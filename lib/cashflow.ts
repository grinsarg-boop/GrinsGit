// Lee EN VIVO el Supabase de la app Cashflow (la caja real de la empresa: percibido, no devengado).
// Es OTRA instancia (la del hermano), no la de Finanzas. Solo lectura server-side con la anon key:
// allá la RLS está abierta, así que la key jamás puede llegar al browser. Mismo patrón que el bot
// de App-Gastos usa en producción.
const BASE = "https://nmhxgkruaiohdpennpga.supabase.co/rest/v1";

// La carga real de la app arrancó en junio 2026; lo anterior es un mov suelto con fecha mal tipeada.
export const DESDE = "2026-06";

export type Mov = {
  tipo: "ingreso" | "egreso" | "transferencia";
  monto: number;
  caja_id: number;
  caja_destino_id: number | null;
  categoria_id: number | null;
  descripcion: string | null;
  fecha: string;
  autor: string | null;
  es_retiro: boolean;
};
export type Caja = { id: number; nombre: string; moneda: string };
export type Cat = { id: number; nombre: string };
export type Cobrar = { quien: string; monto: number };

// Qué se resta del margen de contribución del panel para llegar al neto real. Las demás categorías
// NO se restan porque ya están dentro del margen (devengado, reconciliado ≤1%): Publicidad = ads,
// Proveedor = COGS, Logística = flete. Restarlas acá sería contar la misma plata dos veces.
// "Sin categoría" SÍ se resta (conservador a propósito) hasta que se categorice en la app Cashflow.
export const ESTRUCTURA = ["Sueldos", "Alquiler", "Comida", "Software", "Financieros"];
export const YA_MODELADO = ["Publicidad", "Proveedor", "Logística"];

export async function fetchCashflow() {
  const key = process.env.CASHFLOW_ANON_KEY!;
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const j = (p: string) =>
    fetch(`${BASE}/${p}`, { headers: H, next: { revalidate: 60 } }).then((r) => {
      if (!r.ok) throw new Error(`cashflow ${p.split("?")[0]}: HTTP ${r.status}`);
      return r.json();
    });
  // ponytail: trae todo (~360 filas hoy); paginar con Range cuando pase de 1000 (límite PostgREST)
  const [movs, cajas, cats, cobrar] = await Promise.all([
    j("movimientos?select=tipo,monto,caja_id,caja_destino_id,categoria_id,descripcion,fecha,autor,es_retiro"),
    j("cajas?select=id,nombre,moneda&order=orden.asc"),
    j("categorias?select=id,nombre"),
    j("cobrar?select=quien,monto&cobrado=eq.false"),
  ]);
  return { movs, cajas, cats, cobrar } as { movs: Mov[]; cajas: Caja[]; cats: Cat[]; cobrar: Cobrar[] };
}

export type MesCaja = {
  mes: string; // "2026-07"
  ingresos: number;
  porCat: Record<string, number>; // egresos no-retiro por nombre de categoría
  sinCategoria: number; // egresos no-retiro sin categoria_id (incluido en estructura)
  estructura: number; // Σ ESTRUCTURA + sinCategoria
  yaModelado: number; // Σ YA_MODELADO (no se resta, es conciliación)
  ajustes: number;
  personalSocios: number;
  retiros: number;
};

// Agrega movimientos por mes calendario desde DESDE. Transferencias no son ingreso ni gasto
// (mueven plata entre cajas); retiros no son gasto (son distribución, van aparte).
export function porMes(movs: Mov[], cats: Cat[]): MesCaja[] {
  const nombre = new Map(cats.map((c) => [c.id, c.nombre]));
  const meses = new Map<string, MesCaja>();
  const at = (mes: string) => {
    let m = meses.get(mes);
    if (!m) {
      m = { mes, ingresos: 0, porCat: {}, sinCategoria: 0, estructura: 0, yaModelado: 0, ajustes: 0, personalSocios: 0, retiros: 0 };
      meses.set(mes, m);
    }
    return m;
  };
  for (const r of movs) {
    const mes = r.fecha.slice(0, 7);
    if (mes < DESDE || r.tipo === "transferencia") continue;
    const m = at(mes);
    const n = Number(r.monto);
    if (r.tipo === "ingreso") { m.ingresos += n; continue; }
    if (r.es_retiro) { m.retiros += n; continue; }
    const cat = r.categoria_id != null ? nombre.get(r.categoria_id) : undefined;
    if (!cat) { m.sinCategoria += n; m.estructura += n; continue; }
    m.porCat[cat] = (m.porCat[cat] ?? 0) + n;
    if (ESTRUCTURA.includes(cat)) m.estructura += n;
    else if (YA_MODELADO.includes(cat)) m.yaModelado += n;
    else if (cat === "Ajustes") m.ajustes += n;
    else if (cat === "Personal socios") m.personalSocios += n;
    else m.estructura += n; // categoría nueva desconocida → conservador: estructura
  }
  return [...meses.values()].sort((a, b) => b.mes.localeCompare(a.mes));
}

// Saldo por caja: ingresos suman, egresos restan, transferencias mueven entre origen y destino.
export function saldos(movs: Mov[], cajas: Caja[]): { caja: Caja; saldo: number }[] {
  const s = new Map<number, number>();
  for (const r of movs) {
    const n = Number(r.monto);
    if (r.tipo === "ingreso") s.set(r.caja_id, (s.get(r.caja_id) ?? 0) + n);
    else if (r.tipo === "egreso") s.set(r.caja_id, (s.get(r.caja_id) ?? 0) - n);
    else {
      s.set(r.caja_id, (s.get(r.caja_id) ?? 0) - n);
      if (r.caja_destino_id != null) s.set(r.caja_destino_id, (s.get(r.caja_destino_id) ?? 0) + n);
    }
  }
  return cajas.map((caja) => ({ caja, saldo: s.get(caja.id) ?? 0 }));
}

// Balance societario 50/50: retiros históricos completos por autor; el que retiró menos queda con
// la diferencia a favor. Mismo criterio que la PWA Cashflow y el bot de WhatsApp.
export function balance5050(movs: Mov[]): { fran: number; santi: number; aFavor: string | null; dif: number } {
  let fran = 0, santi = 0;
  for (const r of movs)
    if (r.es_retiro) {
      if (r.autor === "Fran") fran += Number(r.monto);
      else if (r.autor === "Santi") santi += Number(r.monto);
    }
  const dif = Math.abs(fran - santi);
  return { fran, santi, dif, aFavor: dif > 0 ? (fran < santi ? "Fran" : "Santi") : null };
}
