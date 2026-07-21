import { enrichMlShipments, enrichMlTaxes, estimateFlexByCP, estimateMlPercep, syncMlAdSpend, syncMlFlexBonif, syncMlOrders, syncMpKhalil } from "@/lib/ml";
import { today } from "@/lib/couriers/sync";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// OAuth + paginado de órdenes + enriquecimiento de shipments (1 fetch/orden) + recompute → puede pasar los 10s.
export const maxDuration = 60;

export async function POST(req: Request) {
  const bad = badCronAuth(req);
  if (bad) return bad;

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days")) || 60; // ≥60 para re-fetchear cancelaciones tardías
  const enrichLimit = Number(url.searchParams.get("enrich")) || 300;
  try {
    const { rows, sinProducto } = await syncMlOrders(days);
    // Enriquece el flete normal-ME de las órdenes que aún no lo tienen (Flex queda para el listado).
    const { enriched, flex } = await enrichMlShipments(supabaseAdmin(), enrichLimit);
    // Estima por CP el flete de los Flex en curso (sin listado todavía).
    const { estimated } = await estimateFlexByCP(supabaseAdmin(), enrichLimit);
    // Presupuesto de 60s de Vercel (Hobby): los refrescos de ads/bonif/khalil/retenciones son
    // independientes → en paralelo, y con ventana rolling de 21 días (el histórico profundo ya está
    // backfilleado; 21d cubre restatements de ads y refunds típicos — los backfills largos van por
    // script local, no por esta ruta).
    const REFRESH_DAYS = 21;
    const [{ taxed }, { total: adsTotal }, { total: bonifTotal }, { pagos: mpPagos }] = await Promise.all([
      enrichMlTaxes(supabaseAdmin(), enrichLimit),
      syncMlAdSpend(REFRESH_DAYS, supabaseAdmin()),
      syncMlFlexBonif(REFRESH_DAYS, supabaseAdmin()),
      syncMpKhalil(REFRESH_DAYS, supabaseAdmin()),
    ]);
    // Percepciones IVA/IIBB estimadas (046) — después de ads/bonif: su base usa esas tablas.
    const { estimated: percepEst } = await estimateMlPercep(supabaseAdmin());
    // ML entra al P&L acá mismo, sin depender del recompute de otro courier.
    const from = new Date(Date.now() - Math.max(days, 60) * 86400_000).toISOString().slice(0, 10);
    await supabaseAdmin().rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
    const info = { enriched, flex, estimated, taxed, ads_ml: Math.round(adsTotal), bonif_ml: Math.round(bonifTotal), percep_est: percepEst, mp_khalil: mpPagos };
    const warnings = sinProducto > 0 ? [{ ventas_sin_producto: sinProducto }, info] : [info];
    await logSyncRun("ml", "ok", rows, warnings);
    return Response.json({ ok: true, rows, enriched, flex, estimated, taxed, adsTotal, bonifTotal, percepEst, mpPagos, sinProducto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSyncRun("ml", "error", 0, [], msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron / n8n disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
