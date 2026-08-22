// Lee un PDF de etiquetas de cualquier courier y saca, por etiqueta: courier, y según el tipo:
//   COD (Correo/Fixy/Urbano) → N° de orden → se cruza contra Shopify (/api/picking) para el producto.
//   MercadoLibre (ML/Flex)   → no traen N° de orden de Shopify, pero el PRODUCTO está en la etiqueta
//                               → se lee directo (matchProduct + pack). Marcado como "verificar".
//     Ojo: cada etiqueta ML/Flex es UNA página = UN pedido; hay dos formatos que lideran distinto,
//     "Venta ID:" o "Pack ID:" — AMBOS son pedidos reales (no mitades recortables). Solo las hojas
//     "Identifiicación Productos" (Pack ID sin "Recortá") son resúmenes y se ignoran.
// Todo en el navegador, nada se sube.

import { matchAllProducts } from "./product-match";
import { porProducto, type MlVenta } from "./ml-picking";

export type LabelCourier = "urbano" | "fixy" | "correo" | "ml" | "flex" | "?";
export type Label = {
  page: number;
  file?: string;             // PDF de origen (para ubicar la etiqueta que falló)
  courier: LabelCourier;
  orden: string | null;      // COD: para cruzar con Shopify
  venta: string | null;      // ML/Flex: id de venta o de pack (16 díg.) → cruza con /api/ml-picking
  price: number | null;      // contrareembolso (validación)
  producto: string | null;   // ML/Flex: leído de la etiqueta (único)
  unidades: number | null;   // ML/Flex: unidades del pack
  revisar: boolean;          // ML/Flex mixto o multi-compra → contar a mano
};

function parsePage(text: string, page: number): Label {
  const low = text.toLowerCase();
  const courier: LabelCourier =
    low.includes("fixy") ? "fixy"
    : (low.includes("flex") && low.includes("venta")) ? "flex"
    : (low.includes("venta id") || low.includes("mercadolibre")) ? "ml"
    // Etiqueta ML/Flex que lidera con "Pack ID" (no "Venta ID"): también es un pedido a despachar.
    // La "Recortá" la distingue de la hoja resumen (Pack ID sin Recortá) que sí se ignora.
    : (low.includes("pack id") && low.includes("recort")) ? (low.includes("flex") ? "flex" : "ml")
    : (low.includes("canalizador") || low.includes("shipper:")) ? "urbano"
    : (low.includes("f.pagado") || low.includes("clasico") || /destinatario\s+#/i.test(text)) ? "correo"
    : /#\d{4,6}\b/.test(text) ? "correo"
    : "?";

  const cod = courier === "urbano" || courier === "fixy" || courier === "correo";
  // Solo para COD; en ML el "#262382468" es el id del vendedor, no la orden → NO extraer ahí.
  const orden = cod
    ? (text.match(/remito[:\s]+(\d{3,7})/i)?.[1]
        // Urbano: el seguimiento es BLABS<nro-pedido> desde el 04/08/2026 (commit 9ce1cdc), y las
        // etiquetas que se bajan del panel NO traen "#NNNNN" en ningún lado — solo esto. Sin esta
        // regla, un PDF de Urbano entero sale "sin N° de pedido legible".
        // (Las de scripts/redespacho.mjs sí traen "#NNNNN", pero porque se lo estampa el script.)
        ?? text.match(/blabs\s*(\d{4,6})\b/i)?.[1]
        ?? text.match(/destinatario\s+#(\d{4,6})/i)?.[1]
        ?? text.match(/#(\d{4,6})\b/)?.[1]
        ?? null)
    : null;

  const priceRaw = text.match(/contra\s*reembolso[:\s]*\$?\s*([\d.]+)/i)?.[1] ?? null;
  const price = priceRaw ? Number(priceRaw.replace(/\./g, "")) : null;

  // Id de venta (o de pack) de ML: 16 dígitos que el PDF parte como "Venta ID: 20000 17421290758"
  // — el 20000 ES parte del id. Con esto la unidad real se pregunta a la API (/api/ml-picking) en
  // vez de deducirla del título; el parser de abajo queda de fallback.
  const venta = (courier === "ml" || courier === "flex")
    ? (text.match(/(?:venta|pack)\s*(?:id)?\s*:?\s*([\d\s]{16,24})/i)?.[1]
        ?.replace(/\D/g, "").match(/^\d{16}/)?.[0] ?? null)
    : null;

  let producto: string | null = null;
  let unidades: number | null = null;
  let revisar = false;
  if (courier === "ml" || courier === "flex") {
    // ── El producto y el pack se leen SOLO del título del listado, NUNCA de la página entera ──
    // La etiqueta de Colecta trae medidas del bulto ("QBC 6x7x25cm"), peso, CP, teléfono, fechas y
    // códigos de ruteo. Leyendo todo, la regla NxN agarraba el "6x7" de las medidas y un pedido de
    // UNA unidad salía rotulado P6 → el depósito manda 6. Encontrado el 09/08/2026 en
    // E3268…_labels.pdf p16 (Venta 17824513396, "Gotas Pureza … Menta", que es el listado x1).
    // El título va entre "N Unidad(es)" y el bloque del remitente: ancla presente en las 266
    // etiquetas reales que hay para probar, y en ninguna entran las medidas.
    const mU = text.match(/\d+\s*unidad(?:es)?\s+/i);
    const resto = mU ? text.slice(mU.index! + mU[0].length) : text;
    const corte = resto.search(/\s+(?:Remitente|Devolver a|Venta:|Pack ID:|DermaTech|#\d)/i);
    const titulo = corte > 0 ? resto.slice(0, corte) : resto.slice(0, 140);

    const prods = matchAllProducts(titulo);               // varios keywords = venta mixta
    // El SKU trae el pack en el último dígito (VE4 = Veinguard x4, igual que B3 de /correo).
    // Ojo: "1 Unidad" en ML es la cantidad de PUBLICACIONES compradas, no el pack.
    const packM = titulo.match(/sku:\s*[a-z]+(\d{1,2})\b/i)
      // El título del listado arranca justo después de "Tipo de envase: <envase>", y muchas veces
      // el pack va pegado adelante: "Frasco 2 Revival Oil Aceite…" = 2. Es el equivalente del
      // /^\s*(\d{1,2})\s/ de parseMlPack (ml.ts), que acá no sirve porque el título no está solo.
      // Sin esta regla "2 Revival Oil …240ml" se leía 1: ninguna otra pide número sin "gotero"/"u".
      // Rango 1-12 por lo mismo que ml.ts: descarta "30 ml" y demás falsos positivos.
      ?? titulo.match(/tipo de envase:\s*\S+\s+(1[0-2]|[1-9])\b/i)
      // "4 X 30ml" → 4 y también "…Detox 2x1" → 2. Antes esta regla exigía "ml" atrás y el 2x1 de
      // los listados de ML se leía 1, mientras que parseMlPack (ml.ts) lo contaba 2 para el P&L:
      // el depósito despachaba 1 donde se cobraron 2. Confirmado por Pancho el 09/08/2026: en ML
      // el "2x1" del título ES el pack (a diferencia de Shopify, donde es marketing — ver
      // migración 006 y docs/indicador-2b3b.md). Rango 1-12 como en ml.ts.
      ?? titulo.match(/(1[0-2]|[1-9])\s*[xX]\s*\d/)
      // …y al revés, con la letra adelante: "Promo X4", "X5 Pack Ahorro". Es la regla
      // /[xX]\s*(\d{1,2})/ que parseMlPack (ml.ts) ya tenía y acá faltaba: 8 etiquetas de la tanda
      // del 09/08/2026 salían x1 debiendo ser x4 y x5 — 26 unidades de menos, en silencio.
      // Va DESPUÉS de la regla NxN para que "4 X 30ml" siga siendo 4 y no 30.
      ?? titulo.match(/[xX]\s*(1[0-2]|[1-9])\b/)
      ?? titulo.match(/pack\s*x?\s*(\d+)/i)
      ?? titulo.match(/(\d+)\s*(?:goteros?|frascos?|comprimidos?|c[aá]psulas?)\b/i)
      ?? titulo.match(/(\d+)\s*u\b/i);
    const pack = packM ? +packM[1] : 1;
    // Red de seguridad: si NINGUNA regla habló y sin embargo el título del listado tiene un número
    // suelto, es un formato que no conozco y "1" sería una suposición. Un pack leído de menos =
    // despachar menos de lo cobrado, y falla en silencio. Mejor mandarlo a revisar.
    // Medido sobre 213 etiquetas reales: dispara en 0. Habría cazado "Frasco 2 Revival Oil" y
    // "Detox 2x1", que se leían 1 hasta el 09/08/2026.
    const numeroRaro = !packM && /\b\d{1,2}\b/.test(titulo.replace(/\d+\s*ml\b/gi, ""));
    const qtyM = text.match(/(\d+)\s*unidad(?:es)?\b/i);   // "1 Unidad" (compras del mismo listado)
    const multiCompra = (qtyM ? +qtyM[1] : 1) > 1;
    if (prods.length === 1 && !multiCompra && !numeroRaro) {
      producto = prods[0];
      unidades = pack;
    } else if (prods.length === 1 && numeroRaro) {
      producto = prods[0];
      revisar = true; // sabemos qué es, no cuántos
    } else if (prods.length >= 1) {
      // mixto (>1 producto) o multi-compra → no se puede partir bien desde la etiqueta
      producto = prods.length === 1 ? prods[0] : null;
      revisar = true;
    }
    // prods.length === 0 → sin producto reconocido (se marca aparte)
  }

  return { page, courier, orden, venta, price, producto, unidades, revisar };
}

// ── Cruce con la API de ML (/api/ml-picking) ──
// Lo que la venta dice de verdad: el desglose por ítem, resuelto en lib/ml-picking.ts con la misma
// regla con la que el P&L cobra el COGS. Se re-exporta acá porque es el tipo que viaja al cliente.
export type { MlVenta, VentaItem } from "./ml-picking";

// Una etiqueta ya cruzada. `desglose` es lo que hay que despachar, producto por producto: una
// venta MIXTA deja de ser "sin identificar" (la API sabe exactamente qué lleva) y pasa a contarse
// entera; lo único que no puede tener es UN código estampado, porque son dos productos.
export type Cruzada = Label & {
  apiOk: boolean;
  mixto: boolean;
  difiere: boolean;                                        // la etiqueta y la venta no dicen lo mismo
  motivo?: string;                                         // qué falta, nombrando la publicación
  desglose: { producto: string; unidades: number }[];      // vacío = no se pudo identificar
};

// La venta manda sobre lo que se leyó del PDF, y no es un empate: las dos usan la MISMA función de
// pack (parseMlPack), así que si no coinciden es porque el recorte del título en la etiqueta salió
// mal — la venta trae el título entero. La diferencia igual se reporta, porque un recorte que
// falla seguido es un formato de etiqueta nuevo que hay que mirar.
export function mergeVenta(l: Label, v?: MlVenta | null): Cruzada {
  const delTitulo = l.producto && l.unidades != null ? [{ producto: l.producto, unidades: l.unidades }] : [];
  if (!v || v.error) {
    return { ...l, apiOk: false, mixto: false, difiere: false, motivo: v?.error, desglose: delTitulo };
  }
  const desglose = porProducto(v);
  const producto = v.producto ?? (v.mixto ? null : l.producto);
  const unidades = v.unidades ?? (v.mixto ? null : l.unidades);
  const difiere =
    (!!l.producto && !!v.producto && l.producto !== v.producto) ||
    (l.unidades != null && v.unidades != null && l.unidades !== v.unidades);
  // `revisar` acá significa una sola cosa: NO estampar un código. Una mixta se despacha perfecto
  // (el desglose dice qué lleva), pero no hay un código único que la describa.
  const revisar = v.mixto || v.unidades == null || !!v.motivo;
  return { ...l, producto, unidades, revisar, apiOk: true, mixto: v.mixto, difiere, motivo: v.motivo, desglose };
}

// Desglose de paquetes por tamaño de pack: dado el N° de unidades de cada pedido de un producto,
// devuelve "10×1 · 15×2 · 15×4" (10 pedidos de a 1, 15 de a 2, 15 de a 4). Ordenado por tamaño.
export function packBreakdown(unidadesPorPedido: number[]): string {
  const packs = new Map<number, number>();
  for (const u of unidadesPorPedido) packs.set(u, (packs.get(u) ?? 0) + 1);
  return [...packs.entries()].sort((a, b) => a[0] - b[0]).map(([u, n]) => `${n}×${u}`).join(" · ");
}

export async function extractLabels(input: ArrayBuffer, file?: string): Promise<Label[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    typeof window === "undefined"
      ? import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")
      : new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: input.slice(0) }).promise;
  const out: Label[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ").replace(/\s+/g, " ").trim();
    out.push({ ...parsePage(text, i), file });
  }
  return out;
}

export const _parsePage = parsePage; // test
