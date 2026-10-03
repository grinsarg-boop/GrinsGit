import { ml } from './_ml.mjs';
console.log('leido_a', new Date().toISOString());
for (const id of ['MLA1830076567','MLA3692036796']) {
  const p = (await ml(`/items/${id}/price_to_win`, { version: 'v2' })).body;
  const it = (await ml(`/items/${id}`)).body;
  console.log(id, 'price', it.price, 'orig', it.original_price, 'qty', it.available_quantity,
    '| ptw', p.price_to_win, 'cur', p.current_price, 'status', p.status, 'share', p.visit_share,
    'winner', p.winner?.item_id, p.winner?.price, 'inst_win', p.winner?.boosts?.find(b=>b.id==='free_installments')?.status,
    'inst_ours', p.boosts?.find(b=>b.id==='free_installments')?.status, 'sharing', p.competitors_sharing_first_place);
}
const r = await ml('/products/MLA70304457/items', { limit: 20 });
console.log('rivales ficha:', JSON.stringify((r.body?.results||[]).map(x=>({id:x.item_id, price:x.price, seller:x.seller_id, ship:x.shipping?.free_shipping, sold:x.sold_quantity}))));
