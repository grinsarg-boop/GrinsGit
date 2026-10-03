# ML — ¿Cuánto profit sostuvieron las bajadas de precio de catálogo?
**Contrafactual medido · 23/09/2026 · agente profit-dia**

Pregunta: cuánto profit estamos sosteniendo con los cambios de precio del **31/08** (bajada al `price_to_win`) y del **16/09** (lista $36.950 + SMART `P-MLA18023152` → comprador $34.370), contra el profit que habríamos hecho **manteniendo el precio viejo y perdiendo la caja de catálogo**.

---

## 0. Los tres números

| | $ (31/08 → 22/09, 23 días) | por día |
|---|---:|---:|
| **Profit real obtenido** (medido, orden por orden) | **$39.509.543** | $1.717.806 |
| **Profit contrafactual** (precio viejo, sin caja) — central | **$24.201.315** | $1.052.231 |
| **Neto de la decisión** — central | **+$15.308.228 (+63,3%)** | +$665.575 |
| Banda: sin drift de mercado / con drift COD completo | +$19,34M (+95,9%) … +$10,27M (+35,1%) | +$841k … +$447k |

**El cambio se pagó, y por mucho.** El piso de la banda (+$10,3M en 23 días) ya es más que el doble de lo que costó el descuento.

**Pero el neto NO está repartido parejo entre las dos decisiones:**

| decisión | aporte medido | veredicto |
|---|---:|---|
| **31/08 — bajada al `price_to_win`** ($40.131 → $38.573) | **+$15,1M** (central; banda +$10,1M…+$19,1M) | ✅ se pagó, es el 99% del neto |
| **16/09 — lista $36.950 + SMART → $34.370** | **+$0,21M** en 7 días (banda **−$1,51M … +$2,68M**) | ⚠️ **indistinguible de cero.** No se puede afirmar que se pagó |

---

## 1. Por qué el contrafactual está *medido* y no inventado

No hace falta suponer una elasticidad: **el estado contrafactual lo vivimos 21 días seguidos.**

> "Las tres publicaciones de catálogo pasaron de `winning` (29/07) a `competing` con `visit_share: minimum`, **con nuestros precios congelados 21 días**. Nos pasaron por arriba. Recuperadas el 31/08 llevándolas al `price_to_win`… La puja era barata: ML pedía −3,9% y −3,8%, no igualar al rival (que estaba a **$33.105**)."
> — `~/Claude/Obsidian/00-Contexto/Master.md:311`

O sea: del ~10/08 al 30/08 estuvimos **exactamente en el escenario contrafactual** — precio viejo ($40.131), caja perdida contra un tercero, Product Ads encendidos ($215-250K/día). Ese tramo es la ventana base.

**Ancla del tamaño de la caja, medida en la misma publicación y al mismo precio** (`MLA3692036796`, $40.131 todo el tiempo, API de órdenes):

| estado | ventana | órdenes/día |
|---|---|---:|
| `winning` / `maximum` | 05–14/08 | **83,0** |
| `competing` / `minimum` (rival a $33.105) | 15–30/08 | **61,3** |

→ **Perder la caja contra un tercero cuesta −26% de unidades a precio y pauta constantes.** Ése es el número que usa el contrafactual, y es propio.

### Los otros dos episodios (y por qué NO se usan como ancla directa)

- **11–13/09 (la Premium nos tomó la caja):** la Clásica cayó de 102 a 11/13/9 órdenes (−91%) y sus visitas de ~900 a 94-136 (−87%). **No es un ancla válida para "un tercero nos gana":** el gasto de Product Ads de la Clásica se desplomó de $300K a $11K/día y se mudó entero a la Premium (`ml_ad_spend_item`). Cuando el ganador es de la casa, ML mueve la pauta con la caja y el perdedor queda sin tráfico pago. Contra un externo eso **no** pasa (en la base de agosto seguimos gastando $215-250K/día). Lo que sí mide este episodio: **el ganador de la ficha se lleva ~90% del tráfico del catálogo.**
- **15–16/09 (KLOVER):** pérdida **parcial** (solo donde se agotó el cupo de Flex). Clásica 155 → 134 órdenes/día (−13,5% en el día, −33% al corte de las 16h). Se usa como ancla del contrafactual **de la decisión del 16/09**, no de la del 31/08.

---

## 2. Profit real obtenido, por publicación

Metodología canónica ML (idéntica a `recompute_daily_pnl`, filas `courier='ml'`): por **día de venta ART**, orden por orden desde `ml_orders` (`/orders/search` sincronizado), con `sale_fee` real, `tax_withheld` real, `ship_cost` real por orden, COGS de `product_costs` por pack, percepciones y bonificación Flex prorrateadas por revenue del día, y **Product Ads reales por publicación** (`ml_ad_spend_item`, ya deduplicado por `item_id`) **× 1,21 de IVA**. Sin `analisis_pnl`, sin priors, sin proyección: ML paga y entrega, no hay cohorte que madurar.

> Reconciliación: esta agregación por publicación reproduce `daily_pnl` (courier `ml`) con **≤1,5% de desvío** día a día (15–22/09). El resto es ventas ML sin producto mapeado, que el inner join del panel descarta.

### x2 Clásica `MLA3692036796` — el motor (85% del dinero)

| ventana | estado caja | precio efectivo | órdenes | unid. | comisión/orden | flete/orden | COGS/orden | ads/orden | **profit/orden** | **profit/día** |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **base** 15–30/08 | `competing`/`minimum` | $40.417 | 981 (61,3/d) | 988 | $8.227 (20,35%) | $6.689 | $4.532 | $3.816 | **$13.111** | **$803.868** |
| **P1** 31/08–15/09 | `winning`/`maximum` | $38.310 | 1.679 (104,9/d) | 1.708 | $7.738 (20,20%) | $7.021 | $4.578 | $2.720 | **$12.436** | **$1.305.026** |
| **P2** 16–22/09 | `winning` → `sharing` | $35.408 | 1.099 (157,0/d) | 1.122 | $7.146 (20,18%) | $7.095 | $4.594 | $2.800 | **$10.226** | **$1.605.465** |

Lectura: **el precio efectivo bajó 12,4% y el profit por orden 22,0% — pero el volumen subió 156%.** El profit por día se **duplicó** ($803.868 → $1.605.465).

Detalle que importa: **la pauta por orden bajó de $3.816 a $2.800 (−27%)** al recuperar la caja. Parte del descuento se financió sola con CPA: sin caja la pauta gasta más y trae menos (ya observado el 16/09 en el playbook §9).

### x2 Premium `MLA1830076567` y x4 `MLA1908275639`

| publicación | ventana | órdenes/día | precio | comisión | profit/orden | profit/día |
|---|---|---:|---:|---:|---:|---:|
| x2 Premium | base | 0,8 | $49.990 | 23,90% | $20.497 | $16.654 |
| x2 Premium | P1 | 22,4 | $38.102 | 24,19% | $9.844 | $220.878 |
| x2 Premium | P2 | 7,9 | $39.677 | 24,27% | $14.668 | $115.249 |
| x4 | base | 2,6 | $71.652 | 27,16% | $21.462 | $56.337 |
| x4 | P1 | 6,2 | $54.031 | 28,35% | $11.942 | $73.891 |
| x4 | P2 | 14,6 | $53.737 | 15,48% | $18.312 | $266.831 |

El grueso del P1 de la Premium son los 3 días (11–13/09) en que se quedó con la caja de la ficha: es plata de la casa que cambió de bolsillo, por eso el perímetro se mide a nivel **ficha** (Clásica + Premium) y no por publicación suelta.

### Perímetro total (ficha x2 + x4), 31/08 → 22/09

| | P1 (16 d) | P2 (7 d) | **total 23 d** |
|---|---:|---:|---:|
| profit medido | $25.596.725 | $13.912.818 | **$39.509.543** |

*(El x3 de catálogo `MLA2055177767`, alta 01/09, queda fuera: es un alta, no un cambio de precio. Aportó $1,55M en P1 + $0,96M en P2, canibalizando parcialmente al x3 Premium `MLA3030316544`, que cayó de 13,8 a 7,4 órdenes/día. Neto del x3 ≈ +$0,1M/día, no mueve la conclusión.)*

---

## 3. El contrafactual

**Supuesto de volumen (declarado):** sin la bajada del 31/08 seguíamos en el estado medido de la base — **61,3 órdenes/día en la x2 Clásica, 0,8 en la Premium, 2,6 en el x4**, con el profit por orden medido en esa misma ventana (que ya incluye la pauta peor: $3.816/orden). Es evidencia propia, no elasticidad supuesta: es el promedio de 16 días vividos en ese estado exacto.

**profit/día base del perímetro = $876.859.**

**Drift de mercado.** La demanda de Pureza creció en septiembre por motivos ajenos a la caja. Se usan tres supuestos, declarados:

| drift | de dónde sale | contrafactual 23 d | **neto de la decisión** |
|---|---|---:|---:|
| **0%** | el canal ML sin caja no crece; la caja es el único driver | $20.167.763 | **+$19.341.780 (+95,9%)** |
| **+20%** *(central)* | mejora de demanda por peso de pauta: los pedidos COD de Pureza por $1.000 de `spend_real` subieron +15,6% (P1) y +28,1% (P2) | $24.201.315 | **+$15.308.228 (+63,3%)** |
| **+45%** | pedidos COD de Pureza generados/día: 112,1 → 164,2 (+46,5%) y → 161,7 (+44,3%). Traslado completo al canal ML | $29.243.256 | **+$10.266.287 (+35,1%)** |

El drift de +45% es deliberadamente **hostil a la decisión**: asume que ML habría crecido lo mismo que COD sin tocar el precio, cosa que el tramo 15–30/08 contradice (ML estuvo plano mientras COD ya crecía).

**Por qué no se usó una elasticidad-precio:** no la hay. −5,1% de precio (40.417 → 38.310) dio **+71% de unidades**, y otro −7,6% dio **+50% más**. Eso no es una curva de demanda, es **una función escalón**: se gana o se pierde la caja. Modelarlo como elasticidad daría un número sin sentido en los dos sentidos.

---

## 4. La decisión del 16/09 (SMART) por separado: no se puede afirmar que se pagó

Contrafactual: quedarse en lista $37.846 sin aceptar la SMART, con KLOVER en la caja. El único día completo observado en ese estado es el **16/09: 134 órdenes** (y ya contaminado hacia arriba, porque la SMART se aceptó a la tarde). Profit/orden al precio viejo: **$11.752** (medido el 15/09).

| supuesto de volumen sin SMART | de dónde sale | E1 (23 d) | **aporte de la SMART (7 d)** |
|---|---|---:|---:|
| 155 órd/día (no se degradaba) | el 15/09 medido, último día completo pre-KLOVER | $41.022.109 | **−$1.512.566** |
| **134 órd/día** *(central)* | el 16/09 medido, con KLOVER en la caja | $39.294.578 | **+$214.965** |
| 104 órd/día (KLOVER se consolidaba) | −33% del corte de las 16h del 16/09, extendido al día | $36.826.677 | **+$2.682.866** |

**Veredicto: la SMART está dentro del ruido.** Costó ~$1.125/orden (§9 del playbook) y a cambio compró ~23 órdenes/día. Con 157 órdenes/día, $1.125 × 157 = $177K/día de costo contra ~$235K/día de contribución extra: **se paga apenas, y solo si el contrafactual era de verdad 134 y no 155.** No hay evidencia para decidir entre esas dos ramas.

Lo que sí está claro: **la decisión que hizo la plata fue la del 31/08**, cuando ML pedía −3,9% para devolvernos una caja que valía +26% de volumen. Las bajadas de septiembre fueron defender lo ya ganado, a costo creciente.

---

## 5. El escalón de comisión — y la decisión pendiente de bajar a $32.999

Medido hoy contra `GET /sites/MLA/listing_prices` (`MLA8830`, `gold_special`):

| precio | `fixed_fee` | comisión que informa ML | **comisión real nuestra** (con `pcj-co-funded`, +5,00 pp) |
|---:|---:|---:|---:|
| $33.000 | $0 | 15,50% | **20,50%** ($6.765) |
| **$32.999** | **$3.320** | **25,56%** | **30,56%** ($10.085) |

⚠️ **El `fixed_fee` hoy es $3.320, no los $3.005 de §6 del playbook (05/08/2026). Subió 10,5%.**

Estado actual (API en vivo, 23/09): `MLA3692036796` a **$33.231**, `sharing_first_place`, `visit_share: medium`, 1 compartiendo, ganador `MLA3983995152` a **$33.000**, `price_to_win` **$32.999**.

**ML nos está pidiendo bajar $232 para cruzar a la zona muerta:**

- delta precio: **−$232**
- delta comisión: **+$3.272**
- **delta profit por orden: −$3.504** → de $10.226 a **$6.722** (−34,3%)
- **volumen necesario para empatar: +52,1% de unidades**

Recuperar la caja desde `sharing_first_place` (ya compartimos, `visit_share: medium`) no plausiblemente da +52%. El ancla de la propia casa dice que la caja entera vale **+26%** sobre `competing/minimum`, y hoy estamos mejor que eso.

> **Recomendación: NO bajar a $32.999.** Si hay que moverse, **$33.000 clavado** (empatar al ganador, seguir compartiendo) cuesta $231 y ahorra los $3.320. La caja del x3 —que sí está perdida— no se recupera con precio: es `reputation_limit_reached` por el bug de packs (§10 del playbook).

---

## 6. Supuestos

- **Canal ML, sin proyección ni madurez de cohorte:** ML cobra y entrega, `pct_resuelto = 1` por definición en `daily_pnl`. No se aplicó tasa de entrega, prior ni `cohort_k`. El umbral de madurez **≥90% resueltos** (default Claude 12/08/2026, pendiente de canon de Pancho) **no aplica** a este informe porque no hay ninguna cifra COD proyectada adentro.
- **Comisión ML: real por orden**, leída de `ml_orders.sale_fee` (no un % supuesto). Medida: x2 Clásica **20,18–20,35%** (15,50% de ML + 5,00 pp de `pcj-co-funded`); x2 Premium 23,90–24,27%; x4 15,48–28,35%. Curva de comisión y `fixed_fee` **$3.320** leídos hoy 23/09/2026 de `/sites/MLA/listing_prices`.
- **Costo de canal ML medido en el período: 38,8–40,0% de la facturación** (memoria `serum-capilar`, corregido 29/07/2026) — consistente con lo medido acá: comisión + retención + percepción + flete = $17.789 sobre $35.408 = **50,2%** en P2 para la x2, que es más alto porque el precio bajó y el flete es fijo en pesos por tramo.
- **Flete: real por orden** (`ml_orders.ship_cost`), neto de `ml_flex_bonif` prorrateada. No se usó tabla de tramos.
- **Retención (`tax_withheld`) y percepciones (`ml_percepciones`): reales**, las percepciones prorrateadas por revenue del día (misma regla que `recompute_daily_pnl`).
- **COGS:** `product_costs` Pureza — pack 2 = $4.500, pack 3 = $7.000, pack 4 = $10.000 (no estimados).
- **Product Ads: gasto neto de `ml_ad_spend_item` × 1,21** (`settings.ml_ads_iva = 0.21`). La API de Product Ads devuelve gasto NETO y el P&L lo cobra con IVA. Deduplicado por `item_id` en el sync; suma exacta contra `ml_ad_spend` del día (verificado: $12.465.903 = $12.465.903 en los últimos 30 días).
- **Pauta Meta:** solo entra como **control de drift** (pedidos COD de Pureza por peso gastado), leída de **`v_ad_spend.spend_real`**, que aplica el impuesto por tramos de `settings.meta_ads_impuestos` (migración 093, 19/09/2026): R3 `act_1569698667101520` 36,4% del 07/08 al 15/09/2026 y ~10% desde el 16/09/2026 (estimación de Pancho, no lectura de extracto); R2 sin impuesto. **No se grosseó a mano: el ×1,364 plano quedó obsoleto (Pancho, 23/09/2026).**
- **Ventana base = 15–30/08/2026** (16 días), elegida como contrafactual observado: `competing`/`minimum` con precio congelado en $40.131 y rival externo a $33.105 (`Master.md:311`). Se descartaron el 10–14/08 por ser el tramo de transición.
- **Drift de mercado: banda 0% / +20% / +45%**, medido el 23/09/2026 contra `sales_rows` (COD Pureza generadas) y `v_ad_spend` (spend_real Pureza). Es **el supuesto más blando del informe** y el que abre toda la banda.
- **23/09/2026 excluido del cómputo:** el sync de `ml_orders` corta a las 15:45 ART (`max(synced_at) = 18:45 UTC`) y `ml_ad_spend_item` del día está incompleto. Parcial hasta ese corte: x2 Clásica 81 órdenes, $735.220 de profit.
- **Lo que quedó estimado:** (a) el volumen contrafactual, anclado en 16 días observados del mismo estado pero sin control aleatorizado; (b) el drift de mercado; (c) el contrafactual de la SMART del 16/09, que descansa en **un solo día** (16/09) y por eso su banda cruza el cero.
- **Lo que NO se pudo medir:** no existe serie histórica de `price_to_win` / `visit_share` (`ml_caja_snapshots` está especificada en §5(b) del playbook pero **no existe en la base**). Las fechas de pérdida y recuperación de caja se dataron por proxy (órdenes, visitas de `/items/{id}/visits/time_window`, gasto de `ml_ad_spend_item`) y por lo escrito en el vault. Con esa tabla viva este informe sería una consulta, no una reconstrucción.

---

## Apéndice — trazabilidad

- Órdenes: `ml_orders` (status `paid`), día ART por `created_at`, publicación por `raw->'order_items'->0->'item'->>'id'`.
- Pauta por publicación: `ml_ad_spend_item` × 1,21.
- Visitas por publicación: `GET /items/{id}/visits/time_window?last=60&unit=day` (API en vivo, 23/09/2026).
- Caja: `GET /items/MLA3692036796/price_to_win?version=v2` (API en vivo, 23/09/2026).
- Comisiones simuladas: `GET /sites/MLA/listing_prices?price=X&category_id=MLA8830&listing_type_id=gold_special`.
- Control COD: `sales_rows('2026-08-01')`, producto 2 (Pureza), couriers `urbano`/`fixy`/`correo`.
- Pauta Meta: `v_ad_spend.spend_real`, `product_id = 2`.
