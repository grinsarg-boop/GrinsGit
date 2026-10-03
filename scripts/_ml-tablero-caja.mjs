// Tablero: que cuesta recuperar la caja del x2 por cada vehiculo (24/09/2026)
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString:url, ssl:{rejectUnauthorized:false} }); await c.connect();

console.log('# 1) Comision teorica de ML por precio y tipo de listing (categoria MLA8830)');
console.log('tipo         | precio    | pct    | fixed_fee | total     | %efectivo');
for (const lt of ['gold_special','gold_pro']) {
  for (const p of [34000, 33869, 33396, 33231, 33000, 32999, 32547, 31569]) {
    const { body } = await ml('/sites/MLA/listing_prices', { price: p, category_id:'MLA8830', listing_type_id: lt });
    const b = Array.isArray(body) ? body[0] : body;
    const sf = b?.sale_fee_details ?? {};
    const tot = (b?.sale_fee_amount ?? 0);
    console.log(`${lt.padEnd(12)} | ${String(p).padStart(9)} | ${String(sf.percentage_fee ?? '-').padStart(6)} | ${String(sf.fixed_fee ?? '-').padStart(9)} | ${String(Math.round(tot)).padStart(9)} | ${(tot/p*100).toFixed(2)}%`);
  }
}

console.log('\n# 2) Parametros REALES por publicacion (ml_orders, ultimos 10 dias completos)');
const q = await c.query(`
  select raw#>>'{order_items,0,item,id}' item_id, count(*)::int n,
    round(avg(total_amount))::float precio, round(avg(sale_fee))::float fee,
    round(avg(sale_fee)/avg(total_amount)*100,2)::float fee_pct,
    round(avg(ship_cost))::float flete, round(avg(coalesce(tax_withheld,0)))::float ret
  from ml_orders where status <> 'cancelled'
    and created_at >= current_date - interval '10 days' and created_at < current_date
  group by 1 having count(*) > 20 order by 2 desc`);
console.log('item          |   n | precio | fee    | fee%   | flete  | retenc');
for (const r of q.rows) console.log(`${r.item_id} | ${String(r.n).padStart(3)} | ${String(r.precio).padStart(6)} | ${String(r.fee).padStart(6)} | ${String(r.fee_pct).padStart(6)} | ${String(r.flete).padStart(6)} | ${String(r.ret).padStart(6)}`);
await c.end();
