-- sales_check.sql (028): sales_days = P&L por día de VENTA. Ancla la matemática COD duplicada contra
-- recompute_daily_pnl: la MISMA plata que el recompute pone en el día de DESPACHO, sales_days la pone en
-- el día de VENTA (created_at). Sin ad_spend cargado, ads=0 en ambos → los montos deben coincidir al peso.
begin;

delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 5000, false from products where name = 'Natures';

do $t$
declare
  d  date := current_date - 5;           -- día de VENTA
  dd date := current_date - 3;           -- día de DESPACHO (d+2, reciente → no dispara no_despachado)
  pid int := (select id from products where name = 'Natures');
  s_pc numeric; s_pe numeric; s_rc numeric; s_re numeric;
  s_gen int; s_desp int; s_ent int; s_res int;
  d_pc numeric; d_pe numeric; d_rc numeric; d_re numeric;
  n_dias_venta int; n_dias_despacho int;
begin
  -- prior P(entrega) urbano/Córdoba/Natures = 0.5 (seed a mano; el recompute lo usa igual que sales_days)
  delete from delivery_priors;
  insert into delivery_priors (courier, province, product_id, p_delivery, level)
    values ('urbano', 'Córdoba', pid, 0.5, 9), ('urbano', null, null, 0.5, 9);

  -- 3 ventas del día d, Córdoba (→ urbano), Natures x1:
  --   O1 entregada · O2 en tránsito (se estima) · O3 generada pero SIN despachar todavía
  perform upsert_order(jsonb_build_object('id', 2201, 'name', '#2201', 'created_at', d::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 2202, 'name', '#2202', 'created_at', d::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 2203, 'name', '#2203', 'created_at', d::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));

  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','SA','order_ref','2201','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','SA','order_ref','2201','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(dd+1)::text || 'T14:00:00Z','tarifa',10000),
    jsonb_build_object('courier','urbano','tracking','SB','order_ref','2202','status_raw','MA','occurred_at', dd::text || 'T08:00:00Z')
  ));

  perform recompute_daily_pnl(d, current_date);

  -- ===== sales_days: todo cae en el día de VENTA d =====
  select generadas, despachadas, entregadas, resueltas,
         profit_confirmado, profit_estimado, revenue_confirmado, revenue_estimado
    into s_gen, s_desp, s_ent, s_res, s_pc, s_pe, s_rc, s_re
    from sales_days(d, 'urbano') where sale_date = d;

  assert s_gen = 3,  format('028: 3 ventas generadas el día de venta (got %s)', s_gen);
  assert s_desp = 2, format('028: 2 despachadas de esa cohorte (got %s)', s_desp);
  assert s_ent = 1,  format('028: 1 entregada (got %s)', s_ent);
  assert s_res = 1,  format('028: 1 resuelta (got %s)', s_res);

  -- la cohorte de venta NO aparece en el día de despacho, y el despacho no crea cohorte de venta espuria
  select count(*) into n_dias_venta    from sales_days(d, 'urbano') where sale_date = d;
  select count(*) into n_dias_despacho from sales_days(d, 'urbano') where sale_date = dd;
  assert n_dias_venta = 1,    '028: hay fila en el día de venta';
  assert n_dias_despacho = 0, '028: NO hay fila en el día de despacho (eje = venta, no despacho)';

  -- ===== paridad al peso contra recompute_daily_pnl (misma plata, otro día) =====
  select sum(profit_confirmado), sum(profit_estimado), sum(revenue_confirmado), sum(revenue_estimado)
    into d_pc, d_pe, d_rc, d_re
    from daily_pnl where courier = 'urbano';

  assert round(s_rc, 2) = round(d_rc, 2), format('028: revenue confirmado paridad venta=%s despacho=%s', s_rc, d_rc);
  assert round(s_re, 2) = round(d_re, 2), format('028: revenue estimado paridad venta=%s despacho=%s', s_re, d_re);
  assert round(s_pc, 2) = round(d_pc, 2), format('028: profit confirmado paridad venta=%s despacho=%s', s_pc, d_pc);
  assert round(s_pe, 2) = round(d_pe, 2), format('028: profit estimado paridad venta=%s despacho=%s', s_pe, d_pe);

  -- el estimado proyecta la guía en tránsito (O2) por encima del confirmado (prior 0.5 > 0)
  assert s_pe > s_pc, '028: profit estimado > confirmado con guía en tránsito';

  raise notice '028 sales_days (paridad venta↔despacho + generadas): OK';
end $t$;

-- ===== ads por día de venta: reparto a las generadas + sin cohorte =====
do $t$
declare
  d2 date := current_date - 8;
  dd2 date := current_date - 6;
  s_ads numeric; s_sin numeric; s_sin_urb numeric; s_pc numeric; s_pc_sin numeric;
begin
  -- 2 ventas urbano/Córdoba/Natures el día d2, ambas entregadas
  perform upsert_order(jsonb_build_object('id', 2211, 'name', '#2211', 'created_at', d2::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 2212, 'name', '#2212', 'created_at', d2::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','SC','order_ref','2211','status_raw','MA','occurred_at', dd2::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','SC','order_ref','2211','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(dd2+1)::text || 'T14:00:00Z','tarifa',10000),
    jsonb_build_object('courier','urbano','tracking','SD','order_ref','2212','status_raw','MA','occurred_at', dd2::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','SD','order_ref','2212','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(dd2+1)::text || 'T14:00:00Z','tarifa',10000)
  ));
  -- spend del día d2: $20.000 a Natures (matchea keyword) + $5.000 sin keyword (product_id null → sin cohorte)
  perform upsert_ad_spend(jsonb_build_array(
    jsonb_build_object('date', d2, 'ad_id','sa1','ad_name','Natures - hook de venta','campaign_name','NATURES','spend',20000,'purchases',2),
    jsonb_build_object('date', d2, 'ad_id','sa2','ad_name','remarketing broad sin marca','campaign_name','RMKT','spend',5000,'purchases',0)
  ));
  perform recompute_daily_pnl(d2, current_date);

  select ads, ads_sin_cohorte, profit_confirmado into s_ads, s_sin, s_pc
    from sales_days(d2, null) where sale_date = d2;
  assert round(s_ads, 2) = 20000, format('028 ads: todo el spend con producto va a las ventas del día (got %s)', s_ads);
  assert round(s_sin, 2) = 5000, format('028 ads: el spend sin producto es sin cohorte (got %s)', s_sin);

  -- sin cohorte es whole-business: solo aparece en la vista "Todos", no al filtrar por courier
  select ads_sin_cohorte into s_sin_urb from sales_days(d2, 'urbano') where sale_date = d2;
  assert s_sin_urb = 0, '028 ads: sin cohorte solo en "Todos"';

  -- el profit del RPC ya restó el ads atribuido (20000), NO el sin cohorte (eso lo resta la página).
  -- Verificación sin números mágicos: borrar el ad_spend sube el profit exactamente en el ads atribuido.
  delete from ad_spend;
  select profit_confirmado into s_pc_sin from sales_days(d2, null) where sale_date = d2;
  assert round(s_pc_sin - s_pc, 2) = 20000,
    format('028 ads: el ads atribuido se resta del profit (sin ads %s − con ads %s = %s, esperado 20000)', s_pc_sin, s_pc, s_pc_sin - s_pc);

  raise notice '028 sales_days (ads por venta + sin cohorte): OK';
end $t$;

rollback;

-- ===== 030: trabadas = en tránsito y sin movimiento de estado hace 2 semanas =====
begin;
do $t$
declare
  d3 date := current_date - 25;   -- día de VENTA viejo
  dd3 date := current_date - 20;  -- despacho hace 20 días, sin movimientos desde entonces
  s_trab int; s_trab_reciente int;
begin
  perform upsert_order(jsonb_build_object('id', 2221, 'name', '#2221', 'created_at', d3::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  -- guía despachada hace 20d y ahí quedó (MA = en tránsito) → TRABADA
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','ST','order_ref','2221','status_raw','MA','occurred_at', dd3::text || 'T08:00:00Z')));
  perform recompute_daily_pnl(d3, current_date);

  select trabadas into s_trab from sales_days(d3, 'urbano') where sale_date = d3;
  assert s_trab = 1, format('030: la guía sin movimiento hace 20d cuenta como trabada (got %s)', s_trab);

  -- una guía en tránsito RECIENTE no es trabada
  select trabadas into s_trab_reciente from sales_days(current_date - 5, 'urbano') where sale_date = current_date - 5;
  assert coalesce(s_trab_reciente, 0) = 0, format('030: la guía en tránsito reciente NO es trabada (got %s)', s_trab_reciente);

  raise notice '030 trabadas (sin movimiento +14d): OK';
end $t$;
rollback;

-- ===== 031: la segmentación por producto suma exactamente lo mismo que el panel por día =====
begin;
do $t$
declare p_prod numeric; p_dias numeric; g_prod int; g_dias int;
begin
  select coalesce(sum(profit_estimado), 0), coalesce(sum(generadas), 0)
    into p_prod, g_prod from sales_by_product(current_date - 40, current_date, null);
  select coalesce(sum(profit_estimado), 0), coalesce(sum(generadas), 0)
    into p_dias, g_dias from sales_days(current_date - 40, null);
  assert round(p_prod, 2) = round(p_dias, 2),
    format('031: profit por producto (%s) debe igualar al del panel por día (%s)', p_prod, p_dias);
  assert g_prod = g_dias,
    format('031: generadas por producto (%s) = por día (%s)', g_prod, g_dias);
  raise notice '031 sales_by_product (consistencia con sales_days): OK';
end $t$;
rollback;

-- ===== 032: el desglose de costos (flete + comisiones) es correcto y no se corrió de columna =====
-- El riesgo real de la 032 es un swap posicional en el `union all` de sales_rows: flete quedando en la
-- columna de comisiones o viceversa. Por eso se asertan VALORES exactos, no solo consistencia.
begin;

delete from product_costs;
insert into product_costs (product_id, pack, unit_cost, is_estimated)
select id, 1, 5000, false from products where name = 'Natures';

do $t$
declare
  d4  date := current_date - 5;          -- día de VENTA
  dd4 date := current_date - 3;          -- día de DESPACHO
  pid int := (select id from products where name = 'Natures');
  v_flete numeric; v_com numeric; v_rev numeric; v_pe numeric; v_ads numeric;
  f_prod numeric; f_dias numeric; c_prod numeric; c_dias numeric;
  n_neg int;
begin
  delete from delivery_priors;
  insert into delivery_priors (courier, province, product_id, p_delivery, level)
    values ('urbano', 'Córdoba', pid, 0.5, 9), ('urbano', null, null, 0.5, 9);

  -- dos ventas del mismo día, misma tarifa real (10.000) y mismo COD (40.000):
  --   O1 ENTREGADA  → cobra COD, paga comisión
  --   O2 EN TRÁNSITO → ya pagó el flete (hundido), todavía NO generó comisión
  perform upsert_order(jsonb_build_object('id', 2241, 'name', '#2241', 'created_at', d4::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_order(jsonb_build_object('id', 2242, 'name', '#2242', 'created_at', d4::text || 'T13:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','SF','order_ref','2241','status_raw','MA','occurred_at', dd4::text || 'T08:00:00Z'),
    jsonb_build_object('courier','urbano','tracking','SF','order_ref','2241','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(dd4+1)::text || 'T14:00:00Z','tarifa',10000),
    jsonb_build_object('courier','urbano','tracking','SG','order_ref','2242','status_raw','MA','occurred_at', dd4::text || 'T08:00:00Z','tarifa',10000)));
  perform recompute_daily_pnl(d4, current_date);

  select flete, comisiones, revenue_estimado, profit_estimado, ads
    into v_flete, v_com, v_rev, v_pe, v_ads
    from sales_days(d4, 'urbano') where sale_date = d4;

  -- flete = tarifa × urbano_freight_mult (1.29) × LAS DOS guías — hundido, la en tránsito ya lo pagó
  assert round(v_flete, 2) = 25800,
    format('032: flete = 2 × (10000 × 1.29) = 25800 (got %s)', v_flete);
  -- comisiones = commission_pct.urbano (5,2%) × COD cobrado en puerta, SOLO de la entregada.
  -- Si algún día se alineara con el estimado daría 0.052 × (40000 + 20000) = 3120 → este assert lo frena.
  assert round(v_com, 2) = 2080,
    format('032: comisiones = 0.052 × 40000 (solo lo entregado) = 2080 (got %s)', v_com);

  -- Invariante del desglose. revenue_est − flete − comisiones − ads − profit_est deja como residuo
  -- exactamente lo que NO se expone: costo de producto (5000) + costo proyectado (0,5 × 5000 = 2500)
  -- + la comisión de lo que sigue en la calle (0,052 × 0,5 × 40000 = 1040) = 8540.
  -- Si flete y comisiones estuvieran cruzados o contados de más, el residuo se corre.
  assert round(v_rev - v_flete - v_com - v_ads - v_pe, 2) = 8540,
    format('032: el residuo del desglose debe ser 8540 (costo 5000 + costo est. 2500 + comisión est. 1040), got %s',
           round(v_rev - v_flete - v_com - v_ads - v_pe, 2));

  -- el desglose suma igual por producto que por día
  select coalesce(sum(flete), 0), coalesce(sum(comisiones), 0) into f_prod, c_prod
    from sales_by_product(d4, current_date, null);
  select coalesce(sum(flete), 0), coalesce(sum(comisiones), 0) into f_dias, c_dias
    from sales_days(d4, null);
  assert round(f_prod, 2) = round(f_dias, 2),
    format('032: flete por producto (%s) = por día (%s)', f_prod, f_dias);
  assert round(c_prod, 2) = round(c_dias, 2),
    format('032: comisiones por producto (%s) = por día (%s)', c_prod, c_dias);

  -- ningún costo negativo en ninguna rama (COD / correo / ml)
  select count(*) into n_neg from sales_rows(d4) where flete < 0 or comisiones < 0;
  assert n_neg = 0, format('032: %s filas con flete o comisiones negativos', n_neg);

  raise notice '032 desglose flete/comisiones: OK';
end $t$;
rollback;

-- ===== 033: la ventana de cobranza de Urbano es martes→lunes =====
-- El riesgo es el cálculo del "martes de la ventana": un off-by-one manda las entregas del lunes a la
-- ventana siguiente y el saldo a cobrar queda partido en dos semanas.
begin;
do $t$
declare
  n_vent int; v_ini date; v_fin date; v_pago date; v_bruto numeric; v_com numeric; v_neto numeric;
  base date := date '2026-07-07';   -- un martes
begin
  delete from product_costs;
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select id, 1, 5000, false from products where name = 'Natures';

  -- 3 entregas: el martes que abre, el lunes que cierra, y el martes siguiente (otra ventana)
  for i in 0..2 loop
    perform upsert_order(jsonb_build_object(
      'id', 2300 + i, 'name', '#' || (2300 + i), 'created_at', (base - 3)::text || 'T12:00:00-03:00',
      'financial_status', 'pending', 'tags', '', 'total_price', '10000',
      'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
      'line_items', '[{"title":"Natures","quantity":1,"price":"10000"}]'::jsonb));
  end loop;
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','C0','order_ref','2300','status_raw','ENTREGADO EN DOMICILIO','occurred_at', base::text          || 'T12:00:00Z','tarifa',1000),
    jsonb_build_object('courier','urbano','tracking','C1','order_ref','2301','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(base+6)::text      || 'T12:00:00Z','tarifa',1000),
    jsonb_build_object('courier','urbano','tracking','C2','order_ref','2302','status_raw','ENTREGADO EN DOMICILIO','occurred_at',(base+7)::text      || 'T12:00:00Z','tarifa',1000)));

  select count(*) into n_vent from urbano_cobranza(base);
  assert n_vent = 2, format('033: martes y lunes van juntos, el martes siguiente aparte → 2 ventanas (got %s)', n_vent);

  select ventana_ini, ventana_fin, fecha_pago, cod_bruto, comision, neto
    into v_ini, v_fin, v_pago, v_bruto, v_com, v_neto
    from urbano_cobranza(base) where ventana_ini = base;

  assert v_fin = base + 6, format('033: la ventana cierra el lunes (got %s)', v_fin);
  assert v_pago = base + 7, format('033: se cobra el martes siguiente (got %s)', v_pago);
  -- el martes que abre + el lunes que cierra = 2 guías × 10.000
  assert v_bruto = 20000, format('033: martes y lunes suman en la MISMA ventana → 20000 (got %s)', v_bruto);
  -- comisión = commission_pct.urbano sobre el bruto; neto = bruto − comisión
  assert round(v_com + v_neto, 2) = 20000, format('033: comisión + neto = bruto (got %s)', v_com + v_neto);
  assert v_com > 0, '033: la comisión sale de settings.commission_pct y no puede ser 0';

  raise notice '033 ventana de cobranza Urbano (mar→lun): OK';
end $t$;
rollback;

-- ===== 034: las RPCs de /analisis no discuten con el P&L =====
-- El riesgo es que reagrupen con otro criterio y den números distintos a los paneles. Se ancla que:
-- (a) la suma por canal×producto = daily_pnl, (b) la regla no_despachado se aplica igual en las tres.
begin;
do $t$
declare
  d5  date := current_date - 12;
  dd5 date := current_date - 10;
  pid int := (select id from products where name = 'Natures');
  a_prof numeric; d_prof numeric; z_guias int; z_ent int; z_margen numeric; e_calle int; e_nodesp int;
begin
  delete from product_costs;
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select id, 1, 5000, false from products where name = 'Natures';

  -- 3 guías Córdoba: 1 entregada, 1 en tránsito, 1 PI vieja (no despachada, +7d)
  for i in 0..2 loop
    perform upsert_order(jsonb_build_object(
      'id', 2400 + i, 'name', '#' || (2400 + i), 'created_at', d5::text || 'T12:00:00-03:00',
      'financial_status', 'pending', 'tags', '', 'total_price', '30000',
      'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
      'line_items', '[{"title":"Natures","quantity":1,"price":"30000"}]'::jsonb));
  end loop;
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','Z0','order_ref','2400','status_raw','ENTREGADO EN DOMICILIO','occurred_at', dd5::text || 'T12:00:00Z','tarifa',5000),
    jsonb_build_object('courier','urbano','tracking','Z1','order_ref','2401','status_raw','MA','occurred_at', dd5::text || 'T12:00:00Z','tarifa',5000),
    jsonb_build_object('courier','urbano','tracking','Z2','order_ref','2402','status_raw','PI','occurred_at', dd5::text || 'T12:00:00Z','tarifa',5000)));
  perform recompute_daily_pnl(d5, current_date);

  -- (a) analisis_pnl reagrupa daily_pnl sin cambiarlo — los DOS profits (v2, 035)
  select coalesce(sum(profit_conf), 0) into a_prof from analisis_pnl(d5, current_date, null);
  select coalesce(sum(profit_confirmado), 0) into d_prof from daily_pnl
   where dispatch_date between d5 and current_date;
  assert round(a_prof, 2) = round(d_prof, 2),
    format('034: analisis_pnl conf (%s) debe igualar a daily_pnl (%s)', a_prof, d_prof);
  select coalesce(sum(profit_est), 0) into a_prof from analisis_pnl(d5, current_date, null);
  select coalesce(sum(profit_estimado), 0) into d_prof from daily_pnl
   where dispatch_date between d5 and current_date;
  assert round(a_prof, 2) = round(d_prof, 2),
    format('035: analisis_pnl est (%s) debe igualar a daily_pnl (%s)', a_prof, d_prof);

  -- (b) zonas: la PI de +7d sale del denominador y no paga flete
  select guias, entregadas, margen_bruto into z_guias, z_ent, z_margen
    from analisis_zonas(d5, current_date, 'urbano') where province = 'Córdoba';
  assert z_guias = 2, format('034: la guía PI +7d no cuenta como despacho → 2 (got %s)', z_guias);
  assert z_ent = 1, format('034: 1 entregada (got %s)', z_ent);
  -- margen = COD cobrado 30.000 − flete de las DOS despachadas (5000 × 1,29 × 2 = 12.900)
  assert round(z_margen, 2) = 30000 - 12900,
    format('034: margen bruto = 30000 − 12900 = 17100 (got %s)', z_margen);

  -- (c) desenlaces: mismos cubos, la PI aparte
  select coalesce(sum(guias), 0) into e_calle from analisis_desenlaces(d5, current_date, 'urbano')
   where estado = 'en_la_calle';
  select coalesce(sum(guias), 0) into e_nodesp from analisis_desenlaces(d5, current_date, 'urbano')
   where estado = 'no_despachado';
  assert e_calle = 1, format('034: 1 guía en la calle (got %s)', e_calle);
  assert e_nodesp = 1, format('034: 1 guía no despachada, en su propio cubo (got %s)', e_nodesp);

  raise notice '034 RPCs de análisis: OK';
end $t$;
rollback;

-- ===== 035: packs, maduración y flete perdido =====
begin;
do $t$
declare
  d6  date := current_date - 12;
  dd6 date := current_date - 10;
  pk_g int; pk_e int; pk_m numeric; z_perd numeric; z_flete numeric; md_g int; md_r int;
begin
  delete from product_costs;
  insert into product_costs (product_id, pack, unit_cost, is_estimated)
  select id, 2, 4500, false from products where name = 'Natures';

  -- 2 pedidos pack x2 (una línea, quantity=2 ⇒ pack=2 desde la 006): 1 entregado, 1 devuelto
  for i in 0..1 loop
    perform upsert_order(jsonb_build_object(
      'id', 2500 + i, 'name', '#' || (2500 + i), 'created_at', d6::text || 'T12:00:00-03:00',
      'financial_status', 'pending', 'tags', '', 'total_price', '50000',
      'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
      'line_items', '[{"title":"Natures","quantity":2,"price":"50000"}]'::jsonb));
  end loop;
  perform upsert_shipment_events(jsonb_build_array(
    jsonb_build_object('courier','urbano','tracking','K0','order_ref','2500','status_raw','ENTREGADO EN DOMICILIO','occurred_at', dd6::text || 'T12:00:00Z','tarifa',4000),
    jsonb_build_object('courier','urbano','tracking','K1','order_ref','2501','status_raw','RC','occurred_at', dd6::text || 'T12:00:00Z','tarifa',4000)));

  -- packs: el bucket exige >=40 guías, así que con 2 no debe aparecer (guarda contra leer ruido)
  select count(*) into pk_g from analisis_packs(d6, current_date, 'urbano');
  assert pk_g = 0, format('035: con 2 guías el bucket de pack NO se muestra (got %s filas)', pk_g);

  -- zonas: el flete perdido es el de la devuelta (4000 × 1,29 = 5160), el total el de las dos
  select flete, flete_perdido into z_flete, z_perd
    from analisis_zonas(d6, current_date, 'urbano') where province = 'Córdoba';
  assert round(z_flete, 2) = 10320, format('035: flete total = 2 × 5160 = 10320 (got %s)', z_flete);
  assert round(z_perd, 2) = 5160, format('035: flete PERDIDO = solo la devuelta = 5160 (got %s)', z_perd);
  assert z_perd < z_flete, '035: el flete perdido es un subconjunto del total';

  -- 036: margen neto = cobrado − flete − comisión (solo entregada) − costo (entregado+siniestro)
  --      = 50000 − 10320 − 2600 − 4500 = 32580. Clava la fórmula: un swap o contar la comisión de
  --      la devuelta lo corre.
  select margen_neto into pk_m from analisis_zonas(d6, current_date, 'urbano') where province = 'Córdoba';
  assert round(pk_m, 2) = 32580, format('036: margen neto = 32580 (got %s)', pk_m);

  -- maduración: el bucket exige >=20 guías, con 2 tampoco aparece
  select count(*) into md_g from analisis_maduracion(d6, 'urbano');
  assert md_g = 0, format('035: con 2 guías el bucket de maduración NO se muestra (got %s)', md_g);

  -- filtro por producto: con el id correcto la zona aparece, con otro producto no
  select count(*) into md_g from analisis_zonas(d6, current_date, 'urbano',
    (select id from products where name = 'Natures'));
  assert md_g = 1, format('035: zonas filtrado por Natures encuentra la provincia (got %s)', md_g);
  select count(*) into md_g from analisis_zonas(d6, current_date, 'urbano',
    (select id from products where name = 'Pureza'));
  assert md_g = 0, format('035: zonas filtrado por Pureza no tiene guías (got %s)', md_g);

  raise notice '035 packs/maduración/flete perdido + filtro producto: OK';
end $t$;
rollback;

-- el seed de CPA de referencia quedó cargado y es legible
do $t$
declare v jsonb;
begin
  select value into v from settings where key = 'cpa_referencia';
  assert v is not null, '035: falta el seed de cpa_referencia';
  assert (v->'Natures'->>'objetivo')::numeric = 5200,
    format('035: el objetivo de Natures es 5200 (got %s)', v->'Natures'->>'objetivo');
  raise notice '035 seed cpa_referencia: OK';
end $t$;

-- ===== 037: el sin cohorte NO se contamina con los Product Ads de ML =====
begin;
do $t$
declare
  d4 date := current_date - 8;
  s_ads numeric; s_sin numeric;
begin
  -- venta COD del día + spend Meta: $20.000 con producto (ancla) y $5.000 sin producto (sin cohorte real)
  perform upsert_order(jsonb_build_object('id', 2231, 'name', '#2231', 'created_at', d4::text || 'T12:00:00-03:00',
    'financial_status', 'pending', 'tags', '', 'total_price', '40000',
    'shipping_address', '{"province":"Córdoba","city":"Córdoba","zip":"5000"}'::jsonb,
    'line_items', '[{"title":"Natures","quantity":1,"price":"40000"}]'::jsonb));
  perform upsert_ad_spend(jsonb_build_array(
    jsonb_build_object('date', d4, 'ad_id','sa3','ad_name','Natures - hook','campaign_name','NATURES','spend',20000,'purchases',1),
    jsonb_build_object('date', d4, 'ad_id','sa4','ad_name','remarketing broad','campaign_name','RMKT','spend',5000,'purchases',0)
  ));
  -- venta ML el mismo día con Product Ads: NO es plata de Meta, no puede pisar el sin cohorte
  insert into ml_orders (ml_id, created_at, product, units, pack, total_amount, sale_fee, ship_cost, shipment_id, status, raw)
    values (95003, (d4::text||'T12:00:00-03:00')::timestamptz, 'Pureza', 1, 1, 60000, 0, 0, 3, 'paid', '{}');
  insert into ml_ad_spend (date, cost) values (d4, 3000);
  perform recompute_daily_pnl(d4, current_date);

  select ads, ads_sin_cohorte into s_ads, s_sin from sales_days(d4, null) where sale_date = d4;
  -- la columna ads del día sí suma todo lo asignado: Meta (20.000) + ML (3.000)
  assert round(s_ads, 2) = 23000, format('037: ads del día = Meta asignada + ML (got %s)', s_ads);
  -- ANTES del fix: 25.000 − 23.000 = 2.000 (los ads ML, que no son Meta, se comían el sin cohorte)
  assert round(s_sin, 2) = 5000, format('037: sin cohorte = solo spend Meta sin anclar, sin restar ML (got %s)', s_sin);
  raise notice '037 sin-cohorte sin ML: OK';
end $t$;
rollback;
