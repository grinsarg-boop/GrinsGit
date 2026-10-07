// Seguimiento de reposiciones ML que no viven en `shipments` (Correo por MiCorreo, Urbano anticipado BLABSML/BLABSA).
// Fuente: vault 10-BioLabs/reposiciones-ml.json (viaja a la Mac mini por vault-sync). Rastrea las no cerradas por las
// páginas públicas (sin captcha), guarda `ultimo` + `chequeado` y cierra solas las de Correo entregadas.
// Uso: node scripts/reposiciones-ml.mjs [--dry]
import fs from "node:fs";

const FILE = `${process.env.HOME}/Claude/Obsidian/10-BioLabs/reposiciones-ml.json`;
const texto = (html) => html.replace(/<[^>]*>/g, " ").replace(/&times;/g, "").replace(/\s+/g, " ");

async function correo(tn) {
  const r = await fetch("https://www.correoargentino.com.ar/sites/all/modules/custom/ca_forms/api/wsFacade.php", {
    method: "POST", headers: { "User-Agent": "Mozilla/5.0", "Content-Type": "application/x-www-form-urlencoded" },
    body: `action=ecommerce&id=${tn}`,
  });
  // primer movimiento = el más nuevo: "06-10-2026 08:09 DIAMANTE-CDD AUT. INTENTO DE ENTREGA ENTREGADO"
  const m = texto(await r.text()).match(/(\d{2}-\d{2}-\d{4} \d{2}:\d{2}) (.+?)(?= \d{2}-\d{2}-\d{4} \d{2}:\d{2}| Cantidad de movimientos|$)/);
  return m ? `${m[1]} ${m[2].trim()}` : null;
}

async function urbano(guia) {
  const r = await fetch(`https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=4565&cli_codigo=${guia}`,
    { headers: { "User-Agent": "Mozilla/5.0" } });
  // "PAQUETERIA ENTREGA IF - 06-10-2026" o "PAQUETERIA ENTREGA 06-10-2026 CO - Contenerizado 06-10-2026"
  // → fecha + código (+ descripción si viene). PI = Urbano todavía no la admitió.
  const m = texto(await r.text()).match(/PAQUETERIA .*?\b([A-Z]{2}) - ([^0-9]*?) ?(\d{2}-\d{2}-\d{4})/);
  return m ? `${m[3]} ${m[1]}${m[2] ? ` ${m[2].trim()}` : ""}` : null;
}

const items = JSON.parse(fs.readFileSync(FILE, "utf8"));
const hoy = new Date().toISOString().slice(0, 10);
for (const it of items.filter((i) => !i.cerrado)) {
  const ultimo = await (it.courier === "correo" ? correo(it.guia) : urbano(it.guia)).catch((e) => `ERROR ${e.message}`);
  const cambio = ultimo !== it.ultimo;
  console.log(`${cambio ? "🔔" : "  "} ${it.nombre.padEnd(30)} ${it.guia.padEnd(24)} ${ultimo ?? "sin datos"}`);
  if (!ultimo || ultimo.startsWith("ERROR")) continue;
  it.ultimo = ultimo;
  it.chequeado = hoy;
  // ponytail: solo Correo se cierra solo; los códigos de entrega de Urbano 4565 no están medidos → cerrar a mano
  if (it.courier === "correo" && /ENTREGADO|ENTREGA EN SUCURSAL/.test(ultimo)) it.cerrado = true;
}
if (!process.argv.includes("--dry")) fs.writeFileSync(FILE, JSON.stringify(items, null, 1) + "\n");
