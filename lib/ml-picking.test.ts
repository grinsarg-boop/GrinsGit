import { describe, it, expect } from "vitest";
import { packExplicito, resolverItem, resolverVenta, porProducto, type Contexto } from "./ml-picking";

// Títulos REALES de las publicaciones activas al 22/08/2026 (medidos por API). El valor esperado
// es lo que efectivamente hay que meter en la caja.
const ctx = (over: Partial<Contexto> = {}): Contexto => ({
  productoPorItem: new Map(),
  packHistorico: new Map(),
  ...over,
});
const it1 = (id: string, title: string, quantity = 1) => ({ quantity, item: { id, title } });

describe("packExplicito — ¿el título dice la cantidad, o parseMlPack cae a su default de 1?", () => {
  it("dice", () => {
    for (const t of [
      "3 Gotero Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta",
      "Pureza Drenaje Linfático Gotas Orgánicas Hinchazon Promo X4 Menta",
      "X5 Pack Ahorro Drenaje Linfático Hinchazón Abdomen Piernas Menta",
      "Gotas Natures Sunrise Drenaje Linfatico Organico Detox 2x1 Sin Sabor",
      "Anticelulítico Aceite Revival Oil Lavanda Masajes 240ml 3u Limón",
      "Várices Veinguard Solución Herbal Uso Externo Menta 4u 30ml Menta",
    ]) expect(packExplicito(t), t).toBe(true);
  });
  it("no dice — y las medidas del envase no cuentan como pack", () => {
    for (const t of [
      "Gotas Pureza Drenaje Linfático Hinchazón Abdomen Menta 30ml Menta",
      "Gotas Natures Sunrise Drenaje Linfatico Organico Detox 30cc Menta",
      "Serum Capilar Anticaida Arraigo Romero Cafeina 30ml",
      "Anticelulítico Aceite Revival Oil Colágeno Masajes 240ml Lavanda",
      "Várices Arañitas Veinguard Solución Herbal Uso Externo Menta Menta",
    ]) expect(packExplicito(t), t).toBe(false);
  });
});

describe("resolverItem", () => {
  it("el título manda cuando dice la cantidad", () => {
    const r = resolverItem(it1("MLA3030316544", "3 Gotero Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta"), ctx());
    expect(r).toMatchObject({ producto: "Pureza", pack: 3, unidades: 3, fuente: "titulo" });
  });
  // El caso que rompía: el catálogo declara UNITS_PER_PACK=1 y el cliente compró 2. Al no mirar el
  // atributo, la etiqueta y el COGS del P&L dicen lo mismo.
  it("'2x1' es el pack, aunque el catálogo diga otra cosa", () => {
    const r = resolverItem(it1("MLA2708727248", "Gotas Natures Sunrise Drenaje Linfatico Organico Detox 2x1 Sin Sabor"), ctx());
    expect(r).toMatchObject({ producto: "Natures", unidades: 2 });
  });
  it("multi-compra: 2 veces el listado x3 son 6 unidades", () => {
    const r = resolverItem(it1("MLA3030316544", "3 Gotero Pureza Drenaje…", 2), ctx());
    expect(r).toMatchObject({ pack: 3, qty: 2, unidades: 6 });
  });
  // "X5 Pack Ahorro Drenaje Linfático…" no nombra la marca: 68 ventas en 60 días que salían
  // "sin producto reconocido" en el picking.
  it("título sin marca → lo resuelve el mapa ml_ad_items", () => {
    const t = "X5 Pack Ahorro Drenaje Linfático Hinchazón Abdomen Piernas Menta";
    expect(resolverItem(it1("MLA3030521696", t), ctx()).producto).toBeNull();
    const c = ctx({ productoPorItem: new Map([["MLA3030521696", "Pureza"]]) });
    expect(resolverItem(it1("MLA3030521696", t), c)).toMatchObject({ producto: "Pureza", unidades: 5 });
  });
  // El agujero silencioso: título de catálogo que no dice la cantidad. Antes se despachaba 1.
  it("título mudo → decide con qué pack se viene vendiendo esa publicación", () => {
    const t = "Gotero Extractos De Hierbas Pureza Drenaje";
    const c = ctx({ packHistorico: new Map([["MLA9999999999", 2]]) });
    expect(resolverItem(it1("MLA9999999999", t), c)).toMatchObject({ unidades: 2, fuente: "historico" });
  });
  it("título mudo y publicación nueva sin histórico → 1, pero marcado como suposición", () => {
    const r = resolverItem(it1("MLA0000000001", "Serum Capilar Anticaida Arraigo Romero Cafeina 30ml"), ctx());
    expect(r).toMatchObject({ producto: "Arraigo", unidades: 1, fuente: "?" });
  });
  it("el histórico NO pisa un título que sí dice la cantidad", () => {
    const c = ctx({ packHistorico: new Map([["MLA3030316544", 5]]) });
    expect(resolverItem(it1("MLA3030316544", "3 Gotero Pureza Drenaje…"), c).unidades).toBe(3);
  });
});

describe("resolverVenta", () => {
  it("venta mixta: se identifica entera, producto por producto", () => {
    const v = resolverVenta([
      it1("MLA3030316544", "3 Gotero Pureza Drenaje…"),
      it1("MLA1696133711", "Várices Veinguard Solución Herbal Uso Externo Menta 4u 30ml Menta"),
    ], ctx());
    expect(v.mixto).toBe(true);
    expect(v.producto).toBeNull();       // no hay UN código para estampar…
    expect(v.unidades).toBe(7);
    expect(porProducto(v)).toEqual([{ producto: "Pureza", unidades: 3 }, { producto: "Veinguard", unidades: 4 }]);
  });
  it("el motivo nombra la publicación, no dice 'revisá'", () => {
    const v = resolverVenta([it1("MLA1516486365", "Mini Caña Lapicera Plateada Reel Kit 1m Accesorios")], ctx());
    expect(v.motivo).toContain("MLA1516486365");
    expect(porProducto(v)).toEqual([]);
  });
  it("dos veces el mismo producto en la misma venta se suman", () => {
    const v = resolverVenta([
      it1("MLA3030316544", "3 Gotero Pureza Drenaje…"),
      it1("MLA1796638415", "1 Gotero Pureza Drenaje Linfático Hinchazón Abdomen 30ml Menta"),
    ], ctx());
    expect(v.mixto).toBe(false);
    expect(porProducto(v)).toEqual([{ producto: "Pureza", unidades: 4 }]);
  });
});
