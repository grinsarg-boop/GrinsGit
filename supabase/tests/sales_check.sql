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
