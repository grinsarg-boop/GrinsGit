// PASO 0 — Baseline INDEPENDIENTE de mayo 2026.
// Suma/filtra las FUENTES CRUDAS directamente. NO usa NINGUNA pieza del pipeline de la app:
// ni upsert_*/recompute_*, ni el SQL, ni parseUrbanoResponse/parseFixyXlsx/match_product (parsers
// del pipeline). Parsea el WS HTML, los XLSX y el cache de Shopify con lógica propia y mínima acá
// adentro, a propósito: si el baseline reusara el parser/SQL del pipeline, un bug compartido no se
// detectaría. La única constante compartida es la tabla de costos (aceptado: se valida el pipeline,
// no las constantes).
//
// Uso: set -a; source .env.local; set +a; npx tsx scripts/baseline_may.mts
//
// Definiciones (LA MISMA definición de cohorte que la app — la independencia es de implementación):
// - Cohorte Urbano = guías cuyo despacho cae en mayo, con despacho = ciclo (WS) ó, si no hay ciclo,
//   fecha de fulfillment de Shopify (mismo fallback que la app).
// - Cohorte Fixy = guías con Fecha (XLSX) en mayo cuyo Remito mapea a un pedido BioLabs de Shopify
//   (los gadgets / otros canales quedan afuera, igual que en la app).
// - Ingreso (COD entregadas) = valor de facturación para DL (Urbano) + Contrareembolso XLSX para POD (Fixy).
// - Flete Urbano = tarifa facturada × 1.29. Flete Fixy = Σ Importe (todas las del cohorte).
// - Comisión = 5.2% Urbano / 1% Fixy sobre COD entregado.
// - Costo producto = Σ costo(producto·pack) de las entregadas, pack = quantity de Shopify. Packs sin
//   costo en la tabla → FRENADOS (no suman, se listan aparte).
// - Pauta = referencia 19.306.283 (verificada vía 1 llamada agregada a Insights).
import * as XLSX from "xlsx";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { PRODUCT_COSTS, hasCost } from "./product_costs_may.ts";

const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const WS_CACHE = "datos/urbano_ws_cache";
const SHOP_CACHE = "datos/shopify_orders_2026-03-01.json";   // debe coincidir con local_pipeline SHOP_FROM
const MULT = 1.29;
const COMM = { urbano: 0.052, fixy: 0.01 };
const FREIGHT_FALLBACK = 10_200;   // §4.1 urbano_freight_fallback (costo final, NO ×1.29) — para guías
                                   // del cohorte sin facturación todavía (ej. las de intake PI/IF).
const PAUTA_REF = 19_306_283;
const GADGET_NUBBA = "Nu - Nubba ABO";

// -------- helpers de fecha --------
const isMay = (y: number, m: number) => y === 2026 && m === 5;
function ddmmyyyy(s: string): { y: number; m: number } | null {
  const x = /^(\d{2})-(\d{2})-(\d{4})$/.exec((s ?? "").trim());
  return x ? { y: +x[3], m: +x[2] } : null;
}
function ym(v: unknown): { y: number; m: number } | null {
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1 };
  const s = String(v ?? "").trim();
  let x = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (x) return { y: +x[1], m: +x[2] };
  x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (x) return { y: +x[3], m: +x[2] };
  return null;
}
function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// -------- Shopify cache → mapas propios (product·pack = quantity, fecha de fulfillment) --------
// keyword propio (NO match_product del pipeline). pack = quantity del line item.
const KW: [string, string][] = [["nature", "Natures"], ["pureza", "Pureza"], ["vein", "Veinguard"], ["bee", "BeeVenom"], ["altus", "Altus"]];
function prodOf(title: string): string | null {
  const t = (title ?? "").toLowerCase();
  for (const [k, n] of KW) if (t.includes(k)) return n;
  return null;
}
type OrderRec = { id: string; number: string; items: { product: string; pack: number }[]; ffMonth: { y: number; m: number } | null };
type ShopMap = { byId: Map<string, OrderRec>; byNumber: Map<string, OrderRec> };
function readShopify(): ShopMap | null {
  if (!existsSync(SHOP_CACHE)) return null;
  const orders = JSON.parse(readFileSync(SHOP_CACHE, "utf8"));
  const byId = new Map<string, OrderRec>(), byNumber = new Map<string, OrderRec>();
  for (const o of orders) {
    const items = (o.line_items ?? []).map((li: any) => ({ product: prodOf(li.title ?? ""), pack: Number(li.quantity) || 1 }))
      .filter((x: any) => x.product) as { product: string; pack: number }[];
    const ff = o.fulfillments?.[0]?.created_at;
    const rec: OrderRec = { id: String(o.id), number: String(o.name ?? o.order_number ?? "").replace("#", ""), items, ffMonth: ff ? ym(ff) : null };
    byId.set(rec.id, rec);
    if (rec.number) byNumber.set(rec.number, rec);
  }
  return { byId, byNumber };
}
// costo de un pedido = Σ costo(producto·pack) de sus items BioLabs. Packs sin costo → frenados.
function orderCosto(rec: OrderRec | undefined, frozen: Map<string, number>): number {
  if (!rec) return 0;
  let c = 0;
  for (const it of rec.items) {
    if (hasCost(it.product, it.pack)) c += PRODUCT_COSTS[it.product][it.pack];
    else { const k = `${it.product} x${it.pack}`; frozen.set(k, (frozen.get(k) ?? 0) + 1); }
  }
  return c;
}

// -------- WS cache → cohorte Urbano (ciclo ó fulfillment en mayo) + DL=entregado --------
type UrbGuide = { id: string; delivered: boolean; via: "ciclo" | "fulfillment" };
function readUrbanoCohort(shop: ShopMap | null): { cohort: UrbGuide[]; parsedFiles: number } {
  const files = readdirSync(WS_CACHE).filter((f) => f.endsWith(".html"));
  const cohort: UrbGuide[] = [];
  let parsed = 0;
  for (const f of files) {
    const html = readFileSync(`${WS_CACHE}/${f}`, "utf8");
    const id = f.replace(/\.html$/, "");
    let ciclo: { y: number; m: number } | null = null;
    let last: { key: string; code: string } | null = null;
    let any = false;
    for (const mtr of html.matchAll(/<tr\s+data="([^"]*)"/g)) {
      let o: Record<string, string>;
      try { o = JSON.parse(decodeEntities(mtr[1])); } catch { continue; }
      any = true;
      if (!ciclo && o.ciclo) ciclo = ddmmyyyy(o.ciclo);
      const full = (o.estado ?? "").replace(/\s+/g, " ").trim();
      const code = /^([A-Za-z0-9]+)\s*-/.exec(full)?.[1]?.toUpperCase() ?? full.toUpperCase();
      const d = ddmmyyyy(o.fechaEstado ?? ""); const day = /^(\d{2})/.exec((o.fechaEstado ?? "").trim())?.[1] ?? "00";
      const key = d ? `${d.y}${String(d.m).padStart(2, "0")}${day}` : "0";
      // sólo cuenta como evento real si tiene estado Y fecha parseable — igual que la app
      // (parseUrbanoResponse exige `full && at`). Sin esto se cuelan respuestas sin fecha válida.
      if (full && d && (!last || key >= last.key)) last = { key, code };
    }
    if (any) parsed++;
    // despacho = ciclo; si no hay ciclo, fecha de fulfillment de Shopify (mismo fallback que la app).
    // GUARD: el fallback exige que la guía tenga eventos WS reales (last != null). Una respuesta WS
    // "pieza inexistente" (sin eventos) NO es una guía urbano real y la app tampoco la cuenta.
    let via: "ciclo" | "fulfillment" | null = null;
    if (ciclo && isMay(ciclo.y, ciclo.m)) via = "ciclo";
    else if (!ciclo && last) { const ff = shop?.byId.get(id)?.ffMonth; if (ff && isMay(ff.y, ff.m)) via = "fulfillment"; }
    if (via) cohort.push({ id, delivered: last?.code === "DL", via });
  }
  return { cohort, parsedFiles: parsed };
}

// -------- Facturación → shopify_id → {tarifa, valor} --------
function readFacturacion(): Map<string, { tarifa: number; valor: number }> {
  const wb = XLSX.read(readFileSync(FACT), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { range: 1, raw: true });
  const m = new Map<string, { tarifa: number; valor: number }>();
  for (const r of rows) {
    if (r.rec_numguia_cliente == null) continue;
    const id = String(r.rec_numguia_cliente);
    const tarifa = Number(r.tarifa ?? 0), valor = Number(r.valor ?? 0);
    const prev = m.get(id);
    if (prev) m.set(id, { tarifa: prev.tarifa + tarifa, valor: Math.max(prev.valor, valor) });
    else m.set(id, { tarifa, valor });
  }
  return m;
}

// -------- Fixy XLSX → cohorte (Fecha mayo) SCOPED a BioLabs (Remito → pedido con item BioLabs) --------
type FixyGuide = { remito: string; delivered: boolean; importe: number; cod: number; order?: OrderRec };
function readFixyCohort(shop: ShopMap | null): { cohort: FixyGuide[]; excluidasNoBio: number } {
  const wb = XLSX.read(readFileSync(FIXY), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { raw: true });
  const out: FixyGuide[] = [];
  let excl = 0;
  for (const r of rows) {
    const d = ym(r["Fecha"]);
    if (!d || !isMay(d.y, d.m)) continue;
    const remito = String(r["Remito"] ?? "").trim();
    const order = remito ? shop?.byNumber.get(remito) : undefined;
    // scope BioLabs: el pedido existe y tiene al menos un item BioLabs (mismo criterio que la app)
    if (!order || order.items.length === 0) { excl++; continue; }
    const estado = String(r["Estado"] ?? "").replace(/\s+/g, " ").trim();
    out.push({ remito, delivered: /^POD-/i.test(estado), importe: Number(r["Importe"] ?? 0), cod: Number(r["Contrareembolso"] ?? 0), order });
  }
  return { cohort: out, excluidasNoBio: excl };
}

// -------- Meta: verificación de pauta --------
async function verifyPauta() {
  const V = process.env.META_API_VERSION ?? "v25.0";
  const acct = process.env.META_AD_ACCOUNT_ID, tok = process.env.META_ACCESS_TOKEN;
  if (!acct || !tok) return null;
  const tr = JSON.stringify({ since: "2026-05-01", until: "2026-05-31" });
  const acc: { data?: { spend: string }[] } = await fetch(
    `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams({ fields: "spend", time_range: tr, access_token: tok })).then((r) => r.json());
  const accountTotal = Number(acc.data?.[0]?.spend ?? 0);
  let url: string | undefined = `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams(
    { level: "campaign", fields: "campaign_name,spend", time_range: tr, limit: "200", access_token: tok });
  let nubba = 0;
  while (url) {
    const b: { data?: { campaign_name: string; spend: string }[]; paging?: { next?: string } } = await fetch(url).then((r) => r.json());
    for (const c of b.data ?? []) if (c.campaign_name === GADGET_NUBBA) nubba += Number(c.spend);
    url = b.paging?.next;
  }
  return { accountTotal, nubba, path_minus_nubba: accountTotal - nubba };
}

// -------- baseline agregado --------
export type BaselineLine = { cod: number; flete: number; comision: number; costo: number };
export type Baseline = {
  urbano: BaselineLine & { despachadas: number; entregadas: number; tasa: number; sinFactur: number; viaFulfillment: number };
  fixy: BaselineLine & { despachadas: number; entregadas: number; tasa: number; excluidasNoBio: number };
  total: { cod: number; flete: number; comision: number; costo: number; pauta: number; neto: number };
  frozen: Record<string, number>;
  pautaCheck: Awaited<ReturnType<typeof verifyPauta>>;
  meta: { wsParsedFiles: number; shopifyLoaded: boolean; fleteNota: string };
};

export async function computeBaselineMay(): Promise<Baseline> {
  const shop = readShopify();
  const fact = readFacturacion();
  const { cohort: urb, parsedFiles } = readUrbanoCohort(shop);
  const { cohort: fixy, excluidasNoBio } = readFixyCohort(shop);
  const frozen = new Map<string, number>();

  // Urbano
  let uCod = 0, uFlete = 0, uEnt = 0, sinFactur = 0, uCosto = 0, viaFf = 0;
  for (const g of urb) {
    if (g.via === "fulfillment") viaFf++;
    const f = fact.get(g.id);
    if (!f) sinFactur++;
    // flete hundido: facturación tarifa×1.29 si facturado, si no fallback estimado (§4.1, espejo app)
    uFlete += f ? f.tarifa * MULT : FREIGHT_FALLBACK;
    if (g.delivered) { uEnt++; uCod += f?.valor ?? 0; uCosto += orderCosto(shop?.byId.get(g.id), frozen); }
  }
  const uComm = COMM.urbano * uCod;

  // Fixy
  let fCod = 0, fFlete = 0, fEnt = 0, fCosto = 0;
  for (const g of fixy) {
    fFlete += g.importe;
    if (g.delivered) { fEnt++; fCod += g.cod; fCosto += orderCosto(g.order, frozen); }
  }
  const fComm = COMM.fixy * fCod;

  const fleteNota = "Facturación 6-7: 1 concepto (PAQUETERIA/LLO), 1 fila/guía, SIN devolución itemizada → flete = tarifa × 1.29.";
  const pautaCheck = await verifyPauta();

  const cod = uCod + fCod, flete = uFlete + fFlete, comision = uComm + fComm, costo = uCosto + fCosto;
  const neto = cod - flete - comision - costo - PAUTA_REF;

  return {
    urbano: { cod: uCod, flete: uFlete, comision: uComm, costo: uCosto, despachadas: urb.length, entregadas: uEnt, tasa: urb.length ? uEnt / urb.length : 0, sinFactur, viaFulfillment: viaFf },
    fixy: { cod: fCod, flete: fFlete, comision: fComm, costo: fCosto, despachadas: fixy.length, entregadas: fEnt, tasa: fixy.length ? fEnt / fixy.length : 0, excluidasNoBio },
    total: { cod, flete, comision, costo, pauta: PAUTA_REF, neto },
    frozen: Object.fromEntries(frozen),
    pautaCheck,
    meta: { wsParsedFiles: parsedFiles, shopifyLoaded: !!shop, fleteNota },
  };
}

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

// standalone (IIFE async: sin top-level await, transpila también en contexto CJS)
if (import.meta.url === `file://${process.argv[1]}`) void (async () => {
  const b = await computeBaselineMay();
  console.log("\n===== BASELINE MAYO 2026 (independiente, fuentes crudas) =====");
  if (!b.meta.shopifyLoaded) console.log("⚠️ sin cache de Shopify — costo/cohorte-fulfillment incompletos (correr reconcile_may que lo genera)");
  console.log(`\nURBANO  despachadas ${b.urbano.despachadas} (por fulfillment ${b.urbano.viaFulfillment}) · entregadas ${b.urbano.entregadas} · tasa ${(b.urbano.tasa * 100).toFixed(1)}% · sin facturación ${b.urbano.sinFactur}`);
  console.log(`  COD ${money(b.urbano.cod)} · flete ${money(b.urbano.flete)} · comisión ${money(b.urbano.comision)} · costo ${money(b.urbano.costo)}`);
  console.log(`\nFIXY  despachadas ${b.fixy.despachadas} · entregadas ${b.fixy.entregadas} · tasa ${(b.fixy.tasa * 100).toFixed(1)}% · excluidas no-BioLabs ${b.fixy.excluidasNoBio}`);
  console.log(`  COD ${money(b.fixy.cod)} · flete ${money(b.fixy.flete)} · comisión ${money(b.fixy.comision)} · costo ${money(b.fixy.costo)}`);
  console.log("\nTOTAL BASELINE");
  console.log(`  Ingresos (COD)  ${money(b.total.cod)}`);
  console.log(`  Flete           ${money(b.total.flete)}`);
  console.log(`  Comisión        ${money(b.total.comision)}`);
  console.log(`  Costo producto  ${money(b.total.costo)}`);
  console.log(`  Pauta (ref)     ${money(b.total.pauta)}`);
  console.log(`  Neto            ${money(b.total.neto)}`);
  console.log("\nPacks FRENADOS (sin costo):", Object.keys(b.frozen).length ? b.frozen : "(ninguno)");
  if (b.pautaCheck) console.log(`\nPauta: account ${money(b.pautaCheck.accountTotal)} − Nubba ${money(b.pautaCheck.nubba)} = ${money(b.pautaCheck.path_minus_nubba)} vs ref ${money(PAUTA_REF)}`);
})();
