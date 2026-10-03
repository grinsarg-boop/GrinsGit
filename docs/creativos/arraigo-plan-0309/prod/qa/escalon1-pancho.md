# Gate 3 — las 4 preguntas a 380 px (paso 1.7), ARRAIGO escalón 1 · 04/09/2026

**Esto lo contesta Pancho, en el teléfono, 60 segundos, sin brief.** Abajo va la pre-respuesta del
productor para que Pancho la contradiga si no coincide con lo que ve; **lo que vale es lo que
contesta él**. Cualquiera que falle → la pieza vuelve a producción y **las tarjetas de P1 no
desbloquean el escalón 2**.

Mirar estas dos imágenes, nada más:

- `prod/qa/380/contacto-estaticas-380.png` — las 5 estáticas a 380 px (E4, E8, E6, E1, E7)
- `prod/qa/380/contacto-tarjetas-380.png` — las 8 tarjetas de P1 a 380 px (A1 … A8)

---

### 1. ¿Qué producto es y para qué sirve?

**Pre-respuesta:** un sérum capilar anticaída de romero y cafeína, sin minoxidil, que se pone de
noche sobre la raíz. Se contesta en las 5 piezas, pero por vías distintas:

| pieza | cómo lo contesta | fuerza |
|---|---|---|
| E8 | frasco real grande, etiqueta legible a 380 px | **fuerte** |
| E6 | escena de pelo + franja de marca | fuerte |
| E7 | foto del cepillo con pelo + franja | media |
| E4 | segunda línea ("menos pelo en el cepillo") + franja | media — el titular solo no alcanza |
| E1 | franja únicamente; es retargeting, la persona ya vino de la landing | débil en frío, **suficiente en RTG** |

**Las 8 tarjetas NO contestan esta pregunta y no tienen que contestarla**: son cuadros de montaje del
video de P1, van con voz en off y con la franja de marca que se estampa en el montaje (§2.5).

### 2. ¿Este mensaje ya lo estoy diciendo en otra pieza?

**Pre-respuesta: no.** Cinco piezas, cinco mensajes, cinco bodies distintos:

- E4 `copyE4` — la honestidad del mes 1 (M-B)
- E8 `copyE8` — el infográfico comparativo (F-E8, el formato que transfiere de Pureza)
- E6 `copyC` — identificación por el detalle físico (M-D), el copy medido de agosto
- E1 `copyM4` — anti-riesgo COD (M-A), **retargeting**
- E7 `copyE7` — "medí vos" (prueba indirecta), **retargeting**

Solapamiento a vigilar: **E4 y las tarjetas A1/A7 dicen las dos cosas el mismo mes 1.** Es a
propósito — E4 es la estática de esa hipótesis y P1 es su video — pero si las dos corren a la vez en
el mismo público, se pisan. E4 va en el tramo C y P1 en el tramo A: público distinto, pasa.

### 3. ¿Hay piel afectada, antes/después, o algo que Meta lea como enfermedad? (incluida la miniatura)

**Pre-respuesta: no.** Barrido explícito sobre las 13 piezas:

- **Cero patología nombrada**: no aparecen las palabras alopecia, calvicie, DHT, hormonas, folículo
  ni menopausia en ningún texto quemado.
- **Cero cuero cabelludo con clareo**: es la razón por la que se mató la tirada `t4` de E6, donde el
  peine abría una franja de cuero cabelludo. La que quedó tiene pelo denso en toda la coronilla.
- **Cero antes/después**: E7 usa **un solo panel** del `est-cepillo-mes1-mes3.png` de agosto,
  justamente para no fotografiar una evolución. E4 nombra meses en **texto**, no en imágenes.
- **Cero promesa de resultado**: la pieza más cerca del borde es E7 ("Volvé a contar en 60 días"),
  que **invita a medir** y cuyo body dice textual *"No te vamos a mostrar un antes y después: contá vos"*.
- **Cero precio en pantalla.** El único `$` del lote es el **`$0`** de E1, que no es un precio del
  producto (aprobado en §2.3 del plan).
- **Cero caja de medicamento**, cero bata, cero escenografía médica.
- **Miniatura**: no aplica — este escalón no produjo video.

### 4. ¿El último cuadro tiene el producto en una mano o en uso?

**Pre-respuesta: no aplica a estáticas, y en las estáticas está a medias.** No hay video en este
escalón. En las estáticas el equivalente es *"¿se ve el producto?"*: sí en las 5, pero **en ninguna
está en una mano**. Es el defecto #1 del QA (`escalon1.md`): la vara que hoy vende
(`pureza-02-mix-base-v02`) muestra el envase **enorme y en una mano**, y nosotros no tenemos una
foto real de mano + frasco ARRAIGO. Generarla con IA es exactamente donde se rompe la etiqueta
(11/11 piezas falladas a 2K, Protocolo §197), así que **no se generó**.

**Esto sí bloquea el escalón 2 si Pancho lo considera bloqueante**: los cuatro videos cierran con
"la mano recibe el frasco en la puerta, etiqueta legible" (§5 constantes) y ese cuadro va a necesitar
o una foto real o un keyframe con la etiqueta perfecta.

---

## Estado del gate

- [ ] Pancho contesta las 4 sobre `contacto-estaticas-380.png` y `contacto-tarjetas-380.png`
- [ ] Si las 4 pasan → **las tarjetas de P1 quedan aprobadas y desbloquean el escalón 2**
- [ ] Si alguna falla → vuelve a producción con el motivo escrito acá
