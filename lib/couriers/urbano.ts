import type { CourierClient, CourierEvent, FetchStatusesResult } from "./types";

// Tracking de Urbano (SPEC §5.4, R7). El sync incremental usa la API oficial MASIVA (JSON, bulk,
// sin rate-limit): POST /tracking/consultaTrackingMasivo/, auth en el body, consulta por
// codigoSeguimiento.
// EL CÓDIGO CAMBIÓ EL 04/08/2026: antes era el id de pedido de Shopify (13 dígitos), ahora es
// `BLABS<order_number>` (el NÚMERO de pedido). Medido contra la API: el shopify_id de un despacho
// del 06/08 da codError 5 y su BLABS da codError 0; los despachos de hasta el 03/08 siguen
// respondiendo por shopify_id (Urbano no re-keyeó lo viejo, es un corte hacia adelante).
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

// Código de seguimiento → referencia de pedido. `BLABS18942` y `BLABSA27789` (cuenta anticipada) →
// el order_number; un shopify_id vuelve intacto. La `A?` va adentro y es greedy: con `BLABS|BLABSA` la
// alternativa corta gana primero y deja "A27789", que no matchea ningún pedido (guía huérfana).
export const pelar = (codigo: string) => codigo.replace(/^BLABSA?/i, "");

// Desde el 03/10/2026 el pago anticipado sale por OTRA cuenta de Urbano (shipper 4565, servicio E, sin
// contrareembolso) con código BLABSA<order_number>. Cada cuenta sólo ve sus guías y con la clave de la
// otra la masiva contesta "credenciales inválidas" → se consulta por separado, eligiendo por prefijo.
export const esAnticipado = (codigo: string) => /^BLABSA/i.test(codigo);

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
  // `tracking` = el código tal cual (es la clave contra Urbano y la del on conflict con el alta por
  // tag, 013). `order_ref` = el código PELADO, porque es lo que matchea contra orders en 006:
  // "BLABS18942" no es ni shopify_id (^\d{10,}$) ni order_number → la guía quedaría huérfana.
  const orderRef = pelar(cliCodigo);
  // La guía anticipada va a su propio courier (104): ya está cobrada, no entra a tasas COD ni cobranza.
  const courier = esAnticipado(cliCodigo) ? "urbano_ant" : "urbano";
  const ciclo = parseUrbanoDate(item.fecha ?? "");
  if (ciclo) {
    events.push({ courier, tracking: cliCodigo, order_ref: orderRef,
      status_raw: CICLO_STATUS, occurred_at: ciclo, raw: { fecha: item.fecha, producto: item.producto } });
  }
  let maxAt: string | null = null, maxCode = "", maxCount = 0;
  for (const m of item.movimientos) {
    const at = parseUrbanoDate(m.checkFecha ?? "");
    const code = (m.check ?? "").trim().toUpperCase();
    if (code && at) {
      events.push({ courier, tracking: cliCodigo, order_ref: orderRef,
        status_raw: code, occurred_at: at,
        raw: { descripcion: (m.descripcion ?? "").trim(), codigo_motivo: m.codigo_motivo, estado_actual: item.estado } });
      if (maxAt === null || at > maxAt) { maxAt = at; maxCode = code; maxCount = 1; }  // nuevo máximo
      else if (at === maxAt) { maxCode = code; maxCount++; }                            // empate mismo día
    }
  }

  // item.estado ("CÓDIGO - desc") es el estado ACTUAL autoritativo de Urbano; los movimientos son
  // historia y su ORDEN no es confiable (ej. AR llega después de RM pero estado=RM). Urbano colapsa
  // los movimientos del día a 12:00Z, así que cuando varios caen el mismo día el "último por
  // occurred_at" del ingest es arbitrario (RM/DV pierde contra AR → el envío quedaba en_transito y no
  // maduraba). Emitir el estado como evento al cierre del día del último movimiento (23:59 > 12:00) lo
  // hace ganar SIEMPRE. Se emite si difiere del último movimiento O si hubo empate ese día (>1). Si
  // coincide y es único (sin empate) ya gana solo → no se emite (evita ruido). estado vacío (" - ") no
  // matchea el código → no se emite.
  const estadoCode = /^([A-Za-z0-9]+)\s*-/.exec((item.estado ?? "").trim())?.[1]?.toUpperCase();
  if (estadoCode && maxAt && (estadoCode !== maxCode || maxCount > 1)) {
    events.push({ courier, tracking: cliCodigo, order_ref: orderRef,
      status_raw: estadoCode, occurred_at: maxAt.replace("T12:00:00Z", "T23:59:59Z"),
      raw: { estado_actual: item.estado, sintetico: "estado" } });
  }
  return events;
}

async function fetchMasivo(codigos: string[], anticipado: boolean): Promise<MasivoItem[]> {
  const autentificacion = anticipado
    ? { shipper: Number(process.env.URBANO_ANT_SHIPPER), password: process.env.URBANO_ANT_PASSWORD }
    : { shipper: Number(process.env.URBANO_SHIPPER), password: process.env.URBANO_PASSWORD };
  const res = await fetch(MASIVO_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      autentificacion,
      datos: codigos.map((c) => ({ codigoSeguimiento: c })),
    }),
  });
  if (!res.ok) throw new Error(`Urbano masiva ${res.status}: ${(await res.text()).slice(0, 120)}`);
  const body = await res.json();
  return Array.isArray(body) ? body : [];
}

// trackings = códigos de seguimiento (BLABS/BLABSA<order_number>, o shopify_id lo previo al 04/08).
// Tandas de BATCH por cuenta (la masiva es bulk → una llamada por tanda). Un fallo de tanda no aborta
// el resto (se reintenta en el próximo sync, §5.4).
export const urbano: CourierClient = {
  async fetchStatuses(trackings: string[]): Promise<FetchStatusesResult> {
    const events: CourierEvent[] = [];
    const warnings: unknown[] = [];
    for (const anticipado of [false, true]) {
      const codigos = trackings.filter((c) => esAnticipado(c) === anticipado);
      for (let i = 0; i < codigos.length; i += BATCH) {
        try {
          const items = await fetchMasivo(codigos.slice(i, i + BATCH), anticipado);
          for (const it of items) events.push(...parseUrbanoMasivo(it, String(it.codGestion ?? "")));
        } catch (e) {
          // Antes se tragaba a console.error → el warning de sync.ts era código muerto (audit A#7).
          warnings.push({ courier: "urbano", anticipado, tanda: i / BATCH, error: String(e).slice(0, 150) });
        }
      }
    }
    return { events, warnings };
  },
};
