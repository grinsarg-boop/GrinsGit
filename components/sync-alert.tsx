import { supabaseAdmin } from "@/lib/supabase";

// Banner global: si el sync de guías (urbano/fixy) no registra corridas hace más de una hora,
// algo se cayó (pg_cron, Vercel o el courier) y los paneles empiezan a mentir por frescura.
// El freeze de n8n de julio tardó días en notarse; esto lo hace visible al instante.
// Server component async incluido en el layout — una query de una fila por render.
const UMBRAL_MIN = 60;

const minutosDesde = (iso: string | undefined) =>
  iso ? (Date.now() - new Date(iso).getTime()) / 60_000 : Infinity;

export async function SyncAlert() {
  const { data } = await supabaseAdmin()
    .from("sync_runs")
    .select("finished_at")
    .in("connector", ["urbano", "fixy"])
    .order("finished_at", { ascending: false })
    .limit(1);
  const min = minutosDesde(data?.[0]?.finished_at);
  if (min <= UMBRAL_MIN) return null;
  const hace = min === Infinity ? "nunca" : min < 120 ? `hace ${Math.round(min)} min` : `hace ${(min / 60).toFixed(1)} hs`;
  return (
    <div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      ⚠ El sync de guías está caído: última corrida {hace} (lo normal es cada 15 min). Revisá los
      jobs de pg_cron en Supabase (`select * from cron.job`) y los endpoints en /sync.
    </div>
  );
}
