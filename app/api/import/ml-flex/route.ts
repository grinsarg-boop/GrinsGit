import { importMlFlex } from "@/lib/ml";
import { badCronAuth, logSyncRun } from "@/lib/supabase";

// Liquidación Flex de Santiago (xlsx) → ml_flex_flete → ml_orders.ship_cost → recompute. Field "file".
// El flete Flex no lo da la API de ML (lo cobra el repartidor); entra por acá hasta que haya API.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'falta el campo "file"' }, { status: 400 });
    }
    const { parsed, matched } = await importMlFlex(Buffer.from(await file.arrayBuffer()));
    await logSyncRun("ml-flex", "ok", parsed, [{ matched_to_orders: matched }]);
    return Response.json({ ok: true, parsed, matched });
  } catch (e) {
    await logSyncRun("ml-flex", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
