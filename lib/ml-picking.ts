// Qué lleva realmente una etiqueta de MercadoLibre, ítem por ítem.
//
// Historia de por qué esto existe y por qué NO usa UNITS_PER_PACK (medido el 22/08/2026 sobre las
// 27 publicaciones activas):
//   - 3 publicaciones tienen el atributo MAL cargado y contradicen al título, que es lo que el
//     comprador compró: "Detox 2x1" y "3x1 Gotas Natures" declaran UNITS_PER_PACK=1, y
//     "Revival Oil 240ml Pack X4" declara 2. Los precios y `ml_orders.pack` confirman 2, 3 y 4.
//   - 3 publicaciones (las de Arraigo) directamente no lo declaran → unidades null → "a revisar".
//   O sea: el atributo del catálogo estaba fallando en 6 de 27 y el parser del título que venía a
//   reemplazar acertaba en 27 de 27.
// Además el P&L cobra el COGS con `parseMlPack` (el título). Resolver la etiqueta con otra regla
// significa que el depósito despacha una cantidad distinta de la que la contabilidad cobró.
// Entonces: la unidad de despacho sale de la MISMA función que el P&L, y el catálogo no se mira.
//
// La otra pata es el producto. `matchProduct` mira palabras clave del título y hay listados que no
// nombran la marca ("X5 Pack Ahorro Drenaje Linfático…", 68 ventas en 60 días): para esos manda el
// mapa `ml_ad_items` (item_id → producto), que ya existe para atribuir la pauta de ML.

import { matchProduct } from "./product-match";
import { packFijo, parseMlPack } from "./ml";

export type OrderItem = { quantity?: number; item?: { id?: string; title?: string } };

export type VentaItem = {
  itemId: string | null;
  titulo: string;
  producto: string | null;   // null = ninguna keyword ni ml_ad_items lo resuelve
  pack: number | null;       // unidades por publicación; null = el título no lo dice y no hay histórico
  qty: number;               // cuántas veces compró ESA publicación (ML lo llama quantity)
  unidades: number | null;   // qty × pack
  fuente: "titulo" | "override" | "historico" | "?";
};

export type MlVenta = {
  items: VentaItem[];
  // Agregado, para el caso normal de un solo producto (el 99%: una etiqueta = un producto).
  producto: string | null;
  unidades: number | null;
  mixto: boolean;            // más de un producto distinto en la venta/pack
  motivo?: string;           // por qué no se pudo resolver (nombra la publicación, no dice "revisá")
  error?: string;            // no se pudo consultar → vale el parser del título de la etiqueta
};

// Medidas del envase, para no confundirlas con un pack: "30ml", "240 ml", "30cc", "50 g".
const MEDIDA = /\d+\s*(?:ml|cc|cm|mm|kg|g|mg|lt|l)\b/gi;

// ¿El título DICE la cantidad, o `parseMlPack` cayó a su default de 1?
// parseMlPack devuelve 1 tanto para "Gotas Pureza" (que es x1 de verdad) como para un título de
// catálogo que no dice nada (que puede ser un 2-pack). Los dos casos no se pueden tratar igual:
// el segundo es despachar de menos en silencio, que es justo lo que se viene a eliminar.
export function packExplicito(titulo: string): boolean {
  const t = (titulo ?? "").replace(MEDIDA, " ");
  return /^\s*\d{1,2}\s/.test(t) || /\d{1,2}\s*[xX]\s*\d/.test(t) || /[xX]\s*\d{1,2}/.test(t) || /\d{1,2}\s*u\b/i.test(t);
}

export type Contexto = {
  productoPorItem: Map<string, string>;  // ml_ad_items → producto (para los títulos sin marca)
  packHistorico: Map<string, number>;    // item_id → pack con el que ese listado se viene vendiendo
  packOverride?: (itemId: string | null, titulo: string) => number | null;
};

// Resuelve UN ítem de la venta. Nunca inventa: si no puede, deja null y dice por qué.
export function resolverItem(it: OrderItem, ctx: Contexto): VentaItem {
  const itemId = it.item?.id ?? null;
  const titulo = it.item?.title ?? "";
  const qty = it.quantity ?? 1;
  const producto = matchProduct(titulo) ?? (itemId ? ctx.productoPorItem.get(itemId) ?? null : null);

  // 1) Override por publicación (PACK_POR_ITEM, dentro de parseMlPack) o el título, que es lo que
  //    compró el cliente y lo que el P&L ya cobra.
  const porTitulo = parseMlPack(titulo, itemId);
  const explicito = packExplicito(titulo);
  // El pack fijo por publicación (PACK_POR_ITEM) va ANTES que el histórico: el 17-20/09/2026 la x3
  // de catálogo vino con el nombre del catálogo, el histórico ya estaba contaminado por el mismo
  // parser y 48 etiquetas salieron con 1. El override por id no depende de lo que se haya guardado.
  const override = ctx.packOverride?.(itemId, titulo) ?? packFijo(itemId);
  if (override != null) return { itemId, titulo, producto, pack: override, qty, unidades: qty * override, fuente: "override" };
  if (explicito) return { itemId, titulo, producto, pack: porTitulo, qty, unidades: qty * porTitulo, fuente: "titulo" };

  // 2) El título no dice nada. Antes de asumir 1, preguntarle al histórico: si esa publicación
  //    viene vendiéndose como x5, el que está mal es el título, no las 68 ventas anteriores.
  const hist = itemId ? ctx.packHistorico.get(itemId) : undefined;
  if (hist != null) return { itemId, titulo, producto, pack: hist, qty, unidades: qty * hist, fuente: "historico" };

  // 3) Sin señal en ningún lado. Un listado nuevo sin número en el título: 1 es lo más probable,
  //    pero es una suposición y se marca como tal (fuente "?") para que el panel la nombre.
  return { itemId, titulo, producto, pack: 1, qty, unidades: qty, fuente: "?" };
}

export function resolverVenta(items: OrderItem[], ctx: Contexto): MlVenta {
  const res = items.map((it) => resolverItem(it, ctx));
  const prods = [...new Set(res.map((r) => r.producto).filter((p): p is string => !!p))];
  const sinProducto = res.filter((r) => !r.producto);
  const dudosos = res.filter((r) => r.fuente === "?");
  const unidades = res.reduce<number | null>((s, r) => (s == null || r.unidades == null ? null : s + r.unidades), 0);

  const motivos: string[] = [];
  if (sinProducto.length) {
    motivos.push(`publicación sin producto reconocido: ${sinProducto.map((r) => `${r.itemId ?? "?"} "${r.titulo}"`).join(" · ")}`);
  }
  if (dudosos.length) {
    motivos.push(`el título no dice las unidades y la publicación no tiene histórico: ${dudosos.map((r) => `${r.itemId ?? "?"} "${r.titulo}"`).join(" · ")}`);
  }
  return {
    items: res,
    producto: prods.length === 1 ? prods[0] : null,
    unidades,
    mixto: prods.length > 1,
    motivo: motivos.length ? motivos.join(" | ") : undefined,
  };
}

// Desglose por producto de una venta (sirve igual para una venta simple que para una mixta:
// la mixta deja de ser "sin identificar" y pasa a contarse producto por producto).
export function porProducto(v: MlVenta): { producto: string; unidades: number }[] {
  const m = new Map<string, number>();
  for (const it of v.items) {
    if (!it.producto || it.unidades == null) continue;
    m.set(it.producto, (m.get(it.producto) ?? 0) + it.unidades);
  }
  return [...m.entries()].map(([producto, unidades]) => ({ producto, unidades }));
}
