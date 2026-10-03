# ARRAIGO · 04 — Inventario verificado de herramientas (03/09/2026)

Todas las llamadas de esta corrida fueron de **LECTURA**. No se generó, gastó ni escribió nada en
ningún servicio. "Verificado hoy" = llamada en vivo hecha en esta corrida; lo demás sale de memoria
fechada.

## 1. Claves presentes (solo nombres — nunca valores)

**`ProyectoEco/.env.local`**: `ANTHROPIC_API_KEY` · `FREEPIK_API_KEY` · `META_ACCESS_TOKEN` ·
`META_AD_ACCOUNT_ID` · `META_API_VERSION` · `ML_ACCESS_TOKEN`/`ML_CLIENT_ID`/`ML_CLIENT_SECRET`/`ML_REFRESH_TOKEN`
· `VELTRON_API_KEY` · `FIXY_API_TOKEN` · `URBANO_PASSWORD` · `SHOPIFY_CLIENT_ID`/`SHOPIFY_CLIENT_SECRET`
· `SUPABASE_SERVICE_ROLE_KEY` · `N8N_API_KEY` · `MP_KHALIL_*` · sin `FAL_KEY`, sin `HEYGEN_API_KEY`,
sin `ELEVENLABS_API_KEY` (ese pipeline vive del lado de AppAds).

**`~/AppAds-tabla/.env.local`**: `FAL_KEY` · `FREEPIK_API_KEY` · `HEYGEN_API_KEY` · `ELEVENLABS_API_KEY`
· `ELEVENLABS_VOICE_ID` · `ANTHROPIC_API_KEY` · `META_ACCESS_TOKEN` · `META_WRITE_TOKEN` · `N8N_*_WEBHOOK_URL`
(8 webhooks) · `SUPABASE_SERVICE_ROLE` · `PANEL_PASS` · sin claves de Kling/Replicate propias (van
adentro de `FAL_KEY`, fal.ai las revende).

Ninguna key de OpenAI directa en ninguno de los dos `.env`. No hay `REPLICATE_API_TOKEN` en ningún lado.

## 2. Motores de imagen y video — pipeline propio de AppAds (grep en vivo, `~/AppAds-tabla`)

| Herramienta | Qué produce | Mejor para | Costo (fecha) | Límites / trampas | Verificado hoy |
|---|---|---|---|---|---|
| `fal-ai/nano-banana-pro/edit` (`app/api/estatica/generar/route.js`) | Imagen editada desde referencia real del frasco | estática con frasco fiel, texto simple | ~US$0,15-0,30/img según resolución (medido jul/ago) | el modelo inventa texto en packaging secundario; solo protege la etiqueta frontal a 2K | Sí — grep confirma el slug activo en el route |
| `fal-ai/nano-banana-2/edit` | Igual, motor alternativo (2do engine elegible) | mismo uso, fallback/A-B | sin precio medido hoy | mismas trampas de texto que Pro | Sí — grep |
| `fal-ai/flux-2-pro/edit` | Igual, motor alternativo | hooks de síntoma en primer plano, policy más permisiva | sin precio medido hoy | prompt debe pedir texto mínimo | Sí — grep |
| `fal-ai/kling-video/v3/turbo/standard/image-to-video` (`app/api/video/generar/route.js`) | Anima una imagen 9:16/1:1 (i2v) | keyframe → video corto sin voz | ~US$1,12/10s (medido jul, tarifa de lista fal) | 500 transitorio en el poll — reintentar; hereda deformación si la imagen fuente tiene badge quemado | Sí — grep |
| `fal-ai/ffmpeg-api/{compose,merge-videos,merge-audio-video,trim-video,extract-audio,waveform}` | Corte/montaje server-side (sin ffmpeg local en Vercel) | montaje por beats, pegar voz sobre video | tarifa de lista fal, sin medir hoy | `compose` solo acepta 1 pista visual + 1 de audio; sin filtros de subtítulo | Sí — grep, 5 endpoints activos en `app/api/video/montar` |
| Freepik/Magnific vía `lib/magnific.mjs` + `app/api/escena/route.js` | "Escenas" — motor 2 de la Fábrica, ya vivo (no confundir con el conector personal del punto 3) | variación de escena/fondo | sin precio medido hoy (key propia de AppAds, cuenta distinta a la del punto 3) | usa su propia `FREEPIK_API_KEY`, no el conector MCP de esta sesión | Sí — grep |
| Claude QA — `app/api/revisar/route.js` (paso "🔎 Claude") | Copy sugerido (titular+badge) + QA (typos/claims/legibilidad/frasco) sobre una imagen ya generada | control de calidad antes de lanzar, y auto-gate en modo texto-IA | tarifa Sonnet, registrada en `registrarCosto()` — sin monto puntual medido hoy | solo corre en modo texto-IA (overlay/default no necesita QA); no baja imágenes de `scontent.fbcdn.net`, solo base64 directo | Sí — leí el route.js completo: pide `image_url` (URL pública, obligatorio), `producto`, `contexto` (opcional, ≤800 char) |
| HeyGen `POST /v3/videos` (`app/api/testimonial/generar/route.js`) | Avatar hablando con producto en mano (photo-avatar propio o librería) | testimonial/UGC con voz | **no expone precio por API** — se mide por diferencia de saldo | fallo en cadena = saldo agotado; `script` y `audio_url` mutuamente excluyentes; avatares "UGC-style" (Lizzy/Barb) NO salen por API, solo studio o photo-avatar propio | No ejecutado hoy (no es de lectura pura); confirmado por grep que el route existe y usa `HEYGEN_API_KEY` |
| ElevenLabs `eleven_multilingual_v2` (mismo route) | Voz rioplatense para el testimonial | voz en off / doblaje del guion | sin precio medido hoy | dejaba 2-5% de silencio recortable, no es palanca real | Sí — grep confirma el uso en el pipeline |
| HeyGen `caption:{file_format:'srt'}` | Subtítulos quemados sobre el MISMO audio que lipsyncea (sin desfase) | subtítulos del testimonial | incluido en el render de HeyGen | ortogonal a `script`/`audio_url`, hay que pedirlo explícito | No re-verificado hoy, memoria de 31/07 con PR #129/#136 en prod |

## 3. Conector Freepik/Magnific (MCP, cuenta personal conectada — verificado en vivo hoy)

**Cuenta:** Premium, `andreud.francisco@gmail.com`. **Saldo hoy: 15.890 / 20.000 créditos (4.110 gastados).**
Ninguna tool expuso costo por unidad — no hay campo de precio en `images_models_list` ni `video_models_list`;
para saber cuánto cuesta una pieza acá hay que disparar una y medir el delta de saldo (misma regla que HeyGen).

| Herramienta | Qué produce | Mejor para | Verificado hoy |
|---|---|---|---|
| `images_models_list` (48 modelos) | Catálogo imagen | **Seedream 5 Pro** = default recomendado (sota, product/character-consistency); **Nano Banana Pro** = recomendado #3 solo si hace falta fidelidad de marca máxima; **GPT 2** = sota para infografías/texto/UI (mejor que lo que usa hoy AppAds para texto quemado); **Nano Banana 2 Lite** = recomendado #2, barato/rápido para iterar | Sí, llamada completa |
| `video_models_list` (~50 modelos, no cupo en un solo mensaje — guardado y greppeado) | Catálogo video | **Seedance 2.0** = sota #1, "best overall", audio nativo + lipsync + referencia de escena — candidato a reemplazar Kling en el pipeline; **Kling 2.5** = recomendado #2, mejor precio/calidad para silencioso 5-10s; **Kling 3.0 Turbo** = el que ya usa AppAds; **Veo 3.1** = 16:9/9:16, 4/6/8s | Sí, greppeado del archivo completo |
| `video_speak_models_list` (lip-sync) | Habla sobre imagen o video ya existente | **OmniHuman** (imagen, hasta 30s audio) y **Veed Fabric 1.0** (imagen, hasta 300s audio, 720p/480p) — ninguno de los dos lo usa hoy AppAds (usa HeyGen aparte) | Sí |
| `audio_voices_list` (catálogo enorme, greppeado) | Voces TTS | Hay voces explícitamente "Argentine accent" y "Latin American Neutral" — alternativa/backup a la voz de ElevenLabs que ya usa AppAds | Sí |
| `images_upscale_modes_list` (5 modos Magnific) | Upscale 2x-16x | `creative` para alucinar detalle, `ultra-photo`/`ultra-sublime` para fidelidad fotográfica — no se usa hoy en ningún paso de la Fábrica | Sí |
| `account_balance` / `account_profile` | — | saldo y cuenta confirmados arriba | Sí |

**Herramientas de este conector que hoy NO usamos y podríamos** (todas de LECTURA de catálogo, cero gasto en verificarlas):
`video_speak` (lip-sync directo sobre una estática ya QA-eada, sin pasar por HeyGen), `video_dubbing`
(traducir/doblar con estudio inline), `images_skin_enhancer`, `images_relight` (relighting de escena
con hasta 4 luces), `design_auto_resize` (una imagen → set de formatos/redes de un tiro), `audio_tts`
(voces ElevenLabs/Gemini/Seed Audio sin pasar por AppAds), `stock_search` (banco Freepik, fotos/video/3D
por keyword o similitud visual).

## 4. Canva (verificado en vivo hoy)

| Chequeo | Resultado |
|---|---|
| `list-brand-kits` | **1 brand kit conectado** (id `kAF2IsB48WY`), sin nombre visible en la respuesta — no se pudo confirmar si es el kit de BioLabs/ARRAIGO sin abrirlo |
| `search-brand-templates` query="arraigo" | **0 resultados** — no hay plantilla de marca de ARRAIGO en Canva |
| `search-designs` query="arraigo" | 4 resultados, los 4 son **falsos positivos** ("Arraial", festejo brasileño — palabra distinta, no ARRAIGO) |

**Conclusión: no hay nada armado en Canva para ARRAIGO.** Si se quiere texto de marca exacto sobre
diseño (regla de la casa: texto de marca en HTML/diseño, nunca en render IA), hoy el camino real es
el que ya usa el resto de la operación — HTML capturado con Chrome headless (`html2pdf.mjs` del punto 6)
— no Canva.

## 5. Meta Ads — conector (verificado en vivo hoy, solo lectura)

| Chequeo | Resultado |
|---|---|
| `ads_get_ad_accounts` | 8 cuentas visibles. **Tienda R3 = `act_1569698667101520`, ACTIVE, `is_queryable:true`, ARS.** Tienda R2 (`880189106877616`) también ACTIVE/queryable. Tienda R1 y Dusty Rose figuran `UNSETTLED`/no queryable (no tocar, ya sabido) |
| `ads_insights_industry_benchmark` (Tienda R3, last_30d) | **"No industry benchmark data available for the given criteria."** — la tool existe y responde, pero no tiene benchmark de belleza/cuidado personal para esta cuenta ahora mismo |
| `ads_insights_auction_ranking_benchmarks` (Tienda R3, last_30d) | Devolvió ranking real, pero **de los ads actualmente activos** (Pureza, Natures, BeeVenom) — nada de ARRAIGO, porque ARRAIGO tiene 0 anuncios activos (coincide con `00-contexto.md`). La tool funciona; no hay nada que rankear hasta que se lance algo |
| `ads_get_ad_preview` | **Tool cargada y confirmada, NO ejecutada** (instrucción explícita: no correrla sobre nada). Sirve para QA visual a 380px de un ad_id/creative_id sin lanzar nada nuevo |

## 6. Veltron — el contador real de ARRAIGO (verificado en vivo hoy, solo lectura)

**Filtro usado:** `formato_csv` primero (para entender campos) → `valores_pedidos(campo="sku")` para
sacar los 3 SKU de ARRAIGO (`ARR-X1`=x1, `ARRAIGO-X3K`=x2, `ARRAIGO-X3A`=x3) → `listar_pedidos(q=<SKU
exacto>, estado=["entregado"], preset="todos")` **por cada SKU por separado**.

**Trampa encontrada y evitada:** `q` busca substring literal en cliente/#orden/SKU/teléfono, **no** en
`producto_titulo`. `q="ARR"` solo trajo falsos positivos (clientas "G**arr**ote", "Rec**arr**arren",
"N**arr**o", el substring "arr" cae en apellidos). Hubo que consultar cada SKU exacto.

| SKU | Pack | Entregados (cobrados en mano) | Total histórico (cualquier estado) |
|---|---|---|---|
| `ARR-X1` | x1 | **3** | 13 |
| `ARRAIGO-X3K` | x2 | 0 | (incluido abajo) |
| `ARRAIGO-X3A` | x3 | 0 | (incluido abajo) |
| x2+x3 combinado | — | 0 | 14 |
| **Total ARRAIGO** | — | **3 entregados y cobrados** | **27 pedidos creados** |

**El número real, verificable, hoy: 3 pedidos de ARRAIGO entregados y cobrados en mano** (los 3 del pack
x1), de 27 pedidos creados en total desde el lanzamiento. Es un número chico — consistente con que la
única tanda corrió 3 días hace casi un mes y se apagó, y con que el ciclo de entrega tarda semanas. Este
es el dato que ningún competidor prepago puede mostrar (punto 2 de LA PALANCA en `00-contexto.md`), pero
hoy el n es bajo para usarlo como prueba social masiva — sirve como ancla de un caso puntual, no como
"+X mil pedidos".

## 7. ProyectoEco — scripts y skills (verificado en vivo hoy)

| Recurso | Qué hace | Verificado |
|---|---|---|
| `scripts/html2pdf.mjs` | HTML local → PDF a tamaño exacto vía Chrome DevTools Protocol (ignora `--print-to-pdf` que fuerza Letter) | Sí, leí el header |
| `scripts/theme-asset.mjs` | Lee/escribe un archivo del theme LIVE de Shopify por Admin API; hace backup a `docs/theme-backup/` antes de pisar | Sí, leí el header — ojo: pisa producción al instante |
| "Lanzador por API" del Runbook | **No es un script de ProyectoEco** — vive como ruta (`POST /api/lanzador`) en `~/AppAds-tabla`, documentado en el vault `50-Proyectos/Runbook-Lanzar-Anuncios-API.md` | Sí, grep en `scripts/` de ProyectoEco no encontró nada con "lanzar/Lanzador/Runbook" |
| Remotion | **No está instalado en ningún repo** (`grep -rl remotion ~/AppAds-tabla ~/Downloads/ProyectoEco --include=package.json` → 0 resultados) | Sí |
| Skills locales (`.claude/skills/`) | `agent-browser`, `creativos-meta`, `ffmpeg`, `qa-ojo-de-cliente`, `frontend-design`, `web-design-guidelines`, `vercel-react-best-practices`, `yt-dlp`, `find-skills`, `grill-me`, `grill-with-docs`, `improve-codebase-architecture` | Sí, listado + frontmatter |
| Skill `design` (Claude Design canvas) | Disponible globalmente (no vive en `.claude/skills/` del repo, pero está en el roster de skills de la sesión) — arma mockups/artboards en HTML editable visualmente | Confirmado disponible, no ejecutado |
| `uvx --from openai-whisper whisper` | Transcribe audios `.opus` de WhatsApp, sin binario `whisper` instalado (usa `uvx`) | No re-ejecutado hoy; confirmado por memoria (04/08) |

## 8. HeyGen — costo (no se puede verificar sin gastar, según regla de la casa)

No expone precio antes de disparar (ni en la respuesta de la API). Únicos números medidos con fecha:
**~1,4 créditos/segundo** de video (21 créditos por 2 renders de 7,4s, medido 31/07) y el incidente del
**29/08**: una estimación de "~3 créditos" para un lote de 3 salió **113 créditos reales** (error ~38×).
Regla vigente: disparar UNO, medir el saldo antes/después, y recién ahí pedir OK por el lote completo.

---

## Podríamos disponer

### Ya existe y no lo usamos (con qué ganaríamos)

1. **`video_speak` (Freepik/Magnific, lip-sync directo)** — hoy el testimonial pasa entero por HeyGen.
   `video_speak` con modo `veed-fabric-1.0` acepta audio de hasta 300s (vs. 30s recomendados de HeyGen
   `omnihuman`) y correría sobre una estática que YA pasó el QA de Claude. Ganaríamos un fallback cuando
   HeyGen se queda sin saldo, sin depender de una sola cuenta.
2. **`Seedance 2.0` como motor de i2v** (Freepik/Magnific, catalogado sota #1) — genera con audio nativo
   y lipsync en el mismo paso, contra Kling 3.0 Turbo (el que usa hoy AppAds) que es mudo y necesita el
   paso `compose` aparte para pegar la voz. Ganaríamos un paso menos en la cadena de montaje por beats.
3. **`GPT 2` o `Recraft V4.1`** como motor de estáticas con texto/infografía — catalogados sota
   específicamente para texto legible y diseño tipo UI/infografía, un caso que Nano Banana Pro resuelve
   peor (memoria: "el modelo inventa texto en cualquier packaging secundario"). Podría bajar la tasa de
   typos que hoy filtra el paso Claude QA, no reemplazarlo.
4. **`design_auto_resize`** — una estática aprobada → set de formatos/redes de un tiro. Hoy cada pieza
   se genera nativa por formato.
5. **`ads_get_ad_preview`** — ya cargada, cero costo de usarla. Sirve para el QA a 380px que pide la
   skill `qa-ojo-de-cliente` ANTES de lanzar nada, sobre un creative_id ya subido en PAUSED.

### No tenemos y valdría conseguir (con el paso concreto)

1. **Rodaje real del momento de la puerta con el courier** (el ángulo que ningún competidor prepago
   puede filmar, punto 3 de LA PALANCA). Paso concreto: elegir 1-2 pedidos con `estado=confirmado` y
   `carrier` fixy (CABA/AMBA, más fácil de coordinar en persona) desde `listar_pedidos`, coordinar con
   Pancho el consentimiento del cliente y del repartidor ANTES de filmar (no es un dato que se pida por
   API, es logística humana) — esto no lo resuelve ninguna herramienta, es una decisión de producción.
2. **UGC de clientes reales pedido por plantilla de WhatsApp de Veltron.** Paso concreto: `listar_plantillas`
   para ver si ya existe una plantilla aprobada de "pedinos tu opinión/video"; si no existe, es al revés
   del orden habitual — primero hay que dar de alta la plantilla en el proveedor de WhatsApp de Veltron
   (fuera del alcance de este agente, de solo lectura) y recién después `enviar_plantilla` a pedidos
   `entregado`. Con el contador de hoy (3 entregados de x1, 0 de x2/x3) el universo elegible es chico —
   convendría esperar a que la próxima tanda entregue más antes de pedir UGC en volumen.
3. **Avatar HeyGen ENTRENADO (Instant/Studio Avatar), no el photo-avatar que ya se usa.** Hoy el
   "actriz propia" real es una foto fija animada (`type:"image"`, un solo frame) — funciona pero es
   acartonado en gestos. Un avatar entrenado necesita ~2 minutos de video real de una persona (con
   consentimiento explícito) subidos al flujo de creación de avatar de HeyGen; después se reusa como
   `avatar_id` en el mismo endpoint `/v3/videos` que ya está integrado. El costo de conseguirlo es la
   sesión de filmación, no código nuevo.
4. **Benchmark de industria de Meta para ARRAIGO** — hoy `ads_insights_industry_benchmark` no tiene
   datos para la cuenta en la vertical, y `ads_insights_auction_ranking_benchmarks` no tiene nada que
   rankear porque ARRAIGO no tiene ads activos. Ambos se destraban solos en cuanto se lance la próxima
   tanda — no hace falta conseguir nada, solo volver a consultar después de lanzar.
