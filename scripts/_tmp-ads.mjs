import { ml, ADVERTISER } from './_ml.mjs';
const H = { 'Api-Version': '2' };
for (const p of [`/advertising/advertisers?product_id=PADS`, `/advertising/product_ads/campaigns?advertiser_id=${ADVERTISER}&limit=50`]) {
  const d = await ml(p, {}, '2').catch(e=>({err:String(e).slice(0,120)}));
  console.log('>>>', p, '\n', JSON.stringify(d.body ?? d).slice(0, 2500), '\n');
}
