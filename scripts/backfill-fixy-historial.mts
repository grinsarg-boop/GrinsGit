// Backfill del historial de Fixy (073). El conector guardaba sólo `fechas[0]`, así que en `shipments`
// quedó un evento por guía: el estado que tenía el día en que el sync la miró. La API devuelve el
// historial ENTERO en cada llamada, así que re-consultar lo recupera hacia atrás — el fix es retroactivo.
//
// Consulta TODAS las guías fixy (el sync normal sólo refresca las NO terminales de los últimos 60 días,
// que hoy son 39: por eso lo viejo no se backfillea solo) y las upsertea con el mismo cliente que el
// sync → cero divergencia de parseo. Idempotente: `on conflict do nothing` sobre
// (shipment_id, status_raw, occurred_at); correrlo dos veces no duplica nada.
//
// Uso: set -a; source .env.local; set +a
//   npx tsx scripts/backfill-fixy-historial.mts dry     # consulta y reporta, NO escribe
//   npx tsx scripts/backfill-fixy-historial.mts run     # escribe + recompute
import { createClient } from "@supabase/supabase-js";
import { fixy } from "../lib/couriers/fixy.ts";

const MODE = process.argv[2] === "run" ? "run" : "dry";
const CHUNK = 25;   // remitos por tanda: ~9 eventos c/u ⇒ ~225 por RPC, lejos del statement_timeout
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } });

// Paginado obligatorio: PostgREST corta en 1000 filas sin avisar.
const guias: { id: number; order_ref: string; tracking: string }[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("shipments").select("id, order_ref, tracking")
    .eq("courier", "fixy").not("order_ref", "is", null)
    .order("id").range(from, from + 999);
  if (error) throw new Error(error.message);
  guias.push(...(data ?? []) as typeof guias);
  if (!data || data.length < 1000) break;
}
const trackingDe = new Map(guias.map((g) => [g.order_ref, g.tracking]));
console.log(`${MODE.toUpperCase()} — ${guias.length} guías fixy con remito`);

let responden = 0, eventos = 0, conAlta = 0, filas = 0;
const warnings: unknown[] = [];
const t0 = Date.now();
for (let i = 0; i < guias.length; i += CHUNK) {
  const chunk = guias.slice(i, i + CHUNK);
  const { events: todos, warnings: w } = await fixy.fetchStatuses(chunk.map((g) => g.order_ref));
  warnings.push(...w);
  // El upsert matchea por (courier, tracking): si la API devolviera un Nro Guia distinto del que
  // tiene la base crearía una guía PARALELA para el mismo pedido y el COD se contaría dos veces.
  // No pasó en ninguna de las 1.565 medidas, pero es plata: se descarta y se avisa.
  const events = todos.filter((e) => {
    if (e.tracking === trackingDe.get(e.order_ref!)) return true;
    warnings.push({ remito: e.order_ref, tracking_base: trackingDe.get(e.order_ref!), tracking_api: e.tracking });
    return false;
  });
  const porRemito = new Set(events.map((e) => e.order_ref));
  responden += porRemito.size;
  eventos += events.length;
  for (const ref of porRemito) {
    if (events.some((e) => e.order_ref === ref && e.status_raw === "41")) conAlta++;
  }
  if (MODE === "run" && events.length) {
    const t = Date.now();
    const { data, error } = await db.rpc("upsert_shipment_events", { p: events });
    if (error) throw new Error(`upsert falló en el chunk ${i / CHUNK}: ${error.message}`);
    filas += data ?? 0;
    if (i === 0) console.log(`  primer upsert: ${events.length} eventos en ${Date.now() - t} ms`);
  }
  if ((i / CHUNK) % 10 === 0) process.stdout.write(`  ${i + chunk.length}/${guias.length}\r`);
}
const seg = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`\nresponden: ${responden}/${guias.length} · eventos traídos: ${eventos} · con alta (41): ${conAlta}`
  + ` (${(100 * conAlta / guias.length).toFixed(1)}%) · filas nuevas: ${filas} · ${seg}s`);
if (warnings.length) console.log(`warnings: ${warnings.length}`, warnings.slice(0, 5));

if (MODE === "run") {
  // El upsert ya re-ancló dispatched_at guía por guía; el P&L por día de despacho sale de daily_pnl.
  // MES POR MES: el rango entero (mayo→hoy) de una sola vez se come el statement_timeout de PostgREST;
  // por mes tarda 1-5 s. Medido el 13/08/2026.
  const { data: r } = await db.from("shipments").select("dispatched_at")
    .eq("courier", "fixy").order("dispatched_at").limit(1);
  const desde = new Date(`${(r?.[0]?.dispatched_at ?? "2026-05-01").slice(0, 7)}-01T00:00:00Z`);
  const hoy = new Date();
  for (let m = desde; m <= hoy; m.setUTCMonth(m.getUTCMonth() + 1)) {
    const fin = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0));
    const [a, b] = [m.toISOString().slice(0, 10), (fin < hoy ? fin : hoy).toISOString().slice(0, 10)];
    const { error } = await db.rpc("recompute_daily_pnl", { p_from: a, p_to: b });
    if (error) throw new Error(`recompute ${a}→${b}: ${error.message}`);
    console.log(`recompute_daily_pnl ${a} → ${b} ✅`);
  }
}
