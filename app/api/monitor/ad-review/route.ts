import { fetchAdReviewIssues } from "@/lib/meta";
import { badCronAuth, logSyncRun, supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

type OpenIssue = {
  ad_id: string;
  ad_name: string;
  campaign_name: string;
  effective_status: string;
  first_seen_at: string;
  account_id: string;
};

// Polling del estado de revisión de ads (keep-alive). Vuelca DISAPPROVED/WITH_ISSUES de cada cuenta a
// ad_review_issues (§054); el panel/bot leen los abiertos (resolved_at is null). Cuentas:
// META_MONITOR_ACCOUNTS (csv) o R2 + R3 por defecto. Una cuenta que falle (p.ej. token sin acceso a R3)
// queda en warnings sin voltear al resto.
export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  const accounts = (
    process.env.META_MONITOR_ACCOUNTS ?? `${process.env.META_AD_ACCOUNT_ID},act_1569698667101520`
  )
    .split(",")
    .map((a) => a.trim())
    .filter(Boolean);

  const db = supabaseAdmin();
  const warnings: unknown[] = [];
  const open: OpenIssue[] = [];

  for (const account of accounts) {
    try {
      const issues = await fetchAdReviewIssues(account);
      const { data, error } = await db.rpc("sync_ad_review_issues", { p_account: account, p: issues });
      if (error) throw new Error(error.message);
      for (const d of (data ?? []) as Omit<OpenIssue, "account_id">[]) open.push({ ...d, account_id: account });
    } catch (e) {
      warnings.push(`${account}: ${String(e)}`);
    }
  }

  await logSyncRun("ad-review", warnings.length ? "error" : "ok", open.length, warnings);
  return Response.json({ ok: true, accounts: accounts.length, open: open.length, issues: open, warnings });
}

// Vercel Cron / pg_cron disparan GET con el mismo Bearer CRON_SECRET.
export { POST as GET };
