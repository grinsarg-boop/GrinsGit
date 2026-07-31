import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { AvisoEventos } from "@/components/aviso-eventos";
import { Chispa } from "@/components/chispa";
import { Delta } from "@/components/delta";
import { ProfitBars } from "@/components/profit-bars";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { breakEven } from "@/lib/breakeven";
import { claseSemaforo, nivel, percentil } from "@/lib/semaforo";
import { type Evento } from "@/lib/eventos";
import { RitmoCouriers } from "@/components/ritmo-couriers";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { TIP_ADS_ML, TIP_FLETE, TIP_COMIS, TIP_CONFIRMADO, TIP_ESTIMADO, TIP_PERCEP } from "@/lib/tips";

export const revalidate = 60;

// Panel espejo del Resumen, pero cohorteado por DÍA DE VENTA (orders.created_at ART) en vez de día de
// despacho. Responde: cada día que vendés, ¿cuánto vas a ganar con esas ventas y cuánto te costó generarlas?
type Day = {
  date: string; generadas: number; despachadas: number; entregadas: number; resueltas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number; ads: number; adsMl: number; adsSinCohorte: number;
  trabadas: number; flete: number; comisiones: number; percepciones: number;
};
type MonthAgg = {
  month: string; generadas: number; despachadas: number; entregadas: number;
  revenueEst: number; profitConf: number; profitEst: number; ads: number; adsMl: number;
  flete: number; comisiones: number; percepciones: number;
};

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");


const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MES[+m - 1]} ${y}`; };

// Tasa de entrega semanal por courier (RPC entrega_semanal, 064). La entrega tarda ~21 días en
// resolverse, así que las 3 últimas semanas todavía maduran.
type SemanaEnt = { semana: string; courier: string; despachadas: number; entregadas: number };
const MADURA_SEMANAS = 3;
const COURIER_NOMBRE: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };

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
    trabadas: number; revenue_confirmado: number; revenue_estimado: number; profit_confirmado: number;
    profit_estimado: number; flete: number; comisiones: number; ads: number; ads_sin_cohorte: number; percepciones: number; ads_ml: number;
  };
  type ProdRow = {
    courier: string; product_id: number | null; product: string;
    generadas: number; despachadas: number; resueltas: number; trabadas: number;
    revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
    flete: number; comisiones: number; ads: number; percepciones: number;
  };
  // Se pide desde el más viejo entre el rango elegido y 90 días atrás: una sola llamada trae las filas
  // del panel Y la base del semáforo (F1-09), que se mide siempre sobre 90 días — el umbral no puede
  // depender del preset que estés mirando.
  const baseFrom = from < daysAgoIso(90) ? from : daysAgoIso(90);
  const [{ data: rows }, { data: prodRows }, { data: entRaw }, { data: evRaw }] = await Promise.all([
    db.rpc("sales_days", { p_from: baseFrom, p_courier: courierParam }),
    db.rpc("sales_by_product", { p_from: from, p_to: to, p_courier: courierParam }),
    db.rpc("entrega_semanal", { p_desde: daysAgoIso(7 * 13) }),   // 13 semanas, sin filtro de courier
    db.from("eventos").select("id, fecha, fecha_fin, texto").lte("fecha", to),
  ]);
  const eventos = (evRaw ?? []) as Evento[];
  const todos: Day[] = ((rows ?? []) as Row[])
    .map((r): Day => ({
      date: r.sale_date, generadas: r.generadas, despachadas: r.despachadas, entregadas: r.entregadas,
      resueltas: r.resueltas, revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
      profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
      ads: Number(r.ads), adsMl: Number(r.ads_ml ?? 0), adsSinCohorte: Number(r.ads_sin_cohorte), trabadas: r.trabadas ?? 0,
      flete: Number(r.flete), comisiones: Number(r.comisiones), percepciones: Number(r.percepciones),
    }));
  const list: Day[] = todos.filter((d) => d.date >= from && d.date <= to);
  // p25 del CPA diario de 90 días: en CPA mejorar es bajar, así que el cuartil BUENO es el de abajo.
  const p25Cpa = percentil(
    todos.filter((d) => d.date >= daysAgoIso(90) && d.generadas > 0 && d.ads > 0).map((d) => d.ads / d.generadas), 0.25);

  let meses: MonthAgg[] = [];
  if (vista === "meses") {
    const m = new Map<string, MonthAgg>();
    for (const d of list) {
      const k = d.date.slice(0, 7);
      const a = m.get(k) ?? { month: k, generadas: 0, despachadas: 0, entregadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsMl: 0, flete: 0, comisiones: 0, percepciones: 0 };
      a.generadas += d.generadas; a.despachadas += d.despachadas; a.entregadas += d.entregadas;
      a.revenueEst += d.revenueEst; a.profitConf += d.profitConf; a.profitEst += d.profitEst; a.ads += d.ads; a.adsMl += d.adsMl;
      a.flete += d.flete; a.comisiones += d.comisiones; a.percepciones += d.percepciones;
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

  // Drill-down del día de venta: hereda courier + rango + vista (para reconstruir el panel al "Volver").
  const diaHref = (date: string) => {
    const q = new URLSearchParams();
    if (courier) q.set("courier", courier);
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    if (vista === "meses") q.set("v", "meses");
    const s = q.toString();
    return s ? `/ventas/${date}?${s}` : `/ventas/${date}`;
  };

  // Gráfico: profit cerrado (barra) + estimado (vela) por día, en orden cronológico (la tabla va al revés).
  const chartData = [...list].reverse().map((d) => ({ date: d.date, confirmado: d.profitConf, estimado: d.profitEst, href: diaHref(d.date) }));

  // Profit del rango POR PRODUCTO (suma los couriers del filtro activo). Sale de la misma base que el panel
  // (sales_rows), así que los totales cuadran. Ordenado de menor a mayor profit: lo deficitario primero.
  type ProdAgg = { product: string; generadas: number; despachadas: number; resueltas: number; trabadas: number; revEst: number; profitEst: number; profitConf: number; ads: number; flete: number; comisiones: number; percepciones: number };
  const porProducto: ProdAgg[] = [...((prodRows ?? []) as ProdRow[]).reduce((m, r) => {
    const g = m.get(r.product) ?? { product: r.product, generadas: 0, despachadas: 0, resueltas: 0, trabadas: 0, revEst: 0, profitEst: 0, profitConf: 0, ads: 0, flete: 0, comisiones: 0, percepciones: 0 };
    g.generadas += r.generadas; g.despachadas += r.despachadas; g.resueltas += r.resueltas; g.trabadas += r.trabadas;
    g.revEst += Number(r.revenue_estimado); g.profitEst += Number(r.profit_estimado);
    g.profitConf += Number(r.profit_confirmado); g.ads += Number(r.ads);
    g.flete += Number(r.flete); g.comisiones += Number(r.comisiones); g.percepciones += Number(r.percepciones);
    return m.set(r.product, g);
  }, new Map<string, ProdAgg>()).values()].sort((a, b) => a.profitEst - b.profitEst);

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
    acc.ads += d.ads; acc.adsMl += d.adsMl; acc.adsSinCohorte += d.adsSinCohorte;
    return acc;
  }, { generadas: 0, despachadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsMl: 0, adsSinCohorte: 0 });
  const rProfitEst = rango.profitEst - rango.adsSinCohorte;
  const rProfitConf = rango.profitConf - rango.adsSinCohorte;
  const rEnCamino = rProfitEst - rProfitConf;
  const adsTot = rango.ads + rango.adsSinCohorte;
  const cpa = rango.generadas ? adsTot / rango.generadas : 0;   // costo de adquisición por venta generada
  const roas = adsTot > 0 ? rango.revenueEst / adsTot : 0;

  // Break-even CPA del rango (Playbook-Faris §8): arriba de eso cada venta nueva destruye plata. Es el
  // corte rojo del semáforo del CPA diario; el verde es el p25 de 90 días.
  const be = breakEven(list.map((d) => ({ generadas: d.generadas, revenueEst: d.revenueEst, ads: d.ads, profitEst: d.profitEst })));
  const cortesCpa: [number, number] = [be.cpa, p25Cpa];

  // Ads por FUENTE (F1-11): los Product Ads de ML son la parte de `ads` de las filas courier='ml';
  // todo el resto —incluida la pauta sin cohorte, que sale de ad_spend— es Meta. Suman el total exacto.
  // El split en las tablas solo aporta en "Todos": con filtro de courier es todo Meta o todo ML.
  const adsMl = rango.adsMl;
  const adsMeta = adsTot - adsMl;
  const splitAds = !courierParam;

  // F1-13 · small multiples de la tasa de entrega por courier, ESCALA COMPARTIDA 0-100%. Acá compartir
  // eje sí corresponde —es la misma métrica en el mismo rango— y es justamente lo que hay que ver: la
  // tasa "global" del panel sube cuando crece la parte de ML (~100%) sin que Urbano haya mejorado.
  // Con eje propio cada card mentiría diciendo que todos se mueven parecido.
  //
  // La entrega madura ~21 días, así que las 3 últimas semanas van huecas: van a SUBIR solas. El número
  // grande de cada card es la última semana ya firme.
  const semanasEnt = [...new Set(((entRaw ?? []) as SemanaEnt[]).map((r) => r.semana))].sort().slice(1); // la 1ª viene cortada
  const entPorCourier = ["urbano", "fixy", "correo", "ml"].map((c) => {
    const porSemana = new Map(((entRaw ?? []) as SemanaEnt[]).filter((r) => r.courier === c).map((r) => [r.semana, r]));
    // Un courier que no despachó alguna semana del rango queda afuera: dibujar el hueco como si fuera
    // un punto más correría el eje del tiempo y la forma sería falsa.
    const pts = semanasEnt.map((s) => porSemana.get(s));
    if (pts.some((p) => !p || p.despachadas < 1)) return null;
    const serie = pts.map((p, i) => ({ x: semanasEnt[i], v: p!.entregadas / p!.despachadas }));
    const iFirme = Math.max(serie.length - 1 - MADURA_SEMANAS, 0);
    return {
      courier: c, serie,
      firme: serie[iFirme]?.v ?? NaN, previa: serie[iFirme - 1]?.v ?? NaN,
      guiasFirme: pts[iFirme]!.despachadas,
    };
  }).filter((x): x is NonNullable<typeof x> => x !== null && x.serie.length >= 3);

  return (
    <main className="space-y-6">
      <div className="space-y-1">
      {/* El eje va en el título: el Resumen cohortea por día de DESPACHO y este panel por día de
          VENTA. Estaba solo en el tooltip, que ya no necesita gastar su primera mitad en decirlo. */}
      <h1 className="text-xl font-semibold">
        Ventas <span className="font-normal text-muted-foreground">· por día de <span className="font-semibold text-foreground">venta</span></span>
      </h1>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Profit por día de venta</b> — lo que vas a ganar con las ventas que generaste cada día.</span>
        <Tip
          label="Para qué sirve mirarlo por día de venta"
          tip="Sirve para medir el costo de adquisición: gastaste $X en Ads el día D y generaste N ventas. El profit de una venta COD se materializa cuando la guía se despacha y entrega, así que los días de venta muy recientes maduran a medida que despachás — mirá la barra de despacho."
        />
      </div>
      </div>

      <AvisoEventos from={from} to={to} />

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
                  "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                  active ? "bg-foreground text-background shadow-sm hover:shadow" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
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
                "rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                (courier ?? "") === val ? "bg-foreground text-background shadow-sm hover:shadow" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
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
                "rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                vista === val ? "bg-foreground text-background shadow-sm hover:shadow" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {vista === "dias" && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Profit por día de venta · <span className="normal-case tabular-nums">{rangeLabel}</span>
              </span>
              <span className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500/85" /> cerrado +</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive/85" /> cerrado −</span>
                <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-0.5 bg-muted-foreground/60" /> estimado</span>
              </span>
            </div>
            <ProfitBars data={chartData} eventos={eventos} />
            <p className="text-xs text-muted-foreground">La barra es el profit ya <b className="text-foreground">cerrado</b> (cobrado) de las ventas de ese día; la vela gris llega hasta el <b className="text-foreground">estimado</b>. Tocá un día para ver el detalle.</p>
          </CardContent>
        </Card>
      )}

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
              {adsTot > 0 && (
                <div className="pt-0.5 text-[0.7rem] tabular-nums text-muted-foreground">
                  Meta {fmtMoney(adsMeta)} · ML {fmtMoney(adsMl)}
                </div>
              )}
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS est.</div>
              <div className="text-base font-semibold tabular-nums">{roas > 0 ? fmtRatio(roas) : "—"}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {porProducto.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Profit por producto · <span className="normal-case tabular-nums">{rangeLabel}</span>
              </span>
              <span className="text-xs text-muted-foreground">de menor a mayor profit — lo que va a pérdida, primero</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Generadas</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">Resolución
                      <Tip tip="Ventas con desenlace definitivo (cobradas o perdidas) sobre las generadas del producto." />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Envío <Tip tip={TIP_FLETE} /></TableHead>
                  <TableHead className="text-right">Comis. <Tip tip={TIP_COMIS} /></TableHead>
            <TableHead className="text-right">Percep. <Tip tip={TIP_PERCEP} /></TableHead>
                  <TableHead className="text-right">Ads</TableHead>
                  <TableHead className="text-right">CPA</TableHead>
                  <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
                  <TableHead className="text-right">cerrado</TableHead>
                  <TableHead className="text-right">ROAS est.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {porProducto.map((p) => {
                  const resPct = p.generadas ? p.resueltas / p.generadas : 0;
                  const cpaP = p.generadas ? p.ads / p.generadas : 0;
                  return (
                    <TableRow key={p.product} className="hover:bg-accent/40">
                      <TableCell className="font-medium">
                        {p.product}
                        {p.trabadas > 0 && (
                          <span className="ml-1.5 cursor-help font-bold text-orange-500"
                                title={`${p.trabadas} ${p.trabadas === 1 ? "pedido de este producto sigue" : "pedidos de este producto siguen"} en la calle sin movimiento hace +2 semanas`}>!</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.generadas}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(resPct)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.flete ? fmtMoney(p.flete) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.comisiones ? fmtMoney(p.comisiones) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{p.percepciones ? fmtMoney(p.percepciones) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{p.ads ? fmtMoney(p.ads) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{cpaP > 0 ? fmtMoney(cpaP) : "—"}</TableCell>
                      <TableCell className={cn("text-right font-bold tabular-nums", pnlColor(p.profitEst))}>{fmtMoney(p.profitEst)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", p.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(p.profitConf)}</TableCell>
                      <TableCell className="text-right tabular-nums">{p.ads > 0 ? fmtRatio(p.revEst / p.ads) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* F1-13 · tasa de entrega por courier, small multiples con EJE COMPARTIDO 0-100% */}
      {entPorCourier.length > 1 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Tasa de entrega por courier
                <Tip tip={`Entregadas ÷ despachadas por semana de VENTA, ${semanasEnt.length} semanas. Los cuatro gráficos comparten el eje 0-100% a propósito: son la misma métrica en el mismo rango, y la comparación de NIVEL es el punto — la tasa "global" del panel sube cuando crece la parte de ML (entrega ~100%) o Correo sin que Urbano haya mejorado un punto. Como el eje es compartido, el movimiento semana a semana de Urbano y Fixy se ve chico: para eso está el Δ al lado del número. Los ${MADURA_SEMANAS} últimos puntos van huecos — la entrega tarda ~21 días en resolverse, así que van a SUBIR solos. El número grande es la última semana ya firme.`} />
              </span>
              <span className="text-xs text-muted-foreground">eje compartido 0-100% · última semana firme</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {entPorCourier.map((e) => (
                <div key={e.courier} className="sube space-y-1.5 rounded-lg bg-muted/40 p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">{COURIER_NOMBRE[e.courier] ?? e.courier}</span>
                    <span className="text-sm font-semibold tabular-nums">{fmtPct(e.firme)}</span>
                  </div>
                  <div className="flex items-baseline gap-2 text-xs">
                    <Delta actual={e.firme} previo={e.previa} tipo="pct" />
                    <span className="tabular-nums text-muted-foreground">{e.guiasFirme.toLocaleString("es-AR")} guías</span>
                  </div>
                  <Chispa puntos={e.serie} positivo min={0} max={1} pendientes={MADURA_SEMANAS}
                          fmt={fmtPct} unidad={`Tasa de entrega ${COURIER_NOMBRE[e.courier] ?? e.courier}`} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* correo/ml no están en la RPC (sin guía en calle) → con ese filtro la franja no aparece */}
      <RitmoCouriers courier={courierParam} />

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
              <span className="inline-flex items-center gap-1">Resolución
                <Tip tip="Qué porcentaje de las ventas de ese día ya tienen un desenlace definitivo: cobradas (entregadas) o perdidas (devueltas, rehusadas, o sin despachar a esta altura). Los pedidos en tránsito o sin guía recientes NO cuentan como resueltos. A más resolución, más firme el número — un día con 100% ya está cerrado." />
              </span>
            </TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">
              <span className="inline-flex items-center gap-1">Profit estimado
                <Tip tip={TIP_ESTIMADO} />
              </span>
            </TableHead>
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">confirmado
                <Tip tip={TIP_CONFIRMADO} />
              </span>
            </TableHead>
            <TableHead className="text-right">Envío <Tip tip={TIP_FLETE} /></TableHead>
            <TableHead className="text-right">Comis. <Tip tip={TIP_COMIS} /></TableHead>
            <TableHead className="text-right">Percep. <Tip tip={TIP_PERCEP} /></TableHead>
            {splitAds ? (
              <>
                <TableHead className="text-right">Ads Meta</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">Ads ML
                    <Tip tip={TIP_ADS_ML} />
                  </span>
                </TableHead>
              </>
            ) : (
              <TableHead className="text-right">Ads</TableHead>
            )}
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">CPA
                <Tip tip={`Gasto en Ads del día dividido las ventas generadas ese día. El costo de adquisición real por venta.${
                  isFinite(be.cpa)
                    ? ` El color es contra umbrales MEDIDOS, no inventados: rojo arriba del break-even del rango (${fmtMoney(be.cpa)} — ahí cada venta nueva destruye plata)${
                        isFinite(p25Cpa) ? `, verde debajo de ${fmtMoney(p25Cpa)}, que es el percentil 25 de tus propios días de los últimos 90` : ""}. El break-even se mueve con la tasa de entrega mucho más que con la puja, por eso se calcula sobre el rango y no es una constante.`
                    : ""
                }`} />
              </span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            // Resolución = ventas con desenlace definitivo / generadas. Firmes: entregadas/devueltas/rehusadas
            // (d.resueltas). A los 7 días, las que siguen sin despacharse ya no van a salir → cuentan como
            // perdidas (resueltas). Las en tránsito o sin guía recientes NO cuentan (aún pueden cambiar).
            const diasCohorte = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d.date}T00:00:00Z`)) / 86400000);
            const resueltos = d.resueltas + (diasCohorte >= 7 ? Math.max(d.generadas - d.despachadas, 0) : 0);
            const resPct = d.generadas ? resueltos / d.generadas : 0;
            const madurez = resPct;
            const inmaduro = madurez < 0.8;
            const cpaDia = d.generadas ? d.ads / d.generadas : 0;
            return (
              <TableRow key={d.date} className="group hover:bg-accent/40">
                <TableCell>
                  <Link href={diaHref(d.date)} className="font-medium underline-offset-4 group-hover:underline">
                    {fmtDate(d.date)}
                    <span className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100">→</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.generadas}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[74px] flex-none rounded bg-muted">
                      <div className="h-1.5 rounded bg-foreground" style={{ width: `${Math.min(resPct, 1) * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtPct(resPct)}</span>
                    {d.trabadas > 0 && (
                      <Tip
                        label="Pedidos trabados"
                        tip={`${d.trabadas} ${d.trabadas === 1 ? "pedido sigue" : "pedidos siguen"} en la calle sin ningún movimiento de estado hace más de 2 semanas. No debería pasar: reclamalos a la logística — hasta que se resuelvan, este día no cierra.`}
                      >
                        <span className="cursor-help font-bold text-orange-500" aria-label={`${d.trabadas} pedidos trabados`}>!</span>
                      </Tip>
                    )}
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
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.flete ? fmtMoney(d.flete) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.comisiones ? fmtMoney(d.comisiones) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.percepciones ? fmtMoney(d.percepciones) : "—"}</TableCell>
                {splitAds ? (
                  <>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads - d.adsMl ? fmtMoney(d.ads - d.adsMl) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{d.adsMl ? fmtMoney(d.adsMl) : "—"}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads ? fmtMoney(d.ads) : "—"}</TableCell>
                )}
                {/* Semáforo contra umbral medido (F1-09). El CPA queda firme el mismo día —no madura—
                    así que acá sí se pinta siempre que haya ventas y pauta. */}
                <TableCell className={cn("text-right tabular-nums", cpaDia > 0 ? claseSemaforo(nivel(cpaDia, cortesCpa, "baja")) : "text-muted-foreground")}>
                  {cpaDia > 0 ? fmtMoney(cpaDia) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={splitAds ? 11 : 10} className="text-center text-muted-foreground">Sin ventas en el rango elegido</TableCell>
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
            <TableHead className="text-right">Envío <Tip tip={TIP_FLETE} /></TableHead>
            <TableHead className="text-right">Comis. <Tip tip={TIP_COMIS} /></TableHead>
            <TableHead className="text-right">Percep. <Tip tip={TIP_PERCEP} /></TableHead>
            {splitAds ? (
              <>
                <TableHead className="text-right">Ads Meta</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">Ads ML
                    <Tip tip={TIP_ADS_ML} />
                  </span>
                </TableHead>
              </>
            ) : (
              <TableHead className="text-right">Ads</TableHead>
            )}
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
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.flete ? fmtMoney(m.flete) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.comisiones ? fmtMoney(m.comisiones) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.percepciones ? fmtMoney(m.percepciones) : "—"}</TableCell>
                {splitAds ? (
                  <>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{m.ads - m.adsMl ? fmtMoney(m.ads - m.adsMl) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{m.adsMl ? fmtMoney(m.adsMl) : "—"}</TableCell>
                  </>
                ) : (
                  <TableCell className="text-right tabular-nums text-muted-foreground">{m.ads ? fmtMoney(m.ads) : "—"}</TableCell>
                )}
                <TableCell className="text-right tabular-nums text-muted-foreground">{cpaMes > 0 ? fmtMoney(cpaMes) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!meses.length && (
            <TableRow>
              <TableCell colSpan={splitAds ? 11 : 10} className="text-center text-muted-foreground">Sin datos históricos</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      )}
    </main>
  );
}
