import { describe, expect, it } from "vitest";
import { candadoSalida, contactoDe, huellaReclamo, NO_HACE_NADA, NO_ORIGINAL, opcionDelMenu, ORIGINALIDAD, PEDIDO_DATOS, PIDE_REPOSICION, planRoto, reglaFija, respuestaReclamo, ROTO, sinContacto, textoSeguimiento } from "./ml-postventa";

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

describe("respuestaReclamo: textos fijos de Pancho (02/10) solo con canal habilitado", () => {
  const rec = (reason_id: string, stage: string, acciones: string[]) => ({
    id: 1, resource: "order", resource_id: 2, type: "mediations", stage, status: "opened", reason_id, quantity_type: "total",
    players: [{ type: "seller", available_actions: acciones.map((action) => ({ action })) }],
  });
  const dice = (message: string) => [{ sender_role: "complainant", message, date_created: "2026-10-01T23:39" }];
  it("no es original → al mediador solo si ML deja escribirle", () => {
    expect(respuestaReclamo(rec("PDD9943", "dispute", []), [], 0, 2)).toBeNull();
    expect(respuestaReclamo(rec("PDD9943", "dispute", ["send_message_to_mediator"]), [], 0, 2))
      .toMatchObject({ rol: "mediator", texto: NO_ORIGINAL });
  });
  it("arrepentimiento 'no hace nada' → a la compradora; otro motivo de arrepentimiento, nada", () => {
    const r = rec("PDD9939", "claim", ["send_message_to_complainant", "refund", "allow_partial_refund"]);
    expect(respuestaReclamo(r, dice("No hace nada.."), 0, 2)).toMatchObject({ rol: "complainant", texto: NO_HACE_NADA });
    expect(respuestaReclamo(r, dice("Me equivoqué de sabor"), 0, 2)).toBeNull();
    expect(respuestaReclamo(rec("PDD9939", "dispute", []), dice("No hace nada"), 0, 2)).toBeNull();
  });
  it("los textos no dicen 'es el original', no mencionan devolución y entran en el largo que ML aceptó", () => {
    expect(NO_ORIGINAL).not.toMatch(/es (el )?original/i);
    expect(NO_HACE_NADA).not.toMatch(/devol|reembols|reintegr/i);
    expect(NO_ORIGINAL.length).toBeLessThan(387);
    expect(NO_HACE_NADA.length).toBeLessThan(387);
  });
});

describe("reposición: pedir celular y mail mientras el canal está abierto (Pancho 02-03/10)", () => {
  it("PDD9952 en claim con canal al comprador → PEDIDO_DATOS; en dispute o sin canal, nada", () => {
    const r = (stage: string, acciones: string[]) => ({
      id: 1, resource: "order", resource_id: 2, type: "mediations", stage, status: "opened", reason_id: "PDD9952", quantity_type: "partial",
      players: [{ type: "seller", available_actions: acciones.map((action) => ({ action })) }],
    });
    expect(respuestaReclamo(r("claim", ["send_message_to_complainant"]), [], 0, 3)).toMatchObject({ rol: "complainant", texto: PEDIDO_DATOS, accion: "pedido datos" });
    expect(respuestaReclamo(r("claim", []), [], 0, 3)).toBeNull();
    expect(respuestaReclamo(r("dispute", ["send_message_to_mediator"]), [], 0, 3)).toBeNull();
  });
  it("detecta el reporte de faltante/roto/volcado y no la duda o el agradecimiento", () => {
    for (const t of ["Me llegó un frasco roto", "llegó volcado", "compré 3 y me faltan dos frascos", "vino solo 1 gotero", "se rompió en el viaje", "llegó incompleto"])
      expect(PIDE_REPOSICION.test(t), t).toBe(true);
    for (const t of ["¿cuándo llega?", "Gracias, llegó perfecto", "me falta saber la dosis", "¿Cómo se toma?"])
      expect(PIDE_REPOSICION.test(t), t).toBe(false);
  });
  it("captura mail y celular en los formatos que escribe la gente; sin código de área no adivina", () => {
    expect(contactoDe("mi mail es Ana.Perez@Gmail.com y cel 11 2345-6789")).toEqual({ email: "ana.perez@gmail.com", area: "11", cel: "23456789" });
    expect(contactoDe("0351 15 412-3456")).toEqual({ area: "351", cel: "4123456" });
    expect(contactoDe("+54 9 11 2345 6789")).toEqual({ area: "11", cel: "23456789" });
    expect(contactoDe("tel 2345-6789")).toEqual({});
    expect(contactoDe("orden 2000018526183678")).toEqual({});
  });
  it("el texto que sale en el aviso no lleva mail ni teléfono; el pedido entra en 350 y pasa sin nombrar courier", () => {
    expect(sinContacto("soy ana@x.com, 11 2345-6789")).toBe("soy [mail], [tel]");
    expect(PEDIDO_DATOS.length).toBeLessThanOrEqual(350);
    expect(PEDIDO_DATOS).not.toMatch(/correo argentino|urbano|whats|https?:/i);
  });
});

describe("seguimiento de la reposición por Urbano 2 (cuenta 4565, 03/10)", () => {
  it("arma el código que acepta urbano.com.ar/segui-tu-envio y rechaza lo que no es BLABSA", () => {
    const t = textoSeguimiento("BLABSA27789")!;
    expect(t).toContain("4565BLABSA27789");
    expect(textoSeguimiento("4565blabsa27789")).toBe(t);
    expect(t.length).toBeLessThanOrEqual(350);
    expect(t).not.toMatch(/https?:|whats/i);
    expect(textoSeguimiento("HC123456789AR")).toBeNull();
    expect(textoSeguimiento("0001494211379I3IC212901")).toBeNull();
  });
});
