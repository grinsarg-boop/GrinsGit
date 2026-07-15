import { describe, it, expect } from "vitest";
import { _parsePage } from "./label-picking";

describe("_parsePage", () => {
  it("Fixy: detecta courier, remito y contrareembolso", () => {
    const t = "1720297 BIOLABS DESTINATARIO Andres Contrareembolso: $ 49980 BULTOS 1/1 Remito: 16934 www.fixy.com.ar";
    expect(_parsePage(t, 1)).toEqual({ page: 1, courier: "fixy", orden: "16934", price: 49980 });
  });
  it("Correo: N° de orden como #NNNNN + precio con puntos", () => {
    const r = _parsePage("CORREO ARGENTINO DESTINATARIO #16778 Juan Perez $ 39.990", 2);
    expect(r.courier).toBe("correo");
    expect(r.orden).toBe("16778");
    expect(r.price).toBe(39990);
  });
  it("etiqueta sin N° de orden legible → orden null (se marca para revisar)", () => {
    expect(_parsePage("etiqueta rara sin datos utiles", 3).orden).toBeNull();
  });
});
