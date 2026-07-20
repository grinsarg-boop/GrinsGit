-- 038 — trabados_list(): el DETALLE de las guías que el contador `trabadas` de sales_days (030)
-- cuenta por día: en la calle sin desenlace y sin movimiento de estado hace 14+ días. MISMO
-- predicado que la 030 (si difieren, la página miente contra el "!"). Lista de trabajo para
-- reclamar a la logística y llevar la madurez de las cohortes a 100%. Correo/ML no aplican
-- (prepago/sin guía en calle).

create or replace function trabados_list()
returns table (
  courier text, tracking text, order_number text, customer_name text, province text,
  product text, cod_amount numeric, dispatched_at date,
  status_canonical text, status_raw text, last_move timestamptz, dias int
) language sql stable as $$
  select s.courier, s.tracking, o.order_number, o.customer_name,
         coalesce(s.province, o.province),
         p.name, o.cod_amount, s.dispatched_at,
         s.status_canonical, s.status_raw,
         coalesce(s.status_at, s.dispatched_at::timestamptz),
         (extract(epoch from now() - coalesce(s.status_at, s.dispatched_at::timestamptz)) / 86400)::int
  from orders o
  join shipments s on s.order_id = o.id
  left join products p on p.id = order_primary_product(o.id)
  where o.cancelled_at is null
    and (o.tags is null or lower(o.tags) not like '%cuotas_3%')
    and order_primary_product(o.id) is not null
    and s.status_canonical <> 'cancelado'
    and s.dispatched_at is not null
    -- mismo remap que la 030: PI de urbano / 41-pendiente de fixy con +7 días = no_despachado (no trabada)
    and (case when ((s.courier = 'urbano' and s.status_raw = 'PI')
                 or (s.courier = 'fixy' and (s.status_raw = '41'
                      or lower(coalesce(s.status_raw, '')) like '%pendiente de retiro%')))
                and current_date - s.dispatched_at > 7
           then 'no_despachado' else s.status_canonical end)
        not in ('entregado','rehusado','en_devolucion','devuelto','siniestro','no_despachado')
    and coalesce(s.status_at, s.dispatched_at::timestamptz) < now() - interval '14 days'
  order by 12 desc, 8 asc
$$;

revoke execute on function trabados_list() from anon;
grant execute on function trabados_list() to authenticated, service_role;
