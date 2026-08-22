# BeeVenom: de qué está hecho el salto de margen 5,7% → 35,9% (15–21/08/2026)

**Medido:** 21–22/08/2026 · **Fuente:** `sales_rows` / `orders` / `shipments` / `daily_pnl` / `ad_spend` en vivo
(Supabase Finanzas), no del panel. BeeVenom no tiene canal ML: es 100% COD (Urbano + Fixy + Correo).

---

## Veredicto en una línea

**No cambió nada de la unit economics. Cambió el CPA, y el CPA cambió porque el 15/08 se
relanzó BeeVenom con creativos nuevos en otra cuenta de Meta.** El 84% del salto es eficiencia
de medios (un creativo nuevo) y el 13% es contable (la cuenta nueva no paga el 36,4% de impuesto
de tarjeta). El margen del canal antes de ads es **idéntico** las dos semanas: 53,7% vs 53,5%.

**Repetible a voluntad: no.** Es un reset de fatiga de creativos, y la serie histórica muestra
que ese reset se degrada 3x en 2–3 semanas. Lo que sí es accionable hoy es que hay **3,2x de
espacio para escalar gasto** antes de tocar el breakeven.

---

## 1. Lo primero: las dos cifras no son comparables

| | 08–14/08 | 15–21/08 |
|---|---|---|
| Despachadas | 44 | 105 |
| **Resueltas** | 29 (**65,9%**) | 30 (**28,6%**) |
| Revenue **confirmado** | $1,40 M | $1,48 M |
| Revenue estimado | $1,60 M | $2,98 M |
| Profit **confirmado** | **−$76.488** | **−$170.351** |
| Profit estimado | $91.981 | $1.069.451 |
| Margen del panel | 5,7% | 35,9% |

El $1,07 M de la semana 15–21 es **97% proyección**: solo 30 de 105 guías tienen desenlace.
La cohorte está a **28,6% de resueltas**, muy por debajo del umbral de madurez de **≥90%**
(canon Pancho 13/08/2026). Leída así, la tasa miente para arriba.

Por eso todo lo que sigue está **normalizado**: se le aplica a las dos semanas la MISMA tasa
de entrega madura medida de BeeVenom (Urbano 57,6% jul · Fixy 70,2% jul · Correo 49,4% de
confirmación), en vez de dejar que cada semana use su propio grado de madurez.

---

## 2. El P&L normalizado, semana a semana (7 semanas)

Mismas tasas para todas. Ads a costo real (nominal × 1,364 solo donde corresponde por cuenta).

| Semana (sáb) | Pedidos | Rev norm | Contrib. **antes de ads** | Mgn pre-ads | Ads real | **Ads / rev** | Profit norm | **Margen norm** |
|---|---|---|---|---|---|---|---|---|
| 04/07 | 104 | $2,73 M | $1,51 M | **55,3%** | $699 k | 25,6% | $811 k | 29,7% |
| 11/07 | 133 | $3,72 M | $1,96 M | **52,8%** | $1.046 k | 28,1% | $918 k | 24,7% |
| 18/07 | 99 | $2,90 M | $1,57 M | **54,3%** | $747 k | 25,8% | $826 k | 28,5% |
| 25/07 | 126 | $3,35 M | $1,76 M | **52,4%** | $567 k | 16,9% | $1.188 k | **35,5%** |
| 01/08 | 72 | $2,07 M | $1,14 M | **55,2%** | $687 k | 33,2% | $454 k | 22,0% |
| **08/08** | **44** | **$1,40 M** | **$754 k** | **53,7%** | **$811 k** | **57,8%** | **−$57 k** | **−4,1%** |
| **15/08** | **118** | **$3,11 M** | **$1,66 M** | **53,5%** | **$518 k** | **16,7%** | **$1.145 k** | **36,8%** |

**La columna que no se mueve es la del medio.** El margen de contribución antes de ads vivió
entre 52,4% y 55,3% las siete semanas. La semana "mala" tuvo 53,7% y la semana "buena" 53,5% —
la buena es marginalmente PEOR.

**La columna que explica todo es "Ads / rev": 57,8% → 16,7%.**

Y el 36,8% de la semana 15–21 **no es un récord**: el 25/07 hizo 35,5% con el mismo modelo.
El outlier es el −4,1% del 08–14, no el 36,8%.

---

## 3. Hipótesis descartadas (medidas, no supuestas)

### 3.1 ¿Mix de packs / ticket? **NO.**

Ticket y pack de los pedidos COD (Urbano+Fixy), por semana:

| Semana | n | Ticket prom | Pack prom | pack 1 / 2 / 3 | Costo mercadería prom |
|---|---|---|---|---|---|
| 25/07 | 103 | $50.747 | 2,17 | 0 / 85 / 18 | $6.437 |
| 01/08 | 58 | $50.896 | 2,19 | 0 / 47 / 11 | $6.474 |
| **08/08** | 40 | **$51.499** | **2,23** | 1 / 29 / 10 | $6.625 |
| **15/08** | 85 | **$50.528** | **2,14** | 1 / 71 / 13 | $6.382 |

Ticket −1,9%, pack promedio −4,0%. Si algo, el mix de la semana buena es **levemente peor**.
Ni precio nuevo, ni pack nuevo, ni oferta nueva.

### 3.2 ¿Corrimiento de canal/courier? **NO, y va en contra.**

| Courier | Pedidos 08–14 | Pedidos 15–21 |
|---|---|---|
| Urbano | 25 (57%) | 50 (42%) |
| **Fixy** | 15 (**34%**) | 22 (**19%**) |
| Correo | 4 (9%) | 33 (28%) |

Fixy — el courier de mejor margen — **bajó** su participación 15 pp. El que creció es Correo,
que aporta $15.355 de contribución por pedido contra $21.574 de Fixy. El mix de couriers
**resta**, no suma.

Tampoco hubo corrimiento geográfico relevante. Tasa madura de BeeVenom en Urbano (jun–jul,
cohortes 100% resueltas): **AMBA/BA 63,1% · Interior 51,1%**. La mezcla pasó de 25/75 a 17/83
→ tasa ponderada esperada 54,1% → **53,2%**, es decir −0,9 pp. Es ruido.

### 3.3 ¿Cambió la tasa de entrega aplicada, o algún parámetro? **NO.**

- `delivery_priors` se recomputa todos los días; los valores de BeeVenom no dieron un salto —
  y de hecho para la mayoría de las provincias BeeVenom **cae al prior global de Urbano
  (57,3%, n=1.248, nivel 3)**, que está dominado por Pureza. Ver §6, es un riesgo abierto.
- `settings`: `commission_pct` (urbano 5,547% / fixy 1%), `mp_fee_pct` 0, `fixy_cpa_multiplier`
  1,6 — sin cambios entre las dos semanas.
- `meta_ads_impuestos`: 36,4% sobre `act_1569698667101520`, vigente **desde el 07/08**. Las dos
  semanas caen después de esa fecha, así que la regla no cambió entre semanas — lo que cambió
  es **a qué cuenta se le carga** (§4.2).
- `product_costs`: costo unitario $6.625 → $6.382. Sin cambios de fondo.

### 3.4 ¿Faltan pedidos en la semana mala (n8n cortado, sync)? **NO.**

Ratio pedidos generados / purchases reportadas por Meta:
08–14 = 44/52 = **0,85** · 15–21 = 118/138 = **0,86**. Idéntico. La caída de volumen del 08–14
es real (menos compras), no un agujero de datos.

---

## 4. Lo que SÍ cambió

### 4.1 El 15/08 se relanzó la pauta con creativos nuevos en otra cuenta

Corte exacto: **16/08**. La campaña vieja se apagó y arrancó una nueva.

**Semana 08–14 — campaña `abo-keepalive-beevenom-03-50k`, cuenta act_1569698667101520 (R3):**

| Anuncio | Gasto nominal | Compras | CPA |
|---|---|---|---|
| `beevenom-03-beeE1 (reuse)` | $257.727 | 21 | $12.273 |
| `beevenom-0608A-E4-ingrediente` | $178.693 | 15 | $11.913 |
| `beevenom-montaje-V13-lata-en-mano` | $177.678 | 17 | $10.452 |
| resto (6 anuncios) | $20.536 | 0 | — |

El nombre lo dice: **keepalive**. BeeVenom estaba en mantenimiento con un creativo marcado
`(reuse)`, quemando ~$85 k/día a CPA $11–12 k.

**Semana 15–21 — campaña `BeeVenom · ABO Fixy vs Open · 15-08`, cuenta act_880189106877616 (R2):**

| Anuncio | Adset | Gasto nominal | Compras | CPA |
|---|---|---|---|---|
| **`beevenom-video-AM-santi6-open`** | OPEN-AR-sinFixy | **$214.433** | **90** | **$2.383** |
| **`beevenom-video-AM-santi6-fixy`** | FIXY-GBA+CABA | **$170.245** | **28** | **$6.080** |
| `beevenom-video-AM-malena2-fixy` | FIXY-GBA+CABA | $53.180 | 7 | $7.597 |
| `beevenom-video-AM-malena2-open` | OPEN-AR-sinFixy | $19.817 | 10 | $1.982 |
| santi1 / santi5 (4 anuncios) | ambos | $4.309 | 1 | — |

**Un solo creativo (`santi6`, en sus dos variantes) se lleva $384.678 de $503.320 (76% del gasto)
y 118 de 138 compras (86%).** CPA $3.260. Los 8 anuncios son nuevos: primera aparición
16/08/2026, ninguno tiene historia previa en `ad_spend`.

### 4.2 Y el gasto se mudó a una cuenta sin el impuesto del 36,4%

| | 08–14 | 15–21 | Δ |
|---|---|---|---|
| Gasto **nominal** | $594.634 | $503.320 | **−15,4%** |
| Impuesto tarjeta (36,4%) | $216.447 | $15.047 | −$201.400 |
| **Gasto real (P&L)** | **$811.081** | **$518.367** | **−36,1%** |

**El "−36% de ads" del reporte semanal es 2/3 contable.** El gasto nominal bajó apenas 15,4%.
$201 k de los $293 k de "ahorro" son el impuesto de R3 que dejó de aplicar porque la campaña
se mudó a R2 (`act_880189106877616`, sin impuesto según `settings.meta_ads_impuestos`).

R2 no estaba apagada la semana anterior (gastó $671 k en otros productos entre el 08 y el 14),
así que no es un artefacto de sync: es una decisión de ruteo de cuenta.

### 4.3 La curva de fatiga y su reset

Gasto **nominal** por pedido generado:

| 25/07 | 01/08 | 08/08 | → relanzamiento → | 15/08 |
|---|---|---|---|---|
| $4.502 | $9.109 | **$13.514** | | **$4.265** |

Se triplicó en dos semanas y volvió al piso con el relanzamiento. **Es una curva de fatiga de
creativo, y $4.265 no es un récord: el 25/07 fue $4.502 con la generación anterior de piezas.**

---

## 5. Descomposición del salto (normalizado: −4,1% → +36,8% = **+40,9 pp**)

| Contrafactual (sobre la semana 15–21) | Profit norm | Margen norm |
|---|---|---|
| **Real** | $1.144.766 | **36,8%** |
| Si hubiera corrido en R3, con impuesto ×1,364 | $976.605 | 31,4% |
| Si hubiera tenido el CPA nominal del 08–14 ($13.514/pedido) | $68.433 | **2,2%** |

| Contrafactual (sobre la semana 08–14) | Profit norm | Margen norm |
|---|---|---|
| **Real** | −$56.968 | **−4,1%** |
| Si hubiera tenido el CPA nominal del 15–21 ($4.265/pedido) | $566.435 | **40,4%** |

**Reparto del +40,9 pp:**

| Causa | Aporte | Peso |
|---|---|---|
| Eficiencia de medios (CPA nominal, = creativo nuevo) | **+34,6 pp** | **85%** |
| Cambio de cuenta Meta (se dejó de pagar el 36,4%) | **+5,4 pp** | 13% |
| Mix (packs, courier, geo, costos) | ~+0,9 pp | 2% |

---

## 6. Riesgos vivos sobre el $1,07 M

1. **La cohorte está al 28,6% de resueltas** — muy por debajo del ≥90%. El número puede moverse
   varios puntos todavía. Sensibilidad a la tasa de Urbano de esta cohorte:

   | Tasa Urbano supuesta | Profit norm | Margen norm |
   |---|---|---|
   | 57,6% (jul madura, la que usé) | $1.144.766 | 36,8% |
   | **53,2% (jun–jul, ponderada por la geo REAL de esta cohorte)** | ~$1.05 M | **~34,9%** |
   | 45,3% (la cohorte rota del 25–31/07) | $888.495 | 31,8% |
   | 42,0% (piso pesimista) | $819.740 | 30,3% |

   Incluso en el piso el margen queda >30%. **El salto sobrevive a la inmadurez.** Lo que no
   sobrevive es la precisión del $1,07 M: el rango honesto es **$0,82 M – $1,14 M**.

2. **El prior que usa el P&L para BeeVenom en la mayoría de las provincias es el global de
   Urbano (57,3%, nivel 3), dominado por Pureza.** BeeVenom solo tiene prior propio en Buenos
   Aires (66,3%), Córdoba, Entre Ríos y unas pocas más. Como esta cohorte es 83% interior y el
   interior de BeeVenom mide **51,1%** maduro, el `profit_est` del panel está usando una tasa
   ~6 pp optimista. Es exactamente el candado de "tasa por producto, nunca global".

3. **El 21/08 está en curso**: 11 pedidos generados y solo 2 despachados. Subestimado.

4. **El flete estimado de Urbano vence el 30/08** (última tarifa real 30/06). Después de esa
   fecha cae al fallback plano de $10.200 y estos números pierden precisión.

---

## 7. ¿Es repetible a voluntad?

**No como "mejora estructural". Sí como "hay un ganador nuevo, exprimirlo".**

- **En contra de la repetibilidad:** no hubo cambio de producto, precio, pack, courier, ruteo ni
  operación. Todo el salto es un creativo. La serie muestra que un creativo ganador de BeeVenom
  dura ~2–3 semanas antes de que el CPA se triplique ($4.502 → $13.514 entre el 25/07 y el
  08/08). No hay razón medida para esperar que `santi6` se comporte distinto. **El escenario
  base para la semana 22–28/08 es CPA en deterioro, no CPA estable.**
- **La parte del impuesto (5,4 pp) sí es permanente** mientras BeeVenom siga en R2 — pero es
  una silla musical: R2 ya gastó $2,08 M esa semana, tiene techo, y mover otro producto adentro
  desplaza a BeeVenom.
- **Lo único genuinamente accionable hoy:** contribución por pedido antes de ads = $14.094.
  **El CPA real está en $4.393. Hay 3,2x de headroom de gasto antes del breakeven.** La semana
  08–14 corrió a $18.434 contra un breakeven de $17.139 — o sea, estaba **arriba** del breakeven,
  regalando plata.

### Headroom por adset (contribución/pedido vs CPA)

| Adset | Contrib./pedido | CPA real | Headroom |
|---|---|---|---|
| `beevenom-OPEN-AR-sinFixy-40k` (Urbano + Correo) | ~$13.216 | $2.335 | **5,7x** |
| `beevenom-FIXY-GBA+CABA-40k` (Fixy) | $21.574 | $6.461 | **3,3x** |

Los dos son rentables. El Open tiene el CPA 2,8x más barato pero Fixy entrega mejor (70,2% vs
53,2%) con comisión 1% vs 5,547% — el gap de headroom real es 1,7x, no 2,8x. *(Atribución por
adset de Meta cruzada contra couriers reales: aproximada.)*

### Recomendación conservadora

1. **Subir presupuesto de `santi6-open` mientras el CPA se mantenga bajo $8.000** (todavía 1,7x
   de margen sobre breakeven). Los adsets están en $40 k/día: hay lugar.
2. **Tener 2–3 piezas nuevas del mismo mensaje listas para el 26–28/08.** El reset dura poco.
3. **No cargar el 35,9% al P&L como logro consolidado hasta que la cohorte pase el 90% de
   resueltas** (~21 días desde el despacho → alrededor del **08/09/2026**).
4. **Cargar priors de entrega propios de BeeVenom por provincia** para el interior, o el
   `profit_est` de este producto va a seguir leyendo ~6 pp de más.
5. **No leer el "−36% de ads" como disciplina de gasto.** Fueron −15,4% reales.

---

## Supuestos

- **Tasas de entrega usadas (normalización), medidas 21/08/2026 sobre cohortes de despacho
  jun–jul 2026, 100% resueltas:** BeeVenom Urbano **57,6%** (jul, n=236) · Urbano AMBA/BA
  **63,1%** / Interior **51,1%** (jun+jul, n=203/176) · BeeVenom Fixy **70,2%** (jul, n=141,
  99,3% resuelta). Correo: **49,4% de CONFIRMACIÓN**, no de entrega (`delivery_priors`
  producto 4, n=89, recomputado 21/08) — es prepago, no se le proyecta entrega.
- **Umbral de madurez: ≥90% de resueltos** (canon Pancho 13/08/2026). La cohorte 15–21/08 está
  al **28,6%** y la 08–14/08 al **65,9%**: **las dos están inmaduras** y por eso todo el análisis
  comparativo va normalizado. `resuelto = despachadas − en_tránsito` (migración 067, 02/08/2026).
- **Comisiones:** Urbano **5,547%** neto en el giro · Fixy **1%** · leídas en vivo de
  `settings.commission_pct` el 21/08/2026. `mp_fee_pct` = 0. Correo: se conservó el ratio de
  comisión implícito de `daily_pnl` de cada semana (15,9%–17,7%).
- **Flete:** real de `shipments.freight_cost`; donde falta, `estimate_urbano_freight(province)`.
  Medido: Urbano $10.364/guía · Fixy $8.742/guía · Correo $3.273/guía (semana 15–21).
  ⚠️ **la tarifa base de Urbano es del 30/06 y vence el 30/08/2026.**
- **Pauta a costo real ×1,364** (36,4% de impuestos no recuperables, decisión de Pancho
  12/08/2026), aplicado por cuenta según `settings.meta_ads_impuestos`: solo
  `act_1569698667101520` (R3) desde el 07/08/2026. `act_880189106877616` (R2) **sin impuesto**.
  Esta es la convención "real"; el panel `/anuncios` sigue en nominal.
- **Costo de mercadería:** `product_costs` por pack, en vivo. $6.382–$6.625 por pedido.
- **Costo de canal ML: no aplica** — BeeVenom no vende en ML (cero filas `c='ml'` en `sales_rows`).
- **Quedó estimado por inmadurez:** el 97% del revenue de la semana 15–21/08 (75 de 105 guías
  sin desenlace). El rango honesto del profit de esa semana es **$0,82 M – $1,14 M**, no
  $1,069 M puntual.
- **Aproximación declarada:** la atribución de compras por adset viene de Meta (`ad_spend.purchases`)
  y se cruza contra couriers reales de `shipments`; el corte por adset del §7 es indicativo.
