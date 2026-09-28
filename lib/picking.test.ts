import { expect, it } from "vitest";
import { codigoDeposito, type PickingOrder } from "./picking";

const o = (items: PickingOrder["items"], total = 0): PickingOrder => ({ orden: "1", encontrado: true, courier: "urbano", total, items });

it("código de depósito por el camino de preparar", () => {
  expect(codigoDeposito(o([{ producto: "Arraigo", unidades: 1 }], 89900)).code).toBe("S3");          // el precio manda
  expect(codigoDeposito(o([{ producto: "Pureza", unidades: 3 }, { producto: null, unidades: 1 }])).code).toBe("P4"); // suma todas las líneas
  expect(codigoDeposito(o([{ producto: "Pureza", unidades: 1 }, { producto: "BeeVenom", unidades: 1 }])).code).toBeNull();
  expect(codigoDeposito({ ...o([]), error: true }).nota).toMatch(/reintentá/);
  expect(codigoDeposito(undefined).code).toBeNull();
});
