// Simulacion: conviene bajar la x2 Clasica al price_to_win para ganar la caja? (23/09/2026)
//
// El dry-run de _ml-baja-catalogo.mjs aborta por el escalon de comision de $33.000, pero su
// cuenta es precio-comision: no cuenta flete ni COGS, y usa el 15,50% de /listing_prices cuando
// la comision que ML cobra de verdad en esta publicacion es ~20,3% (el delta es el cargo por
// cuotas sin interes de la campana). Los dos errores van en la misma direccion: hacen ver la
// baja mas barata de lo que es. Aca la unidad es la CONTRIBUCION por orden, con todo adentro.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { ml } from './_ml.mjs';

const ID = 'MLA3692036796', PACK = 2, PRODUCT_ID = 2; // x2 Clasica de Pureza
const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();

// 1) Parametros medidos, no supuestos. Ventana de 7 dias completos (excluye el dia en curso).
const { rows: [m] } = await c.query(`
  select round(avg(sale_fee) / avg(total_amount) * 100, 2)::float as fee_pct,
         round(avg(ship_cost))::float as flete, count(*)::int as n
  from ml_orders
  where raw#>>'{order_items,0,item,id}' = $1 and status <> 'cancelled'
    and created_at >= current_date - interval '8 days' and created_at < current_date`, [ID]);
const { rows: [k] } = await c.query(
  'select unit_cost::float as cogs from product_costs where product_id = $1 and pack = $2', [PRODUCT_ID, PACK]);
// Volumen base: mediana de ordenes/dia de dias completos, para no comerse el dia en curso.
const { rows: [v] } = await c.query(`
  select percentile_cont(0.5) within group (order by n)::float as base from (
    select count(*) n from ml_orders
    where raw#>>'{order_items,0,item,id}' = $1 and status <> 'cancelled'
      and created_at >= current_date - interval '8 days' and created_at < current_date
    group by created_at::date) s`, [ID]);
await c.end();

// 2) El escalon lo dice ML, no nosotros.
const it = (await ml(`/items/${ID}`, {}, '2')).body;
const ptw = (await ml(`/items/${ID}/price_to_win`, {}, '2')).body;
const fee = async (p) => {
  const r = await ml('/sites/MLA/listing_prices', { price: p, category_id: it.category_id, listing_type_id: it.listing_type_id });
  const f = Array.isArray(r.body) ? r.body.find((x) => x.listing_type_id === it.listing_type_id) : r.body;
  return (f.sale_fee_amount / p) * 100;
};
const salto = (await fee(ptw.price_to_win)) - (await fee(it.price)); // puntos del escalon

const contrib = (precio, feePct) => precio - precio * (feePct / 100) - m.flete - k.cogs;
const A = contrib(it.price, m.fee_pct);                 // hoy: sharing_first_place
const B = contrib(ptw.price_to_win, m.fee_pct + salto); // al ptw: gana la caja, paga el escalon
const empate = A / B - 1;

console.log(`\nx2 Clasica ${ID} — ${it.title.slice(0, 48)}`);
console.log(`Medido (7 dias completos, n=${m.n}): comision real ${m.fee_pct}% · flete $${m.flete}/orden · COGS pack x${PACK} $${k.cogs} · base ${v.base} ord/dia`);
console.log(`Caja: ${ptw.status} / visitas ${ptw.visit_share} · precio $${it.price} · ptw $${ptw.price_to_win} · escalon +${salto.toFixed(2)} pt\n`);
console.log(`                         A: NO bajar      B: bajar al ptw`);
console.log(`  precio                 $${it.price.toLocaleString('es')}          $${ptw.price_to_win.toLocaleString('es')}`);
console.log(`  comision efectiva      ${m.fee_pct.toFixed(2)}%           ${(m.fee_pct + salto).toFixed(2)}%`);
console.log(`  flete                  $${m.flete}           $${m.flete}`);
console.log(`  COGS                   $${k.cogs}           $${k.cogs}`);
console.log(`  CONTRIBUCION/orden     $${Math.round(A).toLocaleString('es')}          $${Math.round(B).toLocaleString('es')}   (${Math.round(B - A)})`);
console.log(`\n  Para empatar, B necesita +${(empate * 100).toFixed(1)}% de ordenes.`);
console.log(`  Elasticidad requerida: ${(empate / (Math.abs(ptw.price_to_win / it.price - 1))).toFixed(1)} (el simulador de COD llama fantasia a >3,`);
console.log(`  pero ganar la caja es un salto discreto, no elasticidad: la vara real son los episodios medidos).\n`);

console.log(`  Profit/dia segun cuanto devuelva la caja (base ${v.base} ord/dia):`);
console.log(`    escenario                    ordenes/dia   contribucion/dia    vs NO bajar`);
const fmt = (n) => ('$' + Math.round(n).toLocaleString('es')).padStart(11);
console.log(`    A — no bajar (sharing)        ${String(v.base).padStart(6)}   ${fmt(v.base * A)}              —`);
for (const g of [0, 0.1, 0.2, empate, 0.4, 0.6, 0.9]) {
  const ord = v.base * (1 + g), tot = ord * B, d = tot - v.base * A;
  const etq = Math.abs(g - empate) < 1e-9 ? `B — +${(g * 100).toFixed(1)}% (EMPATE)` : `B — +${(g * 100).toFixed(0)}% de ordenes`;
  console.log(`    ${etq.padEnd(28)}  ${String(Math.round(ord)).padStart(6)}   ${fmt(tot)}   ${((d >= 0 ? '+' : '') + '$' + Math.round(d).toLocaleString('es')).padStart(12)}`);
}
console.log();
