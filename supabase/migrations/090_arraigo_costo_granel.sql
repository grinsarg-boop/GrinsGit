-- 090 — Arraigo: el $3.817 de Genus era la MEZCLA, no el frasco terminado.
-- Confirmado por Pancho el 26/08/2026: los $3.817 cubren solo el granel (Capixyl al 3%);
-- frasco + etiqueta los compramos nosotros y estimó $900. Es exactamente la corrección que la
-- 071 dejó escrita como pendiente ("si Genus contesta $4.717, hay que rehacer las tres filas
-- x1 4717 · x2 9434 · x3 17851 y recomputar desde el 05/08"), solo que la respuesta vino de la
-- negociación cerrada, no de David.
--   x1 = 3817 + 900                  = $4.717
--   x2 = 2 × 4717                    = $9.434
--   x3 = 3 × 4717 + 3700 (aplicador) = $17.851
-- El $900 es ESTIMADO (goteros y etiquetas todavía no comprados), pero is_estimated se deja en
-- false igual que en la 071: el flag no alimenta ningún cálculo, y ponerlo en true acá haría que
-- el costo mejor conocido parezca más flojo que el $3.817 que reemplaza.
update product_costs pc
   set unit_cost = v.cost
  from products p, (values (1, 4717), (2, 9434), (3, 17851)) v(pack, cost)
 where pc.product_id = p.id and p.name = 'Arraigo' and pc.pack = v.pack;

-- Arraigo vende desde el 05/08/2026: todo el P&L de esos días quedó con el COGS viejo.
select recompute_daily_pnl('2026-08-05', current_date);
