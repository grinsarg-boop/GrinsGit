import { sql, ml } from './_ml.mjs';
const q = `
select (raw->'order_items'->0->'item'->>'id') item,
       (raw->'order_items'->0->>'listing_type_id') lt,
       (raw->'order_items'->0->>'unit_price')::numeric up,
       (raw->'order_items'->0->>'sale_fee')::numeric sf,
       count(*) n, max(created_at)::date d1
from ml_orders
where created_at >= now() - interval '25 days'
  and (raw->'order_items'->0->>'unit_price')::numeric between 25000 and 33000
group by 1,2,3,4 order by up desc limit 30`;
const rows = await sql(q);
for (const r of rows) {
  const base = r.lt === 'gold_pro' ? 0.244 : 0.205;
  r.pct = (r.sf / r.up * 100).toFixed(2);
  r.resto = (r.sf - base * r.up).toFixed(1);
}
console.table(rows);
// barrido fino del umbral
for (const p of [33001,33000,32999,32900,20000,18001,18000,17999,12000]) {
  const r = await ml('/sites/MLA/listing_prices', { price: p, category_id: 'MLA8830', listing_type_id: 'gold_special' });
  console.log(p, 'fixed=', r.body?.sale_fee_details?.fixed_fee, 'pct=', r.body?.sale_fee_details?.percentage_fee, 'total=', r.body?.sale_fee_amount);
}
