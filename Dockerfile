# ─── Build Stage ───
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# We must build the Vite site using production mode
# PROD-FIX: removed hard `COPY .env.production .env.production` — that file is
# gitignored, so the image build failed on any clean clone/CI checkout.
# `COPY . .` above already includes .env.production when it exists in the
# build context; otherwise Vite falls back to its built-in defaults
# (VITE_API_BASE_URL=/api), which is correct for the nginx-proxied setup.
ENV NODE_ENV=production
RUN npm run build

# ─── Nginx Serving Stage ───
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build out from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Overwrite Nginx config to provide SPA routing
# PROD-FIX: was `COPY nginx/nginx.conf ...` — that file is a FULL top-level
# nginx.conf (user/events/http blocks) and is invalid inside conf.d, which
# made this standalone image crash-loop. nginx/default.conf is a proper
# server-block-only config for the standalone SPA image.
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
