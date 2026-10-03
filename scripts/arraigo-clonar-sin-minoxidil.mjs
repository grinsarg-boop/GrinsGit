// 12/09/2026 — duplicados «Sin Minoxidil» (test A/B de título, decisión Pancho: conviven con las 4 actuales).
// Clona x1, x2 y x3+aplicador con título nuevo, misma galería, misma descripción con el bloque SIN MINOXIDIL primero. Dry-run (POST /items/validate) por defecto; CREAR=1 crea.
import { TOKEN, ml } from './_ml.mjs';
const CREAR = process.env.CREAR === '1';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const CLONES = [
  { de: 'MLA1972685043', titulo: 'Serum Capilar Anticaida Arraigo Sin Minoxidil Romero 30ml', stock: 100 },
  { de: 'MLA1972685049', titulo: '2 Serum Capilar Anticaida Arraigo Sin Minoxidil Romero 30ml', stock: 30 },
  { de: 'MLA3943838032', titulo: '3 Serum Capilar Anticaida Arraigo Sin Minoxidil + Aplicador', stock: 25 },
];
const SKIP = new Set(['ITEM_CONDITION', 'IS_HIGHLIGHT_BRAND', 'IS_TOM_BRAND', 'HAZMAT_TRANSPORTABILITY']);
for (const c of CLONES) {
  const { body: v } = await ml(`/items/${c.de}`);
  const { body: d } = await ml(`/items/${c.de}/description`);
  // la pieza "rutina cosmética / sin minoxidil" (02-minoxidil) a 2ª posición: se detecta por orden conocido del brief (7ª foto)
  const pics = v.pictures.map(p => ({ id: p.id }));
  const antes = d.plain_text ?? '';
  // bloque SIN MINOXIDIL adelante de LA FÓRMULA (replace con función)
  const m = antes.match(/SIN MINOXIDIL\n[\s\S]*?(?=\n\n[A-ZÁÉÍÓÚ])/);
  let desc = antes;
  if (m) desc = antes.replace(m[0], () => '').replace(/\n\n\n+/g, '\n\n').replace(/(\n\nLA FÓRMULA)/, () => `\n\n${m[0]}$1`.replace('$1', '\n\nLA FÓRMULA'));
  const body = {
    category_id: v.category_id, family_name: c.titulo, price: v.price, currency_id: v.currency_id,
    available_quantity: c.stock, buying_mode: v.buying_mode, listing_type_id: v.listing_type_id, condition: v.condition, pictures: pics,
    attributes: v.attributes.filter(a => !SKIP.has(a.id)).map(a => ({ id: a.id, ...(a.value_id ? { value_id: a.value_id } : {}), ...(a.values?.length > 1 ? { values: a.values.map(x => ({ name: x.name })) } : { value_name: a.value_name }) })),
    sale_terms: v.sale_terms.map(s => s.value_id ? { id: s.id, value_id: s.value_id } : { id: s.id, value_name: s.value_name }),
    shipping: { mode: v.shipping.mode, local_pick_up: v.shipping.local_pick_up, free_shipping: v.shipping.free_shipping, ...(v.shipping.free_methods ? { free_methods: v.shipping.free_methods } : {}) },
  };
  if (!CREAR) console.log('  desc:', desc.slice(0, 260).replace(/\n/g, ' ⏎ '));
  console.log(`\n${c.de} → "${c.titulo}" (${c.titulo.length}) · $${body.price} · stock ${c.stock} · ${pics.length} fotos · ${body.attributes.length} attrs · desc ${desc.length} chars (bloque SIN MINOXIDIL ${m ? 'movido adelante' : 'NO encontrado'})`);
  const r = await fetch(`https://api.mercadolibre.com/items${CREAR ? '' : '/validate'}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!CREAR) { console.log(`  validate -> ${r.status} ${r.status === 204 ? 'OK' : JSON.stringify(j).slice(0, 500)}`); continue; }
  if (!j.id) { console.error(`  crear FALLÓ -> ${r.status} ${JSON.stringify(j).slice(0, 500)}`); continue; }
  console.log(`  creada ${j.id} · ${j.status} · "${j.title}" · ${j.permalink}`);
  const rd = await fetch(`https://api.mercadolibre.com/items/${j.id}/description`, { method: 'POST', headers: H, body: JSON.stringify({ plain_text: desc }) });
  console.log(`  descripción -> ${rd.status}`);
}
