// Baja de Gmail los resúmenes de Urbano de las 3 casillas: adjuntos al disco y links al stdout.
// Sin dependencias nuevas — Gmail es REST y el refresh token se canjea con un POST.
//
// Uso:  node scripts/gmail-urbano.mjs --auth <alias>    (una vez por casilla, abre el consentimiento)
//       node scripts/gmail-urbano.mjs [--dias 120]      (baja lo que haya)
//
// En .env.local (gitignoreado): GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET y un
// GMAIL_TOKEN_<ALIAS> por casilla, que escribe el propio --auth. El scope es gmail.readonly:
// no puede mandar, borrar ni marcar nada.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, appendFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ } from './_urbano-rend.mjs';

const ENV = join(RAIZ, '.env.local');
const DEST = join(RAIZ, 'datos', 'urbano-mails');
const env = (k) => readFileSync(ENV, 'utf8').match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim();
const CID = env('GOOGLE_OAUTH_CLIENT_ID');
const CSEC = env('GOOGLE_OAUTH_CLIENT_SECRET');
const REDIR = 'http://localhost:8787';
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : d; };

// Un solo filtro para los tres formatos que Urbano manda a dos casillas distintas. Acotado a
// Urbano a propósito: el token no tiene por qué ver el resto de la casilla.
const Q = (dias) => `(from:urbano.com.ar OR subject:contrarrembolso OR subject:"resumen a pagar"` +
  ` OR subject:"detalle de transferencia") newer_than:${dias}d`;

const token = async (body) => {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, client_secret: CSEC, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`oauth ${r.status}: ${j.error_description ?? j.error}`);
  return j;
};

if (process.argv.includes('--auth')) {
  const alias = arg('--auth')?.toUpperCase();
  if (!alias || !CID) { console.error('uso: --auth <alias>  ·  y GOOGLE_OAUTH_CLIENT_ID/SECRET en .env.local'); process.exit(1); }
  const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
    client_id: CID, redirect_uri: REDIR, response_type: 'code', access_type: 'offline',
    prompt: 'consent', scope: 'https://www.googleapis.com/auth/gmail.readonly',
  });
  // Tres formas de completar el consentimiento. La de abajo (servidor en localhost) es la cómoda,
  // pero solo sirve sentado en la Mac: Google redirige a http://localhost:8787 y eso únicamente
  // resuelve en la máquina que corre el script. Desde el teléfono se parte en dos pasos: `--url`
  // imprime el link para abrir en el celular, y `--code` recibe la URL a la que Google redirigió
  // (la que "no carga") y saca el código de ahí.
  if (process.argv.includes('--url')) { console.log(`\n${url}\n`); process.exit(0); }

  const pegado = arg('--code');
  const code = pegado
    ? (pegado.includes('code=') ? decodeURIComponent(pegado.match(/[?&]code=([^&]+)/)[1]) : pegado)
    : await new Promise((ok) => {
      const srv = createServer((req, res) => {
        const c = new URL(req.url, REDIR).searchParams.get('code');
        res.end(c ? 'Listo, ya podés cerrar esta pestaña.' : 'Sin código.');
        if (c) { srv.close(); ok(c); }
      }).listen(8787, () => {
        console.log(`\nAutorizá la casilla "${alias}" en el navegador. Si no se abre solo:\n${url}\n`);
        execFile('open', [url.toString()], () => {});
      });
    });
  const t = await token({ code, redirect_uri: REDIR, grant_type: 'authorization_code' });
  if (!t.refresh_token) { console.error('❌ Google no devolvió refresh_token — revocá el acceso y reintentá'); process.exit(1); }
  appendFileSync(ENV, `\nGMAIL_TOKEN_${alias}=${t.refresh_token}\n`);
  console.log(`✅ GMAIL_TOKEN_${alias} guardado en .env.local`);
  process.exit(0);
}

const alias = (readFileSync(ENV, 'utf8').match(/^GMAIL_TOKEN_([A-Z0-9_]+)=/gm) ?? [])
  .map((l) => l.slice('GMAIL_TOKEN_'.length, -1));
if (!alias.length) { console.error('no hay ninguna casilla autorizada — corré --auth <alias> primero'); process.exit(1); }
mkdirSync(DEST, { recursive: true });
const dias = Number(arg('--dias', '120'));
let bajados = 0;

for (const a of alias) {
  const { access_token } = await token({ refresh_token: env(`GMAIL_TOKEN_${a}`), grant_type: 'refresh_token' });
  const H = { Authorization: `Bearer ${access_token}` };
  const api = (p) => fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${p}`, { headers: H }).then((r) => r.json());

  const lista = await api(`messages?maxResults=200&q=${encodeURIComponent(Q(dias))}`);
  console.log(`\n── ${a}: ${lista.messages?.length ?? 0} mails`);
  for (const { id } of lista.messages ?? []) {
    const m = await api(`messages/${id}`);
    const asunto = m.payload.headers.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '(sin asunto)';
    const partes = [];
    (function walk(p) { partes.push(p); (p.parts ?? []).forEach(walk); })(m.payload);

    for (const p of partes.filter((x) => x.filename && x.body?.attachmentId)) {
      const { data } = await api(`messages/${id}/attachments/${p.body.attachmentId}`);
      writeFileSync(join(DEST, p.filename), Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64'));
      console.log(`   📎 ${p.filename}`);
      bajados++;
    }
    // Los "Detalle Contrarrembolso" no adjuntan: mandan un link. Se listan para bajarlos aparte.
    const cuerpo = partes.filter((p) => p.body?.data)
      .map((p) => Buffer.from(p.body.data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()).join(' ');
    const links = [...new Set(cuerpo.match(/https?:\/\/[^\s"'<>]*(?:transferencia|resumen|reporte)[^\s"'<>]*/gi) ?? [])];
    if (links.length) console.log(`   🔗 ${asunto.slice(0, 60)}\n      ${links.join('\n      ')}`);
  }
}
console.log(`\n→ ${bajados} adjuntos en datos/urbano-mails/`);
