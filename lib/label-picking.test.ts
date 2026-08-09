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
  it("ML/Flex que lidera con 'Pack ID' + Recortá = pedido real (no se descarta)", () => {
    const t = "Pack ID: 20000 14040615337 Recortá esta parte de la etiqueta para que tu paquete viaje seguro. 1 Unidad Sabor: Menta Botella 2 Gotero Pureza Drenaje Remitente #262382468 María Leticia Acevedo Miño";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("ml");
    expect(r.producto).toBe("Pureza");
    expect(r.unidades).toBe(2);
  });
  it("hoja resumen (Pack ID sin Recortá) se ignora → courier '?'", () => {
    const t = "Identifiicación Productos ABC123 Pack ID: 2000014040615337 Venta: 2000017437709084 María Leticia Acevedo Cantidad: 1 Sabor: Menta";
    expect(_parsePage(t, 1).courier).toBe("?");
  });
  it("ML: pack por SKU VE4 (Veinguard x4, no x1 — la '1 Unidad' es la publicación)", () => {
    const t = "Venta ID: 20000 17425245890 1 Unidad Fragancia: Menta SKU: VE4 Veinguard Solución Herbal Varices 4 X 30ml Uso Externo Remitente #262382468";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("ml");
    expect(r.producto).toBe("Veinguard");
    expect(r.unidades).toBe(4);
    expect(r.revisar).toBe(false);
  });
  // Los dos packs que se leían de menos (09/08/2026). Importan más que el resto: el código que se
  // estampa sale de acá, y un número bajo hace que el depósito mande menos de lo que se cobró.
  it("ML: el pack pegado adelante del título ('Frasco 2 Revival Oil…') es 2, no 1", () => {
    const t = "Venta ID: 20000 17477229458 Recortá esta parte de la etiqueta para que tu paquete viaje seguro. 1 Unidad Fragancia: Lavanda | Tipo de envase: Frasco 2 Revival Oil Aceite Anticelulitico Masajes 240ml Lavanda";
    const r = _parsePage(t, 1);
    expect(r.producto).toBe("Revival Oil");
    expect(r.unidades).toBe(2);
    expect(r.revisar).toBe(false);
  });
  it("ML: el '2x1' del título ES el pack (a diferencia de Shopify, donde es marketing)", () => {
    const t = "Venta ID: 20000 17470000000 Recortá esta parte de la etiqueta. 1 Unidad Sabor: Sin sabor | Tipo de envase: Gotero Gotas Natures Sunrise Drenaje Linfatico Organico Detox 2x1 30ml";
    const r = _parsePage(t, 1);
    expect(r.producto).toBe("Natures");
    expect(r.unidades).toBe(2);
  });
  it("ML: 'Gotas … Menta' sin número sigue siendo x1", () => {
    const t = "Venta ID: 20000 17470000001 Recortá esta parte. 1 Unidad Sabor: Menta | Tipo de envase: Botella Gotas Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta";
    expect(_parsePage(t, 1).unidades).toBe(1);
  });
  it("ML mixto (2 productos) → revisar, no cuenta a ciegas", () => {
    const r = _parsePage("Venta ID 20000 111 1 Unidad Gotero Pureza Drenaje y BeeVenom", 1);
    expect(r.courier).toBe("ml");
    expect(r.revisar).toBe(true);
    expect(r.producto).toBeNull();
  });
});
