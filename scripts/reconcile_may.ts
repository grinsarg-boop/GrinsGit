// RECONCILIACIÓN de mayo 2026: P&L de la app (pipeline real, Postgres local) vs baseline
// independiente (PASO 0). Tolerancia 1% por línea. FRENA con la tabla completa — no aplica fixes en prod.
// Incluye: reporte Rule-2 de packs entregados, patrón de las urbano sin ciclo, clasificación de las
// Fixy fuera de scope BioLabs (con probe teléfono+fecha), y COD de estados RV/NC/RD.
//
// Uso: set -a; source .env.local; set +a; npx tsx scripts/reconcile_may.ts
import { buildLocalDb } from "./local_pipeline.mts";
import { computeBaselineMay } from "./baseline_may.mts";
import { PRODUCT_COSTS, hasCost } from "./product_costs_may.ts";
import * as XLSX from "xlsx";
import { readFileSync, existsSync } from "node:fs";

const M0 = "2026-05-01", M1 = "2026-05-31";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const SHOP_CACHE = "datos/shopify_orders_2026-03-01.json";
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const TOL = 0.01;

async function one(client: any, sql: string, params: unknown[] = []) { return (await client.query(sql, params)).rows[0]; }
async function all(client: any, sql: string, params: unknown[] = []) { return (await client.query(sql, params)).rows; }

function row(metric: string, app: number, base: number) {
  const diff = app - base, pct = base !== 0 ? diff / base : (app === 0 ? 0 : Infinity);
  return { metric, app, base, diff, pct, flag: Math.abs(pct) <= TOL ? "✓" : "✗" };
}
function printTable(rows: ReturnType<typeof row>[]) {
  const p = (s: string, n: number) => s.padStart(n);
  console.log("  " + "métrica".padEnd(20) + p("app", 16) + p("baseline", 16) + p("diff $", 14) + p("diff %", 10));
  console.log("  " + "-".repeat(76));
  for (const r of rows)
    console.log("  " + r.metric.padEnd(20) + p(money(r.app), 16) + p(money(r.base), 16) + p(money(r.diff), 14) + p((r.pct * 100).toFixed(2) + "%", 9) + " " + r.flag);
}

const main = async () => {
  console.log("===== SETUP (pipeline real en Postgres local) =====");
  const { client, teardown } = await buildLocalDb();
  try {
    // ---------- INTEGRIDAD ----------
    console.log("\n===== INTEGRIDAD =====");
    const urb = await one(client, `select sum(despachadas) d, sum(entregadas) e from daily_pnl where dispatch_date between $1 and $2 and courier='urbano'`, [M0, M1]);
    const tasaUrb = Number(urb.e) / Number(urb.d);
    console.log(`Tasa entrega Urbano mayo: ${(tasaUrb * 100).toFixed(1)}%  (desp ${urb.d}, ent ${urb.e})  ${tasaUrb >= 0.35 && tasaUrb <= 0.47 ? "✓ ~41%" : "⚠️ REVISAR"}`);
    const fix = await one(client, `select sum(despachadas) d, sum(entregadas) e from daily_pnl where dispatch_date between $1 and $2 and courier='fixy'`, [M0, M1]);
    console.log(`Tasa entrega Fixy mayo:   ${(Number(fix.e) / Number(fix.d) * 100).toFixed(1)}%  (desp ${fix.d}, ent ${fix.e})`);
    const sinClas = await all(client, "select courier, motivo, count(*) c from v_sin_clasificar group by courier, motivo order by c desc");
    console.log("v_sin_clasificar:", sinClas.map((r) => `${r.courier}/${r.motivo}:${r.c}`).join("  ") || "(vacío)");
    const sinMap = await all(client, "select courier, status_raw from v_estados_sin_mapear");
    console.log("Estados sin mapear:", sinMap.map((r) => `${r.courier}:${r.status_raw}`).join("  ") || "(ninguno) ✓");
    const gap = await one(client, `select count(*) c from shipments s where s.courier='urbano' and s.order_id is null and s.tracking ~ '^\\d{10,}$' and exists (select 1 from orders o where o.shopify_id = s.tracking::bigint)`);
    console.log(`Gap upsert_order: ${gap.c}  ${Number(gap.c) === 0 ? "✓" : "⚠️"}`);

    // ---------- Rule 2: packs entregados de mayo por producto·pack (pack = quantity) ----------
    console.log("\n===== UNIDADES ENTREGADAS MAYO por producto·pack (pack = quantity) — Rule 2 =====");
    const packs = await all(client, `
      select pr.name product, oi.pack, count(*)::int lineas, sum(oi.pack)::int unidades
      from shipments s join orders o on o.id=s.order_id
      join order_items oi on oi.order_id=o.id join products pr on pr.id=oi.product_id
      where s.dispatched_at between $1 and $2 and s.status_canonical in ('entregado','siniestro') and oi.product_id is not null
      group by pr.name, oi.pack order by pr.name, oi.pack`, [M0, M1]);
    let cur = ""; const frozenApp: string[] = [];
    for (const r of packs) {
      if (r.product !== cur) { cur = r.product; console.log(`  -- ${cur} --`); }
      const ok = hasCost(r.product, r.pack);
      if (!ok) frozenApp.push(`${r.product} x${r.pack}·${r.lineas}`);
      console.log(`    x${r.pack}  líneas=${String(r.lineas).padStart(4)} unidades=${String(r.unidades).padStart(4)}  ${ok ? "costo " + PRODUCT_COSTS[r.product][r.pack] : "‼️ SIN COSTO — FRENADO"}`);
    }
    console.log("  Packs FRENADOS (sin costo, se piden a Pancho):", frozenApp.join("  ") || "(ninguno)");

    // ---------- P&L app mayo ----------
    const pnl = await one(client, `select coalesce(sum(revenue_confirmado),0) rev, coalesce(sum(senas_netas),0) senas,
        coalesce(sum(flete),0) flete, coalesce(sum(comisiones),0) comis, coalesce(sum(costo_producto),0) costo,
        coalesce(sum(ads),0) ads, coalesce(sum(profit_confirmado),0) profit from daily_pnl where dispatch_date between $1 and $2`, [M0, M1]);
    const appCod = Number(pnl.rev) - Number(pnl.senas);
    const pC = async (courier: string) => one(client, `select coalesce(sum(revenue_confirmado-senas_netas),0) cod, coalesce(sum(flete),0) flete,
        coalesce(sum(comisiones),0) comis, coalesce(sum(costo_producto),0) costo, coalesce(sum(despachadas),0) desp from daily_pnl
        where dispatch_date between $1 and $2 and courier=$3`, [M0, M1, courier]);
    const pnlU = await pC("urbano"), pnlF = await pC("fixy");
    const adsMapped = await one(client, `select coalesce(sum(spend),0) s from ad_spend where date between $1 and $2 and product_id is not null`, [M0, M1]);
    const adsSinCohorte = await one(client, `select coalesce(sum(spend),0) s from v_ads_sin_cohorte where date between $1 and $2`, [M0, M1]);

    // ---------- baseline ----------
    console.log("\n===== BASELINE (PASO 0) =====");
    const b = await computeBaselineMay();
    console.log(`  URBANO desp ${b.urbano.despachadas} (fulfillment ${b.urbano.viaFulfillment}) ent ${b.urbano.entregadas} tasa ${(b.urbano.tasa * 100).toFixed(1)}% sinFact ${b.urbano.sinFactur}`);
    console.log(`  FIXY   desp ${b.fixy.despachadas} ent ${b.fixy.entregadas} tasa ${(b.fixy.tasa * 100).toFixed(1)}% · excluidas no-BioLabs ${b.fixy.excluidasNoBio}`);
    console.log(`  costo urbano ${money(b.urbano.costo)} · costo fixy ${money(b.fixy.costo)} · packs frenados baseline:`, Object.keys(b.frozen).length ? b.frozen : "(ninguno)");
    if (b.pautaCheck) console.log(`  Pauta: account ${money(b.pautaCheck.accountTotal)} − Nubba ${money(b.pautaCheck.nubba)} = ${money(b.pautaCheck.path_minus_nubba)} vs ref ${money(19306283)} (diff ${money(b.pautaCheck.path_minus_nubba - 19306283)})`);

    // ---------- RECONCILIACIÓN ----------
    console.log("\n===== RECONCILIACIÓN MAYO — app vs baseline (tol 1%) =====\n URBANO");
    printTable([row("COD entregado", Number(pnlU.cod), b.urbano.cod), row("Flete", Number(pnlU.flete), b.urbano.flete),
      row("Comisión", Number(pnlU.comis), b.urbano.comision), row("Costo producto", Number(pnlU.costo), b.urbano.costo)]);
    console.log("\n FIXY");
    printTable([row("COD entregado", Number(pnlF.cod), b.fixy.cod), row("Flete", Number(pnlF.flete), b.fixy.flete),
      row("Comisión", Number(pnlF.comis), b.fixy.comision), row("Costo producto", Number(pnlF.costo), b.fixy.costo)]);
    console.log("\n TOTAL");
    const netoApp = appCod - Number(pnl.flete) - Number(pnl.comis) - Number(pnl.costo) - Number(adsMapped.s);
    const totalRows = [row("COD entregado", appCod, b.total.cod), row("Flete", Number(pnl.flete), b.total.flete),
      row("Comisión", Number(pnl.comis), b.total.comision), row("Costo producto", Number(pnl.costo), b.total.costo),
      row("Pauta (BioLabs)", Number(adsMapped.s), b.total.pauta), row("Neto", netoApp, b.total.neto)];
    printTable(totalRows);
    console.log(`\n Convergencia despachadas: urbano app ${urb.d} / base ${b.urbano.despachadas}  ·  fixy app ${fix.d} / base ${b.fixy.despachadas}`);
    console.log(` Señas mayo (informativo): ${money(Number(pnl.senas))} · v_ads_sin_cohorte mayo: ${money(Number(adsSinCohorte.s))}`);
    console.log(` Neto = margen real (con COGS). Nota: ${frozenApp.length} packs frenados quedan SIN costo (Neto ligeramente sobreestimado hasta que Pancho los pase).`);

    // ---------- INVESTIGACIÓN 1: patrón de las urbano sin ciclo ----------
    console.log("\n===== INVESTIGACIÓN — urbano mayo SIN ciclo (fechadas por fulfillment) =====");
    const nc = await one(client, `select count(*) c from shipments s where s.courier='urbano' and s.dispatched_at between $1 and $2
      and not exists (select 1 from shipment_events e where e.shipment_id=s.id and e.status_canonical='despachado')`, [M0, M1]);
    console.log(`  total sin ciclo en mayo: ${nc.c}`);
    const ncCodes = await all(client, `select se.status_raw, count(distinct s.id)::int c from shipments s
      join shipment_events se on se.shipment_id=s.id
      where s.courier='urbano' and s.dispatched_at between $1 and $2
        and not exists (select 1 from shipment_events e where e.shipment_id=s.id and e.status_canonical='despachado')
      group by se.status_raw order by c desc`, [M0, M1]);
    console.log("  códigos de estado que traen (WS sin evento de ciclo):", ncCodes.map((r) => `${r.status_raw}:${r.c}`).join("  "));
    const ncEv = await all(client, `select n, count(*)::int guias from (
      select s.id, count(*) n from shipments s join shipment_events se on se.shipment_id=s.id
      where s.courier='urbano' and s.dispatched_at between $1 and $2
        and not exists (select 1 from shipment_events e where e.shipment_id=s.id and e.status_canonical='despachado')
      group by s.id) x group by n order by n`, [M0, M1]);
    console.log("  distribución de #eventos por guía:", ncEv.map((r) => `${r.n}ev:${r.guias}`).join("  "));

    // ---------- INVESTIGACIÓN 2: clasificación de las Fixy fuera de scope BioLabs ----------
    console.log("\n===== INVESTIGACIÓN — Fixy de mayo fuera del P&L BioLabs =====");
    await classifyFixy(client);

    // ---------- INVESTIGACIÓN 3: COD de RV/NC/RD del cohorte de mayo ----------
    console.log("\n===== INVESTIGACIÓN — estados RV/NC/RD (fuera del mapa de 23) =====");
    const rv = await one(client, `select count(distinct s.id)::int guias, coalesce(sum(o.cod_amount) filter (where s.status_canonical<>'cancelado'),0) cod
      from shipments s join orders o on o.id=s.order_id
      where s.courier='urbano' and s.dispatched_at between $1 and $2 and s.status_raw in ('RV','NC','RD')`, [M0, M1]);
    console.log(`  guías cohorte mayo en RV/NC/RD (status actual): ${rv.guias} · COD potencial ${money(Number(rv.cod))} ${Number(rv.cod) > 500000 ? "⚠️ material → escalar" : "→ inmaterial, quedan en incidencia"}`);

    const fails = totalRows.filter((r) => r.flag === "✗");
    console.log(`\nLíneas fuera de tolerancia 1%: ${fails.length ? fails.map((r) => `${r.metric} (${(r.pct * 100).toFixed(2)}%)`).join(", ") : "ninguna ✓"}`);
    console.log("\n⛔ FRENO — reconciliación calculada. Lo que sigue es la tarea 006 (prod). Esperando tu OK.");
  } finally { await teardown(); }
};

// Clasifica las Fixy de mayo que NO entran al P&L BioLabs: (a) otro canal, (b) recuperable por
// teléfono+fecha, (c) huérfana. Lee XLSX + cache de Shopify (probe local, sin pegar a la API).
async function classifyFixy(client: any) {
  if (!existsSync(SHOP_CACHE)) { console.log("  (sin cache Shopify)"); return; }
  const orders = JSON.parse(readFileSync(SHOP_CACHE, "utf8"));
  const byNumber = new Map<string, any>(); const nums: number[] = [];
  const phoneIndex: { phone: string; created: string }[] = [];
  for (const o of orders) {
    const num = String(o.name ?? "").replace("#", "");
    if (/^\d+$/.test(num)) { byNumber.set(num, o); nums.push(+num); }
    const ph = (o.shipping_address?.phone ?? o.phone ?? "").replace(/\D/g, "");
    if (ph) phoneIndex.push({ phone: ph, created: (o.created_at ?? "").slice(0, 10) });
  }
  const minN = Math.min(...nums), maxN = Math.max(...nums);
  const KW = ["nature", "pureza", "vein", "bee", "altus"];
  const isBio = (o: any) => (o.line_items ?? []).some((li: any) => { const t = (li.title ?? "").toLowerCase(); return KW.some((k) => t.includes(k)); });

  const wb = XLSX.read(readFileSync(FIXY), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, any>>(wb.Sheets[wb.SheetNames[0]], { raw: true });
  const isMay = (v: any) => { const d = v instanceof Date ? v : new Date(String(v)); return d.getUTCFullYear() === 2026 && d.getUTCMonth() === 4; };
  const buckets: Record<string, string[]> = { gadget: [], otroCanal: [], telFecha: [], huerfana: [] };
  for (const r of rows) {
    if (!isMay(r["Fecha"])) continue;
    const remito = String(r["Remito"] ?? "").trim();
    const o = remito ? byNumber.get(remito) : undefined;
    if (o && isBio(o)) continue; // entra al P&L, no es un caso a clasificar
    const info = `guía ${r["Nro Guia"]} remito=${remito || "∅"} ${String(r["Estado"] ?? "").split("-")[0]} imp=${r["Importe"]} cod=${r["Contrareembolso"]} tel=${r["COM.CELULAR"] ?? ""}`;
    if (o && !isBio(o)) { buckets.gadget.push(info + `  titles=«${(o.line_items ?? []).map((li: any) => li.title).join(" | ").slice(0, 50)}»`); continue; }
    // sin pedido: ¿remito fuera del rango de order_numbers Shopify → otro canal?
    const rn = /^\d+$/.test(remito) ? +remito : null;
    if (!remito || rn === null || rn < minN || rn > maxN) { buckets.otroCanal.push(info + `  (remito ∅/fuera de rango ${minN}-${maxN} → otro canal)`); continue; }
    // remito parece Shopify pero no matchea → probe teléfono+fecha sobre el cache
    const ph = String(r["COM.CELULAR"] ?? "").replace(/\D/g, "").slice(-8);
    const fecha = (r["Fecha"] instanceof Date ? r["Fecha"] : new Date(String(r["Fecha"]))).toISOString().slice(0, 10);
    const hit = ph && phoneIndex.some((p) => p.phone.endsWith(ph) && p.created <= fecha && p.created >= new Date(new Date(fecha).getTime() - 20 * 864e5).toISOString().slice(0, 10));
    (hit ? buckets.telFecha : buckets.huerfana).push(info + (hit ? "  (teléfono+fecha SÍ encuentra pedido)" : "  (ni teléfono+fecha)"));
  }
  for (const [k, arr] of Object.entries(buckets)) {
    const label = { gadget: "OTRO PRODUCTO / gadget (exclusión correcta)", otroCanal: "OTRO CANAL — remito ∅/fuera de rango (ML/manual, exclusión correcta)", telFecha: "RECUPERABLE por teléfono+fecha", huerfana: "HUÉRFANA genuina" }[k];
    console.log(`  [${arr.length}] ${label}`);
    for (const l of arr) console.log(`      ${l}`);
  }
}

main().catch((e) => { console.error("❌ reconcile falló:", e); process.exitCode = 1; });
