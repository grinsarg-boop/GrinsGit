import { describe, expect, it } from "vitest";
import { parseFixySeguimiento } from "./fixy";

// Response real de seguimiento.json (remito 8537, guía 1615598), recortado a 5 de sus 22 eventos.
// Viene DESC: fechas[0] es el estado actual y el ÚLTIMO es el alta. Antes de 073 se guardaba sólo
// fechas[0] → de esta guía quedaba un solo evento (la devolución) y el alta se perdía.
const seguimiento = {
  status: "ok",
  guia: {
    fechas: [
      { guia: 1615598, fecha: "08/06/2026", hora: "16:36", estado: "DEVOLUCIÓN ENTREGADA", codigo_estado: 184, detalles: "RENDICION RECEPCIONADA" },
      { guia: 1615598, fecha: "04/06/2026", hora: "15:05", estado: "COBRO DE SERVICIO Y DEVOLUCION DE MERCADERIA A LA EMPRESA", codigo_estado: 139, detalles: "RENDICION AL CLIENTE" },
      { guia: 1615598, fecha: "08/05/2026", hora: "09:16", estado: "En Recorrido", codigo_estado: 134, detalles: "DESPACHADO A SUCURSAL" },
      { guia: 1615598, fecha: "04/05/2026", hora: "13:46", estado: "EN DEPOSITO LISTO PARA DESPACHO", codigo_estado: 129, detalles: null },
      { guia: 1615598, fecha: "01/05/2026", hora: "00:04", estado: "SOLICITUD PENDIENTE DE RETIRO", codigo_estado: 41, detalles: "INGRESO POR API" },
    ],
  },
};

describe("parseFixySeguimiento", () => {
  it("emite el historial ENTERO, en orden cronológico y con el alta primero", () => {
    const ev = parseFixySeguimiento("8537", seguimiento);
    expect(ev.map((e) => e.status_raw)).toEqual(["41", "129", "134", "139", "184"]);
    // el alta (41) ancla dispatched_at: el rollup toma min(occurred_at) de los 'despachado'
    expect(ev[0].occurred_at).toBe("2026-05-01T00:04:00-03:00");
    expect(ev.map((e) => e.occurred_at)).toEqual([...ev.map((e) => e.occurred_at)].sort());
    expect(ev[0]).toMatchObject({ courier: "fixy", tracking: "1615598", order_ref: "8537" });
    expect(ev[4].raw).toMatchObject({ estado: "DEVOLUCIÓN ENTREGADA", via: "api" });
  });

  it("saltea el evento roto y conserva el resto (antes se perdía la guía entera)", () => {
    const ev = parseFixySeguimiento("8537", { guia: { fechas: [
      { guia: 1615598, fecha: "sin fecha", codigo_estado: 39 },       // fecha ilegible
      { guia: 1615598, fecha: "02/05/2026", hora: "10:00" },          // sin codigo_estado
      { guia: 1615598, fecha: "01/05/2026", hora: "00:04", codigo_estado: 41 },
    ] } });
    expect(ev.map((e) => e.status_raw)).toEqual(["41"]);
  });

  it("sin fechas devuelve vacío (remito sin novedad, no es un error)", () => {
    expect(parseFixySeguimiento("8537", {})).toEqual([]);
    expect(parseFixySeguimiento("8537", { guia: { fechas: [] } })).toEqual([]);
  });
});
