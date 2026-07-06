import { fixy } from "@/lib/couriers/fixy";
import { runCourierSync } from "@/lib/couriers/sync";
import { badCronAuth } from "@/lib/supabase";

export async function POST(req: Request) {
  return badCronAuth(req) ?? runCourierSync("fixy", fixy);
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
