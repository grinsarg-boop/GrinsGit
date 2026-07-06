import { runCourierSync } from "@/lib/couriers/sync";
import { urbano } from "@/lib/couriers/urbano";
import { badCronAuth } from "@/lib/supabase";

export async function POST(req: Request) {
  return badCronAuth(req) ?? runCourierSync("urbano", urbano);
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
