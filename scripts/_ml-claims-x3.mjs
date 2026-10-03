// Reclamos de ML de los ultimos 45 dias, cruzados contra la publicacion que los origino.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';
const ITEMS = { MLA3692036796:'x2 Clasica', MLA1830076567:'x2 Premium', MLA1908275639:'x4', MLA2055177767:'x3 catalogo', MLA3030316544:'x3 Premium', MLA1796574071:'x1' };
const claims = [];
for (const st of ['opened','closed']) {
  for (let off = 0; off <= 400; off += 50) {
    const { status, body } = await ml('/post-purchase/v1/claims/search', { status: st, limit: 50, offset: off });
    if (status !== 200) { console.error(st, status, JSON.stringify(body).slice(0,150)); break; }
    claims.push(...(body.data ?? []));
    if (!body.data?.length || claims.length >= (body.paging?.total ?? 0) + (st==='closed'?0:0)) break;
    if (off + 50 >= (body.paging?.total ?? 0)) break;
  }
}
console.log('reclamos traidos:', claims.length);
const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString:url, ssl:{rejectUnauthorized:false} }); await c.connect();
const ids = [...new Set(claims.map(x => String(x.resource_id)))];
const { rows } = await c.query(`select ml_id, raw#>>'{order_items,0,item,id}' item, (created_at at time zone 'America/Argentina/Buenos_Aires')::date::text venta, shipment_id from ml_orders where ml_id = any($1)`, [ids]);
const mapa = Object.fromEntries(rows.map(r => [r.ml_id, r]));
const por = {};
for (const cl of claims) {
  const o = mapa[String(cl.resource_id)];
  const k = o ? (ITEMS[o.item] ?? o.item) : '(orden no encontrada)';
  (por[k] ??= []).push({ id: cl.id, fecha: cl.date_created?.slice(0,10), venta: o?.venta, status: cl.status, reason: cl.reason_id, type: cl.type });
}
for (const [k, v] of Object.entries(por).sort((a,b) => b[1].length - a[1].length)) {
  console.log(`\n### ${k}: ${v.length}`);
  const porFecha = {};
  for (const x of v) (porFecha[x.fecha] ??= []).push(x);
  for (const [f, xs] of Object.entries(porFecha).sort()) console.log(`  ${f}: ${xs.length}  [${xs.map(x=>x.reason+'/'+x.status).join(', ')}]  ventas: ${[...new Set(xs.map(x=>x.venta))].join(',')}`);
}
await c.end();
