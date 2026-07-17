import { fmtDate, fmtMoney } from "@/lib/format";

// Gráfico de barras del profit por fecha: barra de color = profit CERRADO (confirmado, verde/rojo),
// vela gris = profit ESTIMADO (la proyección de lo que falta madurar) en el mismo día. SVG puro, sin libs.
// Cada columna es un <a> al drill-down del día. ponytail: <a> SVG = nav normal, alcanza para un drill-down.
type Bar = { date: string; confirmado: number; estimado: number };

export function ProfitBars({ data, hrefFor }: { data: Bar[]; hrefFor?: (date: string) => string }) {
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
  // etiquetas de fecha: cada ~7 columnas si hay muchas, para no encimar
  const step = data.length > 45 ? 14 : data.length > 20 ? 7 : data.length > 10 ? 3 : 1;

  return (
    <div className="overflow-x-auto">
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
            <a key={d.date} href={hrefFor ? hrefFor(d.date) : undefined} className="group">
              {/* zona clickeable + hover de toda la columna */}
              <rect x={colW * i} y={padT} width={colW} height={plotH}
                    className="fill-transparent group-hover:fill-accent/50" />
              <title>{`${fmtDate(d.date)} · cerrado ${fmtMoney(d.confirmado)} · estimado ${fmtMoney(d.estimado)}`}</title>
              {/* vela gris = estimado: línea vertical hasta el estimado + cap */}
              <line x1={cx} y1={y0} x2={cx} y2={yEst} className="stroke-muted-foreground/45" strokeWidth={2} />
              <line x1={cx - 5} y1={yEst} x2={cx + 5} y2={yEst} className="stroke-muted-foreground/70" strokeWidth={2} strokeLinecap="round" />
              {/* barra de color = confirmado (cerrado) */}
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
    </div>
  );
}
