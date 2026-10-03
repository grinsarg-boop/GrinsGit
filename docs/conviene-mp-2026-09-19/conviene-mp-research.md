# ¿Conviene Mercado Pago embebido (Bricks) en el checkout propio en vez del link de Checkout Pro?
Research web — 19/09/2026. Solo lectura. Fuentes oficiales de MP (help center + developers + landing), Shopify (pricing AR + help center), Gobierno AR, y blogs marcados como tales.

Contexto del negocio: e-commerce COD en Shopify AR con form propio (Veltron). Hoy "3 cuotas sin interés" = crear preferencia Checkout Pro → popup con `init_point`; si el popup se bloquea, link por WhatsApp.

---

## 0. Respuesta corta

1. **La comisión de MP es la misma para Checkout Pro, Bricks y Checkout API.** El help center tiene una sola tabla "Checkout" y la landing muestra un solo precio para los tres. Embeber no ahorra ni cuesta más en comisión. CABA (vigente 06/03/2026, sin IVA): **6,29% al instante / 4,39% a 10 días / 3,39% a 18 días / 1,49% a 35 días**. Link de pago: idéntico.
2. **Cuotas sin interés absorbidas por el vendedor (vigente 10/02/2026, sin IVA): 3 cuotas = 10,49%, 6 cuotas = 18,69%** (2: 7,79%; 9: 26,49%; 12: 32,29%; 18: 41,59%). Se suma a la comisión por cobro. **Cuota Simple (el programa estatal) terminó el 30/06/2025 y no se renovó** — no hay tasa subsidiada vigente; la landing de MP que dice "activar Cuota Simple" está desactualizada.
3. **Bricks sí se embebe en una página propia** (el cliente no sale del sitio para tarjeta), **requiere backend propio** (POST `/v1/payments` con el token + `X-Idempotency-Key`), **PCI = SAQ A** (autoevaluación, sin auditoría externa por debajo de 6M tx/año), **soporta las cuotas sin interés configuradas en "Costos y cuotas"** (con `minInstallments`/`maxInstallments`). **Pero dinero en cuenta y Cuotas sin Tarjeta redirigen igual a mercadopago.com** (vía `preferenceId`). Y MP dice oficialmente que **Checkout Pro tiene mejor tasa de aprobación** que el transparente.
4. **Integración oficial MP↔Shopify checkout nativo existe** (apps "Mercado Pago Checkout Pro", "Mercado Pago Tarjetas" = Checkout API embebido, y "Cuotas sin Tarjeta"), con cuotas sin interés configurables desde el panel de MP. Costo: comisión de MP **+ cargo Shopify por pasarela externa: Basic 2% / Grow 1% / Advanced 0,6% / Plus 0,2%** (pricing AR, visto 19/09/2026). Shopify Payments no está en Argentina. Los pedidos con **pago manual (COD) o marcados como pagados no pagan ese cargo** — el flujo actual del form propio no lo paga; pasar al checkout nativo de Shopify sí lo pagaría.
5. **Conversión: no hay dato serio publicado** de MP ni Shopify comparando Bricks vs Checkout Pro vs link diferido. Lo único oficial es cualitativo (MP: "Tarjetas… reduce el abandono de carritos", y a la vez "Checkout Pro presenta una mejor tasa de aprobación"). Los "35-45% redirect vs 50-65% embebido" que circulan son de blogs de proveedores de pagos, sin metodología. Baymard (22/09/2025): abandono promedio 70,22%; 19% abandona por "no confío en el sitio con mi tarjeta" y 17% por "checkout demasiado largo/complicado".

---

## 1. Tarifas vigentes de Mercado Pago Argentina (2026)

### 1.1 Comisión por cobro con Checkout (Pro / Bricks / API) — FUENTE OFICIAL
Fuente: https://www.mercadopago.com.ar/ayuda/33399 ("¿Cuánto cuesta recibir pagos con Checkout?") — texto: "Costos vigentes a partir del 6 de marzo de 2026." "Estos costos no incluyen IVA o retenciones." "*Para las tarjetas de crédito extranjeras y tarjeta Sucrédito, el costo se incrementará un 3%."
Aplica a "Todos los medios de pago (tarjeta de crédito, débito y prepaga, efectivo, Cuotas sin Tarjeta, dinero en Mercado Pago)".

| Provincia del domicilio | Al instante | 10 días | 18 días | 35 días |
|---|---|---|---|---|
| CABA, Corrientes, La Pampa, Misiones, Neuquén, Salta, San Luis, T. del Fuego, Tucumán, Jujuy | **6,29%** | **4,39%** | **3,39%** | **1,49%** |
| Buenos Aires, Chubut, Entre Ríos, Córdoba | 6,60% | 4,61% | 3,56% | 1,56% |
| Catamarca, Formosa, Mendoza | 6,46% | 4,51% | 3,48% | 1,53% |
| Chaco, San Juan, Santa Cruz, Sgo. del Estero | 6,19% | 4,32% | 3,34% | 1,47% |
| La Rioja | 6,49% | 4,53% | 3,50% | 1,54% |
| Río Negro | 6,39% | 4,46% | 3,44% | 1,51% |
| Santa Fe | 6,42% | 4,48% | 3,46% | 1,52% |

Nota: los plazos oficiales son **instante / 10 / 18 / 35 días** (no existe "14 días" en la tabla actual).

**¿Hay diferencia Pro vs Bricks/API?** No. El help center tiene una sola nota "Checkout" (33399) sin distinguir producto, y la landing https://www.mercadopago.com.ar/herramientas-para-vender/check-out (vista 19/09/2026) presenta Checkout Pro, Checkout Bricks y Checkout API y una sola tabla de precios debajo: "En 35 días 1,49% +IVA / En 18 días 3,39% +IVA / En 10 días 4,39% +IVA / Al instante 6,29% +IVA. Los costos pueden variar de acuerdo a los impuestos provinciales."

### 1.2 Link de pago — FUENTE OFICIAL
Fuente: https://www.mercadopago.com.ar/ayuda/33392 — misma tabla exacta que Checkout (6,60/4,61/3,56/1,56 en Bs. As.; 6,29/4,39/3,39/1,49 en CABA), "Costos vigentes a partir del 6 de marzo de 2026."

### 1.3 Costo por ofrecer cuotas sin interés (lo absorbe el vendedor) — FUENTE OFICIAL
Fuente: https://www.mercadopago.com.ar/ayuda/3299 ("¿Cómo ofrezco cuotas sin interés con Mercado Pago?") — "Costos vigentes a partir del 10 de febrero de 2026." "Estos costos no incluyen IVA o retenciones." "Recibirás el dinero en tu cuenta de Mercado Pago como siempre, menos el costo por cobro y el costo por ofrecer cuotas sin interés." "si ofrecés hasta 6 cuotas y la persona que compra quiere pagar en 3, en esa venta pagarás el costo correspondiente a 3 cuotas."

| Cuotas | Costo (sin IVA) |
|---|---|
| 2 | 7,79% |
| **3** | **10,49%** (* activa también Plan Z de Naranja X, mismo costo) |
| **6** | **18,69%** |
| 9 | 26,49% |
| 12 | 32,29% |
| 18 | 41,59% |

Confirmación cruzada: https://www.mercadopago.com.ar/ayuda/costos-de-financiamiento-de-point_2610 (Point) tiene la misma tabla con "Costos vigentes a partir del 4 de mayo de 2026". https://www.mercadopago.com.ar/ayuda/32671: aplica a "Point, Código QR, Link de pago, Checkout, etc." y se configura "hasta cuántas cuotas querés ofrecer y a partir de qué monto". Plan Z: https://www.mercadopago.com.ar/ayuda/17974 — "3 cuotas sin interés a tus clientes que tengan tarjeta de crédito Naranja X. Tu costo será el mismo que si cobrás en 3 cuotas sin interés."

**Costo total ejemplo (CABA, sin IVA → con IVA 21% sobre la comisión):**
- 3 cuotas, liberación al instante: 6,29 + 10,49 = **16,78%** → 20,30% con IVA.
- 3 cuotas, liberación 35 días: 1,49 + 10,49 = **11,98%** → 14,50% con IVA.
- 6 cuotas, al instante: 6,29 + 18,69 = 24,98% → 30,23% con IVA.
- 6 cuotas, 35 días: 1,49 + 18,69 = 20,18% → 24,42% con IVA.
(El IVA de la comisión es crédito fiscal si la empresa es RI.)

**Programa subsidiado vigente: NO hay.** Cuota Simple (Sec. de Comercio) tuvo tasas directas 3 cuotas 5,41% / 6 cuotas 10,31% (https://www.argentina.gob.ar/economia/comercio/cuota-simple/comerciantes, página aún online pero sin vigencia) y **venció el 30/06/2025 sin renovación** (El Cronista: https://cronista.com/finanzas-mercados/cuota-simple-finalizara-el-30-de-junio-y-no-sera-renovado ; Infobae 14/06/2025: https://www.infobae.com/economia/2025/06/14/se-termina-cuota-simple-a-fin-de-mes-que-opciones-de-financiacion-tendran-los-consumidores/ ; Tiendanube blog actualizado 17/07/2026: "Cuota Simple dejó de estar vigente el 30 de junio de 2025"). La FAQ de la landing de MP que dice "Para ofrecer hasta 3 o 6 cuotas… necesitás activar Cuota Simple" está desactualizada.

**Discrepancias con blogs (no oficiales, NO usar):** fortunaweb (10/09/2026) dice "4,9% 1 cuota, 6,8% 3 cuotas, 8,4% 6" — no coincide con ninguna nota oficial. Un resultado de búsqueda citaba "desde el 7 de abril de 2026: 9,79% 2 cuotas, 12,49% 3, 19,79% 6" — no lo encontré en ninguna página oficial de MP; la nota 3299 vigente (leída hoy) dice 7,79 / 10,49 / 18,69.

---

## 2. Checkout Bricks (Payment Brick / Card Payment Brick) en Argentina — FUENTES OFICIALES (developers)

- **¿Se embebe en página propia sin salir a MP?** Sí para tarjetas. Landing MP: "Checkout Bricks… Pagos sin salir de tu tienda. Tus clientes finalizan el pago en tu sitio." Requisito: "Los Bricks no cuentan con soporte oficial cuando se utilizan en flujos WebView en las plataformas Android e iOS" (https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/prerequisites). Requisitos: aplicación, cuenta vendedor, Public key + Access Token, SDK JS.
- **¿Requiere backend?** Sí. Tarjetas: "Con toda la información recopilada en el backend, envía un POST con los atributos requeridos al endpoint /v1/payments… deberás enviar obligatoriamente el atributo X-Idempotency-Key" (https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/payment-submission/cards). El Brick tokeniza la tarjeta en el front (callback `onSubmit` trae token, installments, payment_method_id, issuer_id, payer) y el server crea el pago con el Access Token. Además webhooks para confirmar estado.
- **¿Cuotas sin interés del vendedor?** Sí. Se configuran en la cuenta ("Costos y cuotas", ayuda/3299 y 32671, aplica a "Checkout"); en el Brick se limita el rango con `customization.paymentMethods.minInstallments / maxInstallments` (https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/advanced-features/configure-installments) y en la preferencia con `payment_methods.installments` (https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/advanced-features/preferences). La doc de Shopify "Tarjetas (Checkout API)" confirma que las cuotas sin interés del panel aplican al pago embebido de tarjeta (ver §3). No verifiqué en esta sesión el detalle de `installment_rate`/labels CFT del endpoint `/v1/payment_methods/installments` (página JS-only).
- **¿PCI?** https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/security/pci — tabla: Checkout Pro → SAQ A; Checkout Transparente (con Secure Fields/Bricks) → SAQ A; Web Tokenize Checkout → SAQ A-EP. "SAQ A… posee únicamente 22 requerimientos". Nivel 4 (<20.000 tx online/año): SAQ anual + escaneo ASV trimestral + AOC. "Mercado Pago puede exigir esta documentación debido a su rol como PSP." No hay certificación externa obligatoria por debajo de Nivel 1 (6M tx/año). Es autoevaluación; en la práctica MP no bloquea la integración por esto, pero es responsabilidad formal del comercio.
- **¿Dinero en cuenta de MP / Cuotas sin Tarjeta?** Payment Brick los lista ("tarjetas de débito y crédito, Pago Fácil, Rapipago, Cuenta de Mercado Pago y Financiación sin tarjeta" — https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/introduction), **pero redirigen**: "Los pagos con Cuenta de Mercado Pago y Cuotas sin Tarjeta… no necesitan ser enviados a través del backend. Si el usuario selecciona esta opción… el preferenceId enviado en la inicialización del Brick es el encargado de redirigir al comprador al sitio web de Mercado Pago, donde el pago se realizará directamente en nuestro sitio." (https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/payment-brick/payment-submission/wallet-credits). Es decir: con Bricks se queda en la página solo quien paga con tarjeta tipeada; el usuario logueado en MP (tarjetas guardadas, saldo, Mercado Crédito) se va a MP igual que hoy.
- **Aprobación (dato oficial cualitativo):** News MP 05/12/2023 (https://www.mercadopago.com.ar/developers/es/news/2023/12/05/Checkout--What-types-there-are-and-how-to-choose-the-best-one-for-your-website): Checkout Pro "Por tener una mayor cantidad de datos y desarrollarse dentro del ambiente de Mercado Pago, este checkout presenta una mejor tasa de aprobación"; "Quiero contar con… dinero disponible en cuenta y créditos. ¿Qué checkout usar? El Checkout Pro es la mejor elección, pero… se necesita que el comprador esté logueado en Mercado Pago." Para Checkout API/Bricks MP recomienda sumar 3DS 2.0 ("Antifraude Plus" en Shopify) para "aumentar la tasa de aprobación".
- **Mantenimiento:** SDK JS + endpoint propio + webhooks + manejo de estados (approved / in_process / rejected con `status_detail`) + contracargos gestionados desde la cuenta. Con Checkout Pro todo eso lo maneja MP.

---

## 3. Integración oficial Mercado Pago ↔ Shopify checkout nativo (AR, 2026) — FUENTES OFICIALES

- Existe y son tres apps (https://www.mercadopago.com.ar/ayuda/35671): **"Mercado Pago Checkout Pro"** ("tu cliente paga en una página externa de Mercado Pago"), **"Mercado Pago Tarjetas"** ("tu cliente paga directamente en tu tienda" = Checkout API embebido en el checkout de Shopify) y apps adicionales **"Mercado Pago Meses/Cuotas sin Tarjeta"** y "Mercado Pago Banner". "Podés habilitar ambas opciones."
- **Tarjetas (Checkout API):** https://www.mercadopago.com.ar/developers/es/docs/shopify/integration-configuration/checkout-cards — "permite pagos con tarjetas de débito o crédito directamente en el entorno de la tienda en línea, sin redirigir… reduciendo el abandono de carritos y aumentando las posibilidades de conversión" (sin número). "no es compatible con la función multi currency". Paso 3 "Configurar cuotas y costos": desde el "Panel Administrativo de Mercado Pago para Shopify → Cuotas y costos… Selecciona el medio de pago deseado para cambiar el plazo de liberación y si deseas ofrecer cuotas sin intereses en la tarjeta de crédito. Elige las cuotas que quieres ofrecer… Podrás definir los montos mínimos para cada plazo de cuotas sin intereses." Recomiendan instalar "Mercado Pago Antifraude Plus" (3DS 2.0). Requiere email como contacto obligatorio en checkout y captura automática.
- **Checkout Pro en Shopify:** https://www.mercadopago.com.ar/developers/es/docs/shopify/integration-configuration/checkout-pro — pago en ambiente MP "con sus medios de pago guardados, y regresa automáticamente a tu tienda"; misma pantalla de cuotas sin interés y liberación.
- **Cuotas sin Tarjeta en Shopify:** news 12/06/2025 https://www.mercadopago.com.ar/developers/es/news/2025/06/12/Mercado-Pago-Cuotas-sin-Tarjeta-now-available-on-Shopify (hasta 12 cuotas sin tarjeta, Mercado Crédito).
- **¿Cuotas sin interés desde el checkout de Shopify?** Sí, con cualquiera de las dos apps, configuradas en el panel MP (misma tabla 10,49% / 18,69%).
- **Comisión total = MP + Shopify.** Pricing Shopify Argentina (https://www.shopify.com/ar/pricing, leído en navegador 19/09/2026): Basic US$19/mes anual (US$25 mensual) "2 % proveedores de pagos externos"; Grow US$49/65 "1 %"; Advanced US$299/399 "0,6 %"; Plus desde US$2.300 "0,2 %". FAQ: "Es posible que se apliquen cargos por transacción de terceros si utilizas proveedores de pagos externos (en lugar de Shopify Payments)… Shopify Payments solo está disponible en algunos países" (no en Argentina — el pricing AR no lo ofrece).
- **Qué NO paga el cargo de Shopify:** https://help.shopify.com/en/manual/your-account/manage-billing/billing-charges/types-of-charges/third-party-charges/third-party-transaction-fees — "Transaction fees don't apply for POS orders or for manual payment methods, which include cash on delivery (COD), bank deposits, checks, test orders, and draft orders marked as paid or pending." Y https://help.shopify.com/es/manual/payments/third-party-providers/transaction-fees — "Se aplican cargos por transacción de terceros en todas las pasarelas de pago externas o alternativas, incluso cuando Shopify Payments está activado." Implicancia: **el flujo actual (form propio + pedido COD/marcado pagado + link MP) no paga el 2%; mover el pago de tarjeta al checkout nativo de Shopify con la app de MP sí lo paga** (2% en Basic sobre esos pedidos). Un Brick embebido en el form propio (fuera del checkout de Shopify) tampoco lo paga, porque el pedido entra como manual/marcado pagado — verificar cómo crea hoy Veltron el pedido en Shopify.

---

## 4. Conversión: embebido (Bricks) vs redirect (Checkout Pro) vs link después

- **MP oficial:** solo afirmaciones cualitativas y contradictorias entre sí según el producto que promocionan: Tarjetas/Checkout API "reduciendo el abandono de carritos y aumentando las posibilidades de conversión" (doc Shopify Tarjetas); Checkout Pro "presenta una mejor tasa de aprobación" y "óptima conversión de ventas" (news 05/12/2023). **Ningún número publicado.**
- **Shopify oficial:** pricing AR dice que su checkout "genera, en promedio, un 15% más de conversiones que otras plataformas" — es Shopify checkout vs otras plataformas, no embebido vs redirect; no aplica.
- **Estudios AR/LatAm 2024-2026:** no encontré ninguno con metodología que compare Bricks vs Pro vs link diferido. Lo más cercano es contexto de mercado sin comparación: easyappsecom (actualizado 19/03/2026) "60%+ de compras online usan cuotas sin interés" (sin fuente primaria).
- **Blogs de proveedores de pago (NO serio, sin metodología):** retailreach.com.au / north.com: "redirect 35-45% vs embedded 50-65%". No usar como dato.
- **Baymard Institute** (https://baymard.com/lists/cart-abandonment-rate, actualizado 22/09/2025 — serio, pero mercado US y no mide redirect específicamente): abandono promedio **70,22%** (50 estudios). Razones de abandono en checkout: 40% costos extra, 20% entrega lenta, **19% "no confío en el sitio con mi tarjeta"**, 18% crear cuenta, **17% checkout largo/complicado**, 17% errores del sitio, 10% tarjeta rechazada, 9% pocos medios de pago. Lectura para este caso: en AR el redirect a MP juega a favor de la confianza (19%) y en contra del largo (17%); no hay forma de saber el neto sin medirlo.
- **Conclusión honesta:** no hay dato serio. Lo medible internamente sí existe: cuántas preferencias creadas terminan `approved` (hoy), cuántas caen por popup bloqueado y cuántos links por WhatsApp se pagan y en cuánto tiempo. Eso es el único benchmark válido para decidir.

---

## 5. Otras pasarelas en AR con cuotas (referencia rápida)

- **Ualá Bis** (oficial, https://www.ualabis.com.ar/link-de-pago, vista 19/09/2026): link de pago "4,9% + IVA en tarjetas de crédito, débito y prepagas", acreditación inmediata; cuotas sin interés "al costo financiero se le suma la comisión" — tabla no publicada en la landing, se activa por mail (hola@ualabis.com.ar).
- **Getnet (Santander)** (oficial, https://www.getnet.net/ar/aranceles, vista 19/09/2026, vigencia no indicada): crédito 1 pago "hasta 2% + IVA" a 8 días hábiles / "hasta 6,75% + IVA" anticipado 24 h / "hasta 7,28% + IVA" inmediato; crédito en cuotas "hasta 2% + IVA" a 2 días hábiles; Plan Cuotas tasa directa: 2 cuotas 5,57%, **3 cuotas 7,41%**, 4: 9,20%, 5: 10,94%, **6 cuotas 12,64%** (TNA 50%). Es la referencia más barata para 3/6 cuotas, pero requiere integración propia (checkout Getnet) y no tiene wallet de MP.
- **Mobbex** (sitio de precios caído 502 hoy; blogs comparapasarelas 14/03/2026 y fortunaweb 10/09/2026, inconsistentes entre sí): débito ~2,09-2,45% + IVA, crédito ~3,59-5,6% + IVA según plan, acreditación 72 h; costo de cuotas no publicado.
- **Payway (Prisma)** (no encontré página oficial de costos; comparapasarelas 14/03/2026): débito 2,39%, crédito 3,89%, acreditación 5-7 días; cuotas no publicadas.
- **Shopify Payments:** no disponible en Argentina (pricing AR no lo ofrece; features marcadas "* Requiere Shopify Payments").
- Nota: MP en 35 días (1,49%) es más barato que todas las anteriores en comisión pura; la diferencia grande está en el costo de cuotas (MP 10,49% vs Getnet 7,41% para 3 cuotas; 18,69% vs 12,64% para 6).

---

## 6. Lectura para la decisión (sin ejecutar nada)

- **Comisión:** cambiar de link/Checkout Pro a Bricks **no cambia un peso** de comisión de MP. La palanca de costo real está en otro lado: el plazo de liberación (6,29% → 1,49% si se aguantan 35 días = 4,8 puntos) y en si se ofrecen 3 (10,49%) o 6 (18,69%) cuotas.
- **Qué gana Bricks:** el cliente con tarjeta tipeada no sale del form; desaparece el problema del popup bloqueado para ese segmento. Qué no gana: el que paga con saldo/tarjeta guardada/Mercado Crédito sigue yendo a MP; y MP dice que la aprobación es mejor en Pro.
- **Qué cuesta Bricks:** endpoint server-side de pago + idempotencia + webhooks + estados + SAQ A anual + posible 3DS para aprobación. No es un cambio de front.
- **Alternativa barata a probar antes:** reemplazar el popup por **redirect en la misma pestaña** (`init_point` con `back_urls` + `auto_return`), que MP soporta ("Esquema de apertura con redirect externo"). Elimina el bloqueo de popup sin backend nuevo ni PCI; se mide tasa `approved` antes/después con los datos propios.
- **Checkout nativo de Shopify con app MP:** técnicamente es lo más simple, pero implica abandonar el form Veltron para ese segmento y pagar el 2% (Basic) de Shopify sobre esos pedidos, además de perder el control del flujo COD.
