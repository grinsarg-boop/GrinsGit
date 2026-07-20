import { describe, expect, it } from "vitest";
import { balance5050, flujoDiario, porMes, saldos, type Caja, type Cat, type Mov } from "./cashflow";

const CATS: Cat[] = [
  { id: 1, nombre: "Sueldos", tipo: "egreso" },
  { id: 2, nombre: "Proveedor", tipo: "egreso" },
  { id: 3, nombre: "Ajustes", tipo: "egreso" },
  { id: 4, nombre: "Personal socios", tipo: "egreso" },
];

let seq = 0;
const mov = (o: Partial<Mov>): Mov => ({
  id: ++seq, tipo: "egreso", monto: 0, caja_id: 1, caja_destino_id: null, categoria_id: null,
  descripcion: null, fecha: "2026-07-10", autor: null, es_retiro: false, ...o,
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

describe("flujoDiario", () => {
    const movs: Mov[] = [
      mov({ tipo: "ingreso", monto: 1000, fecha: "2026-07-10", caja_id: 1 }),
      mov({ monto: 300, fecha: "2026-07-10", caja_id: 1 }),
      mov({ monto: 200, fecha: "2026-07-10", caja_id: 2, es_retiro: true }), // retiro = plata que sale
      mov({ tipo: "transferencia", monto: 999, fecha: "2026-07-10", caja_id: 1, caja_destino_id: 2 }),
      mov({ tipo: "ingreso", monto: 50, fecha: "2026-07-09", caja_id: 2 }),
      mov({ monto: 1, fecha: "2026-02-01" }), // anterior a DESDE → afuera
    ];

  it("agrupa por día, retiros salen, transferencias no cuentan en 'Todas'", () => {
    expect(flujoDiario(movs)).toEqual([
      { fecha: "2026-07-09", ingresos: 50, egresos: 0 },
      { fecha: "2026-07-10", ingresos: 1000, egresos: 500 },
    ]);
  });

  it("filtrando una caja, las transferencias entran/salen de esa caja", () => {
    expect(flujoDiario(movs, 1)).toEqual([
      { fecha: "2026-07-10", ingresos: 1000, egresos: 300 + 999 }, // la transferencia sale de la caja 1
    ]);
    expect(flujoDiario(movs, 2)).toEqual([
      { fecha: "2026-07-09", ingresos: 50, egresos: 0 },
      { fecha: "2026-07-10", ingresos: 999, egresos: 200 }, // y entra a la caja 2
    ]);
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
