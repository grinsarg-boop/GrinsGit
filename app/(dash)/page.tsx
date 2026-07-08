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
  date: string; despachadas: number; resueltas: number; entregadas: number;
  revenue: number; profit: number; ads: number;
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

  // Agregación server-side (007): la RPC devuelve el resumen por día ya sumado (across producto, y
  // across courier si es null). El P&L por producto llega con /dia/[fecha] en Fase 2.
  const { data: rows } = await db.rpc("dashboard_days", { p_from: from, p_courier: courierParam });
  const list: Day[] = (rows ?? []).map((r: {
    dispatch_date: string; despachadas: number; entregadas: number; resueltas: number;
    revenue_confirmado: number; profit_confirmado: number; ads: number;
  }) => ({
    date: r.dispatch_date, despachadas: r.despachadas, resueltas: r.resueltas, entregadas: r.entregadas,
    revenue: Number(r.revenue_confirmado), profit: Number(r.profit_confirmado), ads: Number(r.ads),
  }));

  const { data: adsSinCohorte } = await db
    .from("v_ads_sin_cohorte").select("*").eq("date", today);

  const period = (daysBack: number) => {
    const cut = daysAgoIso(daysBack);
    const acc = { despachadas: 0, entregadas: 0, resueltas: 0, revenue: 0, profit: 0, ads: 0 };
    for (const d of list) {
      if (d.date >= cut) {
        acc.despachadas += d.despachadas; acc.entregadas += d.entregadas;
        acc.resueltas += d.resueltas; acc.revenue += d.revenue;
        acc.profit += d.profit; acc.ads += d.ads;
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
        {cards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="text-2xl font-semibold">{c.despachadas} <span className="text-sm font-normal text-muted-foreground">despachos</span></div>
              <div>Tasa: <b>{c.despachadas ? fmtPct(c.entregadas / c.despachadas) : "—"}</b></div>
              <div>Profit confirmado: <b>{fmtMoney(c.profit)}</b></div>
              <div>ROAS: <b>{c.ads > 0 ? fmtRatio(c.revenue / c.ads) : "—"}</b></div>
            </CardContent>
          </Card>
        ))}
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
            <TableHead className="text-right">Tasa</TableHead>
            <TableHead className="text-right">Cobrado</TableHead>
            <TableHead className="text-right">Profit conf.</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">ROAS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            const pct = d.despachadas ? d.resueltas / d.despachadas : 0;
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
                  {d.despachadas ? fmtPct(d.entregadas / d.despachadas) : "—"}
                </TableCell>
                <TableCell className="text-right">{fmtMoney(d.revenue)}</TableCell>
                <TableCell className={cn("text-right font-medium", d.profit < 0 && "text-destructive")}>
                  {fmtMoney(d.profit)}
                </TableCell>
                <TableCell className="text-right">{fmtMoney(d.ads)}</TableCell>
                <TableCell className="text-right">{d.ads > 0 ? fmtRatio(d.revenue / d.ads) : "—"}</TableCell>
              </TableRow>
            );
          })}
          {!list.length && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground">
                Sin despachos en los últimos 30 días
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </main>
  );
}
