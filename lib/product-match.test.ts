import { describe, expect, it } from "vitest";
import { matchPack, matchProduct } from "./product-match";

// R2 — único test JS del repo (SPEC §7). Mismas reglas que match_product/match_pack en SQL.
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

describe("matchPack", () => {
  it('regex "x N"', () => {
    expect(matchPack("Natures x2")).toBe(2);
    expect(matchPack("Natures X 3")).toBe(3);
  });
  it('regex "N unidades/frascos/pack/u"', () => {
    expect(matchPack("Pureza 2 unidades")).toBe(2);
    expect(matchPack("Pureza 3 frascos")).toBe(3);
    expect(matchPack("Altus 2u")).toBe(2);
    expect(matchPack("Veinguard 2 pack")).toBe(2);
  });
  it("default 1", () => {
    expect(matchPack("Natures")).toBe(1);
    expect(matchPack("BeeVenom gel grande")).toBe(1);
  });
});
