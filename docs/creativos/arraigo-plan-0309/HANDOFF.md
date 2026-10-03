# Handoff — ARRAIGO, sesión del 03-04/09/2026

## ESTADO

Arrancá por estas dos, en este orden:

1. **Publicar `plan-exacto.html` como Artifact.** Quedó sin publicar el 04/09 por contexto, no por un
   problema. Fuente: `~/Downloads/ProyectoEco/docs/creativos/arraigo-plan-0309/06-plan-exacto.md`.
2. **Pedir a Pancho el OK del escalón 2 de ARRAIGO**: P1 y P2 en video, **US$18-20** en fal.
   El escalón 1 está cerrado y aprobado — 4 estáticas lanzables en `prod/v2/`
   (A1 `NO ES EL SHAMPOO. ES LA RAÍZ.` · A2 `NO QUERÍA EMPEZAR CON MINOXIDIL.` ·
   A3 `MES 1: NO PASA NADA.` · A4 `PAGÁS CUANDO LO TENÉS EN LA MANO.`), gasto real US$1,35 de US$6.
   **Pendiente de la última corrida**: Pancho pidió el frasco ~25% más chico; el contacto comparativo
   queda en `prod/qa/380/contacto-v3-frasco-380.png` y las piezas nuevas en `prod/v3/` — él elige
   entre v2 y v3 antes de cargar nada.

Lo que ya está cerrado y NO hay que re-derivar:

- **La tanda está planificada y NADA lanzado: 14 anuncios · 9 ad sets · 1 campaña ABO.**
- **Cuenta: Tienda R2 `act_880189106877616`.** No R3, porque R2 no paga el impuesto no recuperable
  del **36,4%**; el sobrecosto que se evita en el **tramo A es $39.312**. Los tramos exactos están en
  `06-plan-exacto.md`, no los recalcules. El píxel BioLabs `781630351556303` es el **mismo** en R2 y
  R3, así que mudar de cuenta no parte la señal de conversión.
- **Piso de presupuesto: $25.000/día por ad set.** A $6.000 de CPA real, salir de aprendizaje pide
  50 conv/semana = **$42.857/día por ad set**; a $12.000/día junta 14 y no sale nunca.
- **Vara del día 0 — NO consagrar ni matar por CPA.** Orden de lectura: reparto del gasto → CTR →
  **costo por Initiate Checkout** → mix del x3. Equilibrio por IC **$2.360** (canon 2,54 IC/compra;
  la medición propia de 3,3 daría $1.818, anotada y **no aplicada**), CPA por unidad ≤$6.000,
  mix x3 ≥60%. Referencia de agosto: LPV→IC **8,0%** (414→33) contra 17,5% de Pureza con el mismo form.
- **Antes de leer cualquier CPA, medí el mix del x3.** La escalera cambió el 04/09
  (x1 $49.900 · x2 $64.990 · x3 $79.990 c/aplicador) y el salto x2→x3 se encareció **49%**
  ($10.090 → $15.000). Margen mezclado por pedido creado $30.454 → **$26.468** (−13%);
  BE del x3 $33.925 → **$28.815**.
- **Bug abierto que puede cobrar de más:** los SKU en Veltron siguen con precios viejos —
  `ARRAIGO-X3K` $79.900 y `ARRAIGO-X3A` $89.900.

Pendientes operativos que no son de ARRAIGO:

- **Mail a Fixy para anular la guía `1805691`**, que tenía retiro pactado el 04/09.
- **Pedido `#21200`** (x2, Mendoza, `pendiente` desde el 24/08) y **reclamo del `#21196`** a Urbano.
- **Compactar `MEMORY.md`**, que llegó a 161 líneas.

## LO PRIMERO: la tanda ya está corriendo (lanzada 04/09, arranca 05/09 00:00)

**Campaña `ARRAIGO · ABO Open · 05-09` (`120251245370920152`), Tienda R2 `act_880189106877616`, ACTIVE.**
Dos conjuntos, mismo targeting Open (mujeres 30-60, AR menos Chubut/San Luis/Santa Cruz/Tierra del Fuego),
los dos arrancando el **05/09 a las 00:00 ART**:

| conjunto | id | $/día | contenido |
|---|---|---|---|
| `arraigo-OPEN-AR-3060-estaticas-25k` | `120251247591590152` | $25.000 | 4 estáticas nuevas |
| `arraigo-OPEN-AR-3060-50k` | `120251245371180152` | $50.000 | 5 videos de agosto |

**Total $75.000/día.** Anuncios de estáticas: `e6raya-copyC` `120251247592770152` ·
`e1puerta-copyD` `120251247593700152` · `e3kit-copyA` `120251247594600152` ·
`e2sinminox-copyB` `120251247595870152`.

### La vara, escrita ANTES de ver un resultado (04/09)

Anclas de agosto: video $217/LPV y LPV→IC 6,8% · estáticas de ARRAIGO $620/LPV · estáticas ganadoras
de la casa 1,7-3,3% de CTR saliente · LPV→IC agregado 8,0% · **3,3 IC por compra medido** (canon 2,54) ·
equilibrio **$2.360 por Initiate Checkout** · blended de agosto **$3.456/IC**.

- **Video, día 1:** ~230 LPV, ~16 IC, **$/IC ~$3.200**, 4-6 compras. Es una replicación: si da eso,
  es "igual que antes", NO un fracaso.
- **Estáticas, día 1:** rango honesto **4 a 11 IC, $/IC $2.300 a $6.200**. Las dos anclas se
  contradicen (las estáticas propias de agosto contra la fórmula ganadora de la casa que estas copian)
  y ese ancho es justamente lo que el test viene a contestar. **No acreditar la mejora antes de medirla.**
- **El día 1 casi no informa.** La lectura real es a 72 h. Lo único que sí es señal el día 1:
  una estática con $6.000 gastados y **0 IC está muerta**; y el **reparto** del gasto — si en el
  conjunto de video dos anuncios se comen el 70%, los otros tres no van a tener veredicto propio.

### Dos cosas que van a ensuciar la lectura, ya sabidas

1. **5 anuncios en el conjunto de video** es demasiado: en agosto, con 7, `copyA` se llevó el 43% del
   gasto y el resto murió sin veredicto. Si a 48 h el gasto está concentrado, sacar los perdedores.
2. **`arraigo-ba-raya` y `arraigo-ugcB-copyB-sinminoxidil` llevan el MISMO body** palabra por palabra.
   Lo que midan entre esos dos no se puede separar. Pancho lo dejó a propósito ("está bueno que haya
   opciones"), no es un bug para arreglar.

## CANDADOS

- **Nada se lanza sin OK explícito de Pancho; deployar no es lanzar.** Los 14 anuncios nacen `PAUSED`.
- **Se lanza por API con el runbook, nunca a mano**, con assert de body duplicado.
- **La landing de ARRAIGO NO se toca** (decisión del 04/09). Se asume el riesgo de las reseñas
  inventadas y del "+3.569". **Si Meta rechaza por eso, no se apela**: se registra el motivo de
  `ad_review_feedback` y se lee como señal.
- **El "+10.000 Personas" del contador es decisión para anuncios de testeo, no cifra auditada**
  (lo medido es ~9.300). Fuera de un anuncio de testeo se recalcula antes.
- **No se le saca pauta a lo que funciona**: las patas nuevas van con plata nueva.
- **Editar el presupuesto de una campaña la puede apagar**: mirar el estado después de tocar
  (`status_forced_to_paused` **no existe** en Graph v25.0).
- **Los break-evens y las tasas del vault son fotos con fecha: re-medir antes de concluir.** Los
  $13.587 / $21.793 / $27.950 de `Serum-Capilar-Grilla-Ofertas` son de la escalera **vieja**.
- **En el vault, nunca `git add -A`**: barre cambios de otras sesiones. Add por archivo.

## QUÉ NO TOCAR

- **Verificá con `git status` antes de tocar nada** en `~/Downloads/ProyectoEco` y en `~/Claude/Obsidian`:
  puede haber sesiones paralelas.
- En el repo hay trabajo sin commitear que **no es de ARRAIGO**: `lib/correo.ts`, `lib/correo.test.ts`,
  `lib/couriers/urbano.ts`, `scripts/despacho-etiquetas.mts`, `scripts/_urbano-corte*.mjs`,
  `scripts/com.biolabs.despacho-nocturno.plist`, `etiquetas/`, `.env.example`, `.gitignore`,
  `package.json`. **No los barras en un commit de ARRAIGO.**
- En el vault quedaron **9 notas modificadas sin commitear** por esta sesión (Master, Operaciones-COD,
  Competencia, Learnings, Playbook-Melwani, Tanda-ARRAIGO-2026-09-04, Runbook-Lanzar-Anuncios-API,
  Serum-Capilar-Grilla-Ofertas, Serum-Facial-LIENZO). Si aparece algo más, es de otra sesión.
- **La instancia n8n self-hosted es de Veltron y crea TODOS los pedidos COD: no se toca.**
- **No edites listings de ML que estén vendiendo** por una mejora teórica.
- El escalón +20% de las cinco Pureza de R2 se cargó el 04/09 en otra sesión: **no lo re-toques**.

## DÓNDE GREPEAR

Vault (`~/Claude/Obsidian`) — grepeá el término, no cargues la nota:

- `50-Proyectos/Runbook-Lanzar-Anuncios-API.md` : `Relectura del 03-04/09/2026` · `Plan de la tanda nueva`
- `50-Proyectos/Serum-Capilar-Grilla-Ofertas.md` : `Escalera nueva` · `ARRAIGO-X3K` · `break-even`
- `10-BioLabs/Operaciones-COD.md` : `El contador real de la empresa` · `1805691`
- `20-Ads/Learnings.md` : `Adenda del 04/09/2026` · `cuotas_3`
- `20-Ads/Tanda-ARRAIGO-2026-09-04.md` : `Corrida v2` · `Dos decisiones de Pancho`
- `20-Ads/Competencia.md` : `HAIR BIOLABS ARGENTINA` · `91 días`
- `20-Ads/Playbook-Melwani.md` : `Medición nueva del 04/09/2026`
- `20-Ads/Playbook-Contingencia-Cuentas-Meta.md` : `R2 es la cuenta barata` · `36,4%`

Repo (`~/Downloads/ProyectoEco`), todo untracked:

- `docs/creativos/arraigo-plan-0309/06-plan-exacto.md` — el plan de los 14 anuncios / 9 ad sets / tramos
- `docs/creativos/arraigo-plan-0309/prod/datos/` — mediciones crudas del embudo
- `docs/creativos/arraigo-plan-0309/prod/v2/` y `prod/v3/` — las estáticas
- `docs/creativos/` — informes de competencia (Skinfinity y los 4 capilares)

Si la próxima tarea es lanzar la tanda entera, **desplegá subagentes para contextualizarte** (uno por
el plan exacto, uno por el runbook) y pediles que escriban a archivo y devuelvan solo la ruta más
5 líneas. Si es solo publicar el Artifact y pedir el OK, no hace falta ningún subagente.
