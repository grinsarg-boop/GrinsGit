# Atribución venta ↔ anuncio (el UTM del form COD)

**Estado:** vivo en todas las landings desde el 16/08/2026. Se probó primero solo en ALTUS (pedido
20031, cruzado y visto en `/anuncios`) y se abrió el mismo día.

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

Agregar ese campo en n8n tampoco es una opción: **esa instancia es de Veltron y no se toca**
(decidido por Pancho, 16/08/2026). No es un problema de credenciales que se destrabe consiguiendo una
key — es infraestructura de un tercero.

Hay dos n8n distintos, y conviene tenerlo claro porque el 401 engaña:

| instancia | qué es | la key de `.env.local` |
|---|---|---|
| `biolabs.app.n8n.cloud` | la nuestra (botones AppAds, Fábrica, reportes) | **200** — anda |
| `n8n.srv1817785.hstgr.cloud` | la de Veltron, **crea todos los pedidos COD** | **401** — no es nuestra |

Renovar el `N8N_API_KEY` no cambia nada: está viva, es de la otra instancia.

⇒ **Cruzar por afuera no es un rodeo temporal, es la solución.** Cualquier cosa que en el futuro
necesite que el pedido nazca con un dato nuevo se resuelve de nuestro lado, igual que esto.

Y queda dicho aparte, porque es un riesgo que no controlamos: la instancia de Veltron está en el
camino crítico de toda la facturación COD. Si se cae, no entra ningún pedido.

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

## Cómo se chequea que siga funcionando

No hay que acordarse de mirar nada: quedó colgado de las alertas que ya existen.

**`salud_sistema()`, bloque `atribución`** (migración 076). Antes contaba `utm_content` en
`note_attributes` — con el arreglo vivo eso da 0% para siempre y grita todos los días, que es la forma
más común de apagar una alerta sin darse cuenta. Ahora mide la **cobertura real**: pedidos de ayer a
los que se les puede poner un anuncio por cualquiera de los dos caminos. Salta en AMARILLO bajo 40%
(el histórico sano era ~90%) y pide más de 20 pedidos para no gritar por un día flojo. La corrida
horaria de salud ya la levanta.

Si esa alerta se enciende de ahora en adelante, lo que se rompió es el beacon: el bloque del theme,
`/api/atribucion` o la tabla. Ese es el diagnóstico, no hay que buscarlo.

**El panel `/anuncios`** tiene su propio aviso, independiente: si la cobertura baja de 60% con más de
30 pedidos, dibuja la banda de atribución rota arriba del desglose. Sirve de segundo par de ojos con
otro umbral.

**A mano, si hace falta el número exacto:**

```sql
select count(*) as pedidos,
       count(*) filter (where ad_id_atribuido(raw, phone, created_at) is not null) as atribuidos
from orders where created_at::date = current_date - 1 and cancelled_at is null;
```

`ad_id_atribuido()` es la regla completa y es **la única copia**: la usan el panel y la alerta. Si
algún día cambia el criterio, se toca ahí y los dos se enteran.

### Qué esperar los primeros días

El día que se abrió (16/08) la alerta seguía en 0%: mide *ayer*, y ayer no había beacon. El primer
número real es el del 18/08. Si a las 48 h la cobertura no se parece al ~90% histórico, el beacon está
saliendo pero no cruzando — mirar primero si `atribucion_form` recibe filas (si no recibe, es el
theme; si recibe y no cruzan, es el teléfono o la ventana).

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

**La última milla, cerrada.** Pedido real 20031 por el form de Altus: el beacon guardó
`5491157712384` y el pedido quedó con `1157712384` —la normalización del form se comió el `+54` y el
`9`— y cruzó igual, porque el join va por los últimos 8. Era la hipótesis más frágil del diseño y se
validó con datos de verdad, no de test. `anuncios_pnl` lo devolvió bajo
`120251177936560257 · pureza-02-mix-base-v02 · cbo-sinx1-pureza-02-50k`.

Después de abrir el candado se verificó que Bee Venom (que antes no disparaba) sí manda el beacon con
su propio handle, y que Pureza abre el form con los cuatro campos clave y sin errores de consola. La
primera carga tras escribir el theme vino cacheada por el CDN de Shopify: al probar un cambio de
theme, forzar una copia fresca con un parámetro de query.

## Deuda conocida

`npm run test:db` está rojo desde la migración 074 por un drift de `shipment_events` que no tiene que
ver con esto (prod no tiene la columna `status_canonical` que declara `001_init.sql`). La 075 se
verificó corriendo `anuncios_check.sql` sola contra la base embebida. Mientras eso siga rojo, el
candado de "test verde antes de aplicar" no está disponible para nadie.
