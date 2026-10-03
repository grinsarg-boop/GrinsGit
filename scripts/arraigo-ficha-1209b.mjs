// 12/09/2026 (tarde, sesión competencia) — con OK de Pancho: (1) promo 10% en la x3 nueva, (2) sacar los montos de las
// 4 descripciones, (3) cargar 9 atributos factuales en las 4 (legajo y claims del lab quedan vacíos), (4) stock x3 nueva = 50.
// Dry-run por defecto; APLICAR=1 escribe.
import { TOKEN, ml } from './_ml.mjs';
const APLICAR = process.env.APLICAR === '1';
const H = { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' };
const IDS = { x1: 'MLA1972685043', x2: 'MLA1972685049', x3v: 'MLA1972664973', x3n: 'MLA3943838032' };
const put = (path, body) => fetch(`https://api.mercadolibre.com${path}`, { method: 'PUT', headers: H, body: JSON.stringify(body) });

// (1) promo x3 nueva: PRICE_DISCOUNT 10% → $80.991 (candidato permite hasta $85.490 de tope)
console.log('== (1) promo x3 nueva');
if (APLICAR) {
  const r = await fetch(`https://api.mercadolibre.com/seller-promotions/items/${IDS.x3n}?app_version=v2`, { method: 'POST', headers: H, body: JSON.stringify({ promotion_type: 'PRICE_DISCOUNT', deal_price: 80991 }) });
  console.log('  POST', r.status, (await r.text()).slice(0, 300));
} else console.log('  dry-run: PRICE_DISCOUNT deal_price 80991 (−10%)');

// (2) descripciones sin montos — replace con función (memoria del repo)
console.log('== (2) descripciones');
const CAMBIOS = {
  x1: [/Buscá el kit x3: sale \$29\.997 por frasco y viene con el Aplicador Masajeador de regalo\./, () => 'Buscá el kit x3: el precio por frasco más bajo, y viene con el Aplicador Masajeador de regalo.'],
  x2: [/Pack x2: \$32\.495 por frasco \(vs\. \$39\.990 comprando de a uno\)\./, () => 'Pack x2: dos meses seguidos en un solo envío, con un precio por frasco más bajo que comprando de a uno.'],
  x3v: [/Pack x3: \$28\.330 por frasco — ahorrás \$34\.980 vs\. comprar de a uno\./, () => 'Pack x3: el precio por frasco más bajo — ahorrás frente a comprar de a uno.'],
  x3n: [/Kit x3: \$29\.997 por frasco — ahorrás \$29\.980 vs\. comprar de a uno\./, () => 'Kit x3: el precio por frasco más bajo — ahorrás frente a comprar de a uno.'],
};
for (const [k, id] of Object.entries(IDS)) {
  const { body: d } = await ml(`/items/${id}/description`);
  const antes = d.plain_text ?? '';
  const desp = antes.replace(CAMBIOS[k][0], CAMBIOS[k][1]);
  if (desp === antes) { console.log(`  ${k}: no encontré la línea, salto`); continue; }
  if (/\$ ?\d/.test(desp)) console.log(`  ${k}: ⚠️ queda otro $ en la descripción`);
  console.log(`  ${k}: ${antes.length} -> ${desp.length} chars`);
  if (APLICAR) { const r = await put(`/items/${id}/description`, { plain_text: desp }); console.log(`    PUT ${r.status}`); }
}

// (3) atributos
console.log('== (3) atributos');
const cat = (await ml('/categories/MLA29893/attributes')).body;
const val = (attrId, name) => { const a = cat.find(x => x.id === attrId); const v = (a.values || []).find(v => v.name === name); if (!v) throw new Error(`sin value_id para ${attrId}=${name}`); return { id: attrId, value_id: v.id, value_name: name }; };
const multi = (attrId) => !!cat.find(x => x.id === attrId)?.tags?.multivalued;
const str = (attrId, names) => multi(attrId) ? { id: attrId, values: names.map(n => ({ name: n })) } : { id: attrId, value_name: names.join(', ') };
const comunes = [
  str('EFFECTS', ['Control caída', 'Fortalecedor']),
  str('HAIR_TREATMENT_PRESENTATION', ['Gotero']),
  val('GENDER', 'Sin género'),
  val('HAIR_TYPES', 'Todo tipo de cabello'),
  val('HAIR_TREATMENT_FORMATS', 'Sérum'),
  str('ACTIVE_INGREDIENTS', ['Aceite de romero', 'Cafeína', 'Capixyl (acetyl tetrapeptide-3)']),
  val('HAIR_TREATMENT_APPLICATION', 'Sin enjuague'),
];
const porPack = { x1: [val('SALE_FORMAT', 'Unidad'), { id: 'UNITS_PER_PACK', value_name: '1' }], x2: [val('SALE_FORMAT', 'Pack'), { id: 'UNITS_PER_PACK', value_name: '2' }], x3v: [val('SALE_FORMAT', 'Pack'), { id: 'UNITS_PER_PACK', value_name: '3' }], x3n: [val('SALE_FORMAT', 'Pack'), { id: 'UNITS_PER_PACK', value_name: '3' }] };
console.log('  multivalued: EFFECTS', multi('EFFECTS'), 'ACTIVE_INGREDIENTS', multi('ACTIVE_INGREDIENTS'));
for (const [k, id] of Object.entries(IDS)) {
  const attributes = [...comunes, ...porPack[k]];
  console.log(`  ${k}: ${attributes.length} atributos`);
  if (APLICAR) { const r = await put(`/items/${id}`, { attributes }); const j = await r.json().catch(() => ({})); console.log(`    PUT ${r.status}${r.status !== 200 ? ' ' + JSON.stringify(j).slice(0, 400) : ''}`); }
}

// (4) stock x3 nueva = 50 aplicadores
console.log('== (4) stock x3 nueva → 50');
if (APLICAR) { const r = await put(`/items/${IDS.x3n}`, { available_quantity: 50 }); console.log(`  PUT ${r.status}`); }
