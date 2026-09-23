// Lee EN VIVO el Supabase de la app Cashflow (la caja real de la empresa: percibido, no devengado).
// Es OTRA instancia (la del hermano), no la de Finanzas. Solo lectura server-side con la anon key:
// allá la RLS está abierta, así que la key jamás puede llegar al browser. Mismo patrón que el bot
// de App-Gastos usa en producción.
export const CASHFLOW_BASE = "https://nmhxgkruaiohdpennpga.supabase.co/rest/v1";
const BASE = CASHFLOW_BASE;

// La carga real de la app arrancó en junio 2026; lo anterior es un mov suelto con fecha mal tipeada.
export const DESDE = "2026-06";

export type Mov = {
  id: number;
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
export type Cat = { id: number; nombre: string; tipo: string };
export type Cobrar = { quien: string; monto: number; fecha: string };

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
  // movimientos pasa las 1.000 filas ~01/10/2026 y el max-rows de PostgREST corta ahí SIN error
  // (memoria supabase-max-rows-1000). Keyset por id hasta una página vacía: una alta o baja entre
  // páginas no corre filas (offset sí), y sin limit propio vale con cualquier max-rows del proyecto.
  // Cuesta un request extra: el de la página vacía.
  const todosMovs = async () => {
    const movs: Mov[] = [];
    for (;;) {
      const tras = movs.length ? `&id=gt.${movs[movs.length - 1].id}` : "";
      const lote: Mov[] = await j(
        `movimientos?select=id,tipo,monto,caja_id,caja_destino_id,categoria_id,descripcion,fecha,autor,es_retiro&order=id.asc${tras}`,
      );
      if (!lote.length) return movs;
      movs.push(...lote);
    }
  };
  const [movs, cajas, cats, cobrar] = await Promise.all([
    todosMovs(),
    j("cajas?select=id,nombre,moneda&order=orden.asc"),
    j("categorias?select=id,nombre,tipo"),
    j("cobrar?select=quien,monto,fecha&cobrado=eq.false&order=fecha.asc"),
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

export type DiaFlujo = { fecha: string; ingresos: number; egresos: number };

// Flujo de caja por día calendario: entra vs sale (retiros incluidos — es plata que sale de la
// empresa). Sin filtro, las transferencias no son flujo (mueven plata entre cajas propias);
// filtrando UNA caja sí cuentan: son plata que entra o sale de esa caja.
export function flujoDiario(movs: Mov[], cajaId: number | null = null): DiaFlujo[] {
  const dias = new Map<string, DiaFlujo>();
  const at = (fecha: string) => {
    let d = dias.get(fecha);
    if (!d) { d = { fecha, ingresos: 0, egresos: 0 }; dias.set(fecha, d); }
    return d;
  };
  for (const r of movs) {
    if (r.fecha.slice(0, 7) < DESDE) continue;
    const n = Number(r.monto);
    if (r.tipo === "transferencia") {
      if (cajaId == null) continue;
      if (r.caja_id === cajaId) at(r.fecha).egresos += n;
      if (r.caja_destino_id === cajaId) at(r.fecha).ingresos += n;
      continue;
    }
    if (cajaId != null && r.caja_id !== cajaId) continue;
    if (r.tipo === "ingreso") at(r.fecha).ingresos += n;
    else at(r.fecha).egresos += n;
  }
  return [...dias.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ── Cobranzas: lo que la caja sabe de Urbano y Fixy (para conciliar contra el panel) ──────────

// ids de las categorías de INGRESO en la app Cashflow (estables desde el alta de la app, 06/06)
const CAT_INGRESO_URBANO = 1780752750043;

export type SobreFixy = { fecha: string; monto: number; cobrado: boolean };
export type GiroUrbano = { fecha: string; monto: number; descripcion: string | null };

export async function fetchCobranzas() {
  const key = process.env.CASHFLOW_ANON_KEY!;
  const H = { apikey: key, Authorization: `Bearer ${key}` };
  const j = (p: string) =>
    fetch(`${BASE}/${p}`, { headers: H, next: { revalidate: 300 } }).then((r) => {
      if (!r.ok) throw new Error(`cashflow ${p.split("?")[0]}: HTTP ${r.status}`);
      return r.json();
    });
  const [sobres, giros] = await Promise.all([
    j("cobrar?select=fecha,monto,cobrado&quien=ilike.*fixy*&order=fecha.asc"),
    j(`movimientos?select=fecha,monto,descripcion&tipo=eq.ingreso&categoria_id=eq.${CAT_INGRESO_URBANO}&order=fecha.asc`),
  ]);
  return { sobres, giros } as { sobres: SobreFixy[]; giros: GiroUrbano[] };
}

// Cada giro de la caja se asigna a la ventana con fecha_pago más reciente <= fecha del giro
// (Urbano a veces paga en varios giros y algún día corrido). diff = cobrado/esperado − 1;
// null si la ventana aún no venció o si la caja no tiene registro (antes de su carga inicial).
export type VentanaConciliada = { fecha_pago: string; cobrado: number; diff: number | null };
export function conciliarGiros(
  ventanas: { fecha_pago: string; neto: number }[],
  giros: { fecha: string; monto: number }[],
  hoy: string,
): VentanaConciliada[] {
  const pagos = ventanas.map((v) => v.fecha_pago).sort();
  const cobrado = new Map<string, number>(pagos.map((p) => [p, 0]));
  for (const g of giros) {
    const dest = [...pagos].reverse().find((p) => p <= g.fecha);
    if (dest) cobrado.set(dest, (cobrado.get(dest) ?? 0) + Number(g.monto));
  }
  const primerGiro = giros.length ? giros[0].fecha : null;
  return ventanas.map((v) => {
    const c = cobrado.get(v.fecha_pago) ?? 0;
    const vencida = v.fecha_pago < hoy;
    const anteCaja = primerGiro == null || v.fecha_pago < primerGiro;
    return {
      fecha_pago: v.fecha_pago,
      cobrado: c,
      diff: vencida && !anteCaja && v.neto > 0 ? c / v.neto - 1 : null,
    };
  });
}

// El diff por ventana ENGAÑA: Urbano paga partido en varios giros, corrido algún día y
// hace catch-up entre semanas (21/07: giro +9,8% sobre su ventana devolviendo faltantes
// del 30/06 y 07/07). La lectura que importa es la ACUMULADA: todo lo vencido desde que
// la caja registra giros, menos todo lo girado = lo que Urbano debe HOY.
export type SaldoUrbano = { esperado: number; girado: number; saldo: number; desde: string };
export function saldoUrbano(
  ventanas: { fecha_pago: string; neto: number }[],
  giros: { fecha: string; monto: number }[],
  hoy: string,
): SaldoUrbano | null {
  if (!giros.length) return null;
  const desde = giros[0].fecha; // giros llega ordenado por fecha asc
  const esperado = ventanas
    .filter((v) => v.fecha_pago >= desde && v.fecha_pago <= hoy)
    .reduce((s, v) => s + Number(v.neto), 0);
  const girado = giros.reduce((s, g) => s + Number(g.monto), 0);
  return { esperado, girado, saldo: esperado - girado, desde };
}

// Fixy rinde en sobres físicos con días de demora, y una parte del COD se cobra digital (no pasa
// por sobre). El gap se calcula contra lo entregado hasta hace LAG días (lo más nuevo todavía no
// tiene sobre) y es un TECHO de reclamo, no deuda exacta.
// ponytail: LAG fijo en 4 días; si Fixy cambia el ritmo de rendición, ajustar acá.
export const FIXY_LAG_DIAS = 4;
export type FixyCobranza = {
  esperadoNeto: number; // entregado neto hasta hace LAG días
  rendido: number; // todos los sobres cargados (cobrados + pendientes)
  pendienteCobro: number; // sobres cargados aún no cobrados (plata física viajando)
  gap: number; // esperado − rendido (≥0)
  ultimoSobre: string | null;
};
export function fixyCobranza(
  dias: { dia: string; neto: number }[],
  sobres: SobreFixy[],
  hoy: string,
): FixyCobranza {
  const corte = new Date(new Date(hoy + "T12:00:00Z").getTime() - FIXY_LAG_DIAS * 86400_000)
    .toISOString().slice(0, 10);
  const esperadoNeto = dias.filter((d) => d.dia <= corte).reduce((s, d) => s + Number(d.neto), 0);
  const rendido = sobres.reduce((s, x) => s + Number(x.monto), 0);
  const pendienteCobro = sobres.filter((x) => !x.cobrado).reduce((s, x) => s + Number(x.monto), 0);
  return {
    esperadoNeto, rendido, pendienteCobro,
    gap: Math.max(0, esperadoNeto - rendido),
    ultimoSobre: sobres.length ? sobres[sobres.length - 1].fecha : null,
  };
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
// la diferencia a favor. El movimiento no trae moneda — la pone la caja de la que salió el retiro —
// así que el balance va SEPARADO por moneda: 600 USD no se igualan con 600 pesos. La PWA Cashflow
// y el bot de WhatsApp todavía los suman juntos (ahí el retiro en USD entra como si fuera ARS).
export type BalanceSocios = { moneda: string; fran: number; santi: number; aFavor: string | null; dif: number };
export function balance5050(movs: Mov[], cajas: Caja[]): BalanceSocios[] {
  const moneda = new Map(cajas.map((c) => [c.id, c.moneda]));
  const por = new Map<string, { fran: number; santi: number }>();
  for (const r of movs) {
    if (!r.es_retiro) continue;
    const m = moneda.get(r.caja_id) ?? "ARS"; // caja borrada → ARS, que es el 99% de los retiros
    const b = por.get(m) ?? { fran: 0, santi: 0 };
    if (r.autor === "Fran") b.fran += Number(r.monto);
    else if (r.autor === "Santi") b.santi += Number(r.monto);
    por.set(m, b);
  }
  return [...por]
    .map(([moneda, b]) => {
      const dif = Math.abs(b.fran - b.santi);
      return { moneda, ...b, dif, aFavor: dif > 0 ? (b.fran < b.santi ? "Fran" : "Santi") : null };
    })
    .sort((a, b) => a.moneda.localeCompare(b.moneda)); // ARS antes que USD
}
