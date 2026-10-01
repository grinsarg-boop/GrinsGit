// Acciones OPERATIVAS de Urbano (POST /rescate/). Separado a propósito del adapter de tracking
// (urbano.ts, read-only): el guardrail de .env.example permite operaciones SOLO desde flujos
// explícitos, server-side, confirmados y logueados — NUNCA desde el sync ni el browser.
// Doc (integrate.urbano.com.ar/docs/api/es, "Rescate de Órdenes", 06-03-2026): POST /rescate/
// (testing: testing-apis.urbano.com.ar/rescate/). Hasta el 30/09/2026 apuntaba a /wbs/rescate/, que
// da 404 → el botón de /trabados nunca funcionó. Body { auth:{shipper,password}, pieces:[..],
// tipoRescate, destinatario?, domicilio? }. Respuesta REAL (BLABS27078, 01/10/2026, primer uso):
// { success, message:"OK", code, details:{ succeeded:[{piece,message}], rejected:[], failed:[], errors:[] } }
// → el resultado vive en el bucket de details, NO en un campo `status` (ver parseRescateResponse).
// `pieces` = códigos de SEGUIMIENTO (codigoSeguimiento: BLABS<order_number>, o el shopify_id para
// despachos hasta el 03/08 — ver urbano.ts), no la guía. Una pieza acepta UN solo rescate.
const API_BASE = (process.env.URBANO_API_URL ?? "https://apis.urbano.com.ar/").replace(/\/$/, "");
const RESCATE_URL = `${API_BASE}/rescate/`;

export type Domicilio = {
  direccion: string; altura: string; codigoPostal: string; localidad: string; provincia: string;
  piso?: string; departamento?: string; observaciones?: string;
};
export type RescateInput =
  | { tipo: "devolucion"; piece: string }
  | { tipo: "redireccionamiento"; piece: string; nombre: string; domicilio: Domicilio };

// Construye el body EXACTO que espera Urbano, SIN auth (la password se agrega recién en el envío,
// así el preview nunca la lleva). Pura (sin env ni red) → testeable. Descarta opcionales vacíos.
export function buildRescateBody(input: RescateInput): Record<string, unknown> {
  const base = { pieces: [input.piece], tipoRescate: input.tipo };
  if (input.tipo === "devolucion") return base;
  const d = input.domicilio;
  const domicilio: Domicilio = {
    direccion: d.direccion, altura: d.altura, codigoPostal: d.codigoPostal,
    localidad: d.localidad, provincia: d.provincia,
  };
  if (d.piso) domicilio.piso = d.piso;
  if (d.departamento) domicilio.departamento = d.departamento;
  if (d.observaciones) domicilio.observaciones = d.observaciones;
  return { ...base, destinatario: { nombre: input.nombre }, domicilio };
}

export type RescateResult =
  | { dryRun: true; url: string; body: Record<string, unknown> }
  | { dryRun: false; httpOk: boolean; status: string; message: string };

// dryRun (default de los callers para preview): devuelve el body sin enviar ni tocar la password.
// Sin dryRun: POST real a Urbano. Es la ÚNICA función que dispara una operación sobre un envío.
export async function rescateUrbano(input: RescateInput, opts?: { dryRun?: boolean }): Promise<RescateResult> {
  const body = buildRescateBody(input);
  if (opts?.dryRun) return { dryRun: true, url: RESCATE_URL, body };

  const auth = { shipper: Number(process.env.URBANO_SHIPPER), password: process.env.URBANO_PASSWORD };
  const res = await fetch(RESCATE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ auth, ...body }),
  });
  const json = await res.json().catch(() => ({}));
  return { dryRun: false, httpOk: res.ok, ...parseRescateResponse(json, res.status) };
}

type Bucket = { piece?: string; message?: string };
// El estado de la pieza = el bucket de details donde aparece. Sin bucket (auth, 4xx/5xx, shape nuevo)
// → "failed" con el message de arriba: nunca "succeeded" por default.
export function parseRescateResponse(json: unknown, httpStatus: number): { status: string; message: string } {
  const j = (json ?? {}) as { message?: string; details?: Record<string, Bucket[] | unknown[]> };
  for (const status of ["succeeded", "rejected", "failed"] as const) {
    const hit = j.details?.[status]?.[0] as Bucket | undefined;
    if (hit) return { status, message: String(hit.message ?? j.message ?? "") };
  }
  const err = j.details?.errors?.[0];
  return { status: "failed", message: String((err && JSON.stringify(err)) ?? j.message ?? `HTTP ${httpStatus}`) };
}
