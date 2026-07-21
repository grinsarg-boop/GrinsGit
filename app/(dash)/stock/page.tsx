import { Card, CardContent } from "@/components/ui/card";
import { Tip } from "@/components/ui/tooltip";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Panel } from "@/components/panel";
import { SaveButton } from "@/components/save-button";
import { daysAgoIso, fmtDate, fmtMoney } from "@/lib/format";
import { fetchCashflow } from "@/lib/cashflow";
import { CAT_PROVEEDOR, ESPEJO_DESDE, costosCombos, egresosSinEspejo, fetchStock, valorInventario } from "@/lib/stock";
import { supabaseAdmin } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { registrarCompra } from "./actions";

export const revalidate = 60;

// Stock: la tercera pata del sistema (panel = devengado, Cashflow = percibido, Stock = inventario).
// Lee en vivo el Supabase de la app Stock Cosmética y cierra el circuito de compras: la compra se
// carga UNA vez acá → Stock suma unidades y actualiza costo, y el egreso Proveedor aparece solo
// en la caja. El costo real por combo (receta + packaging) es el candidato a alimentar
// product_costs del panel (COGS con envase).
type CostoPanel = { pack: number; unit_cost: number; is_estimated: boolean; products: { name: string } | null };

const INPUT = "w-full rounded border bg-background px-2 py-1 text-sm";

export default async function Stock() {
  if (!process.env.STOCK_SERVICE_KEY) {
    return (
      <Card>
        <CardContent className="space-y-2 py-8 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Falta conectar el Supabase de Stock.</p>
          <p>
            En el dashboard de Supabase del proyecto de Stock (<code>fxltytovnfpgnwefoovx</code>):
            Project Settings → API keys → pestaña «Legacy API keys» → copiar la <code>service_role</code>.
          </p>
          <p>
            Pegarla como <code>STOCK_SERVICE_KEY</code> en <code>.env.local</code> y en las env vars de
            Vercel (Production + Preview). Nunca va al browser: solo la usa el servidor.
          </p>
        </CardContent>
      </Card>
    );
  }

  let s: Awaited<ReturnType<typeof fetchStock>>;
  try {
    s = await fetchStock();
  } catch (e) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          No pude leer la app Stock ({e instanceof Error ? e.message : "error"}). Reintentá en un rato;
          si persiste, revisar STOCK_SERVICE_KEY.
        </CardContent>
      </Card>
    );
  }

  const inv = valorInventario(s.materiales, s.productos, s.recetas);
  const combos = costosCombos(s.combos, s.recetas, s.packs, s.materiales);
  const productoDe = new Map(s.productos.map((p) => [p.id, p.nombre]));

  // Cajas de la app Cashflow para imputar el pago, y costos actuales del panel para comparar.
  const [cf, pc] = await Promise.all([
    fetchCashflow().catch(() => null),
    supabaseAdmin()
      .from("product_costs")
      .select("pack,unit_cost,is_estimated,products(name)")
      .order("product_id")
      .order("pack") as unknown as Promise<{ data: CostoPanel[] | null }>,
  ]);
  const costosPanel = pc.data ?? [];

  // El hábito real: la compra se anota por el bot de WhatsApp o la PWA → llega a la caja
  // como egreso Proveedor (monto + texto). Acá se detectan los que Stock no tiene y solo
  // falta ponerles insumo + cantidad.
  const sinEspejo = cf
    ? egresosSinEspejo(
        cf.movs
          .filter((m) => m.tipo === "egreso" && !m.es_retiro && m.categoria_id === CAT_PROVEEDOR && m.fecha >= ESPEJO_DESDE)
          .map((m) => ({ id: m.id, fecha: m.fecha, monto: Number(m.monto), descripcion: m.descripcion, autor: m.autor })),
        s.compras,
      )
    : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Stock</h1>
        <p className="text-sm text-muted-foreground">
          Inventario de producción en vivo desde la app Stock Cosmética. Las compras se cargan UNA
          vez acá: suman stock, actualizan el costo del insumo y crean solas el egreso Proveedor en
          la caja.
        </p>
      </div>

      {/* Valor del inventario */}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Insumos", inv.insumos, "Σ stock × costo unitario de cada insumo."] as const,
          ["Terminados", inv.terminados, "Unidades terminadas valorizadas al costo de su receta."] as const,
          ["Inventario total", inv.total, "Plata inmovilizada en stock. Con la caja y el a cobrar de /caja completa la foto: caja + a cobrar + stock."] as const,
        ].map(([label, valor, tip]) => (
          <Card key={label}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">{label} <Tip tip={tip} /></div>
              <div className="text-lg font-semibold tabular-nums">{fmtMoney(valor)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {inv.sinCosto.length > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Insumos sin costo cargado (el valor y los costos por combo son un piso):{" "}
          {inv.sinCosto.join(", ")}. Se cargan comprando acá o editando el insumo en la app Stock.
        </p>
      )}

      {/* Compras anotadas por el bot/PWA que Stock todavía no conoce: se completan acá */}
      {sinEspejo.length > 0 && (
        <Panel
          titulo={<span className="text-amber-600 dark:text-amber-400">Compras de la caja sin espejo en Stock ({sinEspejo.length})</span>}
          tip="Egresos Proveedor que entraron a la caja (por el bot de WhatsApp o la PWA) y no tienen compra gemela en Stock. Elegí el insumo y la cantidad y Guardar: Stock suma unidades y actualiza el costo usando el monto y la fecha que ya vinieron de la caja — sin duplicar el egreso. El panel desaparece cuando no queda ninguna."
        >
          <div className="space-y-2.5 text-sm">
            {sinEspejo.map((e) => (
              <div key={e.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <span className="truncate text-muted-foreground tabular-nums">
                  {fmtDate(e.fecha)} · «{e.descripcion || "sin descripción"}» ({e.autor ?? "?"}) · {fmtMoney(e.monto)}
                </span>
                <form action={registrarCompra} className="flex items-center gap-1.5">
                  <input type="hidden" name="precio" value={e.monto} />
                  <input type="hidden" name="caja" value="0" />
                  <input type="hidden" name="fecha" value={e.fecha} />
                  <input type="hidden" name="nota" value={`espejo caja: ${e.descripcion || e.id}`} />
                  <select name="material" required defaultValue="" className="rounded border bg-background px-1.5 py-0.5 text-xs">
                    <option value="" disabled>insumo…</option>
                    {s.materiales.map((m) => (
                      <option key={m.id} value={`${m.id}|${m.nombre}`}>{m.nombre} ({m.unidad})</option>
                    ))}
                  </select>
                  <input name="cantidad" type="number" step="any" min="0.000001" required placeholder="cant."
                    className="w-20 rounded border bg-background px-1.5 py-0.5 text-xs" />
                  <SaveButton />
                </form>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Compra de insumos: carga única */}
      <Panel
        titulo="Registrar compra"
        tip="La carga única del circuito: suma unidades al insumo, fija su costo al último precio pagado (conservador con inflación) y crea el egreso Proveedor en la app Cashflow con la caja elegida. Si la compra ya estaba cargada en la caja (histórico), elegí «Sin egreso en caja»."
      >
        <form action={registrarCompra} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Insumo</span>
            <select name="material" required defaultValue="" className={INPUT}>
              <option value="" disabled>Elegir insumo…</option>
              {s.materiales.map((m) => (
                <option key={m.id} value={`${m.id}|${m.nombre}`}>
                  {m.nombre} ({m.unidad})
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Cantidad</span>
            <input name="cantidad" type="number" step="any" min="0.000001" required className={INPUT} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Precio total pagado ($)</span>
            <input name="precio" type="number" step="any" min="1" required className={INPUT} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Caja que pagó</span>
            <select name="caja" required defaultValue="" className={INPUT}>
              <option value="" disabled>Elegir caja…</option>
              {(cf?.cajas ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
              <option value="0">Sin egreso en caja (ya estaba cargado)</option>
            </select>
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Fecha</span>
            <input name="fecha" type="date" defaultValue={daysAgoIso(0)} className={INPUT} />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Nota (opcional)</span>
            <input name="nota" type="text" className={INPUT} />
          </label>
          <div className="self-end"><SaveButton>Registrar compra</SaveButton></div>
        </form>
      </Panel>

      {/* Insumos */}
      <Panel
        titulo="Insumos"
        tip="Stock actual de cada insumo según la app Stock. En ámbar los que están por debajo de su mínimo. Valorizado = stock × costo unitario."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Insumo</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="text-right">Costo unit.</TableHead>
              <TableHead className="text-right">Valorizado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {s.materiales.map((m) => {
              const bajo = Number(m.stock) < Number(m.stock_minimo);
              return (
                <TableRow key={m.id} className={cn(bajo && "text-amber-600 dark:text-amber-400")}>
                  <TableCell>{m.nombre} <span className="text-xs text-muted-foreground">({m.categoria})</span></TableCell>
                  <TableCell className="text-right tabular-nums">{Number(m.stock)} {m.unidad}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">{Number(m.stock_minimo) || "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costo_unitario != null ? fmtMoney(Number(m.costo_unitario)) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{m.costo_unitario != null ? fmtMoney(Number(m.stock) * Number(m.costo_unitario)) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Panel>

      {/* Costo real por combo vs costos del panel */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          titulo="Costo real por combo (Stock)"
          tip="Receta × unidades + packaging propio del combo, a costos actuales de insumos. Es el COGS CON envase. Si un insumo no tiene costo, el total es un piso y aparece marcado."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Combo</TableHead>
                <TableHead className="text-right">Contenido</TableHead>
                <TableHead className="text-right">Packaging</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combos.map((c) => (
                <TableRow key={c.combo.id}>
                  <TableCell>
                    {c.combo.nombre}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({productoDe.get(c.combo.producto_id) ?? "?"} ×{Number(c.combo.cantidad_producto)})
                    </span>
                    {c.sinCosto.length > 0 && (
                      <span className="text-xs text-amber-600 dark:text-amber-400"> · piso: falta costo de {c.sinCosto.join(", ")}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(c.contenido)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(c.packaging)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmtMoney(c.total)}</TableCell>
                </TableRow>
              ))}
              {combos.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-muted-foreground">Sin combos cargados en la app Stock.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>

        <Panel
          titulo="Costos del panel (product_costs)"
          tip="Lo que el P&L usa hoy como COGS por producto·pack. Compará a ojo contra el costo real por combo de la izquierda: si el de acá es menor, probablemente sea solo contenido (falta el envase) y hay que actualizarlo desde /config."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="text-right">Pack</TableHead>
                <TableHead className="text-right">Costo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costosPanel.map((c, i) => (
                <TableRow key={i}>
                  <TableCell>
                    {c.products?.name ?? "?"}
                    {c.is_estimated && <span className="text-xs text-muted-foreground"> · estimado</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">×{c.pack}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtMoney(Number(c.unit_cost))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      </div>
    </div>
  );
}
