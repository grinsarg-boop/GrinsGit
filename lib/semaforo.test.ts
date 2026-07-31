import { describe, expect, it } from "vitest";
import { nivel, percentil } from "./semaforo";

describe("percentil", () => {
  it("interpola linealmente (R type 7)", () => {
    const xs = [1, 2, 3, 4, 5];
    expect(percentil(xs, 0.25)).toBe(2);
    expect(percentil(xs, 0.5)).toBe(3);
    expect(percentil(xs, 0.75)).toBe(4);
    // 6 puntos: el cuartil cae entre dos y se interpola
    expect(percentil([0, 10, 20, 30, 40, 50], 0.25)).toBeCloseTo(12.5, 6);
  });

  it("no ordena por referencia ni se cree una muestra chica", () => {
    const xs = [5, 1, 3];
    expect(percentil(xs, 0.5)).toBeNaN();     // 3 < minN
    expect(xs).toEqual([5, 1, 3]);            // el sort no debe pisar el array del caller
    expect(percentil([5, 1, 3], 0.5, 3)).toBe(3);
    expect(percentil([1, 2, NaN, 4, 5, 6], 0.5, 5)).toBe(4);   // descarta el NaN: quedan 5, mediana 4
  });
});

describe("nivel", () => {
  it("ROAS contra break-even y p75 (mejorar es subir)", () => {
    const cortes: [number, number] = [2.03, 3.1];   // break-even MER de julio + p75 de 90 días
    expect(nivel(1.8, cortes)).toBe("mal");
    expect(nivel(2.03, cortes)).toBe("medio");      // justo en break-even ya no es rojo
    expect(nivel(2.9, cortes)).toBe("medio");
    expect(nivel(3.1, cortes)).toBe("ok");
  });

  it("CPA contra break-even y p25 (mejorar es bajar)", () => {
    const cortes: [number, number] = [14276, 9000]; // break-even CPA de julio + p25 de 90 días
    expect(nivel(16000, cortes, "baja")).toBe("mal");
    expect(nivel(12000, cortes, "baja")).toBe("medio");
    expect(nivel(8000, cortes, "baja")).toBe("ok");
  });

  it("sin umbral medido no pinta nada", () => {
    expect(nivel(1, [NaN, 2])).toBeNull();
    expect(nivel(NaN, [1, 2])).toBeNull();
  });

  it("si el cuartil bueno ya está bajo el break-even, no hay banda ámbar", () => {
    // negocio entero bajo el break-even: p75 (2,0) peor que el break-even (2,5)
    const cortes: [number, number] = [2.5, 2.0];
    expect(nivel(2.2, cortes)).toBe("mal");
    expect(nivel(2.6, cortes)).toBe("ok");
  });
});
