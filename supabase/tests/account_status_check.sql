-- account_status_check — sync_meta_account_status: la alerta es la TRANSICIÓN, no el estado.
-- Si esto se rompe, o no avisamos cuando una cuenta se cae, o mandamos un mail por hora para siempre.
begin;

-- run 1: primera foto. Es línea de base, no una noticia → prev_status null.
select * from sync_meta_account_status('[
  {"account_id":"act_1","name":"Tienda R 3","status":"ACTIVE","status_code":1},
  {"account_id":"act_2","name":"Tienda R 2","status":"UNSETTLED","status_code":3}
]'::jsonb);
do $$ begin
  assert (select count(*) from meta_account_status where prev_status is null) = 2,
    'run1: la primera foto no marca cambios';
end $$;

-- run 2: misma foto. Idempotente: no puede inventar un cambio ni mover changed_at.
-- (now() es constante dentro de la txn, por eso probamos con un literal.)
update meta_account_status set changed_at = timestamptz '2020-01-01';
select * from sync_meta_account_status('[
  {"account_id":"act_1","name":"Tienda R 3","status":"ACTIVE","status_code":1},
  {"account_id":"act_2","name":"Tienda R 2","status":"UNSETTLED","status_code":3}
]'::jsonb);
do $$ begin
  assert (select count(*) from meta_account_status where changed_at = timestamptz '2020-01-01') = 2,
    'run2: sin cambio de estado no se toca changed_at';
end $$;

-- run 3: act_1 ACTIVE → UNSETTLED (saldo impago, NO es baneo) y act_2 se recupera.
select * from sync_meta_account_status('[
  {"account_id":"act_1","name":"Tienda R 3","status":"UNSETTLED","status_code":3},
  {"account_id":"act_2","name":"Tienda R 2","status":"ACTIVE","status_code":1}
]'::jsonb);
do $$ begin
  assert (select prev_status = 'ACTIVE' and status = 'UNSETTLED' and changed_at > now() - interval '1 minute'
          from meta_account_status where account_id = 'act_1'), 'run3: la transición queda marcada';
  assert (select prev_status = 'UNSETTLED' and status = 'ACTIVE'
          from meta_account_status where account_id = 'act_2'), 'run3: la recuperación también es cambio';
end $$;

-- run 4: act_1 sigue UNSETTLED. changed_at NO se mueve → /api/salud/cuentas ya no lo cuenta como
-- cambio y el mail no se repite cada hora (la fatiga de alerta que apagó 059).
update meta_account_status set changed_at = timestamptz '2020-01-01' where account_id = 'act_1';
select * from sync_meta_account_status('[
  {"account_id":"act_1","name":"Tienda R 3","status":"UNSETTLED","status_code":3}
]'::jsonb);
do $$ begin
  assert (select changed_at = timestamptz '2020-01-01' and prev_status = 'ACTIVE'
          from meta_account_status where account_id = 'act_1'), 'run4: el estado que persiste no re-alerta';
  -- una cuenta que no vino en esta foto queda como estaba (no se borra ni se marca)
  assert (select status = 'ACTIVE' from meta_account_status where account_id = 'act_2'),
    'run4: la cuenta ausente de la foto no se toca';
end $$;

-- run 5: UNSETTLED → DISABLED. Es la distinción cara del playbook: acá sí se rota de cuenta.
select * from sync_meta_account_status('[
  {"account_id":"act_1","name":"Tienda R 3","status":"DISABLED","status_code":2}
]'::jsonb);
do $$ begin
  assert (select prev_status = 'UNSETTLED' and status = 'DISABLED' and status_code = 2
          from meta_account_status where account_id = 'act_1'), 'run5: UNSETTLED → DISABLED es cambio';
end $$;

rollback;
