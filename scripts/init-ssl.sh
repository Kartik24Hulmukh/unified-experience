#!/usr/bin/env bash
# ═══════════════════════════════════════════════════
# BErozgar — Bootstrap self-signed SSL certificates
# ═══════════════════════════════════════════════════
#
# Generates a self-signed TLS certificate so nginx can start
# with HTTPS before real Let's Encrypt certs are available.
#
# Usage:
#   chmod +x scripts/init-ssl.sh
#   ./scripts/init-ssl.sh
#
# For production, replace with certbot:
#   certbot certonly --webroot -w /var/www/certbot \
#     -d berozgar.in -d www.berozgar.in

set -euo pipefail

DOMAIN="${1:-berozgar.in}"
CERTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/nginx/certs"

mkdir -p "$CERTS_DIR"

if [ -f "$CERTS_DIR/fullchain.pem" ] && [ -f "$CERTS_DIR/privkey.pem" ]; then
  echo "✓ SSL certificates already exist in $CERTS_DIR"
  echo "  To regenerate, delete the existing files and re-run."
  exit 0
fi

echo "→ Generating self-signed certificate for $DOMAIN ..."

openssl req -x509 -nodes -newkey rsa:2048 \
  -days 365 \
  -keyout "$CERTS_DIR/privkey.pem" \
  -out    "$CERTS_DIR/fullchain.pem" \
  -subj   "/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN,DNS:localhost"

echo "✓ Self-signed certificate created:"
echo "    $CERTS_DIR/fullchain.pem"
echo "    $CERTS_DIR/privkey.pem"
echo ""
echo "⚠  This is for bootstrapping only. Replace with Let's Encrypt before going live:"
echo "   certbot certonly --webroot -w /var/www/certbot -d $DOMAIN -d www.$DOMAIN"
