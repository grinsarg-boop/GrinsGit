import { getShopifyToken, SHOPIFY_API_VERSION } from "@/lib/shopify";

// "Micro Veltron": recibe el form COD de la landing y crea la orden en Shopify
// por Admin API (pago contra entrega, financial_status pending). Cuando haya
// tenant de Veltron, la landing apunta a su webhook y esta ruta queda de respaldo.

const ORIGIN = process.env.PEDIDO_ORIGIN ?? "*"; // dominio de la landing (CORS)
const cors = {
  "access-control-allow-origin": ORIGIN,
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

// Diagnóstico sin secretos: qué env vars están cargadas en este deploy.
export function GET() {
  const vars = ["SHOPIFY_SHOP_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET", "SHOPIFY_WEBHOOK_SECRET",
    "PEDIDO_ORIGIN", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
    "DATABASE_URL", "ALLOWED_EMAILS", "CRON_SECRET"];
  return Response.json(Object.fromEntries(vars.map((v) => [v, !!process.env[v]])), { headers: cors });
}

const REQ = ["variant_id", "nombre", "telefono", "dni", "calle", "localidad", "provincia", "cp"] as const;

export async function POST(req: Request) {
  let d: Record<string, string>;
  try {
    d = await req.json();
  } catch {
    return Response.json({ ok: false, error: "JSON inválido" }, { status: 400, headers: cors });
  }
  if (d.web) return Response.json({ ok: true }, { headers: cors }); // honeypot: bot, lo ignoramos
  for (const k of REQ) {
    if (!String(d[k] ?? "").trim()) {
      return Response.json({ ok: false, error: `Falta ${k}` }, { status: 400, headers: cors });
    }
  }
  const tel = d.telefono.replace(/\D/g, "");
  if (tel.length < 8) {
    return Response.json({ ok: false, error: "Teléfono inválido" }, { status: 400, headers: cors });
  }
  const [first_name, ...rest] = d.nombre.trim().split(/\s+/);
  const last_name = rest.join(" ") || "-";
  const address = {
    first_name, last_name, phone: tel,
    address1: d.calle.trim(), city: d.localidad.trim(), province: d.provincia,
    zip: d.cp.trim(), country: "Argentina", country_code: "AR",
  };

  let token: string;
  try {
    token = await getShopifyToken();
  } catch (e) {
    console.error("pedido: token", (e as Error).message);
    return Response.json({ ok: false, error: "Shopify no configurado" }, { status: 502, headers: cors });
  }
  const res = await fetch(
    `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json`,
    {
      method: "POST",
      headers: { "X-Shopify-Access-Token": token, "content-type": "application/json" },
      body: JSON.stringify({
        order: {
          line_items: [{ variant_id: Number(d.variant_id), quantity: 1 }],
          customer: { first_name, last_name, phone: tel },
          shipping_address: address,
          billing_address: address,
          phone: tel,
          financial_status: "pending",
          gateway: "Pago contra entrega",
          tags: `cod, ${d.source ?? "landing"}`,
          note: d.nota?.trim() || undefined,
          note_attributes: [
            { name: "dni", value: d.dni.trim() },
            { name: "pack", value: d.pack ?? "" },
          ],
          send_receipt: false,
          send_fulfillment_receipt: false,
          inventory_behaviour: "bypass",
        },
      }),
    },
  );
  const j = await res.json();
  if (!res.ok || !j.order) {
    console.error("pedido: shopify", res.status, JSON.stringify(j.errors ?? j));
    return Response.json({ ok: false, error: "No pudimos tomar el pedido" }, { status: 502, headers: cors });
  }
  return Response.json({ ok: true, order_number: j.order.order_number, id: j.order.id }, { headers: cors });
}
