# ARRAIGO · Escalón 1 — entrega (04/09/2026)

**OK ejecutado (textual):** `OK escalón 1: 8 tarjetas de P1 + estáticas E4, E8, E6-mujer + E1 y E7
para retargeting + gasto US$2-4 en fal.ai (nano-banana-pro) + nada se pautea; E6-hombre queda para
ronda 2` — Pancho, 04/09/2026.

**Nada se lanzó, nada se pauteó, no se tocó ninguna cuenta publicitaria.** Si Pancho quiere lanzar,
el camino es `meta-operador` (`scripts/lanzar.mjs`), y el tramo C/D no arranca hasta que pase el
gate 1.7.

---

## 1. Qué quedó lanzable

| pieza | archivo | formato | mensaje / body | veredicto |
|---|---|---|---|---|
| **E4** | `prod/e4/e4-4x5.png` | 1080×1350 | `copyE4` · M-B honestidad del mes 1 | **lanzable** (tramo C) |
| E4 9:16 | `prod/e4/e4-9x16.png` | 1080×1920 | idem | producida, **no se carga** (§2.2) |
| **E8** | `prod/e8/e8-4x5.png` | 1080×1350 | `copyE8` · F-E8 el infográfico que transfiere de Pureza | **lanzable** (tramo C) |
| E8 9:16 | `prod/e8/e8-9x16.png` | 1080×1920 | idem | producida, **no se carga** |
| **E6 mujer** | `prod/e6/e6-raya-4x5.png` | 1080×1350 | `copyC` · M-D identificación por el detalle físico | **lanzable** (tramo C) |
| E6 9:16 | `prod/e6/e6-raya-9x16.png` | 1080×1920 | idem | producida, **no se carga** |
| **E1** | `prod/e1/e1-4x5.png` | 1080×1350 | `copyM4` · M-A anti-riesgo COD | **lanzable, solo retargeting** (tramo D) |
| **E7** | `prod/e7/e7-4x5.png` | 1080×1350 | `copyE7` · prueba indirecta | **lanzable, solo retargeting** (tramo D) |

**Tarjetas de P1 — 8 de 8 aptas para montaje** (`prod/p1/tarjetas/A1.png … A8.png`, 1080×1920):

| id | texto quemado | uso |
|---|---|---|
| A1 | `Probé un sérum de romero 90 días` / `antes de rendirme.` + `Mes 1: nada.` | master 0:00-0:05 |
| A2 | `DÍA 1` | 0:05-0:10 |
| A3 | `SEMANA 2` | 0:10-0:16 |
| A4 | `MES 1` | 0:16-0:21 |
| A5 | `MES 2` | 0:21-0:25 |
| A6 | `MES 3` | 0:25-0:28 |
| A7 | `Mes 1:` / `no vas a ver nada.` / `Te lo digo antes.` | bumper C9 |
| A8 | `DÍA 0` | **de más, ver §5** |

> ⚠️ **8 contra 7 — la única discrepancia entre el OK y el plan.** El paso 1.1 de `06-plan-exacto.md`
> especifica **7 tarjetas (A1-A7)** y dice explícitamente que *"la tarjeta `DÍA 0` sale con el beat de
> la puerta del arranque"*. El OK de Pancho dice **8**. Se produjeron las 7 del plan **más A8 = `DÍA 0`**
> para que el conteo cierre: cuesta US$0, es un render HTML, y el montaje del escalón 2 (§2.5) usa 7,
> así que A8 queda de repuesto. **Si el 8 era otra cosa, decilo y se hace: son 5 minutos.**

> **Nota de montaje:** las 8 tarjetas son **crema opaca a cuadro completo**, como pide el paso 1.1
> ("fondo crema de marca"). El montaje §2.5 las describe *sobre* b-roll (`B3 + DÍA 1`). Si el editor
> del escalón 2 las necesita con fondo transparente, es **una línea** en
> `prod/_src/tarjeta-A*.html` (sacar `background` del `body`) y volver a capturar.

## 2. Qué se descartó, y por qué

Solo hubo descartes en E6, que es la única pieza donde intervino IA generativa:

| tirada | archivo | motivo |
|---|---|---|
| t1 | `prod/muertas/e6/e6-t1-tercera-figura-en-el-espejo.jpg` | tercera figura reflejada (se leen 3 personas a 380 px) + el reflejo tiene los dos brazos arriba y el primer plano uno solo + dominante ámbar |
| t2 | `prod/muertas/e6/e6-t2-pelo-encrespado-reflejo-no-coincide.jpg` | pelo encrespado y seco, contradice "peinado y abundante"; el reflejo no repite la pose |
| t4 | `prod/muertas/e6/e6-t4-cuero-cabelludo-visible-en-la-raya.jpg` | **regla dura del OK**: el peine abre una franja de cuero cabelludo visible en la raya |
| **t3** | `prod/e6/tiradas/t3.jpg` (y `prod/e6/escena-mujer.png`) | **ELEGIDA** |

**1 de 4 (25%)**, en línea con la calibración del filtro `qa-ojo-de-cliente`.

## 3. Créditos: gasto real y precio MEDIDO hoy

| concepto | cantidad | precio | total |
|---|---|---|---|
| `fal-ai/nano-banana-pro` (text-to-image) 2K, 4:5 — tiradas de E6 | 4 imágenes | **US$0,15/img (MEDIDO 04/09/2026)** | **US$0,60** |
| íconos de E8 | 0 | dibujados por código (SVG) | US$0 |
| tarjetas, E4, E1, E7, overlays y franjas | — | HTML + Chrome headless | US$0 |
| **TOTAL DEL ESCALÓN** | | | **US$0,60 de un tope de US$4** |

**El precio se midió, no se estimó** (memoria `costos-ia-medir-no-estimar`): saldo de fal antes de la
4ª tirada **US$17,8314** → después **US$17,6814** → **delta exacto US$0,15 por imagen 2K 4:5**.
Ojo: `https://rest.alpha.fal.ai/billing/user_balance` **actualiza con ~1 minuto de retraso** — leído
inmediatamente después de la llamada da el saldo viejo y parece que costó US$0.

> 🔴 **Corrección de precio con fecha.** `20-Ads/Fabrica-Creativos.md:27` afirma *"1K ~US$0.15/img;
> **2K cuesta x2**"* y `Tanda-APLOMO-2026-08-26.md` registra 2K = US$0,30 (27-31/07/2026). **Medido el
> 04/09/2026, `fal-ai/nano-banana-pro` text-to-image a 2K sale US$0,15**, no US$0,30. Es **n=1** y
> sobre el endpoint **text-to-image**, no sobre `/edit` — no se toca el precio de `/edit`, se anota
> el dato. Si la próxima corrida vuelve a medir 0,15, ahí sí se corrige la afirmación.

Desvío contra lo aprobado: **−US$1,40 a −US$3,40 (gasté 15-30% del tope)**. La regla del >20% aplica
al exceso; acá no hubo exceso y no hubo que frenar.

## 4. QA

- `prod/qa/escalon1.md` — QA ojo de cliente completo, con persona y vara.
- **Vara usada:** `pureza-02-mix-base-v02` — la estática que hoy vende en la casa, **CTR 6,08% ·
  CPA $3.067**. Su arquitectura (dos columnas, *Problemas* ilustrados contra *Solución* con el envase
  enorme) es la que se copió en E8 después de mirarla.
- **Ronda 1: 5 lanzables de 5, 0 bloqueantes → no hizo falta ronda 2.** La tasa alta es esperable
  acá: 4 de las 5 piezas son 100% render por código sobre assets ya aprobados, sin lotería de
  artefactos. Donde sí hubo lotería (E6) la tasa fue **1 de 4**.
- **Los 3 defectos de generador** (esto es lo que hay que arreglar, no las piezas):
  1. **El producto llega chico y llega al pie.** Franja de 186 px contra una vara donde el envase
     ocupa media pieza **y está en una mano**.
  2. **Ícono plano de una línea = ruido a 380 px** (E8). La vara usa ilustración con relleno y color.
  3. **Cero prueba social en las 5 piezas.** El número aprobado (`+10.000 Personas pagaron al recibir`)
     vive solo en la descripción del link, que a 380 px casi no se ve.
- `prod/qa/escalon1-pancho.md` — las 4 preguntas del gate 1.7 con la pre-respuesta del productor.
  **Falta que las conteste Pancho** sobre `prod/qa/380/contacto-estaticas-380.png` y
  `prod/qa/380/contacto-tarjetas-380.png`.

## 5. Decisiones tomadas en la corrida (todas contra el plan, todas explicadas)

1. **Los íconos de E8 se dibujaron por código, no con fal.** El paso 1.3(c) presupuestaba
   US$0,15-0,30 en una tirada de "tres íconos planos en fila". Un SVG de tres trazos hace lo mismo,
   sale US$0, sale on-brand exacto y **elimina el riesgo de que la IA dibuje una cabeza con parche**
   (que el propio plan prohíbe). El ahorro es chico; lo que se gana es determinismo.
2. **Las tiradas de E6 se hicieron con `fal-ai/nano-banana-pro` (text-to-image), no con
   `/edit`.** El paso 1.4 dice `/edit`, pero `/edit` **exige `image_urls`** y la única referencia
   disponible era la portada de la landing — meter el frasco de referencia en una escena de baño
   donde el producto no aparece es pedirle al modelo que dibuje una etiqueta, que es exactamente
   donde se rompe (11/11 piezas, Protocolo §197). El endpoint t2i existe y responde 200.
3. **E8 se rehizo después de mirar la vara.** La primera versión (dos columnas de texto con una foto
   chica de mano+gotero) no contestaba *"¿qué producto es?"* a 380 px. La versión entregada copia la
   arquitectura de `pureza-02-mix-base-v02`: panel crema con los 3 síntomas ilustrados contra panel
   verde con **el frasco real grande y la etiqueta legible**.
4. **La "foto real: mano + frasco" del paso 1.3(b) se reemplazó por el packshot real de la landing.**
   No existe en el repo una foto real de una mano sosteniendo el frasco ARRAIGO, y generarla es el
   caso prohibido. El packshot (`frasco-alpha.png`, el mismo que se publicó en ML el 21/08 y que dice
   *Cafeína* y *Capixyl™* bien) resuelve la pregunta del producto sin tocar la etiqueta.
   **Queda como pedido de producción: sacar una foto real de mano + frasco.** La necesita también el
   último cuadro de los 4 videos del escalón 2.
5. **A8 = `DÍA 0`**, ver el aviso del §1.
6. **Se limpió la sombra horneada del packshot.** `frasco-alpha.png` traía recortada la sombra sobre
   crema; sobre el verde de la franja aparecía como una mancha beige. La versión limpia vive en
   `prod/_src/frasco.png` y la usan las 5 piezas.

## 6. Lo que este escalón NO hizo y bloquea lo que sigue

- 🔴 **`creativos_ganadores` está vieja y no tiene ARRAIGO.** `snapshot_date` = **16/08/2026** (19 días)
  y **cero filas de producto `arraigo`**. Acá no rompió nada porque la producción fue fal directo +
  HTML, sin pasar por la Fábrica. **Si el escalón 2 usa la Fábrica de AppAds, esto se carga primero**
  o la Fábrica imita otra cosa (memoria `fabrica-lee-creativos-ganadores`). Es el paso 1.3(a), que
  quedó sin hacer porque no hizo falta para producir.
- **E6-hombre no se produjo** (así lo dice el OK). El prompt guardado para la ronda 2 está en el
  paso 1.4 del plan.
- **E5 no se produjo**: su pieza es el precio y la landing no se toca (decisión de Pancho 03/09).
- **No se creó nada en Meta.** Ni PAUSED.

## 7. Datos de contexto que cambiaron hoy y no contradicen ninguna pieza

- Descripción del link de las piezas nuevas: **`Envío Gratis · +10.000 Personas pagaron al recibir`**
  (decisión de Pancho 04/09; número de tanda, no auditado — lo medido son ~9.300). Va en la
  descripción del link, **no quemado en la imagen**: ninguna pieza lo muestra. ✓
- Escalera nueva: x1 $49.900 · x2 $64.990 · x3 $79.990 con aplicador de regalo. **Ninguna pieza
  muestra precio**, así que nada que corregir. ✓ El único `$` del lote es el `$0` de E1.
- Garantía de 90 días: se puede decir. **No se usó en ninguna estática** (los textos quemados de §2.4
  no la llevan); vive en los bodies. ✓

## 8. Fuentes y reproducibilidad

- HTML y CSS de todas las piezas: `prod/_src/` (`marca.css`, `ajustar.js`, `tarjeta-A*.html`,
  `e4.html`, `e6.html`, `e7.html`, `e8.html`, `e1.html`). Se re-capturan con
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars
  --window-size=1080,1350 --screenshot=<png> file://<html>`.
  ⚠️ **Chrome cachea el CSS de `file://`**: si se edita `marca.css` y se vuelve a capturar sin cambiar
  la URL, sale el render viejo sin avisar. Copiar `_src` a un directorio temporal nuevo antes de cada
  captura (se comió dos rondas de correcciones en esta corrida).
- Assets de origen: `~/Downloads/arraigo-ml-galeria/html/` (packshot `frasco-alpha.png`, `paso1.jpg`,
  `problema.jpg`) y `docs/creativos/arraigo-tanda-0608/est-cepillo-mes1-mes3.png` (panel izquierdo, E7).
