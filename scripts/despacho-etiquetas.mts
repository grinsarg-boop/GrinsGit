// El otro lado del job de las 20:00: con el lote YA aprobado, da de alta las guías en Veltron, baja
// las etiquetas y devuelve UN solo PDF ordenado como arma el depósito y con el código estampado
// (S3 = Arraigo x3). Es lo que hoy se hace a mano subiendo los PDF a /logistica?t=preparar.
//
// Uso:
//   npx tsx scripts/despacho-etiquetas.mts                          # dry-run del lote de .despacho-propuesta.json
//   npx tsx scripts/despacho-etiquetas.mts --confirmar              # alta + PDF
//   npx tsx scripts/despacho-etiquetas.mts --pedidos fixy:1025 --pedidos urbano:4118 --confirmar
//
// ESCRIBE: `generar_etiqueta` crea la guía en el courier. Es irreversible (plata, y en Urbano el
// código queda quemado), así que sin --confirmar no llama a nada que escriba. La contracara es
// scripts/despacho-nocturno.mjs, que es de sólo lectura por construcción y arma la propuesta.
//
// El orden y el código NO se recalculan acá: salen de lib/label-prep.ts y lib/correo.ts, los mismos
// que usa el panel. Una sola regla para el depósito, un solo lugar donde cambiarla.
//
// La diferencia con el panel: el panel tiene que ADIVINAR de qué pedido es cada página (lee el
// número de la etiqueta y lo cruza con /api/picking). Acá no hace falta: la página y el pedido
// vienen atados de origen, así que ARMAR EL PDF funciona sin orden de Shopify. DAR DE ALTA no: sin
// nº de orden el remito que arma Veltron sale roto y el pedido se saltea (ver la guarda del alta).
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
import { buildCsv, needsSucursal, normalizeRow, parseCsv, productoCode, rowErrors } from "../lib/correo.ts";
import { matchProduct } from "../lib/product-match.ts";
import { htmlToPdf } from "./html2pdf.mjs";

const CONFIRMAR = process.argv.includes("--confirmar");
const OUT_DIR = path.join(process.cwd(), "etiquetas");
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
    andreani: (p.lote.andreani ?? []).map((o: any) => o.pedido_id),
  };
}

// ---------------- Veltron por MCP ----------------
// (transporte igual al de despacho-nocturno.mjs; allá la lista blanca es de sólo lectura y acá no,
//  que es justo la diferencia entre proponer y ejecutar — por eso son dos archivos y no uno.)
const MCP_URL = process.env.VELTRON_MCP_URL ?? "https://ecomdash-board-platform-production.up.railway.app/mcp";
const TENANT = process.env.VELTRON_TENANT_ID ?? "ceca9834-e837-4f96-82a7-8b8edc689dd9";
// `etiquetas_lote` también escribe: además de emitir el CSV, pasa los confirmados a `preparando`.
const ESCRIBEN = new Set(["generar_etiqueta", "etiquetas_lote"]);
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
    // El cupo DIARIO no se arregla esperando: reintentar es tiempo tirado y esconde el problema
    // detrás de 60 errores iguales. Se corta la corrida entera y se dice qué hacer (04/09/2026:
    // "Esta key ya usó el cupo diario de destructivas (60)" — un lote de noche son ~90).
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

// Catálogo: unidades del pack y precio por SKU de oferta. Hace falta porque `cantidad` significa
// DOS cosas distintas según de dónde venga el pedido (medido 03/09/2026):
//   · form COD (todos los del día a día): `cantidad` YA son las unidades. Pureza-02c ("Lleva 3")
//     viene con cantidad 3 y total 59.990 = el precio de UNA oferta. Verificado contra order_items
//     en los 97 pedidos de la noche: cero discrepancias.
//   · creados por API (crear_pedido / CSV): `cantidad` son OFERTAS y el total es precio × cantidad.
//     ARRAIGO-X3K ("Pack x2") con cantidad 2 son 4 frascos y total 159.800.
// El total es lo único que los separa, así que la unidad se deduce de ahí. El depósito arma frascos.
async function unidadesPorSku(): Promise<Map<string, { pack: number; precio: number }>> {
  const m = new Map<string, { pack: number; precio: number }>();
  const r = await fetch(`${MCP_URL.replace(/\/mcp$/, "")}/api/v1/tenant/${TENANT}/catalogo`, {
    headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}` },
    signal: AbortSignal.timeout(30_000),
  }).then((x) => (x.ok ? x.json() : null)).catch(() => null);
  for (const p of r?.productos ?? []) {
    m.set(p.sku, { pack: 1, precio: Number(p.precio_venta_ars ?? 0) });
    for (const o of p.ofertas ?? []) {
      m.set(o.sku, { pack: Number(o.oferta_params?.unidades ?? 1) || 1, precio: Number(o.precio_venta_ars ?? 0) });
    }
  }
  return m;
}

// Unidades físicas del pedido. Ver el comentario de unidadesPorSku(): si el total es el precio de
// la oferta multiplicado por `cantidad`, entonces `cantidad` son ofertas y hay que multiplicar por
// el pack; si no, `cantidad` ya son unidades (y no puede ser menos que el pack).
export function unidadesDe(cantidad: number, total: number, cat?: { pack: number; precio: number }): number {
  const c = Math.max(1, Number(cantidad) || 1);
  if (!cat?.pack || !cat.precio) return c;
  const porOferta = c > 1 && Math.abs(Number(total) - cat.precio * c) < 1;
  return porOferta ? c * cat.pack : Math.max(c, cat.pack);
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

// ---------------- datos ----------------
const lote = loteDeArgs();
const correo = lote.andreani ?? [];
delete lote.andreani;                    // no imprime etiqueta: va por el CSV de carga masiva
const packs = await unidadesPorSku();

type Item = SortKey & {
  carrier: string; pedidoId: number; guia: string | null; code: string | null;
  sku: string | null; cod: boolean; pago: string | null;
};
const items: Item[] = [];
const hoy = new Date().toISOString().slice(0, 10);
const desde = new Date(Date.now() - 120 * 86_400_000).toISOString().slice(0, 10);

// Una pasada de listar_pedidos por carrier en vez de un ver_pedido por pedido: 4,8 s por cada 100
// contra 2,5 s por cada UNO. Lo que no aparezca ahí se busca solo, de a uno.
for (const [carrier, ids] of Object.entries(lote)) {
  if (!ids.length) continue;
  const porId = new Map<number, any>();
  for (const estado of [["confirmado"], ["preparando"]]) {
    for (let page = 1, paginas = 1; page <= paginas && page <= 20; page++) {
      const r = await mcp("listar_pedidos", { carrier, estado, preset: "custom", desde, hasta: hoy, page, page_size: 100 });
      paginas = Number(r.paginas ?? 1);
      for (const p of r.pedidos ?? []) porId.set(p.id, p);
    }
  }
  for (const pedidoId of ids) {
    const p = porId.get(pedidoId) ?? (await mcp("ver_pedido", { pedido_id: pedidoId, carrier })).pedido;
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
    const producto = matchProduct(String(p.producto_titulo ?? p.sku ?? ""));
    const unidades = unidadesDe(Number(p.cantidad ?? 1), Number(p.total ?? 0), packs.get(p.sku));
    items.push({
      carrier, pedidoId, sku: p.sku ?? null, guia: p.guia ?? null, producto, unidades,
      pago: p.metodo_pago ?? null, cod: esCOD(p.metodo_pago),
      code: productoCode({ producto, qty: unidades }),
    });
  }
}

const orden = sortOrder(items);
console.log(`\n=== ${items.length} etiquetas · orden de armado (datos en ${seg(Date.now() - t0)}) ===`);
for (const i of orden) {
  const it = items[i];
  // Se muestra el PRODUCTO, no el SKU: hay pedidos con el SKU viejo pegado (el 23022 vende Pureza
  // con sku Natures-01b, 04/09/2026), y el código sale del título, que es el que dice la verdad.
  // Mostrar el SKU hacía dudar de un código que estaba bien.
  console.log(`  ${String(it.code ?? "—").padEnd(4)} ${it.carrier.padEnd(7)} id:${String(it.pedidoId).padEnd(6)} ${String(it.producto ?? "?").padEnd(10)} ${it.unidades}u  ${it.cod ? "COD    " : "PREPAGO"}  ${it.sku !== it.producto ? `sku ${it.sku} ` : ""}${it.guia ?? ""}`);
}
const sinCode = items.filter((i) => !i.code);
if (sinCode.length) console.log(`\n⚠️ ${sinCode.length} sin código (producto no reconocido): van al final, para revisar a mano.`);
const prepago = items.filter((i) => !i.cod);
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
    try {
      const r = await mcp("generar_etiqueta", { pedido_id: it.pedidoId, carrier: it.carrier });
      const guia = r.pedido?.guia ?? it.guia;
      if (!guia) throw new Error("Veltron no devolvió guía");
      guias.set(it.pedidoId, String(guia));
      if (r.label_url ?? r.etiqueta_url) urls.set(it.pedidoId, r.label_url ?? r.etiqueta_url);
      console.log(`  ✓ ${it.code ?? "—"} ${it.carrier}/${it.pedidoId} → ${guia}  (${seg(Date.now() - t)})`);
    } catch (e) {
      const motivo = (e as Error).message.replace(/\s+/g, " ").slice(0, 220);
      fallidos.push({ it, motivo });
      console.error(`  ✗ ${it.carrier}/${it.pedidoId}: ${motivo}  (${seg(Date.now() - t)})`);
      if (e instanceof CupoAgotado) cupoAgotado = true;
    }
  }));
  if (cupoAgotado) {
    console.error(`\n🛑 Se agotó el cupo diario de escrituras de la API key. Las ${enOrden.length - guias.size} guías que faltan NO se van a poder crear hoy por API.`);
    console.error(`   Se siguen desde el panel de Veltron, o se le pide a Veltron que amplíe el cupo de la key.`);
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
const urb = conGuia.filter((it) => it.carrier !== "fixy");
const loteBytes: { bytes: Uint8Array; paginas: Map<string, number> }[] = [];
if (urb.length) {
  const tUrb = Date.now();
  for (let k = 0; k < urb.length; k += 100) {
    const tanda = urb.slice(k, k + 100);
    try {
      const r = await mcp("etiquetas_lote", { carrier: tanda[0].carrier, pedido_ids: tanda.map((it) => it.pedidoId) });
      const bytes = new Uint8Array(await fetch(r.url, { signal: AbortSignal.timeout(180_000) }).then((x) => x.arrayBuffer()));
      const paginas = await paginasPorGuia(bytes, tanda.map((it) => guias.get(it.pedidoId)!));
      loteBytes.push({ bytes, paginas });
      // Las que no se pudieron ubicar en el PDF del lote se bajan de a una: mejor 3 descargas de más
      // que una etiqueta con el código de otro pedido.
      for (const it of tanda) {
        if (paginas.has(guias.get(it.pedidoId)!)) continue;
        const url = urls.get(it.pedidoId);
        const r2 = url ? await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null) : null;
        if (r2?.ok) bytesPorPedido.set(it.pedidoId, new Uint8Array(await r2.arrayBuffer()));
        else fallidos.push({ it, motivo: "no está en el PDF del lote y no se pudo bajar suelta" });
      }
    } catch (e) {
      console.error(`⚠️ ${tanda[0].carrier} en lote falló (${(e as Error).message.slice(0, 120)}). Bajo de a una.`);
      for (let j = 0; j < tanda.length; j += 5) {
        await Promise.all(tanda.slice(j, j + 5).map(async (it) => {
          const url = urls.get(it.pedidoId);
          const r2 = url ? await fetch(url, { signal: AbortSignal.timeout(60_000) }).catch(() => null) : null;
          if (r2?.ok) bytesPorPedido.set(it.pedidoId, new Uint8Array(await r2.arrayBuffer()));
          else fallidos.push({ it, motivo: "la etiqueta no bajó" });
        }));
      }
    }
  }
  console.log(`etiquetas Urbano: ${urb.length} en ${seg(Date.now() - tUrb)}`);
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
const idxLote = new Map<number, number>();          // índice de cada PDF de lote dentro de `sources`
loteBytes.forEach((l, i) => { sources.push(arrayBuffer(l.bytes)); idxLote.set(i, i); });

for (const it of conGuia) {
  const guia = guias.get(it.pedidoId)!;
  const enLote = loteBytes.findIndex((l) => l.paginas.has(guia));
  if (enLote >= 0) {
    pages.push({ file: idxLote.get(enLote)!, page: loteBytes[enLote].paginas.get(guia)!, courier: it.carrier as any, code: it.code });
    continue;
  }
  const bytes = bytesPorPedido.get(it.pedidoId);
  if (!bytes) continue;                              // ya quedó anotado en `fallidos`
  const conTinta = await paginasConTinta(bytes);
  if (!conTinta.length) { fallidos.push({ it, motivo: "la etiqueta vino en blanco" }); continue; }
  sources.push(arrayBuffer(bytes));
  pages.push({ file: sources.length - 1, page: conTinta[0], courier: it.carrier as any, code: it.code });
}

const { pdf, sinEstampar } = await buildPdf(sources, pages);
fs.mkdirSync(OUT_DIR, { recursive: true });
const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
const destino = path.join(OUT_DIR, `despacho-${stamp}.pdf`);
fs.writeFileSync(destino, pdf);
console.log(`\netiquetas → ${destino} · ${pages.length} página(s) · total ${seg(Date.now() - t0)}`);

// Y una copia en iCloud Drive, que es la única forma de que el PDF le llegue al teléfono: el
// depósito y Pancho miran esto desde el celular, no desde la Mac. Si iCloud no está, no pasa nada:
// el PDF bueno es el del repo y esto es sólo el carril de entrega.
const ICLOUD = process.env.DESPACHO_ICLOUD_DIR
  ?? path.join(os.homedir(), "Library/Mobile Documents/com~apple~CloudDocs/BioLabs-despacho");
try {
  if (fs.existsSync(path.dirname(ICLOUD))) {
    fs.mkdirSync(ICLOUD, { recursive: true });
    const copia = path.join(ICLOUD, `despacho-${stamp}.pdf`);
    fs.copyFileSync(destino, copia);
    console.log(`copia para el celular → iCloud Drive / ${path.basename(ICLOUD)} / despacho-${stamp}.pdf`);
  }
} catch (e) {
  console.error(`⚠️ no se pudo copiar a iCloud (${(e as Error).message}). El PDF está en ${destino}.`);
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
      const csv = path.join(OUT_DIR, `correo-${stamp}.csv`);
      fs.writeFileSync(csv, buildCsv(buenas), "latin1");
      console.log(`\nCorreo → ${csv} · ${buenas.length} de ${filas.length} fila(s), pasadas por el filtro de /logistica?t=correo`);
      try { if (fs.existsSync(ICLOUD)) fs.copyFileSync(csv, path.join(ICLOUD, `correo-${stamp}.csv`)); } catch { /* el bueno es el del repo */ }
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
