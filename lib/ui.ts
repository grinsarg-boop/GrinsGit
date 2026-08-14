// Vocabulario visual del panel, en un solo lugar. Estas cuatro clases estaban tipeadas a mano en
// cada pantalla con variantes mínimas —un `tracking-wide` acá, un `text-xs` allá— y el resultado
// era que la misma jerarquía se leía distinta según en qué panel estabas.
//
// Las cifras de plata NO viven acá: son la clase `.cifra` de globals.css, porque necesitan
// font-variation-settings y variantes numéricas que no se pueden expresar con utilidades.

/** Etiqueta chica sobre un valor. El salto de tamaño hasta el valor hace la jerarquía. */
export const EYEBROW = "text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground";

/** Botones de un grupo de filtro (rango, canal, vista). Van dentro de `rounded-lg bg-muted p-0.5`. */
export const PILL = "rounded-md px-2.5 py-1 font-medium transition-all duration-150 ease-out motion-safe:active:scale-95";
/** Seleccionado: verde de marca. Era negro sólido, que competía con los números en importancia. */
export const PILL_ON = "bg-brand text-white shadow-[0_0_14px_-8px_var(--color-brand)] dark:text-background";
export const PILL_OFF = "text-muted-foreground hover:bg-background/70 hover:text-foreground";
