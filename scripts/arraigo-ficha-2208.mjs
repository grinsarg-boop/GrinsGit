// Ficha tecnica + titulo del x2/x3 de ARRAIGO. Aprobado 22/08/2026.
// Dry-run por defecto: node scripts/arraigo-ficha-2208.mjs · aplicar: APLICAR=1 node scripts/...
import { TOKEN, ml } from './_ml.mjs';

const APLICAR = process.env.APLICAR === '1';

// ponytail: IS_KIT NO se copia del x1 (dice "No", es 1 unidad). En x2/x3 va "Si".
const ATTRS = [
  { id: 'HAIR_TREATMENT_CARE_TYPE', value_name: 'Anticaída' },
  { id: 'PRODUCT_TYPE',            value_name: 'Sérum anticaída' },
  { id: 'IS_KIT',                  value_name: 'Sí' },
];
const CAMBIOS = [
  { id: 'MLA1972685049', title: '2 Serum Capilar Anticaida Arraigo Romero Cafeina 30ml' },
  { id: 'MLA1972664973', title: '3 Serum Capilar Anticaida Arraigo Romero Cafeina 30ml' },
];

const { body: cat } = await ml('/categories/MLA29893');
const MAX = cat.settings?.max_title_length ?? 60;
console.log(`max_title_length de MLA29893 = ${MAX}\n`);

for (const c of CAMBIOS) {
  const { body: antes } = await ml(`/items/${c.id}`, { attributes: 'id,title,attributes,sold_quantity,user_product_id' });
  const tiene = (id) => antes.attributes?.find(a => a.id === id)?.value_name ?? '—';
  console.log(`${c.id}  (vendidos: ${antes.sold_quantity})`);
  console.log(`  titulo antes : ${antes.title} (${antes.title.length})`);
  console.log(`  titulo desp. : ${c.title} (${c.title.length}) ${c.title.length > MAX ? 'SE PASA' : 'ok'}`);
  for (const a of ATTRS) console.log(`  ${a.id}: ${tiene(a.id)} -> ${a.value_name}`);

  console.log(`  family_name  : ${antes.family_name ?? '—'}`);
  if (!APLICAR) { console.log('  [dry-run]\n'); continue; }

  // ponytail: los dos PUT van SEPARADOS. Juntos, el 400 del titulo
  // (family_name) tira abajo tambien los atributos.
  const put = async (body) => {
    const r = await fetch(`https://api.mercadolibre.com/items/${c.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { code: r.status, ok: r.ok, j: await r.json().catch(() => ({})) };
  };

  const a = await put({ attributes: ATTRS });
  console.log(`  PUT attrs ${a.code} ${a.ok ? 'ok' : JSON.stringify(a.j).slice(0, 240)}`);

  // ponytail: el TITULO no sale por API — es tarea del panel. Probado 22/08/2026:
  //   PUT /items {title}              -> 400 "cannot modify the title if the item has a family_name"
  //   PUT /items {family_name}        -> 400 "The field family name is invalid"
  //   PUT /user-products/{id} {name}  -> 404 (el GET del mismo recurso da 200)
  console.log(`  titulo: A MANO en el panel -> ${c.title}\n`);
}
