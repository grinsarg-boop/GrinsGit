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

type MlItem = { item?: { title?: string }; quantity?: number; unit_price?: number; sale_fee?: number };
export type MlOrder = {
  id: number;
  date_created: string;
  status: string;
  total_amount?: number;
  order_items?: MlItem[];
  shipping?: { id?: number; logistic_type?: string };
  payments?: { shipping_cost?: number }[];
};

// Pack (unidades por venta) embebido en el título ML: "3 Gotero Pureza"→3, "4 X 30ml"→4, "Gotas"→1.
// ML NO usa quantity para el pack (siempre viene 1); el tamaño está en el nombre del listado.
export function parseMlPack(title: string | null | undefined): number {
  const t = title ?? "";
  const lead = t.match(/^\s*(\d{1,2})\s/); //  "3 Gotero…"
  if (lead) return Number(lead[1]);
  const nx = t.match(/(\d{1,2})\s*[xX]\s*\d/); // "…4 X 30ml"
  if (nx) return Number(nx[1]);
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
  if (listCost == null) return null;
  return Math.max(0, listCost - (buyerShipCost ?? 0));
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
    pack: parseMlPack(items[0]?.item?.title),
    units: items.reduce((n, it) => n + (it.quantity ?? 0), 0),
    shipment_id: o.shipping?.id ?? null,
    total_amount: o.total_amount ?? 0,
    sale_fee: items.reduce((s, it) => s + (it.sale_fee ?? 0), 0), // comisión ML
    ship_type: o.shipping?.logistic_type ?? null,
    ship_cost: null as number | null, // lo llena enrichMlShipments (normal) / import Flex (Santiago)
    province: null as string | null, //   la provincia vive en el shipment
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
      const res = await fetch(`${API}/shipments/${r.shipment_id}`, { headers: { authorization: `Bearer ${token}` } })
        .catch(() => null);
      if (!res?.ok) return;
      const sh = await res.json();
      const fc = sellerFlete(sh.logistic_type, sh.shipping_option?.list_cost, buyerShipCost(r.raw as MlOrder));
      await db.from("ml_orders").update({ ship_type: sh.logistic_type ?? "?", ship_cost: fc }).eq("ml_id", r.ml_id);
      if (sh.logistic_type === "self_service") flex++; else if (fc != null) enriched++;
    }));
  }
  return { enriched, flex };
}

// Copia el flete Flex del staging (ml_flex_flete) a ml_orders.ship_cost por shipment_id.
// ponytail: loop por fila (~30-100/semana). Si escala, un update con join en una RPC.
export async function applyFlexFlete(db: Db = supabaseAdmin()): Promise<{ updated: number }> {
  const { data } = await db.from("ml_flex_flete").select("shipment_id, price");
  if (!data?.length) return { updated: 0 };
  let updated = 0;
  for (const f of data) {
    const { count } = await db.from("ml_orders")
      .update({ ship_cost: f.price, ship_type: "self_service" }, { count: "exact" })
      .eq("shipment_id", f.shipment_id);
    updated += count ?? 0;
  }
  return { updated };
}

// Import completo de la liquidación Flex (xlsx → staging → ship_cost → recompute). Lo usan el endpoint
// /api/import/ml-flex y la subida desde la app (/sync), para no duplicar la lógica.
export async function importMlFlex(buf: Buffer, db: Db = supabaseAdmin()): Promise<{ parsed: number; matched: number }> {
  const rows = parseSantiagoFlex(buf);
  if (rows.length) {
    const { error } = await db.from("ml_flex_flete").upsert(rows, { onConflict: "shipment_id" });
    if (error) throw new Error(`ml_flex_flete upsert: ${error.message}`);
  }
  const { updated } = await applyFlexFlete(db);
  const from = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  await db.rpc("recompute_daily_pnl", { p_from: from, p_to: today() });
  return { parsed: rows.length, matched: updated };
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
