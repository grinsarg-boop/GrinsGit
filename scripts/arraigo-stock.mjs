// Reparte un pool de frascos individuales entre las 3 publicaciones de ARRAIGO en ML.
// Uso: node scripts/arraigo-stock.mjs [total]      (default 10)
//
// ponytail: reparto calculado, NO stock compartido de verdad. El stock compartido en ML es el
// campo `bundle` del item (bundle.components[].user_product_id + quantity: "este pack consume N
// unidades de aquel user_product"). La API lo expone en lectura y valida su forma, pero NO deja
// escribirlo: PUT /items/{id} -> field_not_updatable, POST /items -> "The fields [bundle] are
// invalid for requested call" (probado tambien con el precio roto a proposito: SIN bundle ML valida
// y se queja del precio, CON bundle corta antes -> el campo esta filtrado a la entrada, no es formato).
// /marketplace/items y POST /user-products: 404. Se vincula desde el panel de ML, armando el kit
// NUEVO desde el flujo de kits -- las publicaciones ya creadas no se pueden vincular. Mientras no esté vinculado, cada
// publicación tiene su propio pool y una venta NO descuenta de las otras -> sobreventa posible.
// Re-correr este script después de cada venta o cuando entra mercadería.
import { ml, TOKEN } from './_ml.mjs';

const TOTAL = Number(process.argv[2] ?? 10);
const ITEMS = { MLA1972685043: 1, MLA1972685049: 2, MLA1972664973: 3 };  // item -> frascos por pack

for (const [id, pack] of Object.entries(ITEMS)) {
  const qty = Math.floor(TOTAL / pack);
  const r = await fetch(`https://api.mercadolibre.com/items/${id}`, {
    method: 'PUT', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ available_quantity: qty }),
  });
  const it = (await ml(`/items/${id}`)).body;
  const ok = it.available_quantity === qty;
  console.log(`x${pack} ${id} -> ${qty} packs (${qty * pack} frascos) · ${r.status} · leído ${it.available_quantity} ${ok ? 'OK' : 'MISMATCH'} · ${it.status}`);
  if (!ok) process.exitCode = 1;
}
