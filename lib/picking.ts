// El código de depósito de un pedido COD (S3 = Arraigo x3), calculado por UN solo camino: el de
// /logistica?t=preparar. Shopify (line_items con unidadesLinea) → un producto único por pedido →
// unidadesGuiadas → productoCode. La usan /api/picking, preparar.tsx y los scripts de etiquetas
// (despacho-etiquetas, redespacho, reimprimir-urbano) — regla de Pancho del 28/09/2026: el código
// no se deduce del pedido de Veltron ni de order_items, sale siempre de acá.
// Sin imports de servidor a propósito: preparar.tsx corre en el navegador. El fetch a Shopify se
// recibe por parámetro (shopifyFetch de lib/shopify.ts del lado del server y de los scripts).
import { productoCode, unidadesGuiadas } from "./correo";
import { matchProduct, unidadesLinea } from "./product-match";

export type PickingItem = { producto: string | null; unidades: number };
export type PickingOrder = {
  orden: string; encontrado: boolean; error?: boolean; courier: string | null; total: number; items: PickingItem[];
};

const FIELDS = "name,total_price,tags,line_items";
const COURIERS = ["urbano", "fixy", "correo"] as const;

export class ShopifyAuthError extends Error {}

// Un pedido por request (la búsqueda por name no acepta lista). 401/403 corta todo: es la
// credencial, no el pedido. 429 tras reintentos / 5xx NO es "no existe": queda error → reintentable.
export async function pickingOrders(
  names: string[],
  fetcher: (url: string) => Promise<Response>,
): Promise<PickingOrder[]> {
  const result: PickingOrder[] = [];
  for (const name of names) {
    // ponytail: versión repetida de SHOPIFY_API_VERSION (lib/shopify.ts no se puede importar acá: es de servidor).
    const res = await fetcher(
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/2024-10/orders.json?status=any&name=${name}&fields=${FIELDS}`,
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new ShopifyAuthError(`shopify auth ${res.status}`);
      result.push({ orden: name, encontrado: false, error: true, courier: null, total: 0, items: [] });
      continue;
    }
    const { orders: found } = await res.json();
    const o = found?.find((x: { name: string }) => x.name === `#${name}`) ?? found?.[0];
    if (!o) {
      result.push({ orden: name, encontrado: false, courier: null, total: 0, items: [] });
      continue;
    }
    const tags = String(o.tags ?? "").toLowerCase();
    const courier = COURIERS.find((c) => new RegExp(`(^|,|\\s)${c}(,|\\s|$)`).test(tags)) ?? null;
    const items: PickingItem[] = (o.line_items ?? []).map((li: { title?: string; quantity?: number }) => ({
      producto: matchProduct(li.title ?? ""),
      unidades: unidadesLinea(li.title ?? "", li.quantity ?? 0),
    }));
    result.push({ orden: name, encontrado: true, courier, total: Number(o.total_price ?? 0), items });
  }
  return result;
}

// Producto, unidades y código de un pedido ya cruzado. Solo si TODOS los ítems reconocidos son el
// mismo producto (audit C#3); las unidades suman todas las líneas, como siempre hizo preparar.
// `nota` dice por qué no hay código — sin código la etiqueta va al final, para resolver a mano.
export function codigoDeposito(o: PickingOrder | undefined): {
  producto: string | null; unidades: number | null; code: string | null; nota: string;
} {
  const nada = (nota: string) => ({ producto: null, unidades: null, code: null, nota });
  if (!o || o.error) return nada("error al consultar Shopify — reintentá");
  if (!o.encontrado) return nada("no existe en Shopify");
  const prods = [...new Set(o.items.map((i) => i.producto).filter(Boolean))] as string[];
  if (prods.length !== 1) return nada("carrito mixto o sin producto — poné el código a mano");
  const producto = prods[0];
  const unidades = unidadesGuiadas(producto, o.items.reduce((s, i) => s + i.unidades, 0), o.total);
  return { producto, unidades, code: productoCode({ producto, qty: unidades }), nota: "" };
}
