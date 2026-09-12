// Simulador de precio COD: qué le pasa a la contribución cuando se mueve la lista, y cuánta
// conversión extra hace falta para pagar la baja.
//
// El punto de todo esto es que en COD la unidad de análisis NO es el pedido entregado, es el pedido
// PUESTO. El flete se paga igual si el paquete vuelve (Urbano cobra el viaje completo en las
// devoluciones), así que un pedido que no se entrega no es neutro: es flete perdido. Por eso:
//
//   contribución por pedido puesto = P × t × (1 − comisión) − flete − costo × t
//
// El flete entra SIN multiplicar por t — es el único término que no escala con la entrega, y es el
// que rompe la linealidad. A ticket bajo pesa el 20% del precio; a ticket alto, el 11%. Esa es la
// razón por la que bajar precio duele mucho más de lo que parece en una planilla.
//
// El costo de producto sí va por t: la mercadería que vuelve se revende. Es el supuesto optimista
// del modelo — si el devuelto se pierde o vuelve dañado, poné mermaDevuelto > 0.

export type Escenario = {
  precio: number;
  tasa: number; // entrega esperada [0,1]
  costo: number; // COGS del pack completo
  flete: number; // se paga entregue o vuelva
  comision: number; // fracción sobre lo cobrado (Urbano 0,05547 · Fixy 0,01)
  mermaDevuelto?: number; // fracción del costo que NO se recupera en una devolución (0 = todo vuelve vendible)
};

export type Resultado = {
  cobrado: number; // ingreso esperado por pedido puesto
  comisionPagada: number;
  fletePagado: number;
  costoProducto: number;
  contribucion: number; // lo que queda para pagar la pauta
  cpaBreakeven: number; // = contribución: por encima de esto, cada pedido destruye plata
};

export function simular(e: Escenario): Resultado {
  const merma = e.mermaDevuelto ?? 0;
  const cobrado = e.precio * e.tasa;
  const comisionPagada = cobrado * e.comision;
  // Entregado: se consume el costo. Devuelto: se consume solo la merma.
  const costoProducto = e.costo * (e.tasa + (1 - e.tasa) * merma);
  const contribucion = cobrado - comisionPagada - e.flete - costoProducto;
  return {
    cobrado,
    comisionPagada,
    fletePagado: e.flete,
    costoProducto,
    contribucion,
    cpaBreakeven: contribucion,
  };
}

export type Comparacion = {
  actual: Resultado;
  nuevo: Resultado;
  deltaContribucion: number;
  deltaPrecioPct: number;
  // Cuánto tiene que multiplicarse la conversión para que el escenario nuevo iguale al actual.
  // 1,22 = "necesitás 22% más pedidos". Infinity = la contribución nueva es ≤ 0 y no hay volumen
  // que alcance: cada pedido extra a ese precio agranda el agujero.
  factorConversion: number;
  // Elasticidad-precio implícita que haría falta. |ε| = %Δcantidad / %Δprecio. Referencia: en
  // e-commerce de consumo masivo, 1,5-2,5 es lo alcanzable; arriba de 3 es fantasía.
  elasticidadRequerida: number;
};

export function comparar(actual: Escenario, nuevo: Escenario): Comparacion {
  const a = simular(actual);
  const n = simular(nuevo);
  const deltaPrecioPct = (nuevo.precio - actual.precio) / actual.precio;
  // Si la contribución nueva no es positiva, ningún volumen empata: Infinity, no un número grande
  // que invite a redondear. Misma decisión que breakEven() con contribución ≤ 0.
  const factorConversion = n.contribucion > 0 ? a.contribucion / n.contribucion : Infinity;
  const deltaCantidadPct = factorConversion - 1;
  const elasticidadRequerida =
    deltaPrecioPct === 0 || !Number.isFinite(factorConversion)
      ? NaN
      : Math.abs(deltaCantidadPct / deltaPrecioPct);
  return {
    actual: a,
    nuevo: n,
    deltaContribucion: n.contribucion - a.contribucion,
    deltaPrecioPct,
    factorConversion,
    elasticidadRequerida,
  };
}

// ── Tasa de entrega en función del ticket ────────────────────────────────────────────────────
//
// Medido sobre el catálogo (Urbano, despachos desde 2026-07-01): dentro del MISMO producto, el pack
// más caro entrega MEJOR. Pureza x1 $39.973 → 51,3% · x2 $50.031 → 56,6% · x3 $59.989 → 65,2%.
// El patrón se repite en Natures (+10,9 pp) y BeeVenom (+12,4 pp). O sea: bajar el precio no compra
// tasa de entrega, la empeora — quien compra el pack grande está más comprometido y abre la puerta.
//
// Por eso el simulador ajusta `t` cuando movés el precio en vez de dejarla fija: dejarla fija
// sobreestima sistemáticamente lo que rinde una baja de lista.

export type PuntoCurva = { ticket: number; tasa: number; n: number };

// Interpola linealmente entre los puntos medidos y extrapola plano fuera del rango. Plano a
// propósito: extrapolar la pendiente hacia arriba daría tasas de 80% a $120.000 que nadie midió.
export function tasaPorTicket(curva: PuntoCurva[], ticket: number): number {
  if (curva.length === 0) return NaN;
  const p = [...curva].sort((a, b) => a.ticket - b.ticket);
  if (ticket <= p[0].ticket) return p[0].tasa;
  if (ticket >= p[p.length - 1].ticket) return p[p.length - 1].tasa;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    if (ticket >= a.ticket && ticket <= b.ticket) {
      const k = (ticket - a.ticket) / (b.ticket - a.ticket);
      return a.tasa + k * (b.tasa - a.tasa);
    }
  }
  return p[p.length - 1].tasa;
}
