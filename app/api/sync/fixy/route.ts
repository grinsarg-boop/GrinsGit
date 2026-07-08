import { fixy } from "@/lib/couriers/fixy";
import { runCourierSync } from "@/lib/couriers/sync";
import { badCronAuth } from "@/lib/supabase";

export const maxDuration = 60; // margen de volumen (Hobby máx 60s). Nota: fixy.fetchStatuses se
// implementa en FASE 5 — hasta entonces este sync loguea error (los estados Fixy salen del XLSX).

export async function POST(req: Request) {
  const limit = Number(new URL(req.url).searchParams.get("limit")) || 300;
  return badCronAuth(req) ?? runCourierSync("fixy", fixy, limit);
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
