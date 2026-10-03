import { sql } from './_ml.mjs';
console.log('--- fechas exactas sub-33.000 (últimos 40 días)');
console.table(await sql(`select (created_at at time zone 'America/Argentina/Buenos_Aires')::date d, (raw->'order_items'->0->'item'->>'id') item,
 (raw->'order_items'->0->>'listing_type_id') lt, (raw->'order_items'->0->>'unit_price')::numeric up, (raw->'order_items'->0->>'sale_fee')::numeric sf
from ml_orders where created_at >= now() - interval '40 days' and (raw->'order_items'->0->>'unit_price')::numeric between 25000 and 33005 order by d`));
console.log('--- tasas por item gold_special últimos 20 días');
console.table(await sql(`select (raw->'order_items'->0->'item'->>'id') item, (raw->'order_items'->0->>'listing_type_id') lt,
 round(avg((raw->'order_items'->0->>'sale_fee')::numeric/nullif((raw->'order_items'->0->>'unit_price')::numeric,0)*100),2) pct, count(*) n
from ml_orders where created_at >= now() - interval '20 days' and (raw->'order_items'->0->>'unit_price')::numeric > 33000
group by 1,2 having count(*)>=3 order by n desc limit 20`));
