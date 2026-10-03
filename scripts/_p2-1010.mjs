// 01/10/2026 — con OK de Pancho en chat: meter P2 (x2 Clásica MLA3692036796) en la SMART "Ofertas compartidas 10.10".
// Dry-run por defecto; APLICAR=1 escribe.
import { TOKEN, ml } from './_ml.mjs';
const APLICAR = process.env.APLICAR === '1';
const ID = 'MLA3692036796', PROMO = 'P-MLA18091086';
const p = await ml(`/seller-promotions/items/${ID}`, { app_version: 'v2' });
const o = (p.body ?? []).find?.(x => x.id === PROMO);
console.log('oferta', p.status, JSON.stringify(o));
const it = (await ml(`/items/${ID}`, { attributes: 'category_id,listing_type_id,price,tags' })).body;
const fee = await ml('/sites/MLA/listing_prices', { price: o?.price, listing_type_id: it.listing_type_id, category_id: it.category_id });
console.log('item', JSON.stringify(it));
console.log('fee @promo', JSON.stringify(fee.body?.sale_fee_details ?? fee.body));
if (!o || o.status !== 'candidate') process.exit(console.log('no es candidata, corto'));
if (APLICAR) {
  const r = await fetch(`https://api.mercadolibre.com/seller-promotions/items/${ID}?app_version=v2`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ promotion_id: PROMO, promotion_type: 'SMART', offer_id: o.ref_id }),
  });
  console.log('POST', r.status, (await r.text()).slice(0, 400));
} else console.log('dry-run: SMART', PROMO, 'offer_id', o.ref_id);
