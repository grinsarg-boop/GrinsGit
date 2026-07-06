# BioLabs Finanzas COD — SPEC v1

> **Para Claude Code:** leé este archivo completo antes de escribir una línea. Filosofía **ponytail full**: el mínimo que funciona, Postgres hace el trabajo pesado, cero abstracciones especulativas. La única abstracción permitida es el adapter de couriers (§5.4) porque hay dos implementaciones reales desde el día 1.
>
> **Cómo construir:** fase por fase (§7). No arranques la Fase 2 sin que la Fase 1 pase sus criterios de aceptación. Al cerrar cada fase, correr `/review`.

---

## 0. Contexto de negocio (leer, no codear)

- **BioLabs** vende 5 productos (Natures, Pureza, Veinguard, BeeVenom, Altus) por Shopify con **contra reembolso (COD)** en Argentina.
- Dos couriers: **Urbano** (interior/provincias, cobra con QR Mercado Pago) y **Fixy** (CABA + AMBA, efectivo).
- **Todo se despacha sin filtro previo.** La cohorte de un día de despacho tarda en resolverse: Urbano p50 4 días / p90 8; Fixy p50 3 / p90 6. Recién a los ~10 días (Urbano) / ~7 (Fixy) una cohorte está "madura".
- Referencias reales (may–jun 2026): tasa de entrega Urbano ~41% global (Natures llegó a 36% en mayo), Fixy ~63%. Motivo #1 de fallida en Urbano: rehúsa recibir (~51% de las fallidas). Flete Urbano promedio ~$10.200 con impuestos.
- Hay una estrategia de **seña** en marcha para Urbano/interior (el cliente paga una parte por link antes del despacho) y un link de **prepago con 5% off** (absorbe ~10% de fees de procesamiento).
- **Problema que resuelve la app:** hoy el P&L se arma a mano cruzando CSVs. Queremos ingesta automática por API y ver, por cada día de despacho, la tasa de entrega y el profit **estimado vs confirmado**, actualizándose solo.

## 1. Arquitectura y stack (fijo, no debatir)

- **Next.js 14+ App Router + TypeScript + Tailwind + shadcn/ui + Recharts.** Deploy en Vercel.
- **Supabase**: Postgres (fuente de verdad + toda la lógica en funciones SQL), Auth, Realtime.
- **Conectores = route handlers dentro del repo** (`/api/sync/*`, `/api/webhooks/*`). Son código testeable, no workflows externos.
- **Scheduler**: los endpoints de sync se disparan por HTTP con header `Authorization: Bearer ${CRON_SECRET}`. Los dispara n8n (ya corre en la infra) o Vercel Cron — al repo le da igual. Incluir `vercel.json` con los crons definidos igual.
- Los route handlers **no calculan nada**: hacen fetch a la fuente, normalizan al contrato JSON (§5.1) y llaman RPCs de Postgres. Toda fórmula vive en SQL (`002_rpcs.sql`).
- Credenciales solo server-side (env vars). El browser solo habla con Supabase con anon key + RLS.

**Estructura:**

```
app/(dash)/page.tsx              → Resumen (§6.1)
app/(dash)/dia/[fecha]/page.tsx  → Drill-down (§6.2)
app/(dash)/config/page.tsx       → Config (§6.3)
app/(dash)/sync/page.tsx         → Estado de conectores (§6.4)
app/api/webhooks/shopify/route.ts
app/api/sync/{meta,urbano,fixy,shopify-backfill,recompute}/route.ts
app/api/import/{facturacion-urbano,fixy-xlsx}/route.ts
lib/couriers/{urbano,fixy}.ts    → adapter (§5.4)
lib/{supabase,meta,product-match}.ts
supabase/migrations/001_init.sql → YA ESCRITA, no tocar salvo bug
supabase/migrations/002_rpcs.sql → la escribís vos según §4 y §5.1
supabase/tests/pnl_check.sql     → asserts de R10/R16
```

## 2. Modelo de datos

La fuente de verdad es `supabase/migrations/001_init.sql` (ya escrita). Resumen del grano:

| Tabla | Grano | Nota |
|---|---|---|
| `orders` + `order_items` | pedido Shopify / ítem producto·pack | `cod_amount` = a cobrar en puerta, `deposit_amount` = seña/prepago ya cobrado |
| `shipments` | guía (unique courier+tracking) | estado canónico denormalizado + flete real o estimado |
| `shipment_events` | evento de tracking | historial completo, idempotente |
| `courier_status_map` | courier + estado crudo | exact o keyword → canónico |
| `ad_spend` | (date, ad_id) | producto mapeado por keyword, override con `product_locked` |
| `delivery_priors` | courier × provincia × producto | P(entrega) rolling, con nivel de fallback |
| `daily_pnl` | (fecha_despacho, courier, producto) | la tabla que lee el dashboard |
| `settings` | key/value jsonb | todos los números mágicos viven acá |
| `sync_runs`, `alerts`, `fixy_zips`, `product_costs`, `products` | — | soporte |

Guías sin `order_id` o con producto desconocido **quedan fuera de `daily_pnl`** y se listan en una vista `v_sin_clasificar` (visible en `/sync`). No inventar atribuciones.

## 3. Estados canónicos

```
despachado → en_transito → en_reparto → entregado ✔
                          ↘ incidencia (visita fallida, ausente, dirección)
                          ↘ en_sucursal (guarda / retiro)
                          ↘ rehusado (rehúsa recibir)
incidencia|en_sucursal|rehusado → en_devolucion → devuelto ✔
cualquiera → siniestro ✔ | cancelado ✔
```

- **Terminales:** `entregado`, `devuelto`, `siniestro`, `cancelado` → setean `resolved_at`.
- **Resuelto para P&L** (ya sabemos si cobra o no): `entregado`, `rehusado`, `en_devolucion`, `devuelto`, `siniestro`. Un rehusado cuenta como resuelto aunque el paquete siga viajando de vuelta.
- Mapeo: primero match **exact** sobre `status_raw` (códigos Urbano: MA, AS, AR, AM, NT, ST…), después **keyword** (`status_raw ILIKE '%'||keyword||'%'`), y si nada matchea → `incidencia` + warning en el `sync_run`. El seed de `courier_status_map` es **parcial**: los desconocidos aparecen en `/sync` para mapearlos desde `/config` (el dueño tiene el mapa operativo completo de 23 estados de Urbano).

## 4. Fórmulas (LOCKED — validadas contra datos reales, no inventar variantes)

Todos los parámetros salen de `settings`. Valores por defecto ya seedeados.

**4.1 Flete (costo hundido: se paga por TODAS las guías, incluidas las devueltas)**
- Urbano: `freight_cost = tarifa × urbano_freight_mult (1.29)`.
- Fixy: `freight_cost = importe` tal cual (no facturan, sin gross-up).
- La tarifa de Urbano viene de la **facturación, que llega con ~2 semanas de lag**. Mientras no esté: `freight_cost = promedio de tarifa real por provincia (rolling freight_avg_window_days=60d) × 1.29` con `freight_is_estimated = true`. Cuando se importa la facturación (`/api/import/facturacion-urbano`), pisa el estimado y recalcula el P&L de esas fechas. Este fue un bug real del sistema anterior: no repetirlo.

**4.2 Comisión de cobranza** — solo sobre COD **cobrado en puerta** (entregadas):
- Urbano 5,2% × `cod_amount`. Fixy 1% × `cod_amount`. (`commission_pct` en settings). La seña no paga comisión de courier.

**4.3 Seña / prepago** — se cobra **antes** del despacho, entra sí o sí:
- `senas_netas = Σ despachadas deposit_amount × (1 − mp_fee_pct (0.10))`.
- Pedido prepago total (financial_status `paid` antes del despacho): `deposit_amount = total`, `cod_amount = 0`.

**4.4 Costo de producto** — `unit_cost` por producto·pack (`product_costs`), se pierde solo en `entregado` (se entregó) y `siniestro` (se perdió). Rehusado/devuelto recupera stock → costo 0. Pack sin fila en `product_costs` → crear fila con costo extrapolado del pack 1 × unidades y `is_estimated = true` (editable en `/config`).

**4.5 P(entrega) — priors**
- `recompute_priors()` diario: sobre cohortes **maduras** (despachadas entre hoy−45 y hoy−`maturity_days` del courier), ventana rolling `prior_window_days=30`.
- `P = entregadas / despachadas` a nivel (courier, provincia, producto). Si `n < prior_min_n (30)` → fallback a (courier, provincia) → (courier). Guardar `level` (1/2/3; los seeds iniciales tienen level 9 y se pisan en la primera corrida).

**4.6 Pauta (Meta)** — `spend(producto, día)` = Σ `ad_spend` del día con ese `product_id`. Se reparte entre couriers proporcional a **despachos del día ponderados**: `w_urbano = n_urbano`, `w_fixy = n_fixy × fixy_cpa_multiplier (1.4)`. Subir el multiplicador corre pauta de Urbano a Fixy sin cambiar el neto global. Spend de un producto **sin despachos ese día** no se fuerza a ninguna fila: va a la vista `v_ads_sin_cohorte` y se muestra como línea aparte en el total del día.

**4.7 daily_pnl** — por (fecha_despacho `d`, courier `c`, producto `p`), con `rate_c` = comisión del courier y `P_i` = prior según provincia de cada guía en tránsito:

```
flete            = Σ todas las guías freight_cost                    (hundido)
ads              = asignación §4.6
senas_netas      = §4.3
revenue_confirmado = Σ entregadas cod_amount + senas_netas
comisiones       = rate_c × Σ entregadas cod_amount
costo_producto   = Σ (entregadas + siniestros) unit_cost
profit_confirmado = revenue_confirmado − flete − comisiones − costo_producto − ads

Δ_estimado       = Σ en_tránsito P_i × (cod_i × (1 − rate_c) − unit_cost_i)
profit_estimado  = profit_confirmado + Δ_estimado
revenue_estimado = revenue_confirmado + Σ en_tránsito P_i × cod_i

tasa_actual      = entregadas / despachadas
tasa_proyectada  = (entregadas + Σ en_tránsito P_i) / despachadas
pct_resuelto     = (entregadas + rehusadas + en_devolucion + devueltas + siniestros) / despachadas
```

Propiedades que DEBEN cumplirse (van a `pnl_check.sql`):
1. Cohorte 100% resuelta ⇒ `profit_estimado == profit_confirmado` y `tasa_proyectada == tasa_actual`.
2. `profit_confirmado` de una cohorte recién despachada ≈ −(flete + ads) − 0: arranca muy negativo y sube a medida que se entrega. Es el comportamiento esperado, no un bug.
3. Recalcular dos veces el mismo rango da idéntico resultado (funciones deterministas, upsert por PK).

`recompute_daily_pnl(p_from date, p_to date)` se llama al final de cada sync con el rango de fechas de despacho tocadas (y desde `/api/sync/recompute` para recálculo manual).

## 5. Conectores

Todos: route handler protegido con `CRON_SECRET`, normalizan y llaman RPC, terminan con `log_sync_run(connector, status, rows, warnings, error)`. Errores parciales no abortan el batch: acumulan warnings.

**5.1 Contratos RPC (implementar en `002_rpcs.sql`)**

```
upsert_order(p jsonb) → bigint            -- p = order de Shopify tal cual (raw)
upsert_shipment_events(p jsonb) → int     -- p = array de CourierEvent (§5.4)
upsert_ad_spend(p jsonb) → int            -- p = array {date, ad_id, ad_name, campaign_name, spend, purchases}
recompute_daily_pnl(p_from date, p_to date) → void
recompute_priors() → void
log_sync_run(...)                          -- ya implementada en 001
```

`upsert_order` extrae: `id, name, created_at, cancelled_at, financial_status, tags, total_price, shipping_address{province, city, zip, phone, name}, line_items[{title, variant_title, quantity, price}]`. Idempotente por `shopify_id` (upsert). Reglas:
- **Producto·pack** por ítem: keyword sobre `title` (case-insensitive): `nature→Natures, pureza→Pureza, vein→Veinguard, bee→BeeVenom, altus→Altus`; pack por regex `x\s*(\d)` o `(\d)\s*(u|unid|frascos?|pack)` sobre title+variant_title, default 1. Sin match de producto → `product_id null` + queda en `v_sin_clasificar`.
- **Courier**: si ya hay shipment con company del fulfillment, manda eso; si no, `classify_courier(province, zip)` (función en 001: CABA → fixy; Buenos Aires con CP en `fixy_zips` → fixy; resto → urbano).
- **Seña**: tag `sena:<monto>` → `deposit_amount`; `financial_status='paid'` → prepago total (§4.3). Si no, `deposit_amount=0`, `cod_amount=total`.

**5.2 Shopify**
- Webhooks `orders/create`, `orders/updated`, `orders/cancelled`, `fulfillments/create` → `/api/webhooks/shopify` con verificación **HMAC** (`SHOPIFY_WEBHOOK_SECRET`). `fulfillments/create` crea el `shipment` (tracking, courier por `tracking_company`, `dispatched_at` = created_at del fulfillment).
- Backfill `/api/sync/shopify-backfill`: GET Admin API `orders.json?updated_at_min=<hoy−3d>&status=any`, paginado, mismo RPC. Cron diario 03:00 — los webhooks se pierden, esto reconcilia.

**5.3 Meta** — `/api/sync/meta`, cron cada 1 h:
- `GET /{META_API_VERSION}/{META_AD_ACCOUNT_ID}/insights?level=ad&fields=ad_id,ad_name,campaign_name,spend,actions&time_increment=1&time_range={hoy−2d..hoy}` (3 días porque el spend se reexpresa). **`level=ad` explícito siempre** — sin eso agrega a nivel campaña.
- `purchases` = Σ actions con `action_type ∈ (purchase, omni_purchase, offsite_conversion.fb_pixel_purchase)`.
- Producto por keyword (§5.1) sobre `ad_name + campaign_name`, salvo `product_locked = true`.

**5.4 Couriers — el único adapter del proyecto**

```ts
type CourierEvent = { courier: 'urbano'|'fixy'; tracking: string; order_ref?: string;
  province?: string; status_raw: string; occurred_at: string; tarifa?: number;
  importe?: number; raw?: unknown }
interface CourierClient { fetchStatuses(trackings: string[]): Promise<CourierEvent[]> }
```

- **Urbano** (`lib/couriers/urbano.ts`): consulta el webservice de tracking por guía (existe un script Python del dueño que ya lo hace — pedirlo y portar la llamada; si el WS es SOAP/XML usar `fast-xml-parser`). Env `URBANO_WS_URL/USER/PASS`.
- **Fixy** (`lib/couriers/fixy.ts`): API propia con credenciales del dueño. **Pendiente doc** (§10): dejar el cliente con la interfaz cumplida y el fetch marcado `// ponytail: completar con doc/response real de Fixy`. Mientras tanto, `/api/import/fixy-xlsx` acepta el export XLSX de Fixy (columnas: estado, motivo, fechas, importe, contrareembolso) y emite los mismos `CourierEvent` — la app funciona día 1 sin la API.
- `/api/sync/{urbano,fixy}`, cron cada 45 min: toma guías **no terminales** con `dispatched_at > hoy−60d`, batches de ≤200, llama `fetchStatuses`, RPC.
- **Matching guía↔pedido**: por `order_ref` (número de pedido en la referencia de la guía) o tracking ya presente en el fulfillment. Guía huérfana → warning, reintenta el match en cada sync.

**5.5 Facturación Urbano** — `/api/import/facturacion-urbano` (CSV/XLSX): actualiza `freight_tarifa` real por guía, `freight_is_estimated=false`, recalcula P&L del rango afectado.

## 6. Dashboard

Server components leyendo `daily_pnl` con el client server-side de Supabase. Formato AR-friendly: `$ 1.234.567`, porcentajes con 1 decimal, fechas `dd/mm`.

**6.1 `/` Resumen** — cards Hoy / 7d / 30d (despachos, tasa proyectada, profit estimado, ROAS estimado = revenue_estimado/ads) + tabla últimos 30 días de despacho, una fila por día: despachos · barra de `pct_resuelto` · `tasa_actual → tasa_proyectada` · cobrado · **profit confirmado** · **profit estimado** (atenuado si pct_resuelto < 80%) · ads · ROAS. Fila clickeable → `/dia/[fecha]`. Toggle courier (todos/urbano/fixy). Línea "ads sin cohorte" del día si existe.

**6.2 `/dia/[fecha]`** — mismo P&L abierto por producto × courier, tabla por provincia (despachos, tasa, neto — la vista que justifica la seña por provincia), y lista de guías problemáticas: `rehusado`, `incidencia` > 48 h, `en_sucursal` > 72 h, con tracking, cliente, teléfono y estado crudo.

**6.3 `/config`** — editores inline (tablas shadcn): `product_costs` (badge "estimado"), `settings` (form tipado con los defaults visibles), `courier_status_map` (+ sección "estados sin mapear" desde warnings), `ad_spend` producto override (setea `product_locked`).

**6.4 `/sync`** — últimos 50 `sync_runs` con warnings expandibles, `v_sin_clasificar`, botón "correr ahora" por conector (POST al endpoint con el secret desde una server action).

**Auth**: Supabase Auth por email, whitelist de 2 mails en env (`ALLOWED_EMAILS`), middleware protege todo. RLS ya activa en 001 (select para authenticated; escritura de config habilitada en las 4 tablas editables; el resto escribe solo el service role).

## 7. Requirements

### Fase 1 — Cimientos (P&L confirmado, ingesta viva)

- **R1** Migración 001 aplicada + seeds. AC: `select count(*) from products` = 5; RLS activa.
- **R2** `upsert_order` según §5.1, idempotente. AC: mismo payload 2× → 1 fila; pedido CABA sin fulfillment → courier `fixy`; título "Natures x2" → product Natures pack 2; test unitario de `product-match.ts` (vitest, único test JS del repo).
- **R3** `upsert_shipment_events`: crea/actualiza shipment + eventos, mapea canónico (exact → keyword → `incidencia`+warning), setea `resolved_at`, actualiza `dispatched_at` si falta. AC: estado desconocido no rompe y queda el warning.
- **R4** Matching guía↔pedido §5.4. AC: guía con `order_ref` válido queda linkeada en el mismo sync.
- **R5** Webhook Shopify con HMAC verificado (rechaza firma inválida con 401) + fulfillment crea shipment. AC: pedido de prueba visible en la base < 1 min.
- **R6** `/api/sync/meta` según §5.3. AC: spend de hoy en `ad_spend` con producto asignado; corrida repetida no duplica.
- **R7** `/api/sync/urbano` con el adapter. AC: 1.000 guías < 5 min, `sync_run` ok.
- **R8** `/api/sync/fixy` + `/api/import/fixy-xlsx` (misma salida). AC: import de un XLSX real genera eventos y estados canónicos.
- **R9** Flete §4.1 con estimado por provincia + import facturación que pisa. AC: guía sin facturar muestra flete estimado flageado; tras import queda el real y el P&L cambia.
- **R10** `recompute_daily_pnl` **solo confirmado** (sin Δ_estimado todavía) + conteos + `pct_resuelto`. AC: `supabase/tests/pnl_check.sql` con 10 guías armadas a mano cuadra al peso.
- **R11** `/sync` completa (§6.4).
- **R12** `/` con datos confirmados (columnas estimadas ocultas hasta F2), revalidate 60 s.
- **R13** Auth + middleware + whitelist.
- **R14** Deploy Vercel + Supabase cloud; `vercel.json` con crons; README con: env vars, cómo apuntar los schedules de n8n a los endpoints, cómo crear los webhooks de Shopify.

### Fase 2 — Estimación

- **R15** `recompute_priors()` §4.5. AC: determinística sobre seed; respeta fallback y `prior_min_n`.
- **R16** `daily_pnl` estimado completo §4.7. AC: propiedades 1–3 en `pnl_check.sql`.
- **R17** `/` muestra confirmado + estimado + tasa `actual → proyectada` con la barra de resolución; tooltip de una línea explicando qué es cada número.
- **R18** `/dia/[fecha]` completa (§6.2).
- **R19** `/config` completa (§6.3).
- **R20** Señas §4.3 end-to-end. AC: pedido con `sena:10000` rehusado suma $10.000×0,9 al revenue y $0 de COD.

### Fase 3 — Ops

- **R21** Supabase Realtime sobre `daily_pnl` → `/` se actualiza sin refresh (client component chiquito que hace `router.refresh()` al recibir el evento).
- **R22** Alertas WhatsApp (Twilio): reglas de `settings.alert_rules` — tasa proyectada de cohorte < 35% con ≥ 20 despachos · ROAS estimado del día < 1 · conector sin correr > 2 h. Evaluación post-sync + cron 20:00. Anti-spam: 1 alerta por regla+cohorte por día (tabla `alerts`).
- **R23** Gráficos 90 d en `/`: tasa por courier y profit estimado vs confirmado (Recharts, 2 charts, no más).
- **R24** Export CSV de `daily_pnl` y de guías por rango.
- **R25** Banner en `/` si algún conector está caído (> 2 h sin run ok).

**Definition of done global:** el dueño carga credenciales en `.env`, corre las migraciones, importa una facturación, y en `/` ve el P&L de ayer con tasa proyectada — sin abrir un solo CSV.

## 8. Qué NO construir (YAGNI explícito)

Multi-tenant, roles, i18n, tests E2E, storybook, colas/workers, cache propio, dark mode custom, MercadoLibre, módulo de stock (ya existe otra app para eso). Si algo de esto parece necesario, es un `// ponytail:` y a otra cosa.

## 9. Env vars

Ver `.env.example` en la raíz del paquete.

## 10. Pendientes del dueño (Pancho) — no bloquean la Fase 1

1. **Fixy**: doc de la API o un response de ejemplo (mientras: XLSX por `/api/import/fixy-xlsx`).
2. **Urbano**: pasar el script Python del webservice para portar la llamada (R7).
3. Validar/completar `courier_status_map` contra el mapa operativo de 23 estados (desde `/config`).
4. Cargar `product_costs` por producto·pack en `/config`.
5. Token de Meta (system user con `ads_read` sobre `act_880189106877616`) y webhook secret de Shopify.
