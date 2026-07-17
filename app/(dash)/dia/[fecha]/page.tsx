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
const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };
// entregado verde · terminales malos (plata perdida) rojo · incidencia naranja (accionable: reclamar
// a Urbano) · resto (en la calle, normal) ámbar. La incidencia sale del rojo para no perderse entre
// los cerrados-malos.
const estadoColor = (s: string) =>
  s === "entregado" ? "text-emerald-600 dark:text-emerald-400"
  : s === "incidencia" ? "text-orange-600 dark:text-orange-500"
  : ["devuelto", "rehusado", "en_devolucion", "siniestro"].includes(s) ? "text-destructive"
  : "text-amber-600 dark:text-amber-500";

type Pnl = {
  courier: string; product_id: number; despachadas: number; entregadas: number; en_transito: number;
  revenue_estimado: number; profit_estimado: number; profit_confirmado: number; ads: number;
  flete: number; tasa_proyectada: number | null;
};
type Guia = {
  tracking: string; courier: string; status_canonical: string; status_raw: string | null; freight_cost: number | null;
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

export default async function Dia({ params, searchParams }: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ courier?: string; desde?: string; hasta?: string; v?: string }>;
}) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const sp = await searchParams;
  // Filtro de courier heredado del panel principal (Urbano/Fixy/Correo o null = Todos).
  const courierParam = sp.courier === "urbano" || sp.courier === "fixy" || sp.courier === "correo" || sp.courier === "ml" ? sp.courier : null;
  // "Volver" preserva el estado del panel (courier + rango + vista).
  const backQs = new URLSearchParams();
  if (sp.courier) backQs.set("courier", sp.courier);
  if (sp.desde) backQs.set("desde", sp.desde);
  if (sp.hasta) backQs.set("hasta", sp.hasta);
  if (sp.v) backQs.set("v", sp.v);
  const backHref = backQs.toString() ? `/?${backQs}` : "/";
  const db = supabaseAdmin();
  // Día ARGENTINA (UTC-3): [fecha 03:00Z, fecha+1 03:00Z) — para cohortar Correo por created_at, como el P&L (016).
  const nd = new Date(`${fecha}T00:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1);
  const artFrom = `${fecha}T03:00:00Z`;
  const artTo = `${nd.toISOString().slice(0, 10)}T03:00:00Z`;

  // El filtro de courier del panel se aplica a cada sección: P&L, guías y (según corresponda) Correo.
  let pnlQ = db.from("daily_pnl").select("courier, product_id, despachadas, entregadas, en_transito, revenue_estimado, profit_estimado, profit_confirmado, ads, flete, tasa_proyectada").eq("dispatch_date", fecha);
  let guiasQ = db.from("shipments").select("tracking, courier, status_canonical, status_raw, freight_cost, province, orders(order_number, cod_amount, customer_name, order_items(product_id, qty, unit_price))").eq("dispatched_at", fecha).order("courier");
  if (courierParam) { pnlQ = pnlQ.eq("courier", courierParam); guiasQ = guiasQ.eq("courier", courierParam); }
  // Correo (cuotas) no está en shipments; solo se consulta si el filtro es Correo o Todos.
  const wantCorreo = !courierParam || courierParam === "correo";
  const correoQ = wantCorreo
    ? db.from("orders").select("order_number, customer_name, province, financial_status, deposit_amount, cod_amount, order_items(product_id, qty, unit_price)").ilike("tags", "%cuotas_3%").is("cancelled_at", null).in("financial_status", ["paid", "pending"]).gte("created_at", artFrom).lt("created_at", artTo)
    : Promise.resolve({ data: [] as CorreoOrder[] });

  const [prodsRes, pnlRes, guiasRes, correoRes] = await Promise.all([
    db.from("products").select("id, name"),
    pnlQ,
    guiasQ,
    correoQ,
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
  // Despachos del día agrupados Courier → Producto → ítem (colapsable, corta la lista interminable).
  // Urbano/Fixy son guías (entrega/COD); Correo son órdenes prepago (pagadas/generadas + confirmado).
  // Producto = el principal del pedido (mayor qty×precio), espejo de order_primary_product.
  const primaryProduct = (items: { product_id: number | null; qty: number; unit_price: number }[]): string => {
    const withP = items.filter((i) => i.product_id != null);
    if (!withP.length) return "(sin producto)";
    const top = withP.reduce((a, b) => (b.qty * b.unit_price > a.qty * a.unit_price ? b : a));
    return pname.get(top.product_id!) ?? `#${top.product_id}`;
  };
  // "No despachado" (misma regla que el recompute 018): PI(urbano)/pendiente-retiro(fixy) con +7 días.
  const hoy = new Date().toISOString().slice(0, 10);
  const diasDesdeDespacho = Math.floor((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${fecha}T00:00:00Z`)) / 86400000);
  const esNoDespachado = (s: Guia) =>
    diasDesdeDespacho > 7 && (
      (s.courier === "urbano" && s.status_raw === "PI") ||
      (s.courier === "fixy" && (s.status_raw === "41" || (s.status_raw ?? "").toLowerCase().includes("pendiente de retiro")))
    );
  // Link al seguimiento de Urbano (ver estado y reclamar). tracking = cli_codigo (id Shopify).
  const urbanoTrack = (tk: string) =>
    `https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=${Number(process.env.URBANO_SHIPPER) || 4362}&cli_codigo=${tk}`;

  type Item = {
    key: string; estadoClass: string; estadoText: string; tracking: string | null; trackUrl: string | null;
    orden: string | null; cliente: string | null; province: string | null; freight: number | null; monto: number;
  };
  type Prod = { name: string; count: number; ok: number; value: number; noDesp: number; items: Item[] };
  type Grupo = { name: string; unit: string; okWord: string; count: number; ok: number; value: number; noDesp: number; prods: Prod[] };
  const groupByProduct = (rows: { product: string; ok: boolean; value: number; noDesp: boolean; item: Item }[]) => {
    const m = new Map<string, Prod>();
    let count = 0, ok = 0, value = 0, noDesp = 0;
    for (const e of rows) {
      const p = m.get(e.product) ?? { name: e.product, count: 0, ok: 0, value: 0, noDesp: 0, items: [] };
      p.items.push(e.item);
      // no_despachado no cuenta como despacho ni suma COD (nunca se cobró); se cuenta aparte.
      if (e.noDesp) { noDesp++; p.noDesp++; }
      else { count++; if (e.ok) ok++; value += e.value; p.count++; if (e.ok) p.ok++; p.value += e.value; }
      m.set(e.product, p);
    }
    return { prods: [...m.values()].sort((a, b) => (b.count + b.noDesp) - (a.count + a.noDesp)), count, ok, value, noDesp };
  };
  const grupos: Grupo[] = [];
  for (const ck of ["urbano", "fixy"] as const) {
    const gs = guias.filter((g) => g.courier === ck);
    if (!gs.length) continue;
    const g = groupByProduct(gs.map((s) => {
      const nd = esNoDespachado(s);
      return {
        product: primaryProduct(s.orders?.order_items ?? []),
        ok: s.status_canonical === "entregado",
        value: Number(s.orders?.cod_amount ?? 0),
        noDesp: nd,
        item: {
          key: `${s.courier}-${s.tracking}`,
          estadoClass: nd ? "text-destructive" : estadoColor(s.status_canonical),
          estadoText: nd ? "no despachado" : s.status_canonical.replace(/_/g, " "),
          tracking: s.tracking,
          trackUrl: s.courier === "urbano" && s.tracking ? urbanoTrack(s.tracking) : null,
          orden: s.orders?.order_number ?? null, cliente: s.orders?.customer_name ?? null,
          province: s.province, freight: s.freight_cost != null ? Number(s.freight_cost) : null,
          monto: Number(s.orders?.cod_amount ?? 0),
        },
      };
    }));
    grupos.push({ name: COURIER[ck] ?? ck, unit: "guías", okWord: "entreg.", ...g });
  }
  if (correo.length) {
    const g = groupByProduct(correo.map((o) => ({
      product: primaryProduct(o.order_items ?? []),
      ok: o.financial_status === "paid",
      value: o.financial_status === "paid" ? Number(o.deposit_amount) : 0, // confirmado (prepago cobrado)
      noDesp: false, // Correo es prepago, no tiene guía → nunca "no despachado"
      item: {
        key: `correo-${o.order_number}`,
        estadoClass: o.financial_status === "paid" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-500",
        estadoText: o.financial_status === "paid" ? "pagado" : "pendiente", tracking: null, trackUrl: null,
        orden: o.order_number, cliente: o.customer_name, province: o.province, freight: null,
        monto: Number(o.cod_amount),
      },
    })));
    grupos.push({ name: "Correo", unit: "órdenes", okWord: "pag.", ...g });
  }
  grupos.sort((a, b) => (b.count + b.noDesp) - (a.count + a.noDesp));
  const totalDesp = grupos.reduce((s, g) => s + g.count, 0);
  const totalNoDesp = grupos.reduce((s, g) => s + g.noDesp, 0);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← Volver</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Despachos del {fmtDate(fecha)}
            {courierParam && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2 py-0.5 text-sm text-background">
                {COURIER[courierParam]}
                <Link href={`/dia/${fecha}`} title="Ver todos los couriers" className="text-background/60 hover:text-background">×</Link>
              </span>
            )}
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">
          {courierParam === "correo" ? (
            <><b className="text-foreground tabular-nums">{tot.despachadas}</b> órdenes · <b className="text-foreground tabular-nums">{tot.entregadas}</b> pagadas · <b className="text-foreground tabular-nums">{tot.enTransito}</b> pendientes</>
          ) : (
            <><b className="text-foreground tabular-nums">{tot.despachadas}</b> guías · <b className="text-foreground tabular-nums">{tot.entregadas}</b> entregadas · <b className="text-foreground tabular-nums">{tot.enTransito}</b> en la calle{totalNoDesp > 0 && <> · <b className="text-destructive tabular-nums">{totalNoDesp}</b> no despachadas</>}</>
          )}
        </span>
      </div>

      {/* Totales del día */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Profit estimado", value: fmtMoney(tot.profitEst), color: pnlColor(tot.profitEst), tip: "Confirmado más la proyección de lo que sigue en camino, menos Ads." },
          { label: "Confirmado", value: fmtMoney(tot.profitConf), color: tot.profitConf < 0 ? "text-destructive/80" : "text-foreground", tip: "Plata que ya cobraste, neta del gasto de Ads del período. Puede dar negativo de forma temporal: significa que todavía gastaste más en Ads de lo que maduró en ventas, y se corrige a medida que las guías se entregan." },
          { label: "Revenue estimado", value: fmtMoney(tot.revenueEst), color: "text-foreground", tip: null },
          { label: "Gasto en Ads", value: fmtMoney(tot.ads), color: "text-foreground", tip: courierParam
              ? `Pauta atribuida a los despachos de ${COURIER[courierParam]} (repartida por el P&L). El gasto crudo total de Meta del día está en la sección de abajo.`
              : "Pauta atribuida a los despachos del día (repartida por el P&L). El gasto crudo de Meta está en la sección de abajo." },
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

      {/* P&L por producto */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">P&amp;L por producto</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead>
              <TableHead>Courier</TableHead>
              <TableHead className="text-right">Despachos <Tip tip="COD (Urbano/Fixy): guías despachadas. Correo (prepago, cuotas): órdenes generadas — no hay guía." /></TableHead>
              <TableHead className="w-32">Madurez <Tip tip="Qué % de las guías de este producto ya se resolvieron (entregadas, devueltas, etc.). A más madurez, más firme el estimado. En Correo: qué % de las órdenes ya maduraron." /></TableHead>
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
              const madurez = r.despachadas ? (r.despachadas - r.en_transito) / r.despachadas : 0;
              return (
              <TableRow key={i}>
                <TableCell className="font-medium">{pname.get(r.product_id) ?? `#${r.product_id}`}</TableCell>
                <TableCell className="text-muted-foreground">{COURIER[r.courier] ?? r.courier}</TableCell>
                <TableCell className="text-right tabular-nums">{r.despachadas}{isCorreo && <span className="ml-1 text-[0.6rem] uppercase tracking-wide text-muted-foreground">gen</span>}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[60px] flex-none rounded bg-muted">
                      <div className="h-1.5 rounded bg-foreground" style={{ width: `${madurez * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtPct(madurez)}</span>
                  </div>
                </TableCell>
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
              <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Sin P&amp;L para esta fecha</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      {/* Despachos del día — agrupados Courier → Producto, desplegables (antes: lista interminable) */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">
          Despachos del día ({totalDesp})
          {totalNoDesp > 0 && <span className="ml-1 font-normal text-destructive">· {totalNoDesp} no despachadas</span>}
        </h2>
        {(totalDesp || totalNoDesp) ? (
          <>
            <p className="max-w-[70ch] text-xs text-muted-foreground">
              Urbano y Fixy son guías (entrega / COD). <b className="text-foreground">Correo</b> es prepago (cuotas 3): órdenes, con <b className="text-foreground">pagadas/generadas</b> y monto confirmado — sin guía ni entrega. Las <span className="text-orange-600 dark:text-orange-500">incidencias</span> hay que reclamarlas: tocá la guía de Urbano para abrir su seguimiento.
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
                    <span className="min-w-0 flex-1 truncate font-medium">{grp.name} <span className="font-normal text-muted-foreground">· {grp.count} {grp.unit}</span>{grp.noDesp > 0 && <span className="font-normal text-destructive"> · {grp.noDesp} no desp.</span>}</span>
                    <span className="w-28 text-right tabular-nums text-muted-foreground">{grp.ok}/{grp.count} {grp.okWord}</span>
                    <span className="w-28 text-right font-semibold tabular-nums">{fmtMoney(grp.value)}</span>
                  </summary>
                  <div className="bg-muted/20">
                    {grp.prods.map((p) => (
                      <details key={p.name} className="group/prod border-t border-border/50">
                        <summary className="flex cursor-pointer list-none items-center gap-3 py-1.5 pl-8 pr-3 hover:bg-accent/30 [&::-webkit-details-marker]:hidden">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3 shrink-0 text-muted-foreground transition-transform group-open/prod:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                          <span className="min-w-0 flex-1 truncate">{p.name} <span className="text-muted-foreground">· {p.count}</span>{p.noDesp > 0 && <span className="text-destructive"> · {p.noDesp} no desp.</span>}</span>
                          <span className="w-28 text-right tabular-nums text-muted-foreground">{p.ok}/{p.count} {grp.okWord}</span>
                          <span className="w-28 text-right tabular-nums">{fmtMoney(p.value)}</span>
                        </summary>
                        <div>
                          {p.items.map((it) => (
                            <div key={it.key} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-14 pr-3">
                              <span className={cn("w-24 shrink-0 truncate text-xs", it.estadoClass)}>{it.estadoText}</span>
                              {it.tracking && (it.trackUrl ? (
                                <a href={it.trackUrl} target="_blank" rel="noopener noreferrer"
                                   title="Ver seguimiento en Urbano (para reclamar)"
                                   className="shrink-0 font-mono text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
                                  {it.tracking}<span aria-hidden className="ml-0.5 no-underline">↗</span>
                                </a>
                              ) : (
                                <span className="shrink-0 font-mono text-xs text-muted-foreground">{it.tracking}</span>
                              ))}
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
