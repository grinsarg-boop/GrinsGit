import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tip } from "@/components/ui/tooltip";
import Link from "next/link";
import { adLabel, campaignLabel } from "@/lib/ad-label";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Cruce venta ↔ anuncio de Meta (RPC anuncios_pnl, 051). Responde "qué producto/campaña trae clientes
// que PAGAN, y dónde quemo". Dos capas separadas a propósito: NEGOCIO (todo el COD ÷ gasto, sobrevive
// si la atribución se rompe) y ATRIBUIDO (el subconjunto con ad_id, que se puede desglosar por campaña/
// anuncio). Cuando el form COD deja de estampar utm_content (pasó ~6/jul 2026), la cobertura se desploma
// y el ROAS atribuido se vuelve basura — de ahí el banner de atribución. Cohortes recientes maduran ~21d.
type AdRow = {
  ad_id: string | null; ad_name: string | null; adset_name: string | null;
  campaign_name: string | null; product: string | null;
  pedidos: number; despachadas: number; entregadas: number; devueltas: number; resueltas: number;
  cod_cobrado: number; flete: number; spend: number;
};

const N = (v: number | null | undefined) => Number(v ?? 0);
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const tasaColor = (t: number) => (t < 0.35 ? "text-destructive" : t < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400");

type Sums = { pedidos: number; despachadas: number; entregadas: number; devueltas: number; resueltas: number; cod_cobrado: number; flete: number; spend: number };
const ZERO: Sums = { pedidos: 0, despachadas: 0, entregadas: 0, devueltas: 0, resueltas: 0, cod_cobrado: 0, flete: 0, spend: 0 };
const add = (a: Sums, r: AdRow): Sums => ({
  pedidos: a.pedidos + N(r.pedidos), despachadas: a.despachadas + N(r.despachadas),
  entregadas: a.entregadas + N(r.entregadas), devueltas: a.devueltas + N(r.devueltas),
  resueltas: a.resueltas + N(r.resueltas), cod_cobrado: a.cod_cobrado + N(r.cod_cobrado),
  flete: a.flete + N(r.flete), spend: a.spend + N(r.spend),
});
const derive = (g: Sums) => {
  const enCalle = Math.max(g.despachadas - g.resueltas, 0);
  const tasaMad = g.resueltas ? g.entregadas / g.resueltas : 0;   // robusta a maduración (÷ resueltas, no ÷ despachadas)
  const devRate = g.despachadas ? g.devueltas / g.despachadas : 0;
  const cpa = g.entregadas ? g.spend / g.entregadas : 0;
  const roas = g.spend ? g.cod_cobrado / g.spend : 0;
  const ticket = g.entregadas ? g.cod_cobrado / g.entregadas : 0;
  const contrib = g.cod_cobrado - g.flete - g.spend;             // margen logístico neto de ads (sin costo prod / comisión)
  return { ...g, enCalle, tasaMad, devRate, cpa, roas, ticket, contrib };
};
type Metric = ReturnType<typeof derive>;
const groupSum = <K extends string>(rows: AdRow[], key: (r: AdRow) => K) => {
  const m = new Map<K, AdRow[]>();
  for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(r); }
  return m;
};

const ORDENES = {
  contrib: { label: "Contribución", fn: (a: Metric, b: Metric) => b.contrib - a.contrib },
  entregadas: { label: "Entregadas", fn: (a: Metric, b: Metric) => b.entregadas - a.entregadas },
  cpa: { label: "CPA entregada", fn: (a: Metric, b: Metric) => (a.entregadas ? a.cpa : Infinity) - (b.entregadas ? b.cpa : Infinity) },
  tasa: { label: "Tasa", fn: (a: Metric, b: Metric) => b.tasaMad - a.tasaMad },
  roas: { label: "ROAS", fn: (a: Metric, b: Metric) => b.roas - a.roas },
  spend: { label: "Gasto", fn: (a: Metric, b: Metric) => b.spend - a.spend },
} as const;
type Orden = keyof typeof ORDENES;

// una fila = grid de 7 columnas alineado entre header, productos, campañas y anuncios
const ROW = "grid grid-cols-[minmax(8rem,1fr)_repeat(6,minmax(3.5rem,max-content))] items-center gap-x-3 sm:gap-x-4";

export default async function Anuncios({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; orden?: string }>;
}) {
  const { desde, hasta, orden } = await searchParams;
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const ord: Orden = (orden && orden in ORDENES ? orden : "contrib") as Orden;

  const { data: raw } = await db.rpc("anuncios_pnl", { p_from: from, p_to: to });
  const rows = (raw ?? []) as AdRow[];
  const attributed = rows.filter((r) => r.campaign_name);
  const bus = derive(rows.reduce(add, ZERO));                    // NEGOCIO: todo el COD, con o sin atribución
  const glob = derive(attributed.reduce(add, ZERO));            // ATRIBUIDO: lo que se puede desglosar
  const bucket = derive(rows.filter((r) => !r.campaign_name).reduce(add, ZERO));
  const cobertura = bus.pedidos ? glob.pedidos / bus.pedidos : 0;

  // ¿el rango todavía madura? (guías en la calle sin resolver). Si sí, el ROAS/tasa van a SUBIR.
  const enCalleRatio = bus.despachadas ? bus.enCalle / bus.despachadas : 0;
  const maduro = enCalleRatio < 0.15;
  // proyección de negocio a madurez (conservadora): entregar lo despachado a la tasa madura de hoy
  const busTicket = bus.entregadas ? bus.cod_cobrado / bus.entregadas : 0;
  const projCOD = bus.despachadas * bus.tasaMad * busTicket;
  const projROAS = bus.spend ? projCOD / bus.spend : 0;
  const atribRota = cobertura < 0.6 && bus.pedidos > 30;        // el form dejó de estampar utm_content

  // ---- desglose atribuido: PRODUCTO → campañas (progressive disclosure con <details> nativo) ----
  const prodKey = (r: AdRow) => r.product ?? campaignLabel(r.campaign_name).producto ?? "(sin producto)";
  const productos = [...groupSum(attributed, prodKey)].map(([k, rs]) => ({
    k, ...derive(rs.reduce(add, ZERO)),
    campañas: [...groupSum(rs, (r) => r.campaign_name!)]
      .map(([c, crs]) => ({ k: c, ...derive(crs.reduce(add, ZERO)) }))
      .sort(ORDENES[ord].fn),
  })).sort((a, b) => b.contrib - a.contrib);                     // ganan arriba, queman abajo (rojo)

  // headline: quién trae los que pagan / quién quema
  const ganador = productos.filter((p) => p.entregadas >= 10).sort((a, b) => b.contrib - a.contrib)[0];
  const quema = productos.filter((p) => p.contrib < 0 && p.spend > 0).sort((a, b) => b.spend - a.spend)[0];

  // ---- anuncios: mejores y peores por el orden elegido ----
  const adRows = attributed.filter((r) => N(r.pedidos) > 0 || N(r.spend) > 0)
    .map((r) => ({ k: r.ad_id!, name: r.ad_name, campaign: r.campaign_name, ...derive(add(ZERO, r)) }))
    .sort(ORDENES[ord].fn);
  const mejores = adRows.slice(0, 5);
  const mejoresSet = new Set(mejores.map((a) => a.k));
  const peores = [...adRows].reverse().filter((a) => a.spend > 0 && !mejoresSet.has(a.k)).slice(0, 5);

  const [ey, em] = today.slice(0, 7).split("-").map(Number);
  const pmY = em === 1 ? ey - 1 : ey;
  const pmM = em === 1 ? 12 : em - 1;
  const pm = `${pmY}-${String(pmM).padStart(2, "0")}`;
  const pmLast = new Date(pmY, pmM, 0).getDate();
  const presets: [string, string, string][] = [
    ["7 días", daysAgoIso(7), today], ["30 días", daysAgoIso(30), today], ["90 días", daysAgoIso(90), today],
    ["Este mes", `${today.slice(0, 7)}-01`, today], ["Mes pasado", `${pm}-01`, `${pm}-${String(pmLast).padStart(2, "0")}`],
    ["Máx", "2020-01-01", today],
  ];
  const hrefWith = (o: { desde?: string; hasta?: string; orden?: string }) => {
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const oo = o.orden !== undefined ? o.orden : (orden ?? "");
    const q = new URLSearchParams();
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    if (oo && oo !== "contrib") q.set("orden", oo);
    const s = q.toString();
    return s ? `/anuncios?${s}` : "/anuncios";
  };
  const chip = (active: boolean) => cn(
    "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
    active ? "bg-foreground text-background shadow-sm hover:shadow" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );

  // las 6 métricas de decisión de una fila, alineadas al grid ROW (columnas 2..7)
  const roasColor = (m: Metric) => !m.spend ? "text-muted-foreground/50" : m.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : maduro ? "text-destructive" : "text-muted-foreground";
  const cells = (m: Metric, strong = false) => (
    <>
      <span className={cn("text-right tabular-nums", strong && "font-semibold")}>{m.entregadas.toLocaleString("es-AR")}</span>
      <Tip tip={`Entregadas ÷ resueltas. ${m.despachadas.toLocaleString("es-AR")} despachadas · ${m.enCalle.toLocaleString("es-AR")} en la calle · ${fmtPct(m.devRate)} devol.`}>
        <span className={cn("block text-right tabular-nums", tasaColor(m.tasaMad))}>{fmtPct(m.tasaMad)}</span>
      </Tip>
      <span className="text-right tabular-nums text-muted-foreground">{m.entregadas ? fmtMoney(m.cpa) : "—"}</span>
      <span className="text-right tabular-nums text-muted-foreground">{fmtMoney(m.spend)}</span>
      <Tip tip={`Cobrado ${fmtMoney(m.cod_cobrado)} ÷ gasto ${fmtMoney(m.spend)}.${!maduro ? " El rango todavía madura: va a subir." : ""}`}>
        <span className={cn("block text-right tabular-nums", roasColor(m))}>{m.spend ? fmtRatio(m.roas) : "—"}{!maduro && m.spend && m.roas < 1 ? " ▲" : ""}</span>
      </Tip>
      <span className={cn("text-right font-semibold tabular-nums", pnlColor(m.contrib))}>{fmtMoney(m.contrib)}</span>
    </>
  );
  const headRow = (primera: string) => (
    <div className={cn(ROW, "border-b pb-2 text-[0.7rem] uppercase tracking-wide text-muted-foreground")}>
      <span>{primera}</span>
      <span className="text-right">Entr.</span><span className="text-right">Tasa</span>
      <span className="text-right">CPA</span><span className="text-right">Gasto</span>
      <span className="text-right">ROAS</span><span className="text-right text-amber-600 dark:text-amber-500">Contrib.</span>
    </div>
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-semibold">Anuncios</h1>
          <Tip tip="Cada venta cruzada con la campaña/anuncio de Meta que la trajo (utm_content = ad_id, del form COD) y con su desenlace real de courier. Mide CALIDAD del cliente: COD entregado y cobrado, no el pedido que entra. Dos capas: Negocio (todo el COD ÷ gasto, siempre real) y Atribuido (lo que se puede abrir por campaña). Cohortea por día de venta; el gasto se suma sobre el mismo rango." />
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">{rangeLabel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {presets.map(([label, d, h]) => (
            <Link key={label} href={hrefWith({ desde: d, hasta: h })} aria-current={from === d && to === h ? "page" : undefined} className={chip(from === d && to === h)}>{label}</Link>
          ))}
        </div>
        <form method="get" className="inline-flex items-center gap-1.5">
          {orden && <input type="hidden" name="orden" value={orden} />}
          <input type="date" name="desde" defaultValue={from} max={to} aria-label="Desde" className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground">→</span>
          <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta" className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-medium text-secondary-foreground transition-colors hover:bg-accent">Aplicar</button>
        </form>
      </div>

      {/* banners de salud: primero atribución (rompe el desglose), después maduración (sube solo) */}
      {atribRota && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <div className="font-semibold text-destructive">⚠ Atribución incompleta — solo {fmtPct(cobertura)} de los pedidos traen anuncio</div>
          <p className="mt-1 text-muted-foreground">
            {bucket.pedidos.toLocaleString("es-AR")} de {bus.pedidos.toLocaleString("es-AR")} pedidos ({fmtMoney(bucket.cod_cobrado)} de COD) entran sin <code className="text-xs">utm_content</code>, así que el desglose por campaña/anuncio de abajo NO los ve. Suele pasar cuando el form/landing COD deja de estampar la campaña en el pedido — hay que arreglarlo upstream. <b className="text-foreground">El ROAS de negocio del KPI sigue siendo real</b> (usa todo el COD); el ROAS por-anuncio, no — está calculado sobre un pedazo chico.
          </p>
        </div>
      )}
      {!maduro && bus.despachadas > 0 && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <span className="font-semibold text-amber-700 dark:text-amber-500">⏳ Rango en maduración</span>
          <span className="ml-1 text-muted-foreground">
            {fmtPct(enCalleRatio)} de las guías todavía en la calle. Tasa y ROAS van a <b className="text-foreground">subir</b> — los números finales se conocen en ~21 días. Proyección de negocio a madurez: ROAS ≈ <b className="text-foreground">{fmtRatio(projROAS)}</b> (conservador).
          </span>
        </div>
      )}

      {!rows.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin ventas en el rango elegido.</CardContent></Card>
      ) : (
      <>
      {/* KPIs en dos capas: negocio (real) vs atribuido (desglosable) */}
      <Card>
        <CardContent className="space-y-4 pt-5">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Negocio · todo el COD del rango
                <Tip tip="Todos los pedidos, tengan o no ad_id. El ROAS de negocio (COD total ÷ gasto total de Meta) es el número real: no depende de que la atribución funcione. Es el que hay que mirar para saber si Meta rinde." />
              </span>
              <span className="text-xs tabular-nums text-muted-foreground">{bus.pedidos.toLocaleString("es-AR")} pedidos</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "ROAS negocio", value: fmtRatio(bus.roas), sub: maduro ? "cobrado ÷ gasto" : `proy. ≈ ${fmtRatio(projROAS)}`, cls: bus.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : maduro ? "text-destructive" : "text-amber-600 dark:text-amber-500" },
                { label: "Cobrado (COD)", value: fmtMoney(bus.cod_cobrado), sub: `ticket ${fmtMoney(bus.ticket)}` },
                { label: "Gasto Meta", value: fmtMoney(bus.spend), sub: "toda la pauta del rango" },
                { label: "Entregadas", value: bus.entregadas.toLocaleString("es-AR"), sub: `tasa ${fmtPct(bus.tasaMad)} · ${bus.enCalle.toLocaleString("es-AR")} en calle` },
              ].map((k) => (
                <div key={k.label} className="sube rounded-lg bg-muted/40 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className={cn("text-lg font-semibold tabular-nums", k.cls ?? "text-foreground")}>{k.value}</div>
                  <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Atribuido · lo que se abre por anuncio
                <Tip tip="El subconjunto con ad_id, único que se puede desglosar por campaña/anuncio abajo. Si la cobertura es baja, este pedazo no representa al negocio — miralo con pinzas y arreglá la atribución." />
              </span>
              <span className={cn("text-xs tabular-nums", atribRota ? "text-destructive" : "text-muted-foreground")}>cobertura {fmtPct(cobertura)}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "ROAS atribuido", value: glob.spend ? fmtRatio(glob.roas) : "—", cls: !maduro ? "text-amber-600 dark:text-amber-500" : glob.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive" },
                { label: "Entregadas", value: glob.entregadas.toLocaleString("es-AR"), sub: `de ${glob.pedidos.toLocaleString("es-AR")} pedidos` },
                { label: "CPA entregada", value: glob.entregadas ? fmtMoney(glob.cpa) : "—", sub: "gasto ÷ entregada" },
                { label: "Contribución", value: fmtMoney(glob.contrib), sub: "cobrado − flete − ads", cls: pnlColor(glob.contrib) },
              ].map((k) => (
                <div key={k.label} className="sube rounded-lg bg-muted/40 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                  <div className={cn("text-lg font-semibold tabular-nums", (k as { cls?: string }).cls ?? "text-foreground")}>{k.value}</div>
                  <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">{(k as { sub?: string }).sub ?? " "}</div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* headline: dónde gano, dónde quemo */}
      {(ganador || quema) && (
        <Card>
          <CardContent className="space-y-1.5 pt-5 text-base">
            {ganador && (
              <p className="font-medium">
                <span className="text-emerald-600 dark:text-emerald-400">▲ {ganador.k}</span> trae los que pagan
                <span className="text-muted-foreground"> — {ganador.entregadas.toLocaleString("es-AR")} entregadas · ROAS {fmtRatio(ganador.roas)} · CPA {fmtMoney(ganador.cpa)} · {fmtMoney(ganador.contrib)}</span>
              </p>
            )}
            {quema && quema.k !== ganador?.k && (
              <p className="font-medium">
                <span className="text-destructive">▼ {quema.k}</span> está quemando
                <span className="text-muted-foreground"> — {fmtMoney(quema.spend)} gastados · ROAS {fmtRatio(quema.roas)} · tasa {fmtPct(quema.tasaMad)} · {fmtMoney(quema.contrib)}</span>
              </p>
            )}
            {atribRota && <p className="text-xs text-muted-foreground">Ojo: con {fmtPct(cobertura)} de cobertura, este veredicto se apoya solo en los pedidos atribuidos del rango.</p>}
          </CardContent>
        </Card>
      )}

      {/* PRODUCTO → campañas (click para expandir). Ordena por contrib: ganan arriba, queman abajo. */}
      {productos.length > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Por producto
              <Tip tip="Clic en un producto para ver sus campañas. Ordenado por contribución: lo que gana arriba, lo que quema (rojo) abajo. Tasa = entregadas ÷ resueltas (robusta a maduración). CPA = gasto ÷ entregada. Contrib = cobrado − flete − ads." />
            </span>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-foreground">campañas por:</span>
              {(Object.keys(ORDENES) as Orden[]).map((o) => (
                <Link key={o} href={hrefWith({ orden: o })} aria-current={ord === o ? "page" : undefined} className={chip(ord === o)}>{ORDENES[o].label}</Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[34rem]">
              {headRow("Producto")}
              {productos.map((p) => (
                <details key={p.k} className="group border-b last:border-0">
                  <summary className={cn(ROW, "cursor-pointer list-none py-2.5 hover:bg-muted/40 [&::-webkit-details-marker]:hidden")}>
                    <span className="flex items-center gap-1.5 font-medium">
                      <span className="text-muted-foreground transition-transform group-open:rotate-90">›</span>
                      {p.k}
                      <span className="text-xs font-normal text-muted-foreground">{p.campañas.length}</span>
                    </span>
                    {cells(p, true)}
                  </summary>
                  <div className="pb-2">
                    {p.campañas.map((c) => {
                      const cl = campaignLabel(c.k);
                      return (
                        <div key={c.k} className={cn(ROW, "py-1.5 pl-5 text-sm")}>
                          <span className="flex items-center gap-1.5 truncate text-muted-foreground" title={c.k}>
                            <span className="truncate">{cl.label}</span>
                            {cl.tipo && <Badge variant="outline" className="shrink-0 px-1 py-0 text-[0.6rem]">{cl.tipo}</Badge>}
                          </span>
                          {cells(c)}
                        </div>
                      );
                    })}
                  </div>
                </details>
              ))}
            </div>
          </div>
          {bucket.pedidos > 0 && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">(sin atribución):</span> {bucket.pedidos.toLocaleString("es-AR")} pedidos · {bucket.entregadas.toLocaleString("es-AR")} entregadas · {fmtMoney(bucket.cod_cobrado)} cobrado — no se pueden asignar a ninguna campaña (pedidos sin ad_id).
            </p>
          )}
        </CardContent>
      </Card>
      )}

      {/* anuncios: mejores y peores por el orden elegido */}
      {adRows.length > 1 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Anuncios · mejores y peores
            <Tip tip="El cruce a nivel creativo, top y bottom por el orden elegido arriba. Acá aparecen las gemas (un ad que entrega muy por encima de su campaña) y las fugas (gasta con tasa baja). El nombre corto sale de la convención; el crudo de Meta está en el hover." />
          </span>
          <div className="overflow-x-auto">
            <div className="min-w-[34rem]">
              {headRow("Anuncio")}
              {mejores.map((a) => {
                const al = adLabel(a.name ?? a.k);
                return (
                  <div key={a.k} className={cn(ROW, "border-b py-2 last:border-0")}>
                    <span className="flex min-w-0 items-center gap-1.5" title={`${a.name ?? a.k}  ·  ${a.campaign ?? ""}`}>
                      <span className="truncate text-sm font-medium">{al.label}</span>
                      {al.formato && <Badge variant="outline" className="shrink-0 px-1 py-0 text-[0.6rem]">{al.formato}</Badge>}
                    </span>
                    {cells(a)}
                  </div>
                );
              })}
              {peores.length > 0 && (
                <>
                  <div className="pt-3 text-[0.7rem] uppercase tracking-wide text-destructive/80">Peores (gastando)</div>
                  {peores.map((a) => {
                    const al = adLabel(a.name ?? a.k);
                    return (
                      <div key={a.k} className={cn(ROW, "border-b py-2 last:border-0")}>
                        <span className="flex min-w-0 items-center gap-1.5" title={`${a.name ?? a.k}  ·  ${a.campaign ?? ""}`}>
                          <span className="truncate text-sm font-medium">{al.label}</span>
                          {al.formato && <Badge variant="outline" className="shrink-0 px-1 py-0 text-[0.6rem]">{al.formato}</Badge>}
                        </span>
                        {cells(a)}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}
      </>
      )}
    </main>
  );
}
