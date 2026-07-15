import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct, fmtRatio } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60; // R12

type Day = {
  date: string; despachadas: number; entregadas: number; resueltas: number; proyectadas: number;
  revenueConf: number; revenueEst: number; profitConf: number; profitEst: number;
  ads: number; adsSinCohorte: number;
};

// Verde ganás / rojo perdés — el color hace el trabajo antes de leer el número.
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

export default async function Resumen({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string }>;
}) {
  const { courier } = await searchParams;
  const db = supabaseAdmin();
  const from = daysAgoIso(30);
  const today = daysAgoIso(0);
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" ? courier : null;

  // Agregación server-side (dashboard_days, 009): resumen por día ya sumado, con columnas CONFIRMADO
  // y ESTIMADO (§4.7). El P&L por producto → /dia/[fecha].
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

  // Gastos en Ads (30 días): atribuido a cohortes vs sin cohorte (plata que se resta del profit).
  const adsAtrib = list.reduce((s, d) => s + d.ads, 0);
  const adsSin = list.reduce((s, d) => s + d.adsSinCohorte, 0);
  const adsTot = adsAtrib + adsSin;

  return (
    <main className="space-y-6">
      <p className="max-w-[70ch] text-sm text-muted-foreground">
        Un solo número manda: <b className="text-foreground">Profit estimado</b> — lo que vas a ganar con
        lo ya despachado, incluyendo lo que sigue en la calle. Es el{" "}
        <span className="rounded bg-muted px-1.5 font-medium text-foreground">confirmado</span> (plata que
        YA cobraste) más una proyección de las guías{" "}
        <span className="rounded bg-amber-100 px-1.5 font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-500">en camino</span>,
        usando tu tasa de entrega histórica por zona y producto.
      </p>

      <div className="flex gap-2 text-sm">
        {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"]].map(([v, label]) => (
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {cards.map((c) => {
          // La pauta sin cohorte (product_id NULL o día sin despacho) es costo real no atribuido a
          // ninguna fila → restarlo del profit y sumarlo al denominador del ROAS (§4.6, #11).
          const adsTotal = c.ads + c.adsSinCohorte;
          const profitEst = c.profitEst - c.adsSinCohorte;
          const profitConf = c.profitConf - c.adsSinCohorte;
          const enCamino = profitEst - profitConf;
          return (
            <Card key={c.label}>
              <CardContent className="space-y-1 pt-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                  <span className="text-sm text-muted-foreground"><b className="font-semibold text-foreground">{c.despachadas}</b> despachos</span>
                </div>
                <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Profit estimado</div>
                <div className={cn("text-3xl font-bold tabular-nums tracking-tight", c.despachadas ? pnlColor(profitEst) : "text-muted-foreground")}>
                  {c.despachadas ? fmtMoney(profitEst) : "—"}
                </div>
                {c.despachadas ? (
                  <div className="pt-1 text-sm text-muted-foreground">
                    <div>confirmado <span className="tabular-nums">{fmtMoney(profitConf)}</span></div>
                    <div className="font-medium tabular-nums text-amber-600 dark:text-amber-500">{fmtMoney(enCamino)} en camino</div>
                  </div>
                ) : (
                  <div className="pt-1 text-sm text-muted-foreground">Sin despachos todavía</div>
                )}
                <div className="mt-3 flex gap-6 border-t pt-3">
                  <div>
                    <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Tasa proy.</div>
                    <div className="text-base font-semibold tabular-nums">{c.despachadas ? fmtPct(c.proyectadas / c.despachadas) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS est.</div>
                    <div className="text-base font-semibold tabular-nums">{adsTotal > 0 ? fmtRatio(c.revenueEst / adsTotal) : "—"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gastos en Ads · 30 días</span>
            <span className="text-sm text-muted-foreground">total <b className="tabular-nums text-foreground">{fmtMoney(adsTot)}</b></span>
          </div>
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Atribuido a cohortes</div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(adsAtrib)}</div>
              <div className="text-xs text-muted-foreground">repartido por producto y canal</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">Sin cohorte</div>
              <div className="text-lg font-semibold tabular-nums text-amber-600 dark:text-amber-500">{fmtMoney(adsSin)}</div>
              <div className="text-xs text-muted-foreground">{adsTot ? fmtPct(adsSin / adsTot) : "—"} del total · se resta del profit</div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">ROAS estimado</div>
              <div className="text-lg font-semibold tabular-nums">{adsTot > 0 ? fmtRatio(list.reduce((s, d) => s + d.revenueEst, 0) / adsTot) : "—"}</div>
              <div className="text-xs text-muted-foreground">revenue est. / gasto total</div>
            </div>
          </div>

          {!!adsSinCohorte?.length && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Sin cohorte hoy:</span>{" "}
              {adsSinCohorte.map((a) => `${a.product ?? "sin producto"} ${fmtMoney(Number(a.spend))}`).join(" · ")}
            </p>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
              <span className="underline-offset-4 hover:underline">Cómo se imputan los Ads</span> <span className="text-xs">▾</span>
            </summary>
            <div className="mt-2 space-y-1.5 border-l-2 pl-3 text-muted-foreground">
              <p>Cada gasto de Meta se asigna a un <b className="text-foreground">producto</b> por keyword del nombre del anuncio/campaña.</p>
              <p>El gasto del día por producto se <b className="text-foreground">reparte entre los canales</b> según los despachos de cada uno — Fixy pondera <b className="text-foreground">×1,4</b> (CPA más alto); Correo pondera por pedidos generados.</p>
              <p>Gasto sin producto (keyword no matcheó) o de un producto <b className="text-foreground">sin despachos ese día</b> → <span className="text-amber-600 dark:text-amber-500">sin cohorte</span>: plata real no atribuible a ninguna fila, se <b className="text-foreground">resta directo del profit</b> y suma al denominador del ROAS.</p>
            </div>
          </details>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Despachos</TableHead>
            <TableHead className="w-36">Madurez</TableHead>
            <TableHead className="text-right">Tasa hoy → final</TableHead>
            <TableHead className="text-right text-amber-600 dark:text-amber-500">Profit estimado</TableHead>
            <TableHead className="text-right">confirmado</TableHead>
            <TableHead className="text-right">Ads</TableHead>
            <TableHead className="text-right">ROAS est.</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.map((d) => {
            const pct = d.despachadas ? d.resueltas / d.despachadas : 0;
            const tasaAct = d.despachadas ? d.entregadas / d.despachadas : 0;
            const tasaProy = d.despachadas ? d.proyectadas / d.despachadas : 0;
            const inmaduro = pct < 0.8; // §6.1: el estimado todavía es proyección mientras <80% resuelto
            return (
              <TableRow key={d.date} className="group hover:bg-accent/40">
                <TableCell>
                  <Link href={`/dia/${d.date}`} className="font-medium underline-offset-4 group-hover:underline">
                    {fmtDate(d.date)}
                    <span className="ml-1 text-muted-foreground opacity-0 transition group-hover:opacity-100">→</span>
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">{d.despachadas}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-[74px] flex-none rounded bg-muted">
                      <div className="h-1.5 rounded bg-foreground" style={{ width: `${pct * 100}%` }} />
                    </div>
                    <span className="w-8 text-xs tabular-nums text-muted-foreground">{fmtPct(pct)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.despachadas
                    ? <>{fmtPct(tasaAct)} <span className="text-muted-foreground/60">→</span> <b className="text-foreground">{fmtPct(tasaProy)}</b></>
                    : "—"}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-bold tabular-nums",
                  inmaduro ? "text-muted-foreground" : pnlColor(d.profitEst),
                )}>
                  {fmtMoney(d.profitEst)}
                  {inmaduro && (
                    <span className="ml-1.5 rounded bg-amber-100 px-1 py-px align-middle text-[0.6rem] uppercase tracking-wide text-amber-700 dark:bg-amber-950/50 dark:text-amber-500">
                      inmaduro
                    </span>
                  )}
                </TableCell>
                <TableCell className={cn("text-right tabular-nums", d.profitConf < 0 ? "text-destructive/75" : "text-muted-foreground")}>
                  {fmtMoney(d.profitConf)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{d.ads ? fmtMoney(d.ads) : "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{d.ads > 0 ? fmtRatio(d.revenueEst / d.ads) : "—"}</TableCell>
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
