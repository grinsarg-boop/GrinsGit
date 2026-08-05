import * as XLSX from "xlsx";
import { today } from "@/lib/couriers/sync";
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

type MlItem = { item?: { id?: string; title?: string }; quantity?: number; unit_price?: number; sale_fee?: number };
export type MlOrder = {
  id: number;
  date_created: string;
  status: string;
  total_amount?: number;
  order_items?: MlItem[];
  shipping?: { id?: number; logistic_type?: string };
  payments?: { id?: number; status?: string; shipping_cost?: number }[];
};

// Publicaciones cuyo título NO dice la cantidad en ningún lado, así que no hay regex que las saque.
// Pasa con los títulos de catálogo de ML, que ML impone y no controlamos.
// ponytail: un objeto alcanza mientras sean pocas; si pasa de ~5, va a tabla con su propio sync.
const PACK_POR_ITEM: Record<string, number> = {
  MLA3692036796: 2, // "Dermatech Gotero Extractos De Hierbas Pureza…" — es el 2-pack de catálogo
};

// Pack (unidades por venta) embebido en el título ML: "3 Gotero Pureza"→3, "4 X 30ml"→4, "Gotas"→1.
// ML NO usa quantity para el pack (siempre viene 1); el tamaño está en el nombre del listado.
// El pack manda el COGS via product_costs(product_id, pack): leerlo de menos infla el profit.
export function parseMlPack(title: string | null | undefined, itemId?: string | null): number {
  if (itemId && PACK_POR_ITEM[itemId]) return PACK_POR_ITEM[itemId];
  const t = title ?? "";
  for (const re of [
    /^\s*(\d{1,2})\s/, //      "3 Gotero…"
    /(\d{1,2})\s*[xX]\s*\d/, // "…4 X 30ml"
    /[xX]\s*(\d{1,2})/, //     "…Promo X4…"
    /(\d{1,2})\s*u\b/i, //     "…Menta 2u Menta"
  ]) {
    const n = Number(t.match(re)?.[1]);
    // El tope de 12 es lo que descarta los falsos positivos ("X 30ml" → 30, no es un pack).
    if (n >= 1 && n <= 12) return n;
  }
  return 1;
}

// Flete que absorbe el VENDEDOR (lo que se descuenta en la liquidación). No viene en /orders; se
// deriva del shipment: senders.cost = list_cost − lo_que_pagó_el_comprador. Verificado en 3 envíos.
// Flex (self_service) NO se resuelve por acá (lo carga el xlsx de Santiago) → devuelve null.
export function sellerFlete(
  logisticType: string | null | undefined,
  listCost: number | null | undefined,
  buyerShipCost: number | null | undefined,
): number | null {
  if (logisticType === "self_service") return null; // Flex → xlsx
  if (listCost == null) return null; // sin dato → no inventar (Number(null)=0, así que hay que chequear antes)
  const c = Number(listCost);
  if (!Number.isFinite(c)) return null; // no-numérico → null, nunca NaN persistido
  return Math.max(0, c - (Number(buyerShipCost) || 0));
}

// Una order de ML → fila de ml_orders. `units` = Σ order_items.quantity (nº de listados, casi siempre 1);
// `pack` = tamaño del listado primario (para el COGS via product_costs(product_id, pack)).
// ponytail: multi-producto/multi-pack en una order → product y pack = el ítem primario (items[0]).
// Raro en BioLabs; la order completa queda en raw si hay que desglosar.
export function mapMlOrder(o: MlOrder) {
  const items = o.order_items ?? [];
  const titles = items.map((it) => it.item?.title ?? "").join(" | ");
  return {
    ml_id: o.id,
    created_at: o.date_created,
    product: matchProduct(titles), // null si no matchea ninguno de los 6
    pack: parseMlPack(items[0]?.item?.title, items[0]?.item?.id),
    units: items.reduce((n, it) => n + (it.quantity ?? 0), 0),
    shipment_id: o.shipping?.id ?? null,
    total_amount: o.total_amount ?? 0,
    sale_fee: items.reduce((s, it) => s + (it.sale_fee ?? 0), 0), // comisión ML
    // ship_type/ship_cost/province NO van acá a propósito: los llenan enrichMlShipments (flete normal)
    // e importMlFlex (Flex). Incluirlos en el upsert pisaría con null el flete ya enriquecido en cada
    // re-sync (y el cron diario lo borraría). Al insertar arrancan null por default de columna.
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
export async function syncMlOrders(days = 60, db: Db = supabaseAdmin()): Promise<{ rows: number; sinProducto: number }> {
  const orders = await fetchMlOrders(days, db);
  if (orders.length === 0) return { rows: 0, sinProducto: 0 };
  const rows = orders.map(mapMlOrder);
  const { error } = await db.from("ml_orders").upsert(rows, { onConflict: "ml_id" });
  if (error) throw new Error(`ml_orders upsert: ${error.message}`);
  // Ventas pagadas cuyo título no matcheó ningún producto → se caen del P&L (inner join). Hoy 0, pero
  // un listado nuevo/typo sería plata invisible: se cuenta para alertar en logSyncRun.
  const sinProducto = rows.filter((r) => r.status === "paid" && !r.product).length;
  return { rows: rows.length, sinProducto };
}

// --- Fase 1.5: flete del vendedor ---

const buyerShipCost = (o: MlOrder): number =>
  (o.payments ?? []).find((p) => (p as { status?: string }).status === "approved")?.shipping_cost
  ?? o.payments?.[0]?.shipping_cost ?? 0;

// Enriquece el flete normal-ME desde el shipment (list_cost − lo que pagó el comprador) para órdenes
// pagadas sin ship_cost aún. Flex (self_service) queda ship_cost null (lo pone el xlsx) pero se le
// marca ship_type para no reprocesarlo. Concurrencia acotada; falla por-orden = se saltea (no aborta).
export async function enrichMlShipments(db: Db = supabaseAdmin(), limit = 300): Promise<{ enriched: number; flex: number }> {
  const token = await getMlAccessToken(db);
  const { data } = await db
    .from("ml_orders")
    .select("ml_id, shipment_id, raw")
    .eq("status", "paid").is("ship_type", null).not("shipment_id", "is", null)
    .limit(limit);
  if (!data?.length) return { enriched: 0, flex: 0 };

  let enriched = 0, flex = 0;
  const CONC = 8;
  for (let i = 0; i < data.length; i += CONC) {
    await Promise.all(data.slice(i, i + CONC).map(async (r) => {
      try { // falla por-orden (fetch, json roto o update) = se saltea, no aborta la tanda
        const res = await fetch(`${API}/shipments/${r.shipment_id}`, { headers: { authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const sh = await res.json();
        const fc = sellerFlete(sh.logistic_type, sh.shipping_option?.list_cost, buyerShipCost(r.raw as MlOrder));
        await db.from("ml_orders").update({ ship_type: sh.logistic_type ?? "?", ship_cost: fc }).eq("ml_id", r.ml_id);
        if (sh.logistic_type === "self_service") flex++; else if (fc != null) enriched++;
      } catch { /* se saltea */ }
    }));
  }
  return { enriched, flex };
}

// --- Retenciones impositivas (IIBB/SIRTAC) ---

// Suma los cargos tax_withholding_* de un pago de MP (retenciones provinciales que ML descuenta
// de la liquidación; ~1,4% del revenue promedio, 0,3%–5% según provincia del comprador).
export function sumWithholdings(charges: { name?: string; amounts?: { original?: number } }[] | null | undefined): number {
  return (charges ?? []).reduce(
    (s, c) => (String(c.name ?? "").startsWith("tax_withholding") ? s + (c.amounts?.original ?? 0) : s),
    0,
  );
}

// Enriquece tax_withheld + mp_release_date/mp_net (para "A liquidar de ML") leyendo el pago en MP
// (nada de esto viene en /orders). null = pendiente; 0 = consultado sin retención. Solo marca la
// orden si TODOS sus pagos aprobados respondieron (si no, reintenta en la próxima corrida).
// Requiere token OAuth (scope payments); con el estático MP da 401 → queda todo pendiente, sin romper.
export async function enrichMlTaxes(db: Db = supabaseAdmin(), limit = 300): Promise<{ taxed: number }> {
  const { data } = await db
    .from("ml_orders")
    .select("ml_id, raw")
    .eq("status", "paid").is("tax_withheld", null)
    .limit(limit);
  if (!data?.length) return { taxed: 0 };
  const token = await getMlAccessToken(db);
  let taxed = 0;
  const CONC = 8;
  for (let i = 0; i < data.length; i += CONC) {
    await Promise.all(data.slice(i, i + CONC).map(async (r) => {
      try { // falla por-orden = se saltea, no aborta la tanda
        const ids = ((r.raw as MlOrder).payments ?? [])
          .filter((p) => p.status === "approved" && p.id).map((p) => p.id);
        if (!ids.length) return; // sin pago aprobado (raro en paid) → queda pendiente
        let wh = 0, net = 0, rel: string | null = null;
        for (const id of ids) {
          const res = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          if (!res.ok) return;
          const pay = await res.json();
          wh += sumWithholdings(pay.charges_details);
          net += pay.transaction_details?.net_received_amount ?? 0;
          const rd = String(pay.money_release_date ?? "").slice(0, 10);
          if (rd && (!rel || rd > rel)) rel = rd; // multi-pago: libera cuando libera el último
        }
        await db.from("ml_orders").update({ tax_withheld: wh, mp_net: net, mp_release_date: rel }).eq("ml_id", r.ml_id);
        taxed++;
      } catch { /* se saltea */ }
    }));
  }
  return { taxed };
}

// Copia el flete Flex REAL del staging (ml_flex_flete) a ml_orders.ship_cost por shipment_id. Marca
// ship_cost_estimated=false (es de un listado, pisa cualquier estimado previo por CP).
// ponytail: loop por fila (~30-100/semana). Si escala, un update con join en una RPC.
export async function applyFlexFlete(db: Db = supabaseAdmin()): Promise<{ updated: number }> {
  const { data } = await db.from("ml_flex_flete").select("shipment_id, price");
  if (!data?.length) return { updated: 0 };
  let updated = 0;
  for (const f of data) {
    const { count } = await db.from("ml_orders")
      .update({ ship_cost: f.price, ship_type: "self_service", ship_cost_estimated: false }, { count: "exact" })
      .eq("shipment_id", f.shipment_id);
    updated += count ?? 0;
  }
  return { updated };
}

// Estima el flete de los envíos Flex EN CURSO (self_service, sin flete real) por su CP destino, usando
// la tabla settings.flex_freight_by_cp. Marca ship_cost_estimated=true; applyFlexFlete lo pisa cuando
// llega el listado real. (1) captura dest_cp de los que no lo tienen (1 fetch/shipment), (2) aplica la
// tabla a todos los pendientes con CP conocido (barato, sin API — cubre CPs que se agregaron después).
export async function estimateFlexByCP(db: Db = supabaseAdmin(), limit = 200): Promise<{ estimated: number; sinCP: number }> {
  const { data: st } = await db.from("settings").select("value").eq("key", "flex_freight_by_cp").maybeSingle();
  const table = (st?.value as Record<string, number>) ?? {};
  if (!Object.keys(table).length) return { estimated: 0, sinCP: 0 };

  // (1) capturar CP destino de los Flex pendientes que aún no lo tienen
  const { data: nuevos } = await db.from("ml_orders")
    .select("ml_id, shipment_id")
    .eq("status", "paid").eq("ship_type", "self_service").is("ship_cost", null).is("dest_cp", null)
    .not("shipment_id", "is", null).limit(limit);
  if (nuevos?.length) {
    const token = await getMlAccessToken(db);
    const CONC = 8;
    for (let i = 0; i < nuevos.length; i += CONC) {
      await Promise.all(nuevos.slice(i, i + CONC).map(async (r) => {
        try {
          const res = await fetch(`${API}/shipments/${r.shipment_id}`, { headers: { authorization: `Bearer ${token}` } });
          if (!res.ok) return;
          const cp = String((await res.json())?.receiver_address?.zip_code ?? "").replace(/\D/g, "").slice(0, 4);
          if (cp) await db.from("ml_orders").update({ dest_cp: cp }).eq("ml_id", r.ml_id);
        } catch { /* se saltea */ }
      }));
    }
  }

  // (2) aplicar la tabla a los pendientes con CP conocido
  const { data: pend } = await db.from("ml_orders")
    .select("ml_id, dest_cp")
    .eq("status", "paid").eq("ship_type", "self_service").is("ship_cost", null).not("dest_cp", "is", null);
  let estimated = 0, sinCP = 0;
  for (const r of pend ?? []) {
    const price = table[r.dest_cp as string];
    if (price != null) {
      await db.from("ml_orders").update({ ship_cost: price, ship_cost_estimated: true }).eq("ml_id", r.ml_id);
      estimated++;
    } else sinCP++;
  }
  return { estimated, sinCP };
}

// --- Product Ads de ML (publicidad) ---

const ADS_SITE = "MLA"; // Argentina

async function getMlAdvertiserId(token: string): Promise<number | null> {
  const res = await fetch(`${API}/advertising/advertisers?product_id=PADS`, {
    headers: { authorization: `Bearer ${token}`, "api-version": "1" },
  }).catch(() => null);
  if (!res?.ok) return null;
  const j = await res.json();
  return j.advertisers?.[0]?.advertiser_id ?? null;
}

// Gasto de Product Ads de ML: total del día (campaigns/search → ml_ad_spend, el número que factura ML,
// conciliado contra la factura en la 046) y detalle por publicación (ads/search → ml_ad_spend_item),
// que el recompute imputa al producto dueño del item en vez de prorratear por revenue (062).
// Los endpoints dan métricas agregadas por rango → se pide día por día, con concurrencia acotada.
export async function syncMlAdSpend(days = 60, db: Db = supabaseAdmin()): Promise<{ days: number; total: number }> {
  const token = await getMlAccessToken(db);
  const adv = await getMlAdvertiserId(token);
  if (!adv) return { days: 0, total: 0 };
  const base = `${API}/marketplace/advertising/${ADS_SITE}/advertisers/${adv}/product_ads`;
  const headers = { authorization: `Bearer ${token}`, "api-version": "2" };
  const fechas: string[] = [];
  for (let i = 0; i < days; i++) fechas.push(new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10));
  const rows: { date: string; cost: number }[] = [];
  const items: { date: string; item_id: string; cost: number }[] = [];
  const CONC = 6;
  for (let i = 0; i < fechas.length; i += CONC) {
    await Promise.all(fechas.slice(i, i + CONC).map(async (d) => {
      try {
        const res = await fetch(`${base}/campaigns/search?date_from=${d}&date_to=${d}&metrics=cost&limit=100`, { headers });
        if (!res.ok) return;
        const j = await res.json();
        const cost = ((j.results ?? []) as { metrics?: { cost?: number } }[]).reduce((s, c) => s + (c.metrics?.cost ?? 0), 0);
        rows.push({ date: d, cost });
      } catch { /* se saltea */ }
      try {
        // ads/search repite el mismo item en cada campaña/ad group con las MISMAS métricas: sin
        // deduplicar por item_id el gasto sale ~36% inflado. campaign_id no filtra ahí (devuelve
        // todos los anuncios del advertiser) → una sola llamada, nunca iterar campañas.
        // ponytail: una página de 200 (hoy son 45 anuncios). Si algún día se pasa, lo que quede
        // afuera cae en el resto sin imputar del recompute y se prorratea — no se pierde plata.
        const res = await fetch(`${base}/ads/search?date_from=${d}&date_to=${d}&metrics=cost&limit=200`, { headers });
        if (!res.ok) return;
        const j = await res.json();
        const seen = new Map<string, number>();
        for (const a of (j.results ?? []) as { item_id?: string; metrics?: { cost?: number } }[]) {
          if (a.item_id && !seen.has(a.item_id)) seen.set(a.item_id, a.metrics?.cost ?? 0);
        }
        for (const [item_id, cost] of seen) if (cost > 0) items.push({ date: d, item_id, cost });
      } catch { /* se saltea */ }
    }));
  }
  if (rows.length) await db.from("ml_ad_spend").upsert(rows, { onConflict: "date" });
  if (items.length) await db.from("ml_ad_spend_item").upsert(items, { onConflict: "date,item_id" });
  return { days: rows.length, total: rows.reduce((s, r) => s + r.cost, 0) };
}

// --- Bonificaciones Flex de ML (money_transfer "bonificaciones_flex_fc" en el MP) ---

export type MpTransfer = { date_approved?: string; transaction_amount?: number; status?: string; description?: string };

// Agrupa las bonificaciones aprobadas por día ART de aprobación. El pago no referencia al envío
// (metadata vacía) → día es la máxima granularidad honesta. Refunds quedan afuera por status.
export function groupBonifByDay(transfers: MpTransfer[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of transfers) {
    if (t.status !== "approved" || t.description !== "bonificaciones_flex_fc" || !t.date_approved) continue;
    const d = new Date(t.date_approved).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
    out[d] = (out[d] ?? 0) + (t.transaction_amount ?? 0);
  }
  return out;
}

// Trae los money_transfer aprobados de los últimos `days` días del MP y aterriza las bonificaciones
// Flex por día en ml_flex_bonif. Upsert por día completo: si un transfer se refunda después, el
// re-sync del día lo deja afuera solo (status ya no es approved).
export async function syncMlFlexBonif(days = 60, db: Db = supabaseAdmin()): Promise<{ days: number; total: number }> {
  const token = await getMlAccessToken(db);
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const LIMIT = 100;
  const transfers: MpTransfer[] = [];
  for (let offset = 0; offset <= 2000; offset += LIMIT) {
    const qs = new URLSearchParams({
      operation_type: "money_transfer",
      range: "date_created", begin_date: from, end_date: new Date().toISOString(),
      sort: "date_created", criteria: "desc",
      offset: String(offset), limit: String(LIMIT),
    });
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`MP transfers ${res.status}: ${await res.text()}`);
    const j = await res.json();
    const results: MpTransfer[] = j.results ?? [];
    transfers.push(...results);
    if (results.length < LIMIT) break;
  }
  const byDay = groupBonifByDay(transfers);
  const rows = Object.entries(byDay).map(([date, amount]) => ({ date, amount }));
  if (rows.length) {
    const { error } = await db.from("ml_flex_bonif").upsert(rows, { onConflict: "date" });
    if (error) throw new Error(`ml_flex_bonif upsert: ${error.message}`);
  }
  return { days: rows.length, total: rows.reduce((s, r) => s + r.amount, 0) };
}

// --- MP Khalil: fee real de los links de pago del ecom (048) ---

// "ORDER-17876" → "17876" (el order_number pelado de orders). Otro formato → null (pagos
// personales/QR de la cuenta, se ignoran).
export function parseOrderRef(ref: string | null | undefined): string | null {
  const m = /^ORDER-(\d+)$/.exec(ref ?? "");
  return m ? m[1] : null;
}

// Aterriza en mp_payments los pagos aprobados de los links (refs ORDER-) de la cuenta MP Khalil.
// Token ESTÁTICO del panel (MP_KHALIL_ACCESS_TOKEN); sin env la función es un no-op (no rompe el
// cron). fee = transaction_amount − net_received (mp fee + financing_fee del "3 sin interés").
// ponytail: refunds no se borran (raro acá; la orden refunded sale del P&L por financial_status).
export async function syncMpKhalil(days = 60, db: Db = supabaseAdmin()): Promise<{ pagos: number; fee: number }> {
  const token = process.env.MP_KHALIL_ACCESS_TOKEN;
  if (!token) return { pagos: 0, fee: 0 };
  const from = new Date(Date.now() - days * 86400_000).toISOString();
  const LIMIT = 100;
  const rows: { payment_id: number; order_number: string; amount: number; fee: number; installments: number | null; approved_at: string | null }[] = [];
  for (let offset = 0; offset <= 2000; offset += LIMIT) {
    const qs = new URLSearchParams({
      status: "approved",
      range: "date_created", begin_date: from, end_date: new Date().toISOString(),
      sort: "date_created", criteria: "desc",
      offset: String(offset), limit: String(LIMIT),
    });
    const res = await fetch(`https://api.mercadopago.com/v1/payments/search?${qs}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`MP Khalil ${res.status}: ${await res.text()}`);
    const j = await res.json();
    type Pay = { id: number; external_reference?: string; transaction_amount?: number; installments?: number; date_approved?: string; transaction_details?: { net_received_amount?: number } };
    const results: Pay[] = j.results ?? [];
    for (const p of results) {
      const on = parseOrderRef(p.external_reference);
      if (!on) continue;
      const amount = p.transaction_amount ?? 0;
      rows.push({
        payment_id: p.id, order_number: on, amount,
        fee: amount - (p.transaction_details?.net_received_amount ?? 0),
        installments: p.installments ?? null,
        approved_at: p.date_approved ?? null,
      });
    }
    if (results.length < LIMIT) break;
  }
  if (rows.length) {
    const { error } = await db.from("mp_payments").upsert(rows, { onConflict: "payment_id" });
    if (error) throw new Error(`mp_payments upsert: ${error.message}`);
  }
  return { pagos: rows.length, fee: rows.reduce((s, r) => s + r.fee, 0) };
}

// --- Percepciones IVA/IIBB de la factura mensual (046) ---

// Parsea el Reporte_Facturacion xlsx del panel de ML: header en la fila "N° de factura fiscal";
// suma percepciones (IVA RG5319, IIBB, etc.) + cargos fijos (Mi página, suscripciones) y devuelve
// la ventana del período. El resto de la factura (vender/cuotas/flat_fee/envíos/ads) YA se cuenta
// por otras vías — acá solo lo que falta.
export function parseMlBilling(buf: Buffer): { percep: number; fijos: number; from: string; to: string; cargos: number } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  let percep = 0, fijos = 0, cargos = 0;
  let from = "", to = "";
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null });
    const hi = rows.findIndex((r) => (r ?? []).some((c) => typeof c === "string" && /n° de factura fiscal/i.test(c)));
    if (hi < 0) continue;
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] as unknown[]; if (!r) continue;
      const detalle = String(r[3] ?? "");
      const valor = Number(r[7]);
      if (!detalle || !Number.isFinite(valor)) continue;
      cargos++;
      const fecha = r[1] instanceof Date ? r[1].toISOString().slice(0, 10) : null;
      if (fecha) { if (!from || fecha < from) from = fecha; if (!to || fecha > to) to = fecha; }
      if (/percep/i.test(detalle)) percep += valor; // "Percepción…" y también "Percep. gral." (abreviado)
      else if (/mi p[áa]gina|suscripci/i.test(detalle)) fijos += valor;
    }
  }
  if (!cargos || !from) throw new Error("no parece un Reporte_Facturacion de ML (falta el header o no hay cargos)");
  return { percep, fijos, from, to, cargos };
}

const artDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });

// Base diaria sobre la que ML factura percepciones: comisión (sale_fee) + flete neto de
// bonificaciones + ads brutos (con IVA). Contra esta base se calibra settings.ml_percep_pct.
async function mlDailyBase(db: Db, from: string, to: string): Promise<Map<string, number>> {
  const iva = Number((await db.from("settings").select("value").eq("key", "ml_ads_iva").maybeSingle()).data?.value ?? 0);
  const base = new Map<string, number>();
  const add = (d: string, v: number) => { if (d >= from && d <= to) base.set(d, (base.get(d) ?? 0) + v); };
  // sale_fee + flete por día ART de la venta (mismo criterio que la rama ml del recompute)
  const PAGE = 1000;
  for (let off = 0; ; off += PAGE) {
    const { data } = await db.from("ml_orders")
      .select("created_at, sale_fee, ship_cost, product")
      .eq("status", "paid").not("product", "is", null)
      .gte("created_at", `${from}T00:00:00-00:00`) // margen: el día ART se afina abajo
      .order("ml_id") // sin orden estable, range() puede repetir filas entre páginas (duplicaba base)
      .range(off, off + PAGE - 1);
    for (const r of data ?? []) add(artDay(r.created_at), (r.sale_fee ?? 0) + (r.ship_cost ?? 0));
    if (!data || data.length < PAGE) break;
  }
  const { data: ads } = await db.from("ml_ad_spend").select("date, cost").gte("date", from).lte("date", to);
  for (const r of ads ?? []) add(r.date, (r.cost ?? 0) * (1 + iva));
  const { data: bon } = await db.from("ml_flex_bonif").select("date, amount").gte("date", from).lte("date", to);
  for (const r of bon ?? []) add(r.date, -(r.amount ?? 0));
  return base;
}

// Estima las percepciones de los días que aún no tienen dato REAL (ml_percep_pct × base del día),
// para no quedar ciegos entre factura y factura. El import mensual las pisa con estimated=false.
export async function estimateMlPercep(db: Db = supabaseAdmin(), days = 45): Promise<{ estimated: number }> {
  const pct = Number((await db.from("settings").select("value").eq("key", "ml_percep_pct").maybeSingle()).data?.value ?? 0);
  if (!pct) return { estimated: 0 };
  const from = new Date(Date.now() - days * 86400_000).toISOString().slice(0, 10);
  const to = today();
  const { data: real } = await db.from("ml_percepciones").select("date, estimated").gte("date", from);
  const reales = new Set((real ?? []).filter((r) => !r.estimated).map((r) => r.date));
  const base = await mlDailyBase(db, from, to);
  const rows = [...base.entries()]
    .filter(([d, b]) => b > 0 && !reales.has(d))
    .map(([date, b]) => ({ date, amount: Math.round(pct * b * 100) / 100, estimated: true }));
  if (rows.length) {
    const { error } = await db.from("ml_percepciones").upsert(rows, { onConflict: "date" });
    if (error) throw new Error(`ml_percepciones upsert: ${error.message}`);
  }
  return { estimated: rows.length };
}

// Import del Reporte_Facturacion mensual: percepciones + fijos REALES prorrateados por base diaria
// sobre la ventana del período (pisa los estimados) + recompute. Idempotente por período.
export async function importMlBilling(buf: Buffer, db: Db = supabaseAdmin()): Promise<{ total: number; from: string; to: string; days: number }> {
  const { percep, fijos, from, to } = parseMlBilling(buf);
  const total = percep + fijos;
  const base = await mlDailyBase(db, from, to);
  const dias = [...base.entries()].filter(([, b]) => b > 0).sort();
  if (!dias.length) throw new Error(`sin ventas ML en la ventana ${from}→${to} (¿sync corrido?)`);
  const baseTotal = dias.reduce((s, [, b]) => s + b, 0);
  const rows = dias.map(([date, b]) => ({ date, amount: Math.round((total * b / baseTotal) * 100) / 100, estimated: false }));
  const spread = rows.reduce((s, r) => s + r.amount, 0); // redondeo: el último día absorbe la diferencia
  rows[rows.length - 1].amount = Math.round((rows[rows.length - 1].amount + total - spread) * 100) / 100;
  const { error } = await db.from("ml_percepciones").upsert(rows, { onConflict: "date" });
  if (error) throw new Error(`ml_percepciones upsert: ${error.message}`);
  await db.rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
  return { total, from, to, days: rows.length };
}

// Import completo de la liquidación Flex (archivo → staging → ship_cost + tabla CP→costo → recompute).
// Auto-detecta el formato: listado DarLogistica (trae CP e ID venta) o el xlsx semanal de Santiago.
// Lo usan el endpoint /api/import/ml-flex y la subida desde /sync, para no duplicar la lógica.
export async function importMlFlex(buf: Buffer, db: Db = supabaseAdmin()): Promise<{ parsed: number; matched: number; cps: number }> {
  const dar = parseDarLogistica(buf);
  const rows = dar.length ? dar : parseSantiagoFlex(buf).map((r) => ({ ...r, cp: null as string | null }));
  if (rows.length) {
    const { error } = await db.from("ml_flex_flete").upsert(
      rows.map((r) => ({ shipment_id: r.shipment_id, price: r.price, localidad: r.localidad, fecha: r.fecha })),
      { onConflict: "shipment_id" },
    );
    if (error) throw new Error(`ml_flex_flete upsert: ${error.message}`);
  }
  // Tabla CP→costo (settings.flex_freight_by_cp): mergea los CP con precio de este archivo. Sirve para
  // estimar el flete de los pedidos en curso que todavía no están en ningún listado (editable en /config).
  const byCp: Record<string, number> = {};
  for (const r of rows) if (r.cp && r.price > 0) byCp[r.cp] = r.price;
  let cps = 0;
  if (Object.keys(byCp).length) {
    const { data: cur } = await db.from("settings").select("value").eq("key", "flex_freight_by_cp").maybeSingle();
    const merged = { ...((cur?.value as Record<string, number>) ?? {}), ...byCp };
    await db.from("settings").upsert({ key: "flex_freight_by_cp", value: merged });
    cps = Object.keys(byCp).length;
  }
  const { updated } = await applyFlexFlete(db);
  // Con la tabla ya actualizada, estima por CP los pendientes que no entraron en este listado.
  await estimateFlexByCP(db);
  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  await db.rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
  return { parsed: rows.length, matched: updated, cps };
}

// Parsea el listado de envíos de DarLogistica (.xls): header con "Número Tracking" (=shipment_id) +
// "CP" + "Precio" (la col standalone, NO "Zona precio"). Trae el CP para armar la tabla CP→costo.
export function parseDarLogistica(buf: Buffer): { shipment_id: number; price: number; cp: string | null; localidad: string | null; fecha: string | null }[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const out: { shipment_id: number; price: number; cp: string | null; localidad: string | null; fecha: string | null }[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null });
    const hi = rows.findIndex((r) => (r ?? []).some((c) => typeof c === "string" && /n[úu]mero tracking/i.test(c)));
    if (hi < 0) continue;
    const H = (rows[hi] as unknown[]).map((c) => (typeof c === "string" ? c.trim().toLowerCase() : ""));
    const cTrack = H.findIndex((c) => /n[úu]mero tracking/.test(c));
    const cPrecio = H.findIndex((c) => c === "precio"); // exacto → la col Precio, no "Zona precio"
    const cCP = H.findIndex((c) => c === "cp");
    const cLoc = H.findIndex((c) => c === "localidad");
    const cFec = H.findIndex((c) => c === "fecha venta");
    if (cTrack < 0 || cPrecio < 0) continue;
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] as unknown[]; if (!r) continue;
      const ship = Number(String(r[cTrack] ?? "").replace(/\D/g, ""));
      const price = Number(r[cPrecio]);
      if (!ship || !Number.isFinite(price) || price <= 0) continue;
      const fec = cFec >= 0 ? r[cFec] : null;
      out.push({
        shipment_id: ship,
        price,
        cp: cCP >= 0 && r[cCP] != null ? String(r[cCP]).replace(/\D/g, "").slice(0, 4) || null : null,
        localidad: cLoc >= 0 && r[cLoc] != null ? String(r[cLoc]) : null,
        fecha: fec instanceof Date ? fec.toISOString().slice(0, 10) : null,
      });
    }
  }
  return out;
}

// Parsea la liquidación Flex de Santiago (xlsx): una hoja por día, header con "CODIGO DE VENTA" +
// "PRECIO". Ignora la hoja RESUMEN y la tabla-leyenda de zonas de la derecha.
export function parseSantiagoFlex(buf: Buffer): { shipment_id: number; price: number; localidad: string | null; fecha: string | null }[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const out: { shipment_id: number; price: number; localidad: string | null; fecha: string | null }[] = [];
  for (const name of wb.SheetNames) {
    if (/resumen/i.test(name)) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, blankrows: false, defval: null });
    const hi = rows.findIndex((r) => (r ?? []).some((c) => typeof c === "string" && /codigo de venta/i.test(c)));
    if (hi < 0) continue;
    const H = (rows[hi] as unknown[]).map((c) => (typeof c === "string" ? c.toLowerCase() : ""));
    const ci = (kw: string) => H.findIndex((c) => c.includes(kw)); // findIndex → 1º match (col dato, no leyenda)
    const cCod = ci("codigo de venta"), cPre = ci("precio"), cLoc = ci("localidad"), cFec = ci("fecha");
    for (let i = hi + 1; i < rows.length; i++) {
      const r = rows[i] as unknown[]; if (!r) continue;
      const cod = r[cCod], pre = cPre >= 0 ? r[cPre] : null;
      if (cod == null || pre == null) continue;
      const ship = Number(String(cod).replace(/\D/g, ""));
      if (!ship) continue;
      const fec = cFec >= 0 ? r[cFec] : null;
      out.push({
        shipment_id: ship,
        price: Number(pre),
        localidad: cLoc >= 0 && r[cLoc] != null ? String(r[cLoc]) : null,
        fecha: fec instanceof Date ? fec.toISOString().slice(0, 10) : null,
      });
    }
  }
  return out;
}
