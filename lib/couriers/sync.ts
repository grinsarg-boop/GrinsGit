import { logSyncRun, supabaseAdmin } from "@/lib/supabase";
import type { CourierClient, CourierEvent } from "./types";

const TERMINALES = ["entregado", "devuelto", "siniestro", "cancelado"];

// Corrida de sync de un courier (§5.4): guías no terminales < 60 d, batches ≤ 200.
// Compartido por /api/sync/urbano y /api/sync/fixy.
//
// BATCHES POR INVOCACIÓN (FASE 4d): con >1000 guías el sync completo no entra en el timeout de
// Vercel (Hobby 60s). Cada llamada procesa las `limit` guías MÁS STALE (menor updated_at); como
// sincronizar bumpea updated_at, la próxima llamada agarra las siguientes → n8n lo llama en loop
// (ceil(total/limit) veces) hasta refrescar todas. Sin cursor: la staleness auto-avanza.
// limit=100: la masiva Urbano tarda ~0.3s/código; con el timeout de Vercel (Hobby 60s), 100
// (~30s masiva + upsert + recompute ≈ 45s) es el máximo seguro. n8n loopea ceil(total/100).
export async function runCourierSync(courier: "urbano" | "fixy", client: CourierClient, limit = 100) {
  const db = supabaseAdmin();
  const started = Date.now();
  try {
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const notTerminal = `(${TERMINALES.join(",")})`;
    const orDate = `dispatched_at.gte.${cutoff},dispatched_at.is.null`;
    const { count: total } = await db.from("shipments").select("*", { count: "exact", head: true })
      .eq("courier", courier).not("status_canonical", "in", notTerminal).or(orDate);
    const { data, error } = await db.from("shipments").select("tracking, order_ref")
      .eq("courier", courier).not("status_canonical", "in", notTerminal).or(orDate)
      .order("updated_at", { ascending: true, nullsFirst: true }).limit(limit);
    if (error) throw new Error(error.message);
    // Urbano se consulta por tracking (= shopify_id, la masiva); Fixy por order_ref (= remito).
    // Las fixy sin order_ref (otro canal) no se pueden consultar por API → se saltean.
    const trackings = (data ?? []).map((s) => (courier === "fixy" ? s.order_ref : s.tracking)).filter((x): x is string => !!x);
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
    // total/processed → n8n loopea ceil(total/limit) veces para cubrir todas las no-terminales.
    return Response.json({ ok: true, total: total ?? 0, processed: trackings.length, rows, warnings, ms: Date.now() - started });
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
