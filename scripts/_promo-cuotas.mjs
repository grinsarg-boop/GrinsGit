import { ml } from './_ml.mjs';
const uid = 262382468;
const tries = [
  ['/users/'+uid+'/installments_campaigns', {}],
  ['/items/MLA3692036796/available_upgrades', {}],
  ['/items/MLA1830076567/available_downgrades', {}],
  ['/sites/MLA/domain_discounts/search', { domain_id: 'MLA-BODY_TREATMENT_PRODUCTS' }],
  ['/items/MLA3692036796/shipping_options', { zip_code: '1425' }],
  ['/users/'+uid+'/item_meli_discounts', {}],
];
for (const [p, q] of tries) {
  const r = await ml(p, q);
  console.log('---', p, r.status, JSON.stringify(r.body).slice(0, 600));
}
// fulfillment / Full elegibilidad
const f = await ml('/items/MLA3692036796/fulfillment_information');
console.log('--- fulfillment_information', f.status, JSON.stringify(f.body).slice(0,400));
