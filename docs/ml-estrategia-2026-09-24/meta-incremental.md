# Meta: dónde hay volumen y profit que hoy NO capturamos

**Fecha:** 24/09/2026 · **Alcance:** solo lectura (Graph API v25.0, base ProyectoEco, vault).
**Incremental a** `docs/escalado-2026-09-25.md`. Nada de acá reemplaza E1/E2/E3: lo que sigue es lo que ese plan **no** cubre.
**Ventana anclada:** 17/09–23/09/2026 para Meta; 25/08–23/09/2026 para ventas; cohorte de despacho 01/08–31/08/2026 para tasa de entrega.

---

## 0. Resumen

1. **El freno del plan es la caja, y hay $59.655/día de plata mal puesta dentro de la propia flota** que se recicla sin pedirle un peso a la caja ARS. Cubre un tercio del E2. (ARRAIGO pierde plata medida en los dos canales; `beevenom-FIXY` cuesta 3,24× su hermano.)
2. **No hay saturación de audiencia.** Reach de 30 días: 1,08M (R2) + 0,53M (R3) sobre un universo de ~28M. **El cuello es creativo y lugar de ad set, no audiencia** — el plan acierta al gastar el E2 en mensajes nuevos y no en segmentaciones.
3. **El techo de ad sets no es el problema que dice el plan: el problema es R2.** R3 tiene 5 de 5 ad sets arriba de 50 conv/semana; R2 tiene 19 de 26 abajo, y el **38,5% de su gasto vive ahí**. Y los 4,2 lugares libres de R3 ya los consume el propio plan: **el E3 no tiene dónde entrar**.
4. **El hueco de profit más grande no está en Meta: es el pack x4/x5**, que vende 333 órdenes/mes en ML y no existe en COD. ~$82k/día estimados con **$0 de pauta nueva**, y es lo único que mueve el mix COD/ML sin comprar pedidos.
5. ⚠️ **Corrijo una afirmación del vault: segmentar por provincia NO es ruido.** El 53% del spread de entrega es *entre* provincias (sd 7,21 pp vs 6,82 pp dentro). Vale ~$100k/día. **Pero no es accionable hoy**, porque el flete de Urbano es un fallback plano desde el 30/06 y sesga el ranking justo donde importa.
6. **Targetings nuevos con pool medido hay uno solo** (retargeting de InitiateCheckout sin compra: 2.527/semana), y el vault tiene doctrina en contra con benchmark (iROAS 0,60×). Test chico con vara dura, no apuesta.
7. **Dos veredictos que me retracté de sostener:** `beevenom-FIXY` (no sé si pierde plata — falta su CPA all-in por beacon) y el descarte de la segmentación por zona (era mi conclusión inicial y el dato la dio vuelta).

## 1. Techo real de ad sets y lugar libre (pregunta 1)

### Lo medido hoy (Graph API, 24/09)

| | R2 `act_880189106877616` | R3 `act_1569698667101520` |
|---|---|---|
| Ad sets ACTIVE (contados con filtro, sin truncar) | **26** | **5** |
| Campañas ACTIVE | 10 | 3 |
| Compras 7d (`omni_purchase`) | **919** | **461** |
| Techo por la regla ÷50 | **18,4** | **9,2** |
| Lugar libre por la regla | **−7,6 (pasada)** | **+4,2** |
| Ad sets que de verdad llegan a 50 conv/semana | **7 de 26** | **5 de 5** |
| Mediana de conversiones por ad set | **17,5** | **87** |
| Uso de presupuesto (22–23/09) | 98,3% | 96,5% |
| Impuesto vigente | ×1,00 | ×1,10 desde 16/09 |
| Gasto real/día 7d | $651.659 | $312.320 |

**Flota real 17–23/09: $963.979/día.** Sin Dusty Rose ni ARRAIGO: **$889.740/día**. (MEDIDO; R3 grosseado por el tramo del 10% de `settings.meta_ads_impuestos`, no por el ×1,364 obsoleto.)

### Las tres correcciones que importan

**(a) La regla ÷50 no es ley y el vault ya lo dice.** El origen es Obvi, enero 2024, y era para dimensionar presupuesto de test, no un umbral de salud (`60-Investigaciones/Axiomas-y-Mejoras-2026-07.md:62,493`). Úsenla como piso, no como veredicto.

**(b) Contar ACTIVE sobreestima el techo — y ahora está medido al detalle.** El vault avisaba esto el 04/09 (`Playbook-Melwani.md:285`). Lo volví a medir hoy con la ventana 17–23/09:

- **R2: 7 de 26 ad sets llegan a 50 conversiones/semana.** Los 19 restantes están en learning permanente y se llevan **$1.758.099 de $4.561.610 = 38,5% del gasto de la cuenta**.
- **R3: 5 de 5 llegan** (117, 126, 87, 81, 50). Es la cuenta sana, y por eso el plan acierta en meter lo nuevo ahí.

**(c) El lugar libre de R3 ya está vendido.** 4,2 lugares, y el plan los consume completos: M5-R3 (1) + los 2–3 mensajes nuevos del E2. **Después del E2, R3 queda en cero lugar libre**, y el E3 del ~09/10 no tiene dónde entrar. El plan lo anota como condición (§5) pero no propone nada para resolverlo. Eso es el punto 3 de la sección 6.

### Lo que NO hay que hacer

Liberar lugar apagando los ad sets chicos de R2 **no libera plata**: 16 de ellos son hijos de un CBO con presupuesto $0, y apagar un hijo redistribuye su gasto a los hermanos del mismo CBO. Libera el lugar de ad set, sí — pero el lugar de ad set de R2, que es la cuenta donde ya no conviene meter nada nuevo.

---

## 2. Productos con pauta $0 y economía para sostenerla (pregunta 2)

### El cruce (25/08–23/09, MEDIDO)

| Producto | Pauta Meta | Pedidos COD | Profit COD | Órdenes ML | Profit ML | Veredicto |
|---|---|---|---|---|---|---|
| **Pureza** | $13,6M | 4.686 | **+$32,64M** | 4.580 | +$56,59M | El motor. No se toca salvo para subir |
| **BeeVenom** | $3,61M | 458 | **+$2,95M** | — | — | Vende, pero un ad set pierde plata (§4) |
| **ARRAIGO** | $742k | 24 | **−$319.021** | 5 | **−$61.094** | **Pierde plata en los DOS canales** |
| **VeinGuard** | **$0** | 1 | +$10.142 | 19 | **+$261.923** (26%) | Único candidato real, con trabajo previo |
| **Revival Oil** | **$0** | 0 | — | 13 | +$178.237 (19%) | Margen flojo, n chico. No |
| **Natures** | $7,17M (etiqueta) | 0 | — | 17 | +$482.073 | **No es un producto: es Pureza mal etiquetada** |
| **Altus** | $63k residual | 5 | −$14.635 | — | — | Muerto por margen (−$6.309/despacho) |
| APLOMO / LIENZO | $0 | — | — | — | — | No existen en la base. Sin dato |

### Los tres hallazgos

**1. "Natures" no es un producto con pauta: son 4 campañas de Pureza mal etiquetadas desde el 30/08.** Los $7,17M de `ad_spend` bajo Natures son tráfico de Pureza. El plan ya lo anota como riesgo (§8). Lo que agrego: **también afloja la vara 24%**, porque esas campañas se miden contra el objetivo de Pureza ($4.200) y no contra el de Natures ($5.200) — `Learnings.md:1069`. Natures como producto está muerto por legales y además era mal negocio (retorno 0,66× vs 1,43× de Pureza, `Learnings.md:728-740`). **No se relanza.**

**2. ARRAIGO no es "un test que hay que decidir hasta cuándo sigue": es una pérdida medida en los dos canales.** −$319.021 en COD y −$61.094 en ML en 30 días, con $630.436 de pauta COD. Va al §4.

**3. VeinGuard es el único producto con pauta $0 que tiene economía.** A favor: 19 órdenes ML con 26% de margen y $0 de pauta, una estática ganadora lifetime (250 compras, CPA $6.109) y el CPA máximo más alto del catálogo según el vault ($17,2k, `Dropi.md:96` — dato viejo, hay que recalcularlo). En contra, y es fuerte: **su landing dispara las 5 reglas de compliance, las cinco** (`Playbook-Compliance-AntiBan.md:244,250`), y se apagó en julio a CPA $21.098 con la decisión escrita de "no reabrirlo" (`Analisis-Propios-2026-07.md:156-160`).

> **Veredicto VeinGuard:** no es plata para el 25/09. Es un proyecto de 2 semanas que arranca por reescribir la PDP y hacer el 301 del handle. Si no se hace eso primero, la pauta rebota contra la page y pone en riesgo el scoring de la cuenta que corre Pureza. **Riesgo asimétrico: no vale la pena mientras Pureza dependa de esas cuentas.**

---

## 3. Targetings que nunca probamos (pregunta 3)

### Primero, el dato que desarma la premisa

**No hay saturación de audiencia.** Reach acumulado 25/08–23/09: R2 **1.080.364** personas (frq 4,59), R3 **531.471** (frq 4,43). Aun sumándolos sin descontar solapamiento, son ~1,6M sobre un universo AR 18-65 de ~28–30M: **estamos tocando el 5% del país**. La frecuencia es 1,15 impresiones por persona por semana.

Esto tiene una consecuencia directa: **abrir targetings nuevos no va a traer volumen que el open no pueda traer solo.** El vault ya lo había dicho desde el otro lado: *"el CPM +14% y la frecuencia +12% no son saturación del mercado — son menos creativos vivos concentrando la misma plata. Antes de culpar a la audiencia o ampliar targeting, contar cuántos anuncios están entregando"* (`Playbook-Contingencia-Cuentas-Meta.md:171`). **El cuello es creativo y lugar de ad set, no audiencia.** El plan acierta al gastar el E2 en mensajes nuevos y no en segmentaciones.

### Estado real del targeting (MEDIDO hoy, los 14 ad sets ACTIVE)

- `advantage_audience: 1` en **todos**. Edad 18-65 en todos. Género abierto salvo 3 ad sets "mujeres".
- **Cero `custom_audiences` y cero `excluded_custom_audiences` en toda la flota.**
- **R2 tiene 0 públicos personalizados creados.** R3 tiene 5, y **ninguno sirve**: son seguidores del IG personal de Pancho y LALs sobre esos seguidores, no sobre compradores.
- Geo: tres variantes (CABA / AR menos 4 provincias / AR sin CABA). Son **ruteo logístico**, no rendimiento.
- ⚠️ **Las campañas `cxr-*` se llaman "retargeting" y no lo son.** No tienen ningún público adjunto, y su embudo es indistinguible del prospecting (5,92% compras/LPV vs 6,02% del `abo-cv01`). El clasificador de AppAds las cuenta como retargeting por el nombre (`AppAds.md:131`). **Cualquier test real de retargeting tiene que desambiguar esto primero o el sistema va a leer mal el resultado.**

### Lo que SÍ es targeting nuevo, en orden de calidad

**A. Retargeting de InitiateCheckout sin compra — el único con pool medido.**

Embudo del pixel BioLabs `781630351556303`, 17–23/09 (MEDIDO): PageView 51.945 → ViewContent 48.268 → **InitiateCheckout 3.759** → Purchase 1.232. **VC→IC 7,8%, IC→compra 32,8%. Quedan 2.527 IC sin compra en 7 días.**

- Pool estimado a 30 días: **~8.000–12.000 personas** (ESTIMADO: 2.527 eventos/semana ÷ ~1,3 eventos por persona, sin descontar repetición entre semanas).
- Tamaño máximo del ad set: **$12.000–15.000/día** (ESTIMADO: a CPM $3.000 y frecuencia 6/semana, el pool se agota arriba de ~$20k/día).
- CPA objetivo: **≤$2.500** para CABA/GBA y ≤$3.000 para interior. Fundamento: el m de Pureza es **$11.852** (MEDIDO: contribución pre-ads $32,64M + $22,89M ÷ 4.686 pedidos — converge solo con el $11.844 del plan), pero el retargeting hay que medirlo contra su *incrementalidad*, no contra m.
- Profit incremental: **+$27.000/día** (ESTIMADO, y el estimado es frágil). Cuenta: $15k/día a CPA $2.000 = 7,5 compras/día; descontando **60% de canibalización** quedan 3 incrementales × $11.852 − $15.000 = +$20.500/día. Con 40% de canibalización daría +$38.000/día.
- **Lo que lo bloquea, y es serio:** el vault tiene doctrina en contra. Arash: *"NO usar campañas de retargeting, roba atribución y baja el scoring"* (`Playbook-Arash.md:20`). Faris: **iROAS mediano de retargeting en FB = 0,60× contra 1,14× de adquisición** (`Playbook-Faris.md:102`). Traducido: en la mediana, el retargeting de Meta destruye valor. Y el argumento de que "no hace falta excluir compradores porque la recompra es 6,3%" ya está escrito y fechado (`Playbook-Faris.md:383`).
- **Cómo hacerlo sin violar eso:** el pool de IC-sin-compra **no son compradores**, son abandonos de formulario, que es exactamente el caso donde el retargeting sí tiene teoría a favor. Va como **test acotado a 7 días con vara escrita antes**, en R3, y con el compromiso de leerlo por marginal del sistema (`marginal.mjs`) y no por su CPA aparente.

**B. Advantage+ Shopping (ASC) — el veto del vault se apoya en una premisa que hoy es falsa.**

El vault dice: *"nuestro evento de compra es un formulario, no un checkout... **no hay señal para alimentar una ASC**"* (`Playbook-Melwani.md:546`).

**Medido hoy:** el pixel disparó **5.246 Purchase en 26,3 días (~199/día, ~1.400/semana)** y 16.127 InitiateCheckout. El mínimo de Meta para una ASC es del orden de 50 conversiones/semana. **Tenemos ~28× la señal necesaria.** Y es la *misma* señal con la que ya optimizan las 13 campañas vivas — si no hubiera señal, no funcionaría ninguna.

> **Pero no lo propongo para el 25/09.** La premisa del veto está mal, no el veto. Lo que sí es cierto: (a) el pixel sobrecuenta ~36% (CPA Meta $3.987 vs real $5.439), así que una ASC optimizaría sobre una señal inflada sin nadie mirándola; (b) **no hay ningún catálogo de productos en los BM** (verificado: `/me/businesses` no devuelve nada con este token), así que sería una ASC con creativos manuales; (c) una ASC nueva compite en subasta contra las 13 campañas propias. **Acción: corregir la afirmación del vault. Decisión: no ahora.**

**C. Segmentar por zona — es la palanca MÁS GRANDE del informe, y hoy NO es accionable. Vale la pena entender por qué.**

⚠️ **Esto corrige una conclusión que yo mismo había escrito y que el vault afirma.** Entré a este punto convencido de descartarlo, porque `Learnings.md:100` dice que la tasa esperada por mix de CPs se queda clavada en 33,7–35,7% → *"la geografía casi no se mueve"*, y `Learnings.md:670-682` declara que las exclusiones de provincia son ruido. **Medido hoy sobre 4.448 guías resueltas (despachos 01/08–15/09), eso es falso.**

Descomposición de varianza corregida por ruido binomial (MEDIDO, 24 provincias, 1.141 celdas de CP):

| | sd de la tasa de entrega |
|---|---|
| **Entre** provincias | **7,21 pp** |
| **Dentro** de la provincia, entre CPs | 6,82 pp |
| Dentro, a nivel ciudad | 4,56 pp |

**~53% de la dispersión es ENTRE provincias.** Meta no segmenta por CP, pero sí por provincia y por ciudad — o sea que **la mitad del spread sí es capturable con las herramientas que tenemos.** La afirmación del vault hay que corregirla.

**Y hay un segundo hallazgo que da vuelta la intuición: el ranking por tasa de entrega manda a la zona equivocada.** Lo que decide no es la entrega, es la contribución neta después del CPA de esa zona:

| Provincia | Desp. | Tasa | Contrib/desp | CPA/desp | **NETO/desp** |
|---|---|---|---|---|---|
| La Rioja | 85 | 57,6% | $15.069 | $1.453 | **+$13.616** |
| Neuquén | 122 | 60,8% | $15.848 | $5.976 | +$9.872 |
| Misiones | 154 | 56,5% | $14.532 | $4.684 | +$9.848 |
| Entre Ríos | 111 | 57,7% | $15.313 | $5.577 | +$9.736 |
| Chaco / Salta / Sgo. Estero | 102/243/108 | 56–58% | ~$14.500 | ~$5.300 | ~+$9.200 |
| **Buenos Aires** | 1.293 | 59,3% | $18.048 | $9.572 | +$8.476 |
| Córdoba / Santa Fe | 459/352 | ~51% | ~$12.200 | ~$5.000 | ~+$7.200 |
| Mendoza / Tucumán | 224/214 | 44,8/42,7% | $9.589/$8.693 | $7.247/$6.570 | +$2.342/+$2.123 |
| Catamarca / Jujuy | 91/184 | 43,3/37,4% | $8.605/$6.005 | $6.748/$4.639 | +$1.857/+$1.366 |
| **CABA** | 101 | **63,9% (la mejor)** | $22.396 | **$21.777** | **+$619** |
| **Corrientes** | 130 | 37,7% | $6.049 | $5.985 | **+$64** |

**CABA tiene la mejor tasa de entrega del país y es casi el peor negocio**, porque su CPA es $21.777. Cualquier regla del tipo "pautemos donde entrega mejor" nos manda derecho ahí. **La columna que decide es NETO/desp, no la tasa.**

**El tamaño de la palanca:** las 6 provincias de peor NETO (CABA, Corrientes, Jujuy, Catamarca, Tucumán, Mendoza) se llevan **$218.270/día = 23,4% de la flota** (MEDIDO: reparto del gasto por región 17–23/09 × gasto de cada cuenta). Reasignar el cuartil de peor entrega al mejor da **+$99.600/día** (ESTIMADO, ya descontando que el CPA del cuartil bueno es 61% más caro — el delta naive de $390k/día que sale de ignorar el CPA es falso).

**Y dentro de Buenos Aires el corte es aún más grande, y ES segmentable en Meta:**

| Dentro de Buenos Aires | Tasa | Contrib/desp |
|---|---|---|
| Fixy / AMBA | **65,1%** | **$21.994** |
| Urbano / BA-interior | 50,2% | $11.727 |

**14,9 pp y $10.267 de diferencia dentro de la misma provincia**, separables por radio alrededor de CABA — que es exactamente lo que ya hacen los ad sets `FIXY-GBA+CABA` (CABA + 28 ciudades del conurbano, verificado hoy por Graph).

### Por qué, con todo esto, NO lo propongo como acción

**Tres bloqueantes, y los tres son de datos, no de pauta:**

1. ⚠️ **El flete de Urbano es un número inventado desde el 30/06/2026.** Las 3.634 guías de Urbano de la ventana llevan `freight_is_estimated = true` con un fallback plano de ~$10.200, y el spread real de flete por zona es **2,8×** (memoria `urbano-flete-estimado-vence`). Eso significa que **la contribución de NOA y Patagonia está sobreestimada y la del centro subestimada** — y La Rioja, Salta, Jujuy, Neuquén y Misiones, que encabezan el ranking, son exactamente las provincias lejanas. **El ranking probablemente se da vuelta cuando entre la tarifa real.** Actuar hoy es actuar sobre un sesgo que apunta justo donde importa.
2. **El CPA por provincia es estimado y tiene un sesgo conocido.** Meta reporta la región por ubicación del *usuario*; el pedido se despacha al *domicilio*. Mucha gente del GBA aparece como CABA. El CPA de $21.777 de CABA (n=101) casi seguro está inflado por eso. **Meta directamente no da conversiones por región** — el breakdown devuelve gasto con `actions` en cero.
3. **Excluir geo en ads anula la capa de prepago por CP** (`Tasa-Entrega.md:90`), que es la otra palanca sobre el mismo problema. Son mutuamente excluyentes y nadie decidió cuál gana.

> **Conclusión:** esta es la palanca de ~$100k/día más grande que encontré, y la recomendación es **no tocarla todavía**. Lo que sí hay que hacer es **destrabar la tarifa real de Urbano** — vencida hace 3 meses — porque sin eso no se puede decidir. Es el mejor retorno por hora de trabajo de datos que tiene la empresa ahora mismo, y **no es trabajo de pauta.**

**D. Excluir 65+ en R2 — observación, no acción.**

MEDIDO 17–23/09, R2: 65+ gasta **$380.625/7d con CPA $7.320**, y 55-64 female $427.133 con CPA $6.571, contra ~$4.700 del núcleo 25-54. En R3 el mismo corte da CPA **parejo** (65+ female $2.982). No lo propongo como recorte por tres razones: (a) es reasignación, no plata nueva; (b) con `advantage_audience: 1` la edad no es un límite duro y Meta se sale igual; (c) editar un ad set vivo le resetea el aprendizaje en plena ventana de lectura de E1. **Sirve como configuración de un ad set nuevo, no como cirugía sobre lo que corre.**

**E. Audience Network — ya medido y ya descartado por tamaño, pero hay un corte limpio.**

El vault lo midió el 05/09 y concluyó *"AN es sólo 3,1% del gasto, no explica nada"* (`Serum-Capilar.md:1082`). Lo vuelvo a medir y coincide en tamaño, pero el detalle por posición es nuevo:

| Posición | Gasto 7d | Compras | CPA |
|---|---|---|---|
| `an_classic` R2 | $59.555 | 5 | **$11.911** |
| `an_classic` R3 | $37.719 | 5 | $7.544 |
| `rewarded_video` R2 | $51.341 | 6 | $8.557 |
| `rewarded_video` R3 | $35.040 | 12 | **$2.920** ← el mejor de la flota |

**No cortar Audience Network en bloque**: `rewarded_video` en R3 tiene el mejor CPA de toda la cuenta. El corte limpio es **solo `an_classic`**: $97.274/7d = **$13.896/día** con 10 compras (CPA $9.727). Reasignado al CPA de feed ($4.700) daría ~20,7 compras → **+1,5 pedidos/día ≈ +$17.800/día de contribución**. Es plata real pero chica, y cuesta editar 14 ad sets vivos en plena ventana de E1. **Aplicarlo solo a los ad sets nuevos del E2/E3, no retroactivamente.**

---

## 4. Plata que se está gastando sin rendir (pregunta 4)

Ventana 17–23/09. **CPA real = CPA Meta × tramo de impuesto de la cuenta** (R2 ×1,00, R3 ×1,10). La columna "all-in" agrega la sobrecuenta del pixel (ESTIMADO ×1,364, medido para Pureza el 20/09 — extrapolarlo a otros productos es supuesto).

### Por campaña

| Campaña | Cuenta | Gasto/día | Compras 7d | CPA Meta | CPA real | Veredicto |
|---|---|---|---|---|---|---|
| `abo-keepalive-pureza-02-50k` | R3 | $157.445 | 263 | $4.191 | **$4.610** | **Escalar.** La mejor de la flota |
| `cxr-cv01-pureza-02-purezadrops` | R2 | $83.462 | 190 | $3.075 | **$3.075** | **Escalar.** Ya en E1 |
| `cbo-cv03-...-m5iter` | R2 | $74.204 | 162 | $3.206 | **$3.206** | **Escalar.** Ya en E1 |
| `abo-keepalive-...-nsr` | R3 | $37.979 | 81 | $3.282 | **$3.610** | **Escalar.** Ya en E1 |
| `cbo-sinx1-pureza-02-50k` | R3 | $88.502 | 117 | $5.295 | **$5.825** | Dejar. Bajo m, sin colchón |
| `cxr-cv01-... - bsas` | R2 | $81.593 | 114 | $5.010 | $5.010 | Dejar |
| `abo-cv01-pureza` | R2 | $59.509 | 81 | $5.143 | $5.143 | Dejar |
| `cbo-cv02-pureza` | R2 | $90.083 | 121 | $5.211 | $5.211 | Dejar. Saturándose (+23%) |
| `cbo-cv02-...-bsas` | R2 | $62.197 | 87 | $5.004 | $5.004 | Dejar |
| **`BeeVenom · ABO Fixy vs Open`** | R2 | $126.372 | 134 | $6.602 | $6.602 | **Partir: el OPEN se escala, el FIXY se apaga** |
| **`ARRAIGO · ABO Open · 05-09`** | R2 | **$40.933** | 10 | **$28.653** | **$28.653** | **APAGAR** |
| `Dusty Rose Verano` | R2 | $33.306 | 20 | $11.657 | $11.657 | No es BioLabs. Ya en el plan §6.8 |

### Los dos cortes que pago con números

**(1) ARRAIGO — apagar. Libera $35.520/día y deja de perder ~$10.600/día.**
- El ad set `arraigo-OPEN-AR-MIX` ya está muerto ($0 los últimos 4 días). El vivo es `-TEST Landing`: **$142.079 en 4 días = $35.520/día, 7 compras, CPA $20.297** contra un objetivo de $6.000.
- Es la única campaña de la flota que **no gasta lo que tiene** (uso 80,4% contra 96–103% del resto): Meta no encuentra a quién mostrarle esto al precio que pagamos. CPM $11.409 contra $3.143 de BeeVenom.
- Y el cierre no lo da Meta, lo da la base: **ARRAIGO perdió $319.021 en COD y $61.094 en ML en 30 días**. No es "un test caro", es un producto que pierde plata en los dos canales.
- El plan (§6.8) lo deja como *"hay que definir hasta cuándo sigue"*. **Con este número, la respuesta es: ya.**

**(2) `beevenom-FIXY-GBA+CABA-40k` — recortar a la mitad y medir. NO apagar. (Recomendación degradada.)**

⚠️ **Acá me retracto de mi propia conclusión.** Lo tenía escrito como "apagar" hasta que llegó el cruce de zonas. Lo que cambió:

- **Lo que sostiene el recorte:** $343.946/7d = **$49.135/día, 22 compras, CPA Meta $15.634**. Su hermano `beevenom-OPEN` corre a **$4.827**: cuesta **3,24×** por la misma venta. **Frecuencia 2,83, la más alta de toda la flota** — el pool está agotado.
- **Lo que lo salva de la muerte:** el ad set **no pauta CABA sola** — verifiqué el targeting hoy: es CABA + **28 ciudades del conurbano**, o sea la zona Fixy completa. Y la zona Fixy es **el mejor negocio del país**: 65,1% de entrega y $21.994 de contribución por despacho, contra 50,2% y $11.727 del interior de Buenos Aires. Además BeeVenom entrega mejor ahí que en el resto (fixy 69,0% contra urbano 59,2%, MEDIDO).
- **Por lo tanto su break-even no es el nacional de $15.909, es más alto.** Ajustado por la tasa de su zona daría del orden de **$18.000–18.500** (ESTIMADO). A CPA Meta $15.634 está *debajo*; a CPA all-in (×1,364, SUPUESTO extrapolado de Pureza) daría ~$21.300 y estaría *arriba*. **El signo depende enteramente de un factor que no medí para este producto.**

> **Veredicto honesto: no sé si pierde plata.** Lo que sí sé es que cuesta 3,24× su hermano y tiene la frecuencia más alta de la flota. **Recortar a $25k/día** conserva el aprendizaje, libera $24.135/día y baja la frecuencia. **El dato que cierra la discusión no está en Meta: es el CPA all-in real de ese ad set, que sale del panel `/anuncios` por beacon del form (84–90% de atribución), no de la Graph API.** Pedirlo antes de decidir cuesta una consulta.
>
> Memoria `lo-que-vende-no-se-apaga`: este ad set vende 22 compras/semana. No lo apago por frecuencia ni por CTR, y con los datos de hoy tampoco lo apago por plata.

### Lo que NO toco

`cbo-cv02` (saturándose, pero vende bajo m), las `bsas` con cost cap, y los 10 micro-ad sets de R2 con <$20k/día: **son hijos de CBO, apagarlos redistribuye la plata a los hermanos en vez de liberarla.** Y `natures-angv04` ($8.941/día, CPA $8.941) está arriba de la vara pero adentro de un CBO que en conjunto rinde.

### Total liberable

| Concepto | $/día nominal | $/día real | Contribución que deja de perderse |
|---|---|---|---|
| ARRAIGO completo (apagar) | $35.520 | $35.520 (R2 ×1,00) | ~$10.600/día (MEDIDO) |
| beevenom-FIXY (recortar $49k → $25k) | $24.135 | $24.135 | **incierto — ver arriba** |
| **Total** | **$59.655** | **$59.655** | **≥$10.600/día** |

**$59.655/día = 5,9% de la flota post-E1 ($1,011M/día).** Cubre cerca de **un tercio del E2** sin tocar la caja ARS — y la caja es el freno declarado del plan para el E3 (§5: *"el acumulado +44% pide un pozo de $20,9M, el 88% de la caja ARS"*).

*(Si el CPA all-in de `beevenom-FIXY` resulta estar arriba del break-even de su zona, apagarlo entero lleva el total a **$84.655/día**. Ese dato sale del panel `/anuncios`, no de Meta.)*

## 5. COD/ML 50/50: qué mueve la aguja más barato (pregunta 5)

Hoy 41,3 / 58,7. La memoria `cod-ml-objetivo-5050` dice que llegar cuesta **+$305k/día de pauta en 5 escalones**. Eso sigue siendo cierto **si el único camino es comprar más pedidos COD**.

Hay uno más barato, y sale de comparar los dos canales del mismo producto:

| Pureza, 25/08–23/09 | COD | ML |
|---|---|---|
| Órdenes | 4.686 | 4.580 |
| Revenue | $110,9M | $188,2M |
| **Ticket** | **$51.873** | $41.082 |
| Mix de packs | x1 24 · **x2 3.799** · x3 863 · **x4 0 · x5 0** | x1 73 · x2 3.656 · x3 518 · **x4 246 · x5 87** |

**Los dos canales venden casi exactamente los mismos pedidos (4.686 vs 4.580) y ML factura 70% más.** La diferencia no es la pauta: es que **en ML existe el x4 y el x5 y en COD no.** 333 órdenes/mes (7,3% del volumen ML) en packs que el canal COD no ofrece.

### La propuesta: abrir x4/x5 en COD como oferta adicional

- **Costo de pauta: $0.** Es la misma pauta, el mismo pedido, el mismo flete.
- **Profit incremental: ~$82.000/día (ESTIMADO, con supuestos fuertes declarados abajo).**
  Cuenta: si COD capturara el mismo 7,3% de x4/x5 que ML → 342 pedidos/mes migran de un ticket medio de $51.873 a ~$70.000 (ESTIMADO por extrapolación del escalón medido x2 $50.000 → x3 $60.126). Delta $18.127 por pedido, menos ~$5.000 de producto (2 unidades × $2.500, MEDIDO en `product_costs`), por la tasa de entrega de 55% (MEDIDA, urbano Pureza x2/x3) = **~$7.220 por pedido migrado × 342 = $2,47M/mes ≈ $82k/día**.
- **Efecto sobre el mix:** +$6,2M/mes de revenue COD sin tocar ML mueve el mix de 41,3/58,7 a ~**42,6/57,4**. No llega al 50/50 solo, pero es **el único tramo que no cuesta pauta**, y el resto del camino queda más barato porque sube el ticket sobre el que se paga el mismo CPA.
- **Por qué ML no puede hacer lo mismo:** ML ya tiene el x4/x5 y su cuello es la caja de catálogo y el `lost_by_ad_rank` (0,61), no la plata (`lost_by_budget` 0,09, uso 86%). **Poner más plata en ML hoy no mueve la aguja. Poner una oferta nueva en COD sí.**

**Supuestos que hay que verificar antes de creerle al número:**
1. Que el comprador COD tenga la misma disposición al pack grande que el de ML. **SUPUESTO** — el de ML compara precios, el de COD compra por impulso desde un anuncio. Puede ser que sí, puede ser que no.
2. Que el x4/x5 **no exista ya** en la landing y simplemente no venda. **No lo pude verificar**: `veltron.mjs` devuelve 403 por falta del scope `catalogo:read`, y el form del theme arma los packs desde la config de Veltron. Lo que sí está medido es que **no hay ventas x4/x5 en COD**.
3. Que no canibalice el x2/x3. Mitigación: entra como **bump/upsell adicional**, nunca reemplazando el x2 que vende (memoria `no-tocar-lo-que-ya-funciona`).

---

## 6. Las 3 acciones, en orden de plata

### Acción 1 — Apagar ARRAIGO y recortar `beevenom-FIXY` a la mitad. Libera $59.655/día sin tocar la caja.

**El número que la justifica:** ARRAIGO corre a **CPA $28.653 contra un objetivo de $6.000**, es la única campaña de la flota que no logra gastar lo que tiene (uso 80,4% contra 96–103% del resto), y **perdió $319.021 en COD + $61.094 en ML en 30 días**. No es un test caro: es un producto que pierde plata en los dos canales. El plan (§6.8) lo deja como *"hay que definir hasta cuándo sigue"*. **Con este número, la respuesta es: ya.**

`beevenom-FIXY` va recortado, no apagado: cuesta 3,24× su hermano OPEN y tiene la frecuencia más alta de la flota (2,83), pero pauta la mejor zona del país y **no pude determinar el signo de su rentabilidad** (§4).

**Por qué es la primera:** el plan declara que el freno del E3 es la caja ARS. **Esto financia un tercio del E2 sin pedirle un peso a la caja.** Es la única acción del informe que da plata en vez de pedirla.

**Qué la bloquea:** nada técnico — es una decisión de Pancho. **No lo ejecuto yo:** va a `meta-operador` con OK explícito, y conviene que espere a que cierre el día 0 del E1 (vie 25/09) para no ensuciar la ventana de lectura. Antes de decidir sobre BeeVenom, pedir su **CPA all-in por beacon** al panel `/anuncios`.

### Acción 2 — Abrir el pack x4/x5 en COD. ~$82.000/día estimados con $0 de pauta.

**El número que la justifica:** ML vende **333 órdenes/mes de x4/x5 ($21,5M de revenue)** con el mismo producto y casi el mismo volumen de pedidos que COD (4.580 vs 4.686). COD ofrece hasta x3. El ticket COD es $51.873 contra $60.126 del x3 ya existente: **el escalón de pack está medido y funciona.**

**Por qué es la segunda y no la primera:** el número es el más grande del informe pero es **ESTIMADO sobre tres supuestos**, y uno de ellos (que el x4/x5 no exista ya en la landing) **no lo pude verificar por el 403 de Veltron**.

**Qué la bloquea:** (a) destrabar el scope `catalogo:read` de la API key de Veltron para leer el break-even y el catálogo real; (b) decisión de oferta, no de Meta — sale del carril de este informe; (c) stock: el checklist del plan (§6.1) ya pregunta si hay granel para +44%, y un x4/x5 consume el doble por pedido.

### Acción 3 — Destrabar dos datos rotos. Cuesta horas, no pauta, y desbloquea ~$100k/día.

**El número que la justifica:** la segmentación por zona vale **+$99.600/día estimados** y hoy no se puede decidir, porque **el 53% del spread de entrega es entre provincias** (o sea: sí es capturable con Meta) pero **el flete de Urbano viene de un fallback plano desde el 30/06/2026** y el spread real de flete por zona es **2,8×**, justo en la dirección que da vuelta el ranking.

Los dos datos, en orden:
1. **Tarifa real de Urbano por zona** — vencida hace 3 meses. Sin esto, La Rioja/Salta/Neuquén encabezan el ranking de contribución solo porque su flete está subvaluado.
2. **Scope `catalogo:read` en la API key de Veltron** — hoy da 403 y por eso ningún break-even de este informe está *leído*, están todos *derivados*. Es además prerrequisito de la Acción 2.

**Por qué está acá y no en un backlog de datos:** es el único ítem del informe donde unas horas de trabajo desbloquean una decisión de seis cifras diarias. **No es trabajo de pauta y no compite con el escalado** — se puede hacer en paralelo al E1.

**Qué la bloquea:** nada. Son dos pedidos concretos (tarifario a Urbano, permiso de key a Veltron).

### Lo que decidí NO proponer, y por qué

| Idea | Por qué no |
|---|---|
| Segmentar por zona **ahora** | No porque sea chica — es la más grande (~$100k/día) — sino porque el flete de Urbano es un número inventado desde el 30/06 y sesga el ranking justo donde importa. Va como Acción 3: arreglar el dato primero (§3-C) |
| Advantage+ Shopping (ASC) | La premisa del veto es falsa (hay 28× la señal necesaria), pero el veto se sostiene por otras razones: pixel inflado 36%, sin catálogo, compite contra 13 campañas propias |
| Excluir 65+ en R2 | Es reasignación, no plata nueva; `advantage_audience:1` no respeta la edad como límite duro; y editar ad sets vivos resetea el aprendizaje en plena ventana de E1 |
| Cortar Audience Network en bloque | `rewarded_video` en R3 tiene el **mejor CPA de la flota** ($2.920). Solo `an_classic` merece corte, y son $13.896/día: chico, y solo vale para ad sets nuevos |
| Relanzar Natures, Altus, Caranvi | Natures: legales + retorno 0,66× (decisión escrita, no se relanza). Altus: profit **negativo** por despacho. Caranvi: bloqueado por RNPA, que es el techo del canal, no un trámite |
| VeinGuard ya | Economía sí (26% de margen en ML, $0 de pauta), pero **su landing dispara las 5 reglas de compliance**. Pautarlo antes de reescribir la PDP arriesga el scoring de la cuenta que corre Pureza. Riesgo asimétrico |

---

## 6bis. La decisión que tiene fecha: el warm-up de la cuenta de respaldo

No la cuento como acción de plata porque no da profit — da **opción**. Pero es la única del informe que vence.

**El número que la justifica:** **R3 tiene 4,2 lugares de ad set y el plan los consume completos** (M5-R3 + los 2-3 mensajes del E2). R2 está 7,6 lugares pasada y tiene 19 de 26 ad sets en learning permanente. **El E3 del ~09/10 no tiene dónde entrar**, y el plan lo anota como condición (§5) sin proponer nada para cumplirla.

**El lead time es lo que la vuelve urgente:** el warm-up del playbook es **$10-25k/día subiendo 20-30% cada 2-3 días** (`Playbook-Contingencia-Cuentas-Meta.md:27-32`), y *"una cuenta virgen a $200k/día cae al toque"*. De $15k/día a $100k/día son ~8 escalones × 2,5 días = **~19 días**. **Arrancando el 25/09 está lista el ~14/10. Arrancando el 09/10, no llega.** Es lo único acá adentro con fecha de vencimiento.

**Cuál:** **Mini1** `594672180274016` (BM Biolabs Argentina) — es el único respaldo con historial real ($121.455 en 90 días). **No Bio1** `729713579820778`: está sin medio de pago y con $0 en 90 días, es una cuenta virgen. **Nunca R1** `881334636614448`: UNSETTLED, no aparece en `/me/adaccounts`, da 403.

**Qué la bloquea — y el punto 3 es el más importante de todo el informe:**
1. **El inventario de contingencia está 3 de 8** (`Playbook-Compliance-AntiBan.md` §3). Falta la verificación de negocio (tarea de Santi, pendiente).
2. **El activo crítico está mal ubicado:** la page BioLabs no vive en el BM que gasta. El activo irremplazable y el que gasta están en BMs distintos.
3. ⚠️ **La pregunta que hay que contestar antes de abrir nada:** el vault ya avisa que *"si el cuello es cuánto se carga por día en AstroPay/MP, abrir una cuenta más no suma capacidad — parte la misma plata en dos"* (`Master.md:242`). Y el plan (§8) dice que **el gate de capacidad de pago se verificó por última vez con $566k/día y hoy se gastan $965k/día**. **Si el cuello es el fondeo, esta acción no sirve para nada.** Es barata ($15k/día) y reversible, pero antes de escalarla hay que verificar el gate de pago.


---

## 7. Lo que NO pude ver

1. **Break-even oficial por producto: no leído.** `veltron.mjs` devuelve **403 "esta API key no tiene el permiso `catalogo:read`"** en `listar_productos`, `ver_producto` y `ver_costeo`. Los break-even que uso (Pureza $11.852, BeeVenom $15.909) son **derivados de `sales_by_product`**, no leídos del servidor. Convergen con el m del plan ($11.844), lo cual es buena señal, pero **el break-even lo calcula el servidor y no hay que estimarlo**. Destrabar ese scope es prerrequisito de la Acción 2.
2. **CPA por provincia: Meta no lo da.** El breakdown por `region` devuelve gasto pero **`actions` en cero** en las dos cuentas. Tengo el reparto del gasto por provincia, no el rendimiento. El cruce que lo resolvería (`ad_id ↔ tasa de entrega`) sigue pendiente (`Brechas-Sistema-2026-07.md:21`).
3. **Tienda R1 `881334636614448`: excluida del barrido.** UNSETTLED y no aparece en `/me/adaccounts` (403). Si tiene campañas vivas, no las vi. Por diseño (memoria `meta-rotacion-cuentas-sync`).
4. **`quality_ranking` y `conversion_rate_ranking` vienen `UNKNOWN` en los 27 anuncios.** No puedo decir dónde Meta nos cobra de más por mal ranking. Solo tengo CPM crudo (`pureza-montaje-M5` $7.508 y `hotsale-v03` $6.523 en R3 contra $2.366 de `mix-base-v02` en R2 — R3 paga CPM 3× por el mismo producto, y **no sé por qué**).
5. **`/me/businesses` devuelve vacío** con este token. No pude inventariar catálogos de producto ni confirmar cuántos BM hay hoy. El censo que cito (54 cuentas, 3 BMs) es del vault (30/07–15/08), no medido hoy.
6. **El pixel trunca:** `/stats` devolvió 631 bloques horarios de 720 (26,3 de 30 días) con `paging.next`. Los totales de 30 días están **subestimados ~12%**, no sobreestimados.
7. **APLOMO y LIENZO no existen en la base.** `products` tiene 8 filas y no están. Sin ventas, sin pauta, sin costos. **No los evalué** — no tengo con qué.
8. **Zona de los pedidos incrementales: desconocida.** El plan (§4) ya advierte que RESTO apunta al interior, donde Urbano entrega 48–54% y la contribución cae a $7.830 contra $11.844. **Todos los CPA objetivo que di suponen el mix de zona actual.** Si el incremental se corre al interior, la vara se endurece ~34% y las tres acciones rinden menos de lo que dice este informe.
9. **La tasa de entrega de `urbano|BeeVenom` está inmadura** (88,6% resuelto a 24+ días, único corte bajo el umbral de 90%). Sesga para arriba. El break-even de BeeVenom que uso para apagar el FIXY hereda ese sesgo — **lo cual hace el corte más conservador, no menos**.
10. **La sobrecuenta del pixel (×1,364) está medida para Pureza el 20/09.** Aplicarla a BeeVenom y ARRAIGO es **SUPUESTO**. Los CPA "all-in" de esos dos productos son estimaciones, no mediciones.

---


11. ⚠️ **El flete de Urbano es un número inventado desde el 30/06/2026.** Las 3.634 guías de Urbano de la ventana llevan `freight_is_estimated = true` con un fallback plano de ~$10.200, contra un spread real por zona de **2,8×**. Todo el ranking de contribución por provincia de §3-C hereda ese sesgo, **y lo hereda exactamente en las provincias lejanas que encabezan el ranking**. Es el hueco que más plata bloquea del informe.
12. **El CPA all-in real por ad set: no lo pedí.** Vive en el panel `/anuncios` (atribución 84–90% por beacon del form). Sin ese número, el veredicto sobre `beevenom-FIXY` queda abierto y los "CPA all-in" de este informe son el CPA de Meta × un factor supuesto.
13. **Correo Argentino no aparece en `shipments`**: 0 guías en la ventana de tasa de entrega. El ticket COD que uso mezcla correo + Fixy + Urbano sin poder cortarlo por courier.
14. **Las cohortes de despacho 16–23/09 quedaron fuera** por inmadurez (8,7–87,6% resuelto). Lo más reciente que puedo afirmar sobre entrega es del 15/09.


---

## 8. Nota de método

- Todo el gasto de R3 está grosseado por **×1,10** (tramo vigente desde el 16/09 en `settings.meta_ads_impuestos`, migración 093). **R2 no paga impuesto.** El ×1,364 plano está obsoleto desde el 23/09.
- Las compras salen **siempre** de `omni_purchase`, nunca de la suma de `action_type` (que triplica).
- Verifiqué entrega antes de opinar de cualquier CPA: las 13 campañas con veredicto tuvieron impresiones en las 48 h del 22–23/09. El único ACTIVE sin entrega real es `pureza-m5iter-FIXY-GBA+CABA` ($372 y 39 impresiones en 2 días) — **no le asigné veredicto** porque no tiene datos que leer.
- **Nada de este informe se ejecutó.** No escribo en Meta. Las tres acciones van a `meta-operador` con OK explícito de Pancho, y la Acción 1 conviene que espere a que cierre el día 0 del E1 (vie 25/09) para no ensuciar la ventana de lectura.
