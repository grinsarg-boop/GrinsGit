// Aplica archivos .sql a la base REAL (prod) usando DATABASE_URL de .env.local.
// Uso: node scripts/db-apply.mjs [--force] supabase/migrations/051_lo_que_sea.sql [más archivos...]
// Reemplaza el paso manual de pegar el bloque en el SQL Editor (autonomía acordada 21/07).
// Regla de uso: SIEMPRE npm run test:db verde ANTES de aplicar acá; migraciones destructivas
// (drop de tablas con datos, updates masivos) siguen pidiendo OK explícito de Pancho.
// Registro: cada archivo aplicado queda en schema_migrations (por basename); si ya figura,
// se saltea con aviso — --force lo re-aplica y actualiza la fecha.
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) { console.error('❌ falta DATABASE_URL en .env.local'); process.exit(1); }
const args = process.argv.slice(2);
const force = args.includes('--force');
const files = args.filter((a) => a !== '--force');
if (!files.length) { console.error('uso: node scripts/db-apply.mjs [--force] <archivo.sql> [...]'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`);
  for (const f of files) {
    const name = basename(f);
    process.stdout.write(`→ ${f} ... `);
    const ya = await client.query('select applied_at from schema_migrations where filename = $1', [name]);
    if (ya.rowCount && !force) {
      console.log(`⏭ YA APLICADA (${ya.rows[0].applied_at.toISOString().slice(0, 10)}) — salteada; --force para re-aplicar`);
      continue;
    }
    await client.query(readFileSync(f, 'utf8'));   // el archivo entero va en UNA transacción implícita (simple query)
    await client.query(
      'insert into schema_migrations (filename) values ($1) on conflict (filename) do update set applied_at = now()',
      [name],
    );
    console.log(ya.rowCount ? 'ok (re-aplicada)' : 'ok');
  }
  console.log('✅ aplicado');
} catch (e) {
  console.error('❌', e.message, e.where ?? '');
  process.exitCode = 1;
} finally {
  await client.end();
}
