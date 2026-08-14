import Link from "next/link";
import { fmtDate, fmtMoney } from "@/lib/format";

// La cinta de cohortes — el gráfico que solo puede existir en ESTE panel.
//
// Un día de despacho no nace con su número puesto: nace como promesa (profit estimado, proyectado
// sobre la tasa de entrega) y va endureciendo a medida que las guías cierran. Esa mecánica es la
// que hay que tener en la cabeza para leer el panel, y hasta acá vivía enterrada en la columna 3 de
// la tabla, como una barrita gris de 74px.
//
// Acá cada día son DOS barras superpuestas sobre el mismo eje:
//   · el fantasma traslúcido = profit ESTIMADO — el techo, lo que el día promete
//   · la barra sólida        = profit CONFIRMADO — plata que ya existe
// La brecha entre las dos ES lo que falta madurar. Los días de esta semana se ven casi todos
// fantasma; los del mes pasado, sólidos. El ritmo del negocio se lee de un vistazo, sin números.
//
// Server component a propósito: hover y foco son CSS, así que esto no manda un byte de JS.

const MAX_COLS = 60; // más que esto son barras de 2px: ruido, no información
const ALTO = 112; // es el gráfico principal de la página: por debajo de ~100px no se leen las diferencias

// Dónde cae el cero y cuánto mide cada lado. Sale del componente para poder probarse: un rango sin
// días rojos NO puede reservar espacio abajo (la cinta quedaría flotando), y un rango con un solo
// día muy negativo tampoco puede comerse media altura.
export function escalaCinta(vals: number[], alto = ALTO) {
  const posMax = Math.max(0, ...vals);
  const negMax = Math.max(0, ...vals.map((v) => -v));
  const altoNeg = negMax === 0 ? 0 : Math.min(Math.max((alto * negMax) / (posMax + negMax), 14), 34);
  return { posMax, negMax, altoPos: alto - altoNeg, altoNeg };
}

export function CintaCohortes({
  dias, href,
}: {
  dias: { fecha: string; label?: string; conf: number; est: number }[];
  href?: (fecha: string) => string;
}) {
  // Cronológico y acotado acá adentro: el orden del caller no puede romper la lectura.
  const datos = [...dias].sort((a, b) => (a.fecha < b.fecha ? -1 : 1)).slice(-MAX_COLS);
  if (datos.length < 2) return null;

  // Alto total fijo; el cero se corre para arriba solo lo necesario si hay días en rojo.
  const { posMax, negMax, altoPos, altoNeg } = escalaCinta(datos.flatMap((d) => [d.conf, d.est]));
  if (posMax === 0 && negMax === 0) return null;
  // Escala propia por lado: comparar la altura de un día verde contra uno rojo no es la pregunta;
  // la pregunta es cuánto de cada día ya está firme.
  // Posición + el índice de columna, que viaja como --i para escalonar la animación de entrada.
  const px = (v: number, i: number) => ({
    ...(v >= 0
      ? { bottom: altoNeg, height: posMax ? (v / posMax) * altoPos : 0 }
      : { top: altoPos, height: negMax ? (-v / negMax) * altoNeg : 0 }),
    "--i": i,
  }) as unknown as React.CSSProperties;

  const Col: React.ElementType = href ? Link : "div";
  const nombre = (d: { fecha: string; label?: string }) => d.label ?? fmtDate(d.fecha);

  return (
    <div>
      <div className="relative flex items-end gap-px" style={{ height: ALTO }}>
        {/* El cero, cuando hay días en rojo: sin la línea, una barra para abajo no se lee como pérdida. */}
        {altoNeg > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
               style={{ top: altoPos }} aria-hidden />
        )}
        {datos.map((d, i) => {
          const firme = d.est !== 0 && Math.abs(d.conf / d.est) >= 0.98;
          return (
            <Col
              key={d.fecha}
              {...(href ? { href: href(d.fecha) } : {})}
              aria-label={`${nombre(d)}: confirmado ${fmtMoney(d.conf)}, estimado ${fmtMoney(d.est)}`}
              className="group relative block h-full min-w-[3px] flex-1 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {/* Fantasma: el techo que promete el día. */}
              {/* origin-bottom/top: la barra crece DESDE el cero. Sin esto se abre desde su centro
                  y la línea de base se lee como si se moviera. */}
              <span
                style={px(d.est, i)}
                className={`cinta-barra rayado absolute inset-x-0 rounded-[2px] ${
                  d.est >= 0 ? "origin-bottom bg-emerald-500/10 text-emerald-400/70" : "origin-top bg-destructive/10 text-destructive/70"
                }`}
              />
              {/* Sólida: plata que ya está. Gradiente + halo propio: encendida desde adentro, no
                  pintada de un color plano. */}
              <span
                style={px(d.conf, i)}
                className={`cinta-barra absolute inset-x-0 rounded-[2px] bg-gradient-to-t transition-all group-hover:brightness-125 ${
                  d.conf >= 0
                    ? "origin-bottom from-emerald-600 to-emerald-400 shadow-[0_0_10px_-6px_var(--color-emerald-500)]"
                    : "origin-top from-red-600 to-red-400 shadow-[0_0_10px_-6px_var(--color-red-500)]"
                }`}
              />
              {/* Lectura al pasar por encima. Sin JS: es display sobre group-hover/focus. */}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs shadow-lg group-hover:block group-focus-visible:block">
                <span className="font-medium">{nombre(d)}</span>
                <span className="mt-0.5 block tabular-nums text-muted-foreground">
                  <b className={d.conf >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
                    {fmtMoney(d.conf)}
                  </b>
                  {!firme && <> · techo {fmtMoney(d.est)}</>}
                </span>
              </span>
            </Col>
          );
        })}
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 text-[0.7rem] tabular-nums text-muted-foreground">
        <span>{nombre(datos[0])}</span>
        <span className="inline-flex items-center gap-3 whitespace-nowrap">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-[2px] bg-gradient-to-t from-emerald-600 to-emerald-400" aria-hidden /> confirmado
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="rayado h-2 w-2 rounded-[2px] bg-emerald-500/10 text-emerald-400/70" aria-hidden /> falta madurar
          </span>
        </span>
        <span>{nombre(datos.at(-1)!)}</span>
      </div>
    </div>
  );
}
