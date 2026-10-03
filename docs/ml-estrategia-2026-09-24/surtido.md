# ML — Análisis estratégico de SURTIDO
**Fecha de lectura: 24/09/2026 ~15:00 ART.** Todo por API autenticada (`scripts/_ml.mjs`) y Supabase.
Ventanas: **30 días cerrados** (25/08→23/09) para economía unitaria, **14 días cerrados** (10/09→23/09)
para juzgar ítems (candado de ventana). El 24/09 es día ABIERTO y no se compara.
**Nada de esto se ejecuta.** Son veredictos + pasos para el panel.

Leyenda: **[M] medido** por API/base hoy · **[E] estimado** (modelo con inputs medidos) · **[S] supuesto**
(sin dato; hay que confirmarlo antes de gastar plata).

---

## 0. Modelo de contribución usado (todo [M] salvo donde diga)

Calibrado contra los 4.589 pedidos Pureza de 30 días:

| Componente | Valor | Fuente |
|---|---|---|
| Comisión gold_special (Clásica) | **20,22%** del ticket | [M] `avg(sale_fee)/avg(total_amount)` sobre 3.211 órdenes de `MLA3692036796` |
| Comisión gold_pro (Premium) | **24,18%** | [M] 428 órdenes de `MLA1830076567` |
| Cargo fijo bajo $33.000 | **+$3.320** | [M] `/sites/MLA/listing_prices` — salta exacto en $33.000 (a $32.999 fee 25,56%, a $33.000 fee 15,50%) |
| Flete | $7.117 (x1/x2) · $7.716 (x3 cat) · $8.269-8.631 (x3-x5) | [M] `avg(ship_cost)` por ítem |
| Percepciones | **8,47%** del ticket | [M] `ml_percepciones` 14d = $9.240.347 sobre $109.036.488 facturados |
| Retención (`tax_withheld`) | ~1,61% | [M] promedio por ítem |
| COGS | `product_costs` (product_id 2 = Pureza): x1 $2.500 · x2 $4.500 · x3 $7.000 · x4 $10.000 · x5 $12.500 | [M] `is_estimated=false` |
| Ads/orden | medido por ítem, `ml_ad_spend_item` 30d ÷ órdenes 30d | [M] |

> **Nota de reconciliación:** con este modelo el x2 Clásica a $33.231 da **$9.114** de contribución;
> el brief traía **$8.535**. La diferencia (6,8%) es comisión 20,22% medida vs 20,79% del brief y
> ads $2.431 vs $2.800. **Uso el modelo medido**, pero ninguna conclusión de abajo cambia de signo
> con el número del brief.
>
> ⚠️ **El teórico de `/listing_prices` (15,5% / 28,9%) NO se usa para nada** salvo el escalón de
> $3.320, que sí está verificado. La brecha teórico↔real es enorme y en sentidos opuestos según el
> tipo de publicación.

---

## 0.bis Foto del negocio hoy [M]

Órdenes/día por ítem (`ml_orders`, días cerrados):

| día | x2 Clásica `MLA3692036796` | x2 Premium `MLA1830076567` | x3 catálogo `MLA2055177767` | x3 libre `MLA3030316544` | x4 `MLA1908275639` | x5 `MLA3030521696` | x1 (3 ítems) | TOTAL |
|---|---|---|---|---|---|---|---|---|
| 14/09 | 184 | 15 | 17 | 8 | 18 | 6 | 4 | **255** |
| 16/09 | 133 | 10 | **30** | 16 | 18 | 6 | 5 | **221** |
| 19/09 | 166 | 8 | 5 | 3 | 10 | 1 | 3 | **199** |
| 21/09 | 135 | 9 | 8 | 8 | 17 | 1 | 1 | **181** |
| 23/09 | 116 | 3 | **3** | 7 | 17 | 1 | 1 | **149** |

Confirma lo del brief: el x3 de catálogo cayó 30→3 y el x4 está firme/creciendo (17/día).
El 11-13/09 hubo el swap Clásica↔Premium (la Clásica cayó a 7-12/día y la Premium tomó 86-111).

**Stock leído DOS veces** (17:56:52 y 18:00:18 UTC): idéntico en los 8 ítems clave, sin oscilación.
Runway del ítem que más vende (`MLA3692036796`, 2.994 u a ~121 órdenes/día de 14d) ≈ **24 días**. No hay quiebre.

**Reputación: `5_green` / `platinum`**, reclamos 0,4%, cancelaciones 0,0%, demoras 0,16% (60d) [M].

---

## 1. Fichas de catálogo de Pureza donde NO estamos

Barrido completo de `/products/search` en MLA-SUPPLEMENTS filtrando marcas `Pureza`, `Pureza Drops`
y `Lissea Cosmetics`, más los hijos de los 4 parents de nuestras fichas. **Resultado: 12 fichas
vivas de nuestro producto. Estamos en 3.**

Visitas 14d medidas ítem por ítem con `/items/{id}/visits/time_window` — **esto sí funciona para
ítems ajenos** (el `/items/{id}` da 403, las visitas no). Es la primera vez que se mide volumen de
la competencia sin abrir el sitio.

| Ficha | u × mL | Estamos | Ofertas hoy | Visitas 14d de la ficha | Veredicto |
|---|---|---|---|---|---|
| `MLA70304457` | 2 × 30 mL Menta | **SÍ** (`MLA3692036796` $33.231 · `MLA1830076567` $33.396) | 7 | n/d (las nuestras: 15.062 + 3.421) | en guerra, ya decidido |
| `MLA77148723` | 3 × 30 mL | **SÍ** (`MLA2055177767` $42.290) | 6 | 3.040 nuestras + 260 ajenas | bloqueada `reputation_limit_reached` |
| `MLA74008314` | 4 × 30 mL | **SÍ** (`MLA1908275639` $51.990) `winning` | 3 | 2.534 nuestras + 551 (AMOKSALUD $52.662) | ganando |
| **`MLA78387413`** | **2 × 30 mL "Neutro" (60 mL total)** | **NO** | 3 (SUPLESANO $36.075 · AMOKSALUD $37.665 · SCHIAFFINO $37.739) | **135/14d** (~10/día) | ⚠️ **vigilar** — ver la retractación del §3 |
| **`MLA74348054`** | **2 × 30 mL Menta "2 Meses"** | **NO** | 1 (TB2026… $44.000) | **252** | 🟢 **entrada limpia, sin fricción** |
| `MLA63777933` | 1 × 30 mL (marca *Lissea*) | **NO** — `item_not_opted_in` | 2 (OSMARPEREIRA810 $19.999 · SUPLESANO $32.297) | 290 | 🟡 caja chica, y entrar rompe la escalera |
| `MLA70118173` | 1 × 30 mL (*Lissea*, 100 g) | **NO** | 2 ($20.500 · $35.000) | 113 | ignorar |
| **`MLA75683261`** | **1 × 59 mL Limón** | **NO** | 2 (GJ2025… $27.000 · **SOMOSPUREZA $49.990**) | **1.470** (1.271 de SOMOSPUREZA) | 🔴 **la ficha del 60 mL — ver §2** |
| **`MLA74023323`** | **4 × 59 mL (236 mL) Limón** | **NO** | 1 (SOMOSPUREZA $95.500) | **570** | 🔴 ídem, versión pack |
| `MLA72659010` | 1 × 50 mL Menta ("Vitaly") | **NO** | **0** | 0 | ficha vacía de nuestra propia familia |
| `MLA79731271` | 4 × 30 mL Menta Gotero (creada 22/09) | **NO** | **0** | 0 | ficha vacía, atributos idénticos a los nuestros |
| `MLA79197376` | 2 × ? Clorofila+Menta (creada 11/09) | **NO** | **0** | 0 | ficha vacía |

### 1.a ¿Los sellers de esas fichas son los revendedores de `ml-revendedores-escalera-packs`? [M]

Sí, y ahora tienen nombre y nivel:

| Seller | Nickname | Nivel | Transacciones | Dónde aparece |
|---|---|---|---|---|
| 154632427 | **AMOKSALUD** | 5_green **platinum** | — | x3 ($42.400), x4 ($52.662), **60mL-x2 ($37.665)** |
| 725048253 | **SUPLESANO** | 5_green | — | x1 ($32.297), 60mL-x2 ($36.075) |
| 1104504205 | **SCHIAFFINOROMINA…** | 5_green | — | x3 ($47.108), 60mL-x2 ($37.739), 1×30mL ($20.500) |
| 709740765 | **DAILYGUMMIES123** | 5_green gold | — | x2 ($34.920), x3 ($50.000), 1×30mL ($35.000) |
| 2442043812 | GJ20250514165400 | 4_light_green | 403 | x2 ($22.000), x3 ($50.000), **59mL ($27.000)** |
| 482840666 | **SHARP3R** | 5_green | — | **el que nos ganó la caja x2** ($33.000) |
| 119069830 | OSMARPEREIRA810 | 5_green **platinum** | — | x1 ($19.999) — el que NO se abastece con nosotros |
| 230785875 | **SOMOSPUREZA** | 5_green **platinum** | **5.286** | 59 mL x1 ($49.990) y 4×59 mL ($95.500) |
| 2953648686 | KLOVER | 5_green platinum | — | x2 ($35.517) |
| 3486600795 | TB20260620191325 | 5_green | — | x4 ($69.000), **x2 `MLA74348054` ($44.000)** |

⚠️ **Corrección a la memoria:** en `ml_orders` de los últimos 90 días **`ROMA2461551` ya no compra**
(último dato de esa memoria: 31/08). El comprador-revendedor vivo hoy es **`CESORQUERA` (id 70080728):
4 órdenes, 10 unidades, $844.982, todas pack x5, última 18/09** [M]. El resto de los compradores
repetidos son packs x2 y montos chicos (consumo real, no reventa). **El canal mayorista encubierto se
achicó**, es ~$845k/90d de un solo comprador, no $450k/semana.

### 1.b Veredicto por ficha

#### 🔴 A — `MLA78387413` (x2 declarada "60 mL / Neutro"): **la más grande, y la más delicada**

**Qué es [M]:** una ficha DUPLICADA de nuestra `MLA70304457`, creada el **26/08/2026**, que describe
exactamente nuestro producto — `INGREDIENTS = "Agua purificada, Clorofila, Extractos herbales,
Sorbato de potasio"`, que coincide con la fórmula real (ver memoria `pureza-formula-clorofila`), y
`SERVING_VOLUME = 30 mL`, `UNITS_PER_PACK = 2` — pero catalogada como **`FLAVOR = Neutro`** y con
`NET_VOLUME = 60 mL` (el total del pack, no el del frasco).

**Cuánto mueve [M]: ~10 visitas/día, no 450.** ⚠️ **RETRACTADO el 24/09/2026 por el hilo principal.**

La medición original decía "6.304 visitas en 14 días = 450/día" y concluía que "esa ficha es el 42%
del tráfico de nuestro ítem más vendido". **Las dos afirmaciones son falsas, por un error de
atribución:** `/items/{id}/visits/time_window` mide las visitas del **ÍTEM**, y un ítem compite en
varias fichas a la vez. De las 6.304 visitas, **6.173 son de un solo ítem — `MLA3930680104`
(AMOKSALUD, seller 154632427) — que también compite en la ficha del x3 (`MLA3888506188` a
$42.400)**. Esas visitas son de toda su actividad, no de esta ficha.

Las otras dos ofertas de la ficha suman **135 visitas en 14 días** (80 + 55). Contra las **15.065**
de nuestra `MLA3692036796`: la ficha mueve **~1% de nuestro tráfico, no el 42%**.

**Consecuencia:** el veredicto "🔴 la oportunidad más grande" de la tabla del §2 **no se sostiene**,
y con él se cae la urgencia de pedir la fusión de ficha. Los tres revendedores venden ahí a
$36.075–37.739, **más caro que nuestros $33.231**. Queda como algo a **vigilar** — una ficha
duplicada con nuestro producto puede crecer — no como acción.

**Lo que sí queda en pie de este hallazgo, y es valioso:** `/items/{id}/visits/time_window`
**responde para ítems ajenos** aunque `/items/{id}` dé 403. Es la primera vez que se mide volumen de
un competidor por API sin abrir el sitio. La trampa es la de arriba: mide el ítem, no la ficha.

**Economía si entramos [E]** (modelo §0, gold_special, ads $2.431/orden):
- a $37.665 (empatar al ganador): **$12.205/orden (32,4%)** — vs $9.114 del x2 a $33.231
- a $36.000 (ganar la caja por precio): **$11.044/orden (30,7%)**

**Volumen [E], con banda ancha a propósito:** 441 visitas/día del ganador actual. Nuestra conversión
medida en x2 es 11,28%, la de AMOKSALUD es desconocida. Si capturáramos la caja y la mitad del
tráfico convirtiera como el nuestro: **+10 a +25 órdenes/día**. A $11.044-12.205 de contribución son
**+$110k a +$305k/día**. Es la mayor oportunidad del informe por un factor de 3.
**[S]** Cuánto de eso es incremental vs canibalización del x2: desconocido. El indicio a favor es que
esas 441 visitas/día hoy compran a $36-37,7k teniendo nuestra oferta a $33.231 en otra ficha — no nos
están viendo. **[S]** Tampoco sé cuánto de esas 6.172 visitas es Product Ads de AMOKSALUD.

**Qué la bloquea:** para publicar ahí hay que declarar `FLAVOR = Neutro` y nuestro producto es
**Menta**. Declarar un atributo falso en catálogo es exactamente el flanco por el que nos comimos la
represalia del 29/07 (`ml-guerra-catalogo`). **No lo recomiendo como primer paso.**
**El camino limpio es pedirle a ML la corrección/fusión de la ficha duplicada** — es una gestión de
calidad de catálogo contra la FICHA, no una denuncia contra un vendedor, así que no dispara el
mecanismo de represalia que describe `ml-revendedores-escalera-packs`. Si ML la fusiona con
`MLA70304457`, esas 450 visitas/día caen dentro de la pelea que ya estamos dando.

#### 🟢 B — `MLA74348054` (x2 Menta "2 Meses"): **entrada limpia, hacerlo esta semana**

**Qué es [M]:** hermana de `MLA74008314`, la ficha del x4 donde YA ganamos. Atributos:
`BRAND=Pureza Drops`, `FLAVOR=Menta`, `NET_VOLUME=30 mL`, `UNITS_PER_PACK=2`, `PACKAGING_TYPE=Gotero`.
**Todo coincide con nuestro producto real** — no hay que mentir ningún atributo.

**Quién está [M]:** una sola oferta, `MLA3876993780` de TB20260620191325 a **$44.000**, con
**252 visitas/14d (18/día)**.

**Economía [E]:** a $43.999 → **$16.619/orden (37,8%)**. Es **+82% de contribución por orden** contra
el x2 de la guerra de catálogo. A 18 visitas/día y conversión 10% → **~1,8 órdenes/día = ~$30k/día**.
Chico en volumen, pero es el mejor margen por orden de todo el surtido de 30 mL y el costo de
entrada es una publicación.

**Qué la bloquea:** nada. Ya tenemos dos publicaciones x2 gold_pro **sin usar** apuntadas a
`MLA70304457` y `item_not_opted_in` (`MLA3030316354`, `MLA3030366476`) — el inventario de
publicaciones ya existe.
⚠️ Pero ojo: esos dos ítems venden hoy 7 órdenes/14d **cada uno, con CERO ads y 40-42% de
contribución**. No se tocan (`no-tocar-lo-que-ya-funciona`): la entrada a `MLA74348054` va con
**publicación nueva**.

#### 🟡 C — `MLA63777933` (x1 30 mL): **NO entrar**

Caja chica (290 visitas/14d entre las 2 ofertas = 21/día) y el ganador está a $19.999.
Entrar a $32.297 da **$7.143/orden (22,1%)** [E] — peor que el x2 de hoy — y para eso hay que bajar
el x1 de $38.900 a ~$32.000, que es **exactamente el spread que sostiene la escalera** contra la
reventa. **El costo supera al premio por un orden de magnitud.** Ver §2, que resuelve esta demanda
por otro lado.

#### ⚪ D — Fichas vacías (`MLA79731271` x4 Menta, `MLA79197376` x2 Clorofila, `MLA72659010` 50 mL)

`MLA79731271` (creada 22/09) tiene atributos idénticos a los nuestros y **cero ofertas**: se gana la
caja sin pelear. Pero **una ficha sin tráfico no vale nada** — 0 visitas medidas. Y aplica la trampa
de `ml-alta-catalogo-ventana-y-descripcion`: 2 h invisible + hereda la descripción del producto.
**Veredicto: sumarlas como relleno de una tanda ya planificada, nunca como tarea propia.**

---

## 2. El frasco de 60 mL — ¿sigue siendo cierto? **SÍ, y hoy está mejor documentado que en agosto**

`pacurie` no tiene ficha de catálogo y `/sites/MLA/search` da **403** (memoria
`ml-bloquea-acceso-automatizado`), así que no se lo pudo datar directo. **Pero apareció el mismo
patrón con nombre y ficha: `SOMOSPUREZA` (id 230785875), 5_green platinum, 5.286 transacciones,
vendiendo bajo LA MARCA "Pureza" en dos fichas propias.**

### $/mL medido hoy, 24/09/2026 [M]

| Oferta | contenido | precio | **$/mL** | visitas 14d |
|---|---|---|---|---|
| **SOMOSPUREZA x1** `MLA3909088418` | 59 mL | $49.990 | **$847** | **1.271** |
| **SOMOSPUREZA x4** `MLA3657728580` | 236 mL | $95.500 | **$405** | 570 |
| GJ2025… x1 `MLA3855454258` (sin envío gratis) | 59 mL | $27.000 | $458 | 199 |
| SOLURE x1 `MLA3955755930` | 50 mL | $44.910 | $898 | **1.252** |
| SOLURE x3 `MLA3978505084` | 150 mL | $89.900 | $599 | — |
| LINFATIC x2 `MLA2035646457` | 120 mL | $65.115 | $543 | — |
| **nuestro x1** `MLA1796638415` | 30 mL | $38.900 | **$1.297** | 677 |
| **nuestro x2** `MLA3692036796` | 60 mL | $33.231 | $554 | 15.062 |
| nuestro x5 `MLA3030521696` | 150 mL | $84.498 | $563 | 843 |

**La afirmación de la memoria se confirma al número: $1.297 ÷ $847 = 1,53 → nos ganan 53% en $/mL en
el x1.** Exactamente la misma cifra del 20/08, un mes después. **No es un dato viejo.**

### Lo que cambió desde el 20/08 y obliga a reformular el caso

En agosto nuestro x2 valía $40.131 y el caso era "60 mL a $49.990 contra 2 Gotero a $40.131".
**Hoy el x2 vale $33.231** por la guerra de catálogo — un 60 mL a $49.990 costaría **50% más que
nuestros propios 60 mL en dos frascos**. Si se lo mira como precio-por-mL dentro de nuestra propia
góndola, el caso ya no cierra.

**Pero ese no es el caso.** El caso correcto, con el dato nuevo, es éste:

> El estante de **"1 unidad"** mueve tráfico real que nosotros no podemos monetizar sin destruir la
> escalera de packs. Medido: nuestros tres x1 juntan **2.687 visitas/14d = 192/día** y convierten al
> **1,2-1,8%** — contra 11,28% del x2 — *porque los tenemos deliberadamente caros* ($38.900 por un
> frasco cuando dos cuestan $33.231). Son 190 visitas/día tiradas a la basura todos los días.
> Enfrente, SOMOSPUREZA + SOLURE se llevan **2.523 visitas/14d** de ese mismo estante a $847-898/mL.
>
> **Un frasco de 60 mL es la única forma de cobrar ese tráfico sin abrir arbitraje**, porque un
> revendedor no puede partir un frasco de 60 mL en dos de 30 mL. Rompe la relación 1:1 entre
> "unidades" y "frascos" que es lo que hoy nos obliga a elegir entre volumen y defensa de precio.

### Economía [E] (COGS del frasco de 60 mL **supuesto en $3.750** — ver bloqueos)

| Escenario | precio | contribución/orden | % |
|---|---|---|---|
| 60 mL x1 a $44.910 (precio SOLURE) | $44.910 | **$18.021** | 40,1% |
| 60 mL x1 a $49.990 (precio SOMOSPUREZA) | $49.990 | **$21.562** | 43,1% |
| 60 mL x2 a $79.990 | $79.990 | **$36.553** | 45,7% |
| *(referencia: x2 30 mL hoy a $33.231)* | $33.231 | *$9.114* | *27,4%* |

**+98% a +137% de contribución por orden** contra el x2 de hoy. La memoria decía +48% contra el x2
de agosto; contra el x2 de hoy, deprimido por la guerra de catálogo, **el salto es el doble**.

**Volumen [E]:** las dos ofertas de 59-50 mL que hoy se reparten ese estante juntan **180 visitas/día**.
A conversión 6% (mitad de la nuestra en x2, por precio alto) → **~10 órdenes/día**. A $18.021 →
**~$180k/día de contribución**, sin tocar un solo precio existente y sin darle un frasco de 30 mL más
a ningún revendedor.

### Qué lo bloquea (en orden de dureza)

1. 🔴 **RNPA del formato nuevo.** Es el techo del canal, no un trámite (`ml-productos-bloqueados-papeles`;
   la barrida del 11/03/2026 con denunciante literal "ANMAT" se llevó 17 publicaciones en un minuto).
   **Pregunta concreta a hacer: ¿el RNPA vigente de Pureza cubre un envase de 60 mL del mismo producto,
   o hay que iniciar registro nuevo?** En muchos casos el registro es por fórmula y el envase es una
   modificación menor — pero **no lo sé y no se puede leer por API**.
2. 🟡 **Costo real del frasco de 60 mL: NO MEDIDO.** Los $3.750 de arriba son **[S]** (1,5× el gotero
   de 30 mL). Hay que pedírselo al tercerista. El caso aguanta holgado: aun a $7.500 de COGS el 60 mL
   a $44.910 deja $14.271/orden, +57% sobre el x2.
3. 🟡 **Ranking cero.** `ml-guerra-catalogo`: el ranking es del ítem, no de la caja. Una publicación
   nueva de 60 mL **nace sin historial** y hay que empujarla con Product Ads (esto NO es una excusa
   para no hacerlo: es un costo de arranque que el modelo ya carga con $2.431/orden de ads).
4. ⚪ La ficha ya existe: **`MLA72659010`** (1 × 50 mL Menta, familia `Lissea`, **0 ofertas**) y
   `MLA75683261` (1 × 59 mL Limón). Si el frasco fuera de 50 mL se entra a una ficha vacía de
   nuestra propia familia sin pelear caja.

---

## 3. Productos de la casa que NO están en ML

### 3.a Lo que hay pausado en ML hoy [M] — 27 publicaciones pausadas, 2 cerradas, **0 en `under_review`**

| Producto | publicaciones pausadas | ventas históricas | `sub_status` | pedidos COD últimos 30d |
|---|---|---|---|---|
| **BeeVenom** | 2 ($39.980 x1, $54.990 x2) | 12 | `[]` | **456 órdenes / $10,81M** |
| Caranvi | 5 ($38.980 a $74.990) | 93 | `[]` | **0** |
| Clorofila | 5 ($34.890 a $64.890) | 25 | `[]` | **0** |
| Bronceador | 4 ($33.490 a $68.990) | 2 | `[]` | **0** |
| Aetheria (crema facial retinol) | 1 ($49.990) | 0 | `[]` | **0** |
| Natures | 5 | 284 | `paused_by_seller` | 0 (baja por marca) |
| Altus | 1 | 0 | `[]` | 5 (residual) |
| M3 | 0 en ML | — | — | 3 |

> **Dato nuevo y relevante:** `sub_status` viene **`[]` en todas** y `under_review` está **en cero**.
> En julio había 25 publicaciones en `under_review/["forbidden"]`. **La API no muestra hoy ningún
> bloqueo de moderación activo** — el endpoint `/moderations/infractions/users/{id}` devuelve 404.
> O sea: **[M]** están pausadas, punto; **[S]** que el motivo sea RNPA viene de lo que dijo Pancho
> el 29/07, no de una lectura de hoy. **El motivo del pause se lee en el panel, no por API.**

### 3.b El único producto con demanda probada fuera de ML es **BeeVenom**

**[M]** BeeVenom hace **456 pedidos / $10,81M en 30 días en COD** (15,2/día: 376 del x2, 79 del x3,
1 del x1) y **$0 en ML**. Todos los demás pausados venden **cero en COD también** — o sea para
Caranvi, Clorofila, Bronceador y Aetheria **el cuello no son los papeles, es que no hay demanda en
ningún canal**. Eso corrige el énfasis de `ml-productos-bloqueados-papeles`: los papeles bloquean 5
SKUs, pero **sólo 1 de esos 5 tiene demanda que valga el trámite**.

**Calibración ML↔COD [M]:** en Pureza el ratio es ~1:1 (ML 4.589 órdenes/30d vs COD 4.676) — ML
replica casi exactamente el volumen COD del mismo producto. Aun descontando fuerte por ser un
producto sin historia en ML: **[E] 4 a 8 órdenes/día**.

**Economía [E]** (COGS de `product_costs` product_id 4: x1 $6.000, x2 $6.000, x3 $8.500):
- BeeVenom x2 a $54.990 (el precio de su propia publicación pausada): **$22.328/orden (40,6%)**
- BeeVenom x1 a $39.980: **$11.966/orden (29,9%)**

A 5 órdenes/día del x2: **~$112k/día = ~$3,3M/mes de contribución.** Coincide con el $12.710 netos/
pedido de la memoria `beevenom-plan-5m` en orden de magnitud (aquel número es post-entrega COD, éste
es ML sin tasa de entrega — en ML se cobra el 100%, que es justamente por qué ML paga mejor).

**Veredicto: BeeVenom es la única alta de producto nuevo que vale la pena pedir, y su bloqueo es un
papel, no una decisión.** Lo que hay que hacer no es "publicar": es **averiguar si está bloqueado y
por qué** (el panel lo dice, la API no) y, si es RNPA, la pregunta a David/Genus que quedó sin hacer
desde el 30/07.

### 3.c Arraigo: el producto que SÍ está y no funciona [M]

4 publicaciones activas, **225 visitas/14d**, **2 órdenes/14d**, y **$26.851 de ads en 14 días**
(`MLA1972685043` solo: $15.454 con **0 ventas**). Costo por unidad = **$13.425**, arriba del freno de
$12.500 (Playbook, 05-09/08/2026). En COD hace 23 órdenes/30d. **No es un problema de surtido —
es pauta quemándose en un ítem sin conversión.** Va al informe semanal de ads, no a éste, pero
señalarlo acá porque la respuesta a "¿qué producto nuevo sumamos?" tiene que empezar por "ninguno
mientras el último que sumamos gasta $1.918/día para vender 0,14 unidades/día".

---

## 4. Variantes dentro de las publicaciones que ya venden

**[M] Resultado tajante: las 24 publicaciones activas tienen `variations: []`. CERO. Ninguna.**
Sabor, volumen y unidades viven como **atributos del ítem** (`FLAVOR`, `NET_VOLUME`, `UNITS_PER_PACK`),
no como variaciones, así que cada aroma es hoy una publicación separada — Revival Oil ya funciona
así: `MLA1707704557` Lavanda, `MLA3064229842` Pack X2 Lavanda, `MLA3133329950` 3u Limón,
`MLA3672753182` Pack X4 Limón.

### ¿Suman o canibalizan? — **canibalizan, y hay evidencia directa**

La contribución **por frasco** cae monótonamente al subir el pack [M, 30d]:

| ítem | pack | contribución/orden | **contribución por frasco** | órdenes 30d |
|---|---|---|---|---|
| `MLA1796638415` | x1 | $13.891 | **$13.891** | 31 |
| `MLA1796574071` | x1 | $13.223 | **$13.223** | 41 |
| `MLA3030316354` | x2 (libre, 0 ads) | $19.539 | **$9.769** | 11 |
| `MLA3030366476` | x2 (libre, 0 ads) | $17.928 | **$8.964** | 16 |
| `MLA3030316544` | x3 (libre) | $18.263 | **$6.088** | 305 |
| `MLA3692036796` | x2 (catálogo) | $12.020 | **$6.010** | 3.211 |
| `MLA3030521696` | x5 | $24.932 | **$4.986** | 87 |
| `MLA1696317995` | x4 | $18.099 | **$4.525** | 9 |
| `MLA1908275639` | x4 (catálogo) | $16.357 | **$4.089** | 234 |

Cada escalón nuevo de pack **le saca margen por frasco al escalón anterior** y le abre otra puerta al
arbitraje de reventa. Dos consecuencias:

- **NO agregar un x6.** `product_costs` ya tiene la fila (`product_id=2, pack=6, $15.000`, marcada
  `is_estimated=true`) — o sea alguien lo pensó. A $99.990 gold_pro daría $30.833/orden [E] pero
  **$5.139 por frasco**, por debajo del x2 y del x3, con $11.000/orden de ads (los del x5 medidos) y
  alimentando directamente al único revendedor vivo (`CESORQUERA`, que compra x5). **Veredicto: NO.**
- **NO agregar aromas nuevos a Pureza.** Con 0 variaciones en toda la cuenta, un aroma nuevo es una
  publicación nueva con ranking cero que compite contra `MLA3692036796` (11,28% de conversión, 15.062
  visitas/14d). Es el caso de manual de `no-tocar-lo-que-ya-funciona`.
- ✅ **Lo que sí cambiaría el cuadro son las VARIACIONES de verdad**, que hoy no usamos en ningún lado:
  una sola publicación con variación por tamaño (30 mL / 60 mL) **concentra el ranking en un ítem
  en vez de repartirlo**. Es la forma correcta de lanzar el 60 mL de §2 sin nacer con ranking cero.
  **[S]** No verifiqué si `MLA-SUPPLEMENTS` admite `NET_VOLUME` como atributo de variación — hay que
  chequear `/categories/MLA8830/attributes` antes de diseñarlo así.

### Dato colateral para el listing, ya que estaba a la vista [M]

**Las 24 publicaciones activas tienen `video_id: null`.** Las 25 de agosto también. Un mes después
sigue igual, y `SOMOSPUREZA` — el que nos gana 53% en $/mL — tiene video. Fotos: entre 5 y 12
(`MLA1908275639`, el x4 que está `winning` y creciendo, tiene **5**, el mínimo de la cuenta).

---

## 5. Tabla de oportunidades — volumen, profit y bloqueo

Ordenadas por contribución/día estimada.

| # | Oportunidad | Vol/día [E] | Contrib/orden [E] | Contrib/día [E] | Qué la bloquea | Esfuerzo |
|---|---|---|---|---|---|---|
| 1 | **Ficha `MLA78387413`** (x2 "60 mL/Neutro", 450 visitas/día) | 10-25 | $11.044-12.205 | **$110k-305k** | `FLAVOR=Neutro` ≠ nuestro Menta → hay que pedir fusión de ficha a ML, no publicar de prepo | medio |
| 2 | **Frasco de 60 mL** (estante "1 unidad", 180 visitas/día enfrente + 192/día propias desperdiciadas) | ~10 | $18.021-21.562 | **~$180k** | **RNPA del envase nuevo** (duro) + costo del frasco no medido | alto |
| 3 | **BeeVenom en ML** (456 pedidos/30d probados en COD) | 4-8 | $22.328 (x2) | **$90k-180k** | **RNPA** — y primero hay que leer en el panel por qué está pausado | alto |
| 4 | **Ficha `MLA74348054`** (x2 Menta, 1 sola oferta a $44.000) | ~1,8 | $16.619 | **~$30k** | **nada** — atributos idénticos a los nuestros | bajo |
| 5 | Fichas vacías `MLA79731271` / `MLA79197376` / `MLA72659010` | 0 hoy | — | $0 hoy | tráfico cero; sólo vale como relleno de tanda | bajo |
| — | ~~x1 en caja `MLA63777933`~~ | 2 | $7.143 | $14k | **rompe la escalera de packs** por menos plata que el x2 de hoy | — |
| — | ~~x6~~ | — | $30.833 | — | $5.139/frasco: **peor que el x2**; alimenta la reventa | — |
| — | ~~Caranvi / Clorofila / Bronceador / Aetheria~~ | — | — | — | **0 demanda en COD también** — no es problema de papeles | — |

---

## Para hacer en el panel (por ítem, con su número)

1. **`MLA74348054` — publicación nueva x2 Menta.** Mercado Libre → Catálogo → buscar la ficha
   `MLA74348054` ("Pureza Drenaje Linfático Gotas Orgánicas Hinchazon 2 Meses Menta") → "Vender en
   esta ficha" → **Clásica (gold_special)**, precio **$43.999** (el único competidor está a $44.000),
   envío gratis ON, stock del mismo depósito que `MLA3692036796`.
   ⚠️ **NO reutilizar** `MLA3030316354` ni `MLA3030366476`: venden 7 órdenes/14d cada uno con 0 ads y
   40% de contribución. Publicación NUEVA. Esperar las 2 h de invisibilidad antes de asustarse
   (`ml-alta-catalogo-ventana-y-descripcion`).
2. **`MLA78387413` — pedir corrección de ficha a ML.** Panel → la ficha → "Sugerir cambios" /
   "Reportar problema en la ficha": es un **duplicado** de `MLA70304457` con `FLAVOR=Neutro` mal
   cargado (nuestro producto es Menta) y `NET_VOLUME` cargado como total del pack (60 mL) en vez de
   por unidad (30 mL). Pedir **fusión con `MLA70304457`**.
   **Es contra la ficha, no contra un vendedor** — no dispara la represalia del 29/07.
   **No publicar ahí declarando "Neutro" mientras esto no se resuelva.**
3. **`MLA2055177767` — el reclamo del x3, con el dato que lo gana.** Al reclamar por
   `reason: reputation_limit_reached`, adjuntar que la cuenta está en **`5_green` / `platinum`**, con
   **0,4% de reclamos, 0,0% de cancelaciones y 0,16% de demoras** a 60 días (leído por API hoy). El
   motivo que da la API **se contradice con nuestra propia reputación**. Sumar que el ítem cayó de
   **30 órdenes/día (16/09) a 3 (23/09)** siendo el **más barato de su ficha** ($42.290 vs ganador
   $47.108, que tiene **3 visitas en 14 días**).
4. **Preguntar por el RNPA — una sola pregunta, dos respuestas que destraban $270k-360k/día.**
   (a) ¿El registro vigente de Pureza cubre un envase de **60 mL** del mismo producto o hay registro
   nuevo? (b) ¿Qué falta exactamente para **BeeVenom** (456 pedidos/30d en COD, **$0 en ML**)?
   Y la pregunta a **David (DT de Genus)** que quedó pendiente desde el 30/07.
5. **Pedirle al tercerista el costo del frasco de 60 mL.** Es el único input **[S]** del caso del
   60 mL. El caso aguanta hasta $7.500 de COGS, así que la respuesta casi seguro es "sí".
6. **`MLA1972685043` (Arraigo x1) — frenar la pauta.** $15.454 en 14 días, **0 ventas**. El conjunto
   Arraigo está en **$13.425 por unidad**, arriba del freno de $12.500. Es el ad group, no la
   publicación: la publicación puede quedar activa.
7. **NO hacer:** x6 · aromas nuevos de Pureza · entrar al x1 de catálogo `MLA63777933` · dar de alta
   Caranvi/Clorofila/Bronceador/Aetheria.

---

## Supuestos y fechas

Frenos del escalón (05-09/08/2026) · breakeven por producto (09/08/2026) · gasto API ×1,21 (IVA) ·
ventana 30 días cerrados para economía unitaria y **14 días cerrados para juicio de ítem** ·
comisiones medidas 20,22% / 24,18% (30d al 23/09/2026) · percepciones 8,47% (14d al 23/09/2026) ·
escalón de $3.320 bajo $33.000 verificado en `/sites/MLA/listing_prices` hoy ·
COGS de `product_costs` (`is_estimated=false` salvo pack 6 y Revival/Arraigo) ·
COGS del frasco de 60 mL **$3.750 SUPUESTO** · último dato leído: **24/09/2026 18:00 UTC**.

**Umbrales que pueden estar viejos:** el freno de $12.500/unidad es del 05-09/08/2026 y se calculó
sobre una contribución que ya cambió — hoy el x2 catálogo contribuye **$9.114/orden**, así que
$12.500 es **137% de la contribución del producto principal**, no el 56% original. **Ese freno está
desactualizado y hay que recalcularlo** antes de usarlo para decidir nada que no sea Arraigo (donde
sobra margen de error).

**Lo que NO se pudo leer:** motivo del pause de BeeVenom/Caranvi/Clorofila/Bronceador (la API da
`sub_status: []`, el panel lo dice) · motivo real del `reputation_limit_reached` · si las 6.172
visitas de AMOKSALUD son orgánicas o Product Ads · `/sites/MLA/search` (403) · `/highlights` (403) ·
`/moderations/infractions/users/{id}` (404).

**Scripts de esta lectura:** `/Users/franciscoandreudegasperi/Downloads/ProyectoEco/scratch/s1.mjs`
a `s35.mjs` (efímeros, borrables).
