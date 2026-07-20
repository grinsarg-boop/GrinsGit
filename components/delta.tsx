import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct } from "@/lib/format";

// Variación contra el período anterior de IGUAL LARGO. `bueno` dice para qué lado es mejorar: en tasa
// de entrega subir es bueno, en flete es malo. Sin eso el color miente.
export function Delta({
  actual, previo, tipo = "money", bueno = "sube", className,
}: {
  actual: number;
  previo: number;
  tipo?: "money" | "pct" | "num";
  bueno?: "sube" | "baja";
  className?: string;
}) {
  if (!isFinite(previo) || previo === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>sin base previa</span>;
  }
  const dif = actual - previo;
  const rel = dif / Math.abs(previo);
  if (Math.abs(rel) < 0.005) {
    return <span className={cn("text-xs text-muted-foreground", className)}>= igual</span>;
  }
  const mejora = bueno === "sube" ? dif > 0 : dif < 0;
  const abs = tipo === "money" ? fmtMoney(Math.abs(dif))
            : tipo === "pct" ? `${(Math.abs(dif) * 100).toFixed(1)} pts`
            : Math.abs(dif).toLocaleString("es-AR");
  return (
    <span className={cn("text-xs tabular-nums", mejora ? "text-emerald-600 dark:text-emerald-400" : "text-destructive", className)}>
      {dif > 0 ? "▲" : "▼"} {abs}
      <span className="ml-1 text-muted-foreground">({fmtPct(Math.abs(rel))})</span>
    </span>
  );
}
