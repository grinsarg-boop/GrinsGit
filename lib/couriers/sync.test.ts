import { describe, expect, it } from "vitest";
import { shouldChain } from "./sync";

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
