// Semáforo contra umbral MEDIDO. La regla es que ningún corte se inventa: o sale del break-even
// (lib/breakeven.ts, la línea donde la plata deja de rendir) o sale de un percentil del propio
// histórico. Los 0,35 / 0,45 que estaban hardcodeados en /analisis eran números de nadie: no venían
// de una medición, no se movían cuando el negocio se movía, y con tasas que fueron de 63% (Fixy AMBA)
// a 39% (Urbano nacional) marcaban en rojo cosas sanas.
//
// El par de cortes es siempre [mal, bien] en el ORDEN NATURAL de la métrica, y `bueno` dice para qué
// lado se mejora — igual que <Delta/>. Debajo de `mal` es rojo, arriba de `bien` es verde, en el medio
// ámbar. Si `bien` queda del lado malo de `mal` (pasa cuando el negocio entero está bajo el break-even)
// la banda ámbar desaparece sola: no hay "aceptable" cuando tu mejor cuartil ya pierde plata.
export type Nivel = "ok" | "medio" | "mal";

// Percentil con interpolación lineal (el método por defecto de numpy y de R type 7). Percentil y no
// promedio a propósito: un domingo con 2 guías o un feriado sin pauta no tiene que mover el umbral.
// `minN` es el piso de muestra — con 3 filas un cuartil no significa nada, mejor no pintar nada.
export function percentil(vals: number[], p: number, minN = 5): number {
  const xs = vals.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (xs.length < minN) return NaN;
  const i = (xs.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
}

export function nivel(v: number, [mal, bien]: [number, number], bueno: "sube" | "baja" = "sube"): Nivel | null {
  if (!isFinite(v) || !isFinite(mal) || !isFinite(bien)) return null;
  const s = bueno === "sube" ? 1 : -1;
  if (s * v < s * mal) return "mal";
  if (s * v >= s * bien) return "ok";
  return "medio";
}

export const CLASE_SEMAFORO: Record<Nivel, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  medio: "text-amber-600 dark:text-amber-500",
  mal: "text-destructive",
};

// Clase de color de una fila, o el gris de siempre cuando no hay umbral medido que aplicar.
export const claseSemaforo = (n: Nivel | null, sinDato = "text-muted-foreground") =>
  n ? CLASE_SEMAFORO[n] : sinDato;

// Verde/rojo del profit. Manda la plata FIRME (el confirmado), no el estimado: el estimado es una
// proyección, y pintarlo afirma algo que todavía no pasó. Estaba copiado en 8 páginas juzgando siempre
// el estimado, y eso mentía para los dos lados en rangos recientes — verde sobre plata que todavía no
// existe, o rojo sobre una cohorte que solo va a subir.
//
// El caso del medio es el que importa y por eso hay tres colores y no dos: confirmado en rojo con
// estimado en verde NO es pérdida, es cohorte inmadura (el flete y los ads ya se pagaron, el COD
// todavía no entró). Va ámbar, que es el color que el panel ya usa para "todavía no se sabe".
// Sin confirmado a mano (packs, zonas, un día suelto) se juzga el único número que hay.
export function pnlColor(est: number, conf?: number) {
  const firme = conf ?? est;
  if (firme >= 0) return CLASE_SEMAFORO.ok;
  return est >= 0 ? CLASE_SEMAFORO.medio : CLASE_SEMAFORO.mal;
}
