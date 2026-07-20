-- trabados_check — trabados_list() (038) debe contar EXACTAMENTE lo mismo que la suma del
-- contador `trabadas` de sales_days (030): mismo predicado, si divergen la página miente
-- contra el "!" del panel.
do $$
declare v_list int; v_days int;
begin
  select count(*) into v_list from trabados_list();
  select coalesce(sum(trabadas), 0) into v_days from sales_days('2000-01-01', null);
  if v_list <> v_days then
    raise exception 'trabados_list()=% filas vs sales_days Σtrabadas=%', v_list, v_days;
  end if;
end $$;
