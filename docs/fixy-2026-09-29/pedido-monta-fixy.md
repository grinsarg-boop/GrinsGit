# Pedido para Monta: avisos de Fixy en Veltron (29/09/2026)

Datos medidos sobre los envíos reales y los eventos de Fixy, del 20/07 al 28/09/2026.

## 0. Key de la API (esto destraba todo lo demás)
La key que usamos (`vk_…`) devuelve **403 "Se requiere rol admin del tenant"** en `crear_plantilla` y en `asignar_plantilla_flujo`. Además no tiene `casos:read`.
**Pedido:** una key con rol admin + `casos:read`, o agregarle esos permisos a la actual.

## F4. Avisos de visita fallida

### 4.1 Doble envío de `fixy_visita_fallida`
- `fx_reb` (REBOTADO_1) y `fx_suc` (EN_SUCURSAL) tienen hoy la **misma** plantilla, `fixy_visita_fallida`.
- ~76% de las guías con falla 127/51 pasan por los dos eventos, así que el cliente recibe el mismo mensaje dos veces.
- **Pedido:**
  1. Crear la plantilla `fixy_segundo_contacto` (UTILITY, es_AR, variables `cliente_nombre`, `$order`). Texto:
     > Hola {{1}}, tu pedido {{2}} sigue guardado en Fixy para volver a pasar 📦 Respondé este mensaje con el día y la franja que te quedan mejor, y si cambió algo de la dirección o el teléfono contanos acá. El equipo lo coordina con Fixy y te confirma.
  2. Asignarla a `fx_suc` en lugar de `fixy_visita_fallida`.
  3. Si el motor lo permite, usar `condiciones[]` para que `fx_suc` salga solo si `fx_reb` no mandó nada en las últimas 24 h, o darle `delay_horas: 24`.

### 4.2 Fallas que no reciben ningún aviso: 52, 48 y 63
- Las guías con 52 ("Reprogramado por el comprador"), 48 (dirección) o 63, sin 127/51, recibían algún aviso en el 38-62% de los casos en las semanas del 10/08 y del 17/08. **Desde la semana del 24/08, en el 0%.** Son 35-42 guías por semana.
- Aun con `fx_suc` prendido, ~34% de estas guías sigue sin aviso.
- **Pedido:** mapear en `carrier_status` de Fixy:
  - **52 y 63 → REBOTADO_1**, para que les llegue `fixy_visita_fallida`.
  - **48 → un evento de rebote con condición de dirección**, con una plantilla que pida la dirección: el mismo patrón que `urbano_rebote_direccion` en Urbano.

### 4.3 (Consulta) Recordatorio del día de entrega
- El mensaje de sistema "Reminder: entrega hoy" salió del 20/07 al **01/08** y después se cortó (26 "Recordatorio de entrega Fixy" el 03/08).
- `delivery_reminder_fixy` y `delivery_reminder_fixy_v2` están APPROVED y nunca se cablearon.
- **Pregunta:** ¿por qué se cortó el recordatorio? ¿Veltron le empujaba a Fixy la confirmación del cliente? Estamos investigando el evento 142 "CONFIRMACION EXTERNA" de Fixy: cayó de ~25% a 4,5% de las guías justo con la baja de entrega.

## F5. Retornos

### 5.1 El estado retrocede y el retorno no se detecta
- El evento de Fixy **42 "ESPERANDO PROGRAMACIÓN" mapea a DESPACHADO** y pisa estados posteriores. Hay **156 guías que Fixy ya devolvió y que Veltron muestra como `despachado`**. Por ejemplo, un `ver_pedido` da `fixy_estado: "ESPERANDO PROGRAMACIÓN"`, `comm_evento: DESPACHADO`.
- El **139 (retornado) casi no entró del 27/08 al 21/09**: 18 de 229 (8%). Desde el 22/09 entra en parte: 24 de 43.
- Guías con 139 que Veltron ve como `retornado`: 48% antes del 24/08, **18% desde el 24/08**.
- **Pedido:**
  1. Que los estados **no retrocedan**: un 42 después de un rebote o un retorno no puede volver el pedido a DESPACHADO.
  2. Que el 139 siempre gane y sea terminal.
  3. Re-sincronizar los estados de Fixy desde el 24/08.

### 5.2 `retorno_reenvio_costo` no sale
- Hubo envíos reales el 03-05/09 (16 + 56 + 2 de backfill), 1 el 21/09 y **ninguno del 22 al 28/09**, aunque en esos días se detectaron 24 retornos.
- **Pedido:** revisar por qué no dispara `fx_ret_costo`: condiciones, cupo (`campana_cupo_por_corrida` = 20) o algo del flujo de campaña.
- Además, `fx_ret` (RETORNADO → `fixy_retornado_deposito`) está apagado desde el 01/09. ¿Es a propósito, porque lo reemplazó `retorno_reenvio_costo`?

### 5.3 Envío manual de la oferta a los retornos atrasados
- Vamos a mandar a mano (`enviar_plantilla` con `pedido_id` y `carrier`) la oferta de reenvío a los ~190 retornos de Fixy que no la recibieron.
- **Pregunta:** ¿un envío manual queda enganchado a `fx_ret_costo_2` (recordatorio) y a `fx_ret_transf`? ¿O conviene que lo corras vos como backfill en modo `run` sobre esos pedidos?

## F3. Alta de guías en Fixy (pregunta)
El evento 142 de Fixy dejó de dispararse cuando el paquete entra al depósito, entre el ingreso del **26/08 (~13 h)** y el del **15/09**: 0 de 515 guías. Antes aparecía en el ~20% y volvió el 16/09 a las 14:07. El corte coincide con las altas de la noche del 25 al 26/08.
**Pregunta:** ¿cambió algo entre el alta del 24/08 a la noche y la del 26/08 ~01 h, o alrededor del 15/09, en lo que Veltron manda a `guias.json` de Fixy (formato de `celular`, email, `comprador[horario]`, `observaciones`) o en el webhook de estados de Fixy (`integracion.json`)?

### 5.4 El 184 de Fixy mapea mal, y 126 retornos esperan la oferta
- Fixy **184 "DEVOLUCIÓN ENTREGADA"** mapea hoy a **ENTREGADO**. Veltron ya les mandó `fixy_entregado_gracias` a 5 clientes cuyo paquete había vuelto: 4 por el 184 y 1 por el 140.
- **Pedido:** mapear el **139 y el 184 → RETORNADO**, y el 140 revisarlo.
- Hay **126 retornos** con el paquete ya en depósito que nunca recibieron la oferta. Tenemos la lista de `pedido_id`. Solo 8 están hoy en RETORNADO en Veltron.
- **Pedido:** pasar esos 126 a RETORNADO y correr `fx_ret_costo` nativo, para que queden enganchados al recordatorio de 72 h, a la transferencia de 48 h y al bot del reenvío. Después, 56 más a medida que entre el 184.
