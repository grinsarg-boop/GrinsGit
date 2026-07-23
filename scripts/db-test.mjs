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
                   'supabase/migrations/019_urbano_estado_autoritativo.sql',
                   'supabase/migrations/020_ml_orders.sql',
                   'supabase/migrations/021_ml_flete_pack.sql',
                   'supabase/migrations/022_pnl_canal_ml.sql',
                   'supabase/migrations/023_bot_pnl.sql',
                   'supabase/migrations/024_producto_override.sql',
                   'supabase/migrations/025_flex_estimado.sql',
                   'supabase/migrations/026_ml_ads.sql',
                   'supabase/migrations/027_producto_m3.sql',
                   'supabase/migrations/028_sales_pnl.sql',
                   'supabase/migrations/029_urbano_discover.sql',
                   'supabase/migrations/030_sales_trabadas.sql',
                   'supabase/migrations/031_sales_by_product.sql',
                   'supabase/migrations/032_desglose_costos.sql',
                   'supabase/migrations/033_urbano_cobranza.sql',
                   'supabase/migrations/034_analisis.sql',
                   'supabase/migrations/035_analisis_v2.sql',
                   'supabase/migrations/036_margen_neto.sql',
                   'supabase/migrations/037_sin_cohorte_sin_ml.sql',
                   'supabase/migrations/038_trabados_list.sql',
                   'supabase/migrations/039_urbano_codigos_faltantes.sql',
                   'supabase/migrations/040_fixy_codigos_faltantes.sql',
                   'supabase/migrations/041_fixy_cobranza.sql',
                   'supabase/migrations/042_courier_tiempos.sql',
                   'supabase/migrations/043_ml_retenciones.sql',
                   'supabase/migrations/044_ml_liquidacion.sql',
                   'supabase/migrations/045_ml_flex_bonif.sql',
                   'supabase/migrations/046_ml_percepciones.sql',
                   'supabase/migrations/047_percepciones_columna.sql',
                   'supabase/migrations/048_mp_khalil_fee.sql',
                   'supabase/migrations/049_packs_pmin.sql',
                   'supabase/migrations/050_packs_estimado.sql',
                   'supabase/migrations/051_anuncios.sql',
                   'supabase/migrations/052_fixy_codigos_faltantes.sql',
                   'supabase/migrations/053_chat.sql',
                   'supabase/migrations/054_ad_review.sql',
                   'supabase/tests/pnl_check.sql', 'supabase/tests/matching_check.sql',
                   'supabase/tests/tag_dispatch_check.sql', 'supabase/tests/fixy_link_check.sql',
                   'supabase/tests/correo_check.sql', 'supabase/tests/ml_check.sql',
                   'supabase/tests/bot_pnl_check.sql', 'supabase/tests/override_check.sql',
                   'supabase/tests/flex_estimado_check.sql', 'supabase/tests/ml_ads_check.sql',
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
                   'supabase/tests/ad_review_check.sql']) {
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
