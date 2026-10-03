import { sql } from './_ml.mjs';
const d = `(created_at at time zone 'America/Argentina/Buenos_Aires')::date`;
console.log('# por dia');
for (const r of await sql(`select ${d}::text d, count(*) filter (where status='paid')::int paid, count(*)::int todas,
  sum(units) filter (where status='paid')::int u, round(sum(total_amount) filter (where status='paid'))::bigint rev
  from ml_orders where created_at >= '2026-09-15T03:00Z' and created_at < '2026-10-01T03:00Z' group by 1 order by 1`)) console.log(JSON.stringify(r));
console.log('# por item x semana (paid)');
for (const r of await sql(`select case when ${d} <= '2026-09-22' then 'A' else 'B' end w, raw#>>'{order_items,0,item,id}' item,
  left(raw#>>'{order_items,0,item,title}',60) t, raw#>>'{order_items,0,listing_type_id}' lt, count(*)::int n, sum(units)::int u, round(avg((raw#>>'{order_items,0,unit_price}')::numeric))::int p
  from ml_orders where status='paid' and ${d} between '2026-09-16' and '2026-09-30' group by 1,2,3,4 having count(*)>=5 order by 2,1`)) console.log(JSON.stringify(r));
console.log('# mix pack x semana');
for (const r of await sql(`select case when ${d} <= '2026-09-22' then 'A' else 'B' end w, pack, count(*)::int n
  from ml_orders where status='paid' and ${d} between '2026-09-16' and '2026-09-30' group by 1,2 order by 1,2`)) console.log(JSON.stringify(r));
