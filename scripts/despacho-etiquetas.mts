// El otro lado del job de las 20:00: con el lote YA aprobado, da de alta las guías en Veltron, baja
// las etiquetas y devuelve UN solo PDF ordenado como arma el depósito y con el código estampado
// (S3 = Arraigo x3). Es lo que hoy se hace a mano subiendo los PDF a /logistica?t=preparar.
//
// Uso:
//   npx tsx scripts/despacho-etiquetas.mts                          # dry-run del lote de .despacho-propuesta.json
//   npx tsx scripts/despacho-etiquetas.mts --confirmar              # alta + PDF
//   npx tsx scripts/despacho-etiquetas.mts --pedidos fixy:1025 --pedidos urbano:4118 --confirmar
//   npx tsx scripts/despacho-etiquetas.mts --solo-etiquetas --confirmar   # rehace el PDF, sin dar de alta nada
//   npx tsx scripts/despacho-etiquetas.mts --despachar              # los que ya cumplieron 16 h (dry-run)
//   npx tsx scripts/despacho-etiquetas.mts --despachar --confirmar  # sella la fecha y avisa al cliente
//
// ESCRIBE: `generar_etiqueta` crea la guía en el courier. Es irreversible (plata, y en Urbano el
// código queda quemado), así que sin --confirmar no llama a nada que escriba. La contracara es
// scripts/despacho-nocturno.mjs, que es de sólo lectura por construcción y arma la propuesta.
//
// El orden y el código NO se recalculan acá: salen de lib/label-prep.ts y lib/picking.ts, los mismos
// que usa el panel. Una sola regla para el depósito, un solo lugar donde cambiarla. El código se
// pide a Shopify con el nº de orden, igual que /logistica?t=preparar — no se deduce del pedido de
// Veltron (regla de Pancho, 28/09/2026).
//
// La diferencia con el panel: el panel tiene que ADIVINAR de qué pedido es cada página (lee el
// número de la etiqueta). Acá la página y el pedido vienen atados de origen. Sin nº de orden de
// Shopify el pedido se saltea: el remito de Veltron sale roto (ver la guarda del alta).
//
// TIEMPOS (medidos 03/09/2026, y son la razón de cómo está armado esto):
//   ver_pedido 2,5 s · listar_pedidos (100 pedidos) 4,8 s · bajar etiqueta Urbano 2,5 s
//   convertir UNA etiqueta de Fixy con Chrome: 22 s  ← el HTML de Fixy trae Bootstrap y FontAwesome
//                                                      de CDN, y Chrome espera esos recursos
// Con 110 etiquetas, de a una eran ~30 min: 4,5 min sólo de ver_pedido y 7 min de Chrome si hay 20
// de Fixy. Por eso los datos salen de UNA pasada de listar_pedidos y las de Fixy se piden TODAS
// juntas y se convierten en una sola corrida de Chrome. Lo único que no se puede acelerar es
// `generar_etiqueta`, que crea la guía: va de a una y se cronometra al log.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildPdf, sortOrder, type OutPage, type SortKey } from "../lib/label-prep.ts";
import { buildCsv, needsSucursal, normalizeRow, parseCsv, rowErrors } from "../lib/correo.ts";
import { codigoDeposito, pickingOrders } from "../lib/picking.ts";
import { shopifyFetch } from "../lib/shopify.ts";
import { htmlToPdf } from "./html2pdf.mjs";
import pg from "pg";

const CONFIRMAR = process.argv.includes("--confirmar");
const DESPACHAR = process.argv.includes("--despachar");
// Rehacer el PDF de un lote ya dado de alta (se perdió, faltaba una etiqueta, se cortó una corrida)
// no puede crear guías ni por error: con --solo-etiquetas el alta queda bloqueada de raíz y un
// pedido sin guía se reporta en vez de generarla.
const SOLO_ETIQUETAS = process.argv.includes("--solo-etiquetas");
// El PDF va a Descargas, que es donde Pancho lo abre e imprime (decidido 06/09/2026). El repo no es
// el lugar: son datos de clientes reales y `etiquetas/` está gitignorada justamente por eso.
const OUT_DIR = process.env.DESPACHO_OUT_DIR ?? path.join(os.homedir(), "Downloads");
// Cuándo se generó cada etiqueta. Veltron no guarda ese momento (updated_at se mueve con cualquier
// edición), y de ese momento cuelga el aviso al cliente, así que lo anotamos nosotros.
const LEDGER = path.join(process.cwd(), ".despacho-etiquetas.json");
const leerLedger = (): Record<string, { carrier: string; guia: string; generada: string }> =>
  fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, "utf8")) : {};
const t0 = Date.now();
const seg = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

// --pedidos fixy:1,2 --pedidos urbano:3   (si no viene, sale de la propuesta de la noche)
function loteDeArgs(): Record<string, number[]> {
  const lote: Record<string, number[]> = {};
  process.argv.forEach((a, i) => {
    if (a !== "--pedidos") return;
    const [carrier, ids] = String(process.argv[i + 1] ?? "").split(":");
    if (carrier && ids) lote[carrier] = (lote[carrier] ?? []).concat(ids.split(",").map(Number).filter(Boolean));
  });
  if (Object.keys(lote).length) return lote;
  const f = path.join(process.cwd(), ".despacho-propuesta.json");
  if (!fs.existsSync(f)) throw new Error("no hay --pedidos ni .despacho-propuesta.json (corré despacho-nocturno.mjs primero)");
  const p = JSON.parse(fs.readFileSync(f, "utf8"));
  // Correo va aparte (no imprime etiqueta, sale un CSV de carga masiva), pero sale de la misma
  // propuesta y en la misma corrida: el depósito necesita las dos cosas juntas.
  return {
    fixy: (p.lote.fixy ?? []).map((o: any) => o.pedido_id),
    urbano: (p.lote.urbano ?? []).map((o: any) => o.pedido_id),
    urbano_anticipado: (p.lote.urbano_anticipado ?? []).map((o: any) => o.pedido_id),
    andreani: (p.lote.andreani ?? []).map((o: any) => o.pedido_id),
  };
}

// ---------------- Veltron por MCP ----------------
// (transporte igual al de despacho-nocturno.mjs; allá la lista blanca es de sólo lectura y acá no,
//  que es justo la diferencia entre proponer y ejecutar — por eso son dos archivos y no uno.)
const MCP_URL = process.env.VELTRON_MCP_URL ?? "https://ecomdash-board-platform-production.up.railway.app/mcp";
const TENANT = process.env.VELTRON_TENANT_ID ?? "ceca9834-e837-4f96-82a7-8b8edc689dd9";
// `etiquetas_lote` también escribe: además de emitir el CSV, pasa los confirmados a `preparando`.
const ESCRIBEN = new Set(["generar_etiqueta", "etiquetas_lote", "marcar_despachado"]);
let rpcId = 0;

// Veltron corta en 30 escrituras por minuto por API key ("429: Más de 30 escrituras por minuto con
// esta key", medido 04/09/2026 mandando 12 en paralelo: 38 de 68 pedidos rebotaron). Ese es el techo
// real del despacho — 150 etiquetas no bajan de 5 minutos — así que el ritmo se respeta de este lado
// en vez de descubrirlo a los golpes. 26 y no 30: el margen cubre las escrituras de etiquetas_lote.
const ESCRITURAS_POR_MIN = Number(process.env.DESPACHO_ESCRITURAS_MIN ?? 26);
class CupoAgotado extends Error {}
const ventana: number[] = [];
async function esperarTurno() {
  for (;;) {
    const ahora = Date.now();
    while (ventana.length && ahora - ventana[0] > 60_000) ventana.shift();
    if (ventana.length < ESCRITURAS_POR_MIN) { ventana.push(ahora); return; }
    await new Promise((r) => setTimeout(r, 60_000 - (ahora - ventana[0]) + 250));
  }
}

async function mcp(name: string, args: Record<string, unknown> = {}, intento = 1): Promise<any> {
  if (ESCRIBEN.has(name) && !CONFIRMAR) throw new Error(`${name} escribe y falta --confirmar`);
  if (ESCRIBEN.has(name)) await esperarTurno();
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.VELTRON_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(120_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${txt.slice(0, 200)}`);
  const res = JSON.parse(txt.startsWith("event:") || txt.startsWith("data:")
    ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("")
    : txt);
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  const text = (res.result?.content ?? []).map((c: any) => c.text ?? "").join("");
  if (res.result?.isError) {
    // El cupo de 60 NO es diario aunque el 429 lo diga: es una ventana corta (medido 27/09/2026, ver Operaciones-COD:1633).
    // Reintentar dentro de la misma corrida no sirve: se corta y los que faltan van en otra corrida
    // (04/09/2026: un lote de noche son ~90; 27/09: 313 de Urbano → tandas de ≤60).
    if (/cupo diario/i.test(text)) throw new CupoAgotado(text.slice(0, 300));
    // El de 30 por minuto sí se arregla solo: puede haber otra sesión escribiendo con la misma key.
    if (/\b429\b|escrituras por minuto/i.test(text) && intento <= 3) {
      await new Promise((r) => setTimeout(r, 20_000 * intento));
      return mcp(name, args, intento + 1);
    }
    throw new Error(`${name}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

// COD o prepago por el MEDIO DE PAGO y no por el courier: con el prepago mudándose de Correo a
// Urbano, el courier deja de decir el canal (decisión de Pancho, 03/09/2026).
const esCOD = (metodoPago: unknown) => /^cod_/.test(String(metodoPago ?? ""));

// Páginas con tinta. La etiqueta de Fixy sale de una página HTML y Chrome le agrega una página
// vacía atrás (medido 03/09/2026). Sin esto el PDF de 20 etiquetas son 40 páginas, la mitad papel.
async function paginasConTinta(bytes: Uint8Array): Promise<number[]> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.getPages().flatMap((p, i) => {
    const k = p.node.Resources()?.keys().map((x) => x.asString()) ?? [];
    return k.includes("/XObject") || k.includes("/Font") ? [i + 1] : [];
  });
}

// Qué página de un PDF trae cada guía. Se LEE del contenido de cada página en vez de confiar en el
// orden en que se pidieron las etiquetas: si el courier reordena, el código terminaría estampado en
// la etiqueta de otro pedido, que es peor que no estamparlo. Verificado 04/09/2026 contra un lote de
// 12 de Urbano (12/12 en orden) y uno de 2 de Fixy.
async function paginasPorGuia(bytes: Uint8Array, guias: string[]): Promise<Map<string, number>> {
  const { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const out = new Map<string, number>();
  for (const [i, page] of doc.getPages().entries()) {
    let texto = "";
    try {
      const c = page.node.Contents();
      const partes = c instanceof PDFArray ? c.asArray().map((r: any) => page.doc.context.lookup(r)) : [c];
      for (const st of partes) if (st) texto += new TextDecoder("latin1").decode(decodePDFRawStream(st as PDFRawStream).decode());
    } catch { continue; }
    const plano = texto.replace(/\s+/g, "");
    for (const g of guias) if (!out.has(g) && plano.includes(g)) { out.set(g, i + 1); break; }
  }
  return out;
}

// La etiqueta de Urbano se puede pedir sólo con la guía, sin pasar por Veltron. Hace falta para
// rehacer un PDF (--solo-etiquetas): ahí no hay alta, y la URL que devuelve `generar_etiqueta` no
// existe. Es el mismo endpoint que usa Veltron (verificado 03/09/2026).
// Cada cuenta con su shipper: contra entrega 4362, anticipado 4565 (sin COD, guía BLABSA<orden>).
const SHIPPER: Record<string, string> = {
  urbano: process.env.URBANO_SHIPPER ?? "4362",
  urbano_anticipado: process.env.URBANO_ANT_SHIPPER ?? "4565",
};
const urlUrbano = (guia: string, carrier: string) =>
  `https://apis.urbano.com.ar/impresionEtiqueta/?tipo=Z10X15&shipper=${SHIPPER[carrier]}&codSeguimiento=${encodeURIComponent(guia)}`;
// Nombre del archivo y del courier en el mail (etiquetas-mail.mjs lee "anticipado" del nombre).
const NOMBRE: Record<string, string> = { fixy: "Fixy", urbano: "Urbano", urbano_anticipado: "Urbano anticipado" };
// Para estampar, la anticipada es la plantilla de Urbano: misma página 425×283 y el hueco de arriba a
// la derecha libre (verificado 03/10/2026 rasterizando BLABSA27789).
const stampCourier = (carrier: string) => (carrier === "urbano_anticipado" ? "urbano" : carrier);

async function htmlAPdf(html: string): Promise<Uint8Array> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "etq-"));
  const h = path.join(tmp, "e.html");
  const p = path.join(tmp, "e.pdf");
  fs.writeFileSync(h, html.replace(/<\/head>/i, "<style>body{margin:0}</style></head>"));
  await htmlToPdf(h, p, 10, 15);
  const out = new Uint8Array(fs.readFileSync(p));
  fs.rmSync(tmp, { recursive: true, force: true });
  return out;
}

const arrayBuffer = (b: Uint8Array) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

// ---------------- modo --despachar ----------------
// El bulto sale del depósito al mediodía siguiente de generada la etiqueta (20:00 + 16 h = 12:00),
// y recién AHÍ se marca despachado: sella la fecha —que es la que usan las cohortes para medir la
// tasa de entrega— y le manda el WhatsApp al cliente. Marcarlo antes le avisa a la gente que su
// pedido salió mientras la caja sigue en el depósito, y fecha mal toda la cohorte.
// Corre aparte del alta a propósito: son dos momentos del día distintos.
if (DESPACHAR) {
  const HORAS = Number(process.argv[process.argv.indexOf("--horas") + 1]) || 16;
  const led = leerLedger();
  const listos: { carrier: string; pedidoId: number; guia: string; horas: number; cliente: string }[] = [];
  const esperando: number[] = [];
  const nuevos: number[] = [];   // vistos por primera vez: se les anota la hora y se marcan en la próxima corrida
  const retenidos: string[] = [];
  const RX_CANCEL = /cancel|anular|anulad|no enviar|no despachar|devolver plata|reembols/i;  // = chequeo-dup-cancel.mts
  const SIN_ESCANEO: Record<string, string[]> = { urbano: ["PI"], urbano_anticipado: ["PI"], fixy: ["41"] };            // alta hecha, el courier no lo tocó

  // Estado en la base de cada guía del ledger: sirve para no preguntarle a Veltron por lo que ya salió
  // (respaldo de abajo) y para retener cancelados y bultos que el courier todavía no tocó.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect(); await db.query("set default_transaction_read_only = on");
  const { rows } = await db.query(`select s.tracking, o.cancelled_at, o.tags, o.raw->>'note' nota, s.status_raw
    from shipments s join orders o on o.id = s.order_id where s.tracking = any($1)`, [Object.values(led).map((v) => v.guia).filter(Boolean)]);
  await db.end();
  const base = new Map(rows.map((r) => [r.tracking, r]));
  // Urbano anticipado todavía no entra al sync (lib/couriers/urbano.ts usa sólo la cuenta 4362), así
  // que no tiene fila en shipments: el escaneo se le pregunta a Urbano con la clave de esa cuenta y la
  // cancelación a `orders` por nº de orden. Sin esto quedarían todos RETENIDOS por "sin fila".
  const ant = (Object.values(led) as any[]).filter((v) => v.carrier === "urbano_anticipado" && v.guia && !base.has(v.guia)).map((v) => v.guia as string);
  if (ant.length) {
    const db2 = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await db2.connect(); await db2.query("set default_transaction_read_only = on");
    const ords = new Map((await db2.query(`select order_number, cancelled_at, tags, raw->>'note' nota from orders where order_number = any($1)`,
      [ant.map((g) => g.replace(/^BLABSA/, ""))])).rows.map((r) => [r.order_number, r]));
    await db2.end();
    for (let i = 0; i < ant.length; i += 100) {
      const r = await fetch(`${(process.env.URBANO_API_URL ?? "https://apis.urbano.com.ar/").replace(/\/$/, "")}/tracking/consultaTrackingMasivo/`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ autentificacion: { shipper: Number(SHIPPER.urbano_anticipado), password: process.env.URBANO_ANT_PASSWORD },
          datos: ant.slice(i, i + 100).map((g) => ({ codigoSeguimiento: g })) }),
        signal: AbortSignal.timeout(30_000),
      }).then((x) => x.json()).catch(() => []);
      for (const x of Array.isArray(r) ? r : []) {
        if (x.codError !== 0) continue;
        const o = ords.get(String(x.codGestion).replace(/^BLABSA/, ""));
        if (!o) continue;   // sin la orden en la base no hay cómo saber si se canceló: queda "sin fila" y RETENIDO
        // `estado` ("MA - …") es el autoritativo; viene " - " antes del primer escaneo y ahí manda el último movimiento.
        const status_raw = String(x.estado ?? "").split(" - ")[0].trim() || x.movimientos?.at(-1)?.check || null;
        base.set(x.codGestion, { tracking: x.codGestion, ...o, status_raw });
      }
    }
  }
  const yaSalio = (guia: string) => /(^|, )despachado(,|$)/.test(base.get(guia)?.tags ?? "");

  // `andreani` (Correo) sigue acá sólo para cerrar los que quedaron en preparando antes del 03/10/2026.
  for (const carrier of ["fixy", "urbano", "urbano_anticipado", "andreani"]) {
    const pedidos: any[] = [];
    try {
      for (let page = 1, paginas = 1; page <= paginas && page <= 20; page++) {
        const r = await mcp("listar_pedidos", { carrier, estado: ["preparando"], preset: "30d", page, page_size: 100 });
        paginas = Number(r.paginas ?? 1);
        pedidos.push(...(r.pedidos ?? []));
      }
    } catch (e: any) {
      // 29/09/2026: listar_pedidos tira 400 "Vista inválida" y este modo se caía entero: del 28 al
      // 30/09 quedaron ~300 pedidos en `preparando` sin WhatsApp de despacho. Respaldo: lo que el
      // ledger anotó en los últimos 7 días y la base no da por despachado, de a uno por ver_pedido.
      console.error(`  ⚠️ ${carrier}: listar_pedidos falló (${String(e.message).slice(0, 80)}) — se sigue con el ledger + ver_pedido`);
      const piso = Date.now() - 7 * 86_400_000;
      for (const [k, v] of Object.entries(led) as [string, any][]) {
        const [c, id] = k.split(":");
        if (c !== carrier || !v.guia || Date.parse(v.generada ?? v.visto ?? 0) < piso || yaSalio(v.guia)) continue;
        const r = await mcp("ver_pedido", { pedido_id: Number(id), carrier }).catch(() => null);
        const p = r?.pedido ?? r;
        if (p?.estado === "preparando") pedidos.push({ ...p, id: Number(id), guia: p.guia ?? v.guia });
      }
    }
    {
      for (const p of pedidos) {
        if (!p.guia) continue;
        const k = `${carrier}:${p.id}`;
        // La hora de la etiqueta sólo la sabemos si la anotamos: la API de Veltron no expone
        // `updated_at` ni una fecha de generación (04/09/2026 — sólo created_at, fecha_pedido,
        // fecha_confirmacion, fecha_despacho y fecha_entrega). Para los que se dieron de alta desde
        // el panel se usa la primera vez que los vimos en `preparando`, que se anota acá mismo.
        // Si no hay ninguna de las dos, NO se marca: mandarle "tu pedido salió" a alguien cuya caja
        // sigue en el depósito no se puede deshacer.
        const desde = led[k]?.generada ?? led[k]?.visto;
        if (!desde) {
          led[k] = { ...(led[k] ?? {}), carrier, guia: p.guia, visto: new Date().toISOString() } as any;
          nuevos.push(p.id);
          continue;
        }
        const horas = (Date.now() - Date.parse(desde)) / 3_600_000;
        if (horas < HORAS) { esperando.push(p.id); continue; }
        // Las 16 h son un proxy de "salió del depósito"; el escaneo del courier es el dato. Sin él, o
        // cancelado, no se avisa (andreani no tiene esos estados en la base: queda con la regla de horas).
        const b = base.get(p.guia);
        const motivo = carrier === "andreani" ? null : !b ? "guía sin fila en shipments" : b.cancelled_at ? "cancelada en Shopify"
          : RX_CANCEL.test(`${b.tags} ${b.nota ?? ""}`) ? "tag/nota de cancelar"
          : SIN_ESCANEO[carrier]?.includes(b.status_raw) ? `sin escaneo del courier (${b.status_raw})` : null;
        if (motivo) retenidos.push(`  RETENER ${carrier} id:${p.id} ${p.guia} — ${motivo}`);
        else listos.push({ carrier, pedidoId: p.id, guia: p.guia, horas, cliente: p.cliente_nombre ?? "" });
      }
    }
  }

  fs.writeFileSync(LEDGER, JSON.stringify(led, null, 1));
  console.log(`\n=== Marcar despachado · ${HORAS} h desde la etiqueta ===`);
  // Este modo cuelga entero de listar_pedidos(preparando) y esa tool devolvió 0 para TODO el
  // 04/09/2026. Sin este aviso, "no hay nada para marcar" y "Veltron está caído" se ven igual, y el
  // cliente se queda sin el aviso de que su pedido salió.
  if (!listos.length && !esperando.length && !nuevos.length) {
    console.error(`⚠️ No se encontró NINGÚN pedido en preparando con guía. O no hay nada, o listar_pedidos`);
    console.error(`   está devolviendo 0 (pasó el 04/09/2026). Chequealo antes de dar por hecho que no hay nada.`);
  }
  console.log(`${listos.length} listo(s) · ${esperando.length} esperando · ${retenidos.length} retenido(s) · ${nuevos.length} sin hora conocida (anotados ahora, entran en la próxima corrida)`);
  for (const r of retenidos) console.log(r);
  for (const l of listos) console.log(`  ${l.carrier.padEnd(8)} id:${String(l.pedidoId).padEnd(6)} ${l.guia.padEnd(12)} ${l.horas.toFixed(0)}h  ${l.cliente}`);

  if (!CONFIRMAR) {
    console.log(`\nDry-run: no se marcó nada. Cada uno manda un WhatsApp al cliente. Para ejecutar: --despachar --confirmar`);
    process.exit(0);
  }
  let ok = 0;
  for (const l of listos) {
    try {
      await mcp("marcar_despachado", { pedido_id: l.pedidoId, carrier: l.carrier, confirmar: true });
      ok++;
      console.log(`  ✓ ${l.carrier}/${l.pedidoId} despachado`);
    } catch (e) {
      console.error(`  ✗ ${l.carrier}/${l.pedidoId}: ${(e as Error).message.replace(/\s+/g, " ").slice(0, 200)}`);
      if (e instanceof CupoAgotado) { console.error("   🛑 cupo de 60 agotado: esperar unos minutos y correr de nuevo con el resto."); break; }
    }
  }
  console.log(`\n${ok}/${listos.length} marcados despachados (y avisados por WhatsApp).`);
  process.exit(0);
}

// ---------------- datos ----------------
const lote = loteDeArgs();
const correo = lote.andreani ?? [];
delete lote.andreani;                    // no imprime etiqueta: va por el CSV de carga masiva

type Item = SortKey & {
  carrier: string; pedidoId: number; guia: string | null; code: string | null;
  sku: string | null; cod: boolean; pago: string | null; order_number: string | null; nota: string;
};
const items: Item[] = [];
const hoy = new Date().toISOString().slice(0, 10);
const desde = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);

// Una pasada de listar_pedidos por carrier en vez de un ver_pedido por pedido: 4,8 s por cada 100
// contra 2,5 s por cada UNO. Lo que no aparezca ahí se busca solo, de a uno.
for (const [carrier, ids] of Object.entries(lote)) {
  if (!ids.length) continue;
  const porId = new Map<number, any>();
  // Incluye los estados posteriores porque rehacer un PDF pasa justamente después: si el pedido ya
  // salió, su etiqueta se sigue necesitando (se perdió, se rompió, hay que reimprimirla).
  // 29/09/2026: listar_pedidos tira 400 "Vista inválida" (bug de Veltron). Si falla, todo sale por
  // el ver_pedido de a uno de abajo: más lento, pero el lote sale.
  try {
    for (const estado of [["confirmado"], ["preparando"], ["despachado"], ["en_camino"]]) {
      for (let page = 1, paginas = 1; page <= paginas && page <= 20; page++) {
        const r = await mcp("listar_pedidos", { carrier, estado, preset: "custom", desde, hasta: hoy, page, page_size: 100 });
        paginas = Number(r.paginas ?? 1);
        for (const p of r.pedidos ?? []) porId.set(p.id, p);
      }
    }
  } catch (e: any) {
    console.error(`  ⚠️ ${carrier}: listar_pedidos falló (${String(e.message).slice(0, 80)}) — se sigue con ver_pedido de a uno`);
  }
  for (const pedidoId of ids) {
    // ver_pedido devuelve el pedido en el nivel de arriba, NO envuelto en `.pedido` (verificado
    // 04/09/2026). generar_etiqueta sí lo envuelve; son dos formas distintas para el mismo objeto.
    const v = porId.get(pedidoId) ?? await mcp("ver_pedido", { pedido_id: pedidoId, carrier });
    const p = v?.pedido ?? v;
    if (!p) { console.error(`  ✗ ${carrier}/${pedidoId}: no existe en Veltron`); continue; }
    // SIN Nº DE ORDEN NO SE DA DE ALTA. El remito lo arma Veltron con el nº de orden y desde acá no
    // se puede elegir: cuando no está, a Fixy le manda la CADENA "null" (así nació la guía 1805691
    // el 03/09/2026 — se encuentra sólo buscando remito "null", y la próxima alta sin orden va a
    // colisionar con ella) y a Urbano `BLABS<pedido_id>`, que quema de por vida el código de un
    // pedido real con ese número: BLABS4111…BLABS4122 pisan los pedidos 4111…4122 de marzo. Por eso
    // es cortar y no completar con un fallback — el fallback ES el otro medio bug.
    // Acá y no en la propuesta porque `--pedidos carrier:id` entra derecho, sin pasar por ella.
    if (!String(p.shopify_order_number ?? "").trim()) {
      console.error(`  ⛔ ${carrier}/${pedidoId} (${p.cliente_nombre ?? "?"}): sin nº de orden de Shopify — NO se da de alta, el remito saldría "null". Si es de prueba, cancelalo en Veltron.`);
      continue;
    }
    // La cuenta anticipada no cobra en la puerta (servicio E): un COD por ahí sale sin cobrar.
    if (carrier === "urbano_anticipado" && esCOD(p.metodo_pago)) {
      console.error(`  ⛔ ${carrier}/${pedidoId} #${p.shopify_order_number}: es COD (${p.metodo_pago}) y Urbano anticipado NO cobra — NO se da de alta. Pasarlo a urbano en Veltron.`);
      continue;
    }
    items.push({
      carrier, pedidoId, sku: p.sku ?? null, guia: p.guia ?? null, producto: null, unidades: null,
      order_number: String(p.shopify_order_number).trim(),
      pago: p.metodo_pago ?? null, cod: esCOD(p.metodo_pago), code: null, nota: "",
    });
  }
}

// El código NO sale del pedido de Veltron (título + cantidad + catálogo de ofertas): sale de
// Shopify por el mismo camino que /logistica?t=preparar (lib/picking.ts, regla de Pancho del
// 28/09/2026). Así el PDF de acá y el que arma el panel con las mismas etiquetas no difieren.
const tShopify = Date.now();
const shopify = new Map((await pickingOrders([...new Set(items.map((i) => i.order_number!))], shopifyFetch)).map((o) => [o.orden, o]));
for (const it of items) Object.assign(it, codigoDeposito(shopify.get(it.order_number!)));
console.log(`  (Shopify: ${shopify.size} pedidos en ${seg(Date.now() - tShopify)})`);

const orden = sortOrder(items);
console.log(`\n=== ${items.length} etiquetas · orden de armado (datos en ${seg(Date.now() - t0)}) ===`);
for (const i of orden) {
  const it = items[i];
  // Se muestra el PRODUCTO, no el SKU: hay pedidos con el SKU viejo pegado (el 23022 vende Pureza
  // con sku Natures-01b, 04/09/2026), y el código sale del título, que es el que dice la verdad.
  // Mostrar el SKU hacía dudar de un código que estaba bien.
  console.log(`  ${String(it.code ?? "—").padEnd(4)} ${it.carrier.padEnd(7)} id:${String(it.pedidoId).padEnd(6)} ${String(it.producto ?? "?").padEnd(10)} ${it.unidades ?? "?"}u  ${it.cod ? "COD    " : "PREPAGO"}  ${it.sku !== it.producto ? `sku ${it.sku} ` : ""}${it.guia ?? ""}`);
}
const sinCode = items.filter((i) => !i.code);
if (sinCode.length) {
  console.log(`\n⚠️ ${sinCode.length} sin código: van al final, para revisar a mano.`);
  for (const it of sinCode) console.log(`   #${it.order_number} (${it.carrier}/${it.pedidoId}): ${it.nota}`);
}
const prepago = items.filter((i) => !i.cod && i.carrier !== "urbano_anticipado");
if (prepago.length) {
  console.log(`\n⚠️ ${prepago.length} PREPAGO por un courier de contra entrega: la guía NO puede salir con valor de`);
  console.log(`   contrareembolso o el repartidor lo cobra de nuevo. Mirá la primera etiqueta antes del resto.`);
}

if (correo.length) {
  console.log(`\nCORREO — ${correo.length} pedido(s) → CSV de carga masiva, no etiqueta: ${correo.join(", ")}`);
}

if (!CONFIRMAR) {
  console.log("\nDry-run: no se dio de alta ninguna guía, ni se bajó ninguna etiqueta, ni se armó el CSV. Para ejecutar: --confirmar");
  process.exit(0);
}

// ---------------- alta ----------------
// De a una y en serie: cada llamada crea una guía real. `generar_etiqueta` es idempotente (si ya
// tiene guía no crea otra), así que reintentar una corrida cortada a la mitad no duplica nada.
// Un pedido que falla NO voltea el lote: con 90 pedidos, cortar en el primer error deja al depósito
// sin las 89 que sí salieron y con las guías ya creadas.
const fallidos: { it: Item; motivo: string }[] = [];
const urls = new Map<number, string>();
const guias = new Map<number, string>();
// De a CONCURRENCIA en paralelo: medido el 04/09/2026, 4 altas simultáneas tardan lo mismo que una
// sola (24,6 s contra 24,7 s), así que el cuello es la espera al courier y no Veltron. En serie, 83
// pedidos eran 20 minutos. Se mantiene bajo igual: si n8n se satura devuelve 502 y hay que mirar
// pedido por pedido cuál quedó sin guía.
const CONCURRENCIA = Number(process.env.DESPACHO_CONCURRENCIA ?? 4);
const tAlta = Date.now();
let cupoAgotado = false;
const enOrden = orden.map((i) => items[i]);
for (let k = 0; k < enOrden.length; k += CONCURRENCIA) {
  await Promise.all(enOrden.slice(k, k + CONCURRENCIA).map(async (it) => {
    const t = Date.now();
    // El que YA tiene guía no pasa por el alta: `generar_etiqueta` sería un no-op, pero igual gasta
    // una de las 60 escrituras diarias de la key. Así, rehacer el PDF de un lote ya despachado
    // (porque se perdió, porque falta una etiqueta) no cuesta cupo.
    if (it.guia) { guias.set(it.pedidoId, it.guia); return; }
    if (SOLO_ETIQUETAS) { fallidos.push({ it, motivo: "no tiene guía y --solo-etiquetas no da de alta" }); return; }
    try {
      const r = await mcp("generar_etiqueta", { pedido_id: it.pedidoId, carrier: it.carrier });
      const guia = r.pedido?.guia ?? it.guia;
      if (!guia) throw new Error("Veltron no devolvió guía");
      guias.set(it.pedidoId, String(guia));
      if (r.label_url ?? r.etiqueta_url) urls.set(it.pedidoId, r.label_url ?? r.etiqueta_url);
      const led = leerLedger();
      led[`${it.carrier}:${it.pedidoId}`] = { carrier: it.carrier, guia: String(guia), generada: new Date().toISOString() };
      fs.writeFileSync(LEDGER, JSON.stringify(led, null, 1));
      console.log(`  ✓ ${it.code ?? "—"} ${it.carrier}/${it.pedidoId} → ${guia}  (${seg(Date.now() - t)})`);
    } catch (e) {
      const motivo = (e as Error).message.replace(/\s+/g, " ").slice(0, 220);
      fallidos.push({ it, motivo });
      console.error(`  ✗ ${it.carrier}/${it.pedidoId}: ${motivo}  (${seg(Date.now() - t)})`);
      if (e instanceof CupoAgotado) cupoAgotado = true;
    }
  }));
  if (cupoAgotado) {
    console.error(`\n🛑 Se agotó el cupo de 60 escrituras de la API key (ventana corta, no diaria). Las ${enOrden.length - guias.size} guías que faltan salen esperando unos minutos y corriendo el script de nuevo con esos pedidos.`);
    console.error(`   Para lotes grandes, pasar --pedidos en tandas de ≤60 desde el arranque.`);
    console.error(`   Lo que ya tiene guía sigue igual: el PDF sale con eso y el resto queda anotado abajo.`);
    break;
  }
}
const conGuia = orden.map((i) => items[i]).filter((it) => guias.has(it.pedidoId));
const yaTenian = enOrden.filter((it) => it.guia).length;
console.log(`\nalta: ${conGuia.length}/${items.length} en ${seg(Date.now() - tAlta)}` +
  (yaTenian ? ` · ${yaTenian} ya tenían guía (no gastaron cupo)` : "") +
  (conGuia.length ? ` · ${seg((Date.now() - tAlta) / conGuia.length)} por guía` : ""));

// ---------------- etiquetas ----------------
const bytesPorPedido = new Map<number, Uint8Array>();

// Urbano: `etiquetas_lote` devuelve UN PDF con hasta 100 etiquetas. Medido 04/09/2026: 12 etiquetas
// en 1,4 s de llamada + 12,5 s de descarga, contra 2,5 s por cada una bajándolas de a una.
const loteBytes: { bytes: Uint8Array; paginas: Map<string, number> }[] = [];
// Una pasada por cuenta: `etiquetas_lote` recibe un solo carrier, y una tanda mezclada pediría la
// anticipada con la cuenta de contra entrega.
for (const cuenta of ["urbano", "urbano_anticipado"]) {
const urb = conGuia.filter((it) => it.carrier === cuenta);
if (urb.length) {
  const tUrb = Date.now();
  // De a 50 y no de a 100: con 101 pedidos `etiquetas_lote` se pasó del timeout (04/09/2026).
  for (let k = 0; k < urb.length; k += 50) {
    const tanda = urb.slice(k, k + 50);
    try {
      const r = await mcp("etiquetas_lote", { carrier: tanda[0].carrier, pedido_ids: tanda.map((it) => it.pedidoId) });
      const bytes = new Uint8Array(await fetch(r.url, { signal: AbortSignal.timeout(180_000) }).then((x) => x.arrayBuffer()));
      const paginas = await paginasPorGuia(bytes, tanda.map((it) => guias.get(it.pedidoId)!));
      loteBytes.push({ bytes, paginas });
      // Las que no se pudieron ubicar en el PDF del lote se bajan de a una: mejor 3 descargas de más
      // que una etiqueta con el código de otro pedido.
      for (const it of tanda) {
        if (paginas.has(guias.get(it.pedidoId)!)) continue;
        const url = urls.get(it.pedidoId) ?? urlUrbano(guias.get(it.pedidoId)!, it.carrier);
        const r2 = url ? await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null) : null;
        if (r2?.ok) bytesPorPedido.set(it.pedidoId, new Uint8Array(await r2.arrayBuffer()));
        else fallidos.push({ it, motivo: "no está en el PDF del lote y no se pudo bajar suelta" });
      }
    } catch (e) {
      console.error(`⚠️ ${tanda[0].carrier} en lote falló (${(e as Error).message.slice(0, 120)}). Bajo de a una.`);
      for (let j = 0; j < tanda.length; j += 5) {
        await Promise.all(tanda.slice(j, j + 5).map(async (it) => {
          const url = urls.get(it.pedidoId) ?? urlUrbano(guias.get(it.pedidoId)!, it.carrier);
          const r2 = url ? await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null) : null;
          if (r2?.ok) bytesPorPedido.set(it.pedidoId, new Uint8Array(await r2.arrayBuffer()));
          else fallidos.push({ it, motivo: "la etiqueta no bajó" });
        }));
      }
    }
  }
  console.log(`etiquetas ${NOMBRE[cuenta]}: ${urb.length} en ${seg(Date.now() - tUrb)}`);
}
}

// Fixy no tiene lote en Veltron, pero SÍ en la API de Fixy: se piden todas las guías juntas a
// print-etiquetas-custom (plantilla `FIXYPAY QR`, la única de la cuenta) y sale un solo HTML que se
// convierte de una. Convertir de a una son 22 s cada una.
const fx = conGuia.filter((it) => it.carrier === "fixy");
if (fx.length) {
  const tFx = Date.now();
  const FX = (process.env.FIXY_API_URL ?? "https://fixy.epresis.com/").replace(/\/$/, "");
  const fd = new FormData();
  fd.set("api_token", String(process.env.FIXY_API_TOKEN));
  fd.set("tipo", "custom");
  fd.set("nombre", "FIXYPAY QR");
  fd.set("is_remito", "false");
  fd.set("ides", JSON.stringify(fx.map((it) => Number(guias.get(it.pedidoId)))));
  const raw = await fetch(`${FX}/api/v2/print-etiquetas-custom`, { method: "POST", body: fd, signal: AbortSignal.timeout(180_000) })
    .then((r) => (r.ok ? r.text() : "")).catch(() => "");
  if (raw) {
    const bytes = await htmlAPdf(raw);
    // El orden se lee del HTML y NO del PDF: el PDF lo genera Chrome con fuentes de encoding propio,
    // así que los dígitos de la guía no quedan como texto plano adentro del contenido y buscarlos
    // ahí no encuentra nada (04/09/2026: 11 de 11 sin ubicar). En el HTML sí están, y el PDF sale
    // en ese mismo orden, con una página en blanco entre medio que descarta paginasConTinta.
    const mias = new Set(fx.map((it) => guias.get(it.pedidoId)!));
    const ordenGuias = [...raw.matchAll(/\b\d{6,9}\b/g)].map((m) => m[0]).filter((g, i, a) => mias.has(g) && a.indexOf(g) === i);
    const conTinta = await paginasConTinta(bytes);
    const paginas = new Map<string, number>();
    if (ordenGuias.length === fx.length && conTinta.length === fx.length) {
      ordenGuias.forEach((g, i) => paginas.set(g, conTinta[i]));
    } else {
      console.error(`⚠️ Fixy: ${ordenGuias.length} guías en el HTML y ${conTinta.length} páginas con tinta para ${fx.length} pedidos — no se puede atar página a pedido con seguridad.`);
    }
    loteBytes.push({ bytes, paginas });
    for (const it of fx) {
      if (paginas.has(guias.get(it.pedidoId)!)) continue;
      fallidos.push({ it, motivo: "no se pudo ubicar su etiqueta en el PDF de Fixy" });
    }
  } else {
    for (const it of fx) fallidos.push({ it, motivo: "Fixy no devolvió las etiquetas" });
  }
  console.log(`etiquetas Fixy: ${fx.length} en ${seg(Date.now() - tFx)} (una sola conversión)`);
}

// ---------------- el PDF ----------------
const sources: ArrayBuffer[] = [];
const pages: OutPage[] = [];
const pageItems: Item[] = [];                       // el pedido de cada página (pages[i] ↔ pageItems[i])
const idxLote = new Map<number, number>();          // índice de cada PDF de lote dentro de `sources`
loteBytes.forEach((l, i) => { sources.push(arrayBuffer(l.bytes)); idxLote.set(i, i); });

for (const it of conGuia) {
  const guia = guias.get(it.pedidoId)!;
  const enLote = loteBytes.findIndex((l) => l.paginas.has(guia));
  if (enLote >= 0) {
    pages.push({ file: idxLote.get(enLote)!, page: loteBytes[enLote].paginas.get(guia)!, courier: stampCourier(it.carrier) as any, code: it.code });
    pageItems.push(it);
    continue;
  }
  const bytes = bytesPorPedido.get(it.pedidoId);
  if (!bytes) continue;                              // ya quedó anotado en `fallidos`
  const conTinta = await paginasConTinta(bytes);
  if (!conTinta.length) { fallidos.push({ it, motivo: "la etiqueta vino en blanco" }); continue; }
  sources.push(arrayBuffer(bytes));
  pages.push({ file: sources.length - 1, page: conTinta[0], courier: stampCourier(it.carrier) as any, code: it.code });
  pageItems.push(it);
}

// Lote sólo de Correo: no hay páginas por definición y el CSV sale más abajo. Hasta el 11/09/2026
// esta guarda cortaba acá con exit 1 y el CSV de Correo nunca se escribía (ni se llamaba a
// etiquetas_lote): sólo corta cuando había etiquetas que armar y ninguna salió.
if (!pages.length && items.length) {
  // Un PDF de 0 páginas pisaría el bueno del día y el depósito se quedaría sin etiquetas
  // (04/09/2026: pasó, por eso está este corte).
  console.error(`\n🛑 Ninguna etiqueta pudo armarse. NO se escribe el PDF para no pisar el que ya existe.`);
  for (const f of fallidos) console.error(`  · ${f.it.carrier}/${f.it.pedidoId}: ${f.motivo}`);
  process.exit(1);
}
const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
const ICLOUD = process.env.DESPACHO_ICLOUD_DIR ?? "";
let sinEstampar = 0;
// Un PDF por courier (Pancho, 29/09/2026): cada uno sale por su canal, y el anticipado no se puede
// mezclar con el de contra entrega porque uno se cobra en la puerta y el otro no.
for (const carrier of [...new Set(pageItems.map((it) => it.carrier))].sort()) {
  const idx = pageItems.flatMap((it, i) => (it.carrier === carrier ? [i] : []));
  const r = await buildPdf(sources, idx.map((i) => pages[i]));
  sinEstampar += r.sinEstampar;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // Nunca pisar un PDF que ya existe: en un mismo día hay más de una tanda (la de la mañana y la de
  // la noche), y el 04/09/2026 la segunda corrida borró la primera. Cada tanda es un archivo.
  // Nombre "Fixy - 27-09-2026.pdf" (pedido de Pancho 27/09/2026).
  const base = `${NOMBRE[carrier] ?? carrier} - ${stamp.split("-").reverse().join("-")}`;
  let destino = path.join(OUT_DIR, `${base}.pdf`);
  for (let n = 2; fs.existsSync(destino); n++) destino = path.join(OUT_DIR, `${base} (${n}).pdf`);
  fs.writeFileSync(destino, r.pdf);
  // Índice al lado del PDF: qué pedido, qué guía y qué código hay en cada página. Sin esto, el mapa
  // vive sólo en el log de la corrida y rearmar o reordenar el PDF depende de no haberlo perdido
  // (04/09/2026: reconstruirlo a mano costó media hora).
  const indice = destino.replace(/\.pdf$/, ".json");
  fs.writeFileSync(indice, JSON.stringify({
    generado: new Date().toISOString(),
    pdf: path.basename(destino),
    paginas: idx.map((i, n) => {
      const it = pageItems[i];
      return { pagina: n + 1, pedido_id: it.pedidoId, order_number: it.order_number, carrier: it.carrier, guia: guias.get(it.pedidoId), codigo: pages[i].code, producto: it.producto, unidades: it.unidades };
    }),
    sin_etiqueta: fallidos.filter((f) => f.it.carrier === carrier).map((f) => ({ pedido_id: f.it.pedidoId, carrier: f.it.carrier, motivo: f.motivo })),
  }, null, 1));

  console.log(`\netiquetas → ${destino} · ${idx.length} página(s) · total ${seg(Date.now() - t0)}`);
  console.log(`índice     → ${path.basename(indice)} (pedido, guía y código de cada página)`);

  // Copia opcional a una carpeta sincronizada (iCloud, Drive) para mirar el PDF desde el teléfono.
  // Apagada por default a pedido de Pancho (04/09/2026). Se prende poniendo DESPACHO_ICLOUD_DIR.
  try {
    if (ICLOUD) {
      fs.mkdirSync(ICLOUD, { recursive: true });
      const copia = path.join(ICLOUD, path.basename(destino));
      fs.copyFileSync(destino, copia);
      console.log(`copia → ${copia}`);
    }
  } catch (e) {
    console.error(`⚠️ no se pudo copiar a ${ICLOUD} (${(e as Error).message}). El PDF está en ${destino}.`);
  }
}

// ---------------- Correo: el CSV de carga masiva, ya filtrado ----------------
// Veltron emite el CSV con los datos crudos del pedido; Mi Correo rechaza el ARCHIVO ENTERO si una
// sola fila trae un signo en un campo de texto. El filtro es el mismo de /logistica?t=correo
// (parseCsv → normalizeRow → buildCsv), así que acá sale listo para subir.
// Lo único que no se puede automatizar es elegir sucursal cuando la dirección no alcanza: esas
// filas se marcan y se resuelven en el panel, porque hay que elegir CUÁL sucursal.
if (correo.length) {
  try {
    const r = await mcp("etiquetas_lote", { carrier: "andreani", pedido_ids: correo });
    const crudo = await fetch(r.url, { signal: AbortSignal.timeout(60_000) }).then((x) => x.text());
    const filas = parseCsv(crudo).map(normalizeRow);
    // Mi Correo rechaza el ARCHIVO ENTERO por una fila mala, así que el CSV sale sólo con las que
    // pasan y las otras se listan: mejor subir 7 de 9 hoy y resolver 2 en el panel, que quedarse
    // sin subir nada. `buildCsv` justamente tira excepción si le entra una fila con errores.
    const problema = filas.map((f, i) => ({ i, f, errores: rowErrors(f), sucursal: needsSucursal(f) }))
      .filter((x) => x.errores.length || x.sucursal);
    const buenas = filas.filter((f) => !rowErrors(f).length && !needsSucursal(f));

    if (buenas.length) {
      let csv = path.join(OUT_DIR, `correo-${stamp}.csv`);
      for (let n = 2; fs.existsSync(csv); n++) csv = path.join(OUT_DIR, `correo-${stamp}-${n}.csv`);
      fs.writeFileSync(csv, buildCsv(buenas), "latin1");
      console.log(`\nCorreo → ${csv} · ${buenas.length} de ${filas.length} fila(s), pasadas por el filtro de /logistica?t=correo`);
      try { if (ICLOUD) fs.copyFileSync(csv, path.join(ICLOUD, path.basename(csv))); } catch { /* el bueno es el del repo */ }
    } else {
      console.error(`\n🛑 Correo: ninguna de las ${filas.length} filas pasó el filtro. No se escribió CSV.`);
    }

    for (const x of problema) {
      const quien = `${x.f.nombre || "?"} · ${x.f.localidad || "?"} ${x.f.cp || ""}`.trim();
      if (x.sucursal) console.error(`   ⚠️ fila ${x.i + 2} (${quien}): sin dirección suficiente — hay que ELEGIR sucursal en /logistica?t=correo`);
      if (x.errores.length) console.error(`   🛑 fila ${x.i + 2} (${quien}): ${x.errores.join(", ")}`);
    }
    if (problema.length) console.error(`   ${problema.length} pedido(s) de Correo quedaron FUERA del CSV: se resuelven en el panel y se suben aparte.`);
    if (r.avisos?.length) for (const a of r.avisos) console.error(`   · ${a}`);
  } catch (e) {
    console.error(`🛑 Correo: no se pudo armar el CSV (${(e as Error).message})`);
  }
}
if (fallidos.length) {
  console.error(`\n🛑 ${fallidos.length} sin etiqueta — NO están en el PDF y hay que mirarlos uno por uno:`);
  for (const f of fallidos) console.error(`  · ${f.it.carrier}/${f.it.pedidoId} (${f.it.code ?? "—"}): ${f.motivo}`);
}
if (sinEstampar) console.error(`⚠️ ${sinEstampar} sin código: la geometría de la etiqueta no es una de las validadas (ver STAMP en lib/label-prep.ts). El bulto se arma mirando la etiqueta.`);
