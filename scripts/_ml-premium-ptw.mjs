// Lleva la x2 Premium MLA1830076567 a su price_to_win ($33.396) para recuperar la caja de la
// ficha MLA70304457. OK de Pancho 24/09/2026. Dry-run salvo --go.
import { TOKEN, ml } from './_ml.mjs';
const ID = 'MLA1830076567';
const TARGET = 33396;
const GO = process.argv.includes('--go');

// Assert duro: nunca abajo del escalon de comision de $33.000 (fixed_fee $3.320).
if (TARGET < 33000) { console.error('ABORT: el precio cruza el escalon de $33.000'); process.exit(1); }

const antes = await ml(`/items/${ID}/price_to_win`, { version: 'v2' });
const promos = await ml(`/seller-promotions/items/${ID}`, { app_version: 'v2' });
const pd = (promos.body ?? []).find((p) => p.type === 'PRICE_DISCOUNT');
console.log('ANTES  | precio', antes.body.current_price, '| estado', antes.body.status, '/', antes.body.visit_share, '| ptw', antes.body.price_to_win);
console.log('PRICE_DISCOUNT disponible: min', pd?.min_discounted_price, 'max', pd?.max_discounted_price, 'sugerido', pd?.suggested_discounted_price);
if (!pd) { console.error('ABORT: no hay PRICE_DISCOUNT candidato'); process.exit(1); }
if (TARGET < pd.min_discounted_price || TARGET > pd.max_discounted_price) { console.error('ABORT: fuera de rango'); process.exit(1); }

const iso = (d) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 19) + '-03:00';
const start = new Date(Date.now() + 2 * 60_000), finish = new Date(Date.now() + 30 * 86400_000);
const body = { promotion_type: 'PRICE_DISCOUNT', deal_price: TARGET, start_date: iso(start), finish_date: iso(finish) };
console.log('\nPOST /seller-promotions/items/' + ID + '?app_version=v2');
console.log(JSON.stringify(body));
if (!GO) { console.log('\n(dry-run — correr con --go para ejecutar)'); process.exit(0); }

const r = await fetch(`https://api.mercadolibre.com/seller-promotions/items/${ID}?app_version=v2`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
console.log('\nrespuesta', r.status, (await r.text()).slice(0, 500));

await new Promise((s) => setTimeout(s, 8000));
const desp = await ml(`/items/${ID}/price_to_win`, { version: 'v2' });
const it = await ml(`/items/${ID}`);
console.log('\nDESPUES | precio', desp.body.current_price, '| lista', it.body.price, '| estado', desp.body.status, '/', desp.body.visit_share, '| ptw', desp.body.price_to_win, '| ganador', desp.body.winner?.item_id, desp.body.winner?.price);
if (desp.body.current_price < 33000) console.log('\n⚠️⚠️ ALERTA: el precio quedo ABAJO de $33.000 — entra el fixed_fee de $3.320. REVERTIR.');
