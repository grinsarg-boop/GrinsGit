import { cn } from "@/lib/utils";
import { fmtMoney, fmtPct } from "@/lib/format";

// Dona en SVG puro, sin librería — mismo criterio que profit-bars.tsx (Recharts no está instalado y
// no hace falta). Server component: no hay estado ni JS en el cliente. El detalle por tajada sale por
// el <title> nativo del SVG, que el navegador muestra al pasar el mouse.
//
// Regla de uso: hasta ~7 tajadas. Más que eso no se lee y conviene una tabla ordenada.

// `dot` es la clase de fondo del cuadradito de la leyenda. Va como string LITERAL aparte porque
// derivarla en runtime (replace de stroke→bg) hacía que Tailwind nunca la compilara y los puntos
// salían invisibles — bug real detectado en prod.
export type Slice = { label: string; value: number; className: string; dot: string };

// Paleta pensada para leerse en claro y oscuro. El orden importa: la primera tajada es la más grande.
export const PALETA: { s: string; b: string }[] = [
  { s: "stroke-emerald-500", b: "bg-emerald-500" },
  { s: "stroke-sky-500", b: "bg-sky-500" },
  { s: "stroke-amber-500", b: "bg-amber-500" },
  { s: "stroke-violet-500", b: "bg-violet-500" },
  { s: "stroke-rose-500", b: "bg-rose-500" },
  { s: "stroke-teal-500", b: "bg-teal-500" },
  { s: "stroke-slate-400", b: "bg-slate-400" },
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
  const pcts = slices.map((s) => Math.max(s.value, 0) / total * 100);
  // −25 arranca el trazo a las 12 en punto en vez de a las 3.
  const offs = pcts.map((_, i) => 25 - pcts.slice(0, i).reduce((a, b) => a + b, 0));

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
      <svg viewBox="0 0 42 42" style={{ width: size, height: size }} className="flex-none" role="img"
           aria-label={`Distribución: ${slices.map((s) => `${s.label} ${fmtPct(s.value / total)}`).join(", ")}`}>
        <circle cx="21" cy="21" r={R} fill="none" strokeWidth="6" className="stroke-muted" />
        {slices.map((s, i) => {
          const pct = pcts[i], off = offs[i];
          return (
            <circle key={s.label} cx="21" cy="21" r={R} fill="none" strokeWidth="6"
                    className={cn(s.className, "tajada")}
                    style={{ animationDelay: `${i * 90}ms` }}
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
              <span className={cn("size-2 flex-none rounded-[2px]", s.dot)} />
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
