-- 005 — Mapa completo de los 23 estados Urbano (código → canónico), del Mapa Operativo oficial.
-- El WS emite status_raw = CÓDIGO (urbano.ts extrae la sigla antes del "-"), así que se matchea
-- exact por código (prioritario sobre keyword). Reemplaza/completa los 6 codes exact de 001.
-- Rama del flujo (grp/tipo del mapa) → canónico:
--   ingreso/transito/distribucion (sano) → en_transito · salida a ruta/entrega informada → en_reparto
--   exito → entregado · incidencia/quiebre → incidencia · guarda → en_sucursal
--   rescate/devolución → en_devolucion · RC (terminal-devolución) → devuelto

insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('urbano', 'PI', 'en_transito',   'exact'),  -- Pedido de ingreso
  ('urbano', 'IF', 'en_transito',   'exact'),  -- Ingreso físico
  ('urbano', 'GE', 'en_transito',   'exact'),  -- Guía emitida
  ('urbano', 'CO', 'en_transito',   'exact'),  -- Contenerizado
  ('urbano', 'AS', 'en_transito',   'exact'),  -- Despacho a sucursal
  ('urbano', 'AR', 'en_transito',   'exact'),  -- Arribo a sucursal
  ('urbano', 'MA', 'en_transito',   'exact'),  -- Manifiesto
  ('urbano', 'LD', 'en_reparto',    'exact'),  -- Salida a ruta
  ('urbano', 'EI', 'en_reparto',    'exact'),  -- Entrega informada
  ('urbano', 'DL', 'entregado',     'exact'),  -- Entrega efectiva (delivered) ⭐
  ('urbano', 'AM', 'incidencia',    'exact'),  -- Anulación de manifiesto (quiebre)
  ('urbano', 'CA', 'incidencia',    'exact'),  -- Cliente ausente
  ('urbano', 'VN', 'incidencia',    'exact'),  -- No entregado
  ('urbano', 'BA', 'incidencia',    'exact'),  -- No se pudo entregar
  ('urbano', 'NT', 'incidencia',    'exact'),  -- No tramitado
  ('urbano', 'ST', 'incidencia',    'exact'),  -- Sin tramitar
  ('urbano', 'SP', 'en_sucursal',   'exact'),  -- Servicio pendiente (guarda)
  ('urbano', 'SR', 'en_devolucion', 'exact'),  -- Solicitud de rescate
  ('urbano', 'RP', 'en_devolucion', 'exact'),  -- Rescate pendiente
  ('urbano', 'RR', 'en_devolucion', 'exact'),  -- Rescate realizado
  ('urbano', 'DV', 'en_devolucion', 'exact'),  -- Devolución
  ('urbano', 'RM', 'en_devolucion', 'exact'),  -- Rendición a matriz (aún en central Urbano)
  ('urbano', 'RC', 'devuelto',      'exact')   -- Rendición a cliente (devuelto terminal)
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';
