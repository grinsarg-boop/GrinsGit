"use server";

import { rescateUrbano, type Domicilio, type RescateInput } from "@/lib/couriers/urbano-ops";

// Redirección de una pieza Urbano en tránsito (POST /rescate/). Server action → pasa por el middleware
// de auth (solo mails permitidos) y la password nunca toca el browser. Dos pasos DELIBERADOS: sin
// `confirmar` devuelve el PREVIEW exacto (sin password) para revisar; con `confirmar` recién ahí
// envía de verdad y loguea. Nunca se dispara una operación sin que el operador vea el preview.
export type RedirResult =
  | { ok: true; preview: { url: string; body: unknown } }
  | { ok: true; sent: { httpOk: boolean; status: string; message: string } }
  | { ok: false; error: string };

export async function redirigirUrbano(fd: FormData): Promise<RedirResult> {
  const s = (k: string) => String(fd.get(k) ?? "").trim();
  const piece = s("piece");
  if (!piece) return { ok: false, error: "Falta el código de seguimiento (BLABS<nº de pedido>)." };

  const dom: Domicilio = {
    direccion: s("direccion"), altura: s("altura"), codigoPostal: s("codigoPostal"),
    localidad: s("localidad"), provincia: s("provincia"),
    piso: s("piso") || undefined, departamento: s("departamento") || undefined,
    observaciones: s("observaciones") || undefined,
  };
  const nombre = s("nombre");
  const faltan = [
    !nombre && "nombre", !dom.direccion && "dirección", !dom.altura && "altura",
    !dom.codigoPostal && "CP", !dom.localidad && "localidad", !dom.provincia && "provincia",
  ].filter(Boolean);
  if (faltan.length) return { ok: false, error: `Faltan datos: ${faltan.join(", ")}.` };
  if (!/^\d{4}$/.test(dom.codigoPostal)) return { ok: false, error: "El código postal debe ser 4 dígitos." };

  const input: RescateInput = { tipo: "redireccionamiento", piece, nombre, domicilio: dom };

  if (fd.get("confirmar") !== "1") {
    const r = await rescateUrbano(input, { dryRun: true });
    return r.dryRun ? { ok: true, preview: { url: r.url, body: r.body } } : { ok: false, error: "preview inesperado" };
  }

  const r = await rescateUrbano(input, { dryRun: false });
  if (r.dryRun) return { ok: false, error: "envío inesperado" };
  // ponytail: log a consola; tabla urbano_ops_log si se necesita auditoría/idempotencia formal.
  console.log(`[urbano-rescate] piece=${piece} → ${r.status}: ${r.message}`);
  return { ok: true, sent: { httpOk: r.httpOk, status: r.status, message: r.message } };
}
