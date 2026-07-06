import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

export const SHOPIFY_API_VERSION = "2024-10";

// Client credentials grant: el access_token dura 24 h.
// Cache en memoria del proceso (alcanza: cada corrida de sync pide 1 token como mucho).
let cachedToken: { token: string; expiresAt: number } | null = null;

export async function getShopifyToken(force = false): Promise<string> {
  if (!force && cachedToken && cachedToken.expiresAt - Date.now() > 5 * 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: process.env.SHOPIFY_CLIENT_ID!,
        client_secret: process.env.SHOPIFY_CLIENT_SECRET!,
      }),
    },
  );
  if (!res.ok) throw new Error(`Shopify token ${res.status}: ${await res.text()}`);
  const { access_token, expires_in } = await res.json();
  cachedToken = { token: access_token, expiresAt: Date.now() + (expires_in ?? 86400) * 1000 };
  return access_token;
}

// Todo llamado a la Admin API pasa por acá: token cacheado, y si da 401
// (token revocado antes de tiempo) renueva y reintenta una sola vez.
export async function shopifyFetch(url: string): Promise<Response> {
  let res = await fetch(url, {
    headers: { "X-Shopify-Access-Token": await getShopifyToken() },
  });
  if (res.status === 401) {
    res = await fetch(url, {
      headers: { "X-Shopify-Access-Token": await getShopifyToken(true) },
    });
  }
  return res;
}

export function verifyShopifyHmac(rawBody: string, hmacHeader: string): boolean {
  const digest = createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET!)
    .update(rawBody, "utf8")
    .digest("base64");
  const a = Buffer.from(digest);
  const b = Buffer.from(hmacHeader);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Fulfillment = {
  created_at?: string;
  tracking_company?: string | null;
  tracking_number?: string | null;
  tracking_numbers?: string[];
};

// fulfillments/create → shipment (§5.2). Compartido por webhook y backfill.
// Devuelve la fecha de despacho tocada (para recompute) o null si no aplica.
export async function upsertShipmentFromFulfillment(
  f: Fulfillment,
  orderShopifyId: number,
): Promise<string | null> {
  const tracking = f.tracking_number ?? f.tracking_numbers?.[0];
  if (!tracking) return null;

  const db = supabaseAdmin();
  const { data: order } = await db
    .from("orders")
    .select("id, order_number, province, courier")
    .eq("shopify_id", orderShopifyId)
    .maybeSingle();
  if (!order) return null; // el backfill de las 03:00 reconcilia (§5.2)

  const company = (f.tracking_company ?? "").toLowerCase();
  const courier = company.includes("urbano") ? "urbano"
    : company.includes("fixy") ? "fixy"
    : order.courier; // ya clasificado por provincia/CP en upsert_order

  const dispatched = (f.created_at ?? new Date().toISOString()).slice(0, 10);
  const { error } = await db.from("shipments").upsert(
    {
      courier,
      tracking: String(tracking),
      order_id: order.id,
      order_ref: order.order_number,
      province: order.province,
      dispatched_at: dispatched,
    },
    { onConflict: "courier,tracking" },
  );
  if (error) throw new Error(error.message);

  // el courier real del fulfillment manda sobre la clasificación (§5.1)
  if (courier !== order.courier) {
    await db.from("orders").update({ courier }).eq("id", order.id);
  }
  return dispatched;
}
