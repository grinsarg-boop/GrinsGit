import { NextResponse, type NextRequest } from "next/server";
import { shopifyFetch } from "@/lib/shopify";
import { pickingOrders, ShopifyAuthError } from "@/lib/picking";
import { sessionOk } from "@/lib/api-session";

export const maxDuration = 60; // cruzar ~60 pedidos con Shopify (con reintentos por 429) puede pasar los 10s default

export type { PickingItem, PickingOrder } from "@/lib/picking";

export async function GET(req: NextRequest) {
  if (!(await sessionOk(req))) return new NextResponse("unauthorized", { status: 401 });

  const orders = (req.nextUrl.searchParams.get("orders") ?? "")
    .split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean);
  if (!orders.length || orders.length > 60) {
    return NextResponse.json({ error: "pasá 1 a 60 números de pedido" }, { status: 400 });
  }
  try {
    return NextResponse.json({ orders: await pickingOrders(orders, shopifyFetch) });
  } catch (e) {
    if (e instanceof ShopifyAuthError) return new NextResponse(e.message, { status: 502 });
    throw e;
  }
}
