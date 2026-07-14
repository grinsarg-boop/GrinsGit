import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { mlLabelsTo10x15 } from "./split-labels";

const CM = 28.3465;
const ML_PAGE: [number, number] = [10 * CM, 19 * CM]; // etiqueta Flex: talón + label
const A4: [number, number] = [595.28, 841.89];

async function makeMlPdf() {
  const doc = await PDFDocument.create();
  for (let i = 0; i < 2; i++) {
    const p = doc.addPage(ML_PAGE);
    p.drawText(`etiqueta ${i + 1}`, { x: 20, y: 200 });
    p.drawText(`talon ${i + 1}`, { x: 20, y: 480 });
  }
  doc.addPage(A4).drawText("hoja resumen", { x: 50, y: 400 });
  return doc.save();
}

describe("mlLabelsTo10x15", () => {
  it("emite una página 10x15 por etiqueta y descarta la hoja A4", async () => {
    const { pdf, labels, skipped } = await mlLabelsTo10x15(await makeMlPdf());
    expect(labels).toBe(2);
    expect(skipped).toBe(1);
    const out = await PDFDocument.load(pdf);
    expect(out.getPageCount()).toBe(2);
    const { width, height } = out.getPage(0).getSize();
    expect(width).toBeCloseTo(10 * CM, 1);
    expect(height).toBeCloseTo(15 * CM, 1);
  });

  it("includeTalon agrega una página por etiqueta", async () => {
    const { pdf, labels } = await mlLabelsTo10x15(await makeMlPdf(), { includeTalon: true });
    expect(labels).toBe(2);
    const out = await PDFDocument.load(pdf);
    expect(out.getPageCount()).toBe(4);
  });

  it("páginas que ya son 10x15 pasan tal cual", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([10 * CM, 15 * CM]).drawText("ya recortada", { x: 20, y: 200 });
    const { pdf, labels, skipped } = await mlLabelsTo10x15(await doc.save());
    expect(labels).toBe(1);
    expect(skipped).toBe(0);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  });
});
