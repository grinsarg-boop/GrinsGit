# API de reclamos ML (post-purchase): lo que necesita un agente automático (01/10/2026)

**Método:** todo lo de abajo salió de GETs contra `api.mercadolibre.com` con `scripts/_ml.mjs` (en serie, un solo proceso; ningún POST/PUT/DELETE), más la doc oficial de developers.mercadolibre.com.ar bajada con `curl` (WebFetch da 403, curl con User-Agent de navegador da 200). Las respuestas crudas quedaron en el scratchpad de la sesión, no en el repo.

Docs usadas (es_ar):
- [Qué es un reclamo](https://developers.mercadolibre.com.ar/es_ar/que-es-un-reclamo): campos, `available_actions`, `resolution.reason`, `/affects-reputation`, `/detail`, `/reasons` (actualizada el 20/08/2026)
- [Gestionar resolución de reclamos](https://developers.mercadolibre.com.ar/es_ar/gestionar-resolucion-de-reclamos): `expected-resolutions`, `partial-refund`, `refund`, `allow-return` (08/09/2025)
- [Gestionar mensajes de un reclamo](https://developers.mercadolibre.com.ar/es_ar/gestionar-mensaje-de-un-reclamo): `send-message`, adjuntos (14/07/2024)
- [Reputación de vendedores](https://developers.mercadolibre.com.ar/es_ar/reputacion-de-vendedores)
- Versión en inglés: [global-selling manage-claims](https://global-selling.mercadolibre.com/devsite/manage-claims), con el mismo contenido.

Nuestro `user_id` de vendedor es `262382468`. El mediador es `46622406` (`type: internal`).

---

## 0. Antes de todo: cómo funciona hoy un reclamo PDD (cambia el diseño del agente)

- **Desde julio de 2026 casi todos los PDD abren directamente en `stage: dispute`.** En septiembre fueron 35 de 35 PDD. En `actions-history` el primer evento es `open_dispute` del `complainant`, sin pasar por `claim`. Los 11 abiertos al 01/10 están todos en `dispute`.
- **En `dispute` el "mediador" es un asistente virtual conversacional.** Abre con un mensaje del tipo *"Hola, soy el asistente virtual de Mercado Libre…"* que trae un diagnóstico (incluye lo que se ve en las fotos) y un **menú numerado de soluciones con fecha límite**. El vendedor elige **respondiendo por `send-message` al mediador** (con "2", "Reembolso total" o "Elegimos la opción 1…"). El bot contesta en **3 a 15 segundos**, ejecuta la acción y en general cierra el caso.
- Por eso, en `dispute` **la API "de acciones" casi no se usa**: `available_actions` del vendedor queda vacío o con solo `send_message_to_mediator`, salvo acciones puntuales como `return_review_*` o `confirm_shortage_shipment_*`.

Evidencia (reclamo `5585366048`, el roto):
```
08:49:35 respondent -> mediator  "Hola. Elegimos la opción 1: reembolso total sin devolución. Lamentamos que el frasco haya llegado roto."
08:49:39 mediator  -> respondent "Listo, ya registré **reembolso total sin devolución** para este reclamo. Ahora vamos a presentar esta propuesta al comprador."
08:49:48 actions-history: set_culpability (mediator), send_message_to_respondent
08:49:50 close_claim -> status closed, resolution.reason "coverage_decision", applied_coverage true
```

---

## 1. Cómo identificar un reclamo por producto ROTO / DAÑADO

**Campo:** `reason_id` del reclamo. **Endpoint:** `GET /post-purchase/v1/claims/reasons/{reason_id}`. `GET /post-purchase/v1/claims/reasons?parent_id=…` y `?flow=…` sin id devuelven 404, y `?deep=true` no trae los hijos.

El reclamo `5585366048` tiene `reason_id: "PDD9973"`:
```json
{"id":"PDD9973","flow":"post_purchase_delivered","name":"sup_damaged_package_broken_item",
 "detail":"El embalaje estaba dañado","parent_id":"PDD9971",
 "filter":{"group":["expiring_food","expiring_health"]},
 "settings":{"allowed_flows":["claims"],"expected_resolutions":["change_product","return_product"],"rules_engine_triage":["defective"]}}
```
Su padre es `PDD9971` = `sup_broken_item_parent`, "El producto está en mal estado, abierto o dañado".

**Reasons de "roto" que aparecen en nuestra cuenta** (barrido de 269 mediaciones cerradas):

| reason_id | name | detail | Nota |
|---|---|---|---|
| **PDD9972** | `sup_broken_item` | "Llegó bien" (embalaje sano) | Árbol de suplementos (`expiring_health`), el actual. 29 casos |
| **PDD9973** | `sup_damaged_package_broken_item` | "El embalaje estaba dañado" | Árbol de suplementos, el actual. 15 casos |
| PDD9946 | `broken_item` | "Llegó bien" | Árbol genérico (padre PDD9945), viejo (2025-10 a 2026-01, con algún caso suelto después) |
| PDD9947 | `damaged_package_broken_item` | "El embalaje estaba dañado" | Árbol genérico, viejo |

**Regla para el agente:** `reason_id ∈ {PDD9972, PDD9973, PDD9946, PDD9947}` significa roto. La subdivisión importa: **9973/9947 (embalaje dañado) apunta al envío** y **9972/9946 (embalaje sano) apunta a nosotros**. Ver §4.

**Nombres pedidos:**
- `PDD9952` = `missing_accessories`, "Llegó bien" (padre PDD9951, faltan partes). Es el x3 con 1 gotero.
- `PDD9943` = `fake_different`, "No es de la marca original" (padre PDD9940). `allowed_flows: ["returns"]`.
- `PDD9939` = `repentant_buyer`, "Llegó lo que compré en buenas condiciones pero no lo quiero". `allowed_flows: ["returns"]`.

Otros que aparecen: PDD9942 `different_item_other`, PDD9944 `different_than_published`, PDD9970 `sup_different_taste_or_size`, PDD9955 `missing_item`, PDD9958 `empty_box`, PDD9960 `missing_invoice`, PNR9501 `undelivered_repentant_buyer`, PNR9525 `invalid_shipment_status`, PNR9560/9567 `delivered_but_not_receive_package`. Según la doc, el tipo sale de las 3 primeras letras: PNR = no recibido, PDD = diferente o defectuoso.

---

## 2. Cómo ofrecer un reintegro PARCIAL sin devolución

### 2a. La vía documentada (stage `claim`)

1. **Gate:** `players[role=respondent].available_actions` tiene que incluir `allow_partial_refund`. La doc pide además un reclamo PDD con `expected_resolution: return_product` en `pending`.
2. **Ver las ofertas:** `GET /post-purchase/v1/claims/{id}/partial-refund/available-offers`
3. **Ofrecer:** `POST /post-purchase/v1/claims/{id}/expected-resolutions/partial-refund` con body `{"percentage": 30}`. **No se probó**, porque estaba prohibido.
   - El porcentaje tiene que ser uno de la lista. Si no, devuelve `400 "Percentage not found 35.0"`.
   - Sin la acción habilitada: `400 "Action allow_partial_refund not available for player"`.
   - Por este endpoint no se puede ofrecer el 100%. Para eso está `POST …/expected-resolutions/refund`, sin body.
   - Si no se manda porcentaje, la doc dice que toma `default_percentage` 50%.
4. **El comprador tiene que aceptar.** Si acepta, se cierra con `resolution.reason: partial_refunded`. Si rechaza, la expected queda `rejected` y el comprador puede abrir disputa (doc).

**Evidencia real.** Tenemos 3 reembolsos parciales en la historia, los 3 en `stage: claim` (enero de 2026), al 50% y con `affects_reputation: not_affected`:
```
5457255158 (PDD9946 roto) actions-history:
  open_claim (complainant) 2026-01-08 22:41
  allow_partial_refund (respondent) 2026-01-08 23:04      <- nuestro POST
  accept_partial_refund (complainant) 2026-01-09 11:41    <- el comprador aceptó
  close_claim (mediator) -> resolution {reason: partial_refunded, closed_by: respondent}
expected-resolutions:
  complainant return_product -> "rejected"
  respondent partial_refund details [percentage 50.0, seller_amount 29490.0, buyer_amount 29490.0] -> "accepted"
```
Los otros dos son `5463722657` (PDD9952) y `5460100038` (PDD9939), con el mismo patrón. En el `5463722657`, `seller_amount` (17.930,8) ≠ `buyer_amount` (18.515,5).

**Respuesta real de available-offers.** Responde 200 incluso en reclamos `dispute` y en uno cerrado:
```json
// 5582240699 (Galeone, x3 $42.290)
{"currency_id":"ARS","available_offers":[{"amount":38061,"percentage":90},{"amount":33832,"percentage":80},
 {"amount":29603,"percentage":70},{"amount":25374,"percentage":60}, ... {"percentage":10}],"recommendations":[]}
```
Las ofertas van de 10% a 90% en pasos de 10. No vino `restrictions`, y `recommendations` llegó vacío. **Ojo, la base del 100% no es `total_amount` de la orden:** en el roto da 39.986,70 contra un `total_amount` de 34.478,12, y en MARQUEZ 29.907,90 contra 33.231. Hay que usar el `amount` que devuelve el endpoint y nunca calcularlo. **Que haya ofertas no significa que se puedan ofrecer:** el gate es la acción.

### 2b. La vía real hoy (stage `dispute`, asistente virtual)

- En **ningún** reclamo de los observados (los 11 abiertos más el roto) aparece `allow_partial_refund`. Las acciones del vendedor vistas en `dispute` son: `send_message_to_mediator`, `confirm_shortage_shipment_shipped`, `confirm_shortage_shipment_not_shipped` (mandatory, vence 23/11), `refund`, `return_review_ok`, `return_review_fail`, `return_review_unified_ok` y `return_review_unified_fail`.
- El parcial **se ofrece dentro del menú del mediador**, y el vendedor lo elige por mensaje:
  - PDD9952 (`5581980065`): opción 4, *"Reembolso parcial sin devolución — Devolvés el 33% o el porcentaje que elijas"*. El 33% es 1 de 3 frascos. El menú tenía además reembolso total, devolución, envío del faltante e indicaciones.
  - PDD9972 (`5581480741`, roto con embalaje sano): opción 2, *"Reembolso parcial sin devolución — Podés reintegrar el 10% o cualquier otro porcentaje"*.
  - **PDD9973 (`5585366048`, roto con embalaje dañado): NO ofreció parcial ni envío del faltante.** Solo dio 1) reembolso total sin devolución, 2) devolución con reembolso total y 3) brindar indicaciones, con plazo hasta el 30/09 14h. Si no se elige, *"se aplicará automáticamente la opción más conveniente"*. En otro PDD9973 (`5566197923`, 25/08) ML lo resolvió solo, sin participación nuestra: *"Mercado Libre cubrió todos los costos"*.
- **Aceptación del comprador en `dispute`:** tras la elección, el bot dice *"Ahora vamos a presentar esta propuesta al comprador"*. En los reembolsos totales cerró en segundos, aplicado. **Con un parcial elegido en `dispute` no hay ningún caso**, así que no está confirmado si el comprador tiene que aceptarlo, ni si el POST de 2a funciona en `dispute` sin la acción. Según la doc, sin la acción devuelve 400.

**Para el agente:** si existe `allow_partial_refund`, usar GET available-offers y después POST partial-refund con un porcentaje de la lista. Si no existe y el reclamo está en `dispute`, leer el último mensaje del mediador, ver si el menú trae "Reembolso parcial" y responder por `send-message` al mediador con el número de opción y el porcentaje.

---

## 3. Cómo mandar un MENSAJE en un reclamo

**Endpoint (doc):** `POST /post-purchase/v1/claims/{id}/actions/send-message`
```json
{"receiver_role": "mediator", "message": "texto", "attachments": ["<filename devuelto por /attachments>"]}
```
Respuesta: `201`. El campo `attachments` se puede omitir.

| Acción en available_actions | Quién la tiene | `receiver_role` | Stage |
|---|---|---|---|
| `send_message_to_complainant` | respondent, mediator | `complainant` | `claim` |
| `send_message_to_respondent` | complainant, mediator | `respondent` | `claim` |
| `send_message_to_mediator` | complainant, respondent | `mediator` | `dispute` |

- La doc: *"Un player está habilitado para enviar un mensaje solo si cuenta con la acción de 'send_message'…"*. **Hay que chequear `available_actions` antes de mandar.** En `dispute` el chat post-venta queda `blocked_by_mediation` y la única vía es el mediador.
- **Adjuntos (doc):** primero `POST /post-purchase/v1/claims/{id}/attachments` como multipart form-data, con `file=@ruta`. Devuelve `{"user_id":…, "filename":"<uuid>_<user>.jpg"}`, y ese `filename` va en `attachments`. Formatos JPG, PNG o PDF, **hasta 5 MB**. El nombre de archivo admite **hasta 125 caracteres**, solo `a-zA-Z0-9._-`.
- **Leer adjuntos (GET):**
  - Metadata con `GET /post-purchase/v1/claims/{id}/attachments/{filename}`, verificado con 200: `{"filename":"46622406_5727e…png","original_filename":"foto1.png","size":703173,"type":"image/png"}`.
  - Binario con `GET …/attachments/{filename}/download`. Está en la doc y no se bajó.
- **Límite de caracteres del mensaje:** **no está documentado** (ni en es_ar ni en global-selling) ni se encontró en SDKs. Lo más largo que mandamos y fue aceptado son **386 caracteres** (Galeone, 01/10). El mediador manda hasta ~1.430. Queda **sin confirmar**.
- **Moderación:** cada mensaje trae `message_moderation.status` (`clean`, `rejected` o `pending`). Para deduplicar sirve el `hash` único por mensaje. **GET /messages devuelve del más nuevo al más viejo.**

**Efecto colateral del turno: corrección de lo que dice el vault.** El vault (Integracion-ML-MP §24/09 y §01/10) dice que al escribirle al mediador *"ML le pasa el turno y quita TODAS las acciones… hasta que el mediador responde"*, y que Galeone *"queda sin acciones hasta que responda el mediador"*. Hoy el mediador es un bot y **responde en segundos**:
- Galeone `5582240699`: nuestro mensaje salió a las 09:42:03 y el bot contestó a las 09:42:11. El GET de las 01/10 ~12h ya muestra de nuevo `send_message_to_mediator`, `confirm_shortage_shipment_shipped` y `confirm_shortage_shipment_not_shipped` (mandatory, `due_date 2026-11-23`).
- La quita de acciones existe, pero **dura lo que tarda el bot**. El riesgo real es otro: el bot **cierra con la primera opción que entiende**. Con "2" registró reembolso total en `5582542937`, y con "Reembolso total" lo aplicó en `5581480741`. **Cada mensaje al mediador puede ser una decisión irreversible.**
- Galeone tiene además una pregunta del bot sin responder (01/10 09:42): *"¿Cómo querés seguir…?"*.

---

## 4. Reputación: qué campo lo dice y qué pasa con los daños de envío

**Endpoint:** `GET /post-purchase/v1/claims/{id}/affects-reputation`. Todos los reclamos probados respondieron 200:
```json
{"affects_reputation":"not_affected","has_incentive":false,"due_date":null}
```
- `affects_reputation`: `affected`, `not_affected` o `not_applies` (este último, según la doc, para pagos no vinculados a pedidos del marketplace).
- `has_incentive: true` significa, según la doc, que *"si el vendedor responde satisfactoriamente dentro de las primeras 48 horas, no afectará su reputación"*. Galeone hoy tiene `has_incentive: true`.
- El reclamo en sí no trae ese campo. En el texto, el mediador lo dice explícitamente cuando nos culpa: *"Sos responsable por este reclamo. Tu reputación se verá afectada y debés asumir los costos."* (PDD9943, y PDD9972 `5578391036`). En `actions-history` el momento lo marca `set_culpability` del mediator, justo antes de `close_claim`.

**Hallazgo 1: el flag decae con la ventana.** Todos los reclamos cerrados antes de ~06/08/2026 dan `not_affected`, **incluidos los PDD9943 "imitación"**. Ejemplos: `5497862272` (13/04) y `5551965887` (30/07), mientras que los PDD9943 desde el 23/08 dan `affected`. El cambio cae entre el 05/08 (`not_affected`) y el 12/08 (`affected`), unos 50 a 57 días atrás. Es coherente con que el flag diga si el reclamo **cuenta hoy** en la ventana de 60 días, y no si contó en su momento. **Un histórico de "afectó / no afectó" solo vale para reclamos de los últimos ~50 días.** La ventana exacta no está confirmada.

**Hallazgo 2: dentro de la ventana, el embalaje decide.**

| reason (cerrados, desde el 07/08/2026) | affected | not_affected |
|---|---|---|
| PDD9972 roto, embalaje sano | **17** | 1 (`5577689746`, x4) |
| PDD9973 roto, **embalaje dañado** | 0 | **3** (`5556156413`, `5566197923`, `5585366048`) |

En toda la serie, PDD9973 + PDD9947 (embalaje dañado) dan 21 de 21 `not_affected`, casi todos con `resolution.reason: coverage_decision` y `applied_coverage: true`, cerrados por el mediador. **La variable no es `logistic_type`:** el 90% de los casos es `xd_drop_off` (ME2, Correo Argentino Estándar, como el roto `48057521936`), y PDD9972 por `self_service` (Flex) también afectó (`5582542937`, `5573093941`). El roto `5585366048` cerró con reembolso total y quedó `not_affected`. La orden pasó a `status: cancelled` con tags `not_paid`.

**Hallazgo 3: el flag de un reclamo ABIERTO es provisorio.** Los 5 x3 PDD9952 abiertos dan `not_affected`, pero los PDD9952 x3 que ML cerró con `coverage_decision` entre el 18 y el 25/09 dan **`affected`** (`5579502043`, `5580911000`, `5580921089`, `5580953157`, `5580959204` y `5583557474`). La culpabilidad se fija al cerrar.

**Política escrita de ML sobre daños de envío: SIN CONFIRMAR.**
- La doc de developers no tiene una regla de exclusión por daño de envío. Solo dice que el claims_rate cuenta *"las ventas con reclamos iniciados por el comprador sin distinguir la modalidad de envío o pago"*, que *"ciertas mediaciones son automáticamente ignoradas cuando cumplen reglas específicas"* (MLB) y que una orden sale del cálculo si todos sus reclamos llevan el tag `avoid_reputation`.
- El Centro de Ayuda (mercadolibre.com.ar/ayuda) no se abrió porque es el sitio público.
- La regla operativa sale de la evidencia: **leer `/affects-reputation` en vivo, después del cierre**, y no inferirlo de `logistic_type`.

---

## 5. Unidades de la orden vs unidades rotas

**Orden:** `GET /orders/{resource_id}`. El `resource_id` del reclamo es el `order_id` cuando `resource: "order"`.
```
5585366048 -> orden 2000018550181682: item MLA3692036796 "2 Gotero Pureza Drenaje Linfático…" quantity 1, unit_price 34478.12, shipping 48057521936
```
- **Frascos = `quantity` × pack.** El pack **no siempre está en el título**: el x3 de catálogo `MLA2055177767` se vende como *"Pureza Drops Extractos De Hierbas Gotas…"*, sin "x3", y el x2 a veces sale como *"…Sabor Menta X 30ml 2 Un"*. **Usar `parseMlPack(title, itemId)` de `lib/ml.ts`**, que primero mira `PACK_POR_ITEM` (MLA3692036796→2, MLA2055177767→3, MLA1830076567→2, MLA1908275639→4, MLA3064229842→2) y recién después el regex del título. Sin ese override, el regex del título en "X 30ml 2 Un" daría 1.
- **Del lado del reclamo:**
  - `claimed_quantity` cuenta **unidades de la orden** (packs), no frascos. En el roto es `claimed_quantity: 1` y `quantity_type: "total"`, con 1 pack de 2 frascos.
  - `quantity_type: partial` indicaría un reclamo parcial. En todos nuestros rotos la orden tiene `quantity: 1` y el reclamo es `total`.
- **Cuántos frascos llegaron rotos no viene en ningún campo estructurado.** Sale del **texto del primer mensaje del mediador**, que resume lo que declaró el comprador y lo que se ve en las fotos:
  > "El comprador informó que recibió **1 unidad** de un pack de **2 frascos sabor menta** y que… encontró **un frasco roto con el contenido derramado**… el paquete llegó mojado y manchado por dentro. Según las fotos, se ve el sobre de envío con manchas de derrame y un frasco de vidrio quebrado…"

  El agente tiene que parsear ese texto (o pasarlo por un LLM) y contrastarlo con el pack.
- **Fotos:** vienen como `attachments` del mensaje del mediador. En el roto son `foto1.png` y `foto2.png`, de ~700-800 KB, `image/png`. Se leen con `GET …/attachments/{filename}` (metadata) y `…/download` (binario).
  - `GET /post-purchase/v1/claims/{id}/evidences` devolvió `[]` en todos los casos: es para pruebas de envío del vendedor (`shipping_evidence`) y no para las fotos del comprador.
  - `GET /post-purchase/v1/claims/{id}/changes` también vino vacío.

---

## Endpoints GET verificados (todos 200 salvo lo indicado)

```
/post-purchase/v1/claims/search?status=opened&limit=50
     la doc pide filtrar además por players.user_id=262382468&players.role=respondent
     (con ese filtro: 275 mediaciones cerradas; sin filtro: 762 reclamos de todos los tipos)
/post-purchase/v1/claims/{id}
/post-purchase/v1/claims/{id}/detail                       -> {due_date, action_responsible, title, description, problem}  (estado legible)
/post-purchase/v1/claims/{id}/messages
/post-purchase/v1/claims/{id}/actions-history              -> acciones con player_role y claim_stage (ver accept_partial_refund, set_culpability)
/post-purchase/v1/claims/{id}/status-history
/post-purchase/v1/claims/{id}/expected-resolutions
/post-purchase/v1/claims/{id}/partial-refund/available-offers
/post-purchase/v1/claims/{id}/affects-reputation
/post-purchase/v1/claims/{id}/evidences                    -> []
/post-purchase/v1/claims/{id}/changes                      -> {paging, data: []}
/post-purchase/v1/claims/{id}/attachments/{filename}
/post-purchase/v1/claims/reasons/{reason_id}
/post-purchase/v2/claims/{id}/returns                      -> 404 si no hay devolución; 429 si se encadena rápido
/orders/{id}   /shipments/{id}
```
**Rate limit:** hubo 429 después de ~50 GETs seguidos sin pausa. Con 400-700 ms entre llamadas no volvió a pasar.

## POST documentados (NO ejecutados)

```
POST /post-purchase/v1/claims/{id}/actions/send-message            {"receiver_role","message","attachments"?}
POST /post-purchase/v1/claims/{id}/attachments                     multipart file
POST /post-purchase/v1/claims/{id}/expected-resolutions/partial-refund   {"percentage": N}   (requiere allow_partial_refund)
POST /post-purchase/v1/claims/{id}/expected-resolutions/refund     (reembolso total; requiere refund)
POST /post-purchase/v1/claims/{id}/expected-resolutions/allow-return
POST /post-purchase/v1/claims/{id}/actions/open-dispute
POST /post-purchase/v1/claims/{id}/actions/evidences               (shipping_evidence, PNR)
POST /post-purchase/v1/returns/{return_id}/return-review           (ya usado el 30/09, ver vault)
```

## Qué quedó sin confirmar

1. Si `POST …/expected-resolutions/partial-refund` funciona en `dispute` (ninguno de los reclamos observados tiene `allow_partial_refund`), y si el comprador tiene que aceptar un parcial elegido por chat con el mediador. No hay ningún caso histórico.
2. El límite de caracteres de `send-message`. El máximo aceptado observado es 386.
3. La política escrita de ML que excluye de la reputación los daños de envío. Solo hay evidencia empírica (PDD9973 y PDD9947: 21 de 21 `not_affected`).
4. La ventana exacta en que `affects_reputation` vuelve a `not_affected` (corte observado entre el 05 y el 12/08 → ~50-57 días).
5. Por qué la base del 100% en available-offers difiere de `total_amount`: ¿envío pagado por el comprador?, ¿descuentos co-fondeados (`pcj-co-funded`)?
6. Quién absorbió el costo del reembolso total del roto `5585366048`. Tiene `applied_coverage: true` y `coverage_decision`, pero el bot dijo *"El comprador eligió la solución que propusiste"*. No se cruzó con la liquidación de MP.
