import { getMlAccessToken } from "@/lib/ml";
import { badCronAuth } from "@/lib/supabase";

export const maxDuration = 30;

// Vigía de las cajas de catálogo ML (guerra de catálogo, bitácora 29-30/07). El workflow `salud`
// lo consulta cada hora: si una caja que debe ser nuestra deja de estarlo, el job falla y GitHub
// manda el mail — detección en 1 h en vez de los ~3 días que tardó el ataque de SELERB.
// Una caja está ok si ALGUNA de sus ofertas está "winning" (en x2 tenemos dos: la Clásica que
// puja y la Premium vieja). Un error de la API de ML también es rojo: este chequeo no puede
// fallar en silencio.
// ponytail: lista fija; cuando cambien las publicaciones de catálogo se edita acá.
//
// El x1 SE SACÓ el 31/08/2026 y no se vuelve a agregar sin una publicación nueva que pueda ganar.
// `MLA3356284130` quedó `under_review`/`forbidden` el 19/08 (sin apelación) → su `price_to_win`
// devuelve `not_listed` para siempre, y su reemplazo `MLA1796574515` da `buy_box_eligible: false`
// por `item_has_item_relations`. O sea: una caja que NO podemos ganar, dejando el job en rojo
// permanente. Costó caro: 100 de 100 corridas en `failure`, y con ese ruido de fondo nadie vio que
// entre el 26 y el 30/08 se perdían las cajas del x2 y el x4 de verdad (canal -29% en 7 días).
// La regla que deja: una condición que puede quedar roja para siempre por algo que no se va a
// arreglar NO comparte job con las condiciones accionables — las tapa a todas.
const CAJAS: Record<string, string[]> = {
  x2: ["MLA3692036796", "MLA1830076567"],
  x4: ["MLA1908275639"],
};

export async function POST(req: Request) {
  const unauth = badCronAuth(req);
  if (unauth) return unauth;

  const token = await getMlAccessToken();
  const estados: Record<string, string> = {};
  for (const item of Object.values(CAJAS).flat()) {
    const res = await fetch(`https://api.mercadolibre.com/items/${item}/price_to_win?siteId=MLA`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const body = res.ok ? await res.json() : null;
    estados[item] = body?.status ?? `http_${res.status}`;
  }

  const cajas = Object.entries(CAJAS).map(([caja, items]) => ({
    caja,
    ok: items.some((i) => estados[i] === "winning"),
    estados: Object.fromEntries(items.map((i) => [i, estados[i]])),
  }));

  return Response.json({ rojo: cajas.some((c) => !c.ok), cajas });
}
export { POST as GET };
