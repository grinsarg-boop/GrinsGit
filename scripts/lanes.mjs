// P&L por lane de una campaña de Meta, SIN depender del sync de ad_spend ni de la atribución
// del pixel: el gasto sale de la Graph API en vivo y las órdenes de la base, cruzadas por
// GEOGRAFÍA (los lanes están partidos por CP, así que el CP de la orden dice de qué lane vino).
// Uso: node scripts/lanes.mjs [dias]   (default 3; excluye el día de hoy, que está incompleto)
//
// Kill-rule: el CPA por lane se mide acá, no en Meta — el pixel de esta cuenta reporta 2-3,7x
// más compras que las órdenes reales. Corte sugerido: CPA > $6.500 a los 4 días → apagar lane.
//
// LÍMITE: mientras los lanes se separen solo por geo esto los distingue al 100%. Si se abren
// lanes por EDAD dentro de la misma geo, el CP ya no alcanza y hace falta utm_content por ad.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const dias = Number(process.argv[2] ?? 3);
const hasta = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);        // ayer
const desde = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);

// Margen bruto por orden GENERADA, antes de ads. Difiere por courier porque difiere la tasa de
// entrega (fixy 67,4% vs urbano 57,6%), y las CUOTAS son un tercer caso: en el P&L figuran como
// courier 'correo' (migración 012 — el tag cuotas_3 no genera guía), son prepago, así que no
// arrastran riesgo de cobro pero pagan fee de MP. OJO: `orders.courier` NUNCA dice 'correo',
// guarda el transportista físico; las cuotas se detectan por el tag.
// fixy/urbano: ventana madura 25/05→25/06. cuotas: 15/06→15/07, la única donde existen (arrancaron
// el 06/07) — menos madura, revisar cuando haya un mes cerrado.
const MARGEN = { fixy: 19811, urbano: 12797, cuotas: 15802 };
const KILL_CPA = 6500;

// RESTO se testea PRIMERO: el lane resto se llama "...-RESTO-AR-sinFixy-...", que también
// contiene "Fixy" y caería en el lane equivocado si se preguntara por FIXY antes.
const laneDeAdset = (n) => (/RESTO/i.test(n) ? 'RESTO' : /FIXY/i.test(n) ? 'FIXY' : null);
const laneDeCP = (zip) => (/^1\d{3}/.test(String(zip ?? '').replace(/\D/g, '')) ? 'FIXY' : 'RESTO');

const PURCHASE = new Set(['purchase', 'omni_purchase', 'offsite_conversion.fb_pixel_purchase']);
const cuentas = env.META_AD_ACCOUNT_ID.split(',').map((a) => a.trim()).filter(Boolean);
const gasto = {}, comprasMeta = {};
for (const acct of cuentas) {
  const url = `https://graph.facebook.com/${env.META_API_VERSION ?? 'v25.0'}/${acct}/insights?` +
    new URLSearchParams({
      level: 'adset', fields: 'adset_name,spend,actions', limit: '500',
      time_range: JSON.stringify({ since: desde, until: hasta }),
      access_token: env.META_ACCESS_TOKEN,
    });
  const body = await fetch(url).then((r) => r.json());
  if (body.error) { console.error(`⚠ ${acct}: ${body.error.message}`); continue; }
  for (const r of body.data ?? []) {
    if (!/beevenom/i.test(r.adset_name)) continue;
    // Un adset que no cae en ningún lane (la estructura vieja de R2, o un lane mal nombrado) NO
    // se descarta: va a un bucket aparte. Descartarlo bajaría el CPA sin que se note.
    const l = laneDeAdset(r.adset_name) ?? 'SIN LANE';
    gasto[l] = (gasto[l] ?? 0) + parseFloat(r.spend ?? '0');
    comprasMeta[l] = (comprasMeta[l] ?? 0) + (r.actions ?? [])
      .filter((a) => PURCHASE.has(a.action_type))
      .reduce((s, a) => s + parseInt(a.value, 10), 0);
  }
}

const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  `select o.zip, o.courier, o.tags ilike '%cuotas%' as cuotas, s.id is not null as despachada,
          s.status_canonical = 'entregado' as entregada,
          s.status_canonical in ('devuelto', 'rechazado') as devuelta
   from orders o
   join order_items oi on oi.order_id = o.id
   left join shipments s on s.order_id = o.id
   where oi.product_id = 4 and o.created_at >= $1 and o.created_at < ($2::date + 1)`,
  [desde, hasta],
);
await client.end();

const ordenes = {};
for (const o of rows) {
  const l = laneDeCP(o.zip);
  ordenes[l] ??= { n: 0, margen: 0 };
  ordenes[l].n++;
  // Cuotas manda sobre el courier: es prepago y su margen no depende de quién entregue.
  ordenes[l].margen += o.cuotas ? MARGEN.cuotas : (MARGEN[o.courier] ?? MARGEN.urbano);
}

const ars = (n) => '$' + Math.round(n).toLocaleString('es-AR');
console.log(`\nBeeVenom — P&L por lane, ${desde} → ${hasta} (${dias} días)\n`);
console.log('lane     gasto        órd    CPA        margen/gen   neto/gen    profit/día   x$ de ads');
let tg = 0, tp = 0;
for (const l of ['FIXY', 'RESTO', 'SIN LANE']) {
  const g = gasto[l] ?? 0, o = ordenes[l] ?? { n: 0, margen: 0 };
  if (!g && !o.n) continue;
  if (l === 'SIN LANE') {
    tg += g;
    console.log(`${'SIN LANE'.padEnd(8)} ${ars(g).padStart(10)} ${'—'.padStart(6)} ` +
      `${'—'.padStart(9)}${''.padStart(37)}  ⚠ gasto fuera de los lanes (estructura vieja de R2):`);
    console.log(`         la ventana mezcla dos estructuras — acortá los días o leelo con esto en cuenta`);
    continue;
  }
  const cpa = o.n ? g / o.n : 0;
  const mg = o.n ? o.margen / o.n : 0;
  const profit = o.margen - g;
  tg += g; tp += profit;
  const alarma = cpa > KILL_CPA ? '  ⛔ SOBRE EL CORTE' : '';
  console.log(
    `${l.padEnd(8)} ${ars(g).padStart(10)} ${String(o.n).padStart(6)} ${ars(cpa).padStart(9)} ` +
    `${ars(mg).padStart(12)} ${ars(mg - cpa).padStart(11)} ${ars(profit / dias).padStart(13)} ` +
    `${(o.margen / g).toFixed(2).padStart(9)}${alarma}`,
  );
}
console.log(`\nTOTAL    ${ars(tg).padStart(10)} ${String(rows.length).padStart(6)} ${ars(tg / rows.length).padStart(9)}` +
  `${''.padStart(24)} ${ars(tp / dias).padStart(13)}`);
console.log(`\nCorte de la kill-rule: CPA > ${ars(KILL_CPA)} por lane a los 4 días.`);

// Ventas por courier: a qué transportista terminó yendo cada orden de cada zona. Es el control
// de que el ruteo hace lo que debe (zona FIXY → fixy); una orden de zona FIXY que sale por
// urbano es la fuga que cuesta ~$4.100 de neto por guía.
const porCourier = {};
for (const o of rows) {
  const k = `${laneDeCP(o.zip)}|${o.cuotas ? 'cuotas' : (o.courier ?? 'sin courier')}`;
  porCourier[k] ??= { n: 0, desp: 0, ent: 0, dev: 0 };
  porCourier[k].n++;
  if (o.despachada) porCourier[k].desp++;
  if (o.entregada) porCourier[k].ent++;
  if (o.devuelta) porCourier[k].dev++;
}
// El pixel reporta MÁS compras que las órdenes reales, así que el CPA de Ads Manager subestima.
// Para decidir ad por ad no hay alternativa a mirar el número de Meta (la atribución por utm cubre
// ~33%), así que lo que hay que corregir es el UMBRAL: dividir el CPA real objetivo por este factor.
console.log('\nFactor de corrección del CPA de Meta (el pixel infla las compras):\n');
console.log('lane     compras Meta   órd reales   factor   umbral en Ads Manager para un CPA real de:');
console.log('                                              $8.600 (obj)   $16.100 (máx)');
for (const l of ['FIXY', 'RESTO']) {
  const cm = comprasMeta[l] ?? 0, or = (ordenes[l] ?? { n: 0 }).n;
  if (!cm || !or) continue;
  const f = cm / or;
  console.log(
    `${l.padEnd(8)} ${String(cm).padStart(12)} ${String(or).padStart(12)} ${f.toFixed(2).padStart(8)}x   ` +
    `${ars(8600 / f).padStart(12)}   ${ars(16100 / f).padStart(13)}`,
  );
}

console.log('\nVentas por courier (entrega madura recién a los ~7-10 días, no leer antes):\n');
console.log('zona     courier      órd   despach   entreg   devuelt');
for (const [k, v] of Object.entries(porCourier).sort()) {
  const [zona, courier] = k.split('|');
  const fuga = zona === 'FIXY' && courier === 'urbano' ? '  ← fuga de ruteo' : '';
  console.log(
    `${zona.padEnd(8)} ${courier.padEnd(12)} ${String(v.n).padStart(4)} ${String(v.desp).padStart(9)} ` +
    `${String(v.ent).padStart(8)} ${String(v.dev).padStart(9)}${fuga}`,
  );
}
console.log();
