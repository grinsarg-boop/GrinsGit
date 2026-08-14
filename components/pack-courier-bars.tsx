"use client";
import { useState } from "react";
import { fmtMoney, fmtPct } from "@/lib/format";
import { PILL, PILL_OFF, PILL_ON } from "@/lib/ui";
import { cn } from "@/lib/utils";

// Barras agrupadas: por cada pack (×1, ×2, …) una barra por courier COD (Urbano/Fixy). La altura es el
// profit por guía — la unidad comparable entre packs y couriers (saca el efecto volumen). Verde/rojo por
// signo, igual que el resto del panel; el courier se distingue por posición + etiqueta. SVG puro, sin libs
// (mismo criterio que profit-bars.tsx). El total, las guías y la entrega salen en el tooltip. Buckets con
// <40 guías van con opacidad baja: poco volumen = est/guía ruidoso.
// El toggle Estimado/Cerrado cambia entre el final proyectando lo en-calle con los priors (titular del
// panel) y solo lo ya cobrado — el cerrado deja ver dónde HOY hay pérdida real (p.ej. ×1 Urbano negativo).
export type PC = {
  pack: number; courier: string; guias: number; entrega: number;
  estGuia: number; total: number;         // estimado (con proyección de lo en la calle)
  estGuiaCerr: number; totalCerr: number; // cerrado (solo cobrado)
};

const LABEL: Record<string, string> = { urbano: "U", fixy: "F" };
const NAME: Record<string, string> = { urbano: "Urbano", fixy: "Fixy" };

export function PackCourierBars({ data }: { data: PC[] }) {
  const [hi, setHi] = useState<number | null>(null);
  const [modo, setModo] = useState<"est" | "cerr">("est");
  if (!data.length) return <div className="py-8 text-center text-sm text-muted-foreground">Sin guías COD para graficar</div>;

  const guiaVal = (r: PC) => (modo === "est" ? r.estGuia : r.estGuiaCerr);
  const totVal = (r: PC) => (modo === "est" ? r.total : r.totalCerr);

  // orden: por pack, y dentro del pack Urbano antes que Fixy (coincide con el rótulo "Urbano vs Fixy")
  const ORD: Record<string, number> = { urbano: 0, fixy: 1 };
  const rows = [...data].sort((a, b) => a.pack - b.pack || (ORD[a.courier] ?? 9) - (ORD[b.courier] ?? 9));
  const packs = [...new Set(rows.map((r) => r.pack))];

  const H = 260, padT = 16, padB = 40;
  const barW = 34, gapIn = 6, gapOut = 26;              // barras por grupo / entre grupos
  const groupW = (pack: number) => rows.filter((r) => r.pack === pack).length * (barW + gapIn) - gapIn;
  const W = Math.max(packs.reduce((s, p) => s + groupW(p) + gapOut, gapOut), 320);
  const plotH = H - padT - padB;
  const vals = rows.map(guiaVal).concat(0);
  const maxV = Math.max(...vals), minV = Math.min(...vals);
  const span = maxV - minV || 1;
  const y = (v: number) => padT + ((maxV - v) / span) * plotH;
  const y0 = y(0);

  // posición x de cada barra, recorriendo grupos
  let cursor = gapOut / 2;
  const placed = packs.flatMap((p) => {
    const cells = rows.filter((r) => r.pack === p);
    const gx = cursor;
    const out = cells.map((r, j) => ({ r, x: gx + j * (barW + gapIn) }));
    cursor += groupW(p) + gapOut;
    return out.map((o) => ({ ...o, gx, gw: groupW(p), pack: p }));
  });
  const hd = hi !== null ? placed[hi] : null;

  const toggle = (m: "est" | "cerr", label: string) => (
    <button type="button" onClick={() => setModo(m)}
            aria-pressed={modo === m}
            className={cn(PILL,
              modo === m ? PILL_ON : PILL_OFF)}>
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5 text-sm">
        {toggle("est", "Estimado")}
        {toggle("cerr", "Cerrado")}
      </div>
      <div className="overflow-x-auto">
        <div className="relative" style={{ width: W, height: H }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="max-w-none" role="img"
               aria-label={`Profit ${modo === "est" ? "estimado" : "cerrado"} por guía, por pack y courier`}>
            <line x1={0} y1={y0} x2={W} y2={y0} className="stroke-border" strokeWidth={1} />
            {placed.map((o, i) => {
              const v = guiaVal(o.r);
              const top = Math.min(y0, y(v));
              const h = Math.max(Math.abs(y(v) - y0), 1);
              const faint = o.r.guias < 40;
              return (
                <g key={`${o.r.pack}-${o.r.courier}`} onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)}>
                  <rect x={o.x - 2} y={padT} width={barW + 4} height={plotH} className={hi === i ? "fill-accent" : "fill-transparent"} />
                  <rect x={o.x} y={top} width={barW} height={h} rx={2}
                        className={cn(v >= 0 ? "fill-emerald-500/85 dark:fill-emerald-400/85" : "fill-destructive/85", faint && "opacity-45")} />
                  <text x={o.x + barW / 2} y={v >= 0 ? top - 4 : top + h + 12} textAnchor="middle"
                        className={cn("text-[10px] tabular-nums", v >= 0 ? "fill-emerald-600 dark:fill-emerald-400" : "fill-destructive")}>
                    {fmtMoney(v)}
                  </text>
                  <text x={o.x + barW / 2} y={H - 22} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium">{LABEL[o.r.courier] ?? o.r.courier}</text>
                </g>
              );
            })}
            {packs.map((p) => {
              const cells = placed.filter((o) => o.pack === p);
              const cx = cells.length ? cells[0].gx + cells[0].gw / 2 : 0;
              return <text key={p} x={cx} y={H - 6} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">×{p}</text>;
            })}
          </svg>
          {hd && (
            <div className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-md"
                 style={{ left: hd.x + barW / 2, top: 2 }}>
              <div className="font-medium">×{hd.r.pack} · {NAME[hd.r.courier] ?? hd.r.courier}</div>
              <div className="text-muted-foreground">{hd.r.guias.toLocaleString("es-AR")} guías · entrega {fmtPct(hd.r.entrega)}</div>
              <div className="text-muted-foreground">{modo === "est" ? "est" : "cerr"}/guía <span className={guiaVal(hd.r) >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(guiaVal(hd.r))}</span></div>
              <div className="text-muted-foreground">total {modo === "est" ? "est." : "cerr."} <span className={totVal(hd.r) >= 0 ? "font-medium text-emerald-600 dark:text-emerald-400" : "font-medium text-destructive"}>{fmtMoney(totVal(hd.r))}</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
