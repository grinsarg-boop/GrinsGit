// Crea las 3 publicaciones de ARRAIGO en ML, PAUSADAS (borrador: listas para cuando entre stock).
// Uso: node scripts/_arraigo-ml.mjs [--crear]   (sin --crear solo valida, no toca nada)
import { ml, TOKEN } from './_ml.mjs';
import { readFileSync } from 'node:fs';

const CREAR = process.argv.includes('--crear');
const DIR = '/Users/franciscoandreudegasperi/Claude/Obsidian/50-Proyectos/Serum-Capilar-Renders/';

// Orden = orden en la galería. La primera es la portada.
const FOTOS_BASE = ['01d-hero-wrap-frontal.png', '01e-hero-wrap-tres-cuartos.png', '02c-etiqueta-detalle.png',
  '05b-arraigo-caja-v2.png', '04-arraigo-cristal-clinico.png', '11c-gotas-raya.png', '09c-lifestyle-estante.png'];
const FOTO_KIT = '06b-arraigo-kit-x3-v2.png';

async function subir(nombre) {
  const fd = new FormData();
  fd.append('file', new Blob([readFileSync(DIR + nombre)], { type: 'image/png' }), nombre);
  const r = await fetch('https://api.mercadolibre.com/pictures/items/upload', {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: fd,
  });
  const j = await r.json();
  if (!j.id) throw new Error(`${nombre}: ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.id;
}

// El pack va adelante en el título, igual que el resto del catálogo: es lo que lee parseMlPack
// para imputar el COGS correcto. Sin claims médicos (ver el bloqueo de Pureza del 29/07).
const PACKS = [
  { pack: 1, price: 39990, tipo: 'gold_special', title: 'Serum Capilar Arraigo Romero Cafeina 30ml Fortalecedor' },
  { pack: 2, price: 59990, tipo: 'gold_pro', title: '2 Serum Capilar Arraigo Romero Cafeina 30ml Fortalecedor' },
  { pack: 3, price: 69990, tipo: 'gold_pro', title: '3 Serum Capilar Arraigo Romero Cafeina 30ml Fortalecedor' },
];

// Copy tomado de la ficha del vault (50-Proyectos/Serum-Capilar.md §Qué es): romero como ángulo,
// cafeína como mecanismo, "sin minoxidil" como posicionamiento, 60 segundos de los 4 copies que ya
// corren en Meta. Sin claims terapéuticos — es la política por la que ML volteó una de Pureza.
const DESC = (pack) => `SÉRUM CAPILAR ARRAIGO — ${pack === 1 ? 'Frasco de 30 ml' : `Pack x${pack} · ${pack} frascos de 30 ml`}

Sérum de uso diario en gotero de vidrio ámbar de 30 ml.

LA FÓRMULA
· Aceite de romero — el corazón de la fórmula.
· Cafeína — el activo que acompaña el masaje diario sobre el cuero cabelludo.

SIN MINOXIDIL
No es una omisión: es el posicionamiento. Una rutina cosmética diaria, de uso externo.

CÓMO SE USA — 60 SEGUNDOS POR DÍA
Unas gotas sobre el cuero cabelludo, dividiendo el pelo por rayas. Masajear un minuto con las yemas de los dedos. No se enjuaga.

CONTENIDO
${pack} frasco${pack > 1 ? 's' : ''} de 30 ml con gotero de vidrio ámbar. El vidrio ámbar protege la fórmula de la luz y el gotero permite dosificar sobre el cuero cabelludo sin desperdicio.

Producto unisex. Cosmético grado 1. Uso externo. Mantener fuera del alcance de los niños. Suspender su uso ante irritación.`;

// MLA29893 no acepta `title`: exige `family_name` y arma el título solo desde los atributos.
// Por eso el pack va en el family_name — es lo único que controlamos de cómo queda el título.
const item = (p, pics) => ({
  category_id: 'MLA29893',
  price: p.price,
  currency_id: 'ARS',
  available_quantity: 1,           // ML no acepta 0 al crear; se pausa abajo
  buying_mode: 'buy_it_now',
  listing_type_id: p.tipo,
  condition: 'new',
  family_name: p.title,
  pictures: pics.map((id) => ({ id })),
  attributes: [
    { id: 'BRAND', value_name: 'Arraigo' },
    { id: 'LINE', value_name: 'Arraigo' },
    { id: 'NET_VOLUME', value_name: '30 ml' },
    { id: 'UNITS_PER_PACKAGE', value_name: String(p.pack) },
    // 17055160 = sin código registrado · 17055159 = es un kit o un pack
    { id: 'EMPTY_GTIN_REASON', value_id: p.pack === 1 ? '17055160' : '17055159' },
    { id: 'VALUE_ADDED_TAX', value_id: '48405909' },  // 21%
    { id: 'IMPORT_DUTY', value_id: '49553239' },      // 0% — producto nacional
  ],
});

const ids = {};
for (const f of [...FOTOS_BASE, FOTO_KIT]) {
  ids[f] = await subir(f);
  console.log(`foto ${f} -> ${ids[f]}`);
}
const picsBase = FOTOS_BASE.map((f) => ids[f]);
const picsKit = [ids[FOTO_KIT], ...picsBase];

for (const p of PACKS) {
  const body = item(p, p.pack === 1 ? picsBase : picsKit);
  const url = `https://api.mercadolibre.com/items${CREAR ? '' : '/validate'}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!CREAR) { console.log(`\nx${p.pack} validate -> ${r.status} ${JSON.stringify(j).slice(0, 400)}`); continue; }
  if (!j.id) { console.log(`\nx${p.pack} FALLÓ -> ${r.status} ${JSON.stringify(j).slice(0, 400)}`); continue; }

  await fetch(`https://api.mercadolibre.com/items/${j.id}/description`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ plain_text: DESC(p.pack) }),
  });
  const pause = await fetch(`https://api.mercadolibre.com/items/${j.id}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'paused', available_quantity: 0 }),
  });
  const pj = await pause.json().catch(() => ({}));
  console.log(`\nx${p.pack} ${j.id} · $${p.price} · ${p.tipo} · ${pj.status ?? 'pausa ' + pause.status} · ${j.permalink}`);
}
