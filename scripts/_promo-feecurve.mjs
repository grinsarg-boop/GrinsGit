import { sql } from './_ml.mjs';
const q = `
select (raw->'order_items'->0->>'listing_type_id') lt,
       (raw->'order_items'->0->>'unit_price')::numeric up,
       (raw->'order_items'->0->>'sale_fee')::numeric sf,
       round(((raw->'order_items'->0->>'sale_fee')::numeric / nullif((raw->'order_items'->0->>'unit_price')::numeric,0) *100),2) pct,
       round((raw->'order_items'->0->>'sale_fee')::numeric - 0.155*(raw->'order_items'->0->>'unit_price')::numeric,1) resto_vs_155,
       count(*) n, min(created_at)::date d0, max(created_at)::date d1
from ml_orders
where created_at >= now() - interval '150 days'
  and (raw->'order_items'->0->>'unit_price')::numeric between 15000 and 45000
group by 1,2,3 order by lt, up desc limit 80`;
console.table(await sql(q));
