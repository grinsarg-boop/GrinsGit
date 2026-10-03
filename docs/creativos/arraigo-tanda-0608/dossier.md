# ARRAIGO · Dossier de la tanda del 06/08/2026 (medido por Graph API el 01/09/2026)

Fuente: Graph API en vivo sobre `Tienda R 3` (`act_1569698667101520`), campaña
`ARRAIGO · ABO Open · 06-08` (id `120251431480890257`). Ventana: últimos 90 días.
**Todo pausado hoy.** ARRAIGO no tiene pauta viva en Meta al 01/09/2026.

## El producto y la economía

- **ARRAIGO**: sérum capilar anticaída. Romero + cafeína + Capixyl™. 30 ml = 1 mes de uso.
  Aplicación: 60 segundos por día, sin enjuague. Posicionamiento explícito: **SIN MINOXIDIL**.
- **Grilla COD** (Veltron → landing Shopify, formulario, paga al recibir):
  - x1 $49.900 (ancla, no se pautea)
  - x2 $79.900
  - **x3 + dermaroller $89.900** ($29.966/frasco, 40% off) — "Tratamiento completo · 90 días", **preseleccionado**
- **Costo**: $3.817 el frasco terminado + $3.700 el aplicador.
- **Break-even CPA por orden despachada** (medido 09/08/2026, entrega 54,1% blended, comisión COD 5,547% restada):
  **x1 $13.587 · x2 $21.793 · x3 vivo $27.950.**
- El número viejo "CPA objetivo $12.884" (el que muestra el panel Veltron por unidad) está
  **desactualizado hacia abajo**: sobreestimaba el techo del x1 1,9×.
- **Objetivo que pide Pancho para esta tanda nueva: CPA ~$6.000 en Meta.**
  Contra el break-even del x3, eso es 4,7× de colchón. Es una meta de eficiencia, no de supervivencia.

## Lo que pasó: la tanda entera

Gasto $114.036 · 10 compras · **CPA $11.403** · CTR 3,68% · 17.657 impresiones · frecuencia 1,69.

| Anuncio | Formato | Gasto | Compras | CPA | CTR | CTR saliente | LPV | $/LPV |
|---|---|---|---|---|---|---|---|---|
| `ugcB-copyA-molde` | video UGC | $49.067 | 4 | $12.267 | 4,51% | 3,89% | 202 | $243 |
| `ugcB-copyD-antiriesgo` | video UGC | $16.184 | 2 | $8.092 | **5,11%** | **4,63%** | 87 | $186 |
| `ugcB-copyC-identificacion` | video UGC | $8.032 | 1 | $8.032 | **5,14%** | **4,99%** | 54 | **$149** |
| `ugcB-copyB-sinminoxidil` | video UGC | $3.560 | 2 | $1.780* | 3,63% | 3,42% | 11 | $324 |
| `ba-raya` | estática | $19.313 | 1 | $19.313 | 2,01% | 1,40% | 36 | $536 |
| `mecanismo-916` | estática | $8.718 | 0 | — | 2,77% | 1,33% | 10 | $872 |
| `ba-entradas` | estática | $7.562 | 0 | — | 2,08% | 1,51% | 11 | $687 |
| `timeline-90dias` | estática | $565 | 0 | — | 2,31% | 1,54% | 2 | $283 |
| `cepillo-mes1-mes3` | estática | $1.034 | 0 | — | 1,03% | 1,03% | 1 | $1.034 |

\* `copyB` con $3.560 de gasto y 2 compras es ruido estadístico, no un ganador.

### Retención de video (los 4 comparten el MISMO archivo)

| Anuncio | Plays | p25 | **hook rate** | ThruPlay | p100 | Avg. watch |
|---|---|---|---|---|---|---|
| `copyC-identificacion` | 1.252 | 503 | **40,2%** | 365 (29,2%) | 235 | 8 s |
| `copyD-antiriesgo` | 2.133 | 830 | **38,9%** | 555 (26,0%) | 343 | 7 s |
| `copyA-molde` | 6.300 | 2.307 | 36,6% | 1.509 (24,0%) | 962 | 7 s |
| `copyB-sinminoxidil` | 419 | 142 | 33,9% | 75 (17,9%) | 56 | 5 s |

## ⚠️ El hallazgo estructural: la tanda tuvo 2 hipótesis, no 9

- **Los 4 anuncios de video son el MISMO video** (`ugcB`) con 4 textos distintos. Verificado:
  los 4 thumbnails del frame 0 son byte-idénticos (md5 `f06ab22409e0ebdebfb3adb8112e47ef`).
- **Las 5 estáticas comparten UN ÚNICO body**, palabra por palabra: el copy `sinminoxidil`.
  O sea que ni siquiera testearon copy entre ellas: variaron solo el arte.
- Resultado: 9 anuncios, **1 video + 5 artes**, y el copy solo se testeó dentro del video.
  El Protocolo-Creativos de la casa ya lo dice: *"el hit rate no escala con piezas, escala con
  hipótesis"*. Esta tanda es exactamente el error que el protocolo prohíbe.
- Agravante de mecánica de entrega: los 9 anuncios corrieron en **2 ad sets**
  (`...485570257` con 7 anuncios, `...484900257` con 3). Por el hallazgo 7/7 del 06/08
  (*"el anuncio que arranca perdiendo no se recupera"*), con 7 anuncios en un ad set casi
  todos murieron sin veredicto propio. `copyA` se comió el 43% del gasto de la campaña.

## Los 4 copys, textuales

- **A · molde**: "Solo 60 segundos por día. Romero y cafeína sobre la raíz para frenar la caída y
  recuperar densidad en la raya y la coronilla. Tratamiento de 90 días. Pagás cuando lo recibís."
- **B · sinminoxidil**: "¿Querés frenar la caída pero no querés empezar con minoxidil? Esto es
  romero y cafeína. No genera dependencia. 60 segundos por día."
- **C · identificacion**: "Si se te está abriendo la raya, esto es para vos. Sin minoxidil.
  Pagás cuando te llega."
- **D · antiriesgo**: "No pagues por adelantado un tratamiento que no sabés si te va a funcionar.
  Probalo, pagalo cuando lo tengas en la mano."

Headline en los 9: **"Envío Gratis 📦"**. CTA en los 9: `GET_OFFER_VIEW`.

## Lectura de las estáticas (miradas, no inferidas)

- **`ba-raya`** (la que más gastó de las 5, CPA $19.313): antes/después de la raya en dos fotos
  lado a lado, "DÍA 1" / "DÍA 90", título "LA RAYA, 90 DÍAS DESPUÉS". **La diferencia entre las
  dos fotos es casi imperceptible** — hay que buscarla. Abajo, en letra chica: "Imágenes
  ilustrativas". Un antes/después que no muestra el después no compra credibilidad: la gasta.
- **`mecanismo-916`** (CTR saliente 1,33%, 0 compras): packshot bien producido — mano con gotero
  sobre la coronilla, frasco de ARRAIGO en primer plano, baño con azulejos verdes. Estéticamente
  la mejor pieza de la tanda y la que peor convirtió. No tiene problema, no tiene persona que
  hable, no tiene tensión: es una foto de producto. En frío no arranca.

## Qué dice esto para la tanda nueva

1. **El video UGC gana por goleada al arte fijo**: CTR saliente 3,4-5,0% contra 1,0-1,5%.
   Todo el presupuesto nuevo va a video.
2. **El eje que mejor engancha es el anti-riesgo + identificación** (`copyD` y `copyC`:
   hook rate 39-40%, CTR saliente 4,6-5,0%, el $/LPV más barato de la tanda). El de peor
   arranque es el que lidera con ingrediente (`copyB`).
3. **`copyA` no fue el mejor anuncio: fue el que Meta eligió.** Se llevó el 43% del gasto de la
   campaña y tiene el peor CPA de los cuatro videos ($12.267). Su ventaja fue de entrega, no de
   performance — leerlo como ganador sería leer el reparto de Meta, no el mercado.
4. **El límite real de la lectura**: 10 compras en total. Ningún CPA por anuncio de esta tabla
   tiene significancia. Lo que sí es sólido y direccional es CTR, hook rate y $/LPV,
   donde el n es de miles.
5. **Para el veredicto de la próxima**: usar Initiate Checkout, no compras. El ratio medido de
   la casa es 2,54 IC por compra; con CPA objetivo $6.000, el equilibrio por IC es **~$2.360**.
