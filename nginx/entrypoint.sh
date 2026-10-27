#!/bin/sh
# Genera (una sola vez) un certificado autofirmado para HTTPS y arranca nginx.
# El certificado incluye localhost, 127.0.0.1 y las IP/nombres de EXTRA_IPS / EXTRA_HOSTS (separados por comas),
# por ejemplo EXTRA_IPS=192.168.1.15. Se regenera automáticamente si esos valores cambian.
set -e
DIR=/etc/nginx/certs
mkdir -p "$DIR"

SAN="DNS:localhost,IP:127.0.0.1"
for ip in $(echo "${EXTRA_IPS:-}" | tr ',' ' '); do SAN="$SAN,IP:$ip"; done
for h in $(echo "${EXTRA_HOSTS:-}" | tr ',' ' '); do SAN="$SAN,DNS:$h"; done

if [ ! -f "$DIR/fullchain.pem" ] || [ ! -f "$DIR/key.pem" ] || [ "$(cat "$DIR/san.txt" 2>/dev/null)" != "$SAN" ]; then
  echo "[nginx] Generando certificado autofirmado para: $SAN"
  openssl req -x509 -newkey rsa:2048 -nodes -sha256 -days 825 \
    -keyout "$DIR/key.pem" -out "$DIR/fullchain.pem" \
    -subj "/CN=Cine Andino" -addext "subjectAltName=$SAN" 2>/dev/null
  echo "$SAN" > "$DIR/san.txt"
fi

exec nginx -g 'daemon off;'
