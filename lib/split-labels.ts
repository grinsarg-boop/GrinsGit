import { PDFDocument, StandardFonts } from "pdf-lib";
import { stampPage } from "./label-prep";
import type { LabelCourier } from "./label-picking";

// Etiquetas de Mercado Envíos (Flex): páginas de 10x19 cm = talón de producto
// arriba (4 cm, "recortá esta parte") + etiqueta 10x15 abajo. Al final del PDF
// masivo viene una hoja A4 de resumen. Salida: 10x15 cm, 1 etiqueta por página.
const CM = 28.3465;
const OUT_W = 10 * CM;
const OUT_H = 15 * CM;
const TOL = 3; // pt de tolerancia al comparar tamaños

export type MlSplitResult = {
  pdf: Uint8Array;
  labels: number; // etiquetas emitidas
  skipped: number; // páginas descartadas (hoja resumen A4 u otros tamaños)
  sinEstampar: number; // con código pedido pero geometría no validada (ver STAMP en label-prep)
};

// stampByPage[i] = qué estampar en la página i (0-indexed) del PDF de ENTRADA. Se estampa acá y no
// afuera porque acá es el único lugar donde se sabe qué página de salida vino de cuál de entrada:
// las descartadas y el talón rompen la correspondencia posicional.
// El courier viene del que llama porque Flex y Colecta tienen el MISMO tamaño y distinto layout:
// la geometría sola no alcanza para elegir dónde va el código (ver STAMP en label-prep.ts).
export type MlStamp = { code: string; courier: LabelCourier } | null;

export async function mlLabelsTo10x15(
  input: Uint8Array | ArrayBuffer,
  { includeTalon = false, stampByPage = [] }: { includeTalon?: boolean; stampByPage?: MlStamp[] } = {}
): Promise<MlSplitResult> {
  const src = await PDFDocument.load(input, { ignoreEncryption: true });
  const out = await PDFDocument.create();
  const font = stampByPage.some(Boolean) ? await out.embedFont(StandardFonts.HelveticaBold) : null;
  let labels = 0;
  let skipped = 0;
  let sinEstampar = 0;

  const pages = src.getPages();
  for (let i = 0; i < pages.length; i++) {
    const { width, height } = pages[i].getSize();
    if (Math.abs(width - OUT_W) > TOL) {
      skipped++;
      continue;
    }
    const s = stampByPage[i];
    const marcar = (page: ReturnType<typeof out.addPage>) => {
      if (s && font && !stampPage(page, s.code, s.courier, font)) sinEstampar++;
    };

    if (height <= OUT_H + TOL) {
      // ya es 10x15: pasa tal cual
      const [copied] = await out.copyPages(src, [i]);
      out.addPage(copied);
      marcar(copied);
      labels++;
      continue;
    }

    const embed = (bottom: number, top: number) =>
      out.embedPage(
        pages[i],
        { left: 0, right: width, bottom, top },
        // normaliza el origen del recorte a (0,0)
        [1, 0, 0, 1, 0, -bottom]
      );

    const label = await embed(0, OUT_H);
    const hoja = out.addPage([OUT_W, OUT_H]);
    hoja.drawPage(label, { x: 0, y: 0 });
    marcar(hoja); // el talón (que dice el producto) se recorta: el código va en la etiqueta
    labels++;

    if (includeTalon) {
      const talon = await embed(OUT_H, height);
      // talón (4cm) arriba de su propia hoja 10x15
      out.addPage([OUT_W, OUT_H]).drawPage(talon, { x: 0, y: OUT_H - talon.height });
    }
  }

  return { pdf: await out.save(), labels, skipped, sinEstampar };
}
