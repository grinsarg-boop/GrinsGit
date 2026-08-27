---
name: creativos-meta
description: Analizar creativos/anuncios de Meta Ads — propios (conector Meta Ads MCP) y de la competencia (Ad Library pública) — con un rubric fijo (hook/cuerpo/oferta/CTA/visual/ángulo) cruzado con performance (CPA/CTR/ROAS/freq), registrar en el vault 20-Ads/ y rutear a la Fábrica de creativos. Usar cuando se pida analizar, auditar, desglosar o comparar anuncios, hooks, ángulos, creativos ganadores o de competidores en Meta/Facebook/Instagram.
---

# Análisis de Creativos de Meta — BioLabs

Analiza creativos de Meta y deja registro accionable. **No reinventa nada**: se enchufa al sistema que ya existe en el vault — rubric de [[Creativos-Ganadores-2026-07]], reglas de [[Learnings]], y alimenta el Guionista de [[Fabrica-Creativos]].

## Cuándo se usa
"Analizá/auditá estos ads", "desglosá este creativo", "qué está corriendo <competidor>", "comparar hooks/ángulos", "sacar los ganadores", "qué conviene renovar/clonar/apagar".

## Los dos flujos

### A) Propios — vía conector Meta Ads MCP
1. **Cuenta operativa: Tienda R 2 `act_880189106877616`** (ARS). Hay 50+ cuentas, muchas inhabilitadas por "actividad inusual"; confirmar con `ads_get_ad_accounts` solo si se pide otra (BioLabs *Mini1*, Palma, Moorea, etc.).
2. **Traer el creativo REAL** (no inferir del nombre): `ads_get_ad_entities` para listar campañas/adsets/ads → `ads_get_creatives` / `ads_get_ad_images` / `ads_get_ad_videos` / `ads_get_ad_preview`. **Leer el copy y VER el preview.**
3. **Traer performance nivel ad** con las tools de insights del MCP (`ads_insights_*` o entidades con métricas): CPA, CTR, freq, spend, compras, ROAS. Ventanas: **7d para reaccionar, lifetime para juzgar ganador**.
4. **Clasificar con el naming estricto**: tipo `abo/cbo/cxr` + `angv0X-formato-oferta-vXX-publico`. ⚠️ Los códigos `angvNN` **NO distinguen el mensaje** (bodies repetidos entre 01/02/04/06); la variación real es visual → mirar el copy real, no el código.

### B) Ajenos / competencia — vía Ad Library (público)
1. `ads_library_search` por `page_ids` (la página de la marca) o `search_terms`, con `countries:['AR']` (o el país objetivo) y `ad_active_status`.
2. Abrir el `ad_snapshot_url` de cada ad para ver la pieza.
3. **No hay métricas públicas.** Se analiza lo creativo + **señales de escala**: cuántos ads activos tiene, hace cuánto corren, qué ángulo repite (= qué está escalando y funcionando).

## Rubric (idéntico al de Creativos-Ganadores)
Desglosar cada pieza por: **hook · cuerpo · oferta · CTA · visual · ángulo/mensaje**.
- **Hook** = primer frame / primera línea. Regla validada del vault: abrir con **síntoma en pantalla** (dolor físico real en primer plano, sin producto), nunca con autoridad (doctora IA) ni packshot.
- **Ángulo/mensaje** = el mensaje REAL en palabras, no el código `angvNN`.
- **(Solo propios) + bloque performance**: CPA vs objetivo del producto, CTR, freq → **veredicto** (abajo).

## Fuente de verdad — leer en vivo, NO copiar acá
Estos números cambian seguido (los objetivos de CPA se recalcularon 3 veces en una semana). **Nunca hardcodear en la skill**; leer al momento:
- **Objetivos/máximos de CPA por producto** → tabla `producto_objetivos` en Supabase (`sicilwlxtwrspnazwcve`) y la última pasada de [[Learnings]] (la de abajo del todo manda).
- **Regla de ganador, taxonomía de ángulos, ranking de hooks, estructuras ganadoras** → [[Creativos-Ganadores-2026-07]].
- **Lógica de fatiga, COD (CPA real = CPA Meta ÷ tasa de entrega; mirar ROAS neto, no el de Meta), entrega por producto** → [[Learnings]].

## Veredicto (vocabulario, derivado de la lógica de fatiga)
- **escalar** — CPA sano bajo objetivo.
- **mantener** — al filo del objetivo, no tocar.
- **renovar-visual** — CTR↓ + CPA↑ con freq baja = desgaste del creativo.
- **ampliar-audiencia** — freq↑ + CPA↑ con CTR estable = saturación de público (no matar el creativo).
- **revisar-oferta/landing** — CPA↑ solo (CTR y freq sanos) = conversión/subasta; NO tocar el creativo.
- **renovar-audiencia** — CXR con CPA↑ sin mover CTR/freq = pool agotado.
- **apagar** — CPA > máximo breakeven del producto.
- **clonar** — ganador a replicar (clonar el mejor ad antes de abrir ángulo nuevo).

## Registro (en el vault, carpeta `20-Ads/`)
Ver `reference.md` para los templates exactos. Convención:
- **Propios**: registro periódico `20-Ads/Analisis-Propios-YYYY-MM.md` (tabla resumen + desglose de los relevantes). Hallazgos estructurales → sumar a [[Learnings]].
- **Ajenos**: una nota por competidor `20-Ads/Competencia-<marca>.md` (o un vistazo suelto en `20-Ads/Competencia.md`).
- **Índice**: [[Analisis-Creativos]] (MOC que linkea todo lo de arriba + las notas previas).
- **Higiene detectada** (copy cruzado, typos activos, watermarks del proveedor, ads sin producto) → anotar como en Creativos-Ganadores.

## Ruteo — "usar donde corresponde"
- Insights de ángulo/hook/estructura → **brief del Guionista (06)** de [[Fabrica-Creativos]] (que ya lee `v_ganadores_por_angulo`).
- **Ganador nuevo** → candidato a **clonar** antes de abrir ángulo.
- Si el problema **NO es creativo** (conversión/oferta/landing/segmentación) → NO renovar el visual; marcar para oferta/landing (error clásico del vault: VeinGuard ABO).
- **Ajenos**: ángulos/ofertas que la competencia escala y vos no corrés = **gap para testear**.
