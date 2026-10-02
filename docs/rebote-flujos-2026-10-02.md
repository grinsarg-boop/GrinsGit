# Flujos de rescate de rebote (Veltron) — ¿llegan y una sola vez? · 02/10/2026

Plan 100M **A02-R2-T1**, partes (c) y (d) + estado de los flujos. Solo lectura: `ver_flujos_comms`, `listar_plantillas`, `ver_conversacion` ×18 (15 + 3 extra de Fixy), y un `GET /api/v1/tenant/{T}/comms` (REST, solo lectura, con la API key) porque el MCP **no muestra `condiciones[]`**. Base: Supabase Finanzas con `default_transaction_read_only = on`. Ninguna tool de escritura se llamó.

## Veredicto corto

1. **Las 4 reglas de REBOTADO_2 de Urbano tienen `condiciones[]` por motivo y son excluyentes**: ningún pedido de la muestra recibió más de una `urbano_rebote_*`. No hace falta frenarlas. La sospecha del 26/09 (2-4 plantillas por rebote) **es falsa**.
2. **Cuando el evento le llega a Veltron, la plantilla sale una vez**: ur_suc 3/3, ur_reb2_noresp 2/2, fx_reb 2/3, ur_ret_costo 3/4.
3. **El agujero está en los eventos que Veltron no llega a ver**: 6 de 15 pedidos tenían un evento de rescate sin plantilla (sin contar `fx_ret_costo`). El patrón es VN/BA seguido de DV el mismo día (Veltron lee solo el *último movimiento* y salta directo a RETORNADO), CA pisado por LD/EI, Fixy 51 → 135 → 42 en 19 h (el 42 hace retroceder el estado a DESPACHADO).
4. **`ur_reb1b` (`urbano_ausente_2`, delay 48 h) sale pegado al `urbano_c3_ausente`**, 1 h o 1 min después. En la práctica el cliente recibe 2 plantillas casi juntas. El `delay_horas: 48` no se cumple: confirma lo del 29/09.
5. **`fx_ret_costo` no puede disparar hoy**: exige `fixy_estado like DEVOLUCI*ENTREGADA` (el 184). El 184 no aparece en la base desde el **11/09/2026**, y los 107 retornos Fixy de 14 días son 139 ("COBRO DE SERVICIO Y DEVOLUCION..."), que no matchean. 0 de 2 en la muestra.
6. Un teléfono de la muestra (#22364) tiene **todas** las plantillas en `failed` desde el c1: Veltron "envía" pero no llega a nadie. Es un número inválido o sin WhatsApp, y no hay alerta.

## 1. Estado de los flujos (vivo 02/10/2026)

### Reglas de rescate: evento, plantilla y condiciones (GET /comms, que el MCP no muestra)

Todas con `max_envios: 1`, `campana_horario: [9,20]`, `campana_dias_max: 45`. La nota del MCP dice: "Cada regla manda UNA vez por pedido y evento".

| regla | evento | plantilla | activo | condiciones | delay h | recordatorio_de | modo | una_por_tel_días | cupo/corrida |
|---|---|---|---|---|---|---|---|---|---|
| ur_reb1 | REBOTADO_1 | urbano_c3_ausente | sí | — | 0 | - | - | 0 | 0 |
| ur_reb1b | REBOTADO_1 | urbano_ausente_2 | sí | — | 48 | - | - | 0 | 0 |
| ur_suc | EN_SUCURSAL | urbano_c5_definicion | sí | — | 0 | - | - | 0 | 0 |
| ur_ret | RETORNADO | urbano_retornado_deposito | **no** | — | 0 | - | - | 0 | 0 |
| fx_reb | REBOTADO_1 | fixy_visita_fallida | sí | — | 0 | - | - | 0 | 0 |
| fx_suc | EN_SUCURSAL | fixy_segundo_contacto | sí | — | 0 | - | - | 0 | 0 |
| fx_ret | RETORNADO | fixy_retornado_deposito | **no** | — | 0 | - | - | 0 | 0 |
| ur_reb2 | REBOTADO_2 | urbano_rebote_direccion | `[{"op":"like","campo":"urbano_motivo","valor":"*direcci*"}]` | 0 | - | - | 0 | 0 |
| ur_ret_costo | RETORNADO | retorno_reenvio_costo_v2 | `[{"op":"eq","campo":"urbano_estado","valor":"RC"}]` | 0 | - | - | 7 | 20 |
| fx_ret_costo | RETORNADO | retorno_reenvio_costo_v2 | `[{"op":"like","campo":"fixy_estado","valor":"DEVOLUCI*ENTREGADA"}]` | 0 | - | - | 7 | 10 |
| ur_ret_costo_2 | RETORNADO | retorno_reenvio_recordatorio | `[{"op":"eq","campo":"urbano_estado","valor":"RC"}]` | 72 | ur_ret_costo | - | 7 | 0 |
| fx_ret_costo_2 | RETORNADO | retorno_reenvio_recordatorio | `[{"op":"like","campo":"fixy_estado","valor":"DEVOLUCI*ENTREGADA"}]` | 72 | fx_ret_costo | - | 7 | 0 |
| ur_reb2_noresp | REBOTADO_2 | urbano_rebote_no_responde | `[{"op":"like","campo":"urbano_motivo","valor":"*respond*"}]` | 0 | - | - | 0 | 0 |
| ur_reb2_dinero | REBOTADO_2 | urbano_rebote_sin_pago | `[{"op":"like","campo":"urbano_motivo","valor":"*dinero*"}]` | 0 | - | - | 0 | 0 |
| ur_reb2_rehusa | REBOTADO_2 | urbano_rebote_rechazado | `[{"op":"like","campo":"urbano_motivo","valor":"*ehusa*"}]` | 0 | - | - | 0 | 0 |
| ur_ret_transf | RETORNADO | retorno_reenvio_transferencia | `[{"op":"eq","campo":"urbano_estado","valor":"RC"}]` | 48 | ur_ret_costo | acepto_sin_pago | 7 | 0 |
| fx_ret_transf | RETORNADO | retorno_reenvio_transferencia | `[{"op":"like","campo":"fixy_estado","valor":"DEVOLUCI*ENTREGADA"}]` | 48 | fx_ret_costo | acepto_sin_pago | 7 | 0 |

### Mapa carrier → evento (`carrier_status` de GET /comms)

- **Urbano** (código del último movimiento): `CA`→REBOTADO_1 · `VN, BA, NT, ST`→REBOTADO_2 · `SP`→EN_SUCURSAL · `DV, RV, RM, RC`→RETORNADO · `EI, DL`→ENTREGADO · `PI, IF, GE, CO`→DESPACHADO · `AS, AR, MA, AM, LD`→EN_CAMINO.
- **Fixy** (regex sobre el texto del último movimiento, en orden): `ENTREGAD`→ENTREGADO · `DEVOLUC|DEVUELT|REINGRESO`→RETORNADO · `RECHAZ|AUSENTE|...|SIN CONTACTO|...`→REBOTADO_1 · `RECORRIDO|RUTEAD|REPARTO|...|REPROGRAMAD|EN CAMINO`→EN_CAMINO · default DESPACHADO.
  - ⚠️ El mapa publicado **no explica** que el 135 "REINGRESO A DEPOSITO" dispare `fx_suc` (EN_SUCURSAL): por regex daría RETORNADO. Igual, en los datos el 135 **sí** dispara `fixy_segundo_contacto` (2/3 en la muestra extra). Hay lógica que el `carrier_status` no muestra.
  - ⚠️ Por el orden del regex, "DEVOLUCION ENTREGADA" (184) cae en `ENTREGAD`→ENTREGADO antes que en RETORNADO, y entonces `fx_ret_costo` (RETORNADO + `DEVOLUCI*ENTREGADA`) no tendría cómo matchear. Es coherente con el bug del 184→ENTREGADO del 29/09. No se verificó del lado de Veltron.
- Fixy 48 (dirección), 52 (reprogramado→EN_CAMINO), 63 y 125 (sin dinero) **no generan rebote**: quedan mudos.

### Plantillas (45): 43 APPROVED, 2 REJECTED (`fixy_en_sucursal`, `correo_dato_faltante`)

APPROVED y sin flujo que las use: `urbano_no_responde`, `urbano_sin_efectivo`, `urbano_despacho_anulado`, `urbano_c4_confirmar`, `delivery_reminder_fixy`, `delivery_reminder_fixy_v2`, `order_confirmation_andreani`, `fixy_retiro_sucursal`, `retorno_reenvio_costo` (v1), `mp_despacho_seguimiento_v2`, `correo_confirmar_cp`, `correo_confirmar_direccion`, `payment_confirmed`, `order_confirmation_cuotas`, `order_followup`, `saludo_generico` (algunas pueden colgar de flujos de marketing, que `ver_flujos_comms` no lista).

## 2. (c) Incidencias en la base, últimos 14 días (al 02/10/2026 ~14:30 UTC)

Se cuenta por pedido distinto. Un pedido puede caer en varias reglas (por ejemplo CA, luego VN y luego RC).

| courier | regla mapeada | pedidos | eventos |
|---|---|---|---|
| urbano | ur_reb1 (+ur_reb1b @48h) — CA | 693 | 1.420 |
| urbano | ur_reb2_noresp — VN/BA/NT/ST "no responde" | 398 | 801 |
| urbano | ur_reb2_rehusa — "rehusa" | 323 | 642 |
| urbano | ur_reb2_dinero — "falta de dinero" | 273 | 550 |
| urbano | ur_reb2 (dirección) — "direcci" | 93 | 171 |
| urbano | REBOTADO_2 **sin regla** (titular no encontrado, destinatario desconocido, NT "no pudimos visitarlo", ST, viaje, etc.) | 241 | 432 |
| urbano | ur_suc — SP | 446 | 732 |
| urbano | ur_ret_costo (+transf @48h, recordatorio @72h) — RC | 643 | 648 |
| urbano | RETORNADO DV/RV/RM **sin regla** (ur_ret apagado; la oferta espera al RC) | 922 | 3.518 |
| fixy | fx_reb — 127/51 | 96 | 119 |
| fixy | fx_suc — 135 (todo 14 d; **45** después de reactivarse el 29/09 ~17 h) | 138 | 208 |
| fixy | 139 RETORNADO (`fx_ret_costo` exige DEVOLUCI*ENTREGADA = 184 → **0 elegibles**; último 184 en la base: 11/09) | 107 | 107 |
| fixy | 48/52/63/125 **sin regla** | 77 | 91 |

Salvedades: (1) los `occurred_at` de Urbano son sintéticos (09:00 / 20:59 = hora de nuestro sync), así que el orden real dentro del día no se ve. (2) El motivo de Urbano sale de `raw->>'descripcion'` o, en eventos sintéticos, de `estado_actual` solo si empieza con el mismo código. (3) Veltron no ve estos eventos: ve el **último movimiento** en cada refresh horario, así que la base sobrecuenta lo que Veltron puede disparar.

Query:

```sql
set default_transaction_read_only = on;
-- (c) Pedidos con eventos de rebote/sucursal/retorno en 14 días, mapeados a la regla de Veltron (carrier_status + condiciones[] leídos el 02/10/2026)
with ev as (
  select s.courier, s.tracking, s.order_id, e.status_raw, e.occurred_at,
         lower(coalesce(e.raw->>'descripcion',
               case when e.raw->>'estado_actual' like e.status_raw||' -%' then e.raw->>'estado_actual' end, '')) motivo
  from shipment_events e join shipments s on s.id = e.shipment_id
  where e.occurred_at >= now() - interval '14 days'
    and ((s.courier='urbano' and e.status_raw in ('CA','VN','BA','NT','ST','SP','DV','RV','RM','RC'))
      or (s.courier='fixy' and e.status_raw in ('127','51','135','139','48','52','63','125')))
), m as (
  select *, case
    when courier='urbano' and status_raw='CA' then 'ur_reb1 (+ur_reb1b @48h)'
    when courier='urbano' and status_raw in ('VN','BA','NT','ST') then case
         when motivo like '%direcci%' then 'ur_reb2 (direccion)'
         when motivo like '%respond%' then 'ur_reb2_noresp'
         when motivo like '%dinero%'  then 'ur_reb2_dinero'
         when motivo like '%ehusa%'   then 'ur_reb2_rehusa'
         else 'REBOTADO_2 sin regla (otro motivo)' end
    when courier='urbano' and status_raw='SP' then 'ur_suc'
    when courier='urbano' and status_raw='RC' then 'ur_ret_costo (+transf @48h, recordatorio @72h)'
    when courier='urbano' then 'RETORNADO DV/RV/RM sin regla (ur_ret apagado)'
    when status_raw in ('127','51') then 'fx_reb'
    when status_raw='135' then 'fx_suc'
    when status_raw='139' then 'fx_ret_costo (cond DEVOLUCI*ENTREGADA)'
    else 'Fixy 48/52/63/125 sin regla' end regla
  from ev
)
select courier, regla, count(distinct order_id) pedidos, count(distinct tracking) guias, count(*) eventos
from m group by 1,2 order by 1,3 desc;
```

## 3. (d) Muestra de 15 conversaciones (`ver_conversacion`, ≤25/min)

La muestra son 11 de Urbano y 4 de Fixy, estratificada por regla, con el evento entre 3 y 10 días atrás (orden pseudoaleatorio md5). Horas en ART. Se cuenta "plantilla vista" si es posterior al evento y del mismo pedido.

| # | pedido · carrier · tel | evento(s) en ventana (fecha) | regla esperada | plantillas vistas (fecha ART, estado) | veredicto |
|---|---|---|---|---|---|
| 1 | #22364 · urbano · 2998574699 | CA 21/09, 23/09, 30/09, 02/10 · ST 22/09 · VN rehusa 29/09, 01/10 | ur_reb1b (c3 ya salió 09/09), ur_reb2_rehusa | `urbano_ausente_2` 21/09 19:02 **failed** · `urbano_rebote_rechazado` 29/09 21:03 **failed** | **no llegó** (salió ×1 por regla, pero todo el historial del teléfono está en `failed`, desde el c1) |
| 2 | #24992 · urbano · 3426495328 | CA 18/09, 24/09, 28/09 · VN no responde 28/09 · SP 28/09 · DV/RM 30/09 | ur_reb1+1b, ur_reb2_noresp, ur_suc | `urbano_c3_ausente` 19/09 08:02 + `urbano_ausente_2` 19/09 09:03 · `urbano_rebote_no_responde` 28/09 20:01 · `urbano_c5_definicion` 29/09 16:03 (todo read) | **llegó ×1 por regla**; reb1 **×2 en 1 h**; ninguna otra rebote_* |
| 3 | #24774 · urbano · 3541273670 | VN dirección 24/09 (+DV mismo día) · RC 30/09 | ur_reb2 (dirección), ur_ret_costo | `retorno_reenvio_costo_v2` 30/09 14:02 delivered | reb2 **no llegó**; ret_costo **llegó** |
| 4 | #25815 · urbano · 3804878563 | BA falta de dinero 24/09 · SP 24/09 · DV 30/09 | ur_reb2_dinero, ur_suc | `urbano_rebote_sin_pago` 24/09 21:04 · `urbano_c5_definicion` 25/09 14:03 (read) | **llegó** ×1 c/u |
| 5 | #26711 · urbano · 2622381360 | VN falta de dinero 29/09 (+DV mismo día) | ur_reb2_dinero | — (último: `urbano_c2_salida` 29/09 13:01) | **no llegó** |
| 6 | #26409 · urbano · 3865553434 | VN no responde 29/09 · CA 30/09 | ur_reb2_noresp, ur_reb1+1b | `urbano_rebote_no_responde` 30/09 17:03 · `urbano_c3_ausente` 30/09 18:01 + `urbano_ausente_2` 30/09 18:02 (read) | **llegó**; reb1 **×2 en 1 min** |
| 7 | #25814 · urbano · 3624163588 | VN rehusa 25/09 · SP 25/09 · RC 01/10 | ur_reb2_rehusa, ur_suc, ur_ret_costo | `urbano_rebote_rechazado` 25/09 19:03 · `urbano_c5_definicion` 26/09 08:04 · `retorno_reenvio_costo_v2` 01/10 17:03 | **llegó** ×1 c/u |
| 8 | #22407 · urbano · 2634651829 | DV 21/09 · RC 26/09 | ur_ret_costo | — (último template: `urbano_c5_definicion` 15/09; Carito lo trabajó a mano 18-21/09) | **no llegó** (cupo 20/corrida o regla posterior al RC: sin verificar) |
| 9 | #25182 · fixy · 1125942806 | 135 22/09, 23/09 · 127 23/09 09:47 · 139 01/10 | fx_reb (fx_suc apagado hasta 29/09; 139 no matchea fx_ret_costo) | `fixy_visita_fallida` 23/09 10:01 read | fx_reb **llegó**; retorno **no llegó** (por diseño de la condición); Veltron lo tiene "despachado" (bug del 42) |
| 10 | #26796 · fixy · 1162246904 | 51 28/09 15:23 · 135 28/09 16:25 · 42 29/09 | fx_reb | — (`fixy_en_camino` 28/09 08:02; `fixy_despacho_seguimiento` sale **después**, 29/09 11:01) | **no llegó** (51→135→42 en 19 h; Veltron lo tiene "despachado") |
| 11 | #24084 · fixy · 1132467273 | 139 22/09 (127 12-17/09 fuera de ventana; visita_fallida 11/09) | fx_ret_costo | — | **no llegó** (139 ≠ DEVOLUCI*ENTREGADA) |
| 12 | #26255 · fixy · 1164869379 | 127 23/09 13:56 · 135 23/09 · 39 24/09 | fx_reb | `fixy_visita_fallida` 23/09 14:02 · `fixy_entregado_gracias` 24/09 | **llegó** ×1 (y entregó al día siguiente) |
| 13 | #25595 · urbano · 3856982878 | CA 22/09 · EI 23/09 | ur_reb1+1b | — (ni c3 ni ausente_2; tampoco `urbano_seguimiento_v2`) | **no llegó** |
| 14 | #25252 · urbano · 3491445603 | NT+VN dirección 23/09 · VN+DV 28/09 | ur_reb2 (dirección) | — (último: `urbano_c2_salida` 28/09 09:02) | **no llegó** |
| 15 | #24171 · urbano · 2494684474 | RC 24/09 | ur_ret_costo | `retorno_reenvio_costo_v2` 30/09 12:02 read | **llegó, 6 días tarde** (sale cuando la regla con v2 queda viva el 29-30/09); `_2` @72 h vence el 03/10 |

**Extra, `fx_suc` después de reactivarse** (ninguno de los 15 tenía un 135 posterior al 29/09):

| pedido | evento | plantilla vista | veredicto |
|---|---|---|---|
| #27571 · 1166163734 | 52 30/09 08:49 · 135 30/09 14:52 | `fixy_segundo_contacto` 30/09 15:02 | llegó ×1 |
| #27447 · 1161832084 | 135 30/09 07:57 y 01/10 17:35 | `fixy_segundo_contacto` 30/09 11:02 (una sola vez con dos 135) | llegó ×1 |
| #27234 · 2215706080 | 48 29/09 · 135 30/09 06:12 · 42 30/09 10:25 | — | no llegó (42 regresa el estado antes de la ventana 9-20) |

Notas de la muestra:
- **No hay repeticiones de la misma plantilla** en ningún pedido. El "una vez por pedido y evento" se cumple, incluso con varios CA, VN o 135 en el mismo pedido.
- **No hay cruces entre reglas de REBOTADO_2**: cada pedido recibió como mucho una `urbano_rebote_*`, la del motivo que corresponde.
- El horario `[9,20]` no parece estar en hora argentina (salen plantillas a las 08:02 y 08:04 ART).

## 4. Tabla por regla

| regla | incidencias base 14 d (pedidos) | muestra: con la plantilla esperada / esperables | conclusión |
|---|---|---|---|
| ur_reb1 (`urbano_c3_ausente`) | 693 | 2/3 (#24992 ✓, #26409 ✓, #25595 ✗; #22364 la recibió el 09/09, fuera de ventana) | **llega** (con huecos cuando CA no es el último movimiento) |
| ur_reb1b (`urbano_ausente_2` @48 h) | 693 (mismo evento) | 3/4 salió (#24992, #26409, #22364 failed) · #25595 ✗ | **llega ×2**: sale junto con c3 (1 min a 1 h), no a las 48 h |
| ur_reb2 (`urbano_rebote_direccion`) | 93 | 0/2 (#24774, #25252) | **no llega** (en los 2 casos VN dirección quedó tapado por DV o NT en el mismo día) |
| ur_reb2_noresp | 398 | 2/2 (#24992, #26409) | **llega** ×1 |
| ur_reb2_dinero | 273 | 1/2 (#25815 ✓, #26711 ✗ VN+DV mismo día) | **llega a medias** |
| ur_reb2_rehusa | 323 | 1/2 llegó (#25814); #22364 salió pero `failed` | **llega** ×1 (salió 2/2) |
| REBOTADO_2 sin regla (otros motivos) | 241 | — | **mudo por diseño** |
| ur_suc (`urbano_c5_definicion`) | 446 | 3/3 (#24992, #25815, #25814) | **llega** ×1 |
| ur_ret_costo (`retorno_reenvio_costo_v2`) | 643 | 3/4 (#24774, #25814, #24171 con 6 d de demora · #22407 ✗) | **llega** ×1 (cupo 20/corrida, una por teléfono cada 7 d) |
| ur_ret_costo_2 / ur_ret_transf | — (derivan de ur_ret_costo) | 0 vencidos en la muestra (@72 h vence 03/10; transf solo con `acepto_sin_pago`) | **no medible todavía** |
| RETORNADO DV/RV/RM (ur_ret apagado) | 922 | — | **mudo por diseño** (la oferta espera al RC) |
| fx_reb (`fixy_visita_fallida`) | 96 | 2/3 (#25182 ✓, #26255 ✓, #26796 ✗) | **llega** (falla si 135 o 42 pisan el 51/127 antes del refresh) |
| fx_suc (`fixy_segundo_contacto`) | 138 (45 desde la reactivación) | 0 esperables en los 15 · extra 2/3 | **llega** ×1 (falla si el 42 llega antes de las 9) |
| fx_ret_costo (`retorno_reenvio_costo_v2`) | 0 elegibles (107 retornos 139, ninguno 184) | 0/2 (#25182, #24084) | **no llega**: la condición no matchea el 139 |
| Fixy 48/52/63/125 | 77 | — | **mudo** (sin mapeo) |

**Totales de la muestra:** de 27 pares pedido×regla esperables, 16 llegaron (59%), 2 salieron en `failed` (#22364) y 9 no salieron. De esos 9, 2 son de `fx_ret_costo`, que no puede matchear: sin ellos quedan 16 de 25 (64%). La causa dominante de los que no salieron es que **el evento no fue el último movimiento cuando Veltron refrescó**, no la configuración de los flujos.

## Qué haría con esto (sin ejecutar nada)

1. **No frenar ur_reb2_***: las condiciones funcionan y no duplican. Esto destraba lo de R3 (`pedido_rechazado_motivo` sobre ur_reb2_rehusa).
2. Pedido a Monta: que el disparo mire **todos los movimientos nuevos desde el último refresh**, no solo el último. Eso explica la mayoría de los "no llegó" (VN+DV el mismo día, 51→135→42).
3. `ur_reb1b`: el delay de 48 h no se respeta. O se arregla del lado de Veltron, o conviene apagarlo, porque hoy es un doble mensaje.
4. `fx_ret_costo`: cambiar la condición a algo que matchee el 139 (`*DEVOLUCION DE MERCADERIA*`) o confirmar con Monta qué texto ve Veltron. Hoy no dispara.
5. Alerta por teléfonos con todo en `failed` (#22364).

## Anexo A — `ver_flujos_comms` crudo (02/10/2026)

```json
{
  "flujos": [
    {
      "id": "fx_pago",
      "carrier": "fixy",
      "evento": "PAGO_CONFIRMADO",
      "activo": true,
      "plantilla": "pedido_confirmado_fixy",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$monto"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_desp",
      "carrier": "fixy",
      "evento": "DESPACHADO",
      "activo": true,
      "plantilla": "fixy_despacho_seguimiento",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$tracking_url",
        "$guia"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_camino",
      "carrier": "fixy",
      "evento": "EN_CAMINO",
      "activo": true,
      "plantilla": "fixy_en_camino",
      "params": [
        "cliente_nombre",
        "producto_titulo"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_reb",
      "carrier": "fixy",
      "evento": "REBOTADO_1",
      "activo": true,
      "plantilla": "fixy_visita_fallida",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_ret",
      "carrier": "fixy",
      "evento": "RETORNADO",
      "activo": false,
      "plantilla": "fixy_retornado_deposito",
      "params": [
        "cliente_nombre",
        "producto_titulo"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_ent",
      "carrier": "fixy",
      "evento": "ENTREGADO",
      "activo": true,
      "plantilla": "fixy_entregado_gracias",
      "params": [
        "cliente_nombre",
        "producto_titulo"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_desp",
      "carrier": "urbano",
      "evento": "DESPACHADO",
      "activo": true,
      "plantilla": "urbano_seguimiento_v2",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$tracking_url",
        "$monto"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_camino",
      "carrier": "urbano",
      "evento": "EN_CAMINO",
      "activo": true,
      "plantilla": "urbano_c2_salida",
      "params": [
        "cliente_nombre",
        "$monto"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_reb1",
      "carrier": "urbano",
      "evento": "REBOTADO_1",
      "activo": true,
      "plantilla": "urbano_c3_ausente",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_reb2",
      "carrier": "urbano",
      "evento": "REBOTADO_2",
      "activo": true,
      "plantilla": "urbano_rebote_direccion",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_suc",
      "carrier": "urbano",
      "evento": "EN_SUCURSAL",
      "activo": true,
      "plantilla": "urbano_c5_definicion",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_ret",
      "carrier": "urbano",
      "evento": "RETORNADO",
      "activo": false,
      "plantilla": "urbano_retornado_deposito",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "co_pago",
      "carrier": "andreani",
      "evento": "PAGO_CONFIRMADO",
      "activo": true,
      "plantilla": "order_confirmation_brand_new",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$monto"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "co_desp",
      "carrier": "andreani",
      "evento": "DESPACHADO",
      "activo": true,
      "plantilla": "mp_despacho_seguimiento",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$guia",
        "$link_correo"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "co_corr",
      "carrier": "andreani",
      "evento": "CORRECCION_SEGUIMIENTO",
      "activo": true,
      "plantilla": "correo_correccion_seguimiento",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$guia_vieja",
        "$guia",
        "$link_correo"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_pago",
      "carrier": "urbano",
      "evento": "PAGO_CONFIRMADO",
      "activo": true,
      "plantilla": "urbano_c1_aviso",
      "params": [
        "cliente_nombre",
        "$order",
        "3",
        "10",
        "$monto"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_reb1b",
      "carrier": "urbano",
      "evento": "REBOTADO_1",
      "activo": true,
      "plantilla": "urbano_ausente_2",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 48
    },
    {
      "id": "fx_suc",
      "carrier": "fixy",
      "evento": "EN_SUCURSAL",
      "activo": true,
      "plantilla": "fixy_segundo_contacto",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_ret_costo",
      "carrier": "urbano",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_costo_v2",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "fx_ret_costo",
      "carrier": "fixy",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_costo_v2",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_ret_costo_2",
      "carrier": "urbano",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_recordatorio",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio"
      ],
      "recordatorio_de": "ur_ret_costo",
      "delay_horas": 72
    },
    {
      "id": "fx_ret_costo_2",
      "carrier": "fixy",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_recordatorio",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio"
      ],
      "recordatorio_de": "fx_ret_costo",
      "delay_horas": 72
    },
    {
      "id": "ur_reb2_noresp",
      "carrier": "urbano",
      "evento": "REBOTADO_2",
      "activo": true,
      "plantilla": "urbano_rebote_no_responde",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_reb2_dinero",
      "carrier": "urbano",
      "evento": "REBOTADO_2",
      "activo": true,
      "plantilla": "urbano_rebote_sin_pago",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_reb2_rehusa",
      "carrier": "urbano",
      "evento": "REBOTADO_2",
      "activo": true,
      "plantilla": "urbano_rebote_rechazado",
      "params": [
        "cliente_nombre",
        "$order"
      ],
      "recordatorio_de": "",
      "delay_horas": 0
    },
    {
      "id": "ur_ret_transf",
      "carrier": "urbano",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_transferencia",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio",
        "$datos_transferencia"
      ],
      "recordatorio_de": "ur_ret_costo",
      "delay_horas": 48
    },
    {
      "id": "fx_ret_transf",
      "carrier": "fixy",
      "evento": "RETORNADO",
      "activo": true,
      "plantilla": "retorno_reenvio_transferencia",
      "params": [
        "cliente_nombre",
        "producto_titulo",
        "$costo_reenvio",
        "$datos_transferencia"
      ],
      "recordatorio_de": "fx_ret_costo",
      "delay_horas": 48
    }
  ],
  "eventos": [
    {
      "key": "PAGO_CONFIRMADO",
      "label": "Pago confirmado",
      "trigger": "El pedido se confirma / se paga"
    },
    {
      "key": "DESPACHADO",
      "label": "Despachado",
      "trigger": "Se generó la guía / etiqueta"
    },
    {
      "key": "EN_CAMINO",
      "label": "En camino",
      "trigger": "El carrier lo tomó / salió a reparto"
    },
    {
      "key": "REBOTADO_1",
      "label": "Rebotado · 1ª visita",
      "trigger": "No estaba el cliente (1er intento)"
    },
    {
      "key": "REBOTADO_2",
      "label": "Rebotado · 2ª visita",
      "trigger": "No se entregó tras el reintento"
    },
    {
      "key": "EN_SUCURSAL",
      "label": "En sucursal",
      "trigger": "Quedó en sucursal para coordinar"
    },
    {
      "key": "RETORNADO",
      "label": "Retornado al depósito",
      "trigger": "Volvió al depósito"
    },
    {
      "key": "ENTREGADO",
      "label": "Entregado",
      "trigger": "Entrega confirmada"
    },
    {
      "key": "CORRECCION_SEGUIMIENTO",
      "label": "Corrección de seguimiento",
      "trigger": "El carrier reemitió el código y al cliente ya se le había avisado el viejo"
    }
  ],
  "carriers": [
    "fixy",
    "urbano",
    "andreani",
    "*"
  ],
  "variables": "Variables que se autocompletan por pedido (una por {{n}}, en orden): cliente_nombre, producto_titulo, shopify_order_number, $order (número de orden), $monto (total), $guia (código de seguimiento), $tracking_url, $costo_reenvio (envío del reenvío de un retornado), $link_pago, $guia_vieja y $link_correo (sólo para la corrección de seguimiento de Correo).",
  "nota": "Cada regla manda UNA vez por pedido y evento. Para cambiar el texto de un aviso: crear_plantilla con nombre nuevo y después asignar_plantilla_flujo."
}
```

## Anexo B — `listar_plantillas` crudo (02/10/2026)

```json
{
  "plantillas": [
    {
      "name": "urbano_rebote_direccion",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, Urbano no logró ubicar tu domicilio para entregar el pedido #{{2}}. ¿Me confirmás calle, número, piso o depto y alguna referencia? Con eso lo reprogramamos."
    },
    {
      "name": "fixy_segundo_contacto",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, tu pedido {{2}} sigue guardado en Fixy para volver a pasar 📦 Respondé este mensaje con el día y la franja que te quedan mejor, y si cambió algo de la dirección o el teléfono contanos acá. El equipo lo coordina con Fixy y te confirma."
    },
    {
      "name": "fixy_despacho_seguimiento",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 🚚 Tu pedido de {{2}} ya fue despachado con Fixy.\nSeguí el recorrido de tu envío acá: {{3}} . Tu código de seguimiento es {{4}}. El repartidor te llama antes de pasar (entre las 10 y las 20hs) y en la puerta pagás con QR de Mercado Pago o en efectivo, como prefieras. ¡Gracias por tu compra!"
    },
    {
      "name": "order_confirmation_andreani",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 👋\nTe recordamos que tu pedido de {{2}} está reservado 🙌\nEstos son los datos para la transferencia: \n- Alias: biolabs.arg\n- CBU:  0000003100059260877538\n- Nombre de cuenta: Khalil Paulo Burgos Andreu\n \nCuando realices la transferencia te pedimos que nos pases el comprobante por favor. Apenas lo recibamos  lo despachamos con código de seguimiento por WhatsApp. \n¡Gracias por tu compra!"
    },
    {
      "name": "urbano_rebote_rechazado",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, Urbano nos informa que el pedido #{{2}} fue rechazado en la entrega. Si fue un error o querés que lo volvamos a intentar, respondé este mensaje. Si no, no te vamos a insistir."
    },
    {
      "name": "fixy_en_sucursal",
      "language": "es_AR",
      "status": "REJECTED",
      "category": "UTILITY",
      "body": "Hola {{1}}! El repartidor de Fixy no pudo entregar tu pedido {{2}} y quedo guardado en la sucursal de Fixy de tu zona. Podes retirarlo presentando tu DNI, o si preferis que te lo lleven de nuevo responde este mensaje y coordinamos la entrega."
    },
    {
      "name": "delivery_reminder_fixy_v2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 👋 Tu pedido {{2}} (Guía: {{3}}) te llega hoy!\n\n🚚 *Información de entrega:*\n- Logística: Fixy.\n- Horario: Entre las 10:00 y las 20:00 hs.\n- Aviso: El repartidor se comunicará por teléfono antes de llegar al domicilio.\n\n💵 *Información de pago:*\n- Se abona al recibir el producto.\n- Podés pagar con QR de Mercado Pago (cualquier billetera o tarjeta en 1 pago) o en efectivo, como prefieras.\n\nGracias 😊"
    },
    {
      "name": "mp_despacho_seguimiento",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 📦 Tu pedido de {{2}} ya fue despachado por Correo Argentino y está en camino.\nTu código de seguimiento es {{3}}. Podés seguirlo acá: {{4}} ingresando ese código.\nCualquier duda escribinos por acá. ¡Gracias por tu compra!"
    },
    {
      "name": "urbano_c1_aviso",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}!👋 Te confirmo que tu pedido {{2}} ya quedó registrado y lo despacharemos con Urbano. \nVa a llegarte en aproximadamente {{3}} a {{4}} días *hábiles*. \n🚛 Cuando salga a reparto te escribo de nuevo así lo tenés a mano. El pago es al recibir: escaneás un *QR de Mercado Pago* desde tu celular y abonás ${{5}}. \n¡Gracias por tu compra!✨"
    },
    {
      "name": "urbano_retornado_deposito",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Tu pedido {{2}} volvió al depósito de Urbano porque no se pudo entregar. Escribinos por acá así coordinamos un nuevo envío y no perdés tu compra. Estamos para ayudarte."
    },
    {
      "name": "fixy_visita_fallida",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}} 👋\nPasamos hoy con tu pedido {{2}} pero no pudimos entregarlo.\n\n🚚 Con Fixy el repartidor te llama antes de llegar, entre las 10 y las 20 hs. Contame *qué día te viene bien* y volvemos a pasar.\n\n💸 Podés abonar con QR de Mercado Pago o en efectivo, como prefieras."
    },
    {
      "name": "urbano_c3_ausente",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, tu pedido {{2}} ya casi esta! \nEl repartidor de Urbano pasó por tu domicilio, pero no había nadie para recibirlo 😞\n*¿Qué día y en qué horario te viene bien que vuelva a pasar?* Si te queda más cómodo, también podés retirarlo en la sucursal. \n\n💸 Recordá que el pago es al recibirlo, con QR de Mercado Pago."
    },
    {
      "name": "urbano_seguimiento_v2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 📦 Tu pedido de {{2}} ya fue despachado con Urbano. Podés seguir tu envío acá: {{3}} . El pago es al recibirlo: escaneás un QR de Mercado Pago desde tu celular y abonás {{4}}. Cualquier duda escribinos por acá. ¡Gracias por tu compra!"
    },
    {
      "name": "fixy_retiro_sucursal",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, te contactamos por tu pedido {{2}}. El repartidor no te encontro y el paquete quedo reservado en la sucursal de Fixy de tu zona. Tenes unos dias para retirarlo presentando tu DNI. Si preferis recibirlo en tu domicilio, responde este mensaje y coordinamos una nueva visita."
    },
    {
      "name": "correo_confirmar_cp",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, Correo Argentino no reconoce el código postal de tu pedido #{{2}}. ¿Me confirmás tu código postal y tu localidad? Con eso lo despachamos."
    },
    {
      "name": "correo_correccion_seguimiento",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Te escribimos de BioLabs 💜\n\nTuvimos un error en el código de seguimiento que te enviamos de tu pedido ({{2}}) y queremos corregirlo. El código anterior ({{3}}) no era el correcto.\n\n✅ Tu código de seguimiento correcto es: {{4}}\n\nPodés hacer el seguimiento de tu envío desde acá: {{5}}\n\n¡Perdón por la confusión! Cualquier duda, escribinos por este mismo chat 🙌"
    },
    {
      "name": "urbano_rebote_sin_pago",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, Urbano intentó entregar tu pedido #{{2}} pero no se pudo cobrar. Van a volver a pasar: decinos qué día te conviene y tené a mano el celular para pagar con el QR de Mercado Pago en la puerta."
    },
    {
      "name": "urbano_rebote_no_responde",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, Urbano pasó a entregar tu pedido #{{2}} y no encontró a nadie. Van a volver a pasar. ¿Qué día y en qué horario te conviene? Respondé este mensaje y lo coordinamos."
    },
    {
      "name": "fixy_entregado_gracias",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 🎉 Tu pedido de {{2}} fue entregado. ¡Gracias por elegir BioLabs! Si tenés cualquier duda sobre cómo usarlo, escribinos por acá y te ayudamos."
    },
    {
      "name": "retorno_reenvio_costo",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Tu pedido de {{2}} volvió a nuestro depósito porque el correo no pudo entregarlo. ¿Querés que te lo reenviemos? El reenvío tiene un costo de envío de {{3}} que se suma al total de tu compra. Respondé este mensaje y lo coordinamos enseguida."
    },
    {
      "name": "correo_dato_faltante",
      "language": "es_AR",
      "status": "REJECTED",
      "category": "UTILITY",
      "body": "Hola {{1}}, tu pedido #{{2}} ya está listo para salir por Correo Argentino 📦 Para poder despacharlo necesitamos que nos confirmes {{3}}. Respondé este mensaje y lo despachamos enseguida 🙏"
    },
    {
      "name": "urbano_despacho_anulado",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, te aviso algo de tu pedido {{2}} 🙏\nHubo un problema con el despacho y la guía quedó anulada, así que todavía no salió a tu domicilio.\n\n✅ Ya lo estamos reprogramando y te escribo por acá apenas tenga el nuevo código de seguimiento.\n\nPerdón por la demora. Cualquier duda, respondeme este mensaje."
    },
    {
      "name": "saludo_generico",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "MARKETING",
      "body": "Hola {{1}}, ¿cómo estás?"
    },
    {
      "name": "urbano_sin_efectivo",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}} 👋\nEl repartidor pasó con tu pedido {{2}} pero no se pudo completar el pago.\n\n💳 Con Urbano el cobro es *solo por QR de Mercado Pago*: escaneás desde el celular y pagás con saldo, débito o crédito. No hace falta tener efectivo.\n\nSi querés que volvamos a pasar, contestame por acá y lo coordinamos. 😊"
    },
    {
      "name": "urbano_c4_confirmar",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Cómo estás {{1}}? \n😣 No pudimos entregar tu pedido {{2}}, pero estamos a tiempo de reintentarlo.\nNecesitamos que repasemos tu dirección completa para ver si hubo un error:\ncalle, número, piso o departamento + alguna referencia.\n\n😌 Con esos datos reprogramamos la entrega enseguida. \n\n💸El pago sigue siendo al recibirlo, con QR de Mercado Pago."
    },
    {
      "name": "retorno_reenvio_recordatorio",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "MARKETING",
      "body": "¡Hola {{1}}! Te escribimos hace unos días porque tu pedido de {{2}} volvió a nuestro depósito. Todavía podemos reenviártelo: el costo de envío es de {{3}} y se abona antes por transferencia. ¿Querés que lo coordinemos? Respondé este mensaje y lo vemos enseguida."
    },
    {
      "name": "urbano_ausente_2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, ¿seguís queriendo tu pedido {{2}}? 😊\nTe escribí hace un par de días porque no pudimos entregarlo y todavía no logramos coordinar.\n\n⏳ Si no lo reprogramamos, el paquete vuelve a nuestro depósito y la compra se cancela.\n\nDecime qué día te viene bien y lo resolvemos en un minuto."
    },
    {
      "name": "payment_confirmed",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Gracias {{1}} 🙌 \n✅ *Confirmamos tu pago* del pedido de {{2}}. \n📦 Ahora lo preparamos para despacharlo y te enviamos el código de seguimiento por WhatsApp cuando salga. \nGracias por elegirnos 🤗"
    },
    {
      "name": "order_confirmation_brand_new",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}!  Confirmamos tu pedido de {{2}} con envío gratis por Correo Argentino.\nPara completarlo, transferí ${{3}} (ya con 5% OFF por pago anticipado) y mándanos el comprobante por acá.\n  \n📌 Datos para transferir:\n- CBU 0000003100059260877538\n- Alias biolabs.arg\n-Titular Khalil Paulo Burgos Andreu\n\n  Apenas recibamos el comprobante, despachamos tu pedido. ¡Gracias por\n  elegir BioLabs!"
    },
    {
      "name": "fixy_en_camino",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 🚚 Tu pedido de {{2}} ya salió a tu domicilio con Fixy. El repartidor te llama antes de pasar, entre las 10 y las 20 hs. Tené listo el pago para cuando llegue: podés abonar con QR de Mercado Pago o en efectivo."
    },
    {
      "name": "payment_link_reminder_1",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 👋\nTe recordamos que *tu pedido está reservado*. \n✅ Para confirmarlo solo falta el pago en 3 cuotas sin interés desde acá:\n {{2}} \n\n⭐ Cualquier duda escribinos por acá, estamos para ayudarte 😌"
    },
    {
      "name": "payment_link_reminder_2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "MARKETING",
      "body": "¡Hola {{1}}! \n*Última oportunidad* para no perder tu pedido: \nConfirmalo abonando en 3 cuotas sin interés acá:\n {{2}}  💳\n\nSi ya pagaste, ignorá este mensaje. ¡Gracias! 🤗"
    },
    {
      "name": "retorno_reenvio_costo_v2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Tu pedido de {{2}} volvió a nuestro depósito porque el correo no pudo entregarlo. ¿Querés que te lo reenviemos? El envío del reenvío cuesta {{3}} y se abona antes por transferencia. Respondé este mensaje y lo coordinamos enseguida."
    },
    {
      "name": "order_confirmation_cuotas",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}} 😊\n Recibimos correctamente tu pedido de {{2}} por ${{3}}.\nEn un momento te llega el link de Mercado Pago para *abonar en 3 cuotas sin interés*. \n\n✅ Apenas se acredite, lo despachamos y te enviamos el correspondiente código de seguimiento por acá.\nGracias!"
    },
    {
      "name": "urbano_no_responde",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, ¿cómo estás? 📞\nPasamos con tu pedido {{2}} pero no pudimos comunicarnos con vos. El repartidor llama desde un número que no tenés agendado, así que puede que se te haya pasado.\n\n🕐 Contame *qué día te viene bien* que vuelva a pasar y lo reprogramamos. Si preferís, también podés retirarlo en la sucursal.\n\n💸 Recordá que el pago es al recibirlo: escaneás un QR de Mercado Pago desde tu celular."
    },
    {
      "name": "correo_confirmar_direccion",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "Hola {{1}}, para despachar tu pedido #{{2}} por Correo Argentino nos falta completar tu dirección. ¿Me confirmás calle, número, localidad y provincia? Con eso lo despachamos."
    },
    {
      "name": "retorno_reenvio_transferencia",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Nos dijiste que sí al reenvío de tu pedido de {{2}}. Para volver a despacharlo sólo falta la transferencia del costo de envío de {{3}} al alias {{4}}. Cuando la hagas, mandanos el comprobante por acá y sale ese mismo día. Si tenés alguna duda, respondé este mensaje."
    },
    {
      "name": "mp_despacho_seguimiento_v2",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 📦 Tu pedido de {{2}} ya fue despachado por Correo Argentino y está en camino. Tu código de seguimiento es {{3}}. Podés seguirlo acá: {{4}} ingresando ese código. Si el Correo no logra entregarlo, queda en la sucursal más cercana por 5 días hábiles para que lo retires. Cualquier duda escribinos por acá. ¡Gracias por tu compra!"
    },
    {
      "name": "pedido_confirmado_fixy",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Excelente {{1}}! \nTu pedido de {{2}} quedó confirmado ✅ y lo estamos preparando para despacharlo con Fixy. \nLlega a tu domicilio y abonás ${{3}} al recibirlo: podés pagar con QR de Mercado Pago (cualquier billetera o tarjeta en 1 pago) o en efectivo, lo que te quede más cómodo. En breve te paso el código de seguimiento.\nGracias por confiar en nosotros🤗"
    },
    {
      "name": "urbano_c5_definicion",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡{{1}}! Ya casi tenés tu pedido 🥳\n📝 La orden {{2}} quedó esperando en la sucursal de Urbano para coordinar la entrega, pero no por mucho.\n🙏 Contame por favor *qué día y horario* te viene bien y lo reprogramamos, o si preferís pasás a retirarlo vos. \n\n💸 Recordá que el pago es al recibirlo, con QR de Mercado Pago."
    },
    {
      "name": "payment_link_cuotas",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "MARKETING",
      "body": "Como estás {{1}}?\nTe dejo el link para abonar tu pedido de {{2}} en 3 cuotas *sin interés* de {{3}} cada una: \n\n{{4}}\n\n✅ Cuando termines el pago lo despachamos y te paso el seguimiento. \n¡Gracias!"
    },
    {
      "name": "delivery_reminder_fixy",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 👋 Tu pedido {{2}} (Guía: {{3}}) te llega hoy!\n\n🚚 *Información de entrega:*\n- Logística: Fixy.\n- Horario: Entre las 10:00 y las 20:00 hs.\n- Aviso: El repartidor se comunicará por teléfono antes de llegar al domicilio.\n\n💵 *Información de pago:*\n- Método: Efectivo.\n- Condición: Se abona al recibir el producto (recorda tener el dinero a mano).\n\nGracias 😊"
    },
    {
      "name": "urbano_c2_salida",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "El pedido casi es tuyo 🙌\n {{1}}, el repartidor pasa hoy por tu domicilio de 10 a 20hs, Tratá de que haya alguien en el domicilio para recibirlo.\n⏱️ El horario exacto de  entrega no puede coordinarse, pero aseguramos su visita.\n\n💸 Recorda que el pago es al momento de la entrega: escaneás un QR de Mercado Pago desde tu celular y abonás ${{2}}. \n\nQue lo disfrutes 😄"
    },
    {
      "name": "order_followup",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! 👋\nTe escribimos para dar seguimiento a tu pedido de {{2}}.\nSi te quedó alguna duda o querés cambiar algo, escribime por acá y lo vemos. \nQuedamos a disposición. 😊"
    },
    {
      "name": "fixy_retornado_deposito",
      "language": "es_AR",
      "status": "APPROVED",
      "category": "UTILITY",
      "body": "¡Hola {{1}}! Tu pedido de {{2}} volvió a nuestro depósito porque no se pudo entregar. Escribinos por acá así coordinamos un nuevo envío y no perdés tu compra. Estamos para ayudarte."
    }
  ]
}
```

## Anexo C — query de la muestra (d)

```sql
set default_transaction_read_only = on;
with ev as (
  select s.courier, s.tracking, s.order_id, e.status_raw, e.occurred_at,
         lower(coalesce(e.raw->>'descripcion',
               case when e.raw->>'estado_actual' like e.status_raw||' -%' then e.raw->>'estado_actual' end, '')) motivo
  from shipment_events e join shipments s on s.id = e.shipment_id
  where e.occurred_at >= now() - interval '14 days'
    and ((s.courier='urbano' and e.status_raw in ('CA','VN','BA','NT','ST','SP','DV','RV','RM','RC'))
      or (s.courier='fixy' and e.status_raw in ('127','51','135','139','48','52','63','125')))
), m as (
  select *, case
    when courier='urbano' and status_raw='CA' then 'ur_reb1 (+ur_reb1b @48h)'
    when courier='urbano' and status_raw in ('VN','BA','NT','ST') then case
         when motivo like '%direcci%' then 'ur_reb2 (direccion)'
         when motivo like '%respond%' then 'ur_reb2_noresp'
         when motivo like '%dinero%'  then 'ur_reb2_dinero'
         when motivo like '%ehusa%'   then 'ur_reb2_rehusa'
         else 'REBOTADO_2 sin regla (otro motivo)' end
    when courier='urbano' and status_raw='SP' then 'ur_suc'
    when courier='urbano' and status_raw='RC' then 'ur_ret_costo (+transf @48h, recordatorio @72h)'
    when courier='urbano' then 'RETORNADO DV/RV/RM sin regla (ur_ret apagado)'
    when status_raw in ('127','51') then 'fx_reb'
    when status_raw='135' then 'fx_suc'
    when status_raw='139' then 'fx_ret_costo (cond DEVOLUCI*ENTREGADA)'
    else 'Fixy 48/52/63/125 sin regla' end regla
  from ev
), pick as (
  select distinct on (regla, order_id) regla, order_id, courier, tracking, occurred_at, status_raw, motivo from m
  where occurred_at between now()-interval '10 days' and now()-interval '3 days'
  order by regla, order_id, occurred_at
), r as (
  select p.*, o.order_number, o.phone, row_number() over (partition by regla order by md5(p.order_id::text||'0210')) rn
  from pick p join orders o on o.id=p.order_id where o.phone is not null
)
select r.regla, r.order_number, r.phone, r.courier, r.tracking, to_char(r.occurred_at at time zone 'America/Argentina/Buenos_Aires','DD/MM HH24:MI') ev_at, r.status_raw, left(r.motivo,50) motivo,
 (select string_agg(e2.status_raw||'@'||to_char(e2.occurred_at at time zone 'America/Argentina/Buenos_Aires','DD/MM HH24:MI'), ' ' order by e2.occurred_at) from shipment_events e2 join shipments s2 on s2.id=e2.shipment_id where s2.tracking=r.tracking and e2.occurred_at >= now()-interval '20 days') hist
from r where rn <= case when regla like 'ur_reb1%' or regla like 'ur_reb2_noresp' or regla like 'ur_reb2_dinero' or regla like 'ur_reb2_rehusa' or regla='fx_reb' then 2 when regla like '%sin regla%' then 0 else 1 end
order by courier desc, regla;
```

Conversaciones crudas (JSON por teléfono) en el scratchpad de la sesión: `/private/tmp/claude-501/-Users-franciscoandreudegasperi-Library-Application-Support-Claude-scratch-workspaces-544bef84-8106-45e9-a3ab-17c719a50e0d-4649f7b7-84aa-4b3a-8228-a9283a0c22c8-scratch-2026-10-02-893740/2c2a85ea-2bbb-4ccd-836e-d1eb996efbc6/scratchpad/conv/`.
