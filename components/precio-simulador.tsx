"use client";
import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Panel } from "@/components/panel";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { comparar, tasaPorTicket, type PuntoCurva } from "@/lib/precio-sim";
import { fmtMoney, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DatosSim = {
  productos: { id: number; name: string }[];
  costos: { productId: number; pack: number; costo: number; estimado: boolean }[];
  fletes: Record<string, number>;
  comisiones: Record<string, number>;
  cpaRef: Record<string, { objetivo: number; maximo: number }>;
  curvas: { urbano: PuntoCurva[]; fixy: PuntoCurva[] };
  detalle: { urbano: { producto: string; pack: number; ticket: number; n: number; tasa: number }[];
             fixy: { producto: string; pack: number; ticket: number; n: number; tasa: number }[] };
};

const INPUT = "w-full rounded border bg-background px-2 py-1 text-sm tabular-nums";
const LABEL = "block text-xs font-medium text-muted-foreground";

export function SimuladorPrecio({ datos }: { datos: DatosSim }) {
  const [productId, setProductId] = useState(datos.productos.at(-1)?.id ?? 1);
  const [pack, setPack] = useState(3);
  const [courier, setCourier] = useState<"urbano" | "fixy">("urbano");
  const [precioActual, setPrecioActual] = useState(89990);
  const [precioNuevo, setPrecioNuevo] = useState(79990);
  const [cpa, setCpa] = useState(14635);
  // La tasa se estima sola desde la curva medida; el override existe porque a veces sabés algo que
  // la curva no (un producto que entrega distinto, una zona nueva). Si lo tocás, se queda quieto.
  const [tasaManual, setTasaManual] = useState<{ a: number; n: number } | null>(null);
  const [merma, setMerma] = useState(0);

  const costo = useMemo(() => {
    const c = datos.costos.find((x) => x.productId === productId && x.pack === pack);
    return c?.costo ?? 0;
  }, [datos.costos, productId, pack]);
  const costoEstimado = datos.costos.find((x) => x.productId === productId && x.pack === pack)?.estimado ?? false;

  const flete = datos.fletes[courier] ?? 0;
  const comision = datos.comisiones[courier] ?? 0;
  const curva = datos.curvas[courier];

  const tasaA = tasaManual?.a ?? tasaPorTicket(curva, precioActual);
  const tasaN = tasaManual?.n ?? tasaPorTicket(curva, precioNuevo);

  const c = useMemo(
    () => comparar(
      { precio: precioActual, tasa: tasaA, costo, flete, comision, mermaDevuelto: merma },
      { precio: precioNuevo, tasa: tasaN, costo, flete, comision, mermaDevuelto: merma },
    ),
    [precioActual, precioNuevo, tasaA, tasaN, costo, flete, comision, merma],
  );

  const packsDisponibles = [...new Set(datos.costos.filter((x) => x.productId === productId).map((x) => x.pack))].sort();
  const nombre = datos.productos.find((p) => p.id === productId)?.name ?? "";
  const ref = datos.cpaRef[nombre];

  // El veredicto en una línea. El corte no es "¿da positivo?" sino "¿le gana al CPA?": una
  // contribución de $13.563 con un CPA de $14.635 es plata que se va, aunque el número sea verde.
  const margenA = c.actual.contribucion - cpa;
  const margenN = c.nuevo.contribucion - cpa;
  const el = c.elasticidadRequerida;
  const veredicto = !Number.isFinite(c.factorConversion)
    ? { txt: "Ningún volumen alcanza: a ese precio cada pedido extra agranda el agujero.", tono: "mal" as const }
    : c.factorConversion <= 1
      ? { txt: `Subir el precio libera margen: podés resignar hasta ${fmtPct(1 - c.factorConversion)} de conversión y quedar igual.`, tono: "bien" as const }
      : el <= 2.5
        ? { txt: `Necesitás ${fmtPct(c.factorConversion - 1)} más de conversión. Elasticidad requerida ${el.toFixed(1)} — alcanzable, pero al filo.`, tono: "ojo" as const }
        : { txt: `Necesitás ${fmtPct(c.factorConversion - 1)} más de conversión. Elasticidad requerida ${el.toFixed(1)} — no existe esa elasticidad.`, tono: "mal" as const };

  const TONO = { bien: "text-emerald-600 dark:text-emerald-400", ojo: "text-amber-600 dark:text-amber-400", mal: "text-red-600 dark:text-red-400" };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className={LABEL} htmlFor="prod">Producto</label>
            <select id="prod" className={INPUT} value={productId} onChange={(e) => { setProductId(+e.target.value); setTasaManual(null); }}>
              {datos.productos.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="pack">Pack</label>
            <select id="pack" className={INPUT} value={pack} onChange={(e) => setPack(+e.target.value)}>
              {packsDisponibles.map((p) => <option key={p} value={p}>x{p}</option>)}
              {!packsDisponibles.includes(pack) && <option value={pack}>x{pack} (sin costo cargado)</option>}
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="cour">Courier</label>
            <select id="cour" className={INPUT} value={courier} onChange={(e) => { setCourier(e.target.value as "urbano" | "fixy"); setTasaManual(null); }}>
              <option value="urbano">Urbano</option>
              <option value="fixy">Fixy</option>
            </select>
          </div>
          <div>
            <label className={LABEL} htmlFor="cpa">CPA que estás pagando</label>
            <input id="cpa" type="number" className={INPUT} value={cpa} onChange={(e) => setCpa(+e.target.value)} />
            {ref && <p className="mt-1 text-[11px] text-muted-foreground">objetivo {fmtMoney(ref.objetivo)} · máximo {fmtMoney(ref.maximo)}</p>}
            {!ref && <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">sin vara en cpa_referencia</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {([["Hoy", precioActual, setPrecioActual, tasaA, c.actual, margenA, "a"],
           ["Simulado", precioNuevo, setPrecioNuevo, tasaN, c.nuevo, margenN, "n"]] as const).map(
          ([titulo, precio, setPrecio, tasa, r, margen, k]) => (
          <Card key={titulo}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-baseline justify-between">
                <h2 className="text-sm font-semibold">{titulo}</h2>
                <span className="text-xs text-muted-foreground">{nombre} x{pack} · {courier}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL} htmlFor={`p-${k}`}>Precio</label>
                  <input id={`p-${k}`} type="number" className={INPUT} value={precio} onChange={(e) => setPrecio(+e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`t-${k}`}>Tasa de entrega</label>
                  <input id={`t-${k}`} type="number" step={0.01} min={0} max={1} className={INPUT}
                         value={Number(tasa.toFixed(4))}
                         onChange={(e) => setTasaManual({ a: k === "a" ? +e.target.value : tasaA, n: k === "n" ? +e.target.value : tasaN })} />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {tasaManual ? "manual" : "estimada desde la curva medida"}
                  </p>
                </div>
              </div>
              <dl className="space-y-1 border-t pt-3 text-sm tabular-nums">
                {([["Cobrado esperado", r.cobrado], ["− Comisión courier", -r.comisionPagada],
                   ["− Flete (se paga igual si vuelve)", -r.fletePagado], ["− Costo de producto", -r.costoProducto]] as const).map(([l, v]) => (
                  <div key={l} className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">{l}</dt><dd>{fmtMoney(v)}</dd>
                  </div>
                ))}
                <div className="flex justify-between gap-4 border-t pt-1 font-medium">
                  <dt>Contribución por pedido puesto</dt><dd>{fmtMoney(r.contribucion)}</dd>
                </div>
                <div className={cn("flex justify-between gap-4 font-medium", margen >= 0 ? TONO.bien : TONO.mal)}>
                  <dt>− CPA {fmtMoney(cpa)}</dt><dd>{fmtMoney(margen)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-2 pt-6">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <span className="text-sm text-muted-foreground">
              Precio {c.deltaPrecioPct >= 0 ? "+" : ""}{fmtPct(c.deltaPrecioPct)} · contribución {fmtMoney(c.deltaContribucion)}
            </span>
            {Number.isFinite(c.factorConversion) && (
              <span className="font-display text-2xl font-bold tabular-nums">{c.factorConversion.toFixed(2)}×</span>
            )}
          </div>
          <p className={cn("text-sm font-medium", TONO[veredicto.tono])}>{veredicto.txt}</p>
          <p className="text-xs text-muted-foreground">
            La elasticidad es cuánto sube la cantidad por cada punto que baja el precio. En consumo
            masivo, 1,5-2,5 es lo que se consigue; arriba de 3 no se ha visto. Si el número que pide
            este escenario está arriba de eso, la baja no se paga sola.
          </p>
        </CardContent>
      </Card>

      <Panel titulo="Supuestos y de dónde sale cada número">
        <div className="space-y-3 text-sm">
          <dl className="grid gap-2 sm:grid-cols-2">
            {([["Costo del pack", `${fmtMoney(costo)}${costoEstimado ? " (estimado)" : ""}`, "product_costs"],
               ["Flete", fmtMoney(flete), "settings.flete_prom_courier"],
               ["Comisión", fmtPct(comision), "settings.commission_pct"],
               ["Curva de entrega", `${curva.length} puntos medidos`, "curva_entrega_por_ticket()"]] as const).map(([l, v, src]) => (
              <div key={l} className="flex justify-between gap-4 rounded border px-3 py-2">
                <dt><span className="font-medium">{l}</span><br /><code className="text-[11px] text-muted-foreground">{src}</code></dt>
                <dd className="tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <label className={LABEL} htmlFor="merma">Merma del devuelto (fracción del costo que no se recupera)</label>
            <input id="merma" type="number" step={0.05} min={0} max={1} className={cn(INPUT, "max-w-32")}
                   value={merma} onChange={(e) => setMerma(+e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              0 = todo lo que vuelve se revende (supuesto optimista, el que usa el panel). Subilo si
              la mercadería vuelve dañada.
            </p>
          </div>
        </div>
      </Panel>

      <Panel titulo="La curva medida: la tasa de entrega SUBE con el ticket"
             tip="Dentro del mismo producto, el pack es lo único que cambia — así que la diferencia de tasa es del precio, no del producto ni de la zona.">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Producto</TableHead><TableHead>Pack</TableHead>
              <TableHead className="text-right">Ticket</TableHead>
              <TableHead className="text-right">n</TableHead>
              <TableHead className="text-right">Entrega</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datos.detalle[courier].map((r) => (
              <TableRow key={`${r.producto}-${r.pack}`}>
                <TableCell>{r.producto}</TableCell>
                <TableCell>x{r.pack}</TableCell>
                <TableCell className="text-right tabular-nums">{fmtMoney(r.ticket)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{r.n}</TableCell>
                <TableCell className="text-right tabular-nums font-medium">{fmtPct(Number(r.tasa))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-3 text-xs text-muted-foreground">
          Urbano, despachos desde el 01/07/2026, solo COD (el prepago no tiene riesgo de puerta) y
          solo guías resueltas. Mínimo 40 guías por fila. Pureza gana 13,9 pp del x1 al x3 con n
          grande; el patrón se repite en Natures y BeeVenom. Veinguard es el contraejemplo, con n
          chico. Conclusión: bajar el precio no compra tasa de entrega — la empeora.
        </p>
      </Panel>
    </div>
  );
}
