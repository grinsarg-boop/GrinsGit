// Reemplaza la pieza "pack y ahorro" (con precios) por "el pack" (sin precios) en las 3 publicaciones, misma posición.
import { TOKEN, ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';
const OUT = '/Users/franciscoandreudegasperi/Downloads/arraigo-ml-galeria/out/';
async function subir(nombre) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(OUT + nombre)], { type: 'image/png' }), nombre);
  const j = await (await fetch('https://api.mercadolibre.com/pictures/items/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json();
  if (!j.id) throw new Error(`${nombre}: ${JSON.stringify(j).slice(0, 200)}`);
  return j.id;
}
const nuevo = { '924130-MLA116094005856_092026': await subir('08-pack.png'), '652113-MLA117575890121_092026': await subir('08-pack-x2.png') };
for (const id of ['MLA1972685043', 'MLA1972685049', 'MLA1972664973']) {
  const { body: it } = await ml(`/items/${id}`, { attributes: 'pictures' });
  const pics = it.pictures.map(p => nuevo[p.id] ?? p.id);
  const cambio = pics.findIndex((p, i) => p !== it.pictures[i].id);
  if (cambio < 0) { console.log(`${id}: no tenía la pieza con precios`); continue; }
  const r = await fetch(`https://api.mercadolibre.com/items/${id}`, { method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ pictures: pics.map(id => ({ id })) }) });
  console.log(`${id}: posición ${cambio + 1} reemplazada -> ${r.status}`);
}
