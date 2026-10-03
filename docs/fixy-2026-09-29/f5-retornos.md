# F5, corrida A: oferta de reenvío a los retornos de Fixy que nunca la recibieron (29/09/2026)

Todo fue de solo lectura. No se mandó nada, no se refrescó ningún estado y no se tocó ningún flujo. La lista está en `f5-retornos-envio.csv`: 271 filas, con las que se mandan primero (`motivo=ENVIAR`).

## Resultado

| paso | n |
|---|---|
| Retornos Fixy con el primer 139 (o 184) desde el 27/08 (Finanzas, `shipment_events`) | 276 |
| Ya recibieron alguna plantilla de reenvío (4 costo+recordatorio, 1 solo costo) | −5 |
| **Universo sin oferta** | **271** |
| Excluidos por chat negativo | −46 |
| Excluidos por duplicado | −15 |
| Excluidos por reenviado o pedido nuevo | −14 |
| Excluidos por teléfono inválido | −14 |
| Excluidos porque el paquete todavía no volvió (sin 184) | −56 |
| Excluidos por pedido cancelado | 0 |
| **Lista para mandar** | **126** |

La tabla cuenta cada pedido una sola vez, por el primer motivo en este orden: cancelado → duplicado → reenviado/nuevo → chat → teléfono → no volvió. Si se cuentan los solapes, los totales por motivo son: chat 51, duplicado 15, reenviado/nuevo 15, teléfono 16, no volvió 68.

- **Cancelado: 0.** El único pedido cancelado (#21314) ya había recibido la oferta: el bot lo canceló el 03/09 cuando el cliente dijo que no quería el reenvío.
- **Duplicado:** el mismo teléfono tiene otro retorno más nuevo en la lista (queda solo el más nuevo), o un pedido gemelo a ±72 h que siguió vivo o se entregó. Un pedido de Correo en `espera_link_pago` no cuenta como gemelo vivo.
- **Reenviado o pedido nuevo:** el cliente hizo después (más de 72 h) otro pedido vivo, en Finanzas o en Veltron (entregado, despachado o confirmado). También cuenta si Veltron tiene una nota `[reenvio]` o si la guía cambió. Por guía cambiada no apareció ningún caso.
- **Chat negativo:** los mensajes entrantes desde que se creó el pedido pasaron por un regex (no lo pedí, desconfianza, no lo quiero, cancelar o anular, enojo) y después por **revisión manual en dos pasadas**. Se descartaron 12 falsos positivos, por ejemplo "Bueno gracias", "el otro se canceló" o "no quiero pedir 2 veces". Se sumaron 12 negativos que el regex no agarraba: "ya suspendí el pedido", "rechazo los dos", "no voy a querer el spray", "caselo", y un cliente que rechazó a propósito porque quería un solo frasco.
- **Teléfono inválido (16 si se cuentan los solapes):** 5 pedidos tienen el teléfono con menos de 10 dígitos (Veltron lo rechaza y no tienen pedido en Veltron). En los otros 11, **todas** las plantillas anteriores fallaron: no tienen WhatsApp.
- **No volvió al depósito: sí se puede saber.** Se consultó la API de Fixy (`seguimiento.json`, solo lectura) para los 276. **208 están en 184 "DEVOLUCIÓN ENTREGADA"**, o sea que la devolución llegó a BioLabs, y 68 siguen en 139 "COBRO DE SERVICIO Y DEVOLUCIÓN". Del 139 al 184 pasan una mediana de 4 días (p10 2, p90 10). Los 184 caen en tandas, como el 11/09 a las 12:25.
  - **Tanda 2: 56 pedidos** cuyo único motivo es que falta el 184 (tienen 139 entre el 21 y el 29/09). Se mandan cuando entre el 184. Antes de mandarlos hay que repasar el chat a mano, porque solo pasó el regex.

## La lista de 126

- **Costo de reenvío:** $7.420 en GBA1 (68 pedidos) · $11.770 en GBA3 (25) · $9.757 en GBA2 (17) · $5.198 en CABA (16). El **típico es $7.420** y el promedio da ~$8.300.
- **Producto:** PurezaDrops 110 · Bee Venom 16. El COD original suma $6,54M.
- **Fechas:** el 139 cae entre el 27/08 y el 18/09. El 184 (llegó al depósito) entre el 11/09 y el 21/09.
- **Columnas para priorizar o filtrar, a decisión de Pancho:**
  - `rechazo_puerta_51`: 41 tienen el evento 51 "DESTINATARIO RECHAZA EL ENVIO". Se puede esperar menos aceptación.
  - `pidio_reprogramar`: 8 pidieron otra fecha en el chat. Son los más calientes.
- **Estado del pedido en Veltron (`comm_evento`), que decide si la cadena funciona:** DESPACHADO 94 · EN_SUCURSAL 13 · REBOTADO_1 9 · **RETORNADO 8** · ENTREGADO 2 (por un bug, ver abajo).

## Cómo calcula Veltron `$costo_reenvio`

Es el **`costo_etiqueta` de Fixy para la zona del CP**, que sale de `cotizar_envio`: CABA $5.198 · GBA1 $7.420 · GBA2 $9.757 · GBA3 $11.770. Se validó contra los montos que el bot y las notas `[reenvio]` ya le habían informado a clientes de Fixy: **coinciden 9 de 9**. En Urbano el reenvío es fijo, $8.500. El CSV lo trae calculado por pedido, en `costo_reenvio` y `params_json`, con el CP que tiene Veltron.

## Plantilla y params

El flujo `fx_ret_costo` (fixy, RETORNADO, activo, delay 0) usa `retorno_reenvio_costo`, que es UTILITY y está APPROVED. Los params van en este orden: `[cliente_nombre, producto_titulo, $costo_reenvio]`. En el CSV salen de `ver_pedido`: nombre completo y título tal como los tiene Veltron.

Tres ejemplos renderizados, con el nombre reemplazado por iniciales:

1. [CABA] "¡Hola R. F.! Tu pedido de Bee Venom Spray 2x1: Alivio inmediato para piel sensible con Psoriasis. volvió a nuestro depósito porque el correo no pudo entregarlo. ¿Querés que te lo reenviemos? El reenvío tiene un costo de envío de $5.198 que se suma al total de tu compra. Respondé este mensaje y lo coordinamos enseguida."
2. [GBA1] "¡Hola M. V.! Tu pedido de PurezaDrops™ | Drena Naturalmente la Hinchazón del Rostro, Abdomen y Piernas volvió a nuestro depósito porque el correo no pudo entregarlo. ¿Querés que te lo reenviemos? El reenvío tiene un costo de envío de $7.420 que se suma al total de tu compra. Respondé este mensaje y lo coordinamos enseguida."
3. [GBA3] Igual al 2, con $11.770.

El texto tiene una incoherencia que no traba el envío: dice que el costo "se suma al total de tu compra", pero el bot cobra el reenvío **antes** y por transferencia. Así lo dicen las notas `[reenvio]` y el recordatorio ("se abona antes por transferencia").

## Método: qué deja enganchada la cadena

Hechos medidos:

- `fx_ret_costo_2` (recordatorio a las 72 h) y `fx_ret_transf` (transferencia a las 48 h) cuelgan de `recordatorio_de: fx_ret_costo` y del evento **RETORNADO**. En los logs, la cadena funciona sobre envíos del flujo:
  - Si el cliente no respondió, el recordatorio sale a las 72-74 h (26 casos en Fixy, 597 en Urbano).
  - Si respondió, sale a las ~141 h.
  - Si aceptó, la transferencia sale a las ~49 h.
  - Cuando el cliente acepta o rechaza, el bot deja la nota `[reenvio dd-mm] el cliente ACEPTA/NO quiere…`. Si rechaza, cancela el pedido.
- El marker es `(pedido, evento, flujo_id)`, según `Veltron-WhatsApp.md:387`. `enviar_plantilla` dice que "reclama antes de mandar" y acepta `pedido_id` y `carrier`, pero **no documenta qué `flujo_id` registra**. En los logs **no hay ningún envío manual de `retorno_reenvio_costo`** para comprobarlo: de los 1.305 envíos de `retorno_reenvio_costo` en los logs (Fixy y Urbano), ninguno cae fuera de los minutos del cron (:00-:05 y :29-:34). **No está verificado.**
- **Solo 8 de los 126 están en RETORNADO dentro de Veltron.** Los otros 118 están trabados:
  - 94 en DESPACHADO: Veltron muestra el 42 "ESPERANDO PROGRAMACIÓN" previo al 139 porque dejó de refrescarlos.
  - 22 en EN_SUCURSAL o REBOTADO_1.
  - 2 en ENTREGADO.

  En esos 118, **ninguna vía manual engancha la cadena de RETORNADO**. Además, el bot ve el pedido como "despachado", así que ante un "sí, reenviámelo" puede contestar que el pedido está en camino.
- **No hay que correr `refrescar_estado_carrier` sobre esta lista.** Hoy el refresh traería el 184 "DEVOLUCIÓN ENTREGADA", y Veltron lo mapeó a **ENTREGADO** en 4 de los 8 casos que se vieron: #24160, #24430, #24189 y #24179, más #19942 con el 140. Esos clientes **recibieron `fixy_entregado_gracias` con el paquete devuelto**. Refrescar dispararía esa plantilla en masa y el pedido nunca pasaría a RETORNADO.

**Método recomendado, el que no rompe la cadena:** un solo mensaje de Pancho a Monta con tres pedidos:
1. Mapear 139 y 184 a RETORNADO, nunca a ENTREGADO.
2. Pasar a RETORNADO los 126 `pedido_id` del CSV, sin disparar ENTREGADO.
3. Correr `fx_ret_costo` nativo (`sweep mode=run`, carriers=fixy). El cap es de 40 por corrida, así que drena en 4 ciclos.

De esa forma Veltron calcula el `$costo_reenvio`, reclama el marker de `fx_ret_costo`, y el recordatorio, la transferencia y el bot del reenvío quedan enganchados. Hay que pedirle también que explique por qué `fx_ret_costo` no salió entre el 22 y el 28/09 para los pedidos que sí estaban en RETORNADO.

**Si Pancho quiere mandar sin esperar a Monta:**
- Usar `enviar_plantilla {telefono, plantilla:"retorno_reenvio_costo", params: params_json, pedido_id, carrier:"fixy", confirmar:true}`, **siempre con `pedido_id` y `carrier`**. Los 762 envíos de flujo del log quedaron con `shopify_order_number`, y así se liga la respuesta al pedido.
- Mandar **primero los 8 que están en RETORNADO como piloto** y revisar a las 74 h si salió `retorno_reenvio_recordatorio` a los que no respondieron. Si salió, el envío manual reclamó el marker y la cadena está sana.
- En los otros 118 el envío manual sale una sola vez: no hay recordatorio automático y las respuestas las tiene que tomar Carito.
- Si después Monta arregla la detección y el envío manual no reclamó el marker de `fx_ret_costo`, **se mandaría dos veces**.
- Ritmo: 25 por minuto como máximo, por el cupo de 30 escrituras por minuto de la API.

Aceptación esperada: 4 de 44 (9%) medido, así que unos 11 de 126.

## Hallazgos para derivar

- **Veltron:** mapea el 184 "DEVOLUCIÓN ENTREGADA" a ENTREGADO y manda `fixy_entregado_gracias` a clientes cuyo paquete se devolvió. Es para Monta y va en el mismo mensaje.
- **salud-syncs:**
  - 11 guías tienen en Finanzas un 139 con **fecha futura**, del 24/10/2026 al 21/09/2027, todas a las 10:33, cargadas por Fixy alrededor del 21/09: #24246, 24237, 24482, 24418, 25224, 25401, 25380, 25366, 25547, 25478, 25834. El dato viene así de la API.
  - `runCourierSync` deja de consultar los envíos terminales (`devuelto`), así que la base **nunca ve el 184**: tiene 1 caso contra los 208 reales.

## Supuestos (fechados 29/09/2026)

- **Retorno:** el primer evento 139, 184 o 104 de `shipment_events` desde el 27/08 00:00 ART hasta hoy. Todas las guías Fixy, sin filtrar por producto ni por `cuotas_3`.
- **"Recibió la oferta":** alguna de las 3 plantillas `retorno_reenvio_*` en el log de Veltron (`ver_conversacion`, `ultimos:150`, bajado el 29/09; la conversación más larga tiene 91 mensajes), para ese pedido o sin número de pedido, desde la creación del pedido. `fixy_retornado_deposito` no cuenta como oferta: ninguno de los 126 la recibió.
- **"Volvió al depósito":** el 184 de la API de Fixy consultada el 29/09. No hay registro físico de recepción ni en la base ni en Stock.
- **`$costo_reenvio`:** la tabla de zonas de `cotizar_envio` al 29/09. Si Veltron cambia la tabla, el monto del flujo nativo va a diferir del CSV.
- La revisión del chat es manual y tiene criterio. El único caso dudoso (#24277: dijo "Cancelado" y después "lo espero") quedó en la tanda 2.
- Scripts: `f5-uni.sql`, `f5-fetch.mjs`, `f5-cp.mjs`, `f5-vp.mjs`, `f5-fixy.mjs`, `f5-an.mjs`, `f5-final.mjs`, todos en este scratchpad.
