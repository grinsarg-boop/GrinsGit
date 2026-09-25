-- resolved_primer_evento_check.sql (097): resolved_at es el primer evento de la racha final.
--   a) La rendición que llega DESPUÉS (otra llamada, como en un backfill) no corre la fecha de
--      resolución; el estado y status_at sí siguen al último evento.
--   b) Un evento terminal viejo seguido de estados abiertos (el XLSX de mayo/junio) no cuenta:
--      con un min() pelado la guía resolvía a edad 0.
--   c) Devuelta: vale el primer 139, no el 184 "RENDICION RECEPCIONADA" de semanas después.
begin;

do $t$
declare ts text := 'T15:00:00-03:00';
begin
  -- a) Entregada; la rendición entra en una segunda llamada.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','95000001','order_ref','95000001',
      'status_raw','39','occurred_at',(current_date-3)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000001','order_ref','95000001',
      'status_raw','41','occurred_at',(current_date-6)::text||ts,'raw','{}'::jsonb)));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','95000001','order_ref','95000001',
      'status_raw','39','occurred_at',(current_date-1)::text||ts,
      'raw','{"detalles":"RENDICION AL CLIENTE"}'::jsonb)));
  assert (select resolved_at from shipments where courier='fixy' and tracking='95000001')
         = ((current_date-3)::text||ts)::timestamptz,
    'a) la rendición posterior no mueve resolved_at: vale la entrega física';
  assert (select status_canonical = 'entregado' and status_at = ((current_date-1)::text||ts)::timestamptz
            from shipments where courier='fixy' and tracking='95000001'),
    'a) estado y status_at siguen saliendo del último evento';

  -- b) Terminal viejo (XLSX) + historia de la API.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','95000002','order_ref','95000002',
      'status_raw','39','occurred_at',(current_date-10)::text||'T00:00:00-03:00','raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000002','order_ref','95000002',
      'status_raw','41','occurred_at',(current_date-10)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000002','order_ref','95000002',
      'status_raw','70','occurred_at',(current_date-8)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000002','order_ref','95000002',
      'status_raw','39','occurred_at',(current_date-7)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000002','order_ref','95000002',
      'status_raw','39','occurred_at',(current_date-5)::text||ts,'raw','{}'::jsonb)));
  assert (select resolved_at from shipments where courier='fixy' and tracking='95000002')
         = ((current_date-7)::text||ts)::timestamptz,
    'b) vale el primer 39 DESPUÉS del último estado abierto, no el 39 del XLSX';

  -- c) Devuelta: rehusado → sucursal → 139 → 139 → 184.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','41','occurred_at',(current_date-20)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','51','occurred_at',(current_date-18)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','129','occurred_at',(current_date-17)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','139','occurred_at',(current_date-15)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','139','occurred_at',(current_date-12)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','95000003','order_ref','95000003',
      'status_raw','184','occurred_at',(current_date-2)::text||ts,'raw','{}'::jsonb)));
  assert (select status_canonical = 'devuelto' and resolved_at = ((current_date-15)::text||ts)::timestamptz
            from shipments where courier='fixy' and tracking='95000003'),
    'c) devuelta: vale el primer 139, no el 184 de la rendición recepcionada';
end $t$;

rollback;
