// Brief ML ARRAIGO x1/x2/x3 del 12/09/2026 (Google Doc 115w6dJ9…), parte ejecutable por API:
// portadas limpias (x3 con aplicador), galería en el orden del brief, pack/ahorro por publicación,
// NET_VOLUME del pack (arregla el precio por 100 ml), garantía 30 días, líneas de ahorro en la descripción.
// Fuera de la API (panel): títulos, cuotas, clip de video, precio de lista tachado.
// Dry-run por defecto; APLICAR=1 escribe.
import { TOKEN, ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';

const APLICAR = process.env.APLICAR === '1';
const OUT = '/Users/franciscoandreudegasperi/Downloads/arraigo-ml-galeria/out/';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const put = async (path, body) => {
  const r = await fetch(`https://api.mercadolibre.com${path}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });
  return `${r.status}${r.ok ? '' : ' ' + JSON.stringify(await r.json().catch(() => ({}))).slice(0, 200)}`;
};
async function subir(nombre) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(OUT + nombre)], { type: 'image/png' }), nombre);
  const j = await (await fetch('https://api.mercadolibre.com/pictures/items/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json();
  if (!j.id) throw new Error(`${nombre}: ${JSON.stringify(j).slice(0, 200)}`);
  console.log(`  subida ${nombre} -> ${j.id}`);
  return j.id;
}

// ids ya en ML (compartidos por las 3 publicaciones)
const P = { closeup: '847700-MLA114542864694_082026', raiz: '985369-MLA116555822633_082026', rutina: '836307-MLA115158686186_082026',
  activos: '698999-MLA116555995479_082026', minuto: '675428-MLA115158686228_082026', miras: '741614-MLA115158801520_082026',
  meses: '859603-MLA116555822715_082026', bano: '672491-MLA115900297375_082026', estuche: '789971-MLA114543466618_082026',
  kit: '645027-MLA116094053976_092026', packX3: '924130-MLA116094005856_092026' };
const CONTENIDO = [P.closeup, P.raiz, P.rutina, P.activos, P.minuto, P.miras];

const ITEMS = [
  { id: 'MLA1972685043', pack: 1, portada: 'portada-x1-limpia.png', vol: null,
    fotos: (portada) => [portada, P.meses, P.packX3, ...CONTENIDO, P.bano],
    desc: (d) => d.trimEnd() + '\n\n¿Ya sabés que vas a hacer los 3 meses? Buscá el kit x3: sale $29.997 por frasco y viene con el Aplicador Masajeador de regalo.' },
  { id: 'MLA1972685049', pack: 2, portada: 'portada-x2-limpia.png', vol: '60 mL', packImg: '08-pack-ahorro-x2.png',
    fotos: (portada, packX2) => [portada, P.meses, packX2, ...CONTENIDO, P.bano],
    desc: (d) => d.replace('\n\n', '\n\nPack x2: $32.495 por frasco (vs. $39.990 comprando de a uno).\n\n') },
  { id: 'MLA1972664973', pack: 3, portada: 'portada-x3-aplicador.png', vol: '90 mL',
    fotos: (portada) => [portada, P.kit, P.meses, P.packX3, ...CONTENIDO, P.bano, P.estuche],
    desc: (d) => d.replace('\n\n', '\n\nKit x3: $29.997 por frasco — ahorrás $29.980 vs. comprar de a uno. Es el tratamiento completo de 3 meses, y el Aplicador Masajeador va de regalo.\n\n') },
];
const GARANTIA = [{ id: 'WARRANTY_TYPE', value_name: 'Garantía del vendedor' }, { id: 'WARRANTY_TIME', value_name: '30 días' }];

for (const it of ITEMS) {
  const { body: d } = await ml(`/items/${it.id}/description`);
  const marca = it.pack === 1 ? '¿Ya sabés' : it.pack === 2 ? 'Pack x2:' : 'Kit x3:';
  const yaTiene = d.plain_text.includes(marca);
  console.log(`\n${it.id} x${it.pack}: portada ${it.portada} · ${it.fotos('P', 'K').length} fotos · NET_VOLUME ${it.vol ?? '(queda 30 mL)'} · garantía 30 días · desc ${yaTiene ? 'ya tiene la línea' : '+línea de ahorro'}`);
  if (!APLICAR) continue;
  const portada = await subir(it.portada);
  const packX2 = it.packImg ? await subir(it.packImg) : null;
  console.log(`  PUT fotos     ${await put(`/items/${it.id}`, { pictures: it.fotos(portada, packX2).map(id => ({ id })) })}`);
  if (it.vol) console.log(`  PUT volumen   ${await put(`/items/${it.id}`, { attributes: [{ id: 'NET_VOLUME', value_name: it.vol }] })}`);
  console.log(`  PUT garantía  ${await put(`/items/${it.id}`, { sale_terms: GARANTIA })}`);
  if (!yaTiene) console.log(`  PUT desc      ${await put(`/items/${it.id}/description`, { plain_text: it.desc(d.plain_text) })}`);
}
