"use server";

import { revalidatePath } from "next/cache";
import { CASHFLOW_BASE } from "@/lib/cashflow";
import { CAT_PROVEEDOR, STOCK_BASE, stockHeaders } from "@/lib/stock";

// Carga ÚNICA de la compra: la RPC de Stock suma unidades y actualiza el costo del insumo, y de ahí
// se propaga el egreso Proveedor a la caja. Si se elige "no registrar en caja" (compra ya cargada a
// mano en Cashflow / histórico), solo toca Stock. Server action = pasa por el middleware de auth y
// las keys nunca tocan el browser (misma razón que categorizarMov de /caja).
export async function registrarCompra(fd: FormData) {
  // el value del select viene como "uuid|nombre" para no re-consultar el insumo
  const [materialId, nombre = "insumo"] = String(fd.get("material") ?? "").split("|");
  const cantidad = Number(fd.get("cantidad"));
  const precio = Number(fd.get("precio"));
  const cajaId = String(fd.get("caja") ?? "");
  const fecha = String(fd.get("fecha") ?? "");
  const nota = String(fd.get("nota") ?? "").trim();
  if (!materialId || !Number.isFinite(cantidad) || cantidad <= 0) return;
  if (!Number.isFinite(precio) || precio <= 0) return;

  const r = await fetch(`${STOCK_BASE}/rpc/registrar_compra`, {
    method: "POST",
    headers: { ...stockHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      p_material_id: materialId,
      p_cantidad: cantidad,
      p_precio_total: precio,
      p_nota: nota || null,
      p_usuario: "panel",
    }),
  });
  if (!r.ok) throw new Error(`stock registrar_compra: HTTP ${r.status} ${await r.text()}`);

  if (cajaId && cajaId !== "0") {
    // ids de la app Cashflow = epoch ms generados por el cliente; acá hacemos lo mismo.
    const key = process.env.CASHFLOW_ANON_KEY!;
    const c = await fetch(`${CASHFLOW_BASE}/movimientos`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        id: Date.now(),
        tipo: "egreso",
        monto: precio,
        caja_id: Number(cajaId),
        categoria_id: CAT_PROVEEDOR,
        descripcion: `Compra ${nombre || "insumo"} ×${cantidad}${nota ? ` — ${nota}` : ""}`,
        fecha: fecha || new Date().toISOString().slice(0, 10),
        autor: "Panel",
        es_retiro: false,
      }),
    });
    if (!c.ok)
      throw new Error(
        `La compra quedó registrada en Stock, pero falló el egreso en Cashflow (HTTP ${c.status}). ` +
          `Cargalo a mano en la app Cashflow: egreso Proveedor de ${precio}.`,
      );
  }

  revalidatePath("/stock");
  revalidatePath("/caja");
}
