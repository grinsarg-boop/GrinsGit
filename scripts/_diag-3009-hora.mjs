import { sql } from './_ml.mjs';
const r = await sql(`select (created_at at time zone 'America/Argentina/Buenos_Aires')::date::text d, extract(hour from created_at at time zone 'America/Argentina/Buenos_Aires')::int h,
 raw#>>'{order_items,0,item,id}' item, count(*)::int n, string_agg(distinct (raw#>>'{order_items,0,unit_price}'),',') p
 from ml_orders where status='paid' and created_at >= '2026-09-27T03:00Z' and created_at < '2026-10-01T15:00Z'
 and raw#>>'{order_items,0,item,id}' in ('MLA3692036796','MLA1908275639','MLA3030521696') group by 1,2,3 order by 3,1,2`);
const m = {}; for (const x of r) ((m[x.item] ??= {})[x.d] ??= Array(24).fill('.'))[x.h] = x.n;
for (const [it, ds] of Object.entries(m)) { console.log(it); for (const [d, a] of Object.entries(ds)) console.log(' ', d, a.map(v=>String(v).padStart(2)).join(' ')); }
console.log(r.filter(x=>x.item!=='MLA3692036796' && x.d>='2026-09-28').map(x=>`${x.item} ${x.d} ${x.h}h n${x.n} p${x.p}`).join('\n'));
const s = await sql(`select max(created_at) mx, count(*) from ml_orders where created_at >= '2026-10-01T03:00Z'`); console.log(s);
