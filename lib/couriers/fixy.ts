import * as XLSX from "xlsx";
import type { CourierClient, CourierEvent } from "./types";

// ponytail: completar con doc/response real de Fixy (SPEC §10.1).
// Mientras tanto la app funciona día 1 con el export XLSX vía /api/import/fixy-xlsx.
export const fixy: CourierClient = {
  async fetchStatuses() {
    throw new Error(
      "Fixy API sin implementar: falta la doc (SPEC §10.1). Usar /api/import/fixy-xlsx",
    );
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
  const cRef = col("referencia", "pedido", "orden", "order");
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
    const estado = String(r[cEstado] ?? "").trim();
    if (!tracking || !estado) return [];
    const motivo = cMotivo ? String(r[cMotivo] ?? "").trim() : "";
    return [{
      courier: "fixy" as const,
      tracking,
      order_ref: cRef ? String(r[cRef] ?? "").trim() || undefined : undefined,
      status_raw: motivo ? `${estado} - ${motivo}` : estado,
      occurred_at: toIso(cFecha ? r[cFecha] : undefined),
      importe: cImporte ? num(r[cImporte]) : undefined,
      raw: cCod ? { contrareembolso: num(r[cCod]) } : undefined,
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
