// Triage post-venta ML: baja todos los hilos sin leer + orden/envío. Uso (desde la raíz): node scripts/ml-postventa-triage.mjs <dir_salida>
import { ml } from './_ml.mjs';
import { writeFileSync } from 'node:fs';
const ME = 262382468, OUT = process.argv[2];

const un = await ml('/messages/unread', { role: 'seller', tag: 'post_sale', limit: 200 });
const packs = un.body.results.map(r => r.resource.match(/packs\/(\d+)/)[1]);
console.error('unread total', un.body.total, 'packs', packs.length);

const rows = [];
async function one(pack) {
  const th = (await ml(`/messages/packs/${pack}/sellers/${ME}`, { tag: 'post_sale', mark_as_read: 'false', limit: 50 })).body;
  let p = (await ml(`/packs/${pack}`)).body;
  const orderId = p.orders?.[0]?.id ?? pack;             // ponytail: pack sin /packs = orden suelta
  const o = (await ml(`/orders/${orderId}`)).body;
  const shipId = p.shipment?.id ?? o.shipping?.id;
  const s = shipId ? (await ml(`/shipments/${shipId}`)).body : {};
  const msgs = (th.messages || []).map(m => ({
    who: m.from?.user_id == ME ? 'yo' : 'cli', at: m.message_date?.created?.slice(0, 16), text: (m.text || '').replace(/\s+/g, ' ').trim(),
  })).sort((a, b) => (a.at || '').localeCompare(b.at || '')); // la API devuelve el más nuevo primero; abajo se asume cronológico
  rows.push({
    pack, orderId, buyer: o.buyer?.nickname, item: o.order_items?.map(i => `${i.quantity}x ${i.item?.title}`).join(' + '),
    orderDate: o.date_created?.slice(0, 10), orderStatus: o.status,
    ship: { id: shipId, status: s.status, sub: s.substatus, type: s.logistic_type, tracking: s.tracking_number, eta: s.shipping_option?.estimated_delivery_time?.date?.slice(0, 10), delivered: s.status_history?.date_delivered?.slice(0, 10) },
    conv: th.conversation_status?.status, convSub: th.conversation_status?.substatus, msgs,
  });
}
for (let i = 0; i < packs.length; i += 5) await Promise.all(packs.slice(i, i + 5).map(one));
rows.sort((a, b) => (b.msgs.at(-1)?.at || '').localeCompare(a.msgs.at(-1)?.at || ''));
writeFileSync(`${OUT}/ml-msgs.json`, JSON.stringify(rows, null, 1));
const lines = rows.map(r => {
  const cli = r.msgs.filter(m => m.who === 'cli'); const lastMe = r.msgs.findLast(m => m.who === 'yo');
  return `${r.pack} | ${r.orderDate} ${r.item?.slice(0, 40)} | env:${r.ship.status}/${r.ship.sub || '-'}/${r.ship.type || '-'} ent:${r.ship.delivered || r.ship.eta || '-'} | conv:${r.conv || '?'}${r.convSub ? '/' + r.convSub : ''} | ${cli.length}c${lastMe ? ' (yo:' + lastMe.at.slice(5, 10) + ')' : ''} | ${cli.slice(-2).map(m => m.at.slice(5, 10) + ' ' + m.text.slice(0, 110)).join(' ‖ ')}`;
});
writeFileSync(`${OUT}/ml-msgs.txt`, lines.join('\n'));
console.log(lines.length, 'packs escritos');
