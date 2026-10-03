# ¿Conviene MP embebido (Bricks) en el form? — P&L por LEAD y escenarios — 19/09/2026

Lead = pedido no cancelado que entra por el form (30d 19/08–18/09: 5.130 = cod_qr_mp 3.223 · cuotas_3 1.275 · cod_efectivo 632). Datos medidos en `conviene-mp-datos.md`; modelo en `esc.mjs` (misma carpeta). Solo lectura.

## 0. Insumos (MEDIDO vs SUPUESTO)

| Variable | Valor | Origen / fecha |
|---|---|---|
| Ticket promedio por tag | Urbano qr $51.740 · Fixy $51.775 · cuotas_3 $51.960 | MEDIDO `orders` 30d, 19/09 |
| COGS por pedido (pack promedio 2,17–2,19) | Urbano qr $5.063 · Fixy $5.194 · cuotas_3 $5.150 | MEDIDO `order_items` × `product_costs` (costo por pack, tabla viva) 30d, 19/09. Solo se descuenta en ENTREGADOS (canon §4.4 migr 009; siniestros ignorados, <1%) |
| Pauta por lead A | **$5.317** (canónico DB: `v_ad_spend.spend_real` $27,28M / 5.130) · nominal $4.741 · ×1,364 plano $6.467 | MEDIDO 30d, 19/09. `spend_real` aplica impuesto POR CUENTA (migr 078/093): R3 36,4% hasta 15/09 y 10% desde 16/09 (estimación de Pancho, 19/09); la otra cuenta factor 1. Blended 1,121. **A es igual para los tres canales → NO afecta ningún delta ni breakeven, solo el nivel absoluto** |
| Tasa entrega s/resueltos | Urbano cod_qr_mp **55,1%** · Fixy 70,9% (efectivo) / 72,1% (qr) → mix Fixy 71,1% | MEDIDO cohortes despacho 21/07–28/08, madurez 98–100% (≥90% canon 13/08/2026), 19/09 |
| Despacho por lead COD | 100% (Urbano 99,9%, Fixy 100%) | MEDIDO pedidos 19/08–10/09, 19/09 |
| Comisión courier | Urbano 5,547% · Fixy 1% s/cobrado | `settings.commission_pct` vivo, 19/09; `mp_fee_pct`=0 (QR sin fee extra en el modelo) |
| Flete por guía (se paga entregue o no) | Urbano $10.197 (fallback plano 10.200; real may/jun $10.277/$10.060) · Fixy $8.945 real · Correo prepago **$9.000 SUPUESTO** (`settings.correo_flete`, 14/07/2026, sin medir) | MEDIDO / SUPUESTO |
| Tasa de pago cuotas_3 p | **28,5%** (30d) · 30,7% (60d) · 32,5% maduros | MEDIDO `mp_payments`, 19/09 |
| Fee MP f | 17,11% blended · 3 cuotas 22,62% · 1 pago 11,75% | MEDIDO 30d por fecha aprobación, 19/09 |
| Entrega prepago e | **90% SUPUESTO** (también 80% y 100%) — NO medible: Correo sin tracking en base | SUPUESTO 19/09 |
| No entregado en prepago | reembolso total, fee MP perdido, COGS vuelve, flete perdido | SUPUESTO conservador 19/09 (si Correo lo deja en sucursal y lo retiran, la pérdida es menor) |

## 1. Fórmulas

- COD (por lead, todos se despachan): `d × (T − C − com×T) − F − A`
- cuotas_3 por pedido PAGADO: `PC(e,f) = e×(T − C) − f×T − F_correo`
- cuotas_3 por lead: `p × PC − A` (el 71,5% que no paga solo cuesta la pauta)
- Breakeven vs COD (A se cancela): `p* = (contrib COD antes de pauta) / PC`

## 2. Contribución por lead HOY (A = $5.317 canónico DB)

| Canal | Antes de pauta | **Neto por lead** | Nota |
|---|---|---|---|
| (a) COD Urbano cod_qr_mp | 0,551×(51.740−5.063−2.870) − 10.197 = $13.941 | **$8.624** | MEDIDO |
| (b) COD Fixy (mix 622 ef + 97 qr, d 71,1%) | 0,711×(51.775−5.194−518) − 8.945 = $23.788 | **$18.472** | MEDIDO |
| COD mix de los leads cuotas_3 (88,9% Urb / 11,1% Fixy) | $15.037 | $9.721 | para Q5 |
| (c) cuotas_3 p 28,5%, f 17,1%, **e 90%** | PC $24.239 → 0,285×PC = $6.908 | **$1.591** | e SUPUESTO |
| (c) ídem **e 80%** | PC $19.558 → $5.574 | **$257** | e SUPUESTO |
| (c) ídem e 100% (techo) | PC $28.920 → $8.242 | $2.925 | cota superior |
| (d) cuotas_3 e 90%, **3 cuotas f 22,6%** | PC $21.376 → $6.092 | **$775** | mitad de los pagos |
| (d) cuotas_3 e 90%, **1 pago f 11,75%** | PC $27.024 → $7.702 | **$2.385** | otra mitad |
| (d) e 80%: 3 cuotas / 1 pago | PC $16.695 / $22.343 | −$559 / $1.051 | |

Con A ×1,364 plano ($6.467) restar $1.150 a cada fila; con A nominal ($4.741) sumar $576. El orden no cambia.

Lectura: un lead cuotas_3 vale hoy entre $0 y $3k; un lead COD Urbano $8,6k; Fixy $18,5k. El canal cuotas_3 completo deja ~$2,0M/mes neto (e 90%) contra $6,8M de pauta que consume.

## 3. Breakeven de tasa de pago p* (independiente de A)

| Escenario cuotas | vs COD Urbano (13.941) | vs COD Fixy (23.788) | vs mix 88,9/11,1 (15.037) |
|---|---|---|---|
| f 17,1% · e 90% | **57,5%** | 98,1% | **62,0%** |
| f 17,1% · e 80% | 71,3% | >100% | 76,9% |
| f 17,1% · e 100% | 48,2% | 82,3% | 52,0% |
| 3 cuotas 22,6% · e 90% | 65,2% | >100% | 70,3% |
| 1 pago 11,75% · e 90% | 51,6% | 88,0% | 55,6% |

El 48–50% del vault (24/07) solo se reproduce con e=100% y Urbano al ~46% de entonces. Hoy Urbano cod_qr_mp está en 55,1% (cohorte 21/07–28/08) y eso sube la vara: **57–62%** con e 90%. Con la tasa real (28,5%) el canal está a la mitad del breakeven; ni el mejor caso del 20/07 (45,6%) lo alcanzaba.

## 4. Escenario BUENO de Bricks (p sube; 1.275 leads/mes; f y e fijos)

Delta/lead = (p − 0,285) × PC. No cambia el fee (Bricks cobra igual que Checkout Pro) ni la entrega.

| | e 90% | e 80% |
|---|---|---|
| p 28,5% → **40%** | +$2.787/lead = **+$3,55M/mes** | +$2.249 = +$2,87M/mes |
| p 28,5% → **50%** | +$5.211/lead = **+$6,64M/mes** | +$4.205 = +$5,36M/mes |

Aun al 50% el lead cuotas (0,50×24.239−5.317 = $6.803) sigue por debajo del lead COD Urbano ($8.624): Bricks al mejor caso achica la brecha, no la cierra.

Contra qué se mide "bueno": el 87% de los que pagan lo hacen en <15 min en el popup actual, y 70% no paga nunca. Bricks ataca fricción de checkout; no hay medición de cuántos abren el popup y abandonan (vive en Veltron/MP, no en base). Sin ese dato, 40% es un supuesto sin ancla; 50% supera el mejor pico histórico (45,6%, semana 20/07).

## 5. Escenario MALO: p no se mueve

Delta = $0 − costo de desarrollo. Rango: **20–60 h** si el form es propio (Bricks: SDK JS + backend para crear/validar pago + webhooks + QA en móvil, más adaptar el flujo de link/recordatorio para el 13% que paga después). Si el form es de Veltron (terceros), depende de que ellos lo soporten: **no cuantificable desde acá**. Referencia: si el bueno se da al 40% (+$3,5M/mes), 60 h se pagan en el primer mes; si no se da, es costo hundido + riesgo de regresión en el 28,5% que hoy sí paga.

## 6. Alternativa: los 1.275 leads cuotas_3 van a COD

Supuesto FUERTE: que el lead que eligió cuotas convierte igual a COD y entrega a la tasa de su courier (candado 27/07: "no hay gap de adopción"; el ticket idéntico $49.990 dice que no es por precio). Mix courier de cuotas_3 hoy: 1.133 Urbano / 142 Fixy.

| Variante | Delta por lead | **Delta mensual** |
|---|---|---|
| Todos a COD, vs cuotas e 90% | 15.037 − 6.908 = +$8.129 | **+$10,4M/mes** |
| Todos a COD, vs cuotas e 80% | 15.037 − 5.574 = +$9.463 | +$12,1M/mes |
| Solo el ~18% de los no pagados (0,18 × 911 = **164 leads**) rescatados a COD; el resto igual | +$15.037 (hoy valen $0 antes de pauta) | **+$2,5M/mes** |

La variante del 18% no requiere sacar cuotas: es rescate por WhatsApp/recordatorio ofreciendo COD, compatible con o sin Bricks, y sin desarrollo. Ya con eso supera a Bricks al 40%×e80 y se acerca al 40%×e90.

## 7. Sensibilidad (base p 28,5% · f 17,1% · e 90% · 1.275 leads/mes)

| Variable | ±10 pp | $/lead | M/mes | Rango realista | Impacto en rango |
|---|---|---|---|---|---|
| **Tasa de pago p** | +10 pp | +$2.424 | **+$3,09M** | 24–50% (mín 14/09 → techo Bricks) | −$1,4M … +$6,6M |
| Entrega prepago e (NO medida) | −10 pp | −$1.334 | −$1,70M | 70–100% | −$3,4M … +$1,7M |
| Fee MP f | +10 pp | −$1.481 | −$1,89M | 11,75–22,6% (todo 1 pago … todo 3 cuotas) | +$1,0M … −$1,0M |
| Pauta A | — | igual en los 3 canales | 0 en deltas | nominal / DB / ×1,364 | mueve el nivel, no la decisión |

Orden: **tasa de pago > entrega prepago (sin medir) > fee**. La entrega prepago es la única de las tres que no tiene dato y puede mover ±$3M/mes; medirla (tracking Correo o estado en Veltron) vale más que cualquier refinamiento del fee.

## Supuestos (cierre)

- Tasas COD s/resueltos, cohortes despacho 21/07–28/08 (madurez 98–100%, umbral ≥90% canon Pancho 13/08/2026): Urbano cod_qr_mp 55,1% · Fixy ef 70,9% · Fixy qr 72,1% (medido 19/09). Sin corte por producto (17 pp de dispersión; acá el corte es por medio de pago).
- Comisiones vivas de `settings` 19/09: Urbano 5,547% · Fixy 1% · `mp_fee_pct` 0 · `cuotas_commission` 18% NO usado (fee real 17,11% de `mp_payments`).
- Flete: Urbano $10.197 (100% fallback plano, última tarifa real 30/06) · Fixy $8.945 real · Correo $9.000 SUPUESTO 14/07.
- Pauta: `v_ad_spend.spend_real` por cuenta (36,4% hasta 15/09, 10% desde 16/09 — estimación, migr 093 del 19/09); nominal y ×1,364 plano reportados. Igual para todos los canales.
- Entrega prepago 90%/80%/100% SUPUESTO; no entregado = reembolso con fee perdido (conservador). COGS solo en entregados; siniestros ignorados.
- Escenarios: solo se tocó p (Q3), el destino del lead (Q5) y f/e (Q1d, Q7); el resto en valores medidos.
- Costo de desarrollo: rango en horas, no cuantificado en $ (form Veltron: depende de terceros).
