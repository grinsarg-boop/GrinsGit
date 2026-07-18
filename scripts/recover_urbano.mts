// Recupera guías Urbano despachadas que nunca entraron a `shipments` (órdenes sin el tag guia-<código>
// del 08/07 → el id de seguimiento = shopify_id vive en el pedido). Consulta la API masiva por shopify_id,
// crea los shipment events (upsert idempotente, matchea por shopify_id) y recomputa. Reusa el cliente urbano
// (misma consulta + parseo que el sync) → cero divergencia.
//
// Uso: set -a; source .env.local; set +a
//   npx tsx scripts/recover_urbano.mts dry     # solo reporta cuántas recupera
//   npx tsx scripts/recover_urbano.mts run     # escribe + recompute
import { createClient } from "@supabase/supabase-js";
import { urbano } from "../lib/couriers/urbano.ts";

const MODE = process.argv[2] === "run" ? "run" : "dry";
const FROM = "2026-06-01";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

// órdenes urbano ACTIVAS (no canceladas) sin shipment vinculado, desde FROM
const orders: { id: number; shopify_id: number; created_at: string }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("orders")
    .select("id, shopify_id, created_at, cancelled_at, shipments(id)")
    .eq("courier", "urbano").is("cancelled_at", null).gte("created_at", `${FROM}T00:00:00Z`)
    .order("created_at").range(from, from + 999);
  if (error) throw new Error(error.message);
  for (const o of data ?? []) if (((o as { shipments: unknown[] }).shipments ?? []).length === 0) orders.push(o as never);
  if (!data || data.length < 1000) break;
}
const ids = orders.map((o) => String(o.shopify_id));
console.log(`${MODE.toUpperCase()} · órdenes urbano activas sin guía (desde ${FROM}): ${ids.length}`);

// Consulta la masiva (batches de 200 internos) + parseo, igual que el sync.
const { events, warnings } = await urbano.fetchStatuses(ids);
const conGuia = new Set(events.map((e) => e.tracking));
console.log(`  la API masiva devolvió eventos para ${conGuia.size} de ${ids.length} (el resto Urbano no las tiene: sin despachar / inexistentes)`);
console.log(`  eventos totales a insertar: ${events.length}${warnings.length ? ` · warnings: ${JSON.stringify(warnings).slice(0, 200)}` : ""}`);

// desglose recuperadas vs no, por semana de creación (para ver si el shopify_id alcanza o las viejas usan otro código)
const artDate = (iso: string) => new Date(Date.parse(iso) - 3 * 3600 * 1000).toISOString().slice(0, 10);
const wk = (iso: string) => { const d = artDate(iso); const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return x.toISOString().slice(0, 10); };
const bySem: Record<string, { rec: number; no: number }> = {};
for (const o of orders) { const k = wk(o.created_at); (bySem[k] ??= { rec: 0, no: 0 }); if (conGuia.has(String(o.shopify_id))) bySem[k].rec++; else bySem[k].no++; }
console.log("  por semana (recuperadas / sin guía en Urbano):");
for (const [k, v] of Object.entries(bySem).sort()) console.log(`    ${k}: ${v.rec} / ${v.no}`);

if (MODE === "dry") { console.log("\n(dry-run: no se escribió nada)"); process.exit(0); }

// upsert en tandas + recompute
let rows = 0;
for (let i = 0; i < events.length; i += 500) {
  const { data, error } = await db.rpc("upsert_shipment_events", { p: events.slice(i, i + 500) });
  if (error) throw new Error(error.message);
  rows += (data as number) ?? 0;
}
console.log(`\nupsert_shipment_events: ${rows} filas`);
const hoy = new Date().toISOString().slice(0, 10);
const { error: rcErr } = await db.rpc("recompute_daily_pnl", { p_from: FROM, p_to: hoy });
if (rcErr) throw new Error(rcErr.message);
console.log(`recompute_daily_pnl(${FROM}, ${hoy}): OK`);

// verificación: 16003 y cuántas órdenes quedaron vinculadas
const { data: chk } = await db.from("orders").select("order_number, shipments(tracking, dispatched_at, status_canonical, status_raw)").eq("order_number", "16003");
console.log(`\n16003 →`, JSON.stringify(chk?.[0]?.shipments ?? []));
const { count: aunSin } = await db.from("orders").select("id, shipments(id)", { count: "exact", head: true })
  .eq("courier", "urbano").is("cancelled_at", null).gte("created_at", `${FROM}T00:00:00Z`);
console.log(`(órdenes urbano activas desde ${FROM}: ${aunSin} — re-corré el scope para ver cuántas quedan sin guía)`);
