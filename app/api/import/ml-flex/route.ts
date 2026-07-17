import { applyFlexFlete, parseSantiagoFlex } from "@/lib/ml";
import { today } from "@/lib/couriers/sync";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// Liquidación Flex de Santiago (xlsx) → ml_flex_flete → ml_orders.ship_cost. multipart field "file".
// El flete Flex no lo da la API de ML (lo cobra el repartidor); entra por acá hasta que haya API.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'falta el campo "file"' }, { status: 400 });
    }
    const rows = parseSantiagoFlex(Buffer.from(await file.arrayBuffer()));
    const db = supabaseAdmin();
    if (rows.length) {
      const { error } = await db.from("ml_flex_flete").upsert(rows, { onConflict: "shipment_id" });
      if (error) throw new Error(`ml_flex_flete upsert: ${error.message}`);
    }
    const { updated } = await applyFlexFlete(db);
    // recompute del rango que puede tocar (90d) — la rama 'ml' aparece con 022 aplicada.
    const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
    await db.rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
    await logSyncRun("ml-flex", "ok", rows.length, [{ matched_to_orders: updated }]);
    return Response.json({ ok: true, parsed: rows.length, matched: updated });
  } catch (e) {
    await logSyncRun("ml-flex", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
