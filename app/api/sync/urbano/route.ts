import { after } from "next/server";
import { runCourierSync, shouldChain } from "@/lib/couriers/sync";
import { urbano } from "@/lib/couriers/urbano";
import { badCronAuth } from "@/lib/supabase";

// >1000 guías en batches de 200 (masiva) no entran en los 10s default de Hobby. Máx Hobby = 60s.
export const maxDuration = 60;

async function syncUrbano(limit: number) {
  return (await runCourierSync("urbano", urbano, limit)).json();
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

  // Sin cadena: corremos sincrónico y devolvemos el JSON de la corrida (n8n / cron simple / manual).
  if (rounds <= 1) return Response.json(await syncUrbano(limit));

  // Con cadena: respondemos YA y hacemos la tanda + disparo en after(). Así cada invocación queda
  // desacoplada del cliente y el fetch de disparo completa rápido (nunca aborta la próxima a mitad de
  // camino). El resultado de cada tanda queda en sync_runs.
  const authHeader = req.headers.get("authorization") ?? "";
  after(async () => {
    const body = await syncUrbano(limit);
    if (shouldChain(body, rounds, limit)) {
      await fetch(`${url.origin}/api/sync/urbano?limit=${limit}&rounds=${rounds - 1}`, {
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
