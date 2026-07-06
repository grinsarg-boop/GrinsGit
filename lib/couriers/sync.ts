import { logSyncRun, supabaseAdmin } from "@/lib/supabase";
import type { CourierClient, CourierEvent } from "./types";

const TERMINALES = ["entregado", "devuelto", "siniestro", "cancelado"];

// Corrida de sync de un courier (§5.4): guías no terminales < 60 d, batches ≤ 200.
// Compartido por /api/sync/urbano y /api/sync/fixy.
export async function runCourierSync(courier: "urbano" | "fixy", client: CourierClient) {
  const db = supabaseAdmin();
  const started = Date.now();
  try {
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const { data: ships, error } = await db
      .from("shipments")
      .select("tracking")
      .eq("courier", courier)
      .not("status_canonical", "in", `(${TERMINALES.join(",")})`)
      .or(`dispatched_at.gte.${cutoff},dispatched_at.is.null`);
    if (error) throw new Error(error.message);

    const trackings = (ships ?? []).map((s) => s.tracking);
    let rows = 0;
    const warnings: unknown[] = [];
    for (let i = 0; i < trackings.length; i += 200) {
      const batch = trackings.slice(i, i + 200);
      let events: CourierEvent[];
      try {
        events = await client.fetchStatuses(batch);
      } catch (e) {
        // errores parciales no abortan el batch (§5)
        warnings.push({ batch: i / 200, error: String(e) });
        continue;
      }
      rows += await upsertEvents(events);
    }
    warnings.push(...(await estadosSinMapear(courier)));
    await db.rpc("recompute_daily_pnl", { p_from: cutoff, p_to: today() });
    await logSyncRun(courier, "ok", rows, warnings);
    return Response.json({ ok: true, trackings: trackings.length, rows, warnings, ms: Date.now() - started });
  } catch (e) {
    await logSyncRun(courier, "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Import manual (fixy-xlsx / facturación): mismos eventos, mismo RPC (§5.4).
export async function upsertEvents(events: CourierEvent[]): Promise<number> {
  if (!events.length) return 0;
  const { data, error } = await supabaseAdmin().rpc("upsert_shipment_events", { p: events });
  if (error) throw new Error(error.message);
  return data ?? 0;
}

export async function estadosSinMapear(courier: string): Promise<unknown[]> {
  const { data } = await supabaseAdmin()
    .from("v_estados_sin_mapear")
    .select("*")
    .eq("courier", courier);
  return (data ?? []).map((r) => ({ estado_sin_mapear: r.status_raw }));
}

export const today = () => new Date().toISOString().slice(0, 10);
