import { ml } from './_ml.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const SELLER = readFileSync('.env.local','utf8').match(/^ML_SELLER_ID=(.+)$/m)[1].trim();
const out = { seller: SELLER, at: new Date().toISOString() };
const ITEMS = ['MLA3692036796','MLA1830076567','MLA3030316354','MLA1908275639','MLA2055177767','MLA3030316544','MLA3030521696','MLA1796574071','MLA3692896792','MLA1696317995'];
// listado de todas las publicaciones por status
out.list = {};
for (const st of ['active','paused','closed','under_review','inactive']) {
  const r = await ml(`/users/${SELLER}/items/search`, { status: st, limit: 100 });
  out.list[st] = { total: r.body.paging?.total, ids: r.body.results };
}
out.items = {};
for (const id of ITEMS) {
  const it = (await ml(`/items/${id}`)).body;
  const ptw = await ml(`/items/${id}/price_to_win`, { version: 'v2' });
  const vis = await ml(`/items/${id}/visits/time_window`, { last: 17, unit: 'day' });
  const pr = await ml(`/items/${id}/prices`);
  out.items[id] = {
    title: it.title, status: it.status, sub_status: it.sub_status, price: it.price, base_price: it.base_price, original_price: it.original_price,
    avail: it.available_quantity, lt: it.listing_type_id, cpid: it.catalog_product_id, catalog_listing: it.catalog_listing, tags: it.tags, health: it.health,
    last_updated: it.last_updated, date_created: it.date_created, sold: it.sold_quantity, ship: it.shipping?.logistic_type, free: it.shipping?.free_shipping,
    ptw: ptw.status === 200 ? ptw.body : { err: ptw.status, b: ptw.body },
    visits: vis.status === 200 ? Object.fromEntries((vis.body.results ?? []).map(r => [r.date.slice(0,10), r.total])) : vis.status,
    prices: pr.body?.prices?.map(p => ({ type: p.type, amount: p.amount, regular: p.regular_amount, start: p.conditions?.start_time, end: p.conditions?.end_time, promo: p.metadata?.promotion_id ?? p.metadata?.campaign_id, ctx: p.conditions?.context_restrictions })),
  };
}
// segunda lectura de stock (separada)
out.avail2 = {};
for (const id of ITEMS) out.avail2[id] = (await ml(`/items/${id}`, { attributes: 'available_quantity,status' })).body;
// rivales por ficha
out.rivals = {};
for (const cp of [...new Set(Object.values(out.items).map(i => i.cpid).filter(Boolean))]) {
  const r = await ml(`/products/${cp}/items`);
  const pd = await ml(`/products/${cp}`);
  out.rivals[cp] = { name: pd.body?.name, buy_box_winner: pd.body?.buy_box_winner, status: r.status, items: (r.body.results ?? []).map(x => ({ id: x.item_id, seller: x.seller_id, price: x.price, orig: x.original_price, lt: x.listing_type_id, ship: x.shipping?.logistic_type, free: x.shipping?.free_shipping, tags: x.tags })) };
}
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('ok');
