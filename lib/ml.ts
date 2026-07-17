import { supabaseAdmin } from "@/lib/supabase";
import { matchProduct } from "@/lib/product-match";

// MercadoLibre — Fase 1: token OAuth (refresh + rotación) + landing de órdenes en ml_orders.
// El P&L (canal 'ml' en daily_pnl) es la fase 2.

const OAUTH_URL = "https://api.mercadolibre.com/oauth/token";
const API = "https://api.mercadolibre.com";
const REFRESH_SKEW_MS = 10 * 60_000; // refrescar 10 min antes de vencer

type Db = ReturnType<typeof supabaseAdmin>;
export type MlToken = { access_token: string; refresh_token: string; expires_at: number };

// --- pura: ¿el access token cacheado sirve o hay que refrescar? (testeable sin IO) ---
export function needsRefresh(tok: Partial<MlToken> | null, now: number): boolean {
  return !tok?.access_token || !tok.expires_at || tok.expires_at - REFRESH_SKEW_MS <= now;
}

// --- pura: estado nuevo tras el refresh. El refresh_token de ML ROTA (single-use): si vino uno
// nuevo lo persistimos, si no, conservamos el anterior. ---
export function nextTokenState(
  resp: { access_token: string; refresh_token?: string; expires_in?: number },
  prevRefresh: string,
  now: number,
): MlToken {
  return {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token ?? prevRefresh,
    expires_at: now + (resp.expires_in ?? 21600) * 1000,
  };
}

async function loadToken(db: Db): Promise<Partial<MlToken>> {
  const { data } = await db.from("settings").select("value").eq("key", "ml_token").maybeSingle();
  return (data?.value as MlToken) ?? {};
}

// Devuelve un access token usable para la API de ML. Dos modos:
//  1) ESTÁTICO (el de hoy): token de producción del panel MP/ML en ML_ACCESS_TOKEN — largo, no rota.
//  2) OAuth: si hay un refresh token (TG-…) en ML_REFRESH_TOKEN/settings, refresca + rota + persiste.
// El modo 2 es el upgrade si el estático llegara a expirar: se setea ML_REFRESH_TOKEN y listo, sin
// tocar código. Si el estático caduca, la API tira 401 → logSyncRun lo marca (no falla silencioso).
// ponytail: sin lock en el refresh — si dos corridas lo hacen a la vez, la 2ª quema un refresh usado
// (400). El cache de 6h lo hace rarísimo; si el cron se solapa, poné un lock por-fila en settings.
export async function getMlAccessToken(db: Db = supabaseAdmin()): Promise<string> {
  const cur = await loadToken(db);
  const refresh = cur.refresh_token ?? process.env.ML_REFRESH_TOKEN;

  if (refresh) {
    if (!needsRefresh(cur, Date.now())) return cur.access_token!;
    const res = await fetch(OAUTH_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: process.env.ML_CLIENT_ID ?? "",
        client_secret: process.env.ML_CLIENT_SECRET ?? "",
        refresh_token: refresh,
      }),
    });
    if (!res.ok) throw new Error(`ML oauth ${res.status}: ${await res.text()}`);
    const next = nextTokenState(await res.json(), refresh, Date.now());
    await db.from("settings").upsert({ key: "ml_token", value: next });
    return next.access_token;
  }

  const stat = process.env.ML_ACCESS_TOKEN;
  if (!stat) throw new Error("ML: falta ML_ACCESS_TOKEN (o ML_REFRESH_TOKEN para modo OAuth)");
  return stat;
}

type MlItem = { item?: { title?: string }; quantity?: number; unit_price?: number; sale_fee?: number };
export type MlOrder = {
  id: number;
  date_created: string;
  status: string;
  total_amount?: number;
  order_items?: MlItem[];
  shipping?: { id?: number; logistic_type?: string };
};

// Una order de ML → fila de ml_orders. Suma cantidades y comisiones de todos los order_items.
// ponytail: multi-producto en una order → product = el primero que matchee (matchProduct sobre los
// títulos concatenados). Raro en BioLabs; la order completa queda en raw si hay que desglosar.
export function mapMlOrder(o: MlOrder) {
  const items = o.order_items ?? [];
  const titles = items.map((it) => it.item?.title ?? "").join(" | ");
  return {
    ml_id: o.id,
    created_at: o.date_created,
    product: matchProduct(titles), // null si no matchea ninguno de los 6
    units: items.reduce((n, it) => n + (it.quantity ?? 0), 0),
    total_amount: o.total_amount ?? 0,
    sale_fee: items.reduce((s, it) => s + (it.sale_fee ?? 0), 0), // comisión ML
    ship_type: o.shipping?.logistic_type ?? null,
    ship_cost: null as number | null, // ponytail: enrich real (GET /shipments) = fase 2
    province: null as string | null, //   idem: la provincia vive en el shipment
    status: o.status,
    raw: o,
  };
}

// Trae las órdenes de los últimos `days` días paginando /orders/search (seller propio).
export async function fetchMlOrders(days: number, db: Db = supabaseAdmin()): Promise<MlOrder[]> {
  const token = await getMlAccessToken(db);
  const seller = process.env.ML_SELLER_ID ?? "";
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const LIMIT = 50;
  const out: MlOrder[] = [];
  for (let offset = 0; offset <= 2000; offset += LIMIT) {
    const qs = new URLSearchParams({
      seller,
      "order.date_created.from": from,
      sort: "date_desc",
      offset: String(offset),
      limit: String(LIMIT),
    });
    const res = await fetch(`${API}/orders/search?${qs}`, { headers: { authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`ML orders ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const results: MlOrder[] = j.results ?? [];
    out.push(...results);
    if (results.length === 0 || out.length >= (j.paging?.total ?? out.length)) break;
  }
  return out;
}

// Fase 1: landa las órdenes en ml_orders. Devuelve cuántas filas tocó.
export async function syncMlOrders(days = 30, db: Db = supabaseAdmin()): Promise<{ rows: number }> {
  const orders = await fetchMlOrders(days, db);
  if (orders.length === 0) return { rows: 0 };
  const rows = orders.map(mapMlOrder);
  const { error } = await db.from("ml_orders").upsert(rows, { onConflict: "ml_id" });
  if (error) throw new Error(`ml_orders upsert: ${error.message}`);
  return { rows: rows.length };
}
