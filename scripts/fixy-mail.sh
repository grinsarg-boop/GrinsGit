#!/bin/bash
# Manda por mail la lista de visitas fallidas de Fixy (scripts/fixy-gestion-diaria.mjs) a atención al cliente,
# desde biolabsarg@gmail.com por la API de Gmail (scripts/gmail-enviar.mjs, mismo cliente OAuth que gmail-urbano).
# Corre por launchd a las 9 y a las 15, de lunes a sábado (~/Library/LaunchAgents/local.fixy-mail.plist).
# Ventana: desde el último envío OK hasta ahora, así cubre la Mac dormida y el domingo. La primera vez son 24 h.
# En .env.local: FIXY_MAIL_TO y GMAIL_SEND_TOKEN_BIOLABS (una vez: node scripts/gmail-urbano.mjs --auth biolabs --send).
#   scripts/fixy-mail.sh                      # envío normal (mueve la ventana)
#   MAIL_TO=otra@casilla scripts/fixy-mail.sh # prueba: manda a otra casilla y no mueve la ventana
set -euo pipefail
cd "$(dirname "$0")/.."
env_de() { grep -E "^$1=" .env.local | tail -1 | cut -d= -f2- | sed -E 's/^["'\'']|["'\'']$//g'; }
CASILLA=biolabs   # ponytail: casilla fija; variable de entorno si algún día manda otra
TO=${MAIL_TO:-$(env_de FIXY_MAIL_TO)}
[[ -n $TO ]] || { echo "falta FIXY_MAIL_TO en .env.local" >&2; exit 1; }

ESTADO="$HOME/.claude/fixy-mail-ultimo"   # ISO UTC del último envío OK
HASTA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DESDE=$(cat "$ESTADO" 2>/dev/null || date -u -v-24H +%Y-%m-%dT%H:%M:%SZ)
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
OUT="$T/fixy-gestion-$(date +%Y-%m-%d-%Hh)"
RES=$(node --env-file=.env.local scripts/fixy-gestion-diaria.mjs --desde "$DESDE" --hasta "$HASTA" --out "$OUT")
echo "$RES"
N=$(sed -nE 's/^FILAS ([0-9]+).*/\1/p' <<<"$RES")
ASUNTO="Fixy: visitas fallidas a gestionar $(date +'%d/%m %H') h (${N:-?} guías)"
B="b$(date +%s)"
{
  printf 'To: %s\r\nSubject: =?UTF-8?B?%s?=\r\nMIME-Version: 1.0\r\nContent-Type: multipart/mixed; boundary="%s"\r\n\r\n' \
    "$TO" "$(printf %s "$ASUNTO" | base64)" "$B"
  printf -- '--%s\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n' "$B"
  base64 -b 76 -i "$OUT.html"; printf '\r\n'
  printf -- '--%s\r\nContent-Type: text/csv; charset=UTF-8; name="%s.csv"\r\nContent-Disposition: attachment; filename="%s.csv"\r\nContent-Transfer-Encoding: base64\r\n\r\n' \
    "$B" "$(basename "$OUT")" "$(basename "$OUT")"
  base64 -b 76 -i "$OUT.csv"; printf '\r\n--%s--\r\n' "$B"
} > "$T/mail.eml"
node scripts/gmail-enviar.mjs "$CASILLA" "$T/mail.eml"
echo "mail enviado a $TO: $ASUNTO"
[[ -n ${MAIL_TO:-} ]] || echo "$HASTA" > "$ESTADO"
