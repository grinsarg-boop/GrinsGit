# Cuánto nos costó compartir / perder la caja del x2 en ML (P2 `MLA3692036796`, ficha `MLA70304457`)

Analista ML · medido el 01/10/2026 ~10:00 ART · solo lectura (nada ejecutado).
Ventana analizada: 24/08 00h → 01/10 10h ART. El 01/10 es día abierto: solo se usa por hora, nunca como día cerrado.

## 0. Fuente nueva que hace posible esto (no estaba en el Playbook)

No hay snapshots de `price_to_win` en Supabase, pero existen dos registros históricos que juntos dan la línea de tiempo:

1. **Logs del vigía `salud` en GitHub Actions** (`/api/salud/cajas`, paso "Vigía cajas de catálogo ML"): cada corrida imprime el JSON con el `status` de `price_to_win` de P2, la Premium `MLA1830076567`, la x3 y la x4. Se bajaron las **600 corridas** (05/08 → 01/10). Densidad: ~15-23 lecturas/día hasta el 26/08 y **solo ~5-6/día desde el 27/08** (GitHub espacia el cron), o sea un hueco típico de 3-6 h entre lecturas.
2. **`ml_events` topic `catalog_item_competition_status`** (desde 31/08): ML avisa CUÁNDO cambia la competencia de un ítem, con minuto exacto, pero no dice a qué estado. 19 avisos para P2, 5 para la Premium, 17 para la x4, 14 para la x3.

Método de la línea de tiempo: estado = lo que leyó el vigía; la hora del cambio = el último aviso de ML entre las dos lecturas (con 10 min de margen) o, si no hubo aviso, el punto medio (error de hasta ±3 h).
⚠️ Discrepancia puntual: el 30/09 el aviso de ML es de las 13:28, pero el vigía todavía leyó `winning` a las 13:33 y `sharing_first_place` recién a las 16:04. Uso 13:28, como el §14.

## 1. Línea de tiempo de la caja del x2 (estado de P2)

| desde (ART) | hasta | estado de P2 | horas | quién tenía la caja / contexto |
|---|---|---|---:|---|
| 05/08 08:14 | 29/08 02:30 | winning | 570 | sola (ver §6, contradice al Playbook §10.1) |
| 29/08 02:30 | 30/08 00:17 | **sharing** | 22 | rival no identificado (ya no está en la ficha) |
| 31/08 08:41 | 31/08 16:39 | **competing** | 8 | se resolvió bajando a $38.573 |
| 03/09 19:47 | 03/09 23:06 | **sharing** | 3 | — |
| 04/09 13:13 | 04/09 19:38 | **sharing** | 6 | — |
| 10/09 17:21 | 14/09 00:51 | competing (gana NUESTRA Premium) | 80 | canibalización propia, la pauta se mudó a la Premium |
| 14/09 12:32 | 14/09 20:52 | **competing** | 8 | KLOVER `MLA3877391038` (52 visitas ese día) |
| 15/09 12:45 | 16/09 00:03 | **competing** | 11 | KLOVER (157 visitas) |
| 16/09 00:03 | 16/09 15:20 | **sharing** | 15 | KLOVER (103); se resolvió con la SMART a $34.370 |
| 19/09 18:40 | 19/09 20:54 | Premium gana (P2 `not_listed`) | 2 | — |
| 23/09 15:52 | 24/09 09:25 | **sharing** | 18 | entra el rival `MLA3983995152` a $33.000 (29 visitas) |
| 24/09 09:25 | 24/09 18:03 | gana nuestra Premium | 9 | PRICE_DISCOUNT $33.396 |
| 24/09 18:03 | 25/09 01:00 | **competing** | 7 | rival 3983995152 (56 visitas) |
| 25/09 01:00 | 26/09 00:47 | **sharing** | 24 | rival (138 visitas) |
| 26/09 00:47 → 28/09 07:56 | | **INTERMITENTE** | 55 | rival (172 y 228 visitas): perdida 01-12h y 15-24h del 26; sharing 00-13h y 17-20h del 27 y 01-08h del 28; **caja sola 12-15h del 26, 13-17h y 20-01h del 27** |
| 28/09 07:56 | 30/09 13:28 | winning | 54 | rival con 0 visitas el 28 y el 29 |
| 30/09 13:28 | (sigue) | **sharing** | 20,5 a las 10h del 01/10 | rival (359 visitas el 30/09, 98 a la mañana del 01/10) |

Visitas diarias del rival `MLA3983995152` por API (`/visits/time_window`): 22/09 9 · 23/09 29 · 24/09 56 · 25/09 138 · 26/09 172 · 27/09 228 · 28-29/09 0 · 30/09 359 · 01/10 98 (parcial). Su curva acompaña a nuestras horas sin caja. Hoy la ficha además tiene `MLA2025169081` a $22.000 (otro vendedor, con `pcj-co-funded`) con 2-12 visitas/día: no gana nada (precio de otra cosa o reputación), no pesa.

## 2. Órdenes perdidas por situación (x2 total = P2 + Premium + tradicional `MLA3030316354`)

Tres estimadores de línea base, cada uno con su sesgo:
- **A. ±7 días, misma hora**: media de órdenes a la misma hora del día en horas con caja sola dentro de ±7 días. Placebo (horas con caja sola contra su propia base): **−0,6%** en 642 h → el método no inventa pérdidas.
- **B. Dentro del mismo día**: el nivel del día se mide en sus horas con caja sola × perfil horario. Controla demanda del día; solo sirve para días mixtos.
- **C. Régimen de precio $33.231** (23/09 13h → 01/10 10h): nivel con caja sola = **136,8 órd/día x2** medido en 68 h con caja sola al mismo precio (el bloque limpio 28/09 08h-30/09 13h da 137,0: estable).

### 2.1 Por situación

| situación | horas | A (±7d) | B (mismo día) | C (régimen $33.231) | lectura |
|---|---:|---:|---:|---:|---|
| **Caja compartida** (`sharing_first_place`) | 128 | **−39%** (408 vs 671; −262 órd) | **−33%** (64 h) | **−34%** (83 h; −136 órd) | **~ un tercio de las órdenes** |
| **Caja perdida contra un rival** (`competing`) | 52 | −14% (−47 órd) | −15% | **−29%** (26 h; −40 órd) | muy heterogéneo, ver 2.2 |
| Caja en nuestra propia Premium | 89 | −31% (−182 órd) | −20% | −37% (8 h) | no es el rival: canibalización + pauta mudada |
| Caja sola (placebo) | 642 | −0,6% | — | — | control |

### 2.2 Por episodio (método A salvo que diga otra cosa)

| episodio | situación | real vs base | Δ | órdenes perdidas | costo a $8.535 |
|---|---|---|---:|---:|---:|
| 29/08 (22 h) | sharing | 42 vs 81 | −48% | 39 | $333K* |
| 31/08 09-16h | competing | 20 vs 43 | −54% | 23 | $200K* |
| 03/09 noche (3 h) | sharing | 10 vs 12 | −17% | 2 | ruido |
| 04/09 13-19h | sharing | 10 vs 37 | −73% | 27 | $232K* |
| 10-14/09 (80 h) | Premium propia | 344 vs 492 | −30% | 148 | (otra cuenta: pauta mudada) |
| 14/09 y 15/09 tarde (19 h) | competing vs KLOVER | 166 vs 136 | **+22%** | 0 | 0 |
| 16/09 00-15h | sharing vs KLOVER | 79 vs 104 | −24% | 25 | $215K* |
| 23/09 tarde-24/09 9h (17 h) | sharing | 50 vs 71 (C) | −29% | 21 | $176K |
| 24/09 9-18h | Premium propia | 43 vs 68 (C) | −37% | 25 | $216K |
| 24/09 18h-25/09 1h | competing | 27 vs 33 (C) | −18% | 6 | $51K |
| 25/09 (24 h) | sharing | 101 vs 137 (C) | **−26%** | 36 | $305K |
| 26/09 01h-28/09 08h (55 h) | **intermitente** | 235 vs 287 (C) | **−18%** | 52 | $444K |
| 30/09 13:28-01/10 10h (20,5 h) | sharing | 41 vs 106 (C) | **−59%** (techo; banda −30%…−59%) | 30-65 | $250-555K |

\* Episodios a precio $38.573-40.131: el profit/orden real era mayor que $8.535, así que ahí el costo está **subestimado**.

**El intermitente (26-28/09), hora por hora (método C):** en las **12 h en que el rival soltó la caja vendimos 77 vs 76,8 esperadas (0%)**; en las horas en que la compartía, **−22%** (22 h); en las que la tenía él, **−33%** (19 h). La recuperación es **instantánea**: no hay lag medible entre volver a `winning` y volver al ritmo normal (13h del 27/09: 7-6-7-6 órd/h contra 8,1-8,3-7,2-7,2 esperadas).

**KLOVER 14-15/09 es la excepción que explica la heterogeneidad del "competing":** P2 figuraba `competing` pero vendió **por encima** de la base y tuvo 1.337 y 1.295 visitas (récord). KLOVER ganaba solo para el comprador con "Llega hoy" (su único boost extra era `same_day_shipping`, §9): pérdida por zona, no de la ficha entera. O sea, `competing` no dice CUÁNTO tráfico perdés; `visit_share` sí, pero el vigía no lo guarda.

**El episodio actual infla su propio número:** la mañana del 30/09, todavía con caja sola según el vigía, ya iba **−30%** (08-12h: 37 vs 53). Si esa debilidad era del día, el efecto propio de compartir es ~−30%; si era la caja degradándose antes del aviso de las 13:28 (visit_share bajando), es −59%. Banda honesta: **−30% a −59%, 30-65 órdenes, $250-555K** en 20,5 h.

### 2.3 Totales

- **Régimen actual ($33.231, 23/09 13h → 01/10 10h, ~7,9 días):** sharing −136 órd + competing −40 + Premium propia −25 = **~201 órdenes ≈ $1,71M brutos antes de pauta** (sharing solo: **$1,16M**).
- **Toda la ventana (24/08 → 01/10):** sharing −262 órd (≥ $2,24M), competing −47 (≥ $0,40M; neto de KLOVER), Premium propia −182 (otra lógica).

## 3. Pauta vs caja: la pauta no es una causa aparte, es el canal por el que se va la mitad de la pérdida

Comparación de días cerrados en el mismo régimen de precio: 25/09 (sharing 24 h, viernes) vs 29/09 (caja sola 24 h, martes) — Product Ads de P2 deduplicado por `item_id`, gasto NETO de IVA:

| | 29/09 sola | 25/09 compartida | Δ |
|---|---:|---:|---:|
| impresiones (prints) | 128.145 | 50.782 | **−60%** |
| clicks | 931 | 701 | −25% |
| gasto Ads | $371K | $252K | −32% |
| unidades atribuidas a Ads (directas+indirectas) | 98 | 75 | −23% |
| unidades orgánicas (Ads) | 30 | 25 | −17% |
| visitas P2 (API) | 1.459 | 1.117 | −23% |
| visitas no pagas (visitas − clicks) | 528 | 416 | −21% |
| conversión (órdenes P2 / visitas) | 8,4% | 8,6% | = |

Lectura:
- **La pérdida es tráfico, no conversión**: la conversión no se mueve; caen las visitas pagas y no pagas casi en la misma proporción (−25% y −21%).
- **El anuncio sigue a la caja.** Prueba dura: con la caja en nuestra Premium (11-13/09) P2 pasó de ~35-46K impresiones/día a **~350/día (−99%)** y la Premium subió a 38-64K. Con la caja compartida, P2 imprime la mitad. Medido en clicks, **~2/3 de las visitas perdidas son clicks de Ads** (−230 de −342) y por atribución de ML **~80% de las unidades perdidas venían de la pauta** (−23 de −28).
- **Consecuencia práctica: subir presupuesto no recupera la caja.** El 01/10 goteros gastó el 72% del presupuesto con `lost_by_budget` 0,00 (§14): el límite no es plata sino elegibilidad de la impresión. Coincide con el candado de no tocar presupuesto/target cuando el freno no es presupuesto.
- **Atenuante del costo:** compartiendo se gasta menos pauta. Días del régimen sin caja sola vs el promedio con caja (~$375K netos/día): 23/09 −30K · 24/09 −78K · 25/09 −123K · 26/09 −120K · 27/09 −30K · 30/09 −149K ≈ **$530K netos ≈ $640K con IVA**. Neto, el régimen actual costó **~$1,07M** (no $1,71M). *Inferido*: el presupuesto es promedio diario de la campaña (goteros incluye la x4 y otros ítems), así que parte de ese ahorro puede re-gastarse en otros días o ítems.

## 4. x4 y x3 (aplica poco)

- **x4 `MLA1908275639`** (ficha `MLA74008314`, hoy sola): 6 episodios fuera de la caja (31/08, 02/09, 04-05/09, 08-09/09, 30/09 19:57 → 01/10 05:42). En los de agosto-septiembre la x4 vendía ~4 órd/día y fuera de la caja vendió **~0 (−85% a −100%)**, pero son ~1-7 órdenes por episodio: **~15 órdenes en total**. El de anoche (8 h nocturnas) dio 7 vs 7,9: ruido. Ojo con el 05/10 (sube a $57.000 sola, §12).
- **x3 `MLA2055177767`**: `competing` 04/09 18h → 09/09 11h: 13 vs 40 (**−68%, −27 órd**). Lo de después (23-28/09 `listed`/`not_listed`) es el bloqueo por reputación del §12.1, no caja; no lo cuento acá.

## 5. Qué tan confiable es cada número

| dato | tipo | confianza |
|---|---|---|
| estado de la caja en cada lectura | **medido** (log del vigía, ptw de ML) | alta |
| hora exacta de cada cambio | **medido** si hubo aviso ML (`evt`), **inferido** (punto medio, ±3 h) si no | media |
| órdenes por hora | **medido** (`ml_orders`, `paid`+`partially_refunded`, fila por orden) | alta |
| línea base | **inferido** (3 métodos; placebo −0,6%) | media: ±10 pp por episodio de un día, ±30 pp en episodios <10 h |
| −1/3 compartiendo | inferido, **robusto**: 3 métodos dan −33/−34/−39% | media-alta |
| "competing" | inferido, **no robusto**: −15% a −54% según el rival (por zona vs ficha entera) | baja |
| $8.535/orden | Playbook 24/09 (comisión+flete+COGS, sin pauta), constante | media; subestima los episodios de agosto (precio mayor) |
| pauta ahorrada | inferido (diferencia contra días con caja) | baja-media |
| visitas diarias por ítem | medido, pero el día del endpoint puede ser UTC | media |

No controlado: shocks de demanda del día (el caso del 30/09 a la mañana), la caída de demanda de Pureza en ML de fin de septiembre (§12, también bajaron x3/x4), y si las órdenes perdidas se fueron a otro pack nuestro (el §14 midió que el 01/10 P2 explica el 96% de la caída de la cuenta: casi no hay sustitución interna).

## 6. Contradicción con el vault (no la resolví; para corregir donde vive)

El log del vigía dice que **P2 estaba `winning` del 05/08 al 29/08** (~20 lecturas/día, todas `winning`), salvo el `sharing` del 29/08 y el `competing` del 31/08 a la mañana. El Playbook-ML-Catalogo §10.1 afirma que el contrafactual "sin caja" es un estado **"vivido 16 días seguidos (15→30/08, `competing`/`minimum`)"**, y de ahí sale el **"la caja vale +35% / −26% de unidades sin caja"** que usa el tablero del §12 para comparar la Premium contra la Clásica. Si el log tiene razón, esa diferencia de 61,3 → 83,0 órd/día **no es efecto de la caja** sino de la bajada de precio del 31/08 ($40.131 → $38.573) y de lo que haya cambiado ese día. El comentario del propio `app/api/salud/cajas/route.ts` ("entre el 26 y el 30/08 se perdían las cajas del x2 y el x4 de verdad") tampoco cuadra con su log: x2 `winning` hasta el 29/08 y x4 `winning` hasta el 31/08 02:19. **Lo que mido acá, −1/3 compartiendo, es el número directo que reemplazaría a ese −26%.**

## 7. Reglas que salen

1. **Caja compartida = −1/3 de las órdenes del x2** (≈ 46 órd/día sobre 137 ≈ **$390K/día brutos, ~$300K netos** de la pauta que no se gasta). Banda por episodio: −22% a −41% (−59% el actual, con dudas).
2. **El rival que entra y sale cuesta en proporción a sus horas, no por día**: cuando suelta la caja volvemos al 100% en la misma hora (sin lag); un día intermitente como el 26-28/09 costó **−18%**. Costo ≈ 1/3 × fracción del día con el rival adentro.
3. **"competing" no es una sola cosa**: contra un rival que gana la ficha entera, −30% a −54%; contra uno que gana solo por zona (KLOVER con "Llega hoy"), ~0%. Hace falta `visit_share`, no solo `status`.
4. **La mitad o más de la pérdida viaja por Ads**: el anuncio de catálogo se imprime según la caja (−60% impresiones compartiendo, −99% cuando la tenía la Premium). Subir presupuesto o target no compensa.
5. **Con la regla 1, la cuenta del §14 se sostiene**: perder 1/3 a $8.535 (~$390K/día) sigue siendo mejor que ganar todo a $4.260 (137 × $4.260 = $584K contra 137 × 2/3 × $8.535 = $780K). Bajar del piso de $33.000 solo empataría si compartir costara ~50%, y eso pasó en uno solo de los 13 episodios (el actual, y con dudas).

## 8. Mejoras que harían más fino esto (no ejecutadas)

- Que el vigía guarde `status` + `visit_share` + `winner` en una tabla (hoy solo queda en el log de GitHub, que se borra a los 90 días: **los logs de agosto vencen a principios de noviembre**). Barato y es la única historia de caja que existe.
- Que el cron corra de verdad cada hora (desde el 27/08 son ~5 lecturas/día).

## Archivos

Todo en el scratchpad de esta sesión:
- `runs.txt`, `logs/` — las 600 corridas del vigía crudas · `cajas-hist.json` — estados parseados (ART)
- `events.json` — avisos `catalog_item_competition_status` · `data1.json` — visitas diarias por ítem y fichas · `data2.json` — Ads diario por ítem + órdenes por hora
- `parse.mjs`, `an.mjs`, `an2.mjs`, `an3.mjs`, `an4.mjs` — reproducen todo (`node an.mjs <scratchpad>`; `an.mjs` genera `hours.json`, que usan los demás)
