# BioLabs Finanzas COD

P&L por día de despacho para venta contra reembolso (Shopify + Urbano + Fixy + Meta).
Spec completa en [SPEC.md](SPEC.md). Stack: Next.js App Router + Supabase; **todas las
fórmulas viven en SQL** (`supabase/migrations/002_rpcs.sql`).

## Setup

1. **Supabase**: crear proyecto en supabase.com y aplicar migraciones en orden desde el
   SQL Editor (o `supabase db push`):
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_rpcs.sql`

   En Auth → Providers dejar **Email** habilitado y crear los 2 usuarios a mano en
   Auth → Users (con contraseña). No hay signup ni "olvidé mi contraseña": altas y
   resets se hacen desde ese mismo dashboard.

2. **Env vars**: copiar `.env.example` a `.env.local` y completar. Las mismas variables
   van en Vercel (Project → Settings → Environment Variables).
   - `ALLOWED_EMAILS`: los 2 mails con acceso, separados por coma (R13).
   - `CRON_SECRET`: cualquier string largo random; lo usan n8n/Vercel Cron y el botón
     "correr ahora" de `/sync`.

3. **Deploy en Vercel**: `vercel deploy` (o conectar el repo). `vercel.json` ya define
   los crons; Vercel les agrega solo el header `Authorization: Bearer $CRON_SECRET`.

## Webhooks de Shopify

En Shopify Admin → Settings → Notifications → Webhooks (o por Admin API), crear estos
4 webhooks apuntando a `https://<tu-app>.vercel.app/api/webhooks/shopify` (formato JSON):

- `orders/create` · `orders/updated` · `orders/cancelled` · `fulfillments/create`

Poner el **signing secret** que muestra Shopify en `SHOPIFY_WEBHOOK_SECRET` (la ruta
rechaza firmas inválidas con 401). El backfill diario de las 03:00 reconcilia lo que
los webhooks pierdan.

La Admin API usa **client credentials grant** (`SHOPIFY_CLIENT_ID` /
`SHOPIFY_CLIENT_SECRET` de la app): el token de 24 h se pide, cachea y renueva solo —
no hay token permanente que configurar.

## Schedules (n8n o Vercel Cron)

Cada endpoint es un POST (o GET) con header `Authorization: Bearer $CRON_SECRET`:

| Endpoint | Cadencia |
|---|---|
| `/api/sync/meta` | cada 1 h |
| `/api/sync/urbano` | cada 45 min |
| `/api/sync/fixy` | cada 45 min |
| `/api/sync/shopify-backfill` | diario 03:00 |

Imports manuales (mismo Bearer, `multipart/form-data` campo `file`):

```bash
curl -X POST https://<app>/api/import/fixy-xlsx \
  -H "Authorization: Bearer $CRON_SECRET" -F file=@export-fixy.xlsx

curl -X POST https://<app>/api/import/facturacion-urbano \
  -H "Authorization: Bearer $CRON_SECRET" -F file=@facturacion.xlsx
```

Recalculo manual: `POST /api/sync/recompute` (body opcional `{"from":"2026-06-01","to":"2026-06-30"}`).

## Tests

```bash
npm test              # product-match (R2, vitest)
npm run test:db       # 001 + 002 + supabase/tests/pnl_check.sql contra un Postgres 16 embebido
```

Contra un Supabase real: `psql $DATABASE_URL -f supabase/tests/pnl_check.sql`
(rollbackea solo, no deja datos).

## Pendientes que bloquean ingesta (SPEC §10)

1. Script Python del webservice de Urbano → portar a `lib/couriers/urbano.ts`.
2. Doc/response de la API de Fixy → completar `lib/couriers/fixy.ts` (mientras: XLSX).
3. Completar `courier_status_map` contra el mapa operativo (aparecen en `/sync`).
4. Cargar `product_costs` reales (por ahora se extrapolan del pack 1, flageados).
5. Token de Meta + client id/secret y webhook secret de Shopify en el `.env`.
