# ─── Build Stage ───
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
# We must build the Vite site using production mode
# Make sure .env.production is available for Vite
COPY .env.production .env.production
ENV NODE_ENV=production
RUN npm run build

# ─── Nginx Serving Stage ───
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy Vite build out from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Overwrite Nginx config to provide SPA routing
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
