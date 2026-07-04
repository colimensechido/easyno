/**
 * Reactiva productos y assets 3D inactivos.
 * Los uploads sin archivo GLB real se dejan inactivos.
 * También corre automáticamente en cada arranque del backend (initSchema).
 *
 * Uso en producción:
 *   docker compose exec backend node scripts/reactivate-all-assets.js
 */
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath);

const UPLOADS_DIR = path.join(__dirname, "..", "uploads", "models3d");

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes });
    });
  });
}

function uploadAssetFileExists(filePath) {
  const safePath = String(filePath || "");
  if (!safePath.startsWith("/uploads/models3d/")) return true;
  return fs.existsSync(path.join(UPLOADS_DIR, path.basename(safePath)));
}

async function countByActive() {
  return all(
    `SELECT 'eycon_products' AS tbl, active, COUNT(*) AS cnt FROM eycon_products GROUP BY active
     UNION ALL SELECT 'model_3d_assets', active, COUNT(*) FROM model_3d_assets GROUP BY active
     UNION ALL SELECT 'model_3d_settings', active, COUNT(*) FROM model_3d_settings GROUP BY active
     ORDER BY tbl, active`
  );
}

async function main() {
  console.log(`Database: ${dbPath}`);
  console.log("Before:", await countByActive());

  let total = 0;
  for (const table of ["eycon_products", "model_3d_settings"]) {
    const { changes } = await run(
      `UPDATE ${table} SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE active = 0`
    );
    total += changes;
    console.log(`${table}: reactivated ${changes} row(s)`);
  }

  const builtinAssets = await run(
    `UPDATE model_3d_assets
     SET active = 1, updated_at = CURRENT_TIMESTAMP
     WHERE active = 0 AND file_path NOT LIKE '/uploads/models3d/%'`
  );
  total += builtinAssets.changes;
  console.log(`model_3d_assets built-in/seeded: reactivated ${builtinAssets.changes} row(s)`);

  const uploadAssets = await all(
    `SELECT asset_key AS assetKey, file_path AS filePath
     FROM model_3d_assets
     WHERE active = 0 AND file_path LIKE '/uploads/models3d/%'`
  );
  let uploadReactivated = 0;
  let uploadMissing = 0;
  for (const asset of uploadAssets) {
    if (!uploadAssetFileExists(asset.filePath)) {
      uploadMissing += 1;
      continue;
    }
    const { changes } = await run(
      `UPDATE model_3d_assets
       SET active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE asset_key = ?`,
      [asset.assetKey]
    );
    uploadReactivated += changes;
    total += changes;
  }
  console.log(`model_3d_assets uploads: reactivated ${uploadReactivated} row(s), missing files skipped ${uploadMissing}`);

  console.log(`Total reactivated: ${total}`);
  console.log("After:", await countByActive());
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
