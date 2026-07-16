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
  province: string | null; orders: { order_number: string; cod_amount: number; customer_name: string | null } | null;
};

export default async function Dia({ params }: { params: Promise<{ fecha: string }> }) {
  const { fecha } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) notFound();
  const db = supabaseAdmin();

  const [prodsRes, pnlRes, guiasRes, adsRes] = await Promise.all([
    db.from("products").select("id, name"),
    db.from("daily_pnl").select("courier, product_id, despachadas, entregadas, en_transito, revenue_estimado, profit_estimado, profit_confirmado, ads, flete, tasa_proyectada").eq("dispatch_date", fecha),
    db.from("shipments").select("tracking, courier, status_canonical, freight_cost, province, orders(order_number, cod_amount, customer_name)").eq("dispatched_at", fecha).order("courier"),
    db.from("ad_spend").select("ad_name, campaign_name, spend, product_id").eq("date", fecha).order("spend", { ascending: false }),
  ]);
  const pname = new Map((prodsRes.data ?? []).map((p) => [p.id, p.name as string]));
  const pnl = (pnlRes.data ?? []) as Pnl[];
  const guias = (guiasRes.data ?? []) as unknown as Guia[];
  const ads = (adsRes.data ?? []) as { ad_name: string | null; campaign_name: string | null; spend: number; product_id: number | null }[];

  const tot = pnl.reduce((a, r) => ({
    despachadas: a.despachadas + r.despachadas, entregadas: a.entregadas + r.entregadas,
    enTransito: a.enTransito + r.en_transito, revenueEst: a.revenueEst + Number(r.revenue_estimado),
    profitEst: a.profitEst + Number(r.profit_estimado), profitConf: a.profitConf + Number(r.profit_confirmado),
    ads: a.ads + Number(r.ads), flete: a.flete + Number(r.flete),
  }), { despachadas: 0, entregadas: 0, enTransito: 0, revenueEst: 0, profitEst: 0, profitConf: 0, ads: 0, flete: 0 });
  const adsTotal = ads.reduce((s, a) => s + Number(a.spend), 0);

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

      {/* Gasto en Ads del día — claridad: en qué se gastó */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Gasto en Ads del día — {fmtMoney(adsTotal)}</h2>
        {ads.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Anuncio</TableHead>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Gasto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ads.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="max-w-[28ch] truncate">{a.ad_name || a.campaign_name || "—"}</TableCell>
                  <TableCell className={cn(!a.product_id && "text-amber-600 dark:text-amber-500")}>
                    {a.product_id ? pname.get(a.product_id) ?? `#${a.product_id}` : "sin producto"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(Number(a.spend))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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

      {/* Guías individuales — esclarecer caso por caso */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Guías del día ({guias.length})</h2>
        {guias.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Guía</TableHead>
                <TableHead>Pedido</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Provincia</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">COD</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {guias.map((g) => (
                <TableRow key={`${g.courier}-${g.tracking}`}>
                  <TableCell className="font-mono text-xs">{g.tracking}</TableCell>
                  <TableCell>{g.orders?.order_number ? `#${g.orders.order_number}` : "—"}</TableCell>
                  <TableCell className="max-w-[20ch] truncate text-muted-foreground">{g.orders?.customer_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{COURIER[g.courier] ?? g.courier}</TableCell>
                  <TableCell className="text-muted-foreground">{g.province ?? "—"}</TableCell>
                  <TableCell className={estadoColor(g.status_canonical)}>{g.status_canonical.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{g.freight_cost ? fmtMoney(Number(g.freight_cost)) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.orders?.cod_amount ? fmtMoney(Number(g.orders.cod_amount)) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-sm text-muted-foreground">Sin guías COD ese día (las cuotas/Correo no tienen guía; se cuentan por pago).</p>
        )}
      </section>
    </main>
  );
}
