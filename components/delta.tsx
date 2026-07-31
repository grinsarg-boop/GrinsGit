import { cn } from "@/lib/utils";
import { Tip } from "@/components/ui/tooltip";
import { fmtMoney, fmtMoneyCompact, fmtPct } from "@/lib/format";
import { descomponer, type Periodo } from "@/lib/descomposicion";

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

// El mismo Δ, pero diciendo de QUÉ está hecho: guías × entrega × ticket × margen (lib/descomposicion).
// Un profit plano con más volumen y peor entrega se lee igual que un mes tranquilo mirando el total;
// acá los dos efectos aparecen con su signo y se cancelan a la vista.
//
// Cada factor va con su aporte en plata Y con cuánto se movió el driver, porque son dos preguntas
// distintas: "entrega −2,1 pts" dice qué pasó, "−$1,4M" dice cuánto costó. Ordenado por |aporte|:
// lo que más movió la aguja, primero. Los aportes despreciables (<2% del total) no se listan.
export function DeltaExplicado({ hoy, antes, label = "profit confirmado" }: {
  hoy: Periodo; antes: Periodo; label?: string;
}) {
  const d = descomponer(hoy, antes);
  if (!d) return null;

  const drivers: Record<string, (v: number) => string> = {
    volumen: (v) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("es-AR")} guías`,
    entrega: (v) => `entrega ${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} pts`,
    ticket: (v) => `ticket ${v >= 0 ? "+" : "−"}${fmtMoney(Math.abs(v)).replace("$ ", "$")}`,
    margen: (v) => `margen ${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")} pts`,
  };
  // Umbral relativo al cambio total, con piso: si el total es ~0 (el caso que más importa) todo
  // factor con plata real adentro tiene que verse igual.
  const piso = Math.max(Math.abs(d.total) * 0.02, 1);
  const visibles = [...d.factores].filter((f) => Math.abs(f.efecto) >= piso)
    .sort((a, b) => Math.abs(b.efecto) - Math.abs(a.efecto));
  if (!visibles.length) return null;

  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        De qué está hecho
        <Tip tip={`El cambio del ${label} descompuesto en sus cuatro drivers: guías × tasa de entrega × ticket × margen. Los cuatro suman el cambio exacto, sin residuo — cada uno se evalúa con los anteriores ya movidos. Sirve para el caso que un total plano tapa: más volumen a peor entrega se cancela en el número final y acá se ve. Va sobre el profit CONFIRMADO y no el estimado: el estimado ya tiene adentro una proyección de tasa de entrega, así que el factor "entrega" se estaría explicando a sí mismo.`} />
      </span>
      {visibles.map((f) => (
        <span key={f.clave} className="inline-flex items-baseline gap-1 tabular-nums">
          <span className={f.efecto >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
            {f.efecto >= 0 ? "▲" : "▼"} {fmtMoneyCompact(Math.abs(f.efecto))}
          </span>
          <span className="text-muted-foreground">{drivers[f.clave](f.delta)}</span>
        </span>
      ))}
    </div>
  );
}
