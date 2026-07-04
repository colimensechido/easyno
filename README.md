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

**Importante:** `git pull` sincroniza **código**, no la base SQLite. La DB de producción vive en el volumen Docker `db_data`. Para copiar lo que configuraste en localhost, exporta primero el seed versionable de EyCon:

```bash
npm run export:eycon-seed
```

Ese comando actualiza `backend/model-3d-seed.json` con productos, assets y ajustes 3D de la tienda local. Versiona ese archivo y cualquier GLB nuevo en `backend/uploads/models3d/`. Tras desplegar, el backend importa el seed y reactiva automáticamente los productos y los assets con archivo disponible en cada arranque.

En el **servidor de producción**:

```bash
git pull origin main
docker compose build --no-cache backend frontend
docker compose up -d --force-recreate backend frontend
docker compose logs backend --tail=80 | grep -E '\[eycon\]|Catalog sync|listos'
```

Tras el arranque deberías ver algo como:

```text
[eycon] Catalog sync: catálogo=66, productos activos=85, inactivos=0, reactivados=0
```

Si prod ya tenía productos desactivados por un deploy anterior, reactívalos ahora:

```bash
docker compose exec backend node scripts/reactivate-all-assets.js
```

### Contar productos activos en producción

```bash
docker compose exec backend node -e "const sqlite3=require('sqlite3');const db=new sqlite3.Database(process.env.DATABASE_PATH);db.all('SELECT active,COUNT(*) cnt FROM eycon_products GROUP BY active',(_,r)=>{console.log(r);db.close();});"
```
