import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60; // R12

type Day = {
  date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number;
  ads: number; adsSinCohorte: number;
};

type MonthAgg = {
  month: string; despachadas: number; entregadas: number; proyectadas: number;
  revenueEst: number; profitConf: number; profitEst: number; ads: number;
};

// Verde ganás / rojo perdés — el color hace el trabajo antes de leer el número.
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MES[+m - 1]} ${y}`; };

const COURIER_LABEL: Record<string, string> = { urbano: "Urbano", fixy: "Fixy" };
// >3 días sin guías nuevas = feo (urbano saltea domingos, así que ≤1 ok · 2-3 ámbar · >3 rojo).
const STALE_DAYS = 3;

export default async function Resumen({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string; v?: string; desde?: string; hasta?: string }>;
}) {
  const { courier, v, desde, hasta } = await searchParams;
  const vista = v === "meses" ? "meses" : "dias";
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  // Rango por URL (?desde=&hasta=). Default: últimos 30 días. dashboard_days da p_from→hoy; el tope lo corto acá.
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" ? courier : null;

  type Row = {
    dispatch_date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
    revenue_confirmado: number; revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
    ads: number; ads_sin_cohorte: number;
  };
  const mapDay = (r: Row): Day => ({
    date: r.dispatch_date, despachadas: r.despachadas, entregadas: r.entregadas, resueltas: r.resueltas,
    proyectadas: Number(r.proyectadas),
    revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
    profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
    ads: Number(r.ads), adsSinCohorte: Number(r.ads_sin_cohorte),
  });

  // Agregación server-side (dashboard_days, 009). El P&L por producto → /dia/[fecha].
  // dashboard_days devuelve de p_from hasta hoy; recorto el tope `to` acá (sin migración).
  const { data: rows } = await db.rpc("dashboard_days", { p_from: from, p_courier: courierParam });
  const list: Day[] = ((rows ?? []) as Row[]).map(mapDay).filter((d) => d.date <= to);

  // Vista MESES: agrupa los días DEL RANGO por mes (para todo el histórico, usá el preset "Máx").
  let meses: MonthAgg[] = [];
  if (vista === "meses") {
    const m = new Map<string, MonthAgg>();
    for (const d of list) {
      const k = d.date.slice(0, 7);
      const a = m.get(k) ?? { month: k, despachadas: 0, entregadas: 0, proyectadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0 };
      a.despachadas += d.despachadas; a.entregadas += d.entregadas; a.proyectadas += d.proyectadas;
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
    return s ? `/?${s}` : "/";
  };

  // Atajos de rango [label, desde, hasta]. "Mes pasado" = mes calendario anterior completo.
  const [ey, em] = today.slice(0, 7).split("-").map(Number);
  const pmY = em === 1 ? ey - 1 : ey;
  const pmM = em === 1 ? 12 : em - 1;
  const pm = `${pmY}-${String(pmM).padStart(2, "0")}`;
  const pmLast = new Date(pmY, pmM, 0).getDate(); // día 0 del mes actual = último del anterior
  const presets: [string, string, string][] = [
    ["7 días", daysAgoIso(7), today],
    ["30 días", daysAgoIso(30), today],
    ["90 días", daysAgoIso(90), today],
    ["Este mes", `${today.slice(0, 7)}-01`, today],
    ["Mes pasado", `${pm}-01`, `${pm}-${String(pmLast).padStart(2, "0")}`],
    ["Máx", "2020-01-01", today],
  ];

  const { data: adsSinCohorte } = await db
    .from("v_ads_sin_cohorte").select("product, spend").gte("date", from).lte("date", to);
  const adsSinCohortePorProd = [...(adsSinCohorte ?? []).reduce((m, a) => {
    const k = (a.product as string | null) ?? "sin producto";
    return m.set(k, (m.get(k) ?? 0) + Number(a.spend));
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);

  // Frescura del feed: hace cuánto entró la última guía por courier. El hueco del 08/07 fue
  // silencioso una semana justamente porque nadie miraba esto.
  const freshness = await Promise.all((["urbano", "fixy"] as const).map(async (c) => {
    const { data } = await db.from("shipments").select("dispatched_at").eq("courier", c)
      .not("dispatched_at", "is", null).order("dispatched_at", { ascending: false }).limit(1);
    return { courier: c as string, last: data?.[0]?.dispatched_at as string | undefined };
  }));
  const daysSince = (d: string) => Math.floor((new Date(today).getTime() - new Date(d).getTime()) / 86400_000);
  const stale = freshness.filter((f) => !f.last || daysSince(f.last) > STALE_DAYS);

  // Totales del RANGO (todo lo temporal sigue el rango; reemplaza los cards Hoy/7d/30d).
  const rango = list.reduce((acc, d) => {
    acc.despachadas += d.despachadas; acc.proyectadas += d.proyectadas;
    acc.revenueEst += d.revenueEst; acc.profitConf += d.profitConf; acc.profitEst += d.profitEst;
    acc.ads += d.ads; acc.adsSinCohorte += d.adsSinCohorte;
    return acc;
  }, { despachadas: 0, proyectadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsSinCohorte: 0 });
  // Sin cohorte se resta del profit y suma al denominador del ROAS (§4.6, #11).
  const rProfitEst = rango.profitEst - rango.adsSinCohorte;
  const rProfitConf = rango.profitConf - rango.adsSinCohorte;
  const rEnCamino = rProfitEst - rProfitConf;

  const adsAtrib = rango.ads;
  const adsSin = rango.adsSinCohorte;
  const adsTot = adsAtrib + adsSin;

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Profit estimado</b> — lo que vas a ganar con lo ya despachado.</span>
        <Tip
          label="Cómo se calcula el profit estimado"
          tip={
            courier === "correo"
              ? "En Correo son cuotas 3 sin interés, prepago: lo confirmado ya está cobrado y no se anula, así que no proyectamos tasa de entrega. La métrica es la tasa de confirmación (pagados / generados) y el estimado es igual al confirmado."
              : "Es el confirmado (plata que ya cobraste) más una proyección de las guías que siguen en la calle, usando tu tasa de entrega histórica por zona y producto. Por eso el número puede moverse hasta que todas las guías cierren."
          }
        />
      </div>

      {stale.length > 0 && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
          ⚠️ Feed de despachos frío — {stale.map((f) => `${COURIER_LABEL[f.courier]} ${f.last ? `hace ${daysSince(f.last)} días` : "sin datos"}`).join(" · ")}. Puede estar cortado; revisá el sync.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Frescura del feed
          <Tip label="Qué es la frescura del feed" tip="Fecha de la última guía que entró por cada courier. Si un courier quedó viejo, puede faltar sincronizar." />
        </span>
        {freshness.map((f) => {
          const n = f.last ? daysSince(f.last) : Infinity;
          const color = n <= 1 ? "text-emerald-600 dark:text-emerald-400" : n <= STALE_DAYS ? "text-amber-600 dark:text-amber-500" : "text-destructive";
          const rel = !f.last ? "sin datos" : n === 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
          return (
            <span key={f.courier} className={color}>
              {COURIER_LABEL[f.courier]}: última guía <span className="tabular-nums">{f.last ? fmtDate(f.last) : "—"}</span> <span className="text-xs opacity-80">({rel})</span>
            </span>
          );
        })}
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
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"]].map(([val, label]) => (
            <Link
              key={val}
              href={hrefWith({ courier: val })}
              aria-current={(courier ?? "") === val ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1 font-medium transition-colors",
                (courier ?? "") === val
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
                vista === val
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
              Profit estimado · <span className="tabular-nums normal-case">{rangeLabel}</span>
            </div>
            <div className={cn("text-3xl font-bold tabular-nums tracking-tight", rango.despachadas ? pnlColor(rProfitEst) : "text-muted-foreground")}>
              {rango.despachadas ? fmtMoney(rProfitEst) : "—"}
            </div>
            {rango.despachadas ? (
              <div className="pt-1 text-sm text-muted-foreground">
                confirmado <span className="tabular-nums">{fmtMoney(rProfitConf)}</span>
                <span className="mx-1.5">·</span>
                <span className="font-medium tabular-nums text-amber-600 dark:text-amber-500">{fmtMoney(rEnCamino)} en camino</span>
              </div>
            ) : (
              <div className="pt-1 text-sm text-muted-foreground">Sin despachos en el rango</div>
            )}
          </div>
          <div className="flex gap-8">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Despachos</div>
              <div className="text-base font-semibold tabular-nums">{rango.despachadas}</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Tasa proy.</div>
              <div className="text-base font-semibold tabular-nums">{rango.despachadas ? fmtPct(rango.proyectadas / rango.despachadas) : "—"}</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS est.</div>
              <div className="text-base font-semibold tabular-nums">{adsTot > 0 ? fmtRatio(rango.revenueEst / adsTot) : "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gastos en Ads · <span className="normal-case tabular-nums">{rangeLabel}</span></span>
            <span className="text-sm text-muted-foreground">total <b className="tabular-nums text-foreground">{fmtMoney(adsTot)}</b></span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Atribuido a cohortes
                <Tip tip="Gasto repartido entre productos y canales según los despachos de cada día." />
              </div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(adsAtrib)}</div>
              <div className="text-xs text-muted-foreground">repartido por producto y canal</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Sin cohorte
                <Tip tip="Gasto de Meta que no pudimos atribuir a ningún producto ni pedido. Se resta directo del profit y suma al denominador del ROAS." />
              </div>
              <div className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-500">{fmtMoney(adsSin)}</div>
              <div className="text-xs text-muted-foreground">{adsTot ? fmtPct(adsSin / adsTot) : "—"} del total · se resta del profit</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS estimado</div>
              <div className="text-lg font-semibold tabular-nums">{adsTot > 0 ? fmtRatio(list.reduce((s, d) => s + d.revenueEst, 0) / adsTot) : "—"}</div>
              <div className="text-xs text-muted-foreground">revenue est. / gasto total</div>
            </div>
          </div>

          {!!adsSinCohortePorProd.length && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Sin cohorte en el período:</span>{" "}
              {adsSinCohortePorProd.slice(0, 8).map(([p, s]) => `${p} ${fmtMoney(s)}`).join(" · ")}
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="underline-offset-4 hover:underline">Cómo se imputan los Ads</span> <span className="text-xs">▾</span>
            </summary>
            <div className="mt-2 space-y-1.5 border-l-2 pl-3 text-muted-foreground">
              <p>Cada gasto de Meta se asigna a un <b className="text-foreground">producto</b> por keyword del nombre del anuncio/campaña.</p>
              <p>El gasto del día por producto se <b className="text-foreground">reparte entre los canales</b> según los despachos de cada uno — Fixy pondera <b className="text-foreground">×1,4</b> (CPA más alto); Correo pondera por pedidos generados.</p>
              <p>Gasto sin producto (keyword no matcheó) o de un producto <b className="text-foreground">sin despachos ese día</b> → <span className="text-amber-600 dark:text-amber-500">sin cohorte</span>: plata real no atribuible a ninguna fila, se <b className="text-foreground">resta directo del profit</b> y suma al denominador del ROAS.</p>
            </div>
          </details>
        </CardContent>
      </Card>

      {vista === "dias" ? (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Despachos</TableHead>
            <TableHead className="w-36">
              <span className="inline-flex items-center gap-1">Madurez
                <Tip tip="Qué porcentaje de las guías de ese día ya se resolvieron (entregadas o canceladas). A más madurez, más confiable el estimado." />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">
                {courier === "correo" ? "Confirmación" : "Tasa hoy → final"}
                <Tip tip={courier === "correo"
                  ? "Pagados sobre generados. En prepago no proyectamos entrega, así que este valor no cambia."
                  : "Izquierda: tasa de entrega real hasta ahora. Derecha: tasa final que proyectamos según tu histórico. Cuando el día madura, ambas se igualan."} />
              </span>
            </TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">
              <span className="inline-flex items-center gap-1">Profit estimado
                <Tip tip="Confirmado más la proyección de lo que sigue en camino, menos Ads." />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">confirmado
                <Tip tip="Plata que ya cobraste, neta del gasto de Ads del período. Puede dar negativo de forma temporal: significa que todavía gastaste más en Ads de lo que maduró en ventas, y se corrige a medida que las guías se entregan." />
              </span>
            </TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">ROAS est.
                <Tip tip="Revenue estimado dividido el gasto total en Ads. Cuánto facturás por cada peso invertido en publicidad." />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            const pct = d.despachadas ? d.resueltas / d.despachadas : 0;
            const tasaAct = d.despachadas ? d.entregadas / d.despachadas : 0;
            const tasaProy = d.despachadas ? d.proyectadas / d.despachadas : 0;
            const inmaduro = pct < 0.8; // §6.1: el estimado todavía es proyección mientras <80% resuelto
            return (
              <TableRow key={d.date} className="group hover:bg-accent/40">
                <TableCell>
                  <Link href={`/dia/${d.date}`} className="font-medium underline-offset-4 group-hover:underline">
                    {fmtDate(d.date)}
                    <span className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100">→</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.despachadas}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[74px] flex-none rounded bg-muted">
                      <div className="h-1.5 rounded bg-foreground" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtPct(pct)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.despachadas
                    ? <>{fmtPct(tasaAct)} <span className="text-muted-foreground/60">→</span> <b className="text-foreground">{fmtPct(tasaProy)}</b></>
                    : "—"}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-bold tabular-nums",
                  inmaduro ? "text-muted-foreground" : pnlColor(d.profitEst),
                )}>
                  {fmtMoney(d.profitEst)}
                  {inmaduro ? (
                    <Tip label="Qué significa inmaduro" tip="La tasa de entrega de este día todavía puede cambiar, así que el estimado no es definitivo. Se vuelve firme cuando las guías terminan de entregarse.">
                      <span className="ml-1.5 rounded bg-amber-100 px-1 py-px align-middle text-[0.6rem] uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-500">inmaduro</span>
                    </Tip>
                  ) : pct >= 1 ? (
                    <Tip label="Qué significa cerrado" tip="Todas las guías de este día ya se resolvieron: este número es definitivo.">
                      <span className="ml-1.5 rounded bg-muted px-1 py-px align-middle text-[0.6rem] uppercase tracking-wide text-muted-foreground">cerrado</span>
                    </Tip>
                  ) : null}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", d.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>
                  {d.profitConf < 0 ? (
                    <Tip label="Por qué es negativo" tip="Negativo transitorio: las guías de este día aún no maduraron lo suficiente para cubrir el gasto de Ads. No es una pérdida cerrada.">
                      {fmtMoney(d.profitConf)}
                    </Tip>
                  ) : fmtMoney(d.profitConf)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads ? fmtMoney(d.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ads > 0 ? fmtRatio(d.revenueEst / d.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Sin despachos en el rango elegido
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mes</TableHead>
            <TableHead className="text-right">Despachos</TableHead>
            <TableHead className="text-right">Entregadas</TableHead>
            <TableHead className="text-right">Tasa proy.</TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
            <TableHead className="text-right">confirmado</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">ROAS est.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meses.map((m) => {
            const tasaProy = m.despachadas ? m.proyectadas / m.despachadas : 0;
            return (
              <TableRow key={m.month}>
                <TableCell className="font-medium capitalize">{monthLabel(m.month)}</TableCell>
                <TableCell className="text-right tabular-nums">{m.despachadas}</TableCell>
                <TableCell className="text-right tabular-nums">{m.entregadas}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.despachadas ? fmtPct(tasaProy) : "—"}</TableCell>
                <TableCell className={cn("text-right font-bold tabular-nums", pnlColor(m.profitEst))}>{fmtMoney(m.profitEst)}</TableCell>
                <TableCell className={cn("text-right tabular-nums", m.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(m.profitConf)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.ads ? fmtMoney(m.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.ads > 0 ? fmtRatio(m.revenueEst / m.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!meses.length && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Sin datos históricos
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      )}
    </main>
  );
}
