import { SHOPIFY_API_VERSION, upsertShipmentFromFulfillment } from "@/lib/shopify";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

// Reconciliación diaria 03:00: los webhooks se pierden (§5.2).
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  const db = supabaseAdmin();
  const warnings: unknown[] = [];
  let rows = 0;
  const dates: string[] = [];
  try {
    const since = new Date(Date.now() - 3 * 86400_000).toISOString();
    let url: string | null =
      `https://${process.env.SHOPIFY_SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/orders.json?` +
      new URLSearchParams({ status: "any", limit: "250", updated_at_min: since });

    while (url) {
      const res: Response = await fetch(url, {
        headers: { "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN! },
      });
      if (!res.ok) throw new Error(`Shopify ${res.status}: ${await res.text()}`);
      const { orders } = await res.json();

      for (const order of orders ?? []) {
        const { error } = await db.rpc("upsert_order", { p: order });
        if (error) {
          warnings.push({ order: order.name, error: error.message });
          continue; // errores parciales no abortan el batch (§5)
        }
        rows++;
        for (const f of order.fulfillments ?? []) {
          const d = await upsertShipmentFromFulfillment(f, order.id);
          if (d) dates.push(d);
        }
      }
      // paginado por Link header rel="next"
      const link = res.headers.get("link") ?? "";
      url = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null;
    }

    if (dates.length) {
      dates.sort();
      await db.rpc("recompute_daily_pnl", { p_from: dates[0], p_to: dates[dates.length - 1] });
    }
    await logSyncRun("shopify-backfill", "ok", rows, warnings);
    return Response.json({ ok: true, rows, warnings });
  } catch (e) {
    await logSyncRun("shopify-backfill", "error", rows, warnings, String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// Vercel Cron dispara GET con el mismo Bearer CRON_SECRET
export { POST as GET };
