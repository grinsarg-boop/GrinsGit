import type { CourierClient, CourierEvent, FetchStatusesResult } from "./types";

// Tracking de Urbano (SPEC §5.4, R7). El sync incremental usa la API oficial MASIVA (JSON, bulk,
// sin rate-limit): POST /tracking/consultaTrackingMasivo/, auth en el body, consulta por
// codigoSeguimiento = id de pedido Shopify (Opción A: shipment.tracking = id Shopify).
// El BACKFILL histórico usa el cache del scraping viejo (HTML, ya validado contra la oficial) →
// parseUrbanoResponse se conserva para eso. Sólo cambia el transporte del sync en adelante, no la
// semántica: mismos códigos (005) y mismo evento sintético de ciclo.
const API_BASE = (process.env.URBANO_API_URL ?? "https://apis.urbano.com.ar/").replace(/\/$/, "");
const MASIVO_URL = `${API_BASE}/tracking/consultaTrackingMasivo/`;
const BATCH = 200;          // la masiva es bulk; tandas de 200 por request

// Estado sintético de despacho: mapeado a 'despachado' por el seed de 003. occurred_at = ciclo,
// para cohortear por fecha de despacho real (regla de reconciliación del dashboard viejo).
export const CICLO_STATUS = "CICLO - Despacho";

// "DD-MM-YYYY" → ISO a mediodía UTC (evita corrimiento de día por timezone).
function parseUrbanoDate(s: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}T12:00:00Z` : null;
}

function decodeEntities(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

// Parsea el HTML del WS → CourierEvents. Máximo 2 por guía: despacho (ciclo) + estado actual.
// Cada paso viene como <tr data="{JSON entity-encoded}">. Guía inexistente → sin filas → [].
export function parseUrbanoResponse(html: string, cliCodigo: string): CourierEvent[] {
  const events: CourierEvent[] = [];
  let ciclo: string | null = null;
  let gui: string | undefined;

  for (const m of html.matchAll(/<tr\s+data="([^"]*)"/g)) {
    let o: Record<string, string>;
    try { o = JSON.parse(decodeEntities(m[1])); } catch { continue; }
    gui = o.gui_numero || gui;

    // status_raw = CÓDIGO del estado (ej. "DL", "RC", "RM"): la descripción del WS varía y no
    // coincide con la del mapa operativo, pero el código sí. map_status lo resuelve por exact
    // (seed 005), prioritario sobre keyword. La descripción cruda se guarda en raw.
    const full = (o.estado ?? "").replace(/\s+/g, " ").trim();
    const code = /^([A-Za-z0-9]+)\s*-/.exec(full)?.[1]?.toUpperCase() ?? full;
    const raw = { gui_numero: o.gui_numero, servicio: o.servicio, producto: o.proCodigo,
      linea: o.linea, estado_desc: full };
    const at = parseUrbanoDate(o.fechaEstado ?? "");
    if (full && at) {
      events.push({ courier: "urbano", tracking: cliCodigo, order_ref: cliCodigo,
        status_raw: code, occurred_at: at, raw });
    }
    if (!ciclo && o.ciclo) ciclo = parseUrbanoDate(o.ciclo);
  }

  // Despacho sintético en ciclo (una vez por guía) → dispatched_at correcto.
  if (ciclo) {
    events.unshift({ courier: "urbano", tracking: cliCodigo, order_ref: cliCodigo,
      status_raw: CICLO_STATUS, occurred_at: ciclo, raw: { gui_numero: gui } });
  }
  return events;
}

// Item de la API masiva → CourierEvents. Misma semántica que parseUrbanoResponse (HTML): despacho
// sintético en `fecha` (= ciclo) + un evento por movimiento. El `check` YA es el código (PI, LD,
// DL, RC…) → integra con 005 sin split. codError<>0 (ej. "Pieza postal inexistente") → [].
type MasivoMovimiento = { check?: string; checkFecha?: string; descripcion?: string; codigo_motivo?: string | null };
type MasivoItem = {
  codGestion?: string; codError?: number; fecha?: string; estado?: string;
  producto?: string; movimientos?: MasivoMovimiento[];
};
export function parseUrbanoMasivo(item: MasivoItem, cliCodigo: string): CourierEvent[] {
  if (!item || item.codError !== 0 || !Array.isArray(item.movimientos)) return [];
  const events: CourierEvent[] = [];
  const ciclo = parseUrbanoDate(item.fecha ?? "");
  if (ciclo) {
    events.push({ courier: "urbano", tracking: cliCodigo, order_ref: cliCodigo,
      status_raw: CICLO_STATUS, occurred_at: ciclo, raw: { fecha: item.fecha, producto: item.producto } });
  }
  for (const m of item.movimientos) {
    const at = parseUrbanoDate(m.checkFecha ?? "");
    const code = (m.check ?? "").trim().toUpperCase();
    if (code && at) {
      events.push({ courier: "urbano", tracking: cliCodigo, order_ref: cliCodigo,
        status_raw: code, occurred_at: at,
        raw: { descripcion: (m.descripcion ?? "").trim(), codigo_motivo: m.codigo_motivo, estado_actual: item.estado } });
    }
  }
  return events;
}

async function fetchMasivo(codigos: string[]): Promise<MasivoItem[]> {
  const res = await fetch(MASIVO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      autentificacion: { shipper: Number(process.env.URBANO_SHIPPER), password: process.env.URBANO_PASSWORD },
      datos: codigos.map((c) => ({ codigoSeguimiento: c })),
    }),
  });
  if (!res.ok) throw new Error(`Urbano masiva ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

// trackings = ids de pedido Shopify. Tandas de BATCH (la masiva es bulk → una llamada por tanda).
// Un fallo de tanda no aborta el resto (se reintenta en el próximo sync, §5.4).
export const urbano: CourierClient = {
  async fetchStatuses(trackings: string[]): Promise<FetchStatusesResult> {
    const events: CourierEvent[] = [];
    const warnings: unknown[] = [];
    for (let i = 0; i < trackings.length; i += BATCH) {
      const chunk = trackings.slice(i, i + BATCH);
      try {
        const items = await fetchMasivo(chunk);
        for (const it of items) events.push(...parseUrbanoMasivo(it, String(it.codGestion ?? "")));
      } catch (e) {
        // Antes se tragaba a console.error → el warning de sync.ts era código muerto (audit A#7).
        warnings.push({ courier: "urbano", tanda: i / BATCH, error: String(e).slice(0, 150) });
      }
    }
    return { events, warnings };
  },
};
