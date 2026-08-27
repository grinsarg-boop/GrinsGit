# Relevamiento: manipulación de PDFs de etiquetas en ProyectoEco

Repo: `/Users/franciscoandreudegasperi/Downloads/ProyectoEco`
Fecha: 2026-08-09 · rama `main`

> **La feature ya está construida y deployada (commit `495a458`, 09/08/2026).** Las secciones 3.3,
> 3.4, 6.5 y 7.2 se corrigieron con lo que se midió al hacerla; lo demás quedó como estaba. Lo que
> más costó y no estaba acá: **cada courier tiene más de una plantilla con el MISMO tamaño de
> página**, así que la geometría no alcanza para decidir dónde estampar. Las coordenadas viven en
> `lib/label-prep.ts` con el porqué de cada una.

---

## 0. TL;DR — el hallazgo que cambia el prompt

**`/logistica` ya existe y ya tiene las tres herramientas.** No hay que crear la ruta: hay que
agregarle una cuarta capacidad (reordenar páginas) y generalizar dos que hoy son mono-courier.

| Lo que pide la feature | Estado hoy |
|---|---|
| (a) recibir PDFs de Correo/Urbano/Fixy | **HECHO** — `extractLabels()` ya parsea los 3 + ML/Flex, multi-archivo |
| (b) estampar indicador de unidades "2B"/"3B" | **PARCIAL** — `stampCodes()` estampa, pero solo en Correo (posición fija) y con formato `B3` (letra+número), no `3B` |
| (c) devolver ordenadas por producto y unidades | **FALTA** — hoy solo se *reporta* la agregación en una tabla; ninguna función reordena páginas |
| (d) ordenar etiquetas de ML por producto/unidades | **PARCIAL** — `extractLabels()` ya da producto+unidades por página ML, y `mlLabelsTo10x15()` ya parte el 10×19; falta unir ambos y ordenar |

El pegamento que falta es chico: pdf-lib `copyPages` en el orden que quieras. Todo el
parsing pesado ya está resuelto y testeado.

---

## 1. Rutas y pantallas existentes

### 1.1 `/logistica` — la pantalla real

`app/(dash)/logistica/page.tsx` (server component, 19 líneas). Tab por searchParam `?t=`:

```
t=picking (default) → <Picking />      ./picking.tsx
t=correo            → <CorreoTools />  ./correo.tsx
t=etiquetas         → <EtiquetasMl />  ./etiquetas-ml.tsx
```

Las tres son `"use client"`. Whitelist de tabs: `t === "correo" || t === "etiquetas" ? t : "picking"`.

> **Trampa:** esa whitelist está **duplicada** en `components/nav-link.tsx:34`. Un tab nuevo
> hay que agregarlo en los dos lados o la nav no lo marca activo.

### 1.2 Rutas viejas → redirect

`app/(dash)/picking/page.tsx`, `app/(dash)/correo/page.tsx`, `app/(dash)/etiquetas/page.tsx`
son cada una un `redirect("/logistica?t=<tab>")` de 5 líneas (unificación del 20/07).

### 1.3 `app/(dash)/logistica/picking.tsx` — Picking del día (201 líneas)

El componente más cercano a lo que pide la feature.

- Input: `<input type="file" multiple accept="application/pdf">` (nativo, no `Dropzone`).
- Por cada archivo: `extractLabels(await f.arrayBuffer(), f.name)` → `Label[]`.
- Junta los `orden` nuevos y los pide a `/api/picking?orders=...` en chunks de 60.
- Agrega en un `Map<producto, {unidades, ordenes, packs[]}>`:
  - **COD** (urbano/fixy/correo): por orden distinta, producto+unidades vienen de Shopify.
  - **ML/Flex**: producto+unidades leídos de la etiqueta, sin cruzar Shopify.
- Renderiza tabla: Producto · Órdenes · Unidades · `packBreakdown(packs)` → `"10×1 · 15×2 · 15×4"`.
- Flags de calidad: `sinOrden`, `errores` (429/5xx reintentable), `noEncontrados` (200 pero no
  existe), `sinProducto`, `mlRevisar` (mixto/multi-compra), `mlSinProd`, `noRecon`.
- Mide y muestra `pdfMs` / `crossMs` / etiq-por-segundo.

**No toca el PDF de salida. Solo lee y reporta.**

### 1.4 `app/(dash)/logistica/correo.tsx` — Correo Argentino (317 líneas)

Dos herramientas en una:

**`<CargaMasiva>`** — CSV de 21 columnas para MiCorreo. Irrelevante para esta feature.

**`<Etiquetas>`** — **esto sí es el precedente directo del estampado**:
1. `Dropzone` → `f.arrayBuffer()`.
2. `await import("@/lib/correo-pdf")` (dinámico) → `extractOrders(bytes)` → `(string|null)[]` por página.
3. `fetchPedidos(found)` → `/api/correo/pedidos` (chunks de 60).
4. `productoCode(p)` → `"B3"` por orden.
5. Tabla **editable a mano** (`<input>` por página, `w-16`, placeholder `B3`).
6. `stampCodes(pdf, codes)` → descarga `etiquetas_con_producto.pdf`.

El patrón "parseá → proponé → dejá corregir → estampá" ya está probado acá y es el que conviene copiar.

### 1.5 `app/(dash)/logistica/etiquetas-ml.tsx` — Etiquetas ML → 10×15 (102 líneas)

- `Dropzone` (single file) → `bytesRef` cachea el `ArrayBuffer`.
- `useEffect` re-corre `mlLabelsTo10x15()` al cambiar `file` o el checkbox `includeTalon`.
- Guarda el `ArrayBuffer` en un ref porque **`mlLabelsTo10x15` consume el buffer** → siempre
  pasa `bytesRef.current.slice(0)`.
- Salida: `Blob` → `URL.createObjectURL` → botón de descarga + `<iframe>` de preview 70vh.
- Cleanup con `URL.revokeObjectURL` en el efecto (evita fuga) y flag `cancelled` anti-race.

Ojo con el patrón `slice(0)`: tanto pdfjs (`getDocument({data: input.slice(0)})`) como pdf-lib
lo necesitan porque el buffer queda *detached* después de procesarlo.

### 1.6 Listado COMPLETO de `app/api/` (18 rutas)

| Ruta | Método | Auth | maxDuration | Qué hace |
|---|---|---|---|---|
| `chat/route.ts` | POST | sesión | **300** | Asistente con tool-calling |
| `correo/pedidos/route.ts` | GET | **sesión** | *(default)* | `?orders=N,N` → datos Shopify para CSV/etiqueta |
| `import/facturacion-urbano/route.ts` | POST | `badCronAuth` | *(default)* | FormData `file` xlsx/csv → flete real Urbano |
| `import/fixy-xlsx/route.ts` | POST | `badCronAuth` | *(default)* | FormData `file` xlsx → CourierEvents |
| `import/ml-billing/route.ts` | POST | `badCronAuth` | *(default)* | FormData `file` xlsx → percepciones ML |
| `import/ml-flex/route.ts` | POST | `badCronAuth` | *(default)* | FormData `file` xlsx → flete Flex |
| `monitor/ad-review/route.ts` | GET | cron | 60 | Rechazos de Meta |
| **`picking/route.ts`** | **GET** | **sesión** | **60** | `?orders=N,N` → producto+unidades por orden |
| `salud/cajas/route.ts` | GET | cron | 30 | Alertas |
| `salud/cuentas/route.ts` | GET | cron | 30 | Alertas |
| `sync/fixy/route.ts` | GET | cron | 60 | Sync courier |
| `sync/meta/route.ts` | GET | cron | 60 | Sync ads |
| `sync/ml/route.ts` | GET | cron | 60 | Sync ML |
| `sync/recompute/route.ts` | GET | cron | 300 | Recalcula P&L |
| `sync/shopify-backfill/route.ts` | GET | cron | 300 | Backfill |
| `sync/stock-espejo/route.ts` | GET | cron | 60 | Stock |
| `sync/urbano/route.ts` | GET | cron | 300 | Sync courier |
| `webhooks/shopify/route.ts` | POST | HMAC | *(default)* | Webhook |

**No existe ninguna ruta API que reciba un PDF.** Los `import/*` reciben xlsx/csv y están
protegidos por `CRON_SECRET`, no por sesión — no sirven de molde para un upload del dashboard.

#### `/api/picking` en detalle (el que se va a reusar)

```ts
export const maxDuration = 60;
GET /api/picking?orders=16934,16943,...     // 1..60, más → 400

type PickingItem  = { producto: string | null; unidades: number };
type PickingOrder = { orden: string; encontrado: boolean; error?: boolean;
                      courier: string | null; total: number; items: PickingItem[] };
→ { orders: PickingOrder[] }
```

- Consulta Shopify Admin REST `orders.json?status=any&name=<N>&fields=name,total_price,tags,line_items`,
  **una request por orden, secuencial** (de ahí los 60s).
- `courier` sale de los `tags` con regex de palabra completa contra `["urbano","fixy","correo"]`.
- `producto` = `matchProduct(li.title)`, `unidades` = `li.quantity`.
- Distingue `encontrado:false` (no existe) de `error:true` (429/5xx → reintentable). Esa distinción
  ya está en la UI y conviene no perderla.

---

## 2. Librerías de PDF

### 2.1 Dependencias (package.json)

```json
"pdf-lib":     "^1.17.1"     // escritura: recortar, componer, estampar texto
"pdfjs-dist":  "^6.1.200"    // lectura: extraer texto por página
"xlsx":        "^0.18.5"     // no-PDF, para los imports de facturación
```

Ambas ya están instaladas. **No hace falta ninguna dependencia nueva** para reordenar,
estampar ni rotar — pdf-lib cubre todo.

Fuera de `lib/`, el único otro consumidor es `scripts/redespacho.mjs` (ver §3.5).

### 2.2 `lib/split-labels.ts` (61 líneas)

```ts
const CM = 28.3465; const OUT_W = 10*CM; const OUT_H = 15*CM; const TOL = 3;

export type MlSplitResult = { pdf: Uint8Array; labels: number; skipped: number };

export async function mlLabelsTo10x15(
  input: Uint8Array | ArrayBuffer,
  opts?: { includeTalon?: boolean }
): Promise<MlSplitResult>
```

Lógica por página:
- `|width − 10cm| > 3pt` → `skipped++` (descarta la hoja A4 de resumen y cualquier otro tamaño).
- `height ≤ 15cm + 3pt` → ya es 10×15, se copia tal cual (`copyPages`).
- si no → `embedPage` con crop box `{left:0, right:width, bottom:0, top:15cm}` y matriz
  `[1,0,0,1,0,-bottom]` para normalizar el origen. La etiqueta va abajo; el talón (4 cm) arriba.
- `includeTalon:true` → agrega una segunda hoja 10×15 con el talón pegado arriba
  (`y: OUT_H - talon.height`).

**Solo mira geometría, nunca texto.** No sabe qué producto es cada etiqueta.

### 2.3 `lib/label-picking.ts` (104 líneas) — la pieza central

```ts
export type LabelCourier = "urbano" | "fixy" | "correo" | "ml" | "flex" | "?";
export type Label = {
  page: number;          // 1-indexed
  file?: string;         // nombre del PDF de origen
  courier: LabelCourier;
  orden: string | null;  // COD: para cruzar con Shopify
  price: number | null;  // contrareembolso (validación)
  producto: string | null; // ML/Flex: leído de la etiqueta
  unidades: number | null; // ML/Flex: pack
  revisar: boolean;      // ML/Flex mixto o multi-compra → contar a mano
};

export async function extractLabels(input: ArrayBuffer, file?: string): Promise<Label[]>
export function packBreakdown(unidadesPorPedido: number[]): string
export const _parsePage = parsePage;  // export solo para tests
```

**`extractLabels`** — import dinámico de `pdfjs-dist/legacy/build/pdf.mjs`, resuelve el
`workerSrc` con una rama Node/browser (ver §4.3), y por página junta
`content.items.map(it => it.str).join(" ").replace(/\s+/g," ").trim()` → `parsePage`.

**`parsePage`** — detección de courier, en orden (primera que matchea gana):

| # | Condición sobre el texto (lowercase) | → courier |
|---|---|---|
| 1 | contiene `fixy` | `fixy` |
| 2 | `flex` **y** `venta` | `flex` |
| 3 | `venta id` **o** `mercadolibre` | `ml` |
| 4 | `pack id` **y** `recort` | `flex` si tiene `flex`, si no `ml` |
| 5 | `canalizador` **o** `shipper:` | `urbano` |
| 6 | `f.pagado` **o** `clasico` **o** `/destinatario\s+#/i` | `correo` |
| 7 | `/#\d{4,6}\b/` | `correo` |
| 8 | — | `?` |

**`packBreakdown([1,1,2,2,4])`** → `"2×1 · 2×2 · 1×4"`. Agrupa por tamaño de pack, ordena
ascendente por tamaño, formatea `${cantidadDePedidos}×${unidades}`.

### 2.4 `lib/correo-pdf.ts` (37 líneas) — "Solo cliente"

```ts
export async function extractOrders(input: ArrayBuffer): Promise<(string | null)[]>
export async function stampCodes(input: ArrayBuffer, codeByPage: (string|null)[]): Promise<Uint8Array>
```

- **`extractOrders`** — versión reducida de `extractLabels`: solo `text.match(/#(\d{4,6})/)?.[1]`.
  Devuelve un array paralelo a las páginas, con `null` donde no hay pedido.
- **`stampCodes`** — `PDFDocument.load` → `embedFont(HelveticaBold)` → por página, si hay código:
  ```ts
  page.drawText(code, { x: 95, y: 88, size: 26, font });
  ```
  **Coordenadas hardcodeadas.** El comentario dice: *"posición validada 13/07 sobre los layouts
  DOM y SUC; no pisa barras ni QR"* — o sea, validada **solo para Correo Argentino**.
  Páginas con `code === null` quedan intactas.

> El comentario "Solo cliente" del encabezado es **aspiracional, no técnico**: `extractOrders`
> tiene rama explícita para Node (`import.meta.resolve`) y su test corre en vitest/Node.
> Ver §4.3.

### 2.5 `lib/product-match.ts` (29 líneas)

```ts
const PRODUCT_KEYWORDS: [string, string][] = [
  ["nature","Natures"], ["pureza","Pureza"], ["vein","Veinguard"],
  ["bee","BeeVenom"], ["altus","Altus"], ["revival","Revival Oil"], ["reafirmante","M3"],
];
export function matchProduct(text: string): string | null      // primera que matchea
export function matchAllProducts(text: string): string[]       // todas las distintas
```

`matchAllProducts` existe justamente para detectar etiquetas ML mixtas.

---

## 3. Formato de cada etiqueta

### 3.1 MercadoLibre / Flex

**Geometría** (resuelto, `split-labels.ts`): página de **10 × 19 cm**. Talón de producto
("Recortá esta parte de la etiqueta para que tu paquete viaje seguro") arriba, 4 cm.
Etiqueta 10 × 15 abajo. Al final del PDF masivo viene **una hoja A4** (595.28 × 841.89 pt)
de resumen → se descarta por ancho.

**Texto** (resuelto, `label-picking.ts`). Dos formatos que lideran distinto, **ambos pedidos reales**:

```
Venta ID: 20000 17421290758 1 Unidad Sabor Menta 3 Gotero Pureza Drenaje Remitente #262382468
Pack ID: 20000 14040615337 Recortá esta parte... 1 Unidad Sabor: Menta Botella 2 Gotero Pureza Drenaje
```

La hoja resumen es `Pack ID` **sin** "Recortá" (`"Identifiicación Productos ..."` — sí, con la
errata en el original) → courier `?` → ignorada.

**Nº de pedido: NO se extrae, a propósito.** El `#262382468` es el **id del vendedor**, no la
orden. `parsePage` solo extrae `orden` cuando `courier` es COD. Por eso ML **no cruza Shopify**:
el producto se lee de la etiqueta misma.

**Unidades (pack)** — cadena de fallbacks, en orden:
```ts
/sku:\s*[a-z]+(\d{1,2})\b/i          // "SKU: VE4" → 4   (Veinguard x4)
/(\d+)\s*[xX]\s*\d+\s*ml\b/i         // "4 X 30ml" → 4
/pack\s*x?\s*(\d+)/i
/(\d+)\s*(?:goteros?|frascos?|comprimidos?|c[aá]psulas?)\b/i
/(\d+)\s*u\b/i
// default → 1
```
**Trampa documentada:** `"1 Unidad"` es la cantidad de **publicaciones compradas**, NO el pack.
Se lee aparte (`qtyM`) y si es > 1 marca `revisar = true`.

Reglas de decisión: 1 producto y no multi-compra → cuenta. Mixto (>1 producto) o multi-compra →
`revisar:true`, producto `null`, **no se cuenta solo**. 0 productos → `mlSinProd`.

### 3.2 Correo Argentino

**Texto**: `CLASICO F.PAGADO REMITENTE BioLabsArg DESTINATARIO #16966 Abel`
**Nº de pedido**: `/destinatario\s+#(\d{4,6})/i` → fallback `/#(\d{4,6})\b/`.
**Geometría**: el test usa `[841.89, 595.276]` = **A4 apaisada**. Hay dos layouts, "DOM" y "SUC".
Tiene un **recuadro vacío al pie** en `(95, 88)` donde se estampa el código a 26pt — validado 13/07.

**Resuelto**: extracción de orden, estampado, edición manual.

### 3.3 Urbano

**Texto**: `Fecha emisión Canalizador RES Shipper: 4362-BIOLABS Destinatario Sergio Valor Contrareembolso: $58999 #16943`
**Detección**: `canalizador` o `shipper:`.
**Nº de pedido**: cae al regex genérico `/#(\d{4,6})\b/`.

**Geometría: MEDIDA el 09/08/2026 → 425,2 × 283,5 pt = 15×10 apaisada.** Confirmado sobre
`URBANO07082.pdf`, `Urbano0608.pdf` y `etiquetas-urbano-2026-08-09.pdf`. (Las que baja de la API
`redespacho.mjs` son 283 × 425 = 10×15 vertical: **son otra cosa**, no lo que se sube al panel.)

⚠️ **Hay DOS plantillas de Urbano con el mismo tamaño de página**: `URBANO07082`/`Urbano0608`
ponen Localidad en y=138 x=31 y Bulto/s en y=68 x=230; `etiquetas-urbano-2026-08-09`/`Urbano13071`
las ponen en y=159 x=17 y y=27 x=17. El tamaño no alcanza para distinguirlas.

**Falta**: posición de estampado. `stampCodes` en `(95,88)` es de Correo y muy probablemente
pise algo en Urbano.

> Nota de contexto: desde el 04/08/2026 el código de seguimiento Urbano es `BLABS<nro-pedido>`
> (commit `9ce1cdc`). O sea, **el nº de pedido está embebido en el tracking** — puede ser una
> segunda vía de extracción más robusta que el `#NNNNN` genérico.

### 3.4 Fixy

**Texto**: `1720297 BIOLABS DESTINATARIO Andres Contrareembolso: $ 49980 BULTOS 1/1 Remito: 16934 www.fixy.com.ar`
**Detección**: la palabra `fixy` (viene del `www.fixy.com.ar` del pie).
**Nº de pedido**: `/remito[:\s]+(\d{3,7})/i` — **primera prioridad**, antes que los `#`.
**Geometría**: ojo, son DOS cosas distintas.
- Las que **genera el repo**: 10×15 (`htmlToPdf(tmp, destino, 10, 15)`, plantilla "FIXYPAY QR" vía
  `POST /api/v2/print-etiquetas-custom`, que devuelve **HTML**, no PDF).
- Las que **se bajan del panel y sube Pancho** (que son las que importan acá): **595 × 842 pt = A4
  vertical**, una etiqueta por hoja. Medido 09/08/2026 sobre `FIxy0708`, `FIxy0508`, `Fixy1407`,
  `Fixy2907`. **No son 10×15.**

⚠️ **Dos plantillas de Fixy con el mismo tamaño de página**: la nueva (desde fines de julio) tiene
el texto "QR FIXYPAY" y el QR arriba a la izquierda; la vieja (`Fixy1407`, 14/07) no lo tiene y
pone el QR grande al medio-derecha, justo donde caía la primera coordenada de estampado que probé.

**Trampa del remito en redespacho**: si el remito ya existe, Fixy lo rechaza y el script reintenta
con sufijo `-R2`, `-R3`… → el remito puede no ser exactamente el nº de pedido.

**Falta**: posición de estampado, y confirmar geometría de un PDF bajado del panel de Fixy
(no del generado por el script).

### 3.5 `scripts/redespacho.mjs` — precedente de estampado multi-courier

**Untracked en git** (`?? scripts/redespacho.mjs`). Da de alta guías nuevas y baja etiquetas.
Lo relevante:

```js
// Combina en UN pdf, tamaño original, con el #pedido estampado arriba al centro (sin tapar el QR).
const { width, height } = pg.getSize(), size = 6, t = `#${pedido}`;
pg.drawText(t, { x: (width - font.widthOfTextAtSize(t, size)) / 2, y: height - size - 18, size, font });
```

Es **la estrategia de estampado alternativa**: en vez de coordenada fija, la calcula desde
`getSize()` — centrado horizontal, 18pt desde el borde superior. Funciona con cualquier geometría.
Para "2B"/"3B" a tamaño grande hace falta algo parecido pero con una zona libre confirmada por courier.

También: `scripts/html2pdf.mjs` (untracked) convierte HTML → PDF con tamaño de papel exacto vía
Chrome DevTools Protocol, porque `--print-to-pdf` ignora `@page` y siempre saca Letter.
Requiere Chrome local → **no sirve en Vercel**.

---

## 4. Cómo se sube un archivo hoy

### 4.1 Dos patrones distintos, no mezclarlos

**Patrón A — todo en el browser, nada se sube.** Los tres tools de `/logistica`.

```
Dropzone / <input type=file>
  → File.arrayBuffer()
  → pdfjs-dist (leer texto)  y/o  pdf-lib (escribir)
  → Blob → URL.createObjectURL → <a download> / <iframe>
```
El servidor solo se toca para consultar Shopify por nº de orden (`/api/picking`,
`/api/correo/pedidos`) — **viajan números de orden, nunca el PDF**.

**Patrón B — FormData a una ruta API.** Los cuatro `/api/import/*`.
```ts
const file = (await req.formData()).get("file");
if (!(file instanceof File)) return Response.json({ ok:false, error:'falta el campo "file"' }, { status:400 });
XLSX.read(Buffer.from(await file.arrayBuffer()), { type: "buffer" });
```
Auth por `badCronAuth(req)` (**CRON_SECRET**, no sesión). UI de ejemplo:
`components/flex-upload.tsx` con `useActionState` + `useFormStatus`.

**Para PDFs de etiquetas corresponde el Patrón A.** Razones concretas:
- La UI **promete** que no se sube: *"Todo se procesa en tu navegador, no se sube a ningún lado"*
  (`etiquetas-ml.tsx:62`) y *"Se procesa en tu navegador"* (`picking.tsx:126`).
- Los `import/*` están detrás de `CRON_SECRET`, que el browser logueado no tiene → habría que
  escribir auth de sesión nueva (como hicieron `/api/picking` y `/api/correo/pedidos`).
- Evita el límite de body de Vercel y el `maxDuration` para un PDF de 100+ etiquetas.
- Los datos de destinatario (nombre, dirección, teléfono) no salen de la máquina.

### 4.2 `components/ui/dropzone.tsx`

```tsx
<Dropzone accept="application/pdf" multiple busy files={[{name,size}]}
          onFiles={(fl: FileList) => …} onClear={() => …} hint={…} />
```
Drag-and-drop + click, `role="button"`, `tabIndex=0`, Enter/Space, spinner con `busy`,
lista de archivos con nombre + tamaño formateado + quitar. Tiene su propio `<Spinner>` interno.

Nota: `picking.tsx` **no** lo usa (usa `<input type="file" multiple>` pelado) — inconsistencia
existente; `Dropzone` ya soporta `multiple`.

### 4.3 Qué corre en browser y qué en server — la rama del worker

Ambos módulos de lectura repiten exactamente este bloque:

```ts
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
pdfjs.GlobalWorkerOptions.workerSrc =
  typeof window === "undefined"
    ? import.meta.resolve("pdfjs-dist/legacy/build/pdf.worker.min.mjs")   // Node (tests)
    : new URL("pdfjs-dist/legacy/build/pdf.worker.min.mjs", import.meta.url).toString();
```

Tres decisiones deliberadas:
1. **build `legacy`** — *"corre también en Node (vitest); el moderno exige DOMMatrix"*.
2. **import dinámico** — pdfjs es pesado; no entra al bundle inicial. En `correo.tsx` el
   `await import("@/lib/correo-pdf")` es dinámico **también a nivel del módulo entero**.
3. **`input.slice(0)`** — pdfjs deja el ArrayBuffer *detached*. Sin la copia, el segundo uso
   del mismo buffer falla. `etiquetas-ml.tsx` lo maneja con un `useRef`.

O sea: `label-picking.ts` y `correo-pdf.ts` **corren en los dos lados**. La leyenda
"Solo cliente" describe dónde se los usa en producción (por privacidad), no una restricción técnica.
`split-labels.ts` (pdf-lib puro) es isomorfo sin trucos.

---

## 5. Convenciones del repo

### 5.1 Estructura de una página del dashboard

```
app/(dash)/<nombre>/page.tsx      → server component, default export async
app/(dash)/<nombre>/<tool>.tsx    → "use client", named export (Picking, CorreoTools, EtiquetasMl)
app/(dash)/<nombre>/actions.ts    → server actions ("use server") — ver caja/, stock/, trabados/
```
`app/(dash)/layout.tsx` envuelve con `<Nav>` (dentro de `<Suspense>`, porque lee `useSearchParams`),
`<SaludBanner>` y `<ChatWidget>`. Contenedor `mx-auto w-full max-w-6xl p-4`.

Server components que leen datos vivos declaran `export const dynamic = "force-dynamic"`.

### 5.2 Navegación

`components/nav-link.tsx`: tres grupos de links. `/logistica` está en el grupo "Operación".
Los sub-tabs son un array aparte:
```ts
const LOGISTICA: [string, string][] = [
  ["picking","Picking del día"], ["correo","Correo Argentino"], ["etiquetas","Etiquetas ML"],
];
```
Se renderizan indentados **solo cuando `path === "/logistica"`**. Decisión explícita: la barra de
tabs vivía dentro de la página y era invisible desde otros paneles; ahora la nav es la única
superficie de navegación.

### 5.3 shadcn

`components.json`: style `new-york`, baseColor `neutral`, cssVariables, rsc `true`,
iconLibrary `lucide`. Aliases `@/components`, `@/lib`, `@/components/ui`.

`components/ui/` tiene **solo 7 primitivas**: `badge`, `button`, `card`, `dropzone`, `spinner`,
`table`, `tooltip`. `dropzone` es propia (no shadcn oficial).

Las tablas de datos NO usan `components/ui/table.tsx` — usan `<table className="w-full text-sm">`
con `border-b`, `text-muted-foreground` en el thead y `tabular-nums` en las celdas numéricas.

Componentes compartidos van en `components/` a la raíz (no en `ui/`).

### 5.4 Tests — vitest

`package.json`: `"test": "vitest run"`, `"test:db": "node scripts/db-test.mjs"`.
`vitest.config.ts` solo espeja el alias `@` → `./`. Sin `environment` → **corre en Node**
(de ahí el build legacy de pdfjs).

Convención: `*.test.ts` **colocado al lado del módulo, en `lib/`**. Hay 19 archivos de test,
todos en `lib/`. **Cero tests de componentes.**

Se testea con **PDFs sintéticos armados con pdf-lib en el propio test**:
```ts
const doc = await PDFDocument.create();
const p = doc.addPage([841.89, 595.276]);
p.drawText(`DESTINATARIO #${orden}`, { x: 65, y: 253, size: 10, font });
```
`split-labels.test.ts` hace lo mismo con `[10*CM, 19*CM]` + una A4.
`label-picking.test.ts` no arma PDFs: testea `_parsePage` con **strings de texto real de etiquetas**
(el export `_parsePage` existe solo para eso). Es el patrón más barato y el que conviene extender.

Un test tiene `{ timeout: 20000 }` explícito por el `await import("pdfjs-dist")` lazy, que bajo
carga paralela se pasaba de los 5s default (falló ~5,5s el 22/07).

### 5.5 `maxDuration` y `vercel.json`

```json
{ "crons": [ {"path":"/api/sync/meta","schedule":"0 9 * * *"}, … ] }
```
**`vercel.json` NO tiene bloque `functions`.** El `maxDuration` se declara **por ruta**:
`export const maxDuration = <n>`. Valores en uso: 30, 60, 300. Varios comentarios dicen
*"Hobby máx 60s"* pero el team ya es **Pro desde el 04/08/2026** — los 300 de `chat`, `recompute`,
`urbano` y `shopify-backfill` confirman que 60 ya no es el techo.
El default de una ruta sin declaración es 10s.

### 5.6 Auth

`middleware.ts` protege todo **salvo `/api`** (Supabase Auth + whitelist `ALLOWED_EMAILS`).
Las rutas `/api` se autentican solas, y hay **dos esquemas**:
- **Sesión** (`sessionOk(req)`, duplicado literalmente en `/api/picking` y `/api/correo/pedidos`):
  `createServerClient` con las cookies del request + whitelist de mails.
- **Secret** (`badCronAuth(req)`): los `sync/*`, `import/*`, `salud/*`.

Una ruta nueva llamada desde el dashboard necesita el patrón **sesión**.

### 5.7 Estilo de código

Comentarios en **castellano rioplatense**, densos, explicando **por qué** y citando la fecha de
validación o el nº de auditoría (`audit C#3`, `audit §5`). Marcas `ponytail:` para simplificaciones
deliberadas con su techo (`scripts/redespacho.mjs:24`, `app/api/import/facturacion-urbano/route.ts:23`).
Mensajes de commit tipo `fix(<área>): <lo que estaba mal en una línea>`.

---

## 6. De dónde salen producto y unidades

### 6.1 Dos caminos, y `/logistica` usa el que NO es la base

| | Camino A — **el que usa /logistica** | Camino B — la base |
|---|---|---|
| Fuente | **Shopify Admin API en vivo** | Supabase `orders` + `order_items` |
| Vía | `/api/picking`, `/api/correo/pedidos` | RPCs / `sales_rows` |
| Para qué | operación del día | P&L |

Es lógico: las etiquetas se imprimen el mismo día y el sync a Supabase corre por cron —
la orden recién creada puede no estar todavía en la base.

### 6.2 Esquema (supabase/migrations/001_init.sql)

```sql
create table products (
  id serial primary key,
  name text unique not null,
  active boolean not null default true
);

create table product_costs (
  product_id int not null references products(id),
  pack int not null default 1,
  unit_cost numeric not null default 0,
  is_estimated boolean not null default false,
  primary key (product_id, pack)
);

create table orders (
  id bigserial primary key,
  shopify_id bigint unique not null,
  order_number text not null,          -- sin "#"
  created_at timestamptz not null,
  cancelled_at timestamptz,
  financial_status text,
  customer_name text, phone text, province text, city text, zip text,
  courier text check (courier in ('urbano','fixy')),   -- ojo: NO incluye 'correo'
  total numeric not null default 0,
  cod_amount numeric not null default 0,
  deposit_amount numeric not null default 0,
  tags text,
  raw jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index orders_number_idx on orders (order_number);

create table order_items (
  id bigserial primary key,
  order_id bigint not null references orders(id) on delete cascade,
  product_id int references products(id),
  pack int not null default 1,
  qty int not null default 1,
  unit_price numeric not null default 0,
  title_raw text
);
```

**Semántica de `pack` vs `qty`** (migración `006_pack_quantity.sql`, importante):
> *"pack = QUANTITY del line item de Shopify (el título es marketing '2x1' y NO lleva el pack;
> el regex match_pack colapsaba todo a 1). qty=1 (el costo se cuenta 1 vez por línea; la escala
> de costos es NO lineal). match_pack muere."*

O sea: **`pack` = unidades del pedido, `qty` = 1 casi siempre**. `matchPack` fue eliminado.
El costo se busca por `(product_id, pack)` en `product_costs`, no multiplicando.

`orders.courier` tiene un CHECK que **solo admite `urbano`/`fixy`** — Correo no está en esa
columna (llegó después, se resuelve por `tags`). En `/api/picking` el courier se saca de
`o.tags`, no de esta columna.

`024_producto_override.sql` agrega `orders.product_override` + trigger, porque los re-syncs
pisaban las correcciones manuales de `match_product`.

### 6.3 `match_product` (SQL) — canónica para orders y ads

`supabase/migrations/027_producto_m3.sql` (última versión; original en `002_rpcs.sql:14`):

```sql
create or replace function match_product(p_text text) returns int
language sql stable as $$
  select p.id
  from (values ('nature','Natures'), ('pureza','Pureza'), ('vein','Veinguard'),
               ('bee','BeeVenom'), ('altus','Altus'), ('reafirmante','M3')) k(kw, name)
  join products p on p.name = k.name
  where p_text ilike '%' || k.kw || '%'
  limit 1
$$;
```

Se invoca desde `upsert_order` con `match_product(coalesce(li->>'title',''))` y desde el sync de
ads con `ad_name || ' ' || campaign_name`.

> **`limit 1` sin `order by`** → con dos keywords presentes el resultado es no determinístico.
> Es exactamente el caso que la versión TS resuelve aparte con `matchAllProducts` → `revisar`.

### 6.4 `matchProduct` (TS) vs `match_product` (SQL) — la diferencia importa

| | SQL | TS |
|---|---|---|
| Archivo | `027_producto_m3.sql` | `lib/product-match.ts` |
| Devuelve | `products.id` (int) | nombre canónico (string) o `null` |
| Keywords | 6 | **7** |
| Diferencia | — | **`["revival","Revival Oil"]`** |

El comentario del TS explica el desfasaje **a propósito**:
> *"Revival Oil: se vende SOLO por MercadoLibre → nunca llega a orders/ads de Shopify, por eso no
> está en la versión SQL. Acá lo necesita el lector de etiquetas ML/Flex (/picking) para no
> marcarlo 'sin producto'."*

Encabezado del TS: *"Espejo TS de match_product en 002_rpcs.sql (la versión SQL es la canónica
para orders y ads — mantener sincronizados)"*. **Un producto nuevo hay que agregarlo en los dos
lados** (+ `insert into products` + `product_costs`).

### 6.5 De producto+unidades al código estampado

`lib/correo.ts`:

```ts
export function pickProducto(items: {title,quantity}[]): { producto: string|null; qty: number }
export function productoCode(p: ShopifyPedido): string | null {
  return p.producto ? `${p.producto[0].toUpperCase()}${p.qty}` : null;   // "B3"
}
```

`pickProducto` devuelve producto **solo si TODOS los ítems son el mismo** (carrito mixto → `null`,
código en blanco, se completa a mano — audit C#3, antes rotulaba mal con el 1er ítem y la qty total).

> ✅ **RESUELTO 09/08/2026: queda `B3` (letra + número) en todos lados.** Pancho eligió no cambiar
> el papel que el depósito ya lee. Además apareció un tercer lugar que este relevamiento no tenía:
> **`scripts/redespacho.mjs:45` estampaba `2B`** (número + letra) en las etiquetas de Urbano que
> genera — o sea los dos formatos YA convivían. Se dio vuelta a `B3` para que haya uno solo.

Colisión de letras a chequear: `Pureza`/`?` no colisiona, pero **`BeeVenom` y ninguna otra con B**;
`Veinguard` V, `Natures` N, `Altus` A, `M3` M, `Revival Oil` R. Hoy no hay colisión, pero el
esquema "primera letra" es frágil si entra un producto nuevo con inicial repetida.

---

## 7. Qué se reusa y qué falta construir

### 7.1 Se reusa tal cual

| Pieza | Archivo | Para qué |
|---|---|---|
| `extractLabels()` | `lib/label-picking.ts:87` | leer los 4 formatos, multi-archivo, ya devuelve `{page, courier, orden, producto, unidades, revisar}` |
| `_parsePage()` + su suite | `lib/label-picking.ts:24` | detección de courier y extracción de orden/pack, con 8 tests de texto real |
| `packBreakdown()` | `lib/label-picking.ts:81` | `"10×1 · 15×2 · 15×4"` |
| `/api/picking` | `app/api/picking/route.ts` | orden → producto+unidades, auth de sesión, chunks de 60, distingue error de no-encontrado |
| `stampCodes()` | `lib/correo-pdf.ts:26` | estampar con pdf-lib (hay que parametrizar la posición) |
| `mlLabelsTo10x15()` | `lib/split-labels.ts:17` | partir el 10×19 de ML |
| `matchProduct` / `matchAllProducts` | `lib/product-match.ts` | texto → producto canónico |
| `productoCode()` | `lib/correo.ts` | producto+qty → código (invertir a `3B`) |
| `<Dropzone>` | `components/ui/dropzone.tsx` | upload con drag&drop, ya soporta `multiple` |
| Patrón de `<Etiquetas>` | `logistica/correo.tsx:37` | parseá → proponé → tabla editable → estampá → descargá |
| pdf-lib + pdfjs-dist | `package.json` | **sin dependencias nuevas** |

### 7.2 Falta construir

1. **Reordenar páginas.** No existe nada. Es lo más simple del lote: `PDFDocument.create()` +
   `copyPages(src, indicesEnElOrdenQueQuieras)` + `addPage`. La clave de orden sale de cruzar
   `Label.page` con el producto/unidades ya resueltos. **~15 líneas.**

2. **Generalizar el estampado a Urbano y Fixy.** `stampCodes` tiene `x:95, y:88, size:26`
   hardcodeado y validado **solo para Correo**. Hace falta:
   - medir `page.getSize()` de una etiqueta real de cada courier (dato **no relevado** en el repo);
   - decidir posición por courier, o la estrategia relativa de `redespacho.mjs`
     (centrado horizontal, offset desde el borde) que funciona con cualquier geometría;
   - confirmar si la de Urbano es 15×10 apaisada — **el repo solo afirma 10×15 para las que baja
     de la API de Urbano**, nada sobre las que se suben.

3. **Invertir `B3` → `3B`** y decidir si aplica también al tab Correo existente (ver §6.5).

4. **Unir split + orden en ML.** `mlLabelsTo10x15` (geometría) y `extractLabels` (texto) hoy no se
   hablan: uno mira tamaños, el otro texto. Para (d) hay que correr los dos sobre el mismo PDF y
   usar el `producto`/`unidades` de la página *i* para ordenar la salida.
   **Cuidado con el índice**: si `mlLabelsTo10x15` descarta la hoja A4 (`skipped`), los índices
   de entrada y salida dejan de coincidir — hoy la función **no devuelve el mapeo de páginas**,
   solo el contador. Es el único cambio de firma que probablemente haga falta.

5. **Cruce Shopify para COD antes de estampar.** Ya resuelto en `picking.tsx` (chunks de 60,
   manejo de `error` vs `noEncontrado`) — hay que reusar esa función, no reescribirla.

### 7.3 Riesgos y trampas a nombrar en el prompt

- **`slice(0)` siempre**: pdfjs deja el ArrayBuffer detached. Si el PDF se lee (pdfjs) *y* se
  escribe (pdf-lib), hacen falta dos copias o un `useRef` como en `etiquetas-ml.tsx`.
- **Nada de subir el PDF al server**: rompe la promesa explícita de la UI y no hay ruta con auth
  de sesión que acepte archivos.
- **ML no tiene nº de orden** — el `#262382468` es el vendedor. El producto se lee de la etiqueta.
- **`"1 Unidad"` ≠ pack** en ML.
- **Etiquetas ML mixtas / multi-compra** no se pueden ordenar automáticamente (`revisar:true`).
  Necesitan un cajón "revisar a mano" en la salida, no ser ordenadas a ciegas.
- **Duplicar la whitelist de tabs** en `page.tsx` y `nav-link.tsx` si se agrega un tab.
- **`match_product` SQL y `matchProduct` TS se mantienen a mano** — si entra un producto nuevo,
  van los dos.
- **`orders.courier` no admite `'correo'`** — el courier real sale de `tags`.
- El `?` de `LabelCourier` hoy tapa dos casos distintos: hoja de resumen (esperada, ignorable) y
  etiqueta no reconocida (bug). Si el PDF de salida se reordena, una página `?` no puede
  simplemente desaparecer — hay que decidir dónde va.
