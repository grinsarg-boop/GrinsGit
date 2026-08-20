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

  for (const f of [...migraciones,
                   'supabase/tests/salud_check.sql',
                   'supabase/tests/pnl_check.sql', 'supabase/tests/matching_check.sql',
                   'supabase/tests/tag_dispatch_check.sql', 'supabase/tests/fixy_link_check.sql',
                   'supabase/tests/correo_check.sql', 'supabase/tests/ml_check.sql',
                   'supabase/tests/bot_pnl_check.sql', 'supabase/tests/override_check.sql',
                   'supabase/tests/flex_estimado_check.sql', 'supabase/tests/ml_ads_check.sql',
                   'supabase/tests/ml_ads_item_check.sql',
                   'supabase/tests/sales_check.sql',
                   'supabase/tests/urbano_discover_check.sql',
                   'supabase/tests/trabados_check.sql',
                   'supabase/tests/ml_retenciones_check.sql',
                   'supabase/tests/ml_liquidar_check.sql',
                   'supabase/tests/ml_bonif_check.sql',
                   'supabase/tests/ml_percep_check.sql',
                   'supabase/tests/mp_khalil_check.sql',
                   'supabase/tests/packs_pmin_check.sql',
                   'supabase/tests/anuncios_check.sql',
                   'supabase/tests/chat_check.sql',
                   'supabase/tests/ad_review_check.sql',
                   'supabase/tests/account_status_check.sql',
                   'supabase/tests/urbano_ei_check.sql',
                   'supabase/tests/devoluciones_viejas_check.sql',
                   'supabase/tests/decay_check.sql',
                   'supabase/tests/estado_ultimo_evento_check.sql',
                   'supabase/tests/ads_impuesto_check.sql']) {
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
