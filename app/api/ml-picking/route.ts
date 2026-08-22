import { NextResponse, type NextRequest } from "next/server";
import { getMlAccessToken } from "@/lib/ml";
import { sessionOk } from "@/lib/api-session";
import { supabaseAdmin } from "@/lib/supabase";
import { resolverVenta, type Contexto, type MlVenta, type OrderItem } from "@/lib/ml-picking";

// Producto + unidades REALES de una venta de ML, desde la API — el equivalente de /api/picking
// (que cruza los pedidos COD contra Shopify) para las etiquetas de ML/Flex.
//
// La regla de resolución vive en lib/ml-picking.ts (ahí está el porqué de no usar UNITS_PER_PACK,
// que estaba mal o ausente en 6 de las 27 publicaciones activas el 22/08/2026). Acá solo se junta
// lo que esa regla necesita:
//   · la venta en vivo (/orders o /packs) — y si la API no responde, la copia de ml_orders;
//   · ml_ad_items → producto, para los listados que no nombran la marca en el título;
//   · ml_pack_por_item() → con qué pack se viene vendiendo cada publicación, para no asumir 1
//     cuando el título no dice nada.
const API = "https://api.mercadolibre.com";

export const maxDuration = 60; // ~100 ventas × (1 GET /orders + a veces /packs) puede pasar los 10s

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

// Contexto compartido por todas las ventas del request: 2 consultas, no una por etiqueta.
async function contexto(): Promise<Contexto> {
  const db = supabaseAdmin();
  const [ads, packs] = await Promise.all([
    db.from("ml_ad_items").select("item_id, products(name)"),
    db.rpc("ml_pack_por_item", { p_days: 90 }),
  ]);
  const productoPorItem = new Map<string, string>();
  for (const r of (ads.data ?? []) as { item_id: string; products: { name: string } | { name: string }[] | null }[]) {
    const name = Array.isArray(r.products) ? r.products[0]?.name : r.products?.name;
    if (r.item_id && name) productoPorItem.set(r.item_id, name);
  }
  const packHistorico = new Map<string, number>();
  for (const r of (packs.data ?? []) as { item_id: string; pack: number }[]) packHistorico.set(r.item_id, r.pack);
  return { productoPorItem, packHistorico };
}

// Copia local de la venta, para cuando la API de ML no contesta. Es la misma orden (la sincroniza
// el cron diario), así que la regla de resolución es idéntica: no hay una segunda verdad.
async function desdeBase(ids: string[]): Promise<Map<string, OrderItem[]>> {
  const out = new Map<string, OrderItem[]>();
  const numericos = ids.filter((id) => /^\d+$/.test(id) && id.length <= 18);
  if (!numericos.length) return out;
  const { data } = await supabaseAdmin().from("ml_orders").select("ml_id, raw").in("ml_id", numericos);
  for (const r of (data ?? []) as { ml_id: number; raw: { order_items?: OrderItem[] } }[]) {
    out.set(String(r.ml_id), r.raw?.order_items ?? []);
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

  const ctx = await contexto();

  // De a 8 en paralelo: 100 secuenciales no entran en los 60s y 100 juntas es rate-limit seguro.
  const porVenta: { id: string; items: OrderItem[]; error?: string }[] = [];
  for (let i = 0; i < ids.length; i += 8) {
    porVenta.push(...await Promise.all(
      ids.slice(i, i + 8).map(async (id) => ({ id, ...await itemsDeVenta(id, token) })),
    ));
  }

  // Rescate por la base solo de las que la API no pudo dar (normalmente ninguna).
  const fallidas = porVenta.filter((v) => v.error).map((v) => v.id);
  const base = fallidas.length ? await desdeBase(fallidas) : new Map<string, OrderItem[]>();

  const ventas: Record<string, MlVenta> = {};
  for (const { id, items, error } of porVenta) {
    const rescate = error ? base.get(id) : undefined;
    if (error && !rescate?.length) {
      ventas[id] = { items: [], producto: null, unidades: null, mixto: false, error };
      continue;
    }
    const v = resolverVenta(rescate ?? items, ctx);
    ventas[id] = rescate ? { ...v, motivo: [`${error} — resuelto con la copia de ml_orders`, v.motivo].filter(Boolean).join(" | ") } : v;
  }
  return NextResponse.json({ ventas });
}
