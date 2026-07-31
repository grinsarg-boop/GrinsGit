// Eventos anotados sobre las series (migración 065). Dos formas: PUNTUAL (una marca punteada, "acá
// pasó algo") y FRANJA (fecha_fin: "en este período el dato no es comparable"). La franja además
// dispara el aviso arriba de las tablas cuyo rango la cruza — el pozo deja de ser un misterio.
// `en_graficos` (066): si el evento afecta lo que las curvas PLOTEAN se dibuja encima; si solo afecta
// datos de terceros (Meta, AppAds) va como aviso de texto y nada más — una trama sobre la serie dice
// "no compares esto" y no sabe matizar, el texto sí.
export type Evento = { id: number; fecha: string; fecha_fin: string | null; texto: string; en_graficos?: boolean };
export const SELECT_EVENTOS = "id, fecha, fecha_fin, texto, en_graficos";

export const esFranja = (e: Evento) => e.fecha_fin != null && e.fecha_fin !== e.fecha;

// Eventos que se SOLAPAN con [from, to] — no los que empiezan adentro: una franja que arranca en mayo
// y termina el 22/07 tiene que avisar igual cuando mirás del 1 al 30 de julio.
export function enRango(evs: Evento[], from: string, to: string): Evento[] {
  return evs.filter((e) => e.fecha <= to && (e.fecha_fin ?? e.fecha) >= from);
}

// Traduce fechas a índices de una serie ya dibujada (los dos gráficos del panel indexan por posición,
// no por fecha real). `i` es el primer punto del evento e `iFin` el último, ambos recortados a la
// serie: una franja que empieza antes del primer punto se dibuja desde el borde, que es lo correcto.
// Devuelve null para los eventos que no tocan la serie.
export type Marca = { ev: Evento; i: number; iFin: number };
export function marcas(fechas: string[], evs: Evento[]): Marca[] {
  if (!fechas.length) return [];
  const primera = fechas[0], ultima = fechas[fechas.length - 1];
  const idxDesde = (f: string) => { const i = fechas.findIndex((x) => x >= f); return i < 0 ? fechas.length - 1 : i; };
  const idxHasta = (f: string) => { const i = fechas.findIndex((x) => x > f); return i < 0 ? fechas.length - 1 : Math.max(i - 1, 0); };
  return evs.filter((e) => e.en_graficos !== false).flatMap((ev) => {
    const fin = ev.fecha_fin ?? ev.fecha;
    if (ev.fecha > ultima || fin < primera) return [];
    const i = idxDesde(ev.fecha);
    // iFin nunca antes que i: si el evento cae en un hueco de la serie (un domingo sin ventas), los
    // dos extremos aterrizan en puntos distintos y la franja saldría con ancho negativo.
    return [{ ev, i, iFin: Math.max(idxHasta(fin), i) }];
  });
}
