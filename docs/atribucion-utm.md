# Atribución venta ↔ anuncio (el UTM del form COD)

**Estado:** canary en la landing de ALTUS, desde el 16/08/2026. No está vivo para el resto.

## Qué se rompió y cuándo

Hasta el 05/07/2026 los pedidos COD los creaba una app de Shopify (`source_name = 4310925`) que
estampaba 21 `note_attributes` en cada orden, entre ellos `utm_content` (= `ad_id` de Meta), con ~92%
de cobertura. El 06/07 se migró al form propio del theme y la app se dio de baja. Desde el 13/07 el
**100%** de los pedidos entra con `source_name = cod-form` y **cero** `note_attributes`.

Medido el 16/08/2026 sobre `orders`:

| semana | pedidos | con note_attributes | con utm_content |
|---|---|---|---|
| 29/06 | 781 | 781 | 723 |
| 06/07 | 721 | 164 | 157 |
| 13/07 en adelante | ~3.400 | 0 | 0 |

No fue un bug: la atribución era una prestación de la app que nadie reimplementó al migrar.

## Por qué no se arregla mandando el UTM en el payload

El form (`sections/veltron-cod-checkout-form.liquid`) postea a n8n
(`n8n.srv1817785.hstgr.cloud/webhook/cod-checkout?tenant=biolabs`) y **n8n es quien crea la orden en
Shopify**. n8n no reenvía el payload crudo: lee una lista fija de campos. La prueba está en el `note`
que escribe en cada pedido —`Canal: … | Pago: … | Oferta: …`— compuesto a partir de
`carrier` / `payment_method` / `bundle_label`. Un campo nuevo en el payload no aparece en ningún lado.

El arreglo prolijo es un campo en ese nodo de n8n. No se hizo porque el `N8N_API_KEY` de `.env.local`
devuelve **401** y no hay forma de entrar desde acá. Si algún día se renueva, esa sigue siendo la
mejor versión: es exacta y no necesita cruzar por teléfono.

## Cómo funciona lo que sí se hizo

1. El form captura `utm_content` de la URL y lo guarda en `sessionStorage` (la compradora navega
   variantes y pierde la query).
2. Cuando se completa el campo de teléfono, dispara un `sendBeacon` a `/api/atribucion` con
   `{phone, ad_id, handle}`.
3. `anuncios_pnl` (migración 075) cruza el pedido contra esa tabla **por los últimos 8 dígitos del
   teléfono**, dentro de una ventana de −60 min / +5 min respecto del `created_at` del pedido.

### Las tres decisiones que no son obvias

**Va colgado del campo de teléfono, no del submit.** Si ese código explota, explota en su propio
handler y la venta sale igual. Es la única razón por la que el `ad_id` no está adentro del objeto
`data` que se manda a n8n. El costo: si alguien llena el teléfono y abandona, queda una fila huérfana.

**El join es por los últimos 8 dígitos.** El form normaliza el teléfono antes de mandarlo (saca `+54`,
el `9` de celular, convierte el `15` — línea 560 de la sección) y **todas esas transformaciones tocan
el prefijo**. Los últimos 8 son invariantes, así que el beacon manda el teléfono crudo y no quedan dos
normalizaciones que mantener sincronizadas.

**El teléfono no es identidad.** Dos pedidos del mismo número dentro de la ventana son ambiguos: se
toma el beacon más reciente anterior al pedido. Falla hacia *sin atribución*, nunca hacia atribución
equivocada — un `ad_id` mal puesto ensucia la decisión de escalar, y la ausencia solo deja el pedido
en el cubo `NULL`, que ya está a la vista en el panel.

`note_attributes` tiene prioridad sobre el beacon: para los pedidos hasta el 05/07 ese dato es exacto
y no se toca.

## Qué se tocó

| pieza | archivo |
|---|---|
| tabla + cruce en la RPC | `supabase/migrations/075_atribucion_form.sql` |
| tests | `supabase/tests/anuncios_check.sql` (bloque `075`) |
| endpoint | `app/api/atribucion/route.ts` |
| theme | `sections/veltron-cod-checkout-form.liquid`, bloque al final del `<script>` |

Original del theme antes del cambio, para diff o restore:
`docs/theme-backup/veltron-cod-checkout-form.ORIGINAL-2026-08-16.liquid`
(757 líneas, sha256 `c1b495d8260e184d944c4a51d43f2a145bdc4623ec1360ad915f346b1ff91ce2`).

## Cómo volver atrás

**El theme** (es lo único que puede afectar la venta, y por eso va primero):

```bash
node --env-file=.env.local scripts/theme-asset.mjs put sections/veltron-cod-checkout-form.liquid docs/theme-backup/veltron-cod-checkout-form.ORIGINAL-2026-08-16.liquid
```

Restaura el archivo tal cual estaba. No hace falta tocar nada más: sin el beacon, la tabla deja de
recibir filas y `anuncios_pnl` vuelve sola a leer solo `note_attributes`.

**La RPC**, si hiciera falta dejarla como antes de la 075:

```bash
node scripts/db-apply.mjs --force supabase/migrations/051_anuncios.sql
```

La 051 es la definición vieja, sin el `coalesce`. Es un `create or replace`, así que revierte limpio.

**La tabla** se puede dejar donde está: no la lee nadie más que la RPC. Si molesta,
`drop table atribucion_form;` después de revertir la RPC, nunca antes.

## Ampliar de Altus a todas las landings

En el bloque del theme, borrar la condición `if (S.handle !== CANARY) return;`. Nada más.

Cuando eso pase, hay que acordarse de `salud_sistema()` (migración 068): la alerta de atribución
cuenta `utm_content` en `note_attributes`, así que va a seguir gritando "0 pedidos con utm_content"
aunque el cruce funcione. Mientras sea canary la alerta es correcta y no hay que tocarla.

## Qué se verificó el 16/08/2026

Contra la landing real, con `?utm_content=120251177936560257` (un ad de Pureza con gasto, elegido
para que el cruce muestre nombre):

- El `ad_id` de la URL queda en `sessionStorage`. Sin errores en consola.
- En **Altus**, al completar el teléfono el beacon sale y la fila entra con `ad_id`, `handle` y
  `phone_tail` correctos.
- En **Bee Venom** (que sí tiene pauta corriendo), el mismo recorrido **no dispara nada**: el candado
  por handle corta antes. Es la prueba de que el resto de las landings quedó inerte.
- El endpoint responde 204 al payload válido y 400 a las tres formas inválidas (sin `ad_id`, body que
  no es JSON, teléfono corto).
- `anuncios_check.sql` pasa los 3 asserts nuevos: cruce por teléfono con formatos distintos,
  precedencia de `note_attributes`, y beacon fuera de ventana que no atribuye.

**Falta la última milla:** un pedido de verdad entrando por el form de Altus, para ver el cruce
completo en `/anuncios`. Eso necesita una compra real.

## Deuda conocida

`npm run test:db` está rojo desde la migración 074 por un drift de `shipment_events` que no tiene que
ver con esto (prod no tiene la columna `status_canonical` que declara `001_init.sql`). La 075 se
verificó corriendo `anuncios_check.sql` sola contra la base embebida. Mientras eso siga rojo, el
candado de "test verde antes de aplicar" no está disponible para nadie.
