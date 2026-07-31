import { describe, expect, it } from "vitest";
import { enRango, marcas, type Evento } from "./eventos";

const ev = (fecha: string, fecha_fin: string | null, texto = "x"): Evento => ({ id: 1, fecha, fecha_fin, texto });

describe("enRango", () => {
  const x3 = ev("2026-05-01", "2026-07-22");
  it("avisa aunque la franja haya empezado antes del rango", () => {
    expect(enRango([x3], "2026-07-01", "2026-07-30")).toHaveLength(1);
    expect(enRango([x3], "2026-07-23", "2026-07-30")).toHaveLength(0); // ya pasó
    expect(enRango([x3], "2026-04-01", "2026-04-20")).toHaveLength(0); // todavía no
  });
  it("un evento puntual solo entra si cae adentro", () => {
    const shopify = ev("2026-07-30", null);
    expect(enRango([shopify], "2026-07-01", "2026-07-30")).toHaveLength(1);
    expect(enRango([shopify], "2026-07-01", "2026-07-29")).toHaveLength(0);
  });
});

describe("marcas", () => {
  const fechas = ["2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"];

  it("ubica un evento puntual en su punto", () => {
    const [m] = marcas(fechas, [ev("2026-07-03", null)]);
    expect([m.i, m.iFin]).toEqual([2, 2]);
  });

  it("recorta la franja a los bordes de la serie", () => {
    const [m] = marcas(fechas, [ev("2026-05-01", "2026-07-03")]);
    expect([m.i, m.iFin]).toEqual([0, 2]);       // empieza antes: se dibuja desde el borde
    const [m2] = marcas(fechas, [ev("2026-07-04", "2026-12-31")]);
    expect([m2.i, m2.iFin]).toEqual([3, 4]);
  });

  it("descarta lo que no toca la serie, y tolera fechas sin punto exacto", () => {
    expect(marcas(fechas, [ev("2026-06-01", null)])).toHaveLength(0);
    expect(marcas(fechas, [ev("2026-08-01", null)])).toHaveLength(0);
    expect(marcas([], [ev("2026-07-03", null)])).toHaveLength(0);
    // serie con hueco: el 03 no existe, la marca cae en el primer punto posterior y nunca se invierte
    const [m] = marcas(["2026-07-01", "2026-07-02", "2026-07-04"], [ev("2026-07-03", null)]);
    expect([m.i, m.iFin]).toEqual([2, 2]);
  });
});
