// Cambios ML aprobados 04/08/2026 — SEGUNDA PASADA.
// El precio del x1 ya se aplico y quedo winning: NO se repite aca.
// Uso: node scripts/ml-cambios-0408.mjs
import pg from 'pg';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const g = (k) => env.match(new RegExp('^' + k + '=(.+)$', 'm'))?.[1].trim();

// Token vivo de settings.ml_token; refresca y persiste solo si vencio (el refresh_token rota).
const c = new pg.Client({ connectionString: g('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
await c.connect();
let tok = (await c.query("select value from settings where key='ml_token'")).rows[0]?.value;
if (!tok?.expires_at || tok.expires_at - 300_000 <= Date.now()) {
  const j = await (await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'refresh_token', client_id: g('ML_CLIENT_ID'),
      client_secret: g('ML_CLIENT_SECRET'), refresh_token: tok.refresh_token,
    }),
  })).json();
  if (!j.access_token) { console.error('refresh fallo:', j); process.exit(1); }
  tok = { access_token: j.access_token, refresh_token: j.refresh_token || tok.refresh_token, expires_at: Date.now() + (j.expires_in ?? 21600) * 1000 };
  await c.query("update settings set value=$1 where key='ml_token'", [tok]);
  console.log('token refrescado\n');
}
await c.end();

const H = { Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json', 'api-version': '2' };
const put = async (url, body) => {
  const r = await fetch(url, { method: 'PUT', headers: H, body: JSON.stringify(body) });
  return { code: r.status, body: await r.json().catch(() => ({})) };
};

// 1. Pausar los dos ads con cero unidades atribuidas.
//    La ruta buena NO lleva el segmento /advertisers/932277 (esa da 404).
for (const item of ['MLA1707704557', 'MLA3030676394']) {
  const r = await put(`https://api.mercadolibre.com/marketplace/advertising/MLA/product_ads/ads/${item}`, { status: 'paused' });
  console.log(`pausar ad ${item}\n   ${r.code} ${JSON.stringify(r.body).slice(0, 250)}\n`);
}

// 2. Campaña Revival. El PUT en /marketplace dio 401 "does not have permission to write";
//    probamos tambien la ruta legacy por si la escritura vive solo ahi.
for (const base of [
  'https://api.mercadolibre.com/marketplace/advertising/MLA/product_ads/campaigns/356519403',
  'https://api.mercadolibre.com/advertising/product_ads/campaigns/356519403',
]) {
  const r = await put(base, { budget: 39800, acos_target: 14, status: 'active' });
  console.log(`campaña Revival via ${base.includes('marketplace') ? 'marketplace' : 'legacy'}\n   ${r.code} ${JSON.stringify(r.body).slice(0, 250)}\n`);
  if (r.code < 300) break;
}

// ─── REVERTIR ────────────────────────────────────────────────────────────────
// ads MLA1707704557 y MLA3030676394 -> status active
// campaña 356519403 -> budget 45790, acos_target 20 (strategy PROFITABILITY, roas_target 5.0)
// precio MLA3356284130 -> 30990   (YA APLICADO A 33100, winning · solo si hay que dar marcha atras)
