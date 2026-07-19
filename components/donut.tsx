import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct } from "@/lib/format";

// Dona en SVG puro, sin librería — mismo criterio que profit-bars.tsx (Recharts no está instalado y
// no hace falta). Server component: no hay estado ni JS en el cliente. El detalle por tajada sale por
// el <title> nativo del SVG, que el navegador muestra al pasar el mouse.
//
// Regla de uso: hasta ~7 tajadas. Más que eso no se lee y conviene una tabla ordenada.

export type Slice = { label: string; value: number; className: string };

// Paleta pensada para leerse en claro y oscuro. El orden importa: la primera tajada es la más grande.
export const PALETA = [
  "stroke-emerald-500",
  "stroke-sky-500",
  "stroke-amber-500",
  "stroke-violet-500",
  "stroke-rose-500",
  "stroke-teal-500",
  "stroke-slate-400",
];

export function Donut({
  slices, centro, subcentro, size = 148, money = true,
}: {
  slices: Slice[];
  centro?: string;
  subcentro?: string;
  size?: number;
  money?: boolean;
}) {
  const total = slices.reduce((s, x) => s + Math.max(x.value, 0), 0);
  if (total <= 0) return <p className="text-sm text-muted-foreground">Sin datos en el rango</p>;

  // Circunferencia normalizada a 100 para que dasharray sea directamente el porcentaje.
  const R = 15.9155;
  let acum = 0;

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }} className="flex-none" role="img"
           aria-label={`Distribución: ${slices.map((s) => `${s.label} ${fmtPct(s.value / total)}`).join(", ")}`}>
        <circle cx="21" cy="21" r={R} fill="none" strokeWidth="6" className="stroke-muted" />
        {slices.map((s) => {
          const pct = Math.max(s.value, 0) / total * 100;
          // −25 arranca el trazo a las 12 en punto en vez de a las 3.
          const off = -acum + 25;
          acum += pct;
          return (
            <circle key={s.label} cx="21" cy="21" r={R} fill="none" strokeWidth="6"
                    className={cn(s.className, "transition-[stroke-dasharray] duration-500")}
                    strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={off}>
              <title>{`${s.label}: ${money ? fmtMoney(s.value) : s.value} (${fmtPct(s.value / total)})`}</title>
            </circle>
          );
        })}
        {centro && (
          <text x="21" y={subcentro ? 20.4 : 22} textAnchor="middle"
                className="fill-foreground text-[5px] font-semibold">{centro}</text>
        )}
        {subcentro && (
          <text x="21" y="25" textAnchor="middle"
                className="fill-muted-foreground text-[2.6px]">{subcentro}</text>
        )}
      </svg>

      <ul className="min-w-[210px] flex-1 space-y-px text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center justify-between gap-3 border-b py-1 last:border-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className={cn("size-2 flex-none rounded-[2px]", s.className.replace("stroke-", "bg-"))} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="flex-none tabular-nums text-muted-foreground">
              {money ? fmtMoney(s.value) : s.value}
              <span className="ml-1.5 font-medium text-foreground">{fmtPct(s.value / total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
