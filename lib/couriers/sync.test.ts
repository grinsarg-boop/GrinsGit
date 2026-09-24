import { describe, expect, it, vi } from "vitest";
import type { CourierEvent } from "./types";

const rpc = vi.fn(async (_fn: string, args: { p: unknown[] }) => ({ data: args.p.length, error: null }));
vi.mock("@/lib/supabase", () => ({ supabaseAdmin: () => ({ rpc }), logSyncRun: vi.fn() }));
const { esFallaDeConexion, shouldChain, upsertEvents } = await import("./sync");

// 2.400 eventos en un solo RPC pasaban los 8 s del statement_timeout (23/09/2026). Si esto se cae,
// el sync de Urbano vuelve a morir en ~80% de las corridas.
describe("upsertEvents", () => {
  it("parte en tandas de 500 y suma lo insertado", async () => {
    const events = Array.from({ length: 1201 }, (_, i) => ({ tracking: String(i) }) as CourierEvent);
    expect(await upsertEvents(events)).toBe(1201);
    expect(rpc.mock.calls.map(([, a]) => a.p.length)).toEqual([500, 500, 201]);
  });

  it("sin eventos no llama al RPC", async () => {
    rpc.mockClear();
    expect(await upsertEvents([])).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });
});

// Auto-drenado: la cadena debe avanzar mientras haya backlog y CORTAR sí o sí al agotar rounds.
describe("shouldChain", () => {
  const full = { ok: true, total: 775, processed: 100 };

  it("encadena mientras queden rondas y backlog", () => {
    expect(shouldChain(full, 16, 100)).toBe(true);
  });

  it("corta en la última ronda (no loop infinito aunque siga habiendo backlog)", () => {
    expect(shouldChain(full, 1, 100)).toBe(false);
  });

  it("no encadena si la corrida falló", () => {
    expect(shouldChain({ ...full, ok: false }, 16, 100)).toBe(false);
  });

  it("corta si el backlog ya cabe en una sola tanda", () => {
    expect(shouldChain({ ok: true, total: 60, processed: 60 }, 16, 100)).toBe(false);
  });
});

// El 404 por guía no puede apagar el conector. Si esto se cae, el sync vuelve a marcar ROJO cada
// vez que una ventana no trae eventos y hay un remito que el courier no conoce — y a marcar 'ok'
// con las mismas advertencias cuando sí los trae. Alerta que sigue al tráfico, no a la salud.
describe("esFallaDeConexion", () => {
  it("un 404 es de esa guía, no del conector", () => {
    expect(esFallaDeConexion({ courier: "fixy", remito: "20325", http: 404 })).toBe(false);
  });

  it("un 401 (token vencido) sí es la conexión", () => {
    expect(esFallaDeConexion({ courier: "fixy", remito: "20325", http: 401 })).toBe(true);
  });

  it("un 5xx también", () => {
    expect(esFallaDeConexion({ courier: "fixy", remito: "20325", http: 503 })).toBe(true);
  });

  it("una excepción sin http cuenta como falla (no se traga lo que no sabe leer)", () => {
    expect(esFallaDeConexion({ batch: 0, error: "TypeError: fetch failed" })).toBe(true);
  });

  // El caso del 22/08: 7 remitos de Andreani, todos 404 → la corrida NO es un fallo de conexión.
  it("una tanda entera de 404 sigue sin ser fallo de conexión", () => {
    const w = ["20325", "19982", "19966"].map((remito) => ({ courier: "fixy", remito, http: 404 }));
    expect(w.some(esFallaDeConexion)).toBe(false);
  });
});
