import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Panel espejo del Resumen, pero cohorteado por DÍA DE VENTA (orders.created_at ART) en vez de día de
// despacho. Responde: cada día que vendés, ¿cuánto vas a ganar con esas ventas y cuánto te costó generarlas?
type Day = {
  date: string; generadas: number; despachadas: number; entregadas: number; resueltas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number; ads: number; adsSinCohorte: number;
};
type MonthAgg = {
  month: string; generadas: number; despachadas: number; entregadas: number;
  revenueEst: number; profitConf: number; profitEst: number; ads: number;
};

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MES[+m - 1]} ${y}`; };

export default async function Ventas({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string; v?: string; desde?: string; hasta?: string }>;
}) {
  const { courier, v, desde, hasta } = await searchParams;
  const vista = v === "meses" ? "meses" : "dias";
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;

  type Row = {
    sale_date: string; generadas: number; despachadas: number; entregadas: number; resueltas: number;
    revenue_confirmado: number; revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
    ads: number; ads_sin_cohorte: number;
  };
  const { data: rows } = await db.rpc("sales_days", { p_from: from, p_courier: courierParam });
  const list: Day[] = ((rows ?? []) as Row[])
    .map((r): Day => ({
      date: r.sale_date, generadas: r.generadas, despachadas: r.despachadas, entregadas: r.entregadas,
      resueltas: r.resueltas, revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
      profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
      ads: Number(r.ads), adsSinCohorte: Number(r.ads_sin_cohorte),
    }))
    .filter((d) => d.date <= to);

  let meses: MonthAgg[] = [];
  if (vista === "meses") {
    const m = new Map<string, MonthAgg>();
    for (const d of list) {
      const k = d.date.slice(0, 7);
      const a = m.get(k) ?? { month: k, generadas: 0, despachadas: 0, entregadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0 };
      a.generadas += d.generadas; a.despachadas += d.despachadas; a.entregadas += d.entregadas;
      a.revenueEst += d.revenueEst; a.profitConf += d.profitConf; a.profitEst += d.profitEst; a.ads += d.ads;
      m.set(k, a);
    }
    meses = [...m.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  }

  const hrefWith = (o: { courier?: string; v?: string; desde?: string; hasta?: string }) => {
    const c = o.courier !== undefined ? o.courier : (courier ?? "");
    const vv = o.v !== undefined ? o.v : vista;
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const q = new URLSearchParams();
    if (c) q.set("courier", c);
    if (vv === "meses") q.set("v", "meses");
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    const s = q.toString();
    return s ? `/ventas?${s}` : "/ventas";
  };

  const [ey, em] = today.slice(0, 7).split("-").map(Number);
  const pmY = em === 1 ? ey - 1 : ey;
  const pmM = em === 1 ? 12 : em - 1;
  const pm = `${pmY}-${String(pmM).padStart(2, "0")}`;
  const pmLast = new Date(pmY, pmM, 0).getDate();
  const presets: [string, string, string][] = [
    ["7 días", daysAgoIso(7), today],
    ["30 días", daysAgoIso(30), today],
    ["90 días", daysAgoIso(90), today],
    ["Este mes", `${today.slice(0, 7)}-01`, today],
    ["Mes pasado", `${pm}-01`, `${pm}-${String(pmLast).padStart(2, "0")}`],
    ["Máx", "2020-01-01", today],
  ];

  // Totales del rango. El gasto sin cohorte se resta del profit y suma al denominador de CPA/ROAS (como el
  // panel por despacho): es plata de Meta gastada que no ancló a ninguna venta generada.
  const rango = list.reduce((acc, d) => {
    acc.generadas += d.generadas; acc.despachadas += d.despachadas;
    acc.revenueEst += d.revenueEst; acc.profitConf += d.profitConf; acc.profitEst += d.profitEst;
    acc.ads += d.ads; acc.adsSinCohorte += d.adsSinCohorte;
    return acc;
  }, { generadas: 0, despachadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsSinCohorte: 0 });
  const rProfitEst = rango.profitEst - rango.adsSinCohorte;
  const rProfitConf = rango.profitConf - rango.adsSinCohorte;
  const rEnCamino = rProfitEst - rProfitConf;
  const adsTot = rango.ads + rango.adsSinCohorte;
  const cpa = rango.generadas ? adsTot / rango.generadas : 0;   // costo de adquisición por venta generada
  const roas = adsTot > 0 ? rango.revenueEst / adsTot : 0;

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Profit por día de venta</b> — lo que vas a ganar con las ventas que generaste cada día.</span>
        <Tip
          label="En qué se diferencia del Resumen"
          tip="El Resumen agrupa por día de DESPACHO (la cohorte que sale a la calle). Acá agrupamos por día de VENTA (cuándo se generó la orden). Sirve para medir el costo de adquisición: gastaste $X en Ads el día D y generaste N ventas. El profit de una venta COD se materializa cuando la guía se despacha y entrega, así que los días de venta muy recientes maduran a medida que despachás — mirá la barra de despacho."
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex flex-wrap gap-0.5 rounded-lg bg-muted p-0.5">
          {presets.map(([label, d, h]) => {
            const active = from === d && to === h;
            return (
              <Link
                key={label}
                href={hrefWith({ desde: d, hasta: h })}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 font-medium transition-colors",
                  active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </div>
        <form method="get" className="inline-flex items-center gap-1.5">
          {courier && <input type="hidden" name="courier" value={courier} />}
          {vista === "meses" && <input type="hidden" name="v" value="meses" />}
          <input type="date" name="desde" defaultValue={from} max={to} aria-label="Desde"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground">→</span>
          <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-medium text-secondary-foreground transition-colors hover:bg-accent">Aplicar</button>
        </form>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"], ["ml", "ML"]].map(([val, label]) => (
            <Link
              key={val}
              href={hrefWith({ courier: val })}
              aria-current={(courier ?? "") === val ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                (courier ?? "") === val ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["dias", "Días"], ["meses", "Meses"]].map(([val, label]) => (
            <Link
              key={val}
              href={hrefWith({ v: val })}
              aria-current={vista === val ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                vista === val ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 pt-5">
          <div>
            <div className="mb-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
              Profit por día de venta · <span className="tabular-nums normal-case">{rangeLabel}</span>
            </div>
            <div className={cn("text-3xl font-bold tabular-nums tracking-tight", rango.generadas ? pnlColor(rProfitEst) : "text-muted-foreground")}>
              {rango.generadas ? fmtMoney(rProfitEst) : "—"}
            </div>
            {rango.generadas ? (
              <div className="pt-1 text-sm text-muted-foreground">
                confirmado <span className="tabular-nums">{fmtMoney(rProfitConf)}</span>
                <span className="mx-1.5">·</span>
                <span className="font-medium tabular-nums text-amber-600 dark:text-amber-500">{fmtMoney(rEnCamino)} en camino</span>
                {rango.adsSinCohorte > 0 && (
                  <>
                    <span className="mx-1.5">·</span>
                    <span className="tabular-nums">{fmtMoney(rango.adsSinCohorte)} Ads sin cohorte</span>
                  </>
                )}
              </div>
            ) : (
              <div className="pt-1 text-sm text-muted-foreground">Sin ventas en el rango</div>
            )}
          </div>
          <div className="flex gap-8">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Ventas generadas</div>
              <div className="text-base font-semibold tabular-nums">{rango.generadas}</div>
              <div className="text-xs text-muted-foreground">{rango.generadas ? `${fmtPct(rango.despachadas / rango.generadas)} despachadas` : ""}</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                CPA adquisición
                <Tip tip="Gasto total en Ads del rango (incluido el que no ancló a ninguna venta) dividido las ventas generadas. Cuánto te costó generar cada venta." />
              </div>
              <div className="text-base font-semibold tabular-nums">{cpa > 0 ? fmtMoney(cpa) : "—"}</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS est.</div>
              <div className="text-base font-semibold tabular-nums">{roas > 0 ? fmtRatio(roas) : "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {vista === "dias" ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Día de venta</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">Generadas
                <Tip tip="Órdenes generadas ese día (se hayan despachado o no). En Correo/ML son las ventas del día." />
              </span>
            </TableHead>
            <TableHead className="w-40">
              <span className="inline-flex items-center gap-1">Despachadas
                <Tip tip={courier === "ml"
                  ? "En ML la venta ya está entregada por ML."
                  : courier === "correo"
                  ? "En Correo (cuotas prepago) es la tasa de confirmación: pagados sobre generados."
                  : "Cuántas de las ventas generadas ese día ya salieron a la calle. El profit de las que faltan despachar todavía no está contado, por eso los días recientes maduran."} />
              </span>
            </TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">
              <span className="inline-flex items-center gap-1">Profit estimado
                <Tip tip="Confirmado más la proyección de las guías de esa cohorte de venta que siguen en camino, menos Ads." />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">confirmado
                <Tip tip="Plata ya cobrada de las ventas de ese día, neta de Ads. Puede dar negativo transitorio mientras las guías no maduran." />
              </span>
            </TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">CPA
                <Tip tip="Gasto en Ads del día dividido las ventas generadas ese día. El costo de adquisición real por venta." />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            const despPct = d.generadas ? d.despachadas / d.generadas : 0;
            const madurez = d.generadas ? d.resueltas / d.generadas : 0;   // resueltas / generadas
            const inmaduro = madurez < 0.8;
            const cpaDia = d.generadas ? d.ads / d.generadas : 0;
            return (
              <TableRow key={d.date} className="hover:bg-accent/40">
                <TableCell className="font-medium">{fmtDate(d.date)}</TableCell>
                <TableCell className="text-right tabular-nums">{d.generadas}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[74px] flex-none rounded bg-muted">
                      <div className="h-1.5 rounded bg-foreground" style={{ width: `${Math.min(despPct, 1) * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtPct(despPct)}</span>
                  </div>
                </TableCell>
                <TableCell className={cn(
                  "text-right font-bold tabular-nums",
                  inmaduro ? "text-muted-foreground" : pnlColor(d.profitEst),
                )}>
                  {fmtMoney(d.profitEst)}
                  {inmaduro ? (
                    <Tip label="Qué significa inmaduro" tip="Buena parte de las ventas de este día todavía no se despachó/entregó, así que el estimado no es definitivo. Se firma a medida que las guías cierran.">
                      <span className="ml-1.5 rounded bg-amber-100 px-1 py-px align-middle text-[0.6rem] uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-500">inmaduro</span>
                    </Tip>
                  ) : null}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", d.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>
                  {fmtMoney(d.profitConf)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads ? fmtMoney(d.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{cpaDia > 0 ? fmtMoney(cpaDia) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">Sin ventas en el rango elegido</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Generadas</TableHead>
            <TableHead className="text-right">Despachadas</TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
            <TableHead className="text-right">confirmado</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">CPA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meses.map((m) => {
            const cpaMes = m.generadas ? m.ads / m.generadas : 0;
            return (
              <TableRow key={m.month}>
                <TableCell className="font-medium capitalize">{monthLabel(m.month)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.generadas}</TableCell>
                <TableCell className="text-right tabular-nums">{m.despachadas}</TableCell>
                <TableCell className={cn("text-right font-bold tabular-nums", pnlColor(m.profitEst))}>{fmtMoney(m.profitEst)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", m.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(m.profitConf)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.ads ? fmtMoney(m.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{cpaMes > 0 ? fmtMoney(cpaMes) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!meses.length && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">Sin datos históricos</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      )}
    </main>
  );
}
