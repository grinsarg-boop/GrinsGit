import { supabaseAdmin } from "@/lib/supabase";
import { fixy } from "./fixy";
import { upsertEvents } from "./sync";
import type { CourierEvent } from "./types";

// CP a 4 dígitos (mismo criterio que la carga masiva de Correo).
const normCp = (z: string | null | undefined) =>
  String(z ?? "").replace(/\D/g, "").replace(/^0+/, "").slice(0, 4);

// Flete Fixy estimado: CP → provincia → default (mapas sembrados en 014 del `Importe` histórico).
// La API de seguimiento NO devuelve flete; sin esto la guía entra con flete 0 (profit optimista).
export function fixyFreight(
  o: { zip?: string | null; province?: string | null },
  cp: Record<string, number>, prov: Record<string, number>, def: number,
): number {
  return cp[normCp(o.zip)] ?? prov[String(o.province ?? "").toUpperCase()] ?? def;
}

// Descubre despachos Fixy nuevos (proceso post-08/07: la guía se registra en Fixy por API, NO en un
// tag como Urbano). Toma los pedidos courier='fixy' sin guía (v_fixy_sin_guia), pregunta a la API por
// remito=order_number y crea la shipment. El estado real y el flete estimado por CP quedan en la guía.
// El alta (evento 41) la trae la propia API en `fechas[]` — hasta 073 se emitía un evento 41 sintético
// con el created_at del pedido porque el cliente sólo leía el estado actual; eso anclaba 40 de 183
// guías 1-2 días ANTES del despacho real (el pedido entra antes de que se registre la guía).
// ponytail: el flete queda is_estimated=false (upsert lo marca real). Es cosmético — no afecta el
// profit, sólo el "% estimado" del dashboard; el `Importe` real del XLSX lo pisa igual.
export async function discoverFixy(sinceDays = 45, max = 250): Promise<number> {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);
  const { data: cand } = await db
    .from("v_fixy_sin_guia").select("*").gte("created_at", since).limit(max);
  if (!cand?.length) return 0;

  const { data: st } = await db.from("settings").select("key, value")
    .in("key", ["fixy_freight_by_cp", "fixy_freight_by_prov", "fixy_freight_default"]);
  const s = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
  const cp = (s.fixy_freight_by_cp ?? {}) as Record<string, number>;
  const prov = (s.fixy_freight_by_prov ?? {}) as Record<string, number>;
  const def = Number(s.fixy_freight_default ?? 0);

  const byRef = new Map(cand.map((o) => [String(o.order_number), o]));
  const { events } = await fixy.fetchStatuses(cand.map((o) => String(o.order_number)));

  const enriched: CourierEvent[] = [];
  for (const e of events) {
    const o = byRef.get(String(e.order_ref ?? ""));
    if (!o) continue;
    enriched.push({
      ...e, importe: fixyFreight(o, cp, prov, def),
      raw: { ...(e.raw as object ?? {}), via: "fixy-api" },
    });
  }
  return enriched.length ? upsertEvents(enriched) : 0;
}
