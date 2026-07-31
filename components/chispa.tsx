"use client";
import { useState } from "react";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

// El formato viaja como string y no como función: esto es un client component y una función no
// cruza el borde del servidor (revienta el render entero de la página, no solo la card).
const FMT = { money: fmtMoney, pct: fmtPct } as const;

// Sparkline semanal: una línea, cero ejes, tooltip al pasar el mouse (columnas invisibles, mismo
// patrón que profit-bars; el left va en % porque el svg escala con el ancho de la card).
// Los últimos `pendientes` puntos van huecos: son las semanas que todavía maduran (su valor va a subir
// solo, no es caída). Colores como literales — trampa de Tailwind del 19/07: nada de derivar en runtime.
//
// ESCALA: por defecto cada sparkline usa la SUYA — sirve para leer la forma, no para comparar alturas
// entre cards (Tufte reconoce la escala propia como legítima justamente para eso). `min`/`max` la
// fuerzan compartida, y eso solo es honesto cuando las cards son la MISMA métrica en el mismo rango:
// la tasa de entrega por courier (0-100%) sí, el profit por producto no — ahí compartir escala
// aplastaría a los chicos contra el más grande.
export function Chispa({
  puntos, positivo, min: minFijo, max: maxFijo, pendientes = 1, formato = "money", unidad = "Profit semanal",
}: {
  puntos: { x: string; v: number }[];
  positivo: boolean;
  min?: number;
  max?: number;
  pendientes?: number;
  formato?: keyof typeof FMT;
  unidad?: string;
}) {
  const fmt = FMT[formato];
  const [hi, setHi] = useState<number | null>(null);
  if (puntos.length < 3) return null;
  const W = 240, H = 56, PAD = 7;
  const vals = puntos.map((p) => p.v);
  const max = maxFijo ?? Math.max(...vals, 0), min = minFijo ?? Math.min(...vals, 0);
  const span = max - min || 1;
  const n = puntos.length;
  const x = (i: number) => PAD + (i / (n - 1)) * (W - 2 * PAD);
  const y = (v: number) => PAD + ((max - v) / span) * (H - 2 * PAD);
  const trazo = positivo ? "stroke-emerald-500" : "stroke-destructive";
  const relleno = positivo ? "fill-emerald-500" : "fill-destructive";
  const linea = puntos.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(" ");
  const colW = W / n;
  const hd = hi !== null ? puntos[hi] : null;
  const madurando = (i: number) => i >= n - pendientes;
  const ultimaFirme = puntos[Math.max(n - 1 - pendientes, 0)];

  return (
    <div className="relative" onMouseLeave={() => setHi(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img"
           aria-label={`${unidad}: última semana asentada ${fmt(ultimaFirme.v)}`}>
        {min < 0 && max > 0 && (
          <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="1" />
        )}
        <path d={linea} fill="none" strokeWidth="1.75" strokeLinecap="round" className={trazo} />
        {puntos.map((p, i) => (
          <g key={p.x} onMouseEnter={() => setHi(i)}>
            <rect x={i * colW} y={0} width={colW} height={H} className="fill-transparent" />
            <circle cx={x(i)} cy={y(p.v)} r={i === hi ? 3 : madurando(i) ? 2.5 : 2}
                    strokeWidth={madurando(i) ? 1.5 : 0}
                    className={cn(madurando(i) ? cn("fill-background", trazo) : relleno)} />
          </g>
        ))}
      </svg>
      {hd && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
             style={{ left: `${Math.min(Math.max((x(hi!) / W) * 100, 18), 82)}%`, top: -6 }}>
          <div className="font-medium">sem del {fmtDate(hd.x)}{madurando(hi!) ? " · madurando" : ""}</div>
          <div className={cn("tabular-nums", hd.v >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>{fmt(hd.v)}</div>
        </div>
      )}
    </div>
  );
}
