import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractOrders, stampCodes } from "./correo-pdf";

async function makeLabelsPdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const orden of ["16072", "15807"]) {
    const p = doc.addPage([841.89, 595.276]);
    p.drawText(`DESTINATARIO #${orden}`, { x: 65, y: 253, size: 10, font });
  }
  doc.addPage([841.89, 595.276]); // página sin pedido
  return doc.save();
}

describe("correo-pdf", () => {
  // timeout 20s (default 5s): este test hace un `await import("pdfjs-dist")` lazy dentro de
  // extractOrders (correo-pdf.ts:8) — pdfjs es pesado y, bajo la carga de la suite completa en
  // paralelo, esa importación + getDocument se pasaba de los 5s (falló ~5,5s el 22/07). El margen
  // saca el flake sin bajar cobertura ni frenar las corridas que pasan (es techo, no espera).
  it("extrae el pedido por página y estampa solo donde hay código", { timeout: 20000 }, async () => {
    const bytes = (await makeLabelsPdf()).buffer as ArrayBuffer;
    const orders = await extractOrders(bytes);
    expect(orders).toEqual(["16072", "15807", null]);

    const out = await stampCodes(bytes, ["B2", "B3", null]);
    const stamped = await extractOrders(out.buffer as ArrayBuffer);
    expect(stamped).toEqual(["16072", "15807", null]); // no rompe el texto original
    const doc = await PDFDocument.load(out);
    expect(doc.getPageCount()).toBe(3);
  });
});
