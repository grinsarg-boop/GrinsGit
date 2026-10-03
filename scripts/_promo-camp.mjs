import { ml } from './_ml.mjs';
const me = await ml('/users/me');
const uid = me.body?.id;
console.log('uid', uid, me.body?.nickname, 'seller_reputation', JSON.stringify(me.body?.seller_reputation?.level_id), me.body?.seller_reputation?.power_seller_status);
for (const v of ['v1','v2']) {
  const u = await ml(`/seller-promotions/users/${uid}`, { app_version: v });
  console.log('users promos', v, u.status, JSON.stringify(u.body).slice(0,3000));
}
const ids = [['P-MLA18027168','DEAL'],['P-MLA18023152','SMART'],['P-MLA18041082','SMART'],['P-MLA18091086','SMART'],['C-MLA1582450','SELLER_COUPON_CAMPAIGN'],['LGH-MLA1000','LIGHTNING']];
for (const [id,t] of ids) {
  const r = await ml(`/seller-promotions/promotions/${id}`, { promotion_type: t, app_version: 'v2' });
  console.log('---', id, t, r.status, JSON.stringify(r.body).slice(0,1500));
}
