// Backfill histórico desde 2026-05-01 contra Supabase real (service role, RPCs).
// Uso: set -a; source .env.local; set +a; npx tsx scripts/backfill.mts
// Requiere 003/004/005 YA aplicadas en Supabase real (DDL, se aplica a mano en el dashboard).
// Orden: Shopify → Urbano WS → facturación → Fixy → Meta → recompute. Corre 2 pasadas + reporte PASO 4.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync } from "node:fs";
import { parseUrbanoResponse } from "../lib/couriers/urbano";
import { parseFixyXlsx } from "../lib/couriers/fixy";
import { shopifyFetch, SHOPIFY_API_VERSION } from "../lib/shopify";

const FROM = "2026-05-01";
const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const PURCHASE = new Set(["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const WS = (id: string) => `https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=4362&cli_codigo=${id}`;

async function counts() {
  const out: Record<string, number | null> = {};
  for (const t of ["orders", "order_items", "shipments", "shipment_events", "ad_spend", "daily_pnl"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true });
    out[t] = count;
  }
  return out;
}

// ---------- 1. Shopify (read_all_orders): upsert_order. Sin shipments de fulfillment (Opción A). ----------
async function ingestShopify() {
  let url: string | null =
    `https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${FROM}T00:00:00-03:00&limit=250`;
  let n = 0;
  while (url) {
    const res: Response = await shopifyFetch(url);
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const { orders } = await res.json();
    for (const o of orders ?? []) { await db.rpc("upsert_order", { p: o }); n++; }
    url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
  }
  return n;
}

// ---------- 2. Urbano WS: 1 llamada por shopify_id de pedido urbano, SIN filtro no-terminal/<60d. ----------
async function ingestUrbanoWS() {
  const ids: string[] = [];
  for (let p = 0; ; p++) {
    const { data } = await db.from("orders").select("shopify_id").eq("courier", "urbano")
      .gte("created_at", `${FROM}T00:00:00Z`).range(p * 1000, p * 1000 + 999);
    if (!data?.length) break;
    ids.push(...data.map((r) => String(r.shopify_id)));
    if (data.length < 1000) break;
  }
  let buf: unknown[] = []; let evCount = 0; const failed: string[] = [];
  const flush = async () => { if (buf.length) { const { data } = await db.rpc("upsert_shipment_events", { p: buf }); evCount += data ?? 0; buf = []; } };
  const fetchChunk = async (chunk: string[], sink: string[]) => {
    const res = await Promise.all(chunk.map((id) =>
      fetch(WS(id)).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
        .then((html) => parseUrbanoResponse(html, id))
        .catch(() => { sink.push(id); return null; })));
    for (const ev of res) if (ev) buf.push(...ev);
  };
  for (let i = 0; i < ids.length; i += 5) {           // concurrencia 5 + delay suave (§5.4)
    await fetchChunk(ids.slice(i, i + 5), failed);
    if (buf.length >= 400) await flush();
    if (i % 500 === 0) console.log(`    urbano WS ${i}/${ids.length} · fallidos ${failed.length}`);
    await sleep(150);
  }
  await flush();
  // reintento único de los fallidos (rate-limit / errores transitorios), no aborta el backfill
  const stillFailed: string[] = [];
  for (let i = 0; i < failed.length; i += 5) { await fetchChunk(failed.slice(i, i + 5), stillFailed); await sleep(250); }
  await flush();
  return { ids: ids.length, events: evCount, failed: stillFailed.length };
}

// ---------- 3. Facturación Urbano (tracking = rec_numguia_cliente = shopify_id). ----------
async function ingestFacturacion() {
  const wb = XLSX.read(readFileSync(FACT), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { range: 1, raw: true });
  const p = rows.filter((r) => r.rec_numguia_cliente != null && r.tarifa != null)
    .map((r) => ({ tracking: String(r.rec_numguia_cliente), tarifa: Number(r.tarifa) }));
  const { data } = await db.rpc("import_urbano_freight", { p });   // recalcula el rango afectado adentro
  return { rows: p.length, updated: data ?? 0 };
}

// ---------- 4. Fixy (XLSX → eventos, ejercita 004). ----------
async function ingestFixy() {
  const events = parseFixyXlsx(readFileSync(FIXY));
  let n = 0;
  for (let i = 0; i < events.length; i += 400) {
    const { data } = await db.rpc("upsert_shipment_events", { p: events.slice(i, i + 400) });
    n += data ?? 0;
  }
  return { events: events.length, inserted: n };
}

// ---------- 5. Meta Insights diario FROM→hoy → upsert_ad_spend. ----------
async function ingestMeta() {
  const V = process.env.META_API_VERSION ?? "v25.0";
  const acct = process.env.META_AD_ACCOUNT_ID!;
  const rows: unknown[] = [];
  let url: string | undefined = `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams({
    level: "ad", fields: "ad_id,ad_name,campaign_name,spend,actions", time_increment: "1",
    time_range: JSON.stringify({ since: FROM, until: today() }), limit: "500", access_token: process.env.META_ACCESS_TOKEN!,
  });
  while (url) {
    const b: { data?: { date_start: string; ad_id: string; ad_name?: string; campaign_name?: string; spend?: string; actions?: { action_type: string; value: string }[] }[]; paging?: { next?: string }; error?: unknown } = await fetch(url).then((r) => r.json());
    if (b.error) throw new Error(JSON.stringify(b.error));
    for (const r of b.data ?? []) rows.push({
      date: r.date_start, ad_id: r.ad_id, ad_name: r.ad_name ?? "", campaign_name: r.campaign_name ?? "",
      spend: parseFloat(r.spend ?? "0"),
      purchases: (r.actions ?? []).filter((a) => PURCHASE.has(a.action_type)).reduce((s, a) => s + parseInt(a.value, 10), 0),
    });
    url = b.paging?.next;
  }
  for (let i = 0; i < rows.length; i += 500) await db.rpc("upsert_ad_spend", { p: rows.slice(i, i + 500) });
  return { rows: rows.length };
}

async function runPass(n: number) {
  console.log(`\n===== PASADA ${n} =====`);
  console.log("  shopify orders:", await ingestShopify());
  console.log("  urbano WS:", await ingestUrbanoWS());
  console.log("  facturación:", await ingestFacturacion());
  console.log("  fixy:", await ingestFixy());
  console.log("  meta:", await ingestMeta());
  await db.rpc("recompute_daily_pnl", { p_from: FROM, p_to: today() });
  const c = await counts();
  console.log(`  counts tras pasada ${n}:`, c);
  return c;
}

// ---------- PASO 4: reporte de cierre ----------
async function monthly(table: string, col: string) {
  const out: Record<string, number | null> = {};
  for (const [m, lo, hi] of [["may", "2026-05-01", "2026-06-01"], ["jun", "2026-06-01", "2026-07-01"], ["jul+", "2026-07-01", "2027-01-01"]]) {
    const { count } = await db.from(table).select("*", { count: "exact", head: true }).gte(col, lo).lt(col, hi);
    out[m] = count;
  }
  return out;
}

async function report(c1: Record<string, number | null>, c2: Record<string, number | null>) {
  console.log("\n========== REPORTE PASO 4 ==========");
  console.log("Filas por mes:");
  console.log("  orders (created_at):", await monthly("orders", "created_at"));
  console.log("  shipments (dispatched_at):", await monthly("shipments", "dispatched_at"));
  console.log("  ad_spend (date):", await monthly("ad_spend", "date"));

  console.log("\nIdempotencia (pasada2 − pasada1, debe ser 0 en todas):");
  for (const k of Object.keys(c1)) console.log(`  ${k}: ${c1[k]} → ${c2[k]}  Δ=${(c2[k] ?? 0) - (c1[k] ?? 0)}`);

  const { count: sinClas } = await db.from("v_sin_clasificar").select("*", { count: "exact", head: true });
  const { data: sinPorMotivo } = await db.from("v_sin_clasificar").select("courier, motivo");
  const motivos = (sinPorMotivo ?? []).reduce((a: Record<string, number>, r) => { const k = `${r.courier}/${r.motivo}`; a[k] = (a[k] ?? 0) + 1; return a; }, {});
  console.log("\nv_sin_clasificar:", sinClas, motivos);

  const { data: sinMapear } = await db.from("v_estados_sin_mapear").select("courier, status_raw");
  console.log("Estados sin mapear:", sinMapear?.length ? sinMapear : "(ninguno)");

  // ad_spend grano: filas y días distintos en mayo
  const { count: adsMay } = await db.from("ad_spend").select("*", { count: "exact", head: true }).gte("date", "2026-05-01").lt("date", "2026-06-01");
  const { data: adsDates } = await db.from("ad_spend").select("date").gte("date", "2026-05-01").lt("date", "2026-06-01");
  console.log(`\nad_spend mayo: ${adsMay} filas, ${new Set((adsDates ?? []).map((r) => r.date)).size} días distintos (API diaria)`);

  // gap de upsert_order: guías urbano huérfanas cuyo shopify_id SÍ existe en orders
  const { data: orphans } = await db.from("shipments").select("tracking").eq("courier", "urbano").is("order_id", null);
  let gap = 0;
  for (const o of orphans ?? []) {
    if (/^\d{10,}$/.test(o.tracking)) {
      const { count } = await db.from("orders").select("*", { count: "exact", head: true }).eq("shopify_id", o.tracking);
      if (count) gap++;
    }
  }
  console.log(`Gap upsert_order (urbano huérfana con shopify_id existente en orders): ${gap}  ${gap ? "⚠️ REVISAR" : "✓ 0"}`);
  console.log("\n⛔ FRENO acá — NO corro reconcile_may (esperando tu OK).");
}

// ---------- main ----------
try {
  console.log("counts iniciales:", await counts());
  const c1 = await runPass(1);
  const c2 = await runPass(2);
  await report(c1, c2);
} catch (e) {
  console.error("❌ backfill falló:", (e as Error).message);
  process.exitCode = 1;
}
