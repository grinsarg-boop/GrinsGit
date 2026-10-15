# Grins · setup de infra (fork de ProyectoEco)

Checklist para levantar el panel de Grins (suplemento, COD Argentina) desde cero, con cuentas
propias de la sociedad. Ordenado por dependencia: cada bloque necesita el anterior terminado.
Tienda Shopify ya existente: `br0uny-9s.myshopify.com`, app custom con client_credentials.

Lo que NO existe todavía y hay que crear a mano: cuenta/org de GitHub, proyecto de Supabase,
proyecto de Vercel. Todo lo demás (migraciones, crons, script de webhooks) ya está en el repo.

---

## 0. Antes de arrancar

- [ ] Un mail de la sociedad para las tres cuentas (GitHub, Supabase, Vercel). Mismo mail en las
      tres: después el login de Vercel con GitHub y el import del repo salen sin fricción.
- [ ] Un password manager donde pegar cada key a medida que aparece (varias se muestran UNA sola vez).
- [ ] Generar ya el `CRON_SECRET`: `openssl rand -hex 32`. Va a Vercel y a GitHub; es el mismo valor.

---

## 1. GitHub

- [ ] Crear la cuenta/org de la sociedad y un repo **privado** (ej. `grins-panel`). Sin README,
      sin .gitignore, sin licencia: el fork local ya tiene todo.
- [ ] Conectar el fork local y subir la rama `main`:

  ```bash
  cd /ruta/al/fork
  git remote add origin git@github.com:<org>/<repo>.git   # o https://github.com/<org>/<repo>.git
  git push -u origin main
  git push -u origin infra                                 # si esta rama todavía no está mergeada
  ```

- [ ] Secrets de Actions (Settings → Secrets and variables → Actions → New repository secret).
      Los piden `.github/workflows/backup-db.yml` y `.github/workflows/salud.yml`:

  | Secret | Para qué | De dónde sale |
  |---|---|---|
  | `DATABASE_URL` | `backup-db.yml`: `pg_dump` diario del schema `public` (única copia en plan Free). `salud.yml`: consulta `salud_sistema()` y la tabla `ml_postventa` por `psql`. | Supabase → Connect → **Session pooler** (puerto 5432, usuario `postgres.<ref>`). El transaction pooler (6543) no sirve para `pg_dump`. Ver bloque 2. |
  | `CRON_SECRET` | `salud.yml`: Bearer para pegarle a `/api/salud/cajas`, `/api/monitor/ad-review` y `/api/salud/cuentas` en la URL de prod. | El mismo string que va a Vercel (paso 0). |

  Son **2 secrets** en total.

- [ ] Ojo con `salud.yml` en Grins: tiene **hardcodeada** `https://biolabs-finanzas.vercel.app` en
      tres pasos, y `salud_sistema()` marca ROJO cualquier sync que "nunca corrió" (`urbano`, `fixy`,
      `meta`, `stock-espejo`, `ml`, `ad-review`). Hasta que Grins tenga couriers y pauta, el job va a
      fallar cada hora y mandar un mail cada hora. Dos opciones, elegir una:
  1. Deshabilitar el workflow (Actions → salud → ⋯ → Disable workflow) y volver a habilitarlo cuando
     haya syncs reales.
  2. Editar la URL por la del dominio de Grins y dejar que falle: ruido asegurado.
  `backup-db.yml` sí conviene dejarlo prendido desde el día 1: no depende de nada más que
  `DATABASE_URL`, y falla con error claro si el dump sale vacío (< 1 MB) o le faltan las tablas
  `orders`, `shipments`, `daily_pnl`, `ad_spend`. Una base recién migrada tiene esas tablas, pero
  el dump va a pesar mucho menos de 1 MB hasta que haya datos → el primer backup va a fallar por
  tamaño. Es esperable; no es un bug.

---

## 2. Supabase

- [ ] Crear organización + proyecto nuevo. **Región: South America (São Paulo)** — es la más cercana
      a Argentina y a los runners de Vercel en `gru1`. Plan Free alcanza para arrancar (por eso
      existe el backup diario de GitHub: Free no hace backups).
- [ ] Guardar la **contraseña de la base** que se elige al crear el proyecto. Se muestra una sola vez
      y es parte de `DATABASE_URL`.
- [ ] Habilitar la extensión **`pg_cron`** antes de correr las migraciones: Database → Extensions →
      buscar `pg_cron` → Enable. La migración `057_devoluciones_viejas.sql` agenda un job diario
      (`cerrar-devoluciones-viejas`, 05:35 UTC) **solo si la extensión existe**; si se corre sin
      pg_cron el job no queda agendado y hay que re-aplicar la 057 después. Ninguna otra migración
      usa extensiones fuera de las que Supabase trae por defecto.
- [ ] Auth → Providers: dejar **Email** habilitado, apagar "Confirm email" si molesta. No hay signup
      en la app: los usuarios se crean a mano en Auth → Users → Add user (con contraseña), y además
      tienen que figurar en `ALLOWED_EMAILS` (middleware).
- [ ] Aplicar las **migraciones en orden** desde `supabase/migrations/` (001 → 107; el prefijo numérico
      es el orden, hay huecos de numeración y es normal). No hay `supabase/config.toml` ni CLI
      linkeada; hay dos caminos y ambos registran lo aplicado en `schema_migrations`:

  **Opción A (recomendada): `scripts/db-apply.mjs`.** Lee `DATABASE_URL` de `.env.local` y aplica
  cada archivo en una transacción, salteando los ya aplicados.

  ```bash
  npm install
  npm run test:db      # corre TODAS las migraciones + tests contra un Postgres embebido; tiene que dar verde
  node scripts/db-apply.mjs supabase/migrations/*.sql
  ```

  **Opción B: SQL Editor.** Pegar cada archivo de a uno, en orden. Tedioso (54 archivos) y no deja
  registro en `schema_migrations`; solo si la opción A no conecta.

  Notas sobre migraciones puntuales:
  - `001_init.sql` inserta los **productos de BioLabs** como seed (`products` / `product_costs`).
    Para Grins hay que cargar los productos propios después (tabla `products`, y
    `product_costs` por pack) y desactivar los de BioLabs (`active = false`). No borrarlos: los
    RPCs de P&L los referencian por id.
  - `101_service_role_statement_timeout.sql` hace `alter role service_role` + `notify pgrst`. Corre
    como `postgres` sin problema en Supabase; en el Postgres embebido de test también.
  - `058_rls_schema_migrations.sql` y `db-apply.mjs` cierran `schema_migrations` con RLS. Si se usa
    la opción B, correr igual la 058.

- [ ] Copiar las keys (Project Settings → API) a su variable:

  | Dónde está en Supabase | Variable |
  |---|---|
  | Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
  | `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
  | `service_role` key (Reveal) | `SUPABASE_SERVICE_ROLE_KEY` — solo server-side |
  | Connect → Session pooler (5432) → URI, con la contraseña de la base | `DATABASE_URL` — va a `.env.local` y al secret de GitHub, **no a Vercel** (ninguna ruta de `app/` la usa) |

---

## 3. Vercel

- [ ] Crear cuenta/team con el mismo mail, login con GitHub, dar acceso a la org.
- [ ] Add New → Project → Import el repo. Framework preset: **Next.js** (lo detecta solo por
      `next.config.ts`). Root directory `.`, build command y output por defecto.
- [ ] Región de las funciones: Settings → Functions → **São Paulo (`gru1`)**, misma que Supabase.
      Si no aparece el selector, agregar `"regions": ["gru1"]` a `vercel.json`.
- [ ] Cargar las env vars del bloque 4 (Settings → Environment Variables, en Production y Preview).
      Mínimo las marcadas **sí**. Primero las vars, después el deploy: el middleware explota sin
      `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] **Crons de `vercel.json`**: hoy define 6 crons y 4 son de BioLabs (`/api/sync/urbano`, dos de
      `/api/sync/ml`, `/api/monitor/ml-postventa`). Importa por dos motivos:
  1. El plan **Hobby rechaza crons más frecuentes que diarios** y **voltea el deploy entero** (ya
     pasó en BioLabs; está documentado en `salud.yml`). `*/15 * * * *` y `45 */4 * * *` no pasan.
  2. Correr syncs de couriers que Grins no tiene llena `sync_runs` de errores.

  Para Grins, dejar `vercel.json` así hasta que haya pauta y couriers:

  ```json
  { "crons": [] }
  ```

  y cuando corresponda ir agregando `/api/sync/meta` (`0 9 * * *`) y el courier que se contrate.
  Vercel le agrega solo el header `Authorization: Bearer $CRON_SECRET` a cada cron.
  El backfill diario de Shopify (`/api/sync/shopify-backfill`) no está en `vercel.json` ni en
  BioLabs; lo disparaba n8n. Para Grins, un cron diario `{ "path": "/api/sync/shopify-backfill", "schedule": "0 6 * * *" }` reconcilia lo que los webhooks pierdan. Es diario, así que pasa en Hobby.
- [ ] Deploy. Anotar la URL (`https://<proyecto>.vercel.app`) o conectar el dominio propio en
      Settings → Domains (CNAME a `cname.vercel-dns.com`). Esa URL es `<dominio>` en el bloque 5.
- [ ] Probar login: `https://<dominio>/login` con el usuario creado en Supabase Auth.

---

## 4. Variables de entorno

Fuente: `.env.example` (todas) + las que aparecen en código y no están ahí
(`grep -rhoE "process\.env\.[A-Z_]+" app lib scripts middleware.ts | sort -u`). "Sí" = sin eso
Grins no arranca o no recibe pedidos. "No por ahora" = pertenece a un proveedor de BioLabs o a
una fase que Grins todavía no tiene; dejar vacía o no cargarla (el código tolera la ausencia salvo
donde se indica).

### Obligatorias para Grins (11)

| Variable | De dónde sale | Dónde va |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API → Project URL | Vercel + `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API → anon key | Vercel + `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role | Vercel + `.env.local` (nunca en el cliente) |
| `DATABASE_URL` | Supabase → Connect → Session pooler URI | `.env.local` + secret de GitHub (no Vercel) |
| `ALLOWED_EMAILS` | Mails con acceso al panel, separados por coma; tienen que existir en Supabase Auth | Vercel + `.env.local` |
| `CRON_SECRET` | `openssl rand -hex 32` | Vercel + secret de GitHub + `.env.local` |
| `SHOPIFY_SHOP_DOMAIN` | `br0uny-9s.myshopify.com` (sin `https://`) | Vercel + `.env.local` |
| `SHOPIFY_CLIENT_ID` | Shopify Admin → Settings → Apps → Develop apps → la app custom → API credentials | Vercel + `.env.local` |
| `SHOPIFY_CLIENT_SECRET` | ídem, "API secret key" | Vercel + `.env.local` |
| `SHOPIFY_WEBHOOK_SECRET` | **Si los webhooks se crean con `scripts/grins/registrar-webhooks.mjs` (por API), Shopify los firma con el API secret key de la app: poner el MISMO valor que `SHOPIFY_CLIENT_SECRET`.** Si se crean a mano desde Admin → Notifications → Webhooks, va el signing secret que muestra esa pantalla. | Vercel + `.env.local` |
| `PEDIDO_ORIGIN` | Origen de la landing que postea a `/api/pedido` (CORS). Ej. `https://br0uny-9s.myshopify.com` o el dominio propio de la tienda, sin barra final | Vercel + `.env.local` |

### Cuando haya pauta en Meta (no por ahora)

| Variable | De dónde sale | Nota |
|---|---|---|
| `META_API_VERSION` | `v25.0` | Default razonable |
| `META_AD_ACCOUNT_ID` | `act_<id>` de la cuenta publicitaria de Grins | El `.env.example` trae la de BioLabs: cambiar |
| `META_ACCESS_TOKEN` | System user de Business Manager con `ads_read` | Sin esto `/api/sync/meta` falla; no agendarlo hasta tenerlo |
| `META_MONITOR_ACCOUNTS` | Lista de `act_` a vigilar en `/api/monitor/ad-review` | Opcional |

### Couriers de BioLabs (no por ahora: Grins todavía no definió courier)

| Variable | Proveedor | Nota |
|---|---|---|
| `URBANO_API_URL`, `URBANO_SHIPPER`, `URBANO_PASSWORD` | Urbano contra entrega | Shipper 4362 es de BioLabs |
| `URBANO_ANT_SHIPPER`, `URBANO_ANT_PASSWORD` | Urbano anticipado (no está en `.env.example`) | `lib/couriers/urbano.ts`, scripts de despacho |
| `FIXY_API_URL`, `FIXY_SUCURSAL`, `FIXY_SERVICIO`, `FIXY_API_TOKEN` | Fixy | Sucursal 1764855883 es de BioLabs |

### MercadoLibre (no por ahora)

| Variable | Nota |
|---|---|
| `ML_CLIENT_ID`, `ML_CLIENT_SECRET`, `ML_SELLER_ID`, `ML_ACCESS_TOKEN`, `ML_REFRESH_TOKEN` | Grins no vende en ML. Seller 262382468 es de BioLabs |
| `MP_KHALIL_ACCESS_TOKEN` | Cuenta MP de links de pago de BioLabs (no está en `.env.example`). Sin la var la función es no-op |

### Otros servicios de BioLabs (no por ahora)

| Variable | Qué es | Nota |
|---|---|---|
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WA_FROM`, `ALERT_WA_TO` | Alertas WhatsApp (Fase 3) | No hay código vivo que las use hoy |
| `ANTHROPIC_API_KEY`, `CHAT_MODEL` | Asistente in-app `/api/chat` | Opcional; sin key el chat no funciona, el resto sí |
| `VELTRON_API_KEY`, `VELTRON_MCP_URL`, `VELTRON_TENANT_ID` | Control plane COD de BioLabs | Grins no usa Veltron |
| `CASHFLOW_ANON_KEY` | Otro Supabase (app de caja de BioLabs) | Sin la var la página `/caja` falla: no entrar ahí |
| `STOCK_SERVICE_KEY` | Otro Supabase (app Stock Cosmética) | Sin la var `/stock` muestra un aviso y `/api/sync/stock-espejo` responde sin hacer nada |
| `MAIL_TO`, `CHROME_BIN`, `DESPACHO_*`, `APLICAR`, `CREAR`, `PRECIO`, `HOME` | Flags de scripts locales de BioLabs (`scripts/*.mjs`) | Nunca van a Vercel |

---

## 5. Post-deploy

- [ ] **Registrar los 4 webhooks de Shopify** (`orders/create`, `orders/updated`, `orders/cancelled`,
      `fulfillments/create`) apuntando a `https://<dominio>/api/webhooks/shopify`. Con el
      `.env.local` ya cargado con las 4 `SHOPIFY_*`:

  ```bash
  node --env-file=.env.local scripts/grins/registrar-webhooks.mjs https://<dominio>
  ```

  Es idempotente: lista los existentes, crea solo los que faltan y no duplica. Correrlo dos veces
  tiene que dar "ya existía" en los 4. Si se cambia el dominio, correrlo de nuevo con el nuevo y
  borrar los viejos a mano (el script no borra).
- [ ] Verificar la firma: hacer un pedido de prueba en la tienda y mirar en Vercel → Logs que
      `/api/webhooks/shopify` devuelva 200. Un 401 `invalid hmac` es `SHOPIFY_WEBHOOK_SECRET` mal
      puesto (ver la nota de la tabla: con webhooks creados por API va el client secret).
- [ ] **Endpoint de pedidos en la landing**: el form COD de la landing postea a
      `https://<dominio>/api/pedido`. Poner esa URL en el `action`/`fetch` del form del theme, y
      confirmar que `PEDIDO_ORIGIN` en Vercel coincide exactamente con el origen desde el que se
      sirve la landing (esquema + host, sin barra). Si no coinciden, el browser corta por CORS.
- [ ] Correr una vez `POST /api/sync/shopify-backfill` con `Authorization: Bearer $CRON_SECRET`
      para traer las órdenes que ya existían antes de los webhooks.
- [ ] Cargar los productos de Grins en `products` / `product_costs` (bloque 2) y recalcular:
      `POST /api/sync/recompute` con el mismo Bearer.
- [ ] GitHub → Actions → correr `backup-db` a mano una vez (workflow_dispatch) para confirmar que
      `DATABASE_URL` conecta. Va a fallar por "dump demasiado chico" mientras la base esté vacía;
      lo que importa es que `pg_dump` haya conectado (el error sería otro).
