// PDF de seguimiento de los BeeVenom redespachados: nº de pedido + link.
// Urbano tiene link directo. Fixy NO: su página pide captcha y no acepta deep-link, así que va el
// nº de guía para tipear (el endpoint /seguimiento/<guia> devuelve JSON, no sirve para un cliente).
import fs from "node:fs";
import pg from "pg";
import { htmlToPdf } from "/Users/franciscoandreudegasperi/Downloads/ProyectoEco/scripts/html2pdf.mjs";

const R = "/Users/franciscoandreudegasperi/Downloads/ProyectoEco";
const S = "/private/tmp/claude-501/-Users-franciscoandreudegasperi-Downloads-ProyectoEco/4d002424-6445-485a-a40a-6b6430b15f62/scratchpad";
const urb = JSON.parse(fs.readFileSync(`${R}/.redespacho-urbano.json`, "utf8"));
const fix = JSON.parse(fs.readFileSync(`${R}/.redespacho-fixy.json`, "utf8"));

const peds = [...Object.keys(urb), ...Object.keys(fix)];
const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
const { rows } = await db.query(
  `select o.order_number, o.customer_name, o.province, o.cod_amount,
          (select sum(oi.pack) from order_items oi where oi.order_id = o.id) as unidades
     from orders o where o.order_number = any($1::text[])`, [peds]);
await db.end();
const info = new Map(rows.map((r) => [r.order_number, r]));

const SHIPPER = String(process.env.URBANO_SHIPPER).padStart(6, "0");
const linkUrbano = (c) => `https://apis.urbano.com.ar/cespecifica/?tracking=${SHIPPER}${c}`;

const filas = [
  ...Object.values(urb).map((l) => ({ courier: "Urbano", ...l, link: linkUrbano(l.guia), ref: l.guia })),
  ...Object.values(fix).map((l) => ({ courier: "Fixy", ...l, link: null, ref: `guía ${l.guia}` })),
].map((f) => ({ ...f, ...info.get(f.pedido) }))
 .sort((a, b) => a.courier.localeCompare(b.courier) || Number(a.pedido) - Number(b.pedido));

const esc = (s) => String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
const filasHtml = filas.map((f) => `<tr>
  <td class="ped">#${esc(f.pedido)}</td>
  <td>${esc(f.customer_name)}</td>
  <td class="prov">${esc(f.province)}</td>
  <td class="cou ${f.courier.toLowerCase()}">${f.courier}</td>
  <td class="cod">${esc(f.ref)}</td>
  <td class="lnk">${f.link ? `<a href="${f.link}">Ver seguimiento</a>` : `<span class="sin">buscar la guía en<br>fixy.epresis.com/seguimiento</span>`}</td>
</tr>`).join("\n");

const nUrb = filas.filter((f) => f.courier === "Urbano").length;
const nFix = filas.length - nUrb;
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Seguimiento BeeVenom</title><style>
  *{box-sizing:border-box} body{font:11px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:0;padding:22px 26px}
  h1{font-size:17px;margin:0 0 3px} .sub{color:#666;font-size:11px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse} th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.06em;color:#888;border-bottom:1.5px solid #333;padding:0 6px 5px}
  td{padding:5px 6px;border-bottom:1px solid #e6e6e6;vertical-align:top}
  .ped{font-weight:700;white-space:nowrap} .prov{color:#555} .cod{font-family:ui-monospace,Menlo,monospace;font-size:10px;white-space:nowrap}
  .cou{font-weight:600;font-size:10px;white-space:nowrap} .cou.urbano{color:#c0392b} .cou.fixy{color:#1565c0}
  .lnk a{color:#0645ad} .sin{color:#777;font-size:9px;line-height:1.3}
  tr{break-inside:avoid} thead{display:table-header-group}
</style></head><body>
<h1>BeeVenom redespachados — seguimiento</h1>
<div class="sub">${filas.length} pedidos · ${nUrb} Urbano · ${nFix} Fixy. Los de Fixy no tienen link directo: su seguimiento pide captcha, hay que pegar el nº de guía.</div>
<table><thead><tr><th>Pedido</th><th>Cliente</th><th>Provincia</th><th>Courier</th><th>Código</th><th>Seguimiento</th></tr></thead>
<tbody>${filasHtml}</tbody></table>
</body></html>`;

fs.writeFileSync(`${S}/seguimientos.html`, html);
const out = `${process.env.HOME}/Downloads/seguimiento-beevenom.pdf`;
await htmlToPdf(`${S}/seguimientos.html`, out, 21, 29.7, 1);
console.log(`${filas.length} pedidos (${nUrb} Urbano + ${nFix} Fixy) → ${out}`);
