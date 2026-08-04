import { after } from "next/server";
import { discoverUrbano, runCourierSync, shouldChain } from "@/lib/couriers/sync";
import { urbano } from "@/lib/couriers/urbano";
import { badCronAuth } from "@/lib/supabase";

// >1000 guías en batches de 200 (masiva) no entran en los 10s default. Vercel Pro permite 300s
// (Hobby capaba a 60): eso es lo que habilita limit=400 y la vuelta completa en ~30 min.
export const maxDuration = 300;

async function syncUrbano(limit: number, discover: boolean) {
  // El REFRESH corre PRIMERO y completa (guías + recompute): es lo crítico y ya andaba. El descubrimiento
  // de guías nuevas va DESPUÉS, best-effort: si el presupuesto de 60s (Hobby) se agota acá, el refresh ya
  // quedó firme; discoverUrbano persiste por chunk (lo consultado no se pierde) y el resto se completa en el
  // próximo ciclo. Un fallo de la masiva NO aborta el sync.
  const body = await (await runCourierSync("urbano", urbano, limit)).json();
  if (!discover) return body;
  let discovered: unknown;
  try { discovered = await discoverUrbano(urbano); }
  catch (e) { discovered = { error: String(e).slice(0, 150) }; }
  return { ...body, discovered };
}

export async function POST(req: Request) {
  const auth = badCronAuth(req);
  if (auth) return auth;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit")) || 100;
  // Auto-drenado (FASE 6, red de seguridad si n8n se cae): cada tanda refresca las `limit` guías más
  // stale y encadena la próxima hasta agotar `rounds`. Default 1 = una sola tanda (compat n8n, que
  // llama sin `rounds`); el cron de Vercel pasa rounds=16 (≈1600 guías/día). El tope evita loop infinito.
  const rounds = Number(url.searchParams.get("rounds")) || 1;
  // Descubrir guías nuevas 1×/ciclo (no en cada round encadenado, que sólo refresca): el chain pasa discover=0.
  const discover = url.searchParams.get("discover") !== "0";

  // Sin cadena: corremos sincrónico y devolvemos el JSON de la corrida (n8n / cron simple / manual).
  if (rounds <= 1) return Response.json(await syncUrbano(limit, discover));

  // Con cadena: respondemos YA y hacemos la tanda + disparo en after(). Así cada invocación queda
  // desacoplada del cliente y el fetch de disparo completa rápido (nunca aborta la próxima a mitad de
  // camino). El resultado de cada tanda queda en sync_runs.
  const authHeader = req.headers.get("authorization") ?? "";
  after(async () => {
    const body = await syncUrbano(limit, discover);
    if (shouldChain(body, rounds, limit)) {
      await fetch(`${url.origin}/api/sync/urbano?limit=${limit}&rounds=${rounds - 1}&discover=0`, {
        method: "POST",
        headers: { authorization: authHeader },
        signal: AbortSignal.timeout(10000),
      }).catch(() => {});
    }
  });
  return Response.json({ ok: true, chained: true, rounds });
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
