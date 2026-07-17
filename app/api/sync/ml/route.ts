import { enrichMlShipments, syncMlOrders } from "@/lib/ml";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// OAuth + paginado de órdenes + enriquecimiento de shipments (1 fetch/orden) → puede pasar los 10s.
export const maxDuration = 60;

export async function POST(req: Request) {
  const bad = badCronAuth(req);
  if (bad) return bad;

  const url = new URL(req.url);
  const days = Number(url.searchParams.get("days")) || 30;
  const enrichLimit = Number(url.searchParams.get("enrich")) || 300;
  try {
    const { rows } = await syncMlOrders(days);
    // Enriquece el flete normal-ME de las órdenes que aún no lo tienen (Flex queda para el xlsx).
    const { enriched, flex } = await enrichMlShipments(supabaseAdmin(), enrichLimit);
    await logSyncRun("ml", "ok", rows, [{ enriched, flex }]);
    return Response.json({ ok: true, rows, enriched, flex });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSyncRun("ml", "error", 0, [], msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron / n8n disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
