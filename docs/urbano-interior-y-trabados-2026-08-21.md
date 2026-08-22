# Urbano — ¿el pozo de Interior se sostiene? + reclamo de las trabadas

**Fecha de corrida: 21/08/2026.** Todo el estado de courier de este informe sale de la API de Urbano
consultada EN VIVO hoy (`POST /tracking/consultaTrackingMasivo/`), no de Supabase. Supabase se usó
solo para armar el universo de candidatas.

---

# Parte 1 — El −12,5 pp de Interior no fue un pozo: se profundizó

## El problema de comparar cohortes de distinta edad

El reporte semanal comparó 18–24/07 y 25–31/07 **a 21 días cumplidos**. Las cohortes posteriores
todavía no llegan a 21 días: al 21/08, la 01–07/08 tiene entre 14 y 20 días y la 08–14/08 entre 7 y
13. Compararlas contra un número de 21 días haría parecer una caída que es solo falta de maduración.

Para evitarlo, medí **entrega dentro de los primeros K días de despacho** reconstruida desde
`shipment_events` (fecha del primer movimiento `DL`/`EI`/`RA`, o sea "Su envio fue entregado"), y
comparé cada par de cohortes al mismo K. El K máximo válido para cada cohorte es el que su guía más
nueva ya cumplió:

| Cohorte | Guías Urbano | Edad al 21/08 | K máximo válido |
|---|---|---|---|
| 18–24/07 | 490 | 28–34 d | 21 |
| 25–31/07 | 302 | 21–27 d | 21 |
| 01–07/08 | 236 | 14–20 d | **14** |
| 08–14/08 | 406 | 7–13 d | **7** |

Los eventos están al día: el último sync de Urbano cerró el 21/08 a las 23:47 UTC y hay 4.037
eventos en las últimas 48 h. No hay sesgo por sync atrasado.

## Urbano Interior, entrega a 7 días (la única comparación válida para las 4 cohortes)

| Cohorte | Guías | Entrega a 7 d | Δ vs anterior |
|---|---|---|---|
| 18–24/07 | 370 | **48,8%** | — |
| 25–31/07 | 266 | **38,3%** | −10,5 pp |
| 01–07/08 | 213 | **36,8%** | −1,5 pp |
| 08–14/08 | 363 | **31,9%** | −4,9 pp |

**Respuesta: no fue un pozo puntual.** A igual madurez (7 días), Interior perdió 16,9 pp en cuatro
semanas y no rebotó en ninguna. La caída más grande sigue siendo la del 25–31/07, pero las dos
cohortes siguientes quedaron por debajo de ella, no por encima.

A 14 días, con las tres cohortes que ya lo cumplieron, el mismo dibujo:

| Cohorte | Guías | Entrega a 14 d |
|---|---|---|
| 18–24/07 | 370 | 60,7% |
| 25–31/07 | 266 | 48,5% |
| 01–07/08 | 213 | 46,6% |

## Proyección de las cohortes inmaduras

En las dos cohortes maduras, la entrega a 7 días se convierte en la final con un factor estable de
1,31–1,33 (18–24/07: 48,8% → 64,0%; 25–31/07: 38,3% → 51,1%; 01–07/08 ya va 49,5% con 36,8% a 7 d,
factor 1,34). Aplicado:

| Cohorte | Entrega a 7 d | Proyección a 21 d |
|---|---|---|
| 01–07/08 | 36,8% | ~49% (ya lleva 49,5%) |
| 08–14/08 | 31,9% | **~42%** |

La 08–14/08 son 363 guías de Interior — la cohorte más grande de las cuatro. Si el factor se
sostiene, va a cerrar ~9 pp por debajo de la 25–31/07 que disparó la alarma.

## Urbano AMBA se recuperó, y Fixy sigue arriba

| Courier / zona | 18–24/07 | 25–31/07 | 01–07/08 | 08–14/08 |
|---|---|---|---|---|
| Urbano AMBA (7 d) | 53,7% (121) | 52,6% (38) | 50,0% (32) | **62,1% (58)** |
| Urbano Interior (7 d) | 48,8% (370) | 38,3% (266) | 36,8% (213) | **31,9% (363)** |
| Fixy AMBA (7 d) | 71,6% (102) | 75,3% (73) | 75,0% (52) | 67,1% (76) |

AMBA de Urbano encogió (121 → 38 → 32 → 58 guías: el ruteo a Fixy funcionó) y su tasa mejoró. El
problema es exclusivamente Interior, que es además donde está el volumen: 363 de las 421 guías de
Urbano de la última cohorte.

El 67,1% de Fixy en 08–14/08 es el único dato que puede ser inmadurez: le quedan 14 guías abiertas
sobre 76. No lo leería como quiebre todavía.

## ¿De qué zona es la caída? De ninguna en particular

Entrega a **7 días** por provincia (n entre paréntesis), Interior de Urbano, provincias con ≥15
guías en el período:

| Provincia | 18–24/07 | 25–31/07 | 01–07/08 | 08–14/08 |
|---|---|---|---|---|
| Córdoba | 57% (61) | 45% (31) | 44% (36) | 42% (45) |
| Santa Fe | 40% (40) | 36% (25) | 41% (29) | 36% (28) |
| Salta | 52% (31) | 22% (23) | 56% (18) | 27% (26) |
| Mendoza | 48% (29) | 40% (20) | 10% (10) | 35% (37) |
| Neuquén | 75% (24) | 66% (32) | 42% (12) | 31% (13) |
| Jujuy | 9% (11) | 9% (11) | 6% (18) | 12% (26) |
| Río Negro | 35% (20) | 25% (20) | 29% (7) | 0% (16) |
| Misiones | 75% (20) | 44% (16) | 55% (11) | 33% (12) |
| Tucumán | 30% (20) | 33% (9) | 20% (5) | 18% (17) |
| Corrientes | 21% (14) | 8% (12) | 29% (7) | 29% (14) |
| Entre Ríos | 80% (15) | 44% (9) | 25% (8) | 73% (11) |
| San Juan | 57% (14) | 50% (6) | 20% (5) | 38% (16) |
| Santiago Del Estero | 57% (7) | 60% (5) | 56% (9) | 47% (19) |
| Chaco | 36% (14) | 50% (8) | 40% (5) | 33% (12) |
| Catamarca | 50% (4) | 40% (10) | 50% (4) | 11% (19) |
| Formosa | 22% (9) | 20% (5) | 33% (9) | 10% (10) |
| La Rioja | 45% (11) | 50% (6) | 29% (7) | 78% (9) |
| La Pampa | 57% (7) | 25% (8) | 67% (3) | 43% (7) |
| Chubut | 38% (8) | 25% (4) | 0% (1) | 43% (7) |

Agrupado por región, entrega a 7 días:

| Región | 18–24/07 | 25–31/07 | 01–07/08 | 08–14/08 |
|---|---|---|---|---|
| Centro (CBA, SF, ER, LP) | 54,5% (123) | 39,7% (73) | 42,1% (76) | 44,0% (91) |
| NOA | 40,5% (84) | 29,7% (64) | 34,4% (61) | 26,7% (116) |
| NEA | 43,9% (57) | 31,7% (41) | 40,6% (32) | 27,1% (48) |
| Patagonia | 51,7% (60) | 47,5% (59) | 35,0% (20) | **18,4% (38)** |
| Cuyo | 51,1% (45) | 44,4% (27) | 13,3% (15) | 36,4% (55) |

**Las cinco regiones caen.** La única que se recuperó algo es Centro (44,0% en la última, contra
39,7% en la del pozo), y aun así está 10 pp abajo de julio. La peor es Patagonia: 51,7% → 18,4%,
con Río Negro en 0% a 7 días sobre 16 guías y Neuquén cayendo 75% → 30,8%.

## No es cambio de mix de destinos

Apliqué las tasas por provincia de la cohorte 18–24/07 al mix de destinos de cada cohorte
posterior. Si la caída fuera "mandamos más guías a provincias difíciles", el esperado tendría que
bajar igual que el real. No baja:

| Cohorte | Entrega real a 7 d | Esperada con las tasas de 18–24/07 y el mix propio | Brecha |
|---|---|---|---|
| 25–31/07 | 38,3% | 49,8% | −11,5 pp |
| 01–07/08 | 36,8% | 47,1% | −10,3 pp |
| 08–14/08 | 31,9% | 45,8% | −13,9 pp |

El mix explica ~0. Es performance del courier, no composición de destinos.

## No es demora de admisión

Descarté que el reloj arranque antes de que Urbano retire el bulto: el lag entre `dispatched_at` y
el primer movimiento real (no-PI) tiene mediana 0 y p90 0 en las cuatro cohortes. El bulto se
admite el mismo día que se emite la etiqueta.

## Dónde se traba: en tránsito, no en devolución

Estado de cada guía **al día 7 desde el despacho**, reconstruido evento por evento (Urbano Interior):

| Estado al día 7 | 18–24/07 | 25–31/07 | 01–07/08 | 08–14/08 |
|---|---|---|---|---|
| entregado | 48,6% | 38,0% | 35,2% | 30,6% |
| **en tránsito** | **15,9%** | 12,4% | 20,7% | **28,7%** |
| incidencia | 15,9% | 16,9% | 17,4% | 19,8% |
| en devolución | 8,1% | 16,5% | 8,9% | 11,0% |
| en reparto | 5,7% | 7,9% | 8,5% | 6,1% |
| en sucursal | 5,7% | 6,8% | 7,0% | 2,8% |

La franja que crece es **"en tránsito"**: casi se duplica (15,9% → 28,7%). No hay más rechazos ni
más devoluciones tempranas: hay bultos que a la semana todavía no llegaron a destino. Es lentitud
de red, y encima con el volumen de Interior subiendo de 213 a 363 guías semanales.

## Un daño lateral que se está agrandando: las fantasmas

Guías de Urbano que al día de hoy siguen en `PI` ("Recibimos la información de su pedido") sin
ninguna admisión — etiqueta emitida, bulto nunca retirado. Salen del denominador de entrega, así que
no explican la caída, pero son plata que no llega a existir:

| Cohorte | Guías Urbano | Fantasmas (solo PI) | % |
|---|---|---|---|
| 18–24/07 | 491 | 1 | 0,2% |
| 25–31/07 | 304 | 1 | 0,3% |
| 01–07/08 | 245 | 8 | **3,3%** |
| 08–14/08 | 422 | 11 | **2,6%** |

De 0,2% a ~3% en tres semanas. Sobre 400 guías semanales son ~11 pedidos por semana, ~$550 k de COD
que nunca sale a la calle.

## Qué haría con esto

1. Interior de Urbano no se recuperó y no hay motivo en los datos para esperar que se recupere solo.
   La cohorte más nueva y más grande proyecta ~42%.
2. La palanca que ya está probada es la que se usó en AMBA: mover volumen a Fixy. Fixy entrega
   ~70-75% consistente. El límite es que Fixy hoy es prácticamente todo AMBA (1 sola guía de
   Interior en la última cohorte) — habría que medir si cubre Interior y a qué costo antes de mover.
3. Las 11 fantasmas semanales son un fix operativo distinto y más barato: son etiquetas emitidas que
   nadie retiró.

---

# Parte 2 — Las 137 trabadas, contrastadas en vivo

## El universo

Reproduje el corte del reporte semanal: guías de Urbano sin resolver con más de 21 días desde el
despacho. Con `status_at` (último movimiento en la base) da entre 130 y 141 según el umbral exacto
en horas; el reporte publicó 137 / $6,62 M / más vieja del 02/05. Para no dejar nada afuera consulté
el universo completo: **180 guías** (todas las no resueltas con +21 días de despacho, la más vieja
del 02/05/2026), COD nominal $8,79 M.

Las 180 se consultaron por `codigoSeguimiento` = shopify_id (las 180 son despachos ≤ 31/07, previos
al corte BLABS del 04/08). **Las 180 existen en Urbano** (`codError: 0`) — ninguna es un código
equivocado.

## El resultado: dos tercios del universo no era reclamable

| Categoría | Guías | COD nominal | COD real (sin pedidos cancelados) |
|---|---|---|---|
| **NUNCA ENTRÓ** — sacar del universo | 116 | $5.586.685 | **$99.980** (2 guías) |
| **REDESPACHAR** — volvió, se puede reintentar | 31 | $1.573.669 | $1.573.669 |
| **RECLAMAR** — en poder de Urbano, plata a recuperar | 26 | $1.299.590 | $1.239.610 |
| Ya resuelta (entregada, la base no se enteró) | 1 | $49.990 | $49.990 |
| Cancelados dentro de "redespachar" | 6 | $278.899 | — |

**El $6,62 M del reporte semanal está inflado.** 114 de las 116 "nunca entró" son pedidos que
nosotros cancelamos: la etiqueta se generó, el bulto nunca se retiró, y el `cod_amount` del pedido
cancelado se siguió sumando. La plata realmente en riesgo es **$2,86 M**, no $6,62 M, y de esa solo
**$1,30 M es reclamo a Urbano**; el resto ($1,57 M) es mercadería que volvió y se puede revender.

## RECLAMAR — 26 guías, $1.299.590

Cuatro grupos, con cuatro pedidos distintos a Urbano:

**(a) Historial borrado — 3 guías, $149.940.** El hallazgo más raro. El 27/07 estas tres devolvían
movimientos reales por la misma API. Hoy responden `codError: 0` (la pieza existe) pero **sin
`movimientos`, sin producto y sin domicilio**. No son fantasmas: entraron, se movieron, y el
historial desapareció del tracking. Sin el snapshot del 27/07 las habría clasificado mal como
"nunca entró".

**(b) Sin un solo movimiento desde junio — 2 guías, $109.970.** Último check `IF` ("Ya tenemos su
pedido en Urbano"), hace 74 y 80 días. **Ambas ya se reclamaron el 27/07 y siguen con el mismo
estado y la misma fecha**: Urbano no las tocó en 25 días. Son las que van escaladas.

**(c) Entregadas según el tracking, COD sin rendir — 3 guías, $159.940.** Tienen el check
`DL — "Su envio fue entregado"` en `movimientos`, pero el campo `estado` de la pieza quedó en
`AS — "Su envio esta en viaje a sucursal"`. Dos de las tres también están escaladas (mismo estado y
fecha que el 27/07). Acá el candado de "`item.estado` manda" deja la guía en tránsito, pero el
movimiento con descripción textual "Su envio fue entregado" obliga a preguntar por la rendición.

**(d) Trabadas en bucle de reintentos — 18 guías, $879.740.** Se mueven, pero llevan 3 a 5 semanas
desde el despacho rebotando entre `MA` (preparado para distribución), `LD` (en camino) y una
incidencia (`CA` no encontramos a nadie / `BA` no existe nro-altura / `SP` rehúsa recibir / `ST` sin
tramitar), sin cerrar ni en entrega ni en devolución. Cuatro tienen incidencia de dirección: si el
domicilio cargado está mal, se corrige y sale.

**Ojo con la base:** 18 de estas 26 registran movimiento en Urbano en los últimos 21 días, algunas
de ayer. El `status_at` de Supabase está atrasado y por eso caían en "trabadas +21 d". La lista de
reclamo se armó con la fecha del último movimiento **de la API**, no con la de la base.

| Guía | Pedido | Desp. | Provincia | COD | Estado API | Últ. mov. | Días | Motivo |
|---|---|---|---|---|---|---|---|---|
| 6887499038960 | 9787 | 14/05 | Buenos Aires | $49.980 | - | — | — | historial BORRADO de la API (27/07 estaba en RR|2026-06-02) |
| 6899891339504 | 10298 | 18/05 | Córdoba | $49.980 | - | — | — | historial BORRADO de la API (27/07 estaba en IF|2026-05-22) |
| 6902445998320 | 10410 | 20/05 | Jujuy | $49.980 | - | — | — | historial BORRADO de la API (27/07 estaba en NC|2026-06-02) |
| 6928165372144 | 11415 | 28/05 | Santa Fe | $49.980 | - | 2026-06-02 | 80 | sin movimiento hace 80 d, ultimo: - |
| 6938125795568 | 12039 | 03/06 | Santa Fe | $59.990 | - | 2026-06-08 | 74 | sin movimiento hace 74 d, ultimo: - |
| 6897779540208 | 10179 | 04/06 | Santa Fe | $59.980 | AS - Su envio esta en viaje a sucursal | 2026-06-04 | 78 | movimiento DL (entregado) pero estado AS — o rinden el COD o dicen donde esta |
| 6938775978224 | 12093 | 04/06 | Buenos Aires | $49.980 | AS - Su envio esta en viaje a sucursal | 2026-06-11 | 71 | movimiento DL (entregado) pero estado AS — o rinden el COD o dicen donde esta |
| 7005358653680 | 15938 | 07/07 | Chubut | $49.980 | AS - Su envio esta en viaje a sucursal | 2026-07-10 | 42 | movimiento DL (entregado) pero estado AS — o rinden el COD o dicen donde esta |
| 7018227695856 | 16616 | 14/07 | Buenos Aires | $49.980 | ST - Sin tramitar | 2026-08-15 | 6 | incidencia viva (ST - Sin tramitar), ultimo mov hace 6 d |
| 7032615272688 | 17097 | 20/07 | Río Negro | $39.980 | BA - Rehusa recibir | 2026-08-18 | 3 | incidencia viva (BA - Rehusa recibir), ultimo mov hace 3 d |
| 7039601934576 | 17601 | 22/07 | Santa Cruz | $49.990 | BA - No existe nro/altura | 2026-08-10 | 11 | incidencia viva (BA - No existe nro/altura), ultimo mov hace 11 d |
| 7042710307056 | 17899 | 22/07 | Río Negro | $49.980 | CA - No encontramos a nadie en el domicilio | 2026-08-14 | 7 | incidencia viva (CA - No encontramos a nadie en el domicilio), ultimo mov hace 7 d |
| 7043989307632 | 17992 | 23/07 | Santa Cruz | $39.980 | BA - No existe nro/altura | 2026-08-10 | 11 | incidencia viva (BA - No existe nro/altura), ultimo mov hace 11 d |
| 7035660534000 | 17376 | 23/07 | Río Negro | $39.990 | CA - No encontramos a nadie en el domicilio | 2026-08-14 | 7 | incidencia viva (CA - No encontramos a nadie en el domicilio), ultimo mov hace 7 d |
| 7040615186672 | 17688 | 23/07 | Santa Fe | $39.990 | BA - Mal codificado | 2026-08-01 | 20 | incidencia viva (BA - Mal codificado), ultimo mov hace 20 d |
| 7043433038064 | 17950 | 24/07 | Formosa | $49.980 | CA - No encontramos a nadie en el domicilio | 2026-08-20 | 1 | incidencia viva (CA - No encontramos a nadie en el domicilio), ultimo mov hace 1 d |
| 7050003939568 | 18177 | 28/07 | Santa Cruz | $49.980 | BA - No existe nro/altura | 2026-08-10 | 11 | incidencia viva (BA - No existe nro/altura), ultimo mov hace 11 d |
| 7050094379248 | 18180 | 28/07 | Río Negro | $39.980 | LD - Su envio esta en camino | 2026-08-20 | 1 | incidencia viva (LD - Su envio esta en camino), ultimo mov hace 1 d |
| 7055934521584 | 18405 | 29/07 | Tucumán | $59.980 | MA - Su envio esta preparado para salir a distribucion | 2026-08-21 | 0 | incidencia viva (MA - Su envio esta preparado para salir a distribucion), ultimo mov hace 0 d |
| 7060031963376 | 18558 | 31/07 | Buenos Aires | $49.990 | SP - No pudimos entregar su envio por rehusa recibir | 2026-08-15 | 6 | incidencia viva (SP - No pudimos entregar su envio por rehusa recibir), ultimo mov hace 6 d |
| 7061144535280 | 18599 | 31/07 | Salta | $59.990 | VN - No responde | 2026-08-12 | 9 | incidencia viva (VN - No responde), ultimo mov hace 9 d |
| 7059085295856 | 18533 | 31/07 | La Pampa | $49.990 | BA - Rehusa recibir | 2026-08-13 | 8 | incidencia viva (BA - Rehusa recibir), ultimo mov hace 8 d |
| 7056530866416 | 18432 | 31/07 | Río Negro | $39.990 | SP - No pudimos entregar su envio por no responde | 2026-08-20 | 1 | incidencia viva (SP - No pudimos entregar su envio por no responde), ultimo mov hace 1 d |
| 7057091100912 | 18454 | 31/07 | Buenos Aires | $59.990 | ST - Sin tramitar | 2026-08-15 | 6 | incidencia viva (ST - Sin tramitar), ultimo mov hace 6 d |
| 7057668440304 | 18468 | 31/07 | Salta | $59.990 | CA - No encontramos a nadie en el domicilio | 2026-08-18 | 3 | incidencia viva (CA - No encontramos a nadie en el domicilio), ultimo mov hace 3 d |
| 7060753318128 | 18583 | 31/07 | Buenos Aires | $49.990 | SP - No pudimos entregar su envio por rehusa recibir | 2026-08-19 | 2 | incidencia viva (SP - No pudimos entregar su envio por rehusa recibir), ultimo mov hace 2 d |

## REDESPACHAR — 31 guías, $1.573.669

Estado `RM` (Rendido a Matriz, 26), `DV` (será devuelto al remitente, 4) o `RV` (devolución en viaje
a casa central, 1). El bulto volvió o está volviendo. **27 de las 31 pasaron a devolución en agosto**
— o sea que son recientes y la mercadería debería estar llegando ahora.

Antes de redespachar hay que confirmar la recepción física de los 31 bultos: la API dice "rendido a
matriz", que es el depósito de Urbano, no nuestro depósito.

Distribución: Mendoza 6, Buenos Aires 4, Santa Fe / Río Negro / Corrientes / Formosa / Salta /
Neuquén 2 cada una, y 1 en Chaco, Chubut, Córdoba, Entre Ríos, Jujuy, La Pampa, Misiones, Santiago
del Estero, Tucumán.

Esta es la lista lista para despacho-pedidos, junto con las 2 fantasmas no canceladas (pedidos 17823
y 18472, que nunca salieron y hay que volver a despachar desde cero).

## NUNCA ENTRÓ — 116 guías, sacar del universo

- 69 sin ningún registro en la API (y sin snapshot previo que las contradiga) + 47 con solo el check
  `PI` y entre 22 y 112 días desde el despacho.
- **114 de las 116 son pedidos cancelados.** Etiqueta emitida, pedido cancelado, bulto nunca
  retirado. No hay nada que reclamar: reclamarlas quemaría credibilidad.
- Las 2 no canceladas son pedidos 17823 (Entre Ríos, $49.990, solo PI hace 29 días) y 18472
  (La Rioja, $49.990, solo PI hace 22 días) → van a redespacho.
- Por mes de despacho: 72 de mayo, 36 de junio, 8 de julio. Es un pasivo viejo que nunca se limpió.

## Comparación con el snapshot anterior

Snapshot usado: `datos/reclamos/2026-07-27.json` (22 piezas, de hace 25 días). Once de sus piezas
siguen en el universo de hoy:

- **4 con el mismo estado y la misma fecha** → escaladas (pedidos 11415, 12039, 12093, 15938).
- **4 se movieron** y pasaron a devolución: 11775 (SP → RM 19/08), 12846 (BA → RM 04/08),
  14131 (CA → DV 29/07), 14399 (SP → DV 24/07). El reclamo del 27/07 sirvió para estas.
- **3 perdieron el historial** (las del grupo (a)).

Snapshot nuevo guardado en `datos/reclamos/2026-08-21.json` con las 180 piezas y su categoría, para
que la próxima corrida pueda escalar.

## Archivos

- Reclamar: `docs/urbano-2026-08-21-reclamar.csv` (26 guías)
- Redespachar: `docs/urbano-2026-08-21-redespachar.csv` (31 guías)
- Nunca entró: `docs/urbano-2026-08-21-nunca-entro.csv` (116 guías)
- Detalle de trabajo (las 180 con estado en vivo, motivo, snapshot y flag de escalada):
  `docs/urbano-2026-08-21-detalle.csv`
- Texto del reclamo listo para pegar: `docs/urbano-2026-08-21-reclamo.md`
- Snapshot para la próxima corrida: `datos/reclamos/2026-08-21.json`

**No se mandó ningún mail y no se escribió en la API de Urbano ni en Supabase.**

---

## Supuestos

- Umbral PI = **2 días** para "nunca entró" (medido 11/08/2026: mediana PI→admisión 1,3 d, p90
  2,1 d). El reporte semanal usó 7 días; sobre este universo (todas con +21 días de despacho) los
  dos umbrales dan el mismo conjunto.
- Trabada = **+14 días sin movimiento** (dicho por Pancho 20/07, no medido). Acá se usó el corte de
  +21 días del reporte semanal para armar el universo, y después se reclasificó con la fecha del
  último movimiento **de la API**, no la de Supabase.
- `item.estado` es autoritativo sobre `movimientos[]` (migraciones 019/055; empate de las 23:59:59
  resuelto en la 072 del 13/08). Excepción documentada: en las 3 guías del grupo (c) hay un
  movimiento con descripción textual "Su envio fue entregado" que el campo `estado` no refleja; se
  reclaman como pregunta de rendición, no se dan por entregadas.
- Código de seguimiento: `BLABS<order_number>` desde el 04/08/2026, `shopify_id` antes. Las 180
  guías de la Parte 2 son despachos ≤ 31/07 → shopify_id, y las 180 respondieron `codError: 0`.
- La base no distingue etiqueta emitida de bulto despachado (`dispatched_at` se llena al generar la
  etiqueta); todo veredicto de esta corrida sale de la API consultada el 21/08/2026.
- Cohortes de la Parte 1: entrega = primer evento `DL`/`EI`/`RA` dentro de K días de `dispatched_at`;
  excluye "nunca entró"; excluye pedidos cancelados y guías canceladas. Comparaciones válidas solo a
  K ≤ edad de la guía más nueva de cada cohorte (K=7 para 08–14/08, K=14 para 01–07/08, K=21 para
  las dos de julio).
- Snapshot de reclamo comparado: `datos/reclamos/2026-07-27.json`, del 27/07/2026 (25 días de
  antigüedad).
