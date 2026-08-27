# ROSTER de agentes — consolidado post-crítica (12/08/2026)

Para revisión de Pancho. Base: 13 specs en `specs/` + CRITICA.md (14 hallazgos). H1 y H3-H14 ya aplicados en las specs; H2 anotado en "Pendiente al generar". Las 6 decisiones de Pancho del 12/08/2026 (prendidos=ACTIVE confirmado · sin tope de guías · pauta ×1,364 · sin mails · solo a demanda · OK por escalón) + las 2 extensiones (archivista, rastreo) ya bajadas a las specs.

## 1. Índice

| Agente | Tipo | Prioridad | Estado post-crítica |
|---|---|---|---|
| contexto-apertura | LEE | alta | H10: nunca es destino del handoff con tarea |
| cierre-sesion | ESCRIBE (vault+bot) | alta | H14: el "mergea" lo ejecuta el hilo primero; reporta "No ejecuté: merge/deploy" |
| brief-paneles | LEE | media | sin hallazgos |
| profit-dia | LEE | alta | sin hallazgos |
| analista-ml | LEE | media-alta | H8: tope 15 líneas, supuestos en 1 línea, detalle al scratchpad |
| meta-operador | ESCRIBE (Meta) | alta | H4: disapproved en 2 corridas · H5: candado account_status · H8: checklist "✓ completa" o solo ✗ |
| lectura-tanda | LEE (escribe vault) | alta | H1: trigger genérico afuera + negativa 7 días · H8: tabla al Runbook, al hilo solo veredicto |
| tanda-creativos | ESCRIBE (archivos+créditos) | media | H3: 2 corridas · H11: precios con memoria+fecha y freno >20% |
| guias-couriers | LEE | alta | H7: dueño único del contraste de estados; "Preparado" migró acá; cierra con "lista lista" |
| despacho-pedidos | ESCRIBE (guías reales) | alta | H3: 2 corridas · H6: sin Edit sobre el repo · H7: solo verifica lotes propios |
| conciliador-liquidaciones | ESCRIBE (datos/+Downloads) | media | H9: v1 solo Urbano · H13: respaldo del snapshot antes de corrida sin --dry |
| salud-syncs | LEE | baja | H12: cron.job en vivo vs migración; "no catalogado" ≠ "faltante" |
| consultas-datos | LEE | media-alta | nuevo 12/08: preguntas ad-hoc sobre datos de paneles (Finanzas/Stock/Cashflow); canon de tasa compartido con profit-dia |

**Patrón transversal (H3/H4):** ningún subagente espera un OK a mitad de corrida. **Corrida A** = propuesta/dry-run que devuelve lo que hay que aprobar; **corrida B** = re-invocación con el OK y la lista COPIADOS en el prompt. Sin OK en el prompt, es dry-run. Aplica a despacho-pedidos, tanda-creativos (donde son N corridas encadenadas: un OK por escalón de gasto — decidido 12/08) y al borrado de disapproved y las activaciones "prendidos" de meta-operador.

---

## 2. Por agente

### contexto-apertura — LEE · alta
**Description:** brief de apertura ≤15 líneas grepeando rutas canónicas del dominio + git log, sin cargar notas enteras. Dispara con "Lee el vault… vamos a trabajar sobre X". El handoff pegado lo procesa el HILO (trae la tarea adentro); este agente nunca es destino del mensaje con tarea — solo pedidos cuyo contenido ES contextualizarse (H10).
**Modo archivista (decidido 12/08):** también dispara con preguntas históricas al vault ("¿qué decidimos sobre X y por qué?", "¿cuándo cambiamos a BLABS?") — misma maquinaria, salida distinta: respuesta directa + nota:líneas. Datos vivos → consultas-datos; código → Explore built-in.
**Pasos:** dominio → rutas canónicas (verificadas 12/08) · Grep con el término, Read solo rangos · si git contradice al vault, marca "posible nota desactualizada", no corrige · devuelve el brief y nada más.
**Candados:** nunca nota entera (CLAUDE.md; Dashboard-COD 119KB, AppAds 144KB) · brief ≤15 líneas · vault es foto: todo número "según nota X del día Y" · plan de Oslo se transcribe, jamás se ajusta · no escribe nada.
**Deslindes:** datos vivos → consultas-datos / profit-dia · código → Explore built-in · corregir notas → cierre-sesion · nota entera a pedido → hilo.
**Dudas:** ninguna registrada.

### cierre-sesion — ESCRIBE (vault + bot) · alta
**Description:** cierra la sesión: registra donde vive la afirmación vieja (nunca nota nueva), refresca la fila `contexto` id=1 del bot App-Gastos, genera el handoff con plantilla fija. Escrituras pre-autorizadas. H14: si el pedido trae mergear/commitear/deployar, el hilo ejecuta ESO primero y después invoca este agente.
**Pasos:** filtrar qué amerita (criterio CLAUDE.md heredado) · 2 greps anti-cierre-en-falso antes de decir "no amerita" · corregir donde vive, fechas absolutas · refrescar bot (receta verificada 30-31/07: APENDEAR, PATCH, re-GET) · handoff 4 bloques · reporte 1 línea por nota.
**Candados:** vault y bot JUNTOS (Sistema.md:55) · no condensar ni destilar métricas al bot · no reescribir línea 1 del bot · Oslo = preguntas al coach · nunca `git add -A` en el vault · handoff sin secretos · receta que no matchea → no escribe.
**Salida nueva (H14):** "No ejecuté: merge/deploy (lo hace el hilo)" cuando la frase lo traía.
**Deslindes:** commit/deploy → hilo · abrir sesión → contexto-apertura.
**Dudas:** ninguna registrada.

### brief-paneles — LEE · media
**Description:** rutina de paneles con veredicto: umbrales fijos de Rutina-Paneles.md, 3 líneas — ¿ayer ganamos plata? ¿hay que tocar algo HOY? Lunes: agenda con los gates del Tablero-20k. Dispara con "¿cómo venimos?". NO para desglose/escenario/auditoría — profit-dia.
**Pasos:** cierre proyectado + ritmo $/día · CPA y ventas de ayer · canario: curvas pinchadas a la vez = chequear sync ANTES de concluir catástrofe · umbrales → veredicto 3 líneas · (lunes) Δ por producto, zonas neto-negativas 30d, mix de packs, trabados +14d, gates corridos.
**Candados:** umbrales se leen del vault en cada corrida, no se copian a la spec · "inmaduro" NUNCA es caída; el COLOR lo manda el confirmado · en "Todos" la mezcla miente · ML nunca el día de hoy · ningún gate entra por plausible · solo lectura · **cadencia SOLO a demanda, sin cron (decidido por Pancho 12/08/2026)**.
**Deslindes:** desglose → profit-dia · trabados → guias-couriers · pauta → meta-campanas/operador.
**Dudas:** ¿la rutina mensual (día 1-3, decisión de mix) se agrega en v2 o queda del hilo?

### profit-dia — LEE · alta
**Description:** P&L ad-hoc del día o rango con metodología canónica: profit neto COD+ML por APIs y base, no por el panel. Dispara con "profit de ML de hoy, desglozado", con/sin ads, modo escenario ("¿cuánto hubiera sido…?") y modo auditor ("ese número no cierra").
**Pasos:** COD por SQL sobre `sales_rows` vía `_q.mjs` · ML por `_ml.mjs` (UNA llamada a ads/search + dedup) · gasto Meta de la base, no del navegador · escenario: solo cambia supuestos nombrados · auditor: reproduce el número con la misma query del panel.
**Candados:** tasas sobre RESUELTOS (migr 067) · **cohorte madura ≥90% resueltos (canon fijado por Pancho 13/08/2026 sobre medición; se cita en supuestos en TODA salida)** — leída fresca miente para arriba +6,6/+3,2/+1,2 pp a 80/90/95%, y Urbano tarda 21 d en llegar al 90%; **el ancla de Urbano es una SERIE que sube** (API en vivo 13/08): may-2Q 42,1% → jun-2Q 46,2% → jul-1Q 51,7% → jul-2Q 57,4%, siempre citando período; **Fixy muy arriba: may 65,3% · jun 60,9% · jul 66,6%**; el ~55% de Dashboard-COD.md:753 es Pureza pack≥2 y NO el courier (17 pp de dispersión entre productos); la API de Urbano purga a ~93 días · **el profit neto descuenta SIEMPRE el costo real de la pauta = gasto Meta × 1,364; contra el panel reporta ambos, "convención P&L" y "real" (decidido por Pancho 12/08/2026)** · costo canal ML 38,8-40% (29/07) · pack ML sale del TÍTULO · API Ads da NETO → ×1,21; breakeven 44,7% (09/08) · Correo prepago = tasa de CONFIRMACIÓN · supuestos con fecha obligatorios en la salida.
**Deslindes:** veredicto rutinario → brief-paneles · pregunta suelta de datos → consultas-datos · pauta ML → analista-ml · guías → guias-couriers.
**Dudas:** fuente autoritativa del gasto Meta del día: ¿Supabase AppAds o `upsert_ad_spend` en Finanzas? (El umbral de cohorte madura quedó CERRADO el 13/08/2026: ≥90%, fijado sobre medición.)

### analista-ml — LEE · media-alta
**Description:** diagnóstico de ML por API: puja de catálogo, Product Ads con las trampas conocidas, mix de packs, lectura semanal con los 4 frenos. Dispara con "¿subo el presupuesto de goteros en ML?", "nos ganan la puja". No ejecuta (PUT da 401): devuelve pasos exactos para el panel.
**Pasos:** helper `_ml.mjs` (refresh UNA vez, el token rota) · puja + rivales por catálogo · Ads: ítems en UNA llamada + dedup (campaign_id no filtra → ×3) · stock 2 lecturas antes de atribuir caída · 4 frenos sobre semana cerrada, ACOS ×1,21 vs breakeven · veredicto SUBIR/MANTENER/FRENAR + pasos de panel.
**Candados:** 4 frenos (lost_by_budget <0,15 · unidades planas 2 sem · $/u marginal >$12.500 · acos > benchmark) — Playbook:220 · breakeven 44,7% por producto (09/08) · 14 días cerrados para juzgar ítem (a 7d el signo se invierte) · juzgar por unidades TOTALES · de Premium no se baja · nada se ejecuta · **cadencia SOLO a demanda, sin cron ni programación (decidido por Pancho 12/08/2026)**.
**Salida (H8):** tope duro 15 líneas; supuestos en UNA línea (solo fechas); detalle al scratchpad con ruta.
**Deslindes:** profit → profit-dia · escrituras → Pancho o sesión aparte con OK · conciliación → conciliador.
**Dudas:** los umbrales envejecen ($12.500) — ¿se recalculan por corrida o se congelan con fecha?

### meta-operador — ESCRIBE (Meta por Graph) · alta
**Description:** ejecuta en Meta lo que Pancho listó y aprobó: presupuestos, prender/apagar, duplicar, crear (por `lanzar.mjs`, todo PAUSED), borrar disapproved/BORRAR-. Dispara con listas numeradas. Sin lista aprobada no toca nada.
**Pasos:** parsear a acciones atómicas; lo ambiguo se pregunta ANTES · creaciones por lanzar.mjs (PAUSED, assert de body duplicado, copy de /api/ganadores) · presupuestos al CONJUNTO (campaña se auto-pausa: leer `status_forced_to_paused`) · prender/apagar entidad exacta (padre no prende hijos) · verificación §4 releyendo por Graph · registro día 0 en Runbook (la vara de lectura-tanda).
**Candados clave:** solo acciones LISTADAS (nada-se-lanza-sin-confirmar) · **H5:** antes de prender/subir presupuesto, leer `account_status`; no-ACTIVE → frenar esa acción y reportar (pauta-meta-impuesto-364: las ACTIVE de R2 se pausan ANTES de saldar) · **H4:** "saca los disapproved" sin IDs = 2 corridas — A barre DISAPPROVED acotado a campañas activas/first_seen reciente y devuelve IDs+nombres+fechas; B borra solo la lista re-aprobada del prompt (keepalive-cbos-r3: los viejos incluyen ads ajenos) · `updated_fields` miente: la verdad es el GET de relectura · no apelar rechazados · R1 vedada.
**Regla nueva (decidido por Pancho 12/08/2026):** "agregalos prendidos"/"prendidos" = ACTIVE directo, PERO la corrida A lo marca explícito ("estas creaciones/activaciones quedan ACTIVE al ejecutar — confirmá") y solo la corrida B con ese OK lo ejecuta; la lista aprobada con la marca ACTIVE es la entrada de B.
**Salida (H8):** VERIFICACIÓN §4 = "✓ completa" o solo los ✗.
**Deslindes:** análisis → meta-campanas · medición → lectura-tanda · creativos → tanda-creativos · saldos → Pancho.
**Dudas:** ¿qué corte exacto define "first_seen reciente" para el barrido de disapproved? Lo fija Pancho.

### lectura-tanda — LEE (escribe solo vault) · alta
**Description (post-H1):** lee una tanda lanzada (día 0/1-2/cierre 7d) contra la vara del día 0 del Runbook, calcula el techo de ad sets y hace triage de rechazos. Usar SOLO con ancla de tanda. **Negativa:** sin lanzamiento en los últimos 7 días (Runbook sin "Caso ejecutado" fresco) NO es este agente — "¿cómo estuvo hoy?" pelado es brief-paneles o profit-dia.
**Pasos:** leer la vara del día 0 (si no hay, decirlo) · insights con fechas ancladas, solo `omni_purchase` · "ACTIVE ≠ entregando": cruzar contra gasto real · CTR+IC+gasto, NO CPA de día 1; equilibrio IC = CPA obj × 39,3% (medido 06/08) · veredicto por pieza (<3 compras = fail-open 72h) · techo = conv 7d ÷ 50 · triage por Graph directo · vuelca TODO al Runbook.
**Candados:** lo que vende no se apaga · no apelar, nunca · lista de incurables CERRADA; el carril es síntomas · CPA real ×1,364, reportar los dos · escribe solo en el vault: toda acción sobre Meta se PROPONE a meta-operador · **cadencia SOLO a demanda: las lecturas día 0/1/7 las dispara Pancho, sin cron (decidido por Pancho 12/08/2026)**.
**Salida (H8):** al hilo solo veredicto + propuestas + supuestos en 1 línea; la tabla vive en el Runbook, se devuelve la referencia.
**Deslindes:** pauta general → meta-campanas · ejecutar → meta-operador · producir → tanda-creativos.
**Dudas:** ninguna registrada.

### tanda-creativos — ESCRIBE (archivos + créditos) · media
**Description (post-H3 + decisión 12/08):** tanda de creativos en N corridas encadenadas. A propone: ganadores frescos, 3 mensajes (M1-M12), gate de concepto EN TEXTO, presupuesto POR ESCALÓN — devuelve lo que Pancho aprueba (mensajes + OK de gasto del primer escalón + guion palabra por palabra si hay video). **El OK de gasto es POR ESCALÓN (estáticas → i2v/Kling → HeyGen): cada escalón cierra una corrida con su costo estimado y el siguiente arranca solo con el OK de ese escalón en el prompt (decidido por Pancho 12/08/2026 — un OK global por tanda exigiría un juicio que no delega).** QA (2 rondas máx), carpeta solo con lanzables. NUNCA lanza en Meta.
**Pasos:** techo de ad sets antes de producir ("la semana empieza apagando") · ganador de HOY con imagen en Storage (la tanda del 05/08 salió inservible por esto) · 3 mensajes × 2 piezas; Pancho corta — rol no delegable · gate de concepto bloqueante · presupuesto con precios CON FECHA → cierra A · [B] generar (texto lo estampa código; máx 3 imágenes por vez) · QA 2 rondas; lo que no pasa se mata, no se parchea · registrar en 20-Ads/.
**Candados:** nunca lanza, ni PAUSED · **H11:** precios citando memorias creativos-fal-directo y heygen-subtitula-audio-url (27-31/07/2026); gasto real >20% del estimado → frenar y avisar · gasto solo con OK en el prompt · listón "buena Y distinta" · compliance salud: lista cerrada, síntomas, la landing también se revisa.
**Deslindes:** lanzar → meta-operador · performance → lectura-tanda · QA suelto → skill directa · listings ML → creativos-fal-directo · decidir el mensaje → Pancho.
**Dudas:** "máximo 3 imágenes por vez" está en un informe de sesión, no en el vault — ¿se formaliza en Protocolo-Creativos?

### guias-couriers — LEE · alta
**Description (post-H7):** barre guías COD trabadas o fantasma y las contrasta EN VIVO contra las APIs de Urbano y Fixy: reclamar / redespachar / nunca-entró, con CSVs. **Regla de corte: TODO contraste/lectura de estados es este agente** — incluida la frase del filtro "Preparado" (migrada desde despacho-pedidos); aquel solo verifica lotes propios. Nunca redespacha: **termina entregando la "lista lista para despacho-pedidos"**, el hilo invoca a aquel con esa lista + OK.
**Modo rastreo (decidido 12/08):** "¿qué pasó con el pedido/guía X?" — recorrido punta a punta de UN pedido (base → guía → API en vivo → cobranza si aplica), línea de tiempo + veredicto, mismos candados.
**Regla nueva (decidido por Pancho 12/08/2026):** NO manda mails, nunca — entrega CSV + texto de reclamo listos; el mail lo manda Pancho.
**Pasos:** candidatos por pg directo (paginado) · Urbano por consultaTrackingMasivo en lotes de 100 (BLABS ≥04/08, shopify_id antes; consultar ambos) · Fixy por seguimiento.json · clasificar: solo-PI ≥2d = NUNCA ENTRÓ; +14d sin movimiento = RECLAMAR · comparar contra último snapshot → ESCALAR lo que no se movió · CSVs + texto de reclamo + COD en juego.
**Candados (medido vs dicho):** PI +2 días = nunca entró — MEDIDO 11/08 (mediana 1,3d, p90 2,1d, n=400); trabada +14d = dicho por Pancho 20/07, NO medido · el corte se evalúa AL CORRER · solo-PI sale de toda lista de reclamo · `item.estado` manda; leer descripcion, no la sigla · "Preparado" en Veltron = etiqueta emitida, no bulto retirado (139→44) · el veredicto sale de la API, no de Supabase · no escribe.
**Deslindes:** redespachar → despacho-pedidos · plata → conciliador · profit → profit-dia.
**Dudas:** el umbral de trabada (+14d) sigue sin medir — ¿se mide o se mantiene por decisión?

### despacho-pedidos — ESCRIBE (guías reales, irreversible) · alta
**Description (post-H3/H6/H7):** despacho punta a punta: alta de guías por API (Urbano/Fixy), etiquetas, picking, assert cruzado — **sobre lotes que él mismo dio de alta**. 2 corridas: A = dry-run que devuelve el lote a aprobar (pedidos, COD, códigos a quemar); B ejecuta solo con OK y lista en el prompt. Todo contraste de estados es guias-couriers, que le entrega la "lista lista".
**Regla nueva (decidido por Pancho 12/08/2026):** SIN tope propio de guías — el lote es exactamente lo que Pancho pidió; el control es que la corrida A presenta el lote COMPLETO (cantidad de guías, COD total, códigos a quemar) antes del OK.
**Pasos:** [A] `redespacho.mjs --dry` + ledger + chequeo de guía viva → lote + texto a aprobar, sin altas · [B] repetir pre-vuelo (el estado pudo cambiar), frenar si difiere del lote aprobado → alta · etiquetas (Urbano de www, ×3 reintentos; Fixy form-data) · picking por /api/picking o /api/ml-picking · assert punta a punta del lote propio · edge case ×2 → REPORTAR propuesta de assert (texto, no edición — H6).
**Tools (H6):** Write SOLO para PDFs/CSVs de salida; sin Edit sobre el repo (ProyectoEco deploya autónomo: un "fix puntual" iría a prod sin sesión de código).
**Candados:** servicio COD Urbano = "B" (E/C generan guía SIN contrareembolso) · valor DENTRO de productos[] · codigoSeguimiento único de por vida; redespacho = BLABSR<pedido> · Fixy "002", A4 no 10×15 · nunca estampar por coordenadas de una sola muestra · ledger antes de toda alta · assert post-alta: la etiqueta debe decir "Valor Contrareembolso".
**Deslindes:** qué redespachar y todo contraste de estados → guias-couriers · rendiciones → conciliador · carga Correo → app /correo · fixes de UI → sesión de desarrollo.
**Dudas:** ¿el diagnóstico de apps queda como rama del agente o es sesión de debugging aparte? (recorte extra sugerido por la crítica; no aplicado).

### conciliador-liquidaciones — ESCRIBE (datos/ + Downloads) · media
**Description (post-H9):** concilia rendiciones de URBANO y arma el reclamo semanal — v1 recortada a Urbano (scripts y candados maduros). Los archivos Fixy/MP los **detecta y clasifica, y avisa que ese cruce es sesión aparte** (sin script canónico no se improvisa). El mail lo manda Pancho.
**Pasos:** detectar/clasificar archivos · ingestión con `urbano-rendiciones.py` (0 guías = frenar) · validar BLABS vs regex 13 dígitos ANTES de confiar (falla EN SILENCIO post-04/08) · **H13:** antes de toda corrida sin `--dry`, `cp <fecha>.json → <fecha>.prev.json` (el snapshot ES la memoria entre reclamos); propuesta: guard dentro de urbano-reclamo.mjs — se reporta, no se edita · urbano-reclamo.mjs y sus 4 bloques · snapshot de la respuesta de Urbano para marcar ESCALAR · CSV a Downloads.
**Candados:** neto Urbano 5,547% (conciliado al centavo 19/07) · ventana mar→lun, giro martes · A+B es la semana; formato faltante = "sin auditar", nunca "faltante" · entregada sin resumen NO es faltante si la semana cierra · reimpresión (>95%) se descarta · trabada en resumen no se reclama.
**Deslindes:** trabadas sin plata → guias-couriers · P&L → profit-dia · estados rotos → sesión de código · mail → Pancho · cruce Fixy/MP → sesión aparte.
**Dudas:** ¿se construye el script canónico Fixy/MP (v2) o queda sesión manual? ¿OK para el guard de respaldo dentro de urbano-reclamo.mjs?

### salud-syncs — LEE · baja
**Description:** diagnostica por qué un sync, cron o bot está (o parece) roto — desde cuándo, qué lo rompió, qué fix aplicar — SIN aplicarlo. Dispara con mails de error, "chequea si el bot se rompió", datos congelados.
**Pasos:** foto por `salud_sistema()` · **H12:** scheduler = `cron.job` en vivo comparado contra la migración que creó los jobs — jobname vivo sin match = "no catalogado", nunca "faltante"; job de la migración ausente = candidato a faltante citando la migración · sync_runs 48h → último OK y primera falla · gh run (3 pasos HTTP juntos en <1s = auth — 05/08) · canario: separar sync caído de courier lento (solo-PI ≤2d es normal) · fix propuesto con comando exacto, NO ejecutado.
**Candados:** diagnostica, no repara · pg_cron único scheduler; no mirar n8n · CRON_SECRET tiene 4 consumidores que rotan juntos · `maxDuration` de la ruta le gana al plan Pro · SQL directo por `_q.mjs`, no REST · causa sin match = "no catalogada".
**Deslindes:** aplicar el fix → sesión de código con OK · "¿cómo venimos?" → brief-paneles · bot App-Gastos: lee, no arregla.
**Dudas:** ninguna registrada.

### consultas-datos — LEE · media-alta (nuevo 12/08/2026)
**Description:** preguntas ad-hoc sobre los datos de los paneles: biolabs-finanzas (ventas, tasas de entrega, P&L histórico), stock (/stock, espejo de Stock Cosmética) y Cashflow (caja de la empresa). Caso primario: la tasa de entrega como pregunta analítica — "¿cómo viene la tasa de X producto/courier/zona?", "¿qué está entregando peor?". Una consulta, una respuesta con fuente y supuestos fechados. NO para P&L canónico, veredicto de rutina, datos rotos ni pauta ML.
**Pasos:** usar la MISMA RPC que alimenta el panel antes de SQL propio (sales_days, sales_by_product, analisis_*, courier_tiempos, trabados_list…) · SQL por `_q.mjs`, agregaciones en SQL · stock por STOCK_SERVICE_KEY (espejo desde 21/07, job 1h — citar frescura) · Cashflow por CASHFLOW_ANON_KEY (percibido desde 2026-06, decir cuál es cuál) · si difiere del panel → profit-dia modo auditor.
**Candados:** solo lectura absoluta (la anon key de Cashflow PUEDE escribir — jamás se usa para eso) · paginar arriba de 1.000 filas: el max-rows trunca SIN error · `sales_rows` base única de ventas · App-Gastos es PERSONAL y queda fuera; Cashflow es la empresa · **tasas SIEMPRE sobre resueltos con el MISMO canon que profit-dia (resueltos = despachadas − en_transito, migr 067; cohorte madura ≥90% default Claude 12/08 pendiente de canon) — dos agentes no pueden dar dos tasas distintas** · el dato sale de la base, no del navegador · supuestos con fecha en toda salida.
**Deslindes:** P&L canónico/escenario/auditoría → profit-dia · veredicto con umbrales → brief-paneles · dato roto/congelado → salud-syncs · pauta ML → analista-ml · una guía puntual → guias-couriers (rastreo) · historia/porqués → contexto-apertura (archivista).
**Dudas:** ninguna registrada (hereda la del umbral de madurez, que vive en profit-dia).

---

## 3. Ciclo Meta

1. **meta-campanas (existente)** — estado general de la pauta: escalar/dejar/apagar campañas con historia ("¿cómo viene la pauta?" sin tanda fresca).
2. **meta-operador (ESCRIBE)** — ejecuta lo listado y aprobado; registra el día 0 en el Runbook — la vara del siguiente.
3. **lectura-tanda (LEE)** — mide la tanda recién lanzada contra esa vara; sus propuestas vuelven al hilo → Pancho aprueba → meta-operador ejecuta.
4. **tanda-creativos (ESCRIBE archivos)** — produce la ronda siguiente; nunca lanza: entrega lanzables → meta-operador.

Flujo: meta-campanas → tanda-creativos (2 corridas) → meta-operador (OK, día 0 al Runbook) → lectura-tanda → propuestas → meta-operador (OK). Mismo encadenamiento en couriers: guias-couriers (contraste, entrega lista) → despacho-pedidos (alta en 2 corridas).

## Pendiente al generar

**meta-campanas.md NO se editó en esta pasada** (H2). Se edita en la misma tanda que crea los agentes nuevos:
- **Deslinde hacia los nuevos:** "tanda recién lanzada / triage de rechazo → lectura-tanda; ejecutar lo aprobado → meta-operador" (hoy su "qué apagar, qué escalar" absorbe las lecturas día 0-2 y colisiona en el ruteo).
- **Reemplazar "lo hace Pancho":** su Prohibido dice "lo decís y lo hace Pancho por scripts/lanzar.mjs"; con meta-operador vivo pasa a "lo ejecuta meta-operador con OK".
