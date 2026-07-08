// SETUP de la reconciliación: Postgres 16 embebido + migraciones 001–005 + ingesta COMPLETA por
// el pipeline REAL de la app (RPCs SQL) + override Ve-CBO→Veinguard + recompute_daily_pnl.
// Es el "lado app" de la reconciliación. Lo consume scripts/reconcile_may.ts.
//
// Ingesta (orden del backfill): Shopify → Urbano WS (cache) → facturación → Fixy → Meta → recompute.
// Shopify y Meta se cachean a disco (datos/*.json, gitignored) para que las corridas sean
// reproducibles y no re-peguen a las APIs. El WS ya está en datos/urbano_ws_cache (6366).
import EmbeddedPostgres from "embedded-postgres";
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { parseUrbanoResponse } from "../lib/couriers/urbano.ts";
import { parseFixyXlsx } from "../lib/couriers/fixy.ts";
import { shopifyFetch, SHOPIFY_API_VERSION } from "../lib/shopify.ts";

export const FROM = "2026-05-01";
// Shopify se ingesta desde antes de mayo: hay pedidos creados pre-mayo pero DESPACHADOS en mayo
// (ej. las guías Fixy con order# ~8300-8500). El cohorte es por fecha de despacho, así que traerlos
// no ensucia mayo (los no-despachados-en-mayo no entran) y sí captura los que sí.
export const SHOP_FROM = "2026-03-01";
const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const WS_CACHE = "datos/urbano_ws_cache";
const SHOP_CACHE = `datos/shopify_orders_${SHOP_FROM}.json`;   // el nombre incluye la fecha → cambiarla invalida el cache
const META_CACHE = "datos/meta_insights_cache.json";
const PURCHASE = new Set(["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
const today = () => new Date().toISOString().slice(0, 10);
const MIGRATIONS = [
  "supabase/migrations/001_init.sql", "supabase/migrations/002_rpcs.sql",
  "supabase/migrations/003_matching_shopify_id.sql", "supabase/migrations/004_fixy_status_map.sql",
  "supabase/migrations/005_urbano_status_map.sql", "supabase/migrations/006_pack_quantity.sql",
];
const BOOTSTRAP = `create role anon nologin; create role authenticated nologin;
  create role service_role nologin; create publication supabase_realtime;`;

type PgClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>; end: () => Promise<void> };

// ---------- fuentes con cache a disco ----------
async function loadShopifyOrders(): Promise<any[]> {
  if (existsSync(SHOP_CACHE)) {
    const o = JSON.parse(readFileSync(SHOP_CACHE, "utf8"));
    console.log(`  shopify: ${o.length} pedidos (cache)`);
    return o;
  }
  const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
  let url: string | null =
    `https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${SHOP_FROM}T00:00:00-03:00&limit=250`;
  const all: any[] = [];
  while (url) {
    const res: Response = await shopifyFetch(url);
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const { orders } = await res.json();
    all.push(...(orders ?? []));
    url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
    process.stdout.write(`\r  shopify: bajando… ${all.length}`);
  }
  writeFileSync(SHOP_CACHE, JSON.stringify(all));
  console.log(`\r  shopify: ${all.length} pedidos (API→cache)`);
  return all;
}

async function loadMetaInsights(): Promise<any[]> {
  if (existsSync(META_CACHE)) {
    const r = JSON.parse(readFileSync(META_CACHE, "utf8"));
    console.log(`  meta: ${r.length} filas ad×día (cache)`);
    return r;
  }
  const V = process.env.META_API_VERSION ?? "v25.0";
  const acct = process.env.META_AD_ACCOUNT_ID!;
  const rows: any[] = [];
  let url: string | undefined = `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams({
    level: "ad", fields: "ad_id,ad_name,campaign_name,spend,actions", time_increment: "1",
    time_range: JSON.stringify({ since: FROM, until: today() }), limit: "500", access_token: process.env.META_ACCESS_TOKEN!,
  });
  while (url) {
    const b: any = await fetch(url).then((r) => r.json());
    if (b.error) throw new Error(JSON.stringify(b.error));
    for (const r of b.data ?? []) rows.push({
      date: r.date_start, ad_id: r.ad_id, ad_name: r.ad_name ?? "", campaign_name: r.campaign_name ?? "",
      spend: parseFloat(r.spend ?? "0"),
      purchases: (r.actions ?? []).filter((a: any) => PURCHASE.has(a.action_type)).reduce((s: number, a: any) => s + parseInt(a.value, 10), 0),
    });
    url = b.paging?.next;
  }
  writeFileSync(META_CACHE, JSON.stringify(rows));
  console.log(`  meta: ${rows.length} filas ad×día (API→cache)`);
  return rows;
}

// ---------- setup + ingesta ----------
export async function buildLocalDb(): Promise<{ client: PgClient; teardown: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), "biolabs-recon-"));
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 55443, persistent: false });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase("app");
  const client = pg.getPgClient("app") as unknown as PgClient;
  await (client as any).connect();
  const teardown = async () => { await client.end().catch(() => {}); await pg.stop().catch(() => {}); rmSync(dir, { recursive: true, force: true }); };

  try {
    console.log("→ migraciones 001–005");
    await client.query(BOOTSTRAP);
    for (const f of MIGRATIONS) await client.query(readFileSync(f, "utf8"));

    // índice local para que el estimate O(n²) de upsert_shipment_events no tarde una eternidad
    // (sin timeout local no rompe, pero acelera; NO cambia resultados — es sólo un índice).
    await client.query("create index if not exists ship_prov_idx on shipments(courier, province, freight_tarifa, dispatched_at)");

    // 1. Shopify → upsert_order
    const orders = await loadShopifyOrders();
    for (const o of orders) await client.query("select upsert_order($1::jsonb)", [JSON.stringify(o)]);
    console.log(`  upsert_order: ${orders.length}`);

    // 2. Urbano WS desde cache → upsert_shipment_events (parser real del pipeline).
    // Batches grandes: cada call termina con el estimate O(n) sobre toda la tabla urbano-sin-facturar;
    // menos calls = menos pasadas. Local, sin statement timeout. Idempotente por PK.
    const ids = orders.filter((o) => true).map((o) => String(o.id));
    let wsEvents: any[] = [], wsGuides = 0;
    const flush = async (buf: any[]) => { if (buf.length) await client.query("select upsert_shipment_events($1::jsonb)", [JSON.stringify(buf)]); };
    for (const id of ids) {
      const path = `${WS_CACHE}/${id}.html`;
      if (!existsSync(path)) continue;
      const evs = parseUrbanoResponse(readFileSync(path, "utf8"), id);
      if (evs.length) { wsEvents.push(...evs); wsGuides++; }
      if (wsEvents.length >= 3000) { await flush(wsEvents); wsEvents = []; }
    }
    await flush(wsEvents);
    console.log(`  urbano WS: ${wsGuides} guías con eventos`);

    // 3. Facturación Urbano → import_urbano_freight (pisa estimado, recompute interno del rango)
    const fwb = XLSX.read(readFileSync(FACT), { cellDates: true });
    const frows = XLSX.utils.sheet_to_json<Record<string, unknown>>(fwb.Sheets[fwb.SheetNames[0]], { range: 1, raw: true });
    const fp = frows.filter((r) => r.rec_numguia_cliente != null && r.tarifa != null)
      .map((r) => ({ tracking: String(r.rec_numguia_cliente), tarifa: Number(r.tarifa) }));
    const facUpd = (await client.query("select import_urbano_freight($1::jsonb) n", [JSON.stringify(fp)])).rows[0].n;
    console.log(`  facturación: ${fp.length} filas → ${facUpd} guías con flete real`);

    // 4. Fixy XLSX → upsert_shipment_events (parser real)
    const fixyEvents = parseFixyXlsx(readFileSync(FIXY));
    for (let i = 0; i < fixyEvents.length; i += 1500)
      await client.query("select upsert_shipment_events($1::jsonb)", [JSON.stringify(fixyEvents.slice(i, i + 1500))]);
    console.log(`  fixy: ${fixyEvents.length} eventos`);

    // 5. Meta → upsert_ad_spend
    const meta = await loadMetaInsights();
    for (let i = 0; i < meta.length; i += 500)
      await client.query("select upsert_ad_spend($1::jsonb)", [JSON.stringify(meta.slice(i, i + 500))]);
    console.log(`  meta ad_spend: ${meta.length} filas`);

    // 6. Override Ve-CBO→Veinguard (DML post-ingesta, pre-recompute). product_locked=true.
    const ov = await client.query(
      `update ad_spend set product_id = (select id from products where name='Veinguard'), product_locked = true
       where campaign_name = 'Ve - CBO'`);
    console.log(`  override Ve-CBO→Veinguard: ${(ov as any).rowCount ?? "?"} filas ad×día`);

    // pack=quantity, seed de costos y fallback de cohorte por fulfillment YA son nativos de 006
    // (upsert_order + upsert_shipment_events + seed) → nada de DMLs post-ingesta acá: local == prod.

    // recompute_daily_pnl(FROM, hoy) — final
    await client.query("select recompute_daily_pnl($1::date, $2::date)", [FROM, today()]);
    console.log("  recompute_daily_pnl ✓");

    return { client, teardown };
  } catch (e) {
    await teardown();
    throw e;
  }
}
