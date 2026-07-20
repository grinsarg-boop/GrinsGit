import { fmtPct } from "@/lib/format";

// Curva de maduración: para cada edad de cohorte, qué fracción ya tiene desenlace. SVG puro, server
// component. Dice cuándo un número es confiable — y si se aplana de golpe, que el sync se congeló.
export type Punto = { dias: number; guias: number; resueltas: number; entregadas: number };

export function Curva({ puntos, maturity = 10 }: { puntos: Punto[]; maturity?: number }) {
  if (puntos.length < 3) {
    return <p className="text-sm text-muted-foreground">Hacen falta al menos 3 días con volumen para dibujar la curva.</p>;
  }
  const W = 620, H = 180, PAD = { l: 34, r: 10, t: 10, b: 22 };
  const maxD = Math.max(...puntos.map((p) => p.dias)) || 1;
  const x = (d: number) => PAD.l + (d / maxD) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v) * (H - PAD.t - PAD.b);

  const linea = (sel: (p: Punto) => number) =>
    puntos.map((p, i) => `${i ? "L" : "M"}${x(p.dias).toFixed(1)} ${y(sel(p)).toFixed(1)}`).join(" ");

  const resuelta = (p: Punto) => (p.guias ? p.resueltas / p.guias : 0);
  const entrega = (p: Punto) => (p.guias ? p.entregadas / p.guias : 0);

  return (
    <div className="space-y-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
           aria-label={`Curva de maduración: al día ${maxD}, ${fmtPct(resuelta(puntos[puntos.length - 1]))} de las guías ya tienen desenlace`}>
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(g)} y2={y(g)} className="stroke-border" strokeWidth="1" />
            <text x={PAD.l - 6} y={y(g) + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">
              {Math.round(g * 100)}%
            </text>
          </g>
        ))}
        {/* la vara: a partir de acá la cohorte se considera madura */}
        {maturity <= maxD && (
          <g>
            <line x1={x(maturity)} x2={x(maturity)} y1={PAD.t} y2={H - PAD.b}
                  className="stroke-muted-foreground/50" strokeWidth="1" strokeDasharray="3 3" />
            <text x={x(maturity) + 4} y={PAD.t + 9} className="fill-muted-foreground text-[9px]">madura</text>
          </g>
        )}
        <path d={linea(resuelta)} fill="none" strokeWidth="2" className="stroke-foreground" />
        <path d={linea(entrega)} fill="none" strokeWidth="2" strokeDasharray="4 3"
              className="stroke-emerald-500" />
        {puntos.map((p) => (
          <circle key={p.dias} cx={x(p.dias)} cy={y(resuelta(p))} r="2.5" className="fill-foreground">
            <title>{`Día ${p.dias}: ${fmtPct(resuelta(p))} resuelto · ${fmtPct(entrega(p))} entregado · ${p.guias} guías`}</title>
          </circle>
        ))}
        {[0, Math.round(maxD / 2), maxD].map((d) => (
          <text key={d} x={x(d)} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[9px]">
            {d}d
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-foreground" /> resuelto (ya sabés si cobrás o no)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-emerald-500" /> entregado
        </span>
      </div>
    </div>
  );
}
