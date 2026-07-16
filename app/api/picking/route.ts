import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { shopifyFetch, SHOPIFY_API_VERSION } from "@/lib/shopify";
import { matchProduct } from "@/lib/product-match";

// Igual que /api/correo/pedidos: el middleware saltea /api → validamos la sesión acá.
async function sessionOk(req: NextRequest): Promise<boolean> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = (process.env.ALLOWED_EMAILS ?? "")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return !!user && allowed.includes(user.email?.toLowerCase() ?? "");
}

export const maxDuration = 60; // cruzar ~60 pedidos con Shopify (con reintentos por 429) puede pasar los 10s default

const FIELDS = "name,total_price,tags,line_items";
const COURIERS = ["urbano", "fixy", "correo"] as const;

export type PickingItem = { producto: string | null; unidades: number };
export type PickingOrder = {
  orden: string; encontrado: boolean; error?: boolean; courier: string | null; total: number; items: PickingItem[];
};

export async function GET(req: NextRequest) {
  if (!(await sessionOk(req))) return new NextResponse("unauthorized", { status: 401 });

  const orders = (req.nextUrl.searchParams.get("orders") ?? "")
    .split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean);
  if (!orders.length || orders.length > 60) {
    return NextResponse.json({ error: "pasá 1 a 60 números de pedido" }, { status: 400 });
  }

  const result: PickingOrder[] = [];
  for (const name of orders) {
    const res = await shopifyFetch(
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&name=${name}&fields=${FIELDS}`,
    );
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) return new NextResponse(`shopify auth ${res.status}`, { status: 502 });
      // 429 tras reintentos / 5xx: NO es "no existe", es fallo de consulta → reintentable.
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
      unidades: li.quantity ?? 0,
    }));
    result.push({ orden: name, encontrado: true, courier, total: Number(o.total_price ?? 0), items });
  }
  return NextResponse.json({ orders: result });
}
