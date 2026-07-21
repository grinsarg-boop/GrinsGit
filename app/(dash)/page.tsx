import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import {
  DESDE as CASHFLOW_DESDE, FIXY_LAG_DIAS, conciliarGiros, fetchCobranzas, fixyCobranza, saldoUrbano,
  type GiroUrbano, type SobreFixy,
} from "@/lib/cashflow";
import { RitmoCouriers } from "@/components/ritmo-couriers";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { TIP_FLETE, TIP_COMIS, TIP_CONFIRMADO, TIP_ESTIMADO, TIP_PERCEP } from "@/lib/tips";

export const revalidate = 60; // R12

type Day = {
  date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number;
  ads: number; adsSinCohorte: number; flete: number; comisiones: number; percepciones: number;
};

type MonthAgg = {
  month: string; despachadas: number; entregadas: number; proyectadas: number;
  revenueEst: number; profitConf: number; profitEst: number; ads: number;
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
    flete: number; comisiones: number; ads: number; ads_sin_cohorte: number; percepciones: number;
  };
  const mapDay = (r: Row): Day => ({
    date: r.dispatch_date, despachadas: r.despachadas, entregadas: r.entregadas, resueltas: r.resueltas,
    proyectadas: Number(r.proyectadas),
    revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
    profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
    ads: Number(r.ads), adsSinCohorte: Number(r.ads_sin_cohorte),
    flete: Number(r.flete), comisiones: Number(r.comisiones), percepciones: Number(r.percepciones),
  });

  // Agregación server-side (dashboard_days, 009). El P&L por producto → /dia/[fecha].
  // dashboard_days devuelve de p_from hasta hoy; recorto el tope `to` acá (sin migración).
  const { data: rows } = await db.rpc("dashboard_days", { p_from: from, p_courier: courierParam });
  const list: Day[] = ((rows ?? []) as Row[]).map(mapDay).filter((d) => d.date <= to);

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

  // Saldo Urbano: lo que se le va a facturar, acumulado por MES CALENDARIO. Deliberadamente ignora el
  // rango del panel — sirve para presupuestar la factura, y con el preset "7 días" no diría nada útil.
  // daily_pnl.flete ya trae el costo final con el ×1,29 y ya aplica la regla no_despachado (018: los PI
  // de +7d no se facturan). flete_estimado_pct es la fracción de ese flete que todavía NO tiene factura.
  type SaldoMes = { mes: string; guias: number; total: number; estimado: number };
  let urbanoSaldo: SaldoMes[] = [];
  if (!courierParam || courierParam === "urbano") {
    const [ty, tm] = today.slice(0, 7).split("-").map(Number);   // ojo: ey/em se definen más abajo
    const desde3m = `${new Date(Date.UTC(ty, tm - 3, 1)).toISOString().slice(0, 7)}-01`;
    const { data: us } = await db.from("daily_pnl")
      .select("dispatch_date, despachadas, flete, flete_estimado_pct")
      .eq("courier", "urbano").gte("dispatch_date", desde3m);
    const m = new Map<string, SaldoMes>();
    for (const r of (us ?? []) as { dispatch_date: string; despachadas: number; flete: number; flete_estimado_pct: number | null }[]) {
      const k = r.dispatch_date.slice(0, 7);
      const a = m.get(k) ?? { mes: k, guias: 0, total: 0, estimado: 0 };
      const f = Number(r.flete ?? 0);
      a.guias += r.despachadas; a.total += f; a.estimado += f * Number(r.flete_estimado_pct ?? 0);
      m.set(k, a);
    }
    urbanoSaldo = [...m.values()].sort((a, b) => (a.mes < b.mes ? 1 : -1));
  }

  // A cobrar de Urbano: el COD que cobró en la puerta y todavía no giró. Ventana martes→lunes, giro el
  // martes siguiente, ya neto de la comisión de contrareembolso con impuestos (033, conciliado al centavo
  // contra la liquidación del 14/07). La agregación vive en SQL — son >1000 filas y PostgREST trunca ahí.
  type Cobranza = {
    ventana_ini: string; ventana_fin: string; fecha_pago: string;
    guias: number; cod_bruto: number; comision: number; neto: number;
  };
  // Desde el inicio de la caja (no 35 días): el saldo acumulado necesita TODAS las
  // ventanas vencidas desde que hay giros registrados. La tabla sigue mostrando 5.
  let cobranzaFull: Cobranza[] = [];
  let cobranza: Cobranza[] = [];
  if (!courierParam || courierParam === "urbano") {
    const { data: cb } = await db.rpc("urbano_cobranza", { p_desde: `${CASHFLOW_DESDE}-01` });
    cobranzaFull = (cb ?? []) as Cobranza[];
    cobranza = cobranzaFull.slice(0, 5);
  }

  // Conciliación contra la caja real (app Cashflow): giros de Urbano y sobres de Fixy. Si la
  // caja no responde, los bloques quedan sin conciliar — nunca puede tirar el home.
  let giros: GiroUrbano[] = [];
  let sobres: SobreFixy[] = [];
  try {
    if (!courierParam || courierParam === "urbano" || courierParam === "fixy") {
      ({ giros, sobres } = await fetchCobranzas());
    }
  } catch { /* caja caída: se muestra el panel sin conciliar */ }
  const conciliadas = new Map(
    conciliarGiros(cobranza.map((c) => ({ fecha_pago: c.fecha_pago, neto: Number(c.neto) })), giros, today)
      .map((v) => [v.fecha_pago, v]),
  );
  // La lectura que manda: saldo acumulado (todo lo vencido − todo lo girado). El diff
  // por ventana queda como detalle — Urbano paga partido y hace catch-up entre semanas.
  const saldoU = saldoUrbano(
    cobranzaFull.map((c) => ({ fecha_pago: c.fecha_pago, neto: Number(c.neto) })), giros, today);

  // A cobrar de Fixy: entregado neto (RPC 041) vs sobres cargados en la caja. Si la 041 no está
  // aplicada todavía, el bloque no se muestra (error → null).
  let fixyCob: ReturnType<typeof fixyCobranza> | null = null;
  if (!courierParam || courierParam === "fixy") {
    const { data: fc } = await db.rpc("fixy_cobranza", { p_desde: "2026-06-01" });
    const dias = (fc ?? []) as { dia: string; neto: number }[];
    if (dias.length) fixyCob = fixyCobranza(dias.map((d) => ({ dia: d.dia, neto: Number(d.neto) })), sobres, today);
  }

  // A liquidar de ML: neto pendiente de liberar en el MP (RPC 044), por semana de liberación.
  // ML retiene la plata ~28 días; el neto ya viene sin comisión, flete ni retenciones. Si la 044
  // no está aplicada, el bloque no se muestra (error → []).
  type MlLiq = { semana: string; pagos: number; neto: number };
  let mlLiq: MlLiq[] = [];
  if (!courierParam || courierParam === "ml") {
    const { data: mq } = await db.rpc("ml_a_liquidar");
    mlLiq = ((mq ?? []) as MlLiq[]).filter((w) => Number(w.neto) > 0);
  }

  // Vista MESES: agrupa los días DEL RANGO por mes (para todo el histórico, usá el preset "Máx").
  let meses: MonthAgg[] = [];
  if (vista === "meses") {
    const m = new Map<string, MonthAgg>();
    for (const d of list) {
      const k = d.date.slice(0, 7);
      const a = m.get(k) ?? { month: k, despachadas: 0, entregadas: 0, proyectadas: 0, revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, flete: 0, comisiones: 0, percepciones: 0 };
      a.despachadas += d.despachadas; a.entregadas += d.entregadas; a.proyectadas += d.proyectadas;
      a.revenueEst += d.revenueEst; a.profitConf += d.profitConf; a.profitEst += d.profitEst; a.ads += d.ads;
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
              : courier === "ml"
              ? "En MercadoLibre la venta ya está cobrada y la entrega la hace ML: no proyectamos nada, el estimado es igual al confirmado. La comisión (sale_fee) y el flete son los reales de cada orden; los envíos Flex sin liquidación cargada todavía cuentan flete $0 (ver % de flete estimado)."
              : "Es el confirmado (profit ya cerrado, neto de envío, comisiones, producto y Ads) más una proyección de las guías que siguen en la calle, usando tu tasa de entrega histórica por zona y producto. Por eso el número puede moverse hasta que todas las guías cierren."
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

      {/* Saldo Urbano: lo que se le adeuda por flete, por mes calendario. Cash planning, no P&L —
          por eso ignora el rango del panel y siempre muestra los últimos 3 meses. */}
      {urbanoSaldo.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Saldo Urbano
                <Tip tip="Flete que le debés a Urbano por las guías despachadas, con impuestos incluidos (tarifa × 1,29 = 21% IVA + 8% IIBB). Es el costo hundido: se paga por toda guía despachada, entregue o no. No incluye las guías que quedaron sin despachar (PI de +7 días), que Urbano no factura." />
              </span>
              <span className="text-xs text-muted-foreground">últimos 3 meses · independiente del rango de arriba</span>
            </div>

            {(() => {
              const abierto = urbanoSaldo.find((m) => m.estimado > 0.005 * m.total);
              return abierto ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2.5">
                  <div className="text-[0.7rem] uppercase tracking-wide text-amber-700 dark:text-amber-500">
                    A facturar · {monthLabel(abierto.mes)}
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
                    {fmtMoney(abierto.total)}
                  </div>
                  <div className="pt-0.5 text-xs text-muted-foreground">
                    {fmtMoney(abierto.total / 1.29)} de tarifa + {fmtMoney(abierto.total - abierto.total / 1.29)} de impuestos ·{" "}
                    {abierto.guias.toLocaleString("es-AR")} guías
                    {abierto.estimado >= 0.995 * abierto.total
                      ? " · estimado por promedio de zona, todavía sin factura"
                      : ` · ${fmtPct(abierto.estimado / abierto.total)} todavía sin factura`}
                  </div>
                </div>
              ) : null;
            })()}

            {/* El número accionable queda a la vista; el detalle mensual se despliega si hace falta. */}
            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-4 hover:underline">Ver los {urbanoSaldo.length} meses</span> <span className="inline-block text-xs transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">▾</span>
              </summary>
              <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mes</TableHead>
                  <TableHead className="text-right">Guías</TableHead>
                  <TableHead className="text-right">Tarifa neta</TableHead>
                  <TableHead className="text-right">Imp. 29%</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {urbanoSaldo.map((m) => {
                  const base = m.total / 1.29;
                  const pctEst = m.total ? m.estimado / m.total : 0;
                  return (
                    <TableRow key={m.mes}>
                      <TableCell className="font-medium capitalize">{monthLabel(m.mes)}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.guias.toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(base)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(m.total - base)}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(m.total)}</TableCell>
                      <TableCell className="text-right">
                        {pctEst < 0.005 ? (
                          <span className="rounded bg-muted px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-muted-foreground">facturado</span>
                        ) : pctEst > 0.995 ? (
                          <Tip tip="Ninguna guía de este mes tiene factura todavía. El monto sale del promedio de tarifa por provincia de los últimos 60 días, así que puede moverse cuando llegue la facturación real.">
                            <span className="rounded bg-amber-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-amber-700 dark:text-amber-500">estimado</span>
                          </Tip>
                        ) : (
                          <Tip tip={`${fmtPct(pctEst)} del flete de este mes todavía no tiene factura y está estimado por promedio de zona.`}>
                            <span className="rounded bg-amber-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-amber-700 dark:text-amber-500">
                              parcial {fmtPct(pctEst)}
                            </span>
                          </Tip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <p className="mt-3 text-xs text-muted-foreground">
              La facturación de Urbano llega con ~2 semanas de lag. Mientras no esté, el flete se estima con el promedio
              de tarifa por provincia; al importarla desde <Link href="/sync" className="underline underline-offset-2">Sync</Link> el
              monto se reemplaza por el real y el P&amp;L se recalcula.
            </p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* A cobrar de Urbano — espejo del anterior: lo que Urbano nos debe por el COD que cobró. */}
      {cobranza.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A cobrar de Urbano
                <Tip tip="COD que Urbano cobró en la puerta y todavía no giró. El ciclo es: ventana de entregas de martes a lunes, giro el martes siguiente, ya neto de la comisión de contrareembolso con impuestos (4,3% × 1,29). Verificado al centavo contra la liquidación del 14/07." />
              </span>
              <span className="text-xs text-muted-foreground">ventana martes → lunes · independiente del rango de arriba</span>
            </div>

            {(() => {
              const abierta = cobranza.find((c) => c.fecha_pago >= today);
              return abierta ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2.5">
                  <div className="text-[0.7rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                    A cobrar el {fmtDate(abierta.fecha_pago)}
                  </div>
                  <div className="text-2xl font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                    {fmtMoney(Number(abierta.neto))}
                  </div>
                  <div className="pt-0.5 text-xs text-muted-foreground">
                    {fmtMoney(Number(abierta.cod_bruto))} cobrados − {fmtMoney(Number(abierta.comision))} de comisión ·{" "}
                    {abierta.guias.toLocaleString("es-AR")} entregas ·{" "}
                    {abierta.ventana_fin >= today ? "la ventana todavía está abierta, cierra el " : "cerrada el "}
                    {fmtDate(abierta.ventana_fin)}
                  </div>
                </div>
              ) : null;
            })()}

            {/* La lectura que manda: acumulado vencido − girado. El diff por ventana es detalle. */}
            {saldoU && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  Saldo acumulado con Urbano
                  <Tip tip="Todo lo vencido según el panel desde que la caja registra giros, menos todo lo girado. Es EL número a reclamar: Urbano paga partido en varios giros y compensa faltantes en semanas siguientes, así que el % de una ventana suelta engaña (el giro del 21/07 vino +9,8% devolviendo faltantes de semanas anteriores). Si este saldo crece semana a semana, ahí sí hay reclamo." />
                </span>
                <span className={cn(
                  "font-semibold tabular-nums",
                  saldoU.saldo > 500_000 ? "text-amber-700 dark:text-amber-500" : "text-emerald-700 dark:text-emerald-500",
                )}>
                  {fmtMoney(saldoU.saldo)}
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  vencido desde el {fmtDate(saldoU.desde)}: {fmtMoney(saldoU.esperado)} − girado: {fmtMoney(saldoU.girado)}
                </span>
              </div>
            )}

            {/* Igual que arriba: a primera vista solo el giro pendiente, el histórico se despliega. */}
            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-4 hover:underline">Ver las últimas {cobranza.length} ventanas</span> <span className="inline-block text-xs transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">▾</span>
              </summary>
              <div className="mt-2">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ventana</TableHead>
                  <TableHead className="text-right">Entregas</TableHead>
                  <TableHead className="text-right">COD cobrado</TableHead>
                  <TableHead className="text-right">Comisión</TableHead>
                  <TableHead className="text-right">Giro neto</TableHead>
                  <TableHead className="text-right">
                    <span className="inline-flex items-center gap-1">
                      Cobrado (caja)
                      <Tip tip="Ingresos con categoría Urbano en la app Cashflow, asignados a la ventana cuyo martes de pago es el más reciente anterior al giro. OJO: el % de una ventana suelta engaña — Urbano paga partido y compensa faltantes en semanas siguientes (21/07: +9,8% devolviendo lo del 30/06 y 07/07). Para reclamar, mirá el 'Saldo acumulado' de arriba; esta columna es el detalle de cómo se repartió." />
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cobranza.map((c) => {
                  const pendiente = c.fecha_pago >= today;
                  return (
                    <TableRow key={c.ventana_ini}>
                      <TableCell className="font-medium tabular-nums">
                        {fmtDate(c.ventana_ini)} <span className="text-muted-foreground">→</span> {fmtDate(c.ventana_fin)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{c.guias.toLocaleString("es-AR")}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(c.cod_bruto))}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">−{fmtMoney(Number(c.comision))}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(Number(c.neto))}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(() => {
                          const conc = conciliadas.get(c.fecha_pago);
                          if (pendiente || !conc) return <span className="text-muted-foreground">—</span>;
                          if (conc.diff == null)
                            return <span className="text-xs text-muted-foreground">{conc.cobrado ? fmtMoney(conc.cobrado) : "sin registro"}</span>;
                          const ok = Math.abs(conc.diff) <= 0.03;
                          return (
                            <span className="inline-flex items-center gap-1.5">
                              {fmtMoney(conc.cobrado)}
                              <span className={cn(
                                "rounded px-1 py-px text-[0.6rem] tabular-nums",
                                ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500"
                                   : "bg-amber-500/15 text-amber-700 dark:text-amber-500",
                              )}>
                                {conc.diff >= 0 ? "+" : ""}{(conc.diff * 100).toFixed(1)}%
                              </span>
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        {pendiente ? (
                          <span className="rounded bg-emerald-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                            a cobrar {fmtDate(c.fecha_pago)}
                          </span>
                        ) : (
                          <span className="rounded bg-muted px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                            cobrado {fmtDate(c.fecha_pago)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <p className="mt-3 text-xs text-muted-foreground">
              Estimación <b className="text-foreground">conservadora</b>: contra el giro real del 14/07 este cálculo quedó
              1,2% por debajo, porque nuestra base todavía no tiene todas las entregas de la ventana. Urbano manda los
              resúmenes de transferencia incompletos y a veces paga en varios giros por la misma semana.
            </p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* A cobrar de Fixy: sobres físicos que viajan con el transportista + gap entregado-sin-sobre. */}
      {fixyCob && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A cobrar de Fixy
                <Tip tip={`Fixy rinde el COD en sobres físicos que viajan con el transportista y se cargan en la app Cashflow ("A cobrar"). Esperado = COD entregado neto del 1%, hasta hace ${FIXY_LAG_DIAS} días (lo más nuevo todavía no tiene sobre). El "sin sobre" es un TECHO de reclamo: incluye lo cobrado digital (QR/transferencia) que no pasa por sobre — si crece mes a mes, algo falta rendir o cargar.`} />
              </span>
              <span className="text-xs text-muted-foreground">contra los sobres cargados en la app Cashflow</span>
            </div>

            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-[0.7rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">Sobres por cobrar</div>
                <div className="text-2xl font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                  {fmtMoney(fixyCob.pendienteCobro)}
                </div>
                <div className="pt-0.5 text-xs text-muted-foreground">cargados en la caja, todavía sin cobrar</div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Entregado sin sobre (techo)</div>
                <div className={cn("text-2xl font-bold tabular-nums tracking-tight", fixyCob.gap > 0 ? "text-amber-600 dark:text-amber-500" : "")}>
                  {fmtMoney(fixyCob.gap)}
                </div>
                <div className="pt-0.5 text-xs text-muted-foreground">
                  {fmtMoney(fixyCob.esperadoNeto)} entregado neto (hasta hace {FIXY_LAG_DIAS} días, desde jun) − {fmtMoney(fixyCob.rendido)} en sobres
                </div>
              </div>
              <div>
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Último sobre</div>
                <div className="text-2xl font-bold tabular-nums tracking-tight">
                  {fixyCob.ultimoSobre ? fmtDate(fixyCob.ultimoSobre) : "—"}
                </div>
                {fixyCob.ultimoSobre && fixyCob.ultimoSobre < daysAgoIso(FIXY_LAG_DIAS) && (
                  <div className="pt-0.5 text-xs text-amber-600 dark:text-amber-500">hace más de {FIXY_LAG_DIAS} días — ¿falta cargar?</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A liquidar de ML: la plata retenida en el MP hasta la fecha de liberación (~28 días). */}
      {mlLiq.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A liquidar de ML
                <Tip tip="Ventas de MercadoLibre ya pagadas cuya plata todavía está retenida en el MercadoPago (MP Santi = MP DERMATECH). ML libera a ~28 días de la aprobación del pago. El neto ya viene descontado de comisión, flete y retenciones impositivas — es plata que cae tal cual. Verificado contra el detalle de liberaciones de MP." />
              </span>
              <span className="text-xs text-muted-foreground">libera en el MP a ~28 días · independiente del rango de arriba</span>
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <div className="text-[0.7rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                Pendiente de liberar
              </div>
              <div className="text-2xl font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
                {fmtMoney(mlLiq.reduce((s, w) => s + Number(w.neto), 0))}
              </div>
              <div className="pt-0.5 text-xs text-muted-foreground">
                {mlLiq.reduce((s, w) => s + w.pagos, 0).toLocaleString("es-AR")} ventas ·{" "}
                próxima liberación la semana del {fmtDate(mlLiq[0].semana)}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana de liberación</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Neto que libera</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mlLiq.map((w) => (
                  <TableRow key={w.semana}>
                    <TableCell className="font-medium tabular-nums">semana del {fmtDate(w.semana)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.pagos.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(Number(w.neto))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

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
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads ? fmtMoney(d.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ads > 0 ? fmtRatio(d.revenueEst / d.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
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
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.flete ? fmtMoney(m.flete) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.comisiones ? fmtMoney(m.comisiones) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.percepciones ? fmtMoney(m.percepciones) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{m.ads ? fmtMoney(m.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{m.ads > 0 ? fmtRatio(m.revenueEst / m.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!meses.length && (
            <TableRow>
              <TableCell colSpan={10} className="text-center text-muted-foreground">
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
