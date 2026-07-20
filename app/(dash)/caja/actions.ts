"use server";

import { revalidatePath } from "next/cache";
import { CASHFLOW_BASE } from "@/lib/cashflow";

// Clasifica un movimiento pendiente directo en la base Cashflow. Server action = pasa por el
// middleware de auth (solo mails permitidos) y la key nunca toca el browser. "retiro" marca
// es_retiro en vez de categoría (los retiros no llevan categoría).
export async function categorizarMov(fd: FormData) {
  const id = Number(fd.get("id"));
  const val = String(fd.get("categoria") ?? "");
  if (!Number.isFinite(id) || !val) return;
  const body = val === "retiro" ? { es_retiro: true } : { categoria_id: Number(val) };
  if (val !== "retiro" && !Number.isFinite(Number(val))) return;
  const key = process.env.CASHFLOW_ANON_KEY!;
  const r = await fetch(`${CASHFLOW_BASE}/movimientos?id=eq.${id}`, {
    method: "PATCH",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`cashflow PATCH: HTTP ${r.status}`);
  revalidatePath("/caja");
}
