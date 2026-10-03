import { ml } from './_ml.mjs';
const prices = [42290,39677,33869,33396,33231,33100,33000,32999,32952,32547,32234,31569,29908,28984,28246,17996];
const rows = [];
for (const p of prices) {
  for (const lt of ['gold_special','gold_pro']) {
    const r = await ml('/sites/MLA/listing_prices', { price: p, category_id: 'MLA8830', listing_type_id: lt });
    const b = r.body;
    const sf = b?.sale_fee_details || {};
    rows.push({ p, lt, sale_fee_amount: b?.sale_fee_amount, pct: sf.percentage_fee, gross: sf.gross_amount, fixed: sf.fixed_fee, meli_pct: sf.meli_percentage_fee, listing_fee: b?.listing_fee_amount, free_ship: b?.requires_picture });
  }
}
console.table(rows);
