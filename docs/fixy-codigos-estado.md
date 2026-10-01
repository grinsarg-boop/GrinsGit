# Fixy: diccionario de estados (A13-R1-T1), 01/10/2026

## 1. Qué hay en los 3 docs

| Doc | Qué es | ¿Tiene diccionario de códigos? |
|---|---|---|
| 1. `1xHk2x…` "Manual motomensajería Rol Cliente" | Manual de UI de motomensajería: cambiar contraseña, cargar, listar y ver viajes | **No.** No menciona estados. |
| 2. `fixy.epresis.com/docs` "API Reference" (Documentarian, APIs V1+V2) | Referencia de la API | **No.** Solo trae ejemplos sueltos (ver abajo). |
| 3. `1MmzgX…` "Manual Epresis rol cliente" | Manual de UI: carga, búsqueda y cambio de estado de guías, confirmar, importar CSV, retiros, usuarios, trackers | **No.** En "Cambio de estado" explica la pantalla (fecha, hora, estado, distribuidor, sucursal, fecha de repactación), pero no lista los estados. |

Los únicos estados que aparecen en los docs son ejemplos de la API (doc 2):
- `v2/seguimiento.json`, response de ejemplo: `PICKING`, `PROGRAMACION`, `TRANSITO A SUCURSAL` (solo el texto `estado`, sin código). Ninguno apareció nunca en las guías de BioLabs.
- `v2/integracion.json` (webhook), payload de ejemplo: `"estado": "Entregada", "codigo_estado": "ENT"`. Es un código **alfanumérico**, distinto del numérico que devuelve `seguimiento.json` en prod (39 = ENTREGADA). Puede haber un tercer espacio de códigos (numérico de la API, prefijos del XLSX como `POD-`, alfa del webhook). Los docs no lo aclaran.

**Conclusión: el diccionario no está en estos docs.**

## 2. El diccionario real (empírico, sacado de prod)

Como los docs no lo traen, lo armé con la base: `shipment_events` de Fixy, con `status_raw` numérico (= `codigo_estado` de `seguimiento.json`) y su `raw.estado` (texto que manda Fixy). Fue una consulta de solo lectura del 01/10/2026 que cubre 05/05 → 01/10/2026, con **31 códigos distintos**. "Canon repo" es lo que mapea hoy `courier_status_map`.

| Código | Texto Fixy | Eventos | Canon repo | Categoría |
|---|---|---|---|---|
| 41 | SOLICITUD PENDIENTE DE RETIRO (detalles "INGRESO POR API") | 2735 | despachado | Alta de guía (todavía no la retiraron) |
| 42 | Esperando Programación | 949 | en_transito | En circuito |
| 129 | EN DEPOSITO LISTO PARA DESPACHO | 2673 | en_transito | **En depósito/sucursal** (por salir) |
| 202 | LISTO EN DEPOSITO SAME DAY | 49 (desde 08/09) | **SIN MAPEAR** | **En depósito/sucursal** (por salir) |
| 70 | Ruteado para su entrega | 3897 | en_reparto | En reparto |
| 134 | En Recorrido ("DESPACHADO A SUCURSAL") | 3353 | en_transito | En circuito |
| 142 | CONFIRMACION EXTERNA | 494 | en_transito | En circuito |
| 117 | REPACTADO LISTO PARA DESPACHO | 152 | en_transito | Reprogramación cargada |
| 183 | Envio Reprogramado | 152 | en_transito | Reprogramación cargada |
| 144 | Gestionado Operativa (detalles: UBICADO/BUSCAR/ULTIMA/CANCELA/3SALIDAS) | 111 | incidencia | Gestión de Fixy |
| **39** | **ENTREGADA** | 2776 | entregado | **ENTREGADO** |
| 140 | ENTREGADA CON DEVOLUCION | 2 | **SIN MAPEAR** | Ambiguo (ver nota) |
| **127** | VISITA SIN CONTACTO ALGUNO | 6840 | en_transito | **VISITA FALLIDA**: ausente / no atiende |
| **51** | DESTINATARIO RECHAZA EL ENVIO | 5457 | rehusado | **RECHAZADO** (también es visita fallida) |
| **52** | Reprogramado por el comprador | 5507 | en_transito | **VISITA FALLIDA**: el cliente pide otro día |
| **48** | DIRECCION INCORRECTA O INCOMPLETA | 4126 | incidencia | **VISITA FALLIDA**: dirección |
| **63** | ZONA PELIGROSA O DE MUY DIFICIL ACCESO | 956 | incidencia | **VISITA FALLIDA**: zona |
| **145** | DIRECCION NO GEOLOCALIZADA | 45 | incidencia | **VISITA FALLIDA**: dirección |
| **125** | Sin dinero | 44 | incidencia | **VISITA FALLIDA**: COD, no tenía la plata |
| **121** | Zona No Atendida | 5 | incidencia | **VISITA FALLIDA / no cubre** |
| 64 | FALLA MECANICA | 106 | incidencia | Intento fallido por culpa del courier |
| 126 | Reprogramado por mal clima | 19 | en_transito | Intento fallido por clima |
| 116 | NO RETIRADO | 13 | incidencia | Problema de retiro (no lo retiraron en origen o en depósito) |
| **135** | REINGRESO A DEPOSITO | 1783 | en_sucursal | **EN SUCURSAL/DEPÓSITO** (volvió, se puede rescatar) |
| **182** | RETIRA POR DEPOSITO | 3 | en_sucursal | **EN SUCURSAL**: espera que la retire el cliente |
| **139** | COBRO DE SERVICIO Y DEVOLUCION DE MERCADERIA A LA EMPRESA | 1437 | devuelto | **DEVUELTO**. El motivo va en `detalles`: PLAZO DE REPROGRAMACION VENCIDO (729), RENDICION AL CLIENTE (547), A PEDIDO DE LA EMPRESA / CANCELADO (≈42), EXCESO DE SALIDAS / 3SALIDAS / DOS SALIDAS RECHAZADAS (≈39), PLAZO DE RETIRO VENCIDO |
| **104** | DEVOLUCION DE MERCADERIA A LA EMPRESA sin cobrar servicio | 2 | devuelto | **DEVUELTO** (sin cargo) |
| **184** | DEVOLUCIÓN ENTREGADA ("RENDICION RECEPCIONADA") | 526 | devuelto | **DEVUELTO**: llegó a BioLabs |
| 123 | ANULADO | 5 | cancelado | Cancelado |
| 79 | Envío robado | 7 | siniestro | Siniestro |
| 82 | Paquete dañado o incompleto | 3 | incidencia | Siniestro parcial |

**No admitido:** ningún código de Fixy significa "no admitido". El equivalente operativo es una guía que se queda en `41` sin pasar nunca a `129/70/134`, porque la dieron de alta por API y Fixy no la retiró. Si Fixy tiene un código propio para esto, nunca apareció en 5 meses.

Nota sobre el 140 "ENTREGADA CON DEVOLUCION": hay solo 2 casos en prod (1771957 y 1837831) y en los dos el 140 aparece **en el medio** del recorrido, seguido de 135/127, y después la guía terminó en 139 (devuelta) y en 39 (entregada). En la práctica no es terminal: parece mal cargado o pensado para "entrega con retiro de cambio". Habría que mapearlo como no terminal, por ejemplo `en_transito` o `incidencia`, nunca `entregado`.

## 3. Endpoints de epresis para estados e historial (doc 2)

| Endpoint | Para qué | Notas |
|---|---|---|
| `POST api/v2/seguimiento.json` `{api_token, remito?, nro_guia?}` | Movimientos de una guía, por remito del cliente o nro de guía | **Es el que usa el repo** (`lib/couriers/fixy.ts`, por remito = order_number). En prod devuelve `fechas[]` DESC con `guia, estado, codigo_estado (numérico), fecha, hora, detalles`. El doc no menciona `codigo_estado` ni `detalles`. |
| `GET/POST api/v1/public/tracking.json` `{api_token, tracking}` | Seguimiento logística v1 | El ejemplo del doc devuelve 500. No aporta nada sobre v2. |
| `POST api/v1/public/tracking-mensajeria.json` | Seguimiento de motomensajería | No aplica. |
| `POST api/v2/integracion.json` `{api_token, url, notificacion, token?, usuario?, sucursal?}` | **Webhook**: Fixy hace POST a nuestra URL en cada cambio de estado (`usuario, token, estado, codigo_estado, remito, guia`), y hay que responder 200 | Reemplazaría el polling. No está implementado en el repo. Ojo: el ejemplo usa `codigo_estado` alfa ("ENT"), así que antes de usarlo hay que confirmar con Fixy qué espacio de códigos manda. **Registrarlo escribe config en Fixy, así que necesita el OK de Pancho.** |
| Tracker público `https://<logistica>.epresis.com/seguimiento/consultar/{guia\|remito}` y `/seguimiento_cliente/{token}` (doc 3) | Tracking web | Sirve para un link al cliente. No da códigos. |

## 4. Contraste con el repo

Dónde vive el mapeo: tabla `courier_status_map` (migraciones `supabase/migrations/004, 008, 014, 040, 052, 073, 098`), `lib/couriers/fixy.ts` (status_raw = codigo_estado), y listas sueltas en `scripts/fixy-gestion-diaria.mjs` (FALLAS / VISITA / TERMINAL / GESTION_FIXY) y `scripts/tiempos-entrega-cp.mjs` (primera visita).

**Del diccionario, sin mapear en el repo:**
- `202` LISTO EN DEPOSITO SAME DAY: 49 guías desde el 08/09/2026 (34 terminaron entregadas, 6 devueltas, 9 siguen vivas). Hoy no hay ninguna shipment con estado actual 202, así que el P&L no se ve afectado, pero cae al default `incidencia`. Propuesta: `en_transito`, igual que el 129.
- `140` ENTREGADA CON DEVOLUCION: 2 eventos, sin mapear. Propuesta: no terminal (ver nota).
- `v_estados_sin_mapear` no los muestra, se ve que mira solo el estado actual. Por eso se colaron sin aviso.

**En el repo, pero no en el diccionario numérico:**
- Prefijos del XLSX (`POD-, CSYDV-, EPR-, CANC-, RAD-, ROBO-, ANULADO-, REPRO-, 9WVR-`, migración 004): son de otro espacio (el export XLSX). Son válidos para el import manual y no hay que tocarlos.
- Keywords genéricas del seed 001 (`Ausente, Devuelto, En reparto, Entregado, Rechazado, Rehusado, Reprogramado`) en el courier fixy: nunca matchean un código numérico, son filas muertas e inofensivas. `Reprogramado=incidencia` contradice al 52/183 (`en_transito`), pero no se dispara.
- `scripts/fixy-gestion-diaria.mjs` pone `140` en **TERMINAL** ("entregada/devuelta"). La evidencia dice lo contrario: en los 2 casos la guía siguió viva después del 140. Es un bug menor, porque el script podría dejar de seguir una guía que todavía está en juego.
- Inconsistencia chica entre scripts: `tiempos-entrega-cp.mjs` toma como "primera visita" a `39,127,51,48,52,63,125`, y `fixy-gestion-diaria.mjs` además cuenta `145,121,64` como intento. Ninguno de los dos cuenta el `126` (mal clima).

**Bien mapeados:** los otros 29 códigos numéricos observados coinciden con su texto Fixy.

## 5. Veredicto

**Los docs no traen el diccionario.** Son manuales de pantalla más una referencia de API con ejemplos. Con solo esto, A13-R1-T1 no se puede cerrar diciendo "lo sacamos de la documentación".

Eso sí, el objetivo práctico (saber qué significa cada código que nos llega) está **cubierto al 100% de lo observado** con el diccionario empírico de arriba: 31 códigos en 5 meses y ~50K eventos, 29 mapeados y 2 por mapear (202, 140). Recomendación:
1. Cerrar A13-R1-T1 adoptando la tabla de la sección 2 como diccionario operativo.
2. Mapear 202 y 140 en una migración chica, y sacar el 140 de TERMINAL en `fixy-gestion-diaria.mjs`.
3. Si se quiere el catálogo maestro (códigos que todavía no vimos: "no admitido", extravío, etc., y qué manda el webhook), mandar este pedido opcional de 4 líneas:

> Hola, ¿nos pueden pasar el listado completo de estados de guía de epresis (codigo_estado numérico + descripción) que puede devolver api/v2/seguimiento.json?
> Necesitamos saber cuáles son terminales (entregada / devuelta / anulada) y cuáles son visita fallida.
> También: el webhook api/v2/integracion.json, ¿manda el mismo codigo_estado numérico o el alfanumérico (ej. "ENT")?
> Y si existe un estado para "no admitido / no retirado en origen" distinto del 41 y del 116. Gracias.

## Catálogo oficial de Fixy (xls de Sebastián Fernández, 28/09/2026), cruzado el 01/10/2026

Fixy mandó la lista `estados-finales-o-no-28-9-2026.xls`, con estado, código alfanumérico y "Final SI/NO". No trae el código numérico que llega por `seguimiento.json`, así que se cruzó por nombre contra `raw.estado` y `courier_status_map`. Nuestro "final" son los canónicos entregado, devuelto, siniestro y cancelado (`TERMINALES` en `lib/couriers/sync.ts`).

- **Coinciden todos los códigos vistos en prod salvo uno**: 39, 139, 184, 104, 79 y 123 son finales en los dos lados. 127, 52, 51, 48, 134, 129, 135, 63, 42, 142, 183, 117, 144, 64, 145, 125, 126, 121 y 82 no son finales en ninguno de los dos. Los prefijos alfanuméricos de la carga vieja (POD-, CSYDV-, CANC-, ROBO-, ANULADO-, EPR-, RAD-, REPRO-) también coinciden.
- **51 "DESTINATARIO RECHAZA EL ENVIO" es NO final para Fixy**, y para nosotros también: `rehusado` no está en TERMINALES y la guía se sigue hasta la devolución (139/184).
- **La diferencia: 116 "NO RETIRADO"**. Para Fixy es **final** ("retiro no retirado"); nosotros lo mapeamos `incidencia`. Hay 13 eventos y 0 guías con estado actual 116.
- **No figuran en el catálogo:** 70 "Ruteado para su entrega" (el catálogo dice "Ruteado para su entrega", RC, NO; es el mismo con doble espacio), 41 "SOLICITUD PENDIENTE DE RETIRO", 182, 202 y 140.
- **Están en el catálogo y nunca aparecieron en prod:** CANCELADO, NO ENTREGADA, Armado, Stock Reservado, Pendiente de Armado, Falta Confirmación de Transferencia, Contra reembolso y Devolución con Cobro de servicio (SI), Cancelado por comprador (SI), Zona restringida por paro, Reorganización de envíos, Solicitud Confirmada, Devolución/Rendición Generada, Envío Cancelado en Base, Envío extraviado (SI) y En tránsito.
