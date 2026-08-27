# Prompt para chat nuevo — `/logistica`: preparador de etiquetas

Copiar todo lo que sigue como primer mensaje de la sesión nueva, parado en `~/Downloads/ProyectoEco`.

---

Trabajamos en `/Users/franciscoandreudegasperi/Downloads/ProyectoEco` (panel de finanzas BioLabs, Next.js App Router + Supabase, deploy autónomo en `biolabs-finanzas.vercel.app`).

**Antes de escribir nada, leé `docs/relevamiento-logistica.md` y `docs/indicador-2b3b.md`.** Son un relevamiento hecho el 09/08/2026 de todo lo que el repo YA tiene para manipular PDFs de etiquetas. Te ahorran redescubrir el 80%. Lo que dicen es una foto: si algo no cierra contra el código, gana el código.

## El problema real

Hoy, para despachar, hay que ordenar las etiquetas a mano: mirar cada una, ver qué producto y cuántas unidades lleva, y agruparlas. Eso es tiempo muerto todos los días antes de empezar a armar bultos.

## Qué construir

Dos funciones nuevas dentro de `/logistica` (la ruta **ya existe** con tabs `?t=picking|correo|etiquetas` — se suman tabs, no se crea la página).

### A · Preparador de etiquetas COD

1. Se suben uno o varios PDFs de etiquetas, mezclados, de **Correo Argentino, Urbano y Fixy**.
2. Por cada página se identifica el pedido, el producto y las unidades.
3. Se le estampa el **indicador de depósito** (`2B`, `3B`, `2N`, …) legible al lado del nº de pedido.
4. Devuelve **un PDF** con las páginas reordenadas **por producto y por cantidad de unidades**, listo para imprimir y arrancar a armar sin volver a ordenar nada.

### B · Ordenador de etiquetas de MercadoLibre

Función aparte, en su propio tab, sin estampado: se suben las etiquetas de ML/Flex y devuelve el PDF ordenado por producto y unidades. ML es un flujo distinto (etiqueta 10×19 con talón, sin nº de orden nuestro), por eso va separado y no mezclado con el A.

## Lo que ya está resuelto y hay que reusar

- `extractLabels()` — parsea los **4 formatos** (Correo/Urbano/Fixy/ML) y devuelve por página `{page, courier, orden, producto, unidades, revisar}`. Tiene 8 tests con texto real.
- `POST /api/picking` — cruza `orden → producto + unidades` contra Shopify.
- `stampCodes()` — estampa con pdf-lib.
- `mlLabelsTo10x15()` — parte el 10×19 de ML en etiquetas de 10×15.
- `packBreakdown()` — el agregado tipo `10×1 · 15×2`.
- `lib/correo.ts:187` `productoCode()` — la regla del indicador.
- Dependencias: **pdf-lib ^1.17.1 y pdfjs-dist ^6.1.200 ya instaladas. No agregues ninguna.**

## Lo que falta construir

1. **Reordenar páginas** — no existe nada. Es `copyPages()` en el orden que quieras, ~15 líneas.
2. **Generalizar el estampado** — `stampCodes()` tiene `x:95, y:88` hardcodeado y validado **solo para Correo**. Urbano (15×10 apaisada) y Fixy (10×15) tienen otra geometría. **Medí `page.getSize()` de una etiqueta real de cada courier antes de fijar coordenadas** — hay ejemplos reales en `~/Downloads/` (`FIxy0708.pdf`, `etiquetas-urbano-15x10-apaisada.pdf`, y las que genera `scripts/redespacho.mjs`). El estampado no puede tapar el código de barras ni el QR.
3. **Unir split + orden en ML** — `mlLabelsTo10x15()` devuelve el contador pero no el mapeo de páginas, así que si descarta la hoja A4 de resumen los índices se desalinean. Es el único cambio de firma probable.

## Decisión pendiente, preguntala antes de codear

El código hoy genera **`B3`** (letra + número, `lib/correo.ts:187`) y eso es lo que ya se imprime en las etiquetas de Correo que el depósito usa. Pancho pidió la feature como **`3B`** (número + letra). Es un swap de una línea, pero cambia un papel que la gente ya lee todos los días. **Preguntale cuál quiere y que valga para los dos lugares** — no dejes los dos formatos conviviendo.

Letras: `N` Natures · `P` Pureza · `V` Veinguard · `B` BeeVenom · `A` Altus · `R` Revival Oil · `M` M3.
Número = suma de `order_items.pack` del pedido (NO `qty`, que vale 1 siempre). Carrito mixto → sin código, va a una pila "revisar".

## Restricciones y trampas

- **Todo corre en el browser, a propósito.** La UI promete "no se sube a ningún lado". Los `/api/import/*` están detrás de `CRON_SECRET`, no de sesión. El patrón es Dropzone → `arrayBuffer()` → pdfjs/pdf-lib → Blob.
- **`slice(0)` siempre** sobre el buffer: pdfjs lo deja detached y el segundo uso falla.
- **ML no tiene nº de orden nuestro** — el `#262382468` de la etiqueta es el id del vendedor, no del pedido. El producto y el pack salen del talón y del SKU (`VE4`).
- **`"1 Unidad"` en la etiqueta de ML ≠ pack.**
- **Los pedidos mixtos (`revisar: true`) no se pueden ordenar solos** — que salgan al final, en su propio bloque, y que la UI diga cuántos son.
- **No reescalar las páginas.** `copyPages` + `addPage` preservan tamaño y orientación; forzar un pagesize rompe el escaneo del código de barras.
- Convenciones: vitest con los tests al lado del módulo en `lib/`, shadcn new-york (solo 7 primitivas en `components/ui/`), `maxDuration` por ruta. La whitelist de tabs de `/logistica` está **duplicada** en `page.tsx` y `nav-link.tsx` — hay que tocar las dos.

## Cómo quiero que trabajes

- Leé los dos `docs/` primero y decime en 5 líneas qué vas a hacer antes de empezar.
- Dejá un test que falle si el orden se rompe: PDF de entrada mezclado → orden de salida esperado. Sin frameworks nuevos, vitest como el resto.
- Verificá con archivos reales, no inventados. Generá el PDF de salida y miralo antes de decir que anda.
- Deployás solo cuando te lo pida.
