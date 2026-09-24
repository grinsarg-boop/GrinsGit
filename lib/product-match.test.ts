import { describe, expect, it } from "vitest";
import { matchProduct, matchAllProducts, PRODUCTOS, unidadesLinea } from "./product-match";
import { letraProducto } from "./correo";

// R2 — único test JS del repo (SPEC §7). Mismas reglas que match_product en SQL.
describe("matchProduct", () => {
  it("matchea por keyword case-insensitive", () => {
    expect(matchProduct("Natures x2")).toBe("Natures");
    expect(matchProduct("NATURES - Video hook 1")).toBe("Natures");
    expect(matchProduct("Pureza pack 3")).toBe("Pureza");
    expect(matchProduct("VeinGuard crema")).toBe("Veinguard");
    expect(matchProduct("BeeVenom gel")).toBe("BeeVenom");
    expect(matchProduct("ALTUS 2u")).toBe("Altus");
    expect(matchProduct("Revival Oil Aceite Anticelulítico 240ml")).toBe("Revival Oil"); // solo ML/Flex
    expect(matchProduct("Aceite Reafirmante Anti-celulítico M3 | 2x1!")).toBe("M3"); // 027, distinto de Revival
  });
  it("M3 y Revival no colisionan, y 'celulitis' de Altus no matchea M3", () => {
    expect(matchProduct("ALTUS reducción de celulitis")).toBe("Altus"); // no cae en M3
    expect(matchProduct("2 Revival Oil Aceite Anticelulitico Masajes 240ml")).toBe("Revival Oil"); // no cae en M3
  });
  it("Arraigo se matchea por la marca, y un apellido Romero NO es una venta del sérum", () => {
    expect(matchProduct("ARRAIGO · Sérum Anticaída de Romero — Sin Minoxidil (3 Unidades)")).toBe("Arraigo");
    // matchAllProducts corre sobre el texto entero de la etiqueta ML, destinatario incluido.
    expect(matchAllProducts("Venta ID 20000 111 1 Unidad Gotero Pureza Drenaje Destinatario: Juan Romero")).toEqual(["Pureza"]);
  });

  // El código del depósito es <letra><unidades> y lo lee una persona: dos productos con la misma
  // letra es un pedido armado mal. Arraigo ya chocaba con Altus (los dos empiezan con A).
  it("ningún producto comparte la letra del código de depósito", () => {
    const porLetra = new Map<string, string[]>();
    for (const p of PRODUCTOS) {
      const l = letraProducto(p);
      porLetra.set(l, [...(porLetra.get(l) ?? []), p]);
    }
    const choques = [...porLetra.entries()].filter(([, ps]) => ps.length > 1);
    expect(choques, `letras repetidas: ${JSON.stringify(choques)} — agregá una excepción en LETRA (lib/correo.ts)`).toEqual([]);
  });

  it("sin match → null (queda en v_sin_clasificar, no se inventa atribución)", () => {
    expect(matchProduct("Producto misterioso")).toBeNull();
    expect(matchProduct("")).toBeNull();
  });

  // Títulos reales de la base (23/09/2026). El bot de Veltron carga el pack en 1 línea; el catálogo no.
  it("unidades: el pack del bot sale del título, el del catálogo de quantity", () => {
    expect(unidadesLinea("OFERTA PurezaDrops — Lleva 3", 1)).toBe(3);
    expect(unidadesLinea("OFERTA PurezaDrops — Lleva 2", 2)).toBe(4);
    expect(unidadesLinea("OFERTA Bee Venom Spray — 2x1", 1)).toBe(2);
    expect(unidadesLinea("VeinGuard Herbal Spray 2x1", 1)).toBe(2);
    expect(unidadesLinea("PurezaDrops Pack x3", 1)).toBe(3);
    expect(unidadesLinea("OFERTA ARRAIGO · Sérum Anticaída de Romero — Pack x2", 1)).toBe(2);
    expect(unidadesLinea("PurezaDrops™ | Drena Naturalmente la Hinchazón del Rostro, Abdomen y Piernas (LLEVA 3)", 3)).toBe(3);
    expect(unidadesLinea("Bee Venom Spray 2x1: Alivio inmediato para piel sensible con Psoriasis. (2x1!)", 2)).toBe(2);
    expect(unidadesLinea("Aceite Reafirmante Anti-celulítico MN | 2x1!", 2)).toBe(2);
    expect(unidadesLinea("2x1 Nubba / Adios Vello Corporal", 2)).toBe(2);
    expect(unidadesLinea("ARRAIGO · Sérum Anticaída de Romero — Sin Minoxidil", 1)).toBe(1);
  });
});
