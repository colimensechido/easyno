const sqlite3 = require("sqlite3");

const db = new sqlite3.Database("database.sqlite");

const whereClause = `slot_key = 'TOKEN' OR category = 'TOKEN' OR category LIKE 'TOKEN_%'`;

db.serialize(() => {
  db.all(
    `SELECT id, name, rarity, price_units AS priceUnits
     FROM eycon_products
     WHERE ${whereClause}
     ORDER BY price_units, name`,
    (err, before) => {
      if (err) {
        console.error(err);
        process.exit(1);
      }

      db.run(
        `UPDATE eycon_products
         SET price_units = CAST(ROUND(price_units * 1.15) AS INTEGER),
             updated_at = CURRENT_TIMESTAMP
         WHERE ${whereClause}`,
        function onUpdated(err) {
          if (err) {
            console.error(err);
            process.exit(1);
          }

          console.log(`Updated ${this.changes} token products (+15%)`);
          before.forEach((row) => {
            const next = Math.round(row.priceUnits * 1.15);
            console.log(
              `- ${row.name} (${row.rarity}): ${(row.priceUnits / 100).toFixed(2)} -> ${(next / 100).toFixed(2)} EyCon`
            );
          });
          db.close();
        }
      );
    }
  );
});
