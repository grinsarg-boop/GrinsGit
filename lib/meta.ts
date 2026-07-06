// Meta Insights → contrato de upsert_ad_spend (§5.3). Sin cálculo: normaliza y listo.
const PURCHASE_TYPES = new Set([
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
]);

export type AdSpendRow = {
  date: string;
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  spend: number;
  purchases: number;
};

export async function fetchMetaInsights(): Promise<AdSpendRow[]> {
  const v = process.env.META_API_VERSION ?? "v25.0";
  const account = process.env.META_AD_ACCOUNT_ID!;
  const since = new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const until = new Date().toISOString().slice(0, 10);

  // level=ad explícito SIEMPRE — sin eso agrega a nivel campaña (§5.3)
  let url: string | undefined =
    `https://graph.facebook.com/${v}/${account}/insights?` +
    new URLSearchParams({
      level: "ad",
      fields: "ad_id,ad_name,campaign_name,spend,actions",
      time_increment: "1",
      time_range: JSON.stringify({ since, until }),
      limit: "200",
      access_token: process.env.META_ACCESS_TOKEN!,
    });

  const rows: AdSpendRow[] = [];
  while (url) {
    const res: Response = await fetch(url);
    const body: {
      data?: {
        date_start: string; ad_id: string; ad_name?: string; campaign_name?: string;
        spend?: string; actions?: { action_type: string; value: string }[];
      }[];
      paging?: { next?: string };
      error?: unknown;
    } = await res.json();
    if (!res.ok) throw new Error(`Meta API ${res.status}: ${JSON.stringify(body.error ?? body)}`);
    for (const r of body.data ?? []) {
      rows.push({
        date: r.date_start,
        ad_id: r.ad_id,
        ad_name: r.ad_name ?? "",
        campaign_name: r.campaign_name ?? "",
        spend: parseFloat(r.spend ?? "0"),
        purchases: (r.actions ?? [])
          .filter((a: { action_type: string }) => PURCHASE_TYPES.has(a.action_type))
          .reduce((s: number, a: { value: string }) => s + parseInt(a.value, 10), 0),
      });
    }
    url = body.paging?.next;
  }
  return rows;
}
