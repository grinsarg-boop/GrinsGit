import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";

// El middleware saltea /api → cada endpoint del dashboard valida la sesión por su cuenta
// (misma regla que middleware.ts: user + whitelist de mails). Estaba copiado en cada route.
export async function sessionOk(req: NextRequest): Promise<boolean> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!user && allowed.includes(user.email?.toLowerCase() ?? "");
}
