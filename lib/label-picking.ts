// Lee un PDF de etiquetas de cualquier courier y saca, por etiqueta: courier, y según el tipo:
//   COD (Correo/Fixy/Urbano) → N° de orden → se cruza contra Shopify (/api/picking) para el producto.
//   MercadoLibre (ML/Flex)   → no traen N° de orden de Shopify, pero el PRODUCTO está en la etiqueta
//                               → se lee directo (matchProduct + pack). Marcado como "verificar".
// Todo en el navegador, nada se sube.

import { matchProduct } from "./product-match";

export type LabelCourier = "urbano" | "fixy" | "correo" | "ml" | "flex" | "?";
export type Label = {
  page: number;
  courier: LabelCourier;
  orden: string | null;      // COD: para cruzar con Shopify
  price: number | null;      // contrareembolso (validación)
  producto: string | null;   // ML/Flex: leído de la etiqueta
  unidades: number | null;   // ML/Flex: pack × cantidad (best-effort)
};

function parsePage(text: string, page: number): Label {
  const low = text.toLowerCase();
  const courier: LabelCourier =
    low.includes("fixy") ? "fixy"
    : (low.includes("flex") && low.includes("venta")) ? "flex"
    : (low.includes("venta id") || low.includes("mercadolibre")) ? "ml"
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
  if (courier === "ml" || courier === "flex") {
    producto = matchProduct(text);
    if (producto) {
      const pack = text.match(/(\d+)\s*(?:u\b|goteros?|frascos?|comprimidos?|c[aá]psulas?)/i)?.[1];
      const un = text.match(/(\d+)\s*unidad/i)?.[1];
      unidades = (pack ? +pack : 1) * (un ? +un : 1);
    }
  }

  return { page, courier, orden, price, producto, unidades };
}

export async function extractLabels(input: ArrayBuffer): Promise<Label[]> {
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
    out.push(parsePage(text, i));
  }
  return out;
}

export const _parsePage = parsePage; // test
