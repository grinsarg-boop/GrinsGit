import { describe, expect, it } from "vitest";
import {
  balance5050, conciliarGiros, fixyCobranza, flujoDiario, porMes, saldos,
  type Caja, type Cat, type Mov,
} from "./cashflow";

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

describe("conciliarGiros", () => {
  const ventanas = [
    { fecha_pago: "2026-07-07", neto: 1000 },
    { fecha_pago: "2026-07-14", neto: 2000 },
    { fecha_pago: "2026-07-21", neto: 3000 },
  ];
  it("asigna cada giro a la ventana con fecha_pago más reciente <= giro (giros partidos suman)", () => {
    const giros = [
      { fecha: "2026-07-07", monto: 600 },
      { fecha: "2026-07-11", monto: 350 }, // giro partido, días después → misma ventana 07/07
      { fecha: "2026-07-15", monto: 2020 }, // giro corrido un día → ventana 14/07
    ];
    const r = conciliarGiros(ventanas, giros, "2026-07-20");
    expect(r[0]).toEqual({ fecha_pago: "2026-07-07", cobrado: 950, diff: 950 / 1000 - 1 });
    expect(r[1]).toEqual({ fecha_pago: "2026-07-14", cobrado: 2020, diff: 2020 / 2000 - 1 });
    expect(r[2].diff).toBeNull(); // no vencida todavía
  });
  it("ventanas anteriores al primer giro de la caja no se juzgan (carga arrancó después)", () => {
    const r = conciliarGiros(ventanas, [{ fecha: "2026-07-14", monto: 2000 }], "2026-07-20");
    expect(r[0].diff).toBeNull(); // pago 07/07 < primer giro en caja
    expect(r[1].diff).toBe(0);
  });
});

describe("fixyCobranza", () => {
  it("gap contra lo entregado hasta hace LAG días; pendiente = sobres sin cobrar", () => {
    const dias = [
      { dia: "2026-07-10", neto: 500 },
      { dia: "2026-07-15", neto: 300 },
      { dia: "2026-07-19", neto: 999 }, // dentro del lag de 4 días desde el 20 → afuera
    ];
    const sobres = [
      { fecha: "2026-07-12", monto: 450, cobrado: true },
      { fecha: "2026-07-17", monto: 200, cobrado: false },
    ];
    const r = fixyCobranza(dias, sobres, "2026-07-20");
    expect(r.esperadoNeto).toBe(800);
    expect(r.rendido).toBe(650);
    expect(r.pendienteCobro).toBe(200);
    expect(r.gap).toBe(150);
    expect(r.ultimoSobre).toBe("2026-07-17");
  });
  it("gap nunca negativo y sin sobres devuelve null", () => {
    const r = fixyCobranza([{ dia: "2026-07-01", neto: 100 }], [], "2026-07-20");
    expect(r.gap).toBe(100);
    expect(fixyCobranza([], [{ fecha: "2026-07-01", monto: 500, cobrado: true }], "2026-07-20").gap).toBe(0);
    expect(r.ultimoSobre).toBeNull();
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
