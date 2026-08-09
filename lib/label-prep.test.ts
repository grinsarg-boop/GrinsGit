import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildPdf, sortOrder, type SortKey } from "./label-prep";
import { extractLabels } from "./label-picking";

const CORREO: [number, number] = [841.89, 595.276]; // A4 apaisada, la geometría real de MiCorreo

// PDF de etiquetas sintético: una página por pedido, con el texto que hace que parsePage la
// reconozca como Correo (mismo molde que correo-pdf.test.ts).
async function pdfCorreo(ordenes: number[], size: [number, number] = CORREO) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const o of ordenes) {
    doc.addPage(size).drawText(`CLASICO F.PAGADO DESTINATARIO #${o}`, { x: 65, y: 253, size: 10, font });
  }
  return (await doc.save()).buffer as ArrayBuffer;
}

describe("sortOrder", () => {
  it("agrupa por producto y adentro ordena por unidades ascendente", () => {
    const items: SortKey[] = [
      { producto: "Pureza", unidades: 2 },
      { producto: "BeeVenom", unidades: 3 },
      { producto: "BeeVenom", unidades: 1 },
      { producto: "Pureza", unidades: 1 },
    ];
    expect(sortOrder(items)).toEqual([2, 1, 3, 0]);
  });

  it("lo que no se pudo resolver va al final, no se pierde", () => {
    const items: SortKey[] = [
      { producto: null, unidades: null },   // carrito mixto
      { producto: "Pureza", unidades: 2 },
      { producto: null, unidades: 1 },      // página no reconocida
      { producto: "Altus", unidades: 9 },
    ];
    const orden = sortOrder(items);
    expect(orden).toEqual([3, 1, 0, 2]);
    expect(orden.length).toBe(items.length); // ninguna página desaparece
  });

  it("revisar:true va al final aunque traiga producto (ML de un producto, multi-compra)", () => {
    const items: SortKey[] = [
      { producto: "Pureza", unidades: null, revisar: true }, // multi-compra: el pack no es confiable
      { producto: "Pureza", unidades: 2 },
      { producto: "Pureza", unidades: 1 },
    ];
    expect(sortOrder(items)).toEqual([2, 1, 0]);
  });

  it("empate de producto y unidades mantiene el orden de entrada", () => {
    const items: SortKey[] = Array.from({ length: 4 }, () => ({ producto: "Pureza", unidades: 2 }));
    expect(sortOrder(items)).toEqual([0, 1, 2, 3]);
  });
});

describe("buildPdf", () => {
  it("reordena las páginas de varios PDFs mezclados y estampa el código", { timeout: 30000 }, async () => {
    // Dos archivos mezclados, como los sube el depósito.
    const a = await pdfCorreo([16001, 16002]);
    const b = await pdfCorreo([16003, 16004]);
    const items = [
      { file: 0, page: 1, producto: "Pureza", unidades: 2, orden: "16001" },
      { file: 0, page: 2, producto: null, unidades: null, orden: "16002" },      // mixto → al final
      { file: 1, page: 1, producto: "BeeVenom", unidades: 3, orden: "16003" },
      { file: 1, page: 2, producto: "BeeVenom", unidades: 1, orden: "16004" },
    ];
    const orden = sortOrder(items);
    const { pdf, sinEstampar } = await buildPdf(
      [a, b],
      orden.map((i) => ({
        ...items[i],
        courier: "correo" as const,
        code: items[i].producto ? `${items[i].producto![0]}${items[i].unidades}` : null,
      })),
    );

    expect(sinEstampar).toBe(0);
    const out = await extractLabels(pdf.buffer as ArrayBuffer);
    // BeeVenom x1, BeeVenom x3, Pureza x2, y el mixto al final.
    expect(out.map((l) => l.orden)).toEqual(["16004", "16003", "16001", "16002"]);
    expect(out.length).toBe(4);
  });

  it("no estampa si la geometría no es la validada para ese courier", { timeout: 30000 }, async () => {
    const raro = await pdfCorreo([16005], [400, 400]); // no es la A4 apaisada de MiCorreo
    const { pdf, sinEstampar } = await buildPdf(
      [raro],
      [{ file: 0, page: 1, courier: "correo", code: "B2" }],
    );
    expect(sinEstampar).toBe(1);
    const [pagina] = await PDFDocument.load(pdf).then((d) => d.getPages());
    expect(pagina.getSize().width).toBe(400); // la página sale igual, solo sin código
  });
});
