// Lee EN VIVO el Supabase de la app Stock Cosmética (inventario de producción: insumos, recetas,
// combos). Es una TERCERA instancia (ni la del panel ni la de Cashflow). Su RLS es solo para
// usuarios logueados, así que el panel entra con la service_role key — server-side only, la key
// jamás puede llegar al browser.
export const STOCK_BASE = "https://fxltytovnfpgnwefoovx.supabase.co/rest/v1";

export type Material = {
  id: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stock: number;
  stock_minimo: number;
  costo_unitario: number | null;
};
export type Producto = { id: string; nombre: string; stock: number; precio_venta: number | null };
export type Receta = { producto_id: string; material_id: string; cantidad: number };
export type Combo = {
  id: string;
  nombre: string;
  producto_id: string;
  cantidad_producto: number;
  precio: number | null;
};
export type ComboPack = { combo_id: string; material_id: string; cantidad: number };

export function stockHeaders() {
  const key = process.env.STOCK_SERVICE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}` };
}

export async function fetchStock() {
  const H = stockHeaders();
  const j = (p: string) =>
    fetch(`${STOCK_BASE}/${p}`, { headers: H, next: { revalidate: 60 } }).then((r) => {
      if (!r.ok) throw new Error(`stock ${p.split("?")[0]}: HTTP ${r.status}`);
      return r.json();
    });
  const [materiales, productos, recetas, combos, packs] = await Promise.all([
    j("materiales?select=id,nombre,categoria,unidad,stock,stock_minimo,costo_unitario&order=nombre.asc"),
    j("productos?select=id,nombre,stock,precio_venta&order=nombre.asc"),
    j("recetas?select=producto_id,material_id,cantidad"),
    j("combos?select=id,nombre,producto_id,cantidad_producto,precio&order=nombre.asc"),
    j("combo_packaging?select=combo_id,material_id,cantidad"),
  ]);
  return { materiales, productos, recetas, combos, packs } as {
    materiales: Material[];
    productos: Producto[];
    recetas: Receta[];
    combos: Combo[];
    packs: ComboPack[];
  };
}

// Costo de fabricar UNA unidad del producto según su receta. Un insumo sin costo cargado suma 0
// y queda listado en `sinCosto` — el costo mostrado es un piso, no la verdad, hasta cargarlo.
export function costoReceta(
  productoId: string,
  recetas: Receta[],
  materiales: Map<string, Material>,
): { costo: number; sinCosto: string[] } {
  let costo = 0;
  const sinCosto: string[] = [];
  for (const r of recetas) {
    if (r.producto_id !== productoId) continue;
    const m = materiales.get(r.material_id);
    if (!m) continue;
    if (m.costo_unitario == null) sinCosto.push(m.nombre);
    else costo += Number(r.cantidad) * Number(m.costo_unitario);
  }
  return { costo, sinCosto };
}

export type CostoCombo = {
  combo: Combo;
  contenido: number;
  packaging: number;
  total: number;
  sinCosto: string[]; // insumos involucrados sin costo cargado (el total es un piso)
};

// Costo real por combo: receta × cantidad + packaging propio. Es el número que debería alimentar
// product_costs del panel (COGS CON envase — cierra el agujero del packaging de /caja).
export function costosCombos(
  combos: Combo[],
  recetas: Receta[],
  packs: ComboPack[],
  materiales: Material[],
): CostoCombo[] {
  const mat = new Map(materiales.map((m) => [m.id, m]));
  return combos.map((combo) => {
    const rec = costoReceta(combo.producto_id, recetas, mat);
    const contenido = rec.costo * Number(combo.cantidad_producto);
    let packaging = 0;
    const sinCosto = [...rec.sinCosto];
    for (const p of packs) {
      if (p.combo_id !== combo.id) continue;
      const m = mat.get(p.material_id);
      if (!m) continue;
      if (m.costo_unitario == null) sinCosto.push(m.nombre);
      else packaging += Number(p.cantidad) * Number(m.costo_unitario);
    }
    return { combo, contenido, packaging, total: contenido + packaging, sinCosto: [...new Set(sinCosto)] };
  });
}

export type Inventario = {
  insumos: number; // Σ stock × costo de insumos
  terminados: number; // Σ stock de terminados valorizados por su receta
  total: number;
  sinCosto: string[]; // insumos con stock > 0 y sin costo (el total es un piso)
};

// Valor del inventario inmovilizado: la tercera pata de la foto de la plata en /caja
// (caja + a cobrar + stock).
export function valorInventario(
  materiales: Material[],
  productos: Producto[],
  recetas: Receta[],
): Inventario {
  const mat = new Map(materiales.map((m) => [m.id, m]));
  let insumos = 0;
  const sinCosto: string[] = [];
  for (const m of materiales) {
    if (m.costo_unitario == null) {
      if (Number(m.stock) > 0) sinCosto.push(m.nombre);
      continue;
    }
    insumos += Number(m.stock) * Number(m.costo_unitario);
  }
  let terminados = 0;
  for (const p of productos) {
    if (Number(p.stock) <= 0) continue;
    const rec = costoReceta(p.id, recetas, mat);
    terminados += Number(p.stock) * rec.costo;
    for (const n of rec.sinCosto) sinCosto.push(n);
  }
  return { insumos, terminados, total: insumos + terminados, sinCosto: [...new Set(sinCosto)] };
}

// Para /caja: el valor total del inventario, o null si Stock no está configurado o no responde
// (la página de caja no se rompe por Stock).
export async function inventarioSafe(): Promise<number | null> {
  if (!process.env.STOCK_SERVICE_KEY) return null;
  try {
    const s = await fetchStock();
    return valorInventario(s.materiales, s.productos, s.recetas).total;
  } catch {
    return null;
  }
}
