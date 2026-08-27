# CRÍTICA adversarial — specs de agentes (12/08/2026)

Base: las 12 specs de `specs/`, SINTESIS-agentes-propuestos.md, meta-campanas.md existente, chats-chunk-1..8, y las memorias de `~/.claude/projects/.../memory/`. Verifiqué contra memoria los números citados (IDs de cuentas Meta, system user 122113105539380294, BLABS 04/08, comisión 5,547%, breakeven ML 44,7%, precios fal/HeyGen): **ningún número citado está inventado** — los problemas están en otro lado.

---

## Simulación de ruteo — 14 frases reales de Pancho

| # | Frase (textual, de los chunks) | Rutea a | Veredicto |
|---|---|---|---|
| 1 | "Como estuvo el profit de Ml de hoy, desglozado?" (c4) | profit-dia | ✓ inequívoco (analista-ml lo excluye explícito) |
| 2 | "¿cómo venimos?" (síntesis §9) | brief-paneles | ✓ (solo brief lo reclama pelado; "en ML"→analista-ml, "profit"→profit-dia) |
| 3 | "Como estuvo hoy? hace un analisis preliminar" (c7) | **lectura-tanda / brief-paneles / profit-dia** | ✗ COLISIÓN — ver H1 |
| 4 | "Cuando apago cada anuncio?" (c8) | **lectura-tanda / meta-campanas** | ✗ COLISIÓN — ver H2 |
| 5 | "Ajustas el presupuesto y prendes las campañas? Tienda R2" (c8) | meta-operador | ✓ ruteo, pero sin candado de cuenta UNSETTLED — ver H5 |
| 6 | "saca los disapproved. Borralos" (c8) | meta-operador | ✓ ruteo, candado interno contradictorio — ver H4 |
| 7 | "busques esos pedidos, contrastes el estado actual contra urbano y fixy…" (c8) | guias-couriers | ✓ |
| 8 | "Generar de nuevo esos pedidos para fixy y urbano y pasarme las etiquetas" (c8) | despacho-pedidos | ✓ |
| 9 | "mira bajo el filtro de 'Preparado' que pedidos fueron efectivamente preparados" (c8) | **despacho-pedidos / guias-couriers** | ✗ COLISIÓN — ver H7 |
| 10 | "te paso captura y reportes de la factura de MP de este mes" (c2) | conciliador-liquidaciones | ✓ |
| 11 | "Vale la pena subir el presupuesto de las campañas de goteros en ML?" (c7) | analista-ml | ✓ |
| 12 | "Chequea si el bot de AppGastos se rompio" (c8) | salud-syncs | ✓ |
| 13 | "dame un prompt exacto y sigamos en otra conversacion" (c4) | cierre-sesion | ✓ |
| 14 | "Mergea, actualiza el vault y el supabase de contexto… y cerramos" (c1) | cierre-sesion | ✓ ruteo, pero el "Mergea" se cae — ver H14 |

11/14 inequívocas. Las 3 colisiones son todas del racimo Meta y del racimo couriers — abajo.

---

## Hallazgos

### H1 — lectura-tanda · ruteo pisado por trigger genérico · **ALTA**
La description reclama textual "Como estuvo hoy? hace un analisis preliminar". Sin el contexto de una tanda lanzada, esa frase es la pregunta más genérica del repertorio de Pancho y matchea igual de bien brief-paneles ("¿cómo estuvo ayer?") y profit-dia ("cómo viene el profit de hoy"). El router elige por description, no por historia.
**FIX:** sacar la frase pelada del frontmatter. Dejar solo disparadores con ancla de tanda: "cómo arrancó la campaña de X", "mira este segundo día", "cuándo apago cada anuncio de la tanda". Y agregar la negativa: "si no hubo lanzamiento en los últimos 7 días (Runbook sin 'Caso ejecutado' fresco), NO es este agente — es brief-paneles o profit-dia".

### H2 — meta-campanas (existente) · quedó desactualizado y pisa a los nuevos · **ALTA**
meta-campanas.md dice "Usar cuando se pida revisar la pauta, **qué apagar**, qué escalar, por qué subió el CPA" — eso absorbe las lecturas día 0-2 de lectura-tanda ("Cuando apago cada anuncio?") y no menciona a lectura-tanda ni a meta-operador (no existían). La síntesis (§ Nota de arquitectura) pide vocabulario compartido en el ciclo campanas→operador→lectura-tanda, pero el plan solo edita el lado nuevo. Además su "Prohibido" dice "lo decís y lo hace **Pancho** por scripts/lanzar.mjs" — con meta-operador vivo eso queda falso y rompe el ciclo (derivaría a mano lo que ahora ejecuta un agente).
**FIX:** en la misma tanda que crea los agentes nuevos, editar meta-campanas.md: (a) deslinde "tanda recién lanzada / triage de rechazo → lectura-tanda; ejecutar lo aprobado → meta-operador"; (b) reemplazar "lo hace Pancho" por "lo ejecuta meta-operador con OK".

### H3 — despacho-pedidos + tanda-creativos · "esperar el OK" dentro de una corrida de subagente · **ALTA**
Un subagente no puede frenar a mitad de corrida a esperar un mensaje de Pancho: ejecuta y devuelve. despacho-pedidos paso 3 ("Presentar el lote **y esperar el OK**") y tanda-creativos pasos 3/5 (Pancho corta el mensaje; consultar antes de gastar; guion palabra por palabra) describen 2-3 esperas dentro de un flujo lineal. Tal como está escrito, el agente o se salta la espera (ejecuta sin OK = el peor bug posible) o termina la corrida a mitad de flujo sin protocolo de reanudación.
**FIX:** escribir el protocolo de fases en ambas specs: **corrida A** = pre-vuelo/propuesta, termina devolviendo el lote/costos y el texto exacto que Pancho tiene que aprobar; **corrida B** = re-invocación con el OK y la lista COPIADOS en el prompt de invocación — "el OK vale únicamente si viene en el prompt de esta corrida; si no viene, esta corrida es dry-run". meta-operador ya lo tiene bien resuelto de facto (la lista aprobada ES la entrada); copiar ese patrón.

### H4 — meta-operador · "borrar disapproved" contradice su propio candado · **ALTA**
El trigger textual es "saca los disapproved. Borralos" — sin IDs. El candado dice "solo entidades que Pancho **nombró**" y el paso 7 "confirmar la lista exacta de IDs antes de ejecutar" sin decir ante quién ni cómo. En la práctica el agente va a barrer DISAPPROVED y borrar lo que encontró, que es exactamente improvisar sobre un DELETE irreversible — y la memoria keepalive-cbos-r3 documenta que los DISAPPROVED de R2 incluyen ads viejos de otros negocios (aspiradora/tv box): un barrido ciego borra historia ajena a la orden.
**FIX:** definir "sacar los disapproved" como acción de 2 corridas (patrón H3): corrida A barre `effective_status=DISAPPROVED` de la cuenta nombrada y devuelve la lista de IDs+nombres+fecha; corrida B borra solo esa lista re-aprobada. Y acotar el barrido por defecto a campañas activas / first_seen reciente.

### H5 — meta-operador · sin candado de estado de cuenta al prender · **MEDIA**
"Ajustas el presupuesto y prendes las campañas? Tienda R2" es frase real y R2 está `UNSETTLED`. La memoria pauta-meta-impuesto-364 tiene un orden explícito: "pausar las 10 campañas ACTIVE de R2 **ANTES** de saldar (si no, arrancan solas al pagar)". La spec no mira `account_status` nunca: prendería campañas en una cuenta con saldo impago, o dejaría armado el arranque masivo del día que Pancho pague.
**FIX:** candado nuevo: antes de prender/subir presupuesto, leer `account_status`; si la cuenta no está ACTIVE, frenar esa acción y reportar el estado + la regla de la memoria. (Pagar saldos ya está deslindado a Pancho; esto es el complemento que falta.)

### H6 — despacho-pedidos · spec gorda + herramientas que contradicen su deslinde · **MEDIA**
Cinco tareas pegadas: alta de guías, etiquetas, picking, diagnóstico de apps, y proponer fixes de código. El deslinde dice "fixes de UI del panel → sesión de desarrollo, no este agente", pero tools le da `Edit` sobre "fixes puntuales en scripts" — y ProyectoEco deploya autónomo (memoria avisar-antes-de-deploy): un agente operativo con permiso de edición sobre el repo es una puerta a que el "fix puntual" termine en producción sin sesión de código.
**FIX:** sacar Edit/Write sobre el repo de tools (dejar Write solo para PDFs/CSVs de salida). El paso 9 queda como "reportar el edge case con propuesta de assert" — texto, no edición. Si se quiere adelgazar más: el diagnóstico de apps (/picking da número raro) es una sesión de debugging, no una rama de este agente.

### H7 — guias-couriers ↔ despacho-pedidos · el contraste de estados vive en las dos descriptions · **MEDIA**
"mira bajo el filtro de 'Preparado' qué pedidos fueron efectivamente preparados" está en la description de despacho-pedidos, pero es contraste de estado puro contra la API (el patrón de `_chequeo-preparado.mjs`), que es la definición de guias-couriers. Las dos specs citan frases de las mismas sesiones (33d46a0f/4d002424) porque en la realidad es UNA sesión encadenada: contrastar → decidir → redespachar. El router va a elegir a moneda.
**FIX:** regla de corte nítida en ambas descriptions: **todo contraste/lectura de estados es guias-couriers**; despacho-pedidos solo verifica lotes **que él mismo dio de alta** (su assert punta a punta). Mover la frase de "Preparado" a guias-couriers. Y documentar el encadenamiento: guias-couriers termina diciendo "lista lista para despacho-pedidos", el hilo invoca al segundo con esa lista + OK.

### H8 — analista-ml, lectura-tanda, meta-operador · salidas que inflan el hilo · **MEDIA**
Doctrina de la casa (CLAUDE.md): el informe del subagente queda en el hilo para siempre; informe al archivo, resumen corto. analista-ml se autoriza "~30 líneas" + cierre de supuestos con los 4 frenos, fechas y breakevens (fácil 40 líneas reales). lectura-tanda devuelve tabla por pieza + 7 bloques — y además YA escribe todo al Runbook, o sea la tabla al hilo es duplicada. meta-operador exige "VERIFICACIÓN §4: checklist item por item" (~10 campos × N adsets).
**FIX:** analista-ml: tope 15 líneas, supuestos en UNA línea (solo fechas), el detalle al scratchpad. lectura-tanda: al hilo solo veredicto por pieza + propuestas + supuestos en 1 línea; la tabla vive en el Runbook (que ya escribe) y devuelve la referencia. meta-operador: checklist §4 se reporta como "✓ completa" o solo los ✗ — nunca ítem por ítem cuando todo pasó.

### H9 — conciliador-liquidaciones · el paso Fixy/MP no tiene método · **MEDIA**
Paso 7: "parsear el archivo y cruzar montos… **No hay script canónico para este cruce (ver dudas)**". Es una segunda tarea pegada sin receta: cada corrida va a improvisar el parseo de facturas MP (que en los chats tomó sesiones enteras con 10 xlsx). Una spec que admite no tener el cómo es un agente que va a alucinar el cómo.
**FIX:** recortar la v1 a Urbano (donde los dos scripts + candados están maduros). Fixy/MP en v1 = "detectar el archivo, clasificarlo y avisar que ese cruce es sesión aparte". Se agrega cuando exista el script canónico.

### H10 — contexto-apertura · se traga los handoffs con tarea adentro · **MEDIA**
La description reclama "cuando pega un prompt de handoff de una sesión anterior". Los handoffs de Pancho traen la TAREA ("replicá en BeeVenom el proceso…, leé primero el Runbook") — si el router manda el mensaje entero a contexto-apertura, devuelve un brief de 15 líneas y la tarea no arranca (y a Pancho la demora ya lo irrita: "No deberias de morar tanto").
**FIX:** en la description: "el handoff pegado lo procesa el hilo principal, que puede invocar este agente como paso previo; este agente nunca es el destino del mensaje que trae la tarea". Disparador válido: solo pedidos cuyo contenido ES contextualizarse.

### H11 — tanda-creativos · precios de créditos sin fuente citada · **BAJA**
"nano-banana ~US$0,30/img · Kling ~US$1,12/10s · HeyGen ~1,4 créditos/s" van sin cita. Los números SÍ existen en memorias (creativos-fal-directo, heygen-subtitula-audio-url — verificado) pero al no citarlos quedan como constantes: cuando fal cambie el pricing, el agente presupuesta mal con autoridad.
**FIX:** citar memoria+fecha (27-31/07/2026) y agregar la regla que ya usan otros specs: "precio con fecha; si el gasto real difiere >20% del estimado, frenar y avisar".

### H12 — salud-syncs · lista de jobs pg_cron "esperados" sin fuente · **BAJA**
"Jobs esperados: sync-urbano-15m, sync-fixy-15m, sync-meta-1h, sync-shopify-backfill-6h, stock-espejo-1h" — sin cita de migración ni memoria (las cadencias de salud_sistema sí citan migr 068; los NOMBRES de los jobs no). Si un nombre está mal, el agente diagnostica "job faltante" falso.
**FIX:** no hardcodear la lista: leer `cron.job` en vivo y comparar contra la migración que los creó (citarla); si el nombre no matchea, decir "no catalogado", no "faltante".

### H13 — conciliador-liquidaciones · re-corrida pisa el snapshot del reclamo · **BAJA**
"correr dos veces el mismo día sobreescribe el snapshot" y la mitigación es acordarse de usar `--dry`. El snapshot ES la memoria entre reclamos (lo que decide ESCALAR); pisarlo destruye la evidencia de qué no se movió.
**FIX:** el agente respalda `datos/reclamos/<fecha>.json` → `<fecha>.prev.json` antes de toda corrida sin `--dry` (una línea de `cp`). Mejor aún: proponer el guard en el propio urbano-reclamo.mjs (doctrina reglas-en-código).

### H14 — cierre-sesion · el "Mergea" del trigger se cae en silencio · **BAJA**
El trigger textual "Mergea, actualiza el vault y el supabase… y cerramos sesion" incluye una acción (merge/commit) que el agente explícitamente NO hace (deslinde: hilo principal). Si el hilo rutea el mensaje entero, el merge no lo ejecuta nadie y el cierre reporta éxito igual.
**FIX:** nota en la description: "si el pedido incluye mergear/commitear/deployar, el hilo ejecuta ESO primero (memoria commit-y-deploy-juntos) y recién después invoca este agente"; y el reporte de salida agrega la línea "No ejecuté: merge/deploy (lo hace el hilo)" cuando la frase lo traía.

---

## Lo que está bien y no hay que tocar
- Los candados de escritura de meta-operador (lista aprobada como ENTRADA, PAUSED, relectura §4, R1 vedada) son el patrón correcto — es el único writer cuyo OK está bien operativizado de nacimiento.
- cierre-sesion es fiel a rutina-contexto-bot hasta en las 3 correcciones históricas de la receta (key, marcador, línea 1) y valida supuestos antes de escribir.
- guias-couriers y conciliador declaran qué umbral es medido y cuál es dicho-no-medido (doctrina preferencia-conservador) — copiar ese estilo en los demás.
- Ningún número citado con fuente resultó falso contra las memorias (chequeados: IDs de cuenta, system user, BLABS, 5,547%, 44,7%, ×1,21, ×1,364, 39,3%, PI≥2d, precios fal/HeyGen).

---

## Pendiente al generar

**H2 — meta-campanas.md (el agente existente) NO se editó en esta pasada.** Se edita recién en la tanda de generación de los agentes nuevos, junto con su creación, para que el ciclo quede consistente de una vez:
1. **Deslinde hacia los nuevos:** agregar a su description "tanda recién lanzada / triage de rechazo → lectura-tanda; ejecutar lo aprobado → meta-operador" (hoy su "qué apagar, qué escalar" absorbe las lecturas día 0-2 de lectura-tanda).
2. **Reemplazar "lo hace Pancho":** su sección Prohibido dice "lo decís y lo hace Pancho por scripts/lanzar.mjs" — con meta-operador vivo eso queda falso; pasa a "lo ejecuta meta-operador con OK".
