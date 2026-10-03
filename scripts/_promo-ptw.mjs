import { ml } from './_ml.mjs';
const out = {};
for (const id of ['MLA1830076567','MLA3692036796','MLA2055177767']) {
  out[id] = (await ml(`/items/${id}/price_to_win`, { version: 'v2' })).body;
}
out.cat_MLA3030676394 = (await ml('/items/MLA3030676394')).body?.category_id;
out.lp_otra = (await ml('/sites/MLA/listing_prices', { price: 32871.27, category_id: (await ml('/items/MLA3030676394')).body?.category_id, listing_type_id: 'gold_pro' })).body;
console.log(JSON.stringify(out, null, 1));
