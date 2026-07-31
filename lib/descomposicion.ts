// De qué está hecho un cambio de profit. La pregunta que el panel no contestaba es la que Runway
// pone primero: un profit plano puede esconder MÁS volumen a PEOR entrega, y los dos efectos se
// cancelan en el número final. Cuatro KPIs uno al lado del otro no lo dicen — hay que multiplicarlos.
//
// La identidad es la del P&L, encadenada:
//
//   profit = guías × tasa de entrega × ticket × margen
//            (g)     (t = ent/guías)   (k = rev/ent)  (m = profit/rev)
//
// y la descomposición es en cascada, cada factor evaluado con los que vienen antes ya movidos:
//
//   volumen = (g₁−g₀)·t₀·k₀·m₀      entrega = g₁·(t₁−t₀)·k₀·m₀
//   ticket  = g₁·t₁·(k₁−k₀)·m₀      margen  = g₁·t₁·k₁·(m₁−m₀)
//
// Los cuatro SUMAN el cambio exacto (telescopa: g₁t₁k₁m₁ − g₀t₀k₀m₀), sin residuo que repartir a
// ojo. El orden importa —es lo que hace que cierre— y va del más upstream al más downstream: cuánto
// entró, cuánto llegó, a qué precio, con qué margen.
//
// Sobre el profit CONFIRMADO, no el estimado: el estimado tiene adentro una proyección de tasa de
// entrega, así que "entrega" aparecería a los dos lados de la ecuación y el factor se explicaría a
// sí mismo. ponytail: si algún día hace falta explicar el estimado, la salida honesta es descomponer
// por cohortes ya cerradas, no cambiarle el input a esta función.
export type Periodo = { guias: number; entregas: number; revenue: number; profit: number };
export type Factor = { clave: "volumen" | "entrega" | "ticket" | "margen"; label: string; efecto: number; delta: number };

export type Descomposicion = { total: number; factores: Factor[] };

export function descomponer(hoy: Periodo, antes: Periodo): Descomposicion | null {
  // Sin guías o sin entregas en alguno de los dos períodos la cadena se corta (división por cero) y
  // no hay descomposición posible: mejor no dibujar nada que inventar un reparto.
  for (const p of [hoy, antes]) if (!(p.guias > 0) || !(p.entregas > 0) || !(p.revenue > 0)) return null;

  const f = (p: Periodo) => ({
    g: p.guias, t: p.entregas / p.guias, k: p.revenue / p.entregas, m: p.profit / p.revenue,
  });
  const a = f(antes), b = f(hoy);

  return {
    total: hoy.profit - antes.profit,
    factores: [
      { clave: "volumen", label: "guías",  efecto: (b.g - a.g) * a.t * a.k * a.m, delta: b.g - a.g },
      { clave: "entrega", label: "entrega", efecto: b.g * (b.t - a.t) * a.k * a.m, delta: b.t - a.t },
      { clave: "ticket",  label: "ticket",  efecto: b.g * b.t * (b.k - a.k) * a.m, delta: b.k - a.k },
      { clave: "margen",  label: "margen",  efecto: b.g * b.t * b.k * (b.m - a.m), delta: b.m - a.m },
    ],
  };
}
