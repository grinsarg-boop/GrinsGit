// Lectura solo-GET para el veto ML del 01/10/2026. Vuelca JSON a argv[2].
import { ml, ADVERTISER } from './_ml.mjs';
import { writeFileSync } from 'node:fs';
const out = {};
const IDS = ['MLA3692036796', 'MLA1830076567', 'MLA3030316354', 'MLA3030366476'];
for (const id of IDS) {
  out[id] = {
    item: (await ml(`/items/${id}`, { include_attributes: 'all' }, '2')).body,
    ptw: (await ml(`/items/${id}/price_to_win`, { version: 'v2' })).body,
  };
}
out.ficha = (await ml('/products/MLA70304457/items', {}, '2')).body;
out.prod = (await ml('/products/MLA70304457', {}, '2')).body;
// moderaciones / health del Premium
for (const p of ['/items/MLA1830076567/health', '/items/MLA1830076567/health/actions', '/moderations/infractions/' , '/items/MLA1830076567/description']) {
  out['mod:' + p] = await ml(p, {}, '2');
}
out.promos1830 = await ml('/seller-promotions/items/MLA1830076567', { app_version: 'v2' });
out.promos3692 = await ml('/seller-promotions/items/MLA3692036796', { app_version: 'v2' });
// stock x2 Clasica, segunda lectura
out.stock2 = { at: new Date().toISOString() };
// ads goteros
const base = `/marketplace/advertising/MLA/advertisers/${ADVERTISER}/product_ads`;
const M = 'clicks,prints,cost,cpc,acos,roas,units_quantity,direct_units_quantity,indirect_units_quantity,organic_units_quantity,total_amount';
const IS = 'impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark,cost,clicks,prints,acos,units_quantity,organic_units_quantity';
out.daily = {}; out.is = {};
for (const d of ['2026-09-21','2026-09-22','2026-09-25','2026-09-26','2026-09-27','2026-09-28','2026-09-29','2026-09-30']) {
  out.daily[d] = (await ml(`${base}/campaigns/search`, { date_from: d, date_to: d, metrics: M, limit: 100 }, '2')).body;
  out.is[d] = (await ml(`/marketplace/advertising/MLA/product_ads/campaigns/356403999`, { date_from: d, date_to: d, metrics: IS }, '2')).body;
}
out.is.r2830 = (await ml(`/marketplace/advertising/MLA/product_ads/campaigns/356403999`, { date_from: '2026-09-28', date_to: '2026-09-30', metrics: IS }, '2')).body;
out.is.r1622 = (await ml(`/marketplace/advertising/MLA/product_ads/campaigns/356403999`, { date_from: '2026-09-16', date_to: '2026-09-22', metrics: IS }, '2')).body;
writeFileSync(process.argv[2], JSON.stringify(out, null, 1)); console.log("fase1");
await new Promise((s) => setTimeout(s, 20 * 60_000)); // ponytail: segunda lectura de stock 20 min despues (candado: dos lecturas separadas)
out.stock2.item = (await ml('/items/MLA3692036796', {}, '2')).body?.available_quantity;
out.stock2.item1830 = (await ml('/items/MLA1830076567', {}, '2')).body?.available_quantity;
out.stock2.at2 = new Date().toISOString();
out.ptw2 = (await ml('/items/MLA3692036796/price_to_win', { version: 'v2' })).body;
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('ok');
