# Tasa de entrega COD — serie canónica semanal y baseline (Plan 100M A13-R1-T3)

Medido el **02/10/2026 ~11:20 ART** sobre Supabase Finanzas (solo lectura). Sync fresco: Urbano último ok 02/10 14:17 UTC, Fixy 14:22 UTC; `delivery_priors` recalculado 02/10 14:10 UTC.

## Definición elegida (y la que choca)

- **Vigente en el vault y elegida:** tasa = **entregadas / resueltas** (resuelto = despachadas − en tránsito, migración 067), cohorte madura con **≥90% resuelto** (canon Pancho 13/08/2026, Rutina-Paneles:49; reafirmado en Dashboard-COD:1221 el 29/09/2026). La regla de 20 días del pedido se usa como **compuerta de madurez** (toda venta de la semana con ≥20 d) y además se exige ≥90% resuelto para que la semana sea "oficial".
- **Choca con la lectura literal "entregados ≤20 d / resueltos a 20 d"**: congelar numerador y denominador a los 20 días **infla Urbano +2,8 pp** en el baseline (56,2% vs 53,4%), porque a los 20 d de la venta Urbano está solo 86–92% resuelto y lo que sigue abierto es mayoritariamente devolución (es el sesgo "fresca miente para arriba" medido el 13/08). Por eso no se usa.
- **Al lado, columna congelada:** entregadas dentro de 20 d de la venta / despachadas con ≥20 d (todo lo no entregado a los 20 d cuenta como fallo). No se mueve nunca, pero es un **piso**: queda 1,5–3 pp abajo de la canónica en Urbano (entregas tardías).

Universo: guías Urbano + Fixy (`shipments`) de órdenes con `created_at` (ART) ≥ 29/06/2026, agrupadas por **semana de venta** lun–dom ART. Se excluyen: guías `cancelado`; **prepago mal clasificado** (tracking que empieza con `0001494211`, formato Correo: 157 Urbano + 23 Fixy desde 29/06, todos `cuotas_3` y clavados en "despachado"); órdenes `cuotas_3`; fantasmas solo-PI (Urbano `PI` / Fixy `41` con >7 d, mismo criterio que `sales_rows`). **Se incluyen** las órdenes canceladas en Shopify después de despachar (son devoluciones reales; `sales_rows` las saca e infla Urbano). Unidad = guía (8 órdenes con 2 guías en todo el período). Blend = pooled (ponderado por volumen de resueltas). IC95 = Wilson.

## (a) Query SQL (lista para correr)

Correr desde la raíz del repo: `node scripts/_q.mjs < archivo.sql` (o pegar en el SQL editor de Supabase). Solo se tocan los tres parámetros del primer CTE.

```sql
-- Tasa de entrega COD: serie canonica SEMANAL por semana de venta (lun-dom, ART) + baseline.
-- Solo lectura. Correr: node scripts/_q.mjs < este_archivo.sql   (o pegar en el SQL editor)
-- Parametros (unico lugar a tocar):
--   desde      = lunes de la primera semana de la serie
--   base_desde / base_hasta = lunes de la primera y la ultima semana del baseline
with params as (
  select date '2026-06-29' as desde,
         date '2026-08-10' as base_desde,
         date '2026-08-31' as base_hasta,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as hoy
),
base as (
  select s.id, s.courier, s.status_canonical as st, s.resolved_at,
         date_trunc('week', o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as semana,
         o.created_at + interval '20 days' as h20
  from shipments s
  join orders o on o.id = s.order_id
  cross join params p
  where s.courier in ('urbano','fixy')
    and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= p.desde
    and s.status_canonical <> 'cancelado'                       -- etiqueta anulada antes de salir
    and s.dispatched_at is not null
    and s.tracking !~ '^0001494211'                              -- prepago mal clasificado (tracking formato Correo)
    and (o.tags is null or lower(o.tags) not like '%cuotas_3%')  -- prepago (link MP): no es COD
    -- fantasma solo-PI: etiqueta emitida que el courier nunca recibio (mismo criterio que sales_rows)
    and not (((s.courier = 'urbano' and s.status_raw = 'PI')
           or (s.courier = 'fixy' and (s.status_raw = '41'
                or lower(coalesce(s.status_raw,'')) like '%pendiente de retiro%')))
          and current_date - s.dispatched_at > 7)
    -- NO se excluyen las ordenes canceladas en Shopify despues de despachar: son devoluciones reales
    -- (sales_rows si las excluye y por eso infla Urbano ~+2 pp).
),
r as (
  select b.*,
         b.st in ('entregado','rehusado','en_devolucion','devuelto','siniestro') as resuelta,
         -- momento de entrega = resolved_at (097: primer evento de la racha final)
         (b.st = 'entregado' and b.resolved_at <= b.h20) as ent20,
         (b.h20 <= now()) as mad20
  from base b
),
agg as (
  select r.semana, coalesce(r.courier, 'blend') as courier,
         (r.semana + 27 <= p.hoy) as madura20,             -- todo pedido de la semana ya tiene >= 20 d
         count(*) as despachadas,
         count(*) filter (where resuelta) as resueltas,
         count(*) filter (where st = 'entregado') as entregadas,
         count(*) filter (where mad20) as desp_mad20,
         count(*) filter (where mad20 and ent20) as ent20
  from r cross join params p
  group by grouping sets ((r.semana, r.courier), (r.semana)), p.hoy
),
tot as (
  select a.semana::text as periodo, a.* from agg a
  union all
  select 'BASELINE ' || to_char(p.base_desde,'DD/MM') || '-' || to_char(p.base_hasta + 6,'DD/MM'),
         null, courier, bool_and(madura20),
         sum(despachadas), sum(resueltas), sum(entregadas), sum(desp_mad20), sum(ent20)
  from agg cross join params p
  where semana between p.base_desde and p.base_hasta
  group by courier, p.base_desde, p.base_hasta
)
select periodo, courier, madura20,
       round(100.0*resueltas/nullif(despachadas,0),1) as pct_resuelto,
       (madura20 and resueltas >= 0.9*despachadas) as oficial,   -- canon 13/08: >=90% resuelto
       despachadas, resueltas, entregadas,
       -- TASA CANON: entregadas / resueltas (migr 067, canon 13/08 y 29/09/2026), IC95 Wilson
       round(100.0*entregadas/nullif(resueltas,0),1) as tasa,
       round(100*(ph + z*z/(2*n) - z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_lo,
       round(100*(ph + z*z/(2*n) + z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_hi,
       -- AL LADO: entregadas dentro de 20 d de la venta / despachadas con >= 20 d (congelada, piso)
       desp_mad20, ent20,
       round(100.0*ent20/nullif(desp_mad20,0),1) as tasa_20d_desp
from tot,
lateral (select entregadas::numeric/nullif(resueltas,0) as ph,
                nullif(resueltas,0)::numeric as n, 1.96::numeric as z) w
order by periodo, courier;
```

## (b) Serie semanal (al 02/10/2026)

n = resueltas (denominador). "madura" = toda venta de la semana con ≥20 d **y** ≥90% resuelto. La semana del 07/09 está **parcial**: 712 de 918 guías ya tienen ≥20 d; la última venta (13/09 23:59) cumple 20 d el **03/10 23:59**, así que entra completa en la actualización del **lunes 05/10**. Hoy no se puede tener completa hasta el 07/09 con madurez 20 d estricta; lo completo llega hasta el 31/08. Semanas desde el 14/09: sin tasa (inmaduras).

| semana (lun) | estado | Urbano n | Urbano tasa [IC95] | Fixy n | Fixy tasa [IC95] | Blend n | Blend tasa [IC95] | % resuelto (blend) | al lado: ent≤20d/desp U · F · B |
|---|---|--:|---|--:|---|--:|---|--:|---|
| 29/06 | madura | 553 | 50,6% [46,5–54,8] | 132 | 64,4% [55,9–72,0] | 685 | 53,3% [49,5–57,0] | 100,0% | 48,5 · 64,4 · 51,5 |
| 06/07 | madura | 349 | 51,3% [46,1–56,5] | 77 | 54,5% [43,5–65,2] | 426 | 51,9% [47,1–56,6] | 100,0% | 49,3 · 54,5 · 50,2 |
| 13/07 | madura | 556 | 62,2% [58,1–66,2] | 115 | 71,3% [62,5–78,8] | 671 | 63,8% [60,1–67,3] | 100,0% | 60,6 · 71,3 · 62,4 |
| 20/07 | madura | 343 | 62,1% [56,9–67,1] | 89 | 76,4% [66,6–84,0] | 432 | 65,0% [60,4–69,4] | 100,0% | 60,6 · 76,4 · 63,9 |
| 27/07 | madura | 327 | 48,3% [43,0–53,7] | 78 | 70,5% [59,6–79,5] | 405 | 52,6% [47,7–57,4] | 99,8% | 45,7 · 70,5 · 50,5 |
| 03/08 | madura | 287 | 54,0% [48,2–59,7] | 53 | 77,4% [64,5–86,5] | 340 | 57,6% [52,3–62,8] | 100,0% | 52,3 · 77,4 · 56,2 |
| 10/08 | madura | 449 | 55,2% [50,6–59,8] | 106 | 76,4% [67,5–83,5] | 555 | 59,3% [55,1–63,3] | 100,0% | 53,5 · 76,4 · 57,8 |
| 17/08 | madura | 553 | 52,3% [48,1–56,4] | 129 | 68,2% [59,8–75,6] | 682 | 55,3% [51,5–59,0] | 99,9% | 49,5 · 68,2 · 53,0 |
| 24/08 | madura | 618 | 52,4% [48,5–56,3] | 201 | 61,2% [54,3–67,7] | 819 | 54,6% [51,2–58,0] | 99,8% | 50,2 · 61,2 · 52,9 |
| 31/08 | madura | 770 | 54,0% [50,5–57,5] | 164 | 62,2% [54,6–69,3] | 934 | 55,5% [52,3–58,6] | 97,7% | 51,0 · 61,4 · 52,8 |
| 07/09 | parcial (712/918 con ≥20 d) | 688 | 52,2% [48,4–55,9] | 140 | 55,7% [47,4–63,7] | 828 | 52,8% [49,4–56,2] | 90,2% | 46,7 · 45,5 · 46,5 |
| 14/09 | inmadura | 694 | — | 148 | — | 842 | — | 81,6% | — · — · — |
| 21/09 | inmadura | 375 | — | 99 | — | 474 | — | 50,5% | — · — · — |
| 28/09 | inmadura | 10 | — | 22 | — | 32 | — | 5,8% | — · — · — |
| **BASELINE 10/08-06/09** | madura | 2390 | 53,4% [51,4–55,4] | 600 | 65,7% [61,8–69,4] | 2990 | 55,9% [54,1–57,7] | 99,2% | 50,9 · 65,4 · 53,8 |

Lectura: Urbano oscila 48–55% salvo el pico de dos semanas de julio (62%); Fixy viene **bajando**: 76% (03/08–10/08) → 68% → 61–62% (24/08–31/08). El baseline de 4 semanas de Fixy (65,7%) queda arriba de sus dos últimas semanas — tenerlo en cuenta si se lo usa como vara de mejora.

## (c) Baseline al 28/09/2026

**Definición:** las **4 últimas semanas de venta maduras a 20 d al 28/09/2026** = semanas del 10/08, 17/08, 24/08 y 31/08 (ventas 10/08–06/09), pooled, entregadas/resueltas, IC95 Wilson. (La del 07/09 no estaba madura al 28/09.)

| | n resueltas | tasa | IC95 | al lado: ent≤20d/desp |
|---|--:|--:|---|--:|
| **Urbano** | 2.390 | **53,4%** | 51,4–55,4 | 50,9% |
| **Fixy** | 600 | **65,7%** | 61,8–69,4 | 65,4% |
| **Blend COD** | 2.990 | **55,9%** | 54,1–57,7 | 53,8% |

Reproducibilidad: el baseline está 99,2% resuelto; puede moverse ±0,2 pp mientras cierran las 23 guías abiertas (casi todas de la semana del 31/08). La columna "al lado" no se mueve.

## (d) Brecha contra el prior de `sales_days` (Tablero-20k:331)

Tablero-20k:331 (24/09) suponía que el prior estaba **más alto** que la entrega real. **Medido hoy es al revés: está más BAJO.**

`delivery_priors` nivel courier (02/10 14:10 UTC; ventana `dispatched_at` entre current_date−35 y −21 = **28/08–11/09**, entregadas / **todas** las despachadas): **Urbano 49,2% (n=1.578) · Fixy 56,3% (n=359) · blend 50,5%**.

| | prior | baseline | brecha |
|---|--:|--:|--:|
| Urbano | 49,2% | 53,4% | **−4,2 pp** |
| Fixy | 56,3% | 65,7% | **−9,4 pp** |
| Blend | 50,5% | 55,9% | **−5,4 pp** |

Por qué (descompuesto sobre la misma ventana del prior, recalculado y coincide exacto):

| paso | Urbano | Fixy |
|---|--:|--:|
| prior tal cual (`recompute_priors`) | 49,2 | 56,3 |
| − prepago formato Correo (38 / 4 guías "despachado" que nunca se entregan) | 50,4 (+1,2) | 56,9 (+0,6) |
| − fantasmas solo-PI | 50,4 (0) | 57,1 (+0,2) |
| denominador = resueltas (49 / 11 abiertas contadas como fallo) | 52,0 (+1,6) | 58,9 (+1,8) |
| resto = cohorte distinta (despacho 28/08–11/09 vs venta 10/08–06/09) | −1,4 | −6,8 |

1. **Defectos del prior (~2,8 pp Urbano, ~2,6 pp Fixy):** divide sobre todas las despachadas (cuenta abiertas como no entregadas) y no excluye el prepago mal clasificado con tracking Correo. Es el bug ya anotado en Dashboard-COD:1221 (29/09), más el prepago, que esa nota no tenía.
2. **Cohorte (Urbano −1,4, Fixy −6,8):** la ventana del prior es más reciente que el baseline y cae sobre las semanas más flojas (07/09: Urbano 52,2, Fixy 55,7). En Fixy es casi todo cohorte: **la caída de Fixy es real** (76% → 62%), no un artefacto del prior.
3. No incluido en la descomposición: el corrimiento de un día por `current_date` en UTC (Dashboard-COD:1221) — la corrida de las 14:10 UTC no lo sufre.

Consecuencia: la hipótesis de Tablero-20k:331 ("el prior parece más alto, bajarlo") queda **refutada en el nivel**: si el estimado baja ~5% al madurar, la causa no es un prior alto (no investigado acá). Comparación con el panel: `/ventas` (`entrega_semanal`, sobre `sales_rows`) muestra para las mismas 4 semanas Urbano **54,7%** (1.277/2.333, sobre despachadas, sin las órdenes canceladas) y Fixy 65,9% — Urbano ~+1,3 pp sobre la canónica porque `sales_rows` saca 80 guías de órdenes canceladas (casi todas devueltas). La diferencia es de definición, no un error de esta query; auditar con profit-dia si hace falta.

## Problemas de datos

- **Fixy, migración 099 sin aplicar** (commit `a6286ea`, no está en `main`): **14 guías Fixy con evento de entrega (código 39) que siguen como en_transito/incidencia** — 12 en la semana del 07/09 y 2 en la del 31/08 (eventos duplicados 27–745 por guía). Efecto: Fixy 07/09 lee **55,7%; corregida ~59,2%**; baseline Fixy +0,1 pp (inmaterial). La query no lo parchea (usa `shipments.status_canonical`, como el canon); se corrige sola al aplicar la 099.
- **`en_devolucion` no tiene `resolved_at`** (431 Urbano): no afecta la tasa canónica (que lee el estado), sí cualquier variante que necesite fecha de resolución.
- Urbano a los 20 d de la venta está solo **86–94% resuelto** según la semana: con madurez 20 d la semana recién madura del lunes puede estar justo debajo del 90% (07/09 Urbano 89,8%) → marcarla provisoria hasta pasar el 90%.
- API de Urbano purga a ~93 días: no afecta (las semanas de junio-julio ya están 100% resueltas en la base).

## (e) Bloque para pegar en Rutina-Paneles.md

~~~~markdown
### Tasa de entrega COD — serie canónica semanal (vara del Plan 100M, fijada 02/10/2026)

**Definición:** entregadas / resueltas (resuelto = despachadas − en tránsito, migr 067), por **semana de venta** lun–dom ART, guías Urbano + Fixy. Excluye guías canceladas, prepago (`cuotas_3` y tracking formato Correo `0001494211…`) y fantasmas solo-PI >7 d. Incluye órdenes canceladas en Shopify después de despachar (son devoluciones). Semana **oficial** = toda venta con ≥20 d **y** ≥90% resuelto (canon 13/08/2026). Blend = pooled. IC95 Wilson. Columna "al lado": entregadas ≤20 d de la venta / despachadas con ≥20 d (congelada, piso).

**Baseline al 28/09/2026** (semanas 10/08–31/08, ventas 10/08–06/09): **Urbano 53,4% [51,4–55,4] n=2.390 · Fixy 65,7% [61,8–69,4] n=600 · Blend 55,9% [54,1–57,7] n=2.990.**

| semana (lun) | estado | Urbano n | Urbano tasa [IC95] | Fixy n | Fixy tasa [IC95] | Blend n | Blend tasa [IC95] | % resuelto (blend) | al lado: ent≤20d/desp U · F · B |
|---|---|--:|---|--:|---|--:|---|--:|---|
| 29/06 | madura | 553 | 50,6% [46,5–54,8] | 132 | 64,4% [55,9–72,0] | 685 | 53,3% [49,5–57,0] | 100,0% | 48,5 · 64,4 · 51,5 |
| 06/07 | madura | 349 | 51,3% [46,1–56,5] | 77 | 54,5% [43,5–65,2] | 426 | 51,9% [47,1–56,6] | 100,0% | 49,3 · 54,5 · 50,2 |
| 13/07 | madura | 556 | 62,2% [58,1–66,2] | 115 | 71,3% [62,5–78,8] | 671 | 63,8% [60,1–67,3] | 100,0% | 60,6 · 71,3 · 62,4 |
| 20/07 | madura | 343 | 62,1% [56,9–67,1] | 89 | 76,4% [66,6–84,0] | 432 | 65,0% [60,4–69,4] | 100,0% | 60,6 · 76,4 · 63,9 |
| 27/07 | madura | 327 | 48,3% [43,0–53,7] | 78 | 70,5% [59,6–79,5] | 405 | 52,6% [47,7–57,4] | 99,8% | 45,7 · 70,5 · 50,5 |
| 03/08 | madura | 287 | 54,0% [48,2–59,7] | 53 | 77,4% [64,5–86,5] | 340 | 57,6% [52,3–62,8] | 100,0% | 52,3 · 77,4 · 56,2 |
| 10/08 | madura | 449 | 55,2% [50,6–59,8] | 106 | 76,4% [67,5–83,5] | 555 | 59,3% [55,1–63,3] | 100,0% | 53,5 · 76,4 · 57,8 |
| 17/08 | madura | 553 | 52,3% [48,1–56,4] | 129 | 68,2% [59,8–75,6] | 682 | 55,3% [51,5–59,0] | 99,9% | 49,5 · 68,2 · 53,0 |
| 24/08 | madura | 618 | 52,4% [48,5–56,3] | 201 | 61,2% [54,3–67,7] | 819 | 54,6% [51,2–58,0] | 99,8% | 50,2 · 61,2 · 52,9 |
| 31/08 | madura | 770 | 54,0% [50,5–57,5] | 164 | 62,2% [54,6–69,3] | 934 | 55,5% [52,3–58,6] | 97,7% | 51,0 · 61,4 · 52,8 |
| 07/09 | parcial (712/918 con ≥20 d) | 688 | 52,2% [48,4–55,9] | 140 | 55,7% [47,4–63,7] | 828 | 52,8% [49,4–56,2] | 90,2% | 46,7 · 45,5 · 46,5 |
| 14/09 | inmadura | 694 | — | 148 | — | 842 | — | 81,6% | — · — · — |
| 21/09 | inmadura | 375 | — | 99 | — | 474 | — | 50,5% | — · — · — |
| 28/09 | inmadura | 10 | — | 22 | — | 32 | — | 5,8% | — · — · — |
| **BASELINE 10/08-06/09** | madura | 2390 | 53,4% [51,4–55,4] | 600 | 65,7% [61,8–69,4] | 2990 | 55,9% [54,1–57,7] | 99,2% | 50,9 · 65,4 · 53,8 |

(al 02/10/2026; 07/09 parcial, entra completa el lunes 05/10. Fixy 07/09 lee ~3,5 pp bajo por la 099 sin aplicar.)

**Actualizar cada lunes:**
1. Desde la raíz de ProyectoEco: `node scripts/_q.mjs < docs/tasa-cod-serie-canonica.sql` (la query de abajo; solo lectura).
2. Agregar la fila de la semana que pasó a `oficial = true` (la que terminó hace 3 lunes: lunes L → semana L−28). Si `madura20` es true pero `oficial` false (<90% resuelto), anotarla como provisoria y reemplazarla el lunes siguiente.
3. Re-copiar las 2 semanas oficiales anteriores (pueden moverse unas décimas mientras cierran las últimas guías). No tocar el baseline: es fijo al 28/09/2026.
4. Antes de leer: sync de Urbano/Fixy ok en las últimas 2 h (`sync_runs`).

```sql
-- Tasa de entrega COD: serie canonica SEMANAL por semana de venta (lun-dom, ART) + baseline.
-- Solo lectura. Correr: node scripts/_q.mjs < este_archivo.sql   (o pegar en el SQL editor)
-- Parametros (unico lugar a tocar):
--   desde      = lunes de la primera semana de la serie
--   base_desde / base_hasta = lunes de la primera y la ultima semana del baseline
with params as (
  select date '2026-06-29' as desde,
         date '2026-08-10' as base_desde,
         date '2026-08-31' as base_hasta,
         (now() at time zone 'America/Argentina/Buenos_Aires')::date as hoy
),
base as (
  select s.id, s.courier, s.status_canonical as st, s.resolved_at,
         date_trunc('week', o.created_at at time zone 'America/Argentina/Buenos_Aires')::date as semana,
         o.created_at + interval '20 days' as h20
  from shipments s
  join orders o on o.id = s.order_id
  cross join params p
  where s.courier in ('urbano','fixy')
    and (o.created_at at time zone 'America/Argentina/Buenos_Aires')::date >= p.desde
    and s.status_canonical <> 'cancelado'                       -- etiqueta anulada antes de salir
    and s.dispatched_at is not null
    and s.tracking !~ '^0001494211'                              -- prepago mal clasificado (tracking formato Correo)
    and (o.tags is null or lower(o.tags) not like '%cuotas_3%')  -- prepago (link MP): no es COD
    -- fantasma solo-PI: etiqueta emitida que el courier nunca recibio (mismo criterio que sales_rows)
    and not (((s.courier = 'urbano' and s.status_raw = 'PI')
           or (s.courier = 'fixy' and (s.status_raw = '41'
                or lower(coalesce(s.status_raw,'')) like '%pendiente de retiro%')))
          and current_date - s.dispatched_at > 7)
    -- NO se excluyen las ordenes canceladas en Shopify despues de despachar: son devoluciones reales
    -- (sales_rows si las excluye y por eso infla Urbano ~+2 pp).
),
r as (
  select b.*,
         b.st in ('entregado','rehusado','en_devolucion','devuelto','siniestro') as resuelta,
         -- momento de entrega = resolved_at (097: primer evento de la racha final)
         (b.st = 'entregado' and b.resolved_at <= b.h20) as ent20,
         (b.h20 <= now()) as mad20
  from base b
),
agg as (
  select r.semana, coalesce(r.courier, 'blend') as courier,
         (r.semana + 27 <= p.hoy) as madura20,             -- todo pedido de la semana ya tiene >= 20 d
         count(*) as despachadas,
         count(*) filter (where resuelta) as resueltas,
         count(*) filter (where st = 'entregado') as entregadas,
         count(*) filter (where mad20) as desp_mad20,
         count(*) filter (where mad20 and ent20) as ent20
  from r cross join params p
  group by grouping sets ((r.semana, r.courier), (r.semana)), p.hoy
),
tot as (
  select a.semana::text as periodo, a.* from agg a
  union all
  select 'BASELINE ' || to_char(p.base_desde,'DD/MM') || '-' || to_char(p.base_hasta + 6,'DD/MM'),
         null, courier, bool_and(madura20),
         sum(despachadas), sum(resueltas), sum(entregadas), sum(desp_mad20), sum(ent20)
  from agg cross join params p
  where semana between p.base_desde and p.base_hasta
  group by courier, p.base_desde, p.base_hasta
)
select periodo, courier, madura20,
       round(100.0*resueltas/nullif(despachadas,0),1) as pct_resuelto,
       (madura20 and resueltas >= 0.9*despachadas) as oficial,   -- canon 13/08: >=90% resuelto
       despachadas, resueltas, entregadas,
       -- TASA CANON: entregadas / resueltas (migr 067, canon 13/08 y 29/09/2026), IC95 Wilson
       round(100.0*entregadas/nullif(resueltas,0),1) as tasa,
       round(100*(ph + z*z/(2*n) - z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_lo,
       round(100*(ph + z*z/(2*n) + z*sqrt(ph*(1-ph)/n + z*z/(4*n*n)))/(1+z*z/n),1) as ic_hi,
       -- AL LADO: entregadas dentro de 20 d de la venta / despachadas con >= 20 d (congelada, piso)
       desp_mad20, ent20,
       round(100.0*ent20/nullif(desp_mad20,0),1) as tasa_20d_desp
from tot,
lateral (select entregadas::numeric/nullif(resueltas,0) as ph,
                nullif(resueltas,0)::numeric as n, 1.96::numeric as z) w
order by periodo, courier;
```
~~~~
