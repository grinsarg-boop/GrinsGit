# Corrección al inventario (04): los pedidos COD reales de ARRAIGO, leídos en Veltron el 03/09/2026 14:30 ART

El 04-herramientas.md dice "3 entregados de 27 creados, todos x1, y 14 x2/x3 con 0 entregados". **Está contaminado
por pedidos de prueba y por una lectura errada del pack.** Lo verificado pedido por pedido (`listar_pedidos`,
preset `todos`, por SKU exacto):

## Los SKUs

- `ARR-X1` = el producto; **el pack va en `cantidad`** (cantidad 3 a $89.990 ES el x3 + dermaroller, no "tres x1").
- `ARRAIGO-X3K` ("Pack x2", $79.900) y `ARRAIGO-X3A` ("Pack x3", $89.900) son SKUs nuevos: **13 de sus 14 pedidos son
  PRUEBAS de hoy** (cliente "Test Test", "Calle Falsa", nota "PRUEBA 03/09 - NO despachar"), creadas a las 12:27 y
  13:00 ART por la sesión que arma el despacho nocturno, y canceladas a los 10 minutos. **Seis generaron guía real en
  Urbano** (BLABS4111, BLABS4118-4122) y una en Fixy (1805691): están canceladas en Veltron pero existen en el courier
  como PI sin admisión — pueden aparecer en el barrido de trabados si nadie las descarta.

## Los 11 pedidos reales (todos de la tanda de agosto, 06-08/08)

| estado | n | detalle |
|---|---|---|
| **entregado y cobrado** | **3** | #19095 CABA/Fixy 20/08 · #19119 Godoy Cruz/Urbano 26/08 · #19156 Luján de Cuyo/Urbano 26/08 — **los tres x3 a $89.990** |
| rebotado (en coordinación) | 2 | #19035 San Rafael (pide reprogramar) · #19129 Chaco (no está en la localidad) |
| retornado | 2 | #19094 Jujuy · #19104 Formosa |
| cancelado por el cliente antes del despacho | 2 | #19068 Neuquén (a los 2 min) · #19096 Comodoro |
| **espera_link_pago (eligió cuotas_3 y nunca pagó)** | **2** | #19106 Chaco · #19245 La Rioja |

- Pack: **9 de 11 eligieron x3 (82%)**. Ticket real del x3 en la orden: **$89.990** (la grilla del contexto dice
  $89.900 — el desfasaje que marcaron A1 y A2 está confirmado en las órdenes).
- Entrega: 3 de 11 creados (27%); 3 de 7 despachados (43%); los 2 rebotados todavía son coordinables.
  **Las tres entregas fueron Mendoza ×2 y CABA ×1.**
- **La opción "cuotas_3" del formulario COD fue una fuga: 2 de 11 (18%) la eligieron y ninguno pagó el link.**
  Para la palanca del COD esto importa: el creativo y la landing deberían empujar "pagás al recibir" y no ofrecer
  el prepago en cuotas como alternativa visible en frío.
- Además hay **un pedido real x2 (`ARRAIGO-X3K`) del 24/08, #21200 Carina Ortiz, Mendoza, en `pendiente` desde hace
  10 días** con motivo "accion sobre pedido - hay varios activos": nunca se confirmó. Es operativo, no creativo,
  pero es una venta parada.

## Para el plan

- El contador REAL de ARRAIGO es **3 entregados y cobrados**: no es presentable. El contador verificable pasa a ser
  el de la EMPRESA (todos los productos COD entregados y cobrados en mano) — sacarlo de la base, no de Veltron.
- Los tests del despacho nocturno están usando los SKUs nuevos: cualquier conteo por SKU de ARRAIGO tiene que
  filtrar `cliente_nombre != 'Test Test'`.
