import { parseFixyXlsx } from "@/lib/couriers/fixy";
import { estadosSinMapear, today, upsertEvents } from "@/lib/couriers/sync";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// Export XLSX de Fixy → mismos CourierEvent que la API (R8). multipart field "file".
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'falta el campo "file"' }, { status: 400 });
    }
    const events = parseFixyXlsx(Buffer.from(await file.arrayBuffer()));
    const rows = await upsertEvents(events);
    const warnings = await estadosSinMapear(["fixy"]);
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    await supabaseAdmin().rpc("recompute_daily_pnl", { p_from: cutoff, p_to: today() });
    await logSyncRun("fixy-xlsx", "ok", rows, warnings);
    return Response.json({ ok: true, events: events.length, rows, warnings });
  } catch (e) {
    await logSyncRun("fixy-xlsx", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
