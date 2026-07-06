import { fetchMetaInsights } from "@/lib/meta";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// Spend por ad, últimos 3 días (se reexpresa) — §5.3. Cron cada 1 h.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const rows = await fetchMetaInsights();
    const db = supabaseAdmin();
    if (rows.length) {
      const { error } = await db.rpc("upsert_ad_spend", { p: rows });
      if (error) throw new Error(error.message);
      const dates = rows.map((r) => r.date).sort();
      await db.rpc("recompute_daily_pnl", { p_from: dates[0], p_to: dates[dates.length - 1] });
    }
    await logSyncRun("meta", "ok", rows.length);
    return Response.json({ ok: true, rows: rows.length });
  } catch (e) {
    await logSyncRun("meta", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
