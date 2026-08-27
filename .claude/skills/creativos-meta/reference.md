# Referencia — Análisis de Creativos de Meta

Detalle operativo de la skill `creativos-meta`. La lógica de negocio (reglas, números) vive en el vault; esto es el "cómo".

## Cheatsheet de tools del conector Meta Ads MCP

Prefijo real: `mcp__…__ads_*` (cargar con ToolSearch si están deferidas).

| Necesito | Tool |
|---|---|
| Listar cuentas (confirmar cuál) | `ads_get_ad_accounts` (mirar `is_queryable` + `is_ads_mcp_enabled`; ignorar las `false`) |
| Listar campañas/adsets/ads de una cuenta | `ads_get_ad_entities` (nivel `campaign`/`adset`/`ad`; solo cuentas con `is_queryable:true`) |
| El creativo/copy de un ad | `ads_get_creatives`, `ads_get_creative_ads` |
| Imagen / video del creativo | `ads_get_ad_images`, `ads_get_ad_videos` |
| Ver la pieza renderizada | `ads_get_ad_preview` |
| Performance nivel ad (CPA/CTR/ROAS/freq/spend) | tools `ads_insights_*` / entidades con métricas — elegir la que devuelve métricas a nivel ad; ventana 7d y lifetime |
| Benchmarks de subasta / industria | `ads_insights_auction_ranking_benchmarks`, `ads_insights_industry_benchmark` |
| **Competencia (público)** | `ads_library_search` (por `page_ids` o `search_terms` + `countries`; devuelve `ad_snapshot_url`) |

Notas:
- Los insights fallan intermitente en el conector → si tira error, reintentar o chat nuevo (registrado en [[Learnings]]).
- El log fino de actividad (`ads_account_get_activity_logs`, hora + quién) todavía NO está habilitado en Tienda R 2 ("gradually rolled out"); solo hay `updated_time` por objeto (fecha sin hora, last-write-wins).
- Presupuestos ABO viven a nivel **adset**, no campaña — barrer ambos niveles.

## Productos y contexto (BioLabs, COD Argentina)
veinguard (spray, azul) · natures / natures-sunrise (gotas, drenaje linfático — ⚠️ hay 2 productos Natures) · pureza / purezadrops (gotas) · beevenom (spray, psoriasis) · altus (celulitis) · favrix (aceite, fuera del análisis de ganadores). Landings: `https://biolabsarg.com/collections/all/products.json`.

- **CPA Meta ≠ CPA real**: CPA real = CPA Meta ÷ tasa de entrega (por producto, no por courier). ROAS de Meta engaña en COD → mirar **ROAS neto** (dashboard COD).
- Objetivos/máximos por producto: **leer de `producto_objetivos` / última pasada de [[Learnings]]**, no de acá.

## Template de registro — PROPIOS (`20-Ads/Analisis-Propios-YYYY-MM.md`)

Tabla resumen (una fila por ad relevante):

```markdown
| ad_id | Producto | Tipo | Formato | Hook | Ángulo (mensaje real) | Oferta | CTA | CPA 7d | CTR | Freq | Veredicto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 12023… | pureza | cbo | video | síntoma en pantalla (panza) | "no estás gorda, estás hinchada" | 2x1+pago al recibir | comprar ahora | $4.059 | 3,1% | 1,8 | mantener |
```

Desglose detallado (solo para los que ameriten), reusando el rubric de Creativos-Ganadores:

```markdown
### <ad_id> — <nombre> (<producto>)
- **Hook:** … (primer frame / primera línea; ¿síntoma en pantalla?)
- **Cuerpo:** … (estructura real: prueba social / mecanismo / bullets / testimonio)
- **Oferta:** … (2x1, envío gratis, pago al recibir, cupón…)
- **CTA:** …
- **Visual:** … (formato, primer frame, watermark/artefactos)
- **Ángulo/mensaje:** … (el mensaje REAL, no el código angvNN)
- **Performance:** CPA 7d $… vs objetivo $… · CTR …% · freq … · compras … 
- **Veredicto:** escalar / mantener / renovar-visual / ampliar-audiencia / revisar-oferta-landing / renovar-audiencia / apagar / clonar
- **Higiene:** copy cruzado / typo / watermark / sin-producto (si aplica)
```

## Template de registro — AJENOS (`20-Ads/Competencia-<marca>.md`)

Sin métricas: se lee lo creativo + señales de escala.

```markdown
# Competencia — <marca> (page_id …)
**Última pasada:** YYYY-MM-DD · fuente: Ad Library `ads_library_search` (AR)

**Foto de escala:** N ads activos · más viejo hace … · ángulo que más repite: …

| ad_snapshot_url | Formato | Hook | Ángulo/mensaje | Oferta | CTA | Notas |
|---|---|---|---|---|---|---|

## Patrones / gaps para nosotros
- Ángulo que escalan y NO corremos: …
- Oferta/gancho a testear: …
```

## Cómo escribir en el vault
- Crear/editar con las tools `mcp__mcp-obsidian__obsidian_*`: `obsidian_append_content` (crea si no existe), `obsidian_patch_content`, `obsidian_get_file_contents`.
- Mantener el estilo del vault: español rioplatense, tablas, links `[[Nota]]`, negritas para lo accionable, fecha `YYYY-MM-DD` al tope.
- Siempre linkear a [[Creativos-Ganadores-2026-07]], [[Learnings]], [[Fabrica-Creativos]] según corresponda.

## Ruteo a la Fábrica
El Guionista (06) de [[Fabrica-Creativos]] emite `variantes[{id,titular,texto_sobre_imagen,descripcion_visual,cta}]` y lee `v_ganadores_por_angulo`. Los insights de un análisis se traducen a **brief**: qué ángulo/estructura/hook clonar o iterar. No inventar estructura nueva donde ya hay ganador (ej. gotas: iterar solo el visual sobre el body "40.000+ mujeres").
