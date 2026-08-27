// ponytail: helper compartido de lectura ML. Refresca el token UNA vez (el refresh_token rota:
// dos refresh en paralelo queman uno). Correr desde el repo (necesita .env.local).
import pg from 'pg';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const g = (k) => env.match(new RegExp('^' + k + '=(.+)$', 'm'))?.[1].trim();

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
}
await c.end();

export const TOKEN = tok.access_token;
export const ADVERTISER = '932277';

// GET autenticado. path relativo a api.mercadolibre.com. Devuelve {status, body}.
// ponytail: api-version 1 por defecto — /advertising/* solo responde con esa; /marketplace/* usa 2.
export async function ml(path, params = {}, version = '1') {
  const u = new URL(path.startsWith('http') ? path : `https://api.mercadolibre.com${path}`);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  const r = await fetch(u, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', 'api-version': version },
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// SQL contra el Supabase del proyecto -> filas.
export async function sql(q) {
  const cl = new pg.Client({ connectionString: g('DATABASE_URL'), ssl: { rejectUnauthorized: false } });
  await cl.connect();
  const r = await cl.query(q);
  await cl.end();
  return r.rows;
}
