import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { breakEven } from "@/lib/breakeven";
import { claseSemaforo, nivel, percentil } from "@/lib/semaforo";
import { RitmoCouriers } from "@/components/ritmo-couriers";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { TIP_FLETE, TIP_COMIS, TIP_CONFIRMADO, TIP_ESTIMADO, TIP_PERCEP } from "@/lib/tips";

export const revalidate = 60; // R12

type Day = {
  date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number;
  ads: number; adsMl: number; adsSinCohorte: number; flete: number; comisiones: number; percepciones: number;
};

type MonthAgg = {
  month: string; despachadas: number; entregadas: number; proyectadas: number;
  revenueEst: number; profitConf: number; profitEst: number; ads: number; adsMl: number;
  flete: number; comisiones: number; percepciones: number;
};


// Verde ganás / rojo perdés — el color hace el trabajo antes de leer el número.
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MES[+m - 1]} ${y}`; };

const COURIER_LABEL: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };
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
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;

  type Row = {
    dispatch_date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
    revenue_confirmado: number; revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
    flete: number; comisiones: number; ads: number; ads_sin_cohorte: number; percepciones: number; ads_ml: number;
  };
  const mapDay = (r: Row): Day => ({
    date: r.dispatch_date, despachadas: r.despachadas, entregadas: r.entregadas, resueltas: r.resueltas,
    proyectadas: Number(r.proyectadas),
    revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
    profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
    ads: Number(r.ads), adsMl: Number(r.ads_ml ?? 0), adsSinCohorte: Number(r.ads_sin_cohorte),
    flete: Number(r.flete), comisiones: Number(r.comisiones), percepciones: Number(r.percepciones),
  });

  // Agregación server-side (dashboard_days, 009). El P&L por producto → /dia/[fecha].
  // dashboard_days devuelve de p_from hasta hoy; recorto el tope `to` acá (sin migración).
  // Se pide desde el más viejo entre el rango elegido y 90 días atrás: con una sola llamada salen las
  // filas del panel Y la base del semáforo (F1-09), que se mide siempre sobre 90 días — el yardstick
  // no puede depender del preset que estés mirando.
  const baseFrom = from < daysAgoIso(90) ? from : daysAgoIso(90);
  const { data: rows } = await db.rpc("dashboard_days", { p_from: baseFrom, p_courier: courierParam });
  const todos: Day[] = ((rows ?? []) as Row[]).map(mapDay);
  const list: Day[] = todos.filter((d) => d.date >= from && d.date <= to);
  // p75 del ROAS diario de los últimos 90 días: el "así se ve un buen día tuyo", medido, no inventado.
  const p75Roas = percentil(
    todos.filter((d) => d.date >= daysAgoIso(90) && d.ads > 0).map((d) => d.revenueEst / d.ads), 0.75);

  // Tasa madura por courier (prior a nivel courier: province/product null) — para desarmar el sesgo del
  // blend en "Tasa proy." de la vista Todos: el promedio sube por ML (~100%) y Fixy, pero Urbano —el grueso—
  // entrega mucho menos. Es el mismo prior que el panel usa para proyectar; 3 filas, sin truncar.
  const priorByCourier = new Map<string, number>();
  if (!courierParam) {
    const { data: pr } = await db.from("delivery_priors")
      .select("courier, p_delivery").is("province", null).is("product_id", null);
    for (const r of (pr ?? []) as { courier: string; p_delivery: number }[]) priorByCourier.set(r.courier, Number(r.p_delivery));
  }

  // Flete Flex de ML sin cargar, por semana (solo en la vista ML o Todos). Las órdenes Flex
  // (self_service) con ship_cost null cuentan flete $0 hasta subir el xlsx de Santiago de esa semana.
  let flexPend: { semana: string; n: number }[] = [];
  if (!courierParam || courierParam === "ml") {
    const { data: fp } = await db.from("ml_orders").select("created_at")
      .eq("status", "paid").eq("ship_type", "self_service").is("ship_cost", null);
    const wk = (iso: string) => { const x = new Date(iso); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
    const m = new Map<string, number>();
    for (const r of (fp ?? []) as { created_at: string }[]) { const k = wk(r.created_at); m.set(k, (m.get(k) ?? 0) + 1); }
    flexPend = [...m.entries()].map(([semana, n]) => ({ semana, n })).sort((a, b) => (a.semana < b.semana ? 1 : -1));
  }

  // Vista MESES: agrupa los días DEL RANGO por mes (para todo el histórico, usá el preset "Máx").
  let meses: MonthAgg[] = [];
  if (vista === "meses") {
    const m = new Map<string, MonthAgg>();
    for (const d of list) {
      const k = d.date.slice(0, 7);
      const a = m.get(k) ?? { month: k, despachadas: 0, entregadas: 0, proyectadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsMl: 0, flete: 0, comisiones: 0, percepciones: 0 };
      a.despachadas += d.despachadas; a.entregadas += d.entregadas; a.proyectadas += d.proyectadas;
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
    return s ? `/?${s}` : "/";
  };

  // Link al día: hereda el filtro de courier (+ rango/vista, para que "Volver" reconstruya el panel).
  const diaHref = (date: string) => {
    const q = new URLSearchParams();
    if (courier) q.set("courier", courier);
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    if (vista === "meses") q.set("v", "meses");
    const s = q.toString();
    return s ? `/dia/${date}?${s}` : `/dia/${date}`;
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
    acc.ads += d.ads; acc.adsMl += d.adsMl; acc.adsSinCohorte += d.adsSinCohorte;
    return acc;
  }, { despachadas: 0, proyectadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsMl: 0, adsSinCohorte: 0 });
  // Sin cohorte se resta del profit y suma al denominador del ROAS (§4.6, #11).
  const rProfitEst = rango.profitEst - rango.adsSinCohorte;
  const rProfitConf = rango.profitConf - rango.adsSinCohorte;
  const rEnCamino = rProfitEst - rProfitConf;

  const adsAtrib = rango.ads;
  const adsSin = rango.adsSinCohorte;
  const adsTot = adsAtrib + adsSin;
  // Por fuente (F1-11): los Product Ads de ML son la parte de `ads` de las filas courier='ml'; todo el
  // resto —incluida la pauta sin cohorte, que sale de ad_spend— es Meta. Las dos suman el total exacto.
  const adsMl = rango.adsMl;
  // El split por fuente en las tablas solo aporta en "Todos": con filtro de courier es todo Meta o
  // todo ML, y una columna de ceros es peor que ninguna.
  const splitAds = !courierParam;
  const adsMeta = adsTot - adsMl;

  // Break-even MER del rango (Playbook-Faris §8, mismo cálculo que la línea punteada de /tendencias):
  // debajo de este ROAS el día no paga la pauta. Es el corte rojo del semáforo; el verde es el p75 de
  // 90 días. `generadas` no aplica acá — este panel cohortea por despacho, así que el CPA sale NaN y
  // no se usa.
  const be = breakEven(list.map((d) => ({ generadas: 0, revenueEst: d.revenueEst, ads: d.ads, profitEst: d.profitEst })));
  const cortesRoas: [number, number] = [be.mer, p75Roas];

  return (
    <main className="space-y-6">
      <div className="space-y-1">
      {/* El eje temporal en el título: este panel cohortea por día de DESPACHO y /ventas por día de
          VENTA. Vivía solo en tooltips, y confundir los dos ejes es el error caro de leer el panel. */}
      <h1 className="text-xl font-semibold">
        Resumen <span className="font-normal text-muted-foreground">· por día de <span className="font-semibold text-foreground">despacho</span></span>
      </h1>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Profit estimado</b> — lo que vas a ganar con lo ya despachado.</span>
        <Tip
          label="Cómo se calcula el profit estimado"
          tip={
            courier === "correo"
              ? "En Correo son cuotas 3 sin interés, prepago: lo confirmado ya está cobrado y no se anula, así que no proyectamos tasa de entrega. La métrica es la tasa de confirmación (pagados / generados) y el estimado es igual al confirmado."
              : courier === "ml"
              ? "En MercadoLibre la venta ya está cobrada y la entrega la hace ML: no proyectamos nada, el estimado es igual al confirmado. La comisión (sale_fee) y el flete son los reales de cada orden; los envíos Flex sin liquidación cargada todavía cuentan flete $0 (ver % de flete estimado)."
              : "Es el confirmado (profit ya cerrado, neto de envío, comisiones, producto y Ads) más una proyección de las guías que siguen en la calle, usando tu tasa de entrega histórica por zona y producto. Por eso el número puede moverse hasta que todas las guías cierren."
          }
        />
      </div>
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
                (courier ?? "") === val
                  ? "bg-foreground text-background shadow-sm hover:shadow"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
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
                vista === val
                  ? "bg-foreground text-background shadow-sm hover:shadow"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {flexPend.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
          <span className="font-medium">Flete Flex de ML sin cargar</span> — {flexPend.reduce((s, w) => s + w.n, 0)} órdenes cuentan flete $0 hasta subir la liquidación de Santiago (en <Link href="/sync" className="underline">Sync</Link>). Semanas: {flexPend.map((w) => `${fmtDate(w.semana)} (${w.n})`).join(" · ")}.
        </div>
      )}

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
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Tasa proy.
                {!courierParam && priorByCourier.size > 0 && (
                  <Tip tip={`Es el blend proyectado de TODOS los canales, y engaña: sube porque ML entrega ~100% y Fixy ~${fmtPct(priorByCourier.get("fixy") ?? 0)}. Urbano —que es el grueso de las guías— entrega ~${fmtPct(priorByCourier.get("urbano") ?? 0)} ya maduro (cohortes resueltas). El promedio tapa esa brecha; filtrá por courier arriba para ver cada uno sin mezcla.`} />
                )}
              </div>
              <div className="text-base font-semibold tabular-nums">{rango.despachadas ? fmtPct(rango.proyectadas / rango.despachadas) : "—"}</div>
              {!courierParam && priorByCourier.has("urbano") && (
                <div className="pt-0.5 text-[0.7rem] tabular-nums text-amber-600 dark:text-amber-500">
                  Urbano maduro {fmtPct(priorByCourier.get("urbano")!)}
                </div>
              )}
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
          {/* F1-11: por FUENTE, en columnas paralelas. Un cuarto de la pauta es MercadoLibre y hasta
              acá se leía fusionada con Meta en un solo número — dos plataformas con economías
              distintas (ML se puja por publicación, Meta por conjunto) que no se pueden mover igual. */}
          <div className="flex flex-wrap gap-x-8 gap-y-3 border-b pb-3">
            <div>
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                Meta
                <Tip tip="Pauta de Facebook/Instagram: la atribuida a cohortes más la que no ancló a ningún pedido. Es la que se maneja desde /anuncios." />
              </div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(adsMeta)}</div>
              <div className="text-xs text-muted-foreground">{adsTot ? fmtPct(adsMeta / adsTot) : "—"} del total</div>
            </div>
            <div>
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                MercadoLibre
                <Tip tip="Product Ads de MercadoLibre, con IVA, imputados a la publicación real desde la 062 (antes se prorrateaban por revenue y el profit por producto salía mentido). No pasan por ad_spend: por eso nunca entran a 'sin cohorte'." />
              </div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(adsMl)}</div>
              <div className="text-xs text-muted-foreground">{adsTot ? fmtPct(adsMl / adsTot) : "—"} del total</div>
            </div>
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

          <details className="group text-sm" data-slot="ads-explainer">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="underline-offset-4 hover:underline">Cómo se imputan los Ads</span> <span className="inline-block text-xs transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">▾</span>
            </summary>
            <div className="mt-2 space-y-1.5 border-l-2 pl-3 text-muted-foreground">
              <p>Cada gasto de Meta se asigna a un <b className="text-foreground">producto</b> por keyword del nombre del anuncio/campaña.</p>
              <p>El gasto del día por producto se <b className="text-foreground">reparte entre los canales</b> según los despachos de cada uno — Fixy pondera <b className="text-foreground">×1,4</b> (CPA más alto); Correo pondera por pedidos generados.</p>
              <p>Gasto sin producto (keyword no matcheó) o de un producto <b className="text-foreground">sin despachos ese día</b> → <span className="text-amber-600 dark:text-amber-500">sin cohorte</span>: plata real no atribuible a ninguna fila, se <b className="text-foreground">resta directo del profit</b> y suma al denominador del ROAS.</p>
            </div>
          </details>
        </CardContent>
      </Card>

      <RitmoCouriers courier={courierParam} />

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
                {courier === "correo" ? "Confirmación" : courier === "ml" ? "Entrega" : "Tasa hoy → final"}
                <Tip tip={courier === "correo"
                  ? "Pagados sobre generados. En prepago no proyectamos entrega, así que este valor no cambia."
                  : courier === "ml"
                  ? "En MercadoLibre la entrega la hace ML: contamos las ventas pagadas como entregadas (100%), sin proyección."
                  : "Izquierda: tasa de entrega real hasta ahora. Derecha: tasa final que proyectamos según tu histórico. Cuando el día madura, ambas se igualan."} />
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
                    <Tip tip="Product Ads de MercadoLibre (con IVA), imputados a la publicación real desde la 062. Es una pauta con otra economía: se puja por publicación y no pasa por ad_spend, así que nunca cae en 'sin cohorte'." />
                  </span>
                </TableHead>
              </>
            ) : (
              <TableHead className="text-right">Ads</TableHead>
            )}
            <TableHead className="text-right">
              <span className="inline-flex items-center gap-1">ROAS est.
                <Tip tip={`Revenue estimado dividido el gasto total en Ads. Cuánto facturás por cada peso invertido en publicidad.${
                  isFinite(be.mer)
                    ? ` El color es contra umbrales MEDIDOS, no inventados: rojo debajo del break-even del rango (${fmtRatio(be.mer)} — ahí el día no paga la pauta)${
                        isFinite(p75Roas) ? `, verde arriba de ${fmtRatio(p75Roas)}, que es el percentil 75 de tus propios días de los últimos 90` : ""}. Ojo con los días inmaduros: su revenue todavía está subestimado, así que empiezan pintados peor de lo que van a terminar.`
                    : ""
                }`} />
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
                  <Link href={diaHref(d.date)} className="font-medium underline-offset-4 group-hover:underline">
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
                {/* Semáforo contra umbral medido (F1-09): break-even del rango y p75 de 90 días. Los
                    días inmaduros quedan en gris — su revenue todavía sube, pintarlos sería mentir. */}
                <TableCell className={cn("text-right tabular-nums",
                  d.ads > 0 && !inmaduro ? claseSemaforo(nivel(d.revenueEst / d.ads, cortesRoas)) : "text-muted-foreground")}>
                  {d.ads > 0 ? fmtRatio(d.revenueEst / d.ads) : "—"}
                </TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={splitAds ? 12 : 11} className="text-center text-muted-foreground">
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
            <TableHead className="text-right">Envío <Tip tip={TIP_FLETE} /></TableHead>
            <TableHead className="text-right">Comis. <Tip tip={TIP_COMIS} /></TableHead>
            <TableHead className="text-right">Percep. <Tip tip={TIP_PERCEP} /></TableHead>
            {splitAds ? (
              <>
                <TableHead className="text-right">Ads Meta</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">Ads ML
                    <Tip tip="Product Ads de MercadoLibre (con IVA), imputados a la publicación real desde la 062. Es una pauta con otra economía: se puja por publicación y no pasa por ad_spend, así que nunca cae en 'sin cohorte'." />
                  </span>
                </TableHead>
              </>
            ) : (
              <TableHead className="text-right">Ads</TableHead>
            )}
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
                <TableCell className="text-right tabular-nums">{m.ads > 0 ? fmtRatio(m.revenueEst / m.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!meses.length && (
            <TableRow>
              <TableCell colSpan={splitAds ? 12 : 11} className="text-center text-muted-foreground">
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
