const path = require("path");
const sqlite3 = require("sqlite3");
const { allProducts } = require("../eycon-catalog");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath);

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

async function syncCatalogProductState() {
  const catalogIds = allProducts.map((product) => product.id);
  let activated = 0;
  let deactivated = 0;

  console.log(`Catalog source: eycon-catalog.js (${catalogIds.length} products)`);
  console.log(`Database: ${dbPath}`);

  const before = await all(
    `SELECT active, COUNT(*) AS cnt FROM eycon_products GROUP BY active ORDER BY active`
  );
  console.log("Before:", before);

  if (catalogIds.length) {
    const result = await run(
      `UPDATE eycon_products
       SET active = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id IN (${catalogIds.map(() => "?").join(", ")})`,
      catalogIds
    );
    activated = result.changes;
    console.log(`Activated catalog products: ${activated}`);
  }

  const managedTokenIds = allProducts
    .filter((product) => product.gameKey === "MONOPOLY" && product.slotKey === "TOKEN")
    .map((product) => product.id);
  if (managedTokenIds.length) {
    const result = await run(
      `UPDATE eycon_products
       SET active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE game_key = 'MONOPOLY'
         AND slot_key = 'TOKEN'
         AND id LIKE 'monopoly-token-%'
         AND id NOT IN (${managedTokenIds.map(() => "?").join(", ")})`,
      managedTokenIds
    );
    deactivated += result.changes;
    console.log(`Deactivated orphan tokens: ${result.changes}`);
  }

  const managedFxIds = allProducts
    .filter((product) => product.gameKey === "MONOPOLY" && product.category === "DICE_FX")
    .map((product) => product.id);
  if (managedFxIds.length) {
    const result = await run(
      `UPDATE eycon_products
       SET active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE game_key = 'MONOPOLY'
         AND category = 'DICE_FX'
         AND id LIKE 'monopoly-dice-fx-%'
         AND id NOT IN (${managedFxIds.map(() => "?").join(", ")})`,
      managedFxIds
    );
    deactivated += result.changes;
    console.log(`Deactivated orphan dice FX: ${result.changes}`);
  }

  const equipmentResult = await run(
    `DELETE FROM eycon_equipment
     WHERE product_id IN (
       SELECT id FROM eycon_products WHERE active = 0
     )`
  );
  console.log(`Cleared equipment on inactive products: ${equipmentResult.changes}`);

  const orphans = await all(
    `SELECT id, name, active
     FROM eycon_products
     WHERE id NOT IN (${catalogIds.map(() => "?").join(", ")})
     ORDER BY id`,
    catalogIds
  );
  if (orphans.length) {
    console.log(`Remaining DB-only products (not in catalog): ${orphans.length}`);
    orphans.forEach((row) => {
      console.log(`  - ${row.id} (${row.name}) active=${row.active}`);
    });
  }

  const after = await all(
    `SELECT active, COUNT(*) AS cnt FROM eycon_products GROUP BY active ORDER BY active`
  );
  console.log("After:", after);
  console.log(`Summary: ${activated} activated, ${deactivated} deactivated`);
}

syncCatalogProductState()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.close());
