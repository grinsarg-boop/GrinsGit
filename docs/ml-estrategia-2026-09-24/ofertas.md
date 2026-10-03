# ML — Ofertas y Promociones: qué tomar, qué rechazar, cuánto vale cada una
**24/09/2026 · agente analista-ml · TODO POR API AUTENTICADA · SOLO LECTURA (nada ejecutado)**
Último dato leído: **24/09/2026 18:02 UTC (15:02 ART)**. Ventana de costos: 7 días cerrados 17–23/09.

---

## 0. Lo que cambió MIENTRAS corría este análisis (leer primero)

A las 17:55 UTC la Premium `MLA1830076567` estaba `sharing_first_place` a $33.869.
A las **18:02 UTC** está **`winning` / `visit_share: maximum` / `competitors_sharing_first_place: 0` a $33.396**.

Apareció una promo nueva en el ítem: **`PRICE_DISCOUNT` `status: started`, precio $33.396, 24/09/2026 → 24/10/2026**.
La SMART `P-MLA18023152` sigue `started` a $33.869. **Las dos conviven y manda la más barata.**

→ **La caja ya está recuperada.** Todo lo que sigue se juzga contra ese estado, no contra el de la mañana.

Estado de la ficha `MLA70304457` a las 18:02 UTC (`GET /products/MLA70304457/items`):

| ítem | precio | vendedor | quién |
|---|---:|---|---|
| MLA2025169081 | $22.000 | 2442043812 | rival, **sin** envío gratis (no compite por la caja) |
| MLA3983995152 | $33.000 | 482840666 | **el rival que nos ganaba** |
| MLA3692036796 | $33.231 | nosotros | x2 Clásica — `competing` / `minimum` |
| **MLA1830076567** | **$33.396** | **nosotros** | **x2 Premium — `winning` / `maximum`** |
| MLA2025169503 | $34.920 | 709740765 | rival |
| MLA3877391038 | $35.517 | 2953648686 | rival |
| MLA2025143219 | $42.000 | 303319930 | rival |

**Ganamos la caja estando $396 MÁS CAROS que el rival.** Eso no es un error de ML: es el boost `free_installments`. Ver §4.

---

## 1. La estructura de comisión, medida (y por qué la API miente a medias)

`GET /sites/MLA/listing_prices?price=P&category_id=MLA8830&listing_type_id=LT` devuelve:

```
gold_special  →  meli_percentage_fee 15,5  +  financing_add_on_fee 0,0   =  percentage_fee 15,5 %
gold_pro      →  meli_percentage_fee 15,5  +  financing_add_on_fee 13,4  =  percentage_fee 28,9 %
fixed_fee     →  0 si precio ≥ $33.000  ·  $3.320 si precio ≤ $32.999  (idéntico en ambos listing types)
```

**El escalón está confirmado al peso** (barrido fino, 24/09): $33.001 → fixed 0 · $33.000 → fixed 0 · **$32.999 → fixed $3.320**. Hay otro escalón más abajo ($2.740 entre $18.000 y $32.999… en realidad $2.740 aplica ≤$18.000; $1.330 ≤$12.000).

### Pero la tasa real NUESTRA no es la de la API. Mapa medido en `ml_orders` (25 días, n=1.787 órdenes)

| ítem | listing | tag `INSTALLMENTS_CAMPAIGN` | % API | **% REAL medido** | delta | n |
|---|---|---|---:|---:|---:|---:|
| **MLA3692036796** (x2 Clásica) | gold_special | `pcj-co-funded` | 15,5 | **20,50** | **+5,00** | 1.059 |
| MLA1908275639 (x4 Clásica) | gold_special | `pcj-co-funded` | 15,5 | **15,50** | **0,00** | 94 |
| MLA1908275639 (x4 Premium) | gold_pro | `pcj-co-funded` | 28,9 | **28,90** | 0,00 | 86 |
| MLA3030521696 | gold_pro | — (ninguno) | 28,9 | **28,90** | 0,00 | 67 |
| **MLA1830076567** (x2 Premium) | gold_pro | **`3x_campaign`** | 28,9 | **24,40** | **−4,50** | 207 |
| MLA2055177767 (x3 catálogo) | gold_pro | `3x_campaign` | 28,9 | **24,40** | −4,50 | 207 |
| MLA3030316544, MLA1796574071, MLA1796638415, MLA3030366476, MLA3030316354 | gold_pro | `3x_campaign` | 28,9 | **24,40** | −4,50 | 167 |

**Tres hechos medidos, no estimados:**

1. **`3x_campaign` es un DESCUENTO de 4,50 pp**, consistente en 7 publicaciones y 2 categorías (MLA8830 y MLA3551). ML cofinancia las cuotas. Encima **da el boost `free_installments`**. Es gratis y mejor: es plata a favor.
2. **`pcj-co-funded` cuesta +5,00 pp en la x2 Clásica y $0,00 en la x4 Clásica, con el MISMO tag.** El sobrecosto es específico de `MLA3692036796`, no del programa. Son **$1.661,55/orden brutos = $1.373/orden netos de IVA**. A ~150 órdenes/día eso es **≈$206.000/día**.
3. **Y ese +5,00 pp NO compra el boost**: `price_to_win` de la Clásica devuelve `free_installments: opportunity` (no `boosted`). Pagamos cuotas y no las cobramos en ranking.

> ⚠️ Candado respetado: `pcj-co-funded` de `MLA3692036796` **no se toca ni se clona sin cuotas** (decisión de Pancho, 05/08/2026). Esto **no es una instrucción**, es una pregunta con el número puesto. La comparación contra la x4 (mismo tag, 0,00 pp) sugiere que la diferencia puede ser de *configuración*, no de "sacar las cuotas".

### Corroboración del escalón en órdenes reales (no solo en `listing_prices`)

| ítem | precio | fecha | fee real | fee esperado al % del ítem | **residuo = fixed_fee** |
|---|---:|---|---:|---:|---:|
| MLA3030676394 (gold_pro, MLA392701) | $32.871,27 | 02, 03, 11 y 18/09 | $11.216,23 | 23,90 % → $7.856,23 | **$3.360,00** |
| genérico gold_pro | $32.995,06 | 01–26/07 | $10.810,82 | 23,90 % → $7.885,82 | **$2.925,00** |
| genérico gold_pro | $30.990,00 | 30/07–04/08 | $10.331,61 | 23,90 % → $7.406,61 | **$2.925,00** |

El cargo es **aditivo y redondo**, y **subió de $2.925 (jul-ago) a $3.320–3.360 (sep)**. El umbral es nominal y se indexa: **el número de hoy es $3.320, citado al 24/09/2026; hay que releerlo antes de cada decisión.**

### ⚠️ La única anomalía, declarada: n=1 en contra

`MLA3692036796`, 06/09/2026, `unit_price` $32.971,44 (= $28,56 por debajo del umbral de hoy) → `sale_fee` $6.759,14 = **20,50 % exacto, SIN fixed fee**. No lo puedo explicar. Hipótesis: el umbral en esa fecha era menor a $32.971 y subió a $33.000 después. **No la uso a favor.** Todo este informe asume el caso conservador: **abajo de $33.000 se paga $3.320 (= $2.743,82 netos de IVA).**

---

## 2. El modelo de profit/orden (calibrado, no inventado)

```
profit(P) = P/1,21  −  comisión(P)/1,21  −  flete/1,21  −  COGS  −  t·P  −  ads
comisión(P) = tasa·P + 3.320·[P < 33.000]      tasa: 0,2050 Clásica · 0,2440 Premium
flete  = $7.148,56 brutos   (medido, ml_orders, Pureza pack 2, 7 días cerrados)
COGS   = $4.500             (product_costs Pureza pack 2, is_estimated = false)
t      = 1,676 %            ($581,75 tax_withheld medio / $34.710,91 precio medio, 7d)
ads    = $2.334/orden Clásica (calibración) · ~$0 Premium (medido: $2.884 en 7 días)
```

**Verificación:** `profit(33.231) = $8.535` → reproduce **exactamente** el ancla de Pancho. El modelo es el del P&L: todo neto de IVA (revenue, comisión y flete /1,21).

**Derivada — lo que vale cada peso de precio:**
- Clásica: **$0,6403 de profit por $1 de precio**
- Premium: **$0,6080 de profit por $1 de precio**

**El escalón vale $2.743,82 netos.** Cruzar $33.000 equivale a bajar el precio **$4.285 de golpe** en la Clásica ($4.513 en la Premium). Ese es el número que gobierna todo lo que sigue.

---

## 3. Pregunta 1 — Veredicto promo por promo

Convención crítica (**medida hoy**): el `price` que devuelve la API de promociones es lo que paga el **COMPRADOR**. La base sobre la que ML cobra la comisión es el **precio del VENDEDOR** = `original_price × (1 − seller_percentage/100)`. Verificado al peso: orden de hoy de la Premium, `unit_price` $33.971,39 × 24,40 % = **$8.289,02 = `sale_fee` exacto**, mientras el comprador pagaba $33.869. **`meli_percentage` es plata de ML que no pasa por la orden.**

→ Consecuencia enorme: **en una SMART con `meli_percentage` > 0, el comprador puede ver un precio por debajo de $33.000 mientras la base de comisión queda arriba.** (Ver §3.3: esa es la jugada del 10.10.)

### 3.1 x2 Clásica `MLA3692036796` — lista $33.231 · gold_special 20,50 % · base $8.535/orden

| promo (id) | comprador | base comisión | ¿escalón? | **profit/orden** | Δ vs hoy | **volumen ×** | veredicto |
|---|---:|---:|:--:|---:|---:|---:|---|
| **hoy, sin promo** | 33.231 | 33.231 | no | **$8.535** | — | 1,000 | — |
| SMART `P-MLA18023152` "Potencia tus ventas" (meli 1,31 / seller 3,69) | 31.569 | 32.005 | **SÍ** | $5.006 | −$3.529 | **×1,705** | ❌ **NO TOMAR** |
| SMART `P-MLA18041082` "Compartidas Envíos gratis" (meli 1,8 / seller 3,2) | 31.569 | 32.168 | **SÍ** | $5.110 | −$3.425 | **×1,670** | ❌ **NO TOMAR** |
| SMART `P-MLA18091086` "Ofertas compartidas 10.10" (meli 1,8 / seller 3,2) | 31.569 | 32.168 | **SÍ** | $5.110 | −$3.425 | **×1,670** | ❌ **NO TOMAR así** (sí con §3.3) |
| LIGHTNING `LGH-MLA1000` (relámpago, stock 5–565) | 31.569 | 31.569 | **SÍ** | $4.727 | −$3.808 | ×1,805 | ❌ **NO TOMAR** |
| PRICE_DISCOUNT sugerido (= su máximo) | 31.569 | 31.569 | **SÍ** | $4.727 | −$3.808 | ×1,805 | ❌ **NO TOMAR** |
| DEAL `P-MLA18027168` "CAMPAÑA MELI +" al máximo permitido | 32.234 | 32.234 | **SÍ** | $5.153 | −$3.382 | ×1,656 | ❌ **NO TOMAR** |
| DEAL "CAMPAÑA MELI +" al precio sugerido por ML | 28.911 | 28.911 | **SÍ** | $3.025 | −$5.510 | ×2,821 | ❌ **NO TOMAR** |
| CUPÓN `C-MLA1582450` "Oferta10" (−10 %, tope $5.000) | 29.908 | 29.908 | **SÍ** | $3.663 | −$4.871 | ×2,330 | ❌ **NO TOMAR** |
| bajar a `price_to_win` $32.547 por edición directa de precio | 32.547 | 32.547 | **SÍ** | $5.353 | −$3.182 | ×1,594 | ❌ **NO** (ver abajo) |
| **subir lista a $34.091 y TOMAR la SMART 10.10** | **32.386** | **33.000** | **no** | **$8.387** | **−$148** | **×1,018** | ✅ **LA JUGADA** |

**Por qué ninguna promo de la Clásica se salva.** La lista es $33.231 y está **$231 (0,70 %) arriba del escalón**. ML exige mínimo 5 % de descuento para cualquier promo (`max_discounted_price` del PRICE_DISCOUNT = $31.569,45 = exactamente −5,0 %). **Cualquier promo posible en esta publicación cruza el escalón por construcción.** No es que las ofertas sean malas: es que la lista está mal colocada respecto del umbral.

**El ancla de volumen.** Recuperar la caja vale **+35 %** de unidades (medido en esta misma publicación: 61,3 → 83,0 órd/día a precio y pauta constantes, `ml-contrafactual-precio-caja-2026-09-23.md`). Ninguna de las promos de arriba se paga con +35 %: la más barata necesita **+59,4 %** y la SMART necesita **+67 %**. **La caja no se compra desde la Clásica.**

*(Matiz honesto y a favor de las promos: al ganar la caja la pauta por orden cayó 27 % — $3.816 → $2.800 — el 31/08. Si eso se repitiera, el break-even de la SMART bajaría de ×1,670 a ≈×1,55. Sigue siendo el doble del +35 % medido. No cambia ningún veredicto.)*

### 3.2 x2 Premium `MLA1830076567` — lista $39.677 · gold_pro 24,40 % · base HOY $33.396 → $9.898/orden

| promo (id) | comprador | base comisión | ¿escalón? | **profit/orden** | Δ vs hoy | **volumen ×** | veredicto |
|---|---:|---:|:--:|---:|---:|---:|---|
| **hoy: PRICE_DISCOUNT `started` $33.396 (24/09→24/10)** | 33.396 | 33.396 | no | **$9.898** | — | 1,000 | ✅ **MANTENER — ya gana la caja** |
| SMART `P-MLA18023152` `started` $33.869 (meli 0,3 / seller 14,4) | 33.869 | 33.964 | no | $10.243 | **+$345** | ×0,966 | ⚠️ dejarla `started` debajo (ver §3.4) |
| SMART `P-MLA18041082` "Compartidas Envíos gratis" (meli 1,314 / seller 16,686) | **32.394** | **33.057** | **no** | $9.692 | −$206 | ×1,021 | 🟡 **NO HOY — es el plan B** |
| DEAL "CAMPAÑA MELI +" al máximo permitido | 32.394 | 32.394 | **SÍ** | $6.545 | −$3.353 | ×1,512 | ❌ **NO TOMAR** |
| DEAL "CAMPAÑA MELI +" al sugerido | 28.426 | 28.426 | **SÍ** | $4.133 | −$5.765 | ×2,395 | ❌ **NO TOMAR** |
| CUPÓN "Oferta10" (−10 %) | 30.056 | 30.056 | **SÍ** | $5.124 | −$4.774 | ×1,932 | ❌ **NO TOMAR** |

**La joya escondida: `P-MLA18041082` "Compartidas Envíos gratis".** Es la única promo del set que **pone al comprador abajo de $33.000 sin cruzar el escalón**: ML pone 1,314 pp, nosotros 16,686 pp, y la base de comisión queda en **$33.056,60 — $56,60 arriba del umbral**. Comprador $32.394 (= **$606 por debajo del rival**) por **$206/orden**.

**Hoy no se toma** porque ya ganamos la caja a $33.396 y sería pagar por algo que ya tenemos. **Es el plan B**: si el rival `MLA3983995152` baja de ~$32.700 y nos saca la caja, ésta es la respuesta correcta — y hay que tomarla **antes del 05/10**, que es cuando la campaña termina.

> ⚠️ **Trampa medida en vivo:** el precio candidato de esta SMART **se mueve solo y hacia abajo**. A las 17:55 UTC era comprador $32.952 / seller 16,065 %; a las 18:02 UTC, después de que el PRICE_DISCOUNT bajara el precio a $33.396, pasó a comprador $32.394 / seller **16,686 %**. **ML recalcula la oferta contra tu precio vigente.** El número que leas hoy no es el que vas a aceptar mañana: **hay que releer `GET /seller-promotions/items/{id}?app_version=v2` en el momento exacto de aceptar.**

### 3.3 LA JUGADA — subir la lista de la Clásica a $34.091 y recién ahí tomar la SMART 10.10

El problema de la Clásica es que la lista está **0,70 % arriba** del escalón y ML pide **5 %** de descuento. Se resuelve moviendo la lista, no la promo.

```
lista objetivo = $33.000 / (1 − 0,032) = $34.090,91  →  $34.091
   base de comisión con la SMART 10.10 (seller 3,2 %) = $33.000   →  SIN escalón
   precio al comprador                = $34.091 × 0,95 = $32.386   →  $614 por debajo del rival
```

| | profit/orden | comprador | base comisión |
|---|---:|---:|---:|
| SMART 10.10 con la lista de hoy ($33.231) | $5.110 | $31.569 | $32.168 ❌ |
| **SMART 10.10 con lista $34.091** | **$8.387** | **$32.386** | **$33.000** ✅ |
| **diferencia por orden** | **+$3.276** | | |

**Subir la lista antes de aceptar vale $3.276 por orden.** A 150 órd/día en los 14 días del 10.10 (05→19/10) eso es **≈$6,9 M**.

**Riesgos declarados, sin maquillar:**
- `no-tocar-lo-que-ya-funciona`: `MLA3692036796` es el 85 % del dinero del canal. Esto **no es una mejora teórica**: es mover la lista +2,59 % para no comerse $2.744/orden de cargo fijo.
- **Entre que se sube la lista y arranca la SMART (05/10) la Clásica queda $860 más cara** y hoy vende ~150 órd/día sin promo. Costo del hueco: **+$551/orden de profit** (a $34.091 la Clásica rinde $9.086) contra la conversión que se pierda. Con la caja ya en manos de la Premium, la Clásica vende por pauta y por su propio listing, no por la caja.
- **`seller_percentage` puede cambiar cuando cambie la lista** (ML recalcula, como pasó hoy con la Premium). **Hay que releer la promo DESPUÉS de subir la lista y ANTES de aceptar**, y confirmar que la base de comisión da ≥ $33.000. Si `seller_percentage` sube a 3,69 %, la lista tiene que ser $34.264.
- `POST/PUT /items` **sí** funciona por API, pero **este agente no escribe**. Es instrucción para el panel.

### 3.4 x3 catálogo `MLA2055177767`

`GET /seller-promotions/items/MLA2055177767?app_version=v2` → **`[]`**. Cero promociones disponibles.
`price_to_win` → `status: listed`, `reason: ["reputation_limit_reached"]`, `visit_share: minimum`, ganador ajeno `MLA3944865964` a $47.108 (nosotros a $42.290, **más baratos y no competimos**).

**No hay nada que decidir acá y no es un problema de precio.** `reputation_limit_reached` **no está expuesto en la API con su motivo** — se lee en el panel. Hasta que se levante, bajar el precio del x3 es regalar margen sin comprar nada. **VEREDICTO: no tocar precio. Pancho mira el motivo en el panel.**

---

## 4. Pregunta 2 — Qué son "CAMPAÑA MELI +" y "Ofertas compartidas 10.10"

`GET /seller-promotions/users/262382468?app_version=v2` → **9 campañas vivas** (24/09 18:02 UTC):

| id | tipo | estado | ventana | nombre | cofinancia ML |
|---|---|---|---|---|---|
| `LGH-MLA1000` | LIGHTNING | started | — | Oferta relámpago | **0** |
| `P-MLA18023152` | SMART | started | 06/09 → **01/10 02:50 UTC** | Potencia tus ventas | sí, variable |
| `C-MLA1582450` | SELLER_COUPON_CAMPAIGN | started | 11/09 → 11/10 | Oferta10 (−10 %) | **0 (la paga el vendedor)** |
| `P-MLA18027168` | DEAL | started | 14/09 → **05/10** | **CAMPAÑA MELI +** | **0** |
| `P-MLA18041082` | SMART | started | 14/09 → 05/10 | Compartidas Envíos gratis | sí, variable |
| `P-MLA18015134` | DEAL | started | 18/09 → 11/12 | MK T3 AO BELLEZA Q4 2026 | 0 |
| `P-MLA17979010` | DEAL | started | 21/09 → 28/09 | GLAM DAYS SEPTIEMBRE 2026 | 0 |
| `P-MLA18091144` | SMART | **pending** | 01/10 → 19/10 | Potencia tus ventas (sucesora) | sí |
| `P-MLA18091086` | SMART | **pending** | **05/10 → 19/10** | **Ofertas compartidas 10.10** | sí |

### "CAMPAÑA MELI +" (`P-MLA18027168`) — DEAL, 14/09 → 05/10

**Qué es:** una campaña de ofertas de ML donde **el descuento lo pone entero el vendedor**. El payload lo dice sin ambigüedad: trae `min_discounted_price` / `max_discounted_price` / `suggested_discounted_price` y **no trae `meli_percentage` ni `seller_percentage`**. Las SMART sí traen esos dos campos. **Cofinanciación de ML: $0,00.**

**Qué exposición compra:** un badge de campaña y entrada a las landings/filtros de "MELI +" dentro del sitio. La API **no expone ni tráfico prometido ni impresiones garantizadas** — no hay forma de auditar ese lado desde acá, así que **no lo puedo cuantificar y no lo estimo**.

**El precio que ML sugiere:** $28.984,55 en la Premium y $28.910,97 en la Clásica. Eso es **−27 % y −13 %**. A esos precios el profit/orden cae a **$4.133** y **$3.025**: haría falta **×2,40 y ×2,82 de volumen**. El máximo permitido tampoco alcanza (×1,51 y ×1,66).

**VEREDICTO: ❌ RECHAZAR en las dos publicaciones.** ML cofinancia cero, ambos topes caen abajo del escalón, y el volumen que necesita es 4 a 8 veces el +35 % que vale la caja.
*(Nota: `MLA3064229842` y otros 4 ítems ya están `started` dentro de esta campaña. Fuera del alcance de este informe, pero merecen la misma cuenta.)*

### "Ofertas compartidas 10.10" (`P-MLA18091086`) — SMART, 05/10 → 19/10

**Qué es:** una SMART "compartida" — ML pone una parte del descuento. En la x2 Clásica: **`meli_percentage` 1,8 / `seller_percentage` 3,2** sobre 5,0 % total. **ML cofinancia el 36 % del descuento = 1,8 % × $33.231 = $598,16 por orden.** Es la mejor relación cofinanciación/descuento de todo el set.

**Qué compra:** el evento 10.10 de ML (Día del Descuento, 10 de octubre) — badge de oferta, tachado de precio y posicionamiento en las landings del evento. **La API no expone tráfico garantizado.**

**Es la sucesora exacta de "Compartidas Envíos gratis"**: esa termina el 05/10 y el 10.10 arranca el 05/10. No es una campaña extra, es la continuidad.

**Ojo: la Premium NO está en la lista del 10.10.** `GET /seller-promotions/promotions/P-MLA18091086/items` → 12 ítems, `MLA1830076567` **no** figura (`MLA3030316354` sí, como `candidate` a $32.394,12). La sucesora `P-MLA18091144` tiene **un solo ítem** (`MLA1796638415`) y tampoco incluye la x2 Premium.

**Qué implica comprometerse ahora.** El estado del ítem es `candidate` dentro de una campaña `pending`: aceptar hoy **fija el precio para toda la ventana 05→19/10, 14 días**. Tres consecuencias:
1. **No se puede subir el precio dentro de la campaña** (la SMART no tiene rango: ver §5). Si el mercado sube en octubre, quedamos clavados 14 días.
2. **El precio candidato se recalcula contra tu lista vigente** — comprobado hoy en vivo. Aceptar hoy a $31.569 cuando la lista es $33.231 es distinto de aceptar el 04/10 con la lista en $34.091.
3. **Por eso la secuencia correcta es: subir la lista PRIMERO, releer la promo, y recién ahí aceptar.** Si se acepta hoy, se congela el peor de los dos escenarios (−$3.276/orden).

**VEREDICTO: 🟡 TOMAR, pero NO HOY y NO ASÍ.** Subir la lista de la Clásica a $34.091 (o al número que dé la relectura), verificar que la base de comisión quede ≥ $33.000, y aceptar entre el **01 y el 04/10**.

### Cupón "Oferta10" (`C-MLA1582450`) — dato que no estaba en el pedido

`status: started` · −10 % fijo · `min_purchase_amount` $30.000 · `max_purchase_amount` $5.000 (tope de descuento) · 1 canje por usuario · **`budget` $30.000.000 · `remaining_budget` $29.713.276 · `used_coupons` 70**.

**Ya se consumieron $286.724** (≈$4.096 por canje, cerca del tope de $5.000). Los 24 ítems del listado figuran todos como `candidate`, así que **no es obvio de dónde salen esos 70 canjes**. Dos lecturas posibles y no puedo distinguirlas por API: o hay ítems adheridos fuera de la lista que leí, o el presupuesto es de ML. **Pancho: vale la pena mirarlo en el panel** — si el presupuesto es nuestro, hay $286.724 gastados sin dueño identificado.

**VEREDICTO del cupón sobre x2: ❌ RECHAZAR.** −10 % lleva al comprador a $29.908 (Clásica) / $30.056 (Premium): escalón + descuento, profit $3.663 y $5.124, hace falta ×2,33 y ×1,93.

---

## 5. Pregunta 3 — ¿Se puede cambiar el precio de una SMART ya `started`? **NO. Y la trampa es otra.**

### La respuesta corta

**Una SMART no tiene precio elegible.** Es la diferencia estructural que se ve en el payload de `GET /seller-promotions/items/{id}?app_version=v2`:

```
SMART           → { price, meli_percentage, seller_percentage }        ← UN precio, dictado por ML
DEAL            → { min_discounted_price, max_discounted_price, suggested_discounted_price }
LIGHTNING       → { min_..., max_..., suggested_..., stock:{min,max} }
PRICE_DISCOUNT  → { min_discounted_price, max_discounted_price, suggested_discounted_price }
```

**SMART es la única que NO trae rango.** ML calcula el precio y vos aceptás o no. No hay "modificarla a $33.396": ese precio no existe dentro de `P-MLA18023152`. Lo único que existe es $33.869.

### Lo que sí se hizo hoy, y funciona (observado en vivo, no teoría)

**Se apiló un `PRICE_DISCOUNT` por debajo, dejando la SMART `started`.** Estado a las 18:02 UTC de `MLA1830076567`:

```
P-MLA18023152  SMART           started   $33.869
(sin id)       PRICE_DISCOUNT  started   $33.396   24/09/2026 → 24/10/2026
GET /items/MLA1830076567/price_to_win  →  current_price 33.396 · status "winning" · visit_share "maximum"
```

**Manda la más barata, la SMART no hay que darla de baja, y el boost `3x_campaign` sobrevive** (`free_installments: boosted` sigue ahí). Es la vía correcta y ya está ejecutada.

Endpoints (documentados; **este agente no escribe** — todo PUT de este dominio se hace en el panel):
```
alta/modificación   POST /seller-promotions/items/{item_id}?app_version=v2
                    { "promotion_id":"...", "promotion_type":"PRICE_DISCOUNT",
                      "deal_price": 33396, "offer_id": "<ref_id>" }
baja                DELETE /seller-promotions/items/{item_id}
                           ?promotion_id=...&promotion_type=...&app_version=v2
lectura (la que usé) GET  /seller-promotions/items/{item_id}?app_version=v2
```
Para SMART el body **no lleva precio**: lleva el `ref_id` de la oferta (`OFFER-MLA1830076567-11526795150` para la activa, `CANDIDATE-MLA1830076567-71633784299` para la candidata). No verificado por escritura: **no ejecutamos**.

### Las cuatro trampas de la vía elegida (esto es lo que pediste saber antes)

1. 🔴 **El PRICE_DISCOUNT vence el 24/10/2026 y el precio vuelve a $39.677 ese día.** No hay aviso. Perdemos la caja en el acto, exactamente como el 15–30/08. **Agendar el 22/10.**
2. 🔴 **La SMART `P-MLA18023152` vence antes: 01/10/2026 02:50 UTC (6 días).** Su sucesora `P-MLA18091144` (01→19/10) tiene **un solo ítem adherido y no es el nuestro**. Cuando la SMART caiga, el único piso de precio es el PRICE_DISCOUNT — que sí cubre el hueco. **Pero se pierde la cofinanciación de ML.**
3. 🟡 **La cofinanciación de ML probablemente ya se perdió.** La SMART aporta `meli_percentage` 0,3 % = **$119,03/orden**. Con el PRICE_DISCOUNT mandando, lo más probable es que ML no pague su parte (su parte aplica a *su* precio, $33.869, no al nuestro). **No lo puedo verificar por API: se ve en la liquidación.** A ~35 órd/día son ~$4.166/día. Es chico, pero es real.
4. 🟡 **`available_downgrades` de `MLA1830076567` = `200 []`** (releído hoy, 24/09/2026 — confirma la memoria `ml-guerra-catalogo` del 30/07). La Premium está clavada en 24,40 % para siempre. Es el motivo por el que §6 importa.

**Sin trampa en lo que importa:** $33.396 está **$396 arriba de $33.000**, así que el PRICE_DISCOUNT **no cruza el escalón**. La decisión ejecutada es correcta.

---

## 6. Pregunta 4 — La palanca que NO es precio: `free_installments`

### Está medida hoy, dos veces, en la misma ficha

| hora (UTC) | nuestro ítem | nuestro precio | rival | `free_installments` nuestro / rival | resultado |
|---|---|---:|---:|---|---|
| 17:55 | MLA1830076567 (Premium) | $33.869 | $33.000 | **boosted** / opportunity | `sharing_first_place`, 1 compartiendo |
| 18:02 | MLA1830076567 (Premium) | $33.396 | $33.000 | **boosted** / opportunity | **`winning` / `maximum`, 0 compartiendo** |
| 18:02 | MLA3692036796 (Clásica) | $33.231 | $33.000 | **opportunity** / opportunity | `competing` / **`minimum`** |

**La atribución es limpia:** los otros cuatro boosts (`free_shipping`, `shipping_collect`, `same_day_shipping`) están `boosted` en nosotros **y en el rival**, y `fulfillment` está `opportunity` en los dos. **La única diferencia es `free_installments`.**

**Cuánto vale, medido:** ganamos la caja **estando 1,20 % más caros** ($33.396 vs $33.000) y **compartíamos primer lugar estando 2,63 % más caros** ($33.869). El boost vale entre **+$396 y +$869 de precio** por orden en esta ficha, al 24/09/2026. Y la Clásica, a $33.231 — **más barata que la Premium ganadora** — está en `minimum` porque no lo tiene.

### Cuánto cuesta entrar: el número que cambia la conversación

| | tag | % comisión | boost | sobre la base 15,5 % |
|---|---|---:|---|---:|
| x2 Clásica hoy | `pcj-co-funded` | **20,50 %** | ❌ `opportunity` | **+5,00 pp** |
| x4 Clásica | `pcj-co-funded` | 15,50 % | — | 0,00 pp |
| x2 Premium | **`3x_campaign`** | 24,40 % | ✅ **`boosted`** | +8,90 pp (**−4,50 pp** vs el 28,90 % de su tipo) |

**Ya estamos pagando por cuotas en la Clásica y no nos dan el boost: $1.661,55/orden brutos = $1.373/orden netos, ≈$206.000/día a 150 órdenes.**

### Cuánto vale el boost en la Clásica, con número

Si la Clásica tuviera `free_installments: boosted`, podría ganar la caja a **$33.396** (el mismo precio con el que gana la Premium hoy) en vez de tener que bajar a **$32.547** y comerse el escalón:

| configuración | profit/orden | comentario |
|---|---:|---|
| Clásica gana la caja a $33.396 **con boost** (pauta $2.334) | **$8.640** | hipotético: requiere el boost |
| Premium gana la caja a $33.396 (pauta $2.334, cuando la pauta se le mude) | **$7.564** | el estado al que vamos |
| Clásica gana la caja a $32.547 **sin boost** (edición directa) | $5.353 | escalón |

**Diferencia Clásica-con-boost vs Premium: $1.076/orden.** A 150–200 órdenes/día: **$161.000 a $215.000/día**.

De dónde sale: la Clásica paga 20,50 % y la Premium 24,40 %. **3,90 pp de diferencia = $1.302/orden brutos.** La caja la gana la publicación equivocada — la cara.

### Qué NO recomiendo, y por qué

- **No recomiendo tocar `pcj-co-funded`.** Candado de Pancho del 05/08/2026: no se toca ni se clona sin cuotas. Lo que sí hago es **poner el número y la contradicción**: la x4 tiene el mismo tag a 0,00 pp; la x2 paga 5,00 pp y no recibe boost. **Eso huele a configuración, no a "sacar las cuotas".** Pregunta para el panel, no instrucción.
- **No recomiendo subir la Clásica a Premium.** `available_upgrades` de `MLA3692036796` = `[gold_pro, gold_premium]` — **se puede**, y daría el boost. Pero `available_downgrades` = `[]` es **puerta de una sola dirección**, y la cuenta es mala: 20,50 % → 24,40 % = **−$1.302/orden brutos** en el ítem que mueve el 85 % del dinero, irreversible. **NO.**

---

## 7. Pregunta 5 — Cuotas, envío gratis y Full: qué está activo y qué cuesta

| palanca | x2 Clásica `MLA3692036796` | x2 Premium `MLA1830076567` | costo medido | veredicto |
|---|---|---|---|---|
| **Cuotas sin interés** | `pcj-co-funded`, **+5,00 pp** = $1.373/orden netos, **boost NO** | `3x_campaign`, **−4,50 pp** = $1.230/orden netos **a favor**, **boost SÍ** | medido en `ml_orders`, n=1.266 | Premium ✅ · Clásica ⚠️ **preguntar** |
| **Envío gratis** | `boosted` · `mandatory_free_shipping` · `self_service_in` | idéntico | **$7.148,56/orden brutos** (medido 7d) = $5.908 netos = **21,5 % del precio**. `shipping_options`: `base_cost` $6.990, `list_cost` $6.291 (ML ya descuenta $699), `cost` 0 al comprador | **no es palanca**: es obligatorio arriba del umbral de catálogo. Nada que decidir |
| **Full (`fulfillment`)** | `opportunity` (NO activo) · `logistic_type: xd_drop_off` | `opportunity` (NO activo) · idéntico | **la API no expone el costo**: `/items/{id}/fulfillment_information` → 404. No lo estimo | **el único boost que nos falta, y también le falta al rival.** No hace falta para ganar hoy. Si el rival entra a Full, pasa a ser la palanca decisiva |
| **Envíos con colecta / en el día** | `boosted` | `boosted` | ya incluido en el flete | ✅ ya está |

**Nota sobre Full:** es el único de los 5 boosts que no tenemos, y **es también el único que el rival `MLA3983995152` no tiene**. Por eso hoy la pelea se define por cuotas. Cuando alguien en esa ficha entre a Full, el empate de boosts se rompe y va a hacer falta precio. **Vale la pena costearlo antes de que pase, no después** — pero ese costeo no sale de esta API.

---

## 8. Para hacer en el panel de Mercado Libre — lista numerada

> Nada de esto está ejecutado. `PUT` de Product Ads da 401; `POST/PUT /items` funciona pero **este agente no escribe**.

**AHORA (24/09)**
1. **No tocar `MLA1830076567`.** El `PRICE_DISCOUNT` a $33.396 ya está `started` y la ficha está `winning`/`maximum`. Publicaciones → x2 Premium → Promociones: dejar la SMART `P-MLA18023152` **sin dar de baja** (es el colchón y el que trae el `3x_campaign`).
2. **Rechazar la DEAL "CAMPAÑA MELI +" (`P-MLA18027168`) en las dos publicaciones x2.** Promociones → Campañas de Mercado Libre → CAMPAÑA MELI + → dejar `MLA3692036796` y `MLA1830076567` **fuera**. ML cofinancia $0 y los dos topes caen abajo de $33.000.
3. **No adherir ninguna promo a `MLA3692036796` hoy** — ni SMART, ni LIGHTNING, ni PRICE_DISCOUNT, ni el cupón Oferta10. Todas cruzan el escalón. Profit/orden **$8.535 → $3.025-$5.353**.
4. **Mirar en el panel dos cosas que la API no dice:**
   a. `MLA2055177767` (x3 catálogo): motivo de `reputation_limit_reached`. Hasta que se levante, **no bajar su precio** (está a $42.290 contra un ganador a $47.108 y aun así no compite).
   b. Cupón `C-MLA1582450` "Oferta10": **70 canjes, $286.724 consumidos** de un budget de $30 M. Verificar **de qué publicaciones salen y quién los paga**.

**ANTES DEL 01/10 — la jugada del 10.10 (vale ≈$6,9 M en la ventana)**
5. Publicaciones → x2 Clásica `MLA3692036796` → Editar → **Precio: $33.231 → $34.091.**
6. **Releer** la promo después del cambio (yo la releo por API si me lo pedís) y confirmar que `seller_percentage` de `P-MLA18091086` sigue en **3,2 %**. Si subió a 3,69 %, la lista tiene que ser **$34.264**. La regla es: `lista × (1 − seller_percentage) ≥ $33.000`.
7. Promociones → **"Ofertas compartidas 10.10"** (`P-MLA18091086`) → adherir **solo** `MLA3692036796`, y **solo si** la base de comisión da ≥ $33.000. Ventana 05→19/10. **Hacerlo entre el 01 y el 04/10, no antes.**

**AGENDAR**
8. **22/10/2026** — el `PRICE_DISCOUNT` de la Premium vence el **24/10** y el precio vuelve solo a **$39.677**. Renovarlo o reemplazarlo antes, o se pierde la caja ese día.
9. **30/09/2026** — la SMART `P-MLA18023152` vence el **01/10 02:50 UTC** y su sucesora `P-MLA18091144` no tiene adherida a la x2 Premium. Revisar si aparece como candidata.

**CONTINGENCIA (solo si el rival `MLA3983995152` baja de ~$32.700 y nos saca la caja)**
10. Premium → Promociones → **"Compartidas Envíos gratis"** (`P-MLA18041082`). Es la única que pone al comprador abajo de $33.000 (**$32.394**) dejando la base de comisión arriba (**$33.057**). Cuesta **$206/orden**. **Releer el precio candidato en el momento** — se mueve solo. **Vence el 05/10.**

**PREGUNTA ABIERTA (no es instrucción — candado del 05/08/2026)**
11. `MLA3692036796` paga **+5,00 pp** de comisión por `pcj-co-funded` (**$1.373/orden netos ≈ $206.000/día**) y **no** recibe el boost `free_installments`. La x4 `MLA1908275639` tiene **el mismo tag** y paga **0,00 pp**. La x2 Premium, con `3x_campaign`, paga **−4,50 pp** y **sí** tiene el boost. **¿Se revisa la configuración de cuotas de la x2 Clásica?** Si se pudiera pasar a `3x_campaign`, la caja podría volver a la publicación barata: **+$1.076/orden vs ganarla con la Premium.**

---

## 9. Supuestos, con fecha

| qué | valor | origen | fecha |
|---|---|---|---|
| escalón de comisión | **$3.320** abajo de **$33.000**, aditivo, igual en ambos listing types | `GET /sites/MLA/listing_prices` (barrido al peso) + 3 corroboraciones en `ml_orders` | **24/09/2026** — **se indexa: era $2.925 en jul-ago** |
| tasa real x2 Clásica | **20,50 %** (15,5 + 5,00 `pcj-co-funded`) | `ml_orders.sale_fee`, n=1.059 | 30/08–24/09/2026 |
| tasa real x2 Premium | **24,40 %** (28,9 − 4,50 `3x_campaign`) | `ml_orders.sale_fee`, n=207 | 30/08–24/09/2026 |
| flete | $7.148,56/orden brutos | `ml_orders.ship_cost`, Pureza pack 2, n=1.073 | 17–23/09/2026 |
| COGS pack 2 | $4.500 | `product_costs`, `is_estimated = false` | vigente |
| retenciones | 1,676 % del revenue | `ml_orders.tax_withheld`, n=1.067 | 17–23/09/2026 |
| pauta/orden Clásica | $2.334 (calibración a $8.535) — rango real medido $2.317–$3.318 | `ml_ad_spend_item` ÷ órdenes | 22–23/09/2026 |
| IVA | **×1,21** sobre revenue, comisión y flete | doctrina del P&L | — |
| caja de catálogo | **+35 %** de unidades (61,3 → 83,0 órd/día) | medido en esta misma publicación | 05–30/08/2026 |
| pauta cae al ganar la caja | **−27 %** por orden ($3.816 → $2.800) | `ml-contrafactual-precio-caja-2026-09-23.md` | 31/08/2026 |
| stock | Clásica 2.995 → 2.994 · Premium 507 → 506 (**dos lecturas**) · x3 982 | `GET /items/{id}` | 24/09/2026 17:55 y 18:02 UTC |

**Anomalía declarada y no usada a favor:** una orden (n=1) de `MLA3692036796` del 06/09/2026 a $32.971,44 pagó 20,50 % **sin** el cargo fijo. Sin explicación. Todo el informe asume el caso conservador (el escalón aplica).

**Ventana:** este informe juzga **promociones y precios**, no rendimiento de pauta por ítem. Para un veredicto de ítem hacen falta **14 días cerrados** (a 7 días la atribución joven invierte el signo).

**Scripts de lectura usados** (todos solo-GET, sobre `scripts/_ml.mjs`): `_promo-lectura.mjs`, `_promo-fees.mjs`, `_promo-feecurve.mjs`, `_promo-escalon.mjs`, `_promo-costos.mjs`, `_promo-cogs.mjs`, `_promo-ads.mjs`, `_promo-check2.mjs`, `_promo-lp2.mjs`, `_promo-det.mjs`, `_promo-camp.mjs`, `_promo-items.mjs`, `_promo-now.mjs`, `_promo-tags.mjs`, `_promo-cuotas.mjs`, `_promo-modelo.mjs`.
