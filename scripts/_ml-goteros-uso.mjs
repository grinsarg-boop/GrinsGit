import { ml, ADVERTISER } from './_ml.mjs';
const CAMP = '356403999';
const hoy = new Date(Date.now()-3*3600_000).toISOString().slice(0,10);
const d7 = new Date(Date.now()-3*3600_000-6*86400_000).toISOString().slice(0,10);
const { status, body } = await ml(`/advertising/product_ads/campaigns/${CAMP}`, { date_from: d7, date_to: hoy }, '1');
console.log('campaña', status, JSON.stringify({ name: body.name, status: body.status, budget: body.budget, acos_target: body.acos_target, strategy: body.strategy }, null, 0));
const m = body.metrics ?? {};
console.log('metrics 7d:', JSON.stringify({ cost: m.cost, clicks: m.clicks, prints: m.prints, units: m.units_quantity, acos: m.acos, lost_impression_share_by_budget: m.lost_impression_share_by_budget, lost_impression_share_by_ad_rank: m.lost_impression_share_by_ad_rank }));
// serie diaria
const { body: s } = await ml(`/advertising/product_ads/campaigns/${CAMP}`, { date_from: d7, date_to: hoy, aggregation: 'daily' }, '1');
for (const r of (s.results ?? s.metrics_summary ?? [])) console.log(JSON.stringify(r).slice(0,220));
