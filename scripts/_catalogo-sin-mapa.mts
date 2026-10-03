// Riesgo residual: el fix solo protege a las publicaciones que estan en PACK_POR_ITEM. Cualquier
// publicacion de CATALOGO que no este en el mapa vuelve a romper el dia que ML decida mandar el
// nombre del catalogo en vez del nuestro -- que es exactamente lo que paso el 17/09 sin aviso.
import { ml } from "./_ml.mjs";
import { packFijo, parseMlPack } from "../lib/ml.ts";
const ME = 262382468;
const ids: string[] = [];
for (let off = 0; ; off += 50) {
  const r = (await ml(`/users/${ME}/items/search`, { status: "active", limit: 50, offset: off }, "2")).body;
  ids.push(...(r.results ?? []));
  if (!r.results?.length || ids.length >= (r.paging?.total ?? 0)) break;
}
console.log(`publicaciones activas: ${ids.length}`);
const sinMapa: any[] = [];
for (let i = 0; i < ids.length; i += 20) {
  const lote = (await ml(`/items`, { ids: ids.slice(i, i + 20).join(","), attributes: "id,title,catalog_listing,catalog_product_id,status" }, "2")).body;
  for (const x of lote ?? []) {
    const it = x.body ?? x;
    if (!it?.catalog_listing) continue;
    const enMapa = packFijo(it.id) !== null;
    if (!enMapa) sinMapa.push({ id: it.id, title: it.title, parsea: parseMlPack(it.title, null) });
  }
}
console.log(`\nde catalogo SIN entrada en PACK_POR_ITEM: ${sinMapa.length}`);
for (const s of sinMapa) console.log(`  ${s.id}  parsea ${s.parsea} del titulo propio  — ${s.title.slice(0, 60)}`);
