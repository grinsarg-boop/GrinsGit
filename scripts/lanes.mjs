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

// Margen bruto por orden GENERADA, antes de ads (ventana madura 25/05→25/06, sales_by_product).
// Difiere por courier porque la tasa de entrega difiere: fixy 67,4% vs urbano 57,6%.
const MARGEN = { fixy: 19811, urbano: 12797, correo: 12797 };
const KILL_CPA = 6500;

// RESTO se testea PRIMERO: el lane resto se llama "...-RESTO-AR-sinFixy-...", que también
// contiene "Fixy" y caería en el lane equivocado si se preguntara por FIXY antes.
const laneDeAdset = (n) => (/RESTO/i.test(n) ? 'RESTO' : /FIXY/i.test(n) ? 'FIXY' : null);
const laneDeCP = (zip) => (/^1\d{3}/.test(String(zip ?? '').replace(/\D/g, '')) ? 'FIXY' : 'RESTO');

const cuentas = env.META_AD_ACCOUNT_ID.split(',').map((a) => a.trim()).filter(Boolean);
const gasto = {};
for (const acct of cuentas) {
  const url = `https://graph.facebook.com/${env.META_API_VERSION ?? 'v25.0'}/${acct}/insights?` +
    new URLSearchParams({
      level: 'adset', fields: 'adset_name,spend', limit: '500',
      time_range: JSON.stringify({ since: desde, until: hasta }),
      access_token: env.META_ACCESS_TOKEN,
    });
  const body = await fetch(url).then((r) => r.json());
  if (body.error) { console.error(`⚠ ${acct}: ${body.error.message}`); continue; }
  for (const r of body.data ?? []) {
    if (!/beevenom/i.test(r.adset_name)) continue;
    const l = laneDeAdset(r.adset_name);
    if (!l) { console.error(`⚠ adset sin lane reconocible: ${r.adset_name}`); continue; }
    gasto[l] = (gasto[l] ?? 0) + parseFloat(r.spend ?? '0');
  }
}

const client = new pg.Client({ connectionString: env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const { rows } = await client.query(
  `select o.zip, o.courier from orders o join order_items oi on oi.order_id = o.id
   where oi.product_id = 4 and o.created_at >= $1 and o.created_at < ($2::date + 1)`,
  [desde, hasta],
);
await client.end();

const ordenes = {};
for (const o of rows) {
  const l = laneDeCP(o.zip);
  ordenes[l] ??= { n: 0, margen: 0 };
  ordenes[l].n++;
  ordenes[l].margen += MARGEN[o.courier] ?? MARGEN.urbano;   // el courier real manda sobre el CP
}

const ars = (n) => '$' + Math.round(n).toLocaleString('es-AR');
console.log(`\nBeeVenom — P&L por lane, ${desde} → ${hasta} (${dias} días)\n`);
console.log('lane     gasto        órd    CPA        margen/gen   neto/gen    profit/día   x$ de ads');
let tg = 0, tp = 0;
for (const l of ['FIXY', 'RESTO']) {
  const g = gasto[l] ?? 0, o = ordenes[l] ?? { n: 0, margen: 0 };
  if (!g && !o.n) continue;
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
console.log(`\nCorte de la kill-rule: CPA > ${ars(KILL_CPA)} por lane a los 4 días.\n`);
