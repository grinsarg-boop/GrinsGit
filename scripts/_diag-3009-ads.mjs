import { ml, ADVERTISER } from './_ml.mjs';
import { writeFileSync } from 'node:fs';
const base = `/marketplace/advertising/MLA/advertisers/${ADVERTISER}/product_ads`;
const M = 'clicks,prints,ctr,cost,cpc,acos,roas,cvr,units_quantity,direct_units_quantity,indirect_units_quantity,organic_units_quantity,organic_units_amount,direct_amount,indirect_amount,total_amount,sov';
const out = {};
const r1 = await ml(`${base}/campaigns/search`, { date_from: '2026-09-16', date_to: '2026-09-22', metrics: M, limit: 100 }, '2');
console.log(r1.status);
out.A = r1.body;
out.B = (await ml(`${base}/campaigns/search`, { date_from: '2026-09-23', date_to: '2026-09-29', metrics: M, limit: 100 }, '2')).body;
out.D30 = (await ml(`${base}/campaigns/search`, { date_from: '2026-09-30', date_to: '2026-09-30', metrics: M, limit: 100 }, '2')).body;
out.daily = {};
for (let t = Date.parse('2026-09-14'); t <= Date.parse('2026-09-30'); t += 86400000) {
  const d = new Date(t).toISOString().slice(0, 10);
  out.daily[d] = (await ml(`${base}/campaigns/search`, { date_from: d, date_to: d, metrics: M, limit: 100 }, '2')).body;
}
out.det = {};
for (const c of out.A.results ?? []) out.det[c.id] = await ml(`/marketplace/advertising/MLA/product_ads/campaigns/${c.id}`, {}, '2');
out.adsA = (await ml(`${base}/ads/search`, { date_from: '2026-09-16', date_to: '2026-09-22', metrics: M, limit: 200 }, '2')).body;
out.adsB = (await ml(`${base}/ads/search`, { date_from: '2026-09-23', date_to: '2026-09-29', metrics: M, limit: 200 }, '2')).body;
out.ads30 = (await ml(`${base}/ads/search`, { date_from: '2026-09-30', date_to: '2026-09-30', metrics: M, limit: 200 }, '2')).body;
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
// detalle con IS (probar variantes)
const IS = 'impression_share,top_impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank,acos_benchmark,cost,clicks,prints';
out.isA = {}; out.isB = {}; out.is30 = {};
for (const c of out.A.results ?? []) {
  out.isA[c.id] = await ml(`/marketplace/advertising/MLA/product_ads/campaigns/${c.id}`, { date_from: '2026-09-16', date_to: '2026-09-22', metrics: IS }, '2');
  out.isB[c.id] = await ml(`/marketplace/advertising/MLA/product_ads/campaigns/${c.id}`, { date_from: '2026-09-23', date_to: '2026-09-29', metrics: IS }, '2');
  out.is30[c.id] = await ml(`/marketplace/advertising/MLA/product_ads/campaigns/${c.id}`, { date_from: '2026-09-30', date_to: '2026-09-30', metrics: IS }, '2');
}
out.adgroups = await ml(`${base}/ad_groups/search`, { date_from: '2026-09-23', date_to: '2026-09-29', limit: 100 }, '2');
writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
console.log('ok2');
