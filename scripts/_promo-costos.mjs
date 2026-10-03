import { sql } from './_ml.mjs';
const q = `
select o.product, o.pack, count(*) n,
  round(avg(o.total_amount/nullif(o.units,0)),2) precio,
  round(avg(o.sale_fee),2) comision,
  round(avg(o.ship_cost),2) flete,
  round(avg(coalesce(o.tax_withheld,0)),2) tax,
  count(*) filter (where o.tax_withheld is not null) tax_n
from ml_orders o
where o.status='paid' and o.created_at >= now() - interval '7 days'
group by 1,2 order by n desc limit 12`;
console.table(await sql(q));
