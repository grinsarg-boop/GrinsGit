// La x3 original (MLA1972664973) vuelve a SIN aplicador: $84.990, portada limpia sin aplicador, sin foto del kit,
// pieza "El pack" sin aplicador, descripción sin aplicador (conserva Capixyl y la línea de ahorro).
// Decisión Pancho 12/09/2026: conviven con MLA3943838032 (con aplicador, $89.990).
import { TOKEN, ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';
const ID = 'MLA1972664973';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const put = async (path, body) => { const r = await fetch(`https://api.mercadolibre.com${path}`, { method: 'PUT', headers: H, body: JSON.stringify(body) }); return `${r.status}${r.ok ? '' : ' ' + JSON.stringify(await r.json().catch(() => ({}))).slice(0, 200)}`; };

const fd = new FormData();
fd.append('file', new Blob([readFileSync('/Users/franciscoandreudegasperi/Downloads/arraigo-ml-galeria/out/08-pack-sin.png')], { type: 'image/png' }), '08-pack-sin.png');
const up = await (await fetch('https://api.mercadolibre.com/pictures/items/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json();
if (!up.id) throw new Error(JSON.stringify(up).slice(0, 200));

const { body: it } = await ml(`/items/${ID}`, { attributes: 'pictures' });
const PORTADA_SIN = '833228-MLA116093894358_092026'; // portada-x3-limpia, subida esta mañana
const KIT = '645027-MLA116094053976_092026';
const pics = it.pictures.map(p => p.id).filter(id => id !== KIT);
pics[0] = PORTADA_SIN;
// tras sacar el kit, la 3ª es la pieza "El pack" con aplicador: va la versión sin
pics[2] = up.id;
console.log(`fotos: ${pics.length} · portada ${pics[0]} · pack ${pics[2]}`);
console.log(`PUT fotos  ${await put(`/items/${ID}`, { pictures: pics.map(id => ({ id })) })}`);
console.log(`PUT precio ${await put(`/items/${ID}`, { price: 84990 })}`);

const DESC = `SÉRUM CAPILAR ARRAIGO — Pack x3 · 3 frascos de 30 ml

Pack x3: $28.330 por frasco — ahorrás $34.980 vs. comprar de a uno. Es el tratamiento completo de 3 meses.

Tratamiento completo de 90 días: tres frascos, uno por mes.

LA FÓRMULA — TRES ACTIVOS
· Aceite de romero — el corazón de la fórmula.
· Cafeína — el activo que acompaña el masaje diario sobre el cuero cabelludo.
· Capixyl™ al 3% — péptido (acetyl tetrapeptide-3) con extracto de trébol rojo. La mayoría lo pone al 0,5% para poder nombrarlo en la etiqueta; acá está al 3%.

SIN MINOXIDIL
No es una omisión: es el posicionamiento. Una rutina cosmética diaria, de uso externo.

CÓMO SE USA — 60 SEGUNDOS POR DÍA
1. Aplicá — 1 ml (una pipeta) sobre la raya y la coronilla, con el pelo seco o húmedo.
2. Masajeá — 60 segundos con las yemas de los dedos: apoyá y mové la piel, no tires del pelo.
3. Repetí — todos los días durante 90 días. No se enjuaga, no engrasa, no te arruina el peinado.

CONTENIDO
3 frascos de 30 ml con gotero de vidrio ámbar. El vidrio ámbar protege la fórmula de la luz y el gotero permite dosificar sobre el cuero cabelludo sin desperdicio.

¿Lo querés con el Aplicador Masajeador de silicona? Buscá el kit "3 Serum Capilar Anticaida Arraigo Romero Cafeina + Aplicador".

Producto unisex. Cosmético grado 1. Uso externo. Mantener fuera del alcance de los niños. Suspender su uso ante irritación.`;
console.log(`PUT desc   ${await put(`/items/${ID}/description`, { plain_text: DESC })}`);
const { body: fin } = await ml(`/items/${ID}`, { attributes: 'title,price,pictures,status' });
console.log(`quedó: ${fin.status} · $${fin.price} · ${fin.pictures.length} fotos · "${fin.title}"`);
