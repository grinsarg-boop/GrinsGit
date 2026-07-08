import { describe, expect, it } from "vitest";
import { matchProduct } from "./product-match";

// R2 — único test JS del repo (SPEC §7). Mismas reglas que match_product en SQL.
describe("matchProduct", () => {
  it("matchea por keyword case-insensitive", () => {
    expect(matchProduct("Natures x2")).toBe("Natures");
    expect(matchProduct("NATURES - Video hook 1")).toBe("Natures");
    expect(matchProduct("Pureza pack 3")).toBe("Pureza");
    expect(matchProduct("VeinGuard crema")).toBe("Veinguard");
    expect(matchProduct("BeeVenom gel")).toBe("BeeVenom");
    expect(matchProduct("ALTUS 2u")).toBe("Altus");
  });
  it("sin match → null (queda en v_sin_clasificar, no se inventa atribución)", () => {
    expect(matchProduct("Producto misterioso")).toBeNull();
    expect(matchProduct("")).toBeNull();
  });
});
