# Datos vivos canal prepago/cuotas vs COD — medido 19/09/2026

Fuente principal: Supabase Finanzas (ProyectoEco), SQL por `scripts/_q.mjs`. Ventanas por fecha de pedido en hora AR: **60d = 21/07–18/09**, **30d = 19/08–18/09**. Complemento: Shopify Admin API 2024-10 (GET orders paid, read-only). Queries en `q1.sql`…`q5.sql` y `shopify-cuotas.mjs` en esta misma carpeta.

Convenciones: MEDIDO = query con fecha. SUPUESTO = setting o inferencia, marcado como tal.

---

## 1. Pedidos por método de pago (tag Shopify) — MEDIDO (`orders`, no cancelados)

| Ventana | Tag | Pedidos | Share | Ticket prom | Ticket mediana | Pagados (financial_status=paid) |
|---|---|---|---|---|---|---|
| 60d 21/07–18/09 | cod_qr_mp | 4.820 | 63,4% | $51.636 | $49.990 | — (COD) |
| 60d | cuotas_3 | 1.870 | 24,6% | $51.846 | $49.990 | 574 (30,7%) |
| 60d | cod_efectivo | 907 | 11,9% | $51.576 | $49.990 | — (COD) |
| 30d 19/08–18/09 | cod_qr_mp | 3.223 | 62,8% | $51.746 | $49.990 | — |
| 30d | cuotas_3 | 1.275 | 24,9% | $51.960 | $49.990 | 364 (28,5%) |
| 30d | cod_efectivo | 632 | 12,3% | $51.721 | $49.990 | — |

- Ticket idéntico entre métodos (mediana $49.990 en los tres): elegir cuotas NO sube el ticket.
- Cancelados excluidos (60d): cod_qr_mp 403 · cuotas_3 115 · cod_efectivo 37.
- Sin tag: 0 pedidos en el rango (100% del form Veltron etiquetado).
- Cuotas_3 por courier asignado en `orders.courier` (30d): urbano 1.133 / fixy 142 — es la clasificación por provincia/CP, no el courier real (ver §3).

## 2. cuotas_3: pagados vs no, tiempo a pago — MEDIDO (`orders` × `mp_payments`)

`mp_payments` (migr 048, cuenta MP Khalil, external_reference ORDER-<n>): 791 pagos / 788 pedidos, `approved_at` desde 07/07, última sync 19/09 20:45Z. **Cobertura 100%**: los 574 pagados del 60d matchean con un pago MP (0 pagados sin pago, 1 pago sin `paid`). Shopify Admin confirma: 574 orders `paid` en el rango = 574 cuotas_3.

| Ventana | n | Pagados | % conf. | Pending | Mediana pedido→pago | p75 | <15 min (popup) | ≥15 min (link WA / recordatorio) | ≥24 h |
|---|---|---|---|---|---|---|---|---|---|
| 60d 21/07–18/09 | 1.870 | 574 | **30,7%** | 1.295 | **1,8 min** | 4,7 min | 500 (87,1%) | 75 (13,1%) | 13 |
| 30d 19/08–18/09 | 1.275 | 364 | **28,5%** | 911 | 1,9 min | 4,8 min | 312 (85,7%) | 52 (14,3%) | 7 |
| 60d maduros (≥10d, pedidos ≤09/09) | 1.463 | 476 | **32,5%** | 986 | 1,7 min | 4,4 min | 417 | 60 | 13 |

Distribución del tiempo a pago (60d, 575 pagos): <5 min 442 · 5–15 min 58 · 15–60 min 29 · 1–6 h 17 · 6–24 h 16 · 1–3 d 8 · >3 d 5.

Confirmación semanal (fecha de pedido): 20/07 45,6% · 27/07 33,1% · 03/08 25,4% · 10/08 43,0% · 17/08 27,5% · 24/08 29,5% · 31/08 31,6% · 07/09 26,8% · 14/09 24,3% (inmadura). **El 40,7% del 13/07 ya no vale: hoy ronda 28–32%.**

Lectura: el que paga, paga en el popup (87% en <15 min; mediana 1,8 min). El rescate por WhatsApp/recordatorio aporta ~13% de los pagos = ~4 pp de confirmación. El 70% restante nunca paga.

Campo que falta: `orders.raw` solo guarda `{id}` — no hay `processed_at`/transactions de Shopify en base. El tiempo a pago sale de `mp_payments.approved_at` (suficiente). NO hay en base: cuántos abrieron el popup y abandonaron (eso vive en Veltron/MP preferencias, no acá).

## 3. Tasa de entrega prepago vs COD — MEDIDO para COD, NO MEDIBLE para prepago

Canon: tasa sobre RESUELTOS (`resuelto` = estado en entregado/rehusado/en_devolucion/devuelto/siniestro/no_despachado, migr 067), cohorte madura ≥90% resueltos (canon 13/08/2026). Cohortes: despachos **21/07–28/08** (≥21 días al 18/09). Corte courier × tag de pago:

| Courier | Tag | Despachadas | Resueltas (madurez) | Entregadas | **Tasa s/resueltos** | Tasa bruta |
|---|---|---|---|---|---|---|
| Urbano | cod_qr_mp | 2.419 | 2.372 (98,1%) | 1.308 | **55,1%** | 54,1% |
| Fixy | cod_efectivo | 431 | 429 (99,5%) | 304 | **70,9%** | 70,5% |
| Fixy | cod_qr_mp | 122 | 122 (100%) | 88 | **72,1%** | 72,1% |
| "Urbano"/"Fixy" | prepago cuotas_3 | 115 + 18 | **0 (0%)** | 0 | **no medible** | — |

Por producto (mismo corte, n≥15): Urbano cod_qr_mp Pureza 54,4% (1.812 res) · BeeVenom 57,1% · Natures 58,4% · Veinguard 58,9%. Fixy cod_efectivo Pureza 70,3% · BeeVenom 66,7% · Natures 83,3%. Fixy cod_qr_mp Pureza 74,1% · BeeVenom 70,0%.

Cross-check con el canon del panel (`sales_rows('2026-07-21')`, d 21/07–28/08, por courier): urbano 56,0% s/resueltos (2.216/2.269 madurez 97,7%) · fixy 71,0% (572/572) · correo 36,6% "tasa" = confirmación (847/956 madurez 88,6%). Coinciden ±1 pp con el corte por tag (la diferencia es que `sales_rows` va por cohorte de despacho de `daily_pnl`).

**Por qué prepago no es medible en la base (hallazgo, 19/09/2026):**
- Los pedidos cuotas_3 pagados van por **Correo Argentino** (Shopify: 166/574 fulfillments con `tracking_company = "Correo Argentino"`, 408 fulfillment `success` sin tracking company; `shipment_status = null` en el 100% → Shopify tampoco trackea la entrega).
- Esas 168 guías de Correo entran a `shipments` con `courier = orders.courier` (urbano/fixy por provincia) porque `lib/shopify.ts:91-93` solo reconoce "urbano"/"fixy" en `tracking_company` y cae a `order.courier`. Tracking formato Correo (`000149…`, 23 chars), `status_raw = null`, `status_canonical = 'despachado'`, 0 eventos: **ningún sync las toca**. No contaminan las tasas COD (todas las RPC excluyen `cuotas_3`), pero sí son 168 "despachadas" fantasma si alguien mira `shipments` sin filtrar tag. → derivar a salud-syncs / guias-couriers.
- El canon del sistema para correo es CONFIRMACIÓN (pagados/generados), no entrega (migr 012/015: "prepago, sin proyección").
- Para tener la tasa de entrega real de prepago hace falta: tracking de Correo Argentino (MiCorreo/API) o el estado final en Veltron (`reporte_pedidos`). El archivo `etiquetas/auditoria-link-pago-2026-09-04.json` solo tiene `espera_link_pago`, no sirve.

SUPUESTO para el tablero: prepago pagado ≈ entregado alto (Correo a domicilio con pago hecho; el rechazo es casi nulo, la pérdida es devolución/no encontrado). No hay número; si se necesita, medir con Correo.

## 4. Comisión MP real sobre cuotas_3 — MEDIDO (`mp_payments`, por fecha de aprobación AR)

| Ventana | Cuotas | Pagos | Bruto | Fee (mp + financiación) | **% efectivo** |
|---|---|---|---|---|---|
| 30d 19/08–18/09 | **todas** | 371 | $19.514.640 | $3.339.374 | **17,11%** |
| 30d | 1 | 179 | $9.404.998 | $1.105.359 | 11,75% |
| 30d | 3 | 182 | $9.610.743 | $2.173.662 | **22,62%** |
| 30d | 6 | 7 | $348.939 | $36.518 | 10,47% |
| 30d | 2 / 9 | 2 / 1 | — | — | 20,0% / 7,6% |
| 60d 21/07–18/09 | todas | 582 | $30.520.955 | $4.923.893 | **16,13%** |
| 60d | 1 | 281 | $14.681.886 | $1.559.370 | 10,62% |
| 60d | 3 | 282 | $14.871.261 | $3.251.253 | 21,86% |

Tramos 30d: 3 cuotas tarjeta 162 pagos a **23,9%** promedio (la 3-cuotas "s/i" la absorbe el vendedor); 1 cuota 117 pagos a 12,1% + 41 a 8,7% + 21 a 16,1%; 3 cuotas Mercado Crédito ~7–12% (17 pagos).
Ojo: el 1 pago subió de ~8% (julio, migr 048) a ~12% (30d). El P&L usa el fee real por pago conciliado (migr 048) y cae a `cuotas_commission` 18% solo si no matchea (0 casos en el rango).
Mix 30d: 49% de los pagos en 3 cuotas, 48% en 1 pago → el "cuotas sin interés" lo usa la mitad de los que pagan.

## 5. Costo de envío por pedido — MEDIDO COD / SUPUESTO prepago

| Canal | Fuente | Guías 30d (desp. 19/08–18/09) | Flete prom por guía | Nota |
|---|---|---|---|---|
| COD Urbano | `shipments.freight_cost` | 3.257 | **$10.197** (mediana 10.200) | **100% estimado = fallback plano `urbano_freight_fallback` 10.200**. Última tarifa real 30/06/2026 (migr 083 lo avisa). Real may-26 $10.277 / jun-26 $10.060 por guía (tarifa × 1,29, n=1.749/2.502). Por zona (30d): CABA 5 guías, GBA/PBA 426, Interior 2.826 → el fallback pisa el corte por zona. |
| COD Fixy | `shipments.freight_tarifa` real | 756 (604 con costo) | **$8.945** (mediana 9.757) | tarifa real por CP; CABA $6.501 (73) · GBA $9.239 (681) |
| Prepago cuotas_3 (Correo Argentino) | `settings.correo_flete` | 168 guías Correo mal etiquetadas (§3), 0 con costo | **$9.000 SUPUESTO** (fijado migr 012, 14/07/2026, "flete medio Correo Argentino") | No hay tarifa real de Correo en base. Andreani: no aparece en ningún fulfillment ni tabla. |

Costo de flete **por entrega efectiva** (cohortes maduras 21/07–28/08, flete total / entregadas): Urbano **$18.712** (2.419 desp, 1.308 ent, $24,5M) · Fixy **$10.053** (553 desp, 392 ent, $3,9M). Prepago: no medible (si Correo cobra ida solamente y la entrega es ~alta, el flete por entrega ≈ $9.000–10.000 SUPUESTO).

---

## Supuestos y frescura (cierre)
- Rango: pedidos 21/07–18/09 (60d) y 19/08–18/09 (30d), fecha AR. Tasas sobre despachos 21/07–28/08 (≥21 d al 18/09); cohortes 29/08–18/09 excluidas por inmaduras.
- Canon tasa: resueltos (migr 067), madurez ≥90% (canon 13/08/2026); Urbano 98,1% y Fixy ≥99,5% resueltos → maduras. `dispatched_at` = etiqueta emitida; fantasmas solo-PI no afectan cohortes ≤28/08 (todas >21 d).
- `mp_payments`: última sync 19/09 20:45Z, cobertura 100% de pagados. Fee incluye financiación (3 cuotas s/i absorbida).
- Urbano flete: fallback plano desde ~30/08 (última tarifa real 30/06); Correo flete: setting $9.000 del 14/07 sin medir.
- Prepago entregas: NO existen en base ni en Shopify; hallazgo de guías Correo etiquetadas urbano/fixy sin sync → salud-syncs.
- Solo lectura: ninguna escritura en Supabase, Shopify ni repo.
