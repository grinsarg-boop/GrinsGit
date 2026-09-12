import { Card, CardContent } from "@/components/ui/card";
import { SimuladorPrecio, type DatosSim } from "@/components/precio-simulador";
import { supabaseAdmin } from "@/lib/supabase";
import type { PuntoCurva } from "@/lib/precio-sim";

export const revalidate = 300;

// Simulador de precio COD. Nació el 12/09/2026 de una discusión concreta sobre Arraigo: "si bajamos
// el precio, ¿no sube la conversión lo suficiente para compensar?". La respuesta depende de tres
// números que estaban en tres lugares distintos (costo en product_costs, flete y comisión en
// settings, tasa de entrega en ningún lado) y de una intuición que resultó ser falsa — que el
// ticket alto se rechaza más en la puerta. Ver 092_curva_entrega_por_ticket.sql.
//
// Todo lo que el simulador muestra sale de la base en vivo. No hay una sola constante de negocio
// hardcodeada acá: si cambia el flete de Urbano o el costo de un pack, el simulador cambia solo.

type CostoRow = { product_id: number; pack: number; unit_cost: number; is_estimated: boolean };
type CurvaRow = { producto: string; pack: number; ticket: number; n: number; tasa: number };

export default async function Precio() {
  const db = supabaseAdmin();
  const [productos, costos, ajustes, curvaUrbano, curvaFixy] = await Promise.all([
    db.from("products").select("id,name,active").order("id"),
    db.from("product_costs").select("product_id,pack,unit_cost,is_estimated"),
    db.from("settings").select("key,value").in("key", ["flete_prom_courier", "commission_pct", "cpa_referencia"]),
    db.rpc("curva_entrega_por_ticket", { p_courier: "urbano", p_desde: "2026-07-01", p_min_n: 40 }),
    db.rpc("curva_entrega_por_ticket", { p_courier: "fixy", p_desde: "2026-07-01", p_min_n: 40 }),
  ]);

  const set = (k: string) => (ajustes.data ?? []).find((s) => s.key === k)?.value as Record<string, number> | undefined;
  const fletes = set("flete_prom_courier") ?? { urbano: 10189, fixy: 9242 };
  const comisiones = set("commission_pct") ?? { urbano: 0.05547, fixy: 0.01 };
  const cpaRef = (set("cpa_referencia") ?? {}) as unknown as Record<string, { objetivo: number; maximo: number }>;

  // La curva que alimenta el ajuste automático de tasa: todos los (producto, pack) medidos, ordenados
  // por ticket. Se mezclan productos a propósito — lo que se está estimando es "a este ticket, en
  // este courier, cuánta gente abre la puerta", y con un producto solo no hay puntos suficientes.
  const aCurva = (rows: CurvaRow[] | null): PuntoCurva[] =>
    (rows ?? []).map((r) => ({ ticket: Number(r.ticket), tasa: Number(r.tasa), n: Number(r.n) }))
      .sort((a, b) => a.ticket - b.ticket);

  const datos: DatosSim = {
    productos: (productos.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    costos: (costos.data ?? []).map((c: CostoRow) => ({
      productId: c.product_id, pack: c.pack, costo: Number(c.unit_cost), estimado: c.is_estimated,
    })),
    fletes, comisiones, cpaRef,
    curvas: { urbano: aCurva(curvaUrbano.data), fixy: aCurva(curvaFixy.data) },
    detalle: {
      urbano: (curvaUrbano.data ?? []) as CurvaRow[],
      fixy: (curvaFixy.data ?? []) as CurvaRow[],
    },
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-xl font-bold tracking-tight">Simulador de precio</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Qué le pasa a la contribución cuando se mueve la lista, y cuánta conversión extra hace falta
          para pagar la baja. Todo por <strong>pedido puesto</strong>, no por entregado: en COD el flete
          se paga aunque el paquete vuelva.
        </p>
      </div>
      {datos.productos.length === 0 ? (
        <Card><CardContent className="py-8 text-sm text-muted-foreground">No hay productos cargados.</CardContent></Card>
      ) : (
        <SimuladorPrecio datos={datos} />
      )}
    </div>
  );
}
