"use client";
import { useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

// Barras verticales, una por canal del producto (Urbano/Fixy/Correo/ML). Altura = profit ESTIMADO total
// del producto en ese canal — la lectura es "de dónde sale la plata del producto". Complementa al bloque
// de packs (que mira rentabilidad por guía): acá manda el volumen × margen. Verde/rojo por signo; los
// despachos, la entrega y el est/despacho salen en el tooltip. SVG puro, sin libs.
export type CH = { courier: string; profitEst: number; profitConf: number; despachos: number; entrega: number; estPorDesp: number };

const NAME: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };

export function ChannelBars({ data }: { data: CH[] }) {
  const [hi, setHi] = useState<number | null>(null);
  if (!data.length) return <div className="py-8 text-center text-sm text-muted-foreground">Sin datos por canal</div>;

  const H = 240, padT = 16, padB = 34;
  const barW = 54, gap = 34;
  const W = Math.max(data.length * (barW + gap) + gap, 320);
  const plotH = H - padT - padB;
  const vals = data.map((d) => d.profitEst).concat(0);
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const span = maxV - minV || 1;
  const y = (v: number) => padT + ((maxV - v) / span) * plotH;
  const y0 = y(0);
  const hd = hi !== null ? data[hi] : null;
  const x = (i: number) => gap + i * (barW + gap);

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
             aria-label="Profit estimado del producto por canal">
          <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
          {data.map((d, i) => {
            const top = Math.min(y0, y(d.profitEst));
            const h = Math.max(Math.abs(y(d.profitEst) - y0), 1);
            return (
              <g key={d.courier} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                <rect x={x(i) - 4} y={padT} width={barW + 8} height={plotH} className={hi === i ? "fill-accent" : "fill-transparent"} />
                <rect x={x(i)} y={top} width={barW} height={h} rx={2}
                      className={d.profitEst >= 0 ? "fill-emerald-500/85 dark:fill-emerald-400/85" : "fill-destructive/85"} />
                <text x={x(i) + barW / 2} y={d.profitEst >= 0 ? top - 4 : top + h + 12} textAnchor="middle"
                      className={cn("text-[10px] tabular-nums", d.profitEst >= 0 ? "fill-emerald-600 dark:fill-emerald-400" : "fill-destructive")}>
                  {fmtMoney(d.profitEst)}
                </text>
                <text x={x(i) + barW / 2} y={H - 8} textAnchor="middle" className="fill-foreground text-[11px] font-medium">{NAME[d.courier] ?? d.courier}</text>
              </g>
            );
          })}
        </svg>
        {hd && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
               style={{ left: x(hi!) + barW / 2, top: 2 }}>
            <div className="font-medium">{NAME[hd.courier] ?? hd.courier}</div>
            <div className="text-muted-foreground">{hd.despachos.toLocaleString("es-AR")} despachos · entrega {fmtPct(hd.entrega)}</div>
            <div className="text-muted-foreground">profit est. <span className={hd.profitEst >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(hd.profitEst)}</span></div>
            <div className="text-muted-foreground">est/despacho <span className={hd.estPorDesp >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(hd.estPorDesp)}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
