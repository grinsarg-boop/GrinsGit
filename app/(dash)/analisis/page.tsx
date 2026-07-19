import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { Donut, PALETA, type Slice } from "@/components/donut";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export const revalidate = 60;

// Página de cortes transversales. No calcula plata nueva: reagrupa lo que ya cierra en / y /ventas por
// ejes que esos paneles no tienen (zona, desenlace, producto × courier). Las RPCs son de la 034.
type PnlRow = {
  courier: string; product_id: number | null; product: string;
  despachadas: number; entregadas: number;
  revenue: number; flete: number; comisiones: number; costo_producto: number; ads: number; profit: number;
};
type ZonaRow = {
  province: string; guias: number; entregadas: number; devueltas: number;
  cod_cobrado: number; flete: number; margen_bruto: number;
};
type DesenlaceRow = { estado: string; guias: number; cod: number };

const COURIER: Record<string, string> = { urbano: "Urbano", fixy: "Fixy", correo: "Correo", ml: "ML" };
const ESTADO: Record<string, string> = {
  entregado: "Entregado", en_la_calle: "En la calle", devuelto: "Devuelto", rehusado: "Rehusado",
  en_devolucion: "En devolución", no_despachado: "No despachado", siniestro: "Siniestro",
};
// El orden fija el color: verde lo bueno, gris lo que sigue abierto, rojos las pérdidas.
const ESTADO_COLOR: Record<string, string> = {
  entregado: "stroke-emerald-500", en_la_calle: "stroke-sky-500", devuelto: "stroke-rose-500",
  rehusado: "stroke-rose-400", en_devolucion: "stroke-amber-500", no_despachado: "stroke-slate-400",
  siniestro: "stroke-violet-500",
};

const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

export default async function Analisis({
  searchParams,
}: {
  searchParams: Promise<{ courier?: string; desde?: string; hasta?: string }>;
}) {
  const { courier, desde, hasta } = await searchParams;
  const db = supabaseAdmin();
  const today = daysAgoIso(0);
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const to = hasta && ISO.test(hasta) ? hasta : today;
  let from = desde && ISO.test(desde) ? desde : daysAgoIso(30);
  if (from > to) from = to;
  const rangeLabel = `${fmtDate(from)} → ${fmtDate(to)}`;
  const courierParam = courier === "urbano" || courier === "fixy" || courier === "correo" || courier === "ml" ? courier : null;

  const [{ data: pnlRaw }, { data: zonasRaw }, { data: desRaw }] = await Promise.all([
    db.rpc("analisis_pnl", { p_from: from, p_to: to, p_courier: courierParam }),
    db.rpc("analisis_zonas", { p_from: from, p_to: to, p_courier: courierParam }),
    db.rpc("analisis_desenlaces", { p_from: from, p_to: to, p_courier: courierParam }),
  ]);
  const pnl = (pnlRaw ?? []) as PnlRow[];
  const zonas = (zonasRaw ?? []) as ZonaRow[];
  const desenlaces = (desRaw ?? []) as DesenlaceRow[];

  const N = (v: number | null | undefined) => Number(v ?? 0);
  const sum = (k: keyof PnlRow) => pnl.reduce((s, r) => s + N(r[k] as number), 0);
  const revenue = sum("revenue"), flete = sum("flete"), comis = sum("comisiones");
  const costo = sum("costo_producto"), ads = sum("ads"), profit = sum("profit");

  // 1 · composición del peso cobrado
  const composicion: Slice[] = [
    { label: "Flete", value: flete, className: "stroke-rose-500" },
    { label: "Ads", value: ads, className: "stroke-amber-500" },
    { label: "Comisiones", value: comis, className: "stroke-slate-400" },
    { label: "Costo de producto", value: costo, className: "stroke-violet-400" },
    { label: "Profit", value: Math.max(profit, 0), className: "stroke-emerald-500" },
  ].filter((s) => s.value > 0);

  // 2 · por canal
  const porCanal = [...pnl.reduce((m, r) => {
    const g = m.get(r.courier) ?? { courier: r.courier, despachadas: 0, entregadas: 0, profit: 0 };
    g.despachadas += r.despachadas; g.entregadas += r.entregadas; g.profit += N(r.profit);
    return m.set(r.courier, g);
  }, new Map<string, { courier: string; despachadas: number; entregadas: number; profit: number }>()).values()]
    .sort((a, b) => b.profit - a.profit);

  // 3 · por producto
  const porProducto = [...pnl.reduce((m, r) => {
    const g = m.get(r.product) ?? { product: r.product, despachadas: 0, entregadas: 0, profit: 0 };
    g.despachadas += r.despachadas; g.entregadas += r.entregadas; g.profit += N(r.profit);
    return m.set(r.product, g);
  }, new Map<string, { product: string; despachadas: number; entregadas: number; profit: number }>()).values()]
    .sort((a, b) => b.profit - a.profit);

  // 5 · concentración de volumen: top 6 provincias + el resto agrupado
  const porVolumen = [...zonas].sort((a, b) => b.guias - a.guias);
  const top6 = porVolumen.slice(0, 6);
  const resto = porVolumen.slice(6).reduce((s, z) => s + z.guias, 0);
  const concentracion: Slice[] = [
    ...top6.map((z, i) => ({ label: z.province, value: z.guias, className: PALETA[i] })),
    ...(resto > 0 ? [{ label: `Otras ${porVolumen.length - 6}`, value: resto, className: "stroke-slate-300" }] : []),
  ];
  const totalGuias = porVolumen.reduce((s, z) => s + z.guias, 0);

  // 7 · matriz entrega producto × courier (solo celdas con volumen suficiente para no leer ruido)
  const canales = [...new Set(pnl.map((r) => r.courier))].sort();
  const productos = [...new Set(pnl.map((r) => r.product))].sort();
  const celda = (p: string, c: string) => {
    const r = pnl.find((x) => x.product === p && x.courier === c);
    if (!r || r.despachadas < 15) return null;
    return { tasa: r.entregadas / r.despachadas, n: r.despachadas };
  };

  const hrefWith = (o: { courier?: string; desde?: string; hasta?: string }) => {
    const c = o.courier !== undefined ? o.courier : (courier ?? "");
    const dd = o.desde !== undefined ? o.desde : (desde ?? "");
    const hh = o.hasta !== undefined ? o.hasta : (hasta ?? "");
    const q = new URLSearchParams();
    if (c) q.set("courier", c);
    if (dd) q.set("desde", dd);
    if (hh) q.set("hasta", hh);
    const s = q.toString();
    return s ? `/analisis?${s}` : "/analisis";
  };

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

  const maxMargen = Math.max(...zonas.map((z) => Math.abs(N(z.margen_bruto))), 1);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Análisis</h1>
        <span className="text-sm tabular-nums text-muted-foreground">{rangeLabel}</span>
      </div>

      {/* mismos controles que el resto del panel: todo el estado va en la URL */}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <div className="flex flex-wrap items-center gap-1">
          {presets.map(([label, d, h]) => {
            const active = from === d && to === h;
            return (
              <Link key={label} href={hrefWith({ desde: d, hasta: h })}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                      active ? "bg-foreground text-background shadow-sm hover:shadow"
                             : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}>{label}</Link>
            );
          })}
        </div>
        <div className="inline-flex gap-0.5 rounded-lg bg-muted p-0.5">
          {[["", "Todos"], ["urbano", "Urbano"], ["fixy", "Fixy"], ["correo", "Correo"], ["ml", "ML"]].map(([val, label]) => (
            <Link key={val} href={hrefWith({ courier: val })}
                  aria-current={(courier ?? "") === val ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95",
                    (courier ?? "") === val ? "bg-foreground text-background shadow-sm hover:shadow"
                                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  )}>{label}</Link>
          ))}
        </div>
      </div>

      {!pnl.length ? (
        <Card><CardContent className="pt-5 text-sm text-muted-foreground">Sin datos en el rango elegido.</CardContent></Card>
      ) : (
      <>
      {/* 1 · a dónde va cada peso */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              A dónde va cada peso que cobrás
              <Tip tip="Sobre el COD efectivamente cobrado del período. El flete es hundido: se paga por toda guía despachada, entregue o no, y por eso pesa más de lo que uno espera." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">cobrado {fmtMoney(revenue)}</span>
          </div>
          <Donut slices={composicion} centro={fmtPct(profit / (revenue || 1))} subcentro="queda" />
          {profit < 0 && (
            <p className="text-xs text-destructive">
              El profit del período es negativo, así que la tajada verde no se dibuja: los costos se comieron todo lo cobrado.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 2 · canales */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Profit por canal
            <Tip tip="Ojo con leer el volumen como resultado: el canal que más despacha no es necesariamente el que más deja." />
          </span>
          <Donut
            slices={porCanal.filter((c) => c.profit > 0).map((c, i) => ({
              label: COURIER[c.courier] ?? c.courier, value: c.profit, className: PALETA[i],
            }))}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Canal</TableHead>
                <TableHead className="text-right">Despachos</TableHead>
                <TableHead className="text-right">Entrega</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Profit por despacho</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {porCanal.map((c) => (
                <TableRow key={c.courier}>
                  <TableCell className="font-medium">{COURIER[c.courier] ?? c.courier}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.despachadas.toLocaleString("es-AR")}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {c.despachadas ? fmtPct(c.entregadas / c.despachadas) : "—"}
                  </TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(c.profit))}>{fmtMoney(c.profit)}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", pnlColor(c.profit))}>
                    {c.despachadas ? fmtMoney(c.profit / c.despachadas) : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 3 · productos */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Profit por producto</span>
          <Donut
            slices={porProducto.filter((p) => p.profit > 0).map((p, i) => ({
              label: p.product, value: p.profit, className: PALETA[i % PALETA.length],
            }))}
          />
          {porProducto.some((p) => p.profit < 0) && (
            <p className="text-xs text-muted-foreground">
              A pérdida en el período:{" "}
              {porProducto.filter((p) => p.profit < 0).map((p) => `${p.product} (${fmtMoney(p.profit)})`).join(" · ")}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4 · zonas */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Zonas
              <Tip tip="Margen bruto = COD cobrado − flete de TODAS las guías de esa provincia. No baja a profit porque ni el costo de producto ni los Ads se pueden imputar por zona sin inventar un reparto. Ordenado de peor a mejor: lo de arriba es donde se está yendo la plata." />
            </span>
            <span className="text-xs text-muted-foreground">{zonas.length} provincias · de peor a mejor margen</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provincia</TableHead>
                <TableHead className="text-right">Guías</TableHead>
                <TableHead className="text-right">Entrega</TableHead>
                <TableHead className="text-right">COD cobrado</TableHead>
                <TableHead className="text-right">Flete</TableHead>
                <TableHead className="text-right">Margen bruto</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {zonas.map((z) => {
                const tasa = z.guias ? z.entregadas / z.guias : 0;
                const m = N(z.margen_bruto);
                return (
                  <TableRow key={z.province}>
                    <TableCell className="font-medium">{z.province}</TableCell>
                    <TableCell className="text-right tabular-nums">{z.guias.toLocaleString("es-AR")}</TableCell>
                    <TableCell className={cn("text-right tabular-nums",
                      tasa < 0.35 ? "text-destructive" : tasa < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-muted-foreground")}>
                      {fmtPct(tasa)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.cod_cobrado))}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(N(z.flete))}</TableCell>
                    <TableCell className={cn("text-right font-semibold tabular-nums", pnlColor(m))}>{fmtMoney(m)}</TableCell>
                    <TableCell>
                      <div className="h-1.5 w-full rounded bg-muted">
                        <div className={cn("h-1.5 rounded", m >= 0 ? "bg-emerald-500" : "bg-destructive")}
                             style={{ width: `${Math.abs(m) / maxMargen * 100}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 5 · concentración */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              Concentración de volumen
              <Tip tip="Cuánto del despacho se juega en pocas provincias. Cuanto más concentrado, más pesa mejorar la tasa de una sola zona." />
            </span>
            <span className="text-xs tabular-nums text-muted-foreground">{totalGuias.toLocaleString("es-AR")} guías</span>
          </div>
          <Donut slices={concentracion} money={false}
                 centro={top6.length ? fmtPct(top6.reduce((s, z) => s + z.guias, 0) / (totalGuias || 1)) : undefined}
                 subcentro="top 6" />
        </CardContent>
      </Card>

      {/* 6 · desenlaces */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            En qué termina cada guía
            <Tip tip="Distribución de desenlaces de las guías despachadas en el rango. 'En la calle' son las que todavía no se resolvieron, así que en rangos recientes va a pesar mucho." />
          </span>
          <Donut money={false}
                 slices={desenlaces.map((d) => ({
                   label: ESTADO[d.estado] ?? d.estado, value: d.guias,
                   className: ESTADO_COLOR[d.estado] ?? "stroke-slate-400",
                 }))} />
        </CardContent>
      </Card>

      {/* 7 · matriz producto × courier */}
      <Card>
        <CardContent className="space-y-3 pt-5">
          <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Tasa de entrega · producto × canal
            <Tip tip="Contrasta la hipótesis de que la entrega depende más del producto que del courier. Las celdas con menos de 15 despachos quedan vacías: con ese volumen la tasa es ruido." />
          </span>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                {canales.map((c) => <TableHead key={c} className="text-right">{COURIER[c] ?? c}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {productos.map((p) => (
                <TableRow key={p}>
                  <TableCell className="font-medium">{p}</TableCell>
                  {canales.map((c) => {
                    const v = celda(p, c);
                    return (
                      <TableCell key={c} className="text-right tabular-nums">
                        {v ? (
                          <span className={cn(v.tasa < 0.35 ? "text-destructive"
                            : v.tasa < 0.45 ? "text-amber-600 dark:text-amber-500" : "text-foreground")}>
                            {fmtPct(v.tasa)}
                            <span className="ml-1 text-[0.65rem] text-muted-foreground">({v.n})</span>
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </>
      )}
    </main>
  );
}
