// Preparador de etiquetas: ordena las páginas de uno o varios PDFs por producto y unidades, y
// estampa el código de producto (B3 = BeeVenom x3) para no tener que ordenar los bultos a mano.
// pdf-lib puro, corre en el navegador — el PDF nunca sale de la máquina.
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { LabelCourier } from "./label-picking";

// Dónde va el código, por courier. Cada posición está validada mirando el PDF rasterizado de
// etiquetas REALES (09/08/2026): ninguna pisa el código de barras ni el QR.
// Ojo: dentro de un mismo courier conviven PLANTILLAS distintas con el MISMO tamaño de página
// (Fixy cambió de layout entre el 14/07 y el 29/07; Urbano tiene dos según de dónde se baje), así
// que cada coordenada se eligió en un hueco que está libre en TODAS las variantes que hay a mano:
//   correo → Correo10071/2107, etiquetas_con_producto(17)
//   fixy   → FIxy0708/0508 (plantilla nueva) y Fixy1407 (vieja, la del QR grande al medio)
//   urbano → URBANO07082/Urbano0608 y etiquetas-urbano-2026-08-09 (la de redespacho.mjs)
// La geometría además se verifica en runtime: con otra medida de página la coordenada no significa
// nada, así que NO se estampa — mejor una etiqueta sin código que una con el barcode tapado, que es
// un bulto que no se puede despachar.
const STAMP: Partial<Record<LabelCourier, { w: number; h: number; x: number; y: number; size: number; center?: boolean }>> = {
  correo: { w: 841.89, h: 595.28, x: 95, y: 88, size: 26 },  // A4 apaisada — recuadro vacío al pie (13/07)
  fixy: { w: 595.0, h: 841.9, x: 460, y: 380, size: 32 },    // A4 vertical — columna libre a la derecha del domicilio
  // Urbano 15×10 apaisada: chico y centrado en la franja de arriba (pedido de Pancho 09/08 — antes
  // iba grande al medio derecha y quedaba invadiendo la etiqueta). Es la ÚNICA franja libre a todo
  // el ancho: y 272-284, medida uniendo la tinta de 112 páginas de las dos plantillas.
  // Queda arriba del "#pedido" que estampa redespacho.mjs (y≈256), así que no chocan.
  urbano: { w: 425.2, h: 283.5, x: 0, y: 273.5, size: 11, center: true },
  // Flex: la 10×15 que sale de mlLabelsTo10x15 (el producto vive en el talón, que se recorta → sin
  // esto la etiqueta impresa no dice qué lleva). Columna libre a la izquierda del QR; el recuadro
  // del pie NO sirve, ahí el "Destinatario:" largo baja hasta y=28.
  flex: { w: 283.46, h: 425.2, x: 20, y: 250, size: 30 },
  // ML Colecta/Pickit: mismo tamaño que Flex pero otro layout, denso y distinto página a página
  // (códigos de clasificación, rutas, fechas). El hueco se buscó uniendo la tinta de las 94
  // etiquetas reales de A0CE + 37F6 + ADC75 y quedándose con el rectángulo libre en TODAS:
  // el PIE está ocupado (dirección a la izquierda, QR y recuadro de zona a la derecha), y el único
  // lugar seguro es la columna a la derecha del código de barras (x 216-266, y 249-335).
  // Más chico que Flex a propósito: acá compite con los códigos de ruteo de Mercado Envíos.
  ml: { w: 283.46, h: 425.2, x: 220, y: 275, size: 22 },
};
const TOL = 3; // pt

// Estampa el código en la página. false = geometría desconocida para ese courier, no se dibujó nada.
export function stampPage(page: PDFPage, code: string, courier: LabelCourier, font: PDFFont): boolean {
  const s = STAMP[courier];
  const { width, height } = page.getSize();
  if (!s || Math.abs(width - s.w) > TOL || Math.abs(height - s.h) > TOL) return false;
  const x = s.center ? (width - font.widthOfTextAtSize(code, s.size)) / 2 : s.x;
  page.drawText(code, { x, y: s.y, size: s.size, font });
  return true;
}

export type SortKey = { producto: string | null; unidades: number | null; revisar?: boolean };

// Una etiqueta ML de UN solo producto pero multi-compra trae `producto` puesto y `revisar: true`
// (label-picking.ts): resuelta no está, y sin esto se colaba en el medio de la pila sin código.
const resuelto = (k: SortKey) => (k.revisar ? null : k.producto);

// Orden de armado: agrupado por producto (alfabético) y adentro de cada producto por unidades
// ascendente — se arma toda la pila de 1, después la de 2, después la de 3.
// Lo que no se pudo resolver (carrito mixto, producto sin match, página no reconocida) NO se
// descarta: va al final en su propio bloque, para revisar a mano.
// Devuelve los índices de `items` en el orden de salida.
export function sortOrder(items: SortKey[]): number[] {
  return items
    .map((_, i) => i)
    .sort((a, b) => {
      const pa = resuelto(items[a]), pb = resuelto(items[b]);
      if (!pa !== !pb) return pa ? -1 : 1;
      if (pa && pb && pa !== pb) return pa < pb ? -1 : 1;
      return (items[a].unidades ?? 0) - (items[b].unidades ?? 0) || a - b; // empate → orden de entrada
    });
}

export type OutPage = {
  file: number;              // índice en `sources`
  page: number;              // 1-indexed, como Label.page
  courier?: LabelCourier;
  code?: string | null;      // null/"" → no se estampa
};

// Arma el PDF de salida con las páginas en el orden pedido. copyPages preserva tamaño y
// orientación: reescalar rompe el escaneo del código de barras.
// `sinEstampar` = páginas con código pero geometría no validada para su courier (ver STAMP).
export async function buildPdf(
  sources: ArrayBuffer[],
  pages: OutPage[],
): Promise<{ pdf: Uint8Array; sinEstampar: number }> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  // Una sola copyPages por archivo: copiando de a una, pdf-lib duplica los recursos compartidos
  // (fuentes, logos) y el PDF de 100 etiquetas se infla varias veces.
  const copied: PDFPage[][] = [];
  for (const src of sources) {
    const doc = await PDFDocument.load(src, { ignoreEncryption: true });
    copied.push(await out.copyPages(doc, doc.getPageIndices()));
  }
  let sinEstampar = 0;
  for (const p of pages) {
    const page = copied[p.file]?.[p.page - 1];
    if (!page) continue;
    out.addPage(page);
    if (p.code && !stampPage(page, p.code, p.courier ?? "?", font)) sinEstampar++;
  }
  return { pdf: await out.save(), sinEstampar };
}
