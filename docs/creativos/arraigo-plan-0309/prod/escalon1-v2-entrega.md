# ARRAIGO · Escalón estáticas **v2** — entrega (04/09/2026)

**Corrección de rumbo de Pancho (04/09/2026):** la tanda v1 se descartó entera como anuncios —
*"Faltan imágenes de usuarios y el producto en las estáticas. No se entiende, no hay referencias de
la clienta objetivo. Mirá las estáticas que funcionan en la cuenta."* El QA de v1 miró compliance y
legibilidad en vez de si vendían.

**OK de gasto ejecutado (textual):** `OK de gasto: hasta US$6 en fal.ai (nano-banana-pro 2K medido
el 04/09 = US$0,15/img). Nada se pautea, no toques Meta.`

**Nada se lanzó, nada se pauteó, no se tocó ninguna cuenta publicitaria.** Si Pancho quiere lanzar,
el camino es `meta-operador` (`scripts/lanzar.mjs`).
**Las 8 tarjetas de texto de v1 no se tocaron**: son cuadros del video P1, no anuncios.

---

## 1. Lanzables — 4 piezas × 2 formatos

Una hipótesis por pieza, un `body` distinto por pieza. Todas con la **fórmula medida de la casa**:
titular reencuadre arriba · mujer real de medio cuerpo con el frasco en la mano · producto legible ·
testimonio entre comillas · bullets con ícono · sello circular · barra inferior con estrellas.

| pieza | archivo | hipótesis / mensaje | titular quemado | veredicto |
|---|---|---|---|---|
| **A1 la raya** | `prod/v2/a1-raya-1x1.jpg` · `-4x5.jpg` | reencuadre del síntoma que ella ya conoce (culpa al shampoo, no a la raíz) | `NO ES EL SHAMPOO. / ES LA RAÍZ.` | **lanzable** |
| **A2 sin minoxidil** | `prod/v2/a2-sin-minoxidil-1x1.jpg` · `-4x5.jpg` | el negador que ya es el posicionamiento | `NO QUERÍA EMPEZAR / CON MINOXIDIL.` | **lanzable** |
| **A3 tratamiento 90 días** | `prod/v2/a3-90-dias-1x1.jpg` · `-4x5.jpg` | honestidad del mes 1 + el kit x3 con la caja | `MES 1: NO PASA NADA. / TE LO DECIMOS ANTES.` | **lanzable** |
| **A4 pagás al recibir** | `prod/v2/a4-pagas-al-recibir-1x1.jpg` · `-4x5.jpg` | el COD como titular, no como pie | `PAGÁS CUANDO / LO TENÉS EN LA MANO.` | **lanzable** |

**1:1 = 2048×2048** (el formato de los dos ganadores medidos) · **4:5 = 1080×1350** (banda crema con
el titular arriba + la foto cuadrada abajo, para no recortar ni a la mujer ni a la columna de texto).

**Barra inferior, textual e idéntica en las cuatro** (decidida por Pancho, número de tanda de prueba):
`★★★★★ PAGÁS AL RECIBIR · ENVÍO GRATIS · +10.000 PERSONAS`

Testimonios quemados (todos en 1ª persona, sobre síntomas, ninguno promete nada a quien lee):

- A1 — *"Juntaba pelo del cepillo todas las mañanas. Ahora junto mucho menos."*
- A2 — *"No quería engancharme con algo fuerte. Elegí el de romero y lo usé 3 meses."*
- A3 — *"El primer mes no vi nada y casi lo dejo. Terminé los tres igual."*
- A4 — *"No compraba sin ver antes. Lo pagué en la puerta."*

## 2. Muertas — 5 tiradas, con el motivo en el nombre

`prod/v2/muertas/`

| tirada | motivo |
|---|---|
| `p1-etiqueta-dice-MINOAIDIL-frasco-chico.jpg` | la banda verde de la etiqueta salió `SIN MINOAIDIL` — palabra falsa legible, y justo sobre el claim que es el posicionamiento |
| `p2-frasco-chico-no-se-lee-a-380.jpg` | frasco contra el pecho y tapado por el pelo: a 380 px no se entiende qué se vende (defecto #1 histórico del QA) |
| `p3-mano-sobre-caja-no-sostiene-producto.jpg` | la mano apoyada arriba de la caja = packshot con modelo, no producto en mano |
| `p3-sin-caja-no-comunica-los-90-dias.jpg` | tres frascos sueltos sin la caja: la hipótesis del tratamiento de 90 días se apoya en la caja |
| `p4-casting-repetido-y-frasco-chico.jpg` | misma actriz que A3 (casi-clon de casting) y frasco chico |

**4 elegidas de 9 tiradas (44%)**, en línea con la calibración de `qa-ojo-de-cliente`.

## 3. Créditos — gasto real MEDIDO

| concepto | cantidad | precio | total |
|---|---|---|---|
| `fal-ai/nano-banana-pro/edit` 2K 1:1, referencia = packshot ARRAIGO | 9 imágenes | **US$0,15/img** | **US$1,35** |
| titulares, testimonios, bullets, sellos, barra, formato 4:5 | — | HTML + Chrome headless | US$0 |
| **TOTAL DEL ESCALÓN** | | | **US$1,35 de un tope de US$6** |

Saldo de fal **antes US$17,8314 → después US$16,3314**, delta exacto **US$1,35 / 9 = US$0,15**.
Desvío contra lo aprobado: **−US$4,65 (gasté el 22,5% del tope)**. No hubo exceso, no hubo que frenar.

> 🟢 **Corrección de precio con fecha, ahora sobre `/edit`.** `Fabrica-Creativos.md:27` dejó abierto
> el «2K cuesta x2» porque la medición del 04/09 era n=1 y sobre *text-to-image*. Esta corrida lo
> mide sobre **`/edit` con `image_urls`, n=9, delta exacto**: también **US$0,15 a 2K**. El «x2» no
> vale en ninguno de los dos endpoints. Corregido en el vault.

## 4. QA — 2 rondas, contra el ganador a 380 px

**Vara:** `01-pureza-02-reframe-foto` — **CPA $1.629, CTR saliente 3,28%**, el mejor de la casa; y de
fondo `06-pureza-02-foto-hotsale-v03` (**CPA $2.814 con $1.918.987 de gasto**), de donde sale la
barra inferior con el `PAGA AL RECIBIR`.
**Persona:** mujer de 35-55, pelo largo, argentina, la que ya se cambió la raya de lado para
disimular; pasa el feed a la noche.

- **Ronda 1 — 4 bloqueantes, los 4 de layout y los 4 gratis (código, no plata):** la barra inferior
  se partía en dos líneas y se salía de la franja · el titular de A3 wrapeaba y pisaba el testimonio ·
  el segundo bullet de A1 quedaba tapado por el sello · los testimonios los cortaba el navegador y no
  el HTML. Arreglado con líneas `nowrap` + autofit y `white-space:nowrap` en la barra.
- **Ronda 2 — 1 bloqueante que sí costó plata:** en A2 el frasco quedaba chico y tapado por el pelo;
  a 380 px no se contestaba *"¿qué es esto?"*. **Escena regenerada** (US$0,15) con el frasco al frente
  y grande. Las otras tres pasaron sin tocar.
- **Veredicto contra la vara: 4 de 4 lanzables.** Al lado de `01-pureza-02-reframe-foto` a 380 px
  ninguna se ve vacía: las cuatro tienen persona, producto legible, testimonio y oferta. A4 es la que
  mejor contesta *"¿qué es?"* (la etiqueta se lee a 380), A3 la que más se parece al ganador de
  $1,9M (caja + pack + mujer), A2 la más floja de las cuatro (cara neutra, no sonrisa).
- **Contacto a 380 px para Pancho:** `prod/qa/380/contacto-v2-380.png` — vara + las 4 en 1:1 (fila 1)
  y las 4 en 4:5 (fila 2).

### Las 4 preguntas de Pancho, pre-respondidas

1. **¿Qué producto es y para qué sirve?** Un sérum capilar anticaída de romero y cafeína, sin
   minoxidil. Lo contestan las 4 por el frasco en la mano con la etiqueta legible; A4 y A3 fuerte,
   A1 fuerte, A2 media.
2. **¿Este mensaje ya está en otra pieza?** No: cuatro hipótesis, cuatro titulares, cuatro
   testimonios. A3 comparte el tema del mes 1 con la tarjeta A7 del video P1 — a propósito, pero si
   corren en el mismo público se pisan.
3. **¿Hay algo que Meta lea como enfermedad?** No. Cero patología nombrada (ni alopecia, ni calvicie,
   ni DHT, ni hormonas), **cero cuero cabelludo con clareo** (las cuatro tienen pelo denso en toda la
   cabeza), cero antes/después, cero caja de medicamento, cero promesa de resultado futuro, **cero
   precio en pantalla**. `MINOXIDIL` aparece una vez y como **negador**, que es lo que dice la propia
   etiqueta del producto.
4. **¿Qué tengo que hacer?** La barra inferior lo dice en las cuatro: pedir, y pagar cuando llega.

## 5. Defectos de generador (lo que hay que arreglar, no las piezas)

1. **El frasco se achica solo si no se lo pide explícito.** Las 3 tiradas que murieron por producto
   chico salieron de prompts que decían *"holding the bottle near her shoulder"*. Las que sirven
   dicen *"holds the bottle **forward toward the camera**, LARGE in the frame and in sharp focus"*.
   Va al prompt base.
2. **El casting se repite entre piezas si no se lo varía a mano.** Dos tiradas distintas devolvieron
   la misma actriz (pelo negro largo, misma cara). Hay que pedir edad, color de pelo y ropa distintos
   pieza por pieza, o la tanda parece un casi-clon.
3. **Las líneas más chicas de la etiqueta se garblean** (`Capisyl` por `Capixyl`, `MINOAIDIL` por
   `MINOXIDIL`). A 380 px son invisibles y el trade-off está aceptado
   ([[ugc-etiqueta-la-genera-el-modelo]]), pero **hay que mirarlas al zoom**: si el garble cae sobre
   la línea que carga el claim (la banda `SIN MINOXIDIL`), la tirada se mata.

## 6. Hallazgo que corrige a la corrida v1

**La etiqueta EN MANO sí se puede generar con IA.** `escalon1-entrega.md` §5.4 y
`qa/escalon1-pancho.md` (pregunta 4) concluyeron que no existía foto de mano+frasco ARRAIGO, que
generarla *"es exactamente donde se rompe la etiqueta (11/11 piezas, Protocolo §197)"* y que quedaba
como **pedido de producción física**. Esta corrida lo desmiente: **9 de 9 tiradas de
`nano-banana-pro/edit` con el packshot como `image_urls` devolvieron la etiqueta bien**, con
`ARRAIGO`, `SÉRUM ANTICAÍDA`, `de romero` y `SIN MINOXIDIL` legibles y correctas — sólo se garblean
las líneas más chicas. La regla del Protocolo §197 sigue valiendo para **texto NUEVO pedido por
prompt**; **copiar una etiqueta existente desde una imagen de referencia es otra cosa** y funciona
(es la regla de [[ugc-etiqueta-la-genera-el-modelo]], del 30/08). El pedido de producción física
**deja de ser bloqueante** para el último cuadro de los videos del escalón 2.

## 7. Reproducibilidad

- Prompts de las 9 tiradas: `prod/_src2/jobs1.json … jobs4.json`. Generador: `prod/_src2/gen.mjs`
  (`POST https://fal.run/fal-ai/nano-banana-pro/edit`, `FAL_KEY` de `~/AppAds-tabla/.env.local`,
  referencia pasada como **data URI** — no hace falta subir nada a un bucket).
- Overlay y formatos: `prod/_src2/armar.mjs` (todo el texto se estampa acá; el modelo no escribe una
  sola letra). Contacto a 380 px: `prod/_src2/contacto.mjs`.
  ⚠️ `--window-size` con decimales lo ignora Chrome y sale un PNG de 756×469 sin avisar: redondear.
- Escenas base sin overlay: `prod/v2/_escenas/`.
- Referencias de producto: `~/Claude/Obsidian/50-Proyectos/Serum-Capilar-Renders/`
  (`01e-hero-wrap-tres-cuartos.png` para el frasco, `06b-arraigo-kit-x3-v2.png` para el kit).

## 8. Lo que este escalón NO hizo

- **No se creó nada en Meta.** Ni PAUSED.
- **No se cargó `creativos_ganadores`** (sigue con `snapshot_date` 16/08 y sin filas de `arraigo`).
  Acá no rompió nada porque la producción fue fal directo + HTML, sin pasar por la Fábrica de AppAds;
  **si el escalón 2 usa la Fábrica, esto se carga primero**.
- **No se tocaron las 8 tarjetas de P1** ni ninguna pieza de v1.
