import { describe, expect, it } from "vitest";
import { comparar, simular, tasaPorTicket, type PuntoCurva } from "./precio-sim";

// Parámetros reales de Arraigo en Urbano al 12/09/2026: costo de product_costs, flete de
// settings.flete_prom_courier, comisión de settings.commission_pct.
const URBANO = { flete: 10189, comision: 0.05547 };
const X1 = { ...URBANO, costo: 4717 };
const X2 = { ...URBANO, costo: 9434 };
const X3 = { ...URBANO, costo: 17851 };

describe("simular", () => {
  it("reproduce la contribución del x1 de Arraigo a $49.900 con 56% de entrega", () => {
    const r = simular({ precio: 49900, tasa: 0.56, ...X1 });
    expect(r.cobrado).toBeCloseTo(27944, 0);
    expect(r.contribucion).toBeCloseTo(13563, 0);
  });

  it("reproduce el x3 a $89.990 con 65% de entrega", () => {
    const r = simular({ precio: 89990, tasa: 0.65, ...X3 });
    expect(r.contribucion).toBeCloseTo(33456.7, 1);
  });

  // El corazón del modelo. Si alguien "simplifica" metiendo el flete adentro del × tasa, este test
  // se rompe: con flete × t el x1 daría ~$19.269 y parecería rentable contra el CPA de $14.635.
  it("cobra el flete completo aunque el paquete vuelva", () => {
    const r = simular({ precio: 49900, tasa: 0.5, ...X1 });
    expect(r.fletePagado).toBe(10189); // no 10189 × 0,5
  });

  it("la merma del devuelto descuenta costo extra sobre los que no se entregan", () => {
    const sin = simular({ precio: 49900, tasa: 0.5, ...X1 });
    const con = simular({ precio: 49900, tasa: 0.5, ...X1, mermaDevuelto: 1 });
    // Con merma total, el costo se paga sobre el 100% de los puestos, no sobre el 50% entregado.
    expect(con.costoProducto).toBeCloseTo(4717, 0);
    expect(sin.costoProducto).toBeCloseTo(2358.5, 0);
  });
});

describe("comparar", () => {
  // El número que decide el punto 4: bajar el x3 de $89.990 a $79.990 pide +22% de conversión.
  it("el x3 a $79.990 necesita ~1,22x la conversión para empatar", () => {
    const c = comparar(
      { precio: 89990, tasa: 0.65, ...X3 },
      { precio: 79990, tasa: 0.65, ...X3 },
    );
    expect(c.deltaPrecioPct).toBeCloseTo(-0.1111, 3);
    expect(c.factorConversion).toBeCloseTo(1.225, 2);
    expect(c.elasticidadRequerida).toBeCloseTo(2.02, 1); // alcanzable, pero al filo
  });

  // El x1 baja de precio Y baja de tasa: los dos efectos se suman en contra.
  it("bajar el x1 a $39.900 pide más del doble de conversión", () => {
    const c = comparar(
      { precio: 49900, tasa: 0.56, ...X1 },
      { precio: 39900, tasa: 0.513, ...X1 }, // la tasa cae con el ticket, no queda fija
    );
    expect(c.factorConversion).toBeGreaterThan(2);
    expect(c.elasticidadRequerida).toBeGreaterThan(5); // fantasía: ninguna baja compra esto
  });

  it("contribución nueva ≤ 0 devuelve Infinity, no un número grande", () => {
    const c = comparar(
      { precio: 49900, tasa: 0.56, ...X1 },
      { precio: 20000, tasa: 0.5, ...X1 },
    );
    expect(c.nuevo.contribucion).toBeLessThan(0);
    expect(c.factorConversion).toBe(Infinity);
    expect(c.elasticidadRequerida).toBeNaN();
  });

  it("subir el precio da factor < 1: se puede resignar conversión", () => {
    const c = comparar(
      { precio: 69900, tasa: 0.65, ...X2 },
      { precio: 79900, tasa: 0.65, ...X2 },
    );
    expect(c.factorConversion).toBeLessThan(1);
    expect(c.deltaContribucion).toBeGreaterThan(0);
  });
});

describe("tasaPorTicket", () => {
  // Curva de Pureza en Urbano, jul-sep 2026 (n = 240 / 2.327 / 526).
  const curva: PuntoCurva[] = [
    { ticket: 39973, tasa: 0.513, n: 240 },
    { ticket: 50031, tasa: 0.566, n: 2327 },
    { ticket: 59989, tasa: 0.652, n: 526 },
  ];

  it("interpola entre puntos medidos", () => {
    expect(tasaPorTicket(curva, 45000)).toBeGreaterThan(0.513);
    expect(tasaPorTicket(curva, 45000)).toBeLessThan(0.566);
  });

  it("clava el valor medido en los nodos", () => {
    expect(tasaPorTicket(curva, 50031)).toBeCloseTo(0.566, 3);
  });

  // Extrapolar la pendiente daría 80% a $120.000 — una tasa que nadie observó nunca.
  it("extrapola plano fuera del rango medido", () => {
    expect(tasaPorTicket(curva, 120000)).toBeCloseTo(0.652, 3);
    expect(tasaPorTicket(curva, 10000)).toBeCloseTo(0.513, 3);
  });

  it("la tasa sube con el ticket, no baja", () => {
    expect(tasaPorTicket(curva, 59989)).toBeGreaterThan(tasaPorTicket(curva, 39973));
  });
});
