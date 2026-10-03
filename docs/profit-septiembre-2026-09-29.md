# Profit neto — hoy 29/09/2026 y septiembre a la fecha

Medido el **29/09/2026 21:30 ART**. Todo sale de `sales_rows(p_from)` (base del panel `/ventas`, eje **día de VENTA**),
leída por SQL directo (`scripts/_q.mjs`), más `v_ad_spend`, `ml_orders`, `shipments` y `delivery_priors` en vivo.
**No se copió ninguna cifra de panel.** `analisis_pnl` (eje despacho) no se usó.

Salvo aclaración, toda la serie sale de **una sola llamada** `sales_rows('2026-08-01')`, para que agosto y septiembre
sean comparables (el reparto de pauta de `ads_alloc` depende de la ventana consultada; ver §7, nota de sensibilidad).

---

## 1. Hoy — 29/09/2026 (día EN CURSO, parcial)

| | generadas | despachadas | entregadas | revenue est | profit **confirmado** | profit **estimado** |
|---|---:|---:|---:|---:|---:|---:|
| COD | 123 | 24 | 6 | $2.939.631 | **−$588.945** | **$683.809** |
| ML | 121 | 121 | 121 | $4.591.368 | **$1.171.975** | **$1.171.975** |
| **Total** | **244** | **145** | **127** | **$7.530.999** | **$583.030** | **$1.855.784** |

**Realizado vs proyectado.** De los $1.855.784:
- **$1.171.975 (63%) es realizado**: es todo ML — orden pagada y entregada por ML el mismo día, sin proyección de entrega.
- **$683.809 (37%) es proyección casi pura del COD.** De los 123 pedidos COD de hoy, **solo 24 están despachados**
  (los de Correo, que son prepago) y **99 guías de Fixy/Urbano despachan mañana**. El profit confirmado del COD es
  **−$588.945** porque la pauta del día ($756.898 reales) ya está pagada y todavía no se entregó nada.
- El confirmado del COD de hoy **no es una pérdida**: es el desfasaje normal entre pagar la pauta el día 0 y cobrar
  entre el día 2 y el 20.

**Desglose de hoy por canal × producto**

| canal | producto | gen | desp | rev est | profit est |
|---|---|---:|---:|---:|---:|
| ml | Pureza | 120 | 120 | $4.539.578 | $1.157.119 |
| ml | Revival Oil | 1 | 1 | $51.790 | $14.856 |
| urbano | Pureza | 75 | 0 | $1.941.747 | $490.816 |
| fixy | Pureza | 19 | 0 | $561.591 | $169.880 |
| correo | Pureza | 24 | 24 | $319.910 | $41.346 |
| urbano | BeeVenom | 4 | 0 | $107.632 | −$5.998 |
| fixy | BeeVenom | 1 | 0 | $33.854 | −$979 |

(Tabla con `sales_rows('2026-09-29')`; total COD $695.065 en vez de $683.809 — 1,6% de diferencia por la ventana del
reparto de pauta. La cifra de arriba, la de la serie única, es la que se usa en los agregados del mes.)

**Tasa aplicada a la parte proyectada de hoy** (priors recalculados hoy 29/09 sobre despachos de 21 a 35 días atrás,
o sea la ventana 25/08–08/09):
- Urbano Pureza Buenos Aires **50,25%**, Urbano Pureza Córdoba **51,05%**, fallback Urbano **50,96%**
- Fixy Pureza Buenos Aires **54,92%**, fallback Fixy **58,51%**
- Correo Pureza **27,16%** — es tasa de **CONFIRMACIÓN de pago**, no de entrega (Correo es prepago; no se le proyecta entrega)
- A esto el modelo le aplica el decay por edad (072) y, desde los 7 días de edad, el `cohort_k` de la 079.
  **Los pedidos de hoy tienen edad 0 → `cohort_k` = 1 → hoy es 100% prior.**

**El día está incompleto por los dos lados.** A las 21:30 ART ya ocurrió ~85% de los pedidos COD y ~90% de los de ML
(medido sobre 15–28/09). La pauta de Meta del día también viene parcial ($735.640 nominal vs $1.185.554 del 28/09).
**Aterrizaje de día completo: ~$2,1 M.** El sync de ML corrió a las 21:15 ART (no es la foto de las 07:00), así que
el ML de hoy está casi al día: contraste directo contra `ml_orders` da 123 órdenes / $4.690.268 (2 órdenes entraron
entre el recompute y esta lectura).

---

## 2. Septiembre 01–29: el número

| | revenue est | profit **confirmado** | profit **estimado** | margen |
|---|---:|---:|---:|---:|
| **COD** | $120.308.675 | $12.198.614 | **$30.975.920** | 25,7% |
| **ML** | $202.719.493 | $57.981.418 | **$57.981.418** | 28,6% |
| **TOTAL** | **$323.028.166** | **$70.180.032** | **$88.957.338** | **27,5%** |

- **$70.180.032 (78,9%) ya está confirmado**; **$18.777.306 (21,1%) es proyección, y es toda del COD.**
- ML no lleva proyección: la orden se cobra y se entrega dentro del canal.
- Cross-check independiente: `v_ad_spend` da Meta septiembre real $28.192.732, exactamente el `ads` COD de `sales_rows`.
  `sales_days.ads_sin_cohorte` da ~0 (−5,9e-13): **el invariante de la 081 se cumple, no hay pauta evaporándose.**
- Corriendo `sales_rows('2026-09-01')` (ventana mes) el COD da $30.997.376: **0,07% de diferencia**. Irrelevante.

### Por canal × producto

| mes | canal | producto | pedidos | revenue est | profit est | ads |
|---|---|---|---:|---:|---:|---:|
| 09 | COD | Pureza | 4.630 | $107.342.460 | $29.079.994 | $23.255.969 |
| 09 | COD | BeeVenom | 395 | $12.041.546 | $2.120.278 | $4.227.694 |
| 09 | COD | Arraigo | 24 | $729.271 | **−$256.558** | $630.838 |
| 09 | COD | M3 | 3 | $67.500 | $39.540 | $4.733 |
| 09 | COD | Veinguard | 1 | $45.000 | $28.787 | $3.006 |
| 09 | COD | Altus | 5 | $108.000 | −$14.664 | $70.491 |
| 09 | ML | Pureza | 4.951 | $200.989.708 | $57.668.640 | $15.424.663 |
| 09 | ML | Revival Oil | 14 | $938.081 | $210.612 | $139.785 |
| 09 | ML | Veinguard | 14 | $688.756 | $132.747 | $119.184 |
| 09 | ML | Arraigo | 4 | $201.847 | $19.549 | $32.581 |

Pureza es el 97,5% del profit del mes ($86.748.634 de $88.957.338). Arraigo quema $256.558 en COD (24 pedidos, $630.838 de pauta).

### COD por courier — agosto vs septiembre

| courier | mes | gen | entregadas | revenue est | profit est | margen | ads |
|---|---|---:|---:|---:|---:|---:|---:|
| urbano | ago | 2.041 | 1.118 | $57.984.550 | $18.218.044 | 31,4% | $10.098.474 |
| urbano | **sep** | 3.272 | 1.186 | $83.709.781 | $20.548.703 | **24,5%** | $16.919.575 |
| fixy | ago | 533 | 365 | $18.905.542 | $8.578.534 | 45,4% | $4.513.495 |
| fixy | **sep** | 620 | 329 | $18.891.052 | $6.946.512 | **36,8%** | $5.213.770 |
| correo | ago | 839 | 262 | $13.924.077 | $3.992.910 | 28,7% | $4.086.041 |
| correo | **sep** | 1.166 | 339 | $17.813.909 | $3.570.424 | **20,0%** | $6.059.387 |

Urbano creció 60% en pedidos y solo 13% en profit. **Correo creció 39% en pedidos y PERDIÓ plata** ($3,99 M → $3,57 M):
es el canal de peor margen y el que más se degradó.

---

## 3. Septiembre vs agosto

| período | días | COD | ML | TOTAL | por día | revenue/día | margen |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ago 01–29 | 29 | $28.124.874 | $51.448.039 | **$79.572.913** | $2.743.894 | $7.989.777 | 34,3% |
| Ago 01–31 (mes completo) | 31 | $30.789.471 | $53.876.337 | **$84.665.808** | $2.731.155 | $8.018.349 | 34,1% |
| **Sep 01–29** | 29 | $30.975.920 | $57.981.418 | **$88.957.338** | $3.067.494 | $11.138.902 | **27,5%** |

**Manzanas con manzanas (01–29 contra 01–29): +$9.384.425 = +11,8%.** Contra agosto completo: +5,1%.

**Pero el crecimiento es todo volumen, no rentabilidad:**
- Revenue por día **+39,4%** ($7,99 M → $11,14 M). Pedidos por día **+58%** (219 → 346).
- Profit por día solo **+11,8%**.
- **El margen cayó 6,8 pp: 34,3% → 27,5%.**

Por qué cayó el margen (verificado, no inferido):
1. **El ticket COD NO bajó** — `orders.total` promedio: ago $51.858, sep $51.926. No es precio.
   (Ojo: `revenue_estimado` por pedido sí "bajó" de $26.608 a $23.792, pero eso es porque **lleva la tasa de entrega
   adentro** — es la tasa que cayó, no el ticket.)
2. **Cayó la tasa de entrega de Urbano.** Por semana de despacho, tasa sobre resueltos:
   ago 03 52,7% · ago 10 51,8% · ago 17 46,0% · ago 24 53,1% · ago 31 51,9% · **sep 07 47,5% · sep 14 47,3%**.
3. **El ticket de ML SÍ bajó fuerte** — pack 2 de $41.007 a $36.709 (−10,5%), pack 3 de $61.826 a $50.199 (−18,8%).
   Con el envío de ML fijo en pesos, un ticket más bajo sube el costo de canal como %.
   **Costo real del canal ML (comisión + retención + flete, sin percepciones): ago 38,5% → sep 41,6%** — 2 pp por
   encima del rango canónico de 38,8–40,0% (julio 39,3%, medido 29/07/2026). Margen ML: 34,2% → 28,6%.
4. **La pauta subió más que el revenue en COD**: ads/revenue est 20,6% → 23,4%. El CPA por pedido generado quedó
   casi igual ($5.478 → $5.575), así que es mezcla de canal (más Correo y más Urbano, los de peor tasa), no CPA.

---

## 4. Tendencia dentro del mes — **desmejorando**

| bloque | días | COD/día | ML/día | TOTAL/día | revenue/día | margen |
|---|---:|---:|---:|---:|---:|---:|
| Sep 01–15 | 15 | $1.155.080 | $2.053.762 | **$3.208.842** | $11.144.083 | **28,8%** |
| Sep 16–29 | 14 | $974.980 | $1.941.071 | **$2.916.051** | $11.133.352 | **26,2%** |
| Sep 22–28 (última semana cerrada) | 7 | $893.727 | $1.669.950 | **$2.563.677** | $10.510.507 | **24,4%** |

**2ª quincena −9,1% por día contra la 1ª, con el mismo revenue por día.** Todo el deterioro es margen: 28,8% → 26,2%.
La última semana cerrada está en 24,4%, que es 4,4 pp por debajo de la primera quincena.

Serie diaria (profit estimado total):

| fecha | día | profit est | | fecha | día | profit est |
|---|---|---:|---|---|---|---:|
| 14/09 | lun | $4.104.688 | | 22/09 | mar | $2.930.748 |
| 15/09 | mar | $3.884.295 | | 23/09 | mié | $1.894.307 |
| 16/09 | mié | $4.386.053 | | 24/09 | jue | $2.103.678 |
| 17/09 | jue | $3.541.412 | | 25/09 | vie | $2.095.651 |
| 18/09 | vie | $3.241.584 | | 26/09 | sáb | $2.766.608 |
| 19/09 | sáb | $2.611.303 | | 27/09 | dom | $2.873.620 |
| 20/09 | dom | $4.154.544 | | 28/09 | lun | $3.281.128 |
| 21/09 | lun | $3.088.292 | | 29/09 | mar | $1.855.784 (parcial) |

El quiebre es el **23/09**: la semana 14–20/09 promedia $3,72 M/día y la 23–29/09 promedia $2,44 M/día.
**El COD no se movió** (pedidos 170–190/día y pauta $950 k–1,2 M/día, planos). **La caída es de ML**: volumen flojo
del 23 al 26 (135, 134, 143, 146 órdenes contra 190–235 la semana anterior) y margen más bajo por el ticket caído.
Recuperó parcialmente el 27–28 (174 y 205 órdenes).

---

## 5. Qué está firme y qué es proyección

Canon de madurez: **cohorte ≥90% resuelta**, con `resuelto = despachadas − en_tránsito` (identidad de la migración 067).

| bloque | % resuelto COD | profit est | profit conf | brecha (= proyección) |
|---|---:|---:|---:|---:|
| **Sep 01–12** | **94,0%** | $37.116.641 | $36.684.382 | $432.259 (1,2%) |
| Sep 13–19 | 77,6% | $24.796.337 | $23.153.283 | $1.643.054 (6,6%) |
| Sep 20–29 | 28,5% | $27.044.360 | $10.342.367 | $16.701.993 (61,8%) |
| Agosto completo | 99,6% | $84.665.808 | $84.621.057 | $44.751 (0,05%) |

**El número es firme del 12/09 para atrás.** Detalle diario del % resuelto sobre despachadas (COD):

01/09 98,1 · 02/09 99,0 · 03/09 97,8 · 04/09 96,6 · 05/09 97,4 · 06/09 95,2 · 07/09 91,5 · 08/09 94,6 ·
09/09 88,3 · 10/09 90,4 · 11/09 86,4 · **12/09 90,6** · 13/09 86,4 · 14/09 79,5 · 15/09 84,3 · 16/09 83,4 ·
17/09 75,8 · 18/09 66,3 · 19/09 62,7 · 20/09 54,9 · 21/09 48,6 · 22/09 49,3 · 23/09 31,5 · 24/09 25,0 ·
25/09 10,3 · 26/09 14,7 · 27/09 9,1 · 28/09 8,3 · 29/09 25,0

Estricto: la última fecha con **todos** los días previos ≥90% es el **08/09**. Práctico: el bloque 01–12/09 agrega
94,0% resuelto y su brecha estimado−confirmado es de 1,2%, así que **$37,1 M de septiembre son plata hecha**.
Del **13/09 en adelante el número es cada vez más modelo**, y los últimos 7 días (23–29/09) son **prior puro**:
a menos de 7 días de edad `cohort_k` = 1 y el estimador no mira todavía a la cohorte, solo al prior.

Agosto, para referencia, está 99,6% resuelto: **agosto ya no se mueve más.**

### Riesgo concreto sobre la proyección (hay que verificarlo, no lo corrijo acá)

El prior de Urbano que está usando el modelo es **50,96%** (recalculado hoy sobre despachos del 25/08 al 08/09).
Pero las cohortes por semana de despacho vienen bajando y **la semana del 21/09 está leyendo 39,8% con solo 65,6%
resuelto** — y una cohorte inmadura normalmente lee **para arriba**, no para abajo. De 1.019 guías, 668 resueltas y
266 entregadas: para llegar al 51% harían falta 254 entregas más de las 351 abiertas (72%), lo cual es implausible
porque lo que queda abierto es la cola lenta. Aterrizaje razonable de esa semana: **42–45%**.

Si eso se confirma, son **6–9 pp menos sobre ~1.000 guías ≈ 60–90 entregas menos × ~$26.500 de contribución por
entrega ≈ $1,5–2,5 M menos** en el estimado de septiembre. **No lo apliqué**: el modelo se deja como está y esto se
reporta como banda de riesgo. Pasar a **guias-couriers** para confirmar si es deterioro real de Urbano o atraso de
estados.

Fixy en cambio no muestra deterioro: sep 14 80,3% y sep 21 72,9% sobre resueltos, por encima de agosto.

---

## 6. Proyección de cierre de septiembre (incluye el 30)

| componente | monto | base |
|---|---:|---|
| Sep 01–28 (días cerrados) | $87.101.554 | medido |
| 29/09 día completo | ~$2.100.000 | $1.855.784 medidos ÷ ~0,87 del día transcurrido |
| 30/09 (miércoles) | ~$2.500.000 | promedio 22–28/09 = $2.563.677; mié 23/09 fue $1.894.307 |
| **Cierre central** | **~$91,7 M** | |
| Banda | **$89–93 M** | piso incluye el riesgo Urbano de §5 ($1,5–2,5 M) |

**Contra agosto ($84.665.808): +8,3% en el caso central** (+5,2% en el piso, +9,8% en el techo).
Septiembre cierra arriba de agosto **en plata**, pero con ~39% más de facturación: en margen es peor mes.

---

## 7. Supuestos

1. **Tasas de entrega por producto × zona, nunca global.** Priors de `delivery_priors` leídos en vivo, recalculados
   **29/09/2026** sobre la ventana canónica de despachos de 21 a 35 días atrás (25/08–08/09):
   - Urbano: fallback **50,96%** (n=1.570) · Pureza/BsAs **50,25%** (n=197) · Pureza/Córdoba **51,05%** (n=190) ·
     BeeVenom/BsAs **52,11%** · BeeVenom/Santa Fe **50,75%**. Algunas celdas de Altus siguen con medición de julio
     (Córdoba 42,28% del 28/07, Santa Fe 43,04% del 18/07, Mendoza 51,43% del 29/07) — Altus casi no vende, no mueve el total.
   - Fixy: fallback **58,51%** · Pureza/BsAs **54,92%** · Pureza/CABA **69,00%** (13/09) · Pureza/Tucumán **65,32%** (18/09) ·
     Pureza/Córdoba **58,51%** · Pureza/Jujuy **60,77%** (27/09).
   - Correo: **27,16%** Pureza, **28,92%** fallback. Es **tasa de CONFIRMACIÓN de pago**, no de entrega: Correo es
     prepago y no se le proyecta entrega.
   - Sobre eso corre el decay por edad (072) y el `cohort_k` por cohorte (079), que solo actúa desde los 7 días de edad.
2. **Madurez: cohorte ≥90% resuelta** — canon fijado por Pancho el 13/08/2026. El panel `/ventas` sigue en 80%, así que
   en cohortes frescas esta lectura queda ~3 pp por debajo de `/ventas`: es a propósito.
3. **`resuelto = despachadas − en_tránsito`**, identidad exacta (migración 067, 02/08/2026). En Correo suma los perdidos.
4. **Comisiones COD**: Urbano **5,547%**, Fixy **1,0%** (`settings.commission_pct`, leído en vivo).
   Flete Correo **$9.000** fijo (`settings.correo_flete`). Flete Urbano estimado por provincia donde falta la tarifa real.
   `mp_fee_pct` = 0. Los pedidos con tag `cuotas_3` quedan **fuera** de este P&L por definición de `sales_rows`.
5. **Costo real del canal ML**: no se aplicó un % plano — sale de la liquidación real por orden
   (`sale_fee` **por unidad × quantity**, fix del commit 61a9752, + retenciones + flete real por tramo).
   Medido: **ago 38,5% · sep 41,6%** de la facturación (sin percepciones). Referencia canónica 38,8–40,0%,
   julio 39,3% (medido 29/07/2026): **septiembre está ~2 pp por encima**, por caída del ticket.
   Percepciones ML de septiembre: **$17.421.309** — **sí están descontadas** del profit ML (si se recuperan como
   crédito fiscal, el profit ML real sería esa cifra más alto).
6. **Pack de ML del TÍTULO** (`quantity` siempre 1), parser `parseMlPack` de `lib/ml.ts`. Mezcla de septiembre:
   pack 2 = 78,9% de las órdenes, pack 3 = 10,0%, pack 4 = 7,7%, pack 5 = 1,9%, pack 1 = 1,6%.
7. **ML sin producto mapeado: $0.** Verificado con `left join products` sobre `ml_orders` de agosto y septiembre:
   **cero órdenes** sin producto. El inner join del P&L no descarta nada este mes — la trampa conocida
   (memoria `ml-venta-sin-producto-fuera-del-pnl`) no aplica a agosto ni a septiembre.
8. **Pauta Meta: `v_ad_spend.spend_real`, con impuesto por TRAMOS.** El ×1,364 plano es obsoleto.
   Vigente en `settings.meta_ads_impuestos`: `act_1569698667101520` (R3) **36,4% del 07/08 al 15/09** y
   **10,0% desde el 16/09** (verificado día por día: 22–29/09 dan exactamente +10,0%). `act_880189106877616` (R2)
   **sin impuesto** (+0,0%). Septiembre: R3 nominal $8.331.900 → real $10.295.945; R2 $17.896.787 = $17.896.787.
   **Total real $28.192.732**, que es exactamente el `ads` COD de `sales_rows`. El 10% es estimación de Pancho
   (se paga con cripto), no lectura de extracto.
9. **Pauta sin dueño (cuenta 081): resuelta, no hay fuga.** `sales_days.ads_sin_cohorte` da ~0 (−5,9e-13).
   El diagnóstico `v_ads_sin_cohorte` muestra **$412.082** de gasto mal etiquetado en septiembre (y $107.121 en
   agosto), pero desde la migración 081 esa plata **se reparte entre los productos que sí vendieron**, no se evapora.
   Está dentro del $28,19 M.
10. **Product Ads de ML cobrados ×1,21** (`settings.ml_ads_iva` = 0,21): la API devuelve gasto NETO.
    Septiembre: $15.716.213 con IVA. ACOS de equilibrio del canal ML 44,7% (medido 09/08/2026).
11. **Ventana de la consulta.** El reparto de pauta de `ads_alloc` depende del `p_from`. Serie única desde
    `sales_rows('2026-08-01')`. Sensibilidad medida: septiembre COD varía 0,07% contra `sales_rows('2026-09-01')`;
    un día suelto varía hasta 3,3% ($1.855.784 vs $1.917.167 para el 29/09). Irrelevante a nivel mes, a tener en
    cuenta si se compara un día contra el panel.
12. **Conteos agregados en SQL**, nunca `length` de un select (Supabase corta en 1.000 filas sin avisar).
    Lectura por conexión directa a Postgres (`scripts/_q.mjs`), fuera del límite de 8 s de PostgREST.
13. `daily_pnl` se recomputó a las **21:32 ART de hoy** — la lectura es fresca.
14. **Quedó estimado por inmadurez**: $18.777.306 (21,1% del mes), todo COD, y $16.701.993 de eso está en
    los 10 días del 20 al 29/09. Riesgo a la baja identificado y **no aplicado**: $1,5–2,5 M (ver §5).
