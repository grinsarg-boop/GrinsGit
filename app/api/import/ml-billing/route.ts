import { importMlBilling } from "@/lib/ml";
import { badCronAuth, logSyncRun } from "@/lib/supabase";

// Reporte_Facturacion mensual de ML (xlsx del panel) → percepciones reales por día → recompute.
// La API de billing está bloqueada (403 a nivel app); este import es el reemplazo. Field "file".
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File)) {
      return Response.json({ ok: false, error: 'falta el campo "file"' }, { status: 400 });
    }
    const { total, from, to, days } = await importMlBilling(Buffer.from(await file.arrayBuffer()));
    await logSyncRun("ml-billing", "ok", days, [{ total: Math.round(total), from, to }]);
    return Response.json({ ok: true, total, from, to, days });
  } catch (e) {
    await logSyncRun("ml-billing", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
