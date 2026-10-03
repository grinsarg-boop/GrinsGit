# Comms de Fixy en Veltron: qué más, además del 142 y del `fx_suc`, le cuesta entrega COD (20/07 a 28/09/2026)

Medido el 29/09/2026. Todo fue de solo lectura: no se mandó ningún mensaje ni se tocó ningún flujo, plantilla o caso. Las citas están anonimizadas.

## TL;DR: ranking por puntos de entrega recuperables

Todo Fixy COD, todos los productos. Tasa sobre resueltos en cohortes maduras: **P** (20/07 a 16/08) 74,7% · **A** (17 a 23/08) 71,9% · **B** (24/08 a 13/09) **61,7%**. En B, **la mitad de las guías (50,7%) tiene alguna visita fallida**, así que cada punto de rescate vale ~0,5 pp de entrega.

| # | hallazgo | pp que recupera (sobre B) | costo | quién |
|---|---|---|---|---|
| 1 | **El circuito post-falla quedó sin nadie que lo cierre.** La intervención humana después de una falla cae de 44% (P) y 37% (A) a **9% (B)**, y el rescate baja de 37% y 33% a **26%**. Las derivaciones con respuesta humana en 72 h bajan de 70-80% a 46-56%. Los mensajes humanos en septiembre fueron 159, contra 470 en agosto, con 31% más de entrantes. | **+2 a +3 pp** (techo +3,4, que es volver al rescate de A) | una persona ~1-2 h/día: ~11 derivaciones más ~14 ráfagas post-falla por día, solo de Fixy | Pancho asigna (el operador de hoy es Carito); o ticket al dev de Veltron para empujar a Fixy |
| 2 | **El bot "deja registrado" un día u horario que Fixy nunca recibe.** Existe desde el 17/08 y crece con B. De los pedidos con nota `[coordinacion] reprogramar`, **se entrega el 41,5%** (n=41). Cuando el cliente pidió "después de las X", **el intento siguiente llegó antes de esa hora en 19 de 36 casos (53%)**: esos entregan 52,9%, contra 87,5% cuando se respetó. Solo el 17% muestra después una gestión de Fixy (183/117/144). | **+1,5 a +2 pp** | cambiar el texto del bot para que no prometa, más relay a Fixy (lo mismo que el #1) | dev de Veltron (prompt y relay) y la persona del #1 |
| 3 | **Las fallas 52, 48 y 63 no disparan ningún aviso.** Veltron solo mapea 127 y 51 a `REBOTADO_1`. Son el **21% de las guías de B**, entregan 31,5%, y en B el 0% recibió aviso. Con `fx_suc` prendido hoy, el 66% lo va a recibir vía el 135 (~5 h después). **El 34% restante sigue sin nada**, y la dirección (48, 11% de B) no tiene una plantilla propia. | **+0,3 a +0,7 pp** (solo si el #1 funciona) | ticket de mapeo más 1-2 plantillas (días de Meta) | dev de Veltron y Pancho |
| 4 | **El reenvío de retornados está muerto desde el 05/09.** Veltron dejó de ver el 139 del 27/08 al 21/09 (queda trabado en "Esperando Programación" = DESPACHADO). `retorno_reenvio_costo` salió solo en el backfill del 03-05/09 (74) y 1 vez después. De los 195 retornos de B, solo 4 recibieron la oferta. Con la oferta, la aceptación medida es 4 de 44 (9%). | ~2,5-3% de las guías de B como **ventas recuperadas** con guía nueva. **No mueve la tasa canónica.** Confianza baja (n=4) | ticket de refresh; reenvío único de la oferta (necesita el OK de Pancho) | dev de Veltron y Pancho |
| 5 | Clientes sin WhatsApp: todas las plantillas fallidas en el 2,1% de las guías maduras, que entregan 40% contra 67%. | +0,5 pp | llamarlos antes de despachar | persona |
| 6 | Caída del bot el **28/08 de 11 a 23 h**: 43 ráfagas y 39 sin ninguna respuesta. | ≤0,1 pp | alerta de uptime | dev de Veltron |
| 7 | `fixy_en_camino` tarde en las cohortes del 07/09 y del 14/09: p90 de 15 h, y en 7-9% llega después de la visita. | ~0,3 pp | — | salud-syncs |

**Corrección al marco de partida:** los ~4 pp de "rescate" no vienen del aviso apagado sino del circuito. Dentro de cada código de falla, el rescate con y sin aviso da parecido (127: 42% contra 38%; 48: 30% contra 30%). **Prender `fx_suc` solo vale ≤1 pp.** Lo que movía el rescate en P y A era que alguien contestara la respuesta del cliente y reagendara. En B el bot contesta "quedó registrado" y ahí termina el circuito. Los #1, #2 y #3 suman ~4-6 pp de techo, con sesgo de selección: lo tomaría como cota superior.

**Efecto colateral de hoy:** con `fx_reb` (127/51) y `fx_suc` (135) apuntando los dos a `fixy_visita_fallida`, **el 76% de las guías con 127 o 51 va a recibir la misma plantilla dos veces** (111 de 147 en B), con horas de diferencia.

## 1. Método y universo

- **Guías:** todas las de Fixy despachadas entre el 20/07 y el 28/09, sin `cuotas_3`, con la base `base.sql` (estado 41 con más de 7 días = no despachado, corrección del spam del 39). Son **1.279 guías y 1.204 teléfonos**. La semana sale del **evento 41** de Fixy, no de `dispatched_at`. Cohortes maduras hasta la semana del 07/09 (98-100% resuelto); las del 14/09 (82%) y el 21/09 (37%) quedan fuera de las tasas.
- **Mensajes:** `ver_conversacion` (`ultimos:150`; ninguna conversación llegó al tope, la mayor tiene 95). Se reusaron 657 teléfonos del informe anterior (bajados el 28-29/09) y se bajaron 547 el 29/09. Hay 10 teléfonos con menos de 10 dígitos, rechazados por Veltron. Quedan **1.267 guías con conversación**. La ventana va de la creación −2 h hasta +35 días o hasta el pedido siguiente del mismo teléfono (se corrigió para que el pedido propio de Veltron no corte la ventana).
- **Qué evento dispara cada plantilla**, inferido del retraso entre la plantilla y el primer evento de Fixy (el 0-3 h es el % de envíos que caen en ese rango):

| flujo | evento de Fixy | 0-3 h | mediana |
|---|---|---|---|
| `fx_camino` | **70** Ruteado | 86% | 0,9 h |
| `fx_reb` | **127** sin contacto | 90% | 0,7 h |
| `fx_reb` | **51** rechaza | 66% | 0,4 h |
| `fx_suc` | **135** reingreso a depósito | 98% | 0,6 h |
| `fx_ent` | **39** | 75% | 0,8 h |

  - `fx_desp` sale en el momento del `fecha_despacho` de Veltron, con 0 h de retraso. Ese momento cae entre 15 y 30 h después del 41 de Fixy: es la hora en que el equipo marca el pedido como despachado.
  - **52, 48 y 63 no disparan nada.**
- **Cambio de formato del log:** hasta ~02/08, Veltron guardaba los entrantes como `automatico` y a los humanos como `automatico|humano`. Desde agosto usa `texto` y `dashboard`. `vf-an.mjs`, del informe anterior, descartaba los entrantes `automatico`, así que **el "sin mensaje" de P quedó inflado** allí. Acá se corrigió.
- **Cap de 40 por corrida:** no traba. Hubo horas con 53-79 envíos de `fixy_despacho_seguimiento`, y la plantilla sale con 0 h de retraso respecto del despacho de Veltron. No hay cola.

## 2. Cobertura por regla y por semana (semana del 41)

% de las guías que tocaron el evento y recibieron la plantilla después del evento (mediana de horas):

| evento | 20/07 | 27/07 | 03/08 | 10/08 | 17/08 | 24/08 | 31/08 | 07/09 | 14/09* | 21/09* |
|---|---|---|---|---|---|---|---|---|---|---|
| confirmado → `pedido_confirmado_fixy` | 100 | 100 | 98 | 95 | 97 | 99 | 95 | 96 | 100 | 96 |
| despachado → `fixy_despacho_seguimiento` | 99 | **69** | 98 | 90 | 96 | 97 | 94 | 98 | 91 | 83 |
| 70 → `fixy_en_camino` | **23** | **42** | 92 | 88 | 93 | 90 | 92 | 84 (p90 15 h) | 85 (7,7 h) | 91 (7,3 h) |
| 127/51 → `fixy_visita_fallida` | **0** | **0** | 63 | 83 | 77 | 68 | 88 | 94 | 84 | 80 |
| **52/48/63 sin 127/51 → algún aviso** | 0 | 0 | 0 | 38 | 62 | **0** | **0** | **0** | **0** | **0** |
| 135 → `fixy_retiro_sucursal` | 0 | 0 | 6 | 73 | 81 | **1** | **0** | **0** | **0** | **0** |
| 139 → `fixy_retornado_deposito` / `retorno_reenvio_costo` | 57 | 65 | 82 | 60 | 13 | 5 | **0** | **0** | **0** | **0** |
| 39 → `fixy_entregado_gracias` | 99 | 91 | 97 | 86 | 92 | 89 | 92 | 90 | 88 | 96 |

\* inmaduras (solo cobertura).

- **n por semana**, para las fallas 52/48/63 sin 127/51: 13 · 15 · 12 · 8 · 39 · 40 · 35 · 42 · 20 · 23. Para el 139: 21 · 23 · 11 · 15 · 48 · 75 · 58 · 62 · 18 · 1.
- **Lectura:** aviso de confirmación 82-90% (desde el 03/08; julio no registraba "read"); de en camino 76-84%. **Fallidos** (sin WhatsApp o número roto): 1-7% por plantilla.
- **Qué pasó con 127/51 en la semana del 24/08 (68%):** los huecos se concentran en el **31/08** (4 de 13). En el resto de los días se ve el ~85% habitual. No es una regla apagada.

**Línea de tiempo (fechas en hora argentina, envíos reales en el log):**

| plantilla o mensaje | primer envío | último envío | nota |
|---|---|---|---|
| `fixy_retiro_sucursal` | **14/08** | **26/08** | cero desde entonces |
| `fixy_retornado_deposito` | 22/07 | **01/09** | `fx_ret` apagado |
| `retorno_reenvio_costo` | 03/09 | 05/09 | 16 + 56 + 2 de backfill; después 1 (21/09) |
| `retorno_reenvio_recordatorio` | 06/09 | 12/09 | y 1 el 25/09 |
| `retorno_reenvio_transferencia` | 16/09 | 16/09 | 1 solo |
| `fixy_visita_fallida` | **06/08** | sigue | coincide con la nota del vault del 05/08 |
| "Reminder: entrega hoy" (sistema, no es plantilla de flujo) | 20/07 | **01/08** | 26 "Recordatorio de entrega Fixy" el 03/08; `delivery_reminder_fixy` y `_v2` están APPROVED y nunca se cablearon |
| `fixy_en_camino` | antes del ~03/08 | sigue | cobertura baja en las cohortes del 20/07 y 27/07 |

**RETORNADO no detectado.** El estado en Veltron de las guías con 139 en Finanzas:

| período | total | `retornado` | `despachado` | `rebotado` |
|---|---|---|---|---|
| antes del 24/08 | 118 | 57 (48%) | 46 | 2 |
| desde el 24/08 | 212 | **38 (18%)** | **134** | 30 |

- En 156 casos, el último estado que ve Veltron es **42 "ESPERANDO PROGRAMACIÓN"**, que mapea a DESPACHADO: el estado retrocede y el 139 nunca entra. Ejemplo con `ver_pedido`: `fixy_estado: "ESPERANDO PROGRAMACIÓN"`, `comm_evento: DESPACHADO`, cuando Fixy ya lo había devuelto.
- **Por fecha del 139:** se detecta bien hasta el 26/08. Del **27/08 al 21/09** casi no se detecta (18 de 229, 8%). Desde el 22/09 vuelve en parte (24 de 43). Aun así, `retorno_reenvio_costo` no salió del 22 al 28/09.

## 3. Chats entrantes

**Por semana** (ráfaga = entrantes separados por menos de 15 min):

| semana | ráfagas | bot responde en <15 min* | sin respuesta en 24 h | derivaciones del bot | …con humano en 72 h | mediana de horas hasta el humano |
|---|---|---|---|---|---|---|
| 20/07 | 296 | 84 | 16 | 24 | 38 | 31 |
| 27/07 | 201 | 87 | 15 | 10 | 40 | 21 |
| 03/08 | 241 | 50 | 24 | 41 | **81** | 13 |
| 10/08 | 298 | 58 | 35 | 46 | 70 | 18 |
| 17/08 | 414 | 61 | 29 | 67 | 70 | 16 |
| **24/08** | 480 | 55 | 35 | 95 | **56** | 6 |
| **31/08** | 649 | 62 | 30 | 96 | **54** | 20 |
| **07/09** | 489 | 62 | 27 | 46 | **46** | 16 |
| 14/09 | 423 | 66 | 28 | 46 | **39** | 8 |
| 21/09 | 470 | 65 | 27 | 47 | 53 | 15 |

\* La baja de julio a agosto es de diseño: **desde agosto el bot no contesta acuses** ("gracias", "ok"), que responde 24-28% contra 84% en julio. En mensajes con contenido responde **75-100% por día**, salvo el 28/08. Las ráfagas sin respuesta en 24 h son sobre todo acuses y charla post-entrega. Las que tienen contenido (cancelar, reprogramar, dirección) quedan sin respuesta en 1-10% de los casos.

**Mensajes humanos a clientes del universo, por día:** 20-50 en la primera quincena de agosto. **Desde el 28/08, entre 0 y 21 y casi siempre menos de 10.** Por mes: 470 en agosto y 159 en septiembre, contra 2.102 y 2.754 entrantes.

**Bandeja hoy** (`listar_conversaciones`, 29/09): 195 derivadas con el bot apagado, de las cuales **190 no tienen operador asignado**. De esas, 10 son de Fixy, con esperas de 5 a 348 h. Hay 91 en error de envío (7 de Fixy). Los motivos de derivación más comunes, de todos los couriers:

| motivo | casos |
|---|---|
| `registrar_entrega` (retiro o cambio de dirección con el pedido en camino) | 43 |
| cancelar un pedido ya despachado | 18 |
| varios pedidos activos | 13 |

**Temas × entrega**, cohortes maduras (963 guías, 67,3%). Un pedido puede caer en varios temas.

| tema | % de guías | entrega | con humano en <24 h → entrega | sin humano → entrega |
|---|---|---|---|---|
| ningún mensaje | 28,7 | **57,2** | — | — |
| reprogramar ("no estoy", día u horario) | 17,3 | 57,5 | 46 | 63 |
| ¿cuándo llega? | 12,4 | 68,9 | 69 | 69 |
| medio de pago (QR, transferencia, tarjeta) | 11,7 | 76,1 | 75 | 77 |
| cancelar | 7,3 | **25,7** | 26 | 26 |
| dirección | 4,8 | 67,4 | 58 | 77 |
| "no me llamaron / no pasó" | 2,6 | 60,0 | 57 | 64 |
| "no lo pedí" | 1,0 | 40 | — | — |
| sin plata | 0,8 | 0 | — | — |

- Dentro de un mismo período, el humano **no** muestra más entrega: aparece en los casos difíciles, así que hay sesgo de selección. El efecto se ve **entre períodos**:

| tema | % de guías (P / A / B) | humano en 24 h (P / A / B) |
|---|---|---|
| reprogramar | 16 / 19 / 17,5 | 51 / 47 / **20** |
| medio de pago | 12 / 12 / 11 | 27 / 43 / **17** |
| ¿cuándo llega? | 13 / 13,5 / 12 | 19 / 43 / **20** |

- **Cancelar** entrega 26% haga lo que haga el equipo, y el **51 (rechaza)** rescata 0-10%. No son una palanca.

**Rescate después de la primera falla**, en B por código:

| primera falla | n | recibe aviso | escribe | humano | rescate |
|---|---|---|---|---|---|
| 127 sin contacto | 71 | 90% | 38% | 10% | 35% |
| 52 reprogramado por el comprador | 63 | 25% | 27% | **6%** (P 50, A 47) | 29% |
| 48 dirección | 57 | 11% | 32% | **9%** (A 41) | 26% |
| 51 rechaza | 40 | 75% | 20% | 13% | 0% |
| 63 zona peligrosa | 11 | 0% | 36% | 9% | 9% |

La composición de la primera falla cambia de P a B así: **52 pasa de 6,5% a 12,2%** de las guías, 48 de 4,7% a 11,1% y 127 de 9,0% a 13,8%.

## 4. Coordinaciones que el bot "registra" y no llegan a Fixy (nuevo)

Desde el **17/08**, el bot escribe en las notas del pedido de Veltron líneas como `[coordinacion DD-MM] reprogramar: sábado` o `franja horaria: después de las 17hs`. En el rango hay 242 notas: reprogramar 106, franja 99, referencia 20, cambio de dirección 13. Por semana del 41: 2 · 19 · 34 · 34 · 26 · 11.

- **Al cliente le dice que quedó agendado** (textual, anonimizado):
  - "Perfecto, te lo dejo registrado para que el repartidor pase el dia 4". Fixy marca **52 "Reprogramado por el comprador" 5 h después**. No entregado.
  - "Perfecto, lo dejo anotado para el sabado entonces". Fixy visita antes: 52. No entregado.
  - "Si, ya lo tengo registrado para el viernes, tranqui". Visitan ese mismo día: 52. No entregado.
  - "Dale, anoto que la entrega sea el viernes a la noche, hasta las 8". El cliente había pedido el miércoles. 127. No entregado.
- **No hay rastro de que llegue a Fixy:** solo el 17% de las guías con nota tiene después un 183, 117 o 144 de Fixy.
- **Resultado por guía** (maduras):

| tipo de nota | n | entrega |
|---|---|---|
| reprogramar | 41 | **41,5%** (36 sin humano: 38,9%) |
| franja | 43 | 72% |
| referencia | 9 | 89% |
| cambio de dirección | 8 | 88% |

- **Franja con hora explícita:** de 36 casos con un intento posterior, **en 19 (53%) el intento fue antes de la hora pedida**. Entregan 52,9%, contra 87,5% de los 17 que se respetaron.
- **Pedidos de reprogramar antes de la primera visita**, por período:

| período | % de guías | entrega |
|---|---|---|
| P | 10,5 | 65,5 |
| A | 8,2 | 64,3 |
| B | **13,6** | **52,9** |

  - En B, el bot "anota" en 36 de 70 casos (55,6% entregado). Deriva en 12 (66,7%). Responde otra cosa en 10 (30%). Contesta un humano en 7 (42,9%).
  - **De las 63 primeras fallas 52 de B, 15 (24%) tenían una nota del bot con fecha igual o anterior a la falla.** Es decir, parte de la suba del 52 (6,5% → 12,2% de las guías) es un reagendamiento que el cliente cree hecho y el courier desconoce.

Estimación del #2: llevar a los que piden reprogramar en B al 65% de P y A da +1,6 pp. La franja respetada suma ~+0,5 pp. Parte se superpone con el #1: en los dos casos hace falta alguien que cargue la gestión en Fixy.

## 5. Estado del bot

- **Caída clara el 28/08, desde las 11 h hasta el cierre del día.** Respondió 0 de 32 ráfagas no derivadas. Quedaron 43 ráfagas y 39 sin respuesta de nadie, en 36 guías, de las que 5 no se entregaron. El 29/08 respondió de forma irregular.
- Hay días flojos, sin caída entera: el 23/08, sobre todo a las 20-21 h (7 de 24), y el 24/07.
- **La semana del 24/08, la peor, no coincide con una caída del bot** salvo el 28/08. La correlación está con la **caída de la atención humana desde el 28/08**, no con el bot.
- El estado actual de cada conversación (`bot_activo`) no guarda historial. Las pausas se infieren de las derivaciones.

## 6. Ranking de arreglos (detalle)

1. **Cerrar el circuito post-falla y de derivaciones (+2 a +3 pp).**
   - Una persona con cupo diario para las derivaciones de Fixy (~11 por día) y las respuestas post-falla (~14 ráfagas por día). Su tarea es cargar la reprogramación o la corrección en Fixy, en el portal o con una llamada a operativa.
   - Métrica de control: humano post-falla ≥35% y rescate ≥32%.
   - Sin esto, el aviso de `fx_suc` abre conversaciones que nadie cierra.
2. **Que el bot no prometa lo que no ejecuta (+1,5 a +2 pp).**
   - Cambiar el texto: en vez de "quedó registrado para el viernes", "le paso al equipo tu día para que lo cargue con Fixy; te confirmo cuando esté".
   - Y que cada nota `[coordinacion]` **dispare una derivación** a la cola del #1. Hoy queda en la nota y el bot sigue activo.
   - Ideal (dev): que Veltron empuje la nota a Fixy por API.
3. **Mapear 52, 48 y 63 a un evento de rebote (+0,3 a +0,7 pp).**
   - Pedido al dev: el mismo patrón que Urbano (`REBOTADO_2` con plantillas por motivo), con una plantilla de dirección del tipo `urbano_rebote_direccion` para el 48.
   - Resolver el doble envío de `fixy_visita_fallida` (`fx_reb` + `fx_suc`). Opciones: apuntar `fx_suc` a otro texto o dejar `fx_suc` solo para las guías sin 127 o 51, si el motor admite condiciones (`condiciones[]` existe y hoy está vacío en todos).
4. **Reenvío de retornados** (ventas recuperadas, no tasa canónica).
   - Ticket de refresh: que el 42 no haga retroceder el estado y que el 139 entre.
   - Decidir si se reenvía la oferta a los ~190 retornos de B que no la recibieron. Es una acción de escritura: requiere el OK de Pancho. Aceptación medida: 4 de 44.
5. **Llamar antes de despachar** a los pedidos cuyas plantillas fallan (+0,5 pp).
6. **Alerta de caída del bot**, por el 28/08.
7. **`en_camino` tarde** en las cohortes del 07/09 y del 14/09: va a salud-syncs.

## 7. Calidad de lead por anuncio (16/08 a 28/09)

**Universo:** pedidos Fixy COD despachados, creados entre el 16/08 y el 28/09, con conversación: **959**. El anuncio sale de `ad_id_atribuido()` (migración 076) contra `ad_spend`. Hay 807 atribuidos y 152 sin anuncio. Hay 14 anuncios con n≥20, que cubren 736 pedidos. "Activo" significa gasto >0 en `v_ad_spend` en los últimos 3 días. La entrega se toma solo de las cohortes maduras: 656 pedidos, 63,7%. La "esperada" es el promedio de la celda semana (41) × zona (CABA/GBA) × producto de ese anuncio: sirve para separar el ruido del courier.

**Totales:**
- confirma en <24 h: 27%
- responde en <1 h: 31,4%
- silencio: 30,8%
- cancelar: 8,6%
- "no lo pedí" o desconfianza: 2,1%
- precio o pack: 2,6%
- "llega hoy": 1,8%
- dirección o teléfono en el chat: 1,4%
- 51 rechaza: 7,5%
- lead negativo (cancelar, no lo pedí, precio o pack, o 51): 16,6%

Anuncios ordenados de peor a mejor lead negativo:

| anuncio | activo | n | responde en <1 h | silencio | cancelar | no lo pedí / desconfía | precio o pack | 51 | lead neg. | cancelados antes de despachar | n mad. | entrega | esperada | residuo | no entregados del lado lead |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cxr-cv01-natures-01-naturessunrise-5000-mix-base-**v02** | sí | 54 | 22 | 32 | **13** | **7,4** | 3,7 | 9 | **22,2** | 1 | 36 | 58,3 | 62,1 | −3,8 | **60%** |
| cbo-cv02-pureza-02-…-angv01-foto-base-v01 | sí | 23 | 26 | 30 | 13 | 4,3 | 0 | 4 | 21,7 | 1 | 19 | 63,2 | 62,6 | +0,6 | 29% |
| pureza-02-foto-hotsale-v03 (reuse) | no | 70 | 34 | 27 | 11 | 0 | **5,7** | 6 | 18,6 | 5 | 43 | 67,4 | 61,6 | +5,8 | 36% |
| (sin anuncio) | — | 152 | 34 | 28 | 8 | 2,6 | 5,3 | 6 | 18,4 | 10 | 106 | 69,8 | 65,0 | +4,8 | 44% |
| cbo-cv01-natures-01-angv02-video-base-v03 | sí | 68 | **19** | **42,6** | 6 | 1,5 | 0 | 12 | 17,6 | 4 | 50 | 58,0 | 59,8 | −1,8 | 38% |
| cxr-cv01-natures-01-naturessunrise-5000-mix-base-v01 | sí | 69 | 35 | 32 | 12 | 1,4 | 0 | 12 | 17,4 | 5 | 42 | 52,4 | 60,7 | −8,3 | 25% |
| pureza-02-mix-base-v02 (reuse sinx1) | sí | 23 | 30 | 30 | 4 | 0 | 0 | 13 | 17,4 | 1 | 18 | 61,1 | 62,6 | −1,5 | 57% |
| pureza-02-mix-base-v02 (reuse volumen) | sí | 72 | 35 | 28 | 6 | 1,4 | 1,4 | 10 | 16,7 | 7 | 54 | 57,4 | 62,4 | −5,0 | 35% |
| beevenom-Foto-E3Santi-fixy | sí | 31 | 29 | 19 | 3 | 6,5 | 6,5 | 6 | 16,1 | 0 | 18 | 66,7 | 72,3 | −5,6 | 33% |
| cxr-cv01-natures-01-naturessunrise-5500-foto-base-v03 | sí | 63 | 37 | 24 | 11 | 3,2 | 0 | 8 | 15,9 | 0 | 33 | 69,7 | 63,7 | +6,0 | 40% |
| pureza-montaje-M5 | sí | 20 | 40 | 30 | 5 | 0 | 0 | 10 | 15,0 | 0 | 16 | 62,5 | 62,8 | −0,3 | 33% |
| abo-cv01-pureza-02-…-angv01-mix-base-v01 | sí | 37 | 19 | 32 | 8 | 0 | 2,7 | 0 | 10,8 | 1 | 32 | 65,6 | 59,4 | +6,2 | 0% |
| cbo-cv01-natures-01-angv01-video-base-v02 | sí | 28 | 32 | 29 | 7 | 3,6 | 0 | 4 | 7,1 | 1 | 22 | **50,0** | 63,4 | **−13,4** | 9% |
| cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open | sí | 26 | 39 | 35 | 4 | 0 | 0 | 4 | 3,8 | 0 | 17 | **88,2** | 60,3 | **+27,9** | 50% |

Nota: los anuncios "natures-01-naturessunrise" cuelgan de campañas de Pureza (`product_id` 1). Es el nombre del creativo, no otro producto.

**Anuncio contra courier:**
- De los 238 no entregados maduros, **solo el 34,5% tiene una señal del lado del lead** (pidió cancelar, "no lo pedí", precio o pack, o 51). **El 65,5% es falla en la puerta sin señal del cliente.** La mayor parte de la no-entrega es ruido del courier y del circuito, no del anuncio.
- **Ningún anuncio es significativamente peor en lead negativo** (z máximo +1,1). Con n de 20 a 70, las diferencias de 3 a 5 pp son ruido.

**Señales propias del anuncio** (promesa que la conversación desmiente):
- **cxr-cv01-natures-01-naturessunrise-5000-mix-base-v02** (activo): **"no lo pedí" o desconfianza en 7,4%**, contra 2,1% (z≈2,7), y cancelar 13%. El 60% de sus no entregados es del lado del lead. Citas: "Hola, yo no hice ningún pedido", "Yo no pedí nada" (varios), "No voy a caer en su estafa". **Es el peor lead.** Hipótesis a verificar: pedidos de baja intención o hechos sin querer desde el formulario de ese creativo.
- **cbo-cv01-natures-01-angv02-video-base-v03** (activo): **42,6% de silencio**, contra 30,8% (z 2,1), y la menor respuesta en <1 h (19%). Su entrega (58%) está en línea con lo esperado (60%): el silencio no le cuesta más de lo normal por ahora.
- **Precio o pack ("2×1", "decía 39.990")**, repartido entre anuncios de Pureza, con el pico en hotsale-v03, que está inactivo (5,7%). Citas: "En el face decía 2 x 1 sería así", "La promoción decía 2×1", "El precio decia 39.990". Un caso en angv04: "por lo que leí en el anuncio llegaba en 72 hs". Es chico: 2,6% de los pedidos.
- **beevenom-Foto-E3Santi-fixy** (activo): quejas **después de la entrega** ("Estafadores", "me mandaron uno trucho", "pedí dos aerosol que era la promo 2x1 y me mandan dos spray"). No le cuesta entrega COD: es riesgo de devolución y de reputación por la expectativa del creativo.

**Ruido del courier, no del anuncio:** **cbo-cv01-natures-01-angv01-video-base-v02** entrega 50%, contra 63% esperado (−13,4, z −1,3). Pero el 91% de sus no entregados no tiene señal del cliente, y el lead negativo es de apenas 7,1%. El residuo es de la puerta.

**El mejor:** **cbo-cv03-pureza-02-purezadrops-m5iter-estatica-a2-v01-open**, con 88%, contra 60% esperado (z +2,4), y 3,8% de lead negativo. Todavía tiene n chico (17 maduras).

## 8. Qué derivar

- **Dev de Veltron**, en un solo ticket:
  - refresh de Fixy: el 42 hace retroceder el estado a DESPACHADO y el 139 no entró del 27/08 al 21/09;
  - mapear 52, 48 y 63 a rebote;
  - que las notas `[coordinacion]` deriven al equipo o se empujen a Fixy;
  - el doble envío `fx_reb` + `fx_suc`;
  - alerta de caída del bot (28/08);
  - por qué `retorno_reenvio_costo` no sale desde el 05/09 aunque del 22 al 28/09 Veltron detectó 24 retornos;
  - la key sin `casos:read` impide medir el backlog de tickets.
- **Pancho:** cupo humano diario para la cola de Fixy (#1) y decisión sobre reenviar la oferta a los retornos de B.
- **analista de pauta:** revisar el formulario o el creativo de `cxr-…-5000-mix-base-v02` por el "no lo pedí".
- **salud-syncs:** el retraso de `en_camino` en las cohortes del 07/09 y el 14/09. Las 14 guías entregadas que quedaron en 127 ya estaban derivadas en `fixy-entrega.md`.

## Supuestos (fechados)

- **Rango:** mensajes del 20/07 al 28/09/2026. Tasas solo de cohortes maduras por semana del evento 41 (hasta la del 07/09, 98-100% resuelto). Quedan fuera las del 14/09 (82%), 21/09 (37%) y 28/09 (4%). Canon: tasa sobre resueltos (migración 067; estado 41 con más de 7 días = no despachado), madurez ≥90% (canon del 13/08/2026), con la corrección del spam del 39.
- **Cortes:** Fixy COD, todos los productos (Pureza 77%, BeeVenom 18%), sin `cuotas_3`. Zona CABA/GBA solo en la sección de anuncios. Períodos P = 20/07 a 16/08, A = 17 a 23/08, B = 24/08 a 13/09.
- **Fuentes:**
  - Finanzas (`shipments` y `shipment_events`, leídos el 29/09).
  - MCP de Veltron, solo lectura: `ver_conversacion`, `ver_flujos_comms`, `listar_plantillas`, `listar_conversaciones`, `ver_pedido` ×3. La bandeja se leyó el 29/09 ~03 h.
  - Los flujos son el config de hoy (con `fx_suc` ya prendido). Lo histórico se reconstruyó con los envíos reales del log.
- **Clasificación:** regex, no NLP. Ráfaga = entrantes a menos de 15 min. "Humano" = saliente `dashboard` o `humano` que no es plantilla. "Derivación" = mensaje del bot con "equipo" y pasar, derivar o coordinar.
- **Inferencias no confirmadas con el dev:** el mapeo evento→código de Fixy (por retraso) y que las notas `[coordinacion]` no se empujan a Fixy (por ausencia de 183/117/144 y por intentos fuera de franja).
- **Estimaciones:** comparan períodos y tienen sesgo de selección. Usarlas como cota superior.
- **Sin acceso:** `listar_casos` (falta `casos:read`); 10 teléfonos con menos de 10 dígitos.
- **Archivos en el scratchpad** (los crudos tienen datos personales y no salen de ahí):
  - crudos: `cf-universo.json`, `cf-conv.json`, `cf-bursts.json`, `cf-franja.json`, `cf-bandeja.json`, `cf-ads.json`, `cf-prov.json`;
  - agregados: `cf-out.json`, `cf-ads-out.json`, `cf-ads-comp.json`;
  - scripts: `cf-lib.mjs`, `cf-an.mjs`, `cf-map.mjs`, `cf-notas.mjs`, `cf-notas2.mjs`, `cf-franja.mjs`, `cf-extra.mjs`, `cf-sinresp.mjs`, `cf-ads.mjs`, `cf-fetch.mjs`, `cf-bandeja.mjs`, `cf-uni.sql`, `cf-ads.sql`.
