-- urbano_rendiciones_check.sql (084): lo rendido entra a urbano_cobranza, y la reimpresión NO.
-- El 5545 repite las guías del 5468: si `vale` dejara de filtrarse, lo cobrado se contaría doble
-- y el faltante de la semana desaparecería. Eso es plata, no cosmética.
begin;

do $t$
declare c record;
begin
  insert into urbano_rendiciones (resumen, fecha_pago, fmt, guia, monto, comprobante, transferido, archivo, vale) values
    ('9001', date '2026-06-30', 'B', '9900000000001', 100000, '75896', date '2026-06-30', 't.xls', true),
    ('9001', date '2026-06-30', 'A', '9900000000002',  50000, '75896', date '2026-06-30', 't.xls', true),
    -- misma plata, exportada de nuevo: no es un giro nuevo
    ('9002', date '2026-06-30', 'B', '9900000000001', 100000, 'REEMPLAZA RES 9001', date '2026-08-11', 't2.xls', false);

  select * into c from urbano_cobranza(date '2026-06-01') where fecha_pago = date '2026-06-30';

  assert c.rendido_guias = 2,
    '084: la reimpresión (vale=false) no se cuenta — serían 3 guías si se colara';
  assert c.rendido_bruto = 150000,
    format('084: rendido_bruto debe sumar solo lo que vale, dio %s', c.rendido_bruto);
  assert c.girado_el = date '2026-06-30',
    '084: girado_el sale del giro que vale, no del de la reimpresión (11/08)';

  -- Una ventana con plata rendida y CERO entregas nuestras igual tiene que salir en la tabla:
  -- si sale solo desde las entregas, una liquidación pagada tarde se vuelve invisible.
  assert c.cod_bruto = 0 and c.guias = 0,
    '084: la ventana existe por la rendición aunque no haya entregas nuestras';

  insert into urbano_rendiciones (resumen, fecha_pago, fmt, guia, monto, transferido, vale)
    values ('9003', date '2026-06-19', 'B', '9900000000009', 777000, date '2026-07-28', true);
  select * into c from urbano_cobranza(date '2026-06-01') where fecha_pago = date '2026-06-19';
  assert found and c.rendido_bruto = 777000,
    '084: un viernes de pago (el 5545) tiene que aparecer igual — nunca empata con un martes';

  assert import_urbano_rendiciones(jsonb_build_array(jsonb_build_object(
    'resumen','9001','fecha_pago','2026-06-30','fmt','B','guia','9900000000001',
    'monto','123','comprobante','','transferido','','archivo','t.xls','vale',true))) = 1,
    '084: el importer es idempotente por (resumen, fecha_pago, guia)';
  assert (select monto from urbano_rendiciones where resumen='9001' and guia='9900000000001') = 123,
    '084: reempujar la misma guía actualiza el monto en vez de duplicar la fila';
  assert (select comprobante from urbano_rendiciones where resumen='9001' and guia='9900000000001') is null,
    '084: comprobante vacío entra como null, no como cadena vacía';
end $t$;

rollback;

-- 085: la rendición le gana al evento. Una guía que Urbano pagó está entregada, diga lo que diga
-- el WS — y si no tiene ningún evento de entrega, la fecha cae dentro de la ventana que la pagó.
begin;
do $t$
declare sid bigint; v record;
begin
  perform upsert_order(jsonb_build_object('id', 88085001, 'name', '#88085001',
    'created_at', '2026-05-01T12:00:00-03:00', 'financial_status','pending', 'tags','cod-form',
    'total_price','49990', 'shipping_address','{"province":"Tucumán"}'::jsonb,
    'line_items','[{"title":"Pureza x1","quantity":1,"price":"49990"}]'::jsonb));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','88085001','order_ref','88085001',
      'status_raw','CICLO - Despacho','occurred_at','2026-05-05T12:00:00Z','raw','{}'::jsonb),
    jsonb_build_object('courier','urbano','tracking','88085001','order_ref','88085001',
      'status_raw','RM','occurred_at','2026-05-13T12:00:00Z','raw','{}'::jsonb)));

  select id into sid from shipments where courier='urbano' and tracking='88085001';
  assert (select status_canonical from shipments where id=sid) <> 'entregado',
    '085: sin rendición, un RM no es una entrega — el mapeo de RM se queda como está';

  perform import_urbano_rendiciones(jsonb_build_array(jsonb_build_object(
    'resumen','9010','fecha_pago','2026-05-12','fmt','B','guia','88085001',
    'monto','49990','archivo','t.xls','vale',true)));

  select status_canonical, status_at, resolved_at into v from shipments where id=sid;
  assert v.status_canonical = 'entregado',
    '085: una guía que figura en un resumen está entregada, diga lo que diga el WS';
  assert v.status_at::date between date '2026-05-05' and date '2026-05-11',
    format('085: sin evento de entrega, la fecha cae en la ventana que la pagó, dio %s', v.status_at);
  assert v.resolved_at is not null,
    '085: tiene que cerrar la guía, o la cohorte nunca madura (mismo motivo que la 055)';
end $t$;
rollback;
