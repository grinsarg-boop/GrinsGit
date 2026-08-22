# Reporte semanal de ventas — sábado 15 al viernes 21 de agosto de 2026

**Generado:** viernes 21/08/2026
**Fuente:** base biolabs-finanzas en vivo (RPCs `sales_days`, `sales_rows`, `analisis_maduracion`, `fixy_cobranza`, `ml_a_liquidar` + tabla `shipments`).
**Comparación:** semana previa 08–14/08/2026.

> ### ⚠️ Corregido el 21/08/2026, después de publicar
>
> **La conclusión original era falsa por un sesgo de método.** Este reporte decía que el profit cayó
> **13,5%**. Recalculando las dos semanas con la misma metodología, cayó **2,0%** y el margen quedó
> plano. El −13,5% salía de comparar una semana madura contra una fresca a la que le faltaban dos
> días **sin despachar**: el P&L cohortiza por fecha de despacho, así que esos pedidos no aportaban
> revenue mientras su pauta sí se cobraba.
>
> **No es un error de este reporte: es un sesgo de todos.** La semana en curso siempre va a parecer
> peor que la anterior. Arreglado en la **migración 080**, que valúa los pedidos generados sin guía
> a δ(edad) × prior — con δ medido en ventana reciente (98,8% Urbano, 99,2% Fixy).
>
> Las otras cuatro correcciones:
>
> 1. **El profit estimado de Urbano** se movió dos veces: la **migración 079** lo bajó (el estimado
>    ahora lee la maduración de la propia cohorte desde el día 7, en vez de un prior que atrasa 3
>    semanas) y la 080 lo subió más. Neto $4,98 M → **$5,71 M**.
> 2. **Los $6,62 M "trabados" en Urbano no existían.** De las 180 guías, **116 nunca entraron** y 114
>    de ellas son pedidos que cancelamos nosotros. Plata real en riesgo $2,86 M, de la cual
>    **$1,30 M es reclamo** (26 guías).
> 3. **La caída de ML tiene causa identificada**: un bloqueo de moderación (MLA3356284130,
>    `under_review`/`forbidden` desde el 19/08 02:26 UTC) y un escalón de pauta que se rompió el
>    14/08. **No perdimos ninguna caja de compra.**
> 4. **El "−36% de ads" de BeeVenom era 2/3 contable** — el gasto nominal bajó 15,4%; el resto es el
>    impuesto de R3 que dejó de aplicar al mudarse de cuenta.
>
> Detalle en `docs/backtest-maduracion-2026-08-21.md`, `docs/diagnostico-ml-caida-2026-08-21.md`,
> `docs/urbano-interior-y-trabados-2026-08-21.md` y `docs/beevenom-salto-margen-2026-08-21.md`.

---

## 1. Resumen de la semana

| Métrica | 15–21/08 | 08–14/08 | Δ |
|---|---|---|---|
| Pedidos generados | 1.641 | 1.539 | **+6,6%** |
| Revenue estimado | $56,45 M | $57,43 M | −1,7% |
| **Profit estimado** | **$20,19 M** | **$20,60 M** | **−2,0%** |
| Margen | 35,8% | 35,9% | −0,1 pp |
| Ads Meta | $3,40 M | $2,97 M | +14,5% |
| Ads ML | $2,86 M | $2,78 M | +2,7% |

*Las dos semanas recalculadas el 21/08 con las migraciones 079 y 080. Las cifras publicadas
originalmente ($18,68 M y −13,5%) no son comparables con estas.*

**Más pedidos, misma plata.** El volumen subió 6,6% y el profit quedó prácticamente igual. No es una
semana mala: es una semana en la que **ML se derrumbó y el COD lo tapó casi entero**.

> **Nota metodológica:** esta versión ya no subestima el día en curso. Antes de la migración 080 el
> 21/08 valía $1,69 M porque sus pedidos sin despachar no se contaban; ahora vale **$3,24 M**. Lo que
> queda de incertidumbre es lo normal de una cohorte joven: el COD de los últimos días es proyección,
> no cobranza, y su banda se cierra recién a los ~21 días de despacho.

---

## 2. Profit diario estimado

| Día | Gen | Entr | Rev est | **Profit est** | Margen |
|---|---|---|---|---|---|
| Sáb 15/08 | 194 | 108 | $6,60 M | **$2,26 M** | 34,2% |
| Dom 16/08 | 214 | 109 | $7,34 M | **$2,59 M** | 35,2% |
| Lun 17/08 | 283 | 142 | $9,16 M | **$3,16 M** | 34,5% |
| Mar 18/08 | 289 | 155 | $10,23 M | **$3,78 M** | 37,0% |
| Mié 19/08 | 173 | 84 | $5,95 M | **$2,08 M** | 35,0% |
| Jue 20/08 | 241 | 114 | $8,44 M | **$3,07 M** | 36,4% |
| Vie 21/08 | 247 | 129 | $8,73 M | **$3,24 M** | 37,2% |
| **Total** | **1.641** | **841** | **$56,45 M** | **$20,19 M** | **35,8%** |

El 18/08 fue el mejor día ($3,78 M) y el 19 el pozo ($2,08 M). El 20 y el 21 ya **no** aparecen
hundidos: antes de la 080 figuraban en $2,41 M y $1,69 M porque sus pedidos sin despachar no se
contaban. Ese hueco valía **+$667 k y +$1,55 M** respectivamente.

### Contexto: últimas 6 semanas calendario

| Semana (lun) | Días | Generadas | Rev est | Profit est | Margen |
|---|---|---|---|---|---|
| 20/07 | 7 | 1.196 | $47,66 M | $18,49 M | 38,8% |
| 27/07 | 7 | 1.281 | $51,10 M | $19,04 M | 37,3% |
| 03/08 | 7 | 1.440 | $54,78 M | $21,27 M | 38,8% |
| 10/08 | 7 | 1.524 | $55,75 M | $20,58 M | 36,9% |
| 17/08 | 5 (parcial) | 1.213 | $38,29 M | $13,44 M | 35,1% |

El margen viene bajando cuatro semanas seguidas: 38,8% → 37,3% → 38,8% → 36,9% → 35,1%.

---

## 3. Por canal / courier (fecha de venta)

| Courier | Gen | Rev est | **Profit est** | Margen |
|---|---|---|---|---|
| **ML** | 709 | $32,45 M | **$10,69 M** | 33,0% |
| **Urbano** | 572 | $15,77 M | **$5,71 M** | 36,2% |
| **Fixy** | 122 | $4,95 M | **$2,74 M** | **55,2%** |
| **Correo** | 238 | $3,27 M | **$1,05 M** | 32,3% |

### Contra la semana previa (misma metodología en las dos)

| Courier | Gen 08–14 → 15–21 | Profit est 08–14 → 15–21 |
|---|---|---|
| **ML** | 959 → 709 (**−26%**) | $15,86 M → $10,69 M (**−$5,17 M, −33%**) |
| Urbano | 364 → 572 (+57%) | $2,43 M → $5,71 M (+$3,28 M) |
| Fixy | 86 → 122 (+42%) | $1,38 M → $2,74 M (+$1,36 M) |
| Correo | 130 → 238 (+83%) | $0,93 M → $1,05 M (+$0,12 M) |

**ML perdió $5,17 M y el COD recuperó $4,76 M.** Esa es toda la semana en una línea. El negocio COD
creció fuerte; el agujero es enteramente ML, y tiene causa conocida.

Fixy sigue siendo el de mejor margen por lejos (52%) con solo 121 pedidos. Es la palanca
más obvia de la semana.

---

## 4. Brutas de couriers (COD, por fecha de despacho)

| Courier | Guías | **COD bruto despachado** | Entregadas | COD bruto cobrado | Ticket prom |
|---|---|---|---|---|---|
| Urbano 15–21 | 563 | **$27,69 M** | 27 | $1,44 M | $49.184 |
| Fixy 15–21 | 121 | **$5,90 M** | 72 | $3,73 M | $48.746 |
| **Total 15–21** | **684** | **$33,59 M** | 99 | $5,17 M | — |
| Urbano 08–14 | 424 | $21,68 M | 179 | $9,23 M | $51.142 |
| Fixy 08–14 | 76 | $4,00 M | 52 | $2,74 M | $52.569 |
| **Total 08–14** | **500** | **$25,68 M** | 231 | $11,97 M | — |

$33,6 M de COD bruto salió a la calle esta semana, **+30%** contra la previa. Lo cobrado
todavía es bajo porque la cohorte tiene 0–6 días de vida — no es señal de nada.

**El ticket promedio cae en los dos couriers** (Urbano −3,8%, Fixy −7,3%). Vale mirarlo:
menos plata por bulto con el mismo flete es margen que se va.

### Cobranza efectiva

**Fixy** (rendición leída por API):

| Día | Guías | Bruto | Neto | Retención |
|---|---|---|---|---|
| 18/08 | 16 | $797.808 | $789.830 | 1,0% |
| 19/08 | 9 | $486.917 | $482.048 | 1,0% |
| 20/08 | 40 | $2.094.465 | $2.073.520 | 1,0% |
| 21/08 | 18 | $943.326 | $933.893 | 1,0% |
| **Semana** | **83** | **$4,32 M** | **$4,28 M** | **1,0%** |

Semana previa (10–14/08): $2,86 M brutos.

**ML a liquidar:**

| Fecha de liberación | Pagos | Neto |
|---|---|---|
| 17/08 | 432 | $12,09 M |
| 24/08 | 165 | $4,66 M |
| 31/08 | 8 | $228 k |
| 07/09 | 286 | $8,60 M |
| 14/09 | 547 | $16,77 M |

---

## 5. Maduración COD +21 días — tendencia de entrega

Corte por cohortes de despacho, cada una medida al cumplir 21 días. Excluye las "nunca entró"
(PI de Urbano / código 41 de Fixy con más de 7 días sin admisión).

| Cohorte (despacho) | Cumplió 21d | Guías | **Entrega total** | Urbano | Fixy |
|---|---|---|---|---|---|
| 27/06–03/07 | sem −4 | 749 | 52,5% | 50,2% | 63,7% |
| 04–10/07 | sem −3 | 520 | 50,2% | 49,0% | 56,0% |
| 11–17/07 | sem −2 | 597 | 60,0% | 58,6% | 66,1% |
| 18–24/07 | sem −1 | 598 | **63,7%** | 62,1% | 71,6% |
| **25–31/07** | **esta semana** | **376** | **56,1% ↓** | **51,2% ↓** | **76,7% ↑** |

**La cohorte que maduró esta semana rompió la racha de mejora: 63,7% → 56,1%, −7,6 pp.**

No es falta de maduración. De las 376 guías quedan **solo 11 abiertas**:

| Estado | Guías |
|---|---|
| Entregado | 211 |
| Devuelto | 139 |
| En devolución | 15 |
| Incidencia | 5 |
| En sucursal | 3 |
| En tránsito / reparto | 2 |
| Despachado | 1 |

Techo si entregaran todas las abiertas: **59%**. El número final va a quedar ahí.

### Toda la caída es de Urbano, y es de Interior

| Urbano | 18–24/07 | 25–31/07 | Δ |
|---|---|---|---|
| AMBA / Buenos Aires | 57,9% (121 g) | 52,6% (38 g) | −5,3 pp |
| **Interior** | **63,3%** (376 g) | **50,8%** (266 g) | **−12,5 pp** |

Interior perdió 12,5 pp en una semana sobre 266 guías de muestra. Eso no es ruido.

**Corregido: no fue un pozo puntual, es un deterioro sostenido.** Medido a igual madurez (7 días de
despacho), Urbano Interior viene 48,8% → 38,3% → 36,8% → **31,9%** en las cohortes 18–24/07,
25–31/07, 01–07/08 y 08–14/08; la última (363 guías) proyecta **~42% final**. La caída es
generalizada, no de una zona: las 5 regiones bajan (Patagonia 51,7% → 18,4%) y aplicando las tasas
viejas al mix nuevo el mix explica ~0. **No es demora del courier**: el % resuelto al día 7 no bajó
(40,5% en la cohorte del 10/08, de los más altos). Lo que se rompió es la mezcla — de lo que resuelve
en los primeros 7 días, históricamente 96–99% es una entrega y en esa cohorte es **86,0%**:
aparecieron devoluciones tempranas, o sea rechazo en la puerta. AMBA, en cambio, se recuperó (62,1%).

### Fixy va en la dirección opuesta

56,0% → 66,1% → 71,6% → **76,7%**: cuatro semanas seguidas de mejora.
Ya entrega **25 pp por encima de Urbano**.

### Curva de maduración global (despachos desde 01/06)

| Días desde despacho | Guías | % resuelto | % entregado |
|---|---|---|---|
| 7 | 136 | 50,0% | 39,0% |
| 9 | 145 | 64,8% | 54,5% |
| 15 | 47 | 85,1% | 61,7% |
| 17 | 70 | 94,3% | 64,3% |
| 19 | 27 | 96,3% | 66,7% |
| **21+** | **5.628** | **99,6%** | **51,8%** |

A los 21 días el 99,6% de las guías ya tiene desenlace: el corte de +21d es el punto correcto
para leer tasa final.

### Trabadas de arrastre (+21 días sin resolver)

| Courier | Guías | COD en riesgo | Reclamo real | Guía más vieja |
|---|---|---|---|---|
| **Urbano** | **64** | **$2,86 M** | **$1,30 M (26 guías)** | 02/05/2026 |
| Fixy | 2 | $99 k | — | 02/07/2026 |

**Corregido.** El universo original de 180 guías estaba inflado: **116 nunca entraron**, y 114 de
ellas son pedidos que cancelamos nosotros. Contrastadas en vivo contra la API, quedan 26 para
reclamar ($1.299.590), 31 para redespachar y el resto se sale del universo. CSVs en
`docs/urbano-2026-08-21-*.csv`; 4 guías van escaladas por estar idénticas al snapshot del 27/07.

---

## 6. Por producto

| Producto | Gen 15–21 | Rev est | Profit est | Margen | Margen 08–14 |
|---|---|---|---|---|---|
| Pureza | 1.469 | $47,69 M | $16,88 M | 35,4% | 38,2% |
| BeeVenom | 118 | $2,98 M | $1,07 M | **35,9%** | **5,7%** |
| Natures | 21 | $1,13 M | $423 k | 37,5% | 40,9% |
| RevivalOil | 10 | $720 k | $235 k | 32,6% | 24,7% |
| Veinguard | 1 | $65 k | $18 k | 27,2% | 46,7% |

Pureza es el 90% del negocio y su margen cedió 2,8 pp.

**BeeVenom: el cambio está identificado, y no es repetible a voluntad.** El salto de margen es
**íntegramente CPA** — la unit economics no se movió (margen de contribución antes de ads 53,7% →
53,5%). El 16/08 se apagó un creativo fatigado (CPA $11–12k) y arrancó una campaña nueva donde un
solo video, `santi6`, se lleva el 76% del gasto y el 86% de las compras a **CPA $3.260**. Es un
reset de fatiga de creativo, y la historia mide que dura **2–3 semanas**: hay que tener piezas
nuevas listas para el **26–28/08**.

Dos correcciones: el "−36% de ads" es 2/3 contable (el gasto nominal bajó 15,4%; $201 k es el
impuesto de R3 que dejó de aplicar al mudarse de cuenta), y el $1,07 M es **97% proyección** con la
cohorte al 28,6% de resueltas — rango honesto **$0,82 M–$1,14 M**, madura ~08/09.

Lo accionable sí medido: contribución por pedido $14.094 contra CPA real $4.393 → **3,2× de headroom
para escalar gasto**. La semana 08–14 corría *arriba* del breakeven.

---

## 7. Lectura y acciones

1. **Todo el agujero es ML: −$5,17 M en una semana**, contra +$4,76 M que sumó el COD.
   **Decidido el 21/08 (Pancho):** el bloqueo de MLA3356284130 **no se puede destrabar ni pedir
   revisión** — los ~$390 k/día son costo a absorber, no tarea. Y la campaña `goteros` **no se
   frena**: el canal facturó 6 M brutos ese día y se considera rentable. La medición del escalón
   marginal (+$243.094 → −265 unidades) queda registrada en
   `docs/diagnostico-ml-caida-2026-08-21.md`, sin acción asociada.
2. **Urbano Interior no se rompió una semana: viene cayendo cuatro cohortes seguidas**, hasta
   ~42% proyectado. El `profit_est` inflado ya está corregido ($4,13 M) y la migración 079 hace
   que el estimado lea la cohorte en curso en vez de esperar 3 semanas al prior.
3. **Fixy justifica más ruteo**: 76,7% de entrega, 52% de margen, 1% de retención, cero
   arrastre — y solo 121 pedidos en la semana.
4. **$1,30 M reclamables en Urbano** (26 guías, CSV y texto listos). Los $6,6 M originales eran
   116 guías que nunca entraron, 114 de ellas canceladas por nosotros.
5. **BeeVenom: preparar piezas nuevas para el 26–28/08.** El margen no vino de la economía sino de
   un creativo nuevo (`santi6`, CPA $3.260) que va a fatigarse en 2–3 semanas. Hay 3,2× de headroom
   para escalar gasto mientras dure.

### Caveats

- **El flete estimado de Urbano vence el 30/08.** Se apoya en la última tarifa real del 30/06;
  al salir de la ventana de 60 días todo cae al fallback plano y los `profit_est` de Urbano
  pierden precisión. Conviene cargar tarifa fresca antes de fin de mes.
- **Salud del sistema:** un solo amarillo — 72 anuncios en DISAPPROVED/WITH_ISSUES sin resolver.
- **Las migraciones 079 y 080 son nuevas** (21/08). La 079 está validada out-of-sample contra 8-10
  cohortes cerradas, incluida una en régimen a la baja (27/07, error +0,2 pp a 14 días); la 080 se
  apoya en una curva de despacho medida pero **sin backtest propio**. La primera revalidación real
  es la cohorte del 10/08 cuando cierre, ~31/08.
- El 21/08 es un día en curso; sus cifras de COD van a subir cuando despache y madure. **Medido:**
  ~$6,8 M de revenue bruto generado en los últimos 3 días todavía no tiene guía, y el P&L cohortiza
  por fecha de despacho — así que esos pedidos no están *mal estimados*, directamente no figuran.
  El problema se cierra solo al día 4. Modelarlo es la etapa que sigue.
