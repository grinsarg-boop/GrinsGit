import { describe, it, expect } from "vitest";
import { _parsePage, packBreakdown } from "./label-picking";

describe("packBreakdown", () => {
  it("agrupa por tamaño de pack, ordenado", () => {
    // 10 pedidos de a 1, 15 de a 2, 15 de a 4 → 100 unidades
    const packs = [...Array(10).fill(1), ...Array(15).fill(2), ...Array(15).fill(4)];
    expect(packBreakdown(packs)).toBe("10×1 · 15×2 · 15×4");
    expect(packs.reduce((s, u) => s + u, 0)).toBe(100);
  });
  it("vacío → string vacío", () => {
    expect(packBreakdown([])).toBe("");
  });
});

describe("_parsePage", () => {
  it("Fixy: courier, remito y contrareembolso (cruza por orden)", () => {
    const t = "1720297 BIOLABS DESTINATARIO Andres Contrareembolso: $ 49980 BULTOS 1/1 Remito: 16934 www.fixy.com.ar";
    expect(_parsePage(t, 1)).toEqual({ page: 1, courier: "fixy", orden: "16934", price: 49980, producto: null, unidades: null, revisar: false });
  });
  it("Urbano: Canalizador/Shipper → urbano, orden por #NNNNN", () => {
    const t = "Fecha emisión Canalizador RES Shipper: 4362-BIOLABS Destinatario Sergio Valor Contrareembolso: $58999 #16943";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("urbano");
    expect(r.orden).toBe("16943");
  });
  it("Correo: DESTINATARIO #NNNNN", () => {
    const r = _parsePage("CLASICO F.PAGADO REMITENTE BioLabsArg DESTINATARIO #16966 Abel", 2);
    expect(r.courier).toBe("correo");
    expect(r.orden).toBe("16966");
  });
  it("ML: no cruza (id del vendedor no es orden); producto+pack de la etiqueta", () => {
    const t = "Venta ID: 20000 17421290758 1 Unidad Sabor Menta 3 Gotero Pureza Drenaje Remitente #262382468";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("ml");
    expect(r.orden).toBeNull(); // NO agarra el #262382468 del vendedor
    expect(r.producto).toBe("Pureza");
    expect(r.unidades).toBe(3);
    expect(r.revisar).toBe(false);
  });
  it("ML: pack por SKU VE4 (Veinguard x4, no x1 — la '1 Unidad' es la publicación)", () => {
    const t = "Venta ID: 20000 17425245890 1 Unidad Fragancia: Menta SKU: VE4 Veinguard Solución Herbal Varices 4 X 30ml Uso Externo Remitente #262382468";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("ml");
    expect(r.producto).toBe("Veinguard");
    expect(r.unidades).toBe(4);
    expect(r.revisar).toBe(false);
  });
  it("ML mixto (2 productos) → revisar, no cuenta a ciegas", () => {
    const r = _parsePage("Venta ID 20000 111 1 Unidad Gotero Pureza Drenaje y BeeVenom", 1);
    expect(r.courier).toBe("ml");
    expect(r.revisar).toBe(true);
    expect(r.producto).toBeNull();
  });
});
