import { describe, expect, it } from "vitest";
import { matchProduct, matchAllProducts, PRODUCTOS } from "./product-match";
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
});
