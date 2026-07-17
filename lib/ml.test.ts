import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { mapMlOrder, needsRefresh, nextTokenState, parseDarLogistica, parseMlPack, parseSantiagoFlex, sellerFlete } from "./ml";

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

describe("parseMlPack", () => {
  it("saca el pack del número que encabeza el título", () => {
    expect(parseMlPack("3 Gotero Pureza Drenaje Linfático")).toBe(3);
    expect(parseMlPack("2 Gotero Pureza")).toBe(2);
    expect(parseMlPack("4 Gotero Pureza")).toBe(4);
  });
  it("saca el pack del patrón 'N X' cuando no encabeza", () => {
    expect(parseMlPack("Veinguard Solución Herbal Varices 4 X 30ml Uso Externo Menta")).toBe(4);
  });
  it("pack 1 cuando no hay número de pack", () => {
    expect(parseMlPack("Gotas Pureza Drenaje Linfático")).toBe(1);
    expect(parseMlPack("Gotero Pureza Menta")).toBe(1);
    expect(parseMlPack("")).toBe(1);
    expect(parseMlPack(null)).toBe(1);
  });
});

describe("sellerFlete", () => {
  it("normal ME: list_cost menos lo que pagó el comprador", () => {
    expect(sellerFlete("xd_drop_off", 6600, 0)).toBe(6600); // envío gratis: lo absorbe todo
    expect(sellerFlete("xd_drop_off", 11354.92, 3884.92)).toBeCloseTo(7470, 2); // comprador paga parte
  });
  it("Flex (self_service) → null: lo resuelve el xlsx de Santiago", () => {
    expect(sellerFlete("self_service", 5000, 0)).toBeNull();
  });
  it("sin list_cost → null (no inventar)", () => {
    expect(sellerFlete("xd_drop_off", null, 0)).toBeNull();
  });
});

describe("parseSantiagoFlex", () => {
  // Reproduce el layout real: hoja RESUMEN (ignorada) + hoja de día con header en fila 2, leyenda a la derecha.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["RESUMEN"]]), "RESUMEN SEMANAL");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    [null, "Paquetes del dia:", 2],
    [null, "Precio del dia:", 10784],
    [null, "FECHA", "CODIGO DE VENTA", "LOCALIDAD", "PAQUETES", "PRECIO", null, "ZONA 1", "Zona", "Precio"],
    [1, 46209, 47452325919, "SAN ISIDRO", 1, 4150, null, null, "SAN ISIDRO", 4150],
    [2, 46209, 47451415519, "CABA", 1, 6634, null, null, "CABA", 6634],
    [3, null, null, null, null, null, null, null, "TIGRE", 6634], // fila sólo-leyenda → se ignora
  ]), "LUNES");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  it("extrae shipment_id + precio de las hojas de día, ignora RESUMEN y la leyenda", () => {
    const rows = parseSantiagoFlex(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shipment_id: 47452325919, price: 4150, localidad: "SAN ISIDRO" });
    expect(rows[1]).toMatchObject({ shipment_id: 47451415519, price: 6634 });
  });
});

describe("parseDarLogistica", () => {
  // Header real: "Precio" convive con "Zona precio" → hay que tomar la col exacta "Precio".
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Filtros Aplicados"],
    ["Número Tracking", "ID venta ML", "Fecha Venta", "CP", "Localidad", "Zona", "Zona precio", "Precio"],
    [47530552328, 2000017429280900, "15/07/2026", 1702, "Ciudadela", "3DEFEBRERO", "BIOLABS ZONA2", 6634],
    [47531258883, 2000017431131508, "15/07/2026", 1837, "Sourigues", "BERAZATEGUI", "BIOLABS ZONA3", 9221],
    [null, null, null, null, null, null, null, null], // fila vacía → se ignora
  ]), "Simple");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  it("toma shipment_id, CP y la columna Precio (no Zona precio)", () => {
    const rows = parseDarLogistica(buf);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ shipment_id: 47530552328, price: 6634, cp: "1702", localidad: "Ciudadela" });
    expect(rows[1]).toMatchObject({ shipment_id: 47531258883, price: 9221, cp: "1837" });
  });
});
