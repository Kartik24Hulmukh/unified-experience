#!/usr/bin/env bash
set -euo pipefail

cd /opt/berozgar

echo "→ Pulling latest code..."
git pull origin main

echo "→ Rebuilding frontend..."
npm ci
npm run build

echo "→ Rebuilding and restarting containers..."
docker compose -f docker-compose.prod.yml --env-file .env.production build api
docker compose -f docker-compose.prod.yml --env-file .env.production up -d

echo "→ Running database migrations..."
docker compose -f docker-compose.prod.yml --env-file .env.production exec -T api npx prisma migrate deploy

echo "✓ Deployment complete!"
