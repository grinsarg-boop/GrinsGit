import { today } from "@/lib/couriers/sync";
import { badCronAuth, supabaseAdmin } from "@/lib/supabase";

// Recalculo manual (§4.7). Body opcional {from, to}; default últimos 60 días.
// 60 días de recompute no entran en los 10s default. 300s = techo de Pro. Backfills más largos
// siguen yendo por script local (statement timeout de Postgres, no de Vercel).
export const maxDuration = 300;

export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const from = body.from ?? new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const to = body.to ?? today();
  const db = supabaseAdmin();
  // Refrescar priors P(entrega) ANTES del recompute — el P&L estimado §4.7 los consume (#16).
  await db.rpc("recompute_priors");
  const { error } = await db.rpc("recompute_daily_pnl", { p_from: from, p_to: to });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, from, to });
}
