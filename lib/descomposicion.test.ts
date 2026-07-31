import { describe, expect, it } from "vitest";
import { descomponer, type Periodo } from "./descomposicion";

const suma = (d: NonNullable<ReturnType<typeof descomponer>>) => d.factores.reduce((s, f) => s + f.efecto, 0);

describe("descomponer", () => {
  it("los cuatro factores suman el cambio exacto", () => {
    const antes: Periodo = { guias: 1000, entregas: 450, revenue: 22_500_000, profit: 3_200_000 };
    const hoy: Periodo = { guias: 1180, entregas: 507, revenue: 25_552_800, profit: 3_900_000 };
    const d = descomponer(hoy, antes)!;
    expect(d.total).toBe(700_000);
    expect(suma(d)).toBeCloseTo(d.total, 6);
  });

  it("caza el caso Runway: profit plano con más volumen y peor entrega", () => {
    // mismo profit, 20% más de guías, tasa de 45% a 37,5%: los dos efectos se cancelan
    const antes: Periodo = { guias: 1000, entregas: 450, revenue: 22_500_000, profit: 3_000_000 };
    const hoy: Periodo = { guias: 1200, entregas: 450, revenue: 22_500_000, profit: 3_000_000 };
    const d = descomponer(hoy, antes)!;
    expect(d.total).toBe(0);
    const vol = d.factores.find((f) => f.clave === "volumen")!;
    const ent = d.factores.find((f) => f.clave === "entrega")!;
    expect(vol.efecto).toBeCloseTo(600_000, 6);   // +200 guías a la economía vieja
    expect(ent.efecto).toBeCloseTo(-600_000, 6);  // que la caída de entrega se come entera
    expect(ent.delta).toBeCloseTo(0.375 - 0.45, 10);
  });

  it("aísla el margen cuando lo único que cambia es el costo", () => {
    const antes: Periodo = { guias: 500, entregas: 200, revenue: 10_000_000, profit: 2_000_000 };
    const hoy: Periodo = { guias: 500, entregas: 200, revenue: 10_000_000, profit: 1_500_000 };
    const d = descomponer(hoy, antes)!;
    expect(d.factores.filter((f) => f.clave !== "margen").every((f) => f.efecto === 0)).toBe(true);
    expect(d.factores.find((f) => f.clave === "margen")!.efecto).toBeCloseTo(-500_000, 6);
  });

  it("sin base no inventa un reparto", () => {
    const ok: Periodo = { guias: 10, entregas: 5, revenue: 100, profit: 10 };
    expect(descomponer(ok, { guias: 0, entregas: 0, revenue: 0, profit: 0 })).toBeNull();
    expect(descomponer({ ...ok, entregas: 0 }, ok)).toBeNull();
    expect(descomponer({ ...ok, revenue: 0 }, ok)).toBeNull();
  });

  it("funciona con profit negativo a los dos lados", () => {
    const antes: Periodo = { guias: 300, entregas: 100, revenue: 5_000_000, profit: -800_000 };
    const hoy: Periodo = { guias: 420, entregas: 160, revenue: 8_000_000, profit: -200_000 };
    const d = descomponer(hoy, antes)!;
    expect(suma(d)).toBeCloseTo(600_000, 6);
  });
});
