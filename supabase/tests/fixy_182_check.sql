-- fixy_182_check.sql (098): Fixy 182 "RETIRA POR DEPOSITO" es la guía esperando en el depósito, no
-- una entrega. Con el 182 en 'entregado' el sync dejaba de mirarla y la devolución no entraba nunca
-- (#20246: 182 el 25/08 → 139 → 184; en la base, 'entregado' hasta el 25/09/2026).
--   a) Con el 182 como último evento la guía queda abierta: el sync la sigue refrescando.
--   b) Cuando llega la devolución cierra como 'devuelto', resuelta en el primer 139 (097).
begin;

do $t$
declare ts text := 'T15:00:00-03:00';
begin
  -- a) La historia de la 1775822 hasta el 25/08: reingreso a depósito y, esa misma tarde, el 182.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','41','occurred_at',(current_date-38)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','135','occurred_at',(current_date-31)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','182','occurred_at',(current_date-31)::text||'T18:00:00-03:00','raw','{}'::jsonb)));
  assert (select status_canonical = 'en_sucursal' and resolved_at is null
            from shipments where courier='fixy' and tracking='98000001'),
    'a) el 182 deja la guía abierta (en_sucursal, sin resolved_at): el sync la sigue mirando';

  -- b) Lo que el sync no llegó a leer: plazo de retiro vencido, rendición, devolución entregada.
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','139','occurred_at',(current_date-23)::text||ts,'raw','{}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','139','occurred_at',(current_date-21)::text||ts,
      'raw','{"detalles":"RENDICION AL CLIENTE"}'::jsonb),
    jsonb_build_object('courier','fixy','tracking','98000001','order_ref','98000001',
      'status_raw','184','occurred_at',(current_date-14)::text||ts,'raw','{}'::jsonb)));
  assert (select status_canonical = 'devuelto' and resolved_at = ((current_date-23)::text||ts)::timestamptz
            from shipments where courier='fixy' and tracking='98000001'),
    'b) la devolución cierra la guía en el primer 139, no en el 182 ni en el 184';
end $t$;

rollback;
