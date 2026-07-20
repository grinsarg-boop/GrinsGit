import { describe, expect, it } from "vitest";
import { mediaMovil } from "./tendencias";

describe("mediaMovil", () => {
  it("trailing de ventana 3: null hasta tener ventana completa", () => {
    expect(mediaMovil([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });
  it("ventana 1 = la serie misma", () => {
    expect(mediaMovil([7, -2], 1)).toEqual([7, -2]);
  });
  it("serie más corta que la ventana → todo null", () => {
    expect(mediaMovil([1, 2], 7)).toEqual([null, null]);
  });
});
