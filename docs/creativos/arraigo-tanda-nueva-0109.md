# ARRAIGO · Tanda nueva — PROPUESTA (corrida A, dry-run)

**Fecha:** 01/09/2026 · **Estado:** nada generado, nada gastado, nada lanzado.
**Objetivo pedido por Pancho:** CPA ~$6.000 en Meta.
**Insumos:** `docs/creativos/arraigo-tanda-0608/dossier.md` (la tanda de agosto medida por Graph) +
`docs/creativos/skinfinity-2026-09/analisis.md` (el competidor) + vault `20-Ads/` y
`50-Proyectos/Runbook-Lanzar-Anuncios-API.md` §6 quater.

---

## 0. Antes que nada: aclarar el objetivo, porque hay dos números de $6.000

El dossier de agosto tiene **dos** CPA distintos y los dos rondan la cifra:

| lectura | agosto | ¿ya pasa $6.000? |
|---|---|---|
| **CPA por pedido** | **$11.403** | **no — está 1,9× arriba** |
| CPA por unidad pedida | $4.958 | sí, ya pasaba (78% eligió x3) |

**Asumo que el objetivo es $6.000 por PEDIDO.** Si Pancho quería la métrica por unidad, la tanda
de agosto ya cumplía y esta tanda no tiene razón de ser. Vale la pena que lo confirme en una línea,
porque cambia todo el diseño del test.

Contra el break-even del x3 ($27.950 por pedido creado) el objetivo es 4,7× de colchón: es meta de
eficiencia, no de supervivencia. Agosto ya corría 2,45× debajo del break-even.

---

## 1. Diagnóstico de media buyer — de dónde salieron los $11.403

La descomposición aritmética del CPA (identidad, no modelo):

```
CPA = ($ por LandingPageView) ÷ (LPV→IC × IC→compra)
```

Con los números de agosto: **$275/LPV ÷ (7,7% × 31,3%) = $11.410**. Cierra con los $11.403 medidos.
Esos tres factores son las tres cosas que hay que separar, y separarlas es lo que decide si hacer
más videos sirve para algo.

### Los 5 bullets

**1 — Un tercio del presupuesto se fue en el formato ya medido como perdedor. Eso es creativo, y es la parte fácil.**
Las 5 estáticas se comieron **$37.192 (33% de la tanda) y trajeron 1 compra**. Costo por LPV: $620
contra $217 del video — 2,9×. Solo con haber corrido video puro, la tanda cerraba en **~$8.500**
(los 4 videos hicieron 9 de las 10 compras con $76.843). **Ahí está el 25% del gap, y no requiere
un solo guion nuevo: requiere no volver a comprar tráfico caro.**

**2 — La tanda no fue de 9 hipótesis: fue de 2, y el reparto lo decidió Meta, no el mercado.**
Los 4 videos son **el mismo archivo** (md5 idéntico de los 4 thumbnails) con 4 bodies; las 5 estáticas
comparten **un solo body** palabra por palabra. Y los 9 corrieron en 2 ad sets. Con el hallazgo 7/7 del
06/08 (*el anuncio que arranca perdiendo no se recupera; ninguno de 7 recuperó*), `copyA` se llevó el
**43% del gasto de la campaña** siendo el **peor CPA de los cuatro videos** ($12.267) y el peor $/LPV
de los tres que tuvieron volumen ($243). Los que enganchaban —`copyC` $149/LPV, `copyD` $186/LPV—
nunca vieron plata. **Esto es estructura de campaña, no creativo: el mejor mensaje de la tanda existía
y estaba financieramente asfixiado.**

**3 — El hook y el CTR NO son el problema. Están sanos y mejorando mientras las ventas caen.**
CTR de la tanda 3,68%, y el mejor 5,14%. Hook rate 34-40%. Comparación interna: Pureza 4,6-6,2%,
BeeVenom 2,5-3,2% — ARRAIGO está en la banda alta de la cuenta. Y el dato incómodo de los 3 días:

| día | gasto | compras | CPA | CTR |
|---|---:|---:|---:|---:|
| 06/08 | $56.977 | 6 | $9.496 | 3,05% |
| 07/08 | $36.763 | 3 | $12.254 | 3,99% |
| 08/08 | $20.293 | 1 | **$20.293** | **5,09%** |

**El CTR subió 67% mientras el CPA se duplicó.** Cualquier optimización que persiga CTR acá empeora
el resultado. *(Y ojo al día 3: gastó $20.293 de $30.000 — el conjunto no pudo entregar el
presupuesto. Hay un techo de entrega por público+creativo más abajo de lo que se asumía.)*

**4 — El cuello grande está entre llegar a la landing y abrir el formulario. Eso es landing/oferta, no creativo.**
Medido el día 1 sobre el conjunto de video: **8.381 impr → 187 clics → 133 LPV → 15 IC (11,3%) →
6 compras (40% de los IC)**. En la tanda completa: 414 LPV → 32 IC = **7,7%**.

🔧 **Corregido 01/09/2026 contra Graph API en vivo (90 días, mismas campañas, `omni_` directo).**
La versión anterior de esta tabla decía "Pureza 33% de LPV→IC". **Eso era falso**: el 33% es el
ratio *IC→compra* de `cbo-sinx1-pureza`, no su LPV→IC. Los ratios medidos:

| campaña (90d) | LPV | IC | **LPV → IC** | compras | **IC → compra** |
|---|---:|---:|---:|---:|---:|
| `abo-keepalive-pureza` | 19.399 | 3.399 | **17,5%** | 1.265 | 37,2% |
| `cbo-sinx1-pureza` | 13.741 | 2.110 | **15,4%** | 713 | 33,8% |
| `abo-keepalive-beevenom` | 6.282 | 775 | **12,3%** | 280 | 36,1% |
| **`ARRAIGO · ABO Open`** | 414 | 33 | **8,0%** | 10 | **30,3%** |

**El diagnóstico se sostiene, con dos precisiones que importan:**

1. **El gap de landing es 2×, no 4×.** ARRAIGO abre formulario a la mitad de la tasa de Pureza
   (8,0% contra 15,4-17,5%), no a un cuarto. La conclusión no cambia — sigue siendo la palanca más
   grande — pero el arreglo disponible es menor de lo que decía la versión anterior.
   Con n=414 LPV, el IC95% del 8,0% es 5,4-10,6%: no solapa con Pureza. **La diferencia es real.**
2. **Es falso que ARRAIGO "convierta como el mejor producto de la casa una vez que abre el
   formulario".** Su IC→compra de tanda es **30,3%**, *por debajo* de Pureza (33,8-37,2%) y de
   BeeVenom (36,1%). El 40% citado antes era del día 1 con n=15 IC. Con n=33 el intervalo es
   ancho (±15 pp), así que lo honesto es: **IC→compra no está diferenciado del resto de la cuenta,
   ni para bien ni para mal.** Todo el agujero medible vive en LPV→IC.

**La aritmética que sale de los números buenos:** a igual $/LPV ($275) y a igual IC→compra (30,3%),
llevar LPV→IC de 8,0% al 16,5% de Pureza da **CPA $5.500**. O sea que **el objetivo de $6.000 se
alcanza casi entero por landing, sin tocar un solo creativo.** Por el otro carril, llegar a $6.000
sólo bajando el $/LPV exige ir de $275 a **$145** — casi la mitad, con el embudo congelado.
Es mucho más de lo que este test puede prometer.

**5 — Hay dos bugs de oferta vivos que ninguna pieza nueva arregla y que cualquier pieza nueva puede empeorar.**
Los creativos dicen **$89.900**, Kaching cobra **$89.990**, y el FAQ de la landing dice *"A $89.900 los
tres"*. Es un campo de configuración. **Regla que propongo escribir ahora: ninguna pieza de esta tanda
nombra un precio hasta que el número sea uno solo en las tres superficies.** Aparte: el mix x3 al 78%
es el activo económico real del producto (el CPA se reparte sobre 3 frascos) y no está protegido por
ninguna vara — una tanda que traiga compradores de x1 puede bajar el CPA por pedido y triplicar el
CPA por unidad al mismo tiempo.

### Resumen de la separación

| tramo | ¿es el cuello? | ¿más videos ayuda? | tamaño estimado del arreglo |
|---|---|---|---|
| **Creativo (hook/CTR)** | no — está sano | poco, por sí solo | — |
| **Creativo (asignación de formato)** | sí, y es barato | sí: video puro | $11.403 → ~$8.500 |
| **Estructura de campaña** | sí | no, es lanzamiento | ~$8.500 → ~$7.000-7.500 |
| **Landing / LPV→IC** | **sí, el más grande** | **no** | ~$7.000 → ~$4.500-5.000 |
| **Oferta / bugs de precio** | riesgo, no cuello | no | protege lo que ya funciona |

Cruzado con la tabla de diagnóstico del `Protocolo-Creativos.md` §"si venimos flojos": **CTR sano +
pocos inician pago = post-click. Y ahí dice, textual, que más creativos NO ayuda.** Lo digo entero en
la sección 7.

---

## 2. Los 4 mensajes candidatos

La unidad es el mensaje (`Protocolo-Creativos.md` §3bis.1). Son 4 hipótesis distintas: cada una
ataca una creencia distinta del mercado, no es una variación de redacción de la anterior.

Lección estructural que traigo de Skinfinity y que vale más que cualquier guion: **40 anuncios, 7
copys. No reescribieron el ganador — le cambiaron el número del título y lo relanzaron.** Lo caro de
imitarles no es el video: es decidir cuál es nuestro "tapón de sebo" (la causa con nombre que sólo
nuestro activo resuelve) y después no tocarla en tres meses.

---

### M1 · "La raíz sin riego" — el mecanismo propietario con nombre

**Creencia que ataca:** *"se me cae por la edad / las hormonas / la genética; ya está, no hay nada que hacer."*

**Por qué puede ganarle a agosto:** agosto lideraba con el **ingrediente** (`copyB · sinminoxidil`), y
ese fue el peor arranque de los cuatro (hook rate 33,9%, $324/LPV). El ingrediente sin causa es un
commodity de Mercado Libre. Este mensaje convierte el romero en la respuesta a una causa que tiene
nombre — que es exactamente el movimiento con el que Skinfinity escaló tres meses.

**Qué le robo a Skinfinity:** la estructura de 5 bloques (hook negador → mecanismo con nombre →
reencuadre del fracaso previo → producto tarde con modo de uso → cierre por reversión de riesgo);
inventar la causa que justifica nuestro activo; ponerle **apodo y origen** al activo.

**Qué le dejo:** todo el aparato hormonal. DHT, sebo, "bloquea la hormona", la caja de Folcres,
"aprobado por ANMAT" como sello de eficacia. Son claims médicos sobre una condición y nuestro producto
es cosmético grado 2 — es la deuda de compliance de ellos, no la compramos.

**Nuestro apodo, y por qué es mejor que el de ellos:** ellos tuvieron que inventar una tribu mexicana.
Nosotros tenemos **el agua de romero de las abuelas** — real, argentino, y ya vive en la memoria de
la clienta. No hay que enseñárselo: hay que recordárselo. Es el único activo cultural gratis del brief.

---

### M2 · "El diario de 90 días" — la honestidad del mes 1

**Creencia que ataca:** *"ya probé de todo y nada funcionó; esto tampoco va a funcionar / me van a estafar."*

**Por qué puede ganarle a agosto:** ninguno de los 4 copys de agosto se hace cargo del abandono. El
producto tarda 90 días y la clienta lo compra esperando ver algo en dos semanas; cuando no lo ve, no
sólo no recompra: pide devolución en la puerta, que en COD es plata directa. **Nombrar el mes 1 vacío
antes que ella es lo más copiable del set de Skinfinity y lo que menos hacemos.**

**Qué le robo:** la escalera de hitos temporales (`1052343974325898` y `1045596591505413`); el
anti-hype explícito (*"Semana 1: no viste un puto cambio"* / *"Mes 1: estoy igual"*); **la prueba de
resultado indirecta — la almohada, el cepillo, el desagüe** (vende el mismo resultado sin mostrar la
cabeza: más creíble *y* sin riesgo de compliance); y descalificar al comprador impaciente.

**Qué le dejo:** el personaje 3D estilo Pixar. En cosmética la detección de IA baja intención de
compra más que en cualquier otra categoría (`Protocolo-Creativos.md`, Taboola+500M impresiones), y un
muñeco animado se detecta en el segundo cero. Lo hacemos con b-roll de objetos y manos, luz de casa
argentina, sin cara. También le dejo el falso testimonio: el nuestro va en condicional
("esto es lo que pasa si lo usás"), no afirma que una persona real lo usó.

---

### M3 · "Las cuatro cosas que dejaste de hacer" — identidad, cero producto, cero claim

**Creencia que ataca:** *"todavía no es tan grave; se me cae un poco, pero no me estoy quedando pelada."*
Es el mensaje para quien **todavía no se reconoce en el problema** — el único de los cuatro que va a
buscar mercado nuevo en vez de pelear por el mismo.

**Por qué puede ganarle a agosto:** `copyC · identificacion` ("si se te está abriendo la raya, esto es
para vos") fue el mejor $/LPV de toda la tanda ($149) y el mejor hook rate (40,2%) — con $8.032 de
gasto, o sea que nunca se leyó. Este mensaje es esa misma puerta pero abierta con cuatro llaves en
vez de una, y sin nombrar el problema de frente.

**Qué le robo:** el listicle de pérdidas de `1464274602137331` — el mejor guion del set ajeno y el
más barato de producir: **enumera consecuencias sociales, no síntomas médicos**, no nombra el producto
ni una vez hasta el segundo 30, y cierra con *"se recuperan en el mismo orden en que las perdiste"*.

**Qué le dejo:** dos cosas. (a) Las pérdidas masculinas —la gorra, el injerto en Turquía, raparse—
no le hablan a nuestra clienta; hay que traducirlas a las suyas y ahí está todo el trabajo.
(b) **El CTA de comentario** ("comentá PELO y te mando la guía"): infla señal social y baja CPM, pero
**no produce Initiate Checkout, o sea que no se puede leer contra la vara de esta tanda.** Va a un
test propio, más adelante.

---

### M4 · "No pagás nada hoy" — nuestra ventaja estructural, ascendida a mensaje

**Creencia que ataca:** *"no voy a soltar noventa mil pesos por adelantado por algo que no sé si me va a funcionar."*

**Por qué puede ganarle a agosto:** porque **ya ganó y nadie lo dejó jugar**. `copyD · antiriesgo` sacó
el 2º mejor hook rate (38,9%), el mejor CTR saliente de la tanda (4,63%) y el 2º mejor $/LPV ($186)
con $16.184 — un sexto de lo que se comió `copyA`. Y nunca tuvo pieza propia: corrió sobre el mismo
archivo de video que los otros tres. **Ascenderlo de variante de texto a mensaje con creativo propio
es la apuesta más barata de toda la tanda.**

**Qué le robo:** el cierre por reversión de riesgo en vez de descuento, y descalificar al impaciente.

**Qué le dejo:** su solución. Skinfinity resuelve el riesgo con **garantía de 90 días con devolución
del dinero** porque cobra $79.999 por adelantado en Tiendanube con 3 cuotas. Nosotros no tenemos ese
problema: **el COD es una reversión de riesgo más fuerte que cualquier garantía.** Ellos te devuelven
la plata; nosotros no te la pedimos. Es la única asimetría a favor nuestro en todo el análisis del
competidor y en agosto la dijimos en una línea de copy, nunca en imagen.

**Honestidad sobre esta hipótesis:** es media-nueva. El *body* existía; lo nuevo es el creativo. La
cuento como mensaje porque cambia la pieza, no el texto — pero si Pancho quiere 3 hipótesis 100%
vírgenes, ésta es la que cae.

---

## 3. Los guiones, palabra por palabra

**Reglas comunes a los 4** (salen de reglas duras del vault, no son gusto):

- **Subtítulos quemados en los 4**, palabra por palabra estilo karaoke (como los 6 de Skinfinity).
  Los estampa la edición/código, **nunca el modelo generativo** — 11 de 11 piezas con la etiqueta
  reescrita mal aun a 2K.
- **Ninguna cara humana hablando a cámara.** Manos, objetos, nucas, espejos. Elimina de un saque el
  lipsync, el género de voz cruzado (falló en vivo el 03/08) y la microexpresión, que es donde se
  detecta la IA en cosmética.
- **Voz en off femenina** (el público es mujeres 30-60). **Verificar el `ELEVENLABS_VOICE_ID` antes de
  renderizar** y medir el pitch del wav (mujer 165-255 Hz) — no asumirlo.
- **El producto no aparece antes del 70% del video** (regla de Skinfinity, y la que más disciplina exige).
- **Último cuadro: producto en una mano.** 7/11 ganadores lo cumplen, 0/5 controles.
- **Miniatura elegida a mano**, nunca la `is_preferred` de Meta.
- **Cero cuero cabelludo con clareo en primer plano.** Pelo peinado, sano, luz de casa. Lo que voltea
  no es el antes/después: es fotografiar una patología.
- **Ningún precio en pantalla ni en audio** hasta que $89.900 / $89.990 / FAQ sean el mismo número.
- **Ninguna promesa de resultado.** El plazo es de **uso** ("tratamiento de 90 días"), no de resultado
  ("menos caída en 90 días") — Disp. 4059/2025, sin ensayo propio.

---

### GUION M1 — "La raíz sin riego" · 38 s · 9:16 · voz en off + b-roll · **producible con lo que tenemos**

| t | qué se ve | qué se dice |
|---|---|---|
| **0:00-0:03** | Una regadera vacía inclinada sobre una planta mustia. Corte duro a una mano juntando pelos de un cepillo de cerda blanca. **Cero logo, cero frasco, cero texto de marca.** | *"Tu pelo no se está cayendo. Se está quedando sin riego."* |
| 0:03-0:08 | Baño de casa, luz de tarde por la ventana. El cepillo apoyado en la mesada. | *"Y no, no es la edad. Yo también pensaba eso."* |
| 0:08-0:15 | Mano frente al espejo atando una colita, la mira, la suelta. | *"La raíz del pelo es como cualquier raíz: si le llega poco, el pelo no deja de nacer. Nace más fino. Y un día atás la colita y la sentís la mitad."* |
| 0:15-0:21 | Tres envases genéricos de góndola pasando de largo (sin marcas legibles). | *"Por eso probás un shampoo, una ampolla, una vitamina, y no cambia nada. Ninguna de las tres trabaja en la raíz."* |
| 0:21-0:28 | Ramas de romero, agua hirviendo, una olla vieja, cocina de casa. | *"El agua de romero de nuestras abuelas hacía justo eso. Nada más que había que hervirla todas las noches."* ← **apodo + origen** |
| **0:28-0:34** | **PACKSHOT (73% del video):** gotero sobre la raya, dedos masajeando el cuero cabelludo — cabeza peinada, sana, plano medio, **nunca close-up clínico**. | *"ARRAIGO es esa idea, hecha sérum. Romero y cafeína, tres activos. Diez gotas en la raya, un minuto de masaje, y a dormir. Todas las noches."* ← **modo de uso** |
| **0:34-0:38** | **ÚLTIMO CUADRO:** la mano sostiene el frasco de ARRAIGO sobre la mesa de luz, etiqueta legible, velador encendido. | *"El tratamiento es de noventa días. Y no pagás nada hoy: pagás cuando te llega a la puerta."* |

**Producción:** 100% con lo que ya tenemos. 6 keyframes nano-banana-pro → 4 clips Kling i2v →
voz ElevenLabs → subtítulos en edición.

---

### GUION M2 — "El diario de 90 días" · 45 s · 9:16 · tarjetas de texto + voz en off · **producible con lo que tenemos**

| t | qué se ve | qué se dice |
|---|---|---|
| **0:00-0:03** | Almohada a la mañana, luz cruda de ventana. Tarjeta blanca: **"Esto es lo que pasa si usás un sérum de romero 90 días."** | *"Esto es lo que pasa si lo usás noventa días. Sin adornos."* |
| 0:03-0:09 | Tarjeta **"DÍA 1"**. Gotero, raya, dedos, luz de velador. | *"Diez gotas, un minuto de masaje, a dormir. No es grasoso, no te deja el pelo pesado. Eso es todo lo que vas a notar el primer día."* ← objeción "grasoso" resuelta el día 1 |
| 0:09-0:17 | Tarjeta **"SEMANA 2"**. El frasco en la mesa de luz, medio usado. Cepillo con pelos. | *"Y acá viene la parte que nadie te cuenta: no vas a ver nada. Nada. Es cuando la mayoría lo deja en el cajón."* ← **anti-hype** |
| 0:17-0:25 | Tarjeta **"MES 1"**. Almohada limpia. Cepillo con dos pelos. Desagüe de la ducha limpio. | *"Lo primero que cambia no es el pelo nuevo: es la almohada. Y el cepillo. Y el desagüe de la ducha."* ← **prueba indirecta, cero compliance** |
| 0:25-0:33 | Tarjeta **"MES 2"**. Dedos abriendo la raya frente a la ventana — pelo peinado y sano, plano medio. | *"Recién ahí te acercás al espejo y ves los pelitos cortos parados en la raya. Son un desastre para peinar. Son la mejor noticia del tratamiento."* |
| **0:33-0:40** | **PACKSHOT (73%):** tarjeta **"MES 3"**, tres frascos alineados + el aplicador sobre la mesada. | *"Noventa días. Ni antes. Si buscás algo para dos semanas, este no es."* ← **descalifica al impaciente** |
| **0:40-0:45** | **ÚLTIMO CUADRO:** mano sosteniendo el frasco, etiqueta legible, los otros dos desenfocados atrás. | *"Son tres frascos, uno por mes, con el aplicador. Y lo pagás cuando te lo entregan en la mano."* |

**Producción:** 100% con lo que ya tenemos. Es el guion más barato de los cuatro: todo b-roll de
objetos, ni una figura humana completa.

---

### GUION M3 — "Las cuatro cosas que dejaste de hacer" · 46 s · 9:16 · **dos versiones**

**v1 — sin cara (producible hoy, la que va al test).** Voz en off + b-roll de manos, espejos, nucas.
**v2 — con cara a cámara: EXIGE grabar con persona real.** No la propongo para el escalón 1 (ver §7).

| t | qué se ve | qué se dice |
|---|---|---|
| **0:00-0:03** | Mujer de espaldas frente al espejo del baño, atándose el pelo. **Sin producto, sin logo, sin texto de marca.** | *"Cuatro cosas que dejaste de hacer y no te diste cuenta de cuándo."* |
| 0:03-0:09 | Una mano tapando el lente del celular. Grupo de amigas; ella corriéndose al fondo. | *"Uno. Dejaste de sacarte fotos con flash. Ahora te ponés atrás, o la sacás vos."* |
| 0:09-0:15 | Peine corriendo la raya al costado. Dos veces. | *"Dos. Dejaste la raya al medio. Te la corriste al costado y ya no volviste."* |
| 0:15-0:21 | Elástico dando vueltas sobre la colita. Mano soltando. | *"Tres. Dejaste de atar la colita fuerte. Porque la vuelta que antes daba dos, ahora da tres."* ← el detalle específico que la delata |
| 0:21-0:28 | Espejo de ascensor. Ella baja la vista. Foto de cumpleaños tomada desde arriba. | *"Y cuatro. Dejaste de mirarte de arriba. En el ascensor, en la selfie de otro, en la foto del cumpleaños."* |
| 0:28-0:34 | La misma mujer, ahora atándose la colita normal, de frente al espejo. | *"Ninguna de esas cuatro las decidiste. Se te fueron de a poco. Y se vuelven en el mismo orden en que se fueron."* ← **esperanza** |
| **0:34-0:42** | **PACKSHOT (74%):** gotero sobre la raya, masaje, mesada de baño. | *"ARRAIGO es un tratamiento de noventa días con romero y cafeína. Diez gotas de noche, un minuto de masaje. Nada más."* |
| **0:42-0:46** | **ÚLTIMO CUADRO:** mano con el frasco, etiqueta legible. | *"Y no lo pagás hasta que lo tenés en la mano."* |

---

### GUION M4 — "No pagás nada hoy" · 42 s · 9:16 · **producible con lo que tenemos**

| t | qué se ve | qué se dice |
|---|---|---|
| **0:00-0:03** | Pantalla de celular con un checkout genérico **sin marca**, el dedo dudando sobre el botón. Cero branding. | *"Un tratamiento de noventa días que todavía no sabés si te va a funcionar. ¿Vos lo pagarías por adelantado?"* |
| 0:03-0:10 | El dedo cierra la pestaña. Cepillo con pelos sobre la mesada. | *"Yo tampoco. Y por eso mucha gente cierra la página y lo deja para después."* |
| 0:10-0:18 | Una mano abierta y vacía. Overlay **"$0 HOY"** — **estampado por CÓDIGO, nunca por el modelo.** | *"Así que lo damos vuelta. No pagás nada hoy. No dejás la tarjeta, no hacés transferencia, no ponés un peso."* ← **la oferta ES el mecanismo** |
| 0:18-0:26 | Puerta de calle, caja, manos abriéndola: los tres frascos y el aplicador adentro. | *"Te llega la caja a tu casa. La abrís, ves los tres frascos y el aplicador, y recién ahí le pagás al que te lo trajo."* |
| **0:26-0:33** | **PACKSHOT (79%):** gotero sobre la raya, masaje. | *"Es el tratamiento de noventa días de ARRAIGO. Romero y cafeína, diez gotas de noche, un minuto de masaje."* |
| 0:33-0:38 | Los tres frascos en fila sobre la mesada, luz de cocina. | *"Te aviso una sola cosa: son noventa días. Si buscás algo para el finde, no es este."* ← **descalifica al impaciente** |
| **0:38-0:42** | **ÚLTIMO CUADRO:** mano recibiendo la caja abierta, frasco arriba, etiqueta legible. | *"Cuando te llega, pagás. Antes no."* |

⚠️ **Verificación previa obligatoria de M4:** que el formulario COD **efectivamente no pida tarjeta**.
El guion lo afirma en audio. Si el form pide algún dato de pago, la línea se cae y el anuncio se
convierte en un reclamo. Es un chequeo de dos minutos en la landing, antes de renderizar.

---

### Las piezas: 4 videos producidos, 12 anuncios

Skinfinity escalona duraciones a propósito: bumpers de 0:07 para alcance barato, 0:34-0:47 para el
grueso, 1:11-1:57 de VSL. Lo copiamos, **gratis**: los cortes salen del mismo render con ffmpeg.

| mensaje | pieza A (largo) | pieza B (medio, 15 s) | pieza C (bumper, 8-10 s) |
|---|---|---|---|
| M1 | 0:38 completo | 0:00-0:03 + 0:21-0:34 | 0:00-0:03 + último cuadro |
| M2 | 0:45 completo | 0:00-0:03 + 0:17-0:25 + cierre | tarjeta + almohada + cierre |
| M3 | 0:46 completo | las 4 pérdidas en tarjetas + cierre | 0:00-0:03 + cierre |
| M4 | 0:42 completo | 0:00-0:03 + 0:10-0:18 + cierre | 0:00-0:03 + último cuadro |

**Se renderizan 4 videos. Las otras 8 piezas cuestan cero.** Siguen siendo 4 hipótesis, no 12: los
cortes son la misma apuesta a distinta duración, y por eso viven **dentro** del ad set de su mensaje.

---

## 4. Copy (primary text) y headline

### El headline: se mantiene constante en el escalón 1, y explico por qué

Los 9 de agosto usaron **"Envío Gratis 📦"** — heredado del ganador #1 de la cuenta (Pureza, 607
compras), nunca medido en ARRAIGO. La tentación es testearlo. **No en esta tanda:** el Runbook §6
quater es explícito — *"el test es el body, así que título y descripción se mantienen constantes o el
test no se lee"*. Si cambio mensaje **y** headline a la vez, no sé cuál movió.

Y la iteración más barata de Skinfinity —**el contador en el título del link**, `+10.000` → `+48.000`
sin tocar el copy— **hoy no está disponible para nosotros: nuestro número real son 9 pedidos.**
No se inventa. Vuelve a estar disponible cuando el número sea presentable.

| campo | escalón 1 (constante en las 12 piezas) |
|---|---|
| Headline | `Envío Gratis 📦` |
| Descripción | `Envío gratis · Pagá al recibir` |
| CTA | `GET_OFFER_VIEW` |

**El A/B de headline va al escalón 2**, sobre el mensaje que sobreviva y solo sobre él:
`Envío Gratis 📦` vs `Pagás cuando te llega`. Una variable, un test.

---

### Copy M1 — "La raíz sin riego"

> Tu raíz no está muerta. Está sin riego.
>
> Cuando le llega poco a la raíz, el pelo no deja de nacer: nace más fino. Y un día atás la colita y la sentís la mitad de lo que era.
>
> Por eso el shampoo no cambia nada. El shampoo trabaja en el pelo. El problema está abajo.
>
> El agua de romero de nuestras abuelas hacía justo eso, sólo que había que hervirla todas las noches.
>
> ARRAIGO es esa idea hecha sérum: romero y cafeína, tres activos, para la raíz. 10 gotas de noche, 1 minuto de masaje, sin enjuague. Tratamiento de 90 días: tres frascos, uno por mes, con el aplicador. Sin minoxidil.
>
> No pagás nada hoy. Pagás cuando te lo entregan en la mano.

### Copy M2 — "El diario de 90 días"

> Mes 1: no vas a ver nada. Te lo digo antes de que lo compres.
>
> Lo primero que cambia no es el pelo nuevo. Es la almohada. Y el cepillo. Y el desagüe de la ducha.
>
> Recién en el mes 2 te acercás al espejo y ves los pelitos cortos parados en la raya, imposibles de peinar. Esos son la buena noticia.
>
> ARRAIGO es un tratamiento de 90 días con romero y cafeína. Tres frascos, uno por mes, y el aplicador. 10 gotas de noche, 1 minuto de masaje, sin enjuague. Sin minoxidil.
>
> Si buscás algo para dos semanas, este no es.
>
> Y no lo pagás hasta que lo tenés en la mano.

### Copy M3 — "Las cuatro cosas"

> Cuatro cosas que dejaste de hacer y no te diste cuenta de cuándo.
>
> Dejaste las fotos con flash. Dejaste la raya al medio. Dejaste de atar la colita fuerte, porque la vuelta que antes daba dos ahora da tres. Y dejaste de mirarte de arriba.
>
> Ninguna la decidiste. Se te fueron de a poco. Y se vuelven en el mismo orden en que se fueron.
>
> ARRAIGO: sérum de romero y cafeína para la raíz. 10 gotas de noche, 1 minuto de masaje, sin enjuague. Tratamiento de 90 días con el aplicador incluido. Sin minoxidil.
>
> Pagás cuando te llega.

### Copy M4 — "No pagás nada hoy"

> Un tratamiento de 90 días que todavía no sabés si te va a funcionar. ¿Lo pagarías por adelantado?
>
> Nosotros tampoco.
>
> No dejás tarjeta, no hacés transferencia, no ponés un peso hoy. Te llega la caja, la abrís, ves los tres frascos y el aplicador, y recién ahí le pagás a quien te lo trajo.
>
> ARRAIGO es un sérum de romero y cafeína para la raíz. 10 gotas de noche, 1 minuto de masaje, sin enjuague. Sin minoxidil.
>
> Te aviso una sola cosa: son 90 días. Si buscás algo para el finde, no es este.

---

## 5. Gate de concepto — sobre el texto, antes de generar (bloqueante)

| # | pregunta | M1 riego | M2 diario | M3 cuatro cosas | M4 no pagás |
|---|---|---|---|---|---|
| 1 | ¿Qué producto es y para qué sirve, en una frase? | sí — sérum de romero en la raíz, tratamiento 90 días | sí | ⚠️ **el más flojo**: el producto entra recién a 0:34 (74%) y el 74% del video no tiene producto | sí |
| 2 | ¿El mensaje ya corre en otra pieza? | no (agosto lideraba con ingrediente) | no | no | ⚠️ el *body* existía (copyD); **el creativo no**. Media-nueva, dicho |
| 3 | ¿Algo que Meta lea como enfermedad, incluida la miniatura? | no | ⚠️ el plano "dedos abriendo la raya" 0:25 es el borde: pelo peinado y sano, plano medio, nunca close-up | no | no |
| 4 | ¿Último cuadro con producto en mano/uso? | sí, escrito | sí | sí | sí |
| 5 | ¿Se va a notar que es IA? | **riesgo real en los 4** — mitigación: sin caras hablando, manos+objetos, luz de casa, props argentinos, imperfección deliberada, y verificación a resolución NATIVA además de 380 px | | | |

**Pasan 4 de 4 en texto, con dos condiciones de producción escritas:**
1. **M3 sale al aire con su bumper (pieza C) desde el minuto cero**, que sí lidera con producto. Si a
   las 48 h M3 tiene CTR alto y 0 IC, el diagnóstico está pre-escrito: no se entendió qué se vendía.
2. **La pregunta 5 no se resuelve en el gate, se resuelve en el QA.** Es la única que puede matar
   piezas ya renderizadas.

**Ninguna pieza fue generada.** El QA `qa-ojo-de-cliente` corre sobre los renders, no sobre texto; lo
que queda pre-registrado ahora son la persona y la vara, para que la ronda 1 no las improvise:

- **Persona:** mujer de 43, Mendoza o conurbano, ve más pelo del normal en el cepillo desde hace un
  año, ya probó ampollas de farmacia y dos shampoos anticaída de góndola, anda con el pelo atado casi
  siempre, mira el feed a la noche en la cama, con el sonido apagado.
- **Vara:** el video `ugcB` de agosto — 9 de las 10 compras, hook rate 36-40%, $217/LPV blended y
  **$149/LPV en su mejor celda**. Un candidato pasa si le compite de igual a igual. Y son los dos
  números con n de miles, así que son los únicos que puedo pre-registrar como vara de calidad
  creativa: **hook rate ≥ 40% y $/LPV ≤ $149**.
- Defectos a buscar explícitamente: manos (el más frecuente de nano-banana/flux), la etiqueta escrita
  por el modelo, continuidad del pelo entre planos (si en un plano está atado y en el siguiente
  suelto, se rompe la ilusión), el frasco fuera de escala, y el pitch de la voz.

---

## 6. Diseño del test

### La forma

| decisión | qué | por qué |
|---|---|---|
| **Campaña** | 1 nueva, `OUTCOME_SALES`, **ABO**, `is_adset_budget_sharing_enabled: false` | En `true` Meta reparte entre conjuntos y se pierde el corte por mensaje (trampa verificada 05/08). Test en CBO → escala en CBO es de Arash, pero acá el objetivo es **veredicto por mensaje**, y eso exige presupuesto por conjunto |
| **Ad sets** | **4 — uno por mensaje** | Hallazgo 7/7: dentro de un ad set, el que arranca perdiendo no se recupera. Si querés veredicto de N mensajes, los N necesitan conjunto propio. Es literalmente lo que rompió agosto |
| **Anuncios por ad set** | **3** (largo + medio + bumper del MISMO mensaje) | Arash: nunca 1 ad por ad set (se lleva atribución que no generó). Meta recomienda ≤6. Y las 3 son la misma hipótesis, así que Meta puede repartir entre ellas sin ensuciar la lectura |
| **Targeting** | **idéntico al de agosto**: AR entera, mujeres 30-60, cero exclusiones, sin intereses, ubicaciones automáticas, `advantage_audience: 0`, píxel `781630351556303`, 7d clic + 1d view | Cambiar público y creativo a la vez hace ilegibles a los dos. ⚠️ El targeting abierto **sí** cuesta, pero cuesta en **entrega** (Jujuy 36,5%, Chubut 27,8%), no en CPA de Meta. Es una decisión aparte |
| **Presupuesto** | **$12.000/día por ad set = $48.000/día** | Agosto no pudo gastar $30.000 en un conjunto el día 3 (68%). $12.000 está cómodo bajo ese techo. Y da $36.000 por mensaje en 3 días = 6× el CPA objetivo |
| **Días** | **3** (escalón 1). Escalón 2: 7 días sobre los sobrevivientes | Protocolo §"el test tiene dos escalones" |
| **Gasto del escalón 1** | **$144.000** (4 × $12.000 × 3) | Comparable a los $114.036 de agosto, pero repartido en 4 hipótesis en vez de 2 |

**⚠️ Gate de lanzamiento que NO es mío:** el techo de ad sets de la cuenta = conversiones 7d ÷ 50.
Al 05/08 era 10,3 con 8 corriendo. **Hoy no está medido.** ARRAIGO no tiene pauta viva, así que estos
4 son 4 slots nuevos. **Antes de lanzar, `lectura-tanda` tiene que confirmar que hay 4 lugares
libres.** Si hay 3, Pancho corta un mensaje. Si no hay ninguno, *la semana empieza apagando, no
produciendo* (Protocolo §3bis.4).

### La vara de corte, escrita ANTES de lanzar

**Se corta por Initiate Checkout, no por compras.** Con $36.000 por mensaje y CPA objetivo $6.000, lo
esperado son 6 compras por celda: n insuficiente para cualquier veredicto. IC multiplica la muestra
×2,5 y **el ratio lo manda el formulario, no el creativo** (34,5-44,8% estable en 11 ad sets), que es
justo lo que lo hace servible para juzgar creativos.

**Los números exactos:**

| ratio usado | IC por compra | equilibrio por IC a CPA $6.000 | para qué lo uso |
|---|---|---|---|
| casa (2.376 IC / 934 compras, 90 d) | 2,54 | **$2.360** | **la vara de MATAR** |
| ARRAIGO propio (32 IC / 10 compras, agosto) | 3,20 | $1.875 | la vara de GANAR |

Uso el más laxo para matar por la regla de la casa: **un umbral de corte nunca puede ser más exigente
que el break-even** — así se mataron creativos rentables el 30/07 con el corte de $7.200. El n de
ARRAIGO (32 IC) no aguanta ser vara de ejecución; sí sirve de aspiración.

**Reglas de corte, por AD SET (= por mensaje):**

| momento | condición | acción |
|---|---|---|
| **48 h** | ad set con **≥ $18.000 gastados y 0 IC** | **se apaga**. A $3.564/IC (el costo de agosto) $18.000 debería dar ~5 IC. Cero es señal, no ruido |
| 48 h | frecuencia 7d > 3,5 | frenar el conjunto (guardarraíl Arash) |
| 48 h | cualquier otra cosa | **no se toca nada**. Ni CTR, ni CPA, ni corazonadas |
| **72 h · piso de evidencia** | $36.000 gastados en el ad set (6× CPA objetivo) | recién ahí se juzga |
| **72 h** | costo por IC **> $4.720** (2× el equilibrio) | **muere** |
| **72 h** | costo por IC entre **$2.360 y $4.720** | **sobrevive** al escalón 2 con el mismo presupuesto |
| **72 h** | costo por IC **≤ $2.360** | **pasa al escalón 2 con presupuesto doble** |
| **escalón 2 · 7 días** | $60.000 por mensaje (10× CPA objetivo) | lectura de CPA real |
| escalón 2 | CPA por pedido ≤ $6.000 | **ganador** — se consolida con post ID |
| escalón 2 | CPA por pedido $6.000-$11.403 | empata con agosto: **no escala, no muere** |
| escalón 2 | CPA por pedido > $11.403 | **muere** — no le gana a lo que ya tenemos |
| escalón 2 · **de la base, no de Meta** | **mix x3 ≥ 60%** | si un mensaje baja el CPA por pedido pero rompe el mix, no es ganador: es un CPA por unidad peor disfrazado |

**Lo que NO es criterio de corte, escrito para que nadie lo use:** CTR y retención. Agosto probó que
el CTR sube mientras las ventas bajan (3,05% → 5,09% con el CPA duplicándose). CTR y hook rate sirven
para **elegir qué iterar**, nunca para matar ni para escalar.

**Anotar el día 0** (Runbook §5): qué pregunta responde este test — *¿alguno de los 4 mensajes baja el
costo por IC por debajo de $2.360, con un mensaje por conjunto para que el reparto de Meta no decida
por nosotros?* No es *"¿cuál gana?"*: con 3 días y $36.000 por celda, la respuesta posible es
*"cuáles no son un desastre"*.

---

## 7. Costo del primer escalón

**Escalón 1 = producción. Los 4 videos, nada más. La pauta es un OK aparte y no es mío.**

| ítem | unidad | precio (con fecha) | cantidad | subtotal |
|---|---|---|---|---|
| Keyframes `fal-ai/nano-banana-pro/edit` 2K | US$0,30/img (27-31/07/2026) | 6 por video | 24 | US$7,20 |
| Kling 3.0 Turbo i2v, 10 s | US$1,12/clip (27-31/07/2026) | 4 por video | 16 | US$17,92 |
| Voz ElevenLabs (femenina) | dentro del plan | 4 | — | US$0 |
| Cortes de 15 s y bumpers | ffmpeg | 8 | — | US$0 |
| Subtítulos quemados y overlay `$0 HOY` | código (Fábrica) | — | — | US$0 |
| **Subtotal** | | | | **US$25,12** |
| Descarte y regeneración (+40%: manos, etiqueta, continuidad) | | | | US$10 |
| **TOTAL ESCALÓN 1** | | | | **≈ US$35** |

**Techo autorizado que pido: US$40.** Si el gasto real se pasa 20% de ahí (US$42), freno y aviso —
son precios con fecha, no constantes.

**Los escalones siguientes, para que se vea el total y no haya sorpresas:**

| escalón | qué | costo estimado | quién |
|---|---|---|---|
| 1 | producción de los 4 videos (fal) | **US$35-40** | yo, con OK |
| 2 | **pauta del test**: 4 ad sets × $12.000/día × 3 días | **$144.000 ARS** | **meta-operador** — yo no lanzo |
| 3 | HeyGen: la v2 de M3 con cara real, **sólo si M3 sobrevive** | **no costeado** — HeyGen no expone precio; hay que medir el saldo antes y después. Referencia con fecha: ~1,4 créditos/s al 31/07/2026 → 46 s ≈ 64 créditos | yo, con OK propio |

---

## 8. Qué NO estoy proponiendo, y por qué

1. **Estáticas. Ninguna.** $620/LPV contra $217 del video, 2,9×, y 1 compra en $37.192. Es el único
   dato de agosto con n suficiente para ser conclusión y no dirección.
2. **Volver a probar el antes/después.** Se cortó el 07/08 con el piso de evidencia cumplido:
   $26.889 con una sola venta (un x1), casi 10× el conjunto de video. Pasaron revisión de Meta — el
   problema no fue compliance, fue que no venden. Dato que sí guardamos: **el antes/después no está
   prohibido**, y confirmarlo costó $26.889, así que no hace falta volver a comprarlo.
3. **El lead-gen "comentá ROMERO".** Es el guion más barato de Skinfinity y probablemente el mejor
   CPM, pero **no produce Initiate Checkout, o sea que no se puede leer contra la vara de esta tanda**.
   Meterlo acá contamina el test. Merece uno propio.
4. **El mecanismo DHT / tapón de sebo.** Claim médico sobre una condición, con ANMAT de por medio y
   producto cosmético grado 2. Es la deuda de compliance de ellos. **Y Meta revisa hasta la landing.**
5. **HeyGen ni actor real en el escalón 1.** Historial: 4 testimoniales, 0 lanzables. Si M3 sobrevive
   sin cara, ahí sí vale grabar — pero grabar es el premio del mensaje que ganó, no la apuesta inicial.
6. **Tocar el targeting.** Ni exclusiones, ni intereses, ni `advantage_audience`. Cambiar público y
   creativo a la vez hace ilegibles a los dos. *(La discusión de excluir Jujuy y Chubut es real y es
   plata —36,5% y 27,8% de entrega— pero es una decisión de entrega, no de creativo, y va aparte.)*
7. **El contador de prueba social en el headline.** Es la iteración más barata que existe y hoy no la
   podemos usar: nuestro número real son 9 pedidos.

### Y lo grande, con todas las letras: **$6.000 no se alcanza sólo con creativo.**

La aritmética, con el embudo de agosto congelado y moviendo un solo factor por vez:

| escenario | $/LPV | LPV→IC | IC→compra | **CPA** |
|---|---:|---:|---:|---:|
| Agosto, como fue | $275 | 7,7% | 31,3% | **$11.403** |
| Sólo video (sin estáticas), reparto igual | $217 | 7,7% | 31,3% | ~$9.000 |
| + un mensaje por ad set (sin `copyA` comiéndose el 43%) | ~$170 | 7,7% | 31,3% | ~$7.050 |
| + **toda** la tanda al $/LPV de la mejor pieza de agosto | $149 | 7,7% | 31,3% | ~$6.180 |
| Sólo video + LPV→IC de 7,7% a **12%** | $217 | 12% | 31,3% | **~$5.780** |

**Leído derecho:** para llegar a $6.000 **sólo con creativo** hace falta que las cuatro celdas nuevas
entreguen al nivel de la mejor celda de agosto, sin una sola pieza cara y con el reparto de Meta
cooperando. Es posible y es exactamente lo que este test intenta — pero es el escenario perfecto,
no el escenario esperado. **Lo realista de esta tanda es aterrizar entre $7.000 y $9.000.**

**El tramo que falta está en LPV→IC: 8,0% en la tanda, contra 15,4-17,5% de Pureza en la misma
cuenta con el mismo formulario** (medido por Graph API el 01/09 — ver la corrección del §4).
Nueve de cada diez personas que ARRAIGO paga para llevar a la landing se van sin abrir el
formulario, contra ocho de cada diez en Pureza. Cerrar sólo esa brecha, sin tocar nada más,
pone el CPA en **~$5.500**. Eso no lo arregla ningún guion.

**Lo que habría que tocar, en orden de tamaño:**

1. **LPV → IC.** La palanca más grande del negocio hoy. De 11,3% a 15% baja el CPA 25% sin renderizar
   nada. Candidatos a mirar, ninguno medido todavía: velocidad de la página en mobile, dónde y cuántas
   veces aparece el botón que abre el form, y que la oferta preseleccionada sea el x3 de $89.990 sin
   que la escalera se vea antes. **Esto no es trabajo de creativos y por eso lleva meses sin tocarse.**
2. **Los $90 de diferencia.** $89.900 en los creativos, $89.990 en Kaching, $89.900 en el FAQ. Un
   campo. Mientras siga vivo, ninguna pieza de esta tanda nombra un precio.
3. **Fecha de entrega exacta en el checkout**, no rango. Cambio de texto, no test.
4. **Proteger el mix x3 (78%).** Es el activo económico del producto: con el mix roto, un CPA por
   pedido mejor puede ser un CPA por unidad peor. Va como vara, no como esperanza.
5. **Entrega.** Jujuy 36,5%, Chubut 27,8%, blended 54,1%. El CPA de Meta no lo ve y se lleva la
   diferencia entre $4.958 por unidad pedida y ~$9.100 por unidad entregada.

---

## 9. Límites de esta lectura, dichos una vez

- **10 compras. Ningún CPA por anuncio de agosto tiene significancia.** El intervalo real del CPA de
  la tanda va de ~$6.700 a ~$27.800. Todo lo que digo sobre *qué mensaje vendió mejor* es
  **direccional**, no concluyente.
- **Lo que sí es sólido** (n de miles de impresiones): CTR, CTR saliente, hook rate y $/LPV. Toda mi
  jerarquía de mensajes se apoya en esos cuatro, no en las compras.
- **El IC por anuncio no está desagregado en el dossier**, así que LPV→IC por pieza **no está medido**.
  Los 7,7% y 11,3% son de tanda y de conjunto. Es una de las cosas que este test va a producir.
- **El ratio IC→compra propio de ARRAIGO (3,2) sale de 32 IC y 10 compras.** No aguanta ser vara.
- **El caveat abierto de la casa sigue abierto:** hay un hueco de dedup CAPI sobre `InitiateCheckout`.
  Si el dedup pixel↔servidor está mal, el IC está inflado y **todos los umbrales de esta nota bajan**.
- **Skinfinity está medido por su Ad Library, no por su cuenta.** Sé qué anuncian y hace cuánto; **no
  sé qué les funciona.** Que un ángulo lleve 3 meses corriendo es evidencia razonable de que rinde —
  no es una métrica.

---

## 10. Lo que Pancho tiene que cortar

1. **¿$6.000 es por pedido o por unidad?** (por unidad, agosto ya cumplía).
2. **Cuáles de los 4 mensajes se prueban.** Es el único rol no delegable. Mi orden, si hay que
   recortar a 3: **M4** (ya ganó sin que lo dejaran jugar) → **M2** (ataca el abandono, que en COD es
   plata en la puerta) → **M1** (el mecanismo con nombre, la apuesta a 3 meses) → **M3** (el que busca
   mercado nuevo y el que peor pasa la pregunta 1 del gate).
3. **El OK del escalón 1: US$40 de producción.** Nada más que eso.

---

**NO SE GENERÓ NI SE GASTÓ NADA. NO SE LANZÓ NADA.**
Para arrancar, re-invocar con el OK del escalón copiado en el prompt:
`OK escalón producción: mensajes <cuáles> + gasto US$40 + guiones aprobados`.
