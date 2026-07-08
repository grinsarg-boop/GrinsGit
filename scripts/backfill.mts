// Backfill histórico contra Supabase real (service role, RPCs). Re-run limpio de la tarea 006.
// Uso: set -a; source .env.local; set +a; npx tsx scripts/backfill.mts
// Requiere 001–006 YA aplicadas en Supabase real (DDL, se aplica a mano en el SQL Editor).
// Flujo (validado local): TRUNCATE (confirma 0) → Shopify(desde marzo) → Urbano WS(cache) →
// facturación → Fixy → Meta → override Ve-CBO→Veinguard → recompute. 2 pasadas + reporte PASO 4.
import { createClient } from "@supabase/supabase-js";
import * as XLSX from "xlsx";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { parseUrbanoResponse } from "../lib/couriers/urbano";
import { parseFixyXlsx } from "../lib/couriers/fixy";
import { shopifyFetch, SHOPIFY_API_VERSION } from "../lib/shopify";

const FROM = "2026-05-01";                 // Meta / recompute (P&L arranca en mayo)
const SHOP_FROM = "2026-03-01";            // Shopify: pedidos pre-mayo DESPACHADOS en mayo también entran
const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const PURCHASE = new Set(["purchase", "omni_purchase", "offsite_conversion.fb_pixel_purchase"]);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const today = () => new Date().toISOString().slice(0, 10);
const WS = (id: string) => `https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=4362&cli_codigo=${id}`;

// rpc con chequeo de error + reintento: un error transitorio de Supabase NO puede perder datos
// en silencio (fue la causa del fallo de idempotencia: batches perdidos en la pasada larga).
async function rpc(fn: string, args: object) {
  for (let a = 0; a < 5; a++) {
    const { data, error } = await db.rpc(fn, args);
    if (!error) return data;
    console.log(`    ⚠ rpc ${fn} error (intento ${a + 1}): ${error.message.slice(0, 90)}`);
    await sleep(1000 * 2 ** a);
  }
  throw new Error(`rpc ${fn} falló tras 5 intentos`);
}

async function counts() {
  const out: Record<string, number | null> = {};
  for (const t of ["orders", "order_items", "shipments", "shipment_events", "ad_spend", "daily_pnl"]) {
    const { count } = await db.from(t).select("*", { count: "exact", head: true });
    out[t] = count;
  }
  return out;
}

// ---------- 0. Limpieza de las tablas de datos (re-run limpio). Delete en orden FK por service
// role (bypassa RLS; PostgREST no permite TRUNCATE). Confirma conteos en 0 ANTES de ingestar. ----------
async function wipe() {
  // (tabla, columna para el filtro "todo"). Orden FK: hijas antes que padres.
  const plan: [string, string, string][] = [
    ["daily_pnl", "dispatch_date", "1900-01-01"],
    ["shipment_events", "id", "0"],
    ["shipments", "id", "0"],
    ["order_items", "id", "0"],
    ["orders", "id", "0"],
    ["ad_spend", "date", "1900-01-01"],
  ];
  for (const [t, col, lo] of plan) {
    const { error } = await db.from(t).delete().gte(col, lo);
    if (error) throw new Error(`wipe ${t}: ${error.message}`);
  }
  const c = await counts();
  const notZero = Object.entries(c).filter(([, n]) => (n ?? 0) !== 0);
  console.log("  conteos tras wipe:", c);
  if (notZero.length) throw new Error(`wipe incompleto, no quedaron en 0: ${notZero.map(([k]) => k).join(", ")}`);
  console.log("  ✓ todas las tablas en 0 — listo para ingestar");
}

// ---------- 1. Shopify (read_all_orders): upsert_order. Sin shipments de fulfillment (Opción A). ----------
async function ingestShopify() {
  let url: string | null =
    `https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&created_at_min=${SHOP_FROM}T00:00:00-03:00&limit=250`;
  let n = 0;
  while (url) {
    const res: Response = await shopifyFetch(url);
    if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
    const { orders } = await res.json();
    for (const o of orders ?? []) { await rpc("upsert_order", { p: o }); n++; }
    url = /<([^>]+)>;\s*rel="next"/.exec(res.headers.get("link") ?? "")?.[1] ?? null;
  }
  return n;
}

// ---------- 2. Urbano WS: 1 llamada por shopify_id de pedido urbano, SIN filtro no-terminal/<60d.
// El WS limita a ~5 req/s: SECUENCIAL (concurrencia 1) + backoff en 429. Cachea cada response a
// disco → la 2ª pasada y los reintentos leen del cache (no re-pega 6352 veces) y es resumible. ----------
const WS_CACHE = "datos/urbano_ws_cache";
async function fetchWSCached(id: string): Promise<{ html: string | null; cached: boolean }> {
  const path = `${WS_CACHE}/${id}.html`;
  if (existsSync(path)) return { html: readFileSync(path, "utf8"), cached: true };
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = await fetch(WS(id));
      if (r.status === 429) { await sleep(500 * 2 ** attempt); continue; }  // backoff exponencial
      if (!r.ok) return { html: null, cached: false };
      const html = await r.text();
      writeFileSync(path, html);
      return { html, cached: false };
    } catch { await sleep(500 * 2 ** attempt); }
  }
  return { html: null, cached: false };  // agotó reintentos (rate-limit persistente)
}

async function ingestUrbanoWS() {
  mkdirSync(WS_CACHE, { recursive: true });
  const ids: string[] = [];
  for (let p = 0; ; p++) {
    const { data } = await db.from("orders").select("shopify_id").eq("courier", "urbano")
      .gte("created_at", `${FROM}T00:00:00Z`)
      .order("shopify_id", { ascending: true }).range(p * 1000, p * 1000 + 999);  // orden estable → cache sirve
    if (!data?.length) break;
    ids.push(...data.map((r) => String(r.shopify_id)));
    if (data.length < 1000) break;
  }
  let buf: unknown[] = []; let evCount = 0; let hits = 0; const failed: string[] = [];
  const flush = async () => {
    if (!buf.length) return;
    const batch = buf; buf = [];
    evCount += (await rpc("upsert_shipment_events", { p: batch })) ?? 0;
  };
  // Secuencial (WS ya cacheado = lectura instantánea, la concurrencia solo servía para el rate-limit).
  // Batches de 150 → cada upsert_shipment_events corre solo y bajo el statement timeout de Supabase.
  for (let i = 0; i < ids.length; i++) {
    const { html, cached } = await fetchWSCached(ids[i]);
    if (html === null) failed.push(ids[i]);
    else { buf.push(...parseUrbanoResponse(html, ids[i])); if (cached) hits++; }
    if (buf.length >= 150) await flush();
    if (i % 500 === 0) console.log(`    urbano WS ${i}/${ids.length} · fallidos ${failed.length} · cache ${hits}`);
    if (!cached) await sleep(100);            // delay solo tras fetch real
  }
  await flush();
  // retry de fallidos (fetch fresco que falló) — secuencial, alta tasa de éxito
  for (let round = 0; round < 3 && failed.length; round++) {
    const retry = failed.splice(0);
    console.log(`    retry ${retry.length} fallidos (ronda ${round + 1})`);
    for (const id of retry) {
      const { html } = await fetchWSCached(id);
      if (html === null) failed.push(id);
      else buf.push(...parseUrbanoResponse(html, id));
      if (buf.length >= 150) await flush();
      await sleep(200);
    }
  }
  await flush();
  return { ids: ids.length, events: evCount, cacheHits: hits, failed: failed.length };
}

// ---------- 3. Facturación Urbano (tracking = rec_numguia_cliente = shopify_id). ----------
async function ingestFacturacion() {
  const wb = XLSX.read(readFileSync(FACT), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { range: 1, raw: true });
  const p = rows.filter((r) => r.rec_numguia_cliente != null && r.tarifa != null)
    .map((r) => ({ tracking: String(r.rec_numguia_cliente), tarifa: Number(r.tarifa) }));
  const updated = await rpc("import_urbano_freight", { p });   // recalcula el rango afectado adentro
  return { rows: p.length, updated: updated ?? 0 };
}

// ---------- 4. Fixy (XLSX → eventos, ejercita 004). ----------
async function ingestFixy() {
  const events = parseFixyXlsx(readFileSync(FIXY));
  let n = 0;
  for (let i = 0; i < events.length; i += 150) {
    n += (await rpc("upsert_shipment_events", { p: events.slice(i, i + 150) })) ?? 0;
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
  for (let i = 0; i < rows.length; i += 500) await rpc("upsert_ad_spend", { p: rows.slice(i, i + 500) });
  return { rows: rows.length };
}

// ---------- 6. Override Ve-CBO→Veinguard (DML post-ingesta, pre-recompute). product_locked=true →
// el sync incremental no lo pisa. "Ve - CBO" no matchea keyword ("vein") → sin esto cae en gadget. ----------
async function overrideVeCbo() {
  const { data: prod } = await db.from("products").select("id").eq("name", "Veinguard").single();
  const { data, error } = await db.from("ad_spend").update({ product_id: prod!.id, product_locked: true })
    .eq("campaign_name", "Ve - CBO").select("ad_id");
  if (error) throw new Error(`override Ve-CBO: ${error.message}`);
  return data?.length ?? 0;
}

async function runPass(n: number) {
  console.log(`\n===== PASADA ${n} =====`);
  console.log("  shopify orders:", await ingestShopify());
  console.log("  urbano WS:", await ingestUrbanoWS());
  console.log("  facturación:", await ingestFacturacion());
  console.log("  fixy:", await ingestFixy());
  console.log("  meta:", await ingestMeta());
  console.log("  override Ve-CBO→Veinguard:", await overrideVeCbo(), "filas");
  await rpc("recompute_daily_pnl", { p_from: FROM, p_to: today() });
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
// Guardas: exige 006 aplicada (pack=quantity) y el flag --wipe explícito para el DELETE destructivo.
try {
  console.log("counts iniciales:", await counts());

  // gate 006: product_costs lo seedea 006c (persiste al wipe). Vacío → 006 no aplicada.
  const { count: pcCount } = await db.from("product_costs").select("*", { count: "exact", head: true });
  if (!pcCount) throw new Error("product_costs vacío → 006 NO está aplicada en prod. Aplicala primero (SQL Editor).");
  console.log(`  gate 006: product_costs tiene ${pcCount} filas ✓`);

  if (!process.argv.includes("--wipe")) {
    console.log("\n⚠️  Falta --wipe. El backfill limpia (DELETE) orders/shipments/… de PROD antes de ingestar.");
    console.log("    Corré con: npx tsx scripts/backfill.mts --wipe   (006 ya aplicada).");
    process.exit(0);
  }
  console.log("\n===== WIPE (limpieza de prod) =====");
  await wipe();

  const c1 = await runPass(1);
  const c2 = await runPass(2);
  await report(c1, c2);
} catch (e) {
  console.error("❌ backfill falló:", (e as Error).message);
  process.exitCode = 1;
}
