# ¿Dónde rinde más el peso marginal? — producto × canal
**Modo ESCENARIO · 24/09/2026 · agente profit-dia · ventana 25/08–23/09/2026 (30 días cerrados)**

> Todo desde `sales_rows`/`sales_by_product` (día de VENTA), API de órdenes de ML y `v_ad_spend.spend_real`.
> Nada copiado de un panel. 24/09 va aparte y marcado **parcial** (sync de `ml_orders` al 17:22 ART).

---

## 0. Respuesta corta

| # | Dónde entra el peso siguiente | Retorno del peso marginal | Estado |
|---|---|---|---|
| **1** | **Destrabar el `reputation_limit_reached` del x3 de ML** (`MLA2055177767`) | **infinito: cuesta $0** — vale **$6,2M/mes** (banda $1,6–9,3M) | MEDIDO |
| **2** | **Recuperar la caja del x2** (Premium a `price_to_win` $33.396) | cuesta **precio**, no pauta; el x2 corre hoy a **−45% de volumen** | MEDIDO (1 día parcial) |
| **3** | **COD BeeVenom** | **+$1,17 por peso** si β=1 · **+$0,28** si β=0,59 | economía MEDIDA, β NO medible |
| **4** | **COD Pureza** | **+$0,69 por peso** (β=0,591 medido hoy) | MEDIDO |
| **5** | **ML Pureza — subir `acos_target`** | **el recorrido de ayer NO sobrevive a hoy** (§4) | REFUTADO con dato fresco |
| 6 | ML Veinguard / Revival Oil | la plata no compra nada: presupuesto al **6–9%** de uso | MEDIDO |
| 7 | COD Arraigo | **−$14.364/día**. Apagar o capar | MEDIDO |

**La conclusión de ayer cambia.** El handoff del 23/09 decía *"si hay que elegir dónde entra el peso siguiente, el recorrido medido está del lado de ML"*. Hoy eso es falso, y no por una opinión: **el gasto de Product Ads lleva 12 días clavado en ~$570k/día (con IVA) mientras las órdenes cayeron de 263 (14/09) a 136 (23/09) y el ACOS pasó de 5,5% a 11,3%.** El peso marginal de ML **ya se está gastando** y rinde la mitad que hace diez días. El cuello pasó de la plata a la caja, y la caja no se compra con pauta.

---

## 1. Profit por unidad y por peso de pauta — producto × canal, 30 días

### 1.1 Cifra principal

| canal | pedidos | revenue conf. | revenue est. | **profit CONFIRMADO** | **profit ESTIMADO** | pauta (`spend_real`) |
|---|---:|---:|---:|---:|---:|---:|
| **ML** | 4.634 | $191.473.780 | $191.473.780 | **$57.448.028** | **$57.448.028** | $15.279.005 |
| **COD** | 5.177 | $104.638.708 | $126.100.907 | **$17.867.633** | **$35.827.844** | $27.935.372 |
| **Total** | 9.811 | $296.112.488 | $317.574.687 | **$75.315.661** | **$93.275.872** | $43.214.377 |

ML no tiene cohorte que madurar (`pct_resuelto = 1` por definición): confirmado = estimado.
COD estimado = $3,11M/día · confirmado = $2,51M/día. La brecha es la calle sin resolver, no plata perdida.

**Control de consistencia:** rehice el P&L de ML **orden por orden** desde `ml_orders` (comisión real `sale_fee`, flete real `ship_cost`, `tax_withheld`, COGS de `product_costs`, **percepciones y bonificación Flex prorrateadas por revenue del día**, Product Ads por publicación × 1,21). Da **$57.502.876** contra los **$57.448.028** de la RPC: **0,10% de desvío**. Las percepciones son **$15.978.301 en 30 días** — el bottom-up que se las olvida sobreestima ~30% (trampa conocida, no caí).

### 1.2 COD — por producto (por día de venta, `sales_by_product`)

| producto | pedidos | contribución antes de ads | **por pedido** | CPA asignado | **profit est.** | **$ profit por peso de pauta** |
|---|---:|---:|---:|---:|---:|---:|
| **Pureza** | 4.686 | $55.999.057 | **$11.950** | $4.885 | **$33.106.801** | **$1,45** |
| **BeeVenom** | 458 | $7.337.769 | **$16.021** | $9.464 | **$3.003.265** | $0,69 |
| M3 | 3 | $44.273 | $14.758 | $1.570 | $39.564 | $8,40 (n=3) |
| Veinguard | 1 | $13.147 | — | — | $10.142 | — |
| Altus | 5 | $55.827 | $11.165 | $14.092 | −$14.635 | −$0,21 |
| **Arraigo** | 24 | $313.143 | $13.048 | $26.268 | **−$317.293** | **−$0,50** |

⚠️ **El CPA asignado NO es el CPA real por producto.** La RPC reparte `spend_real` por peso de pedidos generados, y hay **$6,57M de pauta de Pureza etiquetada como producto 1 (Natures)** — campañas `cxr-cv01-pureza-02-purezadrops`, `cbo-cv02-pureza-02-purezadrops-bsas`, `abo-keepalive-pureza-02-50k-nsr`. Esa plata cae en `ads_huerfana` y se reparte entre todos. Re-atribuyendo por **nombre de campaña**:

| producto real (por `campaign_name`) | `spend` nominal | **`spend_real`** | recargo | compras Meta | CPA Meta |
|---|---:|---:|---:|---:|---:|
| **Pureza** | $19.874.513 | **$22.313.882** | +12,3% | 4.963 | $4.496 |
| **BeeVenom** | $3.613.020 | **$3.613.020** | 0% | 514 | $7.029 |
| Natures (real) | $876.042 | $941.741 | +7,5% | 241 | $3.908 |
| **Arraigo** | $742.348 | $742.348 | 0% | 37 | **$20.063** |
| Dusty Rose Verano | $260.782 | $260.782 | 0% | 21 | $12.418 |
| Altus | $63.599 | $63.599 | 0% | 3 | $21.200 |

Con esa atribución: **Pureza $1,49 de profit por peso · BeeVenom $1,02 · Arraigo −$0,58.** El total cierra exacto contra la RPC ($27.935.372 = $27.935.372); lo que cambia es el reparto. **Esto es un bug de etiquetado a arreglar: hoy Pureza se ve más barata de lo que es y BeeVenom más cara.**

### 1.3 ML — por producto (bottom-up orden por orden)

| producto | órdenes | unidades | revenue | contribución antes de ads | **por orden** | ads (×1,21) | ACOS | **profit** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Pureza** | 4.581 | 10.548 | $188.240.223 | $71.390.621 (**37,9%**) | **$15.584** | $14.750.485 | 7,84% | **$56.640.137** |
| Natures | 17 | 44 | $1.145.651 | $524.374 (45,8%) | $30.845 | $41.349 | 3,61% | $483.025 |
| Veinguard | 19 | 46 | $1.003.351 | $419.540 (41,8%) | $22.081 | $157.546 | 15,70% | $261.994 |
| Revival Oil | 13 | 38 | $929.096 | $352.717 (38,0%) | $27.132 | $174.092 | 18,74% | $178.624 |
| Arraigo | 5 | 9 | $239.958 | $65.600 (27,3%) | $13.120 | $126.504 | 52,72% | **−$60.904** |

**El % de contribución es el ACOS de equilibrio marginal de cada ítem** (cuánto puede costar el peso siguiente de pauta antes de restar). Pureza 37,9% a 30 días; **36,8% en los últimos 7 días cerrados** (17–23/09) — el número de ayer (38,2%) sigue vivo, apenas más bajo.

### 1.4 Profit por UNIDAD y por ORDEN, misma base en los dos canales

Base única: **contribución antes de ads** (lo que deja la venta antes de pagar la pauta) y **profit después de ads**. COD sale de `urbano`+`fixy`, donde las unidades son exactas (`order_items.qty × pack`); **correo queda afuera de esta tabla** porque sus pedidos no viven en `orders` y no tienen unidades.

| producto | canal | unidades | **contrib/UNIDAD** | **contrib/ORDEN** | **profit/UNIDAD** | **profit/ORDEN** |
|---|---|---:|---:|---:|---:|---:|
| Pureza | **ML** | 10.548 | **$6.768** | **$15.584** | **$5.370** | **$12.365** |
| Pureza | COD Fixy | 1.287 | $8.835 | $19.175 | $5.478 | $11.888 |
| Pureza | COD Urbano | 6.436 | $5.553 | $12.070 | $3.465 | $7.531 |
| BeeVenom | COD Fixy | 237 | **$11.719** | **$25.717** | $6.124 | $13.438 |
| BeeVenom | COD Urbano | 563 | $6.039 | $13.077 | $2.091 | $4.527 |
| Veinguard | ML | 46 | $9.121 | $22.081 | $5.696 | $13.789 |
| Revival Oil | ML | 38 | $9.282 | $27.132 | $4.701 | $13.740 |

Lectura: **por unidad, Fixy es el mejor destino de la casa** ($8.835 Pureza, $11.719 BeeVenom) — ticket alto, comisión 1% y 68,3% de entrega. **Urbano es el peor** ($5.553) y es donde va el 78% del volumen COD. **ML queda en el medio** ($6.768): ticket más bajo ($37.588 vs $49.987) pero cobra siempre.
⚠️ Fixy **no es una palanca**: lo decide el CP. Las cifras COD de esta tabla son **estimadas** (cohorte inmadura) — la base madura está en la §2.

## 2. La base de cálculo: cohorte madura

Las cifras COD de la §1 son **estimadas** — la ventana de 30 días tiene **63,3% resuelto en Urbano**, muy por debajo del umbral de **≥90%**. Para decidir dónde poner plata uso la **cohorte cerrada 08–29/08/2026** (ventas), con **97,9–100% resuelto** en los tres couriers:

| courier | pedidos | % resuelto | **tasa** | contribución antes de ads / pedido |
|---|---:|---:|---:|---:|
| **Urbano** | 1.399 | 98,4% | **54,6%** | **$13.476** |
| **Fixy** | 339 | 100,0% | **68,3%** | **$24.987** |
| **Correo** | 575 | 97,9% | **30,4% de CONFIRMACIÓN** (no de entrega) | **$9.103** |
| **COD Pureza ponderado** | **2.313** | — | — | **$14.076** |
| ML (mismo período) | 2.276 | 100% | 100% | $19.354 |

**La base madura es 17,8% MÁS ALTA que el estimado de la ventana de 30 días** ($14.076 vs $11.950). No es el sesgo habitual: acá `sales_rows` está siendo **conservador** en las cohortes frescas (`cohort_k` × `delivery_decay` implica ~52,1% para Urbano contra 55–56% medido en cohorte cerrada). Uso **$14.076** para todo lo marginal y lo declaro.

**El courier NO es una palanca:** lo decide el CP del comprador, no la pauta. La unidad de decisión en COD es el **producto**.

---

## 3. COD — el peso marginal, medido

### 3.1 Elasticidad: el vault dice 0,989, yo mido 0,591

Regresión log-log de pedidos generados de Pureza (urbano+fixy+correo) contra `spend_real` de campañas Pureza, **20/08–23/09, n=35, banda $390k–$936k/día**, con término de tendencia:

```
β_spend = 0,591    tendencia = −0,16%/día    R² = 0,621
```

Sin detrendear da 0,543. Sobre 60 días (banda $52k–$936k) da 0,663.

⚠️ **Esto contradice la memoria `pauta-elasticidad-lineal` (β = 0,989 hasta $931k/día).** No la doy por derogada: es una **regresión observacional diaria**, contaminada por fatiga de creativo, día de semana y el propio movimiento de la caja de ML (que mueve la demanda total de Pureza). **La única forma de zanjarlo es un escalón controlado.** Reporto las dos ramas.

### 3.2 La tabla de decisión

| | contribución/pedido (cohorte madura) | CPA medio 7d | **cushion** | CPA marginal (β=0,591) | **retorno del peso marginal** |
|---|---:|---:|---:|---:|---:|
| **COD Pureza** | **$14.076** | $4.920 | **2,86×** | $8.325 | **+$0,69** (β=0,989 → +$1,83) |
| **COD BeeVenom** | **$17.100** | $7.889 | **2,17×** | — | **+$1,17** si β=1 · **+$0,28** si β=0,591 |
| COD Arraigo | $12.976 | **$30.931** | **0,42×** | — | **−$0,58** |

BeeVenom, cohorte cerrada 08–29/08: Fixy 68,3% ($22.558/pedido) · Urbano 65,5% ($16.618) · Correo 43,3% de confirmación ($11.311). Ponderado **$17.100** sobre 295 pedidos. **BeeVenom deja MÁS contribución por pedido que Pureza** ($17.100 vs $14.076) — ticket parecido ($50.7k vs $50.0k) pero **10 pp más de tasa de entrega**.

**Su β no se puede medir:** β = 0,102 con **R² = 0,04** (n=60, banda $54k–$157k/día). No hay señal. Lo único estructural que puedo decir: BeeVenom gasta **$120k/día contra $780k/día de Pureza** — está 6,5× más lejos de la saturación, y por eso es *más probable* que esté en zona lineal. **Eso es un argumento, no una medición**, y el escalón de validación tiene que medirlo.

**CPA de BeeVenom, estable:** $7.889 a 30 días · $7.760 a 7 días. No se degrada.

---

## 4. ML — por qué el recorrido de ayer no sobrevive

### 4.1 El presupuesto NO ata, y hace 12 días que no ata

Campaña `goteros` (id 356403999), API en vivo 24/09:

```
budget = $576.000/día · strategy = PROFITABILITY · acos_target = 15,15% (ROAS 6,6)
costo 14 días cerrados (10–23/09) = $6.455.792 neto = $461.128/día = 80,1% del budget
```

**Nunca toca el techo.** Subir el presupuesto compra **cero**. La única palanca de gasto en ML es **subir `acos_target` (bajar el ROAS objetivo)**.

> No pude reproducir por API el `lost_impression_share_by_budget` 0,09 / `by_ad_rank` 0,61 del contexto: los endpoints `campaigns_metrics` y `ads_search` rechazan el campo (`Field IMPRESSION_SHARE not allowed`). **Queda sin verificar de mi lado.** Lo que sí verifiqué —uso de presupuesto al 80–85%— dice lo mismo: **la plata no es el cuello.**

### 4.2 El dato que voltea la conclusión

Serie diaria de ML (bottom-up, orden por orden, ads por publicación × 1,21):

| día | órdenes | revenue | **ads** | ACOS | **profit** |
|---|---:|---:|---:|---:|---:|
| 14/09 | **263** | $10.439.311 | $570.759 | **5,47%** | **$3.256.431** |
| 16/09 | 220 | $9.254.471 | $564.432 | 6,10% | $2.921.312 |
| 18/09 | 202 | $7.969.747 | $557.663 | 7,00% | $2.436.805 |
| 20/09 | 234 | $8.844.718 | $571.809 | 6,46% | $2.686.755 |
| 22/09 | 191 | $7.192.653 | $574.678 | 7,99% | $2.062.633 |
| **23/09** | **136** | $5.238.535 | **$589.825** | **11,26%** | **$1.259.007** |
| 24/09 *(parcial 17:22)* | 83 | $3.201.685 | $267.550 | 8,36% | $865.399 |

**El gasto es plano —de hecho sube— y el output cayó 48%.** Profit/día de ML: $2.327.872 (10–16/09) → **$2.177.429** (17–23/09) → **$1.745.856** (21–23/09). Contra COD en base madura: $1.549.148 → $1.420.432 → $1.216.738/día. **Los dos caen, ML más rápido.**

Ese es el test del peso marginal que no hacía falta inventar: **ya se gastó, y rindió la mitad.** Con el ACOS realizado duplicándose a gasto constante, el headroom de 29 pp hasta el 36,8% de equilibrio es **nominal**: mide un peso cuyas ventas sean 100% incrementales, y no lo son.

**Cuánto de ML no es incremental:** la campaña reporta **892 unidades orgánicas contra 1.942 publicitadas** en 14 días → **31,5% del canal vende sin pauta**, y el `total_amount` que la API atribuye a los ads ($77,1M) es el **71,6% del revenue real del canal** ($107,6M, 10–23/09). El ACOS que informa ML **no es incremental**.

### 4.3 Qué pasó, en vivo (API 24/09)

| publicación | precio | estado de caja | `price_to_win` | ganador |
|---|---:|---|---:|---|
| **x2 Clásica** `MLA3692036796` | $33.231 | **`competing` / `minimum`** | $32.547 | `MLA3983995152` @ $33.000 |
| **x2 Premium** `MLA1830076567` | $39.677 | `winning` / `maximum` | **$33.396** | (ídem) |
| **x3 catálogo** `MLA2055177767` | $42.290 | **`listed` / `minimum` — `reputation_limit_reached`** | $42.290 | `MLA3944865964` **@ $47.108** |
| x4 `MLA1908275639` | $60.000 | `winning` / `maximum` | $51.990 | sí mismo |
| x3 Premium `MLA3030316544` | $55.500 | `not_listed` (`item_not_opted_in`) | — | — |
| x5 `MLA3030521696` | $84.498 | `not_listed` (`item_not_opted_in`) | — | — |

Comisión simulada hoy (`/sites/MLA/listing_prices`, `MLA8830`): `gold_special` **15,5% + $3.320 fijos por debajo de $33.000** · `gold_pro` 28,9% + el mismo fijo. **El escalón del `fixed_fee` sigue en $3.320** (confirmado hoy, igual que ayer). Bajar la Clásica a $32.999 sigue costando **−$3.504 de profit por orden**: no.

**Hoy 24/09 la caja se movió de la Clásica a nuestra propia Premium** (29 órdenes la Clásica contra 36 la Premium, cuando el promedio de la Premium era 2–9/día). Es el mismo episodio del 11–13/09. El ticket real de la Premium hoy es **$35.074** (no los $39.677 de lista) con contribución **$11.625/orden**, contra **$11.391** de la Clásica a $33.231: **por orden da casi lo mismo**. El problema es el **volumen total**.

**Proyección del día:** 83 órdenes al 17:22 ART. En los últimos 10 días el 77,5% del día está hecho a esa hora → **~107 órdenes proyectadas**, contra un promedio de **194/día** en 17–23/09. **−45%.** Es **un solo día y parcial** — no lo tomo como tendencia, lo tomo como la señal de que la caja vale más que cualquier peso de pauta.

### 4.4 Entonces, ¿se sube el `acos_target`?

**Mi lectura: no hoy.** No porque el número de equilibrio sea falso —36,8% está medido y es real— sino porque:
1. El gasto plano de los últimos 12 días ya probó, sin querer, que el peso extra en ML rinde la mitad cuando falta la caja.
2. El contrafactual de ayer midió que **sin caja la pauta cuesta $3.816/orden y con caja $2.800 (−27%)**. Subir el ACOS objetivo **justo ahora** compra tráfico al precio más caro del ciclo.
3. Primero se recupera la caja (cuesta precio, no pauta); **después** se decide si el peso siguiente entra por ahí.

La regla del 30/07 *"nunca subir el `acos_target` para escalar"* **sigue sin derogarse**. La decisión es de Pancho.

---

## 5. Packs — cuál deja más

### 5.1 ML Pureza por pack, 30 días (medido, orden por orden)

| pack | órdenes | unid. | ticket | comisión | flete/orden | costo de canal | ACOS | **profit/ORDEN** | **profit/UNIDAD** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| x1 | 73 | 75 | $39.897 | 23,6% | $7.074 | 51,2% | 10,03% | $12.881 | **$12.537** |
| **x2** | **3.656** | 7.430 | $37.588 | 20,7% | $7.119 | 49,5% | 7,81% | $11.490 | **$5.654** |
| x3 | 518 | 1.569 | $50.813 | 23,9% | $8.048 | 49,6% | 6,62% | **$15.203** | $5.019 |
| x4 | 246 | 1.004 | $55.451 | 22,1% | $8.440 | **47,2%** | 5,92% | **$15.792** | $3.869 |
| **x5** | 88 | 470 | $90.259 | 26,8% | $8.618 | **46,1%** | 14,77% | **$21.975** | $4.115 |

**Los dos rankings se cruzan.**
- **Por unidad vendida gana el x2** ($5.654) entre los packs ≥2. El x1 gana en el papel ($12.537/unidad) pero son 73 órdenes y su costo de canal es el peor (51,2%).
- **Por orden gana el x5** ($21.975), después el x4 ($15.792) y el x3 ($15.203).

### 5.2 COD Pureza por pack, cohorte cerrada 08–29/08

| courier | pack | guías | % resuelto | tasa | ticket | **contrib/GUÍA** | **contrib/UNIDAD** |
|---|---|---:|---:|---:|---:|---:|---:|
| Urbano | x2 | 1.152 | 98,4% | 54,1% | $49.987 | $12.607 | **$6.303** |
| Urbano | x3 | 246 | 96,7% | 56,7% | $59.988 | **$17.053** | $5.684 |
| Fixy | x2 | 280 | 100% | 66,8% | $49.986 | $23.411 | **$11.706** |
| Fixy | x3 | 58 | 100% | 75,9% | $59.987 | **$33.102** | $11.034 |

**El mismo cruce, en los dos canales.** Y el x3 entrega **2,6–9,1 pp MÁS** que el x2 — no es solo ticket, el paquete grande llega mejor.

### 5.3 ¿Conviene empujar el x3/x4? Sí — y el criterio es por qué

**Sí, porque el recurso escaso es la EXPOSICIÓN, no las unidades.** El envasado propio da **~4.500 frascos/día contra ~900/día de consumo** (handoff 23/09): las unidades no atan en ningún escenario. Lo que ata es cuántos compradores ve la ficha. Con el cuello en órdenes, **se maximiza profit por orden → pack grande.**

| movimiento | delta por orden |
|---|---:|
| un comprador x2 → x3 | **+$3.713** |
| un comprador x2 → x4 | **+$4.302** |
| un comprador x2 → x5 | **+$10.485** |

A 190 órdenes/día de ML, correr **10 pp del mix de x2 a x3** = 19 órdenes × $3.713 = **$70.547/día = $2,12M/mes**.

**Con qué palanca, producto por producto:**
- **x4** (`MLA1908275639`) — es el único pack grande sano: `winning`/`maximum`, de **0,8 órdenes/día en agosto a 14,6 en P2** y 10–18/día esta semana. La palanca que funcionó fue **precio + caja** ($71.652 → $53.737). Hoy está en `price_to_win` $51.990 y gana. **No tocar** (memoria `no-tocar-lo-que-ya-funciona`). Si algo, más pauta acá: su ACOS es **5,92%**, el más bajo de la casa.
- **x3** — la palanca **no es precio**: `MLA2055177767` está a $42.290 y el rival gana la caja a **$47.108, 11,4% MÁS CARO**. El bloqueo es `reputation_limit_reached` (§6).
- **x5** (`MLA3030521696`) y **x3 Premium** (`MLA3030316544`) — están `not_listed` con razón **`item_not_opted_in`**: ni siquiera compiten por la ficha. **Optar-in es gratis.** El x5 deja $21.975/orden con 88 órdenes en 30 días; es el pack con mejor profit por orden de toda la casa y está fuera del catálogo.
- El **x1** no se empuja: peor costo de canal (51,2%) y peor profit por orden.

---

## 6. Productos fuera de Pureza — número por número

| producto | canal | pedidos 30d | contrib/pedido | CPA / ACOS | profit 30d | veredicto |
|---|---|---:|---:|---:|---:|---|
| **BeeVenom** | COD | 458 | **$17.100** (madura) | $7.889 | +$3.003.265 | ✅ **el único candidato real** |
| Veinguard | ML | 19 | $22.081 | ACOS 15,7% (breakeven 41,8%) | +$261.994 | ⚠️ economía sí, **demanda no** |
| Revival Oil | ML | 13 | $27.132 | ACOS 18,7% (breakeven 38,0%) | +$178.624 | ⚠️ ídem |
| Natures | ML | 17 | $30.845 | ACOS 3,6% (breakeven 45,8%) | +$483.025 | ❌ **items `paused_by_seller`** |
| Arraigo | COD | 24 | $13.048 | **CPA $30.931** | **−$317.293** | ❌ apagar/capar |
| Arraigo | ML | 5 | $13.120 | ACOS 52,7% | −$60.904 | ✅ ya pausada el 21/09 |
| Altus, M3 | COD | 8 | — | — | ~−$25k | ruido (n<10) |

**BeeVenom.** Contribución/pedido **$17.100** contra **$14.076** de Pureza. CPA $7.889 y **estable** ($7.760 a 7 días). Gasta **$120k/día** contra los **$780k/día** de Pureza — es **6,5× más chico** y está en la cuenta **R2 (0% de recargo)**, mientras Pureza carga el ~10% de R3 desde el 16/09. **Es el producto con economía medida que hoy no estamos empujando.** Su límite es demanda, y **eso no está medido**: β = 0,102 con R² = 0,04. Un escalón de validación acá cuesta poco y responde la única pregunta que falta.

**Veinguard y Revival Oil.** Contribución por orden altísima ($22k–$27k) y presupuesto de ML **casi sin usar**: `Vein` gastó $43.395 en 14 días contra $48.000/día de budget (**6,5%**), `Revival Oil` $47.548 contra $39.800/día (**8,5%**). **La plata no es el cuello: no hay demanda que comprar.** 4 y 3 unidades directas en 14 días. Lo que mueve la aguja ahí es **listing / catálogo**, no pauta → **analista-ml**.

**Natures.** Las 4 publicaciones están **`paused_by_seller`** (verificado por API hoy). Explica la caída de 71 órdenes en 22 días de agosto a 17 en 30 días. Es la baja por el reclamo de marca — **no es una opción de crecimiento.** Aparte: **$941.741 de pauta Meta sigue corriendo con nombre `natures`** y 241 compras atribuidas; hay que ver a qué landing van.

**Arraigo.** Pierde **$430.933 en 30 días** en COD (contribución $311.415 contra $742.348 de pauta real). Break-even CPA $12.976, CPA real **$30.931: 2,4× por encima.** La campaña de ML ya está `paused` desde el 21/09; la de COD no.

---

## 7. Q5 — cuánto cuesta la caja perdida del x3

**Los hechos (medidos, `ml_orders` por día de venta ART):**

| ventana | x3 catálogo `MLA2055177767` | x3 Premium `MLA3030316544` | **x3 total/día** |
|---|---:|---:|---:|
| **12–17/09** | 21,8/día (pico **27 el 16/09**) | 12,3/día | **34,2** |
| **18–23/09** | 6,7/día (**2 el 23/09, 1 hoy**) | 5,3/día | **12,0** |
| Δ | −15,1 | −7,0 | **−22,2/día** |

Profit por orden medido a 30 días: catálogo **$11.924** · Premium **$17.501** → blend de la ventana sana **$13.895**.

| escenario de canibalización | supuesto | **impacto** |
|---|---|---:|
| **0% captura** (cota superior) | ninguna de esas órdenes vuelve | **−$308.469/día = −$9,25M/mes** |
| **observado (central)** | el x2 subió +9,0 órdenes/día entre las dos ventanas × $11.490 | **−$205.059/día = −$6,15M/mes** |
| **100% captura** (cota inferior) | las 22,2 migran al x2 y solo se pierde el diferencial | **−$53.391/día = −$1,60M/mes** |

**Central: −$6,2M/mes. Banda: −$1,6M a −$9,3M.**
⚠️ La rama central es **la más débil**: la comparación del x2 entre esas dos ventanas está contaminada porque **la propia caja del x2 cambió de manos dentro de W1** (la Premium se la llevó el 11–13/09). El signo es seguro, la magnitud no.

**La causa NO es precio.** `MLA2055177767` está a **$42.290** y `price_to_win` = $42.290 (es decir, ML dice que al precio actual alcanzaría). El ganador `MLA3944865964` vende a **$47.108 — 11,4% más caro que nosotros.** El bloqueo es `reason: ["reputation_limit_reached"]`.

**Y no es nuestra reputación de cuenta.** API en vivo, `/users/me`: **`5_green` / `platinum`**, 8.212 ventas en 60 días, reclamos **0,4%**, cancelaciones **0%**, demoras 0,16%. **Es un límite a nivel ÍTEM** (consistente con el "bug de packs" ya registrado). Conclusión operativa: **es una gestión, no una compra.** Cuesta $0 y vale $6,2M/mes — es el mejor retorno de la casa hoy, por orden de magnitud. → **analista-ml** para ejecutarlo.

**Bonus del mismo tipo:** `MLA3030316544` (x3 Premium) y `MLA3030521696` (x5) están `not_listed` por **`item_not_opted_in`**. Optar-in es gratis. El x5 deja **$21.975/orden**.

---

## 8. Comparativa 3 / 7 días (profit por día)

| | ML (medido) | COD Pureza (base madura) | total |
|---|---:|---:|---:|
| **10–16/09** (7d) | $2.327.872 | $1.549.148 | $3.877.020 |
| **17–23/09** (7d) | $2.177.429 *(−6,5%)* | $1.420.432 *(−8,3%)* | $3.597.861 |
| **18–20/09** (3d) | $2.516.259 | $1.428.432 | $3.944.691 |
| **21–23/09** (3d) | **$1.745.856** *(−30,6%)* | **$1.216.738** *(−14,8%)* | **$2.962.594** *(−24,9%)* |

CPA de COD Pureza en el mismo camino: **$3.948 el 16/09 → $5.460 el 23/09 (+38%)**, con el gasto casi plano ($707k → $748k). **No es saturación de pauta: es deterioro a gasto constante** (fatiga de creativo y/o menos demanda de categoría). El mismo patrón que ML. Eso refuerza el punto: **el peso marginal, hoy, en los dos canales, compra menos que hace una semana.**

**Corte con/sin ads (ML):** 31,5% de las unidades del canal son orgánicas (892 de 2.834, campaña `goteros`, 14 días). En COD no existe el corte: **el 100% del volumen es comprado**.

---

## 9. Qué haría con el peso siguiente

1. **$0 — destrabar el x3** (`reputation_limit_reached` en `MLA2055177767`) y **opt-in del x5 y del x3 Premium**. Vale $6,2M/mes medido + el x5 fuera de catálogo. → **analista-ml**.
2. **$0 de pauta — decidir la caja del x2.** La Premium a `price_to_win` **$33.396** (hoy $39.677). Cuesta precio, no pesos. **No** bajar la Clásica a $32.999: el `fixed_fee` de $3.320 se lleva $3.504/orden.
3. **Plata nueva → COD BeeVenom**, como **escalón medido**, no como reasignación. Es el único producto con contribución/pedido superior a Pureza ($17.100 vs $14.076), CPA estable, cuenta sin recargo y **6,5× menos escala**. Su β es lo único que falta: el escalón lo mide.
4. **NO sacarle pauta a Pureza COD** para financiar lo anterior (memoria `no-sacar-pauta-a-lo-que-funciona`): sigue en **+$0,69 por peso marginal** incluso con el β conservador de 0,591.
5. **Apagar/capar Arraigo COD** (−$14.364/día).
6. **`acos_target` de ML: esperar.** Primero la caja. El headroom de 29 pp es real pero está medido contra un peso 100% incremental, y el canal acaba de mostrar que a gasto plano rinde la mitad.
7. **Arreglar el etiquetado de producto en Meta:** $6,57M de campañas Pureza corren como producto 1. Mientras siga así, el CPA por producto del panel está sesgado.

---

## 10. Supuestos

- **Umbral de madurez: ≥90% resueltos** — default Claude 12/08/2026, **pendiente de canon de Pancho**. Se cita en toda salida. La ventana de 30 días (25/08–23/09) **no** lo cumple en COD (Urbano 63,3% resuelto): todo lo marginal se calculó sobre la **cohorte cerrada 08–29/08/2026** (97,9–100% resuelto).
- **`resuelto = despachadas − en_transito`**, identidad exacta COD y ML (migración 067, 02/08/2026). En correo suma los perdidos.
- **Tasas de entrega POR PRODUCTO × COURIER, medidas hoy 24/09/2026 sobre cohorte cerrada 08–29/08** (nunca una global):
  - Pureza · Urbano **54,6%** (x2 54,1% · x3 56,7%) · Fixy **68,3%** (x2 66,8% · x3 75,9%)
  - BeeVenom · Urbano **65,5%** · Fixy **68,3%**
  - Correo **30,4% (Pureza) / 43,3% (BeeVenom)** de **CONFIRMACIÓN**, no de entrega — es prepago, no se le proyecta entrega (memoria `correo-prepago-sin-proyeccion`).
  - Serie de maduración de Urbano por semana de despacho: cohortes ≥90% resueltas hasta la semana del **31/08**; las del 07/09 (79,2%) y 14/09 (53,1%) **no se usaron**, y sus lecturas (59,2% y 73,0%) son las que mienten para arriba.
  - ⚠️ **Es un ancla de HOY, no un punto fijo.** El ancla de Urbano es una serie que sube: may-2Q 42,1% → jun-2Q 46,2% → jul-1Q 51,7% → jul-2Q 57,4% → **ago-2Q/3Q 54,6% (esta medición, 24/09/2026)**.
- **Costo real del canal ML: 46,1–51,2% de la facturación según pack**, medido orden por orden en esta ventana (no un % plano). Ponderado Pureza **49,4%**. Más alto que el 38,8–40,0% de la memoria `serum-capilar` (29/07/2026) **porque el precio bajó 12,4% y el flete es fijo en pesos por tramo** — misma causa ya registrada en el contrafactual del 23/09.
- **Comisiones ML: reales por orden** (`ml_orders.sale_fee`), no simuladas. x2 Clásica 20,7% · x2 Premium 24,2% · x3 23,9% · x4 22,1% · x5 26,8%. Curva y `fixed_fee` **$3.320** leídos hoy 24/09/2026 de `/sites/MLA/listing_prices` (`MLA8830`).
- **Flete: real por orden** (`ml_orders.ship_cost` en ML; `freight_cost` / `estimate_urbano_freight` en COD). Fallback Urbano $10.200, Fixy medido $6.633–$7.455.
- **Fees por medio de pago (COD, `settings` leído en vivo hoy):** Urbano **5,547%** · Fixy **1,0%** · `mp_fee_pct` **0** · `fixy_cpa_multiplier` 1,6. Los pedidos con tag `cuotas_3` (link MP, fee real ~14,4%) están **excluidos** de todo el informe, igual que en `sales_rows`.
- **Retenciones (`tax_withheld`) y percepciones reales**; percepciones ($15.978.301 en 30 días) y bonificación Flex prorrateadas por revenue del día, misma regla que `recompute_daily_pnl`.
- **COGS de `product_costs`** (Pureza: x1 $2.500 · x2 $4.500 · x3 $7.000 · x4 $10.000 · x5 $12.500). No estimados.
- **Product Ads de ML: gasto NETO de la API, cobrado ×1,21** (`settings.ml_ads_iva = 0.21`). Una sola llamada a `ads/search` con dedup por `item_id` — **nunca iterando campañas** (`campaign_id` no filtra: ×3,04).
- **Impuesto de pauta Meta: por tramos vía `v_ad_spend.spend_real`** (migración 093, 19/09/2026). Vigente y verificado hoy en `settings.meta_ads_impuestos`: R3 `act_1569698667101520` **36,4% del 07/08 al 15/09/2026** y **10,0% desde el 16/09/2026**; **R2 `act_880189106877616` sin impuesto**. En esta ventana el recargo efectivo fue **+29,6% sobre R3** y **+7,8% sobre el total**. **No se grosseó a mano: el ×1,364 plano está obsoleto (Pancho, 23/09/2026).** El 10% sigue siendo **estimación de Pancho**, no lectura de extracto.
- **El día 24/09/2026 es PARCIAL** (último pedido sincronizado 17:22 ART) y **no entra en ningún total**. Solo se usa para el estado de caja en vivo y la proyección de la §4.3, declarada como tal.

### Qué quedó ESTIMADO / SUPUESTO (y no debe leerse como dato)

| | qué es |
|---|---|
| Profit COD de la ventana 25/08–23/09 | **estimado**: 63,3% resuelto en Urbano. El confirmado es $17,9M contra $35,8M estimado. |
| Contribución COD/pedido de $14.076 | **medida** en cohorte cerrada 08–29/08 y **aplicada** a la ventana de 30 días: la mezcla de couriers cambió, la traslación es un supuesto. |
| β = 0,591 de COD Pureza | **regresión observacional**, no experimento. Contradice el 0,989 del vault; **ninguno de los dos está zanjado**. |
| β de BeeVenom | **NO medible** (R² = 0,04). El "+$1,17 por peso" asume β = 1 **sin evidencia**. |
| −$6,2M/mes del x3 | **medido en la rama bruta**; la canibalización del x2 está contaminada por el cambio de caja del propio x2 dentro de la ventana. |
| Proyección de 107 órdenes para hoy | **un solo día, parcial**, extrapolado con el perfil horario de 10 días. Señal, no tendencia. |
| `lost_impression_share` 0,09 / 0,61 | **no verificado**: la API rechaza el campo en `campaigns_metrics` y `ads_search`. |
| Visitas por publicación (`/visits/time_window`) | **descartadas**: la serie vuelve desordenada e inconsistente con las órdenes (94 visitas / 155 órdenes el 15/09). No se usó nada de ahí. |
| CPA por producto del panel | **sesgado**: $6,57M de campañas Pureza etiquetadas como producto 1. El TOTAL de `spend_real` cierra exacto ($27.935.372); el reparto no. |

---

## Apéndice — trazabilidad

- COD: `sales_by_product('2026-08-25','2026-09-23')` y `('2026-08-08','2026-08-29')`, por **día de venta**. Nunca `daily_pnl` sin `courier` (incluye `'ml'`), nunca `analisis_pnl`.
- Cohortes y tasas: `orders` ⋈ `shipments` por `dispatched_at`, `status_canonical` de **`shipments`** (backfilleada 010/019/055), no de `shipment_events`.
- ML órdenes: `ml_orders` (`status='paid'`), día ART por `created_at`, publicación por `raw->'order_items'->0->'item'->>'id'`, pack de `ml_orders.pack` (parser `parseMlPack` sobre el TÍTULO — `quantity` es siempre 1).
- ML pauta: `ml_ad_spend_item` × 1,21 + API `marketplace/advertising/MLA/advertisers/932277/product_ads/campaigns/search` (serie diaria 45 días).
- Caja: `GET /items/{id}/price_to_win?version=v2` · comisiones `GET /sites/MLA/listing_prices` · reputación `GET /users/me` — todo API en vivo 24/09/2026.
- Meta: `v_ad_spend` (`spend_real`), `settings.meta_ads_impuestos`.
