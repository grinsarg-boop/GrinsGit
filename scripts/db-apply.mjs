// Aplica archivos .sql a la base REAL (prod) usando DATABASE_URL de .env.local.
// Uso: node scripts/db-apply.mjs supabase/migrations/051_lo_que_sea.sql [más archivos...]
// Reemplaza el paso manual de pegar el bloque en el SQL Editor (autonomía acordada 21/07).
// Regla de uso: SIEMPRE npm run test:db verde ANTES de aplicar acá; migraciones destructivas
// (drop de tablas con datos, updates masivos) siguen pidiendo OK explícito de Pancho.
import pg from 'pg';
import { readFileSync } from 'node:fs';

const url = readFileSync('.env.local', 'utf8').match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) { console.error('❌ falta DATABASE_URL en .env.local'); process.exit(1); }
const files = process.argv.slice(2);
if (!files.length) { console.error('uso: node scripts/db-apply.mjs <archivo.sql> [...]'); process.exit(1); }

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const f of files) {
    process.stdout.write(`→ ${f} ... `);
    await client.query(readFileSync(f, 'utf8'));   // el archivo entero, una transacción implícita por statement
    console.log('ok');
  }
  console.log('✅ aplicado');
} catch (e) {
  console.error('❌', e.message, e.where ?? '');
  process.exitCode = 1;
} finally {
  await client.end();
}
