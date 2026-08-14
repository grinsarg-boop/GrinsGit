import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { Kpis } from "@/components/kpis";
import Link from "next/link";
import { Chispa } from "@/components/chispa";
import { Delta } from "@/components/delta";
import { ProyeccionMes, type PuntoAcum } from "@/components/proyeccion-mes";
import { Tendencia, type PuntoT } from "@/components/tendencia";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { mediaMovil } from "@/lib/tendencias";
import { breakEven } from "@/lib/breakeven";
import { SELECT_EVENTOS, type Evento } from "@/lib/eventos";
import { AvisoEventos } from "@/components/aviso-eventos";
import { pnlColor } from "@/lib/semaforo";
import { supabaseAdmin } from "@/lib/supabase";
import { PILL, PILL_OFF, PILL_ON } from "@/lib/ui";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Proyecciones y tendencias. No calcula plata nueva: series diarias de las MISMAS RPCs que /ventas
// (sales_days + sales_by_product) — TODO el panel cohortea por día de VENTA (pedido del dueño, 20/07:
// los días de despacho flacos meten 0%/100% de puro n chico). Media móvil + proyección de cierre a
// ritmo de los días maduros. Conservador a propósito: los últimos días se marcan inmaduros (van a
// MEJORAR al madurar, no es caída) y el run-rate los excluye.
type SalesDay = {
  sale_date: string; generadas: number; despachadas: number; entregadas: number;
  revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
  ads: number; ads_sin_cohorte: number;
};
type ProdWeek = { product: string; generadas: number; profit_estimado: number; ads: number };

const N = (v: number | null | undefined) => Number(v ?? 0);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

// La media móvil "de hoy" se toma en el último punto MADURO (fuera de la sombra) y se compara con la
// de 14 puntos antes: eso es la tendencia, sin contaminarla con días que todavía van a subir.
const maAt = (pts: PuntoT[], at: number, w = 7) => {
  if (at < w - 1 || at >= pts.length) return NaN;
  const m = mediaMovil(pts.slice(0, at + 1).map((p) => p.v), w);
  return m[at] ?? NaN;
};

export default async function Tendencias({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string; dias?: string }>;
}) {
  const { courier, dias } = await searchParams;
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const nDias = dias === "30" || dias === "60" || dias === "180" ? Number(dias) : 90;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;

  const [y, m] = today.slice(0, 7).split("-").map(Number);
  const mesStart = `${today.slice(0, 7)}-01`;
  const dom = Number(today.slice(8, 10));
  const diasMes = new Date(y, m, 0).getDate();
  const pmY = m === 1 ? y - 1 : y;
  const pmM = m === 1 ? 12 : m - 1;
  const pmStr = `${pmY}-${String(pmM).padStart(2, "0")}`;
  const prevStart = `${pmStr}-01`;
  const prevEnd = `${pmStr}-${String(new Date(pmY, pmM, 0).getDate()).padStart(2, "0")}`;

  const rangoFrom = daysAgoIso(nDias - 1);
  const pFrom = rangoFrom < prevStart ? rangoFrom : prevStart;

  // Por producto: ventanas semanales de 7 días hasta AYER (hoy está incompleto), cada una con su propia
  // llamada a sales_by_product — así no hay serie día×producto que pise el límite de 1000 filas de PostgREST.
  const nSemanas = Math.min(Math.floor(nDias / 7), 26);
  const semanas = Array.from({ length: nSemanas }, (_, k) => {
    const i = nSemanas - 1 - k; // de la más vieja a la más nueva
    return { from: daysAgoIso(7 * (i + 1)), to: daysAgoIso(7 * i + 1) };
  });

  const [{ data: sdRaw }, { data: evRaw }, ...weekly] = await Promise.all([
    db.rpc("sales_days", { p_from: pFrom, p_courier: courierParam }),
    db.from("eventos").select(SELECT_EVENTOS).lte("fecha", today),
    ...semanas.map((w) => db.rpc("sales_by_product", { p_from: w.from, p_to: w.to, p_courier: courierParam })),
  ]);
  // Blackouts anotados (065): las curvas los dibujan como marca, no como performance.
  const eventos = (evRaw ?? []) as Evento[];

  // neto = profit estimado − ads sin cohorte (mismo criterio que los totales de /ventas: esa pauta es
  // plata real gastada aunque no ancle a ninguna venta; con filtro de courier viene en 0 desde la RPC).
  const sd = ((sdRaw ?? []) as SalesDay[])
    .map((r) => ({
      date: r.sale_date, generadas: r.generadas ?? 0, despachadas: r.despachadas ?? 0,
      entregadas: r.entregadas ?? 0, ads: N(r.ads), sin: N(r.ads_sin_cohorte),
      revenueEst: N(r.revenue_estimado), profitEst: N(r.profit_estimado),
      neto: N(r.profit_estimado) - N(r.ads_sin_cohorte),
      netoConf: N(r.profit_confirmado) - N(r.ads_sin_cohorte),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---- proyección del mes ----
  // HOY queda afuera del acumulado: el día está incompleto y contarlo a medias sesga para abajo tanto
  // el acumulado como la comparación con el mes pasado. Hoy se proyecta entero, a ritmo (auditoría 20/07).
  const mes = sd.filter((d) => d.date >= mesStart && d.date < today);
  const prev = sd.filter((d) => d.date >= prevStart && d.date <= prevEnd);
  const acumAyer = mes.reduce((s, d) => s + d.neto, 0);
  const acumConf = mes.reduce((s, d) => s + d.netoConf, 0);
  // run-rate = promedio diario de los días "maduros" recientes: entre hace 18 y hace 5 días. Los últimos
  // 4 quedan afuera porque gran parte de sus ventas todavía ni despachó (aportan $0 por diseño §sales).
  const madDays = sd.filter((d) => d.date >= daysAgoIso(18) && d.date <= daysAgoIso(5));
  const ritmo = madDays.length ? madDays.reduce((s, d) => s + d.neto, 0) / madDays.length : 0;
  const cierre = acumAyer + ritmo * (diasMes - dom + 1); // hoy incluido: se proyecta entero
  const prevTotal = prev.reduce((s, d) => s + d.neto, 0);
  // "a esta altura" = mismos días completos que el acumulado (hasta ayer), para comparar peras con peras
  const prevMismaAltura = prev.filter((d) => Number(d.date.slice(8, 10)) <= dom - 1).reduce((s, d) => s + d.neto, 0);

  const acumular = (rows: typeof sd): PuntoAcum[] => {
    let s = 0;
    return rows.map((d) => ({ dom: Number(d.date.slice(8, 10)), acum: (s += d.neto) }));
  };
  const curvaActual = acumular(mes);
  const curvaPrevio = acumular(prev);
  const curvaProy: PuntoAcum[] = [{ dom: Math.max(dom - 1, 1), acum: acumAyer }, { dom: diasMes, acum: cierre }];

  // ---- series de tendencia (ventana elegida) ----
  // Hoy queda afuera: el día está incompleto (ads y ventas a medias) y dibuja un pozo falso al final.
  const rango = sd.filter((d) => d.date >= rangoFrom && d.date < today);
  const sProfit: PuntoT[] = rango.map((d) => ({ x: d.date, v: d.neto }));
  const sVentas: PuntoT[] = rango.map((d) => ({ x: d.date, v: d.generadas }));
  // CPA/ROAS sobre la pauta ASIGNADA del día (misma fórmula que la tabla diaria de /ventas). No se le
  // suma ads_sin_cohorte: es una corrección whole-business que se reparte por período, no pertenece a
  // un día puntual (y hasta la 037 venía contaminada con los ads de ML).
  const sCpa: PuntoT[] = rango.filter((d) => d.generadas > 0 && d.ads > 0).map((d) => ({ x: d.date, v: d.ads / d.generadas }));
  const sRoas: PuntoT[] = rango.filter((d) => d.ads > 0).map((d) => ({ x: d.date, v: d.revenueEst / d.ads }));
  // Tasa por día de VENTA, no de despacho: un día de despacho flaco (domingo con 2 guías) daba 0% o
  // 100% por puro n chico y arrastraba la media. El día de venta siempre tiene volumen sano (pedido del
  // dueño, 20/07: "no hay día en que se hayan generado pedidos de los cuales no se entregó ninguno").
  const sTasa: PuntoT[] = rango
    .filter((d) => d.despachadas > 0)
    .map((d) => ({ x: d.date, v: d.entregadas / d.despachadas }));

  const sombraDe = (pts: PuntoT[], horizonte: number) => pts.filter((p) => p.x > daysAgoIso(horizonte)).length;

  // Break-even del rango que se está mirando (Playbook-Faris §8). Es la línea contra la que se juzga
  // el CPA y el ROAS de cada día: sin ella el gráfico muestra la forma pero no si estuvo bien o mal.
  // Se calcula sobre los mismos días que las series (hoy afuera, incompleto) para que la línea y los
  // puntos hablen de lo mismo.
  const be = breakEven(rango.map((d) => ({
    generadas: d.generadas, revenueEst: d.revenueEst, ads: d.ads, profitEst: d.profitEst,
  })));

  // ---- tendencia por producto (semanal, sumando los couriers del filtro) ----
  const prodMap = new Map<string, { profit: number; gen: number; ads: number }[]>();
  weekly.forEach(({ data }, wi) => {
    ((data ?? []) as ProdWeek[]).forEach((r) => {
      const pts = prodMap.get(r.product) ?? semanas.map(() => ({ profit: 0, gen: 0, ads: 0 }));
      pts[wi].profit += N(r.profit_estimado);
      pts[wi].gen += r.generadas ?? 0;
      pts[wi].ads += N(r.ads);
      prodMap.set(r.product, pts);
    });
  });
  // headline = última semana ASENTADA (n-2); la última (n-1) todavía madura y solo va en el sparkline.
  // Ventas y CPA sí usan la última: quedan firmes el mismo día.
  const prodTend = [...prodMap.entries()]
    .filter(([, pts]) => pts.some((w) => w.gen > 0 || w.profit !== 0))
    .map(([name, pts]) => {
      const n = pts.length;
      const ult = pts[n - 1], cerrada = pts[n - 2], anterior = pts[n - 3];
      return {
        name,
        // apagado = sin ventas en las últimas 4 semanas: no hay decisión que tomar, no ocupa card
        activo: pts.slice(-4).some((w) => w.gen > 0),
        spark: pts.map((w, i) => ({ x: semanas[i].from, v: w.profit })),
        profitCerrada: cerrada.profit, profitAnterior: anterior.profit,
        ventas: ult.gen, ventasPrev: cerrada.gen,
        cpa: ult.gen > 0 ? ult.ads / ult.gen : NaN,
        cpaPrev: cerrada.gen > 0 ? cerrada.ads / cerrada.gen : NaN,
      };
    })
    .sort((a, b) => a.profitCerrada - b.profitCerrada); // lo que peor viene, primero
  const prodActivos = prodTend.filter((p) => p.activo);
  const prodApagados = prodTend.filter((p) => !p.activo).map((p) => p.name);

  const bloques: {
    titulo: string; tip: string; pts: PuntoT[]; kind: "money" | "num" | "pct" | "ratio";
    sombra: number; bueno: "sube" | "baja"; trazo: string; punto: string; deltaTipo: "money" | "num" | "pct";
    umbral?: { v: number; texto: string };
  }[] = [
    {
      titulo: "Profit por día de venta", kind: "money", pts: sProfit, sombra: sombraDe(sProfit, 10), bueno: "sube",
      trazo: "stroke-emerald-500", punto: "bg-emerald-500", deltaTipo: "money",
      tip: "Profit estimado de las ventas generadas cada día, neto de la pauta sin cohorte (igual que los totales de /ventas). Los días de la franja 'inmaduro' todavía tienen ventas sin despachar que aportan $0 por diseño: van a subir solos, no es caída.",
    },
    {
      titulo: "Ventas generadas por día", kind: "num", pts: sVentas, sombra: 0, bueno: "sube",
      trazo: "stroke-sky-500", punto: "bg-sky-500", deltaTipo: "num",
      tip: "Órdenes generadas por día (todas, se despachen o no). Este número queda firme el mismo día: acá no hay maduración.",
    },
    {
      titulo: "CPA de adquisición", kind: "money", pts: sCpa, sombra: sombraDe(sCpa, 2), bueno: "baja",
      trazo: "stroke-amber-500", punto: "bg-amber-500", deltaTipo: "money",
      umbral: isFinite(be.cpa) ? { v: be.cpa, texto: `break-even ${fmtMoney(be.cpa)}` } : undefined,
      tip: "Ads asignada del día ÷ ventas generadas ese día (misma fórmula que la tabla diaria de /ventas). El último día queda sombreado: la pauta de Meta termina de sincronizar unas horas después del cierre, y ese hueco se leería como un CPA buenísimo que no es. La pauta sin cohorte no entra: es una corrección whole-business por período, no de un día puntual. Ojo en 'Todos': si cambia la mezcla de productos, el CPA global se mueve sin que ninguna campaña haya cambiado — la referencia por producto vive en /analisis.",
    },
    {
      titulo: "Tasa de entrega por día de venta", kind: "pct", pts: sTasa, sombra: sombraDe(sTasa, 23), bueno: "sube",
      trazo: "stroke-violet-500", punto: "bg-violet-500", deltaTipo: "pct",
      tip: "De las ventas generadas cada día que llegaron a despacharse, cuántas se entregaron. Se cohortea por día de VENTA a propósito: por día de despacho, un domingo con 2 guías daba 0% o 100% de puro ruido y arrastraba la media. Madura en ~3 semanas (entrega 21 días + 1-2 de despacho): toda la franja sombreada va a subir sola — si la curva se aplana también fuera de la franja, ahí sí hay problema (o sync congelado). Ojo en 'Todos': si crece la parte de ML o Correo, la tasa global sube sin que Urbano haya mejorado — filtrá por canal para aislar.",
    },
    {
      titulo: "ROAS estimado", kind: "ratio", pts: sRoas, sombra: sombraDe(sRoas, 10), bueno: "sube",
      trazo: "stroke-rose-500", punto: "bg-rose-500", deltaTipo: "num",
      umbral: isFinite(be.mer) ? { v: be.mer, texto: `break-even ${fmtRatio(be.mer)}` } : undefined,
      tip: "Revenue estimado de las ventas del día ÷ ads asignada del día. El revenue de los días inmaduros todavía está subestimado (ventas sin despachar), así que la cola reciente tira para abajo — no leer ROAS real ahí adentro.",
    },
  ];

  const hrefWith = (o: { courier?: string; dias?: string }) => {
    const c = o.courier !== undefined ? o.courier : (courier ?? "");
    const d = o.dias !== undefined ? o.dias : String(nDias);
    const q = new URLSearchParams();
    if (c) q.set("courier", c);
    if (d !== "90") q.set("dias", d);
    const s = q.toString();
    return s ? `/tendencias?${s}` : "/tendencias";
  };

  const chip = (active: boolean) => cn(
    PILL,
    active ? PILL_ON
           : PILL_OFF,
  );

  const mesLabel = MESES[m - 1];
  const prevLabel = MESES[pmM - 1];

  return (
    <main className="space-y-6">
      <div className="space-y-1">
      {/* Todo este panel cohortea por día de VENTA, igual que /ventas y a diferencia del Resumen. */}
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Tendencias <span className="font-normal text-muted-foreground">· por día de <span className="font-semibold text-foreground">venta</span></span>
      </h1>
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Proyecciones y tendencias</b> — hacia dónde va el mes y hacia dónde van las curvas.</span>
        <Tip tip="Mismos números que /ventas, mirados en el tiempo: TODO el panel cohortea por día de VENTA (cuándo se generó el pedido), no de despacho. La media móvil de 7 días es la tendencia (el valor diario es ruido) y el cierre de mes se proyecta al ritmo de los días ya maduros. Conservador a propósito: no se le da crédito a mejoras que todavía no se midieron." />
      </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["30", "30 días"], ["60", "60 días"], ["90", "90 días"], ["180", "180 días"]].map(([val, label]) => (
            <Link key={val} href={hrefWith({ dias: val })}
                  aria-current={nDias === Number(val) ? "page" : undefined} className={chip(nDias === Number(val))}>{label}</Link>
          ))}
        </div>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"], ["ml", "ML"]].map(([val, label]) => (
            <Link key={val} href={hrefWith({ courier: val })}
                  aria-current={(courier ?? "") === val ? "page" : undefined} className={chip((courier ?? "") === val)}>{label}</Link>
          ))}
        </div>
      </div>

      <AvisoEventos from={rangoFrom} to={today} />

      {!sd.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin datos todavía.</CardContent></Card>
      ) : (
      <>
      {/* proyección del mes en curso */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Cierre proyectado de {mesLabel}
            <Tip tip={`Acumulado real hasta AYER + (hoy y los días que faltan × ritmo diario). Hoy no se cuenta a medias: el día incompleto se proyecta entero, a ritmo. El ritmo es el promedio de los días de hace 18 a hace 5: los últimos quedan afuera porque sus ventas todavía no despacharon y subestimarían. El acumulado igual tiende a ser piso, no techo — los días recientes siguen madurando para arriba. El profit del canal ML ya viene neto de percepciones IVA/IIBB (estimadas al ~18% hasta que el Reporte_Facturacion del mes las confirme en /sync).`} />
          </span>
          <Kpis items={[
            { label: "Cierre proyectado", value: fmtMoney(cierre), color: pnlColor(cierre),
              tip: `Acumulado hasta ayer + (hoy y los ${diasMes - dom} días que faltan) × ritmo. Es margen de contribución: NO incluye costos fijos (sueldos, estructura, packaging) — no es el bottom line del mes.`,
              pie: <>ritmo {fmtMoney(ritmo)}/día
                <Tip tip="Promedio diario del profit estimado de los días de hace 18 a hace 5 — ya maduros. Si el ritmo real de esta semana es mejor, la proyección se queda corta (conservadora a propósito)." />
              </> },
            { label: "Acumulado hasta ayer", value: fmtMoney(acumAyer), color: pnlColor(acumAyer),
              tip: "Profit ESTIMADO de las ventas del mes hasta ayer inclusive, neto de la pauta sin cohorte. Los días recientes todavía maduran para arriba: este número es piso, no techo.",
              pie: <>confirmado {fmtMoney(acumConf)}
                <Tip tip="La parte del acumulado que ya es plata firme (guías resueltas). El resto del estimado converge hacia acá a medida que las cohortes maduran." />
              </> },
            { label: `${prevLabel} a esta altura`, value: fmtMoney(prevMismaAltura),
              tip: `Los mismos días completos (1 al ${dom - 1}) de ${prevLabel}, que ya están asentados. Ojo con el Δ: ${prevLabel} es número final, el mes en curso todavía es estimado y tiende a quedarse corto — si da verde apenas, en realidad va mejor.`,
              delta: <Delta actual={acumAyer} previo={prevMismaAltura} /> },
            { label: `${prevLabel} cerró`, value: fmtMoney(prevTotal),
              tip: `Total de ${prevLabel} con la misma definición (margen de contribución, sin costos fijos). El Δ compara el CIERRE PROYECTADO contra ese total: cómo viene el mes contra el anterior si se sostiene el ritmo.`,
              delta: <Delta actual={cierre} previo={prevTotal} /> },
          ]} />
          <ProyeccionMes actual={curvaActual} proyeccion={curvaProy} previo={curvaPrevio}
                         diasMes={diasMes} mesLabel={mesLabel} prevLabel={prevLabel} />
        </CardContent>
      </Card>

      {/* tendencia por producto */}
      {prodActivos.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Tendencia por producto
              <Tip tip="Profit estimado por semana (ventanas de 7 días hasta ayer), sumando los canales del filtro. El número grande es la última semana ya asentada con su variación contra la anterior; el punto hueco del sparkline es la semana que todavía madura — va a subir sola, no es caída. Ventas y CPA sí son de la última semana (quedan firmes el mismo día). Ordenado de peor a mejor: lo que hay que mirar, arriba. Cada sparkline usa su propia escala — leé la forma; para comparar tamaños entre productos están los números." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{nSemanas} semanas · profit/semana</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prodActivos.map((p) => (
              <div key={p.name} className="sube space-y-1.5 rounded-lg bg-muted/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium">{p.name}</span>
                  <Tip tip={`Profit estimado de la semana asentada: ${fmtDate(semanas[nSemanas - 2].from)} → ${fmtDate(semanas[nSemanas - 2].to)} (el Δ de abajo es contra la semana anterior). Ventas y CPA son de la última semana (${fmtDate(semanas[nSemanas - 1].from)} → ${fmtDate(semanas[nSemanas - 1].to)}): firmes en ventas, todavía madurando en profit.`}>
                    <span className={cn("text-sm font-semibold tabular-nums", pnlColor(p.profitCerrada))}>{fmtMoney(p.profitCerrada)}</span>
                  </Tip>
                </div>
                <div><Delta actual={p.profitCerrada} previo={p.profitAnterior} /></div>
                <Chispa puntos={p.spark} positivo={p.profitCerrada >= 0} />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span className="tabular-nums">ventas {p.ventas.toLocaleString("es-AR")}/sem <Delta actual={p.ventas} previo={p.ventasPrev} tipo="num" /></span>
                  {isFinite(p.cpa) && (
                    <span className="tabular-nums">CPA {fmtMoney(p.cpa)}{" "}
                      {isFinite(p.cpaPrev) && <Delta actual={p.cpa} previo={p.cpaPrev} bueno="baja" />}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {prodApagados.length > 0 && (
            <p className="text-xs text-muted-foreground">Sin ventas en 4 semanas (apagados): {prodApagados.join(" · ")}</p>
          )}
        </CardContent>
      </Card>
      )}

      {/* tendencias */}
      {/* El break-even del rango, escrito una vez: las líneas punteadas de los gráficos de CPA y ROAS
          son este mismo número. Se mueve con la entrega, así que no es una constante de settings. */}
      {isFinite(be.cpa) && (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium uppercase tracking-wide">Break-even del rango</span>
          <span className="tabular-nums">CPA <b className="text-foreground">{fmtMoney(be.cpa)}</b></span>
          <span className="tabular-nums">MER <b className="text-foreground">{fmtRatio(be.mer)}</b></span>
          <span className="tabular-nums">contribución pre-pauta <b className="text-foreground">{fmtPct(be.tasa)}</b></span>
          <Tip tip="La línea contra la que se juzga cada día (Playbook-Faris §8). Contribución pre-pauta = profit estimado + pauta, o sea lo que queda de lo cobrado después de flete, comisiones, percepciones y producto, ANTES de gastar en ads. Break-even CPA = esa contribución ÷ ventas generadas: arriba de ese CPA cada venta nueva destruye plata. Break-even MER = 1 ÷ tasa de contribución. Se calcula sobre el rango elegido y no sobre un número fijo porque se mueve con la TASA DE ENTREGA mucho más que con cualquier decisión de puja: pasó de $8.768 en mayo a $14.276 en julio casi solo por eso. Ojo: los días recientes están inmaduros y bajan la contribución estimada, así que en rangos cortos el break-even sale conservador (más exigente de lo real)." />
        </div>
      )}

      {bloques.map((b) => {
        const iHoy = b.pts.length - 1 - b.sombra;
        const maHoy = maAt(b.pts, iHoy);
        const maAntes = maAt(b.pts, iHoy - 14);
        const fmtMa = b.kind === "money" ? fmtMoney(maHoy) : b.kind === "pct" ? fmtPct(maHoy) : b.kind === "ratio" ? fmtRatio(maHoy) : Math.round(maHoy).toLocaleString("es-AR");
        return (
          <Card key={b.titulo}>
            <CardContent className="space-y-3 pt-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {b.titulo}
                  <Tip tip={b.tip} />
                </span>
                {isFinite(maHoy) && (
                  <span className="flex items-baseline gap-2 text-xs tabular-nums text-muted-foreground">
                    media 7d <span className="font-semibold text-foreground">{fmtMa}</span>
                    {isFinite(maAntes) && <Delta actual={maHoy} previo={maAntes} tipo={b.deltaTipo} bueno={b.bueno} />}
                    <Tip tip={`La media móvil de 7 días tomada en el último punto ya MADURO (fuera de la franja sombreada), comparada con la misma media 14 días antes. Esa es la tendencia real de la curva; el color dice si mejora o empeora — en esta métrica, mejorar es ${b.bueno === "baja" ? "bajar" : "subir"}.`} />
                  </span>
                )}
              </div>
              <Tendencia puntos={b.pts} kind={b.kind} sombra={b.sombra} trazo={b.trazo} punto={b.punto}
                         umbral={b.umbral} eventos={eventos} label={`${b.titulo}, últimos ${nDias} días`} />
            </CardContent>
          </Card>
        );
      })}
      </>
      )}
    </main>
  );
}
