// Corre 001 + 002 + supabase/tests/pnl_check.sql contra un Postgres 16 embebido.
// Uso: node scripts/db-test.mjs
// (contra Supabase real alcanza: psql $DATABASE_URL -f supabase/tests/pnl_check.sql)
import EmbeddedPostgres from 'embedded-postgres';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
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
  for (const f of ['supabase/migrations/001_init.sql', 'supabase/migrations/002_rpcs.sql',
                   'supabase/migrations/003_matching_shopify_id.sql',
                   'supabase/migrations/004_fixy_status_map.sql',
                   'supabase/migrations/005_urbano_status_map.sql',
                   'supabase/migrations/006_pack_quantity.sql',
                   'supabase/migrations/007_dashboard_agg.sql',
                   'supabase/migrations/008_fixy_api_status.sql',
                   'supabase/migrations/009_estimated_pnl.sql',
                   'supabase/migrations/010_urbano_ra_rv_map.sql',
                   'supabase/migrations/011_ads_period_alloc.sql',
                   'supabase/migrations/012_canal_cuotas_correo.sql',
                   'supabase/migrations/013_dispatch_from_tag.sql',
                   'supabase/migrations/014_fixy_api_link.sql',
                   'supabase/migrations/015_correo_sin_proyeccion.sql',
                   'supabase/migrations/016_correo_cohorte_art.sql',
                   'supabase/migrations/017_ads_adset.sql',
                   'supabase/migrations/018_no_despachado.sql',
                   'supabase/tests/pnl_check.sql', 'supabase/tests/matching_check.sql',
                   'supabase/tests/tag_dispatch_check.sql', 'supabase/tests/fixy_link_check.sql',
                   'supabase/tests/correo_check.sql']) {
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
