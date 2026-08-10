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
// Es una LISTA y no un mapa por courier porque un mismo courier puede tener varias geometrías
// (Correo entra en A4 apaisada y sale en 10×15 recortada): la fila se elige por courier + medida.
type Spot = { courier: LabelCourier; w: number; h: number; x: number; y: number; size: number; center?: boolean };
const STAMP: Spot[] = [
  { courier: "correo", w: 841.89, h: 595.28, x: 95, y: 88, size: 26 }, // A4 apaisada — recuadro al pie (13/07)
  // Correo ya recortada a 10×15 (ver correoA10x15): el recuadro del pie queda pegado al borde de
  // la etiqueta térmica y se corta al imprimir, así que el código sube al hueco que está libre en
  // las 24 páginas medidas — a la derecha del bloque REMITENTE, lejos de todo borde.
  { courier: "correo", w: 283.46, h: 425.2, x: 0, y: 252, size: 30, center: true },
  { courier: "fixy", w: 595.0, h: 841.9, x: 460, y: 380, size: 32 }, // A4 vertical — columna libre a la derecha del domicilio
  // Urbano 15×10 apaisada: chico y centrado en la franja de arriba (pedido de Pancho 09/08 — antes
  // iba grande al medio derecha y quedaba invadiendo la etiqueta). Es la ÚNICA franja libre a todo
  // el ancho: y 272-284, medida uniendo la tinta de 112 páginas de las dos plantillas.
  // Queda arriba del "#pedido" que estampa redespacho.mjs (y≈256), así que no chocan.
  { courier: "urbano", w: 425.2, h: 283.5, x: 0, y: 273.5, size: 11, center: true },
  // Flex: la 10×15 que sale de mlLabelsTo10x15 (el producto vive en el talón, que se recorta → sin
  // esto la etiqueta impresa no dice qué lleva). Columna libre a la izquierda del QR; el recuadro
  // del pie NO sirve, ahí el "Destinatario:" largo baja hasta y=28.
  { courier: "flex", w: 283.46, h: 425.2, x: 20, y: 250, size: 30 },
  // ML Colecta/Pickit: mismo tamaño que Flex pero otro layout, denso y distinto página a página
  // (códigos de clasificación, rutas, fechas). El hueco se buscó uniendo la tinta de las 94
  // etiquetas reales de A0CE + 37F6 + ADC75 y quedándose con el rectángulo libre en TODAS:
  // el PIE está ocupado (dirección a la izquierda, QR y recuadro de zona a la derecha), y el único
  // lugar seguro es la columna a la derecha del código de barras (x 216-266, y 249-335).
  // Más chico que Flex a propósito: acá compite con los códigos de ruteo de Mercado Envíos.
  { courier: "ml", w: 283.46, h: 425.2, x: 220, y: 275, size: 22 },
];
const TOL = 3; // pt

// Estampa el código en la página. false = geometría desconocida para ese courier, no se dibujó nada.
export function stampPage(page: PDFPage, code: string, courier: LabelCourier, font: PDFFont): boolean {
  const { width, height } = page.getSize();
  const s = STAMP.find((e) => e.courier === courier && Math.abs(width - e.w) <= TOL && Math.abs(height - e.h) <= TOL);
  if (!s) return false;
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

const CM = 28.3465;
const OUT_W = 10 * CM;
const OUT_H = 15 * CM;

// La etiqueta de Correo ocupa solo un rincón de la A4 apaisada: el resto es papel en blanco y el
// "Powered by TCPDF" del pie, que NO es parte de la etiqueta. Medido sobre 24 páginas de
// Correo10071/2107/1707: idéntico en las 24.
const CORREO_CROP = { left: 56, bottom: 74, right: 300, top: 537 }; // 244 × 463 pt = 8,6 × 16,3 cm

// Recorta la etiqueta de la A4 y la centra en una hoja de 10×15 para la impresora térmica.
// Escala ~0,92 (la etiqueta es más alta que 15 cm en proporción): es lo mínimo para que entre
// entera. Reducir el barcode tiene un límite y 0,92 está lejos de él, pero es la razón por la que
// esto NO se le aplica a Fixy ni a Urbano, que ya vienen en su tamaño.
async function correoA10x15(out: PDFDocument, orig: PDFPage): Promise<PDFPage> {
  const emb = await out.embedPage(orig, CORREO_CROP, [1, 0, 0, 1, -CORREO_CROP.left, -CORREO_CROP.bottom]);
  const s = Math.min(OUT_W / emb.width, OUT_H / emb.height);
  const hoja = out.addPage([OUT_W, OUT_H]);
  hoja.drawPage(emb, {
    x: (OUT_W - emb.width * s) / 2,
    y: (OUT_H - emb.height * s) / 2,
    xScale: s,
    yScale: s,
  });
  return hoja;
}

const esA4Apaisada = (p: PDFPage) => {
  const { width, height } = p.getSize();
  return Math.abs(width - 841.89) <= TOL && Math.abs(height - 595.28) <= TOL;
};

// Arma el PDF de salida con las páginas en el orden pedido. Las de Correo se recortan a la etiqueta
// y se llevan a 10×15; el resto se copia tal cual, porque copyPages preserva tamaño y orientación y
// reescalar de más rompe el escaneo del código de barras.
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
  const docs: PDFDocument[] = [];
  for (const src of sources) {
    const doc = await PDFDocument.load(src, { ignoreEncryption: true });
    docs.push(doc);
    copied.push(await out.copyPages(doc, doc.getPageIndices()));
  }
  let sinEstampar = 0;
  for (const p of pages) {
    const copia = copied[p.file]?.[p.page - 1];
    if (!copia) continue;
    let page = copia;
    if (p.courier === "correo" && esA4Apaisada(copia)) {
      // embedPage necesita la página del documento ORIGEN, no la copiada.
      page = await correoA10x15(out, docs[p.file].getPage(p.page - 1));
    } else {
      out.addPage(copia);
    }
    if (p.code && !stampPage(page, p.code, p.courier ?? "?", font)) sinEstampar++;
  }
  return { pdf: await out.save(), sinEstampar };
}
