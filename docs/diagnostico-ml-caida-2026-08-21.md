# Diagnóstico ML — caída del 15–21/08/2026

**Leído:** 22/08/2026 (última corrida de API/DB: 21/08 23:55 UTC en `last_updated` del ítem campeón).
**Fuentes:** API autenticada de ML (`/items`, `/items/{id}/price_to_win?version=v2`, `/products/{id}/items`,
`/items/{id}/visits/time_window`, `/marketplace/advertising/MLA/advertisers/932277/product_ads/{campaigns,ad_groups,ads}/search`)
+ Supabase (`ml_orders`, `ml_ad_spend`).
**Solo lectura.** Nada de lo que sigue se ejecutó: todo va a la lista del panel (sección 8).

---

## 0. Corrección de ventana (importante)

El pedido comparaba **15–21/08 vs 08–14/08**. El 21/08 estaba **abierto** al momento de la lectura, y
comparar un día abierto contra días cerrados infla el ACOS intradía y subestima las unidades del día.
Todo este informe usa **ventanas cerradas de 7 días: 14–20/08 vs 07–13/08**, y donde hace falta juzgar un
ítem, la ventana de 14 días cerrados (07–20/08).

La conclusión no cambia de signo con el re-anclaje: con ventanas cerradas la caída es incluso un poco
**peor** que la del reporte semanal (−27,9% en órdenes vs el −27% reportado).

---

## 1. La caída, medida

`ml_orders`, `status <> 'cancelled'`, fecha de venta en hora Argentina:

| | 07–13/08 | 14–20/08 | Δ |
|---|---|---|---|
| Órdenes | 1.001 | 722 | **−27,9%** |
| Unidades | 1.014 | 728 | −28,2% |
| Revenue | $45.099.563 | $34.290.880 | **−24,0%** (−$10,81 M) |
| Ticket medio | $45.054 | $47.494 | **+5,4%** |
| Gasto ML Ads (todas las campañas) | $2.220.797 | $2.441.385 | **+9,9%** |
| Costo ML Ads por unidad TOTAL | $2.190 | **$3.353** | +53% |

El ticket **subió**. No vendimos más barato: vendimos **menos veces**. Y pagamos $220.588 más por hacerlo.

### Estado del canal (leído dos veces, con minutos de diferencia — candado de stock)

Ningún quiebre. `available_quantity`: MLA3692036796 = 400 y 400; MLA3030316544 = 772 y 772;
MLA3030521696 = 956; MLA3356284130 = 922. Reputación **platinum / 5_green**, reclamos 0,42% a 60 días,
cancelaciones 0. **La caída no es stock ni reputación.**

---

## 2. Dónde se fueron los $10,81 M — decomposición por publicación

Ventanas cerradas 07–13 vs 14–20/08, ordenado por delta de revenue:

| Ítem | Pack | Órd. prev → act | Δ revenue | Qué pasó |
|---|---|---|---|---|
| **MLA3692036796** | x2 | 602 → 420 (−30%) | **−$7.303.842** | Campeón. Sigue ganando la caja. Perdió tráfico y conversión |
| **MLA3692896792** | x3 | 60 → 0 | −$3.645.306 | Murió el 10/08 — reemplazada (ver 2.b) |
| **MLA3356284130** | x1 | 126 → 46 | **−$2.747.300** | **`under_review` / `forbidden` desde el 19/08** |
| MLA1908275639 | x4 | 27 → 17 | −$874.453 | Gasto plano, unidades −52% |
| MLA2708572562 | Natures x3 | 20 → 9 | −$766.003 | Menos pauta |
| MLA3030366476 | x2 sec. | 25 → 9 | −$674.700 | Ad group en HOLD, 0 gasto |
| MLA3030316354 | x2 sec. | 9 → 3 | −$309.927 | |
| … resto chico | | | −$310.000 | |
| MLA3030521696 | **x5** | 14 → 35 (+150%) | **+$1.774.462** | El único que creció con plata nueva |
| **MLA3030316544** | x3 | 69 → 128 (+86%) | **+$3.400.612** | Absorbió a MLA3692896792 |
| MLA1796638415 | x1 propia | 18 → 22 | +$146.029 | Mejoró gastando menos |
| **NETO** | | **1.001 → 722** | **−$10.808.683** | |

### 2.a — Bucket de causas

| Causa | Δ revenue | % de la caída |
|---|---|---|
| **Bloqueo de moderación del x1 de catálogo** (MLA3356284130) | −$2,75 M | **25%** |
| **Tráfico + conversión del campeón x2** (MLA3692036796) | −$7,30 M | **68%** |
| Swap del x3 (MLA3692896792 → MLA3030316544) | −$0,25 M neto | 2% |
| x4 + Natures + x2 secundarias | −$2,30 M | 21% |
| Crecimiento del x5 (compensa) | +$1,77 M | −16% |

### 2.b — El swap del x3 NO es un problema

MLA3692896792 (Clásica, $62.741,93) cayó a cero el **10/08**: visitas 319 (08/08) → 175 (09/08) → **11 (10/08)**,
prints de pauta 67.669 → 1.209. El mismo día MLA3030316544 (Premium, **mismo precio, mismo stock compartido —
son `user_product_listing` hermanas**) revivió: visitas 12 (08/08) → 156 (10/08) → 403 (18/08).

Es el **efecto hermanas** documentado en la memoria `ml-product-ads-lectura`: con estrategia por ACOS objetivo,
la pauta se concentra en una de las hermanas y le apaga la otra. Neto del pack x3: −$0,25 M sobre $8,0 M.
**Ruido, no causa.** No hay nada que arreglar acá.

---

## 3. Puja de catálogo — ¿perdimos la caja?

**No perdimos ninguna caja frente a un rival. Ninguna.**

| Ítem | Ficha | `status` | `price_to_win` | `visit_share` | Ganador |
|---|---|---|---|---|---|
| **MLA3692036796** | MLA70304457 | **`winning`** | $40.131 = nuestro precio | **`maximum`** | nosotros, `competitors_sharing_first_place: 0` |
| MLA1908275639 | MLA74008314 | `winning` | $69.778 = nuestro precio | maximum | nosotros |
| MLA1830076567 | MLA70304457 | `competing` | $41.311 | `minimum` | **MLA3692036796 (nuestra)** |
| MLA3356284130 | MLA63777933 | `not_listed` — `item_not_opted_in` | — | — | **la ficha quedó vacía** |

- `GET /products/MLA70304457/items` devuelve **sólo dos ofertas, las dos nuestras**. No entró ningún competidor
  a la ficha del x2 durante la ventana.
- `GET /products/MLA63777933/items` devuelve **404**: al bloquearse MLA3356284130, esa ficha de catálogo se
  quedó **sin una sola oferta**. Nadie nos ganó la caja — la caja se apagó porque éramos los únicos.

**Conclusión: la puja de catálogo no explica nada de la caída.** El único evento de catálogo es el bloqueo,
que es moderación, no competencia.

### 3.a — El bloqueo: lo único que se rompió de golpe

```
MLA3356284130  status=under_review  sub_status=["forbidden"]  last_updated=2026-08-19T02:26:09Z
```

Visitas del ítem, por día: … 18/08: **240** → 19/08: **1** → 20/08: **0** → 21/08: **0**.
Órdenes: 27 (13/08), 9, 11, 10, 7, 9 (18/08) → **0, 0, 0** desde el 19/08.

La API **no expone el motivo** de un `under_review`/`forbidden` — eso se lee sí o sí en el panel
(Mis publicaciones → la publicación tiene el cartel con la causa). Contexto que conviene tener a mano al
abrirlo: hay un test vivo de criterio de claims en descripciones que vence el 22/08, y esta línea ya comió
una baja por reclamo de marca (Natures).

Costo del bloqueo mientras dure: **~$2,7 M de revenue por semana**, y encima se lleva **88 unidades
orgánicas semanales** que ese ítem traía sin pagar pauta (ver 4.c).

---

## 4. Product Ads — el escalón se rompió el 14/08

Campaña **`goteros` 356403999** (`strategy: PROFITABILITY`, `acos_target: 15,15%`, `roas_target: 6,6`,
presupuesto **$350.000/día**). Es el 98% del gasto de ML.

### 4.a — La tabla del escalón (6 semanas)

| Semana | Gasto | Prints | Clicks | CTR | CPC | ACOS | u.pauta | u.orgánicas | **u.TOTAL** | $/u.TOTAL | **marginal $/u** | SOV |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10–16/07 | $941.201 | 192.797 | 2.430 | 1,26% | $387 | 8,20% | 212 | 211 | 423 | $2.225 | — | 49,5% |
| 17–23/07 | $961.942 | 152.548 | 2.243 | 1,47% | $429 | 7,55% | 237 | 276 | 513 | $1.875 | $230 | 46,0% |
| 24–30/07 | $1.250.000 | 257.396 | 3.189 | 1,24% | $392 | 7,06% | 346 | 312 | 658 | $1.900 | $1.986 | 52,9% |
| 31/07–06/08 | $1.850.000 | 278.525 | 3.902 | 1,40% | $474 | 8,15% | 482 | 397 | 879 | $2.105 | $2.715 | 55,2% |
| 07–13/08 | $2.154.450 | 639.733 | 5.558 | **0,87%** | $388 | 6,82% | 700 | 314 | **1.014** | $2.125 | $2.255 | 69,2% |
| **14–20/08** | **$2.397.544** | **875.219** | **4.724** | **0,54%** | **$508** | 9,65% | 527 | 222 | **749** | **$3.201** | **negativo** | **70,3%** |

**El último escalón compró unidades negativas: +$243.094 de gasto marginal por −265 unidades totales.**

Cinco semanas seguidas el escalón pagó entre $230 y $2.715 por unidad marginal. El del 14/08 no pagó nada:
gastamos más y vendimos menos. Ese es el freno 3 del Playbook (costo por unidad TOTAL marginal > $12.500,
umbral del 05–09/08/2026) roto por goleada — acá el marginal ni siquiera es un número positivo.

### 4.b — Qué se rompió mecánicamente: compramos impresiones basura

- **Prints +36,8%** (639.733 → 875.219) con **clicks −15,0%** (5.558 → 4.724).
- **CTR −38%**: 0,87% → 0,54%. Y la degradación empezó antes, el 07/08: la serie diaria va
  1,50 · 1,35 · 1,22 · 1,48 · 1,35 · 1,43 (01–06/08) → **0,94** (07/08) → 0,71 · 0,74 · **0,65** (10–12/08)
  → 0,60 · 0,60 · **0,43** (14–16/08) → **0,37** (19/08).
- **CPC +31%**: $388 → $508.
- **SOV 69,2% → 70,3%.** Ahí está la explicación: con 70% de share of voice **ya ganamos casi todas las
  subastas que valen la pena**. El presupuesto extra sólo puede comprar el 30% restante, que es exactamente
  el inventario que no convierte. El escalón tocó techo de subasta, no techo de presupuesto.

Serie diaria del gasto: el presupuesto quedó **clavado en $350.000 exactos el 13, 14, 15, 16, 17 y 18/08** —
seis días seguidos con el monto exacto. Por el criterio del candado (trampa 2ª: "tope real sólo si clava el
monto exacto varios días") **eso sí es tope duro**, no promedio. La campaña está pegada al techo de presupuesto
Y al techo de subasta al mismo tiempo.

### 4.c — Por ad group (14–20 vs 07–13/08)

| Ad group | Qué es | Gasto prev → act | u.TOTAL prev → act | Marginal $/u | Lectura |
|---|---|---|---|---|---|
| 2477446946 | **x2 campeón** MLA3692036796 | $1.225.173 → $1.250.187 | 636 → **464** | **negativo** | Gasto plano, −172 unidades. No es plata: es demanda/conversión |
| 2123711936 | x3 MLA3030316544 | $517.534 → $597.263 | 145 → 135 | **negativo** | +$80k por −10 unidades |
| 2123713882 | **x5** MLA3030521696 | $91.791 → $287.930 | 16 → **41** | **$7.846** | El **único** que convirtió plata nueva en unidades. CPC $883 pero paga |
| 2616726570 | x4 MLA1908275639 | $124.276 → $124.559 | 27 → **13** | **negativo** | Mismo gasto, mitad de unidades. $9.581 por unidad. Orgánicas = 3 (≈0) |
| 2400073499 | x1 propia MLA1796638415 | $86.764 → $79.671 | 21 → 23 | — | Mejoró **gastando menos** |
| **2123732755** | **x1 catálogo MLA3356284130** | $43.203 → $18.361 | **121 → 44** | — | **En `HOLD` y gastando igual** |
| 1843799879 | Natures 3x1 | $43.035 → $26.806 | 21 → 9 | — | Menos pauta, menos venta |

**Dos cosas que saltan:**

1. **El ad group 2123732755 está en `HOLD` y aun así gastó $18.361 en la semana** (y $43.203 la anterior).
   Era, de lejos, **el ad group más eficiente de toda la cuenta**: en 07–13/08 hizo 33 unidades de pauta +
   **88 unidades orgánicas** = 121 unidades por $43.203 → **$357 por unidad total**, con CPC de $109 y ACOS 3,8%.
   La API **no expone el motivo del HOLD**. Se lee en el panel.
2. **El presupuesto marginal se fue al lugar equivocado.** De los +$220.588 de gasto nuevo: +$196.139 al x5
   (bien: pagó $7.846/u) y +$79.729 al x3 (mal: −10 unidades). El campeón x2, que produce unidades a
   **$2.694 cada una**, se quedó **plano**.

### 4.d — Los 4 frenos del Playbook (umbrales del 05–09/08/2026)

| # | Freno | Estado | Evidencia |
|---|---|---|---|
| 1 | `lost_by_budget` < 0,15 | **NO LEÍBLE POR API** | `impression_share`, `lost_impression_share_by_budget` y `lost_impression_share_by_ad_rank` devuelven **400** en `campaigns_metrics` y en `ads_search` para este advertiser. Proxies: SOV 70,3% y presupuesto clavado en $350.000 exactos 6 días. **Pancho lo lee en el panel** |
| 2 | Unidades TOTALES planas 2 semanas seguidas | **NO gatilla — es peor** | No están planas: 1.014 → 749 (−26,1%). Cayeron |
| 3 | **Costo por unidad TOTAL marginal > $12.500** | **GATILLÓ** | +$243.094 de gasto por **−265** unidades. Marginal negativo |
| 4 | `acos` > `acos_benchmark` (~19,6%) | **NO gatilla** | ACOS 9,65%. `acos_benchmark` tampoco es leíble (400 en ambos endpoints), así que se compara contra el número escrito, no contra el vivo — anotado como umbral envejecido |

**Veredicto de la campaña `goteros`: FRENAR el escalón**, por el freno 3.

### 4.e — La trampa que hay que no pisar

ACOS de la API 9,65% × 1,21 (la API da gasto **neto**, el P&L cobra con IVA) = **11,68%**, contra un breakeven
de Pureza de **44,65%** (corrección del 09/08/2026). TACOS: $2.441.385 / $34.290.880 = 7,12% ×1,21 = **8,62%**.

O sea: **por ACOS, la pauta se ve barata**, y el ACOS real (9,65%) está por debajo de 0,7 × el target (10,6%),
que es la condición del Playbook para *subir* presupuesto. **No hay que subirlo.** Ese es exactamente el ACOS
que tenía la campaña la semana en que el escalón dejó de pagar. El freno que manda es el que gatilla **primero**,
y el freno 3 ya gatilló. `acos_benchmark` dice si pagás peor que la categoría; no dice si el peso marginal
compra unidades. Acá no las compra.

---

## 5. Mix de packs — se movió más de 20%, va al informe

Ventanas cerradas, `ml_orders`. En ML el "2x1" del título **es** el pack de 2 (`parseMlPack`).

| Pack | Órdenes prev → act | Δ | Share órdenes | Share revenue |
|---|---|---|---|---|
| x1 | 160 → 82 | **−48,8%** | 16,0% → 11,4% | 12,6% → 8,6% |
| x2 | 646 → 442 | −31,6% | 64,5% → 61,2% | 58,6% → 52,9% |
| x3 | 151 → 141 | −6,6% | 15,1% → **19,5%** | 21,1% → **25,2%** |
| x4 | 30 → 22 | −26,7% | 3,0% → 3,0% | 5,1% → 4,7% |
| **x5** | **14 → 35** | **+150,0%** | 1,4% → **4,8%** | 2,6% → **8,6%** |

El corrimiento hacia arriba que el reporte previo detectó **siguió y se profundizó**: el x1 se derrumbó
(mitad por el bloqueo de MLA3356284130) y el x5 se triplicó. Por eso el ticket medio subió 5,4% mientras
las órdenes caían 28%.

**Ojo con la lectura fácil:** el mix "mejoró" en parte porque le rompimos la pata al x1, no porque el cliente
haya decidido comprar más. El x5 sí es crecimiento genuino y pagado (ad group 2123713882, $7.846/u marginal).

---

## 6. Cambios de precio, listing y publicaciones bloqueadas en la ventana

| Ítem | Cambio | Cuándo | Efecto |
|---|---|---|---|
| **MLA3356284130** | `active` → **`under_review` / `forbidden`** | **19/08 02:26 UTC** | Visitas a 0. −$2,75 M/semana. **La causa no está en la API** |
| MLA3692896792 | Se apagó su pauta (efecto hermanas) | 10/08 | −$3,65 M, compensado por MLA3030316544 (+$3,40 M) |
| MLA1908275639 (x4) | Precio $74.232 → **$69.778** | dentro de la ventana | Sigue `winning` su ficha; el precio nuevo **es** el `price_to_win`. No frenó la caída de unidades (27→17) |
| MLA3030316544 (x3) | Precio de venta promedio $62.742 → $60.053 | dentro de la ventana | Descuentos; el precio de lista no cambió |
| **MLA3692036796** (campeón) | **NINGUNO.** Precio $40.131 los 14 días, stock 400, `active`, sin `sub_status` | — | Su caída **no** es precio, ni stock, ni estado |
| Presupuesto campaña `goteros` | $250k (01–04/08) → $300k (05/08) → **$350k (13/08)** | 13/08 | Es el escalón que rompió el marginal |

**Publicaciones que hoy están frenadas y valen plata:** MLA3356284130 (bloqueada) y el ad group 2123732755
en HOLD. Todo lo demás está `active` y sin `sub_status`.

---

## 7. ¿Es caída nuestra o del mercado?

**Es nuestra, con una salvedad de un día.**

Evidencia contra la hipótesis de mercado/estacionalidad:

1. **El inventario de la categoría creció, no se achicó.** Nuestras impresiones disponibles subieron 36,8%
   y el SOV subió de 69,2% a 70,3%. Si la demanda de la categoría se hubiera caído, no habría 875 mil
   impresiones para comprar.
2. **El otro canal creció la misma semana.** Con la misma oferta y el mismo producto, COD hizo
   364 → 568 pedidos en Urbano (+56%), 86 → 121 en Fixy (+41%), 130 → 234 en Correo (+80%).
   Pureza no dejó de venderse: dejó de venderse **en ML**.
3. **Rompió una tendencia que subía.** Unidades totales de la campaña: 423 → 513 → 658 → 879 → 1.014 → **749**.
   Cinco semanas de crecimiento y un corte. La estacionalidad no hace eso.
4. **No perdimos ninguna caja frente a nadie**, y en la ficha del x2 no entró un solo competidor.

La salvedad: el **19/08 fue flojo en todos los canales** (172 pedidos totales del negocio vs 289 el 18/08;
ML 145 → 66, COD 144 → 106). Un día blando de mercado que se llevó unos **$1,8 M** de los $10,81 M (≈17%).

**Reparto final:** ~25% bloqueo de moderación del x1 · ~50% pérdida de tráfico y conversión del campeón x2
(paid traffic degradado + canibalización interna hacia x3/x5) · ~17% un día blando de mercado ·
resto, mix y ruido.

### 7.a — El detalle incómodo del campeón

MLA3692036796 gana la caja, tiene stock, no cambió de precio y su gasto de pauta quedó plano. Pero:

- **Visitas:** 4.491 → 4.029 (**−10,3%**)
- **Órdenes:** 602 → 420 (**−30,2%**)
- **Conversión visita→orden: 13,4% → 10,4% (−22%)**

El tráfico bajó 10% y la venta bajó 30%. Un tercio de la caída del campeón es tráfico; **dos tercios son
conversión**, y eso no lo explica ni el bloqueo ni el presupuesto.

Hipótesis a verificar **en el panel** (la API no la puede cerrar):

- El `price_to_win` de la ficha muestra `free_installments: opportunity` — es decir, **la publicación no está
  logrando el boost de cuotas sin interés** — mientras su hermana Premium MLA1830076567 lo tiene `boosted`.
  MLA3692036796 es `gold_special` (Clásica) con tag `pcj-co-funded`: las cuotas ahí vienen del programa
  co-fondeado. **Hay que mirar si el cupo de cuotas co-fondeadas del mes se agotó o se cortó.** Si se cortó,
  explica una caída de conversión sin pérdida de caja. La API no dice cuándo cambió el boost, así que esto
  es una pista, no un hallazgo.
- También figura `fulfillment: opportunity` (no estamos en Full) — es estructural, no un cambio de la semana.
- **Nada de esto autoriza a tocar la publicación**: `pcj-co-funded` de MLA3692036796 no se toca ni se clona
  sin cuotas (decisión de Pancho, 05/08/2026). Lo único que corresponde acá es **leer**, y si el cupo se
  agotó, reponerlo por el canal del programa.

---

## 8. Para hacer en el panel

> Ninguna de estas acciones se ejecutó. La escritura de Product Ads por API da **401** y este agente no
> escribe. Todo esto es para Pancho, a mano.

### Bloque A — Desbloquear el x1 (lo más urgente: ~$2,7 M por semana)

1. **Mercado Libre → Mis publicaciones → "Con problemas" → MLA3356284130**
   ("Gotas Pureza Drenaje Linfático Hinchazón Abdomen Piernas Menta").
   Estado actual: `under_review` + `forbidden`, congelada el **19/08/2026 02:26 UTC**.
   **Leer el cartel con el motivo** — la API no lo expone. Anotar la causa textual.
2. Si el motivo es la **descripción / claims**: editar el texto según el criterio vigente (decide el objeto
   del verbo: "drenaje linfático" se puede, "edema" no) y **reenviar a revisión** desde la misma pantalla.
   Si el motivo es **marca o papeles**, no editar: eso es otra conversación.
3. **Puente mientras dure el bloqueo — postular la hermana al catálogo vacío.**
   `MLA1796574515` ("1 Gotero Pureza … 30ml"): `active`, `gold_pro`, **$33.100** (mismo precio que la
   bloqueada), 922 unidades, `catalog_product_id: MLA63777933`, pero **`catalog_listing: false`** y
   `price_to_win` responde `item_not_opted_in`.
   → **Publicaciones → MLA1796574515 → "Competir por el catálogo" / postular a la ficha MLA63777933.**
   La ficha hoy está **vacía** (`/products/MLA63777933/items` → 404): entrar cuesta cero, no hay a quién ganarle.
   Es `gold_pro`, así que no hay bajada de Premium involucrada.
4. **Mercado Ads → campaña "goteros" → ad group 2123732755** ("Suplemento en aceite Lissea Cosmetics…").
   Está en **`HOLD` y gastó $18.361** en 14–20/08. **Leer el motivo del HOLD en el panel** (la API no lo da).
   Era el ad group más eficiente de la cuenta ($357 por unidad total). Reactivarlo apenas se destrabe el ítem.

### Bloque B — Frenar el escalón de la campaña `goteros` (356403999)

5. **Mercado Ads → Campañas → "goteros" → Presupuesto diario: $350.000 → $300.000.**
   Motivo: freno 3 (costo por unidad TOTAL marginal). $300k/día es el nivel de 07–13/08, que hizo
   1.014 unidades a $2.125 cada una.
6. **NO tocar el ACOS objetivo (15,15%) ni el ROAS objetivo (6,6).** Son palancas distintas: el freno acá
   es de escalón de presupuesto, no de target. Y **no subir el presupuesto** aunque el ACOS (11,68% con IVA)
   se vea lejísimos del breakeven de Pureza (44,65%) — ese fue el razonamiento que trajo el escalón que falló.
7. **Re-medir a 7 días cerrados (21–27/08)** antes de mover otra vez. Si con $300k/día las unidades TOTALES
   vuelven a ≥1.000, ése es el escalón bueno y ahí se queda hasta que el CTR se recupere.

### Bloque C — Reasignar dentro de la campaña

8. **Ad group 2616726570 (x4, MLA1908275639): bajarlo, no apagarlo.** $124.559 por 13 unidades totales
   ($9.581 c/u) con el mismo gasto que la semana previa y la mitad de unidades.
   **Cuidado:** sus unidades orgánicas son 3 (≈0) → apagar la pauta no ahorra, **cierra el x4 en el canal**.
   Bajar su participación, no matarlo.
9. **Ad group 2123713882 (x5, MLA3030521696): dejarlo como está.** Es el único donde la plata marginal compró
   unidades ($7.846/u, por debajo del freno de $12.500). CPC alto ($883) pero paga.
10. **Ad group 2477446946 (x2 campeón): mantener el gasto.** Perdió 172 unidades **con el gasto plano** —
    su problema no es presupuesto. Sigue produciendo unidades a $2.694, el mejor número de la cuenta.
11. **Ad group 2123711936 (x3, MLA3030316544): devolver los ~$80.000 que ganó esta semana.** +$79.729
    compraron −10 unidades.

### Bloque D — La conversión del campeón MLA3692036796

12. **Mercado Libre → Financiación / Cuotas → verificar si las cuotas co-fondeadas (`pcj-co-funded`) de
    MLA3692036796 siguen activas y si el cupo del mes se agotó.** El `price_to_win` la muestra con
    `free_installments: opportunity` (no logrado) mientras la hermana Premium MLA1830076567 lo tiene `boosted`.
    Si el cupo se agotó, ahí está el −22% de conversión sin pérdida de caja.
    **No clonar ni modificar la publicación** (decisión 05/08/2026): sólo reponer cupo si eso es lo que pasó.
13. **Abrir la publicación y revisar: preguntas sin responder, reseñas nuevas del período, y el bloque de
    envío/plazo de entrega.** Visitas −10% con órdenes −30% es un problema de página, no de tráfico.

### Bloque E — Lo que NO hay que hacer

14. No subir el presupuesto de `goteros` (ver 4.e).
15. No tocar el precio de MLA3692036796: está en $40.131 = `price_to_win`, gana la caja con `visit_share`
    máximo y **cero** competidores compartiendo el primer lugar. Bajarlo regala margen sin comprar nada,
    y además le apaga la pauta a sus hermanas.
16. No buscar al culpable en la competencia: en las dos fichas relevantes no hay un solo rival.

---

## 9. Supuestos, umbrales y límites de esta lectura

- **Frenos del escalón:** umbrales del 05–09/08/2026 (Playbook-ML-ProductAds-Full.md:220). El freno de
  $12.500 por unidad marginal es el 56% de una contribución medida que ya cambió una vez — **está para
  recalcular**, aunque acá no cambia el veredicto (el marginal es negativo, no "alto").
- **Breakeven ACOS:** corrección del 09/08/2026 — canal 44,7%; Pureza 44,65%.
- **Todo gasto de la API se comparó ×1,21**: la API da gasto **neto**, el P&L cobra con IVA.
- **Ventanas:** 14–20/08 vs 07–13/08, ambas cerradas. El 21/08 estaba abierto y quedó afuera de toda
  comparación de tasas.
- **Métricas que la API NO devolvió** (400 en `campaigns_metrics` y en `ads_search` para este advertiser):
  `impression_share`, `lost_impression_share_by_budget`, `lost_impression_share_by_ad_rank`, `acos_benchmark`.
  El freno 1 quedó **sin medir** — se sustituyó por SOV y por el test de presupuesto clavado, y el número
  real se lee en el panel.
- **Motivos que la API no expone:** el `forbidden` de MLA3356284130 y el `HOLD` del ad group 2123732755.
  Los dos se leen en el panel.
- **`ads/search` se llamó una sola vez por ventana y se dedupó por `item_id`** (44 filas → 44 ítems; sin
  dedupe el gasto sale ~36% inflado).
- **`available_quantity` se leyó dos veces** con minutos de diferencia en los 4 ítems que mueven la aguja.
  Sin variación: no hubo quiebre.
- **Último dato leído:** 21/08/2026 (órdenes y pauta de ese día están en las tablas de contexto pero fuera
  de las comparaciones).
