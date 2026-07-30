import { fetchAccountStatuses } from "@/lib/meta";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

type Cuenta = {
  account_id: string;
  name: string;
  status: string;
  prev_status: string | null;
  changed_at: string;
};

// Vigía del account_status de las cuentas de Meta (§061). Lo llama el workflow `salud` cada hora
// (NO vercel.json: Hobby rechaza crons no diarios y voltea el deploy entero). Si una cuenta CAMBIA
// a algo que no es ACTIVE, el job falla y GitHub manda el mail. Alerta la TRANSICIÓN, no el estado:
// una cuenta UNSETTLED desde hace una semana no puede mandar un mail por hora.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  try {
    const cuentas = await fetchAccountStatuses();
    const { data, error } = await supabaseAdmin().rpc("sync_meta_account_status", { p: cuentas });
    if (error) throw new Error(error.message);

    // Ventana 65 min = cadencia del workflow + margen (mismo criterio que ad-review).
    // prev_status null = primera vez que vemos la cuenta: es línea de base, no una noticia.
    const rows = (data ?? []) as Cuenta[];
    const cambios = rows.filter(
      (c) => c.prev_status && Date.parse(c.changed_at) > Date.now() - 65 * 60_000,
    );

    await logSyncRun("account-status", "ok", rows.length, cambios);
    return Response.json({ rojo: cambios.some((c) => c.status !== "ACTIVE"), cambios, cuentas: rows });
  } catch (e) {
    // Que el chequeo no pueda correr es en sí una alerta: queda en sync_runs y salud_sistema lo
    // levanta como ROJO ("la última corrida falló"), además de que el curl del workflow revienta.
    await logSyncRun("account-status", "error", 0, [], String(e));
    return new Response(String(e), { status: 500 });
  }
}

// Vercel Cron / el workflow salud disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
