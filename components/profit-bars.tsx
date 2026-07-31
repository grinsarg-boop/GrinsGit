"use client";
import { useState } from "react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { marcas, type Evento } from "@/lib/eventos";

// Gráfico de barras del profit por fecha: barra de color = profit CERRADO (confirmado, verde/rojo),
// vela gris = profit ESTIMADO (proyección de lo que falta madurar) en el mismo día. SVG puro, sin libs.
// Al pasar el mouse por una columna se muestra un tooltip con el profit de ese día. Cada columna es un
// link al drill-down. ponytail: <a> SVG = nav normal, alcanza para un drill-down.
// href se pre-construye en el server (no se puede pasar una función a un client component).
type Bar = { date: string; confirmado: number; estimado: number; href?: string };

export function ProfitBars({ data, eventos = [] }: { data: Bar[]; eventos?: Evento[] }) {
  const [hi, setHi] = useState<number | null>(null);
  if (!data.length) return <div className="py-8 text-center text-sm text-muted-foreground">Sin datos para graficar</div>;

  const H = 240, padT = 14, padB = 30;
  const colW = 26;                                   // ancho por día; el contenedor scrollea si no entra
  const W = Math.max(data.length * colW, 320);
  const plotH = H - padT - padB;
  const vals = data.flatMap((d) => [d.confirmado, d.estimado, 0]);
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const span = maxV - minV || 1;
  const y = (v: number) => padT + ((maxV - v) / span) * plotH;
  const y0 = y(0);
  const barW = Math.min(colW * 0.5, 14);
  const step = data.length > 45 ? 14 : data.length > 20 ? 7 : data.length > 10 ? 3 : 1;
  const hd = hi !== null ? data[hi] : null;
  const evs = marcas(data.map((d) => d.date), eventos);

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
             aria-label="Profit cerrado (barras de color) y estimado (velas grises) por fecha">
          {/* Blackouts y cambios de régimen (065), debajo de las barras: un pozo sin marcar se lee
              como performance. Mismo tratamiento que en tendencia.tsx. */}
          {evs.length > 0 && (
            <defs>
              <pattern id="pb-ev-rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" className="stroke-foreground/15" strokeWidth="2" />
              </pattern>
            </defs>
          )}
          {evs.map(({ ev, i, iFin }) => (
            <g key={ev.id}>
              <title>{`${fmtDate(ev.fecha)}${ev.fecha_fin && ev.fecha_fin !== ev.fecha ? ` → ${fmtDate(ev.fecha_fin)}` : ""} · ${ev.texto}`}</title>
              {iFin > i ? (
                <rect x={colW * i} y={padT} width={colW * (iFin - i + 1)} height={plotH} fill="url(#pb-ev-rayas)" />
              ) : (
                <line x1={colW * i + colW / 2} x2={colW * i + colW / 2} y1={padT} y2={padT + plotH}
                      className="stroke-foreground/35" strokeWidth={1} strokeDasharray="3 3" />
              )}
            </g>
          ))}
          <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = colW * i + colW / 2;
            const yEst = y(d.estimado);
            const yConf = y(d.confirmado);
            const confTop = Math.min(y0, yConf), confH = Math.max(Math.abs(yConf - y0), 1);
            const showLabel = i % step === 0;
            return (
              <a key={d.date} href={d.href}
                 onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                <rect x={colW * i} y={padT} width={colW} height={plotH}
                      className={hi === i ? "fill-accent" : "fill-transparent"} />
                <line x1={cx} y1={y0} x2={cx} y2={yEst} className="stroke-muted-foreground/45" strokeWidth={2} />
                <line x1={cx - 5} y1={yEst} x2={cx + 5} y2={yEst} className="stroke-muted-foreground/70" strokeWidth={2} strokeLinecap="round" />
                <rect x={cx - barW / 2} y={confTop} width={barW} height={confH} rx={1.5}
                      className={d.confirmado >= 0 ? "fill-emerald-500/85 dark:fill-emerald-400/85" : "fill-destructive/85"} />
                {showLabel && (
                  <text x={cx} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {fmtDate(d.date).replace(/\s?\d{4}$/, "")}
                  </text>
                )}
              </a>
            );
          })}
        </svg>
        {hd && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
               style={{ left: colW * hi! + colW / 2, top: 2 }}>
            <div className="font-medium">{fmtDate(hd.date)}</div>
            <div className="text-muted-foreground">cerrado <span className={hd.confirmado >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(hd.confirmado)}</span></div>
            <div className="text-muted-foreground">estimado <span className="font-medium text-foreground">{fmtMoney(hd.estimado)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
