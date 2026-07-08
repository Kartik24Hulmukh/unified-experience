FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
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
COPY --from=deps /app/node_modules ./node_modules
RUN apk add --no-cache wget
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
EXPOSE 3001
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.cjs"]
