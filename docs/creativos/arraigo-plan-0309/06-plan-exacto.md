# ARRAIGO · 06 — Plan exacto de ejecución (03/09/2026)

Agente 6 de la cadena. **No analizo ni reabro decisiones: reorganizo el 05 para que un operador lo ejecute sin
abrir el 05.** Donde el 05 dejó algo ambiguo o dos partes se contradicen, decido y lo marco con
"(decidido en 06: …)". **100% plan: nada generado, gastado ni lanzado; Meta y Veltron sin tocar.** Fechas
absolutas, rangos donde hay rango, ningún decimal inventado.

**Ajustado el 03/09/2026 con dos rondas de decisiones de Pancho, marcadas en el texto:**
(a) *(decisión de Pancho 03/09: la landing se queda como está)* — la landing no se toca en ningún escalón; el test
mide creativos con la landing como constante. (b) *(decisión de Pancho 03/09: la tanda va en R2, $25.000/día por ad
set, masters cortos, la garantía entra)* — cuenta **Tienda R2** sin el impuesto del 36,4%, presupuesto por ad set
**$25.000/día**, masters de **28-32 s** (P3 ~40 s) con **dos anuncios por ad set** (master + bumper de 8-10 s), y la
**garantía de 90 días entra en ronda 1** porque la landing la enuncia textual.

Insumos leídos enteros: `00-contexto.md`, `04b-datos-veltron-corregidos.md`, `05-plan-produccion.md`. Por grep:
`01`, `02`, `03`, el Runbook `50-Proyectos/Runbook-Lanzar-Anuncios-API.md` (§6 quater, ARRAIGO 05/08/2026), el
lanzador `~/AppAds-tabla/scripts/lanzar.mjs` (118 líneas, leído entero) y el esquema de `biolabs-finanzas`.

---

## 1. Resumen para Pancho

1. Se lanza **una tanda de ARRAIGO en Tienda R2** (`act_880189106877616`, la cuenta **sin** el impuesto del 36,4%)
   con **4 hipótesis de mensaje × 4 formatos**: 5 videos-hipótesis (**P0 = la réplica exacta del anuncio medido de
   agosto**, reusando su post por `object_story_id`, a US$0 *(decisión de Pancho 04/09: se reusan los post IDs)* ·
   P1 diario "Mes 1" en tarjetas · P2 "la puerta" b-roll · P3 "después de los 45" con cara HeyGen · P4 "la colita",
   opcional) + **3 estáticas frías** (E4, E8, E6) + **2 de retargeting** (E1, E7) cuando haya pool.
2. **14 anuncios** (9 de video: P0 uno solo; P1, P2, P3 y P4 con **master + bumper**, dos por ad set · 3 estáticas ·
   2 retargeting), en **9 ad sets** (7 frío + P4 opcional + 1 retargeting) dentro de **1 campaña ABO** nueva. Todo
   nace **PAUSED**. Masters cortos: P1 32 s · P2 32 s · P3 40 s · P4 32 s, con bumper de 8-10 s cada uno
   *(decisión de Pancho 03/09: masters cortos; agosto midió tiempo medio 5-8 s y ThruPlay 18-29%)*.
3. **Producción: US$24-29 en fal.ai** (escalón 1 US$2-4 + escalón 2 US$16-18 + escalón 3b US$6-7) **+ ~44 créditos
   HeyGen** (sonda ~14 + pieza ~30, a medir) **+ 1 sonda Seedance**; con P4: **US$31-37**. **Pauta: tramo A $225.000 → B +$75.000 → C +$225.000 (con gate) → D hasta $25.000**; máximo
   si se abren los cuatro: **$550.000** (con P4: **$625.000**).
4. **Orden de OKs** (§6, texto literal cada uno): **escalón 0** crear la campaña y el ad set P0 en Meta reusando el
   post de agosto por `object_story_id` *(decisión de Pancho 04/09: se reusan los post IDs)* — no se resube nada —,
   PAUSED ($0, no gasta) → **escalón 1** US$2-4 (**el primero que gasta**) → **escalón 2** US$16-18 + sonda →
   **escalón 3a** sonda HeyGen ~14 créditos → **3b** el número que devuelva la sonda → **pauta A** $225.000 →
   **B** +$75.000 → **C** +$225.000 solo con LPV→IC > 8% contra la landing actual → **D**. **2b (P4, US$7-8) es
   opcional**, solo si sobra un slot.
5. **La landing no se toca en ningún escalón** *(decisión de Pancho 03/09: la landing se queda como está)*. A favor:
   el test mide creativos con la landing como **constante**, así que las anclas de agosto —LPV→IC 8,0%, $/LPV
   $149-324, 2,54 IC por compra— siguen válidas **si P0 las reproduce** (gate de replicación, §4.5; *(decisión de Pancho 04/09: se reusan los post IDs)*: P0 pasó a ser la réplica exacta del anuncio medido, así que
   esto ahora se mide en vez de suponerse). En contra, asumido: las reseñas inventadas y el "+3.569"
   quedan (riesgo de rechazo por landing, §9) y cuotas_3 sigue visible (arrastre conocido entre pedido creado y
   entregado, §7). **La garantía de 90 días sí entra** en guiones y bodies: la landing la enuncia textual.
6. **En R2 nominal = real**: sin el 36,4% de R3, el objetivo de $6.000 por pedido es plata real y el equilibrio por
   IC vuelve a **$2.360 limpio**. A $25.000/día por ad set, 72 h son $75.000 → el corte de "pasa" es **32 IC**.
7. **La palanca del COD nunca es el hook**: va en el cierre de audio de las 5 piezas ("recién ahí le pagás al que te
   lo trajo. Y tenés noventa días de garantía"), en el body de las 8, en el pie de las estáticas
   (`ENVÍO GRATIS · PAGÁS AL RECIBIR`) y en la imagen de la puerta como último cuadro. Cobro en puerta, respondido por
   Pancho: **QR de Mercado Pago en todo el país; en CABA y GBA además efectivo** → los creativos dicen **"sin tarjeta"**
   y **"pagás cuando te llega"**; el efectivo solo se nombraría en un ad set de solo AMBA. Ningún creativo nombra
   cuotas ni precio.

---

## 2. La lista exacta de anuncios

### 2.1 Constantes (valen para las 14 filas)

| campo | valor |
|---|---|
| cuenta | **Tienda R2 · `act_880189106877616`** *(decisión de Pancho 03/09: la tanda va en R2 — sin el impuesto del 36,4%; ver §3.0)* |
| página / IG | página BioLabs **`824765737394913`** (la misma en las dos cuentas) · `instagram_user_id` se lee del creative de agosto |
| campaña | `ARRAIGO · ABO Open · DD-MM` (DD-MM = día de arranque del tramo A, ver §3.1) |
| headline (`title`) | `Envío Gratis 📦` |
| descripción (`link_description`) | `Envío Gratis · +10.000 Personas pagaron al recibir` — **decisión de Pancho 04/09**. Es un número de tanda de prueba, no auditado: lo medido al 04/09/2026 son ~9.300 pedidos entregados y cobrados en la puerta desde el 03/12/2025 (17.396 despachados en Shopify × 53,7% de entrega medida entre el 06/05 y el 04/09, ventana en la que 9.894 despachos dieron 5.308 entregados). Llega a 10.000 real en 1-2 semanas a 60-100 entregas/día. **P0 no lo lleva**: su descripción vive dentro del post de agosto (`Envío gratis · Pagá al recibir`) y no se puede cambiar. |
| CTA | `GET_OFFER_VIEW` |
| landing | `https://biolabsarg.com/products/serum-anticaida-romero-arraigo` — tal como está hoy (decisión de Pancho 03/09: la landing se queda como está) |
| `url_tags` | `utm_content={{ad.id}}` — **salvo P0**, que no lo puede llevar (nota de abajo) |
| `conversion_domain` | `biolabsarg.com` |
| píxel / evento | `781630351556303` / `PURCHASE` |
| estado al nacer | **PAUSED** (campaña, ad sets y anuncios) |
| presupuesto por ad set frío | **$25.000/día** (ABO) *(decisión de Pancho 03/09: $12.000 no sale de aprendizaje)* |

**P0 es la excepción a las cinco constantes de texto y destino** *(decisión de Pancho 04/09: se reusan los post IDs)*: su creative
se arma con `object_story_id` sobre el post de agosto, y **en un creative por `object_story_id` el body, el título,
la descripción, el CTA y el link viven en el post — no se pasan, no se cambian, y el creative tampoco admite
`url_tags` propios**. Lo único nuestro en P0 es el nombre del anuncio, el ad set (targeting, presupuesto, píxel) y
el `conversion_domain`, que va en el **ad** y no en el creative. La consecuencia de atribución está en §4.5.

Convención de nombres (Runbook §6 quater): ad set `arraigo-OPEN-AR-3060-<contenido>-<budget>k`; anuncio
`arraigo-<visual>-<copy>-<hipótesis>-<corte>` (`A32` = master de 32 s; `C9` = bumper de 9 s; `est` = estática 4:5).

### 2.2 Tabla

Hipótesis: **M-A** anti-riesgo COD · **M-B** honestidad del mes 1 · **M-C** después de los 45 (3ª persona) ·
**M-D** identificación por el detalle físico · **F-E8** formato "el infográfico de Pureza transfiere".
Formatos: **F1** UGC con persona (medido) · **F2** tarjetas por código + objetos · **F3** b-roll + voz en off ·
**F4** cara hablando (HeyGen) · **EST** estática. El body va por ID → texto completo en §2.3.

| # | nombre final | hip. | fmt | duración · aspecto | hook, palabra por palabra | body | ad set | $/día | esc. | tramo |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `arraigo-ugcB-copyD-replica-A18` | M-A | F1 | 18,5 s · 1080×1350 — **el post de agosto reusado tal cual**, `object_story_id` `824765737394913_122139167943156780`; no se resube ni el MP4 ni la miniatura *(decisión de Pancho 04/09: se reusan los post IDs)* | el del archivo `ugcB` (voz Malena; cuadro 0 con subtítulo «SIN MINOXIDIL»). **No se toca ni se recorta**: es la réplica del anuncio medido | **copyD** (viene del post; no se escribe) | `arraigo-OPEN-AR-3060-p0-ugcB-25k` | 25.000 | 0 | A |
| 2 | `arraigo-diario-copyM1-mes1-A32` | M-B | F2 | **32 s** · 9:16 | «Probé un sérum de romero para la caída. Te cuento el mes uno.» sobre el cepillo cenital + tarjeta `Mes 1: nada.` | copyM1 | `arraigo-OPEN-AR-3060-p1-diario-25k` | 25.000 | 2 | A |
| 3 | `arraigo-diario-copyM1-mes1-C9` | M-B | F2 | **9 s** · 9:16 = tarjeta `Mes 1: no vas a ver nada. Te lo digo antes.` + cepillo (3 s) + puerta (5 s) | audio: «Semana dos: no vas a ver nada. Te lo digo antes de que lo pidas.» + «No pagás hasta tenerlo en la mano. Noventa días de garantía.» | copyM1 | idem | — | 2 | A |
| 4 | `arraigo-puerta-copyAR-antiriesgo-A32` | M-A | F3 | **32 s** · 9:16 | «Un sérum para la caída del pelo que no pagás hasta tenerlo en la mano.» sobre el cepillo cenital | copyAR | `arraigo-OPEN-AR-3060-p2-puerta-25k` | 25.000 | 2 | A |
| 5 | `arraigo-puerta-copyAR-antiriesgo-C9` | M-A | F3 | **9 s** · 9:16 = cepillo (3 s) + la caja que se abre (3 s) + el pago en la puerta (3 s) | audio: «Un sérum para la caída del pelo que no pagás hasta tenerlo en la mano.» + «Recién ahí le pagás. Noventa días de garantía.» | copyAR | idem | — | 2 | A |
| 6 | `arraigo-pelu-copy45-despues45-A40` | M-C | F4 | **40 s** · 9:16 | «Mi clienta de los jueves tiene cincuenta y dos. Me pidió que le corte más corto para que no se note la caída. Le dije que no.» (avatar a cámara, tijera en mano) | copy45 | `arraigo-OPEN-AR-3060-p3-pelu45-25k` | 25.000 | 3 | B |
| 7 | `arraigo-pelu-copy45-despues45-C9` | M-C | F4 | **9 s** · 9:16 = 0:00-0:05 + 0:35-0:40 | idem #6 (recorte desde «Me pidió que le corte más corto») | copy45 | idem | — | 3 | B |
| 8 | `arraigo-colita-copyCOL-identif-A32` | M-D | F3 | **32 s** · 9:16 | «Hay algo que nadie te dijo de la caída del pelo: la colita no se afina de golpe. Se afina de a una vuelta de elástico.» | copyCOL | `arraigo-OPEN-AR-3060-p4-colita-25k` | 25.000 | 2b | A' (solo si hay slot) |
| 9 | `arraigo-colita-copyCOL-identif-C10` | M-D | F3 | **10 s** · 9:16 = 0:00-0:04 + 0:23-0:26 + 0:29-0:32 | idem #8 | copyCOL | idem | — | 2b | A' |
| 10 | `arraigo-e4mes1-copyE4-mes1-est` | M-B | EST | 4:5 1080×1350 (el 9:16 se produce y queda en `prod/e4/`, no se carga) | texto quemado: `Mes 1: estoy igual.` | copyE4 | `arraigo-OPEN-AR-3060-e4-mes1-25k` | 25.000 | 1 | C |
| 11 | `arraigo-e8comparativa-copyE8-formato-est` | F-E8 | EST | 4:5 (idem) | texto quemado: `LO QUE VES \| LO QUE HACE ARRAIGO` | copyE8 | `arraigo-OPEN-AR-3060-e8-comparativa-25k` | 25.000 | 1 | C |
| 12 | `arraigo-e6raya-copyC-identif-est` | M-D | EST | 4:5 (idem) | texto quemado: `Si ya cambiaste la raya de lado, esto es para vos.` | copyC | `arraigo-OPEN-AR-3060-e6-raya-25k` | 25.000 | 1 | C |
| 13 | `arraigo-e1cero-copyM4-rtg-est` | M-A | EST | 4:5 | texto quemado: `HOY PAGÁS` / `$0` / `Lo pagás cuando lo tenés en la mano.` | copyM4 | `arraigo-RTG-LPV30d-5k` | 5.000 | 1 (US$0) | D |
| 14 | `arraigo-e7cepillo-copyE7-rtg-est` | prueba indirecta | EST | 4:5 (panel izquierdo de `est-cepillo-mes1-mes3.png`, ya aprobado en agosto) | texto quemado: `Contá los pelos que quedan en el cepillo hoy.` / `Volvé a contar en 60 días.` | copyE7 | idem | — | 1 (US$0) | D |

Notas de conteo: **el conteo no cambia con el reuso del post — siguen siendo 14 anuncios en 9 ad sets**
*(decisión de Pancho 04/09: se reusan los post IDs)*. **P0 es un solo anuncio** (el 05 §A.6 lo cuenta así); recortarlo
rompería la réplica, y además un creative por `object_story_id` entra con el post entero: no hay corte posible. El 05 dice
"17 s · 9:16" para `ugcB`; el Runbook §6 quater, leído por Graph, dice **18,5 s, 1080×1350** — manda el Runbook
(decidido en 06). **El segundo anuncio de cada ad set es el bumper de 8-10 s, no el corte medio de 15-20 s**
*(decisión de Pancho 03/09: masters cortos)*: el corte medio salía del master largo y con masters de 32 s ya no
agrega una duración distinta; el bumper sí, y es el único que puede ganar el scroll de 2 s. **E6-hombre** no entra a
esta tanda (body distinto del `copyC` medido; un 4º ad set de estáticas rompe el tramo C) — ronda 2. **E5 sale de la
tanda**: su pieza es el precio, y el precio no se unifica porque la landing no se toca.

### 2.3 Bodies finales, textuales (primary text; los saltos de párrafo son parte del body)

**La garantía de 90 días entra en todos los bodies salvo `copyC` y `copyD`** *(decisión de Pancho 03/09: la
garantía entra; la landing la enuncia textual, «Tenés 90 días de garantía: si no te convence, nos avisás y
listo.»)*. `copyC` queda intacto porque es el copy medido de agosto y su valor es ser comparable; **`copyD` queda
intacto porque no se puede tocar**: es el body del post de agosto que reusa P0 *(decisión de Pancho 04/09: se reusan los post IDs)* —
misma razón, ahora por partida doble, y es justo lo que hace que P0 sirva de vara (§4.5).

**copyD** — **P0. No se escribe: es el body del post de agosto que se reusa** *(decisión de Pancho 04/09: se reusan los post IDs)*. Va acá para que el operador sepa qué tiene que ver en el preview, no para copiarlo a ningún
lado. Es el copy medido de agosto (`arraigo-ugcB-copyD-antiriesgo`), y por eso es la vara de §4.5:

> No pagues por adelantado un tratamiento que no sabés si te va a funcionar. Probalo, pagalo cuando lo tengas en la mano.

**copyAR** — **P2 solamente** *(decisión de Pancho 04/09: se reusan los post IDs)*: el diseño "P0 y P2 comparten body
byte-idéntico" se cayó, porque el texto de P0 ahora viene del post y no se puede escribir (§4.5 lo reemplaza por el
gate de replicación):

> Se me caía tanto el pelo que dejé de mirar el cepillo. Y aun así no iba a pagar noventa días de tratamiento por adelantado.
>
> No dejás tarjeta, no hacés transferencia, no ponés un peso hoy. Te llega la caja, la abrís, ves los tres frascos y el aplicador, y recién ahí le pagás a quien te lo trajo.
>
> ARRAIGO es un sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil.
>
> Te aviso una sola cosa: son 90 días. Si buscás algo para el finde, no es éste. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copyM1** — P1:

> Mes 1 con un sérum anticaída: no vas a ver nada. Te lo digo antes de que lo pidas.
>
> Lo primero que cambia no es el espejo. Es la almohada. Y el cepillo. Y el desagüe de la ducha.
>
> Recién en el mes 2 la colita vuelve a dar dos vueltas. Ésa es la buena noticia.
>
> ARRAIGO es un tratamiento de 90 días con romero y cafeína. Tres frascos, uno por mes, y el aplicador. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil.
>
> Si buscás algo para dos semanas, no es éste.
>
> Y no ponés un peso hasta tenerlo en la mano. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copy45** — P3:

> Mi clienta de los jueves tiene 52 y me pidió que le corte más corto para que no se le note la caída. Le dije que no.
>
> Después de los 45 el pelo cambia: la colita da una vuelta más, la raya se corre sola. Que sea normal no quiere decir que no se pueda hacer nada.
>
> Le dije que probara 90 días con esto antes de cortarse nada. ARRAIGO: sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil. Tres frascos, uno por mes, y el aplicador.
>
> Y no le pedí ni la tarjeta: se lo llevan a la casa y le paga al que se lo trae.
>
> Son 90 días. Si buscás algo para el finde, no es esto. Y si no la convence, nos avisa: tiene 90 días de garantía.

**copyCOL** — P4:

> Hay algo que nadie te dijo de la caída del pelo: la colita no se afina de golpe. Se afina de a una vuelta de elástico.
>
> Dejaste las fotos con flash. Dejaste la raya al medio. Dejaste de atarte la colita fuerte, porque la vuelta que antes daba dos ahora da tres. Y dejaste de mirarte de arriba.
>
> Ninguna la decidiste.
>
> ARRAIGO: sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje, sin enjuague. Tratamiento de 90 días con el aplicador incluido. Sin minoxidil.
>
> Pagás cuando te llega. Sin tarjeta. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copyE4** — E4:

> Te lo decimos antes de que lo pidas: el primer mes no vas a ver nada. El pelo tarda. Por eso ARRAIGO son 3 frascos —romero y cafeína sobre la raíz, 60 segundos por día— y por eso no pagás nada hasta que te lleguen. Si buscás algo para el finde, no es éste. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copyE8** — E8:

> Pelo en la almohada, en el cepillo, en el desagüe. ARRAIGO es un sérum de romero y cafeína que va sobre la raíz: una pipeta de noche, un minuto de masaje, sin enjuague. Tres frascos son los 90 días. Te lo llevan a tu casa y pagás cuando lo recibís. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copyC** — E6 (el `copyC` de agosto, textual; su anuncio de origen está PAUSED, así que no choca con el assert):

> Si se te está abriendo la raya, esto es para vos. Sin minoxidil. Pagás cuando te llega.

**copyM4** — E1 retargeting (el copy M4 del 01/09 con la dosis corregida a "una pipeta", regla §7-3; difiere de
copyAR en el primer párrafo, así que pasa el assert aunque P2 esté ACTIVE):

> Un tratamiento de 90 días que todavía no sabés si te va a funcionar. ¿Lo pagarías por adelantado?
>
> Nosotros tampoco.
>
> No dejás tarjeta, no hacés transferencia, no ponés un peso hoy. Te llega la caja, la abrís, ves los tres frascos y el aplicador, y recién ahí le pagás a quien te lo trajo.
>
> ARRAIGO es un sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil.
>
> Te aviso una sola cosa: son 90 días. Si buscás algo para el finde, no es este. Y si no te convence, nos avisás: tenés 90 días de garantía.

**copyE7** — E7 retargeting:

> No te vamos a mostrar un antes y después: contá vos. Los pelos del cepillo hoy, y otra vez a los 60 días. ARRAIGO es romero y cafeína sobre la raíz, 60 segundos por día, sin enjuague. Lo pedís, te llega, y pagás cuando lo tenés en la mano. Y si no te convence, nos avisás: tenés 90 días de garantía.

**Verificado en 06 (03/09/2026, revisado el 04/09 con `copyD` incluido): ningún body ni headline de los 14
anuncios nombra un precio.** El único «$» de la
tanda es el «$0» quemado en la imagen de E1 (retargeting), que no es un precio del producto. E5 —cuya pieza ES el
precio— sale de la tanda (decisión de Pancho 03/09: la landing se queda como está): el precio no se unifica.

### 2.4 Textos quemados de las estáticas (exactos; HTML, nunca render IA)

- **E4**: `Mes 1: estoy igual.` / `Mes 2: menos pelo en el cepillo.` / `Mes 3: recién ahí.` / `Por eso son 3 frascos. Y por eso no los pagás hasta tenerlos.` / franja `ARRAIGO · Sérum capilar anticaída · Romero + cafeína` / pie `ENVÍO GRATIS · PAGÁS AL RECIBIR`. Packshot real de la landing en la franja.
- **E8** (layout `comparativa` de la Fábrica): columna izquierda `LO QUE VES` → `Pelo en la almohada` · `La raya más ancha` · `La cola más finita` (un ícono plano cada uno); columna derecha `LO QUE HACE ARRAIGO` → `Romero + cafeína sobre la raíz` · `60 segundos por día, sin enjuague` · `3 frascos = 90 días` (foto real: mano + frasco); pie `ENVÍO GRATIS · PAGÁS AL RECIBIR`.
- **E6 mujer**: `Si ya cambiaste la raya de lado,` / `esto es para vos.` / `Romero + cafeína sobre la raíz · 60 segundos por día` / franja `ARRAIGO · Sérum capilar anticaída` + packshot real / pie `ENVÍO GRATIS · PAGÁS AL RECIBIR`.
- **E1**: `HOY PAGÁS` / `$0` (enorme) / `Lo pagás cuando lo tenés en la mano.` / franja `ARRAIGO · Sérum capilar anticaída · Romero + cafeína · 90 días` / pie `ENVÍO GRATIS · PAGÁS AL RECIBIR`.
- **E7**: `Contá los pelos que quedan en el cepillo hoy.` / `Volvé a contar en 60 días.` / chico: `Vos medís. Nosotros cobramos cuando te llega.` / franja `ARRAIGO · Sérum capilar anticaída · Romero + cafeína` + packshot / pie `ENVÍO GRATIS · PAGÁS AL RECIBIR`.

---

## 3. Estructura de campaña

### 3.0 La cuenta: Tienda R2 *(decisión de Pancho 03/09: la tanda va en R2, no en R3)*

**La tanda corre en Tienda R2 `act_880189106877616`.** Verificado por Graph el 03/09/2026: `account_status: 1`,
`disable_reason: 0`, **sin spend cap**, página BioLabs **`824765737394913`** (la misma que R3).

**El motivo es la plata: R2 no lleva el impuesto del 36,4%** que sí paga R3 (débito AstroPay, no recuperable).
En R2 **nominal = real**: el objetivo de $6.000 por pedido y el equilibrio de **$2.360 por IC** se leen crudos de
Ads Manager, sin multiplicar. En R3 el mismo plan costaba × 1,364 (el tramo A: $225.000 nominales → $306.900
reales). El factor ×1,364 **solo vuelve a aplicar si alguna vez se vuelve a R3**.

**Corrección del argumento del techo de ad sets, que estaba flojo** (lo escribió una pasada anterior de este
mismo documento y se corrige acá, no en una nota nueva). Medido hoy sobre R2:

- de los **23 ad sets ACTIVE**, **16 tienen `daily_budget` $0 porque son hijos de un CBO** — no ocupan un slot de
  presupuesto propio. Los ABO reales son **BeeVenom $126.000/día en 2 ad sets** y **un Pureza de $48.000/día en 1**;
- de los **22 con datos**, **solo 8 llegan a 50 conversiones/semana y la mediana es 15**.

O sea: **la casa ya opera debajo del "techo" de 50 conversiones/ad set/semana en la mayoría de sus conjuntos.**
"Conversiones 7d ÷ 50" no es una restricción operativa que impida entrar: es una **referencia de calidad de señal**,
y contarla como cupo de slots libres era el error. **El ítem 12 de §7 baja a informativo**: se mide, se anota, y no
bloquea el tramo B ni el A'.

**El píxel BioLabs `781630351556303` es el MISMO en las dos cuentas**, así que **la señal de conversión no se parte
al mudarse**: el histórico de ARRAIGO (LPV, IC, el pool de retargeting del tramo D) vive en el píxel, no en la
cuenta.

**Y la página también es la misma, así que el creativo de agosto tampoco se muda: se reusa el post**
*(decisión de Pancho 04/09: se reusan los post IDs)*. Los 9 anuncios de la campaña de agosto (`120251431480890257`, R3)
tienen `effective_object_story_id` sobre la página BioLabs **`824765737394913`**, y esa página está **en las dos
cuentas** — un `object_story_id` es de la página, no de la cuenta, así que **cruza a R2 sin resubir nada**. El de
P0 es **`824765737394913_122139167943156780`** (`arraigo-ugcB-copyD-antiriesgo`, el copy medido). La biblioteca de
video sigue sin cruzar (el `video_id 1771810277325620` de `ugcB` es de R3) y **ya no importa**: no se baja ni se
resube el MP4. P0 sigue costando **US$0 de producción**, y ahora también US$0 de trabajo.

Los otros 8 post IDs de agosto, de referencia: `copyA-molde` `824765737394913_122139167883156780` ·
`copyC-identificacion` `…_122139167931156780` · `copyB-sinminoxidil` `…_122139167913156780` · `ba-raya`
`…_122139167685156780` · `mecanismo-916` `…_122139167799156780` · `cepillo-mes1-mes3` `…_122139167859156780` ·
`ba-entradas` `…_122139167715156780` · `timeline-90dias` `…_122139167661156780`. **Ninguno entra a esta tanda**:
el único que se reusa es el de P0.

### 3.1 Campaña

Una sola, **nueva**, en Tienda R2 (`act_880189106877616`): `ARRAIGO · ABO Open · DD-MM`, `objective: OUTCOME_SALES`, `buying_type: AUCTION`,
**ABO** (`is_adset_budget_sharing_enabled: false` — sin el campo el POST devuelve error 100 / subcode 4834011; en
`true` Meta reparte y se pierde el corte por conjunto), `special_ad_categories: []`, `status: PAUSED`. DD-MM es
el día en que arranca la entrega del tramo A (00:00 `-03:00` del día siguiente al OK de pauta A). La campaña
de agosto (`120251431480890257`, R3) queda PAUSED como está; no se reusa, y ARRAIGO no vuelve a tener nada vivo en R3.

### 3.2 Ad sets

Regla de la casa: **"el anuncio que arranca perdiendo no se recupera"** → pocos anuncios por ad set, **nunca dos
formatos en el mismo ad set** (en agosto 7 anuncios en un conjunto: el video se comió a las estáticas). Los
dos anuncios de cada pieza —master y bumper— viven **en el mismo ad set** porque son la misma apuesta a otra duración.

| ad set | contenido | anuncios | $/día | días | tramo | qué lo desbloquea |
|---|---|---|---|---|---|---|
| `arraigo-OPEN-AR-3060-p0-ugcB-25k` | P0 réplica (post de agosto por `object_story_id`: video y body del post) | 1 | $25.000 | 3 | A | OK pauta A |
| `arraigo-OPEN-AR-3060-p1-diario-25k` | P1 A32 + C9 | 2 | $25.000 | 3 | A | OK pauta A |
| `arraigo-OPEN-AR-3060-p2-puerta-25k` | P2 A32 + C9 | 2 | $25.000 | 3 | A | OK pauta A |
| `arraigo-OPEN-AR-3060-p3-pelu45-25k` | P3 A40 + C9 | 2 | $25.000 | 3 | B | escalón 3b + OK pauta B |
| `arraigo-OPEN-AR-3060-p4-colita-25k` | P4 A32 + C10 | 2 | $25.000 | 3 | A' | escalón 2b (solo si hay slot) + OK propio |
| `arraigo-OPEN-AR-3060-e4-mes1-25k` | E4 | 1 | $25.000 | 3 | C | gate LPV→IC > 8% + OK pauta C |
| `arraigo-OPEN-AR-3060-e8-comparativa-25k` | E8 | 1 | $25.000 | 3 | C | idem |
| `arraigo-OPEN-AR-3060-e6-raya-25k` | E6 mujer | 1 | $25.000 | 3 | C | idem |
| `arraigo-RTG-LPV30d-5k` | E1 · E7 | 2 | $5.000 | 5 | D | pool ≥ 1.000 + OK pauta D |

Tramo A = 3 × $25.000 × 3 = **$225.000**. B = **+$75.000**. C = **+$225.000**. A' (P4) = **+$75.000**.
D = $5.000 × 5 = **hasta $25.000**. Techo si se abren los cuatro tramos: **$550.000** (con P4: **$625.000**).

**Por qué $25.000 y no $12.000** *(decisión de Pancho 03/09)*: a $6.000 de CPA real, salir de aprendizaje (50
conversiones/semana) pide **$42.857/día por ad set**. A $12.000 el ad set junta ~14 conversiones/semana y no sale
nunca; a **$25.000 junta ~29/semana** — tampoco llega a 50, pero **duplica la señal** y pone la lectura de 72 h en
$75.000, donde 32 IC ya es una medición y no un rumor. El RTG queda en **$5.000/día** (decidido en 06): su pool son
~1.000 personas y a $25.000 la frecuencia pasa de 4 en un día.

### 3.3 Targeting

**Copiado del ad set modelo de agosto `120251431485570257`** (`arraigo-OPEN-AR-3060-video-est-30k`), que es lo
que hace el lanzador: **AR entera · mujeres · 30-60 · cero exclusiones · sin intereses · ubicaciones automáticas ·
`advantage_audience: 0`** · `OFFSITE_CONVERSIONS` · `IMPRESSIONS` · `LOWEST_COST_WITHOUT_CAP` · `WEBSITE` · píxel
`781630351556303`/`PURCHASE` · atribución 7d clic + 1d view.

> **El modelo es de R3 y la tanda va a R2 — a propósito** (decidido en 06). El lanzador solo hace un **GET** sobre el
> ad set modelo: lectura, no escritura, y los campos que copia son agnósticos de cuenta porque **el píxel
> `781630351556303` es el mismo en las dos** (§3.0). Verificación obligatoria después de crear el primer ad set:
> releer `promoted_object.pixel_id` (= `781630351556303`), `optimization_goal`, `bid_strategy` y
> `targeting.advantage_audience` (= 0). **Si Meta rechaza algún campo por venir de otra cuenta**, el fallback es usar
> como modelo el **ad set ABO vivo de BeeVenom en R2** (leerlo con `GET /act_880189106877616/adsets` filtrando
> `effective_status ACTIVE` y `daily_budget > 0`) y **setear el targeting a mano** con la especificación de arriba;
> si un campo copiado viene vacío (pasa con los hijos de CBO), se escribe explícito: `OFFSITE_CONVERSIONS` ·
> `IMPRESSIONS` · `LOWEST_COST_WITHOUT_CAP` · `WEBSITE` · 7d clic + 1d view.

Igual en los 8 ad sets fríos, **P3 incluido**
(decidido en 06: el 05 no cierra P3 a 45+; con targeting abierto el creativo es el targeting, y la hipótesis
se lee con el desglose por edad a 48 h — `breakdowns=age`, buckets 45-54 y 55-64 — no con un filtro).

Retargeting (`arraigo-RTG-LPV30d-5k`, $5.000/día): custom audience de sitio web sobre el píxel `781630351556303` (**el mismo en R2 y R3: el pool de agosto sirve**), evento
`ViewContent`/LPV en la URL de la landing, **30 días**, excluyendo `Purchase` 30 días; resto de la config igual
al modelo. **No la crea el lanzador**: la arma `meta-operador` a mano (§3.6).

### 3.4 Orden de encendido

1. **Tramo A** (P0, P1, P2) — $225.000: los tres ad sets se prenden **juntos**, con `start_time` = 00:00 `-03:00` del día
   siguiente ("prendelo, que salgan mañana"). Día 0 de la tanda = ese día.
2. **Tramo B** (P3) — +$75.000: se prende cuando el escalón 3b cierre sus gates, con su propio `start_time` a las
   00:00 y su propio reloj de 48 h / 72 h / día 7. El techo de ad sets ya no lo bloquea (§3.0).
3. **Tramo A'** (P4) — +$75.000: solo si una celda del tramo A murió a 48 h y liberó presupuesto, o si Pancho lo
   pide aparte. Ya no depende del techo de ad sets (§3.0).
4. **Tramo C** (E4, E8, E6) — +$225.000: recién cuando el tramo A haya medido **LPV→IC > 8% contra la landing actual** (§4.4). Lo más temprano: 72 h
   del tramo A. Si no pasa el gate, **este tramo no se pide**.
5. **Tramo D** (retargeting) — hasta $25.000: 3-5 días después del tramo A, solo con pool ≥ 1.000 en el píxel a 30 días. Se apaga
   con frecuencia > 4.

### 3.5 El lote del lanzador — `~/AppAds-tabla/scripts/lanzar.mjs`

**Qué hace hoy el script (leído entero):** `node scripts/lanzar.mjs plan.json [--check]`. Lee `account_id`,
`campaign_id`, `adset_modelo`, `page_id`, `instagram_user_id`, `cta`, `mensajes[]`. **Un `mensaje` = un ad set
con un body**; sus `piezas[]` = los anuncios del ad set (cada una con `archivo` .jpg/.png → `/adimages` →
`link_data`). Copia targeting/pixel/optimización del `adset_modelo`. Todo `PAUSED`. **Assert de body**
(`chequearBodies`): falla (exit 2) si dos `mensajes` del **mismo plan.json** comparten body normalizado, o si un
body coincide con uno **ACTIVE** en la cuenta (`effective_status IN [ACTIVE]`). `--check` valida y no toca Meta.

**El problema del body compartido desapareció** *(decisión de Pancho 04/09: se reusan los post IDs)*. P0 ya no lleva
`copyAR`: su texto es el del post (`copyD`), y `copyAR` queda solo en P2. **Los 8 bodies de la tanda son distintos
entre sí**, así que el assert intra-plan no tiene nada que sortear y los dos plan.json ya no necesitan correrse en
un orden por ese motivo. Se mantienen separados por otra razón: **P0 no lo crea el lanzador**. Ningún par comparte
body.

**Lo que el lanzador NO hace hoy: `object_story_id`.** Leído entero el 04/09/2026 sobre `main`
(`~/AppAds-tabla/scripts/lanzar.mjs`, con el soporte de video ya mergeado — commit `f033ae0`). **No lo soporta, y
no hay que suponer que sí:**
- `chequearPiezas()` acepta exactamente tres formas de pieza —`archivo` · `video`+`miniatura` · `video_id`+
  `image_hash`— y una pieza que solo trae `object_story_id` cae en el `else` final y sale con
  `"no trae ni archivo ni video"` → **exit 2, antes de tocar Meta**.
- `crearAnuncio()` arma **siempre** un `object_story_spec` (`video_data` o `link_data`); no existe una rama que
  mande `object_story_id`. Si el chequeo no lo frenara, la rama de imagen llamaría a
  `subirImagen(account_id, undefined)` y reventaría.
- `chequearBodies()` exige `body` no vacío por mensaje, y el body de P0 no es nuestro.
- `grep -rn "object_story_id" ~/AppAds-tabla/scripts/` da cero coincidencias en `lanzar.mjs` (solo en SQL de
  `creativos_ganadores`), verificado el 04/09/2026.

**Qué habría que agregarle** (no se hace en esta tanda; queda escrito por si vuelve a hacer falta): (1) una cuarta
forma de pieza `{ "nombre": "…", "object_story_id": "…" }` aceptada por `chequearPiezas` **sin** exigir miniatura;
(2) en `crearAnuncio`, si `p.object_story_id`, postear el creative como `{ name, object_story_id }` **sin
`object_story_spec` y sin `url_tags`** (un creative por post no los admite); (3) que `chequearBodies` exima al
mensaje cuyas piezas son todas `object_story_id`, o que acepte el body del post como documentación sin mandarlo.

**Decisión (decidido en 06, 04/09): P0 se crea a mano por Graph, no por el lanzador.** Es **un** anuncio y son dos
POST (`/adcreatives` + `/ads`) más el ad set; extender el script para una pieza única cuesta más que hacerla, y el
plan ya tiene el precedente: el tramo D también lo arma `meta-operador` a mano (§3.6). `A1-p0.json` **se mantiene
como la especificación escrita de lo que hay que crear** —sus campos son exactamente los del POST— y queda listo si
alguna vez el lanzador gana la cuarta forma de pieza. Efecto lateral bueno: **el archivo tal como está escrito no se
puede correr por accidente** con el lanzador de hoy; sale por `exit 2` sin tocar Meta.

**La extensión de video que el plan pedía YA ESTÁ MERGEADA en `main`** (commit `f033ae0`, verificado el
04/09/2026 leyendo el script entero — decidido en 06). Hoy el lanzador ya: sube video
(`POST act_<id>/advideos`, multipart campo `source`, esperando `status.video_status = ready` hasta 2 min), sube la
miniatura por `/adimages` (no es la `is_preferred`), arma
`object_story_spec.video_data = { video_id, image_hash, message, title, link_description, call_to_action }`, manda
`url_tags` al creative y `conversion_domain` al ad, y sigue sin `degrees_of_freedom_spec` (error 100/3858504 en
v25). Formas de pieza aceptadas:
- `"archivo": "/ruta.png"` → imagen, `link_data`. La usan E4, E8, E6.
- `"video": "/ruta.mp4"` + `"miniatura": "/ruta.jpg"` → sube los dos y arma `video_data`. La usan P1, P2, P3, P4.
- `"video_id"` + `"image_hash"` ya existentes → mismo `video_data`, sin subir nada. **Ya no la usa nadie en esta
  tanda** *(decisión de Pancho 04/09: se reusan los post IDs)*; queda por si vuelve a hacer falta.
- `"object_story_id"` → **no existe** (arriba). Por eso P0 va a mano.

**El paso 0.1 del escalón 0 deja de ser una sesión de código y pasa a ser una verificación** (decidido en 06,
04/09): correr `node scripts/lanzar.test.mjs` y que dé verde.

**Archivos del lote** (todos en `docs/creativos/arraigo-plan-0309/prod/lanzar/`): `A1-p0.json`, `A2-p1-p2.json`,
`B-p3.json`, `2b-p4.json`, `C-estaticas.json`. **`account_id` = `880189106877616` (R2)** y **`page_id` =
`824765737394913`**, los dos verificados el 03/09/2026. `<CAMPAIGN_ID>` sale del POST de §5 paso 0.2;
`<IG_USER_ID>` se lee del creative de agosto (`GET /<creative_id>?fields=object_story_spec` sobre cualquiera de los
9 anuncios de `120251431480890257`), no se inventa. **Ya no hay `<VIDEO_ID_R2>` ni `<IMAGE_HASH_R2>`**
*(decisión de Pancho 04/09: se reusan los post IDs)*: P0 no sube nada, y el `object_story_id` del post es un id literal que va
escrito en el archivo. `<IG_USER_ID>` tampoco hace falta para P0 (un creative por post no lleva
`object_story_spec`), pero sí para P1-P4.

`A1-p0.json` — **especificación de lo que `meta-operador` crea a mano por Graph (paso 0.4), no un archivo que se
corra**: el lanzador de hoy no acepta `object_story_id` y sale por `exit 2` *(decisión de Pancho 04/09: se reusan los post IDs)*.
Se cayeron `titulo`, `descripcion`, `link`, `body`, `instagram_user_id` y `url_tags`: **todos viven en el post**.

```json
{
  "account_id": "880189106877616",
  "campaign_id": "<CAMPAIGN_ID>",
  "adset_modelo": "120251431485570257",
  "page_id": "824765737394913",
  "cta": "GET_OFFER_VIEW",
  "conversion_domain": "biolabsarg.com",
  "mensajes": [
    {
      "nombre": "arraigo-OPEN-AR-3060-p0-ugcB-25k",
      "budget": 25000,
      "piezas": [
        {
          "nombre": "arraigo-ugcB-copyD-replica-A18",
          "object_story_id": "824765737394913_122139167943156780"
        }
      ]
    }
  ]
}
```

`A2-p1-p2.json` (mismo encabezado; `PROD` = `docs/creativos/arraigo-plan-0309/prod`):

```json
{
  "account_id": "880189106877616",
  "campaign_id": "<CAMPAIGN_ID>",
  "adset_modelo": "120251431485570257",
  "page_id": "824765737394913",
  "instagram_user_id": "<IG_USER_ID>",
  "cta": "GET_OFFER_VIEW",
  "url_tags": "utm_content={{ad.id}}",
  "conversion_domain": "biolabsarg.com",
  "mensajes": [
    {
      "nombre": "arraigo-OPEN-AR-3060-p1-diario-25k",
      "budget": 25000,
      "titulo": "Envío Gratis 📦",
      "descripcion": "Envío gratis · Pagá al recibir",
      "link": "https://biolabsarg.com/products/serum-anticaida-romero-arraigo",
      "body": "Mes 1 con un sérum anticaída: no vas a ver nada. Te lo digo antes de que lo pidas.\n\nLo primero que cambia no es el espejo. Es la almohada. Y el cepillo. Y el desagüe de la ducha.\n\nRecién en el mes 2 la colita vuelve a dar dos vueltas. Ésa es la buena noticia.\n\nARRAIGO es un tratamiento de 90 días con romero y cafeína. Tres frascos, uno por mes, y el aplicador. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil.\n\nSi buscás algo para dos semanas, no es éste.\n\nY no ponés un peso hasta tenerlo en la mano. Y si no te convence, nos avisás: tenés 90 días de garantía.",
      "piezas": [
        {
          "nombre": "arraigo-diario-copyM1-mes1-A32",
          "video": "PROD/p1/cortes/p1-A32.mp4",
          "miniatura": "PROD/p1/miniatura/p1.jpg"
        },
        {
          "nombre": "arraigo-diario-copyM1-mes1-C9",
          "video": "PROD/p1/cortes/p1-C9.mp4",
          "miniatura": "PROD/p1/miniatura/p1.jpg"
        }
      ]
    },
    {
      "nombre": "arraigo-OPEN-AR-3060-p2-puerta-25k",
      "budget": 25000,
      "titulo": "Envío Gratis 📦",
      "descripcion": "Envío gratis · Pagá al recibir",
      "link": "https://biolabsarg.com/products/serum-anticaida-romero-arraigo",
      "body": "Se me caía tanto el pelo que dejé de mirar el cepillo. Y aun así no iba a pagar noventa días de tratamiento por adelantado.\n\nNo dejás tarjeta, no hacés transferencia, no ponés un peso hoy. Te llega la caja, la abrís, ves los tres frascos y el aplicador, y recién ahí le pagás a quien te lo trajo.\n\nARRAIGO es un sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje, sin enjuague. Sin minoxidil.\n\nTe aviso una sola cosa: son 90 días. Si buscás algo para el finde, no es éste. Y si no te convence, nos avisás: tenés 90 días de garantía.",
      "piezas": [
        {
          "nombre": "arraigo-puerta-copyAR-antiriesgo-A32",
          "video": "PROD/p2/cortes/p2-A32.mp4",
          "miniatura": "PROD/p2/miniatura/p2.jpg"
        },
        {
          "nombre": "arraigo-puerta-copyAR-antiriesgo-C9",
          "video": "PROD/p2/cortes/p2-C9.mp4",
          "miniatura": "PROD/p2/miniatura/p2.jpg"
        }
      ]
    }
  ]
}
```

`B-p3.json`: un `mensaje` `arraigo-OPEN-AR-3060-p3-pelu45-25k`, `budget` 25000, body = **copy45** (§2.3), piezas
`arraigo-pelu-copy45-despues45-A40` (`PROD/p3/cortes/p3-A40.mp4`) y `-C9` (`PROD/p3/cortes/p3-C9.mp4`), las dos con
`PROD/p3/miniatura/p3.jpg`. `2b-p4.json`: idem con `arraigo-OPEN-AR-3060-p4-colita-25k`, body **copyCOL**, piezas
`arraigo-colita-copyCOL-identif-A32` y `-C10` (`PROD/p4/cortes/p4-A32.mp4`, `p4-C10.mp4`) y
`PROD/p4/miniatura/p4.jpg`. `C-estaticas.json`: tres `mensajes` de `budget` 25000 (`…-e4-mes1-25k` body **copyE4**
pieza `arraigo-e4mes1-copyE4-mes1-est` `archivo PROD/e4/e4-4x5.png` · `…-e8-comparativa-25k` body **copyE8** pieza
`arraigo-e8comparativa-copyE8-formato-est` `archivo PROD/e8/e8-4x5.png` · `…-e6-raya-25k` body **copyC** pieza
`arraigo-e6raya-copyC-identif-est` `archivo PROD/e6/e6-raya-4x5.png`). Mismo encabezado que A1 en los tres.

Cada archivo se corre primero con `--check` (valida bodies y el `og:description` de la landing, no toca Meta) y
después sin flag. **El assert de body ahora corre contra los ACTIVE de R2** (BeeVenom y Pureza): ninguno de los
bodies de esta tanda vive ahí, y los de agosto viven en R3 y están PAUSED. Miniaturas: **elegidas a mano** (P1 =
cuadro 0, cepillo cenital con la tarjeta `Mes 1: nada.`; P2 = la caja abierta con los tres frascos en la puerta;
P3 = la peluquera con la tijera en el salón, sin bata; P4 = la colita con el elástico, nunca el ascensor).

### 3.6 Retargeting (tramo D) — a mano por `meta-operador`, no por el lanzador

El lanzador arma un body por ad set; el tramo D es **un ad set con dos bodies** (es una audiencia, no un test
de mensaje: la misma excepción que la casa aplica a los splits geo, al revés). `meta-operador` crea: (1) la
custom audience §3.3; (2) el ad set `arraigo-RTG-LPV30d-5k`, $5.000/día, `end_time` = +5 días, config del modelo
con la audiencia; (3) dos creatives (`link_data`, imagen 4:5, bodies copyM4/copyE7, constantes §2.1);
(4) dos ads PAUSED. Verifica releyendo por Graph y anota en el Runbook.

---

## 4. La vara de día 0 (se escribe en el Runbook antes de prender, con estos números)

### 4.1 Cómo se lee cada métrica (Graph, `GET /<adset_id>/insights` y `/<ad_id>/insights`)

- ✅ **En R2 nominal = real** *(decisión de Pancho 03/09: la tanda va en R2)*: la cuenta no tiene el impuesto del
  36,4%, así que lo que muestra Ads Manager **es** la plata que sale. El objetivo de $6.000 por pedido es real y el
  equilibrio por IC es **$2.360 limpio**. El factor × 1,364 solo volvería a aplicar si alguna vez se vuelve a R3.
- **IC** = `actions[omni_initiate_checkout]` · **$/IC** = `spend / IC` · **equilibrio $/IC = $2.360** (2,54 IC por
  compra; break-even por orden creada del x3 $27.950, objetivo $6.000 por pedido).
- **CTR saliente** = `outbound_clicks / impressions` · **$/LPV** = `spend / actions[landing_page_view]` ·
  **LPV→IC** = IC / LPV · **hook rate** = `video_p25_watched_actions / video_play_actions` (así se midió la
  ancla de agosto en el dossier, 33,9-40,2%; se mantiene la misma definición para que la ancla valga —
  decidido en 06) · CPM, frecuencia, `effective_status`, `ad_review_feedback`.
- Presupuesto de referencia de los cortes: **$25.000/día por ad set** → 48 h ≈ $50.000 · 72 h ≈ $75.000 ·
  día 7 ≈ $175.000 (Meta flexa hasta +8,6%, medido en agosto). A $2.360/IC, **$75.000 son 32 IC**.

### 4.2 Por ad set: ancla, lo que tiene que dar, y lo que lo mata

| ad set | hook rate | CTR saliente | $/LPV | IC / $/IC a 72 h | corte propio a 48 h (además del general) |
|---|---|---|---|---|---|
| P0 réplica (persona) | ancla `copyD` **38,9%**; banda 33,9-40,2% | ancla **4,63%**; banda 3,42-4,99% | ancla **$186**; banda $149-324 | general: ≥ 32 IC = ≤ $2.360 pasa · 16-31 sobrevive · < 16 muere | ninguno: la corta solo la regla general. **Sus tres anclas son el gate de replicación de §4.5** *(decisión de Pancho 04/09: se reusan los post IDs)*: es el mismo video con el mismo body, así que acá no se le pide ganar — se le pide *repetir* |
| P1 diario (tarjetas) | sin ancla — se registra, no corta | **piso 3,0%** | sin ancla — se registra | **gana con LPV→IC ≥ 11%** (leído IC/LPV del ad set) | **CTR saliente ≥ 3% y LPV→IC < 8% → apagar** aunque el $/LPV sea bueno: la pre-calificación no movió nada |
| P2 puerta (b-roll) | sin ancla — se registra | **gana con ≥ 4,0%** (copyD hizo 4,63%) | **gana con ≤ $189** (copyD hizo $186); con la landing al 8% es la única forma de llegar a $2.360/IC | general | **CTR saliente < 3,4% → apagar**: el visual no acompañó al copy |
| P3 peluquera (cara) | sin ancla — se registra | **gana con ≥ 3,4% con CPM ≤ $8.000** | sin ancla | general | **CPM > $9.000 → apagar** · **< 60% del gasto en 45+ (`breakdowns=age`, 45-54 + 55-64) → apagar**: el creativo no segmentó y la hipótesis no se leyó |
| P4 colita (b-roll) | **gana con ≥ 40%** (copyC hizo 40,2%) | piso 3,4% | **gana con ≤ $160** (copyC hizo $149) | **≥ 1 IC cada $4.720 a 48 h** (o sea ≥ 10 IC con $50.000) — la falla conocida de la identificación es CTR alto con IC cero | **0 IC con ≥ $37.500 → apagar** |
| E4 mes 1 (estática) | n/a | predicción 02: 1,6-2,6% · **< 1,5% mata · ≥ 2,5% salva** | predicción $310-500 · **> $550 mata · ≤ $320 salva** | $/IC previsto $3.900-6.300 con landing al 8% · **0 IC con $25.000 mata** · ≤ $4.000 sigue · ≤ $2.360 gana | — |
| E8 comparativa | n/a | 1,5-2,4% · mismos cortes | $340-540 · mismos cortes | $4.200-6.700 con 8% · mismos cortes | — |
| E6 raya | n/a | 1,8-2,8% · mismos cortes | $290-450 · mismos cortes | $3.600-5.600 con 8% · mismos cortes | — |
| RTG (E1/E7) | n/a | sin ancla; < 1,5% mata | sin ancla | **la vara es $/IC**: > $4.000 mata · ≤ $2.360 gana · mirar el mix x3 de la cohorte (no bajar del 78%) | **frecuencia > 4 → apagar** |

Para que una estática llegue al equilibrio con la landing al 8% necesita **CTR saliente ≥ 4,3%**, que ninguna
estática de la casa mostró nunca; por eso el tramo C tiene gate (§4.4).

### 4.3 Reglas de día 1-2 y de día 7 (por ad set)

**Día 1 (24 h):** solo `effective_status` (gate 6): la aprobación se puede revertir al entregar. Rechazo → **no se
apela**; se lee `ad_review_feedback`, se corrige la pieza. Nada más se lee el día 1.

**Día 2 (48 h, ≈ $50.000 gastados):**
- **Matar**: 0 IC con ≥ $37.500 (a ~$3.500/IC se esperan ~14; que salgan 0 pasa menos de 1 vez en 1.000) · o el
  corte propio de la pieza (§4.2) · o CTR alto con 0 IC ("no se entendió qué se vende").
- **Esperar**: 1-9 IC con CTR saliente ≥ piso y $/LPV dentro del rango de la pieza.
- **Dejar**: ≥ 10 IC.

**Día 3 (72 h, ≈ $75.000):** **< 16 IC (> $4.720/IC) muere · 16-31 IC sobrevive al mismo presupuesto · ≥ 32 IC
(≤ $2.360/IC) pasa a doble presupuesto ($50.000/día)** — subir presupuesto **editando el ad set, nunca la
campaña**, y mirar `status_forced_to_paused` después (memoria `meta-editar-presupuesto-apaga-campana`).

**Día 7 (≈ $175.000):** **≥ 74 IC escala · 37-73 mantiene y va a ronda 2 · < 37 apaga** (74 IC = $2.360/IC sobre
los $175.000 de la semana). Ronda 2 sobre el
sobreviviente y solo sobre él: A/B de headline (`Envío Gratis 📦` vs `Pagás cuando te llega`), E6-hombre como ad
set propio, y el contador de la empresa en la descripción si es ≥ 1.000 (decidido en 06: la descripción se
mantiene constante en toda la ronda 1).

**Dentro de un ad set (master + bumper):** los dos anuncios **no se apagan por reparto de Meta** (`copyA` se llevó el 43%
del gasto de agosto sin ganar). Por anuncio se leen solo CTR saliente, hook rate y $/LPV con ≥ 1.000 impresiones;
IC y compras por anuncio no se leen (n chico).

**No cortan nunca**: retención, hook rate, CTR, CPM. Disparan diagnóstico: frecuencia > 2,5 con CTR cayendo =
renovar visual.

### 4.4 Gate de las estáticas (tramo C)

**Se mide contra la landing ACTUAL** (decisión de Pancho 03/09: la landing se queda como está). Se abre solo si el
video de esta tanda —los tres ad sets del tramo A **agregados**, leídos a las 72 h, con **n ≥ 300 LPV** (decidido en
06: n mínimo)— mide **LPV→IC > 8%**. El 8% es la ancla de agosto sobre esta misma landing (414 LPV → 33 IC, IC95%
5,4-10,6%; Pureza 15,4-17,5% con el mismo formulario): con la landing constante, superarla solo puede venir del
creativo (la pre-calificación de P1). Si no pasa, el tramo C no se pide: se entregan las piezas y no se gasta un
peso más en estáticas. **Y si el gate de replicación de §4.5 falla, este 8% se rebasa sobre el LPV→IC que
midió P0** *(decisión de Pancho 04/09: se reusan los post IDs)*: el 8,0% también es un número de agosto, y
una vara vieja no puede decidir un tramo de $225.000.

### 4.5 Gate de replicación: P0 tiene que repetir agosto *(decisión de Pancho 04/09: se reusan los post IDs)*

**Esta sección reemplaza al gate "P0 (persona) vs P2 (objetos), mismo body".** Ese gate ya no se puede correr: P0 y
P2 no pueden compartir body byte-idéntico, porque el body de P0 vive en el post de agosto y no se escribe (§2.3).
Lo que queda en su lugar es más barato de leer y vale más — el porqué, al final.

**Qué se mide.** P0 es ahora **el mismo video con el mismo texto** que `arraigo-ugcB-copyD-antiriesgo` corrió en
agosto. Si lo repetimos y da lo mismo, **la tabla de agosto sigue siendo una vara** y las 13 piezas nuevas se leen
contra ella. Si da distinto, no hay nada roto en P0: lo que se movió es el mercado, la cuenta o la landing, y
**las anclas están viejas**.

**Cuándo y con qué n.** A las **72 h** (≈ $75.000), con **≥ 5.000 impresiones** en el ad set (el mismo piso de
lectura que tenía el gate anterior; decidido en 06). P0 es el único anuncio de su ad set, así que las insights del
ad set **son** las del anuncio: no hay reparto de Meta que descontar.

**El margen: la banda que ese mismo visual produjo en agosto.**

| métrica | ancla `copyD` (agosto) | banda de replicación |
|---|---|---|
| CTR saliente | 4,63% | **3,42-4,99%** |
| $/LPV | $186 | **$149-324** |
| hook rate (`video_p25_watched_actions` / `video_play_actions`) | 38,9% | **33,9-40,2%** |

**Por qué esa banda y no un ± inventado.** Son los máximos y los mínimos que **los 4 copys de agosto midieron sobre
este mismo video** (§4.2, §9): el único margen que la casa tiene *medido* sobre esta pieza, no una tolerancia de
escritorio. Y es del tamaño correcto: el copy dejó de ser fuente de variación —ahora es el mismo— pero apareció una
fuente nueva y **sin medir**, que R2 nunca corrió ARRAIGO y su historial de entrega con este creativo no existe
(§9: el CPM del primer día puede ser otro). Cambiar una fuente de ruido de ~1,57 pp por otra que no conocemos no
autoriza a apretar la banda. **Si se apretara, el gate empezaría a gritar "las anclas están viejas" por ruido de
subasta — justo lo que no queremos que decida nada.**

**Veredicto:**
- **3 de 3 dentro** → **replica.** La tabla de §4.2 queda validada tal como está escrita, y P1-P4, E4/E8/E6 y el 8%
  de LPV→IC del tramo C (§4.4) se leen contra ella.
- **1 de 3 afuera** → **replica con nota.** Se escribe en el Runbook cuál se fue y en qué dirección, y esa métrica
  se lee con ese descuento en las demás piezas. Ningún corte se mueve.
- **2 o 3 de 3 afuera** → **las anclas están viejas.** Qué se hace, exactamente:
  1. **No se toca P0 ni se apaga nada por esto.** P0 sigue bajo la regla general de IC de §4.3 (< 16 IC a 72 h
     muere, 16-31 sobrevive, ≥ 32 dobla), que no depende de agosto sino de la economía ($6.000 por pedido, 2,54 IC
     por compra, $2.360/IC). **Los cortes de IC y $/IC no se mueven.**
  2. **Se cae la columna de anclas de §4.2**: el "gana con ≥ 4,0%" y el "≤ $189" de P2, el "≥ 40%" y el "≤ $160" de
     P4, y las anclas de P0 quedan sin respaldo y **no matan ni escalan ninguna pieza**.
  3. **Se rebasa la vara sobre P0, medido hoy**: el CTR saliente, el $/LPV y el hook rate que P0 midió en esta
     tanda pasan a ser la referencia, y P1, P2, P3 y P4 se leen contra **eso**. Es exactamente lo que P0 compra con
     sus $25.000/día: una referencia contemporánea, en la misma cuenta, la misma subasta y la misma semana.
  4. **El gate del tramo C se rebasa igual** (§4.4): el 8,0% de LPV→IC también es un ancla de agosto sobre esta
     misma landing. Si P0 replicó el creativo y su LPV→IC sale claramente abajo del 8%, el que se movió no es el
     creativo — así que el tramo C se abre si el agregado del tramo A **le gana al LPV→IC de P0**, no al 8%
     histórico. Se anota el número con su fecha.
  5. **Se registra en el vault, en la nota que afirma las anclas**, no en una nota nueva: la tabla de agosto pasó a
     ser una foto vieja y la próxima tanda no puede seguir citándola.
  6. Y queda dicho lo que el gate **no** puede: con un solo ad set no separa "el mercado se movió" de "R2 entrega
     distinto que R3". Dice que la vara no sirve, no por qué. Para este plan alcanza, porque la acción es la misma.

**Por qué esto vale más que el A/B interno que había.** El gate viejo comparaba P0 contra P2 para decidir si
"objetos sin cara" quedaba refutado: una respuesta **relativa**, sobre **una sola** hipótesis de formato, que
además ya está cubierta por otro lado — P2 tiene su corte propio a 48 h (CTR saliente < 3,4% → apagar) y P4 el suyo
(0 IC con $37.500 → apagar), así que el formato se contesta igual sin el A/B. El gate nuevo, en cambio, valida
**toda la vara de medición a la vez**: cada "gana con ≥ X" de §4.2, los $/LPV de referencia y el 8% del tramo C son
números de agosto, y si el mercado o la landing se movieron están **todos** mal al mismo tiempo. El A/B viejo no
tenía forma de detectarlo: habría corrido feliz encima de una tabla rota y habría entregado un veredicto de formato
leído contra una vara falsa. Y el precio del cambio es cero: el mismo anuncio, la misma plata, las mismas 72 h.

**La atribución de P0, y qué significa para leer sus resultados** *(decisión de Pancho 04/09: se reusan los post IDs)*. Un
creative armado por `object_story_id` **no admite `url_tags` propios ni cambiar el link**: el destino y el texto
viven en el post. O sea que **a P0 no se le puede inyectar `utm_content={{ad.id}}`**, y es el único anuncio de la
tanda que no lo lleva. En orden:
- **Todo lo que este gate lee no se ve afectado**: CTR saliente, $/LPV, hook rate, IC y $/IC salen de
  `GET /<ad_id>/insights` y `GET /<adset_id>/insights` por Graph, que no dependen del UTM. El gate de replicación,
  los cortes de 48 h / 72 h / día 7 y el gate del tramo C se leen igual que en cualquier otra pieza.
- **Lo que se pierde es el join por UTM en el panel `/anuncios`**: las ventas de P0 no van a traer `utm_content`
  con su ad id. La atribución de la casa no cuelga de ahí —**va por el beacon del formulario, 84-90% de
  cobertura**— así que la venta no queda huérfana; pero si alguna vez se audita P0 por UTM, no hay UTM.
- **El desempate barato**: P0 es **el único anuncio de su ad set**, así que toda venta atribuida a
  `arraigo-OPEN-AR-3060-p0-ugcB-25k` es de P0, sin ambigüedad. Para esta tanda alcanza.
- **Y el link del post no se puede corregir**, así que se verifica **antes** de crear nada (paso 0.3): si el post
  de agosto no apunta a la landing actual, P0 por post no se arregla — se descarta y vuelve la migración del MP4.

### 4.6 Lo que no se lee

CPA de día 1 · compras de días 1-3 · ningún anuncio que haya compartido ad set con otro de distinto formato ·
la asignación de presupuesto de Meta como veredicto · y **si el `InitiateCheckout` está inflado por el dedup
CAPI pendiente (§7-15), todos los cortes de este plan bajan** — se anota en el día 0.

---

## 5. Orden exacto de producción

`PROD` = `docs/creativos/arraigo-plan-0309/prod/`. Carpetas: `datos/`, `p0/`, `p1/ p2/ p3/ p4/` (cada una con
`keyframes/ clips/ voz/ master/ cortes/ miniatura/`; `p1/tarjetas/`; `p3/sonda/ avatar/`), `e4/ e8/ e6/ e1/ e5/ e7/`,
`qa/`, `lanzar/` (no hay carpeta `landing/`: la landing no se toca). Constantes de los 4 videos nuevos: **9:16 1080×1920 · categoría dicha antes del segundo 3 ·
síntoma en el primer cuadro · producto no antes del 70% · último cuadro = la mano recibe el frasco en la puerta,
etiqueta legible · sin cara a cámara (salvo P3) · voz femenina rioplatense · subtítulos y toda letra por código ·
 cero cuero cabelludo con clareo · ningún precio · ninguna promesa de resultado · "una pipeta" (la redacción que existe
en la landing, §7-3) · cero claims de textura (§7-4) · **la garantía de 90 días SÍ se dice, en el cierre de las 5 piezas**
(§7-5) · miniatura a mano.**

**Masters cortos** *(decisión de Pancho 03/09)*: P1 y P2 **32 s**, P3 **40 s**, P4 **32 s**, y un **bumper de 8-10 s**
por pieza como segundo anuncio. Se recortó sacando repetición y beats intermedios; **nunca** la categoría antes del
segundo 3, ni el síntoma del primer cuadro, ni el cierre en la puerta. Respaldo: agosto midió **tiempo medio de
reproducción 5-8 s y ThruPlay 18-29%** sobre un archivo de 18,5 s.

**Cobro en puerta, cerrado por Pancho el 03/09/2026**: **QR de Mercado Pago en todo el país; en CABA y GBA además
efectivo.** Los creativos dicen **"sin tarjeta"** y **"pagás cuando te llega"**; **"sin cuenta de nada" sigue
prohibido** (el QR pide una billetera) y **el efectivo solo se nombra si alguna vez hay un ad set de solo AMBA**.

**Gate 1 (compliance grado 2 sobre guiones + bodies + landing) — corrido por el agente 6 sobre este documento,
03/09/2026: PASA.** Ninguna palabra de patología (alopecia, calvicie, DHT, hormonas, folículo, menopausia), ningún
claim de crecimiento, ninguna comparación con fármaco más allá de "sin minoxidil" chico en el body, ningún precio,
ninguna cuota. **Las restricciones preventivas se levantan** *(decisión de Pancho 03/09)*: verificado por Graph hoy,
**los 9 anuncios de ARRAIGO de agosto tienen `ad_review_feedback` vacío e `issues_info` vacío — cero rechazos**,
incluidos los tres antes/después de personas. Quedan solo los límites que no cuestan nada: **nada de patología, DHT,
hormonas ni caja de medicamento** — y la **garantía de 90 días entra en ronda 1**, con el texto que la landing ya
enuncia. Lectura fijada: el diario de
P1/E4 ("mes 2: menos pelo en el cepillo", "la colita vuelve a dar dos vueltas") narra **síntomas en primera
persona**, no promete; queda prohibido pasarlo a segunda persona con promesa ("vas a ver…").

### Escalón 0 — la réplica P0 en Meta, PAUSED, y los datos (US$0, pauta $0)

**(decisión de Pancho 03/09: la landing se queda como está): acá no hay ningún paso de landing, theme ni backup.** Lo que era "crear P0" en el tramo A pasa a este escalón.

**Y desde el 04/09 tampoco hay paso de video** *(decisión de Pancho 04/09: se reusan los post IDs)*: no se baja ni se resube el
MP4 de agosto. P0 se arma sobre el post `824765737394913_122139167943156780`, que cruza de R3 a R2 porque la página
es la misma en las dos cuentas (§3.0). Como el lanzador no soporta `object_story_id` (§3.5), **P0 lo crea
`meta-operador` a mano por Graph**, y por eso el escalón 0 **ya no depende de la sesión de código**.

| # | paso | herramienta (fallback) | input → output | costo · tiempo | responsable | gate |
|---|---|---|---|---|---|---|
| 0.1 | **Verificar el lanzador, ya no extenderlo** *(decisión de Pancho 04/09: se reusan los post IDs)*: el soporte de `video`/`video_id`, `url_tags` y `conversion_domain` **ya está mergeado en `main`** (commit `f033ae0`, leído entero el 04/09/2026, §3.5). Lo que **no** tiene y no se le agrega en esta tanda es `object_story_id` | `git -C ~/AppAds-tabla log --oneline -- scripts/lanzar.mjs` + `node scripts/lanzar.test.mjs` | → test verde (o la sesión de código que lo ponga verde) | $0 · 15 min | sesión de código | **bloquea el tramo A (A.1), ya no el escalón 0**: P0 no pasa por el lanzador |
| 0.2 | Crear la campaña (§3.1) **en R2** y leer `instagram_user_id` del creative de agosto (la página ya se sabe: `824765737394913`) | `meta-operador`: `POST /act_880189106877616/campaigns` + `GET /<creative_id>?fields=object_story_spec` | → `<CAMPAIGN_ID>`, `<IG_USER_ID>` en `PROD/lanzar/ids.md` | $0 · 15 min | `meta-operador` | **OK escalón 0** literal en el prompt |
| 0.3 | **Verificar el post de agosto antes de reusarlo** *(decisión de Pancho 04/09: se reusan los post IDs)*, **solo lectura, no se baja ni se resube nada**: `GET /824765737394913_122139167943156780?fields=id,permalink_url,message,created_time` y, de control, `GET /<ad_id de agosto>?fields=name,creative{effective_object_story_id}` para confirmar que ese post es el de `arraigo-ugcB-copyD-antiriesgo`. Tres chequeos: (a) el post existe y cuelga de la página `824765737394913`; (b) su texto es el `copyD` de §2.3 palabra por palabra; (c) **su link es la landing actual** | Graph, solo lectura | → `PROD/lanzar/post-p0.md` (id, permalink, texto, link, fecha de lectura) | $0 · 10 min | `meta-operador` | **si el link del post no es la landing actual, P0 por post se descarta** (no se puede cambiar, §4.5) y vuelve la migración del MP4 como plan B |
| 0.4 | **Crear P0 a mano por Graph** *(decisión de Pancho 04/09: se reusan los post IDs)* — el lanzador no soporta `object_story_id` (§3.5), así que acá no se corre `lanzar.mjs`: (a) ad set `arraigo-OPEN-AR-3060-p0-ugcB-25k` copiando `targeting`/`promoted_object`/`optimization_goal`/`billing_event`/`bid_strategy`/`attribution_spec`/`destination_type` del modelo `120251431485570257`, `daily_budget` 2.500.000, `status: PAUSED`; (b) `POST /act_880189106877616/adcreatives` con **`{ "name": "arraigo-ugcB-copyD-replica-A18", "object_story_id": "824765737394913_122139167943156780" }` y nada más** — sin `object_story_spec`, sin `url_tags`, sin `link`, sin `message`, sin `image_hash`; (c) `POST /act_880189106877616/ads` con ese `creative_id`, `conversion_domain: "biolabsarg.com"` y `status: "PAUSED"`. La especificación escrita es `A1-p0.json` (§3.5) | `meta-operador` por Graph (Runbook §3), el mismo camino que el tramo D (§3.6) | → ad set P0 + 1 ad, PAUSED; ids en `PROD/lanzar/ids.md` | $0 · 20 min | `meta-operador` | no hay assert de body que pasar: P0 no lleva body propio. **"Blocked by classifier" = el harness, no Meta: sesión nueva** |
| 0.5 | Preview de P0 a 380 px (`ads_get_ad_preview`, `MOBILE_FEED_STANDARD` + `INSTAGRAM_STORY`) y relectura por Graph. **En P0 la verificación es otra** *(decisión de Pancho 04/09: se reusan los post IDs)*: que el preview muestre el video de agosto y el `copyD` (ésa es la prueba de que el post entró bien), que el creative tenga `object_story_id` y **no** `object_story_spec`, PAUSED, `daily_budget` 2.500.000 centavos, **`promoted_object.pixel_id` = `781630351556303`**, `targeting.advantage_audience` = 0, `conversion_domain`. **`url_tags` no se verifica: P0 no lo lleva ni lo puede llevar** (§4.5) | conector Meta (solo lectura) + Graph | → `PROD/lanzar/previews/p0.png`, `PROD/lanzar/verificacion-0.md` | $0 · 15 min | agente 6 / `meta-operador` | gate 5; si algún campo del modelo de R3 no cruzó, aplicar el fallback de §3.3 |
| 0.6 | **Verificar que el form COD no pide dato de pago** (lectura, sin tocar nada). P0 y P2 lo afirman en audio. **Hecho por el agente 6 el 03/09/2026 sobre el HTML servido**: campos `fName fPhone fDni fEmail fStreet fNum fFloor fCity fCP fProv fNotes`, ningún campo de tarjeta/CVV; existe la opción `cuotas_3` del form (queda, §7-6). Se repite el día antes de prender | `curl -s <landing>` + `/usr/bin/grep -o 'id="f[A-Z][A-Za-z]*"'` y `/usr/bin/grep -i "card\|cvv\|tarjeta"` | → `PROD/datos/form-check.md` | $0 · 2 min | agente 6 | bloquea el render de P2 |
| 0.7 | **Qué ve un CP que rutea a Correo (prepago)** (lectura): si la landing dice "pagás al recibir" a un CP sin COD, P0/P2/E4 son un reclamo ahí; se registran las zonas como arrastre. El targeting no cambia | `consultas-datos` (ruleset por CP en la base) + lectura de la landing con un CP de Correo | → `PROD/datos/correo-cp.md` | $0 · 30 min | `consultas-datos` | bloquea el lanzamiento |
| 0.8 | **Contador de la EMPRESA** (§7-9, consulta en palabras) | `consultas-datos` sobre Supabase `biolabs-finanzas` | → `PROD/datos/contador-empresa.md` (histórico y 60 días, fecha, consulta usada) | $0 · 30 min | `consultas-datos` | va a ronda 2 solo si ≥ 1.000 |
| 0.9 | Techo de ad sets de R2 = conversiones 7d ÷ 50 — **informativo, ya no bloquea** (§3.0: 16 de los 23 ACTIVE son hijos de CBO y la mediana de la cuenta es 15/semana) | `lectura-tanda` | → `PROD/datos/techo-adsets.md` | $0 · 15 min | `lectura-tanda` | — |
| 0.10 | IC por anuncio de agosto (`omni_initiate_checkout` por ad, solo lectura, en R3) → LPV→IC de `copyC` y `copyD` medido | `meta-campanas` (Graph, solo lectura) | → `PROD/datos/ic-agosto.md` | $0 · 15 min | `meta-campanas` | afina las anclas de §4.2 |
| 0.11 | Pedido real #21200 (x2, Mendoza, `pendiente` desde el 24/08) y las guías de pruebas canceladas que existen como PI en el courier (Urbano BLABS4111, 4118-4122; Fixy 1805691) | Veltron / `guias-couriers` | → resueltos aparte | $0 | operación | **no bloquea la tanda**; es operativo |

> **Cerrado el 03/09/2026, no hace falta paso**: *qué cobra cada courier en la puerta* — **QR de Mercado Pago en todo
> el país, y en CABA y GBA además efectivo** (respondido por Pancho). Consecuencia en los creativos: "sin tarjeta" sí,
> "sin cuenta de nada" no, efectivo solo en un eventual ad set de solo AMBA.

### Escalón 1 — tarjetas y estáticas por código (US$2-4 — OK §6)

| # | paso | herramienta (fallback) | input → output | costo (fecha) · tiempo | responsable | gate |
|---|---|---|---|---|---|---|
| 1.1 | **7 tarjetas de P1** (1080×1920, fondo crema de marca, tipografía de marca ExtraBold, hito en versalitas chicas arriba y frase grande abajo; cero texto por IA): A1 `Probé un sérum de romero 90 días` / `antes de rendirme.` / `Mes 1: nada.` · A2 `DÍA 1` · A3 `SEMANA 2` · A4 `MES 1` · A5 `MES 2` · A6 `MES 3` · **A7 (bumper) `Mes 1: no vas a ver nada. Te lo digo antes.`** (la tarjeta `DÍA 0` sale con el beat de la puerta del arranque: el master es de 32 s) | HTML (patrón `~/Downloads/arraigo-ml-galeria/html/`) → Chrome headless: `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1080,1920 --screenshot=<png> file://<html>` (fallback: overlay por código de la Fábrica AppAds) | → `PROD/p1/tarjetas/A1.png … A7.png` | US$0 (patrón vivo 21/08/2026) · 1 h | `tanda-creativos` | **4 preguntas de Pancho a 380 px sobre las tarjetas** antes del escalón 2 |
| 1.2 | **E4** 4:5 y 9:16 del mismo HTML (texto §2.4; packshot real de la landing en la franja, nunca render) | idem 1.1 con `--window-size=1080,1350` y `1080,1920` | → `PROD/e4/e4-4x5.png`, `e4-9x16.png` | US$0 · 45 min | `tanda-creativos` | gates 2-4 |
| 1.3 | **E8**: (a) cargar en `creativos_ganadores` la referencia correcta —`pureza-02-mix-base-v02`, `formato` estática, `imagen_url` viva; ojo con el `×` en `landing_url`— o la Fábrica imita otra cosa; (b) overlay `comparativa` (`app/api/estatica/overlay.js`, layout del 05/08/2026): texto y grilla por código; (c) **1 tirada de tres íconos planos en fila**, cortada en tres, un ícono casi bien se edita con PIL, no se regenera; **ningún ícono de cabeza con parche** | Fábrica AppAds + `fal-ai/nano-banana-pro/edit` 1K. Prompt de íconos (decidido en 06, el 05 no lo escribe): *"Tres íconos planos en fila, estilo línea simple de un solo color sobre fondo crema, sin sombras: una almohada con dos pelos sueltos, un peine sobre una raya de pelo, un elástico de pelo enrollado. Sin texto, sin cabezas, sin caras, sin cuero cabelludo."* | → `PROD/e8/iconos.png`, `e8-4x5.png`, `e8-9x16.png` | US$0,15-0,30 (1K US$0,15 al 17/07/2026; 2K US$0,30 al 27-31/07/2026) · 1-1,5 h | `tanda-creativos` / Fábrica | gates 2-4 |
| 1.4 | **E6 mujer**: 3-6 tiradas de la escena; texto en HTML; **QA con zoom: si la IA dibuja clareo en la raya, la tirada se descarta** | `fal-ai/nano-banana-pro/edit` 2K. Prompt: *"Mujer de 40 años de tres cuartos frente al espejo del baño, peine en mano moviéndose la raya del pelo. Pelo castaño peinado y abundante, sin primer plano del cuero cabelludo, sin clareo visible. Cara fuera de foco o girada. Luz de baño de casa, fotografía de celular. Vertical."* (fallback `fal-ai/flux-2-pro/edit`; luz: Freepik `images_relight` US$0,18/pieza, 08/2026) | → `PROD/e6/escena-mujer.png`, `e6-raya-4x5.png`, `e6-raya-9x16.png` | US$0,90-1,80 (3-6 × US$0,30, 27-31/07/2026) · 1 h | `tanda-creativos` | gates 2-4. **E6 hombre no se produce en este escalón** (§2.2; prompt guardado para ronda 2: *"Hombre de 38 años con el celular en la mano sacándose una selfie de frente, una gorra apoyada sobre la mesada del baño al lado. Pelo corto, peinado. Cara fuera de foco. Luz de baño de casa. Vertical."*) |
| 1.5 | **E1 y E7** (retargeting, US$0): HTML con los textos §2.4; E7 reusa el panel izquierdo de `docs/creativos/arraigo-tanda-0608/est-cepillo-mes1-mes3.png` (un solo panel, sin "Mes 1 / Mes 3"). **E5 no se produce**: su pieza es el precio (decisión de Pancho 03/09: la landing se queda como está) | idem 1.1 | → `PROD/e1/e1-4x5.png`, `PROD/e7/e7-4x5.png` | US$0 · 1 h | `tanda-creativos` | gates 2-4; se cargan recién en el tramo D |
| 1.6 | **QA `qa-ojo-de-cliente`** sobre tarjetas + E4/E8/E6 (+ E1/E7): veredicto binario, **máximo 2 rondas**, a la segunda no lanzable se descarta | skill `qa-ojo-de-cliente` | → `PROD/qa/escalon1.md` | $0 · 30 min | skill, antes de que llegue a Pancho | gate 2 |
| 1.7 | **Las 4 preguntas de Pancho a 380 px, 60 s, sin brief**: (1) ¿qué producto es y para qué sirve? (2) ¿este mensaje ya lo estoy diciendo en otra pieza? (3) ¿hay piel afectada, antes/después o algo que Meta lea como enfermedad, incluida la miniatura? (4) ¿el último cuadro tiene el producto en una mano o en uso? — cualquiera falla → vuelve a producción | Pancho, en el teléfono | → `PROD/qa/escalon1-pancho.md` | $0 · 10 min | Pancho | gate 3; **las tarjetas de P1 aprobadas acá desbloquean el escalón 2** |

### Escalón 2 — P1 y P2 (US$16-18 + sonda Seedance — OK §6). Requiere 0.6 (form verificado) y 1.7 pasado

| # | paso | herramienta (fallback) | input → output | costo (fecha) · tiempo | responsable | gate |
|---|---|---|---|---|---|---|
| 2.1 | **Verificar la voz**: `ELEVENLABS_VOICE_ID` de `~/AppAds-tabla/.env.local`; generar 5 s de prueba; **medir el pitch mediano del wav: mujer 165-255 Hz** (el género cruzado falló en vivo el 03/08) | ElevenLabs `eleven_multilingual_v2` + `uvx --from aubio aubiopitch -i <wav>` (fallback `librosa.pyin`) | → `PROD/p1/voz/check.md` (voice_id, pitch, fecha) | ≈ US$0 · 15 min | `tanda-creativos` | bloquea 2.4 |
| 2.2 | **7 keyframes de P1** (2K; B3, B4, B8 y B9 con **kontext multi + el packshot real de la landing** como referencia: la etiqueta la genera el modelo, nunca pegada). Prompts, textuales: **B1** *"Cenital de un cepillo de pelo de cerda blanca sobre una mesada de cocina argentina de granito claro, con una mata de pelo castaño oscuro enredada entre las cerdas. Luz de mañana de ventana, lateral, suave. Fotografía de celular, sin estilizar, sin viñeta. Sin texto, sin logos, sin envases. Vertical 9:16."* · **B3** *"Mujer de 40 años de espaldas/tres cuartos sentada en el borde de la cama, mesa de luz con velador encendido. Una mano sostiene un gotero de vidrio ámbar sobre la raya del pelo; la otra masajea con los dedos. Pelo castaño peinado y sano, plano medio, sin primer plano del cuero cabelludo, sin clareo. Sin cara reconocible. Luz cálida de velador. Vertical 9:16."* · **B4** *"Un frasco de vidrio ámbar con gotero, medio vacío, sobre una mesa de luz de madera junto a un velador apagado y un libro. La etiqueta la genera el modelo desde la referencia, nunca pegada. Luz de mañana. Vertical 9:16."* · **B5** *"Almohada blanca arrugada a la mañana, luz cruda de ventana entrando de costado, dos pelos largos castaños sobre la funda. Fotografía de celular, sin estilizar. Vertical 9:16."* · **B7** *"Mujer de espaldas frente al espejo del baño atándose una colita castaña con un elástico negro; la mano da la segunda vuelta. Pelo abundante y peinado. Sin cara. Luz de baño de casa. Vertical 9:16."* · **B8** *"Tres frascos de vidrio ámbar con gotero, alineados sobre una mesada de cocina clara, junto a un dermaroller en su caja abierta. Etiquetas generadas desde la referencia de producto, legibles y correctas. Luz de cocina de día. Vertical 9:16."* · **B9** *"Primer plano de dos manos recibiendo una caja de cartón kraft abierta en el umbral de una casa; adentro se ven tres frascos de vidrio ámbar con gotero. Etiqueta frontal legible generada desde la referencia. Sin uniforme ni logos de courier. Luz de día. Vertical 9:16."* (**B2 puerta cerrada y B6 desagüe salen**: el master de 32 s no los usa) | `fal-ai/nano-banana-pro/edit` 2K (fallbacks: B1 `fal-ai/flux-2-pro/edit`; B3-B7 Fábrica AppAds 1K; B8 Freepik referencia `arraigo` id 2235453) | → `PROD/p1/keyframes/B1,B3,B4,B5,B7,B8,B9.png` + `PROD/p1/keyframes/qa-zoom.md` (clareo, logos de courier/billetera, etiquetas con garbles → se descarta la tirada) | **US$3,30** (7 + reintentos ≈ 11 × US$0,30, 27-31/07/2026) · 45 min | `tanda-creativos` | gate 4 sobre cada keyframe |
| 2.3 | **6 clips i2v de 4-5 s** (uno por keyframe salvo B4, que va fijo): movimiento mínimo —la mano que sacude el cepillo, el gotero que baja, el elástico que da la vuelta, las manos que reciben la caja—, **cámara quieta**; reintentar ante 500 transitorio en el poll | `fal-ai/kling-video/v3/turbo/standard/image-to-video` (Kling 3.0 Turbo) | → `PROD/p1/clips/` | **US$4,70** (~42 s con reintentos × US$1,12/10 s, tarifa de lista fal jul/2026) · 45 min | `tanda-creativos` | — |
| 2.4 | **Voz P1 (~32 s**, tono confidencial y bajo, ritmo lento, sin sonrisa), guion textual: *"Probé un sérum de romero para la caída. Te cuento el mes uno. — Día uno: una pipeta en la raya, un minuto de masaje, y a dormir. — Semana dos: no vas a ver nada. Es cuando la mayoría lo deja. Te lo digo antes. — Mes uno: lo primero que cambia no es el espejo. Es la almohada. Y el cepillo. — Mes dos: la colita vuelve a dar dos vueltas. — Mes tres. Son noventa días: tres frascos y el aplicador. — No pagás hasta tenerlo en la mano. Y si no te convence, nos avisás: tenés noventa días de garantía."* Recortar el 2-5% de silencio del final. Tiempos palabra por palabra con whisper | ElevenLabs (fallback Freepik `audio_tts` "Argentine accent") + `uvx --from openai-whisper whisper PROD/p1/voz/p1.wav --language es --word_timestamps True --output_format json` | → `PROD/p1/voz/p1.wav`, `p1.json` | ≈ US$0 · 30 min | `tanda-creativos` | 2.1 pasado |
| 2.5 | **Montaje P1 (32 s)**: 0:00-0:05 B1 + tarjeta A1 (`Mes 1: nada.`) · 0:05-0:10 B3 + `DÍA 1` · 0:10-0:16 B4 fijo → B1 + `SEMANA 2` · 0:16-0:21 B5 + B1 + `MES 1` · 0:21-0:25 B7 + `MES 2` · **0:25-0:28 B8 + `MES 3` (packshot al 78%)** · **0:28-0:32 B9 (último cuadro, la puerta)**. Subtítulos quemados **entre el 60% y el 68% de la altura**, sans bold 72-80 px, blanco con contorno negro 4 px + caja negra al 40%, **máximo 3-4 palabras por tarjeta**, karaoke; franja de marca `ARRAIGO · Sérum capilar anticaída` por HTML → PNG → overlay; **sin música**. **Bumper C9** = tarjeta A7 + B1 (3 s, *"Semana dos: no vas a ver nada. Te lo digo antes de que lo pidas."*) + B9 (5 s, *"No pagás hasta tenerlo en la mano. Noventa días de garantía."*). Miniatura: cuadro 0 | ffmpeg local (skill `ffmpeg`; fallback `drawtext` por palabra si el ASS falla) | → `PROD/p1/master/p1-A32.mp4`, `PROD/p1/cortes/p1-A32.mp4`, `p1-C9.mp4`, `PROD/p1/miniatura/p1.jpg` | US$0 · 1 h | `tanda-creativos` | gates 2-4 |
| 2.6 | **6 keyframes de P2** (**B1 cepillo y el gotero se reusan de P1**, US$0). Prompts: **B3** *"Mujer de espaldas frente al espejo del baño; el elástico negro da la tercera vuelta sobre una colita castaña fina. Pelo peinado, sin cuero cabelludo visible, sin cara. Luz de baño de casa. Vertical 9:16."* · **B4** *"Olla de aluminio vieja sobre una hornalla de casa, agua hirviendo con ramas de romero fresco adentro, vapor. Cocina argentina modesta, luz de tarde. Fotografía de celular. Vertical 9:16."* · **B5** *"Granos de café tostados desparramados sobre una tabla de madera clara, luz lateral de mañana, primerísimo plano. Vertical 9:16."* · **B6** *"Umbral de una casa argentina; la puerta se abre y hay una caja de cartón kraft chica y lisa, sin nada impreso. Luz de mediodía. Sin uniforme ni logos de courier, sin cara del repartidor. Fotografía de celular. Vertical 9:16."* · **B7** (kontext multi + packshot) *"Dos manos abriendo una caja de cartón kraft; adentro, tres frascos de vidrio ámbar con gotero y un dermaroller. Etiquetas generadas desde la referencia de producto, legibles. Luz de día. Vertical 9:16."* · **B9** (kontext multi) *"Primer plano de una mano entregando billetes y otra sosteniendo un frasco de vidrio ámbar con gotero, en el umbral de una casa, con la caja kraft abierta abajo. Etiqueta frontal legible generada desde la referencia. Sin logos de courier ni de billeteras. Luz de día. Vertical 9:16."* (**la góndola de envases genéricos sale**: era el beat que se recortó) | `fal-ai/nano-banana-pro/edit` 2K (fallbacks: B3 `flux-2-pro/edit`; B4/B5 Freepik `stock_search`; B7/B9 Fábrica 1K) | → `PROD/p2/keyframes/B3,B4,B5,B6,B7,B9.png` + `qa-zoom.md` | **US$2,70** (6 + reintentos ≈ 9 × US$0,30) · 45 min | `tanda-creativos` | gate 4 |
| 2.7 | **7 clips i2v** Kling, movimiento mínimo, cámara quieta. **+ la sonda Seedance 2.0: un solo clip, la puerta que se abre (B6)**, con `account_balance` de Freepik leído **antes y después**, delta registrado con fecha; **si el delta supera ~300 créditos, Seedance no entra al pipeline** y no se vuelve a tocar (saldo al 03/09/2026: 15.890/20.000) | Kling 3.0 Turbo · sonda: Freepik `video_generate` (Seedance 2.0) + `account_balance` ×2 | → `PROD/p2/clips/` + `PROD/p2/sonda-seedance.md` (saldo antes, después, delta, fecha, veredicto) | **US$5,50** (~49 s × US$1,12/10 s) + **la sonda, a medir** · 1 h | `tanda-creativos` | — |
| 2.8 | **Voz P2 (~32 s**, **la misma voz que P1**), guion textual: *"Un sérum para la caída del pelo que no pagás hasta tenerlo en la mano. — La vuelta que antes daba dos ahora da tres. No es la edad: es la raíz. Si a la raíz le llega poco, el pelo nace más fino. — El agua de romero que hervían las abuelas iba justo ahí; le faltaba constancia: todas las noches, tres meses. Eso es ARRAIGO: romero y cafeína sobre la raíz. Sin minoxidil. — Te llega la caja, la abrís: tres frascos y el aplicador. Una pipeta de noche, un minuto de masaje. — Y recién ahí le pagás al que te lo trajo. Noventa días de garantía: si no te convence, nos avisás."* **SFX solamente**: timbre y puerta en 0:23, ambiente de calle bajo hasta 0:32; sin música | ElevenLabs + whisper · SFX: ElevenLabs `audio_sfx_generate` o el audio nativo del clip de la sonda | → `PROD/p2/voz/p2.wav`, `p2.json`, `PROD/p2/voz/sfx-puerta.wav` | ≈ US$0 · 30 min | `tanda-creativos` | — |
| 2.9 | **Montaje P2 (32 s)**: 0:00-0:05 B1 (cepillo, categoría en el segundo 1) · 0:05-0:12 B3 (la colita, "no es la edad, es la raíz") · 0:12-0:23 B4 + B5 (romero hirviendo y café) · **0:23-0:28 B6 → B7 → gotero (packshot al 72%, ya en la puerta)** · **0:28-0:32 B9 (último cuadro: la mano paga y se queda con el frasco)**. Subtítulos y overlay como 2.5. **Bumper C9** = B1 (3 s, *"Un sérum para la caída del pelo que no pagás hasta tenerlo en la mano."*) + B7 (3 s, *"Tres frascos y el aplicador."*) + B9 (3 s, *"Recién ahí le pagás. Noventa días de garantía."*). Miniatura: la caja abierta con los tres frascos | ffmpeg | → `PROD/p2/master/p2-A32.mp4`, `PROD/p2/cortes/p2-A32.mp4`, `p2-C9.mp4`, `PROD/p2/miniatura/p2.jpg` | US$0 · 1 h | `tanda-creativos` | gates 2-4 |
| 2.10 | **QA de P1 y P2**: `qa-ojo-de-cliente` (≤ 2 rondas) → 4 preguntas de Pancho a 380 px → compliance grado 2 sobre render + miniatura con zoom (cuero cabelludo, clareo, logos de courier o billetera generados, etiqueta con garbles) | skill + Pancho + agente 6 | → `PROD/qa/escalon2.md` | $0 · 45 min | skill / Pancho / agente 6 | gates 2, 3, 4 |

**Total escalón 2: US$16-18 + sonda Seedance a medir · 7-9 h.**

### Escalón 2b (opcional) — P4 (US$7-8 — OK propio). Solo si una celda del tramo A murió a 48 h y liberó presupuesto, o si Pancho lo pide aparte

| # | paso | herramienta | input → output | costo · tiempo | responsable | gate |
|---|---|---|---|---|---|---|
| 2b.1 | **5 keyframes nuevos** (reusa: colita fina = P2-B3, gotero = P1-B3, tres frascos = P1-B8, la puerta = P1-B9). Prompts (decidido en 06 bajo las constantes del 05): **K1** *"Mano de mujer tapando el lente de un celular en primer plano, fondo de living desenfocado con un grupo de amigas; una de ellas se corre al fondo. Sin caras nítidas. Luz de casa. Vertical 9:16."* · **K2** *"Peine negro corriendo la raya del pelo hacia el costado, mujer de tres cuartos frente al espejo del baño, pelo castaño abundante y peinado, sin cuero cabelludo visible, sin cara. Luz de baño. Vertical 9:16."* · **K3** *"Espejo de ascensor con luz fría; mujer de espaldas mirando hacia abajo, pelo castaño peinado. Sin cara, sin cuero cabelludo. Vertical 9:16."* · **K4** *"Foto de cumpleaños tomada desde arriba en la pantalla de un celular sostenido por una mano, mesa con torta y velas, personas desenfocadas. Sin caras nítidas. Vertical 9:16."* · **K5** *"Gotero de vidrio ámbar sobre la raya del pelo, dedos masajeando, mesada de baño con luz de día; pelo castaño peinado, sin cuero cabelludo, sin cara. Vertical 9:16."* | `nano-banana-pro/edit` 2K | → `PROD/p4/keyframes/K1…K5.png` | **US$2,40** (5 + reintentos ≈ 8) · 45 min | `tanda-creativos` | gate 4 |
| 2b.2 | **6 clips Kling de 4-5 s**, movimiento mínimo | Kling 3.0 Turbo | → `PROD/p4/clips/` | **US$4,70** (~42 s con reintentos) · 45 min | `tanda-creativos` | — |
| 2b.3 | **Voz P4 (~32 s**, misma voz que P1/P2), guion textual: *"Hay algo que nadie te dijo de la caída del pelo: la colita no se afina de golpe. Se afina de a una vuelta de elástico. — Una. Dejaste de sacarte fotos con flash. Ahora te ponés atrás, o la sacás vos. — Dos. Dejaste la raya al medio. Te la corriste al costado y ya no volviste. — Y tres. Dejaste de mirarte de arriba: en el ascensor, en la foto del cumpleaños. Ninguna de las tres la decidiste. — ARRAIGO es un tratamiento de noventa días con romero y cafeína sobre la raíz. Una pipeta de noche, un minuto de masaje. Sin minoxidil. — No lo pagás hasta tenerlo en la mano. Y tenés noventa días de garantía."* | ElevenLabs + whisper | → `PROD/p4/voz/p4.wav`, `p4.json` | ≈ US$0 · 20 min | `tanda-creativos` | — |
| 2b.4 | **Montaje P4 (32 s)**: 0:00-0:04 colita 3ª vuelta · 0:04-0:10 K1 · 0:10-0:16 K2 · 0:16-0:23 K3 + K4 · **0:23-0:29 K5 + tres frascos (packshot al 72%)** · **0:29-0:32 la puerta**. **Bumper C10** = 0:00-0:04 (la colita) + 0:23-0:26 (gotero, *"romero y cafeína sobre la raíz"*) + 0:29-0:32 (la puerta). **Miniatura: la colita con el elástico; nunca el ascensor** (lee como tristeza: el eje del 98% de los rechazos del 30/07). Sin música | ffmpeg | → `PROD/p4/master/p4-A32.mp4`, `PROD/p4/cortes/p4-A32.mp4`, `p4-C10.mp4`, `PROD/p4/miniatura/p4.jpg` | US$0 · 1 h | `tanda-creativos` | gates 2-4 (como 2.10) |

### Escalón 3 — P3, la cara (3a sonda ~14 créditos · 3b el número de la sonda + US$6-7 — OKs §6)

| # | paso | herramienta (fallback) | input → output | costo (fecha) · tiempo | responsable | gate |
|---|---|---|---|---|---|---|
| 3.1 | **Voz P3**: **otra voz** que P1/P2 (peluquera 45-55, coloquial de mostrador, no locución); verificar VOICE_ID y pitch como 2.1. Guion textual del master de **40 s** — bloques de cara **a** (0:00-0:07, 0:12-0:23, 0:35-0:38 ≈ **21 s de cara**) y **b** de b-roll: **a1** *"Mi clienta de los jueves tiene cincuenta y dos. Me pidió que le corte más corto para que no se note la caída. Le dije que no."* · **b1** *"Después de los cuarenta y cinco el pelo cambia: la colita da una vuelta más, la raya se corre sola."* · **a2** *"Lo que más escucho en la silla es 'a mi edad ya está'. Que sea normal no quiere decir que no se pueda hacer nada: lo que pasa es en la raíz, donde no se ve. Le dije que probara noventa días con esto antes de cortarse nada."* · **b2** *"Yo lo veo antes que ellas: en el cepillo, y en las fotos que les sacan desde arriba."* · **b3** *"Es un sérum de romero y cafeína para la raíz. Una pipeta de noche, un minuto de masaje. Tres frascos, uno por mes, y el aplicador. Sin minoxidil."* · **a3** *"Y no le pedí ni la tarjeta: le paga al que se lo trae."* · **b4** *"Noventa días, y noventa días de garantía."* **Sin la palabra "menopausia", sin guardapolvo, sin diplomas, sin escenografía médica, todo en 3ª persona** | ElevenLabs (fallback Freepik `audio_tts` "Argentine accent") + whisper | → `PROD/p3/voz/p3-a1.wav`, `a2.wav`, `a3.wav` (un wav por bloque de cara), `p3-b.wav`, `p3.json` | ≈ US$0 · 30 min | `tanda-creativos` | — |
| 3.2 | **Sonda HeyGen (3a)**: **un** render de 8-10 s del bloque a1 con el photo-avatar propio (actriz ya integrada), `audio_url` = a1 (`script` y `audio_url` son excluyentes), `caption: {file_format: 'srt'}` pedido explícito, 9:16. **Saldo de créditos medido antes y después**, número con fecha | ruta de la casa `~/AppAds-tabla/app/api/testimonial/generar/route.js` (HeyGen) | → `PROD/p3/sonda/sonda.mp4` + `PROD/p3/sonda/sonda-heygen.md` (saldo antes, después, delta, créditos/s, fecha) | estimado **11-14 créditos** (1,4 créd/s medido 31/07/2026; **el 29/08 una estimación de 3 salió 113**) · 30 min con la espera | `tanda-creativos` | **OK 3a**; el número desbloquea el OK 3b |
| 3.3 | **P3 completo (3b)**: 3 bloques de cara ≈ **21 s** (el master corto bajó la cara de 31 s a 21), mismo avatar, mismo `caption` srt (HeyGen quema los subtítulos sobre el mismo audio que lipsyncea, sin desfase) | HeyGen (fallback **Freepik `video_speak` modo `veed-fabric-1.0`** sobre una imagen ya QA-eada, hasta 300 s de audio, **no verificado en la casa**, solo si HeyGen se queda sin saldo) | → `PROD/p3/avatar/a1.mp4, a2.mp4, a3.mp4` | **≈ 29-30 créditos estimados → el número real = créditos/s de la sonda × 21 s** · 1 h | `tanda-creativos` | OK 3b con el número de la sonda |
| 3.4 | **5 keyframes de b-roll** (2K; los dos últimos con kontext multi + packshot): **B1** *"Peluquería de barrio argentina, luz natural de ventana, espejos y sillas de fondo. Manos de peluquera separando el pelo de una clienta de espaldas; el elástico dando la tercera vuelta sobre la colita. Pelo peinado, sin cuero cabelludo, sin cara reconocible. Vertical 9:16."* · **B2** *"…cepillo de cerda blanca con pelo castaño enredado sobre la mesada del salón, tijera al lado. Sin cabezas. Vertical 9:16."* · **B3** *"…una clienta de espaldas mira en su celular una foto vieja tomada desde arriba en un cumpleaños; pantalla desenfocada, sin caras nítidas. Vertical 9:16."* · **B4** *"…gotero de vidrio ámbar sobre la raya de una clienta de espaldas, dedos masajeando, y los tres frascos con el aplicador sobre el mueble del salón. Etiquetas generadas desde la referencia. Vertical 9:16."* · **B5** *"Umbral de una casa argentina; la mano de una mujer recibe un frasco de vidrio ámbar con gotero, etiqueta frontal legible generada desde la referencia; sin uniforme ni logos de courier. Luz de día. Vertical 9:16."* (B2-B4 llevan el prefijo de B1) | `nano-banana-pro/edit` 2K (fallback `flux-2-pro/edit`) | → `PROD/p3/keyframes/B1…B5.png` + `qa-zoom.md` | **US$2,40** (5 + reintentos ≈ 8) · 45 min | `tanda-creativos` | gate 4 |
| 3.5 | **5 clips Kling de 5 s**, movimiento mínimo | Kling 3.0 Turbo (Seedance solo si la sonda 2.7 dio un número aceptable) | → `PROD/p3/clips/C1…C5.mp4` | **US$3,90** (~35 s con reintentos) · 45 min | `tanda-creativos` | — |
| 3.6 | **Montaje P3 (40 s)**: 0:00-0:07 a1 (cara) · 0:07-0:12 B1 · 0:12-0:23 a2 (cara) · 0:23-0:28 B2 + B3 · **0:28-0:35 B4 (packshot al 70%)** · 0:35-0:38 a3 (cara) · **0:38-0:40 B5 (último cuadro, la puerta)**. Subtítulos: **los nativos de HeyGen en los bloques de cara; ffmpeg + whisper en el b-roll, mismo estilo y misma altura**. Ambiente de peluquería muy bajo (secador lejano, tijera; ElevenLabs `audio_sfx_generate`). **Bumper C9** = 0:00-0:05 (desde *"Me pidió que le corte más corto"*) + 0:35-0:40 (la tarjeta COD y la puerta). Miniatura: la peluquera con la tijera en el salón, sin bata | ffmpeg | → `PROD/p3/master/p3-A40.mp4`, `PROD/p3/cortes/p3-A40.mp4`, `p3-C9.mp4`, `PROD/p3/miniatura/p3.jpg` | US$0 · 1 h | `tanda-creativos` | gates 2-4 (como 2.10; **prohibido** poner `copyC` sobre este visual: 2ª persona + condición sobre una cara = Atributos Personales) |
| 3c | **Rodaje real de la puerta**: 10 min con un cliente y un courier reales, celular, **consentimiento de los dos antes de filmar**; reemplaza las tomas generadas de la puerta en P1, P2 y P4. **Bloqueado hoy**: no hay pedido para filmar (los 11 reales están cerrados o en coordinación; los de SKU nuevo son pruebas). Entra cuando la tanda produzca entregas: elegir 1-2 pedidos `confirmado` con carrier **Fixy**, CABA/AMBA | celular | → `PROD/puerta-real/` | $0 | Pancho / operación | ronda 2 |

### Tramo A — carga de P1 y P2 en PAUSED, verificación y encendido ($225.000 — OK §6). Requiere el escalón 0 completo (P0 ya creado PAUSED en R2), 0.7 y 2.10

| # | paso | herramienta | input → output | responsable | gate |
|---|---|---|---|---|---|
| A.1 | `node scripts/lanzar.mjs PROD/lanzar/A2-p1-p2.json --check` → sin flag. **Antes de prender nada** | lanzador extendido (0.1), desde `~/AppAds-tabla`, con `META_WRITE_TOKEN` del system user `biolabsfinanzas` (**no regenerar el token**) | → ad sets P1 y P2 + 4 ads, PAUSED; ids en `PROD/lanzar/ids.md` | `meta-operador` | assert pasa porque P0 está PAUSED (§3.5). **"Blocked by classifier" = el harness, no Meta: sesión nueva** |
| A.2 | **Gate 5, preview a 380 px**: `ads_get_ad_preview` sobre cada `creative_id` en `MOBILE_FEED_STANDARD` e `INSTAGRAM_STORY`: copy cortado antes de la categoría, subtítulo tapado por la UI, miniatura mala → se corrige antes de prender | conector Meta (solo lectura) | → `PROD/lanzar/previews/<ad>.png` + `PROD/qa/preview-A.md` | agente 6 | gate 5 |
| A.3 | Verificar releyendo Graph (checklist del Runbook §4) en los 3 ad sets, P0 incluido: `body`/`title`/`description`/CTA/link coinciden con §2, `status` PAUSED, `daily_budget` **2.500.000 centavos**, `promoted_object.pixel_id` = `781630351556303`, targeting = modelo, `url_tags`, `conversion_domain`. **P0 se verifica distinto** *(decisión de Pancho 04/09: se reusan los post IDs)*: no tiene body/título/descripción/link nuestros ni `url_tags` — se verifica `creative.object_story_id` = `824765737394913_122139167943156780`, el ad set y el `conversion_domain` | `GET /<adset_id>?fields=…` · `GET /<adset_id>/ads?fields=…creative{body,title,video_id,image_hash,call_to_action_type}` | → `PROD/lanzar/verificacion-A.md` | `meta-operador` | — |
| A.4 | **Escribir el día 0 en el Runbook** (nueva sección "§6 sexies — ARRAIGO ronda 2"): ids, la vara de §4 con números, **el gate de replicación de §4.5 con sus tres bandas (CTR saliente 3,42-4,99% · $/LPV $149-324 · hook rate 33,9-40,2%) y el `object_story_id` que reusa P0** *(decisión de Pancho 04/09: se reusan los post IDs)*, el caveat del dedup CAPI, **"cuenta R2 por el impuesto; landing sin tocar por decisión de Pancho 03/09: reseñas inventadas y +3.569 presentes"**, y el techo de ad sets como dato informativo (§3.0) | `Edit` sobre `~/Claude/Obsidian/50-Proyectos/Runbook-Lanzar-Anuncios-API.md` (grep, nunca la nota entera) | → Runbook | `meta-operador` | **antes de prender** |
| A.5 | **Prender** con el OK de pauta A: `start_time` = 00:00 `-03:00` del día siguiente en los 3 ad sets, luego `status: ACTIVE` en campaña + 3 ad sets (los ads quedan `PENDING_REVIEW`/`IN_PROCESS` al nacer: normal). Si Pancho está presente y el harness bloquea, **él prende a mano en Ads Manager y una corrida de solo lectura verifica** | `meta-operador` | → `PROD/lanzar/encendido-A.md` (hora, ids, estados) | `meta-operador` | **OK pauta A** literal en el prompt |
| A.6 | **Día 1**: `effective_status` + `ad_review_feedback` por anuncio (gate 6). Rechazo → **no se apela**. Si el motivo es la landing (reseñas / "Prácticas empresariales"), **se registra y se lee como señal: la pieza no se corrige**. Si el motivo es la pieza, se corrige y se reemplaza el creative (vuelve a `IN_PROCESS`: esperado) | `lectura-tanda` | → Runbook | `lectura-tanda` | gate 6 |
| A.7 | **48 h / 72 h / día 7**: lectura contra §4 y veredicto por ad set (matar / esperar / dejar → escalar / ronda 2 / apagar). Ejecutar apagados o dobles de presupuesto: `meta-operador` con OK | `lectura-tanda` → `meta-operador` | → Runbook | `lectura-tanda` / `meta-operador` | OK por acción |

**Tramo B** (P3): `B-p3.json` con `--check` y sin flag → A.2-A.5 sobre P3 → OK pauta B. **Tramo A'** (P4): `2b-p4.json`,
idem, OK propio. **Tramo C** (estáticas): `C-estaticas.json` **solo tras el gate §4.4** → A.2-A.5 → OK pauta C.
**Tramo D**: §3.6 a mano por `meta-operador` → OK pauta D.

---

## 6. Secuencia exacta de OKs (texto literal que Pancho copia en el prompt de la corrida siguiente)

**(decisión de Pancho 03/09: la landing se queda como está) — el escalón 0 ya no toca la landing; el primer OK que
gasta es el escalón 1.** Regla de la casa: sin el OK copiado en el prompt, la corrida es dry-run. Cada OK desbloquea
solo su escalón.

| orden | OK | qué desbloquea | cuánto cuesta | texto literal |
|---|---|---|---|---|
| 1 | **escalón 0** | 0.2-0.5: la campaña en R2 y el ad set P0 con la réplica del anuncio de agosto, PAUSED — **no se resube nada** *(decisión de Pancho 04/09: se reusan los post IDs)* | $0 (no gasta) | `OK escalón 0: crear en Tienda R2 (act_880189106877616) la campaña ARRAIGO · ABO Open · DD-MM y el ad set P0 con el anuncio control armado sobre el post de agosto (object_story_id 824765737394913_122139167943156780), sin resubir video ni miniatura, todo PAUSED + gasto $0 + no se prende nada; la landing se queda como está` |
| 2 | **escalón 1** (el primero que gasta) | 1.1-1.7 | US$2-4 | `OK escalón 1: 7 tarjetas de P1 + estáticas E4, E8, E6-mujer + E1 y E7 para retargeting + gasto US$2-4 en fal.ai (nano-banana-pro) + nada se pautea; E6-hombre queda para ronda 2` |
| 3 | **escalón 2** | 2.1-2.10 | US$16-18 + sonda | `OK escalón 2: P1 diario (32 s) y P2 puerta (32 s), cada uno con su bumper de 9 s + gasto US$16-18 en fal.ai (keyframes 2K + Kling 3.0 Turbo) + 1 sonda Seedance de un clip con el saldo de Freepik medido antes y después; nada se pautea; la garantía de 90 días entra en el cierre` |
| 4 (opcional) | **escalón 2b** | 2b.1-2b.4 | US$7-8 | `OK escalón 2b: P4 colita (32 s) con su bumper de 10 s + gasto US$7-8 en fal.ai + solo porque una celda del tramo A murió a 48 h y liberó presupuesto` |
| 5 | **escalón 3a** | 3.1-3.2 | ~14 créditos HeyGen | `OK escalón 3a: sonda HeyGen de 8-10 s del bloque 1 de P3 con la actriz propia + gasto ~14 créditos HeyGen (estimado a 1,4 créd/s del 31/07, a medir) + saldo medido antes y después, número con fecha, sin renderizar el resto` |
| 6 | **escalón 3b** | 3.3-3.6 | N créditos + US$6-7 | `OK escalón 3b: P3 peluquera (40 s) completa con su bumper de 9 s + gasto <créditos/s de la sonda × 21 s> créditos HeyGen + US$6-7 en fal.ai + fallback video_speak de Freepik solo si HeyGen se queda sin saldo` (Pancho reemplaza `<…>` por el número que devolvió la sonda) |
| 7 | **pauta A** | A.5 | $225.000 | `OK pauta A: prender ARRAIGO · ABO Open · DD-MM en Tienda R2 (act_880189106877616) con los ad sets P0, P1 y P2 + gasto $225.000 (3 × $25.000/día × 3 días) + todo verificado por Graph en PAUSED, previews a 380 px pasadas, landing como está, que salgan mañana a las 00:00` |
| 8 | **pauta B** | P3 | +$75.000 | `OK pauta B: prender el ad set P3 peluquera + gasto +$75.000 ($25.000/día × 3 días) + los 6 gates de P3 cerrados; se lee con su propio reloj` |
| 9 | **pauta C** | E4, E8, E6 | +$225.000 | `OK pauta C: prender los ad sets E4, E8 y E6-mujer + gasto +$225.000 (3 × $25.000/día × 3 días) + solo porque el tramo A midió LPV→IC > 8% sobre ≥ 300 LPV contra la landing actual` |
| 10 | **pauta D** | retargeting | hasta $25.000 | `OK pauta D: prender el ad set de retargeting arraigo-RTG-LPV30d-5k con E1 y E7 + gasto hasta $25.000 ($5.000/día × 5 días) + pool ≥ 1.000 en el píxel a 30 días, apagar con frecuencia > 4` |
| en curso | **acciones de lectura** | apagar / doblar presupuesto / ronda 2 | según §4 | `OK lectura día <n>: <ad set> → <apagar | doblar a $50.000/día | mantener> + gasto <monto> + por <IC / $/IC medidos>` |

---

## 7. Prerrequisitos de landing y datos

**(decisión de Pancho 03/09: la landing se queda como está).** Los ítems 1-6, que modificaban la landing o el theme, pasan a
"decidido: no se toca", cada uno con su consecuencia concreta y lo que cambia en el plan. Los ítems 7 y 8 son
verificaciones de lectura y se mantienen. Los datos 9-16 se mantienen tal cual. Lo citado entre «» es la landing
viva leída el 03/09/2026 (HTML servido, sin tocar nada).

**Decidido: no se toca (1-6)**

- **1 · Reseñas inventadas y "+3.569" — quedan** («4,8/5 (+3.569 reseñas)», dos veces, y las 6 reseñas con nombre, edad y fecha). Consecuencia: **riesgo de rechazo por landing, asumido** (familia "Prácticas empresariales inaceptables", la misma que tumbó 2 ads de Pureza el 03/08; Meta revisa hasta la landing y las 8 piezas aterrizan ahí). Cambia en el plan: si Meta rechaza por eso, **no se apela** (regla de la casa), se registra el motivo de `ad_review_feedback` en el Runbook y **se lee como señal**; la pieza no se corrige porque el defecto no está en la pieza (paso A.6).
- **2 · Precio — queda como está.** Relevado: el texto de la landing dice «A $89.990 los tres» y «$49.900» el frasco; el $89.900 que reporta el 05 vive en la grilla de Kaching (JS, no verificable en el HTML servido); las órdenes dicen $89.990. Cambia en el plan: **ningún anuncio muestra precio** — verificado en 06 sobre los 18 bodies y el headline (§2.3); **E5 sale** de la tanda porque su pieza ES el precio.
- **3 · Dosis — queda.** La landing dice hoy las dos cosas: «una pipeta (1 ml)», «1 ml (una pipeta)», «Una pipeta y listo» **y** «Cuatro gotas, 60 segundos, una vez por día», «las cuatro gotas». Cambia en el plan: **guiones, bodies y JSON del lanzador quedan con "una pipeta"**, porque esa redacción existe en la landing; "cuatro gotas" queda como inconsistencia asumida (§9). El `og:image` `g1-beneficios` no se regenera.
- **4 · FAQ "acuoso, secado rápido" vs base oleosa — queda.** Cambia en el plan: nada nuevo: **cero claims de textura** en las 8 piezas (ya era constante) y no hace falta confirmar la fórmula para renderizar. Si lo que se despacha es oleoso, el rechazo en puerta por textura queda como arrastre no medido.
- **5 · Garantía — queda como está en la landing, y AHORA SE DICE** *(decisión de Pancho 03/09: la garantía entra en ronda 1)*. La landing la enuncia textual: «Tenés 90 días de garantía: si no te convence, nos avisás y listo.» y «¡Garantía de devolución de 90 días! … podés devolverla y recibir el reembolso total.» Cambia en el plan: **entra en el cierre de las 5 piezas y en todos los bodies salvo `copyC` y `copyD`** (los dos son copy medido de agosto y se dejan intactos; el de `copyD` además no es nuestro, vive en el post que reusa P0 — *(decisión de Pancho 04/09: se reusan los post IDs)*). Combinada con el COD es el cierre más fuerte que tenemos y el único que la categoría prepaga no puede igualar: no pagás antes, y si no te convence, avisás.
- **6 · cuotas_3 y la cuota «3 cuotas sin interés de $16.633,33» — quedan visibles** («Si preferís financiarlo, pedinos el link de Mercado Pago y lo pagás en 3 cuotas» + la opción `cuotas_3` del form). Consecuencia: **la fuga medida (18% eligió, 0% pagó, n=11) se queda como arrastre conocido entre pedido creado y entregado**. Cambia en el plan: nada en los gates — se leen en IC y $/IC, que están antes de la fuga; ningún creativo nombra cuotas.

**Verificaciones de lectura (7-8), sin tocar nada**

- [x] **7 · El form COD no pide dato de pago** — hecho el 03/09/2026 (paso 0.5): campos `fName fPhone fDni fEmail fStreet fNum fFloor fCity fCP fProv fNotes`, ningún campo de tarjeta/CVV. P0 y P2 lo afirman en audio. Se repite el día antes de prender. **Dueño**: agente 6.
- [ ] **8 · Qué ve un CP que rutea a Correo (prepago)** — si la landing dice "pagás al recibir" a un CP sin COD, P0/P2/E4 son un reclamo ahí; se registran las zonas como arrastre (paso 0.6). **Dueño**: `consultas-datos`. Antes de lanzar.

**Datos reales (9-16), en palabras, sin ejecutar nada acá:**

- [ ] **9 · Contador de la EMPRESA** — `consultas-datos` sobre el Supabase de `biolabs-finanzas`: contar las órdenes COD de **cualquier producto** cuyo envío esté **entregado y cobrado en mano**, agrupadas por cohorte de `shipments.dispatched_at`, histórico y últimos 60 días. "Entregado" = `status_canonical = 'entregado'`, que se calcula al leer desde el **último evento** de `shipment_events` (`occurred_at desc, id desc`, migración 072), **y por encima del evento manda la rendición**: toda guía de Urbano que figure en `urbano_rendiciones` cuenta como entregada y cobrada aunque el evento diga otra cosa (migración 085); Fixy con su historial completo. Excluir canceladas y pruebas (en Veltron `cliente_nombre != 'Test Test'`). El de ARRAIGO **no se usa** (3 entregados). **Va solo en la descripción del link, nunca dentro de la pieza ni en la landing** (no la toca: se mantiene), y solo si es ≥ 1.000; entra en ronda 2 (§4.3). Un número chico y real vende menos que ninguno, y no se inventa nunca.
- [ ] **10 · Mix x3 real de ARRAIGO** — **ya está: 9 de 11 (82%)**. Justifica el x3 preseleccionado y "tres frascos" en las piezas. **n = 11: no va como estadística en ningún creativo.**
- [ ] **11 · Motivo de rechazo en puerta** — Veltron `reporte_pedidos` + los 11 de 04b: 2 rebotados, 2 retornados, 2 cancelados antes del despacho, 2 fugados por cuotas_3. **A n = 11 no hay lectura de puerta**; es gate de escalado, no de lanzamiento. La fuga #1 medida es el formulario (#6), y queda.
- [x] **12 · Techo de ad sets — INFORMATIVO, ya no bloquea** *(decisión de Pancho 03/09: la tanda va en R2)*. Medido hoy en R2: 16 de los 23 ad sets ACTIVE son hijos de CBO (`daily_budget` $0), de los 22 con datos solo 8 llegan a 50 conversiones/semana y la mediana es 15 — la casa ya opera debajo del "techo" (§3.0). Se mide y se anota; no decide si entran P3 ni P4.
- [ ] **13 · IC por anuncio de agosto** — `meta-campanas`, Graph solo lectura: LPV→IC de `copyC` y `copyD` medido, no inferido.
- [x] **14 · Qué cobra cada courier en la puerta — RESPONDIDO por Pancho el 03/09/2026**: **QR de Mercado Pago en todo el país; en CABA y GBA además efectivo.** Consecuencia en los creativos: se dice **"sin tarjeta"** y **"pagás cuando te llega"**; **"sin cuenta de nada" sigue prohibido** (el QR pide una billetera) y el **efectivo solo se nombra si alguna vez hay un ad set de solo AMBA**.
- [ ] **15 · Dedup CAPI sobre `InitiateCheckout`** — caveat abierto; si el IC está inflado, todos los cortes bajan. No bloquea; **se anota en el Runbook del día 0**.
- [ ] **16 · Pedido #21200** (x2, Mendoza, `pendiente` desde el 24/08) y las guías fantasma de las pruebas (BLABS4111, 4118-4122, Fixy 1805691) — operativo, aparte.

---

## 8. Lo que NO se hace (una línea por ítem, con el motivo)

**Mensajes**
- M4 tal como estaba escrito (checkout y "$0" en el hook, 42 s sin categoría) — NO LANZABLE por el QA del 01/09; `copyD` ganó como texto sobre pelo, no autoriza un video sobre el pago.
- M4-B y M4-C — la versión concentrada del mismo defecto: 15 y 7 s sin una imagen ni una palabra de pelo.
- M4 Opción A (cepillo primero, ~32 s) — P2 hace lo mismo mejor y sin el flanco del checkout imitado.
- M1 "La raíz sin riego" como ad set — sin ancla propia; el eje más parecido (`copyB`, liderar con ingrediente) fue la peor celda de agosto (3,42% saliente, $324/LPV). Su hook y su apodo viven gratis dentro de P2; vuelve como VSL en escalón 2 si hay ganador.
- M2-B tal como estaba cortado — sacaba "no vas a ver nada", que es la hipótesis; recortado dentro de P1.
- M1-B tal como estaba cortado — "justo eso" queda sin referente; muere con M1.
- M3 v1 — 46 s sin categoría y primer cuadro sin síntoma; entra reparado como P4, escalón 2b.
- M3-C tal como estaba — contradecía su propio gate; redefinido en el corte C de P4.
- H3 "Mi mamá hervía romero" — exige una cara reaccionando; sin cara el hook cae a la ancla, sin ventaja.
- El contador de prueba social dentro de la pieza — ARRAIGO tiene 3 entregados: no es presentable; solo el de la empresa, en la descripción, con el número real.
- FOMO de precio en frío / cualquier precio en pantalla — Pancho lo mató el 04/08; el precio no está unificado; en COD el impulso se rechaza en la puerta.
- "Sin cuenta de nada" (E3) — trae al comprador de peor entrega (Jujuy 36,5%, Chubut 27,8%) y depende de #14; solo "sin tarjeta".
- B2B mayorista con CTA WhatsApp — otro objetivo (lead-gen), no CPA $6.000 COD.

**Formatos y piezas**
- VSL de mecanismo largo (clonar "el oro del desierto" o Excalvo) — hook bajo y $/LPV $250-420: no se lee a 72 h; remarketing profundo, no escalón 1.
- Animación 3D estilo Pixar — la IA visible en cosmética baja la intención; la señal más débil del top 5.
- Reacción a una persona identificable con su audio ("La Cobra") — derecho de imagen y honor; audio ajeno.
- Antes/después de cabeza (raya, entradas, timeline) — pagado en agosto: `ba-raya` $536/LPV y CPA $19.313, `ba-entradas` $687/LPV, 0 compras; B/A solo de objetos.
- E1 "$0 HOY" en frío — es M4 hecho imagen; solo retargeting (tramo D).
- E2 "La puerta" como estática — la cubren los 12 s finales de P2; la más cara del set con el CTR previsto más bajo.
- E5 "Hacé la cuenta" — sale de la tanda: su pieza es el precio, y el precio no se unifica porque la landing no se toca (decisión de Pancho 03/09: la landing se queda como está).
- E7 "Contá los pelos" en frío — tercera prueba indirecta tras P1 y E4, no agrega hipótesis; tramo D.
- E9 contador real — sin número presentable (umbral ≥ 1.000).
- E6-hombre en esta tanda — body distinto del `copyC` medido y 4º ad set fuera del tramo C; ronda 2 (decidido en 06).
- Recortar P0 en B/C — rompería la réplica, y además un creative por `object_story_id` entra con el post entero: no hay corte posible (decidido en 06; *(decisión de Pancho 04/09: se reusan los post IDs)*).
- Resubir el MP4 de `ugcB` a la biblioteca de R2 — no hace falta: la página `824765737394913` está en las dos cuentas y el post cruza por `object_story_id` (*(decisión de Pancho 04/09: se reusan los post IDs)*). Vuelve como plan B solo si el paso 0.3 encuentra que el link del post no es la landing actual.
- Escribirle a P0 body, título, descripción, link o `url_tags` — no se puede: viven en el post (§4.5). Lo único nuestro es el nombre del anuncio, el ad set y el `conversion_domain`.
- Reusar los otros 8 post IDs de agosto — solo P0 se replica; los demás quedan listados en §3.0 como referencia y ninguno entra a esta tanda.
- Extender el lanzador para `object_story_id` en esta tanda — es **un** anuncio y son dos POST: se crea a mano por Graph, como el tramo D. Qué habría que agregarle queda escrito en §3.5 por si vuelve a hacer falta.
- "Sin minoxidil" o "romero + cafeína" como titular — peor eje de agosto (`copyB`) y roza la comparación con fármaco; chico, en la franja.
- Cambiar el headline en el escalón 1 — el conflicto con "$0 HOY" desapareció con P2; el test es el body (Runbook §6 quater); el A/B de headline va en ronda 2 sobre el sobreviviente.
- Más de dos rondas de QA por pieza — a la segunda no lanzable se descarta; no se paga una tercera.

**Claims y compliance**
- La autoridad sanitaria ("Dra.", "dermatóloga", "tricólogo") — no hay profesional y no se fabrica: engaño, riesgo Meta y ANMAT; el sustituto es el oficio no sanitario (P3).
- "Aprobado por ANMAT" como eficacia — ANMAT registra, no aprueba resultados (Disp. 4059/2025); solo "registro ANMAT", solo en la landing.
- "Los pelitos cortos parados en la raya" — claim de crecimiento; reemplazo "la colita vuelve a dar dos vueltas".
- Afirmar textura ("no es grasoso", "secado rápido") — la FAQ dice acuoso, la base decidida es oleosa y la landing no se toca: no se afirma nada.
- Nombrar el efectivo en frío — solo vale en CABA y GBA; en todo el país el cobro es QR de Mercado Pago, así que el creativo dice "sin tarjeta" y nada más.
- Ad sets a $12.000/día — juntan ~14 conversiones/semana y no salen de aprendizaje; el piso de esta tanda es $25.000.
- Correr en R3 — paga 36,4% de impuesto no recuperable sobre el mismo plan; la tanda va en R2.
- El corte medio de 15-20 s como segundo anuncio — con masters de 32 s ya no aporta una duración distinta; el segundo anuncio es el bumper de 8-10 s.
- "Diez gotas" / "cuatro gotas" en guiones y bodies — una sola dosis: "una pipeta", la redacción que existe en la landing (que también dice "cuatro gotas" y queda así).
- cuotas_3 en los creativos — no se nombra nunca; en la landing queda visible (decisión de Pancho 03/09: la landing se queda como está), como arrastre conocido: 18% la eligió y 0% pagó.
- `copyC` (2ª persona + condición) sobre la cara de P3 — Atributos Personales con condición; el flanco por el que Hair Biolabs pagaría.
- Nombrar patología, DHT, hormonas, alopecia, menopausia; fotografiar cuero cabelludo con clareo; logos de courier o billetera generados por IA — grado 2 y §1 del Runbook.

**Herramientas y mecánica**
- Canva — 0 plantillas de marca y 4 falsos positivos; el camino de texto exacto es HTML + Chrome headless (decidido 24/07).
- Seedance 2.0 como motor principal de i2v — no expone precio; entra como una sonda de un clip en P2.
- `video_speak` de Freepik como motor principal del testimonial — no verificado en la casa; fallback de HeyGen.
- Pegar la etiqueta a mano en frasco-en-mano — prohibido; la genera el modelo con packshot de referencia.
- Texto de marca en el render IA — los renders escriben mal la etiqueta; todo texto por HTML/código.
- Apelar rechazos de Meta — protege el scoring; se lee `ad_review_feedback` y se corrige.
- Tocar el assert de body del lanzador — ya no hay nada que sortear: los 8 bodies de la tanda son distintos entre sí (*(decisión de Pancho 04/09: se reusan los post IDs)*, §3.5). El script no se toca por esto.
- Tocar la landing en cualquier escalón — decisión de Pancho 03/09; además, cambiarla a mitad contaminaría el test (§9).

---

## 9. Riesgos y límites de la lectura

- **n chico en todo lo que es plata.** 10 compras en agosto, 11 pedidos reales, 3 entregados: ningún CPA por anuncio es significativo y por eso todos los cortes van en IC y $/IC. A $12.000/día, 72 h dan ~8-16 IC por ad set: la diferencia entre "muere" y "pasa" son 8 IC. La lectura de mix x3 y de rechazo en puerta no existe a este n.
- **Un solo formato con ancla.** F1 (UGC con persona) es el único con curva medida (hook 33,9-40,2%, saliente 3,42-4,99%, $/LPV $149-324 sobre 10.104 plays). Todo lo que se predice para P1, P2 y P4 en hook y retención es inferido; por eso P0 no es un lujo. **Y desde el 04/09 P0 dejó de ser un control contra P2 y pasó a ser la réplica exacta del anuncio medido** *(decisión de Pancho 04/09: se reusan los post IDs)*: no se le pide ganar, se le pide *repetir* las tres anclas de agosto dentro de la banda de §4.5. Si no las repite, lo viejo es la vara y no la pieza, y §4.5 dice qué se hace.
- **Las anclas de agosto podían estar viejas y no había cómo saberlo.** Hasta el 04/09 el plan leía las 13 piezas nuevas contra una tabla de agosto que nadie iba a re-medir; ahora la réplica de P0 la mide en la misma semana, la misma cuenta y la misma subasta, por $0 extra. **El riesgo que queda es el opuesto**: si P0 sale fuera de banda, el plan pierde la vara en el peor momento —72 h, con el tramo C esperando su gate— y todo lo que sigue se lee contra P0 medido, con n de un solo ad set. Es peor que tener una vara buena, y mejor que tener una falsa sin enterarse.
- **P0 no lleva `utm_content`** *(decisión de Pancho 04/09: se reusan los post IDs)*: un creative por `object_story_id` no admite `url_tags` propios ni cambiar el link. Las métricas del gate salen de Graph y no se ven afectadas; lo que no existe para P0 es el join por UTM en `/anuncios`. La atribución cae en el beacon del formulario (84-90%) y en que P0 es el único anuncio de su ad set. **Si alguna vez hiciera falta UTM en P0, la única salida es volver a subir el MP4 y armar el creative con `object_story_spec`** — o sea, el plan viejo.
- **El link del post de agosto no se puede cambiar.** Si apunta a otra URL que la landing actual, P0 por post no sirve y no hay parche: se descarta y vuelve la migración del MP4. Por eso se verifica en el paso 0.3, antes de crear nada.
- **LPV→IC por mensaje no existe**: el 8,0% es de tanda entera (414 LPV → 33 IC, IC95% 5,4-10,6%). Que P1 pre-califique y suba la conversión del click es **la hipótesis**, no un dato. Y la palanca grande del CPA es la landing, no el creativo (medido: a igual $/LPV, llevar LPV→IC al nivel de Pureza da CPA ~$5.500).
- **HeyGen sin precio expuesto**: 1,4 créd/s medido el 31/07 y un error de ~38× el 29/08 (3 estimados → 113 reales). Ningún número de HeyGen en este plan vale hasta la sonda; el OK 3b se pide con el número medido.
- **Seedance sin sonda**: no expone precio; un solo clip en P2 lo convierte en un número fechado. Si el delta pasa ~300 créditos, no entra.
- **Los costos de fal.ai son tarifa de lista de jul/2026**, no facturas de esta tanda; reintentos estimados ×1,4-1,5.
- **La landing con reseñas inventadas y "+3.569", por decisión** (decisión de Pancho 03/09: la landing se queda como está). Antecedente: **2 ads de Pureza cayeron el 03/08 por "Prácticas empresariales inaceptables"** con ese mismo motivo, y Meta revisa hasta la landing: un rechazo por la landing puede pegarle a las 8 piezas a la vez sin que el defecto esté en la pieza. Se asume; no se apela; se registra el motivo y se lee como señal. En el mismo paquete: la landing dice «una pipeta (1 ml)» y también «Cuatro gotas, 60 segundos, una vez por día» — los anuncios dicen "una pipeta" y la inconsistencia queda asumida; y cuotas_3 sigue visible, así que la fuga (18% eligió, 0% pagó, n=11) queda como arrastre entre pedido creado y entregado, fuera de los gates de IC.
- **La landing es la constante del test.** Por eso las anclas de agosto (LPV→IC 8,0%, $/LPV $149-324, 2,54 IC por compra) valen tal cual **mientras P0 las reproduzca** (§4.5, *(decisión de Pancho 04/09: se reusan los post IDs)*) y cualquier diferencia de LPV→IC entre ad sets es del creativo. El costo: la palanca grande del CPA (la landing, medida: llevar LPV→IC al nivel de Pureza daría CPA ~$5.500) no se mueve en esta tanda. Si un rechazo de Meta obligara a tocarla igual, se anota la fecha y la lectura se parte en dos.
- **El techo de ad sets dejó de ser un bloqueo y pasó a ser una advertencia de señal**: a $25.000/día un ad set junta ~29 conversiones/semana, no 50. Ninguno de los conjuntos de esta tanda sale del todo de aprendizaje, igual que la mayoría de los que ya corren en R2 (mediana 15/semana). Es el techo de precisión de toda la lectura, no un impedimento para entrar.
- **En R2 nominal = real** *(decisión de Pancho 03/09)*: sin el 36,4% de R3, §4 se lee cruda de Ads Manager y el
  equilibrio de $2.360/IC es real. El factor × 1,364 vuelve a aplicar **solo si alguna vez se vuelve a R3**; ahí
  todos los cortes de §4 se dividen por 1,364 antes de decidir.
- **Cuenta nueva para este producto**: R2 nunca corrió ARRAIGO. El píxel es el mismo (`781630351556303`), así que la
  señal de conversión y el pool de retargeting no se pierden, pero el **historial de entrega de la cuenta con este
  creativo no existe**: el primer día de R2 puede tener CPM distinto del de agosto en R3 y eso no es un veredicto.
- **Masters cortos, decididos, no medidos** *(decisión de Pancho 03/09)*: recortar a 28-32 s está respaldado por el
  tiempo medio de reproducción de agosto (5-8 s) y el ThruPlay (18-29%), **pero ninguna curva de retención de un
  master de 32 s existe en la casa**. Si el bumper le gana al master en las dos celdas, la ronda 2 va a 8-10 s y no
  se vuelve a pagar un master largo.
- **La garantía se dice porque la landing la enuncia** *(decisión de Pancho 03/09)*: si alguna vez se cambia el texto
  de la landing, las 5 piezas quedan afirmando algo que la página ya no dice — y eso sí es "Prácticas empresariales".
- **Dedup CAPI pendiente sobre `InitiateCheckout`**: si el IC está inflado, todos los cortes bajan y el equilibrio de $2.360 es optimista.
- **El clasificador de la sesión puede bloquear el POST de creación** ("Blocked by classifier"): es el harness, no Meta; la salida es sesión nueva o Pancho prendiendo a mano con verificación por Graph. No se buscan rodeos.
- **Nada de esto se genera, gasta ni lanza sin el OK literal de §6 copiado en el prompt de la corrida.**
