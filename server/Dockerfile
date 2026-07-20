# ═══════════════════════════════════════════════════
# BErozgar API — Production Dockerfile
#
# PROD-FIX: this Dockerfile is now built with the REPO ROOT as the build
# context (see docker-compose.prod.yml: context: . / dockerfile:
# server/Dockerfile). The previous version used ./server as the context,
# which made the "@berozgar/shared": "file:../shared" dependency
# unresolvable inside the image — npm ci failed on every clean build.
# ═══════════════════════════════════════════════════

FROM node:20-alpine AS base
WORKDIR /app/server
RUN corepack enable

FROM base AS deps
# shared must sit at /app/shared so that "file:../shared" resolves from /app/server
COPY shared /app/shared
COPY server/package.json server/package-lock.json* ./
RUN npm ci --ignore-scripts
COPY server/prisma ./prisma
RUN npx prisma generate

FROM base AS build
COPY --from=deps /app/server/node_modules ./node_modules
COPY shared /app/shared
COPY server .
RUN npx esbuild src/server.ts \
    --bundle \
    --platform=node \
    --target=node20 \
    --format=cjs \
    --outfile=dist/server.cjs \
    --alias:@=./src \
    --external:./node_modules/* \
    --external:@prisma/client \
    --external:dotenv

FROM base AS production
ENV NODE_ENV=production
RUN apk add --no-cache wget
COPY --from=deps /app/server/node_modules ./node_modules
COPY --from=deps /app/server/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/server/dist ./dist
COPY server/prisma ./prisma
COPY server/package.json ./
# PROD-FIX: pre-create the uploads dir owned by the runtime user. Without
# this, the Docker named volume for /app/server/uploads is created as root
# and the non-root `node` user cannot write uploaded images (EACCES on
# every image upload).
RUN mkdir -p uploads && chown -R node:node uploads
EXPOSE 3001
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.cjs"]
