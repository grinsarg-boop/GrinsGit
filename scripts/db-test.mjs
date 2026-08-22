// Corre 001 + 002 + supabase/tests/pnl_check.sql contra un Postgres 16 embebido.
// Uso: node scripts/db-test.mjs
// (contra Supabase real alcanza: psql $DATABASE_URL -f supabase/tests/pnl_check.sql)
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, readdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'biolabs-pg-'));
const pg = new EmbeddedPostgres({
  databaseDir: dir, user: 'postgres', password: 'postgres', port: 55442, persistent: false,
});

// roles/publication que Supabase trae de fábrica y las migraciones asumen
const bootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create publication supabase_realtime;
`;

try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('app');
  const client = pg.getPgClient('app');
  await client.connect();
  await client.query(bootstrap);
  // Las migraciones se descubren solas: el prefijo numérico ES el orden. La lista a mano se
  // olvidaba — 059 nunca entró y salud_check corría contra la versión vieja de salud_sistema().
  const migraciones = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort()
    .map((f) => `supabase/migrations/${f}`);

  // Los tests se descubren igual que las migraciones, y por el mismo motivo: la lista a mano se
  // olvidaba. urbano_rendiciones_check (084) se escribió y nunca corrió hasta que esto dejó de ser
  // una lista. Cada test abre su propio begin/rollback, así que el orden no importa.
  const tests = readdirSync('supabase/tests').filter((f) => f.endsWith('_check.sql')).sort()
    .map((f) => `supabase/tests/${f}`);

  for (const f of [...migraciones, ...tests]) {
    process.stdout.write(`→ ${f} ... `);
    await client.query(readFileSync(f, 'utf8'));
    console.log('ok');
  }
  console.log('✅ pnl_check pasó');
  await client.end();
} catch (e) {
  console.error('❌', e.message, e.where ?? '');
  process.exitCode = 1;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
