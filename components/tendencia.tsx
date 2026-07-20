"use client";
import { useState } from "react";
import { fmtDate, fmtMoney, fmtMoneyCompact, fmtPct, fmtRatio } from "@/lib/format";
import { mediaMovil } from "@/lib/tendencias";
import { cn } from "@/lib/utils";

// Gráfico de tendencia: valor diario (línea finita gris) + media móvil (línea gruesa de color) — la
// media es la que hay que mirar, el diario es ruido. SVG puro, sin libs, mismo patrón que profit-bars
// (ancho fijo + scroll horizontal, tooltip absoluto en px). La franja sombreada marca los últimos días
// inmaduros: ahí el valor va a MEJORAR a medida que las cohortes maduren — no es caída real.
export type PuntoT = { x: string; v: number };
type Kind = "money" | "num" | "pct" | "ratio";

const FMT: Record<Kind, (v: number) => string> = {
  money: (v) => fmtMoney(v),
  num: (v) => Math.round(v).toLocaleString("es-AR"),
  pct: (v) => fmtPct(v),
  ratio: (v) => fmtRatio(v),
};
const EJE: Record<Kind, (v: number) => string> = {
  money: fmtMoneyCompact,
  num: (v) => Math.round(v).toLocaleString("es-AR"),
  pct: (v) => `${Math.round(v * 100)}%`,
  ratio: (v) => fmtRatio(v),
};

export function Tendencia({
  puntos, kind, ma = 7, sombra = 0, trazo = "stroke-emerald-500", punto = "bg-emerald-500", label,
}: {
  puntos: PuntoT[];
  kind: Kind;
  ma?: number;         // ventana de la media móvil
  sombra?: number;     // cuántos puntos del final marcar como inmaduros
  trazo?: string;      // clase stroke-* de la media móvil — literal, NO derivar en runtime
  punto?: string;      // clase bg-* del mismo color para la leyenda (trampa de Tailwind: solo literales compilan)
  label: string;
}) {
  const [hi, setHi] = useState<number | null>(null);
  if (puntos.length < Math.max(3, ma)) {
    return <p className="text-sm text-muted-foreground">Hacen falta más días con datos para dibujar la tendencia.</p>;
  }

  const W = 640, H = 210, PAD = { l: 48, r: 10, t: 12, b: 24 };
  const plotW = W - PAD.l - PAD.r, plotH = H - PAD.t - PAD.b;
  const n = puntos.length;
  const medias = mediaMovil(puntos.map((p) => p.v), ma);

  const vals = [...puntos.map((p) => p.v), ...medias.filter((m): m is number => m !== null), 0];
  const max = Math.max(...vals), min = Math.min(...vals);
  const span = max - min || 1;
  const x = (i: number) => PAD.l + (i / (n - 1)) * plotW;
  const y = (v: number) => PAD.t + ((max - v) / span) * plotH;

  const linea = (sel: (i: number) => number | null) => {
    let d = "", pen = false;
    for (let i = 0; i < n; i++) {
      const v = sel(i);
      if (v === null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`;
      pen = true;
    }
    return d;
  };

  const step = n > 90 ? 30 : n > 45 ? 14 : n > 20 ? 7 : n > 10 ? 3 : 1;
  const colW = plotW / (n - 1);
  const hd = hi !== null ? puntos[hi] : null;

  return (
    <div className="overflow-x-auto">
      <div className="relative" style={{ width: W, height: H }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img" aria-label={label}>
          {[0, 1 / 3, 2 / 3, 1].map((f) => {
            const v = min + f * span;
            return (
              <g key={f}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="stroke-border" strokeWidth="1" />
                <text x={PAD.l - 6} y={y(v) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
                  {EJE[kind](v)}
                </text>
              </g>
            );
          })}
          {min < 0 && max > 0 && (
            <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} className="stroke-muted-foreground/50" strokeWidth="1" />
          )}
          {sombra > 0 && sombra < n && (
            <g>
              <rect x={x(n - 1 - sombra)} y={PAD.t} width={x(n - 1) - x(n - 1 - sombra)} height={plotH}
                    className="fill-muted/60" />
              <text x={x(n - 1)} y={PAD.t + 9} textAnchor="end" className="fill-muted-foreground text-[9px]">
                inmaduro
              </text>
            </g>
          )}
          <path d={linea((i) => puntos[i].v)} fill="none" strokeWidth="1.5" className="stroke-muted-foreground/40" />
          <path d={linea((i) => medias[i])} fill="none" strokeWidth="2.25" strokeLinecap="round" className={trazo} />
          {puntos.map((p, i) => {
            const showLabel = i % step === 0 && i <= n - step / 2;
            return (
              <g key={p.x} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                <rect x={x(i) - colW / 2} y={PAD.t} width={colW} height={plotH}
                      className={hi === i ? "fill-accent/60" : "fill-transparent"} />
                {hi === i && <circle cx={x(i)} cy={y(p.v)} r="3" className="fill-foreground" />}
                {showLabel && (
                  <text x={x(i)} y={H - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                    {fmtDate(p.x)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {hd && (
          <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
               style={{ left: Math.min(Math.max(x(hi!), 70), W - 70), top: 2 }}>
            <div className="font-medium">{fmtDate(hd.x)}</div>
            <div className="text-muted-foreground">día <span className="font-medium text-foreground">{FMT[kind](hd.v)}</span></div>
            {medias[hi!] !== null && (
              <div className="text-muted-foreground">media {ma}d <span className="font-medium text-foreground">{FMT[kind](medias[hi!]!)}</span></div>
            )}
          </div>
        )}
      </div>
      <div className={cn("flex flex-wrap gap-4 text-xs text-muted-foreground")}>
        <span className="flex items-center gap-1.5">
          <span className={cn("inline-block h-0.5 w-4 rounded", punto)} /> media {ma} días
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-muted-foreground/40" /> valor diario
        </span>
      </div>
    </div>
  );
}
