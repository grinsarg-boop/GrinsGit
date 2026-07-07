// PASO 0 — Baseline INDEPENDIENTE de mayo 2026.
// Suma/filtra las FUENTES CRUDAS directamente. NO usa NINGUNA pieza del pipeline de la app:
// ni upsert_*/recompute_*, ni el SQL, ni parseUrbanoResponse/parseFixyXlsx (los parsers del
// pipeline). Parsea el WS HTML y los XLSX con lógica propia y mínima acá adentro, a propósito:
// si el baseline reusara el parser/SQL del pipeline, un bug compartido no se detectaría.
//
// Uso: set -a; source .env.local; set +a; npx tsx scripts/baseline_may.mts
//
// Definiciones (mismas que la app, cruce de fuentes distinto):
// - Cohorte Urbano = guías con CICLO (WS) en mayo. Cohorte Fixy = guías con Fecha (XLSX) en mayo.
// - Ingreso (COD entregadas) = valor de facturación para guías DL (Urbano) + Contrareembolso del
//   XLSX para POD-ENTREGADA (Fixy).
// - Flete Urbano = tarifa facturada × 1.29 (ver decisión abajo). Flete Fixy = Σ Importe (todas).
// - Comisión = 5.2% Urbano / 1% Fixy sobre COD entregado. Costo producto = unidades × costo unit.
// - Pauta = referencia 19.306.283 (verificada vía 1 llamada agregada a Insights).
import * as XLSX from "xlsx";
import { readFileSync, readdirSync } from "node:fs";

const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const WS_CACHE = "datos/urbano_ws_cache";
const MULT = 1.29;                 // proxy flete ida+vuelta (SPEC §4.1) — ver decisión de flete
const COMM = { urbano: 0.052, fixy: 0.01 };
const MP_FEE = 0.10;               // §4.3 (no se usa: sin costo de seña acá; ver nota)
const PAUTA_REF = 19_306_283;      // referencia fijada (post override Ve-CBO→Veinguard)
const GADGET_NUBBA = "Nu - Nubba ABO";

// -------- helpers de fecha --------
const isMay = (y: number, m: number) => y === 2026 && m === 5;
// "DD-MM-YYYY" → {y,m,key}  (formato del WS)
function ddmmyyyy(s: string): { y: number; m: number } | null {
  const x = /^(\d{2})-(\d{2})-(\d{4})$/.exec((s ?? "").trim());
  return x ? { y: +x[3], m: +x[2] } : null;
}
// Fecha Fixy: Date (cellDates) o "YYYY-MM-DD ..." → {y,m}
function anyDate(v: unknown): { y: number; m: number } | null {
  if (v instanceof Date) return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1 };
  const s = String(v ?? "").trim();
  let x = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (x) return { y: +x[1], m: +x[2] };
  x = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);        // dd/mm/yyyy
  if (x) return { y: +x[3], m: +x[2] };
  return null;
}
function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// -------- 1. WS cache → cohorte Urbano (ciclo en mayo) + estado terminal (DL=entregado) --------
// Parseo propio del HTML: cada paso es <tr data="{JSON entity-encoded}"> con estado/fechaEstado/ciclo.
type UrbGuide = { id: string; delivered: boolean; lastCode: string };
function readUrbanoCohort(): { cohort: UrbGuide[]; parsedFiles: number } {
  const files = readdirSync(WS_CACHE).filter((f) => f.endsWith(".html"));
  const cohort: UrbGuide[] = [];
  let parsed = 0;
  for (const f of files) {
    const html = readFileSync(`${WS_CACHE}/${f}`, "utf8");
    const id = f.replace(/\.html$/, "");
    let ciclo: { y: number; m: number } | null = null;
    let last: { at: string; code: string } | null = null;
    let any = false;
    for (const mtr of html.matchAll(/<tr\s+data="([^"]*)"/g)) {
      let o: Record<string, string>;
      try { o = JSON.parse(decodeEntities(mtr[1])); } catch { continue; }
      any = true;
      if (!ciclo && o.ciclo) ciclo = ddmmyyyy(o.ciclo);
      const full = (o.estado ?? "").replace(/\s+/g, " ").trim();
      const code = /^([A-Za-z0-9]+)\s*-/.exec(full)?.[1]?.toUpperCase() ?? full.toUpperCase();
      const at = o.fechaEstado ?? "";
      // "último" = mayor fechaEstado (DD-MM-YYYY → orden por Y,M,D)
      const key = (s: string) => { const d = ddmmyyyy(s); return d ? `${d.y}${String(d.m).padStart(2, "0")}` + (/^(\d{2})/.exec(s)?.[1] ?? "00") : "0"; };
      if (full && (!last || key(at) >= key(last.at))) last = { at, code };
    }
    if (any) parsed++;
    if (ciclo && isMay(ciclo.y, ciclo.m)) {
      cohort.push({ id, delivered: last?.code === "DL", lastCode: last?.code ?? "?" });
    }
  }
  return { cohort, parsedFiles: parsed };
}

// -------- 2. Facturación → mapa shopify_id → {tarifa, valor} --------
// valor = importe declarado = contrareembolso (COD) de la guía; tarifa = flete de ida facturado.
function readFacturacion(): Map<string, { tarifa: number; valor: number }> {
  const wb = XLSX.read(readFileSync(FACT), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { range: 1, raw: true });
  const m = new Map<string, { tarifa: number; valor: number }>();
  for (const r of rows) {
    if (r.rec_numguia_cliente == null) continue;
    const id = String(r.rec_numguia_cliente);
    const tarifa = Number(r.tarifa ?? 0);
    const valor = Number(r.valor ?? 0);
    const prev = m.get(id);
    // guía con >1 fila (rarísimo, 1 caso jun): sumo tarifa, tomo el valor máximo (el COD real)
    if (prev) m.set(id, { tarifa: prev.tarifa + tarifa, valor: Math.max(prev.valor, valor) });
    else m.set(id, { tarifa, valor });
  }
  return m;
}

// -------- 3. Fixy XLSX → cohorte (Fecha mayo), plano --------
type FixyGuide = { remito: string; delivered: boolean; importe: number; cod: number; estado: string };
function readFixyCohort(): FixyGuide[] {
  const wb = XLSX.read(readFileSync(FIXY), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { raw: true });
  const out: FixyGuide[] = [];
  for (const r of rows) {
    const d = anyDate(r["Fecha"]);
    if (!d || !isMay(d.y, d.m)) continue;
    const estado = String(r["Estado"] ?? "").replace(/\s+/g, " ").trim();
    out.push({
      remito: String(r["Remito"] ?? "").trim(),
      delivered: /^POD-/i.test(estado),                 // POD-ENTREGADA
      importe: Number(r["Importe"] ?? 0),
      cod: Number(r["Contrareembolso"] ?? 0),
      estado,
    });
  }
  return out;
}

// -------- 4. Meta: verificación de la referencia de pauta (2 caminos de agregación) --------
async function verifyPauta(): Promise<{ accountTotal: number; nubba: number; path_minus_nubba: number; path_minus_150596: number } | null> {
  const V = process.env.META_API_VERSION ?? "v25.0";
  const acct = process.env.META_AD_ACCOUNT_ID;
  const tok = process.env.META_ACCESS_TOKEN;
  if (!acct || !tok) { console.log("  (sin credenciales Meta — salto verificación de pauta)"); return null; }
  const tr = JSON.stringify({ since: "2026-05-01", until: "2026-05-31" });
  // camino A: agregado a nivel cuenta, sin breakdown
  const acc: { data?: { spend: string }[] } = await fetch(
    `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams({ fields: "spend", time_range: tr, access_token: tok })
  ).then((r) => r.json());
  const accountTotal = Number(acc.data?.[0]?.spend ?? 0);
  // breakdown por campaña sólo para aislar el gadget Nubba (el único excluido post-override)
  let url: string | undefined = `https://graph.facebook.com/${V}/${acct}/insights?` + new URLSearchParams(
    { level: "campaign", fields: "campaign_name,spend", time_range: tr, limit: "200", access_token: tok });
  let nubba = 0;
  while (url) {
    const b: { data?: { campaign_name: string; spend: string }[]; paging?: { next?: string } } = await fetch(url).then((r) => r.json());
    for (const c of b.data ?? []) if (c.campaign_name === GADGET_NUBBA) nubba += Number(c.spend);
    url = b.paging?.next;
  }
  return { accountTotal, nubba, path_minus_nubba: accountTotal - nubba, path_minus_150596: accountTotal - 150_596 };
}

// -------- baseline agregado --------
export type BaselineLine = { cod: number; flete: number; comision: number; costo: number };
export type Baseline = {
  urbano: BaselineLine & { despachadas: number; entregadas: number; tasa: number; sinFactur: number };
  fixy: BaselineLine & { despachadas: number; entregadas: number; tasa: number };
  total: { cod: number; flete: number; comision: number; costo: number; pauta: number; neto: number };
  pautaCheck: Awaited<ReturnType<typeof verifyPauta>>;
  meta: { wsParsedFiles: number; costoNota: string; fleteNota: string };
};

export async function computeBaselineMay(): Promise<Baseline> {
  const fact = readFacturacion();
  const { cohort: urb, parsedFiles } = readUrbanoCohort();
  const fixy = readFixyCohort();

  // Urbano
  let uCod = 0, uFlete = 0, uEnt = 0, sinFactur = 0;
  for (const g of urb) {
    const f = fact.get(g.id);
    if (!f) { sinFactur++; }
    uFlete += (f?.tarifa ?? 0) * MULT;                 // todas las guías del cohorte (hundido)
    if (g.delivered) { uEnt++; uCod += f?.valor ?? 0; } // COD sólo de entregadas
  }
  const uComm = COMM.urbano * uCod;

  // Fixy
  let fCod = 0, fFlete = 0, fEnt = 0;
  for (const g of fixy) {
    fFlete += g.importe;                                // CSYDV cobra: todas las guías
    if (g.delivered) { fEnt++; fCod += g.cod; }
  }
  const fComm = COMM.fixy * fCod;

  // Costo producto: no hay tabla product_costs seedeada (001 no la puebla) → 0 en app y baseline.
  const uCosto = 0, fCosto = 0;
  const costoNota = "product_costs NO está seedeada (001 sólo crea 5 products, sin costos). " +
    "unit_cost = 0 en toda la app → costo_producto = 0 en app y baseline. Sin fuente de costos.";
  const fleteNota = "Facturación 6-7: 1 concepto (PAQUETERIA/LLO), 1 fila por guía, SIN ítems de " +
    "devolución. No trae la vuelta itemizada → flete = tarifa × 1.29 (el 1.29 es el proxy ida+vuelta).";

  const pautaCheck = await verifyPauta();

  const cod = uCod + fCod, flete = uFlete + fFlete, comision = uComm + fComm, costo = uCosto + fCosto;
  const neto = cod - flete - comision - costo - PAUTA_REF;

  return {
    urbano: { cod: uCod, flete: uFlete, comision: uComm, costo: uCosto, despachadas: urb.length, entregadas: uEnt, tasa: urb.length ? uEnt / urb.length : 0, sinFactur },
    fixy: { cod: fCod, flete: fFlete, comision: fComm, costo: fCosto, despachadas: fixy.length, entregadas: fEnt, tasa: fixy.length ? fEnt / fixy.length : 0 },
    total: { cod, flete, comision, costo, pauta: PAUTA_REF, neto },
    pautaCheck,
    meta: { wsParsedFiles: parsedFiles, costoNota, fleteNota },
  };
}

const money = (n: number) => "$ " + Math.round(n).toLocaleString("es-AR");

// standalone (IIFE async: sin top-level await, así el módulo transpila también en contexto CJS)
if (import.meta.url === `file://${process.argv[1]}`) void (async () => {
  const b = await computeBaselineMay();
  console.log("\n===== BASELINE MAYO 2026 (independiente, fuentes crudas) =====");
  console.log("\nURBANO  (cohorte = ciclo WS en mayo)");
  console.log(`  despachadas ${b.urbano.despachadas} · entregadas ${b.urbano.entregadas} · tasa ${(b.urbano.tasa * 100).toFixed(1)}%`);
  console.log(`  COD entregado ${money(b.urbano.cod)} · flete ${money(b.urbano.flete)} · comisión ${money(b.urbano.comision)}`);
  console.log(`  guías del cohorte SIN fila de facturación: ${b.urbano.sinFactur}`);
  console.log("\nFIXY  (cohorte = Fecha XLSX en mayo)");
  console.log(`  despachadas ${b.fixy.despachadas} · entregadas ${b.fixy.entregadas} · tasa ${(b.fixy.tasa * 100).toFixed(1)}%`);
  console.log(`  COD entregado ${money(b.fixy.cod)} · flete ${money(b.fixy.flete)} · comisión ${money(b.fixy.comision)}`);
  console.log("\nTOTAL BASELINE");
  console.log(`  Ingresos (COD entregado) ${money(b.total.cod)}`);
  console.log(`  Flete                    ${money(b.total.flete)}`);
  console.log(`  Comisión                 ${money(b.total.comision)}`);
  console.log(`  Costo producto           ${money(b.total.costo)}   (${b.meta.costoNota})`);
  console.log(`  Pauta (ref)              ${money(b.total.pauta)}`);
  console.log(`  Neto                     ${money(b.total.neto)}`);
  console.log("\nDecisión FLETE:", b.meta.fleteNota);
  if (b.pautaCheck) {
    const p = b.pautaCheck;
    console.log("\nVerificación PAUTA (2 caminos sobre la misma API):");
    console.log(`  account total mayo          ${money(p.accountTotal)}`);
    console.log(`  − Nubba (gadget real)       ${money(p.nubba)}`);
    console.log(`  = account − Nubba           ${money(p.path_minus_nubba)}   vs ref ${money(PAUTA_REF)}  (diff ${money(p.path_minus_nubba - PAUTA_REF)})`);
    console.log(`  account − 150.596 (prompt)  ${money(p.path_minus_150596)}   (subestima en ~73.712 = Ve-CBO, que el override manda a Veinguard)`);
  }
  console.log("\nWS cache: archivos parseados con datos:", b.meta.wsParsedFiles);
})();
