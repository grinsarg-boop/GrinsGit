"use client";
import { useMemo, useState } from "react";
import { fmtDate, fmtMoney, fmtMoneyCompact } from "@/lib/format";
import { flujoDiario, type Caja, type Mov } from "@/lib/cashflow";
import { cn } from "@/lib/utils";

// Flujo de caja por día (barras: verde entró / rojo salió) + evolución del saldo acumulado
// (curva: cuánta plata había en caja cada día). Filtrable por caja (chips): en "Todas" las
// transferencias internas no cuentan; en una caja puntual sí. Las dos vistas comparten columna
// por día y tooltip. SVG puro sin libs. Sin saldos iniciales en la app, la curva arranca en 0
// el 06/06 — el nivel es relativo al arranque de la carga; la forma es lo que vale.
export function CajaFlujo({ movs, cajas }: { movs: Mov[]; cajas: Caja[] }) {
  const [sel, setSel] = useState<number | null>(null);
  const [hi, setHi] = useState<number | null>(null);
  const data = useMemo(() => flujoDiario(movs, sel), [movs, sel]);
  const saldo = useMemo(
    () => data.reduce<number[]>((acc, d) => {
      acc.push((acc[acc.length - 1] ?? 0) + d.ingresos - d.egresos);
      return acc;
    }, []),
    [data],
  );

  const chip = (id: number | null, nombre: string) => (
    <button key={id ?? "todas"} type="button" onClick={() => { setSel(id); setHi(null); }}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        sel === id ? "border-brand bg-brand text-white dark:text-background" : "text-muted-foreground hover:bg-accent",
      )}>
      {nombre}
    </button>
  );

  // --- barras de flujo ---
  const H = 200, padT = 14, padB = 24;
  const colW = 22;
  const W = Math.max(data.length * colW, 320);
  const plotH = H - padT - padB;
  const maxV = Math.max(...data.map((d) => Math.max(d.ingresos, d.egresos)), 1);
  const y0 = padT + plotH / 2; // eje cero al medio: arriba entra, abajo sale
  const h = (v: number) => (v / maxV) * (plotH / 2);
  const barW = Math.min(colW * 0.6, 12);
  const step = data.length > 45 ? 14 : data.length > 20 ? 7 : 3;
  const hd = hi !== null ? data[hi] : null;

  // --- curva de saldo ---
  const H2 = 150, padT2 = 12, padB2 = 24;
  const plotH2 = H2 - padT2 - padB2;
  const sMax = Math.max(...saldo, 0), sMin = Math.min(...saldo, 0);
  const sSpan = sMax - sMin || 1;
  const ys = (v: number) => padT2 + ((sMax - v) / sSpan) * plotH2;
  const linea = saldo.map((v, i) => `${i ? "L" : "M"}${(colW * i + colW / 2).toFixed(1)} ${ys(v).toFixed(1)}`).join(" ");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {chip(null, "Todas")}
        {cajas.map((c) => chip(c.id, c.nombre))}
      </div>
      {!data.length ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Sin movimientos para graficar</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="relative" style={{ width: W }}>
            <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
                 aria-label="Flujo de caja por día: ingresos hacia arriba, egresos hacia abajo">
              <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
              {data.map((d, i) => {
                const cx = colW * i + colW / 2;
                return (
                  <g key={d.fecha} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                    <rect x={colW * i} y={0} width={colW} height={H}
                          className={hi === i ? "fill-accent" : "fill-transparent"} />
                    {d.ingresos > 0 && (
                      <rect x={cx - barW / 2} y={y0 - h(d.ingresos)} width={barW} height={Math.max(h(d.ingresos), 1)}
                            rx={1.5} className="fill-emerald-500/85 dark:fill-emerald-400/85" />
                    )}
                    {d.egresos > 0 && (
                      <rect x={cx - barW / 2} y={y0} width={barW} height={Math.max(h(d.egresos), 1)}
                            rx={1.5} className="fill-destructive/80" />
                    )}
                  </g>
                );
              })}
            </svg>
            <div className="mt-1 text-xs text-muted-foreground">Evolución del saldo</div>
            <svg viewBox={`0 0 ${W} ${H2}`} width={W} height={H2} className="max-w-none" role="img"
                 aria-label={`Evolución del saldo en caja por día; último: ${fmtMoney(saldo[saldo.length - 1])}`}>
              {sMin < 0 && (
                <line x1={0} y1={ys(0)} x2={W} y2={ys(0)} className="stroke-border" strokeWidth={1} strokeDasharray="3 3" />
              )}
              <path d={`${linea} L${(colW * (saldo.length - 1) + colW / 2).toFixed(1)} ${ys(Math.min(0, sMin)).toFixed(1)} L${colW / 2} ${ys(Math.min(0, sMin)).toFixed(1)} Z`}
                    className="fill-sky-500/10" />
              <path d={linea} fill="none" strokeWidth={2} className="stroke-sky-500" />
              {hi !== null && (
                <circle cx={colW * hi + colW / 2} cy={ys(saldo[hi])} r={3} className="fill-sky-500" />
              )}
              {data.map((d, i) => (
                <g key={d.fecha} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <rect x={colW * i} y={0} width={colW} height={H2}
                        className={hi === i ? "fill-accent/50" : "fill-transparent"} />
                  {i % step === 0 && (
                    <text x={colW * i + colW / 2} y={H2 - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                      {fmtDate(d.fecha)}
                    </text>
                  )}
                </g>
              ))}
              <text x={4} y={padT2 + 4} className="fill-muted-foreground text-[9px]">{fmtMoneyCompact(sMax)}</text>
              {sMin < 0 && <text x={4} y={H2 - padB2} className="fill-muted-foreground text-[9px]">{fmtMoneyCompact(sMin)}</text>}
            </svg>
            {hd && (
              <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
                   style={{ left: colW * hi! + colW / 2, top: 2 }}>
                <div className="font-medium">{fmtDate(hd.fecha)}</div>
                <div className="text-muted-foreground">entró <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtMoney(hd.ingresos)}</span></div>
                <div className="text-muted-foreground">salió <span className="font-medium text-destructive">{fmtMoney(hd.egresos)}</span></div>
                <div className="text-muted-foreground">saldo al cierre <span className="font-medium text-sky-600 dark:text-sky-400">{fmtMoney(saldo[hi!])}</span></div>
              </div>
            )}
          </div>
        </div>
      )}
      {sel != null && (
        <p className="text-xs text-muted-foreground">
          Filtrando una caja, las transferencias entre cajas propias cuentan (entran o salen de esta caja).
        </p>
      )}
    </div>
  );
}
