import { describe, expect, it } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { buildPdf, parseFixyBox, sortOrder, type SortKey } from "./label-prep";
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

  // Correo entra en A4 apaisada con la etiqueta en un rincón; sale recortada a 10×15 para la
  // impresora térmica, y el código se estampa en la geometría NUEVA (si se estampara antes del
  // recorte quedaría al pie, pegado al borde, y la térmica lo corta).
  it("Correo se recorta a 10×15 y se estampa ahí; los otros couriers no se tocan", { timeout: 30000 }, async () => {
    const correo = await pdfCorreo([16001, 16002]);
    const { pdf, sinEstampar } = await buildPdf([correo], [
      { file: 0, page: 1, courier: "correo" as const, code: "B3" },
      { file: 0, page: 2, courier: "correo" as const, code: "N12" },
    ]);
    expect(sinEstampar).toBe(0);
    for (const p of (await PDFDocument.load(pdf)).getPages()) {
      expect(p.getSize().width).toBeCloseTo(10 * 28.3465, 0);
      expect(p.getSize().height).toBeCloseTo(15 * 28.3465, 0);
    }
    // Una página que NO es Correo conserva su tamaño original.
    const urbano = await pdfCorreo([16003], [425.2, 283.5]);
    const r2 = await buildPdf([urbano], [{ file: 0, page: 1, courier: "urbano" as const, code: "B2" }]);
    expect((await PDFDocument.load(r2.pdf)).getPage(0).getSize().width).toBeCloseTo(425.2, 0);
  });

  // Fixy manda A4 con la etiqueta adentro y el borde dibujado como un rectángulo gris: ese
  // rectángulo es el recorte. Los 3 trozos son content stream REAL, copiados de los PDFs de Fixy.
  describe("parseFixyBox", () => {
    const stream = (cm: string, re: string) =>
      `.23999999 0 0 -.23999999 0 841.91998 cm\nq\n46.875 46.875 2385.4492 3413.4766 re\nW* n\nq\n` +
      `${cm} cm\n.8275 .8275 .8275 RG .8275 .8275 .8275 rg\n/G3 gs\n${re} re\nS\nQ\n`;

    it("layout FIXYPAY QR (17/08): la etiqueta ya viene a 10×15 sobre la A4", () => {
      const box = parseFixyBox(stream("2.9375 0 0 2.9375 46.875 46.875", "218.5 5.5 376 566"), 841.92)!;
      expect(box.right - box.left).toBeCloseTo(265.1, 0);
      expect(box.top - box.bottom).toBeCloseTo(399.0, 0);
      expect(box.left).toBeCloseTo(165.3, 0);
    });

    // El offset cambia entre páginas del mismo PDF y a partir de la 2 el translate es negativo:
    // con /(\d+)/ en vez de /(-?\d+)/ solo recortaba la primera página de cada archivo.
    it("página con translate negativo: mismo tamaño, corrido 3,5 pt", () => {
      const box = parseFixyBox(stream("2.9375 0 0 2.9375 46.875 -3369.4375", "218.5 1163.5 376 566"), 841.92)!;
      expect(box.right - box.left).toBeCloseTo(265.1, 0);
      expect(box.top).toBeCloseTo(830.3, 0);
    });

    it("layout viejo (A4 entera): sale el recuadro grande, buildPdf lo achica", () => {
      const box = parseFixyBox(stream("5.7187505 0 0 5.7187505 46.875 46.875", "20.5 5.5 376 566"), 841.92)!;
      expect(box.right - box.left).toBeCloseTo(516.1, 0);
      expect(box.top - box.bottom).toBeCloseTo(776.8, 0);
    });

    it("sin borde gris (layout del 06/07, que lo dibuja relleno) no recorta", () => {
      const s = `.23999999 0 0 -.23999999 0 841.91998 cm\nq\n6.18 0 0 6.18 46.875 46.875 cm\n` +
        `.8275 .8275 .8275 RG\n4 5 378 1 re\nf\n381 5 1 547 re\nf\n`;
      expect(parseFixyBox(s, 841.92)).toBeNull();
    });

    it("un recuadro más alto que la hoja es un falso positivo", () => {
      expect(parseFixyBox(stream("5.7187505 0 0 5.7187505 46.875 46.875", "20.5 5.5 376 900"), 841.92)).toBeNull();
    });
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
