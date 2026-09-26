import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { destFields, flexPriceForCP, groupBonifByDay, mapMlOrder, reEnrichFilter, parseOrderRef, needsRefresh, nextTokenState, parseDarLogistica, parseMlBilling, parseMlPack, parseSantiagoFlex, sellerFlete, sumWithholdings } from "./ml";

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
    expect(row.sale_fee).toBe(4500); // sale_fee es por unidad: 2×1800 + 1×900
    expect(row.ml_id).toBe(200004);
  });

  it("comisión = sale_fee × quantity, en centavos (orden real 2000018578450350, MP cobró 20859.33)", () => {
    const row = mapMlOrder({ id: 1, date_created: "x", status: "paid",
      order_items: [{ item: { title: "Pureza" }, quantity: 3, unit_price: 33917.59, sale_fee: 6953.11 }] });
    expect(row.sale_fee).toBe(20859.33);
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
  // Los tres que se contaban como x1 y cobraban $2.500 de COGS en vez de $4.500/$10.000 (medido 05/08/2026).
  it("saca el pack de 'Nu' y de 'Promo XN'", () => {
    expect(parseMlPack("Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta 2u Menta")).toBe(2);
    expect(parseMlPack("Pureza Drenaje Linfático Gotas Orgánicas Hinchazon Promo X4 Menta")).toBe(4);
  });
  it("el item_id pisa al título cuando el título de catálogo no dice la cantidad", () => {
    const catalogo = "Dermatech Gotero Extractos De Hierbas Pureza Drenaje Linfatico Aceite Menta";
    expect(parseMlPack(catalogo)).toBe(1); // sin id no hay de dónde sacarlo
    expect(parseMlPack(catalogo, "MLA3692036796")).toBe(2);
    const x3 = "Pureza Drops Extractos De Hierbas Gotas Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta Gotas Menta";
    expect(parseMlPack(x3)).toBe(1);
    expect(parseMlPack(x3, "MLA2055177767")).toBe(3);
    // Catálogo de la Revival x2: "Pack 2 Unidades" lo saca la regex; el id también, por si el nombre cambia.
    const revival = "Revival Oil Aceite Anticelulítico Pack 2 Unidades Limón";
    expect(parseMlPack(revival)).toBe(2);
    expect(parseMlPack("Otro nombre de catálogo cualquiera", "MLA3064229842")).toBe(2);
    expect(parseMlPack("Otro nombre de catálogo cualquiera", "MLA1908275639")).toBe(4);
  });
  it("no confunde el volumen del frasco con el pack", () => {
    expect(parseMlPack("Gotas Pureza Drenaje Linfático X 30ml Menta")).toBe(1);
    expect(parseMlPack("Gotas Pureza Drenaje Linfático Hinchazón Abdomen 30ml Menta")).toBe(1);
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

describe("sumWithholdings", () => {
  it("suma solo los cargos tax_withholding_* (caso real: pago 168914140511)", () => {
    expect(sumWithholdings([
      { name: "coupon_rebate", amounts: { original: 1078.65 } },
      { name: "tax_withholding_sirtac_sobretasa-cordoba", amounts: { original: 1071.16 } },
      { name: "tax_withholding_collector-iibb_tucuman", amounts: { original: 17.85 } },
      { name: "tax_withholding_sirtac-cordoba", amounts: { original: 214.23 } },
      { name: "shp_cross_docking", amounts: { original: 7470 } },
      { name: "meli_percentage_fee", amounts: { original: 11068.68 } },
      { name: "financing_add_on_fee", amounts: { original: 8783.54 } },
    ])).toBeCloseTo(1303.24, 2);
  });

  it("tolera charges vacíos, null o sin amounts", () => {
    expect(sumWithholdings([])).toBe(0);
    expect(sumWithholdings(null)).toBe(0);
    expect(sumWithholdings(undefined)).toBe(0);
    expect(sumWithholdings([{ name: "tax_withholding_x" }])).toBe(0);
  });
});

describe("groupBonifByDay", () => {
  it("agrupa aprobadas por día ART y deja afuera refunds y otras descripciones", () => {
    expect(groupBonifByDay([
      { date_approved: "2026-07-15T05:51:55.000-04:00", transaction_amount: 869, status: "approved", description: "bonificaciones_flex_fc" },
      { date_approved: "2026-07-15T22:30:00.000-04:00", transaction_amount: 649, status: "approved", description: "bonificaciones_flex_fc" }, // 23:30 ART, mismo día
      { date_approved: "2026-07-15T10:00:00.000-04:00", transaction_amount: 869, status: "refunded", description: "bonificaciones_flex_fc" },
      { date_approved: "2026-07-15T10:00:00.000-04:00", transaction_amount: 107000, status: "approved", description: "Varios" },
      { date_approved: "2026-07-16T01:00:00.000-04:00", transaction_amount: 1024.6, status: "approved", description: "bonificaciones_flex_fc" },
    ])).toEqual({ "2026-07-15": 1518, "2026-07-16": 1024.6 });
  });

  it("cruce de medianoche: 23:30 -04:00 cae al día siguiente en ART", () => {
    expect(groupBonifByDay([
      { date_approved: "2026-07-15T23:30:00.000-04:00", transaction_amount: 100, status: "approved", description: "bonificaciones_flex_fc" },
    ])).toEqual({ "2026-07-16": 100 });
  });
});

describe("parseMlBilling", () => {
  // Layout real del Reporte_Facturacion: metadata arriba, header "N° de factura fiscal" en fila 8.
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["Fecha de actualización", null, "2026-07-21"],
    [],
    ["N° de factura fiscal", "Fecha del cargo", "Número del cargo", "Detalle", "Cobrado de la operación", "Estado", "Anula", "Valor del cargo"],
    ["0057A1", new Date("2026-06-17T12:00:00Z"), 1, "Cargo por vender ", "Si", null, null, 5000],
    ["0057A1", new Date("2026-07-16T12:00:00Z"), 2, "Cargo por campaña de publicidad de Product Ads", "No", null, null, 1210],
    ["0057A1", new Date("2026-07-17T12:00:00Z"), 3, "Percepción especial de IVA RG5319/2023", "No", null, null, 1006448.71],
    ["0057A1", new Date("2026-07-17T12:00:00Z"), 4, "Percepción impuesto IIBB Buenos Aires", "No", null, null, 476438.68],
    ["0057A1", new Date("2026-07-17T12:00:00Z"), 5, " Cargo por percepción de IIBB del régimen general para Tucumán", "No", null, null, 91024.9],
    ["0057A1", new Date("2026-07-17T12:00:00Z"), 8, "Percep. gral. impuesto IIBB Bs. As. Mercado Envíos", "No", null, null, 150454.36],
    ["0057A1", new Date("2026-07-01T12:00:00Z"), 6, "Cargo por mantenimiento de Mi página", "No", null, null, 15999],
    ["0057A1", new Date("2026-06-18T12:00:00Z"), 7, "Anulación del cargo por vender", "No aplica", null, null, -3000],
  ]), "REPORT");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  it("suma percepciones y fijos, ignora lo ya contado, y saca la ventana del período", () => {
    const r = parseMlBilling(buf);
    expect(r.percep).toBeCloseTo(1006448.71 + 476438.68 + 91024.9 + 150454.36, 2);
    expect(r.fijos).toBe(15999);
    expect(r.from).toBe("2026-06-17");
    expect(r.to).toBe("2026-07-17");
    expect(r.cargos).toBe(8);
  });

  it("rechaza un xlsx que no es el reporte", () => {
    const w2 = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(w2, XLSX.utils.aoa_to_sheet([["Otra", "cosa"]]), "X");
    expect(() => parseMlBilling(XLSX.write(w2, { type: "buffer", bookType: "xlsx" }) as Buffer)).toThrow();
  });
});

describe("parseOrderRef", () => {
  it("extrae el order_number pelado de los refs ORDER-", () => {
    expect(parseOrderRef("ORDER-17876")).toBe("17876");
    expect(parseOrderRef("ORDER-1")).toBe("1");
  });
  it("descarta refs personales/QR/vacíos de la cuenta", () => {
    expect(parseOrderRef("134129803103")).toBeNull();     // merchant order de checkout ajeno
    expect(parseOrderRef("cashback_2919370616")).toBeNull();
    expect(parseOrderRef("ORDER-17876-b")).toBeNull();    // formato exacto o nada
    expect(parseOrderRef("")).toBeNull();
    expect(parseOrderRef(null)).toBeNull();
    expect(parseOrderRef(undefined)).toBeNull();
  });
});

describe("flexPriceForCP", () => {
  // CABA (11xx) barato, GBA oeste (17xx) caro: el promedio global mentiría en los dos sentidos.
  const T = { "1188": 5000, "1192": 5400, "1743": 9000, "1745": 9400 };

  it("usa el precio exacto cuando el CP está en la liquidación", () => {
    expect(flexPriceForCP(T, "1188")).toBe(5000);
  });
  it("un CP nuevo cae al promedio de SU zona, no al global", () => {
    expect(flexPriceForCP(T, "1199")).toBe(5200);  // (5000+5400)/2 — no 7200
    expect(flexPriceForCP(T, "1763")).toBe(9200);  // (9000+9400)/2
  });
  it("una zona entera desconocida cae al promedio global", () => {
    expect(flexPriceForCP(T, "6706")).toBe(7200);
  });
  it("sin tabla no inventa un precio", () => {
    expect(flexPriceForCP({}, "1188")).toBeNull();
  });
});

// El filtro de re-consulta a MP: si el segundo conjunto se cae, "A liquidar de ML" vuelve a contar
// como pendiente la plata ya liberada (era $99,4M contra ~$41,9M reales, 20/08/2026).
describe("reEnrichFilter", () => {
  const f = reEnrichFilter("2026-08-20", "2026-08-13");

  it("sigue levantando las que nunca se consultaron (tax_withheld null)", () => {
    expect(f).toContain("tax_withheld.is.null");
  });

  it("agrega las de liberación futura con ≥7 días de vida", () => {
    expect(f).toContain("and(mp_release_date.gte.2026-08-20,created_at.lte.2026-08-13)");
  });

  it("por default usa la fecha de negocio ART, no toISOString", () => {
    // daysAgoIso(0) en ART: entre las 21 y las 24 hs UTC ya es "mañana" y el filtro se correría
    // un día, dejando fuera justo las que liberan hoy.
    expect(reEnrichFilter()).toMatch(/mp_release_date\.gte\.\d{4}-\d{2}-\d{2},/);
  });
});

describe("destFields", () => {
  it("normaliza el CP a 4 dígitos y saca la provincia", () => {
    expect(destFields({ receiver_address: { zip_code: "C1425", state: { name: "Capital Federal" } } }))
      .toEqual({ dest_cp: "1425", province: "Capital Federal" });
  });

  it("omite las claves que no vienen en vez de pisar con null", () => {
    expect(destFields({ receiver_address: {} })).toEqual({});
    expect(destFields({})).toEqual({});
  });

  it("no inventa CP cuando el zip no tiene dígitos", () => {
    expect(destFields({ receiver_address: { zip_code: "S/N", state: { name: "Salta" } } }))
      .toEqual({ province: "Salta" });
  });
});
