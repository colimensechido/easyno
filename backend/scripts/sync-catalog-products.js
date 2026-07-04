const path = require("path");
const sqlite3 = require("sqlite3");
const { allProducts } = require("../eycon-catalog");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath);

const REACTIVATE_TABLES = ["eycon_products", "model_3d_assets", "model_3d_settings"];

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

async function reactivateAllAssets() {
  let total = 0;
  for (const table of REACTIVATE_TABLES) {
    const result = await run(
      `UPDATE ${table} SET active = 1, updated_at = CURRENT_TIMESTAMP WHERE active = 0`
    );
    total += result.changes;
    console.log(`${table}: reactivated ${result.changes} row(s)`);
  }
  return total;
}

async function syncCatalogProductState() {
  const catalogIds = allProducts.map((product) => product.id);

  console.log(`Catalog source: eycon-catalog.js (${catalogIds.length} products)`);
  console.log(`Database: ${dbPath}`);

  const before = await all(
    `SELECT active, COUNT(*) AS cnt FROM eycon_products GROUP BY active ORDER BY active`
  );
  console.log("Before:", before);

  let catalogActivated = 0;
  if (catalogIds.length) {
    const result = await run(
      `UPDATE eycon_products
       SET active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${catalogIds.map(() => "?").join(", ")})`,
      catalogIds
    );
    catalogActivated = result.changes;
    console.log(`Catalog products ensured active: ${catalogActivated}`);
  }

  const reactivated = await reactivateAllAssets();

  const orphans = await all(
    `SELECT id, name, active
     FROM eycon_products
     WHERE id NOT IN (${catalogIds.map(() => "?").join(", ")})
     ORDER BY id`,
    catalogIds
  );
  if (orphans.length) {
    console.log(`DB-only products (fuera del catálogo JS, permanecen activos): ${orphans.length}`);
    orphans.forEach((row) => {
      console.log(`  - ${row.id} (${row.name}) active=${row.active}`);
    });
  }

  const after = await all(
    `SELECT active, COUNT(*) AS cnt FROM eycon_products GROUP BY active ORDER BY active`
  );
  console.log("After:", after);
  console.log(`Summary: ${catalogActivated} catalog updated, ${reactivated} rows reactivated`);
}

syncCatalogProductState()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
