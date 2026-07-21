import { describe, expect, it } from "vitest";
import { costosCombos, valorInventario, type Combo, type ComboPack, type Material, type Producto, type Receta } from "./stock";

const mat = (id: string, costo: number | null, stock = 0): Material =>
  ({ id, nombre: id, categoria: "otro", unidad: "unidad", stock, stock_minimo: 0, costo_unitario: costo });

const FRASCO = mat("frasco", 500, 100);
const ACEITE = mat("aceite", 10, 1000); // $10 el gramo
const ETIQUETA = mat("etiqueta", null, 50); // sin costo cargado
const CAJA = mat("caja", 200, 30);

const RECETAS: Receta[] = [
  { producto_id: "drenaje", material_id: "frasco", cantidad: 1 },
  { producto_id: "drenaje", material_id: "aceite", cantidad: 30 },
  { producto_id: "drenaje", material_id: "etiqueta", cantidad: 1 },
];
const COMBOS: Combo[] = [{ id: "c2", nombre: "Drenaje x2", producto_id: "drenaje", cantidad_producto: 2, precio: 49990 }];
const PACKS: ComboPack[] = [{ combo_id: "c2", material_id: "caja", cantidad: 1 }];

describe("costosCombos", () => {
  it("receta × cantidad + packaging, y lista los insumos sin costo", () => {
    const [c] = costosCombos(COMBOS, RECETAS, PACKS, [FRASCO, ACEITE, ETIQUETA, CAJA]);
    expect(c.contenido).toBe((500 + 300) * 2); // frasco + 30g aceite, etiqueta suma 0
    expect(c.packaging).toBe(200);
    expect(c.total).toBe(1800);
    expect(c.sinCosto).toEqual(["etiqueta"]);
  });
});

describe("valorInventario", () => {
  it("insumos a costo + terminados valorizados por receta", () => {
    const productos: Producto[] = [{ id: "drenaje", nombre: "Drenaje", stock: 5, precio_venta: null }];
    const v = valorInventario([FRASCO, ACEITE, ETIQUETA, CAJA], productos, RECETAS);
    expect(v.insumos).toBe(100 * 500 + 1000 * 10 + 30 * 200); // etiqueta sin costo no suma
    expect(v.terminados).toBe(5 * 800);
    expect(v.total).toBe(v.insumos + v.terminados);
    expect(v.sinCosto).toEqual(["etiqueta"]);
  });
});
