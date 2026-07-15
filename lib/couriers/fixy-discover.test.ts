import { describe, it, expect } from "vitest";
import { fixyFreight } from "./fixy-discover";

const cp = { "1425": 5198, "1655": 7420 };
const prov = { "BUENOS AIRES": 8753 };
const def = 8663;

describe("fixyFreight", () => {
  it("matchea por CP normalizado a 4 dígitos (saca letras y ceros a la izquierda)", () => {
    expect(fixyFreight({ zip: "1425" }, cp, prov, def)).toBe(5198);
    expect(fixyFreight({ zip: "B1655", province: "Buenos Aires" }, cp, prov, def)).toBe(7420);
    expect(fixyFreight({ zip: "01425" }, cp, prov, def)).toBe(5198);
  });
  it("cae a provincia (uppercase) si el CP no está en el mapa", () => {
    expect(fixyFreight({ zip: "9999", province: "Buenos Aires" }, cp, prov, def)).toBe(8753);
  });
  it("cae al default si no matchea CP ni provincia", () => {
    expect(fixyFreight({ zip: "9999", province: "Córdoba" }, cp, prov, def)).toBe(8663);
    expect(fixyFreight({}, cp, prov, def)).toBe(8663);
  });
});
