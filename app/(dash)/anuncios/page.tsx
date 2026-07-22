import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Donut, PALETA, type Slice } from "@/components/donut";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Cruce venta ↔ anuncio de Meta. RPC anuncios_pnl (051): une orders.raw->note_attributes.utm_content
// (= ad_id de Meta) con ad_spend, y con shipments para el desenlace real. No calcula plata nueva:
// reagrupa lo que ya cierra en /ventas por eje CAMPAÑA / ANUNCIO / CONJUNTO. La pregunta que responde:
// qué campaña trae clientes de CALIDAD (COD que se entrega y cobra), no solo pedidos que después vuelven.
type AdRow = {
  ad_id: string | null; ad_name: string | null; adset_name: string | null;
  campaign_name: string | null; product: string | null;
  pedidos: number; despachadas: number; entregadas: number; devueltas: number; resueltas: number;
  cod_cobrado: number; flete: number; spend: number;
};

const N = (v: number | null | undefined) => Number(v ?? 0);
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const tasaColor = (t: number) => (t < 0.35 ? "text-destructive" : t < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-emerald-600 dark:text-emerald-400");

// suma cruda de un grupo de anuncios + las métricas derivadas (todas dividen acá, con guardas)
type Sums = {
  pedidos: number; despachadas: number; entregadas: number; devueltas: number; resueltas: number;
  cod_cobrado: number; flete: number; spend: number;
};
const ZERO: Sums = { pedidos: 0, despachadas: 0, entregadas: 0, devueltas: 0, resueltas: 0, cod_cobrado: 0, flete: 0, spend: 0 };
const add = (a: Sums, r: AdRow): Sums => ({
  pedidos: a.pedidos + N(r.pedidos), despachadas: a.despachadas + N(r.despachadas),
  entregadas: a.entregadas + N(r.entregadas), devueltas: a.devueltas + N(r.devueltas),
  resueltas: a.resueltas + N(r.resueltas), cod_cobrado: a.cod_cobrado + N(r.cod_cobrado),
  flete: a.flete + N(r.flete), spend: a.spend + N(r.spend),
});
const derive = (g: Sums) => {
  const enCalle = Math.max(g.despachadas - g.resueltas, 0);
  const tasa = g.despachadas ? g.entregadas / g.despachadas : 0;      // bruta (subestima en cohortes nuevas)
  const tasaMad = g.resueltas ? g.entregadas / g.resueltas : 0;       // sobre resueltas (robusta a maduración)
  const devRate = g.despachadas ? g.devueltas / g.despachadas : 0;
  const cpa = g.entregadas ? g.spend / g.entregadas : 0;
  const roas = g.spend ? g.cod_cobrado / g.spend : 0;
  const ticket = g.entregadas ? g.cod_cobrado / g.entregadas : 0;
  const contrib = g.cod_cobrado - g.flete - g.spend;                 // margen logístico neto de ads (sin costo prod / comisión)
  return { ...g, enCalle, tasa, tasaMad, devRate, cpa, roas, ticket, contrib };
};
type Metric = ReturnType<typeof derive>;

const agrupar = <K extends string>(rows: AdRow[], key: (r: AdRow) => K) =>
  [...rows.reduce((m, r) => m.set(key(r), add(m.get(key(r)) ?? ZERO, r)), new Map<K, Sums>())]
    .map(([k, s]) => ({ k, ...derive(s) }));

const ORDENES = {
  entregadas: { label: "Entregadas", fn: (a: Metric, b: Metric) => b.entregadas - a.entregadas },
  contrib: { label: "Contribución", fn: (a: Metric, b: Metric) => b.contrib - a.contrib },
  cpa: { label: "CPA entregada", fn: (a: Metric, b: Metric) => (a.entregadas ? a.cpa : Infinity) - (b.entregadas ? b.cpa : Infinity) },
  tasa: { label: "Tasa entrega", fn: (a: Metric, b: Metric) => b.tasaMad - a.tasaMad },
  roas: { label: "ROAS", fn: (a: Metric, b: Metric) => b.roas - a.roas },
  spend: { label: "Gasto", fn: (a: Metric, b: Metric) => b.spend - a.spend },
  pedidos: { label: "Pedidos", fn: (a: Metric, b: Metric) => b.pedidos - a.pedidos },
} as const;
type Orden = keyof typeof ORDENES;

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
  const ord: Orden = (orden && orden in ORDENES ? orden : "entregadas") as Orden;

  const { data: raw } = await db.rpc("anuncios_pnl", { p_from: from, p_to: to });
  const rows = (raw ?? []) as AdRow[];
  const atribuidas = rows.filter((r) => r.campaign_name);      // ad_id conocido en ad_spend
  const bucket = derive(rows.filter((r) => !r.campaign_name).reduce(add, ZERO));  // orgánico + ads fuera de ad_spend
  const total = derive(rows.reduce(add, ZERO));
  const glob = derive(atribuidas.reduce(add, ZERO));           // KPIs sobre lo atribuido (el gasto solo existe ahí)
  const cobertura = total.pedidos ? glob.pedidos / total.pedidos : 0;

  const campañas = agrupar(atribuidas, (r) => r.campaign_name!).sort(ORDENES[ord].fn);
  const conjuntos = agrupar(atribuidas.filter((r) => r.adset_name), (r) => r.adset_name!)
    .sort((a, b) => b.entregadas - a.entregadas).slice(0, 15);
  const productos = agrupar(atribuidas, (r) => (r.product ?? "(sin producto)"))
    .sort((a, b) => b.entregadas - a.entregadas);
  // anuncios: solo los que movieron algo (pedido o gasto), top 40 por el orden elegido
  const anuncios = atribuidas
    .filter((r) => N(r.pedidos) > 0 || N(r.spend) > 0)
    .map((r) => ({ k: r.ad_id!, ad_name: r.ad_name, campaign_name: r.campaign_name, ...derive(add(ZERO, r)) }))
    .sort(ORDENES[ord].fn).slice(0, 40);

  // campaña de la que viene cada peso vs de la que vienen las entregadas: si no coinciden, hay fuga
  const topGasto = [...campañas].sort((a, b) => b.spend - a.spend);
  const gastoSlices: Slice[] = topGasto.slice(0, 7).map((c, i) => ({ label: c.k, value: c.spend, className: PALETA[i].s, dot: PALETA[i].b }));
  const topEnt = [...campañas].sort((a, b) => b.entregadas - a.entregadas);
  const entSlices: Slice[] = topEnt.slice(0, 7).map((c, i) => ({ label: c.k, value: c.entregadas, className: PALETA[i].s, dot: PALETA[i].b }));

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

  const hrefWith = (o: { desde?: string; hasta?: string; orden?: string }) => {
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const oo = o.orden !== undefined ? o.orden : (orden ?? "");
    const q = new URLSearchParams();
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    if (oo && oo !== "entregadas") q.set("orden", oo);
    const s = q.toString();
    return s ? `/anuncios?${s}` : "/anuncios";
  };

  const chip = (active: boolean) => cn(
    "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
    active ? "bg-foreground text-background shadow-sm hover:shadow"
           : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
  );

  // celdas comunes de las tablas de ranking (campaña / anuncio comparten columnas)
  const metricCells = (m: Metric) => (
    <>
      <TableCell className="text-right tabular-nums">{m.pedidos.toLocaleString("es-AR")}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums">{m.entregadas.toLocaleString("es-AR")}</TableCell>
      <TableCell className={cn("text-right tabular-nums", tasaColor(m.tasaMad))}>
        <Tip tip={`Entregadas ÷ resueltas (entregadas + devueltas). Robusta a maduración. Bruta (÷ despachadas, subestima con cohortes nuevas): ${fmtPct(m.tasa)}. En la calle sin resolver: ${m.enCalle.toLocaleString("es-AR")}.`}>
          {fmtPct(m.tasaMad)}
        </Tip>
      </TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(m.devRate)}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(m.spend)}</TableCell>
      <TableCell className="text-right tabular-nums">{m.entregadas ? fmtMoney(m.cpa) : <span className="text-muted-foreground/50">—</span>}</TableCell>
      <TableCell className={cn("text-right tabular-nums", m.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : m.spend ? "text-destructive" : "text-muted-foreground/50")}>{m.spend ? fmtRatio(m.roas) : "—"}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(m.cod_cobrado)}</TableCell>
      <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(m.contrib))}>{fmtMoney(m.contrib)}</TableCell>
    </>
  );
  const rankHead = (primera: string) => (
    <TableHeader><TableRow>
      <TableHead>{primera}</TableHead>
      <TableHead className="text-right">Pedidos</TableHead>
      <TableHead className="text-right">Entregadas</TableHead>
      <TableHead className="text-right">Tasa</TableHead>
      <TableHead className="text-right">Devol.</TableHead>
      <TableHead className="text-right">Gasto</TableHead>
      <TableHead className="text-right">CPA entr.</TableHead>
      <TableHead className="text-right">ROAS</TableHead>
      <TableHead className="text-right">Cobrado</TableHead>
      <TableHead className="text-right text-amber-600 dark:text-amber-500">Contrib.</TableHead>
    </TableRow></TableHeader>
  );

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <h1 className="text-xl font-semibold">Anuncios</h1>
          <Tip tip="Cada venta cruzada con la campaña y el anuncio de Meta que la trajo (utm_content = ad_id, guardado por el form COD), y con su desenlace real de courier. Mide CALIDAD del cliente: no el pedido que entra, sino el COD que se entrega y se cobra. El gasto sale de la pauta de Meta ya sincronizada. Cohortea por día de VENTA; el gasto se suma sobre el mismo rango." />
        </div>
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
          {orden && <input type="hidden" name="orden" value={orden} />}
          <input type="date" name="desde" defaultValue={from} max={to} aria-label="Desde"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <span className="text-muted-foreground">→</span>
          <input type="date" name="hasta" defaultValue={to} max={today} aria-label="Hasta"
            className="rounded-md border bg-background px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <button type="submit" className="rounded-md bg-secondary px-3 py-1 font-medium text-secondary-foreground transition-colors hover:bg-accent">Aplicar</button>
        </form>
      </div>

      {!atribuidas.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin ventas atribuidas a Meta en el rango elegido.</CardContent></Card>
      ) : (
      <>
      {/* 0 · KPIs globales de lo atribuido */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Total atribuido a Meta
              <Tip tip="Todo sobre los pedidos que cruzan con un anuncio conocido en la pauta (utm_content = ad_id). El resto — orgánico, WhatsApp, directo, o ads viejos fuera del histórico de pauta — queda en el cubo 'sin atribución' más abajo. El gasto, el CPA y el ROAS solo tienen sentido sobre lo atribuido." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">
              cobertura {fmtPct(cobertura)} · {glob.pedidos.toLocaleString("es-AR")} de {total.pedidos.toLocaleString("es-AR")} pedidos
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {([
              { label: "Entregadas", value: glob.entregadas.toLocaleString("es-AR"), sub: `de ${glob.despachadas.toLocaleString("es-AR")} despachadas` },
              { label: "Tasa de entrega", value: fmtPct(glob.tasaMad), sub: `bruta ${fmtPct(glob.tasa)} · ${glob.enCalle.toLocaleString("es-AR")} en la calle`, cls: tasaColor(glob.tasaMad) },
              { label: "Gasto Meta", value: fmtMoney(glob.spend), sub: `CPA entregada ${fmtMoney(glob.cpa)}` },
              { label: "Cobrado (COD)", value: fmtMoney(glob.cod_cobrado), sub: `ticket ${fmtMoney(glob.ticket)}` },
              { label: "ROAS real", value: fmtRatio(glob.roas), sub: "cobrado ÷ gasto", cls: glob.roas >= 1 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive" },
              { label: "Contribución", value: fmtMoney(glob.contrib), sub: "cobrado − flete − ads", cls: pnlColor(glob.contrib) },
              { label: "Devoluciones", value: fmtPct(glob.devRate), sub: `${glob.devueltas.toLocaleString("es-AR")} guías` },
              { label: "Flete pagado", value: fmtMoney(glob.flete), sub: "sobre toda despachada" },
            ] as { label: string; value: string; sub: string; cls?: string }[]).map((k) => (
              <div key={k.label} className="sube rounded-lg bg-muted/40 p-3">
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{k.label}</div>
                <div className={cn("text-lg font-semibold tabular-nums", k.cls ?? "text-foreground")}>{k.value}</div>
                <div className="pt-0.5 text-xs tabular-nums text-muted-foreground">{k.sub}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            La tasa de entrega madura en ~21 días: en rangos recientes hay muchas guías en la calle todavía sin resolver, así que la
            entrega y el ROAS reales van a MEJORAR al madurar. La columna Tasa usa entregadas ÷ resueltas (no ÷ despachadas)
            justamente para no castigar a las cohortes nuevas. Contribución no descuenta costo de producto ni comisiones — es margen logístico neto de ads.
          </p>
        </CardContent>
      </Card>

      {/* 1 · dónde va el gasto vs de dónde salen las entregadas */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Gasto vs entregadas por campaña
            <Tip tip="Izquierda: cómo se reparte la pauta. Derecha: de qué campañas salen los clientes que efectivamente reciben y pagan. Si una campaña pesa mucho más en gasto que en entregadas, está trayendo volumen de baja calidad — plata que se va en pedidos que vuelven." />
          </span>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-center text-xs font-medium text-muted-foreground">Gasto</div>
              <Donut slices={gastoSlices} centro={fmtMoney(glob.spend)} subcentro="pauta" />
            </div>
            <div className="space-y-2">
              <div className="text-center text-xs font-medium text-muted-foreground">Entregadas</div>
              <Donut slices={entSlices} money={false} centro={glob.entregadas.toLocaleString("es-AR")} subcentro="clientes" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2 · ranking de campañas — el titular */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Campañas
              <Tip tip="La pregunta del panel: qué campaña trae más clientes de calidad. Tasa = entregadas ÷ resueltas. CPA entr. = gasto ÷ entregadas (el CPA que importa: por cliente que paga, no por pedido que entra). ROAS = cobrado ÷ gasto. Contrib. = cobrado − flete − ads. Volumen no es calidad: mirá tasa y CPA entregada juntas." />
            </span>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              <span className="text-muted-foreground">ordenar:</span>
              {(Object.keys(ORDENES) as Orden[]).map((o) => (
                <Link key={o} href={hrefWith({ orden: o })} aria-current={ord === o ? "page" : undefined} className={chip(ord === o)}>{ORDENES[o].label}</Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
          <Table>
            {rankHead("Campaña")}
            <TableBody>
              {campañas.map((c) => (
                <TableRow key={c.k}>
                  <TableCell className="max-w-[22rem] truncate font-medium" title={c.k}>{c.k}</TableCell>
                  {metricCells(c)}
                </TableRow>
              ))}
              {bucket.pedidos > 0 && (
                <TableRow className="text-muted-foreground">
                  <TableCell className="italic">
                    (sin atribución)
                    <Tip tip="Pedidos sin ad_id que cruce con la pauta: orgánico, WhatsApp, directo, o ads viejos/borrados fuera del histórico de ad_spend. No tienen gasto asociado. Su tasa de entrega suele ser más baja que la de tráfico pago maduro." />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{bucket.pedidos.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right tabular-nums">{bucket.entregadas.toLocaleString("es-AR")}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", tasaColor(bucket.tasaMad))}>{fmtPct(bucket.tasaMad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPct(bucket.devRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">—</TableCell>
                  <TableCell className="text-right tabular-nums">—</TableCell>
                  <TableCell className="text-right tabular-nums">—</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(bucket.cod_cobrado)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(bucket.cod_cobrado - bucket.flete)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 3 · ranking de anuncios — las gemas escondidas */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Anuncios
              <Tip tip="El mismo cruce a nivel creativo. Acá aparecen las gemas: un anuncio puede entregar muy por encima del promedio de su campaña — ese es el creativo que atrae al cliente que paga. Y al revés: el que gasta con tasa baja. Top 40 por el orden elegido arriba." />
            </span>
            <span className="text-xs text-muted-foreground">top 40 · orden: {ORDENES[ord].label}</span>
          </div>
          <div className="overflow-x-auto">
          <Table>
            {rankHead("Anuncio")}
            <TableBody>
              {anuncios.map((a) => (
                <TableRow key={a.k}>
                  <TableCell className="max-w-[22rem] truncate font-medium" title={`${a.ad_name ?? a.k}  ·  ${a.campaign_name ?? ""}`}>
                    {a.ad_name ?? a.k}
                    {a.campaign_name && <span className="block truncate text-xs font-normal text-muted-foreground">{a.campaign_name}</span>}
                  </TableCell>
                  {metricCells(a)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 4 · por conjunto */}
      {conjuntos.length > 1 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Conjuntos (adsets)
            <Tip tip="El nivel intermedio: la segmentación/puja. Top 15 por entregadas. Útil para ver si la calidad se juega en el conjunto (audiencia) más que en el creativo." />
          </span>
          <div className="overflow-x-auto">
          <Table>
            {rankHead("Conjunto")}
            <TableBody>
              {conjuntos.map((c) => (
                <TableRow key={c.k}>
                  <TableCell className="max-w-[22rem] truncate font-medium" title={c.k}>{c.k}</TableCell>
                  {metricCells(c)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
      )}

      {/* 5 · por producto */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Por producto
            <Tip tip="El mismo cruce sumado por producto (el producto se hereda del anuncio, vía match del nombre de la campaña). Dice qué producto atrae mejores clientes desde Meta, y con qué CPA entregada." />
          </span>
          <div className="overflow-x-auto">
          <Table>
            {rankHead("Producto")}
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p.k}>
                  <TableCell className="font-medium">{p.k}</TableCell>
                  {metricCells(p)}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* 6 · atribuido vs sin atribución */}
      {bucket.pedidos > 0 && (
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Tráfico pago (Meta) vs sin atribución
            <Tip tip="Compara la calidad del cliente que llega por pauta atribuida contra el resto (orgánico, WhatsApp, directo, ads sin match). Si el pago entrega bastante mejor, la inversión en Meta está trayendo clientes más firmes que el promedio; si no, hay que mirar qué campañas arrastran." />
          </span>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Origen</TableHead>
              <TableHead className="text-right">Pedidos</TableHead>
              <TableHead className="text-right">Entregadas</TableHead>
              <TableHead className="text-right">Tasa</TableHead>
              <TableHead className="text-right">Devol.</TableHead>
              <TableHead className="text-right">Cobrado</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {[["Meta (atribuido)", glob], ["Sin atribución", bucket]].map(([label, m]) => {
                const g = m as Metric;
                return (
                  <TableRow key={label as string}>
                    <TableCell className="font-medium">{label as string}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.pedidos.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right tabular-nums">{g.entregadas.toLocaleString("es-AR")}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", tasaColor(g.tasaMad))}>{fmtPct(g.tasaMad)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtPct(g.devRate)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(g.cod_cobrado)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      )}
      </>
      )}
    </main>
  );
}
