import { NextResponse, type NextRequest } from "next/server";
import { getMlAccessToken } from "@/lib/ml";
import { matchAllProducts } from "@/lib/product-match";
import { sessionOk } from "@/lib/api-session";
import type { MlVenta } from "@/lib/label-picking";

// Producto + unidades REALES de una venta de ML, desde la API — el equivalente de /api/picking
// (que cruza los pedidos COD contra Shopify) para las etiquetas de ML/Flex, que hasta ahora
// deducían el pack leyendo el título de la publicación.
// Las unidades salen de UNITS_PER_PACK de la publicación × quantity de la orden. Ojo: `quantity`
// NO es el pack (es cuántas publicaciones compró), y `order_items[].item.attributes` viene vacío
// → hay que traerse las publicaciones aparte (multiget, cacheado por request).
const API = "https://api.mercadolibre.com";

export const maxDuration = 60; // ~100 ventas × (1 GET /orders + a veces /packs) puede pasar los 10s

type OrderItem = { quantity?: number; item?: { id?: string; title?: string } };

async function mlGet(path: string, token: string) {
  const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: r.status, body: r.ok ? await r.json() : null };
}

// El id de la etiqueta puede ser de venta o de pack (ambos 20000…, indistinguibles a ojo).
// Se prueba como orden y, si no existe, como pack → sus órdenes.
async function itemsDeVenta(id: string, token: string): Promise<{ items: OrderItem[]; error?: string }> {
  const o = await mlGet(`/orders/${id}`, token);
  if (o.status === 200) return { items: o.body.order_items ?? [] };
  if (o.status !== 404) return { items: [], error: `orders ${o.status}` };

  const p = await mlGet(`/packs/${id}`, token);
  if (p.status !== 200) return { items: [], error: `no existe como venta ni como pack` };
  const items: OrderItem[] = [];
  for (const oo of p.body.orders ?? []) {
    const r = await mlGet(`/orders/${oo.id}`, token);
    if (r.status !== 200) return { items: [], error: `orders ${r.status}` };
    items.push(...(r.body.order_items ?? []));
  }
  return { items };
}

// UNITS_PER_PACK por publicación. Multiget de a 20 (tope de ML); un día de despacho son ~10
// publicaciones distintas para ~100 etiquetas, así que esto es 1 sola llamada.
async function unidadesPorPack(ids: string[], token: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  for (let i = 0; i < ids.length; i += 20) {
    const { body } = await mlGet(`/items?ids=${ids.slice(i, i + 20).join(",")}&attributes=id,attributes`, token);
    for (const e of body ?? []) {
      const attr = (e.body?.attributes ?? []).find((a: { id?: string }) => a.id === "UNITS_PER_PACK");
      const n = parseInt(attr?.value_name ?? "", 10);
      if (e.body?.id && n >= 1 && n <= 99) out.set(e.body.id, n);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!(await sessionOk(req))) return new NextResponse("unauthorized", { status: 401 });

  const ids = [...new Set(
    (req.nextUrl.searchParams.get("ids") ?? "").split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean),
  )];
  if (!ids.length || ids.length > 100) {
    return NextResponse.json({ error: "pasá 1 a 100 ids de venta de ML" }, { status: 400 });
  }

  let token: string;
  try {
    token = await getMlAccessToken();
  } catch (e) {
    // Sin token no hay nada que devolver: el cliente cae al parser del título.
    return new NextResponse(`ML auth: ${e instanceof Error ? e.message : String(e)}`, { status: 502 });
  }

  // De a 8 en paralelo: 100 secuenciales no entran en los 60s y 100 juntas es rate-limit seguro.
  const porVenta: { id: string; items: OrderItem[]; error?: string }[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    porVenta.push(...await Promise.all(
      ids.slice(i, i + 8).map(async (id) => ({ id, ...await itemsDeVenta(id, token) })),
    ));
  }

  const upp = await unidadesPorPack(
    [...new Set(porVenta.flatMap((v) => v.items.map((it) => it.item?.id).filter((x): x is string => !!x)))],
    token,
  );

  const ventas: Record<string, MlVenta> = {};
  for (const { id, items, error } of porVenta) {
    if (error) { ventas[id] = { producto: null, unidades: null, mixto: false, error }; continue; }
    const prods = matchAllProducts(items.map((it) => it.item?.title ?? "").join(" | "));
    // Una publicación sin UNITS_PER_PACK deja las unidades en null (NO en 0 ni en quantity):
    // suponer acá es despachar de menos en silencio, que es lo que se venía a arreglar.
    const unidades = items.reduce<number | null>((s, it) => {
      const n = upp.get(it.item?.id ?? "");
      return s == null || n == null ? null : s + (it.quantity ?? 0) * n;
    }, 0);
    ventas[id] = { producto: prods.length === 1 ? prods[0] : null, unidades, mixto: prods.length > 1 };
  }
  return NextResponse.json({ ventas });
}
