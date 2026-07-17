-- bot_pnl_check.sql (023): la RPC del bot exige secreto y agrega bien.
begin;

do $t$
declare j jsonb;
begin
  insert into settings (key, value) values ('bot_read_secret', '"s3cr3t-test"'::jsonb)
  on conflict (key) do update set value = excluded.value;

  insert into daily_pnl (dispatch_date, courier, product_id, despachadas, entregadas,
                         revenue_confirmado, profit_confirmado, profit_estimado, pct_resuelto, ads)
  values
    (current_date - 1, 'urbano', (select id from products where name = 'Natures'), 10, 4, 200000, 50000, 120000, 40, 30000),
    (current_date - 1, 'fixy',   (select id from products where name = 'Pureza'),   5, 3, 150000, 40000,  60000, 60, 20000),
    (current_date - 20, 'ml',    (select id from products where name = 'Revival Oil'), 2, 2, 24000, 9000, 9000, 100, 0);

  -- sin secreto o secreto malo → null (ni error ni datos)
  assert bot_pnl(null) is null, '023: null sin secreto';
  assert bot_pnl('malo') is null, '023: null con secreto malo';

  j := bot_pnl('s3cr3t-test');
  assert j is not null, '023: responde con el secreto';
  assert (j->'total_7d'->>'despachadas')::int = 15, '023: 7d suma solo la última semana';
  assert (j->'total_30d'->>'despachadas')::int = 17, '023: 30d incluye la fila vieja';
  assert (j->'total_7d'->>'profit_est')::bigint = 180000, '023: profit_est 7d';
  assert j->'por_canal_30d' ? 'ml', '023: canal ml presente';
  assert (j->'por_producto_7d'->'Natures'->>'despachadas')::int = 10, '023: producto 7d';
  assert jsonb_array_length(j->'ultimos_dias') = 1, '023: un solo día con datos en la ventana de 10';

  raise notice '023 bot_pnl: OK';
end $t$;

rollback;
