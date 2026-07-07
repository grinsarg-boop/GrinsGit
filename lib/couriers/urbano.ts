import type { CourierClient, CourierEvent } from "./types";

// Tracking real de Urbano (SPEC §5.4, R7). El webservice se consulta por cli_codigo = id de
// pedido Shopify y devuelve el nº de guía (gui_numero) + estado como HTML. Opción A:
// shipment.tracking = cli_codigo (id Shopify); gui_numero va en raw. shi_codigo 4362 fijo.
const WS_BASE = "https://www.urbano.com.ar/webservice/cespecifica/";
const SHI_CODIGO = "4362";
const CONCURRENCY = 5;      // el WS es lento; 5 en paralelo + delay entra en el AC (1000 < 5 min)
const DELAY_MS = 150;       // delay suave entre tandas (no martillar el WS)

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

async function fetchUrbano(cliCodigo: string): Promise<string> {
  const url = `${WS_BASE}?shi_codigo=${SHI_CODIGO}&cli_codigo=${encodeURIComponent(cliCodigo)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Urbano WS ${res.status} para ${cliCodigo}`);
  return res.text();
}

// trackings = ids de pedido Shopify (cli_codigo). Tandas de CONCURRENCY con delay suave.
// Un fallo puntual no aborta la tanda (se reintenta en el próximo sync, §5.4).
export const urbano: CourierClient = {
  async fetchStatuses(trackings: string[]): Promise<CourierEvent[]> {
    const events: CourierEvent[] = [];
    for (let i = 0; i < trackings.length; i += CONCURRENCY) {
      const chunk = trackings.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((id) =>
        fetchUrbano(id).then((html) => parseUrbanoResponse(html, id))
          .catch((e) => { console.error("urbano WS", id, String(e)); return [] as CourierEvent[]; })));
      events.push(...results.flat());
      if (i + CONCURRENCY < trackings.length) await new Promise((r) => setTimeout(r, DELAY_MS));
    }
    return events;
  },
};
