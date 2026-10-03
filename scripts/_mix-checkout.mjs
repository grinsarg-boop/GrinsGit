// Mix de método de pago (tag Shopify) al mismo corte horario: hoy vs domingo pasado vs 7d.
// Uso: cd ~/Downloads/ProyectoEco && node --env-file=.env.local <ruta>/mix-checkout.mjs [HH:MM]
import pg from "pg";
const cut = process.argv[2] || new Date().toLocaleTimeString("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  with o as (
    select created_at at time zone 'America/Argentina/Buenos_Aires' as ts,
      case when tags ilike '%cuotas_3%' then 'cuotas_3'
           when tags ilike '%cod_efectivo%' then 'cod_efectivo'
           when tags ilike '%cod_qr_mp%' then 'cod_qr_mp' else 'otro' end m
    from orders where cancelled_at is null)
  select label, m, count(*) n from (
    select 'A dom 13/09 00-' || $1 label, m from o where ts >= '2026-09-13' and ts < ('2026-09-13 ' || $1)::timestamp
    union all select 'B hoy 20/09 00-' || $1, m from o where ts >= '2026-09-20' and ts < ('2026-09-20 ' || $1)::timestamp
    union all select 'C 7d 13-19/09 00-' || $1 || ' (prom/dia)', m from o where ts >= '2026-09-13' and ts < '2026-09-20' and ts::time < $1::time
    union all select 'D 7d 13-19/09 dia completo (prom/dia)', m from o where ts >= '2026-09-13' and ts < '2026-09-20'
  ) x group by 1,2 order by 1,2`, [cut]);
await c.end();
const g = {}; for (const x of r.rows) (g[x.label] ||= {})[x.m] = +x.n;
for (const l in g) { const v = g[l], tot = Object.values(v).reduce((a, b) => a + b, 0), div = /^[CD]/.test(l) ? 7 : 1;
  console.log(l.padEnd(42), Object.entries(v).map(([k, n]) => `${k} ${(n / div).toFixed(1)} (${(100 * n / tot).toFixed(0)}%)`).join(" · "), `| total ${(tot / div).toFixed(1)}`); }
