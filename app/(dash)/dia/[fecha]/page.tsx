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

export default async function Dia({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const db = supabaseAdmin();

  // ad_spend con nivel de conjunto (adset). Resiliente: si la columna adset_name aún no está
  // migrada (017), cae a la consulta sin conjunto. ponytail: el fallback se borra post-017.
  type Ad = { ad_name: string | null; adset_name: string | null; campaign_name: string | null; spend: number; purchases: number; product_id: number | null };
  const fetchAds = async (): Promise<Ad[]> => {
    const r = await db.from("ad_spend").select("ad_name, adset_name, campaign_name, spend, purchases, product_id").eq("date", fecha).order("spend", { ascending: false });
    if (!r.error) return (r.data ?? []) as Ad[];
    const b = await db.from("ad_spend").select("ad_name, campaign_name, spend, purchases, product_id").eq("date", fecha).order("spend", { ascending: false });
    return (b.data ?? []).map((a) => ({ ...a, adset_name: null })) as Ad[];
  };

  const [prodsRes, pnlRes, guiasRes, ads] = await Promise.all([
    db.from("products").select("id, name"),
    db.from("daily_pnl").select("courier, product_id, despachadas, entregadas, en_transito, revenue_estimado, profit_estimado, profit_confirmado, ads, flete, tasa_proyectada").eq("dispatch_date", fecha),
    db.from("shipments").select("tracking, courier, status_canonical, freight_cost, province, orders(order_number, cod_amount, customer_name, order_items(product_id, qty, unit_price))").eq("dispatched_at", fecha).order("courier"),
    fetchAds(),
  ]);
  const pname = new Map((prodsRes.data ?? []).map((p) => [p.id, p.name as string]));
  const pnl = (pnlRes.data ?? []) as Pnl[];
  const guias = (guiasRes.data ?? []) as unknown as Guia[];

  const tot = pnl.reduce((a, r) => ({
    despachadas: a.despachadas + r.despachadas, entregadas: a.entregadas + r.entregadas,
    enTransito: a.enTransito + r.en_transito, revenueEst: a.revenueEst + Number(r.revenue_estimado),
    profitEst: a.profitEst + Number(r.profit_estimado), profitConf: a.profitConf + Number(r.profit_confirmado),
    ads: a.ads + Number(r.ads), flete: a.flete + Number(r.flete),
  }), { despachadas: 0, entregadas: 0, enTransito: 0, revenueEst: 0, profitEst: 0, profitConf: 0, ads: 0, flete: 0 });
  const adsTotal = ads.reduce((s, a) => s + Number(a.spend), 0);
  const adsVentas = ads.reduce((s, a) => s + (a.purchases ?? 0), 0);

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

  // Guías agrupadas Courier → Producto → guías (colapsable, corta la lista interminable).
  // Producto = el principal del pedido (línea de mayor qty×precio), espejo de order_primary_product.
  const guiaProducto = (g: Guia): string => {
    const items = (g.orders?.order_items ?? []).filter((i) => i.product_id != null);
    if (!items.length) return "(sin producto)";
    const top = items.reduce((a, b) => (b.qty * b.unit_price > a.qty * a.unit_price ? b : a));
    return pname.get(top.product_id!) ?? `#${top.product_id}`;
  };
  type PGrp = { guias: Guia[]; cod: number; entregadas: number };
  type CGrp = { total: number; cod: number; entregadas: number; prods: Map<string, PGrp> };
  const guiasPorCourier = [...guias.reduce((m, g) => {
    const ck = COURIER[g.courier] ?? g.courier;
    const c = m.get(ck) ?? { total: 0, cod: 0, entregadas: 0, prods: new Map<string, PGrp>() };
    const cod = Number(g.orders?.cod_amount ?? 0);
    const ent = g.status_canonical === "entregado" ? 1 : 0;
    c.total++; c.cod += cod; c.entregadas += ent;
    const pk = guiaProducto(g);
    const p = c.prods.get(pk) ?? { guias: [] as Guia[], cod: 0, entregadas: 0 };
    p.guias.push(g); p.cod += cod; p.entregadas += ent;
    c.prods.set(pk, p); m.set(ck, c);
    return m;
  }, new Map<string, CGrp>()).entries()].sort((a, b) => b[1].total - a[1].total);

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
              <TableHead className="text-right">Despachos</TableHead>
              <TableHead className="text-right">Entregadas</TableHead>
              <TableHead className="text-right">Tasa proy.</TableHead>
              <TableHead className="text-right">Flete</TableHead>
              <TableHead className="text-right">Ads</TableHead>
              <TableHead className="text-right">Revenue est.</TableHead>
              <TableHead className="text-right">Profit est.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pnl.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="font-medium">{pname.get(r.product_id) ?? `#${r.product_id}`}</TableCell>
                <TableCell className="text-muted-foreground">{COURIER[r.courier] ?? r.courier}</TableCell>
                <TableCell className="text-right tabular-nums">{r.despachadas}</TableCell>
                <TableCell className="text-right tabular-nums">{r.entregadas}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.despachadas ? fmtPct(Number(r.tasa_proyectada ?? 0)) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.flete))}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(r.ads))}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(Number(r.revenue_estimado))}</TableCell>
                <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(Number(r.profit_estimado)))}>{fmtMoney(Number(r.profit_estimado))}</TableCell>
              </TableRow>
            ))}
            {!pnl.length && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Sin P&amp;L para esta fecha</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Guías del día — agrupadas Courier → Producto, desplegables (antes: lista interminable) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Guías del día ({guias.length})</h2>
        {guias.length ? (
          <div className="divide-y overflow-hidden rounded-lg border text-sm">
            <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span className="flex-1">Courier · producto</span>
              <span className="w-24 text-right">Entregadas</span>
              <span className="w-28 text-right">COD</span>
            </div>
            {guiasPorCourier.map(([cname, c]) => {
              const prods = [...c.prods.entries()].sort((a, b) => b[1].guias.length - a[1].guias.length);
              return (
                <details key={cname} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    <span className="min-w-0 flex-1 truncate font-medium">{cname} <span className="font-normal text-muted-foreground">· {c.total} guías</span></span>
                    <span className="w-24 text-right tabular-nums text-muted-foreground">{c.entregadas}/{c.total}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{fmtMoney(c.cod)}</span>
                  </summary>
                  <div className="bg-muted/20">
                    {prods.map(([prodName, p]) => (
                      <details key={prodName} className="group/prod border-t border-border/50">
                        <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 pl-8 pr-3 hover:bg-accent/30 [&::-webkit-details-marker]:hidden">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0 text-muted-foreground transition-transform group-open/prod:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                          <span className="min-w-0 flex-1 truncate">{prodName} <span className="text-muted-foreground">· {p.guias.length}</span></span>
                          <span className="w-24 text-right tabular-nums text-muted-foreground">{p.entregadas}/{p.guias.length}</span>
                          <span className="w-28 text-right tabular-nums">{fmtMoney(p.cod)}</span>
                        </summary>
                        <div>
                          {p.guias.map((g) => (
                            <div key={`${g.courier}-${g.tracking}`} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-14 pr-3">
                              <span className={cn("w-24 shrink-0 truncate text-xs", estadoColor(g.status_canonical))}>{g.status_canonical.replace(/_/g, " ")}</span>
                              <span className="shrink-0 font-mono text-xs text-muted-foreground">{g.tracking}</span>
                              <span className="w-16 shrink-0">{g.orders?.order_number ? `#${g.orders.order_number}` : "—"}</span>
                              <span className="min-w-0 flex-1 truncate text-muted-foreground">{g.orders?.customer_name ?? "—"}</span>
                              <span className="hidden w-20 truncate text-right text-muted-foreground sm:inline">{g.province ?? "—"}</span>
                              <span className="hidden w-24 text-right tabular-nums text-muted-foreground md:inline">{g.freight_cost ? fmtMoney(Number(g.freight_cost)) : "—"}</span>
                              <span className="w-28 text-right tabular-nums">{g.orders?.cod_amount ? fmtMoney(Number(g.orders.cod_amount)) : "—"}</span>
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
          <p className="text-sm text-muted-foreground">Sin guías COD ese día (las cuotas/Correo no tienen guía; se cuentan por pago).</p>
        )}
      </section>
    </main>
  );
}
