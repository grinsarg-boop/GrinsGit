# Competencia capilar (no-Skinfinity) — Meta Ad Library AR — 03/09/2026

Barrido para ARRAIGO (sérum romero + cafeína + Capixyl, sin minoxidil, COD + ML). Alcance: todo competidor capilar activo en AR **menos Skinfinity** (cubierto en paralelo). Rubric: skill `creativos-meta` (hook · cuerpo · oferta · CTA · visual · ángulo, señales de escala en vez de CPA).

## Qué ya estaba en el vault (no se reinvestiga)

- `20-Ads/Competencia.md:45-60` — Skinfinity ya relevado el 01/09: ~40 ads activos / 7 copys, fórmula hook-negador → mecanismo inventado → enemigo nombrado (minoxidil/finasteride) → producto tarde → reversión de riesgo; NO es COD (Tiendanube + MP, 3 cuotas); ancla $79.999 x3+shampoo. Assets en `docs/creativos/skinfinity-2026-09/`.
- `Competencia-Altier.md` y `Benchmark-Packaging-Altier-Skinfinity.md` — no tocan competencia capilar (Altier no es del rubro capilar; el segundo solo compara packaging de Skinfinity, no trae anunciantes nuevos).
- **Nuevo en este barrido:** Capilux, Alfagrow, Tienda Digital (marca "Hair Biolabs"), Excalvo/Excalvo — ninguno estaba documentado.

## Método y una advertencia sobre las fechas

Barrido combinado: `ads_library_search` (conector Meta, `countries:["AR"]`, `ad_active_status:"ACTIVE"`) para descubrir anunciantes y contar volumen por página, más navegación directa a `facebook.com/ads/library/?id=<ID>` (Browser pane) para leer el copy real, el estado "Started running on..." tal como lo muestra la UI, y extraer las URLs de video del CDN.

**Ojo:** los campos `ad_creation_time`/`ad_delivery_start_time` que devuelve la tool del conector están recortados a una ventana reciente (todos caían entre el 14/08 y el 03/09, sin importar el anunciante) — NO son la fecha real de inicio. La fecha citada abajo en cada pieza es la que muestra la propia UI de Ad Library ("Started running on"), verificada a mano ad por ad. Donde la UI mostraba "Started running on Sep 3, 2026 · Total active time 6 hrs" para TODOS los ads de un anunciante a la vez, lo marco explícitamente como longevidad no probada (puede ser relanzamiento diario del wrapper del ad mantiendo el mismo copy, como ya se documentó para Skinfinity, pero no hay forma de probarlo desde afuera).

---

## 1. CAPILUX ARGENTINA — dispositivo de luz roja (NO serum)

- **Página:** Capilux Argentina · **Sitio:** capiluxoficial.com · **Producto:** "Capilux", gorra de luz roja + infrarroja para uso en casa (no es tópico).
- **Señal que lo rankea:** longevidad + volumen. 99 ads activos hoy; el más antiguo visible sigue "Active" desde **5 de agosto de 2026** (~29 días corridos) — declarado ganador por el anunciante. Duplicación: decenas de recortes de video (24s a 1:58) con el MISMO body copy.
- **Mejor pieza:** Library ID **1589296559661741** — video, **0:47**, activo desde **11/08/2026**, sigue activo hoy.
  - Asset: `1589296559661741-capilux-gorra-entrada-coronilla.mp4`
  - Transcripción completa: `transcripts/1589296559661741-capilux-gorra-entrada-coronilla.txt`
  - **Hook (palabra por palabra, primeros ~3s, sobre foto vieja en pantalla):** *"Esta foto soy yo hace 10 meses, y todavía me acuerdo del día que me la sacaron, porque fue la que me hizo decir: basta. No te voy a vender un milagro, te voy a contar lo que me pasó a mí."*
  - **Estructura:** hook testimonial en 1ª persona (foto "antes") → mecanismo minimizado ("el primer mes no vi nada, todo el trabajo pasa abajo, donde no se ve") → prueba progresiva mes a mes (mes 2: menos caída; después: más cuerpo) → disclaimer honesto ("no le funciona igual a todo el mundo") → oferta: **6 cuotas sin interés de menos de $25.000, envío gratis, 90 días para probarla**.
  - **Palanca de cierre:** cuotas + garantía de prueba (90 días), NO urgencia ni descuento agresivo.
  - **Segunda pieza notable:** ID 3559113867597347 y variantes — hook alternativo por pregunta de síntoma: *"¿Notás que la entrada o la coronilla se empieza a ver más?"*
- **COD / cobro:** **NO es COD.** Lo dice el propio guion ("6 cuotas sin interés"). Checkout propio, prepago con tarjeta.
- **Copiable para ARRAIGO:** el framing "no vendo milagro, cuento lo que me pasó" + ritmo mes-a-mes con expectativa realista (mes 1 sin nada, mes 2 recién se nota) — reduce fricción de escepticismo sin prometer de más. Es la pieza MÁS limpia en compliance de todo el barrido: no nombra DHT, hormonas, ni minoxidil.
- **NO copiable:** nada relevante — es la referencia de "cómo sí" en compliance.

---

## 2. ALFAGROW / ALFAGROW MAN — sérum con romero + péptidos de cobre (competidor directo de fórmula)

- **Páginas:** Alfagrow (page_id 102024532506591, ~208 ads activos) + Alfagrow Man (954551061085653, ads adicionales) · **Sitio:** alfagrow.store (Shopify confirmado + Mercado Pago confirmado por HTML, 10 menciones de "cuotas").
- **Señal que lo rankea:** volumen máximo del barrido (~210+ ads activos combinados) y longevidad más larga verificada: el ad activo más antiguo visible corre desde **15 de julio de 2026** (~50 días). Duplicación explícita: la propia UI marca "12 ads usan este creativo y texto", "6 ads...", "10 ads...".
- **Fórmula: péptidos de cobre + extracto de romero** — mismo activo base que ARRAIGO.
- **Mejor pieza:** Library ID **1078569368488249** (mismo copy que la variante larga descargada) — video, **1:58** (hay cortes hermanos de 20s a 2:00 del mismo guion), activo desde **28/08/2026**, sigue activo.
  - Asset (corte largo, 85s, mismo copy): `alfagrow-flagship-85s-menospelo-ducha.mp4`
  - Asset (corte corto, 20s, variante "2X1"): `1598913671581011-alfagrow-2x1-nuevospelitos.mp4`
  - **Hook (palabra por palabra):** *"🚿 Menos pelo en la ducha. Más confianza frente al espejo."*
  - **Estructura:** hook-síntoma corto → mecanismo en bullets ("reactivar folículos dormidos y fortalecer el crecimiento desde la raíz 🧬 Péptidos de cobre 🌿 Extracto de romero 💧 Fórmula liviana") → prueba social nacional ("Cada vez más hombres en Argentina lo están usando") → oferta rotativa.
  - **Palanca de cierre:** rota entre **2X1 SOLO HOY**, **Últimas unidades**, **80% OFF HOY** + ancla fija **"⭐21.695 Clientes Satisfechos"** + sello **"✅Aprobado por ANMAT"** en varias piezas.
  - Variantes de ángulo activas en paralelo: *"De entradas irregulares a nuevos pelitos en semanas"*, *"De calvicie a nuevos pelitos en semanas"*, *"Tu cabello cambia cuando empezás a usar los activos correctos"*.
- **COD / cobro:** **NO es COD.** Shopify + Mercado Pago + cuotas, confirmado en el HTML de la landing.
- **Copiable:** el activo compartido (romero) da licencia para el mismo tipo de bullets de ingrediente + textura + aroma; el sello de aprobación regulatoria (si ARRAIGO tiene RNPA/registro ANMAT vigente, mostrarlo es seguro y ellos lo usan con buen resultado aparente — está en más de una pieza activa desde hace semanas).
- **NO copiable:** *"reactivar folículos dormidos"*, *"fortalecer el crecimiento desde la raíz"*, *"nuevo crecimiento desde la raíz"*, *"de calvicie a nuevos pelitos"* — son claims de regrowth/mecanismo folicular, cruzan la línea de cosmético grado 2.

---

## 3. TIENDA DIGITAL (marca en pauta: "HAIR BIOLABS ARGENTINA") — sérum anticaída doble acción

**⚠️ Aviso aparte de compliance de marca, no solo creativo:** el anunciante pauta bajo el producto **"HAIR BIOLABS ARGENTINA"**, dominio **biolabsargentina.shop** — el `<title>` del sitio es literalmente el placeholder genérico **"Mi tienda"** (plantilla de e-commerce sin personalizar), lo que sugiere una operación de dropshipping genérica más que una marca real con espalda. El nombre "Hair Biolabs" colisiona directamente con el nombre comercial de la empresa (BioLabs) en el mismo rubro y país. Vale un vistazo desde el lado marcario, no solo creativo — no as investigado más porque es un tema de otro tipo de riesgo, no de creativos.

- **Página:** Tienda Digital · **Señal que lo rankea:** diversidad angular, no longevidad — **los 11 ads activos muestran "Started running on Sep 3, 2026 · Total active time 6 hrs" (hoy), varios marcados "Low impression count"**. No hay ganador probado en el tiempo todavía con este dato; la señal real es que lanzaron **11 guiones 100% distintos el mismo día**, todos con el mismo producto/mecanismo, segmentando por 6+ personas (hombres con entradas, mujeres 40+/menopausia, SOP, "tu hijo te preguntó", raya central que se ensancha, etc.) — arquitectura de testeo amplio, no un solo ganador iterado.
- **Dos piezas destacadas:**
  1. Library ID **1580066700532637** — video (0:00/2:59 en la librería; el asset del CDN es un preview corto de 7s), activo hoy.
     - Asset: `1580066700532637-hairbiolabs-amigo-calvicie.mp4` (preview corto)
     - **Hook:** *"¿Te pasó alguna vez ver a un amigo que venía perdiendo pelo hace años y de repente lo notás impecable, con las entradas cerradas y sin rastros de calvicie?"*
     - **Estructura:** curiosidad (amigo transformado) → nombra minoxidil como lo que el amigo "ya no usa" → mecanismo (no explicitado en esta pieza) → resultado ("cero grasa, absorción rápida") → CTA a garantía.
  2. Library ID **1390684979194783** — video, **2:51**, activo hoy.
     - Asset: `1390684979194783-hairbiolabs-menopausia.mp4`
     - **Hook:** *"¿Sentís que tu pelo perdió fuerza y volumen desde que empezó la menopausia? No estás sola ni haciendo nada mal en tu rutina diaria."*
     - **Estructura:** hook-síntoma por etapa de vida → mecanismo ("el verdadero problema es hormonal: la DHT ataca directo al folículo") → reencuadre esperanzador ("los folículos siguen vivos") → producto → CTA a garantía.
  - **Palanca de cierre común a las 11:** garantía de devolución (120 días en varias) + envío gratis; landing confirma **"Resultados o te devolvemos el dinero"**, **"Garantía 120 días"**, reseñas genéricas (Lucas F./Diego M./Camila R.) y claim **"Frena la caída hasta un 60%"**.
- **COD / cobro:** no confirmado en el copy (no aparece "COD" ni "pagás al recibir" en ninguna de las 11 piezas); la landing ofrece "Ver precio y opciones de pago" como paso aparte — consistente con prepago tipo Tiendanube/Shopify, no con COD.
- **Copiable:** la ESTRUCTURA de autoridad de tercero con oficio real (barbero/peluquera contando lo que ve "en la silla todos los días") es una forma de prueba social profesional fuerte y adaptable sin nombrar mecanismo; la segmentación por síntoma visible específico (entradas vs. coronilla vs. raya central) en vez de "caída" genérica.
- **NO copiable — la pieza con más riesgo de compliance del barrido:** DHT nombrada explícitamente en las 11 piezas, "SOP" (síndrome de ovario poliquístico) nombrado como causa — es nombrar una patología médica —, "bloquea la DHT", comparación implícita con minoxidil, claim numérico "60% menos caída" sin estudio mostrado. Ni el mecanismo ni el % son usables para ARRAIGO.

---

## 4. EXCALVO — shampoo anticaída (romero + cebolla morada + queratina)

- **Página:** Exclavo · **Sitio:** excalvo.com.ar (landing caída al momento de este barrido, no resolvió — no se pudo confirmar método de cobro desde la web).
- **Señal que lo rankea:** duplicación total, no longevidad — los 7-8 ads activos también muestran **"Started running on Sep 3, 2026"** (hoy) para todos, así que tampoco hay longevidad probada hoy. La señal real es que **el body copy es idéntico, carácter por carácter, en las 8 piezas**, con la única variable siendo la duración del corte de video: **0:25, 0:35, 0:58, 1:06, 1:36, 2:10, 2:33, 5:56** — el ejemplo más limpio del barrido de "iterar el formato, no tocar una coma del guion".
- **Mejor pieza (la VSL completa):** Library ID **4649759555256590** — video, **5:56**, activo hoy.
  - Asset: `4649759555256590-excalvo-vsl-completa-556.mp4`
  - Transcripción completa (Whisper): `transcripts/4649759555256590-excalvo-vsl-completa-556.txt`
  - **Hook (palabra por palabra, primeros ~3s):** *"Hay algo que tu médico nunca te dijo sobre por qué se te está cayendo el cabello. No es la genética, no es el estrés, no es la edad: es una sola cosa."*
  - **Estructura completa (la más desarrollada del barrido):** hook negador (nunca nombra el producto en el arranque) → autoridad con nombre propio inventado ("un tricólogo, Andrés [Romero], pasó 10 años investigando") → bloque emocional de síntomas ("la almohada con más pelo", "el desagüe de la ducha que ya no querés ver", "esa foto en la fiesta donde no te reconociste") → mecanismo (DHT nombrado, explicado paso a paso) → reencuadre ("el folículo no está muerto, está dormido") → **enemigo nombrado con comparación clínica directa**: *"el romero igualó al minoxidil, el tratamiento de referencia, pero sin la irritación y sin la dependencia"* → tres activos (romero, cebolla morada, aceite de coco) → marca revelada tarde ("Andrés lo llamó Xcalvo") → escasez artesanal ("solo se hacen 500 frascos al mes, a mano") + prueba social ("+13.000 hombres, 87% vio resultados en 90 días") → **garantía 90 días "sin preguntas"** → CTA.
  - **Palanca de cierre:** garantía total + escasez de manufactura (no descuento, no countdown falso).
- **COD / cobro:** no confirmado (landing caída); el copy no menciona COD en ningún momento, coherente con el resto de la categoría (prepago + garantía como sustituto del riesgo).
- **Copiable:** el nivel de detalle sensorial en el dolor (imágenes concretas: almohada, desagüe, foto de fiesta) es objetivamente el mejor copy del barrido y es 100% portable sin tocar mecanismo — es técnica de escritura, no un claim. El cierre de escasez artesanal ("se hace a mano, por eso hay pocos frascos") es una palanca honesta y copiable.
- **NO copiable — la pieza MÁS peligrosa de compliance de las cuatro:** el bloque completo de mecanismo DHT, la comparación clínica directa con minoxidil nombrado, la mención de que las pastillas "cuestan la libido" (alusión directa a finasteride y efectos sexuales), "folículo dormido que se puede despertar". Se puede robar la emoción; ni una palabra del mecanismo.

---

## Descartados (barridos, no analizados en profundidad)

- **Kérastase** (L'Oréal) — marca de lujo/salón, sin CTA de compra directa visible, sin COD, canal y precio no comparables a COD. Categoría-referencia, no competidor táctico.
- **Valenta Argentina** — 135 ads activos pero multi-producto genérico (su otro SKU dominante es "El mineral N.º 1 para el dolor articular"); apareció por match ambiguo, no es una marca capilar dedicada.
- **Alpha For Men** — 89 ads pero multi-producto (cremas antiedad, skincare hombre); su único SKU capilar es "Serum Anticanas" (canas, no caída/crecimiento) — no compite con ARRAIGO.
- **Melissa Ribeiro** — 53 ads pero es un dropshipper multi-nicho (mezcla "Devolvele la vitalidad a tu pelo" con "Llevá 3 y pagá 1" de decoración del hogar); sin foco de marca capilar.
- **AVENOR / página "Agus aguirre"** — solo 6 ads, foco capilar real ("Empezá a cuidar tu cabello hoy") pero escala insuficiente para analizar en profundidad.
- **Nourvell** — solo 5 ads ("Envío gratis y 3 cuotas"), volumen insuficiente.
- **Dermaraiz** — solo 4 ads, aunque el más viejo corre desde el 14/08 (~3 semanas) — longevidad real pero volumen demasiado bajo para el corte de este barrido.

---

## Los 3 ángulos que la categoría entera usa y ARRAIGO no

1. **Mecanismo hormonal explicado + enemigo nombrado.** Los 4 competidores relevados (y Skinfinity, ya documentado) arman todo el copy alrededor de "la DHT ataca el folículo" y nombran minoxidil/finasteride como lo que no funciona. Es el músculo central del copy de toda la categoría — y es exactamente lo que compliance le bloquea a ARRAIGO por ser cosmético grado 2. No es una oportunidad perdida: es la razón de ser del corte de compliance.
2. **Autoridad de tercero con oficio real contando la historia de otro** (barbero, peluquera, tricólogo con nombre propio) en vez de testimonial en primera persona o UGC genérico. Tienda Digital construyó 11 variantes completas sobre esto. Es 100% compatible con compliance si se corta el mecanismo — y no vimos evidencia de que sea parte del repertorio habitual.
3. **Segmentación por síntoma visible específico y momento de vida** (entradas vs. coronilla vs. raya central; mujeres 40+/menopausia vs. hombres 25+) en vez de "caída del pelo" genérico. Tienda Digital es el caso extremo (11 personas distintas, mismo producto); Alfagrow también corre 3-4 variantes de síntoma en paralelo.

## El hueco que nadie está ocupando

**Ningún competidor relevado es COD.** Los cuatro (Capilux, Alfagrow, Hair Biolabs/Tienda Digital, Excalvo) son prepago — Shopify o Tiendanube + Mercado Pago/tarjeta/cuotas — y los cuatro compensan el riesgo de pagar sin haber visto resultado con garantías largas (90 a 120 días, devolución "sin preguntas"). Ese es el trabajo pesado de todo su copy de cierre. ARRAIGO ya resuelve ese riesgo de raíz por ser COD, pero en ningún lugar de este barrido apareció un mensaje que lo convierta en EL hook: "pagás cuando lo tenés en la mano, ni siquiera necesitás tarjeta" es una frase que ningún jugador de esta categoría puede decir con la misma honestidad. Es el ángulo abierto.

## Assets descargados

Carpeta: `docs/creativos/competencia-capilar-2026-09/`

| Archivo | Anunciante | Ad ID | Duración | Nota |
|---|---|---|---|---|
| `1589296559661741-capilux-gorra-entrada-coronilla.mp4` | Capilux | 1589296559661741 | 0:47 | transcripto |
| `1598913671581011-alfagrow-2x1-nuevospelitos.mp4` | Alfagrow | 1598913671581011 | 0:20 | corte corto |
| `alfagrow-flagship-85s-menospelo-ducha.mp4` | Alfagrow | (creative compartido, 12+ ads) | 1:25 | corte largo, mismo copy que 1078569368488249 |
| `1580066700532637-hairbiolabs-amigo-calvicie.mp4` | Tienda Digital / Hair Biolabs | 1580066700532637 | 0:07 (preview) | asset corto, ver body copy completo en informe |
| `1390684979194783-hairbiolabs-menopausia.mp4` | Tienda Digital / Hair Biolabs | 1390684979194783 | 2:51 | completo |
| `4649759555256590-excalvo-vsl-completa-556.mp4` | Excalvo | 4649759555256590 | 5:56 | completo, transcripto |

Transcripciones completas en `transcripts/`.
