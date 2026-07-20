import { describe, expect, it } from "vitest";
import { balance5050, porMes, saldos, type Caja, type Cat, type Mov } from "./cashflow";

const CATS: Cat[] = [
  { id: 1, nombre: "Sueldos" },
  { id: 2, nombre: "Proveedor" },
  { id: 3, nombre: "Ajustes" },
  { id: 4, nombre: "Personal socios" },
];

const mov = (o: Partial<Mov>): Mov => ({
  tipo: "egreso", monto: 0, caja_id: 1, caja_destino_id: null,
  categoria_id: null, fecha: "2026-07-10", autor: null, es_retiro: false, ...o,
});

describe("porMes", () => {
  it("separa estructura, ya-modelado, ajustes, socios y retiros", () => {
    const movs: Mov[] = [
      mov({ tipo: "ingreso", monto: 1000 }),
      mov({ monto: 100, categoria_id: 1 }), // Sueldos → estructura
      mov({ monto: 200, categoria_id: 2 }), // Proveedor → ya modelado, NO estructura
      mov({ monto: 50, categoria_id: 3 }), // Ajustes
      mov({ monto: 30, categoria_id: 4 }), // Personal socios
      mov({ monto: 70 }), // sin categoría → estructura (conservador)
      mov({ monto: 500, es_retiro: true, autor: "Fran" }), // retiro, no es gasto
      mov({ tipo: "transferencia", monto: 999, caja_destino_id: 2 }), // ni ingreso ni gasto
      mov({ monto: 123, fecha: "2026-02-01" }), // anterior a DESDE → afuera
    ];
    const [m] = porMes(movs, CATS);
    expect(m.mes).toBe("2026-07");
    expect(m.ingresos).toBe(1000);
    expect(m.estructura).toBe(170); // Sueldos 100 + sin categoría 70
    expect(m.sinCategoria).toBe(70);
    expect(m.yaModelado).toBe(200);
    expect(m.ajustes).toBe(50);
    expect(m.personalSocios).toBe(30);
    expect(m.retiros).toBe(500);
  });

  it("ordena meses descendente", () => {
    const movs = [mov({ monto: 1, fecha: "2026-06-05" }), mov({ monto: 1, fecha: "2026-07-05" })];
    expect(porMes(movs, CATS).map((m) => m.mes)).toEqual(["2026-07", "2026-06"]);
  });
});

describe("saldos", () => {
  it("transferencia resta en origen y suma en destino", () => {
    const cajas: Caja[] = [{ id: 1, nombre: "Cash", moneda: "ARS" }, { id: 2, nombre: "MP", moneda: "ARS" }];
    const movs: Mov[] = [
      mov({ tipo: "ingreso", monto: 1000, caja_id: 1 }),
      mov({ tipo: "egreso", monto: 300, caja_id: 1 }),
      mov({ tipo: "transferencia", monto: 200, caja_id: 1, caja_destino_id: 2 }),
    ];
    expect(saldos(movs, cajas).map((s) => s.saldo)).toEqual([500, 200]);
  });
});

describe("balance5050", () => {
  it("el que retiró menos queda a favor", () => {
    const movs: Mov[] = [
      mov({ monto: 800, es_retiro: true, autor: "Fran" }),
      mov({ monto: 500, es_retiro: true, autor: "Santi" }),
      mov({ monto: 100 }), // gasto común: no cuenta
    ];
    expect(balance5050(movs)).toEqual({ fran: 800, santi: 500, dif: 300, aFavor: "Santi" });
  });
});
