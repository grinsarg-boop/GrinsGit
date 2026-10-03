// Lectura en vivo de ventas ML del día, contra los días previos a la MISMA hora.
import { ml } from './_ml.mjs';
import { readFileSync } from 'node:fs';

const env = readFileSync('.env.local', 'utf8');
const SELLER = env.match(/^ML_SELLER_ID=(.+)$/m)[1].trim();

const DAYS = 14;
const from = new Date(Date.now() - DAYS * 86400_000).toISOString();
const out = [];
for (let offset = 0; offset <= 3000; offset += 50) {
  const { status, body } = await ml('/orders/search', {
    seller: SELLER, 'order.date_created.from': from, sort: 'date_desc', offset, limit: 50,
  });
  if (status !== 200) { console.error(status, JSON.stringify(body).slice(0, 300)); process.exit(1); }
  out.push(...(body.results ?? []));
  if (!body.results?.length || out.length >= (body.paging?.total ?? out.length)) break;
}

// día y hora local AR (UTC-3)
const local = (iso) => new Date(new Date(iso).getTime() - 3 * 3600_000);
const dia = (iso) => local(iso).toISOString().slice(0, 10);
const horaDec = (iso) => { const d = local(iso); return d.getUTCHours() + d.getUTCMinutes() / 60; };

const ahora = horaDec(new Date().toISOString());
const hoy = dia(new Date().toISOString());

const pagadas = out.filter((o) => o.status === 'paid');
const byDay = new Map();
for (const o of pagadas) {
  const d = dia(o.date_created);
  if (!byDay.has(d)) byDay.set(d, []);
  byDay.get(d).push(o);
}

const monto = (o) => o.total_amount ?? 0;
const unidades = (o) => (o.order_items ?? []).reduce((a, i) => a + (i.quantity ?? 0), 0);

console.log(`# corte: hoy ${hoy}, hora local ${ahora.toFixed(2)} (AR)\n`);
console.log('dia         | ord | unid |     revenue | ord@hora | rev@hora');
for (const d of [...byDay.keys()].sort().reverse()) {
  const os = byDay.get(d);
  const hasta = os.filter((o) => horaDec(o.date_created) <= ahora);
  console.log(
    `${d} | ${String(os.length).padStart(3)} | ${String(os.reduce((a, o) => a + unidades(o), 0)).padStart(4)} | ` +
    `${Math.round(os.reduce((a, o) => a + monto(o), 0)).toLocaleString('es-AR').padStart(11)} | ` +
    `${String(hasta.length).padStart(8)} | ${Math.round(hasta.reduce((a, o) => a + monto(o), 0)).toLocaleString('es-AR').padStart(10)}`
  );
}

// desglose de hoy por título de publicación
console.log('\n# hoy por publicación');
const porItem = new Map();
for (const o of byDay.get(hoy) ?? []) {
  for (const it of o.order_items ?? []) {
    const k = `${it.item?.id} ${it.item?.title}`;
    const p = porItem.get(k) ?? { q: 0, rev: 0, n: 0 };
    p.q += it.quantity ?? 0; p.rev += (it.unit_price ?? 0) * (it.quantity ?? 0); p.n++;
    porItem.set(k, p);
  }
}
for (const [k, p] of [...porItem].sort((a, b) => b[1].rev - a[1].rev)) {
  console.log(`${String(p.n).padStart(3)} vta | ${String(p.q).padStart(3)} u | ${Math.round(p.rev).toLocaleString('es-AR').padStart(10)} | ${k}`);
}

// no pagadas de hoy (para ver si hay cola)
const hoyTodas = out.filter((o) => dia(o.date_created) === hoy);
const porStatus = {};
for (const o of hoyTodas) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
console.log('\n# hoy por status:', JSON.stringify(porStatus));
