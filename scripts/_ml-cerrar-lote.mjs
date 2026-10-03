// Marca como leídos los hilos post-venta de una lista de packs (mark_as_read solo marca los mensajes que devuelve el GET: limit alto).
import { ml, TOKEN } from './_ml.mjs';
import { readFileSync } from 'node:fs';
let ok = 0;
for (const pack of JSON.parse(readFileSync(process.argv[2], 'utf8'))) {
  await ml(`/messages/packs/${pack}/sellers/262382468`, { tag: 'post_sale', mark_as_read: 'true', limit: 50 }, '2').then(() => ok++).catch((e) => console.log(pack, String(e).slice(0, 120)));
}
console.log('marcados leídos', ok);
