import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");
const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };

// Estados de despacho de una VENTA COD (orden generada ese día), de mejor a peor. "pendiente" = orden válida
// sin guía todavía (la brecha que explica un % de despacho bajo). "no_despachado" = guía pegada +7d (regla 018).
const ESTADOS = [
  { key: "entregado",     label: "Entregada",           cls: "bg-emerald-500" },
  { key: "en_camino",     label: "En la calle",         cls: "bg-amber-500" },
  { key: "incidencia",    label: "Incidencia",          cls: "bg-orange-500" },
  { key: "en_devolucion", label: "En devolución",       cls: "bg-red-400" },
  { key: "devuelto",      label: "Devuelta",            cls: "bg-red-500" },
  { key: "rehusado",      label: "Rehusada",            cls: "bg-red-500" },
  { key: "siniestro",     label: "Siniestro",           cls: "bg-red-700" },
  { key: "no_despachado", label: "No despachada (+7d)", cls: "bg-red-600" },
  { key: "sin_guia_vencida", label: "No se va a despachar (+7d sin guía)", cls: "bg-red-500" },
  { key: "pendiente",     label: "Sin guía todavía",    cls: "bg-slate-400" },
] as const;
type EstadoKey = typeof ESTADOS[number]["key"];
const ESTADO_TXT: Record<string, string> = Object.fromEntries(ESTADOS.map((e) => [e.key, e.label]));
const ESTADO_CLS: Record<string, string> = Object.fromEntries(ESTADOS.map((e) => [e.key, e.cls]));

type Ship = { courier: string; tracking: string; status_canonical: string; status_raw: string | null; dispatched_at: string | null; status_at: string | null };
type OrderRow = {
  order_number: string; customer_name: string | null; province: string | null; courier: string | null;
  cancelled_at: string | null; cod_amount: number; financial_status: string | null; tags: string | null;
  order_items: { product_id: number | null; qty: number; unit_price: number }[];
  shipments: Ship[];
};
type MlRow = { units: number; total_amount: number };
type PanelRow = {
  sale_date: string; generadas: number; despachadas: number; entregadas: number; resueltas: number;
  revenue_estimado: number; profit_confirmado: number; profit_estimado: number; ads: number; ads_sin_cohorte: number;
};

export default async function VentaDia({ params, searchParams }: {
  params: Promise<{ fecha: string }>;
  searchParams: Promise<{ courier?: string; desde?: string; hasta?: string; v?: string }>;
}) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const sp = await searchParams;
  const courierParam = sp.courier === "urbano" || sp.courier === "fixy" || sp.courier === "correo" || sp.courier === "ml" ? sp.courier : null;
  const back = new URLSearchParams();
  if (sp.courier) back.set("courier", sp.courier);
  if (sp.desde) back.set("desde", sp.desde);
  if (sp.hasta) back.set("hasta", sp.hasta);
  if (sp.v) back.set("v", sp.v);
  const backHref = back.toString() ? `/ventas?${back}` : "/ventas";

  const db = supabaseAdmin();
  // Día ARGENTINA (UTC-3): [fecha 03:00Z, fecha+1 03:00Z), igual que sales_days cohortea por created_at ART.
  const nd = new Date(`${fecha}T00:00:00Z`); nd.setUTCDate(nd.getUTCDate() + 1);
  const artFrom = `${fecha}T03:00:00Z`;
  const artTo = `${nd.toISOString().slice(0, 10)}T03:00:00Z`;
  const hoy = new Date().toISOString().slice(0, 10);
  const diasDesde = (d: string | null) => d ? Math.floor((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${d}T00:00:00Z`)) / 86400000) : 0;
  // Antigüedad de la cohorte de venta: si ya pasaron 7 días y la orden sigue sin guía, a esta altura no se
  // va a despachar (regla del dueño) → se muestra como pérdida definitiva, no como "sin guía todavía".
  const cohorteVencida = diasDesde(fecha) >= 7;

  const wantCorreo = !courierParam || courierParam === "correo";
  const wantMl = !courierParam || courierParam === "ml";

  // El RESUMEN sale de sales_days (idéntico al panel → los números cuadran con la fila que clickeaste).
  // El DESGLOSE de estados sale de las órdenes crudas (el "por qué" del despacho COD).
  // ponytail: un día son ~100-300 órdenes (< límite 1000 de PostgREST); si algún día lo supera, paginar.
  const [sdRes, prodsRes, ordersRes, mlRes] = await Promise.all([
    db.rpc("sales_days", { p_from: fecha, p_courier: courierParam }),
    db.from("products").select("id, name"),
    db.from("orders")
      .select("order_number, customer_name, province, courier, cancelled_at, cod_amount, financial_status, tags, order_items(product_id, qty, unit_price), shipments(courier, tracking, status_canonical, status_raw, dispatched_at, status_at)")
      .gte("created_at", artFrom).lt("created_at", artTo),
    wantMl
      ? db.from("ml_orders").select("units, total_amount").eq("status", "paid").gte("created_at", artFrom).lt("created_at", artTo)
      : Promise.resolve({ data: [] as MlRow[] }),
  ]);
  const panel = ((sdRes.data ?? []) as PanelRow[]).find((r) => r.sale_date === fecha);
  const pname = new Map((prodsRes.data ?? []).map((p) => [p.id, p.name as string]));
  const orders = (ordersRes.data ?? []) as unknown as OrderRow[];
  const ml = (mlRes.data ?? []) as MlRow[];

  const primaryProduct = (items: { product_id: number | null; qty: number; unit_price: number }[]): { id: number | null; name: string } => {
    const withP = items.filter((i) => i.product_id != null);
    if (!withP.length) return { id: null, name: "(sin producto)" };
    const top = withP.reduce((a, b) => (b.qty * b.unit_price > a.qty * a.unit_price ? b : a));
    return { id: top.product_id, name: pname.get(top.product_id!) ?? `#${top.product_id}` };
  };
  // Trabado: sigue en la calle y hace 2 semanas que no registra movimiento de estado (para reclamar).
  const CUT14 = Date.now() - 14 * 86400000;
  const estadoDe = (o: OrderRow): { estado: EstadoKey; tracking: string | null; trabado: boolean } => {
    const desp = o.shipments.filter((s) => s.dispatched_at && s.status_canonical !== "cancelado");
    if (!desp.length) return { estado: cohorteVencida ? "sin_guia_vencida" : "pendiente", tracking: null, trabado: false };
    const s = desp.reduce((a, b) => ((b.dispatched_at ?? "") > (a.dispatched_at ?? "") ? b : a));
    const tk = s.courier === "urbano" ? s.tracking : null;   // el seguimiento web es de Urbano (como en /dia)
    const noDesp = diasDesde(s.dispatched_at) > 7 && (
      (s.courier === "urbano" && s.status_raw === "PI") ||
      (s.courier === "fixy" && (s.status_raw === "41" || (s.status_raw ?? "").toLowerCase().includes("pendiente de retiro")))
    );
    if (noDesp) return { estado: "no_despachado", tracking: tk, trabado: false };
    const st = s.status_canonical;
    const estado: EstadoKey = st === "entregado" ? "entregado"
      : ["en_devolucion", "devuelto", "rehusado", "siniestro", "incidencia"].includes(st) ? (st as EstadoKey)
      : "en_camino";
    const enCalle = !["entregado", "en_devolucion", "devuelto", "rehusado", "siniestro"].includes(estado);
    const mov = Date.parse(s.status_at ?? s.dispatched_at ?? "");
    return { estado, tracking: tk, trabado: enCalle && !Number.isNaN(mov) && mov < CUT14 };
  };
  // Seguimiento de Urbano (mismo patrón que /dia): cli_codigo = tracking (id Shopify).
  const urbanoTrack = (tk: string) =>
    `https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=${Number(process.env.URBANO_SHIPPER) || 4362}&cli_codigo=${tk}`;

  // Órdenes COD del día (no cuotas, no ML). Canceladas / sin-producto = contexto (no cuentan en generadas).
  type Venta = { estado: EstadoKey; producto: string; courier: string; orden: string; cliente: string | null; province: string | null; monto: number; tracking: string | null; trabado: boolean };
  const ventas: Venta[] = [];
  let canceladas = 0, sinProducto = 0, cancMonto = 0;
  for (const o of orders) {
    if ((o.tags ?? "").toLowerCase().includes("cuotas_3")) continue;   // correo → aparte
    if (o.cancelled_at) { canceladas++; cancMonto += Number(o.cod_amount); continue; }
    const prod = primaryProduct(o.order_items ?? []);
    if (prod.id == null) { sinProducto++; continue; }
    const courier = o.courier ?? o.shipments.find((s) => s.dispatched_at)?.courier ?? "sin ruta";
    if ((courierParam === "urbano" || courierParam === "fixy") && courier !== courierParam) continue;
    const { estado, tracking, trabado } = estadoDe(o);
    ventas.push({
      estado, producto: prod.name, courier, tracking, trabado,
      orden: o.order_number, cliente: o.customer_name, province: o.province, monto: Number(o.cod_amount),
    });
  }
  const codGen = ventas.length;
  const trabados = ventas.filter((v) => v.trabado).length;
  const desglose = ESTADOS.map((e) => {
    const rows = ventas.filter((v) => v.estado === e.key);
    return { ...e, n: rows.length, monto: rows.reduce((s, v) => s + v.monto, 0) };
  }).filter((e) => e.n > 0);
  const porProducto = [...ventas.reduce((m, v) => {
    const g = m.get(v.producto) ?? { producto: v.producto, rows: [] as Venta[] };
    g.rows.push(v); return m.set(v.producto, g);
  }, new Map<string, { producto: string; rows: Venta[] }>()).values()].sort((a, b) => b.rows.length - a.rows.length);

  // #orden como link al seguimiento de Urbano si la guía tiene tracking; si no, texto plano. Los trabados
  // (en la calle sin movimiento hace +14d) llevan un ! naranja para reclamarlos a la logística.
  const ordenCell = (v: Venta) => (
    <span className="flex w-20 shrink-0 items-center gap-1">
      {v.tracking ? (
        <a href={urbanoTrack(v.tracking)} target="_blank" rel="noopener noreferrer" title="Ver seguimiento en Urbano"
           className="truncate text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
          #{v.orden}<span aria-hidden className="ml-0.5 no-underline">↗</span>
        </a>
      ) : <span className="truncate">#{v.orden}</span>}
      {v.trabado && (
        <Tip label="Pedido trabado" tip="Sigue en la calle y hace más de 2 semanas que no registra ningún movimiento de estado. Reclamalo a la logística.">
          <span className="cursor-help font-bold text-orange-500" aria-label="trabado">!</span>
        </Tip>
      )}
    </span>
  );

  const correo = wantCorreo ? orders.filter((o) => (o.tags ?? "").toLowerCase().includes("cuotas_3") && !o.cancelled_at) : [];
  const correoPagadas = correo.filter((o) => o.financial_status === "paid").length;
  const mlUnidades = ml.reduce((s, r) => s + r.units, 0);
  const mlRevenue = ml.reduce((s, r) => s + Number(r.total_amount), 0);

  const generadas = panel?.generadas ?? 0;
  const despachadas = panel?.despachadas ?? 0;
  const pctDesp = generadas ? despachadas / generadas : 0;
  const profitEst = Number(panel?.profit_estimado ?? 0) - Number(panel?.ads_sin_cohorte ?? 0);
  const profitConf = Number(panel?.profit_confirmado ?? 0) - Number(panel?.ads_sin_cohorte ?? 0);
  // ¿Cuánto de las generadas del panel es COD vs otros canales? (para explicar el % de despacho mezclado)
  const otros = Math.max(generadas - codGen, 0);

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href={backHref} className="text-sm text-muted-foreground hover:text-foreground">← Volver</Link>
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            Ventas del {fmtDate(fecha)}
            {courierParam && (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-2 py-0.5 text-sm text-background">
                {COURIER[courierParam]}
                <Link href={`/ventas/${fecha}`} title="Ver todos los canales" className="text-background/60 hover:text-background">×</Link>
              </span>
            )}
          </h1>
        </div>
        <span className="text-sm text-muted-foreground">
          <b className="text-foreground tabular-nums">{generadas}</b> generadas · <b className="text-foreground tabular-nums">{fmtPct(pctDesp)}</b> despachadas
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Generadas", value: String(generadas), color: "text-foreground", tip: "Ventas generadas ese día en el canal filtrado (idéntico al panel). En Correo/ML son las ventas del día." },
          { label: "Despachadas", value: `${despachadas} · ${fmtPct(pctDesp)}`, color: "text-foreground", tip: "Cuántas de esas ventas ya salieron a la calle. En Correo es la confirmación; en ML, entregadas por ML." },
          { label: "Profit estimado", value: fmtMoney(profitEst), color: pnlColor(profitEst), tip: "Confirmado más la proyección de lo que sigue en camino, menos Ads." },
          { label: "Cerrado", value: fmtMoney(profitConf), color: profitConf < 0 ? "text-destructive/80" : "text-foreground", tip: "Profit ya cobrado de las ventas de ese día, neto de Ads." },
        ].map((k) => (
          <Card key={k.label}>
            <CardContent className="pt-5">
              <div className="flex items-center gap-1 text-[0.7rem] uppercase tracking-wide text-muted-foreground">{k.label}<Tip tip={k.tip} /></div>
              <div className={cn("text-2xl font-bold tabular-nums tracking-tight", k.color)}>{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {codGen > 0 ? (
        <section className="space-y-2">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span>
              Estado de despacho · {codGen} ventas COD
              {otros > 0 && <span className="font-normal text-muted-foreground"> (de {generadas}; las otras {otros} son ML/Correo, que entregan al 100% y suben el % de arriba)</span>}
            </span>
            {trabados > 0 && (
              <Tip label="Pedidos trabados" tip="Siguen en la calle y hace más de 2 semanas que no registran movimiento de estado. No deberían existir: reclamalos a la logística — hasta que se resuelvan, este día no cierra.">
                <span className="cursor-help rounded bg-orange-500/15 px-1.5 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-500">
                  ! {trabados} trabado{trabados === 1 ? "" : "s"}
                </span>
              </Tip>
            )}
          </h2>
          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
            {desglose.map((e) => (
              <div key={e.key} className={cn("h-full", e.cls)} style={{ width: `${(e.n / codGen) * 100}%` }} title={`${ESTADO_TXT[e.key]}: ${e.n}`} />
            ))}
          </div>
          <div className="divide-y overflow-hidden rounded-lg border text-sm">
            {desglose.map((e) => {
              const rows = ventas.filter((v) => v.estado === e.key);
              return (
                <details key={e.key} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    <span className={cn("size-2.5 shrink-0 rounded-sm", e.cls)} />
                    <span className="flex-1">{ESTADO_TXT[e.key]}</span>
                    <span className="w-16 text-right tabular-nums text-muted-foreground">{fmtPct(e.n / codGen)}</span>
                    <span className="w-12 text-right font-medium tabular-nums">{e.n}</span>
                    <span className="w-28 text-right tabular-nums text-muted-foreground">{fmtMoney(e.monto)}</span>
                  </summary>
                  <div className="bg-muted/20 text-xs">
                    {rows.map((v) => (
                      <div key={`${v.courier}-${v.orden}`} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-9 pr-3">
                        <span className="w-14 shrink-0 text-muted-foreground">{COURIER[v.courier] ?? v.courier}</span>
                        {ordenCell(v)}
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{v.cliente ?? "—"}</span>
                        <span className="hidden w-24 truncate text-muted-foreground sm:inline">{v.producto}</span>
                        <span className="hidden w-24 truncate text-right text-muted-foreground md:inline">{v.province ?? "—"}</span>
                        <span className="w-24 text-right tabular-nums">{v.monto ? fmtMoney(v.monto) : "—"}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
          {(canceladas > 0 || sinProducto > 0) && (
            <p className="text-xs text-muted-foreground">
              Contexto (fuera de generadas): {canceladas > 0 && <><b className="text-foreground">{canceladas}</b> canceladas ({fmtMoney(cancMonto)})</>}
              {canceladas > 0 && sinProducto > 0 && " · "}
              {sinProducto > 0 && <><b className="text-foreground">{sinProducto}</b> sin producto reconocido</>}.
            </p>
          )}
        </section>
      ) : (
        !wantMl && !wantCorreo && <p className="text-sm text-muted-foreground">Sin ventas COD generadas ese día.</p>
      )}

      {codGen > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Órdenes por producto</h2>
          <div className="divide-y overflow-hidden rounded-lg border text-sm">
            {porProducto.map((g) => {
              const desp = g.rows.filter((v) => !["pendiente", "no_despachado", "sin_guia_vencida"].includes(v.estado)).length;
              return (
                <details key={g.producto} className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2 hover:bg-accent/40 [&::-webkit-details-marker]:hidden">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" aria-hidden><path d="m9 18 6-6-6-6" /></svg>
                    <span className="min-w-0 flex-1 truncate font-medium">{g.producto} <span className="font-normal text-muted-foreground">· {g.rows.length}</span></span>
                    <span className="w-28 text-right tabular-nums text-muted-foreground">{desp}/{g.rows.length} desp.</span>
                  </summary>
                  <div className="bg-muted/20">
                    {g.rows.map((v) => (
                      <div key={`${v.courier}-${v.orden}`} className="flex items-center gap-3 border-t border-border/40 py-1.5 pl-9 pr-3">
                        <span className="inline-flex w-32 shrink-0 items-center gap-1.5 text-xs">
                          <span className={cn("size-2 shrink-0 rounded-sm", ESTADO_CLS[v.estado])} />
                          <span className="truncate text-muted-foreground">{ESTADO_TXT[v.estado]}</span>
                        </span>
                        <span className="w-16 shrink-0 text-muted-foreground">{COURIER[v.courier] ?? v.courier}</span>
                        {ordenCell(v)}
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{v.cliente ?? "—"}</span>
                        <span className="hidden w-24 truncate text-right text-muted-foreground sm:inline">{v.province ?? "—"}</span>
                        <span className="w-24 text-right tabular-nums">{v.monto ? fmtMoney(v.monto) : "—"}</span>
                      </div>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>
        </section>
      )}

      {wantCorreo && correo.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Correo (cuotas 3) · {correo.length} órdenes</h2>
          <p className="text-sm text-muted-foreground">
            Prepago, sin guía: <b className="text-foreground tabular-nums">{correoPagadas}</b> pagadas de {correo.length} generadas ({fmtPct(correo.length ? correoPagadas / correo.length : 0)} de confirmación).
          </p>
        </section>
      )}

      {wantMl && ml.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">MercadoLibre · {ml.length} ventas</h2>
          <p className="text-sm text-muted-foreground">
            <b className="text-foreground tabular-nums">{mlUnidades}</b> unidades · revenue <b className="text-foreground tabular-nums">{fmtMoney(mlRevenue)}</b>. Entrega y despacho los maneja ML.
          </p>
        </section>
      )}
    </main>
  );
}
