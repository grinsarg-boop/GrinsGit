"use client";
import { useState } from "react";
import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Sparkline semanal por producto: una línea, cero ejes, tooltip al pasar el mouse (columnas invisibles,
// mismo patrón que profit-bars; el left va en % porque el svg escala con el ancho de la card).
// El último punto va hueco: es la semana que todavía madura (su profit va a subir solo, no es caída).
// Colores como literales — trampa de Tailwind del 19/07: nada de derivar clases en runtime.
// Ojo: cada sparkline usa SU PROPIA escala — sirve para leer la forma, no para comparar alturas.
export function Chispa({ puntos, positivo }: { puntos: { x: string; v: number }[]; positivo: boolean }) {
  const [hi, setHi] = useState<number | null>(null);
  if (puntos.length < 3) return null;
  const W = 240, H = 56, PAD = 7;
  const vals = puntos.map((p) => p.v);
  const max = Math.max(...vals, 0), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const n = puntos.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + ((max - v) / span) * (H - 2 * PAD);
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const trazo = positivo ? "stroke-emerald-500" : "stroke-destructive";
  const relleno = positivo ? "fill-emerald-500" : "fill-destructive";
  const colW = W / n;
  const hd = hi !== null ? puntos[hi] : null;

  return (
    <div className="relative" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img"
           aria-label={`Profit semanal: última semana asentada ${fmtMoney(puntos[n - 2].v)}`}>
        {min < 0 && max > 0 && (
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="1" />
        )}
        <path d={linea} fill="none" strokeWidth="1.75" strokeLinecap="round" className={trazo} />
        {puntos.map((p, i) => (
          <g key={p.x} onMouseEnter={() => setHi(i)}>
            <rect x={i * colW} y={0} width={colW} height={H} className="fill-transparent" />
            <circle cx={x(i)} cy={y(p.v)} r={i === hi ? 3 : i === n - 1 ? 2.5 : 2}
                    strokeWidth={i === n - 1 ? 1.5 : 0}
                    className={cn(i === n - 1 ? cn("fill-background", trazo) : relleno)} />
          </g>
        ))}
      </svg>
      {hd && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
             style={{ left: `${Math.min(Math.max((x(hi!) / W) * 100, 18), 82)}%`, top: -6 }}>
          <div className="font-medium">sem del {fmtDate(hd.x)}{hi === n - 1 ? " · madurando" : ""}</div>
          <div className={cn("tabular-nums", hd.v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{fmtMoney(hd.v)}</div>
        </div>
      )}
    </div>
  );
}
