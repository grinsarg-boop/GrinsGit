// Baja de precio para recuperar la caja de catalogo (31/08/2026).
// Las 3 publicaciones de catalogo pasaron de `winning` (29/07) a `competing` + visit_share:minimum,
// sin que nosotros movieramos un peso. Esto lleva el x2 Clasica y el x4 al price_to_win que da ML.
// El x2 Premium (MLA1830076567) NO se toca: pide -20,6% y compite contra nuestra propia Clasica.
//
// Uso:  node scripts/_ml-baja-catalogo.mjs            <- dry-run, no escribe
//       node scripts/_ml-baja-catalogo.mjs --aplicar  <- escribe
//       node scripts/_ml-baja-catalogo.mjs MLA2055177767 [--aplicar]  <- un solo item
import { ml, TOKEN } from './_ml.mjs';

const APLICAR = process.argv.includes('--aplicar');
// pack va explicito y no parseado del titulo: son tres items conocidos, y el $/unidad es
// justamente el numero que se esta decidiendo — no es para deducirlo de un string.
const OBJETIVO = {
  MLA3692036796: { precio: 'ptw', pack: 2 }, // x2 Clasica (31/08: quedo winning a $38.573)
  MLA1908275639: { precio: 'ptw', pack: 4 }, // x4: se resbalo a sharing_first_place en 1 hora ->
  // 'ptw' lee el numero de ML en el momento; hardcodearlo ya quedo viejo una vez hoy.
  MLA2055177767: { precio: 'ptw', pack: 3 }, // x3 CLASICA de catalogo (MLA77148723), alta 01/09.
  // Nacio winning a $55.500 con rivales desde $50.000: 'ptw' hoy es un no-op y solo actua si se
  // resbala. El dry-run avisa antes de tocar nada.
  MLA3030316544: { precio: 55500, pack: 3 }, // x3 Premium. NO es catalogo. $18.500/u para destapar
  // la escalera de packs, que habia quedado invertida (el x3 salia mas caro por unidad que el x2).
  MLA3692896792: { precio: 55500, pack: 3 }, // x3 CLASICA, mismo producto y mismo precio que la
  // Premium de arriba: es el A/B de la migracion Premium->Clasica (27,80% vs 15,50% de comision).
};

// Tope de caida. 'ptw' es un numero que decide ML, no nosotros: si un dia devuelve algo absurdo,
// esto lo frena antes del PUT. La baja mas grande que hicimos a mano fue -11,5%.
const CAIDA_MAX = 0.15;

// ponytail: el assert que importa. Abajo de $33.000 ML mete un cargo fijo que se come 9,7 pt de
// comision -> bajar el precio baja el neto. Ya nos paso una vez; ahora el script se niega solo.
const fee = async (cat, tipo, precio) => {
  const r = await ml('/sites/MLA/listing_prices', { price: precio, category_id: cat, listing_type_id: tipo });
  const f = Array.isArray(r.body) ? r.body.find((x) => x.listing_type_id === tipo) : r.body;
  return { monto: f?.sale_fee_amount, pct: (f?.sale_fee_amount / precio) * 100, det: f?.sale_fee_details };
};

// 28/09/2026: sin filtro, --aplicar corre los 5 items; los de precio fijo se tocarian aunque el
// pedido fuera por uno solo.
const SOLO = process.argv.find((a) => a.startsWith('MLA'));
if (SOLO && !(SOLO in OBJETIVO)) throw new Error(`${SOLO} no esta en OBJETIVO`);

for (const [id, { precio: objetivo, pack }] of Object.entries(OBJETIVO).filter(([k]) => !SOLO || k === SOLO)) {
  const it = (await ml(`/items/${id}`, {}, '2')).body;
  const ptw = it.catalog_listing ? (await ml(`/items/${id}/price_to_win`, {}, '2')).body : null;

  if (objetivo === 'ptw' && !ptw?.price_to_win) {
    console.log(`\n=== ${id}\n  SALTEA: pedia 'ptw' y ML no lo da (${ptw?.status ?? 'sin catalogo'})`);
    continue;
  }
  const nuevo = objetivo === 'ptw' ? ptw.price_to_win : objetivo;
  const a = await fee(it.category_id, it.listing_type_id, it.price);
  const b = await fee(it.category_id, it.listing_type_id, nuevo);

  console.log(`\n=== ${id} — ${it.title.slice(0, 55)}`);
  console.log(`  precio    $${it.price} -> $${nuevo}  (${(((nuevo / it.price) - 1) * 100).toFixed(2)}%)`);
  console.log(`  ptw ahora ${ptw ? `$${ptw.price_to_win} | estado ${ptw.status} | visitas ${ptw.visit_share}` : '(no es de catalogo)'}`);
  console.log(`  $/unidad  $${Math.round(it.price / pack)} -> $${Math.round(nuevo / pack)}  (pack x${pack}, ${it.listing_type_id})`);
  console.log(`  comision  $${a.monto} (${a.pct.toFixed(2)}%) -> $${b.monto} (${b.pct.toFixed(2)}%)  delta ${(b.pct - a.pct).toFixed(2)} pt`);
  console.log(`  neto/u    $${Math.round((it.price - a.monto) / pack)} -> $${Math.round((nuevo - b.monto) / pack)}`);

  if (Math.round(it.price) === nuevo) { console.log('  SALTEA: ya esta en precio'); continue; }
  if (b.pct - a.pct > 0.5) { console.log('  ABORTA: escalon de comision, el neto cae mas que el precio'); continue; }
  if (nuevo < 33000) { console.log('  ABORTA: abajo de $33.000 (zona muerta)'); continue; }
  if (nuevo < it.price * (1 - CAIDA_MAX)) { console.log(`  ABORTA: baja de ${(((nuevo / it.price) - 1) * -100).toFixed(1)}%, arriba del tope de ${CAIDA_MAX * 100}%`); continue; }
  if (ptw && nuevo > ptw.price_to_win) { console.log('  ABORTA: el ptw se movio, ya no alcanza'); continue; }
  // 23/09/2026: `price_to_win` devuelve un numero AUNQUE ya estes ganando la caja. El x4 estaba
  // `winning` con visit_share:maximum a $60.000 y el script propuso bajarlo a $51.990 (-13,35%):
  // $8.010 por venta regalados para comprar algo que ya teniamos. Si la caja es nuestra, no se toca.
  if (ptw && ptw.status === 'winning') { console.log(`  ABORTA: ya gana la caja (${ptw.status}/${ptw.visit_share}); bajar es regalar $${Math.round(it.price - nuevo)}/venta`); continue; }

  if (!APLICAR) { console.log('  [dry-run] listo para aplicar'); continue; }

  const r = await fetch(`https://api.mercadolibre.com/items/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ price: nuevo }),
  });
  const j = await r.json().catch(() => ({}));
  console.log(`  PUT ${r.status} -> precio quedo en $${j.price ?? JSON.stringify(j).slice(0, 200)}`);

  // Verificar contra ML, no contra lo que creemos que pusimos.
  const post = (await ml(`/items/${id}`, {}, '2')).body;
  console.log(`  VERIF     precio $${post.price} | ${post.status} ${JSON.stringify(post.sub_status)}`);
  if (it.catalog_listing) {
    const w = (await ml(`/items/${id}/price_to_win`, {}, '2')).body;
    console.log(`            caja ${w.status} | visitas ${w.visit_share} | ptw $${w.price_to_win}`);
  }
}
