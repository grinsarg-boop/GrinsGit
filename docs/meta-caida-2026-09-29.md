# ¿Meta explica la caída de hoy en Shopify? — 29/09/2026

Lectura en vivo de la Graph API (v25.0), corrida el **29/09/2026 ~18:15 AR**.
Ventana de comparación **anclada al calendario y al mismo tramo horario**: hora 00:00–17:59 de cada día
(`breakdowns=hourly_stats_aggregated_by_advertiser_time_zone`, TZ de las cuentas = America/Argentina/Buenos_Aires).

Cuentas barridas: **Tienda R 3** `act_1569698667101520` y **Tienda R 2** `act_880189106877616`.
Tienda R 1 no se tocó (403 conocido) — y de hecho ya no aparece en `/me/adaccounts`.

Impuesto aplicado por tramo y por cuenta (nada de ×1,364 plano):
**R3 = 10 %** (tramo vigente desde 16/09/2026, estimación de Pancho, pago en cripto) · **R2 = 0 %** (nunca pagó).

---

## Veredicto

**El problema no es Meta.** Meta entregó hoy, al mismo tramo horario, **más** tráfico que el martes pasado
y prácticamente lo mismo que un día laborable promedio. El −33 % que ve Pancho aparece solo cuando se
compara contra el **lunes 28**, que fue el pico de gasto de la semana.

---

## 1. Gasto y entrega — hoy vs baselines (00:00–17:59, R2+R3)

| fecha | día | gasto | impresiones | link clicks | LPV | compras (omni) | CPM | CTR |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 22/09 | mar | 640.892 | 166.445 | 3.013 | 2.282 | 129 | 3.850 | 3,02 % |
| 23/09 | mié | 688.492 | 169.111 | 3.185 | 2.411 | 130 | 4.071 | 3,24 % |
| 24/09 | jue | 683.376 | 169.501 | 3.145 | 2.340 | 152 | 4.032 | 3,13 % |
| 25/09 | vie | 762.097 | 202.903 | 3.834 | 2.835 | 157 | 3.756 | 3,24 % |
| 26/09 | sáb | 725.286 | 203.113 | 3.192 | 2.497 | 145 | 3.571 | 2,81 % |
| 27/09 | dom | 828.367 | 239.837 | 4.103 | 3.093 | 152 | 3.454 | 2,90 % |
| 28/09 | lun | **923.437** | **271.296** | **4.628** | **3.453** | 154 | 3.404 | 3,03 % |
| **29/09** | **mar** | **735.798** | **190.033** | **3.336** | **2.549** | **135** | **3.872** | **3,02 %** |

Los mismos números de hoy leídos contra tres baselines distintos:

| baseline | gasto | impresiones | link clicks | LPV | compras |
|---|---:|---:|---:|---:|---:|
| **martes 22/09** (mismo día de semana) | **+14,8 %** | +14,2 % | **+10,7 %** | **+11,7 %** | **+4,7 %** |
| laborables 22, 23, 24, 25, 28 | −0,5 % | −3,0 % | −6,3 % | −4,3 % | −6,5 % |
| lunes 28/09 (pico de la semana) | −20,3 % | −29,9 % | −27,9 % | **−26,2 %** | **−12,3 %** |

**Acá está la respuesta.** Pancho reporta −33 % de visitas y −10 % de ventas.
Contra el lunes 28 la pauta dio **−26 % de landing page views y −12 % de compras**: eso calza casi exacto
con lo que él ve. O sea, el baseline mental de "lo normal" es el pico de finde + lunes, no un día laborable.
Contra un martes real, hoy Meta está **arriba**.

### Por cuenta

**R3 `act_1569698667101520`** (impuesto 10 %)

| fecha | día | gasto | gasto real | link clk | LPV | compras | CPA Meta | CPA real | CPM | CTR |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 22/09 | mar | 181.637 | 199.800 | 802 | 623 | 41 | 4.430 | 4.873 | 4.092 | 2,99 % |
| 25/09 | vie | 254.371 | 279.808 | 1.321 | 952 | 56 | 4.542 | 4.997 | 3.828 | 3,13 % |
| 27/09 | dom | 283.102 | 311.412 | 1.445 | 1.083 | 47 | 6.023 | 6.626 | 3.404 | 2,82 % |
| 28/09 | lun | 249.769 | 274.746 | 1.334 | 1.013 | 41 | 6.092 | 6.701 | 3.275 | 3,15 % |
| **29/09** | **mar** | **213.034** | **234.337** | **997** | **756** | **34** | **6.266** | **6.892** | 3.524 | 2,88 % |

vs martes 22: gasto **+17,3 %**, link clicks **+24,3 %**, LPV **+21,3 %**, compras **−17,1 %**.
vs laborables: gasto −3,8 %, clicks −4,0 %, LPV −3,6 %, compras −24,4 %.

**R2 `act_880189106877616`** (sin impuesto → CPA Meta = CPA real)

| fecha | día | gasto = gasto real | link clk | LPV | compras | CPA | CPM | CTR |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 22/09 | mar | 459.255 | 2.211 | 1.659 | 88 | 5.219 | 3.763 | 3,03 % |
| 25/09 | vie | 507.727 | 2.513 | 1.883 | 101 | 5.027 | 3.721 | 3,30 % |
| 27/09 | dom | 545.266 | 2.658 | 2.010 | 105 | 5.193 | 3.480 | 2,94 % |
| 28/09 | lun | 673.668 | 3.294 | 2.440 | 113 | 5.962 | 3.454 | 2,99 % |
| **29/09** | **mar** | **522.764** | **2.339** | **1.793** | **101** | **5.176** | **4.034** | 3,09 % |

vs martes 22: gasto **+13,8 %**, clicks +5,8 %, LPV **+8,1 %**, compras **+14,8 %**.
vs laborables: gasto +0,9 %, clicks −7,3 %, LPV −4,6 %, compras +1,6 %.

### El test que pedía la pregunta 4

- **¿Cae el gasto y caen los clicks en la misma proporción?** Sí, y proporcionalmente
  (−20 % gasto / −28 % clicks vs lunes; −0,5 % / −6 % vs laborables). No hay divergencia.
- **¿Se mantiene el gasto y caen los clicks?** No. **CTR hoy 3,02 %** contra 3,03 % (lun), 3,13 % (jue),
  3,02 % (mar 22). Plano. No hay deterioro de creativo ni de subasta.
- **¿Se sostiene la relación clicks → landing?** Sí. **LPV / link clicks = 76 % hoy**, contra 74–78 %
  toda la semana. Si el pixel o el sitio estuvieran rotos, este ratio se caería. **Está intacto: el
  tráfico que Meta manda está llegando a la página y el PageView dispara normal.**
- **CPM hoy 3.872** vs 3.404 (lun) y 3.850 (mar 22). Subió ~14 % contra el lunes pero está **idéntico al
  martes pasado**. Es el rebote normal de lunes de subasta barata, no un encarecimiento nuevo.

---

## 2. Estados: ¿se apagó o se rechazó algo?

`effective_status` releído a nivel campaign, adset y ad en ambas cuentas.

| cuenta | ACTIVE | PAUSED | ADSET_PAUSED | CAMPAIGN_PAUSED | DISAPPROVED | WITH_ISSUES | ARCHIVED |
|---|---:|---:|---:|---:|---:|---:|---:|
| R2 | 73 | 246 | 444 | 383 | 14 | 38 | — |
| R3 | 12 | 16 | 43 | 28 | 11 | 19 | 45 |

- **Ningún rechazo nuevo.** El `updated_time` más reciente de un DISAPPROVED es **19/09** en R3 y
  **15/09** en R2. Todo el stock de DISAPPROVED / WITH_ISSUES es histórico (Natures, BeeVenom viejos,
  ads "V1/V2/A1..A6" de 2025). Nada tocado en las últimas 48 h.
- **Ningún PAUSED inesperado hoy.** El log de actividad de R3 desde el 27/09 solo tiene cargas de saldo
  y cobros — **cero** cambios estructurales. En R2 los únicos cambios de estado fueron:
  - `27/09 03:10 AR` — Pancho pausó **ARRAIGO · ABO Open · 05-09**.
  - `28/09 08:22 AR` — Pancho **activó** `cbo-cv04-pureza-02-purezadrops-fixycaba` (campaña creada 27/09, $100.000/día).
- **ARRAIGO no explica lo de hoy.** Ya venía sin entregar: última entrega **24/09** ($37.112, 195 LPV);
  25, 26 y 27 en cero antes de que Pancho la pausara. Salió del sistema hace 5 días, no hoy.
- **Campañas ACTIVE con 0 impresiones hoy:** solo ARRAIGO, que además está PAUSED. Ninguna campaña
  activa está muerta en silencio.

### Cambios de hoy (aditivos, no restrictivos)

Hoy a las **16:09–16:54 AR** se lanzó tanda nueva en **R2**: 3 ad sets Open AR nuevos a **$25.000/día c/u**
(`pureza-p7-no-es-grasa-open-ar`, `pureza-p11-cara-manana-open-ar`, `pureza-p12-piernas-livianas-open-ar`)
con 6 ads que pasaron de "Pendiente de revisión" a **Activo** sin rechazo. Eso suma ~$75.000/día y casi no
pisa la ventana 00:00–17:59 medida acá: el gasto del resto del día va a subir, no bajar.

**No hubo ninguna edición de presupuesto** (`update_campaign_budget` / `update_ad_set_budget`) en las
últimas 72 h en ninguna de las dos cuentas. La trampa de "editar presupuesto apaga la campaña" no aplica hoy.

---

## 3. Límites de cuenta

| | R3 `act_1569698667101520` | R2 `act_880189106877616` |
|---|---|---|
| `account_status` | **1 (ACTIVE)** | **1 (ACTIVE)** |
| `disable_reason` | 0 | 0 |
| `spend_cap` | **0 (sin tope)** | **0 (sin tope)** |
| balance pendiente | $213.556 | $196.971 |
| método de pago | tarjeta (type 1) | tarjeta (type 1) |
| moneda / TZ | ARS / AR | ARS / AR |

- **R3**: carga de saldo **$1.000.000** hoy 16:54 AR vía **Stablecoin**, exitosa. 3 cobros normales hoy.
- **R2**: carga de saldo **$1.000.000** ayer 22:25 AR vía **Mercado Pago**, exitosa. 5 cobros normales hoy.
- **Único incidente de cuenta de la semana:** R2 pasó a **"Pago necesario"** el **27/09 20:41 AR** y Meta
  la volvió a **"Activa"** a las **20:48 AR** — 7 minutos, hace dos días, ya resuelto. No es de hoy.
- Ninguna restricción de cuenta publicitaria ni de página vigente. La única mención de restricción de
  Instagram cuelga de ads de 2025 ya apagados.

---

## Acciones (en orden de plata)

1. **No tocar nada de la pauta por esta caída.** Contra el martes pasado la pauta está **+14,8 % de gasto,
   +11,7 % de LPV y +4,7 % de compras** al mismo tramo horario. Apagar o recortar algo hoy sería reaccionar
   a un baseline mal elegido. El único ajuste que corresponde es de medición: comparar Shopify contra el
   mismo día de semana, no contra el lunes.

2. **Buscar el −33 % fuera de Meta.** Meta mandó hoy **2.549 landing page views** en la ventana (vs 2.282 el
   martes pasado) con el ratio LPV/click intacto en **76 %**. Si Shopify ve un tercio menos de sesiones,
   la diferencia está en el tráfico **no-Meta** (directo, orgánico, ML, email) o en el reporte de Shopify —
   no en lo que la pauta entrega. Primer corte a mirar: sesiones por fuente en Shopify, hoy vs martes 22.

3. **Vigilar el CPA de R3, que sí se movió — y que no tiene nada que ver con las visitas.**
   CPA real de R3 pasó de **$4.873–5.380 (22–24/09)** a **$6.626 → $6.701 → $6.892** (27, 28, 29).
   Tres días seguidos de deterioro y ~40 % arriba de la referencia de $4.500. R2 en cambio está estable en
   **$5.176**, igual que el martes pasado. Es una conversación de campaña de R3 para mañana con datos de día
   cerrado, no una acción de hoy a las 18 h.

---

## Lo que NO pude ver

- **Tienda R 1**: excluida por el 403 conocido. Ya ni figura en `/me/adaccounts`, así que si todavía tuviera
  pauta viva no la estaría contando. Asumo que no la tiene.
- **El lado Shopify**: no leí Shopify en esta corrida. Que Meta esté sano **no prueba** que el sitio esté
  sano para el tráfico que no viene de Meta; solo prueba que el tráfico de Meta llega y dispara PageView.
- **Zona por campaña**: las campañas mezclan Open AR, BSAS, CABA y Fixy. Los CPA de arriba son agregados de
  cuenta; el umbral real es producto × zona y **no lo estoy resolviendo acá**. El $4.500 va como referencia,
  no como regla.
- **Compras del día en curso**: el pixel de Meta atribuye con retraso; las 135 compras de hoy en la ventana
  van a subir un poco cuando cierre el día. La comparación es válida porque el mismo sesgo no aplica a los
  días cerrados — o sea, si algo, hoy está **subestimado**.
- **Últimas ~1,5 h**: la ventana corta a las 18:00 para comparar contra horas completas. La tanda nueva de
  R2 arrancó 16:10 y su gasto real todavía no se ve.
