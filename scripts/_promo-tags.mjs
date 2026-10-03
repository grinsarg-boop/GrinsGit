import { ml, sql } from './_ml.mjs';
const rows = await sql(`select (raw->'order_items'->0->'item'->>'id') item, (raw->'order_items'->0->>'listing_type_id') lt,
 (raw->'order_items'->0->>'unit_price')::numeric up, (raw->'order_items'->0->>'sale_fee')::numeric sf, count(*) n
from ml_orders where created_at >= now() - interval '25 days' and (raw->'order_items'->0->>'unit_price')::numeric > 33000
group by 1,2,3,4 order by n desc limit 40`);
const seen = new Map();
for (const r of rows) {
  const k = r.item + '|' + r.lt;
  const pct = +(r.sf / r.up * 100).toFixed(2);
  if (!seen.has(k)) seen.set(k, { item: r.item, lt: r.lt, pct, n: +r.n, up: +r.up });
}
const out = [];
for (const v of seen.values()) {
  const it = (await ml(`/items/${v.item}`)).body;
  const cuotas = (it.sale_terms||[]).find(s=>s.id==='INSTALLMENTS_CAMPAIGN')?.value_name || '—';
  const lp = (await ml('/sites/MLA/listing_prices', { price: v.up, category_id: it.category_id, listing_type_id: v.lt })).body?.sale_fee_details;
  out.push({ item: v.item, cat: it.category_id, lt: v.lt, n: v.n, precio: v.up, pct_real: v.pct,
    pct_api: lp?.percentage_fee, base_api: lp?.meli_percentage_fee, fin_api: lp?.financing_add_on_fee,
    delta: +(v.pct - lp?.percentage_fee).toFixed(2), cuotas_tag: cuotas });
}
console.table(out.sort((a,b)=>b.n-a.n));
