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
const CAJAS: Record<string, string[]> = {
  x1: ["MLA3356284130"],
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
