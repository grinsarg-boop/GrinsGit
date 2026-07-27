// Backfill de gasto de Meta para un rango de fechas, con las cuentas de META_AD_ACCOUNT_ID.
// Uso: set -a; source .env.local; set +a; npx tsx scripts/backfill-meta.mts 2026-07-23 2026-07-27
//
// Por qué existe: el cron horario solo pide los últimos 2 días. Las cuentas se queman (UNSETTLED)
// y se rota (R1 → R2 → R3); cuando la nueva recién se agrega a META_AD_ACCOUNT_ID, todo lo que
// gastó mientras estaba fuera de la lista queda invisible para siempre. Esto lo recupera.
// Idempotente: upsert_ad_spend es on conflict (date, ad_id) y respeta product_locked.
import { createClient } from "@supabase/supabase-js";
import { fetchMetaInsights } from "../lib/meta";

const [since, until] = process.argv.slice(2);
if (!/^\d{4}-\d{2}-\d{2}$/.test(since ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(until ?? "")) {
  console.error("uso: npx tsx scripts/backfill-meta.mts <desde> <hasta>   (YYYY-MM-DD)");
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const rows = await fetchMetaInsights(since, until);
const total = rows.reduce((s, r) => s + r.spend, 0);
console.log(
  `${rows.length} filas · ${since} → ${until} · gasto $${Math.round(total).toLocaleString("es-AR")}` +
    ` · cuentas: ${process.env.META_AD_ACCOUNT_ID}`,
);
if (!rows.length) {
  console.log("sin filas — nada que hacer");
  process.exit(0);
}

const { error } = await db.rpc("upsert_ad_spend", { p: rows });
if (error) throw new Error(`upsert_ad_spend: ${error.message}`);

const { error: e2 } = await db.rpc("recompute_daily_pnl", { p_from: since, p_to: until });
if (e2) throw new Error(`recompute_daily_pnl: ${e2.message}`);

console.log("✅ ad_spend actualizado y P&L recomputado");
