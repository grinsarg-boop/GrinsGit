// Backfill del atraso de mp_release_date: la fecha se leía UNA sola vez, apenas aprobado el pago,
// cuando MP todavía devuelve el peor caso (+28 días). Al entregarse, MP la adelanta a ~+11 días y
// libera — pero nosotros seguíamos con el +28, así que "A liquidar de ML" contaba como pendiente
// plata ya cobrada ($99,4M declarados vs ~$41,9M reales, 20/08/2026).
// enrichMlTaxes ya repasa esto solo (300 por corrida, cada 4 h), pero el atraso son ~2.600 órdenes
// y tardaría día y medio: esto lo limpia de una. Idempotente, se puede volver a correr.
// 082: también trae money_release_status. La fecha sola no alcanza — MP libera a una HORA del día
// (09:38, 17:22…) y guardamos solo la fecha, así que todo lo que libera HOY se contaba como
// pendiente hasta mañana ($5.267.125 en 181 órdenes el 22/08/2026).
import { TOKEN, sql } from './_ml.mjs';

const rows = await sql(`
  select ml_id, (raw->'payments') pays
  from ml_orders
  where status='paid'
    and mp_release_date >= (now() at time zone 'America/Argentina/Buenos_Aires')::date
    and (created_at at time zone 'America/Argentina/Buenos_Aires')::date
        <= (now() at time zone 'America/Argentina/Buenos_Aires')::date - 7
  order by created_at`);

console.log(`${rows.length} órdenes a repasar`);
const CONC = 8;
let movidas = 0, iguales = 0, fallos = 0;
const updates = [];

for (let i = 0; i < rows.length; i += CONC) {
  await Promise.all(rows.slice(i, i + CONC).map(async (r) => {
    const ids = (r.pays ?? []).filter((p) => p.status === 'approved' && p.id).map((p) => p.id);
    if (!ids.length) return;
    let wh = 0, net = 0, rel = null, libre = true;
    for (const id of ids) {
      const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
        headers: { authorization: `Bearer ${TOKEN}` },
      });
      if (!res.ok) { fallos++; return; } // igual que enrichMlTaxes: no marca, reintenta el cron
      const p = await res.json();
      wh += (p.charges_details ?? []).filter((c) => c.name?.startsWith('withholding'))
        .reduce((s, c) => s + (c.amounts?.original ?? 0), 0);
      net += p.transaction_details?.net_received_amount ?? 0;
      const rd = String(p.money_release_date ?? '').slice(0, 10);
      if (rd && (!rel || rd > rel)) rel = rd;
      if (p.money_release_status !== 'released') libre = false;
    }
    updates.push([r.ml_id, wh, net, rel, libre ? 'released' : 'pending']);
  }));
  if ((i / CONC) % 25 === 0) console.log(`  ${Math.min(i + CONC, rows.length)}/${rows.length}`);
}

for (let i = 0; i < updates.length; i += 200) {
  const chunk = updates.slice(i, i + 200);
  await sql(`update ml_orders o set tax_withheld=v.wh, mp_net=v.net, mp_release_date=v.rel,
                                    mp_release_status=v.st
             from (values ${chunk.map(([id, wh, net, rel, st]) =>
               `(${id}::bigint, ${wh}::numeric, ${net}::numeric, ${rel ? `'${rel}'` : 'null'}::date, '${st}'::text)`).join(',')})
             as v(ml_id, wh, net, rel, st) where o.ml_id = v.ml_id`);
}
for (const [, , , , st] of updates) (st === 'released' ? movidas++ : iguales++);
console.log(`\nactualizadas=${updates.length} released=${movidas} pending=${iguales} fallos=${fallos}`);
