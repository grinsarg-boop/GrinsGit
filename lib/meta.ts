// Meta Insights → contrato de upsert_ad_spend (§5.3). Sin cálculo: normaliza y listo.
// UN SOLO action_type: Meta devuelve el MISMO número bajo 8 etiquetas (purchase, omni_purchase,
// offsite_conversion.fb_pixel_purchase, onsite_web_purchase, web_in_store_purchase, …). Sumar tres
// multiplicaba `purchases` por 3 en toda la historia. Mismo criterio que scripts/lanes.mjs.
const PURCHASE_TYPES = new Set(["omni_purchase"]);

export type AdSpendRow = {
  date: string;
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  spend: number;
  purchases: number;
};

// Las cuentas se queman (UNSETTLED) y se rota a la siguiente (R1 → R2 → R3 → …). Mantener la lista
// a mano es el paso que se olvida: el 23/07 R3 arrancó y el panel marcó $0 cuatro días porque la
// variable de Vercel quedó vieja. Por eso el default es DESCUBRIRLAS: /me/adaccounts devuelve solo
// las que el token puede leer de verdad, así que la cuenta nueva entra sola y las que no tenemos
// permiso (R1 → 403) ni aparecen. META_AD_ACCOUNT_ID sigue mandando si está seteada (escape hatch).
const CUENTAS_RE = /^tienda\s*r/i;

export async function resolveAccounts(): Promise<string[]> {
  const manual = process.env.META_AD_ACCOUNT_ID?.trim();
  if (manual) return manual.split(",").map((a) => a.trim()).filter(Boolean);

  const v = process.env.META_API_VERSION ?? "v25.0";
  const res = await fetch(
    `https://graph.facebook.com/${v}/me/adaccounts?` +
      new URLSearchParams({ fields: "id,name", limit: "200", access_token: process.env.META_ACCESS_TOKEN! }),
  );
  const body: { data?: { id: string; name?: string }[]; error?: unknown } = await res.json();
  if (!res.ok) throw new Error(`Meta /me/adaccounts ${res.status}: ${JSON.stringify(body.error ?? body)}`);
  // Sin filtro traeríamos las cuentas de otros negocios si al token le amplían el alcance.
  const found = (body.data ?? []).filter((a) => CUENTAS_RE.test(a.name ?? "")).map((a) => a.id);
  if (!found.length) throw new Error("Meta: /me/adaccounts no devolvió ninguna cuenta 'Tienda R'");
  return found;
}

// since/until (YYYY-MM-DD) solo los pasa el backfill: cuando entra una cuenta nueva, su gasto
// anterior NO vuelve solo porque el cron mira 2 días. Ver scripts/backfill-meta.mts.
export async function fetchMetaInsights(since?: string, until?: string): Promise<AdSpendRow[]> {
  const accounts = await resolveAccounts();
  // Una cuenta rota no puede tapar a las demás (antes un 403 tiraba TODO el sync), pero si fallan
  // todas es un problema real (token vencido) y tiene que explotar para que quede en sync_runs.
  const results = await Promise.allSettled(accounts.map((a) => fetchAccountInsights(a, since, until)));
  const fallaron = results.filter((r) => r.status === "rejected");
  if (fallaron.length === accounts.length) throw (fallaron[0] as PromiseRejectedResult).reason;
  for (const f of fallaron) console.error("meta: cuenta caída,", String((f as PromiseRejectedResult).reason));
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchAccountInsights(account: string, sinceArg?: string, untilArg?: string): Promise<AdSpendRow[]> {
  const v = process.env.META_API_VERSION ?? "v25.0";
  const since = sinceArg ?? new Date(Date.now() - 2 * 86400_000).toISOString().slice(0, 10);
  const until = untilArg ?? new Date().toISOString().slice(0, 10);

  // level=ad explícito SIEMPRE — sin eso agrega a nivel campaña (§5.3)
  let url: string | undefined =
    `https://graph.facebook.com/${v}/${account}/insights?` +
    new URLSearchParams({
      level: "ad",
      fields: "ad_id,ad_name,adset_name,campaign_name,spend,actions",
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
        date_start: string; ad_id: string; ad_name?: string; adset_name?: string; campaign_name?: string;
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
        adset_name: r.adset_name ?? "",
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

export type AdReviewIssue = {
  ad_id: string;
  ad_name: string;
  adset_name: string;
  campaign_name: string;
  effective_status: string;
};

// Ads con problema de revisión/entrega (DISAPPROVED / WITH_ISSUES) de UNA cuenta. Barato: filtra
// server-side por effective_status, sólo trae los rotos. accountId con o sin prefijo "act_".
export async function fetchAdReviewIssues(accountId: string): Promise<AdReviewIssue[]> {
  const v = process.env.META_API_VERSION ?? "v25.0";
  const acct = accountId.startsWith("act_") ? accountId : `act_${accountId}`;

  let url: string | undefined =
    `https://graph.facebook.com/${v}/${acct}/ads?` +
    new URLSearchParams({
      fields: "id,name,adset{name},campaign{name},effective_status",
      effective_status: JSON.stringify(["DISAPPROVED", "WITH_ISSUES"]),
      limit: "200",
      access_token: process.env.META_ACCESS_TOKEN!,
    });

  const out: AdReviewIssue[] = [];
  while (url) {
    const res: Response = await fetch(url);
    const body: {
      data?: {
        id: string; name?: string; adset?: { name?: string };
        campaign?: { name?: string }; effective_status: string;
      }[];
      paging?: { next?: string };
      error?: unknown;
    } = await res.json();
    if (!res.ok) throw new Error(`Meta API ${res.status}: ${JSON.stringify(body.error ?? body)}`);
    for (const a of body.data ?? []) {
      out.push({
        ad_id: a.id,
        ad_name: a.name ?? "",
        adset_name: a.adset?.name ?? "",
        campaign_name: a.campaign?.name ?? "",
        effective_status: a.effective_status,
      });
    }
    url = body.paging?.next;
  }
  return out;
}
