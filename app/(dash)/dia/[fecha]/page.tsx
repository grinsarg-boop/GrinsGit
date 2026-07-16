import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo" };
// entregado verde · terminales malos/incidencia rojo · resto (en la calle) ámbar
const estadoColor = (s: string) =>
  s === "entregado" ? "text-emerald-600 dark:text-emerald-400"
  : ["devuelto", "rehusado", "en_devolucion", "siniestro", "incidencia"].includes(s) ? "text-destructive"
  : "text-amber-600 dark:text-amber-500";

type Pnl = {
  courier: string; product_id: number; despachadas: number; entregadas: number; en_transito: number;
  revenue_estimado: number; profit_estimado: number; profit_confirmado: number; ads: number;
  flete: number; tasa_proyectada: number | null;
};
type Guia = {
  tracking: string; courier: string; status_canonical: string; freight_cost: number | null;
  province: string | null;
  orders: {
    order_number: string; cod_amount: number; customer_name: string | null;
    order_items: { product_id: number | null; qty: number; unit_price: number }[];
  } | null;
};
// Correo (cuotas 3, prepago): no genera guía. Es una orden, cohortada por creación ART.
type CorreoOrder = {
  order_number: string; customer_name: string | null; province: string | null;
  financial_status: string; deposit_amount: number; cod_amount: number;
  order_items: { product_id: number | null; qty: number; unit_price: number }[];
};

export default async function Dia({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const db = supabaseAdmin();
  // Día ARGENTINA (UTC-3): [fecha 03:00Z, fecha+1 03:00Z) — para cohortar Correo por created_at, como el P&L (016).
  const nd = new Date(`${fecha}T00:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1);
  const artFrom = `${fecha}T03:00:00Z`;
  const artTo = `${nd.toISOString().slice(0, 10)}T03:00:00Z`;

  // ad_spend con nivel de conjunto (adset). Resiliente: si la columna adset_name aún no está
  // migrada (017), cae a la consulta sin conjunto. ponytail: el fallback se borra post-017.
  type Ad = { ad_name: string | null; adset_name: string | null; campaign_name: string | null; spend: number; purchases: number; product_id: number | null };
  const fetchAds = async (): Promise<Ad[]> => {
    const r = await db.from("ad_spend").select("ad_name, adset_name, campaign_name, spend, purchases, product_id").eq("date", fecha).order("spend", { ascending: false });
    if (!r.error) return (r.data ?? []) as Ad[];
    const b = await db.from("ad_spend").select("ad_name, campaign_name, spend, purchases, product_id").eq("date", fecha).order("spend", { ascending: false });
    return (b.data ?? []).map((a) => ({ ...a, adset_name: null })) as Ad[];
  };

  const [prodsRes, pnlRes, guiasRes, ads, correoRes] = await Promise.all([
    db.from("products").select("id, name"),
    db.from("daily_pnl").select("courier, product_id, despachadas, entregadas, en_transito, revenue_estimado, profit_estimado, profit_confirmado, ads, flete, tasa_proyectada").eq("dispatch_date", fecha),
    db.from("shipments").select("tracking, courier, status_canonical, freight_cost, province, orders(order_number, cod_amount, customer_name, order_items(product_id, qty, unit_price))").eq("dispatched_at", fecha).order("courier"),
    fetchAds(),
    db.from("orders").select("order_number, customer_name, province, financial_status, deposit_amount, cod_amount, order_items(product_id, qty, unit_price)").ilike("tags", "%cuotas_3%").is("cancelled_at", null).in("financial_status", ["paid", "pending"]).gte("created_at", artFrom).lt("created_at", artTo),
  ]);
  const pname = new Map((prodsRes.data ?? []).map((p) => [p.id, p.name as string]));
  const pnl = (pnlRes.data ?? []) as Pnl[];
  const guias = (guiasRes.data ?? []) as unknown as Guia[];
  const correo = (correoRes.data ?? []) as unknown as CorreoOrder[];

  const tot = pnl.reduce((a, r) => ({
    despachadas: a.despachadas + r.despachadas, entregadas: a.entregadas + r.entregadas,
    enTransito: a.enTransito + r.en_transito, revenueEst: a.revenueEst + Number(r.revenue_estimado),
    profitEst: a.profitEst + Number(r.profit_estimado), profitConf: a.profitConf + Number(r.profit_confirmado),
    ads: a.ads + Number(r.ads), flete: a.flete + Number(r.flete),
  }), { despachadas: 0, entregadas: 0, enTransito: 0, revenueEst: 0, profitEst: 0, profitConf: 0, ads: 0, flete: 0 });
  const adsTotal = ads.reduce((s, a) => s + Number(a.spend), 0);
  const adsVentas = ads.reduce((s, a) => s + (a.purchases ?? 0), 0);
  // Gasto CRUDO por producto (Paso 1: keyword del anuncio) — antes del reparto por entregas del P&L.
  const adsPorProducto = [...ads.reduce((m, a) => {
    const k = a.product_id ? (pname.get(a.product_id) ?? `#${a.product_id}`) : "sin producto";
    return m.set(k, (m.get(k) ?? 0) + Number(a.spend));
  }, new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);

  // Agrupar Campaña → Conjunto (adset) → Anuncio. Cada nivel se despliega.
  type Adset = { spend: number; purchases: number; ads: Ad[] };
  type Camp = { spend: number; purchases: number; adsets: Map<string, Adset> };
  const campañas = [...ads.reduce((m, a) => {
    const ck = a.campaign_name || "(sin campaña)";
    const c = m.get(ck) ?? { spend: 0, purchases: 0, adsets: new Map<string, Adset>() };
    c.spend += Number(a.spend); c.purchases += a.purchases ?? 0;
    const ak = a.adset_name || "(sin conjunto)";
    const s = c.adsets.get(ak) ?? { spend: 0, purchases: 0, ads: [] as Ad[] };
    s.spend += Number(a.spend); s.purchases += a.purchases ?? 0; s.ads.push(a);
    c.adsets.set(ak, s); m.set(ck, c);
    return m;
  }, new Map<string, Camp>()).entries()].sort((a, b) => b[1].spend - a[1].spend);

  // Despachos del día agrupados Courier → Producto → ítem (colapsable, corta la lista interminable).
  // Urbano/Fixy son guías (entrega/COD); Correo son órdenes prepago (pagadas/generadas + confirmado).
  // Producto = el principal del pedido (mayor qty×precio), espejo de order_primary_product.
  const primaryProduct = (items: { product_id: number | null; qty: number; unit_price: number }[]): string => {
    const withP = items.filter((i) => i.product_id != null);
    if (!withP.length) return "(sin producto)";
    const top = withP.reduce((a, b) => (b.qty * b.unit_price > a.qty * a.unit_price ? b : a));
    return pname.get(top.product_id!) ?? `#${top.product_id}`;
  };
  type Item = {
    key: string; estadoClass: string; estadoText: string; tracking: string | null;
    orden: string | null; cliente: string | null; province: string | null; freight: number | null; monto: number;
  };
  type Prod = { name: string; count: number; ok: number; value: number; items: Item[] };
  type Grupo = { name: string; unit: string; okWord: string; count: number; ok: number; value: number; prods: Prod[] };
  const groupByProduct = (rows: { product: string; ok: boolean; value: number; item: Item }[]) => {
    const m = new Map<string, Prod>();
    let count = 0, ok = 0, value = 0;
    for (const e of rows) {
      count++; if (e.ok) ok++; value += e.value;
      const p = m.get(e.product) ?? { name: e.product, count: 0, ok: 0, value: 0, items: [] };
      p.count++; if (e.ok) p.ok++; p.value += e.value; p.items.push(e.item);
      m.set(e.product, p);
    }
    return { prods: [...m.values()].sort((a, b) => b.count - a.count), count, ok, value };
  };
  const grupos: Grupo[] = [];
  for (const ck of ["urbano", "fixy"] as const) {
    const gs = guias.filter((g) => g.courier === ck);
    if (!gs.length) continue;
    const g = groupByProduct(gs.map((s) => ({
      product: primaryProduct(s.orders?.order_items ?? []),
      ok: s.status_canonical === "entregado",
      value: Number(s.orders?.cod_amount ?? 0),
      item: {
        key: `${s.courier}-${s.tracking}`, estadoClass: estadoColor(s.status_canonical),
        estadoText: s.status_canonical.replace(/_/g, " "), tracking: s.tracking,
        orden: s.orders?.order_number ?? null, cliente: s.orders?.customer_name ?? null,
        province: s.province, freight: s.freight_cost != null ? Number(s.freight_cost) : null,
        monto: Number(s.orders?.cod_amount ?? 0),
      },
    })));
    grupos.push({ name: COURIER[ck] ?? ck, unit: "guías", okWord: "entreg.", ...g });
  }
  if (correo.length) {
    const g = groupByProduct(correo.map((o) => ({
      product: primaryProduct(o.order_items ?? []),
      ok: o.financial_status === "paid",
      value: o.financial_status === "paid" ? Number(o.deposit_amount) : 0, // confirmado (prepago cobrado)
      item: {
        key: `correo-${o.order_number}`,
        estadoClass: o.financial_status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500",
        estadoText: o.financial_status === "paid" ? "pagado" : "pendiente", tracking: null,
        orden: o.order_number, cliente: o.customer_name, province: o.province, freight: null,
        monto: Number(o.cod_amount),
      },
    })));
    grupos.push({ name: "Correo", unit: "órdenes", okWord: "pag.", ...g });
  }
  grupos.sort((a, b) => b.count - a.count);
  const totalDesp = grupos.reduce((s, g) => s + g.count, 0);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← Volver</Link>
          <h1 className="text-xl font-semibold">Despachos del {fmtDate(fecha)}</h1>
        </div>
        <span className="text-sm text-muted-foreground"><b className="text-foreground tabular-nums">{tot.despachadas}</b> guías · <b className="text-foreground tabular-nums">{tot.entregadas}</b> entregadas · <b className="text-foreground tabular-nums">{tot.enTransito}</b> en la calle</span>
      </div>

      {/* Totales del día */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Profit estimado", value: fmtMoney(tot.profitEst), color: pnlColor(tot.profitEst), tip: "Confirmado más la proyección de lo que sigue en camino, menos Ads." },
          { label: "Confirmado", value: fmtMoney(tot.profitConf), color: tot.profitConf < 0 ? "text-destructive/80" : "text-foreground", tip: "Plata que ya cobraste, neta del gasto de Ads del período. Puede dar negativo de forma temporal: significa que todavía gastaste más en Ads de lo que maduró en ventas, y se corrige a medida que las guías se entregan." },
          { label: "Revenue estimado", value: fmtMoney(tot.revenueEst), color: "text-foreground", tip: null },
          { label: "Gasto en Ads", value: fmtMoney(adsTotal), color: "text-foreground", tip: null },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">
                {k.label}
                {k.tip && <Tip tip={k.tip} />}
              </div>
              <div className={cn("text-2xl font-bold tabular-nums tracking-tight", k.color)}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Gasto en Ads del día — por campaña, desplegable a sus anuncios (ahorra espacio) */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-sm font-semibold">Gasto en Ads del día — {fmtMoney(adsTotal)}</h2>
          {adsVentas > 0 && (
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              {adsVentas} venta{adsVentas === 1 ? "" : "s"}
              <Tip tip="Compras que Meta le atribuye a los anuncios (según su ventana de atribución), no necesariamente entregas COD." />
            </span>
          )}
        </div>
        {adsPorProducto.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium uppercase tracking-wide">
              Crudo por producto
              <Tip tip="Gasto tal cual lo reporta Meta ese día, repartido por producto según la keyword del anuncio (Paso 1). En el P&L este gasto se re-reparte entre las entregas del período (Fixy ×1,4, Correo por generados), así que el 'Ads' del P&L no coincide con este número." />
            </span>
            {adsPorProducto.map(([p, v]) => (
              <span key={p} className={cn("tabular-nums", p === "sin producto" && "text-amber-600 dark:text-amber-500")}>
                {p} <b className="text-foreground">{fmtMoney(v)}</b>
              </span>
            ))}
          </div>
        )}
        {campañas.length ? (
          <div className="divide-y overflow-hidden rounded-lg border text-sm">
            {/* encabezado de columnas */}
            <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Campaña · conjunto · anuncio</span>
              <span className="w-20 text-right">Anuncios</span>
              <span className="w-16 text-right">Ventas</span>
              <span className="w-24 text-right">Gasto</span>
            </div>
            {campañas.map(([cname, c]) => {
              const nAds = [...c.adsets.values()].reduce((n, s) => n + s.ads.length, 0);
              const adsets = [...c.adsets.entries()].sort((a, b) => b[1].spend - a[1].spend);
              return (
                <details key={cname} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    <span className="min-w-0 flex-1 truncate font-medium">{cname}</span>
                    <span className="w-20 text-right tabular-nums text-muted-foreground">{nAds}</span>
                    <span className="w-16 text-right tabular-nums">{c.purchases > 0 ? c.purchases : "—"}</span>
                    <span className="w-24 text-right font-semibold tabular-nums">{fmtMoney(c.spend)}</span>
                  </summary>
                  <div className="bg-muted/20">
                    {adsets.map(([aname, s]) => (
                      <details key={aname} className="group/as border-t border-border/50">
                        <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 pl-8 pr-3 hover:bg-accent/30 [&::-webkit-details-marker]:hidden">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0 text-muted-foreground transition-transform group-open/as:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                          <span className="min-w-0 flex-1 truncate">{aname}</span>
                          <span className="w-20 text-right tabular-nums text-muted-foreground">{s.ads.length}</span>
                          <span className="w-16 text-right tabular-nums">{s.purchases > 0 ? s.purchases : "—"}</span>
                          <span className="w-24 text-right tabular-nums">{fmtMoney(s.spend)}</span>
                        </summary>
                        <div>
                          {[...s.ads].sort((a, b) => Number(b.spend) - Number(a.spend)).map((a, i) => (
                            <div key={i} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-14 pr-3">
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">{a.ad_name || "—"}</span>
                              <span className={cn("hidden w-28 truncate text-right text-xs sm:inline", !a.product_id && "text-amber-600 dark:text-amber-500")}>
                                {a.product_id ? pname.get(a.product_id) ?? `#${a.product_id}` : "sin producto"}
                              </span>
                              <span className="w-16 text-right tabular-nums">{a.purchases > 0 ? a.purchases : "—"}</span>
                              <span className="w-24 text-right tabular-nums text-muted-foreground">{fmtMoney(Number(a.spend))}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Sin gasto en Ads registrado ese día.</p>
        )}
      </section>

      {/* P&L por producto */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">P&amp;L por producto</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead className="text-right">Despachos <Tip tip="COD (Urbano/Fixy): guías despachadas. Correo (prepago, cuotas): órdenes generadas — no hay guía." /></TableHead>
              <TableHead className="text-right">Entregadas <Tip tip="COD: guías entregadas. Correo (prepago): pagadas/confirmadas — no hay entrega, la plata ya entró." /></TableHead>
              <TableHead className="text-right">Tasa proy. <Tip tip="COD: tasa de entrega proyectada. Correo (prepago): tasa de confirmación (pagados/generados), sin proyección de entrega." /></TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Ads</TableHead>
              <TableHead className="text-right">Revenue est.</TableHead>
              <TableHead className="text-right">Profit est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pnl.map((r, i) => {
              const isCorreo = r.courier === "correo";
              return (
              <TableRow key={i}>
                <TableCell className="font-medium">{pname.get(r.product_id) ?? `#${r.product_id}`}</TableCell>
                <TableCell className="text-muted-foreground">{COURIER[r.courier] ?? r.courier}</TableCell>
                <TableCell className="text-right tabular-nums">{r.despachadas}{isCorreo && <span className="ml-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">gen</span>}</TableCell>
                <TableCell className="text-right tabular-nums">{r.entregadas}{isCorreo && <span className="ml-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">pag</span>}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.despachadas ? fmtPct(Number(r.tasa_proyectada ?? 0)) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.flete))}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.ads))}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(Number(r.revenue_estimado))}</TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(Number(r.profit_estimado)))}>{fmtMoney(Number(r.profit_estimado))}</TableCell>
              </TableRow>
              );
            })}
            {!pnl.length && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sin P&amp;L para esta fecha</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Despachos del día — agrupados Courier → Producto, desplegables (antes: lista interminable) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Despachos del día ({totalDesp})</h2>
        {totalDesp ? (
          <>
            <p className="max-w-[70ch] text-xs text-muted-foreground">
              Urbano y Fixy son guías (entrega / COD). <b className="text-foreground">Correo</b> es prepago (cuotas 3): órdenes, con <b className="text-foreground">pagadas/generadas</b> y monto confirmado — sin guía ni entrega.
            </p>
            <div className="divide-y overflow-hidden rounded-lg border text-sm">
              <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <span className="flex-1">Courier · producto</span>
                <span className="w-28 text-right">Cerradas</span>
                <span className="w-28 text-right">Monto</span>
              </div>
              {grupos.map((grp) => (
                <details key={grp.name} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    <span className="min-w-0 flex-1 truncate font-medium">{grp.name} <span className="font-normal text-muted-foreground">· {grp.count} {grp.unit}</span></span>
                    <span className="w-28 text-right tabular-nums text-muted-foreground">{grp.ok}/{grp.count} {grp.okWord}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{fmtMoney(grp.value)}</span>
                  </summary>
                  <div className="bg-muted/20">
                    {grp.prods.map((p) => (
                      <details key={p.name} className="group/prod border-t border-border/50">
                        <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 pl-8 pr-3 hover:bg-accent/30 [&::-webkit-details-marker]:hidden">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0 text-muted-foreground transition-transform group-open/prod:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                          <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-muted-foreground">· {p.count}</span></span>
                          <span className="w-28 text-right tabular-nums text-muted-foreground">{p.ok}/{p.count} {grp.okWord}</span>
                          <span className="w-28 text-right tabular-nums">{fmtMoney(p.value)}</span>
                        </summary>
                        <div>
                          {p.items.map((it) => (
                            <div key={it.key} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-14 pr-3">
                              <span className={cn("w-24 shrink-0 truncate text-xs", it.estadoClass)}>{it.estadoText}</span>
                              {it.tracking && <span className="shrink-0 font-mono text-xs text-muted-foreground">{it.tracking}</span>}
                              <span className="w-16 shrink-0">{it.orden ? `#${it.orden}` : "—"}</span>
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">{it.cliente ?? "—"}</span>
                              <span className="hidden w-20 truncate text-right text-muted-foreground sm:inline">{it.province ?? "—"}</span>
                              <span className="hidden w-24 text-right tabular-nums text-muted-foreground md:inline">{it.freight != null ? fmtMoney(it.freight) : ""}</span>
                              <span className="w-28 text-right tabular-nums">{it.monto ? fmtMoney(it.monto) : "—"}</span>
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Sin despachos ese día.</p>
        )}
      </section>
    </main>
  );
}
