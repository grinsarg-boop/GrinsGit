// Prepara el PDF de rótulos que devuelve Mi Correo después de subir el CSV de carga masiva: recorta
// cada A4 apaisada a 10×15, ordena como arma el depósito y estampa el código (P2 = Pureza x2).
// Es lo mismo que hace /logistica?t=preparar, pero con los códigos de un índice y no de Shopify:
// un reenvío parcial (1 unidad de un pedido de 2) en el panel saldría con el código del pedido.
//
// Uso:
//   npx tsx scripts/correo-rotulos.mts ~/Downloads/rotulos.pdf ~/Downloads/correo_SUBIR_carga_masiva_2026-09-11.json
// El índice es [{ orden, codigo, producto, un }] — lo deja el armado del CSV. Sale en ~/Downloads.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { buildPdf, sortOrder } from "../lib/label-prep.ts";

// Igual que extractOrders de lib/correo-pdf.ts, pero esa resuelve el worker con import.meta.resolve,
// que tsx no tiene; acá el worker se resuelve por require.
// El SEGUIMIENTO de Correo es el TN (23 caracteres: "TN 000149421160E430TI8C101"). El "T&T HC…AR" es el
// código de etiqueta: cargarlo en Veltron le mandó al cliente un seguimiento que no existe (28/09/2026,
// 38 pedidos). Por eso el CSV para `importar_csv_guias` sale de acá, y sólo con TN.
const TN = /\bTN\s+([0-9A-Z]{23})\b/;
const tns: (string | null)[] = [];
async function ordenesPorPagina(data: ArrayBuffer): Promise<(string | null)[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = createRequire(import.meta.url).resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  const doc = await pdfjs.getDocument({ data: data.slice(0) }).promise;
  const out: (string | null)[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const text = (await (await doc.getPage(i)).getTextContent()).items.map((it) => ("str" in it ? it.str : "")).join(" ");
    out.push(text.match(/#(\d{4,6})/)?.[1] ?? null);
    tns.push(text.match(TN)?.[1] ?? null);
  }
  return out;
}

const [pdfPath, indicePath] = process.argv.slice(2);
if (!pdfPath || !indicePath) { console.error("uso: correo-rotulos.mts <rotulos.pdf> <indice.json>"); process.exit(1); }
const indice = new Map<string, { codigo: string | null; producto: string | null; un: number }>(
  JSON.parse(fs.readFileSync(indicePath, "utf8")).map((i: any) => [String(i.orden), i]),
);
const src = fs.readFileSync(pdfPath);
const ordenes = await ordenesPorPagina(src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer);
const keys = ordenes.map((o) => { const i = o ? indice.get(o) : null; return { producto: i?.producto ?? null, unidades: i?.un ?? null }; });
const pages = sortOrder(keys).map((p) => ({ file: 0, page: p + 1, courier: "correo" as const, code: ordenes[p] ? indice.get(ordenes[p]!)?.codigo ?? null : null }));
const { pdf, sinEstampar } = await buildPdf([src.buffer.slice(src.byteOffset, src.byteOffset + src.byteLength) as ArrayBuffer], pages);

const stamp = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" });
let out = path.join(os.homedir(), "Downloads", `correo-rotulos-${stamp}.pdf`);
for (let n = 2; fs.existsSync(out); n++) out = path.join(os.homedir(), "Downloads", `correo-rotulos-${stamp}-${n}.pdf`);
fs.writeFileSync(out, pdf);
const sinOrden = ordenes.filter((o) => !o).length, sinIndice = ordenes.filter((o) => o && !indice.has(o)).length;
console.log(`rótulos → ${out} · ${pages.length} página(s)`);
pages.forEach((p, i) => console.log(`  ${String(i + 1).padStart(3)}  #${ordenes[p.page - 1] ?? "?"}  ${p.code ?? "—"}`));
if (sinOrden) console.error(`⚠️ ${sinOrden} página(s) sin nº de pedido legible: van al final, sin código`);
if (sinIndice) console.error(`⚠️ ${sinIndice} pedido(s) que no están en el índice: sin código`);
if (sinEstampar) console.error(`⚠️ ${sinEstampar} sin estampar: geometría de página no reconocida`);

// CSV para Veltron (`validar_csv_guias` → `importar_csv_guias`): referencia,carrier,guia = orden,correo,TN.
const filas = ordenes.map((o, i) => ({ o, tn: tns[i] }));
const malas = filas.filter((f) => !f.o || !f.tn || /^HC/i.test(f.tn));
if (malas.length) {
  console.error(`⛔ ${malas.length} página(s) sin #pedido o sin TN: NO se escribe el CSV de Veltron. Revisar a mano (nunca cargar el HC).`);
  process.exit(1);
}
const csv = path.join(path.dirname(out), path.basename(out, ".pdf") + "-veltron-guias.csv");
fs.writeFileSync(csv, "referencia,carrier,guia\n" + filas.map((f) => `${f.o},correo,${f.tn}`).join("\n") + "\n");
console.log(`guías para Veltron (TN, no HC) → ${csv}`);
