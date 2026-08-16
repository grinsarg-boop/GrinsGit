import { supabaseAdmin } from "@/lib/supabase";

// Atribución del anuncio para los pedidos COD (migración 075). El form del theme dispara un
// sendBeacon con {phone, ad_id} cuando se completa el teléfono; el cruce con el pedido lo hace
// anuncios_pnl por los últimos 8 dígitos. Ver docs/atribucion-utm.md.
//
// Pública a propósito: la llama el storefront (biolabsarg.com), otro origen, y sendBeacon manda
// text/plain para no disparar preflight. No hay secreto que compartir con el navegador —cualquiera
// que mire el theme ve la URL igual— así que la defensa es la forma: solo entran dos números con
// pinta de teléfono y de ad_id, y el peor daño posible es una fila basura que no cruza con ningún
// pedido. Nada de esto toca el pedido en sí, que ya nació por otro lado.
// ponytail: sin rate limit. Si alguna vez alguien la inunda, la fila más barata de tirar es esta y
// se corta con un límite por IP en el edge, no acá.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response("bad json", { status: 400 });
  }

  // El teléfono se guarda crudo-pero-solo-dígitos: la normalización del form (saca +54, el 9, el 15)
  // no importa porque el join va por la cola de 8, invariante a todas ellas.
  const phone = String(body.phone ?? "").replace(/\D/g, "");
  const adId = String(body.ad_id ?? "").replace(/\D/g, "");
  if (phone.length < 8 || phone.length > 15) return new Response("phone", { status: 400 });
  if (adId.length < 6 || adId.length > 25) return new Response("ad_id", { status: 400 });

  const handle = String(body.handle ?? "").slice(0, 120) || null;
  const { error } = await supabaseAdmin()
    .from("atribucion_form")
    .insert({ phone, ad_id: adId, handle });
  if (error) return new Response(error.message, { status: 500 });

  return new Response(null, { status: 204 });
}
