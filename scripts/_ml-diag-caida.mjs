// Diagnostico de la caida de ML (24/09/2026): caja en vivo + visitas/dia + ads/dia por publicacion.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';

const ITEMS = {
  MLA3692036796: 'x2 Clasica',
  MLA1830076567: 'x2 Premium',
  MLA1908275639: 'x4',
  MLA2055177767: 'x3 catalogo',
  MLA3030316544: 'x3 Premium',
  MLA1796574071: 'x1',
};

console.log('# CAJA EN VIVO (price_to_win v2)\n');
console.log('item            | tag          | precio    | status                 | visit_share | ganador          | p_to_win  | comp');
for (const [id, tag] of Object.entries(ITEMS)) {
  const { status, body } = await ml(`/items/${id}/price_to_win`, { version: 'v2' });
  if (status !== 200) { console.log(`${id} | ${tag} | ERROR ${status} ${JSON.stringify(body).slice(0,120)}`); continue; }
  const w = body.winner ?? {};
  console.log(
    `${id} | ${tag.padEnd(12)} | ${String(body.current_price ?? '-').padStart(9)} | ${String(body.status ?? '-').padEnd(22)} | ` +
    `${String(body.visit_share ?? '-').padEnd(11)} | ${String(w.item_id ?? '-').padEnd(16)} | ${String(w.price ?? '-').padStart(9)} | ${body.competitors_sharing_first_place ?? '-'}`);
}

console.log('\n# VISITAS POR DIA (ultimos 16 dias, API en vivo)\n');
const visitas = {};
for (const id of Object.keys(ITEMS)) {
  const { status, body } = await ml(`/items/${id}/visits/time_window`, { last: 16, unit: 'day' });
  if (status !== 200) continue;
  visitas[id] = Object.fromEntries((body.results ?? []).map((r) => [r.date.slice(0, 10), r.total]));
}
const dias = [...new Set(Object.values(visitas).flatMap((v) => Object.keys(v)))].sort();
console.log('dia        | ' + Object.values(ITEMS).map((t) => t.padStart(12)).join(' | ') + ' |  TOTAL');
for (const d of dias) {
  const row = Object.keys(ITEMS).map((id) => String(visitas[id]?.[d] ?? 0).padStart(12));
  const tot = Object.keys(ITEMS).reduce((a, id) => a + (visitas[id]?.[d] ?? 0), 0);
  console.log(`${d} | ${row.join(' | ')} | ${String(tot).padStart(6)}`);
}

// Base: ads por item por dia + ordenes por item por dia
const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

console.log('\n# PRODUCT ADS por dia (ml_ad_spend_item, NETO sin IVA) — ultimos 14 dias\n');
const ads = await c.query(`
  select date::text as d, item_id, sum(spend)::float as spend, sum(clicks)::int as clicks,
         sum(prints)::int as prints, sum(direct_units + indirect_units)::int as units
  from ml_ad_spend_item where date >= current_date - interval '14 days'
  group by 1,2 order by 1 desc,3 desc`).catch((e) => ({ rows: [], err: e.message }));
if (ads.err) console.log('  (no se pudo leer ml_ad_spend_item:', ads.err, ')');
const byDay = new Map();
for (const r of ads.rows ?? []) {
  if (!byDay.has(r.d)) byDay.set(r.d, []);
  byDay.get(r.d).push(r);
}
console.log('dia        |      spend |  clicks |   prints | units | CPC   | top item');
for (const d of [...byDay.keys()].sort().reverse()) {
  const rs = byDay.get(d);
  const s = rs.reduce((a, r) => a + r.spend, 0), cl = rs.reduce((a, r) => a + r.clicks, 0);
  const pr = rs.reduce((a, r) => a + r.prints, 0), u = rs.reduce((a, r) => a + r.units, 0);
  const top = rs[0];
  console.log(`${d} | ${Math.round(s).toLocaleString('es-AR').padStart(10)} | ${String(cl).padStart(7)} | ${String(pr).padStart(8)} | ${String(u).padStart(5)} | ${cl ? Math.round(s/cl) : '-'} | ${ITEMS[top.item_id] ?? top.item_id} ${Math.round(top.spend).toLocaleString('es-AR')}`);
}

console.log('\n# ORDENES Y PRECIO por publicacion y dia (ml_orders, ultimos 14 dias)\n');
const o = await c.query(`
  select (created_at at time zone 'America/Argentina/Buenos_Aires')::date::text as d,
         raw#>>'{order_items,0,item,id}' as item_id,
         count(*)::int as n,
         round(avg((raw#>>'{order_items,0,unit_price}')::numeric))::float as precio
  from ml_orders
  where status <> 'cancelled' and created_at >= current_date - interval '14 days'
  group by 1,2 order by 1 desc`);
const od = new Map();
for (const r of o.rows) { if (!od.has(r.d)) od.set(r.d, {}); od.get(r.d)[r.item_id] = r; }
console.log('dia        | ' + Object.values(ITEMS).map((t) => t.padStart(13)).join(' | ') + ' | TOT');
for (const d of [...od.keys()].sort().reverse()) {
  const row = Object.keys(ITEMS).map((id) => {
    const r = od.get(d)[id];
    return (r ? `${r.n}@${Math.round(r.precio/1000)}k` : '-').padStart(13);
  });
  const tot = Object.values(od.get(d)).reduce((a, r) => a + r.n, 0);
  console.log(`${d} | ${row.join(' | ')} | ${tot}`);
}
await c.end();
