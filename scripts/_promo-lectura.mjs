import { ml } from './_ml.mjs';
const items = ['MLA1830076567','MLA3692036796','MLA2055177767'];
const out = {};
for (const id of items) {
  const p = await ml(`/seller-promotions/items/${id}`, { app_version: 'v2' });
  out[id] = { promos: p };
  const it = await ml(`/items/${id}`);
  out[id].item = it.status === 200 ? {
    price: it.body.price, base_price: it.body.base_price, original_price: it.body.original_price,
    listing_type_id: it.body.listing_type_id, status: it.body.status, available_quantity: it.body.available_quantity,
    sold_quantity: it.body.sold_quantity, catalog_product_id: it.body.catalog_product_id,
    catalog_listing: it.body.catalog_listing, shipping: it.body.shipping, tags: it.body.tags,
    logistic_type: it.body.shipping?.logistic_type, category_id: it.body.category_id,
    sale_terms: it.body.sale_terms,
  } : it;
}
console.log(JSON.stringify(out, null, 1));
