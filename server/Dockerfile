# ─── Build Stage ───
FROM node:20-alpine AS builder

WORKDIR /app
# Copy package manifests and install dependencies
COPY package*.json ./
RUN npm ci

# Copy server source code and prisma schema
COPY tsconfig.json .
COPY prisma ./prisma
COPY src ./src

# Generate prisma client and build TypeScript
RUN npx prisma generate
RUN npm run build

# ─── Production Stage ───
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy package manifests for production install
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built code
COPY --from=builder /app/dist ./dist

# Create a non-root user for security
RUN addgroup -S nodejs && adduser -S -G nodejs fastifyuser
USER fastifyuser

EXPOSE 3001
CMD ["npm", "start"]
