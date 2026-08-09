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

async function textoPorPagina(pdf: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({ data: pdf.slice(0) }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(c.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  return out;
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

  // El talón dice el producto y se recorta, así que el código va estampado en la etiqueta. El
  // riesgo es la alineación: las páginas descartadas y el talón rompen la correspondencia
  // posicional entre entrada y salida, y un código corrido = armar el pedido equivocado.
  it("estampa el código de CADA etiqueta aunque el split descarte páginas", async () => {
    const doc = await PDFDocument.create();
    doc.addPage(A4).drawText("resumen de arriba", { x: 50, y: 400 });   // descartada
    for (const n of ["uno", "dos", "tres"]) {
      const p = doc.addPage(ML_PAGE);
      p.drawText(`etiqueta ${n}`, { x: 20, y: 200 });
    }
    doc.addPage(A4).drawText("resumen de abajo", { x: 50, y: 400 });    // descartada
    // codeByPage es 0-indexed sobre la ENTRADA: la A4 de arriba ocupa el índice 0.
    const { pdf, labels, skipped, sinEstampar } = await mlLabelsTo10x15(await doc.save(), {
      stampByPage: [null, { code: "P1", courier: "flex" }, null, { code: "V4", courier: "flex" }, null],
    });
    expect({ labels, skipped, sinEstampar }).toEqual({ labels: 3, skipped: 2, sinEstampar: 0 });

    // Página 1 ← entrada 1 ("uno") con P1; página 2 ← "dos" sin código; página 3 ← "tres" con V4.
    const t = await textoPorPagina(pdf);
    expect(t[0]).toContain("uno");
    expect(t[0]).toContain("P1");
    expect(t[1]).toContain("dos");
    expect(t[1]).not.toMatch(/P1|V4/);
    expect(t[2]).toContain("tres");
    expect(t[2]).toContain("V4");
  });

  it("no estampa si la página no tiene la medida de la etiqueta ML", async () => {
    const doc = await PDFDocument.create();
    doc.addPage([10 * CM, 12 * CM]).drawText("rara", { x: 20, y: 100 }); // 10 de ancho pero no 15 de alto
    const { sinEstampar, labels } = await mlLabelsTo10x15(await doc.save(), {
      stampByPage: [{ code: "P2", courier: "flex" }],
    });
    expect({ labels, sinEstampar }).toEqual({ labels: 1, sinEstampar: 1 });
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
