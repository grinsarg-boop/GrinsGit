// x3 de ARRAIGO en ML con el Aplicador Masajeador de regalo, como en Shopify (Kaching: "Aplicador de Regalo!").
// Dry-run por defecto: node scripts/arraigo-x3-aplicador.mjs · aplicar: APLICAR=1 PRECIO=89990 node scripts/...
import { TOKEN, ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';

const ID = 'MLA1972664973';
const APLICAR = process.env.APLICAR === '1';
const PRECIO = Number(process.env.PRECIO || 89990);
const KIT = '/Users/franciscoandreudegasperi/Downloads/Serum-Capilar-Ads/06d-kit-limpio.png'; // la misma foto del kit que usa Shopify
const TITULO = '3 Serum Capilar Anticaida Arraigo Romero 30ml + Aplicador'; // 59/60

// Mismo copy que la landing de Shopify (§Cómo se usa, "el Aplicador Masajeador viene con el kit"). Sin claims.
const DESC = `SÉRUM CAPILAR ARRAIGO — Pack x3 · 3 frascos de 30 ml + Aplicador Masajeador DE REGALO

Tratamiento completo de 90 días: tres frascos, uno por mes, con el Aplicador Masajeador de silicona incluido.

LA FÓRMULA
· Aceite de romero — el corazón de la fórmula.
· Cafeína — el activo que acompaña el masaje diario sobre el cuero cabelludo.

SIN MINOXIDIL
No es una omisión: es el posicionamiento. Una rutina cosmética diaria, de uso externo.

CÓMO SE USA — 60 SEGUNDOS POR DÍA
1. Aplicá — 1 ml (una pipeta) sobre la raya y la coronilla, con el pelo seco o húmedo.
2. Masajeá — 60 segundos con el Aplicador: apoyá y mové la piel, no tires del pelo.
3. Repetí — todos los días durante 90 días. No se enjuaga, no engrasa, no te arruina el peinado.

CONTENIDO
· 3 frascos de 30 ml con gotero de vidrio ámbar. El vidrio ámbar protege la fórmula de la luz y el gotero permite dosificar sobre el cuero cabelludo sin desperdicio.
· 1 Aplicador Masajeador ARRAIGO de silicona, de púas blandas, para el masaje diario del cuero cabelludo. Va de regalo con el pack de 3.

Producto unisex. Cosmético grado 1. Uso externo. Mantener fuera del alcance de los niños. Suspender su uso ante irritación.`;

const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const req = async (path, method, body) => {
  const r = await fetch(`https://api.mercadolibre.com${path}`, { method, headers: H, body: JSON.stringify(body) });
  return { code: r.status, ok: r.ok, j: await r.json().catch(() => ({})) };
};

const { body: antes } = await ml(`/items/${ID}`, { attributes: 'title,price,pictures,status,available_quantity' });
console.log(`${ID} · ${antes.status} · stock ${antes.available_quantity}`);
console.log(`  precio : $${antes.price} -> $${PRECIO}`);
console.log(`  titulo : ${antes.title} -> ${TITULO} (${TITULO.length})`);
console.log(`  fotos  : ${antes.pictures.length} -> ${antes.pictures.length + 1} (kit con aplicador en 2º lugar)`);
console.log(`  desc   : ${DESC.length} chars, menciona "Aplicador" ${DESC.split('Aplicador').length - 1} veces`);
if (!APLICAR) { console.log('\n[dry-run] nada tocado'); process.exit(0); }

// 1. foto del kit -> 2º lugar (la portada sigue siendo la de fondo blanco)
const fd = new FormData();
fd.append('file', new Blob([readFileSync(KIT)], { type: 'image/png' }), '06d-kit-limpio.png');
const up = await (await fetch('https://api.mercadolibre.com/pictures/items/upload', { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd })).json();
if (!up.id) { console.error('upload fallo', up); process.exit(1); }
const pics = [antes.pictures[0].id, up.id, ...antes.pictures.slice(1).map(p => p.id)].map(id => ({ id }));

// ponytail: PUTs separados — un 400 en uno no tira abajo los otros (lección de arraigo-ficha-2208).
const p1 = await req(`/items/${ID}`, 'PUT', { pictures: pics });
console.log(`  PUT fotos  ${p1.code} ${p1.ok ? 'ok' : JSON.stringify(p1.j).slice(0, 200)}`);
const p2 = await req(`/items/${ID}`, 'PUT', { price: PRECIO });
console.log(`  PUT precio ${p2.code} ${p2.ok ? '$' + p2.j.price : JSON.stringify(p2.j).slice(0, 200)}`);
const p3 = await req(`/items/${ID}/description`, 'PUT', { plain_text: DESC });
console.log(`  PUT desc   ${p3.code} ${p3.ok ? 'ok' : JSON.stringify(p3.j).slice(0, 200)}`);
// El título no salía por API el 22/08 (family_name). Se intenta una vez; si falla, va a mano.
const p4 = await req(`/items/${ID}`, 'PUT', { title: TITULO });
console.log(`  PUT titulo ${p4.code} ${p4.ok ? 'ok' : 'A MANO en el panel -> ' + TITULO}`);

const { body: desp } = await ml(`/items/${ID}`, { attributes: 'title,price,pictures,status' });
console.log(`\nquedó: ${desp.status} · $${desp.price} · ${desp.pictures.length} fotos · "${desp.title}"`);
