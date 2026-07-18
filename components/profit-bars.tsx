"use client";
import { useState } from "react";
import { fmtDate, fmtMoney } from "@/lib/format";

// Gráfico de barras del profit por fecha: barra de color = profit CERRADO (confirmado, verde/rojo),
// vela gris = profit ESTIMADO (proyección de lo que falta madurar) en el mismo día. SVG puro, sin libs.
// Al pasar el mouse por una columna se muestra un tooltip con el profit de ese día. Cada columna es un
// link al drill-down. ponytail: <a> SVG = nav normal, alcanza para un drill-down.
type Bar = { date: string; confirmado: number; estimado: number };

export function ProfitBars({ data, hrefFor }: { data: Bar[]; hrefFor?: (date: string) => string }) {
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

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
             aria-label="Profit cerrado (barras de color) y estimado (velas grises) por fecha">
          <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = colW * i + colW / 2;
            const yEst = y(d.estimado);
            const yConf = y(d.confirmado);
            const confTop = Math.min(y0, yConf), confH = Math.max(Math.abs(yConf - y0), 1);
            const showLabel = i % step === 0;
            return (
              <a key={d.date} href={hrefFor ? hrefFor(d.date) : undefined}
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
