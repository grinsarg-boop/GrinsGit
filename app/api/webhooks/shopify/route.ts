import { upsertShipmentFromFulfillment, verifyShopifyHmac } from "@/lib/shopify";
import { supabaseAdmin } from "@/lib/supabase";

// orders/create · orders/updated · orders/cancelled · fulfillments/create (§5.2)
export async function POST(req: Request) {
  const raw = await req.text();
  const hmac = req.headers.get("x-shopify-hmac-sha256") ?? "";
  if (!hmac || !verifyShopifyHmac(raw, hmac)) {
    return new Response("invalid hmac", { status: 401 }); // R5
  }

  const topic = req.headers.get("x-shopify-topic") ?? "";
  const p = JSON.parse(raw);
  const db = supabaseAdmin();

  if (topic.startsWith("orders/")) {
    const { error } = await db.rpc("upsert_order", { p });
    if (error) return new Response(error.message, { status: 500 });
  } else if (topic === "fulfillments/create") {
    const dispatched = await upsertShipmentFromFulfillment(p, p.order_id);
    if (dispatched) {
      await db.rpc("recompute_daily_pnl", { p_from: dispatched, p_to: dispatched });
    }
  }
  return Response.json({ ok: true });
}
