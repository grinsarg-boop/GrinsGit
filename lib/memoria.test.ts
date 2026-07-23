import { describe, expect, it } from "vitest";
import { sinDatosPersonales } from "./memoria";

describe("sinDatosPersonales", () => {
  it("saca el bloque personal y conserva el negocio", () => {
    const txt =
      "QUIÉN ES PANCHO: Fran Andreu, novia Sere, de viaje en Brasil.\n\nNEGOCIO PRINCIPAL — BIOLABS: COD.\n\nPRODUCTOS: Bee Venom x2.";
    const out = sinDatosPersonales(txt);
    expect(out.startsWith("NEGOCIO PRINCIPAL")).toBe(true);
    for (const k of ["Sere", "novia", "Brasil", "Andreu"]) expect(out).not.toContain(k);
    expect(out).toContain("BIOLABS");
    expect(out).toContain("PRODUCTOS");
  });

  it("sin el bloque, no toca nada", () => {
    expect(sinDatosPersonales("NEGOCIO: x")).toBe("NEGOCIO: x");
  });
});
