import { describe, it, expect } from "vitest";
import { _parsePage, packBreakdown, mergeVenta, type Label } from "./label-picking";

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
    expect(_parsePage(t, 1)).toEqual({ page: 1, courier: "fixy", orden: "16934", venta: null, price: 49980, producto: null, unidades: null, revisar: false });
  });
  it("Urbano: Canalizador/Shipper → urbano, orden por #NNNNN", () => {
    const t = "Fecha emisión Canalizador RES Shipper: 4362-BIOLABS Destinatario Sergio Valor Contrareembolso: $58999 #16943";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("urbano");
    expect(r.orden).toBe("16943");
  });
  // Las etiquetas que se bajan del panel de Urbano NO traen "#NNNNN": el nº de pedido está solo
  // adentro del código de seguimiento. Un PDF entero salía "sin N° de pedido legible" (09/08/2026).
  it("Urbano del panel: el pedido sale de BLABS<nro>, no hay ningún '#'", () => {
    const t = "Fecha emisión: 09/08/2026 Canalizador: BCH - ZONAO3 F Shipper: 4362-BIOLABS Destinatario: Maria belen almada Telefono: 5492944676986 Domicilio: Cacique linares 1680 Localidad: El.bolson (8430) Provincia: Rio Negro BLABS19124 Bulto/s: 1/1 Valor Contrareembolso: $49990 Powered by TCPDF (www.tcpdf.org)";
    expect(/#\d/.test(t)).toBe(false); // si esto falla, la etiqueta cambió y el test ya no prueba nada
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("urbano");
    expect(r.orden).toBe("19124");
  });
  it("Urbano estampado por redespacho.mjs: BLABS y #NNNNN coinciden", () => {
    const t = "Fecha emisión: 09/08/2026 Canalizador: POS - ZONAO1 C Shipper: 4362-BIOLABS Destinatario: Estela Vargas Localidad: Campo Grande (3362) BLABS16134 Bulto/s: 1/1 Valor Contrareembolso: $48999 Powered by TCPDF (www.tcpdf.org) #16134 2B";
    expect(_parsePage(t, 1).orden).toBe("16134");
  });
  it("Fixy: el 'BIOLABS' del remitente no se confunde con un BLABS de Urbano", () => {
    const t = "1756093 R.N.P.S.P N 1259 BIOLABS DESTINATARIO Virginia orieta Remito: 19029 www.fixy.com.ar Contrareembolso: $ 49990";
    const r = _parsePage(t, 1);
    expect(r.courier).toBe("fixy");
    expect(r.orden).toBe("19029");
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
  // El peor bug posible de esta herramienta: un pedido de 1 rotulado como 6, o sea el depósito
  // mandando 6. Texto REAL de E3268…_labels.pdf p16 (09/08/2026): el "6x7" que la regla NxN
  // agarraba son las MEDIDAS del bulto que imprime Colecta, no un pack.
  it("ML: las medidas del bulto ('QBC 6x7x25cm') no son el pack", () => {
    const t = "Venta ID: 20000 17824513396 Recortá esta parte de la etiqueta para que tu paquete viaje seguro. 1 Unidad Sabor: Menta | Tipo de envase: Botella Gotas Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta Remitente #262382468 Devolver a CTP BUE Sector CGC B1842ZAC Monte Grande Venta: 20000 17824513396 XCF1 Despachar: lun 10/ago antes de 17:30 hs 477178 84192 10 10:00 XCF1 > COR140 SUR-NQNF FAP: 16276 C SUC HC495214923AR QBC 6x7x25cm 0.17 kg Dario Vaca (VACADARIO20230627104446) Domicilio: Calle 2 0 CP: 8305 Centenario";
    const r = _parsePage(t, 1);
    expect(r.producto).toBe("Pureza");
    expect(r.unidades).toBe(1); // el listado es "Gotas ... Menta", sin número: es x1
    expect(r.revisar).toBe(false);
  });

  // Encontrado cruzando 249 etiquetas contra la API de ML (09/08/2026): el pack escrito con la
  // letra adelante no lo agarraba ninguna regla y se leía 1. 26 unidades de menos, en silencio.
  it("ML: el pack con la x adelante ('Promo X4', 'X5 Pack') también es pack", () => {
    const p4 = "Venta ID: 20000 17800000001 Recortá. 1 Unidad Sabor: Menta | Tipo de envase: Gotero Pureza Drenaje Linfático Gotas Orgánicas Hinchazon Promo X4 Menta Remitente #262382468";
    expect(_parsePage(p4, 1).unidades).toBe(4);
    const p5 = "Venta ID: 20000 17800000002 Recortá. 1 Unidad Sabor: Menta | Tipo de envase: Gotero X5 Pack Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta Remitente #262382468";
    expect(_parsePage(p5, 1).unidades).toBe(5);
    // y no rompe el caso con el número adelante: "4 X 30ml" sigue siendo 4, no 30
    const ml = "Venta ID: 20000 17800000003 Recortá. 1 Unidad Fragancia: Menta | Tipo de envase: Frasco SKU: VE4 Veinguard Solución Herbal Varices 4 X 30ml Remitente #262382468";
    expect(_parsePage(ml, 1).unidades).toBe(4);
  });

  // El listado real MLA3030521696 se llama "X5 Pack Ahorro Drenaje Linfático…" y NO nombra al
  // producto: matchProduct no tiene de dónde agarrarse ("drenaje" no sirve, lo comparte con
  // Natures). Sale sin producto y sin código — que es lo correcto, pero significa que ese listado
  // hay que renombrarlo en ML para que el depósito lo pueda rotular.
  it("ML: un listado que no nombra el producto sale sin código, no adivina", () => {
    const t = "Venta ID: 20000 17800000004 Recortá. 1 Unidad Sabor: Menta | Tipo de envase: Gotero X5 Pack Ahorro Drenaje Linfático Hinchazón Abdomen Piernas Menta Remitente #262382468";
    const r = _parsePage(t, 1);
    expect(r.producto).toBeNull();
    expect(r.unidades).toBeNull();
  });

  // Red de seguridad: un formato de título que no conozco, con un número que ninguna regla
  // interpreta, NO se asume 1 — se manda a revisar. Un pack leído de menos despacha de menos.
  it("ML: número en el título que ninguna regla entiende → revisar, no '1' a ciegas", () => {
    const t = "Venta ID: 20000 17470000002 Recortá esta parte. 1 Unidad Sabor: Menta | Tipo de envase: Gotero Pureza Drenaje Linfático — Llevá 2 y ahorrá";
    const r = _parsePage(t, 1);
    expect(r.producto).toBe("Pureza"); // qué es, lo sabemos
    expect(r.revisar).toBe(true);      // cuántos, no
    expect(r.unidades).toBeNull();
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

// El id que cruza contra la API de ML. El PDF lo parte como "20000 17421290758": el 20000 ES parte
// del id, son 16 dígitos. Sin esto no hay con qué preguntar y todo cae al parser del título.
describe("_parsePage: id de venta de ML", () => {
  it("'Venta ID: 20000 NNN' → los 16 dígitos pegados, sin comerse lo que sigue", () => {
    const t = "Venta ID: 20000 17421290758 1 Unidad Sabor Menta 3 Gotero Pureza Drenaje Remitente #262382468";
    expect(_parsePage(t, 1).venta).toBe("2000017421290758");
  });
  it("'Pack ID: 20000 NNN' también sirve (el endpoint prueba orden y después pack)", () => {
    const t = "Pack ID: 20000 14040615337 Recortá esta parte de la etiqueta. 1 Unidad Botella 2 Gotero Pureza Drenaje";
    expect(_parsePage(t, 1).venta).toBe("2000014040615337");
  });
  it("sin espacio adentro del id", () => {
    expect(_parsePage("Venta ID: 2000017824513396 Recortá 1 Unidad Gotero Pureza Drenaje", 1).venta).toBe("2000017824513396");
  });
  it("etiqueta COD: no hay id de ML", () => {
    expect(_parsePage("CLASICO F.PAGADO REMITENTE BioLabsArg DESTINATARIO #16966 Abel", 1).venta).toBeNull();
  });
});

// La API manda sobre el título, salvo que se contradigan: ahí no manda nadie y va a revisar.
describe("mergeVenta", () => {
  const base: Label = {
    page: 1, courier: "ml", orden: null, venta: "2000017421290758",
    price: null, producto: "Pureza", unidades: 3, revisar: false,
  };
  it("la API pisa lo que dijo el título cuando coinciden en producto", () => {
    const r = mergeVenta({ ...base, unidades: 1 }, { producto: "Pureza", unidades: 2, mixto: false });
    expect(r.unidades).toBe(2);
    expect(r.difiere).toBe(true);   // el título decía 1 → no se estampa, se revisa
    expect(r.revisar).toBe(true);
  });
  it("coinciden → se estampa, sin ruido", () => {
    const r = mergeVenta(base, { producto: "Pureza", unidades: 3, mixto: false });
    expect(r).toMatchObject({ producto: "Pureza", unidades: 3, revisar: false, difiere: false });
  });
  it("multi-compra que el título no podía partir: la API la resuelve y sale del 'revisar'", () => {
    const l = { ...base, unidades: null, revisar: true };
    const r = mergeVenta(l, { producto: "Pureza", unidades: 6, mixto: false }); // 2 × listado x3
    expect(r.unidades).toBe(6);
    expect(r.revisar).toBe(false);
  });
  it("API caída → vale el título tal cual (fallback)", () => {
    const r = mergeVenta(base, { producto: null, unidades: null, mixto: false, error: "orders 500" });
    expect(r).toMatchObject({ producto: "Pureza", unidades: 3, revisar: false, difiere: false });
  });
  it("sin id de venta (nunca se consultó) → vale el título", () => {
    expect(mergeVenta(base, null)).toMatchObject({ producto: "Pureza", unidades: 3, revisar: false });
  });
  it("la API dice mixto → sin producto y a revisar, aunque el título viera uno solo", () => {
    const r = mergeVenta(base, { producto: null, unidades: 4, mixto: true });
    expect(r.producto).toBeNull();
    expect(r.revisar).toBe(true);
  });
  it("publicación sin UNITS_PER_PACK → sabemos qué, no cuántos: a revisar, nunca asumir 1", () => {
    const r = mergeVenta(base, { producto: "Pureza", unidades: null, mixto: false });
    expect(r.revisar).toBe(true);
    expect(r.unidades).toBe(3); // queda lo del título, pero sin código: se cuenta a mano
  });
});
