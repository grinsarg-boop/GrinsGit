import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import Link from "next/link";
import { Delta } from "@/components/delta";
import { ProyeccionMes, type PuntoAcum } from "@/components/proyeccion-mes";
import { Tendencia, type PuntoT } from "@/components/tendencia";
import { daysAgoIso, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { mediaMovil } from "@/lib/tendencias";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Proyecciones y tendencias. No calcula plata nueva: series diarias de las MISMAS RPCs que /ventas
// (sales_days, por día de venta) y / (dashboard_days, por cohorte de despacho), con media móvil y una
// proyección de cierre de mes a ritmo de los días maduros. Conservador a propósito: los últimos días
// se marcan inmaduros (van a MEJORAR al madurar, no es caída) y el run-rate los excluye.
type SalesDay = {
  sale_date: string; generadas: number; revenue_estimado: number;
  profit_confirmado: number; profit_estimado: number; ads: number; ads_sin_cohorte: number;
};
type DashDay = { dispatch_date: string; despachadas: number; entregadas: number };

const N = (v: number | null | undefined) => Number(v ?? 0);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

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

  const [{ data: sdRaw }, { data: ddRaw }] = await Promise.all([
    db.rpc("sales_days", { p_from: pFrom, p_courier: courierParam }),
    db.rpc("dashboard_days", { p_from: pFrom, p_courier: courierParam }),
  ]);

  // neto = profit estimado − ads sin cohorte (mismo criterio que los totales de /ventas: esa pauta es
  // plata real gastada aunque no ancle a ninguna venta; con filtro de courier viene en 0 desde la RPC).
  const sd = ((sdRaw ?? []) as SalesDay[])
    .map((r) => ({
      date: r.sale_date, generadas: r.generadas ?? 0, ads: N(r.ads), sin: N(r.ads_sin_cohorte),
      revenueEst: N(r.revenue_estimado),
      neto: N(r.profit_estimado) - N(r.ads_sin_cohorte),
      netoConf: N(r.profit_confirmado) - N(r.ads_sin_cohorte),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  // ---- proyección del mes ----
  const mes = sd.filter((d) => d.date >= mesStart);
  const prev = sd.filter((d) => d.date >= prevStart && d.date <= prevEnd);
  const acumHoy = mes.reduce((s, d) => s + d.neto, 0);
  const acumConf = mes.reduce((s, d) => s + d.netoConf, 0);
  // run-rate = promedio diario de los días "maduros" recientes: entre hace 18 y hace 5 días. Los últimos
  // 4 quedan afuera porque gran parte de sus ventas todavía ni despachó (aportan $0 por diseño §sales).
  const madDays = sd.filter((d) => d.date >= daysAgoIso(18) && d.date <= daysAgoIso(5));
  const ritmo = madDays.length ? madDays.reduce((s, d) => s + d.neto, 0) / madDays.length : 0;
  const cierre = acumHoy + ritmo * (diasMes - dom);
  const prevTotal = prev.reduce((s, d) => s + d.neto, 0);
  const prevMismaAltura = prev.filter((d) => Number(d.date.slice(8, 10)) <= dom).reduce((s, d) => s + d.neto, 0);

  const acumular = (rows: typeof sd): PuntoAcum[] => {
    let s = 0;
    return rows.map((d) => ({ dom: Number(d.date.slice(8, 10)), acum: (s += d.neto) }));
  };
  const curvaActual = acumular(mes);
  const curvaPrevio = acumular(prev);
  const curvaProy: PuntoAcum[] = [{ dom, acum: acumHoy }, { dom: diasMes, acum: cierre }];

  // ---- series de tendencia (ventana elegida) ----
  // Hoy queda afuera: el día está incompleto (ads y ventas a medias) y dibuja un pozo falso al final.
  const rango = sd.filter((d) => d.date >= rangoFrom && d.date < today);
  const sProfit: PuntoT[] = rango.map((d) => ({ x: d.date, v: d.neto }));
  const sVentas: PuntoT[] = rango.map((d) => ({ x: d.date, v: d.generadas }));
  const sCpa: PuntoT[] = rango.filter((d) => d.generadas > 0 && d.ads > 0).map((d) => ({ x: d.date, v: d.ads / d.generadas }));
  const sRoas: PuntoT[] = rango.filter((d) => d.ads > 0).map((d) => ({ x: d.date, v: d.revenueEst / d.ads }));
  const sTasa: PuntoT[] = ((ddRaw ?? []) as DashDay[])
    .filter((r) => r.dispatch_date >= rangoFrom && r.dispatch_date < today && (r.despachadas ?? 0) > 0)
    .sort((a, b) => (a.dispatch_date < b.dispatch_date ? -1 : 1))
    .map((r) => ({ x: r.dispatch_date, v: r.entregadas / r.despachadas }));

  const sombraDe = (pts: PuntoT[], horizonte: number) => pts.filter((p) => p.x > daysAgoIso(horizonte)).length;

  const bloques: {
    titulo: string; tip: string; pts: PuntoT[]; kind: "money" | "num" | "pct" | "ratio";
    sombra: number; bueno: "sube" | "baja"; trazo: string; punto: string; deltaTipo: "money" | "num" | "pct";
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
      titulo: "CPA de adquisición", kind: "money", pts: sCpa, sombra: 0, bueno: "baja",
      trazo: "stroke-amber-500", punto: "bg-amber-500", deltaTipo: "money",
      tip: "Ads del día ÷ ventas generadas ese día (misma fórmula que la tabla diaria de /ventas; acá sin la pauta sin cohorte, que no ancla a ventas). También queda firme el mismo día. La referencia por producto vive en /analisis.",
    },
    {
      titulo: "Tasa de entrega por cohorte de despacho", kind: "pct", pts: sTasa, sombra: sombraDe(sTasa, 14), bueno: "sube",
      trazo: "stroke-violet-500", punto: "bg-violet-500", deltaTipo: "pct",
      tip: "Entregadas ÷ despachadas de cada día de DESPACHO (dashboard_days, el mismo dato del Resumen). Una cohorte tarda ~2-3 semanas en madurar: la caída de la franja sombreada es maduración normal, no un derrumbe — si se aplana también fuera de la franja, ahí sí hay problema (o sync congelado).",
    },
    {
      titulo: "ROAS estimado", kind: "ratio", pts: sRoas, sombra: sombraDe(sRoas, 10), bueno: "sube",
      trazo: "stroke-rose-500", punto: "bg-rose-500", deltaTipo: "num",
      tip: "Revenue estimado de las ventas del día ÷ ads del día. El revenue de los días inmaduros todavía está subestimado (ventas sin despachar), así que la cola reciente tira para abajo.",
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
    "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
    active ? "bg-foreground text-background shadow-sm hover:shadow"
           : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );

  const mesLabel = MESES[m - 1];
  const prevLabel = MESES[pmM - 1];

  return (
    <main className="space-y-6">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <span><b className="text-foreground">Proyecciones y tendencias</b> — hacia dónde va el mes y hacia dónde van las curvas.</span>
        <Tip tip="Mismos números que /ventas y el Resumen, mirados en el tiempo: la media móvil de 7 días es la tendencia (el valor diario es ruido) y el cierre de mes se proyecta al ritmo de los días ya maduros. Conservador a propósito: no se le da crédito a mejoras que todavía no se midieron." />
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

      {!sd.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin datos todavía.</CardContent></Card>
      ) : (
      <>
      {/* proyección del mes en curso */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Cierre proyectado de {mesLabel}
            <Tip tip={`Acumulado real del mes + (días restantes × ritmo diario). El ritmo es el promedio de los días de hace 18 a hace 5 días: los últimos días quedan afuera porque sus ventas todavía no despacharon y subestimarían. El acumulado de hoy también tiende a subestimar por lo mismo — es el piso, no el techo.`} />
          </span>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sube rounded-lg bg-muted/40 p-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Cierre proyectado</div>
              <div className={cn("text-lg font-semibold tabular-nums", pnlColor(cierre))}>{fmtMoney(cierre)}</div>
              <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">ritmo {fmtMoney(ritmo)}/día</div>
            </div>
            <div className="sube rounded-lg bg-muted/40 p-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Acumulado hoy (día {dom})</div>
              <div className={cn("text-lg font-semibold tabular-nums", pnlColor(acumHoy))}>{fmtMoney(acumHoy)}</div>
              <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">confirmado {fmtMoney(acumConf)}</div>
            </div>
            <div className="sube rounded-lg bg-muted/40 p-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{prevLabel} a esta altura</div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(prevMismaAltura)}</div>
              <div className="pt-0.5"><Delta actual={acumHoy} previo={prevMismaAltura} /></div>
            </div>
            <div className="sube rounded-lg bg-muted/40 p-3">
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{prevLabel} cerró</div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(prevTotal)}</div>
              <div className="pt-0.5"><Delta actual={cierre} previo={prevTotal} /></div>
            </div>
          </div>
          <ProyeccionMes actual={curvaActual} proyeccion={curvaProy} previo={curvaPrevio}
                         diasMes={diasMes} mesLabel={mesLabel} prevLabel={prevLabel} />
        </CardContent>
      </Card>

      {/* tendencias */}
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
                  </span>
                )}
              </div>
              <Tendencia puntos={b.pts} kind={b.kind} sombra={b.sombra} trazo={b.trazo} punto={b.punto}
                         label={`${b.titulo}, últimos ${nDias} días`} />
            </CardContent>
          </Card>
        );
      })}
      </>
      )}
    </main>
  );
}
