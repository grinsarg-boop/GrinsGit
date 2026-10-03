import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';
const IDS = { MLA3692036796:'x2 Clasica', MLA1830076567:'x2 Premium', MLA2055177767:'x3 catalogo', MLA3030316544:'x3 Premium' };
for (const [id,tag] of Object.entries(IDS)) {
  const { body } = await ml(`/items/${id}/price_to_win`, { version:'v2' });
  console.log(`\n=== ${tag} ${id} ===`);
  console.log(JSON.stringify(body, null, 1).slice(0, 1400));
}
// La ficha de catalogo: quienes compiten y a cuanto
const { body: it } = await ml('/items/MLA3692036796');
console.log('\n=== catalog_product_id x2:', it.catalog_product_id, ' catalog_listing:', it.catalog_listing);
const { status, body: comp } = await ml(`/products/${it.catalog_product_id}/items`, { limit: 10 });
console.log('status', status, JSON.stringify(comp).slice(0, 1800));
