import { ml } from './_ml.mjs';
const pairs = [['C-MLA1582450','SELLER_COUPON_CAMPAIGN'],['P-MLA18023152','SMART'],['P-MLA18041082','SMART'],['P-MLA18027168','DEAL'],['P-MLA18015134','DEAL'],['P-MLA17979010','DEAL'],['P-MLA18091086','SMART'],['P-MLA18091144','SMART']];
for (const [id,t] of pairs) {
  const r = await ml(`/seller-promotions/promotions/${id}/items`, { promotion_type: t, app_version: 'v2', limit: 50 });
  const b = r.body;
  const res = (b?.results||[]).map(x=>`${x.id} st=${x.status} p=${x.price??x.deal_price??''} orig=${x.original_price??''}`);
  console.log('---',id,t,r.status,'total',b?.paging?.total, res.slice(0,12).join(' | '));
}
console.log('=== oferta actual del item (SMART started) ===');
for (const [pid,t] of [['P-MLA18023152','SMART'],['P-MLA18041082','SMART']]) {
  const r = await ml('/seller-promotions/items/MLA1830076567', { promotion_id: pid, promotion_type: t, app_version: 'v2' });
  console.log(pid, r.status, JSON.stringify(r.body).slice(0,1200));
}
