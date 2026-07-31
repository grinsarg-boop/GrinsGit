import { fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

// Waterfall del P&L: de lo cobrado al profit, restando un costo por fila. Reemplaza la dona de
// composición, que contestaba "qué porción es cada costo" pero no "de dónde se fue el margen" —
// para leer la caída había que sumar tajadas de memoria.
//
// Y la dona MENTÍA con profit negativo: clampeaba esa tajada a 0 y las demás se repartían el 100%,
// así que un período en pérdida se veía igual de sano que uno rentable. Acá el profit negativo es
// una barra que cruza el cero, que es lo que es.
//
// Filas horizontales con divs, no columnas en SVG: las etiquetas van en castellano ("Percepciones
// ML", "Costo de producto") y no entran abajo de una columna. Cada barra flota entre el acumulado
// anterior y el nuevo, así que la escalera se lee de arriba a abajo. Server component, cero JS.
export type Paso = { label: string; monto: number }; // monto positivo = costo que se resta

export function Waterfall({
  inicio,
  pasos,
  finalLabel = "Profit confirmado",
}: {
  inicio: { label: string; monto: number };
  pasos: Paso[];
  finalLabel?: string;
}) {
  if (inicio.monto <= 0) return <p className="text-sm text-muted-foreground">Sin datos en el rango</p>;

  let run = inicio.monto;
  const filas = pasos.map((p) => {
    const desde = run;
    run -= p.monto;
    return { ...p, desde, hasta: run };
  });
  const final = run;

  // La escala incluye el 0 siempre: si el acumulado se hunde, la línea del cero tiene que verse.
  const max = Math.max(inicio.monto, 0);
  const min = Math.min(0, final, ...filas.map((f) => f.hasta));
  const span = max - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;
  // 0.4% de piso: un costo chiquito tiene que dejar marca, si no la fila parece vacía.
  const barra = (a: number, b: number) => ({
    left: `${Math.min(x(a), x(b))}%`,
    width: `${Math.max(Math.abs(x(a) - x(b)), 0.4)}%`,
  });

  const Fila = ({ label, monto, pos, color, pct, fuerte }: {
    label: string; monto: number; pos: React.CSSProperties; color: string; pct?: number; fuerte?: boolean;
  }) => (
    <div className={cn("flex items-center gap-3 py-1", fuerte && "border-t pt-2 font-medium")}>
      <span className="w-36 flex-none truncate text-muted-foreground">{label}</span>
      <span className="relative h-3 flex-1 rounded bg-muted/60">
        {min < 0 && <span className="absolute inset-y-0 w-px bg-border" style={{ left: `${x(0)}%` }} />}
        <span className={cn("barra absolute inset-y-0 rounded", color)} style={pos} />
      </span>
      <span className={cn("w-32 flex-none text-right tabular-nums", fuerte && (monto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"))}>
        {monto < 0 ? `−${fmtMoney(Math.abs(monto))}` : fmtMoney(monto)}
      </span>
      <span className="w-12 flex-none text-right text-xs tabular-nums text-muted-foreground">
        {pct === undefined ? "" : fmtPct(pct)}
      </span>
    </div>
  );

  return (
    <div className="text-sm">
      <Fila label={inicio.label} monto={inicio.monto} pos={barra(0, inicio.monto)} color="bg-muted-foreground/40" />
      {filas.map((f) => (
        <Fila key={f.label} label={f.label} monto={-f.monto} pos={barra(f.desde, f.hasta)}
              color="bg-rose-500/75" pct={f.monto / inicio.monto} />
      ))}
      <Fila label={finalLabel} monto={final} pos={barra(0, final)} fuerte
            color={final >= 0 ? "bg-emerald-500" : "bg-destructive"} pct={final / inicio.monto} />
    </div>
  );
}
