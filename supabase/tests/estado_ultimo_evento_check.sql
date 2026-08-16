-- estado_ultimo_evento_check.sql: dos reglas que se rompieron solas en prod.
--   a) Con eventos EMPATADOS en occurred_at gana el ÚLTIMO informado (id mayor), no el que Postgres
--      devuelva primero. Urbano colapsa el día a 12:00Z / 23:59:59 → el empate es la norma, no el borde.
--   b) El canónico se CALCULA al leer: corregir courier_status_map corrige el histórico sin backfill.
--      (Antes se congelaba en el insert: 1.392 eventos quedaron viejos entre mayo y agosto de 2026.)
--
-- Las dos viven en el `order by occurred_at desc, id desc` de upsert_shipment_events, hoy definida
-- en la 074 (la 077 terminó de sacar shipment_events.status_canonical, que era el valor congelado).
begin;

do $t$
declare sid bigint; v_disp date;
begin
  perform upsert_order(jsonb_build_object('id', 88072001, 'name', '#88072001',
    'created_at', (current_date-6)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','49990',
    'shipping_address','{"province":"Tucumán","city":"San Miguel","zip":"4000"}'::jsonb,
    'line_items','[{"title":"Pureza x1","quantity":1,"price":"49990"}]'::jsonb));

  -- Un día de sync típico: despacho, y después AR/MA/LD/EI TODOS a las 23:59:59 (un sintético por corrida).
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','CICLO - Despacho','occurred_at',(current_date-5)::text||'T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','AR','occurred_at',(current_date-2)::text||'T23:59:59Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','MA','occurred_at',(current_date-2)::text||'T23:59:59Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','LD','occurred_at',(current_date-2)::text||'T23:59:59Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','EI','occurred_at',(current_date-2)::text||'T23:59:59Z','raw','{}'::jsonb)));

  select id, dispatched_at into sid, v_disp from shipments where courier='urbano' and tracking='88072001';
  assert (select status_canonical from shipments where id = sid) = 'entregado',
    'con empate de occurred_at gana el último evento informado (EI), no AR';
  assert (select resolved_at from shipments where id = sid) is not null,
    'el estado ganador es terminal → la guía cierra y la cohorte madura';
  assert v_disp = current_date - 5,
    'dispatched_at sigue saliendo del evento CICLO (map_status resuelve el despachado)';

  -- b) El mapa cambia → el histórico se re-canoniza solo en el próximo upsert, sin tocar eventos.
  update courier_status_map set status_canonical = 'incidencia'
   where courier='urbano' and match_type='exact' and status_raw='EI';
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','88072001','order_ref','88072001',
      'status_raw','EI','occurred_at',(current_date-2)::text||'T23:59:59Z','raw','{}'::jsonb)));
  assert (select status_canonical from shipments where id = sid) = 'incidencia',
    'el canónico se calcula al leer — cambiar el mapa alcanza, sin backfill de shipment_events';
end $t$;

rollback;
