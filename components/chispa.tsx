import { fmtDate, fmtMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

// Sparkline semanal por producto: una línea, puntos con <title> nativo, cero ejes. Server component.
// El último punto va hueco: es la semana que todavía madura (su profit va a subir solo, no es caída).
// Colores como literales — trampa de Tailwind del 19/07: nada de derivar clases en runtime.
export function Chispa({ puntos, positivo }: { puntos: { x: string; v: number }[]; positivo: boolean }) {
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

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full" role="img"
         aria-label={`Profit semanal: última semana asentada ${fmtMoney(puntos[n - 2].v)}`}>
      {min < 0 && max > 0 && (
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} className="stroke-border" strokeWidth="1" />
      )}
      <path d={linea} fill="none" strokeWidth="1.75" strokeLinecap="round" className={trazo} />
      {puntos.map((p, i) => (
        <circle key={p.x} cx={x(i)} cy={y(p.v)} r={i === n - 1 ? 2.5 : 2}
                strokeWidth={i === n - 1 ? 1.5 : 0}
                className={cn(i === n - 1 ? cn("fill-background", trazo) : relleno)}>
          <title>{`semana del ${fmtDate(p.x)}: ${fmtMoney(p.v)}${i === n - 1 ? " (madurando)" : ""}`}</title>
        </circle>
      ))}
    </svg>
  );
}
