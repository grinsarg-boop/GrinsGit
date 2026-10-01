import { correrPostventa } from "@/lib/ml-postventa";
import { badCronAuth, logSyncRun } from "@/lib/supabase";

export const maxDuration = 300;

// Agente de post-venta de ML (migración 102), una vez por hora (:50) por vercel.json. Preguntas: decide
// responder / borrar / escalar / ignorar y, en modo 'auto' (settings.ml_postventa), publica.
// Reclamos: guarda una huella por reclamo abierto; si cambia, el workflow salud avisa.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;
  try {
    const r = await correrPostventa();
    await logSyncRun("ml-postventa", r.errores.length ? "error" : "ok", r.preguntas.length + r.cambios.length, r.errores);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    await logSyncRun("ml-postventa", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export { POST as GET };
