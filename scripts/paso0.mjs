// Paso 0 de toda lectura de gate (Plan 100M N06-R2-T4, 01/10/2026): las fuentes QUE USA ese
// gate están frescas. No es "salud verde global": el flete o las cajas rotas no frenan un gate
// de pedidos/CPA. Imprime la línea con la que arranca el veredicto; exit 1 = sin veredicto.
//
// Uso: node scripts/paso0.mjs [--hasta 2026-10-08] shopify meta ml urbano fixy
//   shopify → último pedido de la base hace < 6 h (el webhook no escribe en sync_runs)
//   otro    → sync_runs ok del connector dentro de su ventana (6 h; 26 h los diarios)
//   --hasta → además, daily_pnl recalculado después del último día de la ventana
import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^"|"$/g, '');
const args = process.argv.slice(2);
const iH = args.indexOf('--hasta');
const hasta = iH > -1 ? args.splice(iH, 2)[1] : null;
const fuentes = args.length ? args : ['shopify', 'meta'];
const HORAS = { 'shopify-backfill': 26, 'account-status': 26, 'ad-review': 26, 'ml-postventa': 26 }; // corren 1-2 veces por día

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const hhmm = (d) => d.toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const partes = [], frenadas = [];

for (const f of fuentes) {
  const { rows: [r] } = f === 'shopify'
    ? await c.query(`select max(created_at) t from orders`)
    : await c.query(`select max(finished_at) t from sync_runs where connector = $1 and status = 'ok'`, [f]);
  const t = r.t && new Date(r.t);
  const ok = t && Date.now() - t < (HORAS[f] ?? 6) * 3600e3;
  partes.push(`${f} ${ok ? 'ok' : 'FRENADA'} ${t ? hhmm(t) : 'nunca'}`);
  if (!ok) frenadas.push(f);
}

if (hasta) {
  const { rows: [r] } = await c.query(`select max(computed_at) t from daily_pnl`);
  const t = r.t && new Date(r.t);
  const ok = t && t > new Date(`${hasta}T00:00:00-03:00`).getTime() + 86400e3; // después del cierre del último día
  partes.push(`pnl ${ok ? 'recalculado' : 'VIEJO'} ${t ? hhmm(t) : 'nunca'}`);
  if (!ok) frenadas.push('daily_pnl');
}
await c.end();

console.log(frenadas.length
  ? `sin veredicto: ${frenadas.join(', ')} frenada(s) — fuentes: ${partes.join(' · ')}`
  : `fuentes: ${partes.join(' · ')}`);
process.exit(frenadas.length ? 1 : 0);
