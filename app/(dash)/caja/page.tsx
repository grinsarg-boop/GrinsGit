import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CajaFlujo } from "@/components/caja-flujo";
import { CajaPendiente } from "@/components/caja-pendiente";
import { daysAgoIso, fmtDate, fmtMoney } from "@/lib/format";
import {
  DESDE, ESTRUCTURA, YA_MODELADO, balance5050, fetchCashflow, flujoDiario, porMes, saldos,
  type MesCaja,
} from "@/lib/cashflow";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { categorizarMov } from "./actions";

export const revalidate = 60;

// Caja y P&L final real. Única página que junta los dos mundos: el margen de contribución del panel
// (devengado por día de venta, sales_days) y la caja real de la app Cashflow (percibido). El puente:
// margen − estructura = neto real del mes. Publicidad/Proveedor/Logística de la caja NO se restan
// (ya viven dentro del margen como ads/COGS/flete) — se muestran como conciliación.
type SalesDay = { sale_date: string; profit_confirmado: number; profit_estimado: number; ads_sin_cohorte: number };

const N = (v: number | null | undefined) => Number(v ?? 0);
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesLabel = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
const pnlColor = (n: number) => (n >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive");

// Panel colapsable: <details> nativo (mismo recurso que los recuadros del Resumen). El estado
// no persiste entre recargas — alcanza para despejar la vista mientras se lee.
function Panel({ titulo, tip, children }: { titulo: React.ReactNode; tip?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <details open className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
            <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-90">▸</span>
            {titulo}
            {tip && <Tip tip={tip} />}
          </summary>
          <div className="mt-3">{children}</div>
        </details>
      </CardContent>
    </Card>
  );
}

export default async function Caja() {
  let cf: Awaited<ReturnType<typeof fetchCashflow>>;
  try {
    cf = await fetchCashflow();
  } catch (e) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No pude leer la app Cashflow ({e instanceof Error ? e.message : "error"}). Reintentá en un rato;
          si persiste, revisar CASHFLOW_ANON_KEY.
        </CardContent>
      </Card>
    );
  }

  const meses = porMes(cf.movs, cf.cats);
  const mesActual = daysAgoIso(0).slice(0, 7);

  // Margen de contribución por mes desde sales_days (mismo neto que /ventas y /tendencias:
  // profit_estimado − ads_sin_cohorte), para los meses que la caja tiene cargados.
  const desde = meses.length ? `${meses[meses.length - 1].mes}-01` : `${mesActual}-01`;
  const { data: sdRaw } = await supabaseAdmin().rpc("sales_days", { p_from: desde, p_courier: null });
  const margen = new Map<string, { est: number; conf: number }>();
  for (const r of (sdRaw ?? []) as SalesDay[]) {
    const mes = r.sale_date.slice(0, 7);
    const m = margen.get(mes) ?? { est: 0, conf: 0 };
    m.est += N(r.profit_estimado) - N(r.ads_sin_cohorte);
    m.conf += N(r.profit_confirmado) - N(r.ads_sin_cohorte);
    margen.set(mes, m);
  }

  const heroMeses = meses.slice(0, 2); // mes en curso + anterior
  const cajas = saldos(cf.movs, cf.cajas);
  const socios = balance5050(cf.movs);
  const flujo = flujoDiario(cf.movs);
  const aCobrar = cf.cobrar.reduce((s, c) => s + Number(c.monto), 0);
  const retirosMes = new Map<string, number>();
  for (const r of cf.movs)
    if (r.es_retiro && r.fecha.slice(0, 7) === mesActual)
      retirosMes.set(r.autor ?? "?", (retirosMes.get(r.autor ?? "?") ?? 0) + Number(r.monto));
  const pendientes = cf.movs
    .filter((m) => m.tipo === "egreso" && !m.es_retiro && m.categoria_id == null && m.fecha.slice(0, 7) >= DESDE)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const catsEgreso = cf.cats.filter((c) => c.tipo === "egreso").sort((a, b) => a.nombre.localeCompare(b.nombre));

  // Filas de la tabla por categoría: las fijas + cualquier categoría nueva que aparezca en la caja
  // (porMes ya la cuenta como estructura; acá solo hay que listarla).
  const conocidas = new Set([...ESTRUCTURA, ...YA_MODELADO, "Ajustes", "Personal socios"]);
  const extras = [...new Set(meses.flatMap((m) => Object.keys(m.porCat)))].filter((c) => !conocidas.has(c)).sort();
  const filasEstructura = [...ESTRUCTURA, ...extras];

  const celda = (m: MesCaja, get: (m: MesCaja) => number, muted = false) => (
    <TableCell key={m.mes} className={cn("text-right tabular-nums", muted && "text-muted-foreground")}>
      {get(m) ? fmtMoney(get(m)) : "—"}
    </TableCell>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Caja</h1>
        <p className="text-sm text-muted-foreground">
          Plata real de la app Cashflow (percibido) cruzada con el margen del panel (devengado). Acá vive
          el único número que el resto del panel no tiene: el neto DESPUÉS de la estructura.
        </p>
      </div>

      {/* P&L final real por mes */}
      <details open className="group/hero">
        <summary className="mb-2 flex cursor-pointer list-none items-center gap-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
          <span aria-hidden className="text-muted-foreground transition-transform group-open/hero:rotate-90">▸</span>
          P&L final real por mes
        </summary>
        <div className="grid gap-4 sm:grid-cols-2">
          {heroMeses.map((m) => {
            const mg = margen.get(m.mes);
            const neto = mg ? mg.est - m.estructura : null;
            return (
              <Card key={m.mes}>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="capitalize">{mesLabel(m.mes)}</span>
                    {m.mes === mesActual && (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-400">
                        en curso, estimado
                      </span>
                    )}
                    <Tip tip="Margen de contribución del panel (profit estimado − ads sin cohorte, por día de venta, igual que /ventas) menos la estructura pagada según la caja (sueldos, alquiler, software, financieros, comida y lo sin categoría). Publicidad, proveedores y logística de la caja NO se restan: ya están dentro del margen." />
                  </div>
                  <div className="space-y-1 text-sm tabular-nums">
                    <div className="flex justify-between">
                      <span>Margen de contribución (est.)</span>
                      <span className={mg ? pnlColor(mg.est) : ""}>{mg ? fmtMoney(mg.est) : "—"}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>− Estructura (caja)</span>
                      <span>{fmtMoney(m.estructura)}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-semibold">
                      <span>= Neto real</span>
                      <span className={cn("text-lg", neto != null && pnlColor(neto))}>
                        {neto != null ? fmtMoney(neto) : "—"}
                      </span>
                    </div>
                    {mg && (
                      <div className="text-xs text-muted-foreground">
                        con margen confirmado (piso): {fmtMoney(mg.conf - m.estructura)}
                      </div>
                    )}
                    {(m.retiros > 0 || m.personalSocios > 0) && (
                      <div className="text-xs text-muted-foreground">
                        los socios ya se llevaron {fmtMoney(m.retiros + m.personalSocios)} (retiros
                        {m.personalSocios > 0 ? " + personales" : ""})
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </details>

      {/* Egresos sin categoría: se clasifican acá mismo, la fila desaparece al guardar */}
      {pendientes.length > 0 && (
        <Panel
          titulo={<span className="text-amber-600 dark:text-amber-400">Registros pendientes ({pendientes.length})</span>}
          tip="Egresos sin categoría en la app Cashflow. Se restan como estructura (conservador): el neto real solo puede mejorar al clasificarlos. Elegí la categoría y Guardar — escribe directo en la base de Cashflow y la fila desaparece. Este panel se oculta solo cuando no queda ninguno."
        >
          <div className="space-y-2 text-sm tabular-nums">
            {pendientes.map((m) => (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <span className="truncate text-muted-foreground">
                  {fmtDate(m.fecha)} · «{m.descripcion || "sin descripción"}» ({m.autor ?? "?"}) · {fmtMoney(m.monto)}
                </span>
                <CajaPendiente movId={m.id} categorias={catsEgreso} action={categorizarMov} />
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Flujo de movimientos */}
      <Panel
        titulo="Flujo de caja por día"
        tip="Movimientos reales de la app Cashflow por día: verde hacia arriba = plata que entró (giros cobrados), rojo hacia abajo = plata que salió (gastos y retiros). Las transferencias entre cajas propias no cuentan. Pasá el mouse para ver los montos y el neto del día."
      >
        <CajaFlujo data={flujo} />
      </Panel>

      {/* Egresos por categoría × mes */}
      <Panel
        titulo="Caja por categoría y mes"
        tip="Movimientos reales de la app Cashflow por mes calendario. El bloque 'ya en el P&L' (publicidad, proveedor, logística) no se resta del neto: esa plata ya está contada en el margen como ads, COGS y flete — acá sirve para conciliar caja vs devengado. Ajustes son arqueos de caja."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Categoría</TableHead>
              {meses.map((m) => (
                <TableHead key={m.mes} className="text-right capitalize">{mesLabel(m.mes)}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell className="font-medium">Ingresos (giros cobrados)</TableCell>
              {meses.map((m) => celda(m, (x) => x.ingresos))}
            </TableRow>
            {filasEstructura.map((cat) => (
              <TableRow key={cat}>
                <TableCell>{cat}</TableCell>
                {meses.map((m) => celda(m, (x) => x.porCat[cat] ?? 0))}
              </TableRow>
            ))}
            <TableRow>
              <TableCell>Sin categoría</TableCell>
              {meses.map((m) => celda(m, (x) => x.sinCategoria))}
            </TableRow>
            <TableRow className="border-t-2">
              <TableCell className="font-semibold">Estructura (se resta del margen)</TableCell>
              {meses.map((m) => (
                <TableCell key={m.mes} className="text-right font-semibold tabular-nums">
                  {fmtMoney(m.estructura)}
                </TableCell>
              ))}
            </TableRow>
            {YA_MODELADO.map((cat) => (
              <TableRow key={cat} className="text-muted-foreground">
                <TableCell>{cat}</TableCell>
                {meses.map((m) => celda(m, (x) => x.porCat[cat] ?? 0, true))}
              </TableRow>
            ))}
            <TableRow className="text-muted-foreground">
              <TableCell>
                Ya en el P&L (no se resta){" "}
                <Tip tip="Publicidad = pagos a Meta (el panel ya cuenta ads devengado). Proveedor = compras de insumos/stock (ya está como COGS por pedido entregado). Logística = facturas Urbano, Correo y Flex (ya está como flete). Si esta fila difiere mucho del devengado del panel, hay algo para mirar." />
              </TableCell>
              {meses.map((m) => celda(m, (x) => x.yaModelado, true))}
            </TableRow>
            <TableRow className="text-muted-foreground">
              <TableCell>Ajustes de caja</TableCell>
              {meses.map((m) => celda(m, (x) => x.ajustes, true))}
            </TableRow>
            <TableRow className="text-muted-foreground">
              <TableCell>Personal socios</TableCell>
              {meses.map((m) => celda(m, (x) => x.personalSocios, true))}
            </TableRow>
            <TableRow className="text-muted-foreground">
              <TableCell>Retiros de socios</TableCell>
              {meses.map((m) => celda(m, (x) => x.retiros, true))}
            </TableRow>
          </TableBody>
        </Table>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Saldos por caja */}
        <Panel
          titulo="Saldos por caja"
          tip="Suma de todos los movimientos de la app Cashflow por caja (las transferencias mueven entre cajas). Es el arqueo teórico: si no coincide con la plata real, falta cargar movimientos o va un ajuste."
        >
          <div className="space-y-1.5 text-sm tabular-nums">
            {cajas.map(({ caja, saldo }) => (
              <div key={caja.id} className="flex justify-between">
                <span className="text-muted-foreground">{caja.nombre}</span>
                <span className={pnlColor(saldo)}>
                  {fmtMoney(saldo)}{caja.moneda === "USD" ? " USD" : ""}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-muted-foreground">A cobrar ({cf.cobrar.length} pendientes)</span>
              <span>{fmtMoney(aCobrar)}</span>
            </div>
          </div>
        </Panel>

        {/* Socios */}
        <Panel
          titulo="Socios"
          tip="Retiros del mes en curso por socio, y el balance histórico 50/50: el que retiró menos queda con la diferencia a favor para igualar. Mismo cálculo que la app Cashflow."
        >
          <div className="space-y-1.5 text-sm tabular-nums">
            {[...retirosMes.entries()].map(([autor, total]) => (
              <div key={autor} className="flex justify-between">
                <span className="text-muted-foreground">Retiros {mesLabel(mesActual).split(" ")[0]} · {autor}</span>
                <span>{fmtMoney(total)}</span>
              </div>
            ))}
            {retirosMes.size === 0 && <div className="text-muted-foreground">Sin retiros este mes</div>}
            <div className="flex justify-between border-t pt-1.5">
              <span className="text-muted-foreground">Histórico Fran / Santi</span>
              <span>{fmtMoney(socios.fran)} / {fmtMoney(socios.santi)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {socios.aFavor
                ? `${socios.aFavor} tiene ${fmtMoney(socios.dif)} a favor para igualar`
                : "Parejos"}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
