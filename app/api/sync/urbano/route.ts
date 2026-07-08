import { runCourierSync } from "@/lib/couriers/sync";
import { urbano } from "@/lib/couriers/urbano";
import { badCronAuth } from "@/lib/supabase";

// >1000 guías en batches de 200 (masiva) no entran en los 10s default de Hobby. Máx Hobby = 60s.
export const maxDuration = 60;

export async function POST(req: Request) {
  return badCronAuth(req) ?? runCourierSync("urbano", urbano);
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
