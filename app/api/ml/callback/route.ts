import { mlNotifRow } from "@/lib/ml";
import { supabaseAdmin } from "@/lib/supabase";

// Callback de notificaciones de ML: un POST por cada cambio en los topics suscriptos (items,
// items_prices, catalog_item_competition_status, questions, shipments, …). Ver la 091.
//
// ML espera respuesta rápida y reintenta hasta recibir un 200, así que acá solo se guarda el aviso
// crudo. Ir a buscar el recurso es trabajo de después: metido en esta ruta, la volvería lenta y
// haría reintentar avisos que ya estaban guardados.
//
// El middleware deja pasar /api sin auth y ML no firma las notificaciones: quién puede escribir en
// la tabla lo decide mlNotifRow(), que es donde vive el filtro y donde está el test. Lo que no pasa
// el filtro se descarta con 200 — un 4xx le confirmaría a quien sondee que la ruta existe.
export async function POST(req: Request) {
  const row = mlNotifRow(await req.json().catch(() => null), process.env.ML_SELLER_ID);
  if (!row) return Response.json({ ok: true });

  const { error } = await supabaseAdmin()
    .from("ml_events")
    .upsert(row, { onConflict: "notif_id", ignoreDuplicates: true });
  // 500 a propósito: ML reintenta y el aviso no se pierde. Un 200 acá lo tiraría en silencio.
  if (error) return new Response(error.message, { status: 500 });

  return Response.json({ ok: true });
}
