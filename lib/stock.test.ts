import { describe, expect, it } from "vitest";
import { costosCombos, egresosSinEspejo, parseCompra, valorInventario, type Combo, type ComboPack, type Material, type Producto, type Receta } from "./stock";

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

describe("parseCompra", () => {
  // mat() usa el id como nombre, alcanza para el parser
  const M = [mat("Frasco 250ml", 100), mat("Frasco 30ml", 60), mat("Aloe Vera", 116), mat("Bolsas chicas (25x30)", 80)];
  it("caso del bot: cantidad suelta + insumo único; 1m (plata) y 250ml (envase) no cuentan", () => {
    const r = parseCompra("Egreso 1m galicia fran por compra de 100 frascos 250ml revival oil", M)!;
    expect(r.material.nombre).toBe("Frasco 250ml");
    expect(r.cantidad).toBe(100);
  });
  it("acentos y mayúsculas no molestan", () => {
    expect(parseCompra("500 de áloe verá", M)!.material.nombre).toBe("Aloe Vera");
  });
  it("ambiguo (matchea 2 insumos o 2 números sueltos) → null, va al panel", () => {
    expect(parseCompra("compra frascos", M)).toBeNull(); // 250ml y 30ml matchean los dos
    expect(parseCompra("100 aloe vera y 50 mas", M)).toBeNull(); // dos cantidades
    expect(parseCompra("aloe vera sin cantidad", M)).toBeNull();
  });
});

describe("egresosSinEspejo", () => {
  const egreso = (id: number, fecha: string, monto: number) =>
    ({ id, fecha, monto, descripcion: null, autor: null });
  it("matchea por monto ±1 y fecha ±3 días, y cada compra espeja UN egreso", () => {
    const egresos = [egreso(1, "2026-07-22", 200000), egreso(2, "2026-07-23", 200000), egreso(3, "2026-07-22", 99000)];
    const compras = [{ precio_total: 200000.5, created_at: "2026-07-22T14:00:00Z" }];
    // la compra espeja al egreso 1; el 2 (mismo monto) y el 3 quedan pendientes
    expect(egresosSinEspejo(egresos, compras).map((e) => e.id)).toEqual([2, 3]);
  });
  it("fuera de la ventana de 3 días no espeja", () => {
    const r = egresosSinEspejo([egreso(1, "2026-07-10", 5000)], [{ precio_total: 5000, created_at: "2026-07-22T00:00:00Z" }]);
    expect(r.map((e) => e.id)).toEqual([1]);
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
