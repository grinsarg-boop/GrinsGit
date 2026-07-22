import { fetchCashflow } from "@/lib/cashflow";
import {
  CAT_PROVEEDOR, ESPEJO_DESDE, STOCK_BASE, egresosSinEspejo, fetchStock, parseCompra, stockHeaders,
} from "@/lib/stock";
import { badCronAuth, logSyncRun } from "@/lib/supabase";

export const maxDuration = 60;

// Espejo automático bot→Stock: los egresos Proveedor que entran por el bot de WhatsApp
// (o la PWA) con descripción inequívoca se anotan solos como compra en Stock (unidades +
// costo = último precio). Los ambiguos quedan en el panel de /stock para completarlos a
// mano. Lo dispara pg_cron cada hora (datos/stock-handoff/2-pg-cron-espejo.sql).
export async function POST(req: Request) {
  const auth = badCronAuth(req);
  if (auth) return auth;
  if (!process.env.STOCK_SERVICE_KEY) {
    return Response.json({ ok: false, error: "sin STOCK_SERVICE_KEY" }, { status: 500 });
  }
  try {
    const [cf, s] = await Promise.all([fetchCashflow(), fetchStock()]);
    const egresos = cf.movs
      .filter((m) => m.tipo === "egreso" && !m.es_retiro && m.categoria_id === CAT_PROVEEDOR && m.fecha >= ESPEJO_DESDE)
      .map((m) => ({ id: m.id, fecha: m.fecha, monto: Number(m.monto), descripcion: m.descripcion, autor: m.autor }));
    const pendientes = egresosSinEspejo(egresos, s.compras);

    let anotadas = 0;
    const alPanel: number[] = [];
    for (const e of pendientes) {
      const p = e.descripcion ? parseCompra(e.descripcion, s.materiales) : null;
      if (!p) { alPanel.push(e.id); continue; }
      const r = await fetch(`${STOCK_BASE}/rpc/registrar_compra`, {
        method: "POST",
        headers: { ...stockHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          p_material_id: p.material.id,
          p_cantidad: p.cantidad,
          p_precio_total: e.monto,
          p_nota: `espejo auto: ${e.descripcion}`,
          p_usuario: "bot-espejo",
        }),
      });
      if (r.ok) anotadas++;
      else alPanel.push(e.id);
    }
    await logSyncRun("stock-espejo", "ok", anotadas);
    return Response.json({ ok: true, anotadas, quedan_en_panel: alPanel.length });
  } catch (e) {
    await logSyncRun("stock-espejo", "error", 0, [], String(e));
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

// pg_cron dispara con el mismo Bearer CRON_SECRET
export { POST as GET };
