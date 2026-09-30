// Ordena y estampa etiquetas de ML (N PDFs crudos de ml-etiquetas.mjs → UN PDF 10x15): código de la app
// (/api/ml-picking → productoCode, NO el pack del título) y orden de Pancho (28/09/2026): unidades asc ›
// producto › (drop-off antes que Flex) › entrada. Nunca mezclar Flex con drop-off: se llama una vez por modo.
//   npx tsx scripts/ml-ordenar.mts <salida.pdf> <salida-indice.json> <crudo.pdf>...
// Nació como script de un solo uso el 29/09/2026 y lo usa el job de Flex de las 11 (scripts/flex-11.sh).
import { readFileSync, writeFileSync } from "node:fs";
const R = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const { _parsePage, mergeVenta } = await import(`${R}/lib/label-picking.ts`);
const { resolverVenta } = await import(`${R}/lib/ml-picking.ts`);
const { buildPdf } = await import(`${R}/lib/label-prep.ts`);
const { mlLabelsTo10x15 } = await import(`${R}/lib/split-labels.ts`);
const { productoCode } = await import(`${R}/lib/correo.ts`);
const { TOKEN: token, sql } = await import(`${R}/scripts/_ml.mjs`);

const [outPdf, outIdx, ...files] = process.argv.slice(2);
const API = "https://api.mercadolibre.com";

async function leer(buf: ArrayBuffer) {
  const pdfjs = await import(`${R}/node_modules/pdfjs-dist/legacy/build/pdf.mjs`);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent();
    out.push(_parsePage(c.items.map((it: any) => it?.str ?? "").join(" ").replace(/\s+/g, " ").trim(), i));
  }
  return out;
}
async function mlGet(path: string) {
  for (let t = 0; t < 3; t++) {
    try {
      const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
      if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 1500 * (t + 1))); continue; }
      return { status: r.status, body: r.ok ? await r.json() : null };
    } catch { /* reintenta */ }
  }
  return { status: 0, body: null };
}
async function itemsDeVenta(id: string) {
  const o = await mlGet(`/orders/${id}`);
  if (o.status === 200) return { items: o.body.order_items ?? [] };
  if (o.status !== 404) return { items: [], error: `orders ${o.status || "sin respuesta"}` };
  const p = await mlGet(`/packs/${id}`);
  if (p.status !== 200) return { items: [], error: "no existe como venta ni como pack" };
  const items: any[] = [];
  for (const oo of p.body.orders ?? []) {
    const r = await mlGet(`/orders/${oo.id}`);
    if (r.status !== 200) return { items: [], error: `orders ${r.status || "sin respuesta"}` };
    items.push(...(r.body.order_items ?? []));
  }
  return { items };
}
const [ads, packs] = await Promise.all([
  sql("select a.item_id, p.name from ml_ad_items a join products p on p.id = a.product_id"),
  sql("select item_id, pack from ml_pack_por_item(90)"),
]);
const ctx = {
  productoPorItem: new Map((ads as any[]).filter((r) => r.item_id && r.name).map((r) => [r.item_id, r.name])),
  packHistorico: new Map((packs as any[]).map((r) => [r.item_id, Number(r.pack)])),
};

const bufs = files.map((f) => new Uint8Array(readFileSync(f)).buffer);
const labels: any[] = [];
for (let fi = 0; fi < files.length; fi++) for (const l of await leer(bufs[fi])) labels.push({ ...l, file: fi });
const ids = [...new Set(labels.map((l) => l.venta).filter(Boolean))] as string[];
const cache = new Map<string, any>();
for (let i = 0; i < ids.length; i += 8) {
  for (const { id, items, error } of await Promise.all(ids.slice(i, i + 8).map(async (id) => ({ id, ...await itemsDeVenta(id) })))) {
    cache.set(id, error ? { items: [], producto: null, unidades: null, mixto: false, error } : resolverVenta(items, ctx));
  }
}
const cr = labels.map((l) => {
  const v = l.venta ? cache.get(l.venta) ?? null : null;
  const m = mergeVenta(l, v);
  const code = !m.revisar && m.producto && (m.courier === "ml" || m.courier === "flex") && m.apiOk
    ? productoCode({ producto: m.producto, qty: m.unidades ?? 1 }) : null;
  return { ...m, file: l.file, code };
});
const orden = cr.map((_, i) => i).sort((a, b) => {
  const A = cr[a], B = cr[b];
  if (!A.code !== !B.code) return A.code ? -1 : 1;              // sin código → al final
  return (A.unidades ?? 0) - (B.unidades ?? 0)
    || (A.producto ?? "").localeCompare(B.producto ?? "")
    || A.file - B.file || a - b;
});
const { pdf: unido } = await buildPdf(bufs.map((b) => b.slice(0)), orden.map((i) => ({ file: cr[i].file, page: cr[i].page })));
const stampByPage = orden.map((i) => (cr[i].code ? { code: cr[i].code, courier: cr[i].courier } : null));
const { pdf, labels: n, skipped, sinEstampar } = await mlLabelsTo10x15(unido, { includeTalon: false, stampByPage });
writeFileSync(outPdf, pdf);
writeFileSync(outIdx, JSON.stringify(orden.map((i, pos) => {
  const c = cr[i];
  return { pos: pos + 1, file: files[c.file].split("/").pop(), page: c.page, courier: c.courier, venta: c.venta, producto: c.producto,
    unidades: c.unidades, code: c.code, apiOk: c.apiOk, difiere: c.difiere, mixto: c.mixto, motivo: c.motivo ?? c.error ?? null,
    tituloProducto: c.producto === undefined ? null : labels[i].producto, tituloUnidades: labels[i].unidades, desglose: c.desglose, items: (cache.get(c.venta)?.items ?? []).map((it: any) => ({ itemId: it.itemId, titulo: it.titulo, pack: it.pack, qty: it.qty, fuente: it.fuente })) };
}), null, 1));
console.log(JSON.stringify({ leidas: labels.length, salida: n, skipped, sinEstampar, sinCodigo: stampByPage.filter((s) => !s).length,
  apiOk: cr.filter((c) => c.apiOk).length, difiere: cr.filter((c) => c.difiere).length }));
