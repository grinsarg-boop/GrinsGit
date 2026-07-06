-- BioLabs Finanzas COD — 001_init
-- Schema + seeds + RLS. La lógica de negocio (RPCs) va en 002_rpcs.sql según SPEC §4/§5.1.

-- ============ TABLAS ============

create table products (
  id serial primary key,
  name text unique not null,
  active boolean not null default true
);

create table product_costs (
  product_id int not null references products(id),
  pack int not null default 1,
  unit_cost numeric not null default 0,
  is_estimated boolean not null default false,
  primary key (product_id, pack)
);

create table orders (
  id bigserial primary key,
  shopify_id bigint unique not null,
  order_number text not null,
  created_at timestamptz not null,
  cancelled_at timestamptz,
  financial_status text,
  customer_name text,
  phone text,
  province text,
  city text,
  zip text,
  courier text check (courier in ('urbano','fixy')),
  total numeric not null default 0,
  cod_amount numeric not null default 0,
  deposit_amount numeric not null default 0,
  tags text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index orders_number_idx on orders (order_number);
create index orders_created_idx on orders (created_at);

create table order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id int references products(id),
  pack int not null default 1,
  qty int not null default 1,
  unit_price numeric not null default 0,
  title_raw text
);
create index order_items_order_idx on order_items (order_id);

create table courier_status_map (
  courier text not null check (courier in ('urbano','fixy')),
  status_raw text not null,
  status_canonical text not null check (status_canonical in
    ('despachado','en_transito','en_reparto','incidencia','en_sucursal',
     'rehusado','entregado','en_devolucion','devuelto','siniestro','cancelado')),
  match_type text not null default 'exact' check (match_type in ('exact','keyword')),
  primary key (courier, status_raw)
);

create table shipments (
  id bigserial primary key,
  courier text not null check (courier in ('urbano','fixy')),
  tracking text not null,
  order_id bigint references orders(id),
  order_ref text,
  province text,
  dispatched_at date,
  status_raw text,
  status_canonical text not null default 'despachado',
  status_at timestamptz,
  resolved_at timestamptz,
  freight_tarifa numeric,           -- tarifa real de facturación (urbano) o importe (fixy)
  freight_cost numeric,             -- costo final: urbano tarifa*mult, fixy importe (SPEC §4.1)
  freight_is_estimated boolean not null default false,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (courier, tracking)
);
create index shipments_dispatched_idx on shipments (dispatched_at);
create index shipments_status_idx on shipments (status_canonical);
create index shipments_order_idx on shipments (order_id);

create table shipment_events (
  id bigserial primary key,
  shipment_id bigint not null references shipments(id) on delete cascade,
  status_raw text not null,
  status_canonical text not null,
  occurred_at timestamptz not null,
  raw jsonb,
  unique (shipment_id, status_raw, occurred_at)
);

create table ad_spend (
  date date not null,
  ad_id text not null,
  ad_name text,
  campaign_name text,
  spend numeric not null default 0,
  purchases int not null default 0,
  product_id int references products(id),
  product_locked boolean not null default false,  -- true = override manual, el sync no lo pisa
  primary key (date, ad_id)
);

create table delivery_priors (
  id bigserial primary key,
  courier text not null check (courier in ('urbano','fixy')),
  province text,                    -- null = nivel courier
  product_id int references products(id),  -- null = nivel courier(+provincia)
  p_delivery numeric not null check (p_delivery >= 0 and p_delivery <= 1),
  n int not null default 0,
  level int not null,               -- 1=c+prov+prod  2=c+prov  3=courier  9=seed inicial
  computed_at timestamptz not null default now()
);
create unique index delivery_priors_uq
  on delivery_priors (courier, (coalesce(province, '*')), (coalesce(product_id, 0)));

create table settings (
  key text primary key,
  value jsonb not null
);

create table daily_pnl (
  dispatch_date date not null,
  courier text not null check (courier in ('urbano','fixy')),
  product_id int not null references products(id),
  despachadas int not null default 0,
  entregadas int not null default 0,
  rehusadas int not null default 0,
  en_devolucion int not null default 0,
  devueltas int not null default 0,
  siniestros int not null default 0,
  en_transito int not null default 0,
  pct_resuelto numeric not null default 0,
  tasa_actual numeric,
  tasa_proyectada numeric,
  revenue_confirmado numeric not null default 0,
  revenue_estimado numeric not null default 0,
  senas_netas numeric not null default 0,
  flete numeric not null default 0,
  flete_estimado_pct numeric not null default 0,  -- % del flete que todavía es estimado (SPEC §4.1)
  costo_producto numeric not null default 0,
  comisiones numeric not null default 0,
  ads numeric not null default 0,
  profit_confirmado numeric not null default 0,
  profit_estimado numeric not null default 0,
  computed_at timestamptz not null default now(),
  primary key (dispatch_date, courier, product_id)
);

create table sync_runs (
  id bigserial primary key,
  connector text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','error')),
  rows_upserted int default 0,
  warnings jsonb not null default '[]'::jsonb,
  error text
);
create index sync_runs_connector_idx on sync_runs (connector, started_at desc);

create table alerts (
  id bigserial primary key,
  rule text not null,
  cohort_key text,                  -- ej. '2026-07-04|urbano|Natures' para anti-spam
  fired_at timestamptz not null default now(),
  payload jsonb,
  sent boolean not null default false
);

create table fixy_zips (
  zip_prefix text primary key
);

-- ============ FUNCIONES ============

-- Clasificación de courier cuando el fulfillment no trae company (SPEC §5.1)
create or replace function classify_courier(p_province text, p_zip text)
returns text language sql stable as $$
  select case
    when p_province ilike '%ciudad aut%' or p_province ilike 'capital federal%'
         or upper(coalesce(p_province,'')) in ('CABA','C.A.B.A.') then 'fixy'
    when p_province ilike 'buenos aires%' and exists (
      select 1 from fixy_zips z
      where regexp_replace(coalesce(p_zip,''), '\D', '', 'g') like z.zip_prefix || '%'
    ) then 'fixy'
    else 'urbano'
  end
$$;

create or replace function log_sync_run(
  p_connector text, p_status text, p_rows int,
  p_warnings jsonb default '[]'::jsonb, p_error text default null
) returns void language sql as $$
  insert into sync_runs (connector, finished_at, status, rows_upserted, warnings, error)
  values (p_connector, now(), p_status, coalesce(p_rows, 0), coalesce(p_warnings, '[]'::jsonb), p_error);
$$;

-- Stubs: se reemplazan (create or replace) en 002_rpcs.sql según SPEC §4 y §5.1
create or replace function upsert_order(p jsonb) returns bigint language plpgsql as
$$ begin raise exception 'implementar en 002_rpcs.sql (SPEC §5.1)'; end $$;

create or replace function upsert_shipment_events(p jsonb) returns int language plpgsql as
$$ begin raise exception 'implementar en 002_rpcs.sql (SPEC §5.1)'; end $$;

create or replace function upsert_ad_spend(p jsonb) returns int language plpgsql as
$$ begin raise exception 'implementar en 002_rpcs.sql (SPEC §5.3)'; end $$;

create or replace function recompute_daily_pnl(p_from date, p_to date) returns void language plpgsql as
$$ begin raise exception 'implementar en 002_rpcs.sql (SPEC §4.7)'; end $$;

create or replace function recompute_priors() returns void language plpgsql as
$$ begin raise exception 'implementar en 002_rpcs.sql (SPEC §4.5)'; end $$;

-- ============ SEEDS ============

insert into products (name) values
  ('Natures'), ('Pureza'), ('Veinguard'), ('BeeVenom'), ('Altus');

insert into settings (key, value) values
  ('urbano_freight_mult',      '1.29'),
  ('commission_pct',           '{"urbano": 0.052, "fixy": 0.01}'),
  ('fixy_cpa_multiplier',      '1.4'),
  ('mp_fee_pct',               '0.10'),
  ('maturity_days',            '{"urbano": 10, "fixy": 7}'),
  ('prior_window_days',        '30'),
  ('prior_min_n',              '30'),
  ('freight_avg_window_days',  '60'),
  ('alert_rules',              '{"tasa_proyectada_min": 0.35, "tasa_min_despachos": 20, "roas_dia_min": 1.0, "sync_stale_hours": 2}');

-- SEED PARCIAL: códigos conocidos del mapa operativo de Urbano + keywords genéricas.
-- Los estados sin match caen en "incidencia" con warning y se completan desde /config
-- contra el mapa de 23 estados del dueño.
insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('urbano', 'MA', 'despachado',    'exact'),   -- manifiesto
  ('urbano', 'AS', 'en_transito',   'exact'),   -- despacho a sucursal
  ('urbano', 'AR', 'en_transito',   'exact'),   -- arribo a sucursal
  ('urbano', 'AM', 'incidencia',    'exact'),   -- manifiesto anulado
  ('urbano', 'NT', 'incidencia',    'exact'),   -- no tramitado
  ('urbano', 'ST', 'incidencia',    'exact'),   -- sin tramitar
  ('urbano', 'ENTREGADO',   'entregado',     'keyword'),
  ('urbano', 'SALIDA A RUTA','en_reparto',   'keyword'),
  ('urbano', 'EN REPARTO',  'en_reparto',    'keyword'),
  ('urbano', 'REHUSA',      'rehusado',      'keyword'),
  ('urbano', 'RECHAZA',     'rehusado',      'keyword'),
  ('urbano', 'AUSENTE',     'incidencia',    'keyword'),
  ('urbano', 'CERRADO',     'incidencia',    'keyword'),
  ('urbano', 'VISITA',      'incidencia',    'keyword'),
  ('urbano', 'SUCURSAL',    'en_sucursal',   'keyword'),
  ('urbano', 'GUARDA',      'en_sucursal',   'keyword'),
  ('urbano', 'RESCATE',     'en_devolucion', 'keyword'),
  ('urbano', 'DEVOLUCION',  'en_devolucion', 'keyword'),
  ('urbano', 'DEVUELTO',    'devuelto',      'keyword'),
  ('urbano', 'REMITENTE',   'devuelto',      'keyword'),
  ('urbano', 'SINIESTRO',   'siniestro',     'keyword'),
  ('urbano', 'EXTRAVIADO',  'siniestro',     'keyword'),
  ('fixy',   'Entregado',   'entregado',     'keyword'),
  ('fixy',   'En reparto',  'en_reparto',    'keyword'),
  ('fixy',   'Rehusado',    'rehusado',      'keyword'),
  ('fixy',   'Rechazado',   'rehusado',      'keyword'),
  ('fixy',   'Ausente',     'incidencia',    'keyword'),
  ('fixy',   'Reprogramado','incidencia',    'keyword'),
  ('fixy',   'Devuelto',    'devuelto',      'keyword');

-- Priors iniciales (datos reales may–jun 2026). level 9 = seed: recompute_priors() los pisa.
insert into delivery_priors (courier, province, product_id, p_delivery, n, level) values
  ('urbano', null, null, 0.41, 0, 9),
  ('fixy',   null, null, 0.63, 0, 9);
insert into delivery_priors (courier, province, product_id, p_delivery, n, level)
  select 'urbano', null, id, 0.36, 0, 9 from products where name = 'Natures';

-- Prefijos de CP con cobertura Fixy (CABA 1000–1499 + GBA). Ajustar desde /config si cambia cobertura.
insert into fixy_zips (zip_prefix) values
  ('10'), ('11'), ('12'), ('13'), ('14'), ('16'), ('17'), ('18');

-- ============ RLS ============
-- Lectura: cualquier usuario autenticado. Escritura: solo service role (bypassa RLS),
-- salvo las 4 tablas editables desde /config.

do $$
declare t text;
begin
  foreach t in array array[
    'products','product_costs','orders','order_items','courier_status_map',
    'shipments','shipment_events','ad_spend','delivery_priors','settings',
    'daily_pnl','sync_runs','alerts','fixy_zips'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for select to authenticated using (true)', t || '_read', t);
  end loop;
end $$;

create policy product_costs_write on product_costs
  for all to authenticated using (true) with check (true);
create policy settings_write on settings
  for all to authenticated using (true) with check (true);
create policy status_map_write on courier_status_map
  for all to authenticated using (true) with check (true);
create policy ad_spend_update on ad_spend
  for update to authenticated using (true) with check (true);
create policy fixy_zips_write on fixy_zips
  for all to authenticated using (true) with check (true);

-- Realtime para el dashboard (Fase 3, no molesta tenerlo desde el día 1)
alter publication supabase_realtime add table daily_pnl;
