# ── Backend – Node.js / Express / SQLite ──────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Instalar dependencias de producción
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Copiar código fuente del backend
COPY backend/*.js ./

# Copiar módulos compartidos
COPY shared ./shared

# El directorio /app/data se usa para la base de datos persistente
# (montado como volumen en docker-compose)
ENV DATABASE_PATH=/app/data/database.sqlite \
    PORT=4000 \
    NODE_ENV=production

EXPOSE 4000

CMD ["node", "server.js"]
