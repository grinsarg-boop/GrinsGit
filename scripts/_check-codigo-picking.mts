// Self-check del código de depósito: compara el `codigo` que quedó en el índice de un lote ya
// armado (camino viejo de despacho-etiquetas: pedido de Veltron) contra el de lib/picking.ts
// (camino de /logistica?t=preparar). Solo lectura: Shopify.
//
//   node --env-file=.env.local --import tsx scripts/_check-codigo-picking.mts ~/Downloads/"Urbano - 27-09-2026.json"
import fs from "node:fs";
import { codigoDeposito, pickingOrders } from "../lib/picking.ts";
import { shopifyFetch } from "../lib/shopify.ts";

const file = process.argv[2];
if (!file) { console.error("uso: <índice .json de despacho-etiquetas>"); process.exit(1); }
const paginas: { pagina: number; order_number?: string; codigo?: string | null }[] =
  JSON.parse(fs.readFileSync(file, "utf8")).paginas.filter((p: any) => p.order_number);

const t0 = Date.now();
const shopify = new Map((await pickingOrders([...new Set(paginas.map((p) => p.order_number!))], shopifyFetch)).map((o) => [o.orden, o]));
const difs = paginas
  .map((p) => ({ ...p, nuevo: codigoDeposito(shopify.get(p.order_number!)) }))
  .filter((p) => (p.codigo ?? null) !== p.nuevo.code);

for (const d of difs) console.log(`  p.${String(d.pagina).padEnd(4)} #${d.order_number}  viejo ${String(d.codigo ?? "—").padEnd(4)} → nuevo ${d.nuevo.code ?? "—"}  ${d.nuevo.nota}`);
console.log(`\n${paginas.length} páginas · ${paginas.length - difs.length} iguales · ${difs.length} distintas · Shopify ${((Date.now() - t0) / 1000).toFixed(0)}s`);
