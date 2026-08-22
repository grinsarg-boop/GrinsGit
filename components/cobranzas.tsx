import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import Link from "next/link";
import { daysAgoIso, fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import {
  DESDE as CASHFLOW_DESDE, FIXY_LAG_DIAS, conciliarGiros, fetchCobranzas, fixyCobranza, saldoUrbano,
  type GiroUrbano, type SobreFixy,
} from "@/lib/cashflow";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";

// Los cuatro bloques de conciliación de cobranza: qué le debemos a Urbano por flete, qué nos debe de
// COD, qué falta rendir de Fixy y qué retiene ML. Vivían en el Resumen, que quedaba con ocho
// preocupaciones en la primera pantalla — y ninguna de estas es P&L: son PERCIBIDO, que es de lo que
// habla /caja. Ninguno sigue el rango del panel a propósito: son ciclos de cobranza con calendario propio.
//
// Server component con sus propias queries (mismo patrón que RitmoCouriers): si una RPC no está
// aplicada o la caja no responde, el bloque no se dibuja — nunca puede tirar la página.

const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const monthLabel = (ym: string) => { const [y, m] = ym.split("-"); return `${MES[+m - 1]} ${y}`; };

type SaldoMes = { mes: string; guias: number; total: number; estimado: number };
type Cobranza = {
  ventana_ini: string; ventana_fin: string; fecha_pago: string;
  guias: number; cod_bruto: number; comision: number; neto: number;
  rendido_bruto: number; girado_el: string | null;
};
type MlLiq = { semana: string; pagos: number; neto: number };

export async function Cobranzas() {
  const db = supabaseAdmin();
  const today = daysAgoIso(0);

  // Saldo Urbano: lo que se le va a facturar, acumulado por MES CALENDARIO — sirve para presupuestar
  // la factura. daily_pnl.flete ya trae el costo final con el ×1,29 y ya aplica la regla no_despachado
  // (018: los PI de +7d no se facturan). flete_estimado_pct es la fracción que todavía NO tiene factura.
  const [ty, tm] = today.slice(0, 7).split("-").map(Number);
  const desde3m = `${new Date(Date.UTC(ty, tm - 3, 1)).toISOString().slice(0, 7)}-01`;

  const [{ data: us }, { data: cb }, { data: fc }, { data: mq }] = await Promise.all([
    db.from("daily_pnl").select("dispatch_date, despachadas, flete, flete_estimado_pct")
      .eq("courier", "urbano").gte("dispatch_date", desde3m),
    // Desde el inicio de la caja (no 35 días): el saldo acumulado necesita TODAS las ventanas vencidas
    // desde que hay giros registrados. La tabla igual muestra 5.
    db.rpc("urbano_cobranza", { p_desde: `${CASHFLOW_DESDE}-01` }),
    db.rpc("fixy_cobranza", { p_desde: "2026-06-01" }),
    db.rpc("ml_a_liquidar"),
  ]);

  const saldoPorMes = new Map<string, SaldoMes>();
  for (const r of (us ?? []) as { dispatch_date: string; despachadas: number; flete: number; flete_estimado_pct: number | null }[]) {
    const k = r.dispatch_date.slice(0, 7);
    const a = saldoPorMes.get(k) ?? { mes: k, guias: 0, total: 0, estimado: 0 };
    const f = Number(r.flete ?? 0);
    a.guias += r.despachadas; a.total += f; a.estimado += f * Number(r.flete_estimado_pct ?? 0);
    saldoPorMes.set(k, a);
  }
  const urbanoSaldo = [...saldoPorMes.values()].sort((a, b) => (a.mes < b.mes ? 1 : -1));

  const cobranzaFull = (cb ?? []) as Cobranza[];
  const cobranza = cobranzaFull.slice(0, 5);
  const mlLiq = ((mq ?? []) as MlLiq[]).filter((w) => Number(w.neto) > 0);

  // Conciliación contra la caja real (app Cashflow): giros de Urbano y sobres de Fixy. Si la caja no
  // responde, los bloques quedan sin conciliar — nunca puede tirar la página.
  let giros: GiroUrbano[] = [];
  let sobres: SobreFixy[] = [];
  try { ({ giros, sobres } = await fetchCobranzas()); } catch { /* caja caída: se muestra sin conciliar */ }

  const conciliadas = new Map(
    conciliarGiros(cobranza.map((c) => ({ fecha_pago: c.fecha_pago, neto: Number(c.neto) })), giros, today)
      .map((v) => [v.fecha_pago, v]),
  );
  // La lectura que manda: saldo acumulado (todo lo vencido − todo lo girado). El diff por ventana queda
  // como detalle — Urbano paga partido y hace catch-up entre semanas.
  const saldoU = saldoUrbano(
    cobranzaFull.map((c) => ({ fecha_pago: c.fecha_pago, neto: Number(c.neto) })), giros, today);

  const dias = (fc ?? []) as { dia: string; neto: number }[];
  const fixyCob = dias.length ? fixyCobranza(dias.map((d) => ({ dia: d.dia, neto: Number(d.neto) })), sobres, today) : null;

  return (
    <>
      {/* Saldo Urbano: lo que se le adeuda por flete, por mes calendario. Cash planning, no P&L. */}
      {urbanoSaldo.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                Saldo Urbano
                <Tip tip="Flete que le debés a Urbano por las guías despachadas, con impuestos incluidos (tarifa × 1,29 = 21% IVA + 8% IIBB). Es el costo hundido: se paga por toda guía despachada, entregue o no. No incluye las guías que quedaron sin despachar (PI de +7 días), que Urbano no factura." />
              </span>
              <span className="text-xs text-muted-foreground">últimos 3 meses</span>
            </div>

            {(() => {
              const abierto = urbanoSaldo.find((m) => m.estimado > 0.005 * m.total);
              return abierto ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2.5">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-500">
                    A facturar · {monthLabel(abierto.mes)}
                  </div>
                  <div className="cifra text-2xl font-bold text-amber-700 dark:text-amber-400">
                    {fmtMoney(abierto.total)}
                  </div>
                  <div className="pt-0.5 text-xs text-muted-foreground">
                    {fmtMoney(abierto.total / 1.29)} de tarifa + {fmtMoney(abierto.total - abierto.total / 1.29)} de impuestos ·{" "}
                    {abierto.guias.toLocaleString("es-AR")} guías
                    {abierto.estimado >= 0.995 * abierto.total
                      ? " · estimado por promedio de zona, todavía sin factura"
                      : ` · ${fmtPct(abierto.estimado / abierto.total)} todavía sin factura`}
                  </div>
                </div>
              ) : null;
            })()}

            {/* El número accionable queda a la vista; el detalle mensual se despliega si hace falta. */}
            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-4 hover:underline">Ver los {urbanoSaldo.length} meses</span> <span className="inline-block text-xs transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">▾</span>
              </summary>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mes</TableHead>
                      <TableHead className="text-right">Guías</TableHead>
                      <TableHead className="text-right">Tarifa neta</TableHead>
                      <TableHead className="text-right">Imp. 29%</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {urbanoSaldo.map((m) => {
                      const base = m.total / 1.29;
                      const pctEst = m.total ? m.estimado / m.total : 0;
                      return (
                        <TableRow key={m.mes}>
                          <TableCell className="font-medium capitalize">{monthLabel(m.mes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{m.guias.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(base)}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(m.total - base)}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(m.total)}</TableCell>
                          <TableCell className="text-right">
                            {pctEst < 0.005 ? (
                              <span className="rounded bg-muted px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-muted-foreground">facturado</span>
                            ) : pctEst > 0.995 ? (
                              <Tip tip="Ninguna guía de este mes tiene factura todavía. El monto sale del promedio de tarifa por provincia de los últimos 60 días, así que puede moverse cuando llegue la facturación real.">
                                <span className="rounded bg-amber-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-amber-700 dark:text-amber-500">estimado</span>
                              </Tip>
                            ) : (
                              <Tip tip={`${fmtPct(pctEst)} del flete de este mes todavía no tiene factura y está estimado por promedio de zona.`}>
                                <span className="rounded bg-amber-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-amber-700 dark:text-amber-500">
                                  parcial {fmtPct(pctEst)}
                                </span>
                              </Tip>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <p className="mt-3 text-xs text-muted-foreground">
                  La facturación de Urbano llega con ~2 semanas de lag. Mientras no esté, el flete se estima con el promedio
                  de tarifa por provincia; al importarla desde <Link href="/sync" className="underline underline-offset-2">Sync</Link> el
                  monto se reemplaza por el real y el P&amp;L se recalcula.
                </p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* A cobrar de Urbano — espejo del anterior: lo que Urbano nos debe por el COD que cobró. */}
      {cobranza.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A cobrar de Urbano
                <Tip tip="COD que Urbano cobró en la puerta y todavía no giró. El ciclo es: ventana de entregas de martes a lunes, giro el martes siguiente, ya neto de la comisión de contrareembolso con impuestos (4,3% × 1,29). Verificado al centavo contra la liquidación del 14/07." />
              </span>
              <span className="text-xs text-muted-foreground">ventana martes → lunes</span>
            </div>

            {(() => {
              const abierta = cobranza.find((c) => c.fecha_pago >= today);
              return abierta ? (
                <div className="rounded-md border bg-muted/40 px-3 py-2.5">
                  <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
                    A cobrar el {fmtDate(abierta.fecha_pago)}
                  </div>
                  <div className="cifra text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                    {fmtMoney(Number(abierta.neto))}
                  </div>
                  <div className="pt-0.5 text-xs text-muted-foreground">
                    {fmtMoney(Number(abierta.cod_bruto))} cobrados − {fmtMoney(Number(abierta.comision))} de comisión ·{" "}
                    {abierta.guias.toLocaleString("es-AR")} entregas ·{" "}
                    {abierta.ventana_fin >= today ? "la ventana todavía está abierta, cierra el " : "cerrada el "}
                    {fmtDate(abierta.ventana_fin)}
                  </div>
                </div>
              ) : null;
            })()}

            {/* La lectura que manda: acumulado vencido − girado. El diff por ventana es detalle. */}
            {saldoU && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-md border px-3 py-2 text-sm">
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  Saldo acumulado con Urbano
                  <Tip tip="Todo lo vencido según el panel desde que la caja registra giros, menos todo lo girado. Es EL número a reclamar: Urbano paga partido en varios giros y compensa faltantes en semanas siguientes, así que el % de una ventana suelta engaña (el giro del 21/07 vino +9,8% devolviendo faltantes de semanas anteriores). Si este saldo crece semana a semana, ahí sí hay reclamo." />
                </span>
                <span className={cn(
                  "font-semibold tabular-nums",
                  saldoU.saldo > 500_000 ? "text-amber-700 dark:text-amber-500" : "text-emerald-700 dark:text-emerald-500",
                )}>
                  {fmtMoney(saldoU.saldo)}
                </span>
                <span className="w-full text-xs text-muted-foreground">
                  vencido desde el {fmtDate(saldoU.desde)}: {fmtMoney(saldoU.esperado)} − girado: {fmtMoney(saldoU.girado)}
                </span>
              </div>
            )}

            {/* Igual que arriba: a primera vista solo el giro pendiente, el histórico se despliega. */}
            <details className="group text-sm">
              <summary className="cursor-pointer list-none text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                <span className="underline-offset-4 hover:underline">Ver las últimas {cobranza.length} ventanas</span> <span className="inline-block text-xs transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none">▾</span>
              </summary>
              <div className="mt-2">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ventana</TableHead>
                      <TableHead className="text-right">Entregas</TableHead>
                      <TableHead className="text-right">COD cobrado</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Rendido (Urbano)
                          <Tip tip="Lo que los resúmenes de rendición de Urbano dicen que cobraron en esa ventana, en bruto (solo las guías que valen: la rendición manda sobre el estado). El % compara contra nuestro COD cobrado. Las dos últimas ventanas quedan en gris a propósito: el resumen llega en partes y el % oscila fuerte (21/07 −65% y 28/07 +34% son la misma plata llegando tarde). Una vez madura, un rojo grande es reclamo si falta, o base nuestra incompleta si sobra. Un guion es una ventana sin resumen cargado." />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Comisión</TableHead>
                      <TableHead className="text-right">Giro neto</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center gap-1">
                          Cobrado (caja)
                          <Tip tip="Ingresos con categoría Urbano en la app Cashflow, asignados a la ventana cuyo martes de pago es el más reciente anterior al giro. OJO: el % de una ventana suelta engaña — Urbano paga partido y compensa faltantes en semanas siguientes (21/07: +9,8% devolviendo lo del 30/06 y 07/07). Para reclamar, mirá el 'Saldo acumulado' de arriba; esta columna es el detalle de cómo se repartió." />
                        </span>
                      </TableHead>
                      <TableHead className="text-right">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cobranza.map((c) => {
                      const pendiente = c.fecha_pago >= today;
                      return (
                        <TableRow key={c.ventana_ini}>
                          <TableCell className="font-medium tabular-nums">
                            {fmtDate(c.ventana_ini)} <span className="text-muted-foreground">→</span> {fmtDate(c.ventana_fin)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.guias.toLocaleString("es-AR")}</TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">{fmtMoney(Number(c.cod_bruto))}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(() => {
                              const rend = Number(c.rendido_bruto ?? 0);
                              if (!rend) return <span className="text-muted-foreground">—</span>;
                              const base = Number(c.cod_bruto);
                              const diff = base > 0 ? rend / base - 1 : null;
                              // La rendición llega en partes: el % de una ventana fresca oscila ±30% sin
                              // que falte nada. Se pinta recién cuando ya maduró (>14d del martes de pago).
                              const maduro = c.fecha_pago < daysAgoIso(14);
                              return (
                                <span className="inline-flex items-center gap-1.5">
                                  {fmtMoney(rend)}
                                  {diff != null && (
                                    <span className={cn(
                                      "rounded px-1 py-px text-[0.6rem] tabular-nums",
                                      !maduro ? "bg-muted text-muted-foreground"
                                        : Math.abs(diff) <= 0.03 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500"
                                        : "bg-amber-500/15 text-amber-700 dark:text-amber-500",
                                    )}>
                                      {diff >= 0 ? "+" : ""}{(diff * 100).toFixed(1)}%
                                    </span>
                                  )}
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">−{fmtMoney(Number(c.comision))}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(Number(c.neto))}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {(() => {
                              const conc = conciliadas.get(c.fecha_pago);
                              if (pendiente || !conc) return <span className="text-muted-foreground">—</span>;
                              if (conc.diff == null)
                                return <span className="text-xs text-muted-foreground">{conc.cobrado ? fmtMoney(conc.cobrado) : "sin registro"}</span>;
                              const ok = Math.abs(conc.diff) <= 0.03;
                              return (
                                <span className="inline-flex items-center gap-1.5">
                                  {fmtMoney(conc.cobrado)}
                                  <span className={cn(
                                    "rounded px-1 py-px text-[0.6rem] tabular-nums",
                                    ok ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-500"
                                       : "bg-amber-500/15 text-amber-700 dark:text-amber-500",
                                  )}>
                                    {conc.diff >= 0 ? "+" : ""}{(conc.diff * 100).toFixed(1)}%
                                  </span>
                                </span>
                              );
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            {pendiente ? (
                              <span className="rounded bg-emerald-500/10 px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-emerald-700 dark:text-emerald-500">
                                a cobrar {fmtDate(c.fecha_pago)}
                              </span>
                            ) : c.girado_el ? (
                              // El martes es el calendario; girado_el es cuándo salió la plata de verdad.
                              (() => {
                                const tarde = Math.round(
                                  (Date.parse(c.girado_el) - Date.parse(c.fecha_pago)) / 86_400_000);
                                return (
                                  <Tip tip={tarde > 0
                                    ? `El giro salió ${tarde} día${tarde === 1 ? "" : "s"} después del martes que le tocaba (${fmtDate(c.fecha_pago)}).`
                                    : `Girado el día de pago (${fmtDate(c.fecha_pago)}).`}>
                                    <span className="rounded bg-muted px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                                      girado {fmtDate(c.girado_el)}{tarde > 0 ? ` +${tarde}d` : ""}
                                    </span>
                                  </Tip>
                                );
                              })()
                            ) : (
                              <span className="rounded bg-muted px-1.5 py-px text-[0.6rem] uppercase tracking-wide text-muted-foreground">
                                cobrado {fmtDate(c.fecha_pago)}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                <p className="mt-3 text-xs text-muted-foreground">
                  Estimación <b className="text-foreground">conservadora</b>: contra el giro real del 14/07 este cálculo quedó
                  1,2% por debajo, porque nuestra base todavía no tiene todas las entregas de la ventana. Urbano manda los
                  resúmenes de transferencia incompletos y a veces paga en varios giros por la misma semana.
                </p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* A cobrar de Fixy: sobres físicos que viajan con el transportista + gap entregado-sin-sobre. */}
      {fixyCob && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A cobrar de Fixy
                <Tip tip={`Fixy rinde el COD en sobres físicos que viajan con el transportista y se cargan en la app Cashflow ("A cobrar"). Esperado = COD entregado neto del 1%, hasta hace ${FIXY_LAG_DIAS} días (lo más nuevo todavía no tiene sobre). El "sin sobre" es un TECHO de reclamo: incluye lo cobrado digital (QR/transferencia) que no pasa por sobre — si crece mes a mes, algo falta rendir o cargar.`} />
              </span>
              <span className="text-xs text-muted-foreground">contra los sobres cargados en la app Cashflow</span>
            </div>

            <div className="flex flex-wrap gap-6">
              <div>
                <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">Sobres por cobrar</div>
                <div className="cifra text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {fmtMoney(fixyCob.pendienteCobro)}
                </div>
                <div className="pt-0.5 text-xs text-muted-foreground">cargados en la caja, todavía sin cobrar</div>
              </div>
              <div>
                <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Entregado sin sobre (techo)</div>
                <div className={cn("cifra text-2xl font-bold", fixyCob.gap > 0 ? "text-amber-600 dark:text-amber-500" : "")}>
                  {fmtMoney(fixyCob.gap)}
                </div>
                <div className="pt-0.5 text-xs text-muted-foreground">
                  {fmtMoney(fixyCob.esperadoNeto)} entregado neto (hasta hace {FIXY_LAG_DIAS} días, desde jun) − {fmtMoney(fixyCob.rendido)} en sobres
                </div>
              </div>
              <div>
                <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">Último sobre</div>
                <div className="cifra text-2xl font-bold">
                  {fixyCob.ultimoSobre ? fmtDate(fixyCob.ultimoSobre) : "—"}
                </div>
                {fixyCob.ultimoSobre && fixyCob.ultimoSobre < daysAgoIso(FIXY_LAG_DIAS) && (
                  <div className="pt-0.5 text-xs text-amber-600 dark:text-amber-500">hace más de {FIXY_LAG_DIAS} días — ¿falta cargar?</div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* A liquidar de ML: la plata retenida en el MP hasta la fecha de liberación (mediana ~11 días). */}
      {mlLiq.length > 0 && (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
                A liquidar de ML
                <Tip tip="Ventas de MercadoLibre ya pagadas cuya plata todavía está retenida en el MercadoPago (MP Santi = MP DERMATECH). ML libera CONTRA ENTREGA, no a plazo fijo: la mediana real son 11 días desde la venta (mínimo 8). Mientras el pedido no se entrega, MP informa su fecha de peor caso (+28 días), así que las semanas más lejanas de la tabla son proyección: esas ventas van a liberar antes. El neto ya viene descontado de comisión, flete y retenciones impositivas — es plata que cae tal cual. Verificado contra el detalle de liberaciones de MP (20/08/2026)." />
              </span>
              <span className="text-xs text-muted-foreground">libera en el MP contra entrega (~11 días)</span>
            </div>

            <div className="rounded-md border bg-muted/40 px-3 py-2.5">
              <div className="text-[0.65rem] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
                Pendiente de liberar
              </div>
              <div className="cifra text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                {fmtMoney(mlLiq.reduce((s, w) => s + Number(w.neto), 0))}
              </div>
              <div className="pt-0.5 text-xs text-muted-foreground">
                {mlLiq.reduce((s, w) => s + w.pagos, 0).toLocaleString("es-AR")} ventas ·{" "}
                próxima liberación la semana del {fmtDate(mlLiq[0].semana)}
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semana de liberación</TableHead>
                  <TableHead className="text-right">Ventas</TableHead>
                  <TableHead className="text-right">Neto que libera</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mlLiq.map((w) => (
                  <TableRow key={w.semana}>
                    <TableCell className="font-medium tabular-nums">semana del {fmtDate(w.semana)}</TableCell>
                    <TableCell className="text-right tabular-nums">{w.pagos.toLocaleString("es-AR")}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{fmtMoney(Number(w.neto))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </>
  );
}
