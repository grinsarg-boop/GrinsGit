// Lee un PDF de etiquetas de cualquier courier y saca, por página: courier, N° de orden y precio.
// El producto/unidades NO está en la etiqueta → se cruza después por N° de orden contra Shopify
// (/api/picking). El precio queda para validar (varios productos comparten precio → precio solo es
// ambiguo; el N° de orden es la clave). Todo en el navegador, nada se sube.

export type LabelCourier = "urbano" | "fixy" | "correo" | "?";
export type Label = { page: number; courier: LabelCourier; orden: string | null; price: number | null };

// Patrones de N° de orden por courier (ampliar con muestras reales):
//   Fixy   → "Remito: 16934"
//   Correo → "#16778"  (DESTINATARIO #NNNNN, igual que lib/correo-pdf.ts)
//   Urbano → PENDIENTE muestra (placeholder genérico "orden/pedido N")
function parsePage(text: string, page: number): Label {
  const low = text.toLowerCase();
  const courier: LabelCourier =
    low.includes("fixy") ? "fixy"
    : low.includes("urbano") ? "urbano"
    : (/#\d{4,6}/.test(text) || low.includes("correo") || low.includes("micorreo")) ? "correo"
    : "?";

  const orden =
    text.match(/remito[:\s]+(\d{3,7})/i)?.[1] ??
    text.match(/#(\d{4,6})/)?.[1] ??
    text.match(/(?:orden|pedido)[:\s#]*(\d{4,6})/i)?.[1] ??
    null;

  const priceRaw =
    text.match(/contra\s*reembolso[:\s]*\$?\s*([\d.]+)/i)?.[1] ??
    text.match(/\$\s*([\d.]{4,})/)?.[1] ??
    null;
  const price = priceRaw ? Number(priceRaw.replace(/\./g, "")) : null;

  return { page, courier, orden, price };
}

export async function extractLabels(input: ArrayBuffer): Promise<Label[]> {
  // build legacy: corre también en Node (tests). Igual que lib/correo-pdf.ts.
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

// exportado para test (sin pdfjs)
export const _parsePage = parsePage;
