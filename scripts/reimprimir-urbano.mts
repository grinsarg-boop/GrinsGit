// Reimprime etiquetas de Urbano YA dadas de alta, por guía, sin tocar Veltron ni crear nada:
// baja cada una de apis.urbano.com.ar (mismo endpoint que Veltron), la ordena y le estampa el
// código de producto con lib/label-prep.ts, igual que /logistica?t=preparar. Nació para las
// huérfanas (alta sin admisión: 11/09 y 18/09/2026), que hay que volver a mandar con la MISMA guía.
//
//   node --env-file=.env.local --import tsx scripts/reimprimir-urbano.mts --guias ~/Downloads/huerfanas-urbano-2026-09-18.csv
//
// Solo lectura: Supabase (producto y unidades) y Urbano (etiqueta). El PDF va a Descargas.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { buildPdf, sortOrder, type OutPage } from "../lib/label-prep.ts";
import { productoCode, unidadesGuiadas } from "../lib/correo.ts";
import { matchProduct } from "../lib/product-match.ts";

const arg = (k: string) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : undefined; };
const csv = arg("guias");
if (!csv) { console.error("uso: --guias <csv con una guía por línea> [--out DIR]"); process.exit(1); }
const guias = fs.readFileSync(csv, "utf8").split(/\r?\n/).map((s) => s.trim()).filter((s) => /^BLABS\d+/.test(s));
const OUT_DIR = arg("out") ?? path.join(os.homedir(), "Downloads");

// La guía es BLABS<nº de orden>[R<n>] (código propio desde 04/08/2026): el pedido sale de ahí.
const ordenDe = (g: string) => g.replace(/^BLABS/, "").replace(/R\d+$/, "");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();
// Misma query que scripts/redespacho.mjs: producto y unidades físicas desde order_items.
const { rows } = await db.query(
  `select o.order_number, o.total,
          (select sum(oi.pack) from order_items oi where oi.order_id = o.id) as unidades,
          -- title_raw y no products.name: el matcher busca la keyword del título ("reafirmante"),
          -- y el name canónico de M3 es "M3", que no matchea nada.
          (select string_agg(distinct oi.title_raw, ' + ') from order_items oi where oi.order_id = o.id) as producto
     from orders o where o.order_number = any($1::text[])`,
  [guias.map(ordenDe)],
);
await db.end();
const porOrden = new Map(rows.map((r) => [String(r.order_number), r]));

type It = { guia: string; producto: string | null; unidades: number | null; code: string | null };
const items: It[] = guias.map((guia) => {
  const r = porOrden.get(ordenDe(guia));
  const producto = r ? matchProduct(String(r.producto ?? "")) : null;
  const unidades = r ? unidadesGuiadas(producto, Number(r.unidades) || 0, Number(r.total)) || null : null;
  return { guia, producto, unidades, code: producto && unidades ? productoCode({ producto, qty: unidades }) : null };
});

const urlUrbano = (guia: string) =>
  `https://apis.urbano.com.ar/impresionEtiqueta/?tipo=Z10X15&shipper=${process.env.URBANO_SHIPPER ?? "4362"}&codSeguimiento=${encodeURIComponent(guia)}`;

const sources: ArrayBuffer[] = [];
const fallidas: string[] = [];
for (let k = 0; k < items.length; k += 5) {
  await Promise.all(items.slice(k, k + 5).map(async (it, j) => {
    const r = await fetch(urlUrbano(it.guia), { signal: AbortSignal.timeout(60_000) }).catch(() => null);
    const bytes = r?.ok ? await r.arrayBuffer() : null;
    if (!bytes || !new TextDecoder("latin1").decode(bytes.slice(0, 5)).startsWith("%PDF")) { fallidas.push(it.guia); return; }
    sources[k + j] = bytes;
  }));
  process.stdout.write(`\r  bajadas ${Math.min(k + 5, items.length)}/${items.length}`);
}
console.log();

const orden = sortOrder(items).filter((i) => sources[i]);
const pages: OutPage[] = orden.map((i) => ({ file: i, page: 1, courier: "urbano", code: items[i].code }));
const { pdf, sinEstampar } = await buildPdf(sources.map((s) => s ?? new ArrayBuffer(0)), pages);

const stamp = new Date().toISOString().slice(0, 10);
const destino = path.join(OUT_DIR, `etiquetas-reimpresas-urbano-${orden.length}-${stamp}.pdf`);
fs.writeFileSync(destino, pdf);

for (const i of orden) console.log(`  ${String(items[i].code ?? "—").padEnd(4)} ${items[i].guia}  ${items[i].producto ?? "?"} ${items[i].unidades ?? "?"}u`);
const sinCode = orden.filter((i) => !items[i].code);
if (sinCode.length) console.log(`\n⚠️ ${sinCode.length} sin código (producto no reconocido o sin ítems en la base): van al final.`);
if (sinEstampar) console.log(`⚠️ ${sinEstampar} con geometría desconocida: sin estampar.`);
if (fallidas.length) console.log(`✗ ${fallidas.length} no bajaron de Urbano: ${fallidas.join(", ")}`);
console.log(`\netiquetas → ${destino} · ${orden.length} página(s)`);
