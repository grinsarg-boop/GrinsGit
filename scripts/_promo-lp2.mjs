import { ml } from './_ml.mjs';
for (const lt of ['gold_special','gold_pro']) {
  for (const p of [33231, 32999]) {
    const r = await ml('/sites/MLA/listing_prices', { price: p, category_id: 'MLA8830', listing_type_id: lt });
    console.log('MLA8830', lt, p, JSON.stringify(r.body?.sale_fee_details), 'total', r.body?.sale_fee_amount);
  }
}
