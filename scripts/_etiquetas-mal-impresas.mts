// Que etiquetas salieron con el pack equivocado, contadas por FECHA DE IMPRESION (no de venta).
// El backlog de despacho desacopla las dos: los pedidos que se imprimen un domingo son ventas de
// varios dias antes, porque el tope diario empuja las nuevas a dias subsiguientes. Por eso contar
// por created_at subestima y corre la ventana.
//
// viejo = parseMlPack(title, null)      -> el comportamiento previo al fix: solo regex sobre el titulo
// nuevo = parseMlPack(title, item_id)   -> con PACK_POR_ITEM como primera capa (fix del 21/09 17:38)
// Donde difieren, el sistema habria puesto el pack mal. Si ademas se imprimio ANTES del fix, salio mal.
import pg from "pg";
import { readFileSync } from "node:fs";
import { parseMlPack } from "../lib/ml.ts";

const FIX = new Date("2026-09-21T20:38:00Z"); // 17:38 ART
const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)![1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const { rows } = await c.query(`
  select ml_id, shipment_id, created_at, province, status,
         raw#>>'{order_items,0,item,id}' item_id,
         raw#>>'{order_items,0,item,title}' title
  from ml_orders
  where created_at >= '2026-09-01' and shipment_id is not null and status <> 'cancelled'`);
await c.end();

const malas = rows
  .map((r) => ({ ...r, viejo: parseMlPack(r.title, null), nuevo: parseMlPack(r.title, r.item_id) }))
  .filter((r) => r.viejo !== r.nuevo);
console.log(`ordenes desde el 01/09: ${rows.length} · con pack divergente (viejo≠nuevo): ${malas.length}`);
const porItem: Record<string, number> = {};
for (const m of malas) porItem[`${m.item_id} ${m.viejo}->${m.nuevo}`] = (porItem[`${m.item_id} ${m.viejo}->${m.nuevo}`] ?? 0) + 1;
console.log("por publicacion:", JSON.stringify(porItem, null, 1));

// Fecha de impresion de la etiqueta, una llamada por envio divergente.
const { ml } = await import("./_ml.mjs");
const out: any[] = [];
for (const m of malas) {
  const s = (await ml(`/shipments/${m.shipment_id}`, {}, "2")).body;
  const h = s?.status_history ?? {};
  const imp = h.date_first_printed ?? h.date_ready_to_ship ?? null;
  out.push({ ...m, impresa: imp, dia: imp ? String(imp).slice(0, 10) : "sin imprimir", envio: s?.status });
}
const porDia: Record<string, { n: number; items: Record<string, number> }> = {};
for (const o of out) {
  const e = (porDia[o.dia] ??= { n: 0, items: {} });
  e.n++; e.items[o.item_id] = (e.items[o.item_id] ?? 0) + 1;
}
console.log(`\netiquetas con pack equivocado, por DIA DE IMPRESION:`);
for (const [d, e] of Object.entries(porDia).sort()) {
  const post = d !== "sin imprimir" && new Date(d + "T23:59:00Z") > FIX;
  console.log(`  ${d}  ${String(e.n).padStart(3)}  ${post ? "<<< DESPUES DEL FIX" : ""}  ${JSON.stringify(e.items)}`);
}
const pendientes = out.filter((o) => o.dia === "sin imprimir");
console.log(`\nsin imprimir todavia (se corrigen solas con el fix): ${pendientes.length}`);
