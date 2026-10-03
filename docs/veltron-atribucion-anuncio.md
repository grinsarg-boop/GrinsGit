# Veltron · Atribución anuncio → pedido en el form COD (tenant `biolabs`)

Pedido de BioLabs para implementar en Veltron. Objetivo: que **cada pedido nazca con el ID del anuncio de
Meta que lo trajo**, guardado en el pedido de Shopify y en el pedido/cliente de Veltron.

---

## 1. Contexto

- Los anuncios de Meta llevan en la URL de destino `utm_content={{ad.id}}` (ID numérico de 18 dígitos).
  Ejemplo: `https://biolabsarg.com/products/<handle>?utm_content=120243737909300152`.
- Hasta el **05/07/2026** los pedidos COD los creaba una app de Shopify que guardaba ese valor en
  `note_attributes` del pedido (~92 % de cobertura).
- Desde la migración al form de Veltron (`sections/veltron-cod-checkout-form.liquid` → webhook n8n
  `cod-checkout?tenant=biolabs` → alta en Shopify, `source_name = cod-form`), los pedidos llegan con
  `note_attributes` vacío. El payload `data{}` del form no incluye ni la URL ni ningún `utm_*`.
- Desde el 16/08/2026 BioLabs lo parchó por afuera: un bloque al final del `<script>` del form manda
  `{phone, ad_id, handle}` a un endpoint propio y después se cruza con el pedido por teléfono. Funciona
  (~87 % en septiembre), pero es un cruce indirecto. Queremos el dato **en el pedido mismo**.

## 2. Qué hay que hacer

### R1 — Form: capturar y persistir el anuncio

Al cargar cualquier página que tenga el form:

1. Leer de `location.search`: `utm_content` (obligatorio), y si están, `utm_source`, `utm_medium`,
   `utm_campaign`, `fbclid`.
2. Validar `utm_content` con `/^\d{6,25}$/`. Si no pasa, ignorarlo.
3. Si es válido, guardarlo en una **cookie first-party de 7 días** (`path=/`, `SameSite=Lax`) y también
   en `sessionStorage`. Guardar además la URL de entrada (`location.href`) de esa visita.
   - Modelo **último clic**: si llega un `utm_content` nuevo, pisa al anterior.
   - 7 días = la ventana de clic por defecto de Meta. La cookie cubre a la clienta que entra por el
     anuncio, cierra, y vuelve a comprar otro día sin el parámetro en la URL (hoy eso se pierde).
4. Todo envuelto en `try/catch`: si la cookie o el storage están bloqueados, se sigue sin el dato.

### R2 — Form: mandarlo en el payload

Agregar al objeto `data` que se postea a n8n:

```js
utm_content:  "120243737909300152",   // de la cookie/storage/URL, o null
utm_source:   "fb",                   // opcional
utm_medium:   "paid",                 // opcional
utm_campaign: "...",                  // opcional
fbclid:       "...",                  // opcional
landing_url:  "https://biolabsarg.com/products/...?utm_content=..."  // opcional
```

### R3 — n8n (`cod-checkout`): escribirlo en el pedido de Shopify

Al crear la orden, poblar `note_attributes`. **El nombre tiene que ser exactamente `utm_content`** —
el reporting de BioLabs lee ese nombre y con eso lo toma automático, sin cambios de nuestro lado:

```json
"note_attributes": [
  { "name": "utm_content", "value": "120243737909300152" },
  { "name": "utm_source",  "value": "fb" },
  { "name": "utm_campaign","value": "..." },
  { "name": "fbclid",      "value": "..." },
  { "name": "landing_url", "value": "https://biolabsarg.com/products/..." }
]
```

Si no hay `utm_content`, no escribir la entrada (no mandar `""` ni `"null"`). El `note` actual
(`Canal: … | Pago: … | Oferta: …`) queda como está.

### R4 — Veltron: guardarlo en el pedido y en el cliente

- En el **pedido**: `ad_id` (= `utm_content`) y el resto de los `utm_*` que lleguen.
- En el **cliente** (por teléfono): `primer_ad_id` (el que lo trajo la primera vez, no se pisa) y
  `ultimo_ad_id` (el del pedido más reciente).
- Exponer `ad_id` en `ver_pedido`, `listar_pedidos` y en los CSV de exportación.

### R5 — Nunca bloquear la venta

Nada de esto puede impedir que el pedido se cree. Valor inválido, cookie bloqueada o error en la
captura → el pedido sale igual, sin el dato.

### R6 — No tocar el bloque de BioLabs

Al final del `<script>` de `sections/veltron-cod-checkout-form.liquid` hay un bloque que empieza con
`var ATRIB_URL = 'https://biolabs-finanzas.vercel.app/api/atribucion';` (copiado abajo, §4). **Tiene que
quedar intacto** en cualquier edición de la sección: queda como respaldo y alimenta el cruce de los
pedidos actuales.

## 3. Criterios de aceptación

| # | Prueba | Resultado esperado |
|---|---|---|
| 1 | Entrar con `?utm_content=123456789012345678`, cambiar de variante (se pierde la query), comprar | Pedido de Shopify con `note_attributes` → `utm_content = 123456789012345678`. Pedido de Veltron con `ad_id` |
| 2 | Entrar sin `utm_content`, comprar | Pedido normal, sin entrada `utm_content` |
| 3 | Entrar con `utm_content`, cerrar la pestaña, volver al día siguiente sin parámetro, comprar | El pedido lleva el `ad_id` de la cookie |
| 4 | Entrar con `?utm_content=abc` | Se ignora, pedido sin `utm_content` |
| 5 | Entrar con anuncio A, después con anuncio B, comprar | Lleva B (último clic). En el cliente: `primer_ad_id = A` si era cliente nuevo |
| 6 | Forzar un error en la captura (p. ej. storage bloqueado) | El pedido se crea igual |

Al terminar, avisar **fecha y hora de salida a producción** para que BioLabs mida la cobertura desde ese
momento.

## 4. Referencia: el bloque actual de BioLabs (versión viva al 21/09/2026)

Muestra cómo se lee el parámetro hoy. No reemplazarlo: R1–R2 van en el flujo principal del form.

```js
var ATRIB_URL = 'https://biolabs-finanzas.vercel.app/api/atribucion';
try {
  var atribAd = null;
  try { atribAd = new URLSearchParams(location.search).get('utm_content'); } catch(e) {}
  /* La compradora puede navegar variantes antes de comprar y ahí la query se pierde. */
  if (atribAd) { try { sessionStorage.setItem('cod_ad_id', atribAd); } catch(e) {} }

  var atribEnviado = '';
  $('fPhone').addEventListener('blur', function() {
    try {
      var ad = atribAd;
      if (!ad) { try { ad = sessionStorage.getItem('cod_ad_id'); } catch(e) {} }
      /* El teléfono va crudo: el cruce usa los últimos 8 dígitos, que sobreviven a cualquier
         normalización de prefijo (+54, el 9, el 15). */
      var ph = this.value.replace(/\D/g, '');
      if (!ad || !/^\d{6,25}$/.test(ad) || ph.length < 8 || ph === atribEnviado) return;
      if (!navigator.sendBeacon) return;
      atribEnviado = ph;
      navigator.sendBeacon(ATRIB_URL, new Blob(
        [JSON.stringify({ phone: ph, ad_id: ad, handle: S.handle })], { type: 'text/plain' }));
    } catch(e) {}
  });
} catch(e) {}
```

## 5. Histórico (opcional)

BioLabs tiene el cruce pedido → anuncio para **marzo–junio 2026** (~90 % de los pedidos) y desde el
**16/08/2026** en adelante. Del **06/07 al 15/08/2026** el dato no existe en ningún lado: el payload del
form nunca llevó la URL, así que tampoco está en las ejecuciones de n8n. Si Veltron quiere cargar el
histórico en sus clientes, BioLabs puede pasar un CSV `order_name, phone, ad_id, created_at`: indicar
el formato que prefieran.
