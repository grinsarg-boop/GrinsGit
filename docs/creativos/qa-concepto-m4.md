# QA de concepto — "M4 · No pagás nada hoy" (ARRAIGO, 42 s, 9:16, sin cara)

**Auditoría hecha el 01/09/2026, sobre el guion. La pieza no existe: esto se decide antes de gastar.**
Skill aplicada: `qa-ojo-de-cliente`. Método: imaginar la pieza cuadro por cuadro a 380 px,
primero con el sonido apagado, después con sonido.

---

## VEREDICTO: 🔴 **NO LANZABLE**

No por el ángulo. **El ángulo anti-riesgo es correcto y está medido.** Es no lanzable por el
**orden**: el anuncio pone el cierre en el lugar del hook y deja la categoría afuera de los
primeros 18 segundos.

**El dato que lo condena, y es verificable contando palabras:**

> En los 42 segundos de voz en off, las palabras **"pelo", "caída", "cabello", "raya",
> "densidad" y "anticaída" no aparecen NI UNA VEZ.**

Repasar la tabla: 0:00 "un tratamiento" · 0:03 "mucha gente cierra la página" · 0:10 "no pagás
nada hoy" · 0:18 "los tres frascos y el aplicador" · 0:26 "romero y cafeína, diez gotas de
noche" · 0:33 "son noventa días" · 0:38 "cuando te llega, pagás". Ninguna dice de qué es.
La categoría existe solo en dos imágenes (el cepillo a los 0:03, el gotero sobre la raya a los
0:26) y en el renglón 4 del copy, que en el feed queda debajo del "…ver más".

Cuatro canales — primer cuadro, subtítulo de los primeros 3 s, copy visible sin desplegar,
headline — y **los cuatro tienen cero señal de categoría.** Eso es exactamente el error que ya
costó una tanda entera en esta casa: el 04/08/2026 seis piezas aprobadas 6/6 por QA forense y
rechazadas por Pancho con *"no se entiende de qué es el producto"*. Este guion reincide, y esta
vez es peor, porque ahí la ambigüedad duraba un vistazo y acá dura 18 segundos.

---

## 1. La persona y la vara

**La persona.** Mujer de 43, Argentina, no necesariamente AMBA (el público es país entero).
En el último año se le abrió la raya y lo sabe porque se acomoda el pelo antes de cada foto.
Ya compró un shampoo "anticaída" de farmacia que no hizo nada, y le da vergüenza contarlo.
Mira el feed a las 23:40, en la cama, **con el sonido apagado porque al lado duerme alguien.**
El sonido apagado no es una estadística de Meta: es su situación.

**La vara.** Acá hay que decirlo derecho: **ARRAIGO no tiene hoy ningún anuncio vivo.** Todo
quedó pausado. Así que la vara no se puede traer por API y hay que construirla con lo que sí
tiene n suficiente:

| Vara | Número | De dónde sale |
|---|---|---|
| Hook rate a batir | **≥ 39%** | `copyD` 38,9% y `copyC` 40,2% (n = 2.133 y 1.252 plays) |
| $/LPV a batir | **≤ $186** | `copyD` $186, `copyC` $149 |
| CTR saliente a batir | **≥ 4,6%** | `copyD` 4,63% |
| Equilibrio por IC | **~$2.360** | CPA objetivo $6.000 ÷ 2,54 IC/compra |
| Vara de mercado | el diario de Skinfinity (`1052343974325898`, 0:37) | es el formato que escaló 3 meses |

Un CPA por anuncio de la tanda vieja no sirve de vara: 10 compras en total, ninguna significativa.
Lo direccional es hook rate, CTR saliente y $/LPV, donde el n es de miles.

---

## 2. Imaginado cuadro por cuadro — SONIDO APAGADO (así lo va a ver la mayoría)

### 0:00 – 0:03 · Pantalla de celular con checkout genérico, dedo dudando

Lo que efectivamente entra por el ojo: **un celular filmado dentro de un celular.** En 9:16 a
380 px de ancho, ese checkout ocupa quizá 200 px de ancho útil y su tipografía es texto de
formulario: **ilegible, y sin intención de ser leído.** No hay color, no hay cara, no hay
movimiento salvo un dedo que flota. Es el cuadro de menor contraste y menor energía de los siete.

Y hay algo peor que la ilegibilidad: **la ambigüedad de rubro.** Una pantalla de checkout sin
marca es la imagen más category-agnostic que existe en el feed argentino. Es literalmente el
frame de apertura de Mercado Pago, Ualá, Naranja X, Modo, de cualquier finfluencer de "cómo
comprar en cuotas sin que te choreen", y de las PSA de estafas online. La lectura por defecto de
ese cuadro es **fintech o alerta de fraude**, no cosmética.

El subtítulo quemado ayuda poco: "Un tratamiento de noventa días que todavía no sabés si te va a
funcionar. ¿Vos lo pagarías por adelantado?" son ~95 caracteres, o sea 3-4 renglones a 380 px,
o sea ~3 segundos de lectura. **Toda la ventana del hook se consume leyendo una pregunta que no
dice de qué habla.** Y la palabra que más peso visual tiene ahí es "pagarías".

**¿Frena el pulgar?** No en la persona con caída. Frena — y esto es el problema, no la virtud —
**al que le interesa el tema plata.** Ver §4.

### 0:03 – 0:10 · El dedo cierra la pestaña. Cepillo con pelos sobre la mesada.

Acá aparece, a los 3 segundos, **la mejor imagen de todo el anuncio** y la única que hace el
trabajo: el cepillo con la mata de pelo enredada. Es exactamente la "prueba de resultado
indirecta" que el análisis de Skinfinity marcó como copiable y superior al antes/después
(§7: *ducha sin pelos, peine, almohada limpia*).

Y está **usada como b-roll debajo de una frase sobre abandono de carrito.** El subtítulo en ese
tramo dice "Yo tampoco. Y por eso mucha gente cierra la página y lo deja para después." Imagen y
texto tiran para lados opuestos durante 7 segundos: el ojo dice *pelo*, la letra dice
*e-commerce*. Con el sonido apagado, el puente entre las dos cosas —que lo hace la voz— no existe.

Desperdiciar el mejor activo del guion tapándolo con una frase de otro tema es el defecto más
caro de la pieza después del orden general.

### 0:10 – 0:18 · Mano abierta y vacía. Overlay "$0 HOY".

Dieciocho segundos y seguimos hablando de plata. "$0 HOY" en overlay grande sí se lee a 380 px
—es lo único que se lee bien en toda la primera mitad—, pero **refuerza el rubro equivocado.**
Mano vacía + "$0" es el lenguaje de un cashback, de una prueba gratis, de un sorteo bancario.
Y en la persona escéptica dispara la reacción contraria a la buscada: *nadie regala nada*.

Ocho segundos de anuncio dedicados a explicar tres veces la misma cosa ("no dejás la tarjeta, no
hacés transferencia, no ponés un peso"). Es la parte más larga de la pieza y es la que menos
información nueva aporta.

### 0:18 – 0:26 · Puerta, caja, manos abriéndola, tres frascos y un aplicador.

**Recién acá aparece algo que se parece a un producto**, y todavía en modo genérico: tres frascos
ámbar con gotero, sin etiqueta legible a esa distancia. Tres frascos ámbar a 380 px son
*cosmética o suplemento*, punto. Podrían ser aceite de CBD, vitamina D o perfume.

### 0:26 – 0:33 · PACKSHOT: gotero sobre la raya, masaje.

**Segundo 26 de 42: acá y no antes se entiende qué es.** Y se entiende por la imagen, no por la
voz, que sigue sin nombrar el pelo ("romero y cafeína, diez gotas de noche, un minuto de masaje").

### 0:33 – 0:38 · Tres frascos en fila. "Son noventa días."

**La mejor línea del guion.** Descalificar al comprador impaciente es exactamente lo que el
análisis marcó como más copiable de Skinfinity y como lo que menos hacemos. Se conserva entera.

### 0:38 – 0:42 · Mano recibiendo la caja, frasco arriba, etiqueta legible.

Cumple la regla dura de la casa: *el último cuadro del video, producto en una mano o en uso*
(7/11 ganadores lo cumplen, 0/5 controles). Bien.
Salvedad de legibilidad: en la estática `mecanismo-916` la etiqueta ARRAIGO se lee a resolución
nativa, pero **en una mano a 380 px lo único que va a leerse es "ARRAIGO"**; "SÉRUM ANTICAÍDA de
romero" queda al borde. O sea: **la etiqueta no puede ser el lugar donde se resuelve la categoría.**
Hoy es el único lugar donde se resuelve.

---

## 3. Con sonido

La voz en off está bien escrita. Registro rioplatense real, "vos", ritmo, un giro claro ("así que
lo damos vuelta"), y descalifica. Como cuña de radio o lectura de podcast, funciona.

El problema es estructural, no de redacción: **la voz carga el 100% del significado y la imagen
carga 0% durante los primeros 18 segundos.** Un guion así solo sobrevive si todo el mundo lo
escucha, y no es el caso.

Los subtítulos quemados mitigan a medias —transportan las palabras— pero no arreglan nada, porque
**el texto de esas palabras tampoco nombra la categoría.** Poner subtítulos a un texto que no dice
de qué es no resuelve que no se entienda de qué es.

---

## 4. La rareza, de frente: ¿ventaja o defecto?

Pancho preguntó si le suena raro porque es diferenciación o porque está mal. La respuesta honesta
tiene tres partes y ninguna es diplomática.

### 4.1 El ángulo está bien. La evidencia que lo respalda dice otra cosa de la que se le atribuye.

M4 nace de un dato real: `copyD-antiriesgo` sacó el mejor CTR saliente de la tanda (4,63%) y el
2º hook rate (38,9%). Pero el dossier también documenta el detalle que cambia todo:

> **Los 4 anuncios de video son el MISMO video.** Los cuatro thumbnails del frame 0 son
> byte-idénticos (md5 `f06ab22409e0ebdebfb3adb8112e47ef`).

El hook rate mide los primeros segundos **de video**. Si el video es idéntico en los cuatro, las
diferencias de hook rate (33,9 / 36,6 / 38,9 / 40,2%) **no las causó el copy**: las causó a quién
se lo mostró Meta. Lo único que el copy pudo mover de verdad es el CTR — o sea, la decisión de
clickear de alguien **a quien ya lo enganchó un video de pelo.**

Traducido: **hay evidencia sólida de que el anti-riesgo funciona como CUERPO. No hay ninguna
evidencia de que funcione como HOOK.** M4 asciende un cierre probado al puesto de apertura, y
lo hace apoyándose en un número que mide precisamente el puesto que le está sacando.

### 4.2 Por eso "no es el tipo de anuncio que solemos ver": el mensaje tiene un rol estructural.

No es un hueco de mercado sin explotar. Es que el mensaje de plata es un **cerrador** en todos
lados, y el mercado ya lo resolvió así:

- Skinfinity pone la reversión de riesgo en el segundo **0:41 de 0:47** (guion 5.3), y en la VSL
  de 1:57 la oferta ocupa **los últimos 5 segundos**. Nunca al principio.
- Las propias estáticas de ARRAIGO ya llevan "PAGÁS CUANDO LO RECIBÍS" — **en la franja al pie**,
  debajo de todo. Es un sello, no un titular.
- Regla 1 de la fórmula Skinfinity: *el hook nunca es el producto; es una negación o una noticia
  ajena, cero branding en los primeros 3 segundos*. Nótese que "cero branding" **no es lo mismo
  que "cero categoría"**: el clip del streamer es una coronilla pelada, la maquinita de cortar el
  pelo está en cuadro en el segundo 0, el listicle abre con "cuatro cosas que perdés cuando
  empezás a perder pelo". **Producto tarde, categoría instantánea.**

**Y ahí está el diagnóstico exacto de M4: Skinfinity llega tarde al producto y temprano a la
categoría. M4 llega tarde a los dos.** No es una variante de la fórmula ganadora: es la fórmula
con la parte que sostiene el peso sacada.

### 4.3 Y la promesa central, mirada de cerca, es la más débil de las dos que hay en el mercado.

Esto es lo que más me preocupa del concepto y no es obvio. Cuando algo es el pie de página, nadie
lo examina. Cuando es la tesis del anuncio, **el espectador lo piensa**. Y pensado:

> "No pagás nada hoy" **no elimina el riesgo: lo posterga tres días.** Pagás en la puerta y te
> quedás con tres frascos y noventa días por delante. El riesgo de que no funcione —que es
> literalmente el riesgo que el anuncio nombra en el segundo 0— queda intacto.

Skinfinity ofrece **90 días con devolución del dinero si no ves resultados**. Eso sí cubre el
riesgo que M4 enuncia. O sea: **el anuncio abre invitando a la comparación exacta que perdemos.**
Como sello al pie, COD es una ventaja nuestra sobre ellos (menos fricción, no hay que dar la
tarjeta). Como tesis de 26 segundos, se convierte en la puerta por la que entra su garantía.

### 4.4 ¿Quién se autoselecciona con este hook?

No la que tiene caída. **El que desconfía de comprar por internet** — una población enorme,
transversal a todos los rubros, y de intención baja respecto de este producto.

Esto no es solo una debilidad creativa, es **veneno de targeting**: Meta aprende de los primeros
clicks. Si los primeros clicks vienen de gente que reacciona a "$0 hoy" y no de gente que
reacciona a "se me cae el pelo", el optimizador construye una audiencia de sensibilidad al pago y
la compone día tras día. En un ABO/CBO eso se cristaliza en 48-72 h y después no se corrige
apagando la pieza.

---

## 5. El riesgo del comprador equivocado en COD

Sí, está en el guion, y conviene ser preciso en vez de alarmista. Son dos riesgos distintos y el
grande no es el que parece.

**(a) Rechazo en la puerta — real, acotado, medible.** La base COD ya entrega ~54% blended
(Urbano jul-2Q 57,4%, piso). O sea que ~43-46% de lo despachado ya no se cobra, y cada uno de
esos es flete perdido: ese costo ya está adentro del break-even ($27.950 el x3). Un hook que
recluta compromiso marginal puede empujar la entrega de esa cohorte hacia abajo. Si cayera 5 pp,
el break-even del x3 baja de ~$27.950 a ~$25.400. **Contra el objetivo de $6.000 sigue habiendo
4,2× de colchón: no rompe la economía.**

**(b) El riesgo real es de MEDICIÓN, no de P&L.** Este es un creativo que puede mostrar un CPA
excelente en Meta y una cohorte mala en la puerta, y la tanda se lee al día 1-2 sobre CPA de
Meta. La entrega recién se ve a los 21-35 días. **O sea: si M4 gana, no vamos a saber si ganó de
verdad hasta tres semanas después, y para entonces ya se escaló.** Ese desfasaje es un problema
del creativo, no del panel.

**Mitigación sin romper el mensaje:** las dos que sirven son gratis.
1. **Dejar la descalificación adentro** ("son noventa días, si buscás algo para el finde, no es
   este"). Ya está en el guion y es el filtro correcto. Reforzarla nombrando la plata:
   *"cuando te llega, pagás los tres frascos juntos"* — dice el compromiso sin quitarle el
   beneficio de no pagar hoy.
2. **No leer esta pieza por CPA de Meta al escalarla.** Si pasa el escalón 1, gatear el escalón 2
   contra la entrega de su propia cohorte a 21 días, no contra el CPA a 7. Es una regla de lectura,
   no de creativo, y hay que escribirla el día 0 en el Runbook o no va a pasar.

---

## 6. Comparación

### (a) Contra lo que hacía ARRAIGO en agosto

| | Agosto (las 5 estáticas + el video ugcB) | M4 |
|---|---|---|
| Señal de categoría | inmediata (pelo/frasco en el cuadro 0) | ninguna hasta 0:03 (imagen) / nunca (voz) |
| Producto en cuadro | desde el segundo 0 | 0:18 genérico, 0:26 identificable |
| Anti-riesgo | franja al pie / cuerpo del copy | **la tesis entera** |
| Persona en cuadro | sí (UGC) | **no** |
| Riesgo de compliance | medio (`ba-raya` es un antes/después) | **bajo — el mejor de los dos** |

Se aparta en cuatro cosas. **Una le juega a favor** (sacarse de encima el antes/después: ese
`ba-raya` "gasta credibilidad en vez de comprarla" y además es el flanco de Meta).
**Tres le juegan en contra**, y una de ellas no está medida por nadie: **sacar la persona.**

Ojo con esto, porque es una duda seria y no la puedo cerrar. El dossier dice que el video le ganó
por goleada a la estática (CTR saliente 3,4-5,0% vs 1,0-1,5%). Pero **los videos que ganaron eran
UGC: había alguien hablando.** Y la estática que peor convirtió, `mecanismo-916`, está descrita
así: *"packshot bien producido… estéticamente la mejor pieza de la tanda y la que peor convirtió.
No tiene problema, no tiene persona que hable, no tiene tensión: es una foto de producto."*
**M4 es objetos + voz en off, o sea `mecanismo-916` en movimiento.** Puede que lo que ganó haya
sido la persona y no el movimiento. Nadie lo midió acá.

### (b) Contra la fórmula Skinfinity

| Regla | Skinfinity | M4 |
|---|---|---|
| 1 · hook = negación, cero branding a 3 s | ✅ y con categoría visible en el frame 0 | ⚠️ negación sí, **categoría no** |
| 2 · mecanismo con nombre propio | ✅ el tapón de sebo, la jojoba con apodo | ❌ **ausente**. "Romero y cafeína" es un commodity de ML |
| 3 · reencuadre del fracaso previo | ✅ "probaste todo, no es tu culpa" | ❌ ausente |
| 4 · enemigo con nombre | ✅ minoxidil, Turquía, farmacia | ⚠️ solo en el copy escrito ("sin minoxidil") |
| 5 · producto tarde + **modo de uso** | ✅ 0:23 de 0:47 | ✅ 0:26 de 0:42, con modo de uso. **Bien.** |
| 7 · cierre = reversión de riesgo | ✅ **al final** | ❌ **al principio Y al final** |
| 10 · 80% mecanismo / 15% producto / 5% oferta | ✅ | ❌ **~60% oferta / 25% producto / 0% mecanismo** |

Cumple 2 de 7. **El hueco más grande no es el hook: es el mecanismo.** La lectura corta del
análisis lo dice sin vueltas: *"Skinfinity no ganó con creativos: ganó con un mecanismo inventado
que justifica su activo… Lo caro de imitar no es el video: es decidir cuál es nuestro 'tapón de
sebo' para el romero."* M4 no tiene mecanismo, no tiene apodo del activo, no tiene causa con
nombre. Los 26 segundos que le sobran de logística de pago son exactamente los que le faltan ahí.

---

## 7. El resto de la checklist

**Legibilidad a 380 px**
- Checkout dentro del celular: **ilegible y prescindible.** No comunica nada.
- "$0 HOY": se lee perfecto. Es lo único legible de la primera mitad, y refuerza el rubro equivocado.
- Tres frascos ámbar en fila: legibles como objetos, **mudos como categoría.**
- Etiqueta a 0:38-0:42: se va a leer "ARRAIGO"; "SÉRUM ANTICAÍDA" queda al borde. No sirve de red.

**Primer cuadro / miniatura.** Regla dura de la casa: *miniatura elegida a mano* (la `is_preferred`
de Meta eligió una vez el antebrazo descamado y provocó un rechazo). Acá el riesgo es otro pero
igual de caro: **la miniatura automática más probable es el checkout o la mano vacía**, o sea que
la vista previa estática de este anuncio no dice nada de nada. **Miniatura obligatoria a mano: el
frame del gotero sobre la raya (0:26-0:33).**

**Compliance — es lo mejor que tiene la pieza.**
- Cero antes/después, cero cuero cabelludo con clareo, cero patología en cuadro. Riesgo Meta bajo.
- Cero claim de eficacia. De hecho el guion abre con un **anti-claim** ("todavía no sabés si te va
  a funcionar"), que es lo más defendible que se puede escribir.
- "Sin minoxidil" en el copy: nombrar la categoría es defendible; no se muestra ninguna caja de
  marca. OK.
- ⚠️ **Chequear**: "$0 HOY" como overlay es del tipo de cosa que Meta puede leer como oferta
  engañosa si la landing no dice lo mismo con la misma prominencia. Meta revisa hasta la landing.
  Verificar que "Pagás al recibir" esté arriba del pliegue de la landing. Son 2 minutos y no
  bloquea nada si está.

**Promesa.** No promete resultado. Es coherente y es honesto. El costo de esa honestidad es que
**tampoco promete nada más**: no hay beneficio, no hay identificación, no hay tensión. Un anuncio
puede no prometer resultado — Skinfinity casi no lo hace — pero entonces tiene que dar *mecanismo*
o *identificación*. M4 no da ninguno de los dos: da términos de pago.

**Riesgo de producción (si esto se genera con IA).** El concepto es **todo manos**: dedo sobre
pantalla, mano vacía, manos abriendo la caja, mano masajeando, mano recibiendo. Seis planos de
manos en 42 segundos **y ninguna cara que distraiga la mirada.** Manos y dedos —fundidos, de más,
de menos— es el defecto n°1 documentado de flux/nano-banana. Este guion maximiza la exposición al
modo de falla más frecuente que tenemos, y el protocolo permite **dos rondas de QA y después se
mata**. Traducido a plata: es de los conceptos más caros de producir por unidad de riesgo.

**Duración.** 42 s con avg watch histórico de 7-8 s y ThruPlay 24-29%. El diario ganador de
Skinfinity dura 37. No es el defecto principal, pero **si los primeros 5 segundos no se arreglan,
los otros 37 no se miran igual.** Recortar a ~30 s.

---

## 7 bis. La objeción de Pancho, contestada — y por qué el veredicto se endurece

Pancho, textual: *"Pensa a quien apunta un anuncio asi: no estas mostrando un producto, ni un
resultado. La gente, y mas el publico objetivo puntual, puede facilmente no saber de que se trata
y por ende no comprar"*.

**Tiene razón, y su formulación es más precisa que la mía.** Yo llegué al mismo defecto contando
palabras (§Veredicto: cero menciones de "pelo" en 42 segundos); él llega por el lado de a quién
convoca la pieza. Son la misma falla vista de los dos extremos del embudo. **El veredicto no
cambia: se endurece, y ahora por tres razones independientes en vez de una.**

### 7bis.1 · El dato que justifica M4 no aguanta la extrapolación

El argumento para ascender el anti-riesgo a mensaje visual propio fue: `copyD-antiriesgo` sacó el
mejor CTR saliente (4,63%) y el 2º hook rate (38,9%). Pero el experimento de agosto, mirado como
experimento, fue este:

| | Video (frame 0) | Texto |
|---|---|---|
| `copyA-molde` | `ugcB` | molde |
| `copyB-sinminoxidil` | `ugcB` | sin minoxidil |
| `copyC-identificacion` | `ugcB` | identificación |
| `copyD-antiriesgo` | `ugcB` | anti-riesgo |

**El visual fue la constante. El texto fue la variable.** Los cuatro thumbnails del frame 0 son
byte-idénticos (md5 `f06ab22409e0ebdebfb3adb8112e47ef`). Un experimento solo puede hablar de la
variable que movió: lo único que agosto midió es **texto anti-riesgo sobre un visual de producto**.

M4 hace la operación inversa: **conserva la variable y cambia la constante**, y presenta el
resultado como si fuera el mismo hallazgo. No lo es. Es una extrapolación sobre el eje que nunca
se varió — o sea, **está tratando el control como si fuera un resultado.**

Y el error apunta en la peor dirección posible. La métrica que M4 cita para justificarse —el hook
rate del 38,9%— **es la métrica que mide exactamente los primeros segundos de video**, es decir,
el canal que M4 se propone reemplazar. Es citar un número producido por un visual de pelo para
justificar sacar el visual de pelo.

Dicho con los números: la dispersión de hook rate entre los cuatro (33,9% – 40,2%) sobre un
**mismo archivo** es el piso de ruido del reparto de Meta, no un efecto del copy. Lo que el copy
sí movió, y es real, es el CTR saliente: convenció de clickear a gente **a la que ya había
enganchado un video de pelo.** De frame 0 no hay ni un dato.

**Conclusión: no hay ninguna evidencia de que un visual cuyo tema es el método de pago funcione.
La hay de que el TEXTO anti-riesgo funciona sobre un visual de producto.** Son dos afirmaciones
distintas y M4 se apoya en la que nadie midió.

### 7bis.2 · Le copia a Skinfinity la mitad de atrás de la regla

De la fórmula se tomó la regla 10: *"el producto no aparece antes de la mitad del video"*. Es una
regla real. Pero es la segunda mitad de una regla de dos partes, y la primera mitad es la que
sostiene el peso. Contra los guiones transcriptos:

| Guion | Tema en el segundo 0 | Producto entra | ¿Sabés que es de pelo a los 3 s? |
|---|---|---|---|
| 5.1 · La Cobra (1:11) | coronilla del streamer + *"me estoy quedando pelado de manual"* | 0:44 | **sí** |
| 5.2 · Diario (0:37) | *"Probando el serum capilar… 6 meses antes de hacerme un injerto"* | 0:00 | **sí** |
| 5.3 · Mito (0:47) | maquinita en cuadro + *"Raparte la cabeza no hace que el pelo crezca más fuerte"* | 0:23 | **sí** |
| 5.4 · Listicle (0:41) | *"Cuatro cosas que perdés cuando empezás a perder pelo"* | **nunca** | **sí** |
| **M4 (0:42)** | **checkout genérico + "¿Vos lo pagarías por adelantado?"** | 0:26 | **no** |

**4 de 4 abren en el problema.** El producto llega tarde; **el problema llega primero, siempre.**
La regla completa es *"el producto tarde, el problema en el segundo cero"*, y M4 copió la mitad
de atrás y tiró la de adelante.

El listicle `1464274602137331` es el contraejemplo que cierra la discusión: **no nombra el
producto ni una sola vez en 41 segundos** y aun así contesta la pregunta 1 de Pancho ("¿de qué es
esto?") en un segundo, porque su primera frase contiene las palabras "perder pelo". **Producto
tarde no es el problema. Problema ausente sí.**

### 7bis.3 · Con targeting abierto, el creativo ES el targeting — y este le da a Meta la señal equivocada

Público: mujeres 30-60, **país entero, sin intereses**. Meta no tiene otra cosa de dónde agarrarse
que la pieza: el contenido del video, el copy y la landing son literalmente lo que define a quién
busca. Dos mecanismos, y los dos juegan en contra:

1. **El sembrado.** Los primeros repartos salen de la semántica del anuncio. Un video cuyos
   primeros 10 segundos son una pantalla de checkout, un dedo, una mano vacía y un "$0" tiene la
   semántica de un anuncio **financiero o de oferta**. Meta va a arrancar buscando ahí.
2. **La composición.** Después el optimizador compone sobre quien enganchó primero. Y quien
   engancha primero con "$0 HOY" es el reactor a ofertas: una población **enorme, transversal a
   todos los rubros, baratísima de encontrar** —justo por abundante— y de intención nula respecto
   de un sérum capilar. En fase de aprendizaje el optimizador persigue engagement barato. Este
   creativo se lo ofrece en bandeja.

El perfil que sale de ahí es predecible y es el peor de todos para operar: **CPM bajo, CTR
decente, tasa de compra mala.** O sea, a las 48 h se lee como "promete, hay que optimizarlo", que
es exactamente el perfil del anuncio que se come el presupuesto sin convertir. Esta casa ya sabe
lo que cuesta: `copyA` se llevó el 43% del gasto de la campaña de agosto **por ventaja de entrega,
no de performance**.

Y hay un agravante que lo vuelve irreversible dentro de la tanda: **una vez que el ad set aprendió
sobre reactores al "$0", no se arregla editando el creativo después.** El ad set ya está compuesto.

**Respuesta directa a la pregunta de Pancho** — *¿alguien de ese público sabe en los primeros 10
segundos que esto es para su pelo?* **No. Y no es opinable, se cuenta:**

- **Palabras sobre pelo en los primeros 10 s: cero.** (En los 42, también cero.)
- **Imágenes de pelo: una**, el cepillo, desde el segundo 3.
- Y esa única imagen está **desmentida por su propio subtítulo**, que durante esos mismos 7
  segundos habla de cerrar una página web.
- A 380 px, un cepillo sobre una mesada sin contexto previo de caída es **un objeto doméstico
  cualquiera**: el pelo enredado es detalle de bajo contraste. Necesita que la voz lo señale, y la
  voz está hablando de otra cosa.

Diez segundos, cero palabras, una imagen ambigua contradicha por su propio texto. **Pancho la
cazó de un vistazo, que es exactamente lo que el protocolo dice que él caza y el QA forense no.**

### 7bis.4 · Y aunque se lanzara: no produciría un veredicto legible

Último punto, y es de método. Si M4 sale como está y le va mal, **no vamos a poder saber qué
falló**, porque cambia tres cosas a la vez respecto de lo que ya está medido: (1) el mensaje pasa
de cuerpo a visual, (2) el visual pasa de UGC con persona a objetos con voz en off, (3) la
categoría desaparece de los primeros segundos. Tres variables confundidas en una pieza.

El protocolo es explícito: *el hit rate no escala con piezas, escala con hipótesis*. **Una pieza
que no puede devolver un veredicto atribuible no es una hipótesis: es gasto.** Ese es el motivo
final por el que no debería producirse en esta forma ni siquiera "para ver qué pasa".

---
## 8. Qué lo vuelve LANZABLE

Hay dos caminos. **La Opción A rescata M4 como pieza; la Opción B rescata el ángulo sin producir
nada.** Ninguno de los dos tira el anti-riesgo: los dos lo devuelven al puesto donde ya está
medido que gana.

### Opción A — M4 arreglado: tres movimientos

### Movimiento 1 — Abrir con el cepillo. Es el mejor plano y hoy está enterrado.

**0:00 – 0:03 (reemplaza al checkout):**
> **Visual:** primer plano cenital del cepillo con la mata de pelo enredada. Una mano lo levanta
> y lo sacude contra el borde de la mesada. Nada más en cuadro. Sin celular, sin checkout.
> **Voz / subtítulo:** *"Esto es lo que junto en el cepillo cada mañana."*

Categoría resuelta en el segundo 0, en imagen **y** en palabra, sin marca, sin claim y sin
patología. Cumple la regla 1 de Skinfinity mejor que el guion actual, porque su "cero branding"
sigue siendo cero branding — pero deja de ser cero categoría.

### Movimiento 2 — La desconfianza queda, pero la dice ELLA, no el anunciante.

**0:03 – 0:08 (acá sí entra el checkout, que ahora tiene referente):**
> **Visual:** el celular con el checkout, el dedo dudando, cierra la pestaña.
> **Voz / subtítulo:** *"Ya probé cosas que no hicieron nada. Así que no, no voy a pagar por
> adelantado otros noventa días."*

Mismo ángulo anti-riesgo, misma tensión — pero ahora es **la voz de la que tiene el problema**,
no una observación sobre abandono de carrito. De paso entra la regla 3 de Skinfinity (reencuadre
del fracaso previo), que hoy no está.

### Movimiento 3 — El pago vuelve a ser el cierre, no la tesis.

Estructura nueva, ~32 s:

| t | qué se ve | voz |
|---|---|---|
| 0:00-0:03 | cepillo con pelo, se sacude | "Esto es lo que junto en el cepillo cada mañana." |
| 0:03-0:08 | checkout, el dedo cierra la pestaña | "Ya probé cosas que no hicieron nada. Así que no, no voy a pagar por adelantado otros noventa días." |
| 0:08-0:14 | gotero sobre la raya, masaje **(packshot adelantado)** | "Esto es romero y cafeína sobre la raíz. Diez gotas de noche, un minuto de masaje, sin enjuague. Sin minoxidil." |
| 0:14-0:20 | puerta, caja, manos abriéndola, tres frascos | "Te llega la caja, la abrís, ves los tres frascos y el aplicador." |
| 0:20-0:26 | tres frascos en fila, luz de cocina | "Te aviso una sola cosa: son noventa días. Si buscás algo para el finde, no es este." |
| 0:26-0:32 | mano recibiendo la caja, frasco arriba, etiqueta legible. Overlay "$0 HOY" acá | "Recién ahí le pagás al que te lo trajo. Antes no ponés un peso." |

Producto identificable en 0:08 en vez de 0:26. La reversión de riesgo cierra, como en el 100% del
mercado. "$0 HOY" sobrevive, en su lugar. La descalificación sobrevive entera.

### Cuatro arreglos obligatorios además de los tres movimientos

1. **Que la voz diga las palabras.** "Caída", "pelo", "raya" o "densidad" tienen que aparecer
   **al menos dos veces, una de ellas antes del segundo 5.** Hoy: cero en 42 segundos.
2. **Primer renglón del copy, arriba del "…ver más"** (Meta corta a ~125 caracteres). Hoy la
   parte visible no dice de qué es. Reemplazo:
   > *"Se me caía tanto el pelo que dejé de mirar el cepillo. Y aun así no iba a pagar 90 días de
   > tratamiento por adelantado."*
   El resto del copy actual queda igual: está bien.
3. **Headline.** "Envío Gratis 📦" en un anuncio cuyo tema es la plata **compite con "$0 hoy" y
   pierde**, y no aporta categoría. Cambiar a "Sin minoxidil · Romero para la raíz". Nota honesta:
   el headline era constante en las 9 piezas de agosto, así que cambiarlo introduce una variable
   más — pero acá el conflicto es explícito y vale pagar esa variable.
4. **Miniatura a mano**: el frame del gotero sobre la raya. Nunca la automática.

---

---

### Opción B — la conservadora, y es la que primero hay que correr

Hay un camino que cuesta **cero producción** y contesta la pregunta que M4 quiere contestar:
**devolver el anti-riesgo a copy sobre un visual de producto** — que es, palabra por palabra, la
configuración que ya midió bien en agosto.

`copyD-antiriesgo` no está muerto: está **pausado**, con su texto escrito y su video disponible.
Lo que M4 quiere averiguar —"¿el anti-riesgo aguanta como mensaje propio?"— se puede averiguar
subiéndole la dosis **en el texto**, sobre un visual capilar, sin producir un solo frame nuevo:

- Visual: `ugcB` (el que ya corrió) o cualquier visual nuevo de pelo del lote de la semana.
- Body: el copy de M4 tal cual está escrito. **Está bien: es lo mejor de todo el material.**
  Con el arreglo del primer renglón (§8, arreglo 2) para que la categoría quede arriba del
  "…ver más".
- Headline: "Sin minoxidil · Romero para la raíz".

Eso es un anuncio nuevo, con una hipótesis limpia y atribuible (¿la dosis alta de anti-riesgo en
el body mejora el CTR saliente sobre 4,63%?), y **su costo de producción es cero**.

**Orden recomendado:**

1. **Opción B primero.** Cuesta $0 producir y su veredicto es legible. Si el anti-riesgo escala
   como mensaje, se ve acá.
2. **Opción A (M4 arreglado, ~32 s) como UNA de las 3 hipótesis de la semana**, si hay presupuesto
   de producción de sobra — y sabiendo que es un concepto **todo manos, sin cara**, o sea de los
   más caros por unidad de riesgo de generación que podemos elegir (§7, riesgo de producción).
3. **M4 tal como está escrito hoy: no se produce.** Ni con retoques cosméticos. El defecto no es
   de ejecución, es de orden.

## 9. Las tres dudas que no puedo cerrar, y qué las cerraría

Están escritas como dudas a propósito, no como veredictos.

1. **¿Un video de solo objetos + voz en off sostiene el hook rate?**
   Nunca se midió acá. Todos los videos que ganaron tenían una persona hablando, y la pieza sin
   persona (`mecanismo-916`) fue la que peor convirtió de la tanda.
   **Lo cerraría:** cortar una versión de 15 s solo-objetos de un ganador que YA existe y leer
   hook rate a 48 h contra el UGC original. Es un escalón 1 (~$10.000), no una producción entera.
   **Esta prueba cuesta menos que producir M4 y contesta la pregunta que M4 asume.**

2. **¿El hook de plata trae cohortes de peor entrega?**
   No se puede saber con lo que hay: el anti-riesgo de agosto era cuerpo, no hook, y tenía 2
   compras. **Lo cerraría:** entrega de la cohorte por anuncio a 21-35 días. Como tarda tres
   semanas, **no puede ser el gate de lanzamiento: es el gate de escalado**, y hay que escribirlo
   el día 0 en el Runbook o se olvida.

3. **¿"$0 HOY" pasa como oferta no engañosa?**
   **Lo cerraría:** mirar que la landing diga "Pagás al recibir" arriba del pliegue. Dos minutos.

---

## 10. Resumen para el que apura

- **NO LANZABLE.** No por el ángulo: por el orden. Y con la objeción de Pancho encima, el
  veredicto **se endurece**, no se ablanda.
- **Cero señal de categoría en los cuatro canales que se ven primero** (primer cuadro, subtítulo
  de los 3 s, copy visible sin desplegar, headline). La voz no dice "pelo", "caída" ni "cabello"
  **ni una vez en 42 segundos.**
- **El dato que justifica M4 está mal extrapolado.** En agosto el visual fue la CONSTANTE (mismo
  archivo `ugcB`, thumbnails byte-idénticos) y el texto la variable. Lo medido es *texto
  anti-riesgo sobre visual de producto*. **No hay ni un dato sobre un visual de método de pago** —
  y el número que M4 cita, el hook rate, mide justo el canal que M4 se propone reemplazar.
- **Le copia a Skinfinity la mitad de atrás de la regla.** En sus 4 guiones el producto llega
  tarde pero **el problema está en el segundo cero, 4 de 4.** El listicle no nombra el producto
  jamás en 41 s y aun así se entiende en 1 s, porque su primera frase dice "perder pelo".
  Producto tarde no es el problema. Problema ausente sí.
- **Con targeting abierto, el creativo ES el targeting.** Un video de checkout + dedo + "$0" le da
  a Meta semántica de anuncio financiero y compone la audiencia sobre reactores a ofertas:
  transversales, abundantes, baratos y de intención nula. Perfil esperable: CPM bajo, CTR decente,
  compra mala — o sea, el anuncio que a las 48 h "promete" y se come el presupuesto.
- **Aunque saliera, no devolvería un veredicto legible:** cambia tres cosas a la vez (mensaje de
  cuerpo a visual, UGC con persona a objetos, categoría fuera del arranque). No es una hipótesis,
  es gasto.
- **Lo bueno se conserva entero:** la descalificación de los 90 días, el modo de uso, el último
  cuadro con producto en mano, el copy escrito (es lo mejor del material) y **el mejor perfil de
  compliance que tuvo ARRAIGO** — cero antes/después, cero patología, cero claim de eficacia.
- **Qué hacer:** correr primero la **Opción B** (el copy anti-riesgo sobre un visual de pelo —
  costo de producción $0, hipótesis limpia). La **Opción A** (M4 reordenado a ~32 s, abriendo con
  el cepillo) queda como una de las 3 hipótesis de la semana si sobra presupuesto, sabiendo que es
  un concepto todo manos y sin cara, o sea caro por unidad de riesgo de generación.
