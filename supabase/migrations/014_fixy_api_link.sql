-- 014 — Vínculo Fixy por API (proceso nuevo desde ~08/07/2026).
-- La guía Fixy se registra en Fixy vía API ("INGRESO POR API"), NO en un tag como Urbano.
-- seguimiento.json la devuelve por remito = order_number. Falla previa: el sync solo REFRESCABA
-- guías existentes; el bootstrap era el import XLSX (cortado ~08). Sin bootstrap, las guías Fixy
-- quedaban huérfanas → invisibles. Parche: (a) mapear los códigos de estado que faltaban,
-- (b) flete estimado por CP (la API no trae flete), (c) vista de candidatos para el discovery
-- (lib/couriers/fixy-discover.ts, que corre en /api/sync/fixy). Aditivo: NO toca fórmulas de P&L.

-- a) códigos de estado de la API Fixy que caían a incidencia (vistos en guías reales, patrón §3)
insert into courier_status_map (courier, status_raw, status_canonical, match_type) values
  ('fixy', '41',  'despachado',  'exact'),   -- SOLICITUD PENDIENTE DE RETIRO (ingreso por API)
  ('fixy', '70',  'en_reparto',  'exact'),   -- Ruteado para su entrega
  ('fixy', '134', 'en_transito', 'exact'),   -- En Recorrido
  ('fixy', '51',  'rehusado',    'exact'),   -- Destinatario rechaza el envío
  ('fixy', '123', 'cancelado',   'exact'),   -- ANULADO
  ('fixy', '142', 'en_transito', 'exact')    -- Confirmación externa
on conflict (courier, status_raw)
  do update set status_canonical = excluded.status_canonical, match_type = 'exact';

-- b) flete Fixy estimado por CP: promedio de `Importe` histórico (datos/fixy_guias_may-jul.xlsx).
-- La API de seguimiento NO devuelve flete. Incluye devoluciones (Fixy cobra doble) → conservador.
-- ponytail: NO es "COSTO POR CP" (Pancho: ese no es el costo real; el flete es `Importe`).
-- Se pisa con el Importe real cuando llega el XLSX de fletes.
insert into settings (key, value) values
  ('fixy_freight_by_cp', '{"1004":5198,"1015":5198,"1026":5198,"1027":5198,"1030":5198,"1031":5198,"1032":5198,"1040":5198,"1043":5198,"1046":5198,"1048":5198,"1050":5198,"1060":5198,"1063":5198,"1068":5198,"1079":5198,"1084":5198,"1087":5198,"1088":5198,"1089":5198,"1090":5198,"1091":5198,"1093":5198,"1102":5198,"1104":5198,"1107":5198,"1111":5198,"1122":5198,"1126":5198,"1134":5198,"1148":5198,"1153":5198,"1155":5198,"1161":5198,"1163":5198,"1173":5198,"1177":5198,"1179":5198,"1183":5198,"1185":5198,"1189":5198,"1190":5198,"1197":5198,"1201":5198,"1202":5198,"1209":5198,"1213":5198,"1221":5198,"1228":5198,"1234":5198,"1243":5198,"1245":5198,"1247":5198,"1251":5198,"1253":5198,"1254":5198,"1257":5198,"1261":5198,"1265":5198,"1269":5198,"1270":5198,"1279":5198,"1284":5198,"1289":5198,"1290":5198,"1405":5198,"1406":5198,"1407":5198,"1408":5198,"1413":5198,"1414":5198,"1416":5198,"1417":5198,"1419":5198,"1424":5198,"1425":5198,"1426":5198,"1427":5198,"1428":5198,"1429":5198,"1431":5198,"1437":5198,"1439":5198,"1440":5198,"1441":5198,"1445":5198,"1453":5198,"1602":7420,"1603":7420,"1604":7420,"1605":7420,"1607":9757,"1609":9757,"1610":9757,"1611":9757,"1613":9757,"1614":9757,"1615":9757,"1617":9757,"1618":9757,"1619":9757,"1620":9757,"1621":9757,"1622":9757,"1623":9757,"1625":9757,"1627":9757,"1629":9757,"1630":9757,"1631":9757,"1633":9757,"1634":9757,"1635":9757,"1636":7420,"1638":7420,"1640":9757,"1641":9757,"1643":9757,"1644":9757,"1645":9757,"1646":9757,"1648":9757,"1650":7420,"1651":7420,"1653":7420,"1655":7420,"1657":7420,"1660":9757,"1661":9757,"1663":9757,"1665":9757,"1666":9757,"1667":9757,"1669":9757,"1672":7420,"1674":7420,"1678":7420,"1682":7420,"1683":7420,"1684":9757,"1686":9757,"1688":9757,"1702":7420,"1704":7420,"1706":9757,"1708":9757,"1712":9757,"1713":9757,"1714":9757,"1716":9757,"1718":9757,"1721":9757,"1722":9757,"1723":9757,"1724":9757,"1727":11770,"1736":9757,"1738":9757,"1741":11770,"1742":9757,"1743":9757,"1744":9757,"1745":9757,"1746":9757,"1748":11770,"1749":11770,"1751":7420,"1752":7420,"1753":9757,"1754":9757,"1755":9757,"1757":9757,"1759":9757,"1761":9757,"1763":9757,"1765":9757,"1766":7420,"1768":7420,"1769":7420,"1770":9757,"1772":7420,"1776":9757,"1778":9757,"1803":9757,"1804":9757,"1805":9757,"1806":9757,"1812":9757,"1814":11770,"1821":7420,"1822":7420,"1824":7420,"1825":7420,"1826":7420,"1827":7420,"1828":7420,"1832":7420,"1834":7420,"1835":7420,"1836":7420,"1838":9757,"1840":9757,"1841":9757,"1842":9757,"1846":9757,"1847":9757,"1849":9757,"1852":9757,"1854":9757,"1856":9757,"1862":11770,"1864":11770,"1865":11770,"1869":7420,"1870":7420,"1872":7420,"1873":7420,"1874":7420,"1875":7420,"1876":9757,"1877":9757,"1878":9757,"1879":9757,"1880":9757,"1881":9757,"1882":9757,"1884":9757,"1885":9757,"1888":9757,"1889":9757,"1890":9757,"1891":9757,"1893":9757,"1894":11770,"1895":11770,"1896":11770,"1897":11770,"1900":11770,"1901":11770,"1902":11770,"1903":11770,"1923":11770,"1925":11770,"1931":11770,"1980":11770,"2800":11770,"2804":11770,"2806":11770,"2812":11770,"6700":11770,"6706":11770}'::jsonb),
  ('fixy_freight_by_prov', '{"BUENOS AIRES":8753,"CIUDAD AUTONOMA DE BUENOS AIRES":5198,"CHACO":9757}'::jsonb),
  ('fixy_freight_default', '8663')
on conflict (key) do update set value = excluded.value;

-- c) candidatos del discovery: pedidos fixy sin guía (los consulta por API y crea la shipment)
create or replace view v_fixy_sin_guia as
select o.id, o.order_number, o.created_at, o.zip, o.province
from orders o
where o.courier = 'fixy' and o.cancelled_at is null
  and not exists (select 1 from shipments s where s.order_id = o.id);
