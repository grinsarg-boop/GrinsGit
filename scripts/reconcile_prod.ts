// PASO 4 (tarea 006) — paridad PROD vs baseline. Corre DESPUÉS del backfill limpio contra Supabase
// (006 aplicada). Consulta el daily_pnl de prod, agrega mayo y lo compara contra el MISMO baseline
// independiente que cerró local. Expectativa: la misma tabla (Neto $3.080.938, todas ≤1%).
//
// Uso: set -a; source .env.local; set +a; npx tsx scripts/reconcile_prod.ts
import { createClient } from "@supabase/supabase-js";
import { computeBaselineMay } from "./baseline_may.mts";

const M0 = "2026-05-01", M1 = "2026-05-31";
const TOL = 0.01;
const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function row(metric: string, app: number, base: number) {
  const diff = app - base, pct = base !== 0 ? diff / base : (app === 0 ? 0 : Infinity);
  return { metric, app, base, diff, pct, flag: Math.abs(pct) <= TOL ? "✓" : "✗" };
}
function printTable(rows: ReturnType<typeof row>[]) {
  const p = (s: string, n: number) => s.padStart(n);
  console.log("  " + "métrica".padEnd(20) + p("prod", 16) + p("baseline", 16) + p("diff $", 14) + p("diff %", 10));
  console.log("  " + "-".repeat(76));
  for (const r of rows)
    console.log("  " + r.metric.padEnd(20) + p(money(r.app), 16) + p(money(r.base), 16) + p(money(r.diff), 14) + p((r.pct * 100).toFixed(2) + "%", 9) + " " + r.flag);
}
const sum = (rows: any[], f: (r: any) => number) => rows.reduce((s, r) => s + Number(f(r) ?? 0), 0);

const main = async () => {
  // daily_pnl de mayo (≈235 filas) → agrego en JS
  const { data: pnl, error } = await db.from("daily_pnl").select("*").gte("dispatch_date", M0).lte("dispatch_date", M1);
  if (error) throw new Error(`daily_pnl: ${error.message}`);
  if (!pnl?.length) throw new Error("daily_pnl de mayo VACÍO → ¿corriste el backfill contra prod?");

  const byCourier = (c: string) => pnl.filter((r) => r.courier === c);
  const line = (rows: any[]) => ({
    cod: sum(rows, (r) => r.revenue_confirmado - r.senas_netas),
    flete: sum(rows, (r) => r.flete), comis: sum(rows, (r) => r.comisiones), costo: sum(rows, (r) => r.costo_producto),
    desp: sum(rows, (r) => r.despachadas), ent: sum(rows, (r) => r.entregadas),
  });
  const U = line(byCourier("urbano")), F = line(byCourier("fixy")), T = line(pnl);
  const adsMayMapped = (await db.from("ad_spend").select("spend").gte("date", M0).lte("date", M1).not("product_id", "is", null)).data ?? [];
  const pauta = sum(adsMayMapped, (r) => r.spend);

  console.log("===== INTEGRIDAD PROD (mayo) =====");
  const tasaU = U.ent / U.desp;
  console.log(`Tasa entrega Urbano: ${(tasaU * 100).toFixed(1)}%  (desp ${U.desp}, ent ${U.ent})  ${tasaU >= 0.35 && tasaU <= 0.47 ? "✓ ~41%" : "⚠️"}`);
  console.log(`Tasa entrega Fixy:   ${(F.ent / F.desp * 100).toFixed(1)}%  (desp ${F.desp}, ent ${F.ent})`);
  const { count: sinClas } = await db.from("v_sin_clasificar").select("*", { count: "exact", head: true });
  console.log(`v_sin_clasificar: ${sinClas}`);

  console.log("\n===== BASELINE (PASO 0) =====");
  const b = await computeBaselineMay();
  console.log(`  urbano desp ${b.urbano.despachadas} ent ${b.urbano.entregadas} · fixy desp ${b.fixy.despachadas} ent ${b.fixy.entregadas} · packs frenados:`, Object.keys(b.frozen).length ? b.frozen : "(ninguno)");

  console.log("\n===== PARIDAD MAYO — PROD vs baseline (tol 1%) =====\n URBANO");
  printTable([row("COD entregado", U.cod, b.urbano.cod), row("Flete", U.flete, b.urbano.flete), row("Comisión", U.comis, b.urbano.comision), row("Costo producto", U.costo, b.urbano.costo)]);
  console.log("\n FIXY");
  printTable([row("COD entregado", F.cod, b.fixy.cod), row("Flete", F.flete, b.fixy.flete), row("Comisión", F.comis, b.fixy.comision), row("Costo producto", F.costo, b.fixy.costo)]);
  console.log("\n TOTAL");
  const neto = T.cod - T.flete - T.comis - T.costo - pauta;
  const rows = [row("COD entregado", T.cod, b.total.cod), row("Flete", T.flete, b.total.flete), row("Comisión", T.comis, b.total.comision),
    row("Costo producto", T.costo, b.total.costo), row("Pauta (BioLabs)", pauta, b.total.pauta), row("Neto", neto, b.total.neto)];
  printTable(rows);
  console.log(`\n Convergencia: urbano prod ${U.desp}/base ${b.urbano.despachadas} · fixy prod ${F.desp}/base ${b.fixy.despachadas}`);
  const fails = rows.filter((r) => r.flag === "✗");
  console.log(`\nLíneas fuera de tolerancia 1%: ${fails.length ? fails.map((r) => `${r.metric} (${(r.pct * 100).toFixed(2)}%)`).join(", ") : "ninguna ✓ — PARIDAD OK"}`);
};

main().catch((e) => { console.error("❌ reconcile_prod falló:", e); process.exitCode = 1; });
