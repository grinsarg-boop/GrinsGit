import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Campanita de salud del sistema, en la nav. `salud_sistema()` (056/059) devuelve una fila por
// problema VIGENTE —sync frenado, sync que falla, ads en $0, atribución ciega, anuncios rechazados—
// y hasta hoy eso se dibujaba como una franja apilada arriba del contenido: información de una
// línea ocupando media pantalla en TODAS las páginas, empujando los datos abajo del fold. Los
// avisos son globales y crónicos (la atribución rota lleva semanas), así que el lugar correcto es
// un indicador permanente pero chico, con el detalle a un click.
// `<details>` nativo: mismo recurso que el resto del panel, sin estado ni dependencia nueva.
// Sigue siendo server component en el layout: una RPC por render, misma cuenta que antes.
type Fila = { severidad: string; area: string; detalle: string };

const ESTILO: Record<string, string> = {
  ROJO: "text-destructive",
  AMARILLO: "text-amber-700 dark:text-amber-400",
};

export async function SaludBanner() {
  const { data, error } = await supabaseAdmin().rpc("salud_sistema");
  // Que el chequeo no pueda correr es en sí una alerta: si esto se rompe, se rompió en silencio.
  const filas: Fila[] = error
    ? [{ severidad: "AMARILLO", area: "salud", detalle: `no se pudo leer la salud del sistema: ${error.message}` }]
    : ((data ?? []) as Fila[]).sort((a, b) => (a.severidad === b.severidad ? 0 : a.severidad === "ROJO" ? -1 : 1));
  if (!filas.length) return null;

  const rojo = filas.some((f) => f.severidad === "ROJO");
  return (
    <details className="relative">
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-1 rounded-md px-1.5 py-1 text-sm font-semibold transition-colors hover:bg-accent [&::-webkit-details-marker]:hidden",
          rojo ? ESTILO.ROJO : ESTILO.AMARILLO,
        )}
        title={`${filas.length} aviso${filas.length === 1 ? "" : "s"} del sistema`}
      >
        <span aria-hidden="true">!</span>
        <span className="tabular-nums">{filas.length}</span>
        <span className="sr-only">avisos del sistema</span>
      </summary>
      <div className="absolute right-0 z-50 mt-1 w-[min(80vw,28rem)] space-y-1.5 rounded-md border bg-popover p-3 text-sm shadow-lg">
        {filas.map((f) => (
          <div key={f.severidad + f.area + f.detalle}>
            <span className={cn("font-medium", ESTILO[f.severidad] ?? ESTILO.AMARILLO)}>{f.area}</span>{" "}
            <span className="text-muted-foreground">· {f.detalle}</span>
          </div>
        ))}
        <Link href="/sync" className="inline-block pt-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
          Ver corridas y warnings en /sync
        </Link>
      </div>
    </details>
  );
}
