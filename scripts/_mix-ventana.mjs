// Lectura temprana del copy COD (vivo 21/09 17:54 ART): misma ventana horaria en días previos.
import pg from "pg";
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const desde = process.argv[2] || "17:54", hasta = process.argv[3] || new Date().toLocaleTimeString("en-GB",{timeZone:"America/Argentina/Buenos_Aires",hour:"2-digit",minute:"2-digit"});
const r = await c.query(`
  with o as (
    select created_at at time zone 'America/Argentina/Buenos_Aires' as ts,
      case when tags ilike '%cuotas_3%' then 'cuotas_3'
           when tags ilike '%cod_efectivo%' then 'cod_efectivo'
           when tags ilike '%cod_qr_mp%' then 'cod_qr_mp' else 'otro' end m
    from orders where cancelled_at is null),
  w as (select * from o where ts::time >= $1::time and ts::time < $2::time)
  select label, m, count(*) n from (
    select '1 lun 21/09 (POST copy COD)' label, m from w where ts::date = '2026-09-21'
    union all select '2 dom 20/09 (post badge)', m from w where ts::date = '2026-09-20'
    union all select '3 lun 14/09', m from w where ts::date = '2026-09-14'
    union all select '4 lun 07/09', m from w where ts::date = '2026-09-07'
    union all select '5 prom/dia 7d 14-20/09', m from w where ts::date between '2026-09-14' and '2026-09-20'
    union all select '6 prom/dia lunes 24/08-14/09 (4)', m from w where ts::date in ('2026-08-24','2026-08-31','2026-09-07','2026-09-14')
  ) x group by 1,2 order by 1,2`, [desde, hasta]);
// dia completo 21/09 antes del cambio vs mismos dias, para ver si el lunes venia flojo de por si
const r2 = await c.query(`
  with o as (select created_at at time zone 'America/Argentina/Buenos_Aires' as ts from orders where cancelled_at is null)
  select d::date d, count(*) n from o, lateral (select ts::date d) q where ts::time < $1::time and ts::date in ('2026-09-21','2026-09-20','2026-09-14','2026-09-07') group by 1 order by 1 desc`, [desde]);
await c.end();
const g = {}; for (const x of r.rows) (g[x.label] ||= {})[x.m] = +x.n;
console.log(`Ventana ${desde}–${hasta} ART, pedidos no cancelados por método:`);
for (const l in g) { const v = g[l], tot = Object.values(v).reduce((a,b)=>a+b,0), div = /^5/.test(l)?7:/^6/.test(l)?4:1;
  console.log(l.padEnd(36), ["cod_qr_mp","cod_efectivo","cuotas_3","otro"].filter(k=>v[k]).map(k=>`${k} ${(v[k]/div).toFixed(1)} (${(100*v[k]/tot).toFixed(0)}%)`).join(" · "), `| total ${(tot/div).toFixed(1)}`); }
console.log(`\nMismos días, 00:00–${desde} (antes del cambio): ` + r2.rows.map(x=>`${x.d.toISOString().slice(5,10)} ${x.n}`).join(" · "));
