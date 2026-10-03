# Cierre de la sesión del 24/09/2026 — etiquetas de ML por API

Escrito el 26/09/2026. No se commiteó ni deployó nada.

## 1. Greps corridos en el vault (~/Claude/Obsidian)

Antes de decidir qué amerita, según el chequeo anti-cierre-en-falso:

| Término | Resultado |
|---|---|
| `etiqueta` (todo el vault) | 60+ hits, casi todos de creativos IA (garble de etiqueta del frasco). Los operativos: `Operaciones-COD.md:185-190`, `Dashboard-COD.md:1045-1117` (preparador), `:1119-1166` (contrato de alta de guías por courier), `:1362-1365`, `:1395-1425` (fix de `mlGet`) |
| `shipment_label / ready_to_ship / lead_time / límite de despacho` | **cero hits**. El vault no afirmaba nada sobre el endpoint ni sobre el límite de despacho |
| `Etiquetas ML` / `/etiquetas` | `Dashboard-COD.md:696, 1363, 1397, 1419`, `Benchmark-Finanzas-App.md:41`, `Master.md:69` — todos describen la pestaña, ninguno dice de dónde sale el PDF |
| `a mano` / `del panel de ML` / `subís los PDF` | `Operaciones-COD.md:185` ("subís los PDF de etiquetas de todos los couriers… los ML/Flex se leen de la etiqueta") es lo más cerca de afirmar lo viejo |
| nota-manual del área: `Rutina-Paneles.md` (`etiqueta`, `imprim`, `picking`) | **cero hits de etiquetas**. La rutina de paneles no toca impresión → no se actualiza |

Conclusión del chequeo: **no había una afirmación falsa explícita**, pero sí dos párrafos de los que se deducía el flujo manual, y un contrato de etiquetas por courier (Urbano / Fixy) al que le faltaba ML. Se corrigieron esos, no se creó nota nueva.

## 2. Notas tocadas

### `~/Claude/Obsidian/10-BioLabs/Operaciones-COD.md`

1. **Línea 185** (§16/07/2026, descripción de `/picking`): se agregó al final de la frase *"los ML/Flex se leen de la etiqueta"* → `⚠️ Actualizado 24/09/2026: los PDF de ML ya no se bajan a mano del panel — salen por API (GET /shipment_labels), y el cruce contra la API de ML manda sobre lo impreso. Ver §24/09/2026 al final.`
2. **Línea 190** (mismo §, bullet del pack): se agregó `⚠️ 24/09/2026: el título es FALLBACK, las unidades las da la API de ML (catálogo)` con el caso medido (etiquetas **P6 y P8** con título x3 y x4 = multi-compra, 2× "Lleva 3" = 6).
3. **Sección nueva al final (línea 1796)**: `## 24/09/2026 — Las etiquetas de ML salen por API, y pedirlas las marca impresas`. Contiene el endpoint, las 4 trampas medidas (marca `printed`; lotes incompletos sin error 25→24 con el id `48073634487`; Flex+drop-off pierde páginas 6→4; el límite de despacho no está en la API), el corte por hora de venta (07:58 vs 07:59 del 23/09, 70 envíos), la cola autoritativa (`/orders/search` 359 vs `ml_orders` 339), el volumen (366 en 4 PDFs: 1+204+111+50), la trampa del filtro de `/logistica` (`ordenar` vs `stampByPage`) y los 3 pendientes.

### `~/Claude/Obsidian/50-Proyectos/Dashboard-COD.md`

4. **Línea 1167**, subsección nueva `### ML — la etiqueta SÍ sale de la API (agregado 24/09/2026)`, dentro de §2026-08-11 "Contrato de ALTA de guías", justo después de las subsecciones de Urbano ("la etiqueta NO sale de la API") y Fixy. Es el párrafo del que se deducía que ML era manual. Remite a `Operaciones-COD §24/09/2026`.
5. **Línea 1413** (§2026-09-19, el fix de `mlGet`): matiz sobre *"`ml_orders` completa (1.581/1.581…)"* — ese "completa" es por `order_items` de lo que ya está en la tabla, no por cobertura de la cola; el 24/09 la tabla daba 339 contra 359 reales.

**No se tocó** `Rutina-Paneles.md` (no habla de etiquetas), ni `Integracion-ML-MP.md` (su bloque de límites de escritura por API sigue siendo cierto: `/shipment_labels` es lectura), ni ninguna conclusión sobre cosas no investigadas.

## 3. Qué NO se registró (y por qué)

- El detalle de los scripts y su uso → vive en git (`scripts/ml-etiquetas.mjs`, `_ml-etiqueta-parse.py`, `_ml-etiquetas-filtro.mts`), aunque hoy sin commitear.
- El trabajo de rutina del día (armar los 4 PDFs, pasarlos por el filtro) → solo el número medido quedó como volumen de referencia.
- Nada de esto se guardó (de nuevo) en memoria: `ml-etiquetas-por-api` y `etiquetas-ml-pasan-por-logistica` ya existían de la sesión.

## 4. Bot de WhatsApp (App-Gastos)

Fila `contexto` id=1 del proyecto Supabase `jgxdnxqpkapmjgpahdyk`: sección **apendeada** al final (línea 1 intacta, no se reescribió nada).

- Header: `ETIQUETAS DE ML POR API · 24/09/2026 (sesión ProyectoEco de etiquetas ML del 24/09, cerrada el 26/09/2026; NADA commiteado ni deployado)`
- PATCH REST `Prefer: return=minimal` → **204**. Re-GET: **406.887 → 410.437 chars (+3.550)**.
- Supuestos validados antes de escribir: `SB_KEY` en `app.js:5` matchea `sb_publishable_…` (46 chars) y el texto termina en secciones fechadas con el patrón `TEMA · dd/mm/aaaa` (la última era `FIXY: resolved_at TOMABA LA RENDICIÓN… · 25/09/2026`). Sin desvíos, sin fallback.
- Números cargados sin destilar: endpoint textual, id `48073634487`, 25→24, 6→4, 07:58/07:59, 339/359, 366 = 1+204+111+50, 12 Flex, 46 marcadas.

## 5. Estado del repo al cerrar (para auditar)

- `docs/etiquetas-ml/` — 11 archivos, 4 PDFs crudos + 4 `_10x15` + auxiliares. **Llevan domicilios de compradores.** `.gitignore` **no** tiene ninguna regla para `docs/` (verificado 26/09/2026).
- `scripts/ml-etiquetas.mjs` (10.067 B), `scripts/_ml-etiqueta-parse.py` (1.339 B), `scripts/_ml-etiquetas-filtro.mts` (6.213 B) — untracked.
- Rama `main`, último commit `d9737bb`. Sin commit ni deploy de esta sesión.
