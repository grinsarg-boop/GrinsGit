// Gate de matching 20+20 (tarea 3). Levanta Postgres 16 embebido con 001–004, toma guías
// REALES (facturación Urbano + XLSX Fixy), trae los pedidos de Shopify, corre el matching real
// (RPCs) y reporta link-rate + fallos. Uso: set -a; source .env.local; set +a; npx tsx scripts/matching_gate.mts
import EmbeddedPostgres from "embedded-postgres";
import * as XLSX from "xlsx";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseUrbanoResponse } from "../lib/couriers/urbano.ts";
import { parseFixyXlsx } from "../lib/couriers/fixy.ts";
import { getShopifyToken, SHOPIFY_API_VERSION } from "../lib/shopify.ts";

const FACT = "datos/facturacion_urbano_may-jun.xlsx";
const FIXY = "datos/fixy_guias_may-jul.xlsx";
const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;

// ---------- Shopify helpers ----------
async function shopGet(path: string, token: string) {
  const res = await fetch(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}/${path}`,
    { headers: { "X-Shopify-Access-Token": token } });
  if (!res.ok) return null;
  return res.json();
}
const orderById = async (id: string, t: string) => (await shopGet(`orders/${id}.json`, t))?.order ?? null;
const orderByName = async (name: string, t: string) =>
  (await shopGet(`orders.json?status=any&name=${encodeURIComponent(name)}&limit=1`, t))?.orders?.[0] ?? null;

// ---------- selección de guías ----------
function pickUrbano(n: number) {
  const wb = XLSX.read(readFileSync(FACT), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { range: 1, raw: true });
  const seen = new Set<string>(); const out: { id: string; tarifa: number }[] = [];
  for (const r of rows) {
    const id = String(r.rec_numguia_cliente ?? "").trim();
    if (id && !seen.has(id)) { seen.add(id); out.push({ id, tarifa: Number(r.tarifa) }); }
    if (out.length >= n) break;
  }
  return out;
}
// Fixy: cruza estados — cubre cada código presente, rellena con POD/CSYDV hasta n. Remito válido.
function pickFixy(n: number) {
  const wb = XLSX.read(readFileSync(FIXY), { cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { raw: true });
  const code = (r: Record<string, unknown>) => String(r["Estado"] ?? "").split("-")[0].trim();
  const valid = rows.filter((r) => /^\d+$/.test(String(r["Remito"] ?? "").trim()));
  const byCode = new Map<string, Record<string, unknown>[]>();
  for (const r of valid) { const c = code(r); (byCode.get(c) ?? byCode.set(c, []).get(c)!).push(r); }
  const out: Record<string, unknown>[] = [];
  for (const [, rs] of byCode) out.push(rs[0]);                 // 1 de cada estado (cruce)
  for (const c of ["POD", "CSYDV"]) for (const r of (byCode.get(c) ?? []).slice(1)) {
    if (out.length >= n) break; out.push(r);                    // rellena con volumen real
  }
  return out.slice(0, n);
}

// ---------- main ----------
const dir = mkdtempSync(join(tmpdir(), "gate-pg-"));
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port: 55443, persistent: false });
const bootstrap = `create role anon nologin; create role authenticated nologin;
  create role service_role nologin; create publication supabase_realtime;`;

try {
  await pg.initialise(); await pg.start(); await pg.createDatabase("app");
  const db = pg.getPgClient("app"); await db.connect();
  await db.query(bootstrap);
  for (const f of ["001_init", "002_rpcs", "003_matching_shopify_id", "004_fixy_status_map"])
    await db.query(readFileSync(`supabase/migrations/${f}.sql`, "utf8"));

  const token = await getShopifyToken();
  const urb = pickUrbano(20);
  const fix = pickFixy(20);
  console.log(`Seleccionadas: ${urb.length} Urbano, ${fix.length} Fixy\n`);

  // ===== URBANO: pedido → WS (upsert_shipment_events) → facturación (import_urbano_freight) =====
  for (const u of urb) {
    const o = await orderById(u.id, token);
    if (o) await db.query("select upsert_order($1)", [o]);
  }
  for (const u of urb) {
    const html = await fetch(`https://www.urbano.com.ar/webservice/cespecifica/?shi_codigo=4362&cli_codigo=${u.id}`).then((r) => r.text());
    const ev = parseUrbanoResponse(html, u.id);
    if (ev.length) await db.query("select upsert_shipment_events($1)", [JSON.stringify(ev)]);
    await new Promise((r) => setTimeout(r, 120));
  }
  await db.query("select import_urbano_freight($1)", [JSON.stringify(urb.map((u) => ({ tracking: u.id, tarifa: u.tarifa })))]);

  // ===== FIXY: pedido (por Remito) → eventos del XLSX (upsert_shipment_events, ejercita 004) =====
  const fixTrk = new Set(fix.map((r) => String(r["Nro Guia"]).trim()));
  for (const r of fix) {
    const o = await orderByName(String(r["Remito"]).trim(), token);
    if (o) await db.query("select upsert_order($1)", [o]);
  }
  const allFixEvents = parseFixyXlsx(readFileSync(FIXY)).filter((e) => fixTrk.has(e.tracking));
  await db.query("select upsert_shipment_events($1)", [JSON.stringify(allFixEvents)]);

  // ---------- reporte ----------
  async function report(label: string, trackings: string[], meta: Map<string, { ref: string; phone?: string; date?: string; estado?: string }>) {
    const { rows } = await db.query(
      `select s.tracking, s.order_id, s.status_canonical, s.order_ref
         from shipments s where s.tracking = any($1)`, [trackings]);
    const byTrk = new Map(rows.map((r: { tracking: string }) => [r.tracking, r]));
    let ok = 0; const fails: string[] = [];
    for (const t of trackings) {
      const r = byTrk.get(t) as { order_id: number | null } | undefined;
      if (r?.order_id) ok++;
      else {
        const m = meta.get(t)!;
        // ¿teléfono+fecha lo resolvería? sólo si hay teléfono en la fuente (Fixy) y un pedido cercano
        let fb = "sin teléfono en la fuente";
        if (m.phone) {
          const cand = await shopGet(`orders.json?status=any&created_at_min=${m.date}T00:00:00-03:00&limit=250&fields=id,phone,shipping_address`, token);
          const hit = (cand?.orders ?? []).some((o: { phone?: string; shipping_address?: { phone?: string } }) =>
            [o.phone, o.shipping_address?.phone].some((p) => p && p.replace(/\D/g, "").endsWith(m.phone!.replace(/\D/g, "").slice(-8))));
          fb = hit ? "SÍ (teléfono+fecha encuentra pedido)" : "no (sin pedido con ese teléfono)";
        }
        fails.push(`    guía ${t} (ref ${m.ref}${m.estado ? `, ${m.estado}` : ""}) → sin match | teléfono+fecha: ${fb}`);
      }
    }
    console.log(`${label}: ${ok}/${trackings.length} por order_ref  ${ok >= trackings.length - 1 ? "✅" : "❌ (<19)"}`);
    if (fails.length) console.log(fails.join("\n"));
    return ok;
  }

  const urbMeta = new Map(urb.map((u) => [u.id, { ref: u.id }]));
  const okUrb = await report("URBANO", urb.map((u) => u.id), urbMeta);

  const fixMeta = new Map(fix.map((r) => [String(r["Nro Guia"]).trim(), {
    ref: String(r["Remito"] ?? "").trim(),
    phone: String(r["COM.CELULAR"] ?? "").trim() || undefined,
    date: (r["Fecha"] as Date | undefined)?.toISOString?.().slice(0, 10),
    estado: String(r["Estado"] ?? "").split("-")[0],
  }]));
  const okFix = await report("FIXY", fix.map((r) => String(r["Nro Guia"]).trim()), fixMeta);

  // distribución de estados canónicos resultante (verifica 004 en vivo)
  const { rows: dist } = await db.query(
    `select courier, status_canonical, count(*) n from shipments group by 1,2 order by 1,3 desc`);
  console.log("\nEstados canónicos resultantes:");
  for (const r of dist) console.log(`  ${r.courier}\t${r.status_canonical}\t${r.n}`);

  // estados crudos sin mapear (con conteo) — lo que hay que completar en /config
  const { rows: unmapped } = await db.query(
    `select s.courier, se.status_raw, count(*) n from shipment_events se
       join shipments s on s.id = se.shipment_id
      where not exists (select 1 from courier_status_map m where m.courier = s.courier and (
        (m.match_type='exact' and upper(trim(m.status_raw))=upper(trim(se.status_raw))) or
        (m.match_type='keyword' and se.status_raw ilike '%'||m.status_raw||'%')))
      group by 1,2 order by 3 desc`);
  console.log("\nEstados SIN MAPEAR (para /config):");
  if (!unmapped.length) console.log("  (ninguno)");
  for (const r of unmapped) console.log(`  ${r.courier}\t${r.n}\t${JSON.stringify(r.status_raw)}`);

  console.log(`\nGATE: Urbano ${okUrb}/20 ${okUrb >= 19 ? "PASA" : "FRENA"} · Fixy ${okFix}/20 ${okFix >= 19 ? "PASA" : "FRENA"}`);
  await db.end();
} catch (e) {
  console.error("❌", (e as Error).message);
  process.exitCode = 1;
} finally {
  await pg.stop().catch(() => {});
  rmSync(dir, { recursive: true, force: true });
}
