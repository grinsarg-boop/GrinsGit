import { describe, expect, it } from "vitest";
import { breakEven } from "./breakeven";

describe("breakEven", () => {
  // Ancla del Playbook-Faris §8: julio cerró con tasa de contribución 0,4914 → break-even MER 2,03.
  // Si alguien cambia la fórmula, este número se rompe.
  it("reproduce el break-even MER de julio (2,03) desde la tasa de contribución", () => {
    const be = breakEven([{ generadas: 1000, revenueEst: 10_000_000, ads: 2_000_000, profitEst: 2_914_000 }]);
    expect(be.tasa).toBeCloseTo(0.4914, 4);
    expect(be.mer).toBeCloseTo(2.035, 2);
    expect(be.cpa).toBeCloseTo(4914, 0); // contribución 4.914.000 ÷ 1.000 órdenes
  });

  it("suma las filas antes de dividir, no promedia ratios", () => {
    const be = breakEven([
      { generadas: 10, revenueEst: 1000, ads: 100, profitEst: 400 },
      { generadas: 90, revenueEst: 9000, ads: 900, profitEst: 3600 },
    ]);
    expect(be.contribucion).toBe(5000);
    expect(be.cpa).toBe(50); // 5000 / 100, no el promedio de 50 y 50 por casualidad
    expect(be.mer).toBeCloseTo(2, 6);
  });

  it("sin contribución positiva no hay break-even que alcance", () => {
    const be = breakEven([{ generadas: 10, revenueEst: 1000, ads: 100, profitEst: -200 }]);
    expect(be.contribucion).toBe(-100);
    expect(be.mer).toBeNaN();
    expect(be.cpa).toBeNaN();
  });

  it("sin datos no explota", () => {
    const be = breakEven([]);
    expect(be.tasa).toBe(0);
    expect(be.mer).toBeNaN();
    expect(be.cpa).toBeNaN();
  });
});
