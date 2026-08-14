import { describe, expect, it } from "vitest";
import { escalaCinta } from "./cinta-cohortes";

describe("escalaCinta", () => {
  it("sin días en rojo no reserva nada abajo: el cero es el piso", () => {
    const e = escalaCinta([100, 250, 80], 112);
    expect(e.altoNeg).toBe(0);
    expect(e.altoPos).toBe(112);
  });

  it("con rojos parte la altura, con piso de 14px para que el rojo se vea", () => {
    const e = escalaCinta([1000, 800, -5], 112); // un rojo mínimo: proporcional daría <1px
    expect(e.altoNeg).toBe(14);
    expect(e.altoPos).toBe(98);
  });

  it("un día muy negativo no se come más de 34px", () => {
    const e = escalaCinta([10, -5000], 112);
    expect(e.altoNeg).toBe(34);
    expect(e.altoPos).toBe(78);
  });

  it("los dos lados suman siempre el alto total", () => {
    for (const vals of [[5, -5], [0, 0], [-1], [900, -300, 40]]) {
      const e = escalaCinta(vals, 112);
      expect(e.altoPos + e.altoNeg).toBe(112);
    }
  });
});
