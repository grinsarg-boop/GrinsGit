// Empuja datos/urbano_rendiciones.csv a la base (tabla urbano_rendiciones, migr 084).
// Uso:  node scripts/urbano-push-rendiciones.mjs [--dry]
// Idempotente: se puede correr cada vez que entra un resumen nuevo. La regla de reimpresión sale
// de _urbano-rend.mjs, la misma que usa el reclamo — acá se traduce a la columna `vale`.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, leerRendiciones } from './_urbano-rend.mjs';

const { rend, vale } = leerRendiciones();
const filas = rend.map((r) => ({
  resumen: r.resumen, fecha_pago: r.fecha, fmt: r.fmt, guia: r.guia,
  monto: r.monto, comprobante: r.comprobante ?? '', transferido: r.transferido ?? '',
  archivo: r.archivo ?? '', vale: vale(r),
}));
const descartadas = filas.filter((f) => !f.vale).length;
console.log(`${filas.length} filas · ${descartadas} marcadas reimpresión (vale=false)`);
if (process.argv.includes('--dry')) { console.log('(--dry: no escribí nada)'); process.exit(0); }

const url = readFileSync(join(RAIZ, '.env.local'), 'utf8').match(/^DATABASE_URL=(.+)$/m)[1].trim();
const db = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await db.connect();
let n = 0;
for (let i = 0; i < filas.length; i += 1000) {                 // ponytail: lotes de 1000, el jsonb entero anda pero no hace falta probarlo
  const { rows } = await db.query('select import_urbano_rendiciones($1) as n', [JSON.stringify(filas.slice(i, i + 1000))]);
  n += rows[0].n;
}
const { rows: [chk] } = await db.query(
  `select count(*)::int filas, count(*) filter (where vale)::int valen,
          sum(monto) filter (where vale) bruto, max(fecha_pago) ultima
   from urbano_rendiciones`);
console.log(`→ ${n} filas escritas · en la base: ${chk.filas} (${chk.valen} valen, $${Math.round(chk.bruto).toLocaleString('es-AR')}) · última ventana ${chk.ultima.toISOString().slice(0, 10)}`);
await db.end();
