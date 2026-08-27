# El indicador de producto+unidades ("B2", "B3", "N2") en ProyectoEco

Fecha: 09/08/2026. Repo `/Users/franciscoandreudegasperi/Downloads/ProyectoEco`.

## 0. Titular

El indicador EXISTE y se llama **código de producto**. Su formato hoy es **letra + número**
(`B3` = BeeVenom x3), **no** número + letra (`3B`). Es una sola función de 2 líneas:

```
lib/correo.ts:187-189
export function productoCode(p: ShopifyPedido): string | null {
  return p.producto ? `${p.producto[0].toUpperCase()}${p.qty}` : null;
}
```

---

## 1. La regla exacta

### La letra
Primera letra del **nombre canónico** que devuelve `matchProduct()` (`lib/product-match.ts`),
en mayúscula. NO es el título de Shopify ni el SKU: es el nombre de la tabla `products`.

| id | products.name | keyword de match | letra |
|----|---------------|------------------|-------|
| 1 | Natures | `nature` | **N** |
| 2 | Pureza | `pureza` | **P** |
| 3 | Veinguard | `vein` | **V** |
| 4 | BeeVenom | `bee` | **B** |
| 5 | Altus | `altus` | **A** |
| 6 | Revival Oil | `revival` | **R** |
| 7 | M3 | `reafirmante` | **M** |

**No hay colisiones de inicial**: N, P, V, B, A, R, M son las 7 distintas. No hay ninguna regla
de desempate escrita porque nunca hizo falta. (Si mañana entra otro producto con N/P/V/B/A/R/M,
el código colisiona en silencio — no hay assert que lo impida.)

Ojo con la keyword, que sí puede colisionar: el orden de evaluación en TS es el del array
`PRODUCT_KEYWORDS` (primera que matchea gana). En SQL es un `limit 1` **sin order by**
(`027_producto_m3.sql:7-15`), o sea no determinístico si un título matcheara dos keywords.
Hoy ninguna combinación real matchea dos.

### El número
Es **`qty` = Σ `line_item.quantity` de las líneas de ESE producto** en la orden de Shopify
(`pickProducto`, `lib/correo.ts:174-184`).

**No es `pack*qty`.** Y ojo con la trampa de nombres, que es la fuente de toda la confusión:

| concepto | Shopify | tabla `order_items` |
|----------|---------|---------------------|
| unidades físicas del pedido | `line_items[].quantity` | columna **`pack`** |
| — | — | columna **`qty` = 1 siempre** (para contar el costo 1 vez por línea) |

Es decir: **el número del código = `order_items.pack` = `line_items[].quantity`**. La columna
`order_items.qty` NO participa (vale 1 en el 100% de las filas desde la migración 006).

Verificado en la base: los 15.977 pedidos tienen **exactamente 1 línea** cada uno, así que la
suma de `pickProducto` es, en la práctica, el `quantity` de la única línea.

### Carrito mixto
Si la orden tiene ítems de más de un producto (o ninguno matchea), `pickProducto` devuelve
`producto = null` → `productoCode` devuelve `null` → el código queda **en blanco** y se completa
a mano. Decisión explícita del audit C#3: mejor blanco que rotular mal con el 1er ítem.

---

## 2. Dónde vive (archivo:línea)

| qué | dónde |
|-----|-------|
| **La regla del código** (letra+número) | `lib/correo.ts:186-189` (`productoCode`) — **único lugar**, TS puro, no está duplicada en SQL |
| Producto + unidades del pedido | `lib/correo.ts:171-184` (`pickProducto`) |
| Nombre canónico ← keyword | `lib/product-match.ts:5-23` (`matchProduct`) — **espejo TS** de `match_product` en SQL |
| Espejo SQL (canónico para orders/ads) | `supabase/migrations/027_producto_m3.sql:7-15` |
| `pack = quantity` (el número) | `supabase/migrations/006_pack_quantity.sql:53-62`, re-declarado en `013_dispatch_from_tag.sql:53-62` |
| Fuente de datos del panel | `app/api/correo/pedidos/route.ts:48` (llama `pickProducto`) |
| Test | `lib/correo.test.ts:50` → `expect(productoCode(pedido)).toBe("N2")` |

**Duplicación real que hay que saber:** la lógica producto↔keyword está en TS *y* en SQL, y hay
que mantenerlas sincronizadas a mano (el propio comentario de `product-match.ts:1-3` lo dice).
Diferencia viva: **Revival Oil está solo en TS** (se vende únicamente por ML, no llega a
`orders`). La regla del código en sí (letra+número) **no** está duplicada.

---

## 3. Cómo se lee el pack del título de Shopify

**Respuesta corta: NO se lee del título.** El pack sale del `quantity` del line item.

Historia: en `002_rpcs.sql` había una función `match_pack(text)` con regex sobre el título. La
migración **006 la mató** (`drop function if exists match_pack(text)`) con este diagnóstico
textual: *"el título es marketing '2x1' y NO lleva el pack; el regex match_pack colapsaba todo a 1"*.

Por qué esto es correcto y no hay que volver atrás: los títulos son marketing, no inventario.
"Bee Venom Spray **2x1**: …" es el nombre del producto — dice 2x1 aunque el cliente compre 3.
El sufijo entre paréntesis que agrega el upsell (`(2x1!)`, `(3x1!)`, `(Pack x4!)`, `(LLEVA 3)`)
sí correlaciona con el quantity, pero es redundante: el dato duro ya está en `quantity`.

Formas de decir lo mismo que conviven hoy en `title_raw` (medido en base):
`(2x1!)`, `(3x1!)`, `(Pack 2x1!)`, `(Promo 2x1!)`, `(Pack x4!)`, `(LLEVA 1)`, `(LLEVA 2)`,
`(LLEVA 3)`, `(LLEVA 2X1)`, `| 3x1!`, `Lleva 1`, y sin sufijo.

### Dónde SÍ hay parser de pack por texto (dos, y ninguno toca Shopify COD)

**a) MercadoLibre — `lib/ml.ts:95-109` (`parseMlPack`)**
ML nunca manda el pack en `quantity` (siempre viene 1); vive en el nombre del listado. Regex en
orden, primera que dé 1..12 gana (el tope de 12 descarta "X 30ml" → 30):
1. `/^\s*(\d{1,2})\s/` → "3 Gotero…" = 3
2. `/(\d{1,2})\s*[xX]\s*\d/` → "…4 X 30ml" = 4
3. `/[xX]\s*(\d{1,2})/` → "…Promo X4…" = 4
4. `/(\d{1,2})\s*u\b/i` → "…Menta 2u…" = 2
Sin match → 1. Excepción por item id: `PACK_POR_ITEM` (`MLA3692036796` = 2, título de catálogo
que ML impone y no dice la cantidad).

**b) Etiquetas ML/Flex en /picking — `lib/label-picking.ts:57-64`**
Lee el PDF de la etiqueta. Orden: `SKU: XX<n>` (el pack es el último dígito del SKU: `VE4` =
Veinguard x4) → `(\d+) x \d+ ml` → `pack x?(\d+)` → `(\d+) goteros|frascos|comprimidos|cápsulas`
→ `(\d+) u`. Sin match → 1.
Trampa documentada: **"1 Unidad" en ML es la cantidad de PUBLICACIONES compradas, no el pack**
(`qtyM`, línea 63). Si es >1 → `revisar = true` y la etiqueta NO se cuenta sola.

---

## 4. Dónde se renderiza hoy

### A. Estampado en el PDF de etiquetas de Correo Argentino — el uso principal
Ruta: `/logistica?t=etiquetas` (antes `/correo`, hoy redirect). UI en
`app/(dash)/logistica/correo.tsx:37-120` (componente `Etiquetas`).

Flujo: subís el PDF de MiCorreo → `extractOrders` lee `#NNNNN` de cada página
(`lib/correo-pdf.ts:6-22`) → `/api/correo/pedidos` trae producto+qty de Shopify →
`productoCode` arma el código → tabla editable (input `w-16`, placeholder `"B3"`, se fuerza
`.toUpperCase()` al estampar, `correo.tsx:70`) → botón "Estampar y descargar PDF".

Formato del estampado (`lib/correo-pdf.ts:26-37`):
- fuente **Helvetica-Bold**, **size 26**, en `x: 95, y: 88`
- va en el recuadro vacío al pie de la etiqueta; posición validada 13/07 sobre los layouts DOM y SUC (no pisa barras ni QR)
- código `null` o vacío → no dibuja nada

Texto de ayuda en pantalla: *"estampa el código (B3 = BeeVenom x3) en el recuadro vacío al pie"*.

### B. NO existe en la pantalla de Picking
`/logistica?t=picking` (`app/(dash)/logistica/picking.tsx`) muestra un **agregado del día**, no
un código por pedido: tabla Producto | Órdenes | Unidades | "Paquetes a armar", donde la última
columna es `packBreakdown()` (`lib/label-picking.ts:81-85`) con formato `10×1 · 15×2 · 15×4`
(n pedidos × tamaño de pack). Tipografía normal `text-sm`, nada grande.

O sea: **para Correo hay código por bulto estampado en la etiqueta; para Fixy/Urbano/ML no hay
ninguno** — ahí Pancho solo tiene el resumen agregado del día.

---

## 5. BeeVenom en concreto

Medido en `order_items` (producto id 4), todas las variantes de título:

| `title_raw` | `pack` | filas | último pedido |
|---|---|---|---|
| `Bee Venom Spray 2x1: … Psoriasis.` (sin sufijo) | **2** | 1139 | 07/07/2026 |
| `Bee Venom Spray 2x1: … Psoriasis.` (sin sufijo) | **3** | 247 | 06/07/2026 |
| `Bee Venom Spray 2x1: … Psoriasis.` (sin sufijo) | **1** | 93 | 07/07/2026 |
| `… Psoriasis. (2x1!)` | **2** | 417 | 09/08/2026 |
| `… Psoriasis. (3x1!)` | **3** | 85 | 09/08/2026 |
| `Bee Venom Spray 2x1` (título viejo corto) | **1** | 4 | 17/07/2026 |

Lecturas:
1. **El sufijo es fiel cuando está**: `(2x1!)` → pack 2 siempre; `(3x1!)` → pack 3 siempre.
   Pero el pack NO se deriva de ahí, se deriva del `quantity`.
2. **El título sin sufijo NO dice nada**: el mismo string tiene pack 1, 2 y 3. Cualquier intento
   de sacar el pack del título de BeeVenom leyendo el "2x1" del nombre daría 2 para el 100% de
   los pedidos — mal en 425 de 1985 casos históricos. Por eso murió `match_pack`.
3. **`pack = 1` en BeeVenom/Veinguard es un error de tipeo de Shopify, no un pedido de 1 unidad.**
   Migración 006, comentario textual: *"Veinguard/BeeVenom NO existen como x1: el x1 es el x2 mal
   tipeado en Shopify (quantity=1 en vez de 2)"*. Por eso `product_costs` seedea x1 con el costo
   del x2 (alias). **El P&L lo corrige; el código de la etiqueta NO**: un pedido así se estampa
   `B1` y en depósito se arma 1 unidad cuando el cliente pagó 2.
   Mitigación real: ya no pasa. En los últimos 21 días BeeVenom tiene solo pack 2 (238) y pack 3
   (55); pack 1 no aparece desde el 07/07/2026. Veinguard pack 1 tuvo 1 caso.
4. Distribución BeeVenom total: pack 1 = 97, pack 2 = 1556, pack 3 = 332. Códigos posibles hoy:
   **B2** y **B3**.

### Los códigos que salen realmente por producto (todo el histórico)
- **N** (Natures): N1 (1837), N2 (2268), N3 (419), N4 (214), N5 (1)
- **P** (Pureza): P1 (1846), P2 (2820), P3 (575), P4 (135), P6 (1)
- **V** (Veinguard): V1 (151), V2 (2039), V4 (535) — **no existe V3**
- **B** (BeeVenom): B1 (97), B2 (1556), B3 (332)
- **A** (Altus): A1 (325), A2 (457), A3 (146)
- **M** (M3): M1 (1), M2 (4), M3 (15) — ojo, **`M3` el código = M3 x3**, choca con el nombre del producto
- **R** (Revival Oil): no aparece en `order_items` (solo ML)

Colisión de lectura a tener en cuenta si esto se imprime en un bulto: **`M3` puede leerse como
"el producto M3"** en vez de "M3 x3". Son 15 pedidos históricos, pero el ambiguo existe.

---

## 6. Resumen para el que tenga que tocarlo

```
código = matchProduct(title)[0].toUpperCase() + Σ line_item.quantity
       = products.name[0]                     + order_items.pack
```
- Una sola función: `lib/correo.ts:187`. Un solo consumidor: `app/(dash)/logistica/correo.tsx:57`.
- Un solo render: estampado Helvetica-Bold 26pt en `(95, 88)` del PDF de Correo.
- Si se quisiera el formato `2B` en vez de `B2`, es dar vuelta el template string en esa línea
  (y el placeholder `"B3"` de `correo.tsx:101` + el copy de `correo.tsx:79`).
- Si se quisiera el código en /picking (Fixy/Urbano), el dato ya está: `PickingOrder.items[]`
  trae `{producto, unidades}` por pedido (`app/api/picking/route.ts:24`); hoy se agrega y se
  tira el detalle por pedido.
