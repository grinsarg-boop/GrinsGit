// Pasa PDFs de etiquetas de ML por el MISMO filtro que la pestaña "Etiquetas ML" de /logistica:
// recorta el talón (10×19 → 10×15) y estampa el código de producto. No reimplementa nada: llama a
// las mismas funciones que el componente (`app/(dash)/logistica/etiquetas-ml.tsx`).
//
// Existe porque el componente corre en el navegador y estos PDF salieron de un script
// (scripts/ml-etiquetas.mjs). Misma cadena, sin browser.
//
//   node --env-file=.env.local --import tsx scripts/_ml-etiquetas-filtro.mts docs/etiquetas-ml/*.pdf

import { readFileSync, writeFileSync } from "node:fs";
import { _parsePage, mergeVenta, type Label } from "../lib/label-picking.ts";
import { resolverVenta, type Contexto, type MlVenta, type OrderItem } from "../lib/ml-picking.ts";
import { buildPdf, sortOrder } from "../lib/label-prep.ts";
import { mlLabelsTo10x15, type MlStamp } from "../lib/split-labels.ts";
import { productoCode } from "../lib/correo.ts";
// El token y el SQL salen del helper de scripts, no de lib/ml.ts: esa importa con el alias `@/`,
// que el loader ESM de tsx no resuelve. Es la misma tabla `settings.ml_token` y el mismo refresh.
import { TOKEN as token, sql } from "./_ml.mjs";

const API = "https://api.mercadolibre.com";

// Mismo texto por página que extractLabels() y el MISMO parser (`_parsePage`). Se repite acá solo
// el armado del string porque extractLabels resuelve el worker de pdfjs con `import.meta.resolve`,
// que no existe cuando tsx compila la lib como CJS. La regla de parseo no se toca.
async function leerEtiquetas(buf: ArrayBuffer): Promise<Label[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const out: Label[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const text = content.items.map((it: unknown) => (it && typeof it === "object" && "str" in it ? String((it as { str: string }).str) : ""))
      .join(" ").replace(/\s+/g, " ").trim();
    out.push(_parsePage(text, i));
  }
  return out;
}
const files = process.argv.slice(2).filter((a) => a.endsWith(".pdf"));
if (!files.length) throw new Error("pasá al menos un PDF");

async function mlGet(path: string, token: string) {
  try {
    const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    return { status: r.status, body: r.ok ? await r.json() : null };
  } catch {
    return { status: 0, body: null };
  }
}

// Mismo cruce que /api/ml-picking: la venta puede venir como orden o como pack.
async function itemsDeVenta(id: string, token: string): Promise<{ items: OrderItem[]; error?: string }> {
  const o = await mlGet(`/orders/${id}`, token);
  if (o.status === 200) return { items: o.body.order_items ?? [] };
  if (o.status !== 404) return { items: [], error: `orders ${o.status || "sin respuesta"}` };
  const p = await mlGet(`/packs/${id}`, token);
  if (p.status !== 200) return { items: [], error: "no existe como venta ni como pack" };
  const items: OrderItem[] = [];
  for (const oo of p.body.orders ?? []) {
    const r = await mlGet(`/orders/${oo.id}`, token);
    if (r.status !== 200) return { items: [], error: `orders ${r.status || "sin respuesta"}` };
    items.push(...(r.body.order_items ?? []));
  }
  return { items };
}

// Mismo contexto que arma /api/ml-picking (producto por publicación + pack histórico), en SQL.
async function contexto(): Promise<Contexto> {
  const [ads, packs] = await Promise.all([
    sql("select a.item_id, p.name from ml_ad_items a join products p on p.id = a.product_id"),
    sql("select item_id, pack from ml_pack_por_item(90)"),
  ]);
  const productoPorItem = new Map<string, string>();
  for (const r of ads as { item_id: string; name: string }[]) if (r.item_id && r.name) productoPorItem.set(r.item_id, r.name);
  const packHistorico = new Map<string, number>();
  for (const r of packs as { item_id: string; pack: number }[]) packHistorico.set(r.item_id, Number(r.pack));
  return { productoPorItem, packHistorico };
}

const ctx = await contexto();
const cache = new Map<string, MlVenta>();

async function ventas(ids: string[]) {
  const faltan = [...new Set(ids)].filter((id) => !cache.has(id));
  for (let i = 0; i < faltan.length; i += 8) {
    const tanda = await Promise.all(faltan.slice(i, i + 8).map(async (id) => ({ id, ...await itemsDeVenta(id, token) })));
    for (const { id, items, error } of tanda) {
      cache.set(id, error ? { items: [], producto: null, unidades: null, mixto: false, error } : resolverVenta(items, ctx));
    }
  }
}

for (const f of files) {
  const buf = new Uint8Array(readFileSync(f)).buffer;
  const ls = await leerEtiquetas(buf.slice(0));
  await ventas(ls.map((l) => l.venta).filter((x): x is string => !!x));

  const cr = ls.map((l) => ({ ...mergeVenta(l, l.venta ? cache.get(l.venta) ?? null : null), apiOk: !!(l.venta && !cache.get(l.venta)?.error) }));
  // `ordenar` va SIEMPRE en true: el componente solo estampa el código cuando ordena (el índice de
  // stampByPage es la página ya reordenada). Sin ordenar no hay código, que es justo lo que se pide.
  const orden = sortOrder(cr);
  const { pdf: unido } = await buildPdf([buf.slice(0)], orden.map((i) => ({ file: 0, page: cr[i].page })));
  const stampByPage: MlStamp[] = orden.map((i) => {
    const l = cr[i];
    if (l.revisar || !l.producto || (l.courier !== "ml" && l.courier !== "flex")) return null;
    const code = productoCode({ producto: l.producto, qty: l.unidades ?? 1 });
    return code ? { code, courier: l.courier } : null;
  });

  const { pdf, labels, skipped, sinEstampar } = await mlLabelsTo10x15(unido, { includeTalon: false, stampByPage });
  const out = f.replace(/\.pdf$/i, "_10x15.pdf");
  writeFileSync(out, pdf);
  const sinCodigo = stampByPage.filter((s) => !s).length;
  console.log(`${f.split("/").pop()}: ${ls.length} etiquetas leidas → ${labels} de 10x15 | descartadas ${skipped} | sin codigo ${sinCodigo} | pedido sin estampar ${sinEstampar} | API ok ${cr.filter((l) => l.apiOk).length}/${cr.length}`);
  console.log(`   -> ${out}`);
}
