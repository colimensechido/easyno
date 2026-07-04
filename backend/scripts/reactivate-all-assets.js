/**
 * Reactiva todos los productos y assets 3D inactivos.
 * También corre automáticamente en cada arranque del backend (initSchema).
 *
 * Uso en producción:
 *   docker compose exec backend node scripts/reactivate-all-assets.js
 */
const path = require("path");
const sqlite3 = require("sqlite3");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath);

const TABLES = ["eycon_products", "model_3d_assets", "model_3d_settings"];

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
  for (const table of TABLES) {
    const { changes } = await run(
      `UPDATE ${table} SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE active = 0`
    );
    total += changes;
    console.log(`${table}: reactivated ${changes} row(s)`);
  }

  console.log(`Total reactivated: ${total}`);
  console.log("After:", await countByActive());
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
