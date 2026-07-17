import { describe, expect, it } from "vitest";
import { mapMlOrder, needsRefresh, nextTokenState } from "./ml";

const NOW = 1_700_000_000_000;

describe("ml token", () => {
  it("usa el cache cuando el access token no venció", () => {
    expect(needsRefresh({ access_token: "a", expires_at: NOW + 3_600_000 }, NOW)).toBe(false);
  });

  it("refresca si no hay token, si venció, o si está dentro del skew de 10 min", () => {
    expect(needsRefresh(null, NOW)).toBe(true);
    expect(needsRefresh({ access_token: "a", expires_at: NOW + 60_000 }, NOW)).toBe(true); // <10min
    expect(needsRefresh({ access_token: "a", expires_at: NOW - 1 }, NOW)).toBe(true);
  });

  it("rota el refresh_token: persiste el nuevo si vino, conserva el viejo si no", () => {
    expect(nextTokenState({ access_token: "A2", refresh_token: "R2", expires_in: 21600 }, "R1", NOW))
      .toEqual({ access_token: "A2", refresh_token: "R2", expires_at: NOW + 21_600_000 });
    expect(nextTokenState({ access_token: "A3" }, "R1", NOW).refresh_token).toBe("R1");
  });
});

describe("mapMlOrder", () => {
  it("mapea producto, suma unidades y comisiones de todos los order_items", () => {
    const row = mapMlOrder({
      id: 200004,
      date_created: "2026-07-15T10:00:00Z",
      status: "paid",
      total_amount: 30000,
      order_items: [
        { item: { title: "Revival Oil x2" }, quantity: 2, unit_price: 12000, sale_fee: 1800 },
        { item: { title: "Revival Oil" }, quantity: 1, unit_price: 6000, sale_fee: 900 },
      ],
    });
    expect(row.product).toBe("Revival Oil"); // ML-only, no está en products pero matchProduct lo mapea
    expect(row.units).toBe(3);
    expect(row.sale_fee).toBe(2700);
    expect(row.ml_id).toBe(200004);
  });

  it("product = null si ningún título matchea", () => {
    const row = mapMlOrder({ id: 1, date_created: "x", status: "paid", order_items: [{ item: { title: "Otra cosa" } }] });
    expect(row.product).toBeNull();
  });
});
