// Backfill de ml_orders.pack con parseMlPack ya arreglado. Reusa la función, no reimplementa el regex.
// Uso: npx tsx <este archivo> [--apply]
import pg from "pg";
import { readFileSync } from "node:fs";
import { parseMlPack } from "../lib/ml.ts";

const url = readFileSync(".env.local", "utf8")
  .match(/^DATABASE_URL=(.+)$/m)![1].trim();
const apply = process.argv.includes("--apply");

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

const { rows } = await c.query(
  "select ml_id, pack, created_at, raw->'order_items'->0->'item'->>'id' as item_id, raw->'order_items'->0->'item'->>'title' as title from ml_orders",
);

const diffs = rows
  .map((r) => ({ ...r, nuevo: parseMlPack(r.title, r.item_id) }))
  .filter((r) => r.nuevo !== r.pack);

const porItem = new Map<string, { title: string; de: number; a: number; n: number; desde: string }>();
for (const d of diffs) {
  const k = `${d.item_id}|${d.pack}->${d.nuevo}`;
  const e = porItem.get(k) ?? { title: d.title, de: d.pack, a: d.nuevo, n: 0, desde: d.created_at };
  e.n++;
  if (d.created_at < e.desde) e.desde = d.created_at;
  porItem.set(k, e);
}
for (const [k, v] of porItem) console.log(`${k}  ${v.n} órdenes  desde ${String(v.desde).slice(0, 10)}  ${v.title?.slice(0, 60)}`);
console.log(`\n${diffs.length} filas a corregir de ${rows.length}`);

if (apply && diffs.length) {
  await c.query("update ml_orders set pack = v.pack from (select unnest($1::bigint[]) ml_id, unnest($2::int[]) pack) v where ml_orders.ml_id = v.ml_id", [
    diffs.map((d) => d.ml_id),
    diffs.map((d) => d.nuevo),
  ]);
  const desde = diffs.map((d) => String(d.created_at)).sort()[0].slice(0, 10);
  console.log(`aplicado. recomputando daily_pnl desde ${desde}…`);
  await c.query("select recompute_daily_pnl($1::date, current_date)", [desde]);
  console.log("recompute ok");
}
await c.end();
