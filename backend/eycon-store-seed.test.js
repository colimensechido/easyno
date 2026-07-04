const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const sqlite3 = require("sqlite3");

const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "eycon-seed-"));
process.env.EYCON_STORE_SEED_PATH = path.join(tmpRoot, "model-3d-seed.json");

const { createEyconService } = require("./eycon-service");

function createDb(dbPath) {
  const db = new sqlite3.Database(dbPath);
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
  const all = (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) reject(err);
      else resolve({ changes: this.changes, lastID: this.lastID });
    });
  });
  const service = createEyconService({
    get,
    run,
    all,
    io: { to: () => ({ emit: () => {} }) },
    userRoom: () => ""
  });
  return { db, get, all, run, service };
}

test("EyCon store seed exports and imports DB-only products", async () => {
  const source = createDb(path.join(tmpRoot, "source.sqlite"));
  await source.service.initSchema();
  await source.service.adminCreateProduct({
    id: "monopoly-token-local-only",
    slug: "local-only",
    name: "Pieza local",
    description: "Producto creado desde localhost",
    priceUnits: 575,
    gameKey: "MONOPOLY",
    category: "TOKEN_PREMIUM",
    slotKey: "TOKEN",
    rarity: "LEGENDARY",
    preview: "*",
    metadata: { renderer: "primitive", model: "hat", glyph: "*", color: "#fbbf24", ring: "#92400e" }
  });
  await source.run(
    `INSERT INTO model_3d_assets (
      asset_key, label, file_path, source, fallback_model, fit_size, active
    ) VALUES (?, ?, ?, 'UPLOAD', 'hat', 1.9, 1)`,
    ["missing_upload", "Missing upload", "/uploads/models3d/not-here.glb"]
  );

  const { seed } = await source.service.writeEyconStoreSeed();
  assert.ok(seed.products.some((product) => product.id === "monopoly-token-local-only"));
  assert.equal(seed.assets.find((asset) => asset.assetKey === "missing_upload")?.active, false);
  source.db.close();

  const target = createDb(path.join(tmpRoot, "target.sqlite"));
  await target.service.initSchema();
  const imported = await target.get(
    "SELECT id, active FROM eycon_products WHERE id = ?",
    ["monopoly-token-local-only"]
  );
  assert.deepEqual(imported, { id: "monopoly-token-local-only", active: 1 });
  const missingUpload = await target.get(
    "SELECT asset_key AS assetKey, active FROM model_3d_assets WHERE asset_key = ?",
    ["missing_upload"]
  );
  assert.deepEqual(missingUpload, { assetKey: "missing_upload", active: 0 });
  target.db.close();
});

test.after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});
