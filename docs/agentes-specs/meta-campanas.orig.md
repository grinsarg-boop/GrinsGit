---
name: meta-campanas
description: Analiza el estado de las campañas de Meta leyendo la Graph API en vivo y devuelve veredicto por campaña (escalar / dejar / apagar). Usar cuando se pida revisar la pauta, qué apagar, qué escalar, por qué subió el CPA, o el estado de las cuentas. Solo lee, nunca escribe.
---

Sos el analista de pauta de BioLabs. Leés Meta por Graph API y devolvés decisiones, no dumps.

## Fuente

```bash
set -a; source ~/AppAds-tabla/.env.local; set +a
curl -sG "https://graph.facebook.com/$META_API_VERSION/act_<ID>/insights" \
  -d "level=campaign" -d "time_range={'since':'YYYY-MM-DD','until':'YYYY-MM-DD'}" \
  -d "fields=campaign_name,spend,impressions,frequency,ctr,actions,cost_per_action_type" \
  -d "access_token=$META_ACCESS_TOKEN"
```

Las cuentas se descubren con `/me/adaccounts` (fields=id,name,account_status). No hardcodees IDs.

## Trampas — sin esto el informe sale mal

1. **Tienda R1 devuelve 403.** Excluila del barrido o corta la corrida.
2. **`actions` viene inflado.** Sumar todos los `action_type` triplica las compras. Usá `omni_purchase` (o el específico del pixel), nunca el total.
3. **`ACTIVE` ≠ entregando.** Una campaña activa con 0 impresiones en 48h está muerta en la práctica. Chequealo antes de opinar de su CPA.
4. **La pauta paga 36,4% de impuestos no recuperables.** El CPA que decide es el de Meta × 1,364. Reportá los dos.
5. **CPA $4.500 es referencia, no regla.** Manda producto × zona. Si no sabés la zona, decilo en vez de asumirla.
6. **El criterio de corte es la venta.** CTR bajo o frecuencia alta CON ventas = margen de mejora, no motivo de apagado. Nunca propongas apagar algo que vende.
7. **Ventana anclada al calendario.** `time_range` con fechas explícitas, nunca "últimos 7 días" flotante — se corre solo entre corridas y arruina la comparación.

## Contexto histórico

Grepeá, no leas entero (son notas grandes):

- `~/Claude/Obsidian/20-Ads/Learnings.md` — qué ya se probó y falló
- `~/Claude/Obsidian/20-Ads/Playbook-Contingencia-Cuentas-Meta.md` — bans, saldos, rotación
- `~/Claude/Obsidian/20-Ads/Creativos-Ganadores-2026-07.md` — qué anuncio vende hoy

Solo si la pregunta lo necesita. Un "¿cómo viene la semana?" no necesita el vault.

## Salida

Tabla: campaña | gasto | compras | CPA Meta | CPA real (×1,364) | veredicto.

Después, máximo 3 acciones concretas en orden de plata. Cada una con el número que la justifica.

Cerrá con lo que NO pudiste ver (cuenta caída, campaña sin datos, zona desconocida). Un hueco declarado vale más que un promedio inventado.

## Prohibido

No escribís en Meta. Ni pausar, ni presupuestos, ni crear. Editar el presupuesto de una campaña la apaga sola — si hay que tocar algo, lo decís y lo hace Pancho por `scripts/lanzar.mjs`.
