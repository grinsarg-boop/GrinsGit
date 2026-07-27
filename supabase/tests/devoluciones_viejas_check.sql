-- devoluciones_viejas_check.sql (057): una devolución de +30 días cierra como devuelta; una
-- reciente NO se toca (sigue en curso y todavía puede terminar en RC).
begin;

do $t$
declare oid_vieja bigint; oid_nueva bigint; sid_vieja bigint; sid_nueva bigint; v_n int;
begin
  oid_vieja := upsert_order(jsonb_build_object('id', 88056001, 'name', '#88056001',
    'created_at', (current_date-60)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','49990',
    'shipping_address','{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items','[{"title":"Pureza x1","quantity":1,"price":"49990"}]'::jsonb));
  oid_nueva := upsert_order(jsonb_build_object('id', 88056002, 'name', '#88056002',
    'created_at', (current_date-20)::text||'T12:00:00-03:00', 'financial_status','pending',
    'tags','cod-form', 'total_price','49990',
    'shipping_address','{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items','[{"title":"Pureza x1","quantity":1,"price":"49990"}]'::jsonb));

  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','88056001','order_ref','88056001',
      'status_raw','CICLO - Despacho','occurred_at',(current_date-59)::text||'T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88056001','order_ref','88056001',
      'status_raw','RM','occurred_at',(current_date-45)::text||'T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88056002','order_ref','88056002',
      'status_raw','CICLO - Despacho','occurred_at',(current_date-19)::text||'T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88056002','order_ref','88056002',
      'status_raw','RM','occurred_at',(current_date-10)::text||'T12:00:00Z','raw','{}'::jsonb)));

  select id into sid_vieja from shipments where courier='urbano' and tracking='88056001';
  select id into sid_nueva from shipments where courier='urbano' and tracking='88056002';
  assert (select status_canonical from shipments where id=sid_vieja) = 'en_devolucion',
    '057: RM entra como en_devolucion (la regla de edad es lo único que la cierra)';

  v_n := cerrar_devoluciones_viejas(30);
  assert v_n >= 1, '057: la de 45 días tiene que cerrarse';
  assert (select status_canonical from shipments where id=sid_vieja) = 'devuelto',
    '057: en_devolucion de +30 días pasa a devuelto';
  assert (select resolved_at from shipments where id=sid_vieja) is not null,
    '057: al cerrarla queda resolved_at — si no, la cohorte sigue sin madurar';
  assert (select status_raw from shipments where id=sid_vieja) = 'RM',
    '057: status_raw NO se toca, es la evidencia de por qué se cerró';
  assert (select status_canonical from shipments where id=sid_nueva) = 'en_devolucion',
    '057: la de 10 días sigue en curso, no se toca';

  assert cerrar_devoluciones_viejas(30) = 0, '057: idempotente — la segunda corrida no mueve nada';
end $t$;

rollback;
