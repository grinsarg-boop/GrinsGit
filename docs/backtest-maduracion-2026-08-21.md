# Backtest: cómo estimar la tasa final de una cohorte COD

**Fecha:** 21/08/2026 · **Scripts:** `scripts/_backtest-maduracion.mjs`, `scripts/_proyeccion-viva.mjs`

## Pregunta

El profit estimado necesita la tasa de entrega final de cohortes que todavía no maduraron.
¿Cuál es la mejor forma de estimarla a los 7, 10 y 14 días de despacho?

## Métodos comparados

| | Método | Idea |
|---|---|---|
| **A** | Prior ventana 21–35 d | Canon Pancho 21/08. La tasa de las cohortes maduras; ignora la cohorte que se estima. |
| **B** | Cadena, edad calendario | `entregado(t) / Gd(t)`, con `Gd(t)` = fracción de las entregas finales ya realizada a la edad t. |
| **C** | Cadena, **edad efectiva** | Se lee cuánto resolvió la cohorte, se busca a qué edad corresponde ese % en el ritmo histórico, y se usa `Gd` de ESA edad. Corrige por velocidad. |
| **D** | Promedio de B y C | |

Curvas (`Gd`, `Rexp`) medidas **solo sobre cohortes cerradas a la fecha de proyección** — sin fuga.

## Resultado (Urbano, 8–10 cohortes semanales cerradas)

MAE = error absoluto medio, en puntos porcentuales.

| Edad | A prior | B cadena | C ef. | **D mix** |
|---|---|---|---|---|
| 7 d | 5,61 | 4,84 | 5,02 | **1,59** |
| 10 d | 5,81 | 2,30 | 2,07 | **0,80** |
| 14 d | 5,08 | 0,77 | 0,78 | **0,46** |

Sesgo:

| Edad | A | B | C | **D** |
|---|---|---|---|---|
| 7 d | −4,22 | **+3,71** | **−4,51** | −0,40 |
| 10 d | −2,78 | +1,79 | −1,99 | −0,10 |
| 14 d | −1,84 | +0,61 | −0,50 | +0,05 |

### Lo que dice

1. **El prior no mejora con la edad.** 5,6 → 5,8 → 5,1 pp. Es estructural: no mira la cohorte.
   Cualquier método que la mire le gana desde el día 10.
2. **B y C tienen sesgos opuestos y de magnitud parecida.** B usa la edad calendario y sobreestima;
   C usa la edad efectiva y subestima. El promedio los cancela: sesgo ≈ 0 en las tres edades.
3. **D a 14 días tiene MAE 0,46 pp.** A 10 días, 0,80. Eso es suficiente para valuar plata.
4. **|B − C| funciona como banda de confianza.** Cuando convergen, el número es confiable; cuando
   se abren, la cohorte es demasiado joven (ver semana 17/08 abajo).

## Proyección de cohortes vivas (21/08)

Cada día de despacho proyectado a su propia edad, agregado ponderando por guías.

| Courier | Semana | n | Entregado hoy | B | C | **D** |
|---|---|---|---|---|---|---|
| Urbano | 03/08 | 239 | 51,0% | 52,7% | 51,6% | **52,2%** |
| Urbano | **10/08** | 444 | 41,0% | 48,4% | 45,4% | **46,9%** |
| Urbano | 17/08 | 83 | 2,4% | 6,9% | 14,7% | *10,8% — no usar* |
| Fixy | 10/08 | 75 | 72,0% | 74,1% | 75,3% | **74,7%** |

**La cohorte del 10/08 proyecta 46,9%** contra el **57,8%** que dice el prior de la ventana 21–35.
El deterioro ya es visible hoy, a 7–11 días; el prior no lo va a ver hasta el ~04/09.

La semana del 17/08 (edad 4–5 d) tiene B y C separados 2× — es el propio método diciendo que todavía
no sabe. Antes del día ~7 no hay señal.

## Trampas encontradas en el camino

- **Invertir la curva de devoluciones no funciona.** Primer intento de C: estimar entregas y
  devoluciones con curvas separadas y normalizar. Al día 7 las devoluciones casi no arrancaron
  (`Gv ≈ 0,02`), así que dividir por eso explota: MAE 12–15 pp. La versión de edad efectiva usa el
  **total resuelto** (que sí es estable) y evita la división.
- **Los días sueltos son ruido puro.** Urbano 10/08 = 27,3% entregado, 11/08 = 77,8%, 12/08 = 46,0%,
  a edades casi iguales. Cualquier lectura por día individual es humo: hay que proyectar por día
  pero **agregar a semana**.
- **Sesgo de "el día más viejo de la semana".** Tomar la edad máxima de la cohorte y filtrar a las
  guías de esa edad deja solo el primer día de despacho. Dio 29,5% donde la semana entera daba 46,9%.

## Caveats — lo que NO está probado

1. **Muestra chica.** 8–10 cohortes de Urbano. Fixy tiene 1–2 cohortes utilizables (su histórico
   pre-julio tiene las fechas de resolución rotas, ver migración 072): sus números son anécdota.
2. **El 50/50 de D se eligió después de ver que los sesgos eran opuestos.** Hay razón estructural
   (uno mide en tiempo calendario, el otro en tiempo operativo, y la verdad queda en el medio), pero
   es selección in-sample. No está tuneado por edad, que es lo que evita lo peor.
3. **⚠️ El backtest corrió sobre un régimen que MEJORABA** (43% en junio → 62% el 20/07). El régimen
   de hoy cae. **El método no está validado en un régimen a la baja**, porque la cohorte que se
   rompió (10/08) todavía no cerró. Cierra ~31/08: ahí se sabe si el 46,9% era bueno.
4. **Las guías que nunca entraron siguen contaminando las curvas.** Las 116 de hoy figuran vivas y
   sin resolver nunca; aplastan la curva de resolución y hacen ver lento a un courier que no lo es.
5. **Grano.** Todo esto es por courier. El deterioro real es de Interior. Por courier × región la
   muestra semanal no da; falta medir hasta qué grano aguanta.

## Propuesta

- **Días 0–6:** prior de la ventana 21–35 (regla del 21/08). No hay alternativa: no hay señal aún.
- **Día 7 en adelante:** D = promedio de cadena por edad calendario y por edad efectiva.
- **|B − C| como banda** publicada junto al número, en vez de una alerta con umbral.
- **Gate:** no se aplica a producción hasta revalidar con la cohorte del 10/08 cerrada (~31/08),
  que es la primera prueba en régimen a la baja.

---

# Anexo — la etapa que falta: generación → despacho

Planteado por Pancho el 21/08. Todo el modelo de arriba está anclado en `dispatched_at`, pero el
P&L de `/ventas` es **por día de venta**. Entre generar y despachar hay una etapa que el modelo no
mira.

## El hallazgo estructural

`recompute_daily_pnl` cohortiza por `s.dispatched_at`. **Un pedido generado que todavía no despachó
no está mal estimado: no existe en el P&L.** La migración 018 cubre "hay guía pero nunca salió"
(PI +7d → `no_despachado`); no cubre "nunca hubo guía".

## Falso positivo que hubo que descartar

Primera medición: los pedidos COD "despachados alguna vez" caían de 92% (junio) a ~70% (jul-ago).
**Era artefacto.** Cero guías huérfanas (no hay falla de matching) y de 765 pedidos sin guía, **683
son `cuotas_3`** — prepago por link MP, que no lleva guía de Urbano/Fixy aunque `orders.courier`
esté seteado. Filtrando `cuotas_3`, la tasa real de despacho es **88–99% y viene mejorando**.

## Curva de despacho (COD sin cuotas_3, % de generados ya despachados)

| Semana gen. | n | ≤1d | ≤2d | ≤4d | ≤7d | total | lag mediano |
|---|---|---|---|---|---|---|---|
| 15/06 | 718 | 21,0 | 44,8 | 84,7 | 90,8 | 92,1 | 3 |
| 29/06 | 764 | 31,2 | 67,8 | 87,2 | 88,0 | 88,0 | 2 |
| 06/07 | 565 | 37,2 | 65,0 | 75,6 | 77,5 | **77,5** | 2 |
| 13/07 | 692 | 56,4 | 67,1 | 93,9 | 95,7 | 95,8 | 1 |
| 27/07 | 439 | 56,9 | 82,5 | 90,4 | 90,9 | 96,1 | 1 |
| 03/08 | 344 | 37,2 | 59,0 | 85,2 | 95,6 | 98,5 | 2 |
| 10/08 | 551 | 44,6 | 57,5 | 92,9 | 99,5 | 99,5 | 2 |

Estable en forma, mejorando en nivel. La 06/07 es el único pozo (77,5%).

## Cuánta plata queda invisible hoy (21/08)

| Días desde generado | Pedidos | Sin despachar | Revenue invisible |
|---|---|---|---|
| 0 | 2 | 2 | $110 k |
| 1 | 108 | 108 | **$5,62 M** |
| 2 | 91 | 19 | $958 k |
| 3 | 79 | 3 | $149 k |
| 4+ | — | ~0 | ~$0 |

**~$6,8 M de revenue bruto de los últimos 3 días no está en el P&L por día de venta.** Y el problema
se cierra solo al día 4: de ahí en adelante es cero.

Esto **explica el caveat del reporte semanal** ("el 21/08 está subestimado porque el COD del día
todavía no despachó"). No es una nota al pie: es esta etapa faltante, y modelarla la elimina.

## Modelo completo

    P(entrega | generado, edad a) =
        Σ_l  P(despacho a lag l | generado) × P(entrega | despachado, edad a−l)

Misma maquinaria de cadena, una etapa antes. Las dos curvas (`Rexp` de despacho y `Gd` de entrega)
se miden igual, sobre cohortes cerradas.

## Consecuencias

1. **Los días de venta recientes dejan de estar vacíos.** Hoy un pedido de ayer no figura; con esto
   entra valuado a `P(despacho) × P(entrega)`.
2. **Una demora de despacho se ve el mismo día.** Hoy es invisible: las cohortes por despacho se
   ven perfectas mientras el día de venta se desangra.
3. **Alcance acotado y medido:** solo mueve los últimos 3 días. Un reporte semanal con 4+ días de
   antigüedad no cambia.

## Pendiente

- `orders.courier` está seteado en pedidos `cuotas_3` que nunca van por ese courier. Cualquier
  medición COD que no filtre `cuotas_3` va a repetir el falso positivo de arriba. **Candidato a
  assert.**
- La curva de despacho está medida global. Falta ver si difiere por courier y por producto
  (un quiebre de stock afectaría a un producto, no a todos) — la semana del 06/07 al 77,5% huele
  a eso.
