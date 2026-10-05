// Propuesta de despacho de las 20:00. Arma el lote de la noche y NO ESCRIBE NADA: deja
// `.despacho-propuesta.json` e imprime los pasos exactos del alta, que ejecuta Pancho con su OK.
// El alta de guías es irreversible (plata y, en Urbano, código quemado de por vida), así que este
// script es de sólo lectura por construcción: `mcp()` rechaza cualquier tool que no esté en
// SOLO_LECTURA y cualquier argumento `confirmar`/`generar` en true (ver assertSoloLectura).
//
// Uso:
//   set -a && . ./.env.local; set +a
//   node scripts/despacho-nocturno.mjs                 # la propuesta de hoy
//   node scripts/despacho-nocturno.mjs --viejos         # suma el arrastre de más de 7 días al lote
//   node scripts/despacho-nocturno.mjs --check          # self-check, sin base ni red
//
// LA COLA SALE DE VELTRON, NO DE LOS TAGS DE SHOPIFY (medido 03/09/2026, adenda en
// 10-BioLabs/Operaciones-COD.md): derivarla de los tags daba 3 de 73 en Urbano porque el
// `confirmado` de Shopify llega atrasado — por poco no se despachan 71 pedidos de un día. Los tags
// cierran bien del lado del despacho (`despachado` ⟺ tiene guía) y mienten del lado de la apertura.
//
// Pero Veltron tampoco alcanza solo: es autoritativo para "está confirmado", NO para "no tiene
// guía". Si el alta se hizo por fuera (scripts/redespacho.mjs pega directo contra el courier),
// Veltron nunca se enteró y el pedido queda en su cola para siempre. Medido el 03/09/2026: los 3
// Fixy más viejos de la cola (19222, 19378, 19387) ya tenían guía del 11/08 — dos entregadas y una
// devuelta. Proponerlos habría creado 3 guías duplicadas. De ahí las tres fuentes con rol fijo:
//   · Veltron           → la cola (quién está confirmado y esperando etiqueta)
//   · shipments + APIs  → si la guía existe DE VERDAD (la base es barata, el courier es fresco)
//   · el panel          → lo que Veltron no sabe: el código de depósito (/logistica?t=preparar) y
//                         la limpieza del CSV de Mi Correo (/logistica?t=correo)
// Los que ya tienen guía no se proponen: salen aparte, con el CSV para devolvérsela a Veltron por
// `importar_csv_guias` — que además es lo que los saca de la cola y hace seguro el alta en lote.
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
// Tope de seguridad: una cola que no se vació en días (o algo raro del otro lado) no debe
// convertirse en 300 guías reales sin que alguien lo mire. 150 porque una noche normal son ~90 de
// alta — medido el 03/09/2026: Fixy 19 + Urbano 74 — y el tope tiene que cazar la anomalía, no la rutina.
const TOPE = Number(arg("tope", 150));
// Arrastre: a partir de acá el pedido no entra al lote sin que alguien lo mire (ver antiguedad()).
const DIAS_VIEJO = Number(arg("dias-viejo", 7));
const VIEJOS = process.argv.includes("--viejos");

// Desde el 03/10/2026 el pago anticipado no va más por Correo: lo lleva `urbano_anticipado`, otra
// cuenta de Urbano (shipper 4565, servicio E, SIN cobro en la puerta) con guía `BLABSA<orden>`.
// Veltron lo dice en ver_carriers → `pago_anticipado_lo_lleva`. Correo (`andreani`) quedó en 0.
const CARRIERS = [
  { key: "fixy", nombre: "FIXY", alta: "courier" },
  { key: "urbano", nombre: "URBANO", alta: "courier" },
  { key: "urbano_anticipado", nombre: "URBANO ANTICIPADO", alta: "courier" },
];

const TZ = "America/Argentina/Buenos_Aires";
// El job corre a las 20:00 de acá y Veltron devuelve todo en UTC: el día tiene que ser el local o el
// arrastre se corre solo entre las 21:00 y la medianoche.
export const diaLocal = (d) => new Date(d).toLocaleDateString("sv-SE", { timeZone: TZ });

// Días de antigüedad del pedido contra el día local de la corrida. null = Veltron no dio fecha.
export function antiguedad(fechaISO, hoyISO) {
  if (!fechaISO) return null;
  const dia = diaLocal(fechaISO);
  return Math.round((Date.parse(`${hoyISO}T12:00:00Z`) - Date.parse(`${dia}T12:00:00Z`)) / 86_400_000);
}

// El depósito arma por unidades, así que la propuesta sale en ese orden — igual que el PDF de
// etiquetas que ordena /logistica?t=preparar.
export const porUnidades = (a, b) =>
  (Number(a.un ?? 0) - Number(b.un ?? 0)) ||
  String(a.sku ?? "").localeCompare(String(b.sku ?? "")) ||
  Number(a.order_number ?? 0) - Number(b.order_number ?? 0);

// COD o prepago. Se decide por el MEDIO DE PAGO y no por el courier: con el prepago mudándose de
// Correo a Urbano, el courier deja de decir el canal (decisión de Pancho, 03/09/2026). Un envío
// prepago que salga con "Valor Contrareembolso" impreso se le cobra al cliente dos veces.
export const esCOD = (metodoPago) => /^cod_/.test(String(metodoPago ?? ""));

// CSV para `importar_csv_guias` (validarlo antes con `validar_csv_guias`, que no escribe).
export function csvGuias(rows) {
  return ["referencia,carrier,guia", ...rows.map((r) => `${r.order_number},${r.carrier},${r.guia}`)].join("\r\n");
}

// Corre `fn` sobre `items` en tandas de `tam`, `paralelo` tandas a la vez, con hasta `intentos` por
// tanda. Devuelve lo que contestó y los ítems de las tandas que fallaron todas las veces, para que el
// aviso diga CUÁNTOS quedaron sin chequear y no sólo "no corrió".
// Por qué estos números en la masiva de Urbano (medido 03/10/2026, cuenta 4362): el tiempo crece
// lineal con la tanda — 10 códigos 6-7 s, 25 → 10 s, 50 → 13-28 s, 100 → 30-61 s (los que existen
// tardan casi el doble que los que no). Con tandas de 100 y 30 s, la cola de 181 del 03/10 se
// abortó entera. En paralelo no se degrada: 4×25 a la vez = 6,5 s en total, 8×25 = 8,6 s.
export async function enTandas(items, { tam, paralelo, intentos }, fn) {
  const tandas = [];
  for (let i = 0; i < items.length; i += tam) tandas.push(items.slice(i, i + tam));
  const resultados = [];
  const fallidos = [];
  let error = null;
  for (let i = 0; i < tandas.length; i += paralelo) {
    await Promise.all(tandas.slice(i, i + paralelo).map(async (t) => {
      for (let k = 1; k <= intentos; k++) {
        try { resultados.push(...await fn(t)); return; } catch (e) { error = e.message; }
      }
      fallidos.push(...t);
    }));
  }
  return { resultados, fallidos, error };
}

// Estados de shipments que NO cuentan como guía vigente (la pieza ya no está en la calle).
const NO_VIGENTE = new Set(["devuelto", "cancelado"]);

// Acá se decide qué se propone y qué no, así que es una función y no diez líneas sueltas en el
// cuerpo: --check la cubre con casos armados que una corrida real casi nunca alcanza (el arrastre
// viejo, el pedido que está en Veltron y no en nuestra base, las unidades que no coinciden).
// `base` es order_number → { producto, un, guias[] } y `vivas` order_number → por qué el courier ya
// tiene la pieza. Ninguna de las dos manda sola: alcanza con que UNA diga que hay guía.
export function repartir(filas, { base = new Map(), vivas = new Map(), hoy, diasViejo = 7, viejosAdentro = false, avisos = [] } = {}) {
  const lote = Object.fromEntries(CARRIERS.map((c) => [c.key, []]));
  const reparar = [];   // tiene guía de verdad: hay que devolvérsela a Veltron, no dar de alta otra
  const viejos = [];    // arrastre de más de diasViejo: se mira antes de despachar
  const sinBase = [];   // en la cola de Veltron pero no en nuestra base
  const sinOrden = [];  // sin nº de orden: no hay remito posible, no se da de alta (ver abajo)

  for (const fila of filas) {
    const b = fila.order_number ? base.get(fila.order_number) : null;
    const f = { ...fila, producto: b?.producto ?? null, un_base: b?.un ?? null };
    f.dias ??= antiguedad(f.fecha, hoy);
    // Sin número de orden no hay remito que mandarle al courier, y el alta la hace Veltron con lo
    // que tenga: en Fixy manda la CADENA "null" (guía 1805691, 03/09/2026 — se encuentra sólo
    // buscando remito "null", y la próxima alta sin orden colisiona con ella) y en Urbano cae a
    // `BLABS<pedido_id>`, que pisa order_numbers reales — BLABS4111…BLABS4122 quedaron quemados de
    // por vida contra pedidos de marzo que llevan esos mismos números. Fuera del lote SIEMPRE, ni
    // con --viejos: acá no se puede elegir el remito, así que lo único que se puede hacer es no
    // autorizar el alta.
    if (!f.order_number) { sinOrden.push(f); continue; }
    // La cuenta anticipada no cobra en la puerta: un COD por ahí sale regalado. Fuera, siempre.
    if (f.carrier === "urbano_anticipado" && f.cod) {
      avisos.push(`#${f.order_number}: es COD (${f.pago}) y Veltron lo manda por Urbano anticipado, que NO cobra — fuera del lote, pasarlo a urbano`);
      continue;
    }
    if (!b) sinBase.push(f);
    if (f.un != null && f.un_base != null && Number(f.un) !== Number(f.un_base)) {
      avisos.push(`#${f.order_number}: Veltron dice ${f.un} u. y la base ${f.un_base} — el bulto se puede armar mal, mirar antes`);
    }

    // Una guía devuelta (o cancelada) no es guía vigente: el pedido que vuelve a la cola de Veltron
    // es un REENVÍO pago (#22726, #23172, #25062 — 04/10/2026) y necesita alta nueva. Con `guias[0]`
    // a secas salían como "ya tiene guía" y nunca se despachaban.
    const guia = b?.guias?.find((g) => !NO_VIGENTE.has(g.estado));
    if (!guia && b?.guias?.length) {
      avisos.push(`#${f.order_number}: reenvío — la guía anterior (${b.guias.map((g) => `${g.tracking} ${g.estado}`).join(", ")}) no está vigente; el alta nueva necesita otro código (Urbano: BLABS${f.order_number}R1, ver redespacho.mjs) y conviene confirmar que no se haya reenviado ya por fuera`);
    }
    if (guia) { reparar.push({ ...f, guia: guia.tracking, guia_courier: guia.courier, despachada: guia.despachada, estado: guia.estado, via: "shipments" }); continue; }
    if (f.order_number && vivas.has(f.order_number)) { reparar.push({ ...f, guia: null, via: vivas.get(f.order_number) }); continue; }
    // Sin fecha se trata como arrastre: no saber de cuándo es un pedido no es razón para despacharlo.
    if (f.dias == null || f.dias > diasViejo) { (viejosAdentro ? lote[f.carrier] : viejos).push(f); continue; }
    lote[f.carrier].push(f);
  }
  for (const k of Object.keys(lote)) lote[k].sort(porUnidades);
  return { lote, reparar, viejos, sinBase, sinOrden, avisos };
}

// ---------------- Veltron por MCP (sólo lectura) ----------------
const MCP_URL = process.env.VELTRON_MCP_URL ?? "https://ecomdash-board-platform-production.up.railway.app/mcp";
// Las tools de escritura de Veltron NO se llaman desde acá: el alta la aprueba Pancho. Si alguna
// vez hay que ejecutarla, va en otro archivo — este tiene que poder leerse y confiarse de una.
const SOLO_LECTURA = new Set(["descargar_etiquetas_pendientes", "listar_pedidos", "ver_pedido"]);

export function assertSoloLectura(name, args = {}) {
  if (!SOLO_LECTURA.has(name)) throw new Error(`despacho-nocturno es de sólo lectura: ${name} no está permitida acá`);
  for (const k of ["confirmar", "generar", "marcar_despachado", "forzar", "avisar_cliente"]) {
    if (args[k] === true) throw new Error(`despacho-nocturno es de sólo lectura: ${name} con ${k}=true`);
  }
  return true;
}

let rpcId = 0;
async function mcp(name, args = {}) {
  assertSoloLectura(name, args);
  if (!process.env.VELTRON_API_KEY) throw new Error("falta VELTRON_API_KEY (panel Veltron → Conexiones → API)");
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.VELTRON_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(90_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${txt.slice(0, 200)}`);
  // El endpoint contesta JSON plano, pero el transporte admite SSE: si algún día devuelve el stream,
  // el payload viene en las líneas `data:`.
  const body = txt.startsWith("event:") || txt.startsWith("data:")
    ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("")
    : txt;
  const res = JSON.parse(body);
  if (res.error) throw new Error(`${name}: ${res.error.message ?? JSON.stringify(res.error)}`);
  const text = (res.result?.content ?? []).map((c) => c.text ?? "").join("");
  if (res.result?.isError) throw new Error(`${name}: ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${name}: respuesta que no es JSON: ${text.slice(0, 200)}`);
  }
}

if (process.argv.includes("--check")) {
  const { strict: a } = await import("node:assert");

  a.equal(antiguedad("2026-09-03T14:40:13.941335+00:00", "2026-09-03"), 0);
  a.equal(antiguedad("2026-09-02T23:30:00+00:00", "2026-09-03"), 1, "23:30 UTC del 2 es el 2 a las 20:30 de acá");
  // 02:30 UTC del 3 son las 23:30 del 2 en Buenos Aires: con el día UTC este pedido sería de hoy.
  a.equal(antiguedad("2026-09-03T02:30:00+00:00", "2026-09-03"), 1, "el día es el local, no el UTC");
  a.equal(antiguedad("2026-08-08T11:42:54.674+00:00", "2026-09-03"), 26);
  a.equal(antiguedad(null, "2026-09-03"), null);

  a.deepEqual(
    [{ un: 3, order_number: 5 }, { un: 1, order_number: 9 }, { un: 1, order_number: 2 }].sort(porUnidades).map((o) => o.order_number),
    [2, 9, 5],
  );

  a.equal(
    csvGuias([{ order_number: "19222", carrier: "fixy", guia: "1764787" }]),
    "referencia,carrier,guia\r\n19222,fixy,1764787",
  );

  // El candado de sólo lectura es el punto del archivo: si esto deja de fallar, el job puede gastar.
  a.equal(assertSoloLectura("descargar_etiquetas_pendientes", { carrier: "fixy", generar: false }), true);
  a.throws(() => assertSoloLectura("descargar_etiquetas_pendientes", { carrier: "fixy", generar: true }), /sólo lectura/);
  a.throws(() => assertSoloLectura("generar_etiqueta", { pedido_id: 1 }), /sólo lectura/);
  a.throws(() => assertSoloLectura("marcar_despachado", { pedido_id: 1, confirmar: true }), /sólo lectura/);
  a.throws(() => assertSoloLectura("importar_csv_guias", { csv: "x" }), /sólo lectura/);
  // --- reparto: las ramas que la corrida real casi nunca toca ---
  const hoy = "2026-09-03";
  const ped = (o) => ({ carrier: "fixy", nombre: "FIXY", alta: "courier", pedido_id: 1, order_number: "100",
    cliente: "X", cp: "1000", sku: "Pureza-02b", un: 2, fecha: `${hoy}T12:00:00Z`, ...o });
  const conBase = (o = {}) => new Map([["100", { producto: "Pureza", un: 2, guias: [], ...o }]]);

  const normal = repartir([ped()], { base: conBase(), hoy });
  a.equal(normal.lote.fixy.length, 1);
  a.equal(normal.lote.fixy[0].producto, "Pureza", "el producto lo pone la base, no Veltron");
  a.equal(normal.reparar.length + normal.viejos.length + normal.sinBase.length, 0);

  // Ya tiene guía en shipments: NO se propone. Es el caso de las 3 Fixy del 11/08 (ver cabecera).
  const conGuia = repartir([ped()], { base: conBase({ guias: [{ tracking: "1764787", courier: "fixy", despachada: "2026-08-11", estado: "entregado" }] }), hoy });
  a.equal(conGuia.lote.fixy.length, 0);
  a.equal(conGuia.reparar[0].guia, "1764787");
  a.equal(conGuia.reparar[0].via, "shipments");

  // Reenvío: la única guía está devuelta → entra al lote para alta nueva, con aviso.
  const reenvio = repartir([ped()], { base: conBase({ guias: [{ tracking: "BLABS22726", courier: "urbano", despachada: "2026-09-03", estado: "devuelto" }] }), hoy });
  a.equal(reenvio.lote.fixy.length, 1, "una guía devuelta no es guía vigente");
  a.equal(reenvio.reparar.length, 0);
  a.match(reenvio.avisos[0], /reenvío/);
  // Devuelta + la nueva ya dada de alta: manda la vigente, no se duplica.
  const yaReenviado = repartir([ped()], { base: conBase({ guias: [
    { tracking: "BLABS22726", courier: "urbano", estado: "devuelto" },
    { tracking: "BLABS22726R1", courier: "urbano", estado: "en_transito" }] }), hoy });
  a.equal(yaReenviado.lote.fixy.length, 0);
  a.equal(yaReenviado.reparar[0].guia, "BLABS22726R1");

  // La base todavía no la tiene pero el courier sí: misma decisión, sin número de guía.
  const viva = repartir([ped()], { base: conBase(), vivas: new Map([["100", "Fixy ya tiene el remito (guía 999)"]]), hoy });
  a.equal(viva.lote.fixy.length, 0);
  a.equal(viva.reparar[0].guia, null);

  // Arrastre viejo: fuera del lote salvo --viejos, y nunca en silencio.
  const viejo = ped({ fecha: "2026-08-08T11:42:54Z" });
  a.equal(repartir([viejo], { base: conBase(), hoy }).viejos.length, 1);
  a.equal(repartir([viejo], { base: conBase(), hoy }).lote.fixy.length, 0);
  a.equal(repartir([viejo], { base: conBase(), hoy, viejosAdentro: true }).lote.fixy.length, 1);
  // Sin fecha se trata como arrastre: no saber de cuándo es no es razón para despacharlo.
  a.equal(repartir([ped({ fecha: null })], { base: conBase(), hoy }).viejos.length, 1);

  // En Veltron y no en nuestra base (sync atrasado): se despacha igual, pero se avisa y sin producto.
  const huerfano = repartir([ped()], { base: new Map(), hoy });
  a.equal(huerfano.lote.fixy.length, 1);
  a.equal(huerfano.sinBase.length, 1);
  a.equal(huerfano.lote.fixy[0].producto, null, "sin base no hay producto: el código va a mano");

  // COD por la cuenta anticipada: no cobra en la puerta, así que no se propone jamás.
  const codAnt = repartir([ped({ carrier: "urbano_anticipado", cod: true, pago: "cod_efectivo" })], { base: conBase(), hoy });
  a.equal(codAnt.lote.urbano_anticipado.length, 0, "un COD no sale por la cuenta que no cobra");
  a.match(codAnt.avisos[0], /NO cobra/);
  a.equal(repartir([ped({ carrier: "urbano_anticipado", cod: false })], { base: conBase(), hoy }).lote.urbano_anticipado.length, 1);

  // Unidades que no coinciden: el bulto se puede armar mal, así que sale aviso (pero se propone).
  const desacuerdo = repartir([ped({ un: 3 })], { base: conBase(), hoy });
  a.equal(desacuerdo.lote.fixy.length, 1);
  a.match(desacuerdo.avisos[0], /Veltron dice 3 u\. y la base 2/);

  // SIN NÚMERO DE ORDEN: no se propone el alta jamás. Es el caso del 03/09/2026 — 13 pedidos de
  // prueba con shopify_order_number null; los que llegaron a alta le mandaron a Fixy el remito
  // literal "null" (guía 1805691) y a Urbano BLABS4111…4122, códigos quemados contra pedidos reales
  // de marzo que tienen esos mismos números. Este archivo no elige el remito (lo arma Veltron), así
  // que la única defensa es no autorizar el alta.
  const sinNumero = repartir([ped({ order_number: null })], { base: new Map(), hoy });
  a.equal(sinNumero.lote.fixy.length, 0, "un pedido sin orden NO se propone para alta");
  a.equal(sinNumero.sinOrden.length, 1, "y sale listado, no en silencio");
  a.equal(sinNumero.sinBase.length, 0, "no es 'falta en la base': es que no hay con qué darlo de alta");
  // Ni con --viejos, que es el flag que mete al lote todo lo que quedó afuera por antigüedad.
  a.equal(repartir([ped({ order_number: null })], { base: new Map(), hoy, viejosAdentro: true }).lote.fixy.length, 0);

  // El lote sale en el orden en que arma el depósito.
  const orden = repartir([ped({ order_number: "100", un: 3 }), ped({ order_number: "101", un: 1 })], { base: new Map(), hoy });
  a.deepEqual(orden.lote.fixy.map((o) => o.un), [1, 3]);

  // Guarda fresca en tandas: un timeout se reintenta, y si la tanda vuelve a fallar sus pedidos salen
  // contados como sin chequear (el 03/10/2026 el aviso decía sólo "no corrió" con 181 en la cola).
  const llamadas = new Map();
  const t = await enTandas([1, 2, 3, 4, 5], { tam: 2, paralelo: 2, intentos: 2 }, async (lote) => {
    const n = (llamadas.get(lote[0]) ?? 0) + 1;
    llamadas.set(lote[0], n);
    if (lote[0] === 1 && n === 1) throw new Error("timeout");  // falla una vez y el reintento contesta
    if (lote[0] === 5) throw new Error("timeout");             // falla siempre
    return lote;
  });
  a.deepEqual([t.resultados.sort(), t.fallidos, t.error, llamadas.get(5)], [[1, 2, 3, 4], [5], "timeout", 2]);

  console.log("✓ despacho-nocturno: 44 casos OK");
  process.exit(0);
}

const HOY = diaLocal(new Date());

// ---------------- 1. la cola, de Veltron ----------------
// La cola sale de `listar_pedidos` PAGINADO y no de `descargar_etiquetas_pendientes`, que corta en
// 100 sin decirlo: Urbano ya viene en 81 y con el prepago mudándose de Correo se pasa. Los dos dan
// lo mismo hoy (Fixy 19 = 19, medido 03/09/2026) porque el alta mueve el pedido a `preparando` y
// deja de ser `confirmado` — pero uno pagina y el otro trunca, así que manda el que pagina.
// El otro queda de control cruzado: si difieren, algo cambió del lado de Veltron y hay que mirarlo.
const cola = {};
const detalle = new Map(); // `${carrier}:${pedido_id}` → fila de listar_pedidos
const avisos = [];

const desde = new Date(Date.parse(`${HOY}T12:00:00Z`) - 120 * 86_400_000).toISOString().slice(0, 10);
for (const c of CARRIERS) {
  const pendientes = [];
  // El 29/09/2026 `listar_pedidos` empezó a tirar 400 "Vista inválida" para todo carrier (bug de
  // Veltron con el param nuevo `vista`, ni con vista:null pasa). Un error cuenta como "vino vacío":
  // cae a la red de seguridad de abajo en vez de voltear la noche entera.
  try {
  for (let page = 1, paginas = 1; page <= paginas && page <= 20; page++) {
    const r = await mcp("listar_pedidos", {
      carrier: c.key, estado: ["confirmado"], preset: "custom", desde, hasta: HOY, page, page_size: 100,
    });
    paginas = Number(r.paginas ?? 1);
    for (const p of r.pedidos ?? []) {
      // Un `confirmado` con guía no debería existir (el alta lo pasa a `preparando`), pero si el
      // estado quedó a mitad de camino, la guía manda: no se propone.
      if (p.guia) continue;
      detalle.set(`${c.key}:${p.id}`, p);
      pendientes.push({ id: p.id, shopify_order_number: p.shopify_order_number, cliente_nombre: p.cliente_nombre, cliente_cp: p.cliente_cp, cliente_provincia: p.cliente_provincia });
    }
  }
  } catch (e) {
    avisos.push(`${c.nombre}: listar_pedidos falló (${String(e.message).slice(0, 80)})`);
    pendientes.length = 0;
  }
  cola[c.key] = pendientes;

  const { total = 0, pendientes: crudos = [] } = await mcp("descargar_etiquetas_pendientes", { carrier: c.key, generar: false });

  // Red de seguridad: si el listado paginado viene vacío y la otra fuente ve cola, manda la otra.
  // El 04/09/2026 `listar_pedidos` empezó a devolver 0 para TODO —incluso sin filtros— mientras
  // había 79 pedidos esperando; sin esto la propuesta decía "nada para despachar" y la noche no
  // salía. Que la fuente preferida se caiga no puede dejar al depósito sin lote.
  if (!pendientes.length && total > 0) {
    avisos.push(`${c.nombre}: listar_pedidos devolvió 0 y hay ${total} pendientes — se usa descargar_etiquetas_pendientes (tope 100) y hay que avisarle a Veltron`);
    for (const p of crudos) {
      pendientes.push({ id: p.id, shopify_order_number: p.shopify_order_number, cliente_nombre: p.cliente_nombre, cliente_cp: p.cliente_cp, cliente_provincia: p.cliente_provincia });
      // Sin listar_pedidos no hay sku ni cantidad: se pide de a uno, que es lento pero es la única
      // forma de saber qué lleva cada bulto.
      if (!detalle.has(`${c.key}:${p.id}`)) {
        const v = await mcp("ver_pedido", { pedido_id: p.id, carrier: c.key });
        detalle.set(`${c.key}:${p.id}`, v?.pedido ?? v);
      }
    }
  } else if (total !== pendientes.length && total < 100) {
    avisos.push(`${c.nombre}: la cola paginada da ${pendientes.length} y descargar_etiquetas_pendientes da ${total} — deberían coincidir`);
  }
  if (total >= 100) avisos.push(`${c.nombre}: descargar_etiquetas_pendientes llegó a su tope de 100 (la cola real es ${pendientes.length}) — el alta en lote por esa tool ya no alcanza para el día`);
}

// ---------------- 2. lo que sabe la casa: ¿ya tiene guía? ----------------
const filas = [];
for (const c of CARRIERS) {
  for (const p of cola[c.key]) {
    const d = detalle.get(`${c.key}:${p.id}`) ?? {};
    const fecha = d.fecha_confirmacion ?? d.fecha_pedido ?? d.created_at ?? null;
    filas.push({
      carrier: c.key, nombre: c.nombre, alta: c.alta, pedido_id: p.id,
      order_number: p.shopify_order_number ?? d.shopify_order_number ?? null,
      cliente: p.cliente_nombre ?? d.cliente_nombre ?? "?",
      cp: p.cliente_cp ?? d.cliente_cp ?? "?", provincia: p.cliente_provincia ?? d.cliente_provincia ?? "?",
      sku: d.sku ?? null, un: d.cantidad ?? null, total: d.total ?? null,
      pago: d.metodo_pago ?? null, cod: esCOD(d.metodo_pago),
      fecha, dias: antiguedad(fecha, HOY),
      guia_veltron: d.guia ?? null,
    });
  }
}

const numeros = filas.map((f) => f.order_number).filter(Boolean);
const base = new Map();  // order_number → { creada, un, producto, guias: [{tracking, courier, despachada}] }
if (numeros.length) {
  const pg = (await import("pg")).default;
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await db.connect();
  const { rows } = await db.query(
    `select o.order_number, o.created_at::date as creada,
            s.tracking, s.courier as s_courier, s.dispatched_at::date as despachada, s.status_canonical,
            (select sum(oi.pack) from order_items oi where oi.order_id = o.id) as un,
            (select case when count(distinct oi.product_id) = 1 then min(p.name) end
               from order_items oi join products p on p.id = oi.product_id
              where oi.order_id = o.id) as producto
       from orders o
       left join shipments s on s.order_id = o.id
      where o.order_number = any($1)`,
    [numeros],
  );
  await db.end();
  for (const r of rows) {
    const e = base.get(r.order_number) ?? { creada: r.creada, un: r.un, producto: r.producto, guias: [] };
    if (r.tracking) e.guias.push({ tracking: r.tracking, courier: r.s_courier, despachada: r.despachada, estado: r.status_canonical });
    base.set(r.order_number, e);
  }
}

// Guarda fresca: la base va por detrás del sync, y el courier es la única fuente que sabe de verdad
// si la pieza existe. Urbano usa `BLABS<pedido>` como código de cliente — el mismo que arma Veltron,
// verificado 03/09/2026 contra shipments — y en Fixy el remito ES el número de pedido.
// (Ojo: cuando el pedido NO tiene orden de Shopify, Veltron cae a `BLABS<pedido_id>` — probado el
//  03/09/2026 con un pedido de prueba: BLABS4111. Esos no se chequean acá porque sin order_number
//  no hay contra qué preguntar, y los saca del lote la guarda de `repartir()`, que es la única que
//  los mira: hasta el 04/09/2026 esta línea decía que quedaban afuera "por la guarda de arriba" y
//  era falso — la de arriba filtra por `p.guia`, no por orden, y un pedido sin orden con fecha
//  fresca entraba al lote derecho.)
const vivasEnCourier = new Map(); // order_number → texto de por qué está viva
// ponytail: un pedido con guía (aunque esté devuelta) no se consulta: el courier devolvería la misma
// pieza vieja (BLABS<n> / remito n) y bloquearía el reenvío. El hueco: un reenvío dado de alta por
// fuera y todavía no sincronizado — lo cubre el aviso de reenvío de repartir().
const pendientesDe = (k) => filas.filter((f) => f.carrier === k && f.order_number && !base.get(f.order_number)?.guias.length);

// Las dos cuentas de Urbano: cada una con su clave y su prefijo (anticipado = `BLABSA<orden>`, visto
// el 03/10/2026 en la guía BLABSA27789). Preguntar con la cuenta equivocada da "credenciales inválidas".
const CUENTAS_URBANO = [
  { key: "urbano", prefijo: "BLABS", shipper: process.env.URBANO_SHIPPER, password: process.env.URBANO_PASSWORD },
  { key: "urbano_anticipado", prefijo: "BLABSA", shipper: process.env.URBANO_ANT_SHIPPER, password: process.env.URBANO_ANT_PASSWORD },
];
for (const cta of CUENTAS_URBANO) {
  const urb = pendientesDe(cta.key);
  if (!urb.length || !process.env.URBANO_API_URL) continue;
  if (!cta.password) { avisos.push(`${cta.key}: falta la clave en .env.local — la guarda fresca no corrió`); continue; }
  // Tandas de 25, 4 a la vez, 45 s y un reintento: ver la medición en enTandas().
  const { resultados, fallidos, error } = await enTandas(urb, { tam: 25, paralelo: 4, intentos: 2 }, async (lote) => {
    const r = await fetch(`${process.env.URBANO_API_URL.replace(/\/$/, "")}/tracking/consultaTrackingMasivo/`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        autentificacion: { shipper: Number(cta.shipper), password: cta.password },
        datos: lote.map((o) => ({ codigoSeguimiento: `${cta.prefijo}${o.order_number}` })),
      }),
      signal: AbortSignal.timeout(45_000),
    }).then((x) => x.json());
    if (!Array.isArray(r)) throw new Error(`respuesta inesperada: ${JSON.stringify(r).slice(0, 120)}`);
    return r;
  });
  if (fallidos.length) {
    avisos.push(`Urbano (${cta.key}) no contestó el tracking masivo (${error}): ${fallidos.length} de ${urb.length} pedidos quedaron SIN la guarda fresca — mirarlos antes del alta: ${fallidos.map((o) => o.order_number).join(", ")}`);
  }
  for (const x of resultados) {
    if (x.codError === 0) vivasEnCourier.set(String(x.codGestion).slice(cta.prefijo.length), `Urbano ya tiene la pieza (${x.codGestion})`);
  }
}

const fix = pendientesDe("fixy");
if (fix.length && process.env.FIXY_API_TOKEN) {
  const url = `${(process.env.FIXY_API_URL ?? "https://fixy.epresis.com/").replace(/\/$/, "")}/api/v2/seguimiento.json`;
  for (let i = 0; i < fix.length; i += 5) {
    await Promise.all(fix.slice(i, i + 5).map(async (o) => {
      const j = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ api_token: process.env.FIXY_API_TOKEN, remito: o.order_number }),
        signal: AbortSignal.timeout(20_000),
      }).then((x) => x.json()).catch(() => ({}));
      const g = j?.guia?.fechas?.[0]?.guia ?? j?.guia?.guia ?? null;
      if (g || j?.guia) vivasEnCourier.set(o.order_number, `Fixy ya tiene el remito (guía ${g ?? "?"})`);
    }));
  }
}

// ---------------- 3. reparto: lote / reparar / viejos ----------------
const { lote, reparar, viejos, sinBase, sinOrden } = repartir(filas, {
  base, vivas: vivasEnCourier, hoy: HOY, diasViejo: DIAS_VIEJO, viejosAdentro: VIEJOS, avisos,
});

// ---------------- 4. la propuesta ----------------
const u = (l) => l.reduce((s, o) => s + Number(o.un ?? o.un_base ?? 0), 0);
const linea = (o) => `  #${String(o.order_number ?? `id:${o.pedido_id}`).padEnd(6)} ${String(o.producto ?? o.sku ?? "?").padEnd(14)} ${String(o.un ?? o.un_base ?? "?").padStart(2)}u  CP ${String(o.cp).padEnd(5)} ${o.dias === 0 ? "hoy" : o.dias == null ? "sin fecha" : `${o.dias}d`}  ${o.cliente}`;

const totalLote = Object.values(lote).reduce((s, l) => s + l.length, 0);
const todos = Object.values(lote).flat();
const nCod = todos.filter((o) => o.cod).length;
console.log(`\n=== Propuesta de despacho ${HOY} · ${totalLote} pedidos (${nCod} COD · ${todos.length - nCod} prepago) — cola Veltron: ${CARRIERS.map((c) => `${c.nombre} ${cola[c.key].length}`).join(" · ")} ===`);

for (const c of CARRIERS) {
  const l = lote[c.key];
  if (!l.length) { console.log(`\n${c.nombre}: nada para despachar`); continue; }
  console.log(`\n${c.nombre} — ${l.length} pedidos · ${u(l)} unidades`);
  // Partido por medio de pago: el depósito arma igual, pero el COD se cobra en la puerta y el
  // prepago ya está cobrado. Mientras el prepago viva dentro de un courier COD, el corte tiene que
  // estar a la vista de quien aprueba el lote.
  for (const [titulo, filtro] of [["COD (se cobra en la puerta)", (o) => o.cod], ["PREPAGO (ya cobrado)", (o) => !o.cod]]) {
    const sub = l.filter(filtro);
    if (!sub.length) continue;
    if (l.some((o) => o.cod) && l.some((o) => !o.cod)) console.log(`  · ${titulo} — ${sub.length} pedidos · ${u(sub)} u.`);
    for (const o of sub) console.log(linea(o));
  }
  const prepagoEnCOD = l.filter((o) => !o.cod && c.key !== "urbano_anticipado");
  if (prepagoEnCOD.length) {
    console.log(`  ⚠️ ${prepagoEnCOD.length} PREPAGO por ${c.nombre}: la guía NO puede salir con valor de contrareembolso o el repartidor lo cobra de nuevo.`);
    console.log(`     Mirá la primera etiqueta antes de despachar el resto: ${prepagoEnCOD.map((o) => o.pedido_id).slice(0, 5).join(", ")}`);
  }
  const sinProd = l.filter((o) => !o.producto);
  if (sinProd.length) console.log(`  ⚠️ ${sinProd.length} sin producto único en la base (carrito mixto o sync atrasado): el código va a mano en /logistica?t=preparar`);
}

if (reparar.length) {
  console.log(`\n🔧 YA TIENEN GUÍA — no se dan de alta (${reparar.length}). Veltron no se enteró y por eso siguen en su cola:`);
  for (const o of reparar) console.log(`  #${o.order_number} ${o.nombre} → ${o.guia ?? "guía desconocida"}${o.despachada ? ` (despachada ${diaLocal(o.despachada)}, ${o.estado})` : ""} · ${o.via}`);
  console.log("  Dar de alta cualquiera de estos duplica la guía: plata, y en Urbano el código queda quemado.");
}

if (viejos.length) {
  console.log(`\n⏳ ARRASTRE de más de ${DIAS_VIEJO} días — FUERA del lote (${viejos.length}). Sin guía en ningún lado, pero confirmados hace rato: mirar por qué antes de despachar.`);
  for (const o of viejos) console.log(linea(o));
  console.log(`  Si el arrastre es legítimo: --viejos (los suma al lote).`);
}

if (sinBase.length) {
  console.log(`\n❓ EN VELTRON Y NO EN NUESTRA BASE (${sinBase.length}) — el sync de Shopify viene atrasado; el pedido igual se despacha, pero sin producto ni unidades de la base:`);
  for (const o of sinBase) console.log(`  #${o.order_number} ${o.nombre} · ${o.sku ?? "?"} ${o.un ?? "?"}u`);
}

if (sinOrden.length) {
  console.log(`\n⛔ SIN NÚMERO DE ORDEN (${sinOrden.length}) — FUERA del lote, y no hay --flag que los meta.`);
  for (const o of sinOrden) console.log(`  id:${o.pedido_id} ${o.nombre} · ${o.cliente} · CP ${o.cp}`);
  console.log(`  El alta la arma Veltron con el nº de orden: sin él, a Fixy le va el remito "null" (colisiona con la guía 1805691)`);
  console.log(`  y a Urbano BLABS<pedido_id>, que quema el código de un pedido real con ese número. Mirá si son de prueba y cancelalos.`);
}

for (const a of avisos) console.log(`\n⚠️ ${a}`);

// ---------------- 5. archivos y pasos ----------------
const out = path.join(process.cwd(), ".despacho-propuesta.json");
fs.writeFileSync(out, JSON.stringify({
  fecha: HOY, generado: new Date().toISOString(), tope: TOPE, dias_viejo: DIAS_VIEJO, viejos_incluidos: VIEJOS,
  cola: Object.fromEntries(CARRIERS.map((c) => [c.key, cola[c.key].length])),
  lote: Object.fromEntries(CARRIERS.map((c) => [c.key, lote[c.key].map((o) => ({ pedido_id: o.pedido_id, order_number: o.order_number, un: o.un, sku: o.sku, pago: o.pago, cod: o.cod }))])),
  reparar: reparar.map((o) => ({ carrier: o.carrier, pedido_id: o.pedido_id, order_number: o.order_number, guia: o.guia, via: o.via })),
  arrastre_viejo: viejos.map((o) => ({ carrier: o.carrier, pedido_id: o.pedido_id, order_number: o.order_number, dias: o.dias })),
  sin_base: sinBase.map((o) => o.order_number),
  sin_orden: sinOrden.map((o) => ({ carrier: o.carrier, pedido_id: o.pedido_id, cliente: o.cliente })),
  avisos,
}, null, 1));
console.log(`\npropuesta → ${out}`);

// Sólo las que tenemos de la base: la guarda del courier dice que la pieza existe, no con qué guía.
const csvRows = reparar.filter((o) => o.guia && o.order_number).map((o) => ({ order_number: o.order_number, carrier: o.guia_courier ?? o.carrier, guia: o.guia }));
let csvPath = null;
if (csvRows.length) {
  csvPath = path.join(process.cwd(), ".despacho-guias-huerfanas.csv");
  fs.writeFileSync(csvPath, `${csvGuias(csvRows)}\r\n`);
  console.log(`guías a devolverle a Veltron → ${csvPath}`);
}

const conAlta = Object.values(lote).reduce((n, l) => n + l.length, 0);
if (conAlta > TOPE) {
  console.error(`\n🛑 ${conAlta} guías a dar de alta supera el tope de ${TOPE}. Revisá el lote antes de aprobar nada.`);
  console.error(`   Si es legítimo: --tope ${conAlta}`);
  process.exit(1);
}

console.log("\n--- para ejecutar el alta (con el OK, y en este orden) ---");
if (csvRows.length) {
  console.log(`0. Reparar las ${csvRows.length} huérfanas primero: validar_csv_guias con ${path.basename(csvPath)} y, si da OK, importar_csv_guias(confirmar=true).`);
  console.log("   Además de dejar de mentir, las saca de la cola — que es lo que hace seguro el alta en lote.");
}
for (const c of CARRIERS) {
  const l = lote[c.key];
  if (!l.length) continue;
  const ids = l.map((o) => o.pedido_id);
  const colaLimpia = cola[c.key].length === l.length;
  console.log(`\n${c.nombre} (${l.length}):`);
  if (colaLimpia) {
    console.log(`   descargar_etiquetas_pendientes(carrier="${c.key}", generar=true, confirmar=true) — de a 20 por llamada, ${Math.ceil(l.length / 20)} llamada(s).`);
    console.log(`   Vale porque la cola de Veltron (${cola[c.key].length}) es exactamente el lote aprobado.`);
  } else {
    console.log(`   🛑 NO usar descargar_etiquetas_pendientes(generar=true): la cola tiene ${cola[c.key].length} y el lote ${l.length} — la tool toma los primeros de la cola, no los aprobados.`);
    console.log(`   Ir de a uno, que es idempotente: generar_etiqueta(pedido_id=…, carrier="${c.key}") para ${ids.join(",")}`);
  }
  if (c.key.startsWith("urbano")) console.log(`   Etiquetas juntas: etiquetas_lote(carrier="${c.key}", pedido_ids=[${ids.join(",")}]) → un PDF. (Fixy no tiene lote: sale una por pedido.)`);
}

console.log("\nDespués del alta:");
console.log("  · Las etiquetas van a /logistica?t=preparar: ordena por producto y unidades y estampa el código de depósito (B3), que es lo que Veltron no sabe.");
console.log("    Urbano viene en PDF de 425×283 pt, que es la geometría que el panel ya conoce. Fixy NO: viene como página HTML de fixy.epresis.com y hay que imprimirla a PDF antes (probado 03/09/2026).");
console.log("  · Cuando el bulto SALE: marcar_despachado(pedido_id, carrier, confirmar=true) — sella la fecha y le avisa al cliente por WhatsApp.");
