import { NextResponse, type NextRequest } from "next/server";
import { shopifyFetch, SHOPIFY_API_VERSION } from "@/lib/shopify";
import { pickProducto, type ShopifyPedido } from "@/lib/correo";
import { sessionOk } from "@/lib/api-session";

const FIELDS = "name,total_price,email,phone,shipping_address,customer,line_items";

export async function GET(req: NextRequest) {
  if (!(await sessionOk(req))) return new NextResponse("unauthorized", { status: 401 });

  const orders = (req.nextUrl.searchParams.get("orders") ?? "")
    .split(/[,\s]+/).map((s) => s.replace(/\D/g, "")).filter(Boolean);
  if (!orders.length || orders.length > 60) {
    return NextResponse.json({ error: "pasá 1 a 60 números de pedido" }, { status: 400 });
  }

  const pedidos: ShopifyPedido[] = [];
  const notFound: string[] = [];
  for (const name of orders) {
    const res = await shopifyFetch(
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?status=any&name=${name}&fields=${FIELDS}`,
    );
    if (!res.ok) {
      // Auth (token/permiso) aborta el lote: nada va a andar. Otros (429/5xx/red) NO abortan — ese
      // pedido queda sin resolver y seguimos con el resto (audit C#9, antes un 502 tiraba todo).
      if (res.status === 401 || res.status === 403) return new NextResponse(`shopify auth ${res.status}`, { status: 502 });
      notFound.push(name);
      continue;
    }
    const { orders: found } = await res.json();
    const o = found?.find((x: { name: string }) => x.name === `#${name}`) ?? found?.[0];
    if (!o) { notFound.push(name); continue; }
    const a = o.shipping_address ?? o.customer?.default_address ?? {};
    const { producto, qty } = pickProducto(o.line_items ?? []);
    pedidos.push({
      orden: name,
      nombre: a.name || `${a.first_name ?? ""} ${a.last_name ?? ""}`.trim(),
      email: o.email ?? "",
      telefono: a.phone || o.phone || o.customer?.phone || "",
      total: String(o.total_price ?? ""),
      provincia: a.province_code ?? "",
      localidad: a.city ?? "",
      address1: a.address1 ?? "",
      address2: a.address2 ?? "",
      zip: a.zip ?? "",
      producto,
      qty,
    });
  }
  return NextResponse.json({ pedidos, notFound });
}
