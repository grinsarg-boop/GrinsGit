# Fixy: el evento 142 y qué cambió entre el 10 y el 31/08 (medido el 29/09/2026, solo lectura)

## TL;DR

1. **Hay un registro de cambio, y es del lado de Fixy o del alta, no del volumen.**
   - Un 142 "temprano" es el que aparece después del 129 EN DEPOSITO y antes del ruteo. Hasta el 25/08 lo tenía el **~20% de las guías cada día**, en todas las zonas.
   - Desde el ingreso a depósito del **26/08 (13 h)** hasta el del **15/09** inclusive, cae a **0 de 515 guías**. Vuelve el **16/09 a las 14:07** (8 de 24 guías ese día) y se sostiene en 17-20%.
   - El último antes del corte es del 25/08 a las 20:20.
   - Es un apagado y prendido, no una erosión: el día anterior al corte dio 25% y el siguiente 0%.
2. **Cayó parejo en todo:**
   - por zona: CABA 28,9 → 2,0 · Norte 18,3 → 0 · Oeste 21,7 → 0 · Sur 18,4 → 0 · La Plata y el resto → 0;
   - por producto, pack, monto COD, medio de pago (efectivo o QR) y día de la semana.

   Es un cambio de proceso, no de algunas zonas, repartidores u horarios.
3. **Qué es el 142**, según la forma de los datos:
   - Aparece a una **mediana de 12 minutos del 129**, nunca antes de 1 minuto, con cola hasta la noche (17 a 22 h).
   - En un 20% al azar, y con el detalle "MODIFICACION EXTERNA".
   - Esa forma es la de **una persona respondiendo un aviso** que se dispara cuando el paquete entra al depósito. No parece un proceso automático.
   - **Durante el apagón el 142 siguió apareciendo, pero solo 2 a 30 minutos después de una visita fallida** (52, 127, 51, 183: 20 casos). El estado funcionaba. Lo que se cortó fue el disparo al ingresar al depósito.
4. **La pista (a), nuestro recordatorio, queda descartada:**
   - el 142 cae **antes** de nuestro recordatorio en el 90% de los casos (mediana 6,7 h antes);
   - siguió en 15-34% del 03/08 al 25/08, cuando el recordatorio ya no salía;
   - solo 10 de 179 tienen un mensaje del cliente con nosotros ±30 minutos alrededor.

   **La (b), un aviso propio de Fixy, calza en la forma pero no en la fecha:** el corte es el 26/08, no el 17/08 (FIXYPAY QR). Del 18 al 25/08 el 142 estaba en 18-29%.
5. **El volumen no lo explica.**
   - Del 17 al 25/08 hubo días de 62-64 guías con el 142 intacto (18%) y entrega de ~70%.
   - En el corte, los días de mucho volumen entregan **más** (63,1) que los de poco (57,4).
   - Los proxies de saturación (fallas sin detalle, menciones de llamada, intentos por guía) no se mueven.
6. **Cuánto pesa, con honestidad: el 142 es un marcador fuerte, pero no toda la caída.**
   - Antes del corte, las guías con 142 entregan 86,5% y las sin 142, 69,1%.
   - A edad fija (D+7 del 129): jul-ago 72,9 → corte 61,2. Pero **las que nunca tuvieron 142 también caen** (70,7 → 61,1).
   - Con el 142 de vuelta (16 al 22/09, n=110) da 63,6, no 72.
   - CABA perdió el 142 y no cayó (n=50).
   - El canal del 142 vale entre ~2 pp (lo que se ve con la vuelta) y ~5 pp (cota superior). El resto de los ~11 pp está en otro lado. Los candidatos son los de los informes previos: la demanda de Pureza en provincia de Buenos Aires, que cae también en Urbano, y el circuito humano post-falla, que se cae desde el 28/08.
7. **De nuestro lado no hay ningún cambio en la fecha del corte que alcance a todas las guías.** Queda un punto ciego: el alta la hace **Veltron** (`generar_etiqueta`, 41 "INGRESO POR API") y no vemos qué payload le manda a Fixy. Las altas que perdieron el 142 son las de la noche del 25 al 26/08 (~01 h), y las que lo recuperan, las de la noche del 15/09. **No se puede separar "cambió el alta" de "cambió el depósito de Fixy"**, porque todas las guías entran al depósito al día siguiente del alta. Hay que preguntarle a los dos.

## 1. Caracterización del 142

**Universo:** guías Fixy COD sin `cuotas_3`, con ingreso a depósito (129) desde el 20/07. Eventos `via` en api o fixy-api, sin duplicados por código y hora. En total hay 391 eventos 142 en 359 guías desde junio. El detalle es "MODIFICACION EXTERNA" en 479 casos y "ELIMINA DE PLANILLA" en 7 (4 en el rango, se excluyen).

**Momento** (n=180, guías con 142 del 20/07 en adelante):

| referencia | posición | mediana | p25 a p75 |
|---|---|---|---|
| alta (41) | 100% después | +20,1 h | 17 a 39 h |
| ingreso a depósito (129) | 100% después | **+0,2 h (12 min)** | 0,1 a 8,2 h |
| primer ruteo (70) | 79% antes | −10 h | |
| primera visita | **133 antes, 35 después, 12 sin visita** | −23 h | |

- **Evento previo:** 129 en 143 casos, 52 en 18 y 127 en 8.
- **Evento siguiente:** 70 en 140 casos y 135 en 18.
- **Lag 129 → 142, en minutos:**

  | 0-1 | 1-3 | 3-6 | 6-10 | 10-20 | 20-40 | 40-60 | 1-3 h | 3-10 h | >10 h |
  |---|---|---|---|---|---|---|---|---|---|
  | 0 | 1 | 14 | 19 | 38 | 30 | 16 | 47 | 52 | 7 |

- **Hora (ART):** pico de 13 a 16 h (14 h: 63 de 180), con cola de 17 a 22 h. El 129 cae siempre a las 13-14 h, escaneado en tanda (~8 guías por minuto).
- **Día de la semana:** lunes 50 · martes 32 · miércoles 40 · jueves 25 · viernes 28 · sábado y domingo 5. La tasa por día del 129 es plana (18-25%).

**Reparto antes del corte** (129 del 20/07 al 25/08), % con 142 temprano:
- **Zona:** CABA 28,3 · GBA con cobertura 19,1 · fuera de cobertura 13,9.
- **Cordón:** Norte 18,0 · Oeste 18,6 · Sur 21,0 · La Plata 7,1 (n=14).
- **Producto:** Pureza 21,4 · BeeVenom 18,6 · Natures 15,8.
- **Pack de Pureza:** pk2 22,5 · pk3 17,9.
- **COD:** menos de 45k 14,7 · 45-55k 20,7 · 55k o más 18,1.
- **Medio de pago en Veltron:** efectivo 19,4 · QR MP 21,4. Todas las guías son COD.
- **Durante el corte:** 0,0-0,2% en todas las celdas. **Después de la vuelta:** 16-22% en todas.

**Por semana** (semana del 41; tasa canónica sobre resueltos, con la corrección del spam del 39):

| semana | desp | % 142 | % 142 al ingreso | tasa | % resuelto | Pureza % 142 | Pureza tasa | tasa con 142 | tasa sin 142 |
|---|---|---|---|---|---|---|---|---|---|
| 20/07 | 91 | 22,0 | 20,9 | 76,9 | 100 | 40,0 | 75,0 | 85,0 (20) | 74,6 |
| 27/07 | 77 | 24,7 | 24,7 | 70,1 | 100 | 27,8 | 77,8 | 73,7 (19) | 69,0 |
| 03/08 | 50 | 34,0 | 30,0 | 78,0 | 100 | 35,9 | 79,5 | 82,4 (17) | 75,8 |
| 10/08 | 61 | 14,8 | 9,8 | 73,3 | 98,4 | 14,0 | 74,0 | 88,9 (9) | 70,6 |
| 17/08 | 174 | 23,6 | 19,0 | 71,3 | 100 | 24,8 | 73,0 | 90,2 (41) | 65,4 |
| **24/08** | 202 | **3,5** | 2,5 | **61,4** | 100 | 2,4 | 58,5 | 71,4 (7) | 61,0 |
| 31/08 | 164 | 3,0 | 0,0 | 63,4 | 100 | 2,9 | 60,9 | 60,0 (5) | 63,5 |
| 07/09 | 157 | 7,0 | 0,6 | 59,7 | 98,1 | 7,8 | 58,7 | 72,7 (11) | 58,7 |
| 14/09* | 143 | 16,8 | 14,0 | (78,0) | 86,0 | 18,0 | (75,0) | | |
| 21/09* | 138 | 19,6 | 17,4 | (90,7) | 39,1 | 19,8 | | | |

\* Inmaduras, por debajo del 90% resuelto: se excluyen de la tasa y se leen infladas. Coincide con `fixy-entrega.md` (71,3 → 61,4 → 63,4 → 59,7).

- **Qué aparece en su lugar en las guías sin 142:** nada. Entre el 129 y el primer 70, 965 de las 1.099 guías sin 142 no tienen ningún evento: pasan directo de depósito a ruteo. No hay código sustituto.
- **Lo único que sube en el corte** es el 42 "Esperando Programación" (23-30% → 37-43% de las guías). Pero va después de las fallas (48 > 42 > 139), así que es consecuencia, no reemplazo.
- **Perfil de fallas antes del corte**, con 142 contra sin 142:

  | código | con 142 | sin 142 |
  |---|---|---|
  | rechazo (51) | 3,8% | 11,2% |
  | sin contacto (127) | 6,7% | 11,4% |
  | reprogramado (52) | 6,7% | 10,0% |
  | dirección (48) | 8,7% | 9,7% |
  | no geolocalizada (145) | 0% | 2,1% |
  | entrega en la primera visita | 73,1% | 57,7% |

  → No es una validación de domicilio: es un destinatario que **confirmó que lo espera**.

## 2. Volumen y saturación

- **Guías por día de ingreso a depósito:** del 20/07 al 16/08 una media de 17,3 · del 17 al 25/08, 32,7 · en el corte (26/08 a 15/09), 34,3 · desde el 16/09, 26,3.
- **Período × volumen del día**, tasa sobre resueltos y % de 142 temprano:

  | período | volumen del día | tasa | % 142 |
  |---|---|---|---|
  | 17-25/08 | menos de 25 | 72,9 | 21,4 |
  | 17-25/08 | 45 o más | 69,8 | 18,3 |
  | corte | menos de 25 | 57,4 | 0 |
  | corte | 25-44 | 62,4 | 0 |
  | corte | 45 o más | 63,1 | 0,5 |

- **El 142 desaparece igual en días chicos**, por ejemplo el 27/08 con 21 guías.
- **Proxies de saturación (primera falla):**

  | período | sin detalle | menciona llamada o WhatsApp | salidas a reparto por guía | mediana 129 → primera visita |
  |---|---|---|---|---|
  | 20/07 a 16/08 | 46,2% | 5,8% | 1,28 | 23,9 h |
  | 17 a 25/08 | 51,3% | 3,9% | 1,52 | 23,9 h |
  | corte | 48,4% | 7,7% | 1,41 | 25,1 h |

  Fixy no expone un ID de repartidor, así que "repartidores nuevos" no se puede medir.
- **Veredicto:** no hay firma de saturación. El salto de volumen es del 17/08 y la caída arranca el 26/08, en días de volumen alto y bajo por igual.

## 3. Cambios nuestros del 10 al 31/08

**Repo (`git log` del 10 al 31/08, 40 commits):**

| fecha | commit | qué | ¿toca lo que Fixy recibe? |
|---|---|---|---|
| 13/08 | `f00e88b`, `4ebe80c` | el sync guarda el historial completo; `dispatched_at` en ART | No: es lectura |
| **17/08 22:40** | `6fa95c1` | recorte 10×15 de la etiqueta FIXYPAY QR en el preparador | Solo cómo se imprime. Recorta al borde que dibuja Fixy y no pierde contenido. **El 142 siguió del 18 al 25/08 → descartado** |
| 22/08 | `4a6f3f2` | un 404 por guía ya no marca el conector como caído | No: es lectura |
| 23 al 31/08 | — | ningún commit sobre Fixy, despacho ni etiquetas | — |

- **El alta de guías normales no la hace el repo:** la hace Veltron con `generar_etiqueta` (API de Fixy, 41 "INGRESO POR API" en el 100% de las semanas).
- El repo solo da de alta los redespachos (`scripts/redespacho.mjs`, remito `-R`, ~15 en agosto). Ese payload lleva `celular` como +549…, `observaciones` vacío salvo `--obs`, servicio 2 → "002" y `contrareembolso` = COD. No lleva `comprador[horario]`.
- El despacho nocturno y el script de etiquetas son del 04 y 05/09, después del corte.

**Veltron** (REST `/pedidos`, carrier fixy, 1.544 pedidos del 10/07 al 28/09, cruzados 1.277 de 1.277 guías):

| campo | antes del corte | corte | vuelta | ¿alinea con el 26/08 o el 16/09? |
|---|---|---|---|---|
| `fixy_servicio` | 002 en el 100% | 002, más SDC desde el **04/09** (19) | 002, más SDC (3) | No |
| `metodo_pago` | QR MP en 21% | QR MP en 14%; el último grueso es el 04/09 | ~0 | No (el 142 es igual con QR o efectivo) |
| teléfono guardado | 10 dígitos en el 98% | 98% | 98% | No |
| hora del alta (41) | 19 a 23 h | 19 a 22 h, más 01 h | 12 y 20 a 22 h | No |
| 41 → 129 (mediana) | 17,1 h | 16,1 h | 19,7 h | No |
| hora del 129 | 13 a 14 h | 13 a 14 h | 14 a 15 h | No |
| marcado "despachado" (dispara `fx_desp`) | tras el ruteo: 0% en julio, 56-61% del 03 al 16/08, 37% el 17/08 | 1% del 24/08 al 06/09, 64% el 07/09 | 0-12% | No. Marcar tras el ruteo entregaba **más** (76,2 contra 71,8) |
| `despachar_desde`, `etiquetas`, `tracking_url` | null, [], "" | igual | igual | No |
| email del comprador | dominios comunes en el 99% | igual | igual | No |

- **Etiqueta:** Fixy pasó a FIXYPAY QR el 17/08 y nosotros recortamos a 10×15 esa misma noche. El 142 sobrevivió 8 días más.
- **No visible desde acá:** qué manda Veltron en el alta. Faltan el formato del `celular` enviado, el email, `comprador[horario]` y `observaciones`, y si registró un webhook de estados (`/api/v2/integracion.json`). La REST no expone el payload.
- **Incidentes de Veltron en la misma ventana**, según `comms-fixy.md`: `fixy_retiro_sucursal` solo del 19 al 26/08; Veltron deja de ver el 139 del 27/08 al 21/09; el bot se cae el 28/08; la atención humana post-falla se desploma desde el 28/08. Son vecinos del 26/08, pero no hay mecanismo conocido que los ate al 142.

## 4. La pista del coordinador: (a) recordatorio contra (b) aviso de Fixy

- El recordatorio "Reminder: entrega hoy" salió del 22/07 al 01/08, más 26 el 03/08. Las guías de las semanas del 20/07 y 27/07 lo tienen todas.
- **Recordatorio → 142: el 142 es anterior en el 89,7% de los casos** (n=39, mediana −6,7 h). El recordatorio sale alrededor del primer 70 y el 142 unas 10 h antes.
- **El 142 aparece sin ningún recordatorio nuestro:** 03/08 34,0% · 10/08 14,8% · 17/08 23,4%. No cae del 01 al 03/08: cae el 26/08.
- Nuestro `fx_desp` manda `$tracking_url`, que está vacío en Veltron para Fixy. No le damos al cliente ningún link de Fixy.
- **Conclusión:** (a) queda descartada. (b) es la mejor explicación de la forma (un aviso disparado en el 129 con respuesta humana), pero **la fecha no es la del FIXYPAY QR** (17/08) sino la del **26/08**, y el aviso volvió el 16/09.

## 5. Paquete para Fixy

**Remitos:** `fixy-142-remitos.csv`, en esta carpeta. Son 30 filas sin datos personales:
- 15 con 142 temprano, despachados del 03 al 16/08: 12 entregadas y 3 no entregadas, de todos los cordones;
- 15 sin 142, despachados del 24/08 al 07/09 e ingresados a depósito del 26/08 al 11/09: 7 entregadas y 8 no entregadas.

Columnas: remito, guía Fixy, alta (41), ingreso (129), 142, minutos del 129 al 142, primer 70, primer resultado, resultado final, zona y CP.

**Preguntas, listas para pegar:**

> 1. ¿Qué genera el estado **142 CONFIRMACION EXTERNA** (detalle "MODIFICACION EXTERNA") en nuestras guías? En 1 de cada 5 aparece entre 3 minutos y unas horas después del **129 EN DEPOSITO LISTO PARA DESPACHO**. ¿Es la respuesta del destinatario a un aviso de Fixy (WhatsApp, SMS, mail o link)? Por favor indiquen sí o no y por qué canal.
> 2. Entre el ingreso a depósito del **26/08 (~13 h)** y el del **15/09** inclusive, **ninguna de nuestras 515 guías** tuvo el 142 al entrar al depósito. Antes lo tenía el 20%, y **volvió el 16/09 a las 14:07**. ¿En esas fechas se apagó, falló o cambió el aviso que Fixy le manda al destinatario cuando el paquete entra al depósito (proveedor, número emisor, plantilla o regla)? ¿Qué se tocó el 26/08 y qué el 16/09?
> 3. En esas mismas fechas el 142 **sí siguió apareciendo minutos después de una visita fallida** (52, 127, 51, 183). ¿El aviso de ingreso a depósito y el de después de la visita son procesos distintos en su sistema? Sí o no.
> 4. Para los 30 remitos del adjunto: ¿pueden ver en el log de cada guía **qué usuario, integración o canal registró el 142** en las primeras 15, y si a las otras 15 **se les mandó el aviso previo**, con qué resultado (enviado, entregado, fallido o sin teléfono válido)?
> 5. ¿El 142 cambia algo en la operación (prioridad en la hoja de ruta, franja o llamada previa del repartidor)? ¿Y entre el 26/08 y el 16/09 cambió algo en la llamada previa del repartidor en zona GBA?

**Al dev de Veltron**, en paralelo, porque el corte coincide con las altas de la noche del 25 al 26/08:

> ¿Cambió algo entre el alta del 24/08 a la noche y la del 26/08 ~01 h, o alrededor del 15/09, en lo que Veltron manda a `guias.json` de Fixy (formato de `celular`, email, `comprador[horario]`, `observaciones`) o en el webhook de estados de Fixy (`integracion.json`)?

## 6. Qué derivar

- **guias-couriers:** mandar a Fixy las preguntas 1 a 5 y el CSV.
- **Dev de Veltron:** la pregunta del payload y el webhook. Se suma al ticket de `comms-fixy.md` §8, por la vecindad con el 139 que no entró desde el 27/08.
- **profit-dia:** si Fixy confirma que el aviso se apagó, el efecto esperable de tenerlo prendido es de +2 a +5 pp sobre la tasa de Fixy, no +11. La brecha restante sigue abierta (demanda de Pureza en provincia de Buenos Aires y circuito post-falla).

## Supuestos (fechados)

- **Canon:** tasa sobre resueltos (migración 067; 41 con más de 7 días = no despachado), madurez ≥90% (canon del 13/08/2026), corrección del spam del 39 (`base.sql`). Las cohortes del 14/09 en adelante son inmaduras (86% y 39%) y se excluyen de la tasa. Para la vuelta del 142 se usa entrega a edad fija, D+7 del 129 (A 72,9 · B 69,4 · C 61,2 · D 63,6; n de D = 110), que no es canónica y sirve solo como comparación.
- **"142 temprano":** 142 dentro de las 48 h del 129 y antes del primer 70. Los períodos se cortan por el día del 129 (antes = hasta el 25/08; corte = del 26/08 al 15/09; vuelta = desde el 16/09) y las tablas semanales por la semana del 41.
- **Fuentes:**
  - Finanzas: `shipments`, `shipment_events`, `orders` y `order_items`, leídos el 29/09/2026 ~11 h.
  - Veltron: REST `/pedidos`, solo lectura, el 29/09. Del payload del alta no hay visibilidad.
  - `cf-conv.json` (conversaciones bajadas el 28 y 29/09).
  - Doc pública de la API de Fixy (`fixy.epresis.com/docs/collection.json`, GET), que no define el 142.
  - `git log` del 10 al 31/08.
- **Sin ID de repartidor ni log de avisos de Fixy:** la hipótesis (b) sale de la forma de los datos, no de una confirmación. Eso lo tiene que contestar Fixy.
- No se tocaron Stock ni Cashflow. Scripts y datos en esta carpeta: `f142.sql`, `f142-lib.mjs`, `f142-a1…a14.mjs`, `f142-vel.mjs`, `f142-csv.mjs` y `f142.json`/`f142-vel.json`, que tienen el teléfono crudo en `f142.json` y no salen de acá.
