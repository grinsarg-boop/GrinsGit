import { fixy } from "@/lib/couriers/fixy";
import { discoverFixy } from "@/lib/couriers/fixy-discover";
import { runCourierSync } from "@/lib/couriers/sync";
import { badCronAuth } from "@/lib/supabase";

export const maxDuration = 60; // margen de volumen (Hobby máx 60s).

export async function POST(req: Request) {
  const auth = badCronAuth(req);
  if (auth) return auth;
  // Bootstrap: la guía Fixy se registra en Fixy por API (no en tags como Urbano). Descubrir las
  // nuevas ANTES de refrescar estados, si no nunca entran (audit feed-despacho 15/07). Un fallo del
  // discovery no debe voltear el sync de estados → aislado.
  await discoverFixy().catch(() => {});
  const limit = Number(new URL(req.url).searchParams.get("limit")) || 100;
  return runCourierSync("fixy", fixy, limit);
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
