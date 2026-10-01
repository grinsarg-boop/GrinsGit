// CPA marginal del SISTEMA: pedidos COD de la base contra la pauta real, por día.
//
// Por qué del sistema y no por campaña: medido el 28/08/2026, `BeeVenom · ABO Fixy vs Open`
// subió el gasto 55% semana contra semana y sumó 3 compras — leído por campaña es saturación
// total. En el mismo período el sistema pasó de 899 a 1.025 pedidos por +$614k. La plata
// convirtió; el pixel se la atribuyó a otra campaña. El único marginal verificable es el
// total de la base contra el gasto total.
//
// Uso: node scripts/marginal.mjs [ventana_dias]           → 7v7 + regresión
//      node scripts/marginal.mjs [dias] --desde 2026-08-29 → lee un escalón desde su día 1
//      ... --incluir-todo → sin el filtro de abajo, para comparar
//
// Filtro por defecto (29/09/2026, Plan 100M A01-R2-T1): solo R2 y R3, y afuera las campañas de
// Dusty Rose (proyecto de la madre, reintegra el saldo: no es costo de BioLabs) y ARRAIGO
// (ROJO, pausado el 27/09), con sus pedidos (product_id 8). El gate del 25/09 se lee "sin
// Dusty ni ARRAIGO"; sumarlos ensucia el marginal del sistema.
//
// Techo: $9.000. Sale del MC de $14.000 por pedido despachado (post producto/flete/comisión,
// con tasa de entrega proyectada adentro) menos los $5.000 que se exigen de neto. El $4.400
// que circulaba antes del 28/08/2026 era el CPA promedio de junio, un objetivo, no un corte.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const TECHO = 9000;
const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const dias = Number(process.argv[2] ?? 7);
const iDesde = process.argv.indexOf('--desde');
const desde = iDesde > -1 ? process.argv[iDesde + 1] : null;
const todo = process.argv.includes('--incluir-todo');
const CUENTAS = `'act_880189106877616','act_1569698667101520'`;   // R2, R3
const ARRAIGO = 8;
const filtroGasto = todo ? 'true' : `account_id in (${CUENTAS}) and campaign_name !~* '(dusty|arraigo)'`;
const filtroPedido = todo ? 'true' : `not exists (select 1 from order_items i where i.order_id = orders.id and i.product_id = ${ARRAIGO})`;

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
// El día de HOY se excluye siempre: está a medio gastar y hunde el CPA del último punto.
const { rows } = await c.query(`
  with o as (
    select (created_at at time zone 'America/Argentina/Buenos_Aires')::date d, count(*) n
    from orders where cancelled_at is null and ${filtroPedido} group by 1
  ), s as (select date d, sum(spend_real) g from v_ad_spend where ${filtroGasto} group by 1)
  select to_char(s.d,'YYYY-MM-DD') dia, coalesce(o.n,0)::int n, s.g::float g
  from s left join o on o.d = s.d
  where s.d < (now() at time zone 'America/Argentina/Buenos_Aires')::date
  order by s.d`);
await c.end();

const ars = (n) => '$' + Math.round(n).toLocaleString('es-AR');
const cpa = (g, n) => (n > 0 ? g / n : Infinity);
const sum = (a, k) => a.reduce((s, x) => s + x[k], 0);
console.log(todo ? '\n(--incluir-todo: todas las cuentas y campañas)' : '\n(sin Dusty Rose ni ARRAIGO; solo R2+R3 — --incluir-todo para comparar)');

if (desde) {
  const post = rows.filter((r) => r.dia >= desde);
  const pre = rows.filter((r) => r.dia < desde).slice(-post.length);
  if (!post.length) { console.log(`Sin días completos desde ${desde}. Volvé mañana.`); process.exit(0); }
  console.log(`\nEscalón desde ${desde} — ${post.length} día(s) completo(s) contra los ${pre.length} previos\n`);
  for (const [lbl, w] of [['antes', pre], ['después', post]])
    console.log(` ${lbl.padEnd(8)} ${w[0].dia}→${w.at(-1).dia}  pauta ${ars(sum(w, 'g') / w.length)}/día  pedidos ${(sum(w, 'n') / w.length).toFixed(1)}/día  CPA medio ${ars(cpa(sum(w, 'g'), sum(w, 'n')))}`);
  const dg = sum(post, 'g') / post.length - sum(pre, 'g') / pre.length;
  const dn = sum(post, 'n') / post.length - sum(pre, 'n') / pre.length;
  const m = dg / dn;
  console.log(`\n MARGINAL = ${ars(dg)}/día ÷ ${dn.toFixed(1)} pedidos/día = ${dn > 0 ? ars(m) : 'sin pedidos incrementales'}`);
  console.log(` Techo ${ars(TECHO)} → ${dn > 0 && m > 0 && m < TECHO ? `✅ AGUANTA (deja ${ars(14000 - m)} por pedido)` : '⛔ FRENAR / REVERTIR'}`);
  if (post.length < 4) console.log(`\n ⚠ ${post.length} día(s) no alcanza. La lectura vale a los 4-5 días: ` +
    `un día suelto mezcla el escalón con el día de la semana y con la atribución sin madurar.`);
  process.exit(0);
}

const b = rows.slice(-dias * 2, -dias), a = rows.slice(-dias);
const dg = sum(a, 'g') - sum(b, 'g'), dn = sum(a, 'n') - sum(b, 'n');
console.log(`\n7v7 — ${b[0].dia}→${b.at(-1).dia} vs ${a[0].dia}→${a.at(-1).dia}`);
console.log(` antes:   ${ars(sum(b, 'g') / dias)}/día → ${(sum(b, 'n') / dias).toFixed(1)} pedidos/día`);
console.log(` después: ${ars(sum(a, 'g') / dias)}/día → ${(sum(a, 'n') / dias).toFixed(1)} pedidos/día`);
console.log(` MARGINAL = ${ars(dg / dn)}  (Δ ${ars(dg)} ÷ ${dn} pedidos)  · techo ${ars(TECHO)}`);

const w = rows.slice(-15).filter((r) => r.g > 0 && r.n > 0);
const xs = w.map((r) => Math.log(r.g)), ys = w.map((r) => Math.log(r.n));
const mx = xs.reduce((s, v) => s + v) / xs.length, my = ys.reduce((s, v) => s + v) / ys.length;
const beta = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
const ss = ys.reduce((s, y) => s + (y - my) ** 2, 0);
const r2 = 1 - ys.reduce((s, y, i) => s + (y - (my + beta * (xs[i] - mx))) ** 2, 0) / ss;
const cpaMedio = cpa(sum(w, 'g'), sum(w, 'n'));
console.log(`\nRegresión log-log, n=${w.length} días, banda ${ars(Math.min(...w.map((r) => r.g)))}–${ars(Math.max(...w.map((r) => r.g)))}/día`);
console.log(` beta ${beta.toFixed(3)}  R² ${r2.toFixed(2)}  ·  CPA medio ${ars(cpaMedio)} → marginal implícito ${ars(cpaMedio / beta)}`);
console.log(` ⚠ fuera de esa banda es extrapolación, no medición: re-medir en cada escalón.\n`);
