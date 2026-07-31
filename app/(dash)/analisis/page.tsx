import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import { Kpis } from "@/components/kpis";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Donut, PALETA, type Slice } from "@/components/donut";
import { Curva, type Punto } from "@/components/curva";
import { Delta } from "@/components/delta";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Página de cortes transversales. No calcula plata nueva: reagrupa lo que ya cierra en / y /ventas por
// ejes que esos paneles no tienen (zona, desenlace, producto × canal, pack, maduración). Además compara
// contra el período anterior de igual largo (segunda llamada a las mismas RPCs). RPCs de la 034/035.
type PnlRow = {
  courier: string; product_id: number | null; product: string;
  despachadas: number; entregadas: number;
  revenue: number; flete: number; comisiones: number; costo_producto: number; ads: number; percepciones: number;
  profit_conf: number; profit_est: number;
};
type ZonaRow = {
  province: string; guias: number; entregadas: number; devueltas: number;
  cod_cobrado: number; flete: number; flete_perdido: number;
  comisiones: number; costo_producto: number; margen_bruto: number; margen_neto: number;
};
type DesenlaceRow = { estado: string; guias: number; cod: number };
type PackRow = {
  pack: number; guias: number; entregadas: number; devueltas: number;
  cod_cobrado: number; flete: number;
  comisiones: number; costo_producto: number; margen_bruto: number; margen_neto: number;
};

const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };
const ESTADO: Record<string, string> = {
  entregado: "Entregado", en_la_calle: "En la calle", devuelto: "Devuelto", rehusado: "Rehusado",
  en_devolucion: "En devolución", no_despachado: "No despachado", siniestro: "Siniestro",
};
const ESTADO_COLOR: Record<string, { s: string; b: string }> = {
  entregado: { s: "stroke-emerald-500", b: "bg-emerald-500" },
  en_la_calle: { s: "stroke-sky-500", b: "bg-sky-500" },
  devuelto: { s: "stroke-rose-500", b: "bg-rose-500" },
  rehusado: { s: "stroke-rose-400", b: "bg-rose-400" },
  en_devolucion: { s: "stroke-amber-500", b: "bg-amber-500" },
  no_despachado: { s: "stroke-slate-400", b: "bg-slate-400" },
  siniestro: { s: "stroke-violet-500", b: "bg-violet-500" },
};
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const N = (v: number | null | undefined) => Number(v ?? 0);

export default async function Analisis({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string; desde?: string; hasta?: string; producto?: string }>;
}) {
  const { courier, desde, hasta, producto } = await searchParams;
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;
  const prodParam = producto && /^\d+$/.test(producto) ? Number(producto) : null;

  // Período anterior de IGUAL largo, contiguo hacia atrás. La comparativa se apoya en esto.
  const largoDias = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(prevTo) - (largoDias - 1) * 86400000).toISOString().slice(0, 10);

  const [
    { data: pnlRaw }, { data: zonasRaw }, { data: desRaw }, { data: packRaw }, { data: madRaw },
    { data: pnlPrevRaw }, { data: cpaRef }, { data: prodsRaw },
  ] = await Promise.all([
    db.rpc("analisis_pnl", { p_from: from, p_to: to, p_courier: courierParam }),
    db.rpc("analisis_zonas", { p_from: from, p_to: to, p_courier: courierParam, p_producto: prodParam }),
    db.rpc("analisis_desenlaces", { p_from: from, p_to: to, p_courier: courierParam, p_producto: prodParam }),
    db.rpc("analisis_packs", { p_from: from, p_to: to, p_courier: courierParam, p_producto: prodParam }),
    db.rpc("analisis_maduracion", { p_desde: daysAgoIso(45), p_courier: courierParam, p_producto: prodParam }),
    db.rpc("analisis_pnl", { p_from: prevFrom, p_to: prevTo, p_courier: courierParam }),
    db.from("settings").select("value").eq("key", "cpa_referencia").maybeSingle(),
    db.from("products").select("id, name").order("id"),
  ]);
  // analisis_pnl ya viene por producto → el filtro es un where en el cliente, sin RPC extra
  const pnl = ((pnlRaw ?? []) as PnlRow[]).filter((r) => !prodParam || r.product_id === prodParam);
  const pnlPrev = ((pnlPrevRaw ?? []) as PnlRow[]).filter((r) => !prodParam || r.product_id === prodParam);
  const prods = (prodsRaw ?? []) as { id: number; name: string }[];
  const zonas = (zonasRaw ?? []) as ZonaRow[];
  const desenlaces = (desRaw ?? []) as DesenlaceRow[];
  const packs = (packRaw ?? []) as PackRow[];
  const maduracion = ((madRaw ?? []) as Punto[]).filter((p) => p.dias >= 0);
  const cpaObj = (cpaRef?.value ?? {}) as Record<string, { objetivo: number; maximo: number }>;

  const sumOf = (rows: PnlRow[], k: keyof PnlRow) => rows.reduce((s, r) => s + N(r[k] as number), 0);
  const revenue = sumOf(pnl, "revenue"), flete = sumOf(pnl, "flete"), comis = sumOf(pnl, "comisiones");
  const percep = sumOf(pnl, "percepciones");
  const costo = sumOf(pnl, "costo_producto"), ads = sumOf(pnl, "ads");
  const profitConf = sumOf(pnl, "profit_conf"), profitEst = sumOf(pnl, "profit_est");
  const despachos = sumOf(pnl, "despachadas"), entregas = sumOf(pnl, "entregadas");
  // mismos totales del período anterior, para los Δ
  const pRev = sumOf(pnlPrev, "revenue"), pProfitEst = sumOf(pnlPrev, "profit_est");
  const pDesp = sumOf(pnlPrev, "despachadas"), pEnt = sumOf(pnlPrev, "entregadas");
  const tasa = despachos ? entregas / despachos : 0;
  const pTasa = pDesp ? pEnt / pDesp : 0;

  // 1 · composición del peso
  const composicion: Slice[] = [
    { label: "Flete", value: flete, className: "stroke-rose-500", dot: "bg-rose-500" },
    { label: "Ads", value: ads, className: "stroke-amber-500", dot: "bg-amber-500" },
    { label: "Comisiones", value: comis, className: "stroke-slate-400", dot: "bg-slate-400" },
    { label: "Percepciones ML", value: percep, className: "stroke-sky-400", dot: "bg-sky-400" },
    { label: "Costo de producto", value: costo, className: "stroke-violet-400", dot: "bg-violet-400" },
    { label: "Profit confirmado", value: Math.max(profitConf, 0), className: "stroke-emerald-500", dot: "bg-emerald-500" },
  ].filter((s) => s.value > 0);

  const agrupar = <K extends string>(rows: PnlRow[], key: (r: PnlRow) => K) =>
    [...rows.reduce((m, r) => {
      const k = key(r);
      const g = m.get(k) ?? { k, despachadas: 0, entregadas: 0, profitConf: 0, profitEst: 0 };
      g.despachadas += r.despachadas; g.entregadas += r.entregadas;
      g.profitConf += N(r.profit_conf); g.profitEst += N(r.profit_est);
      return m.set(k, g);
    }, new Map<K, { k: K; despachadas: number; entregadas: number; profitConf: number; profitEst: number }>()).values()]
      .sort((a, b) => b.profitEst - a.profitEst);

  const porCanal = agrupar(pnl, (r) => r.courier);
  const porProducto = agrupar(pnl, (r) => r.product);
  const profitProdPrev = new Map(agrupar(pnlPrev, (r) => r.product).map((g) => [g.k, g.profitEst]));
  const prodIdByName = new Map(pnl.map((r) => [r.product, r.product_id]));
  // CPA actual por producto (ads / despachos) para contrastar con la referencia
  const cpaProd = new Map(porProducto.map((g) => [g.k, {
    cpa: g.despachadas ? pnl.filter((r) => r.product === g.k).reduce((s, r) => s + N(r.ads), 0) / g.despachadas : 0,
  }]));

  // 5 · concentración
  const porVolumen = [...zonas].sort((a, b) => b.guias - a.guias);
  const top6 = porVolumen.slice(0, 6);
  const resto = porVolumen.slice(6).reduce((s, z) => s + z.guias, 0);
  const concentracion: Slice[] = [
    ...top6.map((z, i) => ({ label: z.province, value: z.guias, className: PALETA[i].s, dot: PALETA[i].b })),
    ...(resto > 0 ? [{ label: `Otras ${porVolumen.length - 6}`, value: resto, className: "stroke-slate-300", dot: "bg-slate-300" }] : []),
  ];
  const totalGuias = porVolumen.reduce((s, z) => s + z.guias, 0);

  // 8 · flete perdido (Pareto): provincias ordenadas por flete quemado en devoluciones
  const pareto = [...zonas].filter((z) => N(z.flete_perdido) > 0).sort((a, b) => N(b.flete_perdido) - N(a.flete_perdido));
  const totalPerdido = pareto.reduce((s, z) => s + N(z.flete_perdido), 0);

  // matriz producto × canal
  const canales = [...new Set(pnl.map((r) => r.courier))].sort();
  const productos = [...new Set(pnl.map((r) => r.product))].sort();
  const celda = (p: string, c: string) => {
    const r = pnl.find((x) => x.product === p && x.courier === c);
    if (!r || r.despachadas < 15) return null;
    return { tasa: r.entregadas / r.despachadas, n: r.despachadas };
  };

  const hrefWith = (o: { courier?: string; desde?: string; hasta?: string; producto?: string }) => {
    const c = o.courier !== undefined ? o.courier : (courier ?? "");
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const pp = o.producto !== undefined ? o.producto : (producto ?? "");
    const q = new URLSearchParams();
    if (c) q.set("courier", c);
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    if (pp) q.set("producto", pp);
    const s = q.toString();
    return s ? `/analisis?${s}` : "/analisis";
  };

  // link a la subpágina del producto (packs sin umbral + CPA), heredando rango y canal
  const subHref = (pid: number) => {
    const q = new URLSearchParams();
    if (courier) q.set("courier", courier);
    if (desde) q.set("desde", desde);
    if (hasta) q.set("hasta", hasta);
    const s = q.toString();
    return s ? `/analisis/${pid}?${s}` : `/analisis/${pid}`;
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

  const maxMargen = Math.max(...zonas.map((z) => Math.abs(N(z.margen_neto))), 1);
  const maxPackM = Math.max(...packs.map((p) => Math.abs(N(p.margen_neto))), 1);

  const chip = (active: boolean) => cn(
    "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
    active ? "bg-foreground text-background shadow-sm hover:shadow"
           : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Análisis</h1>
        <span className="text-sm tabular-nums text-muted-foreground">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {presets.map(([label, d, h]) => (
            <Link key={label} href={hrefWith({ desde: d, hasta: h })}
                  aria-current={from === d && to === h ? "page" : undefined} className={chip(from === d && to === h)}>{label}</Link>
          ))}
        </div>
        <form method="get" className="inline-flex items-center gap-1.5">
          {courier && <input type="hidden" name="courier" value={courier} />}
          {producto && <input type="hidden" name="producto" value={producto} />}
          <input type="date" name="desde" defaultValue={from} max={to} aria-label="Desde"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground">→</span>
          <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-medium text-secondary-foreground transition-colors hover:bg-accent">Aplicar</button>
        </form>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"], ["ml", "ML"]].map(([val, label]) => (
            <Link key={val} href={hrefWith({ courier: val })}
                  aria-current={(courier ?? "") === val ? "page" : undefined}
                  className={cn("rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                    (courier ?? "") === val ? "bg-foreground text-background shadow-sm hover:shadow"
                                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground")}>{label}</Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Link href={hrefWith({ producto: "" })} aria-current={!prodParam ? "page" : undefined} className={chip(!prodParam)}>
            Todos los productos
          </Link>
          {prods.map((pr) => (
            <Link key={pr.id} href={hrefWith({ producto: String(pr.id) })}
                  aria-current={prodParam === pr.id ? "page" : undefined} className={chip(prodParam === pr.id)}>
              {pr.name}
            </Link>
          ))}
          {prodParam && (
            <Link href={subHref(prodParam)}
                  className="font-medium text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
              Packs del producto →
            </Link>
          )}
        </div>
      </div>

      {!pnl.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin datos en el rango elegido.</CardContent></Card>
      ) : (
      <>
      {/* 0 · comparativa contra el período anterior */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Contra el período anterior
              <Tip tip="Cada número comparado con los mismos días inmediatamente anteriores (igual largo). Verde = mejoró, rojo = empeoró — el sentido depende de la métrica: en flete y devoluciones, subir es malo." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">vs {fmtDate(prevFrom)} → {fmtDate(prevTo)}</span>
          </div>
          <Kpis items={[
            { label: "Profit estimado", value: fmtMoney(profitEst), color: pnlColor(profitEst),
              delta: <Delta actual={profitEst} previo={pProfitEst} />, pie: `confirmado ${fmtMoney(profitConf)}` },
            { label: "Cobrado", value: fmtMoney(revenue), delta: <Delta actual={revenue} previo={pRev} /> },
            { label: "Despachos", value: despachos.toLocaleString("es-AR"), delta: <Delta actual={despachos} previo={pDesp} tipo="num" /> },
            { label: "Tasa de entrega", value: fmtPct(tasa), delta: <Delta actual={tasa} previo={pTasa} tipo="pct" /> },
          ]} />
        </CardContent>
      </Card>

      {/* 1 · a dónde va cada peso */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              A dónde va cada peso que cobrás
              <Tip tip="Sobre el COD efectivamente cobrado del período. El flete es hundido: se paga por toda guía despachada, entregue o no, por eso pesa más de lo que uno espera. Percepciones ML = IVA/IIBB que MercadoLibre factura sobre sus servicios (solo canal ML): estimadas por día al ~18% calibrado contra la factura real; el Reporte_Facturacion mensual (en /sync) las pisa con el valor exacto." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">cobrado {fmtMoney(revenue)}</span>
          </div>
          <Donut slices={composicion} centro={fmtPct(profitConf / (revenue || 1))} subcentro="queda" />
          {profitConf < 0 && <p className="text-xs text-destructive">Profit confirmado negativo en el período: los costos ya pagados superan lo cobrado hasta ahora. Con cohortes recientes es esperable — mirá el estimado.</p>}
        </CardContent>
      </Card>

      {/* 2 · canales */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Profit por canal
            <Tip tip="La dona y la columna grande usan el profit ESTIMADO (confirmado + proyección de lo que sigue en la calle): en rangos recientes el confirmado solo da muy negativo porque el flete y los ads ya se pagaron pero el COD todavía no maduró — no es pérdida, es cohorte inmadura. El confirmado queda al lado para ver cuánto ya es plata firme." />
          </span>
          <Donut slices={porCanal.filter((c) => c.profitEst > 0).map((c, i) => ({ label: COURIER[c.k] ?? c.k, value: c.profitEst, className: PALETA[i].s, dot: PALETA[i].b }))} />
          {porCanal.some((c) => c.profitEst <= 0) && (
            <p className="text-xs text-muted-foreground">
              Fuera de la dona (estimado ≤ 0):{" "}
              {porCanal.filter((c) => c.profitEst <= 0).map((c) => `${COURIER[c.k] ?? c.k} (${fmtMoney(c.profitEst)})`).join(" · ")}
            </p>
          )}
          <Table>
            <TableHeader><TableRow>
              <TableHead>Canal</TableHead><TableHead className="text-right">Despachos</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
              <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
              <TableHead className="text-right">confirmado</TableHead>
              <TableHead className="text-right">Est. por despacho</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {porCanal.map((c) => (
                <TableRow key={c.k}>
                  <TableCell className="font-medium">{COURIER[c.k] ?? c.k}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.despachadas.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{c.despachadas ? fmtPct(c.entregadas / c.despachadas) : "—"}</TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(c.profitEst))}>{fmtMoney(c.profitEst)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", c.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(c.profitConf)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", pnlColor(c.profitEst))}>{c.despachadas ? fmtMoney(c.profitEst / c.despachadas) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3 · productos, con Δ y CPA vs referencia */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Productos
            <Tip tip="Profit ESTIMADO de cada producto (el confirmado al lado — en rangos recientes es bajo porque las cohortes no maduraron, no porque se pierda plata), la variación contra el período anterior, y el CPA actual (ads ÷ despachos) contra la referencia del vault. Verde ≤ objetivo, ámbar entre objetivo y máximo, rojo > máximo. La referencia es guía, no regla: manda producto × zona. Click en un producto para abrir su análisis: packs sin umbral y rango libre." />
          </span>
          <Donut slices={porProducto.filter((p) => p.profitEst > 0).map((p, i) => ({ label: p.k, value: p.profitEst, className: PALETA[i % PALETA.length].s, dot: PALETA[i % PALETA.length].b }))} />
          <Table>
            <TableHeader><TableRow>
              <TableHead>Producto</TableHead><TableHead className="text-right">Despachos</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
              <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
              <TableHead className="text-right">confirmado</TableHead>
              <TableHead className="text-right">vs anterior</TableHead><TableHead className="text-right">CPA vs objetivo</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {porProducto.map((p) => {
                const ref = cpaObj[p.k];
                const cpa = cpaProd.get(p.k)?.cpa ?? 0;
                const estado = !ref || !cpa ? null : cpa <= ref.objetivo ? "ok" : cpa <= ref.maximo ? "vig" : "mal";
                const pid = prodIdByName.get(p.k);
                return (
                  <TableRow key={p.k}>
                    <TableCell className="font-medium">
                      {pid != null ? (
                        <Link href={subHref(pid)} title="Análisis del producto: packs sin umbral, CPA y rango libre"
                              className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                          {p.k} <span className="text-muted-foreground">›</span>
                        </Link>
                      ) : p.k}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{p.despachadas.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{p.despachadas ? fmtPct(p.entregadas / p.despachadas) : "—"}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(p.profitEst))}>{fmtMoney(p.profitEst)}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", p.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>{fmtMoney(p.profitConf)}</TableCell>
                    <TableCell className="text-right"><Delta actual={p.profitEst} previo={profitProdPrev.get(p.k) ?? NaN} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {estado ? (
                        <Tip tip={`Objetivo ${fmtMoney(ref.objetivo)} · máximo ${fmtMoney(ref.maximo)}`}>
                          <span className={cn(estado === "ok" ? "text-emerald-600 dark:text-emerald-400" : estado === "vig" ? "text-amber-600 dark:text-amber-500" : "text-destructive")}>
                            {fmtMoney(cpa)}
                          </span>
                        </Tip>
                      ) : <span className="text-muted-foreground/50">—</span>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4 · packs */}
      {packs.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Por tamaño de pack
            <Tip tip="Solo pedidos de una línea (con carrito mixto el pack no está definido). La tasa de entrega suele subir con el tamaño del pack. Margen bruto = cobrado − flete. Neto s/Ads = bruto − comisiones − costo de producto; lo único que falta ahí son los Ads, que van por producto y día y no se pueden repartir por pack sin inventar." />
          </span>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Pack</TableHead><TableHead className="text-right">Guías</TableHead>
              <TableHead className="text-right">Entrega</TableHead><TableHead className="text-right">Devolución</TableHead>
              <TableHead className="text-right">Margen bruto</TableHead>
              <TableHead className="text-right">Neto s/Ads</TableHead><TableHead className="w-28" />
            </TableRow></TableHeader>
            <TableBody>
              {packs.map((p) => {
                const t = p.guias ? p.entregadas / p.guias : 0;
                const dev = p.guias ? p.devueltas / p.guias : 0;
                const m = N(p.margen_neto);
                return (
                  <TableRow key={p.pack}>
                    <TableCell className="font-medium">×{p.pack}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.guias.toLocaleString("es-AR")}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", t < 0.35 ? "text-destructive" : t < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400")}>{fmtPct(t)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(dev)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(p.margen_bruto))}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(m))}>{fmtMoney(m)}</TableCell>
                    <TableCell><div className="h-1.5 w-full rounded bg-muted"><div className={cn("barra h-1.5 rounded", m >= 0 ? "bg-emerald-500" : "bg-destructive")} style={{ width: `${Math.abs(m) / maxPackM * 100}%` }} /></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}

      {/* 5 · zonas */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Zonas
              <Tip tip="Margen bruto = COD cobrado − flete de TODAS las guías de la provincia. Neto s/Ads = bruto − comisiones − costo de producto, con las mismas reglas del P&L (comisión solo sobre entregadas, costo en entregado y siniestro). Lo único que falta es los Ads, que van por producto y día y no se reparten por zona sin inventar. De peor a mejor NETO: arriba es donde se va la plata." />
            </span>
            <span className="text-xs text-muted-foreground">{zonas.length} provincias · de peor a mejor</span>
          </div>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Provincia</TableHead><TableHead className="text-right">Guías</TableHead>
              <TableHead className="text-right">Entrega</TableHead><TableHead className="text-right">COD cobrado</TableHead>
              <TableHead className="text-right">Flete</TableHead><TableHead className="text-right">Margen bruto</TableHead>
              <TableHead className="text-right">Neto s/Ads</TableHead><TableHead className="w-28" />
            </TableRow></TableHeader>
            <TableBody>
              {zonas.map((z) => {
                const t = z.guias ? z.entregadas / z.guias : 0;
                const m = N(z.margen_neto);
                return (
                  <TableRow key={z.province}>
                    <TableCell className="font-medium">{z.province}</TableCell>
                    <TableCell className="text-right tabular-nums">{z.guias.toLocaleString("es-AR")}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", t < 0.35 ? "text-destructive" : t < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground")}>{fmtPct(t)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.cod_cobrado))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.flete))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.margen_bruto))}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(m))}>{fmtMoney(m)}</TableCell>
                    <TableCell><div className="h-1.5 w-full rounded bg-muted"><div className={cn("barra h-1.5 rounded", m >= 0 ? "bg-emerald-500" : "bg-destructive")} style={{ width: `${Math.abs(m) / maxMargen * 100}%` }} /></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 6 · Pareto del flete perdido */}
      {pareto.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Dónde se quema el flete de devoluciones
              <Tip tip="Flete de las guías que volvieron (devuelto, rehusado, en devolución), por provincia. Es el agujero del COD: plata que se paga sin cobrar nada. Ordenado por monto — arreglar las primeras es donde más rinde." />
            </span>
            <span className="text-xs tabular-nums text-destructive">{fmtMoney(totalPerdido)} quemados</span>
          </div>
          {(() => { let ac = 0; return pareto.slice(0, 8).map((z) => {
            ac += N(z.flete_perdido);
            return (
              <div key={z.province} className="flex items-center gap-3 text-sm">
                <span className="w-28 flex-none truncate font-medium">{z.province}</span>
                <div className="h-4 flex-1 rounded bg-muted">
                  <div className="barra h-4 rounded bg-destructive/80" style={{ width: `${N(z.flete_perdido) / N(pareto[0].flete_perdido) * 100}%` }} />
                </div>
                <span className="w-24 flex-none text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.flete_perdido))}</span>
                <span className="w-12 flex-none text-right text-xs tabular-nums text-muted-foreground">{fmtPct(ac / totalPerdido)}</span>
              </div>
            );
          }); })()}
          <p className="text-xs text-muted-foreground">La última columna es el acumulado: cuánto del flete perdido total explican las provincias hasta esa fila.</p>
        </CardContent>
      </Card>
      )}

      {/* 7 · concentración */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Concentración de volumen
              <Tip tip="Cuánto del despacho se juega en pocas provincias. A más concentrado, más pesa mejorar la tasa de una sola zona." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{totalGuias.toLocaleString("es-AR")} guías</span>
          </div>
          <Donut slices={concentracion} money={false}
                 centro={top6.length ? fmtPct(top6.reduce((s, z) => s + z.guias, 0) / (totalGuias || 1)) : undefined} subcentro="top 6" />
        </CardContent>
      </Card>

      {/* 8 · desenlaces */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            En qué termina cada guía
            <Tip tip="Distribución de desenlaces de las guías despachadas en el rango. 'En la calle' son las que todavía no se resolvieron: en rangos recientes va a pesar mucho." />
          </span>
          <Donut money={false} slices={desenlaces.map((d) => ({ label: ESTADO[d.estado] ?? d.estado, value: d.guias, className: (ESTADO_COLOR[d.estado] ?? { s: "stroke-slate-400", b: "bg-slate-400" }).s, dot: (ESTADO_COLOR[d.estado] ?? { s: "stroke-slate-400", b: "bg-slate-400" }).b }))} />
        </CardContent>
      </Card>

      {/* 9 · maduración */}
      {maduracion.length >= 3 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Curva de maduración de cohortes
            <Tip tip="Para cada edad de cohorte (días desde el despacho), qué fracción ya tiene desenlace. Dice cuándo confiar en un número. Últimos 45 días; si la curva se aplana de golpe, el sync se congeló." />
          </span>
          <Curva puntos={maduracion} maturity={courierParam === "fixy" ? 7 : 10} />
        </CardContent>
      </Card>
      )}

      {/* 10 · matriz producto × canal */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Tasa de entrega · producto × canal
            <Tip tip="Contrasta si la entrega depende más del producto que del courier. Celdas con menos de 15 despachos quedan vacías: con ese volumen la tasa es ruido." />
          </span>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Producto</TableHead>
              {canales.map((c) => <TableHead key={c} className="text-right">{COURIER[c] ?? c}</TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p}>
                  <TableCell className="font-medium">{p}</TableCell>
                  {canales.map((c) => {
                    const v = celda(p, c);
                    return (
                      <TableCell key={c} className="text-right tabular-nums">
                        {v ? (
                          <span className={cn(v.tasa < 0.35 ? "text-destructive" : v.tasa < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-foreground")}>
                            {fmtPct(v.tasa)}<span className="ml-1 text-[0.65rem] text-muted-foreground">({v.n})</span>
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>
      )}
    </main>
  );
}
