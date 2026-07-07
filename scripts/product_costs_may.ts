// Tabla de costos por producto·pack — costo TOTAL por pack en ARS (NO unitario), confirmada por
// Pancho (07/07). Constante COMPARTIDA por el pipeline (seed de product_costs) y el baseline:
// se valida el pipeline, no la constante. Un pedido con >1 pack suma el costo de cada pack
// (lo hace el SQL de recompute sumando order_items; el baseline lo replica).
// unit_cost en product_costs = costo total del pack (qty del ítem lo multiplica: 1 pack → ×1).
export const PRODUCT_COSTS: Record<string, Record<number, number>> = {
  Natures:   { 1: 2500, 2: 4500, 3: 7000 },   // "Goteros"
  Pureza:    { 1: 2500, 2: 4500, 3: 7000 },   // "Goteros" (mismo costo que Natures)
  Veinguard: { 2: 3000, 4: 6000 },
  BeeVenom:  { 2: 6000, 3: 8500 },
  Altus:     { 1: 3000, 2: 5500, 3: 8000 },
};

// (product_name, pack) que tienen costo confirmado — para detectar packs vendidos sin costo.
export function hasCost(product: string, pack: number): boolean {
  return PRODUCT_COSTS[product]?.[pack] !== undefined;
}
