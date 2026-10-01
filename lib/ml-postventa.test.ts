import { describe, expect, it } from "vitest";
import { candadoSalida, huellaReclamo, ORIGINALIDAD, reglaFija } from "./ml-postventa";

describe("reglaFija (reglas de Pancho 21/09 y 30/09/2026)", () => {
  it("ANMAT / RNPA / Factura A → ignorar, aunque también pregunte por originalidad", () => {
    for (const q of ["Esta avalado por anmat?", "Está autorizado por Anmat ?", "Es el original? Esta aprobado x ANMAT?", "Hacen factura A ?"])
      expect(reglaFija(q)?.accion).toBe("ignorar");
  });
  it("originalidad → texto fijo, nunca 'es el original'", () => {
    expect(reglaFija("Si es original")).toMatchObject({ accion: "responder", texto: ORIGINALIDAD });
  });
  it("'compré y me llegó distinto' no es originalidad: lo decide el modelo", () => {
    expect(reglaFija("Compré y me llegó una imitación, no es el original")).toBeNull();
  });
  it("una pregunta común no tiene regla fija", () => {
    expect(reglaFija("Hace efecto q tiempo lleva ?")).toBeNull();
  });
});

describe("candadoSalida: lo prohibido escala en vez de publicarse", () => {
  const r = (texto: string) => candadoSalida({ accion: "responder", texto, motivo: "" });
  it("respuesta limpia pasa", () => {
    expect(r("¡Hola! Se toman 15 gotas por día en ayunas. ¡Saludos!").accion).toBe("responder");
  });
  it.each([
    "¡Hola! Escribinos al WhatsApp",
    "¡Hola! Llamanos al 11 5555-4444",
    "¡Hola! Mirá www.biolabs.com.ar",
    "¡Hola! Está aprobado por ANMAT",
    "¡Hola! Sí, es el original",
    "¡Hola! Elimina la retención en 7 días",
    "",
    "x".repeat(2001),
  ])("escala: %s", (t) => {
    expect(r(t).accion).toBe("escalar");
  });
});

describe("huellaReclamo", () => {
  const base = { id: 1, resource_id: 2, type: "mediations", stage: "dispute", status: "opened", reason_id: "PDD9952" };
  it("cambia cuando aparece una acción obligatoria y toma su vencimiento", () => {
    const sin = huellaReclamo({ ...base, players: [{ type: "seller", available_actions: [] }] });
    const con = huellaReclamo({ ...base, players: [{ type: "seller", available_actions: [
      { action: "send_message_to_mediator", mandatory: false },
      { action: "confirm_shortage_shipment_shipped", due_date: "2026-11-23T10:57:00.000-04:00", mandatory: true },
    ] }] });
    expect(sin.estado).not.toBe(con.estado);
    expect(sin.vence).toBeNull();
    expect(con.vence).toBe("2026-11-23T10:57:00.000-04:00");
  });
});
