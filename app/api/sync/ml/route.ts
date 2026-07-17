import { enrichMlShipments, estimateFlexByCP, syncMlOrders } from "@/lib/ml";
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
    // ML entra al P&L acá mismo, sin depender del recompute de otro courier.
    const from = new Date(Date.now() - Math.max(days, 60) * 86400_000).toISOString().slice(0, 10);
    await supabaseAdmin().rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
    const warnings = sinProducto > 0 ? [{ ventas_sin_producto: sinProducto }, { enriched, flex, estimated }] : [{ enriched, flex, estimated }];
    await logSyncRun("ml", "ok", rows, warnings);
    return Response.json({ ok: true, rows, enriched, flex, estimated, sinProducto });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSyncRun("ml", "error", 0, [], msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron / n8n disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
