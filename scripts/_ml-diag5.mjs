import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';
for (const [id,tag] of [['MLA1830076567','x2 Premium'],['MLA3692036796','x2 Clasica'],['MLA2055177767','x3 cat']]) {
  const { status, body } = await ml(`/seller-promotions/items/${id}`, { app_version:'v2' });
  console.log(`\n=== promos ${tag} (${status})`);
  console.log(JSON.stringify(body).slice(0, 900));
}
const { body: rep } = await ml('/users/262382468');
console.log('\n=== reputacion vendedor:', JSON.stringify({ level: rep.seller_reputation?.level_id, status: rep.seller_reputation?.power_seller_status, metrics: rep.seller_reputation?.metrics }).slice(0,600));

const url = readFileSync('.env.local','utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString:url, ssl:{rejectUnauthorized:false} }); await c.connect();
const f = await c.query(`select max(updated_at) u, max(date)::text d from ml_ad_spend_item`);
console.log('\nads sync: ultimo updated_at', f.rows[0].u, '| ultima fecha', f.rows[0].d);
const s = await c.query(`select max(synced_at) s, max(created_at) c from ml_orders`);
console.log('ml_orders: synced_at', s.rows[0].s, '| ultima orden', s.rows[0].c);
await c.end();
