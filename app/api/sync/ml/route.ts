import { syncMlOrders } from "@/lib/ml";
import { badCronAuth, logSyncRun } from "@/lib/supabase";

// OAuth (refresh 6h) + paginado de órdenes → puede pasar los 10s default de Hobby.
export const maxDuration = 60;

export async function POST(req: Request) {
  const bad = badCronAuth(req);
  if (bad) return bad;

  const days = Number(new URL(req.url).searchParams.get("days")) || 30;
  try {
    const { rows } = await syncMlOrders(days);
    await logSyncRun("ml", "ok", rows);
    return Response.json({ ok: true, rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await logSyncRun("ml", "error", 0, [], msg);
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}

// Vercel Cron / n8n disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
