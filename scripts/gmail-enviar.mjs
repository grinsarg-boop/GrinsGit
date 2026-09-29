// Manda un mail ya armado (.eml, RFC 822) por la API de Gmail. Lo usa scripts/fixy-mail.sh.
//   node scripts/gmail-enviar.mjs <alias> <archivo.eml>
// Token: GMAIL_SEND_TOKEN_<ALIAS> en .env.local. Lo escribe `node scripts/gmail-urbano.mjs --auth <alias> --send`
// (scope gmail.send: solo manda, no lee la casilla). Si el .eml no trae From, Gmail pone la casilla del token.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ENV = readFileSync(join(import.meta.dirname, '..', '.env.local'), 'utf8');
const env = (k) => ENV.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim();
const [alias, eml] = process.argv.slice(2);
const refresh = alias && env(`GMAIL_SEND_TOKEN_${alias.toUpperCase()}`);
if (!refresh || !eml) { console.error('uso: gmail-enviar.mjs <alias> <archivo.eml>  ·  y GMAIL_SEND_TOKEN_<ALIAS> en .env.local'); process.exit(1); }

const t = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ client_id: env('GOOGLE_OAUTH_CLIENT_ID'), client_secret: env('GOOGLE_OAUTH_CLIENT_SECRET'), refresh_token: refresh, grant_type: 'refresh_token' }),
}).then((r) => r.json());
if (!t.access_token) { console.error(`oauth: ${t.error_description ?? t.error}`); process.exit(1); }
const r = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
  method: 'POST',
  headers: { authorization: `Bearer ${t.access_token}`, 'content-type': 'application/json' },
  body: JSON.stringify({ raw: readFileSync(eml).toString('base64url') }),
});
if (!r.ok) { console.error(`gmail ${r.status}: ${await r.text()}`); process.exit(1); }
