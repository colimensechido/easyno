# ── Frontend – React / Vite → nginx ───────────────────────────────────────────

# ── Etapa 1: build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Etapa 2: serve ────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copiar los estáticos compilados
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar la configuración de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
