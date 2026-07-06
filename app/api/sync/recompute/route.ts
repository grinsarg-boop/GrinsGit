import { today } from "@/lib/couriers/sync";
import { badCronAuth, supabaseAdmin } from "@/lib/supabase";

// Recalculo manual (§4.7). Body opcional {from, to}; default últimos 60 días.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  const body = await req.json().catch(() => ({}));
  const from = body.from ?? new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
  const to = body.to ?? today();
  const { error } = await supabaseAdmin().rpc("recompute_daily_pnl", { p_from: from, p_to: to });
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  return Response.json({ ok: true, from, to });
}
