import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';
const ITEMS = { MLA3692036796:'x2 Clasica', MLA1830076567:'x2 Premium', MLA1908275639:'x4', MLA2055177767:'x3 catalogo', MLA3030316544:'x3 Premium', MLA1796574071:'x1' };
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl:{rejectUnauthorized:false} }); await c.connect();

console.log('# PRODUCT ADS (ml_ad_spend_item.cost, NETO) por dia — 14 dias');
const a = await c.query(`select date::text d, item_id, sum(cost)::float cost from ml_ad_spend_item
  where date >= current_date - interval '14 days' group by 1,2 order by 1 desc`);
const m = new Map();
for (const r of a.rows) { if(!m.has(r.d)) m.set(r.d,{}); m.get(r.d)[r.item_id]=r.cost; }
console.log('dia        | ' + Object.values(ITEMS).map(t=>t.padStart(11)).join(' | ') + ' |      TOTAL');
for (const d of [...m.keys()].sort().reverse()) {
  const row = Object.keys(ITEMS).map(id => Math.round(m.get(d)[id]??0).toLocaleString('es-AR').padStart(11));
  const tot = Object.values(m.get(d)).reduce((x,y)=>x+y,0);
  console.log(`${d} | ${row.join(' | ')} | ${Math.round(tot).toLocaleString('es-AR').padStart(10)}`);
}
await c.end();

console.log('\n# EL GANADOR DE LA FICHA');
for (const id of ['MLA3983995152','MLA3944865964']) {
  const { body } = await ml(`/items/${id}`);
  const s = body.seller_id;
  const { body: sel } = await ml(`/users/${s}`).catch(()=>({body:{}}));
  console.log(`${id} | $${body.price} | ${body.title} | vendidos:${body.sold_quantity} | seller ${s} ${sel?.nickname??''} | ship free:${body.shipping?.free_shipping} | listing:${body.listing_type_id} | status:${body.status} | disponible:${body.available_quantity}`);
}

console.log('\n# NUESTRAS PUBLICACIONES: precio, oferta y estado');
for (const [id,tag] of Object.entries(ITEMS)) {
  const { body } = await ml(`/items/${id}`, { include_attributes:'all' });
  const dp = body.sale_terms; // no
  console.log(`${id} ${tag.padEnd(12)} | lista $${body.price} | base $${body.base_price} | orig $${body.original_price ?? '-'} | ${body.listing_type_id} | ${body.status}/${body.sub_status?.join(',')||'-'} | stock ${body.available_quantity} | last_upd ${body.last_updated?.slice(0,16)}`);
}
