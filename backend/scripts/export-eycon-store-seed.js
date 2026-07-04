const path = require("path");
const sqlite3 = require("sqlite3");
const { createEyconService } = require("../eycon-service");

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "..", "database.sqlite");
const db = new sqlite3.Database(dbPath);

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
}

const eyconService = createEyconService({
  get,
  run,
  all,
  io: { to: () => ({ emit: () => {} }) },
  userRoom: () => ""
});

async function main() {
  const { seed, seedPath } = await eyconService.writeEyconStoreSeed();
  console.log(`Database: ${dbPath}`);
  console.log(`Seed: ${seedPath}`);
  console.log(`Products: ${seed.products.length}`);
  console.log(`Assets: ${seed.assets.length}`);
  console.log(`Model 3D settings: ${seed.settings.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.close());
