// RECONCILIACIÓN de mayo 2026: P&L de la app (pipeline real, Postgres local) vs baseline
// independiente (PASO 0). Tolerancia 1% por línea. FRENA con la tabla completa — no aplica fixes.
//
// Uso: set -a; source .env.local; set +a; npx tsx scripts/reconcile_may.ts
import { buildLocalDb } from "./local_pipeline.mts";
import { computeBaselineMay } from "./baseline_may.mts";

const M0 = "2026-05-01", M1 = "2026-05-31";       // rango de despacho de mayo (inclusive)
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const TOL = 0.01;

async function one(client: any, sql: string, params: unknown[] = []) { return (await client.query(sql, params)).rows[0]; }
async function all(client: any, sql: string, params: unknown[] = []) { return (await client.query(sql, params)).rows; }

function row(metric: string, app: number, base: number) {
  const diff = app - base;
  const pct = base !== 0 ? diff / base : (app === 0 ? 0 : Infinity);
  const flag = Math.abs(pct) <= TOL ? "✓" : "✗";
  return { metric, app, base, diff, pct, flag };
}
function printTable(rows: ReturnType<typeof row>[]) {
  const pad = (s: string, n: number) => s.padStart(n);
  console.log("  " + "métrica".padEnd(22) + pad("app", 16) + pad("baseline", 16) + pad("diff $", 15) + pad("diff %", 10) + "  ");
  console.log("  " + "-".repeat(81));
  for (const r of rows) {
    console.log("  " + r.metric.padEnd(22) + pad(money(r.app), 16) + pad(money(r.base), 16) +
      pad(money(r.diff), 15) + pad((r.pct * 100).toFixed(2) + "%", 9) + " " + r.flag);
  }
}

const main = async () => {
  console.log("===== SETUP (pipeline real en Postgres local) =====");
  const { client, teardown } = await buildLocalDb();
  try {
    // ---------- INTEGRIDAD ----------
    console.log("\n===== INTEGRIDAD =====");
    const months = [["may", "2026-05-01", "2026-06-01"], ["jun", "2026-06-01", "2026-07-01"], ["jul+", "2026-07-01", "2027-01-01"]];
    const filasPorMes = async (table: string, col: string) => {
      const out: Record<string, number> = {};
      for (const [m, lo, hi] of months)
        out[m] = Number((await one(client, `select count(*) c from ${table} where ${col} >= $1 and ${col} < $2`, [lo, hi])).c);
      return out;
    };
    console.log("Filas por mes:");
    console.log("  orders (created_at):    ", await filasPorMes("orders", "created_at"));
    console.log("  shipments (dispatched): ", await filasPorMes("shipments", "dispatched_at"));
    console.log("  shipment_events (occ.): ", await filasPorMes("shipment_events", "occurred_at"));
    console.log("  ad_spend (date):        ", await filasPorMes("ad_spend", "date"));
    console.log("  daily_pnl (dispatch):   ", await filasPorMes("daily_pnl", "dispatch_date"));
    const totShip = await one(client, "select count(*) c from shipments");
    const totOrders = await one(client, "select count(*) c from orders");
    console.log(`  totales: orders ${totOrders.c} · shipments ${totShip.c}`);

    // Tasa de entrega Urbano mayo (~41% esperado)
    const urb = await one(client, `select sum(despachadas) d, sum(entregadas) e from daily_pnl
      where dispatch_date between $1 and $2 and courier='urbano'`, [M0, M1]);
    const tasaUrb = Number(urb.e) / Number(urb.d);
    console.log(`\nTasa entrega Urbano mayo: ${(tasaUrb * 100).toFixed(1)}%  (despachadas ${urb.d}, entregadas ${urb.e})  ${tasaUrb >= 0.35 && tasaUrb <= 0.47 ? "✓ ~41%" : "⚠️ fuera de rango — REVISAR mapeo/link"}`);
    const fix = await one(client, `select sum(despachadas) d, sum(entregadas) e from daily_pnl
      where dispatch_date between $1 and $2 and courier='fixy'`, [M0, M1]);
    console.log(`Tasa entrega Fixy mayo:   ${(Number(fix.e) / Number(fix.d) * 100).toFixed(1)}%  (despachadas ${fix.d}, entregadas ${fix.e})`);

    // v_sin_clasificar por motivo + estados sin mapear
    const sinClas = await all(client, "select courier, motivo, count(*) c from v_sin_clasificar group by courier, motivo order by c desc");
    console.log("\nv_sin_clasificar:", sinClas.length ? sinClas.map((r) => `${r.courier}/${r.motivo}:${r.c}`).join("  ") : "(vacío)");
    const sinMap = await all(client, "select courier, status_raw from v_estados_sin_mapear");
    console.log("Estados sin mapear:", sinMap.length ? sinMap.map((r) => `${r.courier}:${r.status_raw}`).join("  ") : "(ninguno) ✓");

    // Gap upsert_order: urbano huérfana cuyo shopify_id existe en orders (esperado 0)
    const gap = await one(client, `select count(*) c from shipments s where s.courier='urbano' and s.order_id is null
      and s.tracking ~ '^\\d{10,}$' and exists (select 1 from orders o where o.shopify_id = s.tracking::bigint)`);
    console.log(`Gap upsert_order (urbano huérfana con shopify_id en orders): ${gap.c}  ${Number(gap.c) === 0 ? "✓" : "⚠️ REVISAR"}`);

    // ---------- P&L app mayo ----------
    const pnl = await one(client, `select
        coalesce(sum(revenue_confirmado),0) rev, coalesce(sum(senas_netas),0) senas,
        coalesce(sum(flete),0) flete, coalesce(sum(comisiones),0) comis,
        coalesce(sum(costo_producto),0) costo, coalesce(sum(ads),0) ads,
        coalesce(sum(profit_confirmado),0) profit
      from daily_pnl where dispatch_date between $1 and $2`, [M0, M1]);
    const appCod = Number(pnl.rev) - Number(pnl.senas);   // COD entregado = rev_confirmado − señas
    const pnlU = await one(client, `select coalesce(sum(revenue_confirmado-senas_netas),0) cod, coalesce(sum(flete),0) flete,
        coalesce(sum(comisiones),0) comis, coalesce(sum(costo_producto),0) costo from daily_pnl
        where dispatch_date between $1 and $2 and courier='urbano'`, [M0, M1]);
    const pnlF = await one(client, `select coalesce(sum(revenue_confirmado-senas_netas),0) cod, coalesce(sum(flete),0) flete,
        coalesce(sum(comisiones),0) comis, coalesce(sum(costo_producto),0) costo from daily_pnl
        where dispatch_date between $1 and $2 and courier='fixy'`, [M0, M1]);

    // Pauta: la del daily_pnl (asignada a cohortes) vs total BioLabs mapeada en ad_spend
    const adsMapped = await one(client, `select coalesce(sum(spend),0) s from ad_spend
        where date between $1 and $2 and product_id is not null`, [M0, M1]);
    const adsSinCohorte = await one(client, `select coalesce(sum(spend),0) s from v_ads_sin_cohorte
        where date between $1 and $2`, [M0, M1]);
    const adsGadget = await one(client, `select coalesce(sum(spend),0) s from ad_spend
        where date between $1 and $2 and product_id is null`, [M0, M1]);

    // ---------- baseline ----------
    console.log("\n===== BASELINE (PASO 0, fuentes crudas) =====");
    const b = await computeBaselineMay();
    console.log(`  URBANO despachadas ${b.urbano.despachadas} entregadas ${b.urbano.entregadas} (tasa ${(b.urbano.tasa * 100).toFixed(1)}%) · sin facturación ${b.urbano.sinFactur}`);
    console.log(`  FIXY   despachadas ${b.fixy.despachadas} entregadas ${b.fixy.entregadas} (tasa ${(b.fixy.tasa * 100).toFixed(1)}%)`);
    console.log(`  Decisión FLETE: ${b.meta.fleteNota}`);
    console.log(`  Decisión COSTO: ${b.meta.costoNota}`);
    if (b.pautaCheck) console.log(`  Pauta check: account ${money(b.pautaCheck.accountTotal)} − Nubba ${money(b.pautaCheck.nubba)} = ${money(b.pautaCheck.path_minus_nubba)} vs ref ${money(19306283)} (diff ${money(b.pautaCheck.path_minus_nubba - 19306283)})`);

    // ---------- TABLA RECONCILIACIÓN ----------
    console.log("\n===== RECONCILIACIÓN MAYO — app vs baseline (tol 1%) =====\n");
    console.log(" URBANO");
    printTable([
      row("COD entregado", Number(pnlU.cod), b.urbano.cod),
      row("Flete", Number(pnlU.flete), b.urbano.flete),
      row("Comisión", Number(pnlU.comis), b.urbano.comision),
      row("Costo producto", Number(pnlU.costo), b.urbano.costo),
    ]);
    console.log("\n FIXY");
    printTable([
      row("COD entregado", Number(pnlF.cod), b.fixy.cod),
      row("Flete", Number(pnlF.flete), b.fixy.flete),
      row("Comisión", Number(pnlF.comis), b.fixy.comision),
      row("Costo producto", Number(pnlF.costo), b.fixy.costo),
    ]);
    console.log("\n TOTAL");
    const netoApp = appCod - Number(pnl.flete) - Number(pnl.comis) - Number(pnl.costo) - Number(adsMapped.s);
    const totalRows = [
      row("COD entregado", appCod, b.total.cod),
      row("Flete", Number(pnl.flete), b.total.flete),
      row("Comisión", Number(pnl.comis), b.total.comision),
      row("Costo producto", Number(pnl.costo), b.total.costo),
      row("Pauta (BioLabs)", Number(adsMapped.s), b.total.pauta),
      row("Neto", netoApp, b.total.neto),
    ];
    printTable(totalRows);

    // ---------- diagnóstico de COHORTE (explica Flete y Neto) ----------
    console.log("\n===== DIAGNÓSTICO DE COHORTE =====");
    // Urbano: app fecha de despacho = coalesce(ciclo, min-evento). El baseline exige ciclo en mayo.
    // Guías urbano de mayo SIN evento 'despachado' (ciclo) → app las fechó por fallback (min evento).
    const uFallback = await one(client, `select count(*) c, coalesce(sum(freight_cost),0) f
      from shipments s where s.courier='urbano' and s.dispatched_at between $1 and $2
      and not exists (select 1 from shipment_events e where e.shipment_id=s.id and e.status_canonical='despachado')`, [M0, M1]);
    const uWithCiclo = await one(client, `select count(*) c from shipments s where s.courier='urbano'
      and s.dispatched_at between $1 and $2
      and exists (select 1 from shipment_events e where e.shipment_id=s.id and e.status_canonical='despachado')`, [M0, M1]);
    console.log(`Urbano mayo — despachadas app (daily_pnl) ${urb.d} vs baseline (ciclo WS) ${b.urbano.despachadas}  → Δ ${Number(urb.d) - b.urbano.despachadas} guías`);
    console.log(`  shipments urbano mayo con evento 'despachado'(ciclo): ${uWithCiclo.c} · SIN ciclo (fechadas por fallback min-evento): ${uFallback.c} (flete ${money(Number(uFallback.f))})`);
    console.log(`  ⇒ Flete urbano ratio app/base ${(Number(pnlU.flete) / b.urbano.flete).toFixed(4)} ≈ despachadas ratio ${(Number(urb.d) / b.urbano.despachadas).toFixed(4)} → el desfase es CANTIDAD DE GUÍAS, no la ×1.29.`);
    // Fixy: guías del XLSX de mayo que NO entran al P&L (sin pedido / producto desconocido).
    const fExcl = await one(client, `select count(*) c, coalesce(sum(freight_cost),0) f
      from shipments s where s.courier='fixy' and s.dispatched_at between $1 and $2
      and (s.order_id is null or order_primary_product(s.order_id) is null)`, [M0, M1]);
    console.log(`Fixy mayo — despachadas app (daily_pnl) ${fix.d} vs baseline (Fecha XLSX) ${b.fixy.despachadas}  → Δ ${Number(fix.d) - b.fixy.despachadas} guías`);
    console.log(`  guías fixy mayo excluidas del P&L (v_sin_clasificar: sin pedido/producto desconocido): ${fExcl.c} (flete ${money(Number(fExcl.f))})`);
    console.log(`  ⇒ Flete fixy ratio app/base ${(Number(pnlF.flete) / b.fixy.flete).toFixed(4)} ≈ despachadas ratio ${(Number(fix.d) / b.fixy.despachadas).toFixed(4)} → app CAPTURA MENOS guías (las no matcheadas), no error de fórmula.`);

    // ---------- desgloses que explican los desfases ----------
    console.log("\n===== NOTAS / DIAGNÓSTICO =====");
    console.log(`Señas (app, informativo): revenue incluye senas_netas = ${money(Number(pnl.senas))} (mayo). El baseline mide sólo COD; por eso el COD se compara neto de señas.`);
    console.log(`Pauta: app total BioLabs mapeada (ad_spend product_id not null, mayo) = ${money(Number(adsMapped.s))}.`);
    console.log(`       app asignada a cohortes en daily_pnl = ${money(Number(pnl.ads))}.`);
    console.log(`       v_ads_sin_cohorte mayo (spend sin despachos ese día) = ${money(Number(adsSinCohorte.s))}.`);
    console.log(`       gadget sin product_id (Nubba) mayo = ${money(Number(adsGadget.s))}.`);
    console.log(`       → app daily_pnl.ads + v_ads_sin_cohorte = ${money(Number(pnl.ads) + Number(adsSinCohorte.s))} (debe ≈ pauta mapeada).`);
    console.log(`Neto app (con pauta mapeada total): ${money(netoApp)}. Neto app (con ads asignada daily_pnl ${money(Number(pnl.ads))}) = profit_confirmado sum = ${money(Number(pnl.profit))}.`);

    // resumen de banderas
    const fails = totalRows.filter((r) => r.flag === "✗");
    console.log(`\nLíneas fuera de tolerancia 1%: ${fails.length ? fails.map((r) => `${r.metric} (${(r.pct * 100).toFixed(2)}%)`).join(", ") : "ninguna ✓"}`);
    console.log("\n⛔ FRENO — reconciliación calculada, NINGÚN fix aplicado. Esperando tu OK.");
  } finally {
    await teardown();
  }
};

main().catch((e) => { console.error("❌ reconcile falló:", e); process.exitCode = 1; });
