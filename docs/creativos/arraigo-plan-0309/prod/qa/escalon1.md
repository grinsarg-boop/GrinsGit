# QA ojo de cliente — ARRAIGO, escalón 1 (04/09/2026)

Paso 1.6 de `06-plan-exacto.md`. Veredicto binario, máximo 2 rondas. Todo mirado a **380 px**
(miniaturas en `prod/qa/380/`), no a tamaño de archivo.

## La persona

**Silvana, 44, Ituzaingó (GBA oeste).** Se ata el pelo todos los días. Hace ocho meses junta más
pelo del que junta la escoba; lo ve en la almohada y en el desagüe antes que en el espejo. Ya probó
un shampoo anticaída de farmacia y una ampolla que le regalaron. Leyó sobre minoxidil y le da miedo
("después no lo podés dejar"). No mete la tarjeta en tiendas que no conoce. Pasa el feed a las
23:40, en la cama, con el brillo bajo.

## La vara

**`pureza-02-mix-base-v02`** — la estática que hoy vende en la casa: **CTR 6,08% · CPA $3.067**
(fila de `creativos_ganadores`, snapshot 16/08/2026; imagen viva en Storage). Estructura:
dos columnas — *Problemas* ilustrados (fondo claro) contra *Solución* (fondo oliva) con el **envase
enorme en una mano y la etiqueta legible** — y barra de prueba social al pie (★4,6/5, +5500 reseñas).

**Vara propia de ARRAIGO, la que hay que superar:** las 5 estáticas de agosto dieron
**CTR saliente 1,0-1,5% y 1 compra entre las cinco** (`00-contexto.md`). No es un listón alto: es el
piso del que hay que despegarse.

> ⚠️ `creativos_ganadores` está **fresca en contenido pero vieja de fecha** (`snapshot_date` 16/08,
> 19 días) y **no tiene ninguna fila de ARRAIGO**. No afectó a esta corrida porque acá no se usó la
> Fábrica (fal directo + HTML). **Bloquea el escalón 2 si ese escalón pasa por la Fábrica.**

---

## Ronda 1 — las cinco preguntas, pieza por pieza

### E4 · `e4/e4-4x5.png` — "Mes 1: estoy igual."
1. **¿Me freno en 1 s?** Sí. Bloque de texto negro sobre crema en un feed de fotos: corta por
   contraste, y la frase dice lo contrario de lo que dice la categoría.
2. **¿Entiendo qué es en 2 s?** Sí, pero por la segunda línea ("Mes 2: menos pelo en el cepillo"),
   no por el titular. La franja de marca cierra la duda a 380 px.
3. **¿Me la creo?** Sí. Cero foto de IA, cero promesa, cero antes/después.
4. **¿Entiendo la oferta?** Sí: caja verde "no los pagás hasta tenerlos" + pie ENVÍO GRATIS · PAGÁS AL RECIBIR.
5. **¿Qué rompe la ilusión?** El packshot de la franja es chico (145 px de 1350). Contra la vara,
   donde el envase ocupa media pieza, acá el producto casi no está.
→ **LANZABLE.**

### E8 · `e8/e8-4x5.png` — comparativa
1. **¿Me freno?** Sí. El corte cromático crema | verde parte la pieza al medio y se lee de lejos.
   Es la misma arquitectura de la vara, que mide CTR 6,08%.
2. **¿Entiendo qué es?** Sí, y es la que mejor lo contesta: el frasco real, grande, con
   "ARRAIGO · SÉRUM ANTICAÍDA · SIN MINOXIDIL" legible.
3. **¿Me la creo?** Sí. El envase es la foto de la landing, no un render: **cero riesgo de etiqueta
   mal escrita** (Protocolo §197, 11/11 piezas falladas a 2K).
4. **¿Entiendo la oferta?** Sí, pie.
5. **¿Qué rompe?** Los tres íconos de línea son fríos y a 380 px miden ~35 px: decoran, no informan.
   La vara usa ilustraciones con color y figura humana. No es bloqueante — el texto de al lado carga
   el significado — pero es la debilidad de la pieza.
→ **LANZABLE.**

### E6 · `e6/e6-raya-4x5.png` — "Si ya cambiaste la raya de lado"
1. **¿Me freno?** Sí, es la más fuerte del lote: baño de casa, gesto que Silvana hace todas las mañanas.
2. **¿Entiendo qué es?** Sí, por la bajada y la franja.
3. **¿Me la creo, o parece IA?** Es IA y **pasa el barrido**, revisado a resolución de producción:
   - **manos**: la del peine tiene 4 dedos + pulgar, uñas, anatomía correcta; la de la coronilla
     muestra 4 yemas bien formadas. Sin dedos fundidos ni de más.
   - **texto**: ninguno. La imagen no escribe una sola letra (todo el texto es HTML).
   - **reflejo**: la pose del espejo coincide con la del primer plano (brazo izquierdo arriba,
     derecho con el peine). Sin tercera figura.
   - **cuero cabelludo**: pelo denso en toda la coronilla, **sin clareo y sin cuero cabelludo visible**.
4. **¿Entiendo la oferta?** Sí.
5. **¿Qué rompe?** Nada bloqueante. Cortina de ducha algo quemada a la izquierda.
→ **LANZABLE.** Es el punto de mayor riesgo del lote y el único que costó plata.

### E1 · `e1/e1-4x5.png` — "$0" (retargeting)
1. **¿Me freno?** Sí. El `$0` es el elemento más grande de la pieza — la regla del ganador cumplida
   al pie de la letra.
2. **¿Entiendo qué es?** En frío, no del todo (el titular no nombra la categoría); en **retargeting**,
   que es su único destino, sí: la persona ya estuvo en la landing.
3. **¿Me la creo?** Sí.
4. **¿Entiendo la oferta?** La pieza **es** la oferta, y la bajada corrige de inmediato la lectura
   "me lo regalan" → "lo pagás cuando lo tenés en la mano".
5. **¿Qué rompe?** Nada.
→ **LANZABLE, solo retargeting.**

### E7 · `e7/e7-4x5.png` — "Contá los pelos" (retargeting)
1. **¿Me freno?** Sí: es una orden y la foto es el síntoma exacto, no una metáfora.
2. **¿Entiendo qué es?** Sí.
3. **¿Me la creo?** Sí. La foto ya corrió en agosto y está aprobada.
4. **¿Entiendo la oferta?** Sí.
5. **¿Qué rompe?** Nada. "Volvé a contar en 60 días" **invita a medir, no promete** — y el body
   (`copyE7`) lo dice explícito: *"No te vamos a mostrar un antes y después: contá vos"*.
→ **LANZABLE, solo retargeting.**

### Tarjetas A1-A8 · `p1/tarjetas/`
No son anuncios: son insumos de montaje del escalón 2. Lo que se audita es legibilidad a 380 px,
cero typo, cero texto de IA y marca consistente. Las 8 pasan: tipografía de marca ExtraBold, cortes
de línea decididos por HTML (`white-space:nowrap` + autoajuste), fondo crema `#F4EEE2`.
→ **APTAS PARA MONTAJE** (no aplica veredicto de anuncio).

---

## Ronda 1 sobre las tiradas de IA de E6 — 4 candidatas, 1 sobrevive

| tirada | veredicto | motivo |
|---|---|---|
| `t1` | **muerta** | tercera figura en el espejo lateral (se leen tres personas a 380 px); el reflejo tiene los dos brazos arriba y el primer plano uno solo; dominante ámbar que ensucia |
| `t2` | **muerta** | pelo encrespado y seco — contradice "peinado y abundante" del brief; el reflejo no repite la pose del primer plano |
| `t3` | **ELEGIDA** | composición limpia, dos figuras, luz de baño de casa, manos correctas, cero cuero cabelludo |
| `t4` | **muerta** | **regla dura**: el peine abre una franja de **cuero cabelludo visible en la raya**. Se descarta sin discusión |

Tasa 1 de 4 (25%), en línea con la calibración del filtro. Las tres muertas quedan en
`prod/muertas/e6/` con el motivo en el nombre del archivo.

**No hizo falta ronda 2:** ninguna pieza quedó con un bloqueante en ronda 1. Los defectos de abajo
son de generador, no de pieza — se arreglan en la ronda 2 de la tanda, no parchando estas cinco.

---

## Los 3 defectos más repetidos del lote (esto es lo que hay que arreglar en el generador)

1. **El producto llega tarde y llega chico** (E4, E1, E7, y en menor medida E6). El envase vive en
   una franja de 186 px al pie; en la vara ocupa media pieza y está **en una mano**. Arreglo:
   subir el packshot al bloque de texto en las piezas de texto puro, o conseguir de una vez una
   **foto real de mano sosteniendo el frasco ARRAIGO** — no la hay en el repo, y generarla con IA
   es exactamente donde se rompe la etiqueta.
2. **Ícono plano de una línea = ruido a 380 px** (E8). 100 px de trazo monocolor desaparecen. La
   vara usa ilustración con relleno y color. Arreglo: ícono con relleno a 140 px, o foto real.
3. **Cero prueba social en las cinco piezas.** La vara cierra con ★4,6/5 (+5500 reseñas) y todo el
   clúster de Skinfinity escala con un contador. El número aprobado el 04/09
   (`+10.000 Personas pagaron al recibir`) vive **solo en la descripción del link**, que a 380 px
   casi no se ve. En esta corrida no se toca — el texto quemado está cerrado en §2.4 — pero es la
   diferencia más grande contra la vara y debería entrar en la ronda 2.
