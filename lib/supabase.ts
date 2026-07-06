import { createClient } from "@supabase/supabase-js";

// Server-side only: bypassa RLS. Jamás importar desde un client component.
export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

// Guard de los endpoints de sync/import (§5): Bearer CRON_SECRET.
export function badCronAuth(req: Request): Response | null {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("unauthorized", { status: 401 });
  }
  return null;
}

// Registrar corrida de conector (§5). Los errores parciales van en warnings.
export async function logSyncRun(
  connector: string,
  status: "ok" | "error",
  rows: number,
  warnings: unknown[] = [],
  error: string | null = null,
) {
  await supabaseAdmin().rpc("log_sync_run", {
    p_connector: connector,
    p_status: status,
    p_rows: rows,
    p_warnings: warnings,
    p_error: error,
  });
}
