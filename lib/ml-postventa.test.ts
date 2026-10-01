import { describe, expect, it } from "vitest";
import { candadoSalida, huellaReclamo, opcionDelMenu, ORIGINALIDAD, planRoto, reglaFija, ROTO } from "./ml-postventa";

describe("reglaFija (reglas de Pancho 21/09 y 30/09/2026)", () => {
  it("ANMAT / RNPA → borrar (01/10), aunque también pregunte por originalidad", () => {
    for (const q of ["Esta avalado por anmat?", "Está autorizado por Anmat ?", "Es el original? Esta aprobado x ANMAT?", "Tiene RNPA?"])
      expect(reglaFija(q)?.accion).toBe("borrar");
  });
  it("Factura A → ignorar (21/09)", () => {
    expect(reglaFija("Hacen factura A ?")?.accion).toBe("ignorar");
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
  const base = { id: 1, resource: "order", resource_id: 2, type: "mediations", stage: "dispute", status: "opened", reason_id: "PDD9952" };
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

// Menú real del bot mediador (reclamo 5581480741, PDD9972, 22/09/2026).
const MENU = `Analizamos el caso y te sugerimos estas opciones para resolverlo:

1. **Devolución con reembolso total** — La compradora devuelve el producto recibido y vos reintegrás el 100% del importe de la venta.
2. **Reembolso parcial sin devolución** — Podés reintegrar el 10% o cualquier otro porcentaje que elijas, sin que la compradora devuelva el producto.
3. **Brindar indicaciones** — Podés enviar instrucciones y/o imágenes.`;
const MENU_TOTAL = `1. **Reembolso total sin devolución** — El comprador se queda con el producto.
2. **Devolución con reembolso total** — Devolvés el 100%.
3. **Brindar indicaciones** — Podés enviar instrucciones.`;

describe("rotos: reintegro sin devolución por la proporción de frascos rotos (regla 01/10)", () => {
  it("lee el número de opción del menú", () => {
    expect(opcionDelMenu(MENU, "parcial")).toBe(2);
    expect(opcionDelMenu(MENU, "total")).toBeNull();
    expect(opcionDelMenu(MENU_TOTAL, "total")).toBe(1);
  });
  it("1 de 2 rotos → parcial 50%, la elección va primero y culpa al transporte", () => {
    const p = planRoto(1, 2, MENU);
    if ("escalar" in p) throw new Error(p.escalar);
    expect(p.pct).toBe(50);
    expect(p.texto.startsWith("Elegimos la opción 2: reembolso parcial sin devolución del 50%")).toBe(true);
    expect(p.texto).toMatch(/transporte/);
    expect(p.texto.length).toBeLessThan(380); // lo más largo que ML aceptó a un mediador: 386
  });
  it("todos rotos → reembolso total sin devolución", () => {
    const p = planRoto(2, 2, MENU_TOTAL);
    expect("texto" in p && p.texto.startsWith("Elegimos la opción 1: reembolso total sin devolución")).toBe(true);
  });
  it("escala si el menú no tiene la opción, o si el número de rotos no cierra", () => {
    expect("escalar" in planRoto(1, 2, MENU_TOTAL)).toBe(true);
    expect("escalar" in planRoto(0, 2, MENU)).toBe(true);
    expect("escalar" in planRoto(3, 2, MENU)).toBe(true);
  });
  it("los 4 motivos de rotura", () => {
    for (const r of ["PDD9972", "PDD9973", "PDD9946", "PDD9947"]) expect(ROTO.has(r)).toBe(true);
    expect(ROTO.has("PDD9943")).toBe(false);
  });
});
