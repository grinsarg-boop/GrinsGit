// Responde post-venta ML desde un plan [{pack, tpl, text}]. Uso: node scripts/ml-postventa-responder.mjs plan.json (dry-run) | --send (manda). Reglas de texto: memoria ml-postventa-respuestas / vault.
import { ml, TOKEN } from './_ml.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ME = 262382468, SEND = process.argv.includes('--send');
const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const log = [];
for (const p of plan) {
  const packInfo = (await ml(`/packs/${p.pack}`)).body;
  const o = (await ml(`/orders/${packInfo.orders?.[0]?.id ?? p.pack}`)).body;
  if (!o.buyer?.id) { log.push({ ...p, status: 'sin buyer' }); continue; }
  if (!SEND) { log.push({ ...p, buyer: o.buyer.id, status: 'dry' }); continue; }
  const r = await fetch(`https://api.mercadolibre.com/messages/packs/${p.pack}/sellers/${ME}?tag=post_sale`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: { user_id: ME }, to: { user_id: o.buyer.id }, text: p.text }),
  });
  const body = await r.json().catch(() => ({}));
  log.push({ ...p, buyer: o.buyer.id, status: r.status, err: r.ok ? undefined : JSON.stringify(body).slice(0, 200) });
  console.log(p.pack, p.tpl, r.status, r.ok ? '' : JSON.stringify(body).slice(0, 200));
}
writeFileSync(process.argv[2].replace('.json', SEND ? '-enviado.json' : '-dry.json'), JSON.stringify(log, null, 1));
const ok = log.filter(l => l.status === 'dry' || (l.status >= 200 && l.status < 300)).length;
console.log(SEND ? 'enviados' : 'dry-run', ok, '/', plan.length);
