# ARRAIGO en ML — diagnóstico de puja (22/08/2026, 19:xx ART)

Lectura por API autenticada. Nada se ejecutó: todo lo de la sección 8 son pasos para el panel de
Mercado Ads / Mis publicaciones. La escritura de Product Ads sigue dando 401.

---

## 0. El endpoint que faltaba (para no volver a perderlo)

El 404 de `/campaigns/{id}/metrics` era una calle que no existe. Las métricas viven así:

| Qué | Path | api-version | Notas |
|---|---|---|---|
| Total por campaña por día | `/marketplace/advertising/MLA/advertisers/932277/product_ads/campaigns/search?date_from=&date_to=&metrics=...` | **2** | **CON** `/advertisers/{id}`. Devuelve las 4 campañas con `metrics` embebido. |
| Por publicación | `.../advertisers/932277/product_ads/ads/search?date_from=&date_to=&metrics=...&limit=200` | **2** | `campaign_id` NO filtra: una sola llamada y deduplicar por `item_id`. |
| **`impression_share` y los `lost_*`** | `/marketplace/advertising/MLA/product_ads/campaigns/{id}?date_from=&date_to=&metrics=impression_share,lost_impression_share_by_budget,lost_impression_share_by_ad_rank` | **2** | **SIN** `/advertisers/{id}`. Este es el único que los devuelve. |

Dos trampas del parámetro `metrics` que cuestan un 400 mudo:
- `impression_share` / `lost_impression_share_by_*` **rompen** `campaigns/search` y `ads/search`
  (`Field IMPRESSION_SHARE not allowed at endpoint campaigns_metrics`). Solo van en el detalle de campaña.
- `acos_benchmark` **rompe** los dos `search` también, pero **sí anda** en el detalle de campaña.

`ad_groups/search` da 404 por las dos rutas → el reparto por ad group no se lee por API.

Métricas que sí aceptan los `search`: `clicks, prints, ctr, cost, cpc, acos, sov,
organic_units_quantity, direct_units_quantity, indirect_units_quantity, units_quantity,
direct_amount, indirect_amount, total_amount`.

---

## 1. ¿Entregó o está muda? — Entregó, pero está fuera de la subasta

Campaña **Arraigo `358871579`**, creada 19/08 22:46, `active`, budget $10.000/día,
`PROFITABILITY`, `acos_target` 30,96%, `roas_target` 3,23.

| Día | Prints | Clicks | Costo neto | CPC | CTR | **impression_share** | **lost_by_budget** | **lost_by_ad_rank** | `acos_benchmark` |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 19/08 | 60 | 0 | $0 | — | 0% | 0,06 | **0,00** | **0,94** | 0 |
| 20/08 | 127 | 0 | $0 | — | 0% | 0,02 | **0,00** | **0,98** | 0 |
| 21/08 | 236 | 2 | $204,69 | $102,35 | 0,85% | 0,03 | **0,00** | **0,97** | 14 |
| 22/08 (día ABIERTO) | 90 | 1 | $143,34 | $143,34 | 1,11% | 0 | 0 | 0 | 0 |

**Días cerrados 19-21/08: 423 impresiones, 2 clicks, $204,69 netos ($247,67 con IVA) contra $30.000
de presupuesto disponible — gastó el 0,68%.** Sumando el día abierto: 513 prints, 3 clicks, $348,03
netos ($421,12 c/IVA).

El 22/08 es día abierto: de ahí solo se leen clicks y gasto, nunca ACOS ni share.

### El número que cierra el caso

`lost_impression_share_by_budget = 0,00` los tres días cerrados. `lost_impression_share_by_ad_rank
= 0,94 / 0,98 / 0,97`. (Son **fracciones** que suman 1,00 con `impression_share`, no porcentajes.)

**El presupuesto no es el freno. Perdimos el 94-98% de las subastas por ad rank.** La campaña gana
entre el 2% y el 6% de las oportunidades de impresión en las que participa. Subir los $10.000/día no
compra ni una impresión más: no hay una sola subasta que se esté perdiendo por falta de plata.

Y el CTR **no** es el problema: 0,47% en días cerrados (2/423), 0,85% el 21/08. La campaña goteros
corre a 0,55% y el 1 Gotero Pureza — precio casi idéntico, $38.900 — a 0,30%. Cuando la impresión
aparece, la ficha convierte a clic mejor que el promedio de la casa. **Lo que falta son impresiones.**

Las 13 visitas cuadran perfecto: 3 vinieron de la pauta, ~10 son orgánicas de una publicación
`newbie` con 0 ventas en una categoría de 196.126 ítems.

---

## 2. Por qué PROFITABILITY no puede arrancar una publicación sin historial

En `PROFITABILITY` la puja no se fija a mano: ML la deriva.

```
puja ≈ acos_target × precio × CVR_estimada
```

Despejando con lo medido: `CPC observado / (acos_target × precio)` = `122 / (0,3096 × 39.990)` =
**0,99%**. ML nos está estimando ~1% de conversión — el default de categoría para un ítem sin
historial. Con eso, el ACOS objetivo de 30,96% compra un CPC de **~$122**.

El mercado en el que hay que ganar:

| | CPC 15-21/08 | CTR | Precio | `current_level` |
|---|---:|---:|---:|---|
| goteros (campaña) | **$481,60** | 0,55% | — | — |
| Revival Oil (campaña) | **$309,34** | 0,09% | — | — |
| 1 Gotero Pureza `MLA1796638415` | **$288,61** | 0,30% | $38.900 | `green` |
| Vein (campaña) | $205,33 | 0,12% | — | — |
| **ARRAIGO x1 `MLA1972685043`** | **$102,35** | 0,47% | $39.990 | **`newbie`** |

Estamos pujando **2,8× por debajo** de lo que paga la publicación comparable de la casa.

### Y subir el ACOS objetivo no alcanza — el techo lo pone el breakeven

Breakeven recalculado hoy con la comisión viva de la API (`/sites/MLA/listing_prices`,
gold_pro, MLA29893 = 26,8% en los tres tramos) + envío por tramo (tabla del vault, jul/2026) +
retenciones 1,5% + COGS de `product_costs`:

| | Precio | Comisión | Envío | Ret. 1,5% | COGS | **Contribución** | **BE ACOS** | **BE en gasto de API (÷1,21)** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| x1 `MLA1972685043` | $39.990 | $10.717 | $6.327 | $600 | $3.817 | **$18.529** | 46,3% | **38,3%** |
| x2 `MLA1972685049` | $59.990 | $16.077 | $7.424 | $900 | $7.634 | **$27.955** | 46,6% | **38,5%** |
| x3 `MLA1972664973` | $69.990 | $18.757 | $7.424 | $1.050 | $11.451 | **$31.308** | 44,7% | **37,0%** |

> COGS x1 $3.817 y x2 $7.634 salen de `product_costs`. Para el x3 usé 3×$3.817 = $11.451: el
> `product_costs` dice $15.151 pero ese número incluye el aplicador, que el título de ML no menciona.
> Si el pack de ML lleva aplicador, el BE del x3 baja a 39,4% (32,6% API) y el x3 pasa a ser el peor
> de los tres, no el mejor. **Confirmar antes de empujar el x3.**
> Envío: tramos $6.327 (<$50k) / $7.424 ($50-70k) medidos en julio/2026 — están por revalidar.

Llevar el `acos_target` de 30,96% al techo de breakeven (38,3%) mueve el CPC de $122 a **~$127**.
Sigue 2,3× abajo del mercado. **Para pagar los $289 que paga Pureza x1 haría falta un `acos_target`
de ~87%**, o sea el doble del breakeven. Dentro del régimen de ACOS objetivo el arranque no existe.

### Contraste con las campañas que sí funcionan

| Campaña | Estrategia | `acos_target` | Budget/día | 15-21/08: prints / clicks / costo neto | ACOS API | ACOS ×1,21 | BE producto | **IS** | **lost_bud** | **lost_rank** |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| goteros `356403999` | PROFITABILITY | 15,15% | $350.000 | 907.136 / 5.023 / $2.419.067 | 9,52% | **11,52%** | 44,7% (Pureza) | 0,38 | **0,15** | 0,48 |
| Vein `355903088` | PROFITABILITY | 17,99% | $48.000 | 47.611 / 56 / $11.498 | 0% (0 u) | — | 47,51% | 0,57 | 0,00 | 0,43 |
| Revival `356519403` | PROFITABILITY | 14,29% | $39.800 | 122.841 / 109 / $33.718 | 8,67% | **10,49%** | 40,79% | 0,28 | 0,00 | 0,72 |
| **Arraigo `358871579`** | PROFITABILITY | **30,96%** | $10.000 | **423 / 2 / $205** | s/d | s/d | 46,3% (x1) | **0,02** | **0,00** | **0,98** |

Lo que muestra la tabla: **las campañas que andan corren con un ACOS objetivo la MITAD del de
Arraigo y aun así entregan 100-2000× más.** No es que Arraigo puje poco en términos de %; es que el %
se multiplica por una CVR estimada de ~1% y por un componente de calidad que está en el piso.

El `acos_benchmark` vivo de la categoría, leído el 21/08 en el detalle de la campaña: **14%**. Nuestro
target de 30,96% ya es **2,2× el benchmark de la categoría** — pagamos peor que el rubro *en target*
y aun así perdemos el 98% de las subastas. Eso no lo explica la puja sola.

> `acos_benchmark` NO es el breakeven (trampa 8ª, 05/08/2026): dice si pagás peor que la categoría,
> no si perdés plata. Y viene 0 en casi todas las ventanas: el 14 del 21/08 es el único dato vivo que
> devolvió la API en esta lectura, sobre un día con 2 clicks. Tratarlo como orientativo.

### La parte que la puja NO compra

`ad_rank ≈ puja × calidad`, y la calidad de un ítem en ML es historial de ventas + CTR acumulado +
reseñas + reputación de la publicación. Los tres ítems de ARRAIGO están en **`current_level: newbie`,
`sold_quantity: 0`, sin reseñas, publicados el 10/08**. En toda la cuenta, **ninguna publicación
`newbie` tiene impresiones**: las 6 que están en ese nivel (incluidas las 3 de ARRAIGO) suman 423
prints entre todas, y todo lo que imprime es `green` o `yellow`.

Ese es el techo honesto de esta recomendación: **cambiar la estrategia sube la puja, que es uno de
los dos factores del ad rank. El otro no se compra — se construye con las primeras ventas.** Por eso
el plan de abajo es "pagar de más durante 14 días para comprar el historial", no "optimizar el ACOS".

---

## 3. Respuesta a la pregunta 2

**No, `PROFITABILITY` con ACOS objetivo no es la estrategia que corresponde para una publicación con
0 historial de ventas.** El régimen de ACOS objetivo es un mecanismo de *contención*: sirve cuando ML
ya sabe cuánto convierte tu ítem. Con CVR estimada por default (~1%) y calidad en el piso, la puja
derivada queda estructuralmente por debajo del precio de la subasta, y el presupuesto ni se toca —
exactamente lo medido: `lost_by_budget = 0,00` con el 0,68% del presupuesto gastado.

Hay que arrancar en el régimen sin techo de ACOS (Crecimiento / Máxima visibilidad, según cómo los
llame el panel), sostenerlo 14 días cerrados, y **recién apretar el ACOS cuando haya una CVR medida
propia**, no estimada.

Esto coincide con lo que ya está escrito en `50-Proyectos/Serum-Capilar.md`: *"tratar los primeros
meses de ACOS 15-25% como costo de construir posición, no como ineficiencia a corregir"*. La campaña
se creó el 19/08 con la lógica opuesta.

> **Límite de la lectura:** la API expone `strategy` pero no enumera los valores válidos, y las 4
> campañas de la cuenta son `PROFITABILITY` — no tengo ningún ejemplo propio de otra estrategia para
> mostrar cómo se comporta. Los nombres exactos de las otras opciones son los que Pancho vea en el
> panel al editar la campaña. Y **no sé si la estrategia es editable sobre una campaña ya creada**
> (en ML a veces se fija al crearla); el paso 3 de la sección 8 cubre ese caso.

---

## 4. Presupuesto: NO tocarlo

$10.000/día se queda como está.

- `lost_impression_share_by_budget = 0,00` los tres días cerrados. Cero subastas perdidas por plata.
- Gastó $205 de $30.000 disponibles (0,68%).
- Candado del Playbook (:32 y :283): no se toca el target cuando el freno es presupuesto — y el
  converso vale igual, **no se toca el presupuesto cuando el freno es la puja**.
- Dimensionado para el aprendizaje que hace falta: ~100-150 clicks para tener una CVR legible. A CPC
  de mercado ($250-350) son $25.000-52.500 netos en 14 días = **$1.800-3.750/día**. El cap de
  $10.000/día sobra y encima deja aire si la subasta se pone cara.
- Recordar: el presupuesto es **promedio diario**, no tope duro. Ver $15.000-20.000 un día no es
  sobregasto reclamable (trampa 2ª). Tope real solo si clava $10.000,00 exactos varios días seguidos
  — ahí sí el presupuesto pasó a ser el freno y recién ahí se sube.

---

## 5. Pregunta 4 — el reparto x1/x2/x3

Impresiones desde el 19/08:

| Ítem | Precio | Prints | Clicks | Costo | Share de impresiones | Visitas |
|---|---:|---:|---:|---:|---:|---:|
| x1 `MLA1972685043` | $39.990 | 496 | 3 | $348,03 | **96,7%** | 11 |
| x2 `MLA1972685049` | $59.990 | 12 | 0 | $0 | 2,3% | 1 |
| x3 `MLA1972664973` | $69.990 | 5 | 0 | $0 | 1,0% | 1 |

**No es la 7ª trampa.** Esa trampa (05/08/2026: el x2 nuevo de Pureza le apagó la pauta al x3 dentro
de goteros) requiere que haya presupuesto que reasignar. Acá no hay nada que repartir: la campaña
entera está en `impression_share` 0,02 y gastó $348 en cuatro días. Ninguna se come a las otras —
**ninguna arranca.**

La asimetría igual es informativa y es el mismo mecanismo: `PROFITABILITY` prioriza al ítem con mejor
ACOS estimado, que a igual CVR estimada es **el de menor precio**. El x2 y el x3, encima, están peor
posicionados para relevancia (ver 6.1). Cuando la puja suba, el reparto va a degenerar hacia el x1 de
nuevo salvo que se los separe.

**Y el punto que decide el plan: en ML el ranking es del ÍTEM, no de la marca ni de la cuenta**
(candado `ml-guerra-catalogo`, confirmado 30/07/2026). La primera venta del x1 **no** le da ad rank al
x2. Empujar los tres en paralelo triplica el costo de comprar historial y ensucia la lectura.
→ **Concentrar todo en el x1** hasta la primera decena de ventas.

Contra-argumento honesto, para que quede escrito: según la tabla de la sección 2 el **x2 es el
escalón más eficiente** ($27.955 de contribución vs $18.529 del x1), y el vault ya lo dice
(*"en ML el x2 sigue siendo el escalón más eficiente"*). Sacrificamos margen por unidad a cambio de
comprar el historial más barato — el x1 es el que menos fricción de conversión tiene y el que ML ya
eligió mostrar. Cuando el x1 tenga reseñas y `green`, el x2 se empuja con su propia campaña.

`organic_units_quantity = 0` en los tres. No hay orgánico que canibalizar: todo lo que venga en los
próximos 14 días lo trae la pauta. El corolario de `lo-que-vende-no-se-apaga` no aplica todavía —
acá no hay nada que apagar.

**Stock (leído dos veces, 18:5x y 19:0x — estable):** x1 = 10, x2 = 5, x3 = 3. No hubo quiebre, así
que la caída de impresiones no se explica por stock. Pero **10 unidades es runway fino**: si el x1
arranca de verdad bajo estrategia agresiva, se agota en días y un `out_of_stock` mata el ad rank
recién comprado. Reponer antes de apretar.

---

## 6. Pregunta 5 — ¿hay una ficha rota abajo de la puja?

Respuesta corta: **la ficha no está rota, pero tiene tres agujeros que sí pesan en el ad rank, y uno
de ellos es de categoría, no de ficha.** Pujar no es tirar plata, pero conviene tapar estos primero
porque son gratis y mejoran el mismo ad rank que estamos tratando de comprar.

### 6.1 El x2 y el x3 están sin los atributos de ficha (el más caro y el más fácil)

| Atributo | x1 | x2 | x3 |
|---|---|---|---|
| `HAIR_TREATMENT_CARE_TYPE` | **Anticaída** | **falta** | **falta** |
| `PRODUCT_TYPE` | **Sérum anticaída** | **falta** | **falta** |
| `IS_KIT` | No | **falta** | **falta** |
| `NET_VOLUME` | 30 mL | 30 mL | 30 mL |
| `UNITS_PER_PACKAGE` | 1 | 2 | 3 |
| `BRAND` / `LINE` | Arraigo | Arraigo | Arraigo |

`HAIR_TREATMENT_CARE_TYPE` y `PRODUCT_TYPE` son los atributos con los que ML matchea la búsqueda y
los filtros de la categoría. Sin ellos, el x2 y el x3 quedan fuera del filtro "Anticaída" y su
relevancia contra la query es más baja → menos ad rank → menos impresiones. Esto explica parte del
2,3% / 1,0% de share de la tabla de arriba, y es la única cosa de esta sección que se arregla en dos
minutos.

Y en el título: el x1 dice **"Anticaida"**, el x2 y el x3 **no** ("2 Serum Capilar Arraigo Romero
Cafeina 30ml Fortalecedor"). El término que describe el problema del comprador quedó afuera de dos de
las tres publicaciones.

### 6.2 La categoría no busca "romero" — el freno de demanda

`GET /trends/MLA/MLA29893` (50 keywords top de "Tratamientos para el Cabello"):

> minoxidil · ampollas fidelite · biotina pura · biotina · alfagrow · baño de crema · luminoliss
> alisado · karseell · skala · minoxidil 5 · locion minoxidil 5 · finasteride comprimidos ·
> megacistin max · locion minoxidil productos · mascarilla karseell · dutasteride comprimidos ·
> minoxidil comprimidos · valcatil max · aceite de ricino · la puissance · … · aceite de batana ·
> pastilla caida cabello · … · **serum capilar pantene** · … · locion minoxidil kirkland

**Ninguno de los 50 contiene "romero", "anticaída" ni "cafeína".** El único que se acerca es "serum
capilar pantene" (una marca). La demanda medida de la categoría es minoxidil / finasteride / biotina
/ keratina / botox capilar.

Esto matiza el hallazgo del vault (*"el romero premium está vacío: en 308 resultados el techo son
$58.990"*). Está vacío, sí — **pero puede estar vacío porque no hay demanda de romero en ML, no
porque haya un hueco de oferta.** En ML se captura demanda, no se crea; eso ya está escrito como
límite (2) del escenario solo-ML en `Serum-Capilar.md`.

No es motivo para no pujar — es motivo para **esperar volúmenes chicos aun con la puja arreglada**, y
para no leer "pocas impresiones" como fracaso de la puja si el techo de la subasta es bajo. Y es un
argumento fuerte para meter en el título los términos de la demanda real que sí sean verdaderos del
producto (**"caída del cabello"**, **"crecimiento"**, **"fortalecedor"**) — nunca "minoxidil", que no
lo tiene y sería claim falso + riesgo de baja por moderación (`ml-descripciones-criterio-claims`).

### 6.3 Lo demás está sano

- Las 3 `active`, sin `sub_status`, `gold_pro` (Premium), `mandatory_free_shipping`, envío ME2.
- Fotos: 9 / 9 / 10 (el máximo de la categoría es 12). `image_quality: good_quality_thumbnail`.
- `catalog_listing: false`, `catalog_product_id: null`, `price_to_win` → `not_listed` /
  `item_not_opted_in`. **No hay caja de catálogo que ganar ni perder** — y eso es lo que se buscó a
  propósito (*"entrar buscando publicación propia … en vez de pelear precio dentro de una ficha
  compartida"*). Nada que reportar en el frente de cajas.
- `EMPTY_GTIN_REASON` seteado en las tres (sin código de barras). Correcto para producto propio, pero
  cierra la puerta al catálogo mientras no haya GTIN.
- `video_id: null` en las tres. `pacurie` sí tiene video en su ficha (Playbook-ML-Catalogo §8.3). El
  video **no se puede cargar por API** (acepta el PUT con 200 y descarta el valor, 12 combinaciones
  probadas) — es panel o app de vendedor.
- `/items/{id}/health` devuelve 404 (`Items with buying mode 'buy_it_now' are not allowed`) y el
  campo `health` del ítem viene `null`. **El puntaje de calidad de publicación no se lee por API** —
  se mira en Mis publicaciones.

### 6.4 Dos cosas raras que conviene mirar

- **Peso declarado inconsistente:** x1 = 770 g, **x2 = 2000 g**, x3 = 1550 g. El x2 pesa más que el
  x3. Con envío gratis obligatorio, el peso declarado entra en el costo de flete que absorbemos.
- **Logística distinta:** el x1 tiene tag `self_service_in`; el x2 y el x3 `self_service_out` +
  `self_service_available`. Los tres son `xd_drop_off`. Vale confirmar en el panel que los tres estén
  en el mismo modo de envío — el modo de envío pesa en la posición.

### 6.5 Precio contra la competencia

No se pudo barrer el rubro: `/sites/MLA/search` da **403** con token (la API pública de búsqueda está
cerrada para nosotros — `ml-bloquea-acceso-automatizado`) y no se abre el sitio público.

Con lo que hay en el vault (Playbook-ML-Catalogo §8.3, y ojo que **pacurie es competidor de _Pureza_,
no del sérum capilar** — el ángulo aplicable es el formato, no el precio):

| | contenido | precio | $/mL |
|---|---:|---:|---:|
| ARRAIGO x1 | 30 mL | $39.990 | **$1.333** |
| ARRAIGO x2 | 60 mL | $59.990 | $1.000 |
| ARRAIGO x3 | 90 mL | $69.990 | $778 |
| pacurie x1 (Pureza, referencia de formato) | 59 mL | $49.990 | $847 |

En capilar el comparable real es **Skinfinity** (x3 + cepillo $79.990, 500 vendidos, 79 opiniones,
4,6, Full Súper, tienda oficial) — datos del vault, **sin re-verificar y de julio**. Contra eso, el
x3 de ARRAIGO a $69.990 está bien puesto de precio; lo que no tiene es la prueba social.

**El x1 a $39.990 con $1.333/mL es el punto más flojo de la escalera**, y es justo el ítem que ML
eligió mostrar. Si en el día 7 el CTR se mantiene pero no hay conversión, la palanca siguiente es el
precio del x1 — no más puja.

> Al tocar el precio del x1, ojo la 7ª trampa (05/08/2026): con `PROFITABILITY`, bajar el precio de
> una publicación mejora su ACOS estimado y le apaga la pauta a las hermanas. Acá el riesgo está
> acotado — el x2 y el x3 ya están en 0 impresiones y la campaña Arraigo está aislada de goteros —
> pero si para entonces ya se pasó a estrategia de visibilidad, el efecto reaparece con otro signo.

---

## 7. Lo que NO se puede leer por API (para que Pancho lo mire en el panel)

1. **El puntaje de calidad de la publicación** (`health` viene `null`, `/health` da 404).
2. **El reparto por ad group** dentro de la campaña (`ad_groups/search` → 404 por las dos rutas).
3. **Los valores válidos de `strategy`** — la API los devuelve pero no los enumera, y las 4 campañas
   de la cuenta son `PROFITABILITY`.
4. **Si la estrategia es editable** sobre una campaña ya creada.
5. **La competencia del rubro** (`/sites/MLA/search` = 403).
6. **El `acos_benchmark` estable** de la categoría: la API devolvió 0 en casi todas las ventanas; el
   único valor vivo fue **14% el 21/08**, sobre 2 clicks.

---

## 7 bis. ✅ EJECUTADO la noche del 22/08/2026 — y qué salió mal del §8

El §8 de abajo se escribió antes de ejecutar y **tiene cuatro errores**. Se deja tal cual como
registro, pero **lo que vale es esto**:

| §8 dice | Qué pasó realmente |
|---|---|
| Paso 1: los 3 atributos "copiados del x1" | ✅ Hecho **por API**, no en el panel. Pero **`IS_KIT` del x1 es `No`** — copiarlo dejaba el atributo mal. En x2/x3 va **`Sí`** a mano. |
| Paso 2: título `…Cafeina Crecimiento 30ml` | ✅ Hecho a mano. Pero ese título tiene **65 chars y el máximo de MLA29893 es 60**. Quedó `2 / 3 Serum Capilar Anticaida Arraigo Romero Cafeina 30ml` (53), sin *"Crecimiento"* — que además es término **sin demanda medida** (§6.2). |
| Paso 3: pasar a "Crecimiento/Visibilidad", y si no se puede, crear `Arraigo-arranque` | ✅ Resuelto, pero **esas estrategias no existen**. El panel expone un slider **ROAS Objetivo 1x–35x** (*"Maximizar la cantidad de ventas"* ↔ *"Maximizar el retorno por venta"*): **`ROAS = 1/ACOS`**. Quedó en **1,2x** (`acos_target` 83,33%). **Se edita en la campaña existente** → el plan B era innecesario. |
| Paso 4: pausar x2/x3 | ❌ **Se cae, medido.** 19→22/08 el x2 hizo 19 prints y el x3 nueve, **$0 los dos** (x1: 564 prints, 3 clicks, $348,03). No compiten por presupuesto. Se dejan activas. |

Sin hacer: **stock del x1** (sigue en 10, no hay frascos — la propuesta es *reasignar* x1 20 · x2 2 ·
x3 1, que son 27 frascos contra los 29 comprometidos hoy) y **video de la ficha del x1**.

También corregido: el **~87%** de la §sobre el ACOS necesario da **73%** rehaciendo la cuenta
(`289 / (39.990 × 0,0099)`) — ROAS objetivo 1,37x. No cambia la conclusión.

Y el §6.2 quedó **matizado**: `/highlights/MLA/category/MLA29893` muestra que el **#4 y el #5** de la
categoría **son anticaída** (Kérastase Génesis 90 mL $130.295 · Natura Ekos Patauá 30 mL $10.900).
La demanda existe; **llega por marca**, no por el término genérico. Eso pone en foco el precio: el x1
está a **3,7× el comparable directo de formato** y al **92% del $/mL de Kérastase**. Detalle en el
vault, `50-Proyectos/Serum-Capilar.md`.

Candado nuevo: **el título no se cambia por API** (`family_name` / user product) — ver
`scripts/arraigo-ficha-2208.mjs` y `50-Proyectos/Integracion-ML-MP.md`.

## 8. Para hacer en el panel de Mercado Ads

En este orden. Los pasos 1-2 son gratis y mejoran el mismo ad rank que el paso 3 intenta comprar.

1. **Mis publicaciones → `MLA1972685049` (x2) → Ficha técnica.** Cargar los tres atributos que
   faltan, copiados del x1: `Tipo de cuidado del cabello` = **Anticaída** · `Tipo de producto` =
   **Sérum anticaída** · `Es un kit` = **Sí**. Repetir en **`MLA1972664973`** (x3).
2. **Misma pantalla, título del x2 y del x3.** Meter **"Anticaida"** (hoy solo lo tiene el x1):
   - x2: `2 Serum Capilar Arraigo Romero Cafeina 30ml Fortalecedor` → **`2 Serum Capilar Anticaida
     Arraigo Romero Cafeina Crecimiento 30ml`** (60 chars es el máximo de MLA29893).
   - x3: `3 Serum Capilar Arraigo Romero Cafeina 30ml Fortalecedor` → **`3 Serum Capilar Anticaida
     Arraigo Romero Cafeina Crecimiento 30ml`**.
   - No poner "minoxidil" ni nada que el producto no tenga.
3. **Mercado Ads → campaña `Arraigo` (358871579) → Editar → Objetivo/Estrategia.**
   Cambiar de **Rentabilidad (ACOS objetivo 30,96%)** a la opción **sin techo de ACOS** — la que el
   panel llame **Crecimiento** o **Máxima visibilidad** (si están las dos, elegir **Crecimiento**:
   maximiza ventas dentro del presupuesto en vez de comprar impresiones a cualquier costo).
   - **Si el panel NO deja cambiar la estrategia de una campaña ya creada:** crear una campaña nueva
     `Arraigo-arranque` con estrategia Crecimiento/Visibilidad, budget $10.000/día, meter **solo**
     `MLA1972685043` (el x1), y **pausar la campaña `Arraigo` 358871579** para que no queden dos
     campañas compitiendo por el mismo ítem.
   - **Si tampoco existe una estrategia sin techo de ACOS** (solo hay Rentabilidad): subir
     `acos_target` de **30,96% → 38%** — el techo de breakeven del x1 con gasto de API. Avisar que
     eso solo lleva el CPC de ~$122 a ~$127 y probablemente no alcance; en ese caso la palanca que
     queda es el precio del x1, no la puja.
4. **Misma campaña → Anuncios.** Pausar los anuncios de **`MLA1972685049` (x2)** y
   **`MLA1972664973` (x3)**. Dejar activo **solo `MLA1972685043` (x1)**.
   No pausar las publicaciones — solo los anuncios. Motivo: el ranking es del ítem, empujar tres en
   paralelo triplica el costo de comprar historial y ensucia la lectura.
5. **Presupuesto diario: dejarlo en $10.000. NO tocarlo.** `lost_by_budget = 0,00`: no hay una sola
   subasta perdida por plata. Si en algún momento el gasto clava $10.000,00 exactos varios días
   seguidos, ahí sí el presupuesto pasó a ser el freno y se sube — no antes.
6. **Stock del x1.** Está en 10 unidades. Subirlo a **≥ 30** antes de que la campaña empiece a
   entregar: si se agota, el `out_of_stock` borra el ad rank que estamos pagando por construir.
7. **Video en la ficha del x1** (app de vendedor o panel; por API es imposible). `pacurie` lo tiene y
   nosotros no en ninguna de las 25 publicaciones activas. Es lo más barato que queda para subir el
   componente de calidad del ad rank.
8. **No tocar nada más hasta el 06/09.** Ni el precio, ni el presupuesto, ni el objetivo.

### Calendario de lectura

| Fecha | Qué se lee | Qué NO se lee |
|---|---|---|
| **29/08** (chequeo intermedio) | Solo **clicks acumulados, gasto acumulado e `impression_share`**. Verde si `impression_share` ≥ 0,10 y ≥ 40 clicks. | **Nada de ACOS ni de conversión** — atribución joven, y el 29/08 sería una ventana de 6 días. |
| **06/09** (veredicto) | Ventana **23/08 → 05/09, 14 días cerrados**. ACOS API ×1,21 contra BE del x1 (46,3%), unidades TOTALES, `impression_share`, `lost_by_*`. | — |

**Umbral para que el 06/09 sea legible:** ≥ 100 clicks acumulados e `impression_share` ≥ 0,15 (hoy
0,02). Con menos de 100 clicks no hay CVR que leer y el veredicto se pospone en vez de estimarse.

**Stop-loss (chequeo del 29/08):** si el gasto acumulado supera **$70.000 netos ($84.700 con IVA)**
con **0 unidades**, frenar y volver a Rentabilidad con `acos_target` 38%. Ese número son ~4,6
unidades de contribución del x1 ($18.529 c/u) quemadas sin una sola señal de conversión — el punto
donde "comprar historial" deja de ser una inversión acotada.

**Por qué 14 días y no 7:** a 7 días la atribución joven invierte el signo (mismo ítem medido:
ACOS 52,6% a 7d vs 33,4% a 14d — Playbook:232). Con 3 clicks de historia, cualquier lectura antes del
06/09 es ruido.

---

## 9. Supuestos y fechas

- Frenos del escalón: Playbook-ML-ProductAds-Full.md:220 (05-09/08/2026) — **no se aplicaron a
  Arraigo**: los 4 frenos son para decidir un escalón de presupuesto, y acá el presupuesto no es el
  freno (`lost_by_budget` = 0,00).
- Breakeven de canal 44,7% y por producto: Playbook:25 y :302, corrección del 09/08/2026. Los BE de
  ARRAIGO de la sección 2 son **calculados hoy 22/08/2026**, no del Playbook.
- Comisión 26,8%: `/sites/MLA/listing_prices` leída hoy 22/08/2026, en los tres tramos de precio.
- Envío por tramo ($6.327 / $7.424): tabla de `Serum-Capilar.md`, medida en **julio/2026** — por
  revalidar.
- COGS: `product_costs` (x1 $3.817 · x2 $7.634 · x3 $15.151-con-aplicador). El x3 se calculó sin
  aplicador; **confirmar**.
- Factor **×1,21**: la API devuelve gasto NETO, el P&L lo cobra con IVA.
- `acos_benchmark` vivo: **14% (21/08/2026)**, sobre 2 clicks. El ~19,6% del Playbook es de otra
  categoría y otro momento. Ninguno de los dos es el breakeven.
- Ventanas: métricas de Arraigo 19-22/08 (el 22/08 **abierto**, solo clicks y gasto); comparación de
  campañas y de ítems 15-21/08 (7 días cerrados, suficiente para comparar *setup*, insuficiente para
  juzgar un ítem).
- Último dato leído: 22/08/2026 ~19:00 ART.
- Stock leído dos veces (candado de la oscilación): 10 / 5 / 3, estable.
- Nada se ejecutó. Los PUT de Product Ads dan 401.
