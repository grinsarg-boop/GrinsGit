// Tabla de costos por producto·pack — costo TOTAL por pack en ARS (NO unitario), confirmada por
// Pancho (07/07). Constante COMPARTIDA por el pipeline (seed de product_costs) y el baseline:
// se valida el pipeline, no la constante. Un pedido con >1 pack suma el costo de cada pack
// (lo hace el SQL de recompute sumando order_items; el baseline lo replica).
// unit_cost en product_costs = costo total del pack (qty del ítem lo multiplica: 1 pack → ×1).
export const PRODUCT_COSTS: Record<string, Record<number, number>> = {
  Natures:   { 1: 2500, 2: 4500, 3: 7000, 4: 10000, 5: 12500 },   // "Goteros" (x4/x5 resueltos por Pancho)
  Pureza:    { 1: 2500, 2: 4500, 3: 7000, 4: 10000, 5: 12500 },   // "Goteros" (mismo costo que Natures; x5 por simetría)
  // Veinguard/BeeVenom NO existen como x1: el x1 es el x2 mal tipeado en Shopify (quantity=1 en vez de 2).
  // Se seedea x1 = costo de x2 (alias) → blinda prod: cualquier quantity=1 futura recibe el costo correcto.
  Veinguard: { 1: 3000, 2: 3000, 4: 6000 },   // x1 = alias de x2 (mal tipeado)
  BeeVenom:  { 1: 6000, 2: 6000, 3: 8500 },   // x1 = alias de x2 (mal tipeado)
  Altus:     { 1: 3000, 2: 5500, 3: 8000 },
};

// (product_name, pack) que tienen costo confirmado — para detectar packs vendidos sin costo.
export function hasCost(product: string, pack: number): boolean {
  return PRODUCT_COSTS[product]?.[pack] !== undefined;
}
