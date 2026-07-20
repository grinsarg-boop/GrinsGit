"use client";
import { useState } from "react";
import { fmtMoney, fmtMoneyCompact } from "@/lib/format";
import { cn } from "@/lib/utils";

// Acumulado del mes en curso (línea sólida), proyección al cierre a ritmo de los días maduros (punteada)
// y el mes anterior como vara (gris), alineados por día del mes. SVG puro. Tooltip al pasar el mouse por
// cualquier día: acumulado real, proyección interpolada y el mes anterior a esa misma altura — el left
// del tooltip va en % porque el svg escala con el contenedor.
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
  const [hd, setHd] = useState<number | null>(null);
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

  const actualM = new Map(actual.map((p) => [p.dom, p.acum]));
  const prevM = new Map(previo.map((p) => [p.dom, p.acum]));
  const p0 = proyeccion[0];
  const proyAt = (d: number) =>
    p0 && cierre && d >= p0.dom && cierre.dom > p0.dom
      ? p0.acum + ((cierre.acum - p0.acum) * (d - p0.dom)) / (cierre.dom - p0.dom)
      : null;
  const colW = plotW / (diasMes - 1);
  const hActual = hd !== null ? actualM.get(hd) : undefined;
  const hProy = hd !== null && hActual === undefined ? proyAt(hd) : null;
  const hPrev = hd !== null ? prevM.get(hd) : undefined;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <div className="relative min-w-[480px]" onMouseLeave={() => setHd(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
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
            {hoy && <circle cx={x(hoy.dom)} cy={y(hoy.acum)} r="3.5" className="fill-emerald-500" />}
            <circle cx={x(cierre.dom)} cy={y(cierre.acum)} r="3.5" fill="none" strokeWidth="2" className="stroke-emerald-500/70" />
            {finPrevio && <circle cx={x(finPrevio.dom)} cy={y(finPrevio.acum)} r="3" className="fill-muted-foreground/60" />}
            {Array.from({ length: diasMes }, (_, i) => i + 1).map((d) => (
              <g key={d} onMouseEnter={() => setHd(d)}>
                <rect x={x(d) - colW / 2} y={PAD.t} width={colW} height={plotH}
                      className={hd === d ? "fill-accent/60" : "fill-transparent"} />
              </g>
            ))}
            {[1, Math.round(diasMes / 2), diasMes].map((d) => (
              <text key={d} x={x(d)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {d}
              </text>
            ))}
          </svg>
          {hd !== null && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
                 style={{ left: `${Math.min(Math.max((x(hd) / W) * 100, 14), 86)}%`, top: 2 }}>
              <div className="font-medium">día {hd}</div>
              {hActual !== undefined && (
                <div className="text-muted-foreground">{mesLabel} <span className={cn("font-medium tabular-nums", hActual >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{fmtMoney(hActual)}</span></div>
              )}
              {hProy !== null && (
                <div className="text-muted-foreground">proyección <span className="font-medium tabular-nums text-foreground">{fmtMoney(hProy)}</span></div>
              )}
              {hPrev !== undefined && (
                <div className="text-muted-foreground">{prevLabel} <span className="font-medium tabular-nums text-foreground">{fmtMoney(hPrev)}</span></div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-emerald-500" /> {mesLabel}</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded border-t-2 border-dashed border-emerald-500/60 bg-transparent" /> proyección</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded bg-muted-foreground/50" /> {prevLabel}</span>
      </div>
    </div>
  );
}
