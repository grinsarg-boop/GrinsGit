// Leer/escribir un archivo del theme live de Shopify por Admin API (scope write_themes).
// Uso: node --env-file=.env.local scripts/theme-asset.mjs get sections/x.liquid [destino]
//      node --env-file=.env.local scripts/theme-asset.mjs put sections/x.liquid archivo-local
//
// El `put` pisa el archivo en el theme PUBLICADO: es producción y se ve al instante. Antes de
// escribir, guarda una copia del contenido anterior en docs/theme-backup/<archivo>.<timestamp>.bak
// — sin eso, "volver atrás" depende de que alguien se haya acordado de bajar el original antes.
// El admin nuevo de Shopify no se puede operar con navegador automatizado, así que este script es
// la única vía práctica para tocar el theme desde acá.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { basename } from 'node:path';

const [cmd, key, file] = process.argv.slice(2);
if (!['get', 'put'].includes(cmd) || !key) {
  console.error('uso: theme-asset.mjs get <key> [destino] | put <key> <archivo>');
  process.exit(1);
}

const D = process.env.SHOPIFY_SHOP_DOMAIN, V = '2024-10';
const token = await (await fetch(`https://${D}/admin/oauth/access_token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.SHOPIFY_CLIENT_ID,
    client_secret: process.env.SHOPIFY_CLIENT_SECRET,
  }),
})).json().then((j) => j.access_token);

const api = async (path, init) => {
  const r = await fetch(`https://${D}/admin/api/${V}/${path}`, {
    ...init,
    headers: { 'X-Shopify-Access-Token': token, 'content-type': 'application/json', ...init?.headers },
  });
  if (!r.ok) { console.error(`❌ ${r.status} ${await r.text()}`); process.exit(1); }
  return r.json();
};

const live = (await api('themes.json')).themes.find((t) => t.role === 'main');
const q = `themes/${live.id}/assets.json?asset[key]=${encodeURIComponent(key)}`;
const actual = (await api(q)).asset.value;

if (cmd === 'get') {
  if (file) { writeFileSync(file, actual); console.log(`✅ ${key} → ${file} (${actual.length} bytes)`); }
  else process.stdout.write(actual);
  process.exit(0);
}

if (!file) { console.error('❌ put necesita un archivo local'); process.exit(1); }
const nuevo = readFileSync(file, 'utf8');
if (nuevo === actual) { console.log('sin cambios, no se escribe'); process.exit(0); }

mkdirSync('docs/theme-backup', { recursive: true });
const bak = `docs/theme-backup/${basename(key)}.${new Date().toISOString().replace(/[:.]/g, '-')}.bak`;
writeFileSync(bak, actual);

await api(`themes/${live.id}/assets.json`, {
  method: 'PUT',
  body: JSON.stringify({ asset: { key, value: nuevo } }),
});
console.log(`✅ ${key} escrito en el theme ${live.id} (${live.name})`);
console.log(`   backup del anterior: ${bak}`);
