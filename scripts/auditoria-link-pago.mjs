// Por qué no pagan los pedidos de prepago. 668 pedidos en `espera_link_pago` (04/09/2026, todos de
// Correo) contra 1.015 del canal: dos de cada tres compran y nunca pagan. Antes de mudar el prepago
// a Urbano conviene saber si es un problema de flujo (no entienden cómo pagar, el link falla) o de
// intención (se arrepienten), porque son arreglos distintos.
//
// Uso:
//   set -a && . ./.env.local; set +a
//   node scripts/auditoria-link-pago.mjs                 # últimos 30 días
//   node scripts/auditoria-link-pago.mjs --preset 7d
//
// SÓLO LECTURA: `reporte_pedidos`, `listar_pedidos` y `ver_conversacion` no escriben nada y no
// gastan el cupo diario de la key, que es sólo de escrituras.
//
// Escribe el detalle en etiquetas/auditoria-link-pago-<fecha>.json y por pantalla sale el resumen.
// Los chats crudos NO se imprimen: son cientos y el detalle vive en el archivo.
//
// Esta primera pasada es ESTRUCTURAL a propósito: cuántos nunca contestaron, cuántos conversaron y
// aun así no pagaron, cuánto se les insistió, si la ventana de 24 h sigue abierta. Eso ya parte la
// pregunta en dos sin necesidad de leer el texto. La clasificación del motivo (lo que dijeron) va
// en una segunda pasada y sólo sobre los que efectivamente respondieron.
import fs from "node:fs";
import path from "node:path";

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PRESET = arg("preset", "30d");
const CONCURRENCIA = Number(arg("concurrencia", 4));

const MCP_URL = process.env.VELTRON_MCP_URL ?? "https://ecomdash-board-platform-production.up.railway.app/mcp";
const SOLO_LECTURA = new Set(["reporte_pedidos", "listar_pedidos", "ver_conversacion", "resumen_pedidos"]);
let rpcId = 0;

// `ver_conversacion` cuenta contra el límite de "30 escrituras por minuto" aunque sólo lea (medido
// 04/09/2026: 261 de 653 conversaciones se perdieron con 429 mandándolas de a 5 sin pausa). Así que
// se pacea igual que las escrituras de verdad. `listar_pedidos` y `reporte_pedidos` no lo tocan.
const PACEAR = new Set(["ver_conversacion"]);
const POR_MIN = Number(arg("por-min", 26));
const ventana = [];
async function esperarTurno() {
  for (;;) {
    const ahora = Date.now();
    while (ventana.length && ahora - ventana[0] > 60_000) ventana.shift();
    if (ventana.length < POR_MIN) { ventana.push(ahora); return; }
    await new Promise((r) => setTimeout(r, 60_000 - (ahora - ventana[0]) + 250));
  }
}

async function mcp(name, args = {}) {
  if (!SOLO_LECTURA.has(name)) throw new Error(`auditoría de sólo lectura: ${name} no está permitida`);
  if (PACEAR.has(name)) await esperarTurno();
  const r = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.VELTRON_API_KEY}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name, arguments: args } }),
    signal: AbortSignal.timeout(180_000),
  });
  const txt = await r.text();
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status} ${txt.slice(0, 150)}`);
  const res = JSON.parse(txt.startsWith("event:") || txt.startsWith("data:")
    ? txt.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("")
    : txt);
  if (res.error) throw new Error(`${name}: ${res.error.message}`);
  const t = (res.result?.content ?? []).map((c) => c.text ?? "").join("");
  if (res.result?.isError) throw new Error(`${name}: ${t.slice(0, 200)}`);
  return JSON.parse(t);
}

// El CSV de reporte_pedidos: ; o , según la tienda, con comillas. Parser mínimo pero que respeta
// las comillas, porque las direcciones traen comas adentro.
function parseCsv(texto) {
  const filas = [];
  let campo = "", fila = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') enComillas = false;
      else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo || fila.length) { fila.push(campo); filas.push(fila); }
  const head = filas.shift().map((h) => h.replace(/^﻿/, "").trim());
  return filas.filter((f) => f.length > 1).map((f) => Object.fromEntries(head.map((h, i) => [h, (f[i] ?? "").trim()])));
}

const horas = (a, b) => (Date.parse(b) - Date.parse(a)) / 3_600_000;

// ---------------- 1. los pedidos ----------------
const rep = await mcp("reporte_pedidos", { preset: PRESET });
const csv = await fetch(rep.url, { signal: AbortSignal.timeout(180_000) }).then((r) => r.text());
const todos = parseCsv(csv);
const esperando = todos.filter((r) => r.Estado === "espera_link_pago");
console.log(`${todos.length} pedidos en ${PRESET} · ${esperando.length} en espera_link_pago (${(100 * esperando.length / todos.length).toFixed(1)}%)`);

// Un teléfono puede tener varios pedidos: la conversación se pide UNA vez por teléfono.
const porTelefono = new Map();
for (const p of esperando) {
  const t = (p["Teléfono"] ?? "").replace(/\D/g, "");
  if (t.length < 8) continue;   // Veltron pide 8 dígitos mínimo; más corto es un dato roto
  porTelefono.set(t, [...(porTelefono.get(t) ?? []), p]);
}
console.log(`${porTelefono.size} teléfonos distintos · ${esperando.length - [...porTelefono.values()].flat().length} sin teléfono`);

// ---------------- 2. las conversaciones ----------------
const salida = [];
const telefonos = [...porTelefono.keys()];
const t0 = Date.now();
for (let i = 0; i < telefonos.length; i += CONCURRENCIA) {
  await Promise.all(telefonos.slice(i, i + CONCURRENCIA).map(async (tel) => {
    const pedidos = porTelefono.get(tel);
    let conv = null;
    try { conv = await mcp("ver_conversacion", { telefono: tel, ultimos: 60 }); }
    catch (e) { salida.push({ tel, error: String(e.message).slice(0, 120), pedidos: pedidos.map((p) => p["#"]) }); return; }

    // Campos reales de ver_conversacion (verificados 04/09/2026): direccion "entrante"|"saliente",
    // el texto en `mensaje`, y `estado_envio` con el acuse de WhatsApp: sent | delivered | read |
    // failed. Ese último es el dato que parte la pregunta: si el link se leyó y no pagaron, es
    // intención; si nunca se entregó, es flujo (y se arregla).
    const msgs = conv.mensajes ?? [];
    const entrantes = msgs.filter((m) => m.direccion === "entrante");
    const salientes = msgs.filter((m) => m.direccion === "saliente");
    const links = salientes.filter((m) => /payment_link|mercadopago\.com|checkout/i.test(String(m.mensaje ?? "")));
    const ultimoLink = links[links.length - 1];
    const leyoElLink = links.some((m) => m.estado_envio === "read");
    const linkFallado = links.length > 0 && links.every((m) => m.estado_envio === "failed");

    salida.push({
      tel,
      pedidos: pedidos.map((p) => ({ n: p["#"], fecha: p["Fecha pedido"], total: p.Total, producto: p.Producto, pago: p["Método de pago"] })),
      mensajes: msgs.length,
      entrantes: entrantes.length,
      salientes: salientes.length,
      contesto: entrantes.length > 0,
      // ¿respondió DESPUÉS de que le mandamos el link? Es la señal de que hubo diálogo sobre el pago.
      contesto_post_link: !!ultimoLink && entrantes.some((m) => Date.parse(m.created_at) > Date.parse(ultimoLink.created_at)),
      links_enviados: links.length,
      estado_link: ultimoLink?.estado_envio ?? null,
      leyo_el_link: leyoElLink,
      link_fallado: linkFallado,
      ventana_abierta: conv.ventana_24h_abierta ?? null,
      ultimo_entrante_horas: conv.ultimo_entrante_horas ?? null,
      bot: conv.bot ?? null,
      horas_desde_pedido: pedidos[0]?.["Fecha pedido"] ? Number(horas(pedidos[0]["Fecha pedido"], new Date().toISOString()).toFixed(1)) : null,
      // Los textos van al archivo para la segunda pasada; acá no se imprimen.
      texto: msgs.map((m) => `${m.direccion === "entrante" ? "C" : "N"}[${m.estado_envio ?? "-"}]: ${String(m.mensaje ?? "").replace(/\s+/g, " ").slice(0, 400)}`),
    });
  }));
  if ((i / CONCURRENCIA) % 10 === 0) process.stderr.write(`  ${salida.length}/${telefonos.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}

// ---------------- 3. lectura estructural ----------------
const ok = salida.filter((s) => !s.error);
const contestaron = ok.filter((s) => s.contesto);
const mudos = ok.filter((s) => !s.contesto);
const sinMensajes = ok.filter((s) => s.mensajes === 0);

console.log(`\n=== ${esperando.length} pedidos esperando el pago · ${ok.length} conversaciones leídas ===`);

const conLink = ok.filter((s) => s.links_enviados > 0);
const sinLink = ok.filter((s) => s.links_enviados === 0);
const leyeron = conLink.filter((s) => s.leyo_el_link);
const fallados = conLink.filter((s) => s.link_fallado);

console.log(`\nEL LINK`);
console.log(`  nunca se les mandó link:      ${sinLink.length}  (${(100 * sinLink.length / ok.length).toFixed(0)}%)  ← no es que no quisieron pagar`);
console.log(`  se les mandó y lo leyeron:    ${leyeron.length}  (${(100 * leyeron.length / ok.length).toFixed(0)}%)  ← lo vieron y no pagaron`);
console.log(`  se les mandó y NO lo leyeron: ${conLink.length - leyeron.length}`);
console.log(`  el envío del link falló:      ${fallados.length}`);

console.log(`\nLA CONVERSACIÓN`);
console.log(`  nunca contestaron nada:       ${mudos.length}  (${(100 * mudos.length / ok.length).toFixed(0)}%)`);
console.log(`  contestaron alguna vez:       ${contestaron.length}  (${(100 * contestaron.length / ok.length).toFixed(0)}%)`);
console.log(`  contestaron DESPUÉS del link: ${ok.filter((s) => s.contesto_post_link).length}  ← los que tienen algo que decirnos`);
const conError = salida.filter((s) => s.error);
if (conError.length) console.log(`  sin conversación accesible:   ${conError.length}`);

console.log(`\nINSISTENCIA`);
console.log(`  links enviados por cliente, promedio: ${(conLink.reduce((a, s) => a + s.links_enviados, 0) / (conLink.length || 1)).toFixed(1)}`);
console.log(`  mensajes que les mandamos: ${(mudos.reduce((a, s) => a + s.salientes, 0) / (mudos.length || 1)).toFixed(1)} a los mudos · ${(contestaron.reduce((a, s) => a + s.salientes, 0) / (contestaron.length || 1)).toFixed(1)} a los que contestaron`);
const plata = esperando.reduce((a, r) => a + (Number(String(r.Total).replace(/[^\d.-]/g, "")) || 0), 0);
console.log(`\nPLATA EN JUEGO: $${plata.toLocaleString("es-AR", { maximumFractionDigits: 0 })} en ${esperando.length} pedidos sin cobrar`);
const edades = ok.map((s) => s.horas_desde_pedido).filter((h) => h != null).sort((a, b) => a - b);
if (edades.length) {
  const q = (x) => edades[Math.floor(edades.length * x)];
  console.log(`antigüedad del pedido: mediana ${(q(.5) / 24).toFixed(1)} días · p90 ${(q(.9) / 24).toFixed(1)} días`);
}

const dir = path.join(process.cwd(), "etiquetas");
fs.mkdirSync(dir, { recursive: true });
const destino = path.join(dir, `auditoria-link-pago-${new Date().toISOString().slice(0, 10)}.json`);
fs.writeFileSync(destino, JSON.stringify({ preset: PRESET, pedidos: esperando.length, telefonos: telefonos.length, conversaciones: salida }, null, 1));
console.log(`\ndetalle → ${destino}`);
console.log(`Segunda pasada: clasificar el motivo sobre los que contestaron después del link (los demás no dijeron nada).`);
