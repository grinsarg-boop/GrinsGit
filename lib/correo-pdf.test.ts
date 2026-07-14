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
  it("extrae el pedido por página y estampa solo donde hay código", async () => {
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
