"use client";
import { useState } from "react";
import { fmtDate, fmtMoney } from "@/lib/format";
import type { DiaFlujo } from "@/lib/cashflow";

// Flujo de caja por día: barra verde hacia arriba = entró, barra roja hacia abajo = salió.
// SVG puro sin libs, tooltip al pasar el mouse (mismo esquema que ProfitBars).
export function CajaFlujo({ data }: { data: DiaFlujo[] }) {
  const [hi, setHi] = useState<number | null>(null);
  if (!data.length) return <div className="py-8 text-center text-sm text-muted-foreground">Sin movimientos para graficar</div>;

  const H = 220, padT = 14, padB = 30;
  const colW = 22;
  const W = Math.max(data.length * colW, 320);
  const plotH = H - padT - padB;
  const maxV = Math.max(...data.map((d) => Math.max(d.ingresos, d.egresos)), 1);
  const y0 = padT + plotH / 2; // eje cero al medio: arriba entra, abajo sale
  const h = (v: number) => (v / maxV) * (plotH / 2);
  const barW = Math.min(colW * 0.6, 12);
  const step = data.length > 45 ? 14 : data.length > 20 ? 7 : 3;
  const hd = hi !== null ? data[hi] : null;

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
             aria-label="Flujo de caja por día: ingresos hacia arriba, egresos hacia abajo">
          <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
          {data.map((d, i) => {
            const cx = colW * i + colW / 2;
            return (
              <g key={d.fecha} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                <rect x={colW * i} y={padT} width={colW} height={plotH}
                      className={hi === i ? "fill-accent" : "fill-transparent"} />
                {d.ingresos > 0 && (
                  <rect x={cx - barW / 2} y={y0 - h(d.ingresos)} width={barW} height={Math.max(h(d.ingresos), 1)}
                        rx={1.5} className="fill-emerald-500/85 dark:fill-emerald-400/85" />
                )}
                {d.egresos > 0 && (
                  <rect x={cx - barW / 2} y={y0} width={barW} height={Math.max(h(d.egresos), 1)}
                        rx={1.5} className="fill-destructive/80" />
                )}
                {i % step === 0 && (
                  <text x={cx} y={H - 10} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {fmtDate(d.fecha)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hd && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
               style={{ left: colW * hi! + colW / 2, top: 2 }}>
            <div className="font-medium">{fmtDate(hd.fecha)}</div>
            <div className="text-muted-foreground">entró <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(hd.ingresos)}</span></div>
            <div className="text-muted-foreground">salió <span className="font-medium text-destructive">{fmtMoney(hd.egresos)}</span></div>
            <div className="text-muted-foreground">neto <span className={hd.ingresos - hd.egresos >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(hd.ingresos - hd.egresos)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
