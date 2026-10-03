import { sql } from './_ml.mjs';
console.table(await sql(`select date, item_id, round(cost) cost from ml_ad_spend_item where date between current_date-8 and current_date-1 and item_id in ('MLA3692036796','MLA1830076567') order by 1 desc, cost desc`));
console.table(await sql(`select (created_at at time zone 'America/Argentina/Buenos_Aires')::date d, (raw->'order_items'->0->'item'->>'id') item, count(*) n, round(avg((raw->'order_items'->0->>'unit_price')::numeric)) precio
from ml_orders where status='paid' and created_at >= now() - interval '9 days' and (raw->'order_items'->0->'item'->>'id') in ('MLA3692036796','MLA1830076567') group by 1,2 order by 1 desc, n desc`));
