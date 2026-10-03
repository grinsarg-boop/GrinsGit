import { sql } from './_ml.mjs';
const d = `(created_at at time zone 'America/Argentina/Buenos_Aires')::date`;
const rows = await sql(`select ${d}::text d, raw#>>'{order_items,0,item,id}' item, count(*)::int n,
  round(avg((raw#>>'{order_items,0,unit_price}')::numeric))::int p, min((raw#>>'{order_items,0,unit_price}')::numeric)::int pmin, max((raw#>>'{order_items,0,unit_price}')::numeric)::int pmax,
  string_agg(distinct left(raw#>>'{order_items,0,item,title}',12),'|') t
  from ml_orders where status='paid' and ${d} between '2026-09-14' and '2026-09-30' group by 1,2`);
const items = ['MLA3692036796','MLA1830076567','MLA3030316354','MLA1908275639','MLA2055177767','MLA3030316544','MLA3030521696','MLA1796574071'];
const m = {}; for (const r of rows) (m[r.d] ??= {})[r.item] = r;
console.log('dia | ' + items.join(' | ') + ' | otros');
for (const day of Object.keys(m).sort()) {
  const o = Object.entries(m[day]).filter(([k]) => !items.includes(k)).reduce((a, [, r]) => a + r.n, 0);
  console.log(day + ' | ' + items.map(i => m[day][i] ? `${m[day][i].n}@${m[day][i].pmin===m[day][i].pmax?m[day][i].p:m[day][i].pmin+'-'+m[day][i].pmax}` : '-').join(' | ') + ' | ' + o);
}
console.log('# titulos P2 por dia');
for (const r of rows.filter(r => r.item==='MLA3692036796').sort((a,b)=>a.d<b.d?-1:1)) console.log(r.d, r.t);
