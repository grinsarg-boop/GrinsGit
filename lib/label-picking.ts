// Lee un PDF de etiquetas de cualquier courier y saca, por etiqueta: courier, y según el tipo:
//   COD (Correo/Fixy/Urbano) → N° de orden → se cruza contra Shopify (/api/picking) para el producto.
//   MercadoLibre (ML/Flex)   → no traen N° de orden de Shopify, pero el PRODUCTO está en la etiqueta
//                               → se lee directo (matchProduct + pack). Marcado como "verificar".
//     Ojo: cada etiqueta ML/Flex es UNA página = UN pedido; hay dos formatos que lideran distinto,
//     "Venta ID:" o "Pack ID:" — AMBOS son pedidos reales (no mitades recortables). Solo las hojas
//     "Identifiicación Productos" (Pack ID sin "Recortá") son resúmenes y se ignoran.
// Todo en el navegador, nada se sube.

import { matchAllProducts } from "./product-match";

export type LabelCourier = "urbano" | "fixy" | "correo" | "ml" | "flex" | "?";
export type Label = {
  page: number;
  file?: string;             // PDF de origen (para ubicar la etiqueta que falló)
  courier: LabelCourier;
  orden: string | null;      // COD: para cruzar con Shopify
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
        ?? text.match(/destinatario\s+#(\d{4,6})/i)?.[1]
        ?? text.match(/#(\d{4,6})\b/)?.[1]
        ?? null)
    : null;

  const priceRaw = text.match(/contra\s*reembolso[:\s]*\$?\s*([\d.]+)/i)?.[1] ?? null;
  const price = priceRaw ? Number(priceRaw.replace(/\./g, "")) : null;

  let producto: string | null = null;
  let unidades: number | null = null;
  let revisar = false;
  if (courier === "ml" || courier === "flex") {
    const prods = matchAllProducts(text);                 // varios keywords = venta mixta
    // El SKU trae el pack en el último dígito (VE4 = Veinguard x4, igual que B3 de /correo).
    // Ojo: "1 Unidad" en ML es la cantidad de PUBLICACIONES compradas, no el pack.
    const packM = text.match(/sku:\s*[a-z]+(\d{1,2})\b/i)
      ?? text.match(/(\d+)\s*[xX]\s*\d+\s*ml\b/i)          // "4 X 30ml" → 4
      ?? text.match(/pack\s*x?\s*(\d+)/i)
      ?? text.match(/(\d+)\s*(?:goteros?|frascos?|comprimidos?|c[aá]psulas?)\b/i)
      ?? text.match(/(\d+)\s*u\b/i);
    const pack = packM ? +packM[1] : 1;
    const qtyM = text.match(/(\d+)\s*unidad(?:es)?\b/i);   // "1 Unidad" (compras del mismo listado)
    const multiCompra = (qtyM ? +qtyM[1] : 1) > 1;
    if (prods.length === 1 && !multiCompra) {
      producto = prods[0];
      unidades = pack;
    } else if (prods.length >= 1) {
      // mixto (>1 producto) o multi-compra → no se puede partir bien desde la etiqueta
      producto = prods.length === 1 ? prods[0] : null;
      revisar = true;
    }
    // prods.length === 0 → sin producto reconocido (se marca aparte)
  }

  return { page, courier, orden, price, producto, unidades, revisar };
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
