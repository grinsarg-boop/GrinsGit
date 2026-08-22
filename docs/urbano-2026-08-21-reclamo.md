# Reclamo a Urbano — 21/08/2026

**Cómo se armó.** Las 180 guías de Urbano que la base daba por trabadas (+21 días sin resolver) se
consultaron EN VIVO contra `POST /tracking/consultaTrackingMasivo/` el 21/08/2026, por
`codigoSeguimiento` = shopify_id (las 180 son despachos ≤ 31/07, anteriores al corte BLABS del
04/08). Las 180 existen en el courier (`codError: 0`).

Del universo salen 116 por "nunca entró" y 31 por "volvió, va a redespacho". Quedan
**26 guías para reclamar, COD $1.299.590**.

Contra el snapshot anterior (`datos/reclamos/2026-07-27.json`, de hace 25 días): **4 guías siguen
con el mismo estado y la misma fecha de movimiento** — Urbano no las tocó desde el reclamo anterior.

**NO se mandó ningún mail.** El texto de abajo está listo para copiar y pegar.

---

## Texto del mail

**Asunto:** Reclamo formal — 26 piezas sin resolución (shipper 004362) — $1.299.590 en COD

Buen día,

Les paso el detalle de 26 piezas de nuestro shipper 004362 que siguen sin resolución. Las
consultamos hoy 21/08 por la API de tracking masivo y el estado que devuelve su sistema es el que
listamos abajo. Necesitamos respuesta pieza por pieza.

### 1) Tres piezas cuyo historial desapareció del tracking — $149.940

El 27/07 estas tres devolvían movimientos reales por esta misma API. Hoy la consulta responde
`codError: 0` (la pieza existe) pero sin ningún movimiento, sin producto y sin domicilio. No es que
nunca hayan entrado: entraron, se movieron, y el historial se borró.

- Guía **6887499038960** — pedido 9787, despacho 14/05, Buenos Aires, COD $49.980. El 27/07 figuraba en `RR|2026-06-02`; hoy la API no devuelve ningún movimiento.
- Guía **6899891339504** — pedido 10298, despacho 18/05, Córdoba, COD $49.980. El 27/07 figuraba en `IF|2026-05-22`; hoy la API no devuelve ningún movimiento.
- Guía **6902445998320** — pedido 10410, despacho 20/05, Jujuy, COD $49.980. El 27/07 figuraba en `NC|2026-06-02`; hoy la API no devuelve ningún movimiento.

Pedimos el historial completo de las tres y dónde está la mercadería.

### 2) Piezas en poder de Urbano sin un solo movimiento desde junio — $109.970

El último movimiento de las dos es **IF — "Ya tenemos su pedido en Urbano"**. Desde ahí, nada. Ya
las reclamamos el 27/07 y hoy siguen con el mismo estado y la misma fecha.

- Guía **6928165372144** — pedido 11415, despacho 28/05, Santa Fe, COD $49.980. Último movimiento IF el 02/06, hace 80 días. Ya reclamada el 27/07, sin cambios.
- Guía **6938125795568** — pedido 12039, despacho 03/06, Santa Fe, COD $59.990. Último movimiento IF el 08/06, hace 74 días. Ya reclamada el 27/07, sin cambios.

Pedimos entrega o devolución efectiva, o compensación por extravío.

### 3) Piezas con movimiento DL ("Su envío fue entregado") y COD sin rendir — $159.940

En estas tres el tracking muestra el check **DL — "Su envio fue entregado"**, pero el campo `estado`
de la pieza quedó en un estado anterior (AS — "en viaje a sucursal") y el COD nunca se rindió.

- Guía **6897779540208** — pedido 10179, despacho 04/06, Santa Fe, COD $59.980. DL registrado y estado final `AS - Su envio esta en viaje a sucursal`; último movimiento 04/06.
- Guía **6938775978224** — pedido 12093, despacho 04/06, Buenos Aires, COD $49.980. DL registrado y estado final `AS - Su envio esta en viaje a sucursal`; último movimiento 11/06.
- Guía **7005358653680** — pedido 15938, despacho 07/07, Chubut, COD $49.980. DL registrado y estado final `AS - Su envio esta en viaje a sucursal`; último movimiento 10/07.

Pedimos: si fueron entregadas, la rendición del COD; si no, dónde está el bulto.

### 4) Piezas trabadas en bucle de reintentos — $879.740

Estas se mueven, pero llevan entre 3 y 5 semanas desde el despacho rebotando entre "preparado para
salir a distribución", "en camino" y una incidencia, sin cerrar ni en entrega ni en devolución.

- Guía **7018227695856** — pedido 16616, despacho 14/07, Buenos Aires, COD $49.980. Estado actual `ST - Sin tramitar`; último movimiento 15/08 (6 días).
- Guía **7032615272688** — pedido 17097, despacho 20/07, Río Negro, COD $39.980. Estado actual `BA - Rehusa recibir`; último movimiento 18/08 (3 días).
- Guía **7039601934576** — pedido 17601, despacho 22/07, Santa Cruz, COD $49.990. Estado actual `BA - No existe nro/altura`; último movimiento 10/08 (11 días).
- Guía **7042710307056** — pedido 17899, despacho 22/07, Río Negro, COD $49.980. Estado actual `CA - No encontramos a nadie en el domicilio`; último movimiento 14/08 (7 días).
- Guía **7043989307632** — pedido 17992, despacho 23/07, Santa Cruz, COD $39.980. Estado actual `BA - No existe nro/altura`; último movimiento 10/08 (11 días).
- Guía **7035660534000** — pedido 17376, despacho 23/07, Río Negro, COD $39.990. Estado actual `CA - No encontramos a nadie en el domicilio`; último movimiento 14/08 (7 días).
- Guía **7040615186672** — pedido 17688, despacho 23/07, Santa Fe, COD $39.990. Estado actual `BA - Mal codificado`; último movimiento 01/08 (20 días).
- Guía **7043433038064** — pedido 17950, despacho 24/07, Formosa, COD $49.980. Estado actual `CA - No encontramos a nadie en el domicilio`; último movimiento 20/08 (1 días).
- Guía **7050003939568** — pedido 18177, despacho 28/07, Santa Cruz, COD $49.980. Estado actual `BA - No existe nro/altura`; último movimiento 10/08 (11 días).
- Guía **7050094379248** — pedido 18180, despacho 28/07, Río Negro, COD $39.980. Estado actual `LD - Su envio esta en camino`; último movimiento 20/08 (1 días).
- Guía **7055934521584** — pedido 18405, despacho 29/07, Tucumán, COD $59.980. Estado actual `MA - Su envio esta preparado para salir a distribucion`; último movimiento 21/08 (0 días).
- Guía **7060031963376** — pedido 18558, despacho 31/07, Buenos Aires, COD $49.990. Estado actual `SP - No pudimos entregar su envio por rehusa recibir`; último movimiento 15/08 (6 días).
- Guía **7061144535280** — pedido 18599, despacho 31/07, Salta, COD $59.990. Estado actual `VN - No responde`; último movimiento 12/08 (9 días).
- Guía **7059085295856** — pedido 18533, despacho 31/07, La Pampa, COD $49.990. Estado actual `BA - Rehusa recibir`; último movimiento 13/08 (8 días).
- Guía **7056530866416** — pedido 18432, despacho 31/07, Río Negro, COD $39.990. Estado actual `SP - No pudimos entregar su envio por no responde`; último movimiento 20/08 (1 días).
- Guía **7057091100912** — pedido 18454, despacho 31/07, Buenos Aires, COD $59.990. Estado actual `ST - Sin tramitar`; último movimiento 15/08 (6 días).
- Guía **7057668440304** — pedido 18468, despacho 31/07, Salta, COD $59.990. Estado actual `CA - No encontramos a nadie en el domicilio`; último movimiento 18/08 (3 días).
- Guía **7060753318128** — pedido 18583, despacho 31/07, Buenos Aires, COD $49.990. Estado actual `SP - No pudimos entregar su envio por rehusa recibir`; último movimiento 19/08 (2 días).

Pedimos, para cada una: o un nuevo intento con fecha comprometida, o el cierre en devolución para
recuperar la mercadería. Cuatro de estas tienen incidencia de dirección ("no existe nro/altura",
"mal codificado"): si el domicilio que tienen cargado está mal, pásennoslo y lo corregimos.

Quedamos a la espera del detalle pieza por pieza.

Saludos.

---

## Lo que NO se reclama (para que el reclamo no pierda fuerza)

- **116 guías salen por "nunca entró"**: la API devuelve solo `PI` ("Recibimos la información de su
  pedido") o directamente ningún registro, con más de 2 días desde el despacho. 114 de esas 116 son
  pedidos que nosotros cancelamos — etiqueta emitida, bulto nunca retirado. COD nominal
  $5.586.685, COD real en juego $99.980.
- **31 guías volvieron** (RM "Rendido a Matriz" / RV / DV) y van a redespacho, no a reclamo. 27 de
  las 31 pasaron a devolución en agosto. Lo que sí corresponde es chequear la recepción física de
  esos 31 bultos.
- **1 guía se entregó y la base no se enteró** (pedido 16872, guía 7021422182640, DL el 19/08).
  No entra al reclamo: el ciclo de rendición todavía no la alcanzó.
