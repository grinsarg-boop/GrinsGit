// Pausa las publicaciones de Natures Sunrise (31/08/2026).
// Motivo: un tercero registro la marca en INPI y pidio bajarlas. Es reversible (paused -> active).
//
// OJO: "M3 Naturals" es OTRA marca y NO entra. El filtro pide "natures" pero excluye "m3 natural*",
// porque el error caro aca es apagar facturacion ajena al reclamo.
//
// Uso:  node scripts/_ml-apagar-natures.mjs            <- dry-run, lista y no toca nada
//       node scripts/_ml-apagar-natures.mjs --aplicar  <- pausa
import { ml, TOKEN } from './_ml.mjs';

const APLICAR = process.argv.includes('--aplicar');
const ES_NATURES = (t) => /natures/i.test(t) && !/m3\s*natural/i.test(t);

const ids = [];
for (let off = 0; ; off += 100) {
  const r = await ml('/users/262382468/items/search', { limit: 100, offset: off });
  ids.push(...(r.body.results ?? []));
  if (off + 100 >= (r.body.paging?.total ?? 0)) break;
}

const objetivo = [];
for (const id of ids) {
  const it = (await ml(`/items/${id}`, {}, '2')).body;
  if (!ES_NATURES(it.title ?? '')) continue;
  objetivo.push(it);
  // El estado del anuncio va al lado del item: ML pasa el ad a 'hold' solo, pero con lag, y sin
  // esta columna no hay forma de ver cual quedo colgado.
  const ad = (await ml(`/marketplace/advertising/MLA/product_ads/ads/${id}`, {}, '2')).body.status;
  console.log(`${id} | item ${it.status.padEnd(12)} | ad ${String(ad).padEnd(6)} | $${it.price} | stock ${String(it.available_quantity).padStart(4)} | ${it.title}`);
}
console.log(`\n${objetivo.length} publicaciones de Natures; ${objetivo.filter((i) => i.status === 'active').length} activas.`);

for (const it of objetivo) {
  if (it.status !== 'active') { console.log(`  ${it.id}: ya esta en '${it.status}', no se toca`); continue; }
  if (!APLICAR) { console.log(`  ${it.id}: [dry-run] se pausaria`); continue; }
  const r = await fetch(`https://api.mercadolibre.com/items/${it.id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paused' }),
  });
  const j = await r.json().catch(() => ({}));
  // Releer: el PUT puede devolver 200 y el item quedar como estaba.
  const post = (await ml(`/items/${it.id}`, {}, '2')).body;
  console.log(`  ${it.id}: PUT ${r.status} -> quedo '${post.status}'${r.ok ? '' : ' ' + JSON.stringify(j).slice(0, 160)}`);
}
