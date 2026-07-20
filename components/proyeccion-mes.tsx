import { fmtMoney, fmtMoneyCompact } from "@/lib/format";

// Acumulado del mes en curso (línea sólida), proyección al cierre a ritmo de los días maduros (punteada)
// y el mes anterior como vara (gris), alineados por día del mes. SVG puro, server component, hover con
// <title> nativo — alcanza para leer un punto puntual.
export type PuntoAcum = { dom: number; acum: number };

export function ProyeccionMes({
  actual, proyeccion, previo, diasMes, mesLabel, prevLabel,
}: {
  actual: PuntoAcum[];
  proyeccion: PuntoAcum[];
  previo: PuntoAcum[];
  diasMes: number;
  mesLabel: string;
  prevLabel: string;
}) {
  const W = 640, H = 230, PAD = { l: 48, r: 12, t: 12, b: 24 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const todos = [...actual, ...proyeccion, ...previo];
  if (!todos.length) return null;
  const max = Math.max(...todos.map((p) => p.acum), 1);
  const min = Math.min(...todos.map((p) => p.acum), 0);
  const span = max - min || 1;
  const x = (dom: number) => PAD.l + ((dom - 1) / (diasMes - 1)) * plotW;
  const y = (v: number) => PAD.t + ((max - v) / span) * plotH;
  const path = (pts: PuntoAcum[]) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.dom).toFixed(1)} ${y(p.acum).toFixed(1)}`).join(" ");

  const hoy = actual[actual.length - 1];
  const cierre = proyeccion[proyeccion.length - 1];
  const finPrevio = previo[previo.length - 1];

  return (
    <div className="space-y-2 overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[480px]" role="img"
           aria-label={`Acumulado de ${mesLabel}: ${hoy ? fmtMoney(hoy.acum) : "—"} al día ${hoy?.dom ?? 0}, cierre proyectado ${fmtMoney(cierre.acum)}; ${prevLabel} cerró en ${finPrevio ? fmtMoney(finPrevio.acum) : "—"}`}>
        {[0, 1 / 3, 2 / 3, 1].map((f) => {
          const v = min + f * span;
          return (
            <g key={f}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
              <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
                {fmtMoneyCompact(v)}
              </text>
            </g>
          );
        })}
        {min < 0 && max > 0 && (
          <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="stroke-muted-foreground/50" strokeWidth="1" />
        )}
        {previo.length > 1 && (
          <path d={path(previo)} fill="none" strokeWidth="1.5" className="stroke-muted-foreground/50" />
        )}
        {actual.length > 1 && (
          <path d={path(actual)} fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-emerald-500" />
        )}
        {proyeccion.length > 1 && (
          <path d={path(proyeccion)} fill="none" strokeWidth="2" strokeDasharray="6 4" className="stroke-emerald-500/60" />
        )}
        {hoy && (
          <circle cx={x(hoy.dom)} cy={y(hoy.acum)} r="3.5" className="fill-emerald-500">
            <title>{`hoy (día ${hoy.dom}): ${fmtMoney(hoy.acum)} acumulado`}</title>
          </circle>
        )}
        <circle cx={x(cierre.dom)} cy={y(cierre.acum)} r="3.5" fill="none" strokeWidth="2" className="stroke-emerald-500/70">
          <title>{`cierre proyectado: ${fmtMoney(cierre.acum)}`}</title>
        </circle>
        {finPrevio && (
          <circle cx={x(finPrevio.dom)} cy={y(finPrevio.acum)} r="3" className="fill-muted-foreground/60">
            <title>{`${prevLabel} cerró: ${fmtMoney(finPrevio.acum)}`}</title>
          </circle>
        )}
        {[1, Math.round(diasMes / 2), diasMes].map((d) => (
          <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
            {d}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-emerald-500" /> {mesLabel}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-emerald-500/60 bg-transparent" /> proyección</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-muted-foreground/50" /> {prevLabel}</span>
      </div>
    </div>
  );
}
