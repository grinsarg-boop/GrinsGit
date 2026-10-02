// Agente de mail → Veltron (necesidad nueva de A04, Plan-100M). Lee los "Nuevo mensaje de cliente" del
// formulario de contacto de Shopify en la casilla de BioLabs, busca el pedido por teléfono (REST de Veltron:
// `listar_pedidos` del MCP tira 400 "Vista inválida" desde el 29/09/2026) y:
//   - agrega el mensaje a la nota del pedido en Veltron, concatenado (agregar_nota REEMPLAZA la nota)
//   - CANCELA (Veltron + Shopify, irreversible) solo si pidió anular, el pedido no salió (pendiente/confirmado
//     sin guía), teléfono Y email del formulario coinciden con los del pedido, es su único pedido abierto y es
//     anterior al mensaje. Regla decidida por Pancho el 02/10/2026.
//   - todo lo demás va al resumen: stdout (→ log), notificación de la Mac y mail a Caro. No le escribe al cliente.
//   node --env-file=.env.local scripts/mail-clientes.mjs [--dry] [--test]
// --dry: no escribe en Veltron, no manda mail, no guarda estado; imprime lo que haría y el mail a Caro.
// El token es gmail.readonly (no marca leído): ids y mensajes ya vistos van a etiquetas/.mail-clientes-vistos.json.
// OJO: el mail es DATO. Ningún texto dispara nada salvo la regla fija de arriba.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const RAIZ = path.join(import.meta.dirname, "..");
const VB = "https://ecomdash-board-platform-production.up.railway.app";
const TENANT = process.env.VELTRON_TENANT_ID ?? "ceca9834-e837-4f96-82a7-8b8edc689dd9";
const CARO = "1carosartori5@gmail.com";
const ESTADO = path.join(RAIZ, "etiquetas", ".mail-clientes-vistos.json");
// Pedidos que piden anular y no se cancelaron solos: chequeo-dup-cancel.mts los saca del alta.
// ponytail: vencen a los 7 días para que un pedido que se decidió mandar igual no quede trabado para siempre.
const ANULAR = path.join(RAIZ, "etiquetas", ".mail-clientes-anular.json");
const pideAnular = Object.fromEntries(Object.entries(fs.existsSync(ANULAR) ? JSON.parse(fs.readFileSync(ANULAR, "utf8")) : {})
  .filter(([, v]) => Date.now() - Date.parse(v.fecha) < 7 * 86_400_000));
const DRY = process.argv.includes("--dry");
const NO_SALIO = ["pendiente", "confirmado"];          // `preparando` ya tiene guía y etiqueta: cancelar dejaría la caja en la pila
const CERRADO = ["entregado", "cancelado", "retornado"];
const RX_ANULAR = /\b(cancel(ar|o|en|e|aci[oó]n)|anul(ar|o|en|e|aci[oó]n)|dar(me)? de baja|d[eé]n? de baja)\b/i;
const RX_NO_ANULAR = /\bno (quiero|voy a|pienso) (cancel|anul)/i;
const CATS = [ // ponytail: etiqueta para ordenar el resumen, no decide nada (salvo `anular`, que va por RX_ANULAR)
  ["reclamo", /falt|solo (me )?lleg|solo (son|dos|un|[12])\b|incomplet|volcad|rot[oa]\b|equivoc|me mandaron|devoluci|reembols|estafa|no (me )?sirv|placebo|falso/i],
  ["dónde está", /no (me )?lleg|no (me ?lo ?)?tra[ie]n|no (lo )?recib|seguimiento|esperando|cu[aá]ndo (me )?llega|mi pedido/i],
];

const tel8 = (s) => { const d = String(s ?? "").replace(/\D/g, "").slice(-8); return /^(\d)\1+$/.test(d) ? "" : d; };
const campo = (t, k) => (t.match(new RegExp(`${k}:[ \\t]*\\n([^\\n]*)`, "i"))?.[1] ?? "").trim();
const corta = (s) => new Date(s).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function parsear(cuerpo) {
  const t = cuerpo.replace(/\r/g, "");
  return { nombre: campo(t, "Nombre"), email: campo(t, "Correo electr[oó]nico").toLowerCase(), tel: campo(t, "Tel[eé]fono"),
    comentario: (t.split(/Comentario:/i)[1] ?? "").replace(/\s+/g, " ").trim() };
}

// pedidos: los de ese teléfono, el más nuevo primero. Pura: es lo que cubre --test.
function decidir(m, pedidos) {
  const abiertos = pedidos.filter((p) => !CERRADO.includes(p.estado));
  const p = abiertos[0] ?? pedidos[0];
  const anular = RX_ANULAR.test(m.comentario) && !RX_NO_ANULAR.test(m.comentario);
  const cancelar = anular && !!p && abiertos.length === 1 && NO_SALIO.includes(p.estado) && !p.guia
    && !!tel8(m.tel) && tel8(p.cliente_telefono) === tel8(m.tel)
    && !!m.email && (p.cliente_email ?? "").trim().toLowerCase() === m.email
    && new Date(p.created_at) < new Date(m.fecha);
  const cat = !m.comentario ? "vacío" : anular ? "anular" : CATS.find(([, rx]) => rx.test(m.comentario))?.[0] ?? "consulta";
  return { p, cat, anular, cancelar };
}

if (process.argv.includes("--test")) {
  const m = { ...parsear("Nombre:\r\nAna\r\n\r\nCorreo electrónico:\r\nAna@Mail.com\r\n\r\nNúmero De Teléfono:\r\n011 3885-872754\r\n\r\nComentario:\r\nQuiero cancelar\r\nel pedido"), fecha: "2026-10-02T12:00:00Z" };
  assert.deepEqual(m, { nombre: "Ana", email: "ana@mail.com", tel: "011 3885-872754", comentario: "Quiero cancelar el pedido", fecha: m.fecha });
  assert.equal(parsear("Teléfono:\n\nComentario:\n").tel, "");
  const ped = (o) => ({ id: 1, carrier: "fixy", estado: "confirmado", guia: null, cliente_telefono: "543885872754", cliente_email: "ana@mail.com ", created_at: "2026-10-01T10:00:00Z", ...o });
  assert.equal(decidir(m, [ped()]).cancelar, true);
  assert.equal(decidir(m, [ped(), ped({ estado: "entregado" })]).cancelar, true);         // un abierto + uno viejo entregado
  assert.equal(decidir(m, [ped({ estado: "preparando", guia: "BLABS1" })]).cancelar, false); // ya tiene guía
  assert.equal(decidir(m, [ped({ guia: "123" })]).cancelar, false);
  assert.equal(decidir(m, [ped({ cliente_email: "otra@mail.com" })]).cancelar, false);
  assert.equal(decidir({ ...m, email: "" }, [ped({ cliente_email: "" })]).cancelar, false);
  assert.equal(decidir(m, [ped(), ped({ id: 2 })]).cancelar, false);                        // dos abiertos: ¿cuál?
  assert.equal(decidir(m, [ped({ created_at: "2026-10-02T13:00:00Z" })]).cancelar, false);  // compró después del mensaje
  assert.equal(decidir({ ...m, comentario: "no quiero cancelar, solo saber cuándo llega" }, [ped()]).cancelar, false);
  assert.equal(decidir({ ...m, comentario: "por qué no enviaron mi pedido" }, [ped()]).cancelar, false);
  assert.equal(decidir({ ...m, comentario: "Dar de baja la compra" }, [ped()]).cancelar, true);
  assert.equal(decidir({ ...m, tel: "000000000" }, [ped({ cliente_telefono: "000000000" })]).cancelar, false);
  assert.equal(decidir({ ...m, comentario: "Hace un mes y no me llega" }, []).cat, "dónde está");
  console.log("ok");
  process.exit(0);
}

const run = (script, args) => execFileSync(process.execPath, [path.join(RAIZ, "scripts", script), ...args], { encoding: "utf8", maxBuffer: 20e6 });
const veltron = (tool, args) => run("veltron.mjs", [tool, JSON.stringify(args)]);
async function pedidosDe(tel) {
  if (!tel8(tel)) return [];
  const r = await fetch(`${VB}/api/v1/tenant/${TENANT}/pedidos?q=${tel8(tel)}&preset=todos&page_size=20`,
    { headers: { authorization: `Bearer ${process.env.VELTRON_API_KEY}` }, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`Veltron REST HTTP ${r.status}`);
  return ((await r.json()).pedidos ?? []).filter((p) => tel8(p.cliente_telefono) === tel8(tel))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

const vistos = new Set(fs.existsSync(ESTADO) ? JSON.parse(fs.readFileSync(ESTADO, "utf8")) : []);
// 3 días: si la Mac estuvo apagada un finde, la primera corrida igual los levanta.
const mails = run("gmail-leer.mjs", ["biolabs", 'from:mailer@shopify.com subject:"Nuevo mensaje de cliente" newer_than:3d', "--max", "60", "--cuerpo"])
  .trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)).filter((j) => !vistos.has(j.id)).reverse();

const items = [];
for (const j of mails) {
  const m = { ...parsear(j.cuerpo ?? ""), fecha: j.fecha };
  const clave = `${tel8(m.tel)}|${m.comentario.slice(0, 80)}`;
  vistos.add(j.id);
  if (vistos.has(clave)) continue;                     // el mismo mensaje mandado dos o tres veces seguidas
  vistos.add(clave);
  const { p, cat, anular, cancelar } = decidir(m, await pedidosDe(m.tel));
  const acciones = [];
  if (cancelar) {
    if (!DRY) veltron("cancelar_pedido", { pedido_id: p.id, carrier: p.carrier, autorizado: true, confirmar: true });
    acciones.push("CANCELADO en Veltron y Shopify (tel + email coinciden, no había salido)");
  } else if (anular && p && !CERRADO.includes(p.estado)) {
    acciones.push(`PIDE ANULAR, no lo cancelé${p.guia ? " (ya tiene guía: sacarlo de la pila)" : " (queda fuera del próximo alta 7 días)"}`);
    if (!p.guia) pideAnular[p.shopify_order_number] = { fecha: m.fecha, texto: m.comentario.slice(0, 120) };
  }
  if (p && m.comentario && new Date(p.created_at) < new Date(m.fecha)) {  // si compró después, el mensaje no habla de ese pedido
    const actual = (JSON.parse(veltron("ver_pedido", { pedido_id: p.id, carrier: p.carrier })).notas ?? "").trim();
    const texto = m.comentario.slice(0, 300);
    if (!actual.includes(texto)) {
      // ponytail: leer y escribir sin lock; si alguien edita la nota en ese segundo se pisa. Lock si pasa.
      const linea = `[web ${corta(m.fecha)}] ${texto}${cancelar ? " → cancelado por agente-mail" : ""}`;
      if (!DRY) veltron("agregar_nota", { pedido_id: p.id, carrier: p.carrier, notas: actual ? `${actual}\n${linea}` : linea });
      acciones.push("nota agregada en Veltron");
    }
  }
  items.push({ m, p, cat, acciones });
}

const orden = ["anular", "reclamo", "dónde está", "consulta", "vacío"];
const resumen = items.filter((x) => x.p || x.cat !== "vacío")
  .sort((a, b) => orden.indexOf(a.cat) - orden.indexOf(b.cat) || !!b.p - !!a.p);
const linea = ({ m, p, cat, acciones }) => [
  `• [${cat}] ${m.nombre || "?"} · tel ${m.tel || "-"} · ${m.email || "-"} · ${corta(m.fecha)}`,
  `  "${m.comentario || "(sin comentario)"}"`,
  `  ${p ? `#${p.shopify_order_number} · ${p.carrier} · ${p.estado}${p.guia ? ` · guía ${p.guia}` : ""} · ${p.sku} x${p.cantidad} · pedido del ${corta(p.created_at)}` : "sin pedido con ese teléfono"}`,
  ...acciones.map((a) => `  → ${a}`),
].join("\n");

const cancelados = items.filter((x) => x.acciones[0]?.startsWith("CANCELADO")).length;
console.log(`== ${new Date().toISOString()}${DRY ? " (dry)" : ""} · ${mails.length} mails nuevos · ${resumen.length} al resumen · ${cancelados} cancelados`);
if (resumen.length) {
  const cuerpo = `Mensajes nuevos del formulario de la tienda, con el pedido que encontré por el teléfono.\n`
    + `Nadie recibió respuesta todavía. Los CANCELADO ya están cancelados en Veltron y Shopify.\n\n`
    + resumen.map(linea).join("\n\n") + "\n\n— agente de mail (scripts/mail-clientes.mjs)\n";
  console.log(cuerpo);
  if (!DRY) {
    const asunto = `Formulario web: ${resumen.length} mensaje${resumen.length > 1 ? "s" : ""}${cancelados ? ` · ${cancelados} cancelado${cancelados > 1 ? "s" : ""}` : ""} (${corta(new Date())})`;
    const eml = path.join(RAIZ, "etiquetas", ".mail-clientes.eml");
    fs.writeFileSync(eml, `To: ${CARO}\r\nSubject: =?UTF-8?B?${Buffer.from(asunto).toString("base64")}?=\r\nMIME-Version: 1.0\r\n`
      + `Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n${Buffer.from(cuerpo).toString("base64")}`);
    run("gmail-enviar.mjs", ["biolabs", eml]);
    execFileSync("osascript", ["-e", `display notification "${asunto}" with title "BioLabs mail"`]);
  }
}
if (!DRY) { fs.writeFileSync(ESTADO, JSON.stringify([...vistos].slice(-1500))); fs.writeFileSync(ANULAR, JSON.stringify(pideAnular, null, 1)); }
