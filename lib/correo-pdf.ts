// Solo cliente: pdfjs-dist para leer el nº de pedido de cada etiqueta y
// pdf-lib para estampar el código de producto. Nada sale del navegador.
import { PDFDocument, StandardFonts } from "pdf-lib";
import { stampPage } from "./label-prep";

// Nº de pedido por página ("DESTINATARIO #16778"). null si la página no tiene.
export async function extractOrders(input: ArrayBuffer): Promise<(string | null)[]> {
  // build legacy: corre también en Node (vitest); el moderno exige DOMMatrix
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc =
    typeof window === "undefined"
      ? import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs") // Node (tests)
      : new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: input.slice(0) }).promise;
  const orders: (string | null)[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it) => ("str" in it ? it.str : "")).join(" ");
    orders.push(text.match(/#(\d{4,6})/)?.[1] ?? null);
  }
  return orders;
}

// Código grande en el recuadro vacío al pie de la etiqueta de Correo. La posición vive en
// label-prep.ts junto con la de Urbano y Fixy — una sola tabla de coordenadas, no una por pantalla.
// Efecto del cambio: si el PDF no es la A4 apaisada de MiCorreo ya no se estampa a ciegas en (95,88).
export async function stampCodes(
  input: ArrayBuffer,
  codeByPage: (string | null)[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach((page, i) => {
    const code = codeByPage[i];
    if (code) stampPage(page, code, "correo", font);
  });
  return doc.save();
}
