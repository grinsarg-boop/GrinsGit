// Lista diaria de gestión de visitas fallidas de Fixy, para atención al cliente. SOLO LECTURA.
// Base (eventos de Fixy) → Veltron REST (pedido: cliente, zona, notas, comm_evento) → MCP de Veltron
// (ver_conversacion, listar_conversaciones). No escribe en ningún lado salvo el CSV y el HTML de salida.
// Una fila por guía de Fixy que entra por: falla nueva (127/51/52/48/63 o REBOTADO_1/EN_SUCURSAL), mensaje
// del cliente después de una falla, nota [coordinacion] del bot o derivación abierta.
//
//   node --env-file=.env.local scripts/fixy-gestion-diaria.mjs                          # últimas 24 h
//   node --env-file=.env.local scripts/fixy-gestion-diaria.mjs --dia 2026-09-28         # ese día (ART)
//   node --env-file=.env.local scripts/fixy-gestion-diaria.mjs --desde <iso> --hasta <iso> --out /ruta/prefijo
//   node scripts/fixy-gestion-diaria.mjs --test                                          # check del parser
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import pg from "pg";

// Canal donde Carito carga la gestión. ponytail: constante hasta que se defina (API / WhatsApp de atención / portal).
const DONDE_CARGAR = "formulario fixy.epresis.com/contacto/formulario (Reprogramación de envíos / Modificar guía / Novedad) o WhatsApp de atención de Fixy +54 9 11 3381-0216 (L-V 9-18, sáb 10-16)";
const FALLAS = ["127", "51", "52", "48", "63"];                          // disparan la fila
const VISITA = [...FALLAS, "125", "145", "121", "64"];                   // cuentan como intento
const TERMINAL = ["39", "139", "184", "123", "79"];                       // entregada / devuelta / anulada / robada (140 no: la guía sigue, migración 103)
const GESTION_FIXY = ["183", "117", "144"];                              // Fixy registró una reprogramación
const MIN = { reprogramar: 3, corregir_direccion: 4, actualizar_telefono: 2, cancelar: 4, confirmar_rechazo: 5, contactar_cliente: 6, revisar: 4, verificar: 1 };
const VB = "https://ecomdash-board-platform-production.up.railway.app";
const MCP = process.env.VELTRON_MCP_URL ?? `${VB}/mcp`;
const TENANT = process.env.VELTRON_TENANT_ID ?? "ceca9834-e837-4f96-82a7-8b8edc689dd9";
const H = 3600e3;

// ---- qué pidió el cliente: regex sobre el texto libre (chat) ------------------------------------------------
const DIAS = "lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo";
export function pedidoCliente(txt) {
  const t = String(txt ?? "").toLowerCase().replace(/\s+/g, " ");
  const o = {};
  if (/\b(cancel|anul|no lo (quiero|necesito)|ya no lo quiero|no (lo |la )?ped[ií]|desisto|no lo voy a recibir)/.test(t)) o.cancelar = true;
  if (/no (hay nadie|estoy|estaba|me encuentro|voy a estar)|no est[aá]bamos|estoy trabajando/.test(t)) o.ausente = true;
  const fr = t.match(/(despu[eé]s|desde|a partir|pasad[ao]s?|antes) de las? \d{1,2}([:.]\d\d)? ?(hs?|horas)?|(de|entre) (las )?\d{1,2}([:.]\d\d)? ?(hs? )?(a|y|hasta) (las )?\d{1,2}([:.]\d\d)? ?(hs?)?|(a|por|de) la (mañana|tarde|noche)|\bmediod[ií]a\b/);
  if (fr) o.franja = fr[0].trim();
  // "mañana" es día salvo "a/por/de la mañana"; "hoy" no se toma ("hoy no puedo" no es un pedido).
  const di = t.match(new RegExp(`\\b(${DIAS})\\b|pasado mañana|(?<!la )\\bmañana\\b|\\b\\d{1,2}[/-]\\d{1,2}\\b|\\bel (d[ií]a )?\\d{1,2}\\b(?! ?(hs|:|horas))`));
  if (di) o.dia = di[0].trim();
  if (/(otra|nueva|mi|la) direcci[oó]n (es|ser[ií]a|correcta)|otra direcci|cambi\w* (de |la )?direcci|entre calles|\bpiso\b|\bde?pto\b|timbre|me mud[eé]|esquina/.test(t)) o.direccion = `"${t.slice(0, 90)}"`;
  const tel = t.match(/(tel|cel|n[uú]mero|llam|whats)[^\d]{0,25}((\+?54 ?9? ?)?\d[\d -]{7,14}\d)/);
  if (tel) o.telefono = tel[2].replace(/\D/g, "");
  return o;
}
// Notas del bot: "[coordinacion DD-MM] reprogramar: sábado" → campo estructurado.
const NOTA = /\[coordinacion (\d\d)-(\d\d)\]\s*([^:\n]+):\s*([^\n]*)/gi;
function pedidoNota(tipo, texto) {
  if (/reprogram/i.test(tipo)) return { dia: texto };
  if (/franja/i.test(tipo)) return { franja: texto };
  if (/direcci|referencia/i.test(tipo)) return { direccion: texto };
  return pedidoCliente(texto);
}
const ACUSE = /^((ok|oka|okey|dale|gracias|muchas|genial|perfecto|listo|bueno|buenas?|buen d[ií]a|si|sí|joya|de nada|👍|🙏|❤️)[\s!.,]*)+$/i;

if (process.argv.includes("--test")) {
  assert.deepEqual(pedidoCliente("Puede ser el sábado después de las 17hs?"), { franja: "después de las 17hs", dia: "sábado" });
  assert.deepEqual(pedidoCliente("mañana por la tarde"), { franja: "por la tarde", dia: "mañana" });
  assert.equal(pedidoCliente("prefiero a la mañana").dia, undefined);
  assert.equal(pedidoCliente("quiero cancelar el pedido").cancelar, true);
  assert.equal(pedidoCliente("llamen a este numero 11 5555-1234").telefono, "1155551234");
  assert.ok(pedidoCliente("la dirección es Calle Falsa 123 piso 2").direccion);
  assert.equal(pedidoCliente("hoy no estoy en mi domicilio").direccion, undefined);
  assert.deepEqual(pedidoCliente("gracias"), {});
  assert.equal(pedidoCliente("hoy no hay nadie en casa").ausente, true);
  console.log("ok pedidoCliente");
  process.exit(0);
}

// ---- ventana --------------------------------------------------------------------------------------------------
const arg = (k) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : null; };
const ahora = new Date();
let desde, hasta;
if (arg("dia")) { desde = new Date(`${arg("dia")}T00:00:00-03:00`); hasta = new Date(Math.min(+desde + 24 * H, +ahora)); }
else { hasta = arg("hasta") ? new Date(arg("hasta")) : ahora; desde = arg("desde") ? new Date(arg("desde")) : new Date(+hasta - 24 * H); }
const art = (d) => new Date(+d - 3 * H).toISOString();                   // ISO en hora argentina (sin offset)
const diasVentana = new Set();
for (let t = +desde; t < +hasta; t += H) diasVentana.add(art(t).slice(8, 10) + "-" + art(t).slice(5, 7)); // "DD-MM"
const OUT = arg("out") ?? path.join(os.homedir(), "Downloads", `fixy-gestion-${art(hasta).slice(0, 10)}`);

// ---- 1. base: guías de Fixy abiertas con falla en los últimos 14 días -----------------------------------------
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows: guias } = await db.query(`
  with ev as (
    select e.shipment_id sid, e.status_raw c, e.occurred_at t, e.raw->>'estado' txt
      from shipment_events e join shipments s on s.id = e.shipment_id
     where s.courier = 'fixy' and e.occurred_at < $2 and e.occurred_at > $2::timestamptz - interval '40 days'
  ), cand as (
    select sid from ev group by sid
    having max(t) filter (where c = any($3) or c = '135') >= $2::timestamptz - interval '14 days'
       and not bool_or(c = any($5))
  )
  select s.tracking guia, o.order_number remito,
         min(ev.t) filter (where ev.c = any($4)) t1,
         count(distinct (ev.t at time zone 'America/Argentina/Buenos_Aires')::date) filter (where ev.c = any($4)) intentos,
         max(ev.t) filter (where ev.c = any($4)) tn,
         (array_agg(ev.c || ' ' || coalesce(ev.txt, '') order by ev.t desc) filter (where ev.c = any($4)))[1] falla,
         (array_agg(ev.c order by ev.t desc) filter (where ev.c = any($4)))[1] c_falla,
         max(ev.t) filter (where ev.c = '135') t_deposito,
         bool_or((ev.c = any($3) or ev.c = '135') and ev.t >= $1) falla_nueva,
         max(ev.t) filter (where ev.c = any($6)) t_gestion
    from cand join ev on ev.sid = cand.sid join shipments s on s.id = cand.sid join orders o on o.id = s.order_id
   group by 1, 2`, [desde, hasta, FALLAS, VISITA, TERMINAL, GESTION_FIXY]);
const { rows: cerr } = await db.query(`
  select distinct o.order_number remito from shipment_events e join shipments s on s.id = e.shipment_id join orders o on o.id = s.order_id
   where s.courier = 'fixy' and e.status_raw = any($2) and e.occurred_at < $1 and e.occurred_at > $1::timestamptz - interval '60 days'`, [hasta, TERMINAL]);
const cerradoDB = new Set(cerr.map((x) => x.remito));
const { rows: [{ ult }] } = await db.query(`select max(e.occurred_at) ult from shipment_events e join shipments s on s.id = e.shipment_id where s.courier = 'fixy' and e.occurred_at <= now()`);
await db.end();

// ---- 2. Veltron REST: pedidos Fixy de los últimos 45 días (cliente, zona, notas, comm_evento) -----------------
const ped = new Map(); // shopify_order_number → pedido
for (let page = 1, paginas = 1; page <= paginas; page++) {
  const q = `carrier=fixy&preset=custom&desde=${art(+hasta - 45 * 24 * H).slice(0, 10)}&hasta=${art(hasta).slice(0, 10)}&page=${page}&page_size=200`;
  const r = await fetch(`${VB}/api/v1/tenant/${TENANT}/pedidos?${q}`, { headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}` }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Veltron REST HTTP ${r.status}`);
  const j = await r.json();
  paginas = Number(j.paginas ?? 1);
  for (const p of j.pedidos ?? []) if (p.shopify_order_number) ped.set(String(p.shopify_order_number), p);
}
const antes = (s) => s && new Date(s) < hasta;
const cerrado = (p) => antes(p.fecha_entrega) || antes(p.fecha_cancelacion) || (p.estado === "retornado" && antes(p.comm_evento_at));

// ---- 3. MCP de Veltron (solo tools de lectura) ------------------------------------------------------------------
const LECTURA = new Set(["ver_conversacion", "listar_conversaciones"]);
async function mcp(name, args) {
  if (!LECTURA.has(name)) throw new Error(`tool no permitida (solo lectura): ${name}`);
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(MCP, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }), signal: AbortSignal.timeout(90_000),
      });
      const txt = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const res = JSON.parse(txt.startsWith("event:") || txt.startsWith("data:") ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("") : txt);
      const text = (res.result?.content ?? []).map((c) => c.text ?? "").join("");
      if (res.error || res.result?.isError) return { error: res.error?.message ?? text.slice(0, 200) };
      return JSON.parse(text);
    } catch (e) { if (i >= 2) return { error: String(e).slice(0, 200) }; await new Promise((s) => setTimeout(s, 4000 * (i + 1))); }
  }
}
// derivaciones abiertas (bot apagado) — estado de HOY, Veltron no guarda historial
const deriv = new Map(); // remito → {motivo, pausadoEn}
for (let page = 1, paginas = 1; page <= paginas; page++) {
  const j = await mcp("listar_conversaciones", { estado: "bot_off", page, page_size: 100 });
  if (j.error) { console.warn("listar_conversaciones:", j.error); break; }
  paginas = Number(j.paginas ?? 1);
  for (const c of j.conversations ?? []) if (antes(c.pausadoEn) || !c.pausadoEn)
    for (const n of c.pedidos ?? []) deriv.set(String(n), { motivo: c.motivo ?? "", esperaHoras: c.esperaHoras });
}

// ---- 4. candidatos -------------------------------------------------------------------------------------------------
const cand = new Map(); // remito → {g, p, motivos:Set}
const add = (remito, motivo, g) => {
  const p = ped.get(remito);
  if ((p && cerrado(p)) || cerradoDB.has(remito)) return;
  const x = cand.get(remito) ?? { g: g ?? guias.find((y) => y.remito === remito), p, motivos: new Set() };
  if (motivo) x.motivos.add(motivo);
  cand.set(remito, x);
};
for (const g of guias) add(g.remito, g.falla_nueva ? "falla nueva" : null, g); // todas: después se mira si escribió
for (const [n, p] of ped) {
  if (["REBOTADO_1", "EN_SUCURSAL"].includes(p.comm_evento) && new Date(p.comm_evento_at) >= desde && antes(p.comm_evento_at)) add(n, "falla nueva");
  for (const m of (p.notas ?? "").matchAll(NOTA)) if (diasVentana.has(`${m[1]}-${m[2]}`)) add(n, "nota [coordinacion]");
  if (deriv.has(n) && (["despachado", "en_camino", "rebotado"].includes(p.estado) || guias.some((g) => g.remito === n))) add(n, "derivación abierta");
}

// conversaciones de todos los candidatos (hace falta para "escribió después de la falla" y para "qué pidió")
const tels = [...new Set([...cand.values()].map((x) => x.p?.cliente_telefono).filter(Boolean))];
const conv = new Map();
await Promise.all([0, 1, 2, 3].map(async () => { while (tels.length) { const t = tels.shift(); conv.set(t, await mcp("ver_conversacion", { telefono: t, ultimos: 80 })); } }));

// ---- 5. filas ------------------------------------------------------------------------------------------------------
const filas = [];
const sinConv = [];
for (const [remito, { g, p, motivos }] of cand) {
  const t1 = g?.t1 ? new Date(g.t1) : null;
  const c = conv.get(p?.cliente_telefono);
  if (p && (!c || c.error)) sinConv.push(String(c?.error ?? "sin teléfono").slice(0, 60));
  const desdeMsgs = +(t1 ?? desde) - 24 * H;
  const entr = (c?.mensajes ?? []).filter((m) => m.direccion === "entrante" && new Date(m.created_at) < hasta && +new Date(m.created_at) >= desdeMsgs && !ACUSE.test((m.mensaje ?? "").trim()))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  if (t1 && entr.some((m) => new Date(m.created_at) >= desde && new Date(m.created_at) > t1)) motivos.add("mensaje post-falla");
  if (!motivos.size) continue;

  // qué pidió: chat en orden y las notas del bot encima (lo último pisa)
  const pc = {};
  for (const m of entr) { const x = pedidoCliente(m.mensaje); if (!x.cancelar && (x.dia || x.franja || x.direccion)) delete pc.cancelar; Object.assign(pc, x); }
  const notas = [...(p?.notas ?? "").matchAll(NOTA)].filter((m) => `${art(hasta).slice(0, 4)}-${m[2]}-${m[1]}` <= art(hasta).slice(0, 10));
  for (const m of notas) Object.assign(pc, pedidoNota(m[3], m[4]));
  const pidio = [pc.cancelar && "CANCELAR", pc.ausente && !pc.dia && "avisó que no estaba", pc.dia && `día: ${pc.dia}`, pc.franja && `franja: ${pc.franja}`, pc.direccion && `dirección: ${pc.direccion}`, pc.telefono && `tel: ${pc.telefono}`].filter(Boolean).join(" · ")
    || (entr.length ? `(sin pedido concreto) último msj: "${entr.at(-1).mensaje.replace(/\s+/g, " ").slice(0, 80)}"` : "");

  // qué cargar
  const cf = g?.c_falla ?? (g?.t_deposito ? "135" : "");
  let tipo, accion;
  if (pc.cancelar) [tipo, accion] = ["cancelar", "Confirmar la baja con el cliente y pedir en Fixy la devolución (no reprogramar)"];
  else if (pc.direccion || pc.dia || pc.franja || pc.telefono) {
    tipo = pc.direccion ? "corregir_direccion" : pc.dia || pc.franja ? "reprogramar" : "actualizar_telefono";
    accion = "Cargar: " + [pc.direccion && `corregir dirección (${pc.direccion})`, pc.telefono && `tel. de contacto ${pc.telefono}`, (pc.dia || pc.franja) && `reprogramar visita ${[pc.dia, pc.franja].filter(Boolean).join(", ")}`].filter(Boolean).join(" + ");
  } else if (pc.ausente && cf !== "48") [tipo, accion] = ["contactar_cliente", `Avisó que no estaba${cf === "51" ? " (Fixy lo marcó rechazo)" : ""}: pedirle día y franja y cargar la reprogramación`];
  else [tipo, accion] = {
    127: ["contactar_cliente", "No atendió: pedirle día y franja y cargar la reprogramación"],
    52: ["contactar_cliente", "Fixy lo marcó 'reprogramado por el comprador': pedirle día y franja y cargarlos"],
    48: ["contactar_cliente", "Pedir dirección completa y referencias y cargar la corrección"],
    51: ["confirmar_rechazo", "Confirmar el rechazo: si lo confirma, pedir devolución; si no, reprogramar"],
    63: ["contactar_cliente", "Zona peligrosa: coordinar dirección alternativa o punto de entrega"],
    135: ["contactar_cliente", "Volvió al depósito: pedirle día y cargar una nueva salida"],
  }[cf] ?? ["revisar", motivos.has("derivación abierta") ? `Leer la derivación (${deriv.get(remito)?.motivo}) y decidir` : "Leer el chat y decidir"];

  const cargado = (p?.notas ?? "").match(/\[cargado en fixy[^\]]*\]/i);
  const estado = cargado ? `cargado ${cargado[0]}` : g?.t_gestion && g.tn && new Date(g.t_gestion) > new Date(g.tn) ? "Fixy ya registró gestión (183/117/144)" : "pendiente";
  if (estado !== "pendiente") [tipo, accion] = ["verificar", `Ya gestionado (${estado}): confirmar con el cliente que el día le sirve`];
  const dias = t1 ? Math.floor((+hasta - +t1) / (24 * H)) : null;
  const concreto = pc.cancelar || pc.dia || pc.franja || pc.direccion || pc.telefono;
  const prio = estado !== "pendiente" ? 3 : concreto || dias >= 6 ? 1 : motivos.has("derivación abierta") || g?.intentos >= 2 ? 2 : 3;
  filas.push({
    prioridad: prio, entra_por: [...motivos].join(" + "), pedido: p?.id ?? "", remito, guia: g?.guia ?? p?.guia ?? "",
    cliente: p?.cliente_nombre ?? "", telefono: p?.cliente_telefono ?? "", zona: [p?.cliente_ciudad, p?.cliente_provincia].filter(Boolean).join(", "),
    falla: (g?.falla ?? (g?.t_deposito ? "135 REINGRESO A DEPOSITO" : `sin falla (Veltron: ${p?.comm_evento ?? "?"})`)) + (g?.t_deposito && (!g.tn || new Date(g.t_deposito) > new Date(g.tn)) ? " (volvió a depósito)" : ""), intento: g?.intentos ?? "", dias_1a_falla: dias == null ? "" : dias >= 7 ? `${dias} (vuelve ~día 9)` : dias,
    pidio_cliente: pidio, cargar_en_fixy: accion, donde_cargarlo: DONDE_CARGAR, estado, tipo_accion: tipo,
  });
}
filas.sort((a, b) => a.prioridad - b.prioridad || (parseInt(b.dias_1a_falla) || 0) - (parseInt(a.dias_1a_falla) || 0));

// ---- 6. salida -----------------------------------------------------------------------------------------------------
const cols = Object.keys(filas[0] ?? { prioridad: 0 });
const csvCell = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
fs.writeFileSync(`${OUT}.csv`, [cols.join(","), ...filas.map((f) => cols.map((k) => csvCell(f[k])).join(","))].join("\n"));
const esc = (v) => String(v ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const titulo = `Fixy: visitas fallidas a gestionar (${art(desde).slice(0, 16).replace("T", " ")} a ${art(hasta).slice(0, 16).replace("T", " ")})`;
fs.writeFileSync(`${OUT}.html`, `<p style="font:14px Arial"><b>${esc(titulo)}</b><br>${filas.length} guías. Cargar en: ${esc(DONDE_CARGAR)}. Al cargar, dejar en la nota del pedido "[cargado en Fixy DD-MM]".</p>
<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font:12px Arial">
<tr style="background:#eee">${cols.filter((k) => k !== "donde_cargarlo").map((k) => `<th>${esc(k)}</th>`).join("")}</tr>
${filas.map((f) => `<tr${f.prioridad === 1 ? ' style="background:#fff3cd"' : ""}>${cols.filter((k) => k !== "donde_cargarlo").map((k) => `<td>${esc(f[k])}</td>`).join("")}</tr>`).join("\n")}
</table>`);

const cuenta = (k) => Object.entries(filas.reduce((o, f) => { for (const v of String(f[k]).split(" + ")) o[v] = (o[v] ?? 0) + 1; return o; }, {})).sort((a, b) => b[1] - a[1]).map(([v, n]) => `${v} ${n}`).join(" · ");
console.log(titulo);
console.log(`eventos de Fixy en base hasta ${art(ult).slice(0, 16)} ART · guías abiertas con falla ≤14 d: ${guias.length} · candidatos: ${cand.size}`);
console.log(`FILAS ${filas.length} · prioridad ${cuenta("prioridad")}`);
console.log(`  por acción: ${cuenta("tipo_accion")}`);
console.log(`  entra por:  ${cuenta("entra_por")}`);
console.log(`  minutos estimados: ${filas.reduce((a, f) => a + MIN[f.tipo_accion], 0)} (${Object.entries(MIN).map(([k, v]) => `${k} ${v}`).join(", ")})`);
if (sinConv.length) console.log(`  sin conversación de Veltron: ${sinConv.length} (${[...new Set(sinConv)].join(" | ")})`);
if ([...cand.values()].some((x) => !x.p)) console.log(`  sin pedido en Veltron (REST 45 d): ${[...cand.values()].filter((x) => !x.p).length}`);
console.log(`→ ${OUT}.csv\n→ ${OUT}.html`);
