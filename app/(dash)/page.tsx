import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60; // R12

type Day = {
  date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number;
  ads: number; adsSinCohorte: number;
};

export default async function Resumen({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string }>;
}) {
  const { courier } = await searchParams;
  const db = supabaseAdmin();
  const from = daysAgoIso(30);
  const today = daysAgoIso(0);
  const courierParam = courier === "urbano" || courier === "fixy" ? courier : null;

  // Agregación server-side (dashboard_days, 009): resumen por día ya sumado (across producto, y across
  // courier si es null), con columnas CONFIRMADO y ESTIMADO (§4.7). El P&L por producto → /dia/[fecha].
  const { data: rows } = await db.rpc("dashboard_days", { p_from: from, p_courier: courierParam });
  const list: Day[] = (rows ?? []).map((r: {
    dispatch_date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
    revenue_confirmado: number; revenue_estimado: number; profit_confirmado: number; profit_estimado: number;
    ads: number; ads_sin_cohorte: number;
  }) => ({
    date: r.dispatch_date, despachadas: r.despachadas, entregadas: r.entregadas, resueltas: r.resueltas,
    proyectadas: Number(r.proyectadas),
    revenueConf: Number(r.revenue_confirmado), revenueEst: Number(r.revenue_estimado),
    profitConf: Number(r.profit_confirmado), profitEst: Number(r.profit_estimado),
    ads: Number(r.ads), adsSinCohorte: Number(r.ads_sin_cohorte),
  }));

  const { data: adsSinCohorte } = await db
    .from("v_ads_sin_cohorte").select("*").eq("date", today);

  const period = (daysBack: number) => {
    const cut = daysAgoIso(daysBack);
    const acc = { despachadas: 0, entregadas: 0, proyectadas: 0,
      revenueEst: 0, profitConf: 0, profitEst: 0, ads: 0, adsSinCohorte: 0 };
    for (const d of list) {
      if (d.date >= cut) {
        acc.despachadas += d.despachadas; acc.entregadas += d.entregadas; acc.proyectadas += d.proyectadas;
        acc.revenueEst += d.revenueEst; acc.profitConf += d.profitConf; acc.profitEst += d.profitEst;
        acc.ads += d.ads; acc.adsSinCohorte += d.adsSinCohorte;
      }
    }
    return acc;
  };
  const cards = [
    { label: "Hoy", ...period(0) },
    { label: "7 días", ...period(7) },
    { label: "30 días", ...period(30) },
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 text-sm">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"]].map(([v, label]) => (
            <Link
              key={v}
              href={v ? `/?courier=${v}` : "/"}
              className={cn(
                "rounded-md border px-3 py-1",
                (courier ?? "") === v ? "bg-primary text-primary-foreground" : "hover:bg-accent",
              )}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          // La pauta sin cohorte (product_id NULL o día sin despacho) es costo real no atribuido a
          // ninguna fila → restarlo del profit y sumarlo al denominador del ROAS (§4.6, #11).
          const adsTotal = c.ads + c.adsSinCohorte;
          const profitEst = c.profitEst - c.adsSinCohorte;
          const profitConf = c.profitConf - c.adsSinCohorte;
          return (
            <Card key={c.label}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="text-2xl font-semibold">{c.despachadas} <span className="text-sm font-normal text-muted-foreground">despachos</span></div>
                <div>Tasa proyectada: <b>{c.despachadas ? fmtPct(c.proyectadas / c.despachadas) : "—"}</b></div>
                <div>Profit estimado: <b className={cn(profitEst < 0 && "text-destructive")}>{fmtMoney(profitEst)}</b></div>
                <div className="text-xs text-muted-foreground">confirmado {fmtMoney(profitConf)}</div>
                <div>ROAS estimado: <b>{adsTotal > 0 ? fmtRatio(c.revenueEst / adsTotal) : "—"}</b></div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!!adsSinCohorte?.length && (
        <p className="text-sm text-muted-foreground">
          Ads sin cohorte hoy:{" "}
          {adsSinCohorte.map((a) => `${a.product ?? "sin producto"} ${fmtMoney(Number(a.spend))}`).join(" · ")}
        </p>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Despachos</TableHead>
            <TableHead className="w-32">Resuelto</TableHead>
            <TableHead className="text-right">Tasa → proy.</TableHead>
            <TableHead className="text-right">Cobrado</TableHead>
            <TableHead className="text-right">Profit conf.</TableHead>
            <TableHead className="text-right">Profit est.</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">ROAS est.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            const pct = d.despachadas ? d.resueltas / d.despachadas : 0;
            const tasaAct = d.despachadas ? d.entregadas / d.despachadas : 0;
            const tasaProy = d.despachadas ? d.proyectadas / d.despachadas : 0;
            const inmaduro = pct < 0.8; // §6.1: atenuar el estimado si la cohorte está poco resuelta
            return (
              <TableRow key={d.date}>
                <TableCell>{fmtDate(d.date)}</TableCell>
                <TableCell className="text-right">{d.despachadas}</TableCell>
                <TableCell>
                  <div className="h-2 w-full rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${pct * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{fmtPct(pct)}</span>
                </TableCell>
                <TableCell className="text-right">
                  {d.despachadas ? `${fmtPct(tasaAct)} → ${fmtPct(tasaProy)}` : "—"}
                </TableCell>
                <TableCell className="text-right">{fmtMoney(d.revenueConf)}</TableCell>
                <TableCell className={cn("text-right", d.profitConf < 0 && "text-destructive")}>
                  {fmtMoney(d.profitConf)}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-medium",
                  inmaduro && "text-muted-foreground",
                  !inmaduro && d.profitEst < 0 && "text-destructive",
                )}>
                  {fmtMoney(d.profitEst)}
                </TableCell>
                <TableCell className="text-right">{fmtMoney(d.ads)}</TableCell>
                <TableCell className="text-right">{d.ads > 0 ? fmtRatio(d.revenueEst / d.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                Sin despachos en los últimos 30 días
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
