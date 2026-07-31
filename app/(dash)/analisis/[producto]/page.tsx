import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { Kpis } from "@/components/kpis";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Donut, type Slice } from "@/components/donut";
import { PackCourierBars } from "@/components/pack-courier-bars";
import { ChannelBars } from "@/components/channel-bars";
import { Delta } from "@/components/delta";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Subpágina de análisis POR PRODUCTO. El foco es el profit por PACK en un rango libre: el mismo corte
// del bloque Packs de /analisis pero sin el umbral de 40 guías (acá los buckets chicos se marcan con ~,
// no se esconden — eso pide la 049) y con mix de volumen y neto por guía. Los demás cortes del producto
// ya viven en /analisis?producto= — esta página no los duplica, linkea.
type PnlRow = {
  courier: string; product_id: number | null; product: string;
  despachadas: number; entregadas: number;
  revenue: number; flete: number; comisiones: number; costo_producto: number; ads: number; percepciones: number;
  profit_conf: number; profit_est: number;
};
type PackRow = {
  pack: number; guias: number; entregadas: number; devueltas: number; en_calle: number;
  cod_cobrado: number; flete: number;
  comisiones: number; costo_producto: number; margen_bruto: number; margen_neto: number;
  margen_neto_est: number;
};

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const N = (v: number | null | undefined) => Number(v ?? 0);

export default async function AnalisisProducto({ params, searchParams }: {
  params: Promise<{ producto: string }>;
  searchParams: Promise<{ courier?: string; desde?: string; hasta?: string }>;
}) {
  const { producto } = await params;
  if (!/^\d+$/.test(producto)) notFound();
  const id = Number(producto);
  const { courier, desde, hasta } = await searchParams;
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;

  // período anterior de igual largo, contiguo (mismo criterio que /analisis)
  const largoDias = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(prevTo) - (largoDias - 1) * 86400000).toISOString().slice(0, 10);

  const [{ data: pnlRaw }, { data: pnlPrevRaw }, { data: packRaw }, { data: cpaRef }, { data: prodsRaw },
         { data: packUrb }, { data: packFix }, { data: pnlAllRaw }] = await Promise.all([
    db.rpc("analisis_pnl", { p_from: from, p_to: to, p_courier: courierParam }),
    db.rpc("analisis_pnl", { p_from: prevFrom, p_to: prevTo, p_courier: courierParam }),
    db.rpc("analisis_packs", { p_from: from, p_to: to, p_courier: courierParam, p_producto: id, p_min: 1 }),
    db.from("settings").select("value").eq("key", "cpa_referencia").maybeSingle(),
    db.from("products").select("id, name").order("id"),
    // Contraste pack × courier: siempre los dos COD, sin importar el filtro de arriba (su punto es cruzar couriers).
    db.rpc("analisis_packs", { p_from: from, p_to: to, p_courier: "urbano", p_producto: id, p_min: 1 }),
    db.rpc("analisis_packs", { p_from: from, p_to: to, p_courier: "fixy", p_producto: id, p_min: 1 }),
    // CPA/guía del producto sin filtro de courier (el ads va por producto×día, mismo por celda).
    courierParam ? db.rpc("analisis_pnl", { p_from: from, p_to: to, p_courier: null }) : Promise.resolve({ data: null }),
  ]);
  const prods = (prodsRaw ?? []) as { id: number; name: string }[];
  const prod = prods.find((p) => p.id === id);
  if (!prod) notFound();
  // analisis_pnl ya viene por producto → filtro en el cliente, sin RPC extra (mismo truco que /analisis)
  const rows = ((pnlRaw ?? []) as PnlRow[]).filter((r) => r.product_id === id);
  const prev = ((pnlPrevRaw ?? []) as PnlRow[]).filter((r) => r.product_id === id);
  const packs = (packRaw ?? []) as PackRow[];
  const cpaObj = (cpaRef?.value ?? {}) as Record<string, { objetivo: number; maximo: number }>;

  const sumOf = (rs: PnlRow[], k: keyof PnlRow) => rs.reduce((s, r) => s + N(r[k] as number), 0);
  const revenue = sumOf(rows, "revenue"), flete = sumOf(rows, "flete"), comis = sumOf(rows, "comisiones");
  const percep = sumOf(rows, "percepciones"), costo = sumOf(rows, "costo_producto"), ads = sumOf(rows, "ads");
  const profitConf = sumOf(rows, "profit_conf"), profitEst = sumOf(rows, "profit_est");
  const despachos = sumOf(rows, "despachadas"), entregas = sumOf(rows, "entregadas");
  const tasa = despachos ? entregas / despachos : 0;
  const pRev = sumOf(prev, "revenue"), pProfitEst = sumOf(prev, "profit_est");
  const pDesp = sumOf(prev, "despachadas"), pEnt = sumOf(prev, "entregadas"), pAds = sumOf(prev, "ads");
  const pTasa = pDesp ? pEnt / pDesp : 0;
  const cpa = despachos ? ads / despachos : 0;
  const prevCpa = pDesp ? pAds / pDesp : 0;
  const ref = cpaObj[prod.name];
  const cpaEstado = !ref || !cpa ? null : cpa <= ref.objetivo ? "ok" : cpa <= ref.maximo ? "vig" : "mal";

  const composicion: Slice[] = [
    { label: "Flete", value: flete, className: "stroke-rose-500", dot: "bg-rose-500" },
    { label: "Ads", value: ads, className: "stroke-amber-500", dot: "bg-amber-500" },
    { label: "Comisiones", value: comis, className: "stroke-slate-400", dot: "bg-slate-400" },
    { label: "Percepciones ML", value: percep, className: "stroke-sky-400", dot: "bg-sky-400" },
    { label: "Costo de producto", value: costo, className: "stroke-violet-400", dot: "bg-violet-400" },
    { label: "Profit confirmado", value: Math.max(profitConf, 0), className: "stroke-emerald-500", dot: "bg-emerald-500" },
  ].filter((s) => s.value > 0);

  const totalPackGuias = packs.reduce((s, p) => s + p.guias, 0);
  // Ads por guía: los ads van por producto×día — el pack lo elige el cliente en el checkout — así que
  // cada guía carga el MISMO costo de adquisición: CPA del producto en el rango (sin ML, que no pasa por
  // este corte). profit_final = neto s/Ads − cpa × guías. Es asignación, no medición → columna ámbar.
  const rowsCod = rows.filter((r) => r.courier !== "ml");
  const despCod = sumOf(rowsCod, "despachadas");
  const cpaGuia = despCod ? sumOf(rowsCod, "ads") / despCod : 0;
  // la barra escala sobre el FINAL ESTIMADO (el titular, como en todo el dashboard)
  const maxPackM = Math.max(...packs.map((p) => Math.abs(N(p.margen_neto_est) - cpaGuia * p.guias)), 1);

  // Contraste pack × courier (Urbano vs Fixy). El ads/guía es el del PRODUCTO sin filtro (mismo por celda):
  // cuando hay filtro de courier arriba lo saco de pnlAllRaw; si no, pnlRaw ya es sin-filtro. Excluye ML,
  // igual que la tabla de packs. total = neto estimado del bucket − cpa×guías; est/guía = total ÷ guías.
  const allRowsProd = ((courierParam ? pnlAllRaw : pnlRaw) ?? []) as PnlRow[];
  const codProd = allRowsProd.filter((r) => r.product_id === id && r.courier !== "ml");
  const despCodProd = sumOf(codProd, "despachadas");
  const cpaGuiaProd = despCodProd ? sumOf(codProd, "ads") / despCodProd : 0;
  const packCells = (["urbano", "fixy"] as const).flatMap((courier) =>
    (((courier === "urbano" ? packUrb : packFix) ?? []) as PackRow[]).map((p) => {
      const adsP = cpaGuiaProd * p.guias;
      const total = N(p.margen_neto_est) - adsP;    // estimado (proyecta lo en la calle)
      const totalCerr = N(p.margen_neto) - adsP;    // cerrado (solo cobrado)
      return { pack: p.pack, courier, guias: p.guias, entrega: p.guias ? p.entregadas / p.guias : 0,
               total, estGuia: p.guias ? total / p.guias : 0,
               totalCerr, estGuiaCerr: p.guias ? totalCerr / p.guias : 0 };
    }),
  );

  // Contraste por canal (los 4): de dónde sale la plata del producto. analisis_pnl ya viene por
  // courier×producto y sin filtrar (allRowsProd) → una barra por canal presente.
  const canalRows = allRowsProd.filter((r) => r.product_id === id);
  const channelCells = (["urbano", "fixy", "correo", "ml"] as const).flatMap((courier) => {
    const rs = canalRows.filter((r) => r.courier === courier);
    if (!rs.length) return [];
    const profitEst = sumOf(rs, "profit_est");
    const desp = sumOf(rs, "despachadas");
    return [{ courier, profitEst, profitConf: sumOf(rs, "profit_conf"),
              despachos: desp, entrega: desp ? sumOf(rs, "entregadas") / desp : 0,
              estPorDesp: desp ? profitEst / desp : 0 }];
  });

  // querystring heredable: subpáginas hermanas, presets y volver a /analisis con el mismo estado
  const qs = (o: { courier?: string; desde?: string; hasta?: string } = {}) => {
    const c = o.courier !== undefined ? o.courier : (courier ?? "");
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const q = new URLSearchParams();
    if (c) q.set("courier", c);
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    const s = q.toString();
    return s ? `?${s}` : "";
  };
  const cortesHref = (() => {
    const q = new URLSearchParams(qs().slice(1));
    q.set("producto", String(id));
    return `/analisis?${q.toString()}`;
  })();

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

  const chip = (active: boolean) => cn(
    "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
    active ? "bg-foreground text-background shadow-sm hover:shadow"
           : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href={`/analisis${qs()}`} className="text-sm text-muted-foreground hover:text-foreground">← Análisis</Link>
          <h1 className="text-xl font-semibold">{prod.name}</h1>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {presets.map(([label, d, h]) => (
            <Link key={label} href={`/analisis/${id}${qs({ desde: d, hasta: h })}`}
                  aria-current={from === d && to === h ? "page" : undefined} className={chip(from === d && to === h)}>{label}</Link>
          ))}
        </div>
        <form method="get" className="inline-flex items-center gap-1.5">
          {courier && <input type="hidden" name="courier" value={courier} />}
          <input type="date" name="desde" defaultValue={from} max={to} aria-label="Desde"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground">→</span>
          <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-medium text-secondary-foreground transition-colors hover:bg-accent">Aplicar</button>
        </form>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"], ["ml", "ML"]].map(([val, label]) => (
            <Link key={val} href={`/analisis/${id}${qs({ courier: val })}`}
                  aria-current={(courier ?? "") === val ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                    (courier ?? "") === val ? "bg-foreground text-background shadow-sm hover:shadow"
                                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground")}>{label}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {prods.map((pr) => (
            <Link key={pr.id} href={`/analisis/${pr.id}${qs()}`}
                  aria-current={pr.id === id ? "page" : undefined} className={chip(pr.id === id)}>
              {pr.name}
            </Link>
          ))}
        </div>
      </div>

      {!rows.length && !packs.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin datos de {prod.name} en el rango elegido.</CardContent></Card>
      ) : (
      <>
      {rows.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              El producto en el rango
              <Tip tip="P&L del producto con las mismas reglas del panel, cohorte por día de DESPACHO (igual que /analisis). El Δ compara contra los mismos días inmediatamente anteriores (igual largo): verde mejora, rojo empeora — en CPA, bajar es mejorar." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">vs {fmtDate(prevFrom)} → {fmtDate(prevTo)}</span>
          </div>
          <Kpis items={[
            { label: "Profit estimado", value: fmtMoney(profitEst), color: pnlColor(profitEst),
              delta: <Delta actual={profitEst} previo={pProfitEst} />, pie: `confirmado ${fmtMoney(profitConf)}` },
            { label: "Cobrado", value: fmtMoney(revenue), delta: <Delta actual={revenue} previo={pRev} /> },
            { label: "Despachos", value: despachos.toLocaleString("es-AR"), delta: <Delta actual={despachos} previo={pDesp} tipo="num" />,
              pie: <>entrega {fmtPct(tasa)} <Delta actual={tasa} previo={pTasa} tipo="pct" className="ml-1" /></> },
            { label: "CPA (ads ÷ despachos)", value: cpa ? fmtMoney(cpa) : "—",
              color: cpaEstado === "ok" ? "text-emerald-600 dark:text-emerald-400"
                   : cpaEstado === "vig" ? "text-amber-600 dark:text-amber-500"
                   : cpaEstado === "mal" ? "text-destructive" : undefined,
              delta: <Delta actual={cpa} previo={prevCpa} bueno="baja" />,
              pie: ref ? `objetivo ${fmtMoney(ref.objetivo)} · máx ${fmtMoney(ref.maximo)}` : "sin referencia en el vault" },
          ]} />
        </CardContent>
      </Card>
      )}

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Profit por pack
              <Tip tip="Final ESTIMADO = el número para decidir: neto estimado − Ads. El neto estimado proyecta las guías en la calle con los mismos priors del panel (courier×provincia×producto): por cada una suma prior×COD×(1−comisión) − prior×costo; el flete no se proyecta porque ya está hundido completo. CERRADO = lo mismo sin proyección (cobrado solo de entregadas − todos los costos hundidos) — en rangos recientes castiga de más. Ads asignados por guía: van por producto y día, no por pack (el pack lo elige el cliente en el checkout), así que cada guía carga el CPA del producto en el rango (Meta, sin ML); es asignación, por eso la columna va en ámbar. Solo pedidos de una línea (con carrito mixto el pack no está definido), cohorte por día de DESPACHO, ML y Correo quedan afuera. Buckets con menos de 40 guías marcados con ~ (en /analisis se ocultan)." />
            </span>
            {totalPackGuias > 0 && <span className="text-xs tabular-nums text-muted-foreground">{totalPackGuias.toLocaleString("es-AR")} guías</span>}
          </div>
          {!packs.length ? (
            <p className="text-sm text-muted-foreground">
              Sin desglose por pack en el rango: este corte usa guías COD (Urbano/Fixy) de pedidos de una sola línea — ML y Correo quedan afuera.
            </p>
          ) : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Pack</TableHead><TableHead className="text-right">Guías</TableHead>
              <TableHead className="text-right">% vol</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
              <TableHead className="text-right">Margen bruto</TableHead>
              <TableHead className="text-right">Neto s/Ads</TableHead>
              <TableHead className="text-right">Ads</TableHead>
              <TableHead className="text-right text-amber-600 dark:text-amber-500">Final estimado</TableHead>
              <TableHead className="text-right">cerrado</TableHead>
              <TableHead className="text-right">Est./guía</TableHead><TableHead className="w-28" />
            </TableRow></TableHeader>
            <TableBody>
              {packs.map((p) => {
                const t = p.guias ? p.entregadas / p.guias : 0;
                const m = N(p.margen_neto);
                const me = N(p.margen_neto_est);
                const adsP = cpaGuia * p.guias;
                const f = m - adsP;      // final CERRADO
                const fe = me - adsP;    // final ESTIMADO (titular)
                return (
                  <TableRow key={p.pack}>
                    <TableCell className="font-medium">
                      ×{p.pack}
                      {p.guias < 40 && (
                        <span title="Menos de 40 guías: poco volumen, la tasa y el margen tienen ruido (en /analisis este bucket directamente se oculta)"
                              className="ml-1 cursor-help font-bold text-amber-600 dark:text-amber-500">~</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.guias.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(totalPackGuias ? p.guias / totalPackGuias : 0)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", t < 0.35 ? "text-destructive" : t < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400")}>{fmtPct(t)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(p.margen_bruto))}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", pnlColor(m))}>{fmtMoney(m)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{adsP ? fmtMoney(adsP) : "—"}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(fe))}
                               title={p.en_calle ? `${p.en_calle} guías en la calle, proyectadas con los priors del panel` : "sin guías en la calle: estimado = cerrado"}>{fmtMoney(fe)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", f < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(f)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", pnlColor(fe))}>{p.guias ? fmtMoney(fe / p.guias) : "—"}</TableCell>
                    <TableCell><div className="h-1.5 w-full rounded bg-muted"><div className={cn("barra h-1.5 rounded", fe >= 0 ? "bg-emerald-500" : "bg-destructive")} style={{ width: `${Math.abs(fe) / maxPackM * 100}%` }} /></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
          {packs.length > 0 && (
            <p className="text-xs text-muted-foreground">
              El titular es el <b>Final estimado</b> (cerrado + proyección de lo en-calle con los priors del panel — mismo criterio
              que el resto del dashboard); el cerrado queda al lado para ver cuánto ya es plata firme. En rangos muy recientes el
              estimado también es tentativo: madura en ~3 semanas.
            </p>
          )}
        </CardContent>
      </Card>

      {packCells.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Profit por pack y courier
              <Tip tip="El mismo profit del bloque de arriba, pero abierto por courier COD (Urbano vs Fixy) y expresado POR GUÍA — así se compara peral con peral entre packs y couriers, sin que el volumen lo tape. Altura = profit por guía (neto del bucket − CPA del producto, ÷ guías); verde/rojo por signo. Toggle Estimado (proyecta lo en la calle con los priors) / Cerrado (solo lo ya cobrado — deja ver dónde HOY hay pérdida real). El total, las guías y la entrega salen al pasar el mouse. Barras tenues = menos de 40 guías (por-guía ruidoso). ML y Correo no aparecen: no llevan guía COD por pack." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">por guía · Urbano vs Fixy</span>
          </div>
          <PackCourierBars data={packCells} />
          <p className="text-xs text-muted-foreground">
            Cada barra es un <b>pack en un courier</b>: comparás el mismo pack entre Urbano y Fixy, y los packs entre sí, por su rentabilidad
            unitaria (independiente del filtro de courier de arriba). Para la plata total de cada pack, mirá la tabla anterior.
          </p>
        </CardContent>
      </Card>
      )}

      {channelCells.length > 1 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Profit por canal
              <Tip tip="Los cuatro canales del producto contrastados: de dónde sale la plata. Altura = profit ESTIMADO total del producto en ese canal (volumen × margen) — complementa al bloque de packs, que mira la rentabilidad por guía. Despachos, entrega y est/despacho salen al pasar el mouse. Es el corte producto×canal completo: acá SÍ entran ML (prepago) y Correo, que no tienen desglose por pack." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">profit estimado · los 4 canales</span>
          </div>
          <ChannelBars data={channelCells} />
          <p className="text-xs text-muted-foreground">
            Dónde vive el profit de {prod.name} por canal (independiente del filtro de arriba). Para la rentabilidad por unidad de cada uno,
            el tooltip trae el est/despacho; el desglose fino por pack está en las barras de arriba (solo COD).
          </p>
        </CardContent>
      </Card>
      )}

      {rows.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              A dónde va cada peso de {prod.name}
              <Tip tip="Sobre el COD efectivamente cobrado del producto en el período. El flete es hundido: se paga por toda guía despachada, entregue o no. Percepciones ML solo si el producto vende por ese canal." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">cobrado {fmtMoney(revenue)}</span>
          </div>
          <Donut slices={composicion} centro={fmtPct(profitConf / (revenue || 1))} subcentro="queda" />
          {profitConf < 0 && <p className="text-xs text-destructive">Profit confirmado negativo en el período: los costos ya pagados superan lo cobrado hasta ahora. Con cohortes recientes es esperable — mirá el estimado.</p>}
        </CardContent>
      </Card>
      )}

      <p className="text-sm">
        <Link href={cortesHref} className="text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
          Todos los cortes de {prod.name} (zonas, desenlaces, maduración) en /analisis →
        </Link>
      </p>
      </>
      )}
    </main>
  );
}
