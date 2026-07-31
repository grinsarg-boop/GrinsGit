-- Los eventos necesitan alcance: el aviso de texto y la marca en las curvas no son lo mismo.
--
-- Verificado en prod al ver la 065 dibujada: la franja del ×3 de `purchases` (may → 22/07) tapaba
-- dos tercios del gráfico de profit por día de venta de /ventas, que NO usa `purchases` para nada —
-- ese profit sale de nuestras propias órdenes. Una trama sobre la serie dice "no compares esto", y
-- ahí era falso: el dato del gráfico estaba bien.
--
-- El aviso de texto sí corresponde, porque puede explicar CUÁL número está tocado y cuál no; una
-- trama no puede matizar. Entonces: `en_graficos` decide si el evento se dibuja además de avisarse.
-- Default true — un blackout de verdad (Shopify caído, ANMAT) sí afecta lo que las curvas plotean.
alter table eventos add column if not exists en_graficos boolean not null default true;

comment on column eventos.en_graficos is
  'Si el evento afecta lo que los gráficos del panel PLOTEAN, se dibuja como marca/franja. Si solo afecta datos de terceros (Meta, AppAds), va como aviso de texto y nada más.';

update eventos set en_graficos = false where fecha = '2026-05-01' and texto like 'Dato de Meta no comparable%';
