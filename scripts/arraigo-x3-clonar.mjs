// Clona la x3 (MLA1972664973) en una publicación nueva con "Aplicador" en el título — el validador de ML
// no deja agregar palabras al título de un ítem existente (panel y API, 12/09/2026).
// Decisión Pancho 12/09: conviven las dos — la vieja sigue activa SIN aplicador (ver arraigo-x3-revertir.mjs).
// Dry-run (POST /items/validate) por defecto; CREAR=1 crea + descripción.
import { TOKEN, ml } from './_ml.mjs';

const VIEJA = 'MLA1972664973';
const CREAR = process.env.CREAR === '1';
const TITULO = '3 Serum Capilar Anticaida Arraigo Romero Cafeina + Aplicador'; // 60/60
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };

const { body: v } = await ml(`/items/${VIEJA}`);
const { body: d } = await ml(`/items/${VIEJA}/description`);
// Atributos que ML calcula solo o que no acepta en el POST.
const SKIP = new Set(['ITEM_CONDITION', 'IS_HIGHLIGHT_BRAND', 'IS_TOM_BRAND', 'HAZMAT_TRANSPORTABILITY']);
const body = {
  category_id: v.category_id, family_name: TITULO, price: v.price, currency_id: v.currency_id,
  available_quantity: v.available_quantity, buying_mode: v.buying_mode, listing_type_id: v.listing_type_id,
  condition: v.condition, pictures: v.pictures.map(p => ({ id: p.id })),
  attributes: v.attributes.filter(a => !SKIP.has(a.id)).map(a => ({ id: a.id, value_name: a.value_name, ...(a.value_id ? { value_id: a.value_id } : {}) })),
  sale_terms: v.sale_terms.map(s => s.value_id ? { id: s.id, value_id: s.value_id } : { id: s.id, value_name: s.value_name }),
  shipping: { mode: v.shipping.mode, local_pick_up: v.shipping.local_pick_up, free_shipping: v.shipping.free_shipping, ...(v.shipping.free_methods ? { free_methods: v.shipping.free_methods } : {}) },
};
console.log(`clon de ${VIEJA}: $${body.price} · stock ${body.available_quantity} · ${body.listing_type_id} · ${body.pictures.length} fotos · ${body.attributes.length} attrs · envío ${JSON.stringify(body.shipping)}`);
console.log(`título: ${TITULO} (${TITULO.length})`);

const r = await fetch(`https://api.mercadolibre.com/items${CREAR ? '' : '/validate'}`, { method: 'POST', headers: H, body: JSON.stringify(body) });
const j = await r.json().catch(() => ({}));
if (!CREAR) { console.log(`validate -> ${r.status} ${r.status === 204 ? 'OK' : JSON.stringify(j).slice(0, 600)}`); process.exit(0); }
if (!j.id) { console.error(`crear FALLÓ -> ${r.status} ${JSON.stringify(j).slice(0, 600)}`); process.exit(1); }
console.log(`creada ${j.id} · ${j.status} · "${j.title}" · ${j.permalink}`);
const rd = await fetch(`https://api.mercadolibre.com/items/${j.id}/description`, { method: 'POST', headers: H, body: JSON.stringify({ plain_text: d.plain_text }) });
console.log(`descripción -> ${rd.status}`);
