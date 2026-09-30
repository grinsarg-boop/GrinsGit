#!/bin/bash
# Etiquetas ML de la mañana (Pancho, 30/09/2026). launchd lo corre cada 15 min de 8:00 a 11:00
# (~/Library/LaunchAgents/local.flex-11.plist, log ~/.claude/flex-11.log). Genera cuando pasa lo primero:
#   · se llegó al tope diario de Flex (FLEX_TOPE en .env.local): ML ya no vende más Flex para hoy, así que
#     no tiene sentido esperar al corte. Se cuentan TODAS las Flex que vencen hoy, impresas o no.
#   · son las 11, la hora de corte.
# Cuando genera, pide las Flex Y las drop-off que vencen hoy y siguen sin imprimir (una venta de la noche),
# cada modo en su PDF (nunca mezclados), las ordena y estampa (ml-ordenar.mts) y las pasa por
# etiquetas-mail.mjs (detalle + descuento de stock + mail). Lo ya impreso no se vuelve a pedir, así que
# las corridas siguientes sin nada nuevo no hacen nada.
# ML no expone el tope por API (probado 30/09/2026: /flex/.../configurations da 404): el número se copia
# del panel de Flex. Sin FLEX_TOPE, genera sólo a las 11.
#   scripts/flex-11.sh            # corrida normal
#   DRY=1 scripts/flex-11.sh      # muestra qué pediría, no imprime nada
#   AHORA=1 scripts/flex-11.sh    # genera ya, sin esperar tope ni corte
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
AR() { TZ=America/Argentina/Buenos_Aires date "$@"; }

# Si algo falla (ML caído, token vencido, PDF roto), avisa por mail con el final del log: si no, nadie se
# entera hasta que falta el PDF de la mañana. Mismo envío que etiquetas-mail.mjs (biolabs → andreud.francisco).
LOG=$(mktemp); exec > >(tee "$LOG") 2>&1
aviso() {
  local code=$?; (( code )) || return 0
  local eml; eml=$(mktemp)
  { printf 'To: andreud.francisco@gmail.com\r\nSubject: =?UTF-8?B?%s?=\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n' \
      "$(printf '⚠️ Falló el ML de la mañana (%s)' "$(AR '+%d/%m %H:%M')" | base64)"
    printf 'scripts/flex-11.sh salió con código %s. Últimas líneas:\n\n' "$code"; tail -40 "$LOG"
    printf '\nLog completo: ~/.claude/flex-11.log · Reintento a mano: AHORA=1 scripts/flex-11.sh\n'; } > "$eml"
  node scripts/gmail-enviar.mjs biolabs "$eml" || echo "tampoco salió el mail de aviso"
}
trap aviso EXIT
HOY=$(AR +%F); HORA=$(AR +%H%M)
# Suma los conteos de la línea "a pedir (Despachar, modo): { '2026-09-30 23:00 flex': 46 }" (": 46", no el "23:00").
suma() { { sed -nE '/^a pedir/{s/[^:]*: //;p;}' | grep -oE ": [0-9]+" | tr -dc '0-9\n' | paste -sd+ - | bc; } || true; }

FLEX_HOY=$(node scripts/ml-etiquetas.mjs --incluir-impresos --modo=flex --hasta="$HOY" | suma)
FLEX_HOY=${FLEX_HOY:-0}
echo "=== $(AR '+%F %H:%M') · Flex que vencen hoy: $FLEX_HOY${FLEX_TOPE:+ de $FLEX_TOPE}"
if [[ -z ${AHORA:-} && $HORA < 1100 ]] && { [[ -z ${FLEX_TOPE:-} ]] || (( FLEX_HOY < FLEX_TOPE )); }; then
  echo "todavía no: ni tope ni corte"; exit 0
fi
if [[ -n ${DRY:-} ]]; then node scripts/ml-etiquetas.mjs --hasta="$HOY"; exit 0; fi

OUT="docs/etiquetas-ml/manana-$HOY-$HORA"
node scripts/ml-etiquetas.mjs --print --hasta="$HOY" --out="$OUT"
shopt -s nullglob
PDFS=()
for MODO in flex dropoff; do
  CRUDOS=("$OUT"-*"$MODO".pdf)
  (( ${#CRUDOS[@]} )) || continue
  [[ $MODO == flex ]] && NOMBRE="ML Flex" || NOMBRE="ML drop-off"
  FINAL="$HOME/Downloads/$NOMBRE - $(AR +%d-%m-%Y) - $(AR +%Hh%M).pdf"
  npx tsx scripts/ml-ordenar.mts "$FINAL" "${FINAL%.pdf}.json" "${CRUDOS[@]}"
  PDFS+=("$FINAL")
done
(( ${#PDFS[@]} )) || { echo "nada pendiente para hoy"; exit 0; }
node scripts/etiquetas-mail.mjs "${PDFS[@]}"
