import { logSyncRun, supabaseAdmin } from "@/lib/supabase";
import type { CourierClient, CourierEvent } from "./types";

const TERMINALES = ["entregado", "devuelto", "siniestro", "cancelado"];

// ¿Esta advertencia dice que el CONECTOR está caído, o solo que esa guía no está?
// Un 404 es de la guía: el courier contesta bien, ese remito no existe para él. Un 401 (token
// vencido) o un 5xx sí son la conexión. Sin esta distinción, 7 pedidos de Andreani mal fichados como
// fixy ponían el sync en ROJO cada vez que la ventana no traía ningún evento — y en 'ok' cuando sí,
// con las MISMAS 7 advertencias (22/08/2026). La alerta seguía al tráfico, no a la salud.
export const esFallaDeConexion = (w: unknown) => (w as { http?: number })?.http !== 404;

// Corrida de sync de un courier (§5.4): guías no terminales < 60 d, batches ≤ 200.
// Compartido por /api/sync/urbano y /api/sync/fixy.
//
// BATCHES POR INVOCACIÓN (FASE 4d): con >1000 guías el sync completo no entra en el timeout de
// Vercel. Cada llamada procesa las `limit` guías MÁS STALE (menor updated_at); como sincronizar
// bumpea updated_at, la próxima llamada agarra las siguientes → el cron lo llama en loop
// (ceil(total/limit) veces) hasta refrescar todas. Sin cursor: la staleness auto-avanza.
// La masiva Urbano tarda ~0.3s/código. Con Hobby (60s) el máximo seguro era limit=100; con Pro
// (300s) el pg_cron llama con limit=400 (~120s masiva + upsert + recompute ≈ 150s) → las ~700
// guías activas dan la vuelta en 2 corridas de 15 min. Subir más pide medir antes: el techo son 300s.
export async function runCourierSync(courier: "urbano" | "fixy", client: CourierClient, limit = 100) {
  const db = supabaseAdmin();
  const started = Date.now();
  try {
    const cutoff = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
    const notTerminal = `(${TERMINALES.join(",")})`;
    const orDate = `dispatched_at.gte.${cutoff},dispatched_at.is.null`;
    const { count: total } = await db.from("shipments").select("*", { count: "exact", head: true })
      .eq("courier", courier).not("status_canonical", "in", notTerminal).or(orDate);
    const { data, error } = await db.from("shipments").select("id, tracking, order_ref")
      .eq("courier", courier).not("status_canonical", "in", notTerminal).or(orDate)
      .order("updated_at", { ascending: true, nullsFirst: true }).limit(limit);
    if (error) throw new Error(error.message);
    // Urbano se consulta por tracking (= shopify_id, la masiva); Fixy por order_ref (= remito).
    // Las fixy sin order_ref (otro canal) no se pueden consultar por API → se saltean.
    const trackings = (data ?? []).map((s) => (courier === "fixy" ? s.order_ref : s.tracking)).filter((x): x is string => !!x);
    let rows = 0;
    let fetchFailed = false;
    const warnings: unknown[] = [];
    for (let i = 0; i < trackings.length; i += 200) {
      const batch = trackings.slice(i, i + 200);
      let events: CourierEvent[];
      try {
        const res = await client.fetchStatuses(batch);
        events = res.events;
        if (res.warnings.length) {
          warnings.push(...res.warnings);
          if (res.warnings.some(esFallaDeConexion)) fetchFailed = true;
        }
      } catch (e) {
        // errores parciales no abortan el batch (§5)
        warnings.push({ batch: i / 200, error: String(e) });
        fetchFailed = true;
        continue;
      }
      // Un upsert cortado (statement_timeout de 8 s) no aborta la corrida: sin esto el throw saltaba el
      // update del cursor de abajo y la corrida siguiente reintentaba las MISMAS guías (23/09/2026).
      try {
        rows += await upsertEvents(events);
      } catch (e) {
        warnings.push({ batch: i / 200, upsert: String(e) });
        fetchFailed = true;
      }
    }
    // Avanzar el cursor SIEMPRE: 'sincronizado' = INTENTADO, no = 'tuvo evento nuevo'. Sin esto una
    // guía que la API devuelve vacía nunca bumpea updated_at y tapa la cabeza de la cola stalest,
    // hambreando al resto (audit A#1, causa de raíz del freeze). Las que tuvieron evento ya se
    // bumpearon en el RPC; este update cubre al resto del batch.
    const ids = (data ?? []).map((s) => s.id);
    if (ids.length) await db.from("shipments").update({ updated_at: new Date().toISOString() }).in("id", ids);

    warnings.push(...(await estadosSinMapear(courier)));
    // supabase-js no tira: devuelve { error }. Sin leerlo, el recompute de 60 d moría a los 8 s en cada
    // corrida y el P&L de cohortes quedó congelado ~16/09→23/09 sin que nada avisara.
    const { error: recErr } = await db.rpc("recompute_daily_pnl", { p_from: cutoff, p_to: today() });
    if (recErr) warnings.push({ recompute: recErr.message });
    // Nada entró Y se cayó la CONEXIÓN (ej. token Fixy vencido) ⇒ run DEGRADADO, no 'ok' (audit A#2).
    // Los 404 por guía siguen quedando en warnings: son el rastro de las guías que el courier no
    // conoce, que fue justo lo que permitió diagnosticar las 7 de Andreani.
    const status = rows === 0 && fetchFailed ? "error" : "ok";
    await logSyncRun(courier, status, rows, warnings, status === "error" ? "fetch falló y 0 filas" : null);
    // total/processed → n8n loopea ceil(total/limit) veces para cubrir todas las no-terminales.
    return Response.json({ ok: status === "ok", total: total ?? 0, processed: trackings.length, rows, warnings, ms: Date.now() - started });
  } catch (e) {
    await logSyncRun(courier, "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// DESCUBRIMIENTO de guías Urbano (fix 029): el sync de arriba sólo REFRESCA guías ya en `shipments`;
// nunca crea las nuevas. Las órdenes que Urbano despacha sin el tag guia-<código> jamás crean su shipment
// (figuran "sin despachar" aunque Urbano las tiene, ej. #16003). Acá tomamos las órdenes urbano activas
// sin guía de una ventana reciente, consultamos la masiva por su código de seguimiento (mismo client/parseo
// que el refresh) y creamos los eventos — upsert_shipment_events las matchea por order_ref (006). NO recomputa
// (runCourierSync lo hace después). Un fallo de la API acá NO debe abortar el refresh (el route lo envuelve
// en try/catch). Se corre 1×/ciclo, no en cada round del auto-drenado.
export async function discoverUrbano(
  client: CourierClient,
  opts: { sinceDays?: number; limit?: number; chunk?: number } = {},
): Promise<{ consultadas: number; recuperadas: number; rows: number; warnings: unknown[] }> {
  // Ventana 10d: una orden que a los 7 días sigue sin guía ya no se va a despachar (regla del dueño); +3d de
  // margen para que Urbano indexe. Consultar más viejas es gastar consultas en órdenes que no aparecerán.
  const { sinceDays = 10, limit = 150, chunk = 50 } = opts;
  const db = supabaseAdmin();
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString();
  const { data, error } = await db.rpc("urbano_sin_guia", { p_since: since, p_limit: limit });
  if (error) throw new Error(error.message);
  const pedidos = (data ?? []) as { shopify_id: number | string; order_number: string }[];
  if (!pedidos.length) return { consultadas: 0, recuperadas: 0, rows: 0, warnings: [] };
  // Consultar + upsertear + MARCAR POR CHUNK: (1) si el presupuesto de 60s se agota a mitad, lo persistido
  // queda firme (upsert idempotente) y el resto sigue el próximo ciclo — nunca "todo o nada"; (2) marcar
  // urbano_discovery_at de las intentadas (haya guía o no) las manda al fondo de la cola → el discover rota
  // por TODO el set en corridas sucesivas en vez de re-consultar siempre las mismas.
  const recuperadas = new Set<string>();
  const warnings: unknown[] = [];
  let rows = 0;
  for (let i = 0; i < pedidos.length; i += chunk) {
    const batch = pedidos.slice(i, i + chunk);
    // Se consultan los DOS códigos por pedido: el nuevo (BLABS<order_number>, desde el 04/08/2026) y el
    // viejo (shopify_id, que Urbano sigue respondiendo para lo despachado antes). El que no existe vuelve
    // codError 5 → parseUrbanoMasivo devuelve [] y no cuesta nada: la masiva es bulk, un request por chunk.
    const codigos = batch.flatMap((p) => [`BLABS${p.order_number}`, String(p.shopify_id)]);
    const { events, warnings: w } = await client.fetchStatuses(codigos);
    if (w.length) warnings.push(...w);
    for (const e of events) recuperadas.add(e.tracking);
    rows += await upsertEvents(events);
    await db.from("orders").update({ urbano_discovery_at: new Date().toISOString() })
      .in("shopify_id", batch.map((p) => Number(p.shopify_id)));
  }
  // Recompute acotado a la ventana sólo si se crearon guías (si se cortó antes, el refresh del próximo ciclo
  // —que ya ve las guías nuevas en shipments— las recomputa igual).
  if (rows > 0) await supabaseAdmin().rpc("recompute_daily_pnl", { p_from: since.slice(0, 10), p_to: today() });
  return { consultadas: pedidos.length, recuperadas: recuperadas.size, rows, warnings };
}

// Import manual (fixy-xlsx / facturación): mismos eventos, mismo RPC (§5.4).
// En tandas de 500 eventos: el RPC procesa evento por evento y 200 guías (~2.400 eventos) pasaban los
// 8 s del statement_timeout de PostgREST → el sync de Urbano falló 77-91% de las corridas desde el
// 20/09/2026. 500 eventos ≈ 40 guías ≈ ~1,5 s. Cada tanda commitea sola, así un corte no tira lo ya
// guardado. Partir una guía entre dos tandas no rompe nada: el UPDATE de estado relee todos sus eventos.
export async function upsertEvents(events: CourierEvent[]): Promise<number> {
  let n = 0;
  for (let i = 0; i < events.length; i += 500) {
    const { data, error } = await supabaseAdmin().rpc("upsert_shipment_events", { p: events.slice(i, i + 500) });
    if (error) throw new Error(error.message);
    n += data ?? 0;
  }
  return n;
}

export async function estadosSinMapear(courier: string): Promise<unknown[]> {
  const { data } = await supabaseAdmin()
    .from("v_estados_sin_mapear")
    .select("*")
    .eq("courier", courier);
  return (data ?? []).map((r) => ({ estado_sin_mapear: r.status_raw }));
}

export const today = () => new Date().toISOString().slice(0, 10);

// ¿Disparar otra tanda? Auto-drenado del backlog sin depender de n8n (FASE 6): cada tanda refresca
// las `limit` guías más stale; si sobra backlog, encadena la próxima. El tope `rounds` GARANTIZA
// terminación (no puede loopear infinito). processed>=limit ⇒ la tanda vino llena (había ≥limit
// stale); total>processed ⇒ quedan no-terminales sin tocar en esta tanda.
export function shouldChain(
  r: { ok: boolean; total: number; processed: number },
  rounds: number,
  limit: number,
): boolean {
  return r.ok && rounds > 1 && r.processed >= limit && r.total > r.processed;
}
