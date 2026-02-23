# ═══════════════════════════════════════════════════
# BErozgar API — Multi-stage Dockerfile
# ═══════════════════════════════════════════════════

# ── Base ────────────────────────────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# ── Dependencies ────────────────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
# Prisma needs to generate after install
COPY prisma ./prisma
RUN npx prisma generate

# ── Development ─────────────────────────────────────
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
EXPOSE 3001
CMD ["npx", "tsx", "watch", "src/server.ts"]

# ── Build ───────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx tsc

# ── Production ──────────────────────────────────────
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3001
USER node
CMD ["node", "dist/server.js"]
