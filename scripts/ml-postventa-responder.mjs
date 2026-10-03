// Responde ML desde un plan [{pack, tpl, text}] (post-venta) o [{question_id, tpl, text}] (pregunta pre-venta). Uso: node scripts/ml-postventa-responder.mjs plan.json (dry-run) | --send (manda). Reglas de texto: vault Integracion-ML-MP §21/09.
import { ml, TOKEN } from './_ml.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const ME = 262382468, SEND = process.argv.includes('--send');
const plan = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const log = [];
for (const p of plan) {
  let url = 'https://api.mercadolibre.com/answers', payload = { question_id: p.question_id, text: p.text }, buyer;
  if (!p.question_id) {
    const packInfo = (await ml(`/packs/${p.pack}`)).body;
    const o = (await ml(`/orders/${packInfo.orders?.[0]?.id ?? p.pack}`)).body;
    if (!o.buyer?.id) { log.push({ ...p, status: 'sin buyer' }); continue; }
    buyer = o.buyer.id;
    url = `https://api.mercadolibre.com/messages/packs/${p.pack}/sellers/${ME}?tag=post_sale`;
    payload = { from: { user_id: ME }, to: { user_id: buyer }, text: p.text };
  }
  if (p.text.length > (p.question_id ? 2000 : 350)) { log.push({ ...p, status: 'texto largo' }); continue; } // límites de ML
  if (!SEND) { log.push({ ...p, buyer, status: 'dry' }); continue; }
  const r = await fetch(url, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await r.json().catch(() => ({}));
  log.push({ ...p, buyer, status: r.status, err: r.ok ? undefined : JSON.stringify(body).slice(0, 200) });
  console.log(p.pack ?? p.question_id, p.tpl, r.status, r.ok ? '' : JSON.stringify(body).slice(0, 200));
}
writeFileSync(process.argv[2].replace('.json', SEND ? '-enviado.json' : '-dry.json'), JSON.stringify(log, null, 1));
const ok = log.filter(l => l.status === 'dry' || (l.status >= 200 && l.status < 300)).length;
console.log(SEND ? 'enviados' : 'dry-run', ok, '/', plan.length);
