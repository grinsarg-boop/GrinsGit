// Estampa ad_spend.account_id hacia atrás: el sync traía la cuenta y la tiraba al aplanar, así que
// las filas viejas no saben quién pagó — y sin eso el impuesto de la tarjeta (078) no se puede
// aplicar solo a R3. Re-consulta insights por cuenta y actualiza SOLO account_id (no toca spend,
// product_id ni product_locked). Idempotente.
// Uso: node scripts/backfill-ads-account.mjs [desde YYYY-MM-DD]
import pg from 'pg';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const g = (k) => env.match(new RegExp('^' + k + '=(.+)$', 'm'))?.[1].trim();
const V = g('META_API_VERSION') ?? 'v25.0';
const TOKEN = g('META_ACCESS_TOKEN');
const desde = process.argv[2] ?? '2026-07-01';
const hasta = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });

const c = new pg.Client({ connectionString: g('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
await c.connect();

const cuentas = await (await fetch(
  `https://graph.facebook.com/${V}/me/adaccounts?fields=id,name&limit=200&access_token=${TOKEN}`)).json();
const lista = (cuentas.data ?? []).filter((a) => /^tienda\s*r/i.test(a.name ?? ''));
if (!lista.length) { console.error('sin cuentas "Tienda R"'); process.exit(1); }

for (const { id, name } of lista) {
  const pares = [];
  let url = `https://graph.facebook.com/${V}/${id}/insights?` + new URLSearchParams({
    level: 'ad', fields: 'ad_id', time_increment: '1', limit: '500',
    time_range: JSON.stringify({ since: desde, until: hasta }), access_token: TOKEN,
  });
  while (url) {
    const j = await (await fetch(url)).json();
    if (j.error) { console.error(name, 'ERROR', j.error.message); break; }
    for (const r of j.data ?? []) pares.push([r.date_start, r.ad_id]);
    url = j.paging?.next;
  }
  let tocadas = 0;
  for (let i = 0; i < pares.length; i += 500) {
    const chunk = pares.slice(i, i + 500);
    const vals = chunk.map((_, k) => `($${k * 2 + 2}::date, $${k * 2 + 3}::text)`).join(',');
    const r = await c.query(
      `update ad_spend a set account_id = $1 from (values ${vals}) as v(d, ad)
       where a.date = v.d and a.ad_id = v.ad and a.account_id is distinct from $1`,
      [id, ...chunk.flat()]);
    tocadas += r.rowCount;
  }
  console.log(`${name} (${id}): ${pares.length} filas de Meta, ${tocadas} actualizadas`);
}

const q = await c.query(`select coalesce(account_id,'(sin cuenta)') cta, count(*) filas,
  round(sum(spend)) spend from ad_spend where date >= $1 group by 1 order by 3 desc nulls last`, [desde]);
console.table(q.rows);
await c.end();
