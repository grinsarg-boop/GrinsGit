import * as XLSX from "xlsx";
import type { CourierClient, CourierEvent, FetchStatusesResult } from "./types";

// API de tracking de Fixy (FASE 5, R8): POST /api/v2/seguimiento.json {api_token, remito}.
// Consulta por REMITO (= order_number Shopify); el response trae guia.fechas[] con el Nro Guia,
// estado (texto), codigo_estado (numérico) y fecha/hora. NO trae plata (importe/contrareembolso):
// el flete/COD sigue saliendo del XLSX (/api/import/fixy-xlsx). status_raw = codigo_estado (mapeo
// exact en 008). Emite SOLO el estado actual (fechas[0]) — más fresco que el XLSX; dispatched_at
// ya viene del XLSX. Sólo lectura: NUNCA guias.json/solicitarRetiro/generar-recepcion (escritura).
const API = (process.env.FIXY_API_URL ?? "https://fixy.epresis.com/").replace(/\/$/, "");
const SEGUIMIENTO = `${API}/api/v2/seguimiento.json`;
const CONCURRENCY = 5;

type FixyFecha = { guia?: number; estado?: string; codigo_estado?: number; fecha?: string; hora?: string; detalles?: string };

// "dd/mm/yyyy" + "HH:MM" → ISO con offset ART (-03:00).
function fixyApiDate(fecha?: string, hora?: string): string | null {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((fecha ?? "").trim());
  if (!m) return null;
  const t = /^\d{1,2}:\d{2}/.test((hora ?? "").trim()) ? hora!.trim() : "12:00";
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${t.padStart(5, "0")}:00-03:00`;
}

// {events, warning?}: un HTTP no-2xx (401 token vencido, 5xx) es un fallo que hay que VER, no un
// []silencioso (audit A#2). 404/vacío es normal (remito sin novedad) → sin warning.
async function fetchRemito(remito: string): Promise<{ events: CourierEvent[]; warning?: unknown }> {
  const res = await fetch(SEGUIMIENTO, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_token: process.env.FIXY_API_TOKEN, remito }),
  });
  if (!res.ok) return { events: [], warning: { courier: "fixy", remito, http: res.status } };
  const j: { status?: string; guia?: { fechas?: FixyFecha[] } } = await res.json();
  const f = j?.guia?.fechas?.[0]; // fechas[0] = estado actual (viene desc)
  const at = fixyApiDate(f?.fecha, f?.hora);
  if (!f || f.codigo_estado == null || !at) return { events: [] };
  return { events: [{
    courier: "fixy", tracking: String(f.guia ?? ""), order_ref: remito,
    status_raw: String(f.codigo_estado), occurred_at: at,
    raw: { estado: f.estado, detalles: f.detalles, via: "api" },
  }] };
}

// trackings = REMITOS (order_number) — runCourierSync pasa order_ref para fixy. Tandas de CONCURRENCY.
export const fixy: CourierClient = {
  async fetchStatuses(remitos: string[]): Promise<FetchStatusesResult> {
    const events: CourierEvent[] = [];
    const warnings: unknown[] = [];
    for (let i = 0; i < remitos.length; i += CONCURRENCY) {
      const chunk = remitos.slice(i, i + CONCURRENCY);
      const res = await Promise.all(chunk.map((r) =>
        fetchRemito(r).catch((e) => ({ events: [] as CourierEvent[], warning: { courier: "fixy", remito: r, error: String(e).slice(0, 120) } }))));
      for (const x of res) { events.push(...x.events); if (x.warning) warnings.push(x.warning); }
    }
    return { events, warnings };
  },
};

// Export XLSX de Fixy → mismos CourierEvent que la API (§5.4).
// ponytail: detección de columnas por keyword — ajustar contra un XLSX real de Fixy.
export function parseFixyXlsx(buf: Buffer): CourierEvent[] {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[wb.SheetNames[0]],
    { raw: true },
  );
  if (!rows.length) return [];

  const keys = Object.keys(rows[0]);
  const col = (...kws: string[]) =>
    keys.find((k) => kws.some((kw) => k.toLowerCase().includes(kw)));
  const cTracking = col("tracking", "guia", "guía", "envio", "envío", "seguimiento");
  const cRef = col("remito", "referencia", "pedido", "orden", "order"); // Remito = order_number Shopify
  const cEstado = col("estado", "status");
  const cMotivo = col("motivo");
  const cFecha = col("fecha");
  const cImporte = col("importe", "costo", "flete");
  const cCod = col("contrareembolso", "contra reembolso", "cod");

  if (!cTracking || !cEstado) {
    throw new Error(`XLSX sin columnas de tracking/estado. Headers: ${keys.join(", ")}`);
  }

  return rows.flatMap((r) => {
    const tracking = String(r[cTracking] ?? "").trim();
    // estado = código canónico Fixy (POD-ENTREGADA, CSYDV-…): mapeado por seed 004.
    const estado = String(r[cEstado] ?? "").replace(/\s+/g, " ").trim();
    if (!tracking || !estado) return [];
    // Motivo NO va en status_raw (rompería el mapeo por código); se preserva en raw (granularidad).
    const motivo = cMotivo ? String(r[cMotivo] ?? "").replace(/\s+/g, " ").trim() : "";
    return [{
      courier: "fixy" as const,
      tracking,
      order_ref: cRef ? String(r[cRef] ?? "").trim() || undefined : undefined,
      status_raw: estado,
      occurred_at: toIso(cFecha ? r[cFecha] : undefined),
      importe: cImporte ? num(r[cImporte]) : undefined,
      raw: { motivo: motivo || undefined, contrareembolso: cCod ? num(r[cCod]) : undefined },
    }];
  });
}

function toIso(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v.trim()) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(v.trim()); // dd/mm/yyyy
    if (m) return new Date(`${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T12:00:00Z`).toISOString();
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  return new Date().toISOString(); // sin fecha: el import vale como "visto ahora"
}

function num(v: unknown): number | undefined {
  if (v == null || v === "") return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? undefined : n;
}
