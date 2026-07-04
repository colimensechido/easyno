# easyno

Casino web local: videojuego de economia con mundos persistentes, minijuego de trabajo y Blackjack (contra la banca y PvP).

## Requisitos

- Node.js 18+
- npm

## Instalacion

```bash
npm run install:all
```

## Ejecutar

En una terminal:

```bash
npm run dev:backend
```

En otra terminal:

```bash
npm run dev:frontend
```

La API corre en `http://localhost:4000` y el frontend en `http://localhost:5173`.

La base SQLite se crea automaticamente en `backend/database.sqlite`.

## Despliegue en producción (Docker)

En el **servidor de producción** (no en tu máquina local):

```bash
git pull origin main
docker compose build --no-cache backend
docker compose up -d --force-recreate backend
docker compose logs backend --tail=80 | grep -E '\[eycon\]|Catalog sync|listos'
```

Tras el arranque deberías ver una línea como:

```text
[eycon] Catalog sync: catálogo=66, activos=66 (66 catálogo + 0 huérfanos), inactivos=19, NODE_ENV=production, skipOrphans=false
```

Si `activos` sigue siendo 85 o `skipOrphans=true` en producción, el contenedor no está corriendo el código nuevo o `EYCON_SKIP_ORPHAN_CLEANUP=1` está definido.

### Diagnóstico manual en producción

```bash
# Ver commit desplegado dentro del contenedor
docker compose exec backend node -e "console.log(require('./eycon-catalog').allProducts.length)"

# Forzar sincronización del catálogo (desactiva huérfanos)
docker compose exec backend node scripts/sync-catalog-products.js

# Contar productos activos en la DB persistente
docker compose exec backend node -e "const sqlite3=require('sqlite3');const db=new sqlite3.Database(process.env.DATABASE_PATH);db.all('SELECT active,COUNT(*) cnt FROM eycon_products GROUP BY active',(_,r)=>{console.log(r);db.close();});"
```

La base de datos vive en el volumen Docker `db_data` (`DATABASE_PATH=/app/data/database.sqlite`). Reconstruir la imagen no borra la DB; la sincronización corre en cada arranque vía `initSchema()`.
