---
name: qa-ojo-de-cliente
description: Auditar creativos publicitarios (estáticas o video) como si los mirara el comprador, y dar veredicto binario lanzable / no lanzable antes de que la pieza llegue a Pancho o se gaste plata en producirla. Usar cuando haya candidatos generados por IA para una tanda de anuncios, cuando se pida QA de creativos, cuando se vaya a mandar piezas para aprobar, o antes de gastar en HeyGen/Kling sobre una estática base. NO es QA de diseño ni de compliance técnico — eso es otra cosa.
---

# QA con ojo de cliente

No evaluás diseño. Adoptás la persona del comprador y mirás la pieza como la ve él, en el feed,
a la velocidad del feed.

## 1. Antes de mirar nada, definí dos cosas

**La persona.** Concreta, no un segmento. Para BeeVenom: *mujer de 47, conurbano bonaerense, piel
reactiva hace años, ya probó cremas de farmacia, pasa el feed rápido a la noche*. Si el producto es
otro, construila con el mismo nivel de detalle desde el vault (`20-Ads/`, `10-BioLabs/`).

**La vara.** No un ideal abstracto: **el anuncio que hoy vende**. Traelo por API y mirálo primero.
Un candidato pasa solo si le compite de igual a igual. Si no sabés cuál es el que vende, averigualo
antes — sin vara no hay veredicto.

## 2. Las cinco preguntas, en orden

1. ¿Me freno en 1 segundo?
2. ¿Entiendo qué es en 2?
3. ¿Me la creo, o parece IA / stock?
4. ¿Entiendo la oferta?
5. ¿Qué rompe la ilusión?

## 3. Veredicto

Binario: **lanzable** / **no lanzable**. **Si dudás, es no lanzable.**

Calibración real de este filtro: 11 candidatos → 1 aprobado; 2 layouts nuevos → 0; el video v13
pasó recién en la cuarta ronda. Una tasa de aprobación alta significa que lo estás corriendo mal.

## 4. Mirá a tamaño de feed, no a tamaño de archivo

Renderizá la pieza a ~380px de ancho y mirala ahí. La mitad de los defectos que importan (texto
que no se lee, oferta sin jerarquía, cara que no se distingue) solo aparecen a ese tamaño, y la
mitad de los que no importan (píxeles de la etiqueta) desaparecen.

## 5. Defectos que ya costaron plata — buscalos explícitamente

- **Manos y dedos.** Fundidos, de más, de menos. El defecto más frecuente de flux/nano-banana.
- **La etiqueta del envase escrita por el modelo.** «Bea Vonom», «Paorlosis», etiqueta espejada.
  Vara: garble que forma palabras falsas legibles = NO. Texto chico empastado sin forma de palabra = OK.
- **Textura de piel que se va a los extremos.** Purpurina brillante, filamentos, costras negras.
  Lo que funciona es seca y descamada, sutil; lo que gatilla política de Meta es la lesión.
- **El producto no se usa.** Brazos cruzados abrazando el envase = packshot con modelo, no demo.
  Medido: el que vende tiene el producto en la mano los 15s, marca legible a 1,33s contra 6,83s.
- **La oferta perdió jerarquía.** En el ganador el `2x1` es el elemento más grande de la pieza.
  Si hay que buscarlo, la pieza no vende. (Trampa conocida: el overlay de AppAds no embebe fuente
  bold, así que `fontWeight: 800` no se aplica y todo sale en peso regular.)
- **Escena donde no aparece el problema que el producto resuelve.**
- **Estrellas de puntaje sin número, caras cortadas, envases fuera de escala.**
- **Video:** ¿en qué segundo aparece el producto? ¿en qué segundo se entiende la oferta? Si el
  producto llega después de los 3s, no lanzable.
- **Continuidad entre planos.** Si el anuncio alterna cara y b-roll, el estado del cuerpo tiene
  que ser el mismo en todos. Un brazo que aparece irritado, después sano y otra vez irritado
  rompe la ilusión más que cualquier defecto de textura.
- **Casting de plano en el b-roll.** El cierre y los tramos sin lipsync van con manos y producto,
  nunca con la cara del actor: una cara a cámara con la boca cerrada mientras su propia voz habla
  se lee como error de edición. (Es lo que hace el ganador de Pureza.)

## 5.bis Video: el audio también se audita

Un QA por frames NO es un QA de video. Antes de dar veredicto:

- **El género de la voz tiene que coincidir con el actor en pantalla.** Falló en vivo el
  03/08/2026: se usó el `ELEVENLABS_VOICE_ID` del env —que es la voz femenina de la actriz
  propia— sobre un actor masculino, y el filtro visual no lo vio.
- Si no podés escuchar el audio, **medí el pitch** en vez de asumirlo. Autocorrelación sobre el
  wav, saltando silencios: hombre 85-180 Hz · mujer 165-255 Hz. Es un chequeo de diez líneas y
  convierte una promesa en un dato.
- Chequeá también que la voz no se corte al final (duración del video ≥ duración del audio) y
  que el acento sea el del mercado, no un neutro de locutor.

## 6. Qué entregar

- La lista de **aprobados** (puede estar vacía).
- Los **3 defectos más repetidos entre candidatos** — eso dice qué arreglar en el generador en
  vez de pieza por pieza. Es la parte de mayor valor del informe.
- El análisis largo va a un archivo; en la respuesta solo aprobados + defectos + la ruta.

**Si no pasa ninguno, decilo y no mandes imágenes.** Mandar igual «para que veas» es exactamente
lo que este filtro existe para evitar.

## 7. Lo que este QA NO es

No reemplaza al QA técnico de la Fábrica (`lib/claude.mjs` → typos, claims, política de Meta) ni
al chequeo de compliance sobre la landing. Corrélos aparte. Este contesta una sola pregunta:
**¿esto frena el scroll y vende?**
