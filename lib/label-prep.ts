// Preparador de etiquetas: ordena las páginas de uno o varios PDFs por producto y unidades, y
// estampa el código de producto (B3 = BeeVenom x3) para no tener que ordenar los bultos a mano.
// pdf-lib puro, corre en el navegador — el PDF nunca sale de la máquina.
import { PDFArray, PDFDocument, StandardFonts, decodePDFRawStream, type PDFFont, type PDFPage, type PDFRawStream } from "pdf-lib";
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
type Spot = { courier: LabelCourier; w: number; h: number; x: number; y: number; size: number; center?: boolean }; // center → x es el CENTRO del texto
const STAMP: Spot[] = [
  { courier: "correo", w: 841.89, h: 595.28, x: 95, y: 88, size: 26 }, // A4 apaisada — recuadro al pie (13/07)
  // Correo ya recortada a 10×15 (ver correoA10x15): el recuadro del pie queda pegado al borde de
  // la etiqueta térmica y se corta al imprimir, así que el código sube al hueco que está libre en
  // las 24 páginas medidas — a la derecha del bloque REMITENTE, lejos de todo borde.
  { courier: "correo", w: 283.46, h: 425.2, x: 141.73, y: 252, size: 30, center: true },
  { courier: "fixy", w: 595.0, h: 841.9, x: 460, y: 380, size: 32 }, // A4 vertical — columna libre a la derecha del domicilio
  // Fixy ya recortada a 10×15 (ver fixyCrop): la columna libre de la A4 queda FUERA de la etiqueta,
  // así que el código se mudó adentro. El hueco se buscó uniendo la tinta de las 544 páginas de los
  // 3 layouts que hay a mano YA RECORTADAS (que es donde se estampa) y quedándose con la caja libre
  // en las 544: la franja de abajo a la derecha, entre la fecha de venta y el código de barras.
  // 22/09/2026: ahí se montaba sobre el borde derecho del código de barras. Se volvió a medir sobre
  // las 93 etiquetas Fixy recortadas de septiembre (layout FIXYPAY QR, el único que llega hoy):
  // el hueco grande está debajo del monto de contrareembolso, a la derecha de "QR FIXYPAY"
  // (x 106-270, y 245-291). Centrado ahí a 38 pt, "B12" deja ≥10 pt de aire contra todo.
  { courier: "fixy", w: 283.46, h: 425.2, x: 188, y: 258, size: 38, center: true },
  // Urbano 15×10 apaisada. Hasta el 22/09/2026 iba chico (11 pt) en la franja de arriba, pegado al
  // borde: con la etiqueta corrida en la impresora se cortaba. Medido sobre las 680 páginas Urbano
  // de septiembre (plantilla con el QR abajo a la derecha): arriba a la derecha, a la derecha de
  // "Canalizador: … ZONA", hay una caja libre x 286-406, y 207-265 — ≥18 pt de todo borde.
  // Ojo: la etiqueta que baja redespacho.mjs por API tiene el QR ARRIBA a la derecha y esto lo
  // pisaría; esa ya sale con su propio "#pedido B2" y no pasa por acá.
  { courier: "urbano", w: 425.2, h: 283.5, x: 346, y: 221, size: 44, center: true },
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
  const x = s.center ? s.x - font.widthOfTextAtSize(code, s.size) / 2 : s.x;
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
// El corte de abajo va en 132 y no en 74 a propósito: entre 74 y 130 está el recuadro vacío del pie,
// que dejó de usarse cuando el código se mudó arriba. Sacándolo la etiqueta queda 244 × 405 pt
// (8,6 × 14,3 cm) y entra en 10×15 SIN escalar — el código de barras sale a su tamaño original.
// Con el recuadro habría que encogerla a 0,92 y el barcode con ella.
const CORREO_CROP = { left: 56, bottom: 132, right: 300, top: 537 }; // 244 × 405 pt

type Crop = { left: number; bottom: number; right: number; top: number };

// Fixy manda A4 vertical con la etiqueta adentro y el resto en blanco. Desde el layout "FIXYPAY QR"
// (17/08/2026) la etiqueta ya viene dibujada a 9,4 × 14,1 cm, o sea una 10×15 pegada en una hoja A4:
// recortada entra en la térmica SIN escalar, igual que Correo.
// El recorte no puede ser una constante porque conviven 3 layouts (265×399, 516×777 y 537×807 pt) y
// los tres usan la MISMA medida de página, así que no hay forma de distinguirlos por geometría. Pero
// los tres son el mismo generador y dibujan el borde de la etiqueta como un rectángulo gris
// (0,8275) trazado: ese rectángulo ES la etiqueta, y sale del content stream. Se lee por página
// porque el offset cambia de página a página (±3,5 pt entre la 1 y las demás del mismo PDF).
// Sin match (el layout del 06/07 dibuja el borde con 3 rectángulos rellenos) → null → la página sale
// A4 tal cual, que es como salía hasta ahora.
const N = String.raw`(-?[\d.]+)`;
const RE_FLIP = new RegExp(String.raw`([\d.]+) 0 0 -\1 0 ${N} cm`);                    // el volteo de coordenadas del generador
const RE_BORDE = new RegExp(                                                          // el borde gris de la etiqueta
  String.raw`([\d.]+) 0 0 \1 ${N} ${N} cm\s+0?\.8275 0?\.8275 0?\.8275 RG[^]{0,60}?${N} ${N} ${N} ${N} re\s+S`,
);

// Exportada para poder probarla contra los content streams reales sin arrastrar los PDFs al repo.
export function parseFixyBox(contenido: string, alto: number): Crop | null {
  const flip = contenido.match(RE_FLIP), borde = contenido.match(RE_BORDE);
  if (!flip || !borde) return null;
  const f = +flip[1];
  const [, k, tx, ty, x, y, w, h] = borde.map(Number);
  const box = {
    left: f * (k * x + tx),
    right: f * (k * (x + w) + tx),
    top: +flip[2] - f * (k * y + ty),
    bottom: +flip[2] - f * (k * (y + h) + ty),
  };
  // Un recuadro que no cierra o que no entra en la hoja es un falso positivo: mejor no recortar.
  const ancho = box.right - box.left, altoBox = box.top - box.bottom;
  if (ancho <= 0 || altoBox <= 0 || altoBox > alto) return null;
  return box;
}

function fixyCrop(page: PDFPage): Crop | null {
  let box: Crop | null = null;
  try {
    const c = page.node.Contents();
    const partes = c instanceof PDFArray ? c.asArray().map((r) => page.doc.context.lookup(r)) : [c];
    let s = "";
    for (const st of partes) {
      if (!st) continue;
      s += new TextDecoder("latin1").decode(decodePDFRawStream(st as PDFRawStream).decode());
    }
    box = parseFixyBox(s, page.getSize().height);
  } catch {
    // Un content stream que no se puede leer no puede tirar abajo la preparación entera: sin
    // recorte la etiqueta sale A4, que es como salía antes.
    return null;
  }
  if (!box) return null;
  // 2 pt de sangrado: el borde es un trazo centrado en el rectángulo, sin esto se corta al medio.
  return { left: box.left - 2, bottom: box.bottom - 2, right: box.right + 2, top: box.top + 2 };
}

// Recorta la etiqueta de la hoja y la centra en una de 10×15 para la impresora térmica.
async function recortarA10x15(out: PDFDocument, orig: PDFPage, crop: Crop): Promise<PDFPage> {
  const emb = await out.embedPage(orig, crop, [1, 0, 0, 1, -crop.left, -crop.bottom]);
  // Nunca agrandar: 1 es el tamaño con el que el courier diseñó el barcode. Achicar sí, y es lo que
  // pasa con los layouts viejos de Fixy (A4 entera → 0,53): el propio Fixy imprime hoy el barcode a
  // ese tamaño en el layout nuevo, así que es una medida que ya está probada en la calle.
  const s = Math.min(1, OUT_W / emb.width, OUT_H / emb.height);
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

// Arma el PDF de salida con las páginas en el orden pedido. Las de Correo y Fixy se recortan a la
// etiqueta y se llevan a 10×15; el resto se copia tal cual, porque copyPages preserva tamaño y
// orientación y reescalar de más rompe el escaneo del código de barras.
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
    // embedPage necesita la página del documento ORIGEN, no la copiada.
    const orig = docs[p.file].getPage(p.page - 1);
    const crop =
      p.courier === "correo" && esA4Apaisada(copia) ? CORREO_CROP
      : p.courier === "fixy" ? fixyCrop(orig)
      : null;
    let page = copia;
    if (crop) page = await recortarA10x15(out, orig, crop);
    else out.addPage(copia);
    if (p.code && !stampPage(page, p.code, p.courier ?? "?", font)) sinEstampar++;
  }
  return { pdf: await out.save(), sinEstampar };
}
