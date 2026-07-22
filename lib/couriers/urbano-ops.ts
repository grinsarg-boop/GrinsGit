// Acciones OPERATIVAS de Urbano (POST /wbs/rescate/). Separado a propósito del adapter de tracking
// (urbano.ts, read-only): el guardrail de .env.example permite operaciones SOLO desde flujos
// explícitos, server-side, confirmados y logueados — NUNCA desde el sync ni el browser.
// Doc (integrate.urbano.com.ar): body { auth:{shipper,password}, pieces:[..], tipoRescate,
// destinatario?, domicilio? }; respuesta { status: "succeeded|rejected|failed", message }.
// OJO: `pieces` puede ser la guía de Urbano o el codigoSeguimiento — validar en el primer uso real.
const API_BASE = (process.env.URBANO_API_URL ?? "https://apis.urbano.com.ar/").replace(/\/$/, "");
const RESCATE_URL = `${API_BASE}/wbs/rescate/`;

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
  const json = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
  return {
    dryRun: false,
    httpOk: res.ok,
    status: String(json.status ?? (res.ok ? "unknown" : "failed")),
    message: String(json.message ?? `HTTP ${res.status}`),
  };
}
