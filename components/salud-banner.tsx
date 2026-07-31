import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Franja de salud del sistema. `salud_sistema()` (056/059) devuelve una fila por problema VIGENTE
// —sync frenado, sync que falla, ads en $0, atribución ciega, anuncios rechazados— y hasta hoy la
// miraba solo el workflow `salud` por mail cada hora. En la app el único aviso era el sync caído:
// uno de los cinco chequeos. Los otros cuatro no tenían dónde verse, que era justo el problema que
// la función existe para resolver (el sistema no explota, miente callado).
// Server component en el layout: una RPC por render, misma cuenta que el banner que reemplaza.
type Fila = { severidad: string; area: string; detalle: string };

const ESTILO: Record<string, string> = {
  ROJO: "border-destructive/40 bg-destructive/10 text-destructive",
  AMARILLO: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
};

export async function SaludBanner() {
  const { data, error } = await supabaseAdmin().rpc("salud_sistema");
  // Que el chequeo no pueda correr es en sí una alerta: si esto se rompe, se rompió en silencio.
  if (error) {
    return (
      <div className={cn("mb-4 rounded-md border px-3 py-2 text-sm", ESTILO.AMARILLO)}>
        No se pudo leer la salud del sistema: {error.message}
      </div>
    );
  }
  const filas = ((data ?? []) as Fila[]).sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === "ROJO" ? -1 : 1));
  if (!filas.length) return null;
  return (
    <div className="mb-4 space-y-1">
      {filas.map((f) => (
        <div key={f.severidad + f.area + f.detalle}
             className={cn("rounded-md border px-3 py-2 text-sm", ESTILO[f.severidad] ?? ESTILO.AMARILLO)}>
          <span className="font-medium">{f.area}</span> · {f.detalle}
        </div>
      ))}
      <Link href="/sync" className="inline-block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
        Ver corridas y warnings en /sync
      </Link>
    </div>
  );
}
