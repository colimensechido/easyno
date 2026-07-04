const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { allProducts, gameDefinitions } = require("./eycon-catalog");
const { loadShared } = require("./load-shared");
const { displayName: BOLOWPOLY_NAME } = loadShared("bolowpoly-brand");

const EYCON_SCALE = 100;
const BLACKJACK_DAILY_CAP_UNITS = 100;
const MODEL_3D_DEFAULT_COLOR_MODE = "TINT";
const MODEL_3D_DEFAULT_TINT_STRENGTH = 0.75;
const MODEL_3D_SEED_PATH = path.join(__dirname, "model-3d-seed.json");
const MODEL_3D_WRITE_SEED = process.env.MODEL_3D_WRITE_SEED === "1";
const MODEL_3D_TINT_MIGRATION_KEY = "model3d-default-tint-75-v2";
const MODEL_3D_LEGACY_COLOR_CLEANUP_KEY = "model3d-remove-legacy-color-v1";
const MODEL_3D_ASSETS = [
  {
    assetKey: "chicken",
    label: "Chicken",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/chicken.glb",
    fitSize: 1.9,
    fallbackModel: "duck"
  },
  {
    assetKey: "dingus_the_cat",
    label: "Dingus the Cat",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/Dingusthecat.glb",
    fitSize: 1.95,
    fallbackModel: "cat"
  },
  {
    assetKey: "jigglypuff",
    label: "Jigglypuff",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/jigglypuff.glb",
    fitSize: 1.75,
    fallbackModel: "ghost"
  },
  {
    assetKey: "pikachu",
    label: "Pikachu",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/pikachu.glb",
    fitSize: 1.9,
    fallbackModel: "robot_dog"
  },
  {
    assetKey: "snorlax",
    label: "Snorlax",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/snorlax.glb",
    fitSize: 1.9,
    fallbackModel: "astronaut"
  },
  {
    assetKey: "tralalero_tralala",
    label: "Tralalero Tralala",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/tralalerotralala.glb",
    fitSize: 2.05,
    fallbackModel: "dinosaur"
  },
  {
    assetKey: "tung_tung_shakur",
    label: "Tung Tung Shakur",
    filePath: "frontend/src/files/custom_models/monopoly/pawns/tungtungshakur.glb",
    fitSize: 2.05,
    fallbackModel: "hat"
  }
];
const MODEL_3D_ASSET_BY_KEY = new Map(MODEL_3D_ASSETS.map((asset) => [asset.assetKey, asset]));
const MODEL_3D_FALLBACK_MODELS = [
  "hat",
  "robot_dog",
  "sport_car",
  "duck",
  "cat",
  "dinosaur",
  "astronaut",
  "ghost",
  "dragon",
  "taco"
];
const MODEL_3D_PREVIEW_STATUSES = ["DRAFT", "READY", "NEEDS_REVIEW", "BROKEN"];
const MODEL_3D_COLOR_MODES = ["ORIGINAL", "TINT", "FORCE"];

function createEyconService({ get, run, all, io, userRoom }) {
  let queue = Promise.resolve();

  function serialize(work) {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  function clientError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  function parseMetadata(value) {
    if (!value) return {};
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }

  function model3dColumns(alias = "m3d") {
    return `
      ${alias}.asset_key AS model3dAssetKey,
      ${alias}.file_path AS model3dFilePath,
      ${alias}.fallback_model AS model3dFallbackModel,
      ${alias}.fit_size AS model3dFitSize,
      ${alias}.rotation_json AS model3dRotationJson,
      ${alias}.offset_json AS model3dOffsetJson,
      ${alias}.color_locked AS model3dColorLocked,
      ${alias}.tintable AS model3dTintable,
      ${alias}.tint_strength AS model3dTintStrength,
      ${alias}.color_mode AS model3dColorMode,
      ${alias}.preview_status AS model3dPreviewStatus,
      ${alias}.active AS model3dActive,
      a.label AS model3dAssetLabel,
      a.source AS model3dAssetSource,
      ${alias}.created_at AS model3dCreatedAt,
      ${alias}.updated_at AS model3dUpdatedAt
    `;
  }

  function parseVector(value, fallback = [0, 0, 0]) {
    const source = Array.isArray(value) ? value : parseMetadata(value);
    if (!Array.isArray(source)) return fallback;
    return [0, 1, 2].map((index) => {
      const parsed = Number(source[index]);
      return Number.isFinite(parsed) ? parsed : fallback[index] || 0;
    });
  }

  function publicModel3dSetting(row) {
    if (!row || !row.model3dAssetKey) return null;
    return {
      productId: row.id,
      assetKey: row.model3dAssetKey,
      filePath: row.model3dFilePath,
      fallbackModel: row.model3dFallbackModel || "hat",
      fitSize: Number(row.model3dFitSize || 1.9),
      rotation: parseVector(row.model3dRotationJson),
      offset: parseVector(row.model3dOffsetJson),
      colorLocked: row.model3dColorLocked !== 0,
      tintable: row.model3dTintable === 1,
      tintStrength: Number(row.model3dTintStrength ?? MODEL_3D_DEFAULT_TINT_STRENGTH),
      colorMode: row.model3dColorMode || (row.model3dTintable === 1 ? "TINT" : MODEL_3D_DEFAULT_COLOR_MODE),
      previewStatus: row.model3dPreviewStatus || "DRAFT",
      active: row.model3dActive !== 0,
      assetLabel: row.model3dAssetLabel || row.model3dAssetKey,
      assetSource: row.model3dAssetSource || "BUILTIN",
      assetUrl: String(row.model3dFilePath || "").startsWith("/") ? row.model3dFilePath : null,
      createdAt: row.model3dCreatedAt || null,
      updatedAt: row.model3dUpdatedAt || null
    };
  }

  function model3dMetadata(setting) {
    const metadata = {
      renderer: "gltf",
      assetKey: setting.assetKey,
      fallbackModel: setting.fallbackModel,
      fitSize: setting.fitSize,
      rotation: setting.rotation,
      offset: setting.offset,
      colorLocked: setting.colorLocked,
      tintable: setting.tintable,
      tintStrength: setting.tintStrength,
      colorMode: setting.colorMode || (setting.tintable ? "TINT" : MODEL_3D_DEFAULT_COLOR_MODE),
      previewStatus: setting.previewStatus
    };
    if (String(setting.filePath || "").startsWith("/")) {
      metadata.assetUrl = setting.filePath;
    }
    return metadata;
  }

  function publicProduct(row) {
    const model3dSetting = publicModel3dSetting(row);
    const baseMetadata = parseMetadata(row.metadataJson);
    let metadata = baseMetadata;
    if (model3dSetting?.active) {
      metadata = { ...baseMetadata, ...model3dMetadata(model3dSetting) };
    } else if (model3dSetting) {
      metadata = {
        ...baseMetadata,
        renderer: "primitive",
        model: model3dSetting.fallbackModel || baseMetadata.fallbackModel || baseMetadata.model || "hat",
        colorLocked: false
      };
      delete metadata.assetKey;
      delete metadata.asset;
      delete metadata.fitSize;
      delete metadata.rotation;
      delete metadata.offset;
      delete metadata.assetUrl;
      delete metadata.colorMode;
      delete metadata.previewStatus;
    }
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      priceUnits: row.priceUnits,
      price: row.priceUnits / EYCON_SCALE,
      gameKey: row.gameKey,
      category: row.category,
      slotKey: row.slotKey,
      rarity: row.rarity,
      active: Boolean(row.active),
      preview: row.preview,
      metadata,
      model3dSetting
    };
  }

  async function ensureAccount(userId) {
    await run(
      `INSERT OR IGNORE INTO eycon_accounts (user_id, balance_units) VALUES (?, 0)`,
      [userId]
    );
    return get(
      `SELECT user_id AS userId, balance_units AS balanceUnits, created_at AS createdAt,
              updated_at AS updatedAt
       FROM eycon_accounts WHERE user_id = ?`,
      [userId]
    );
  }

  async function emitBalance(userId) {
    const account = await ensureAccount(userId);
    io.to(userRoom(userId)).emit("eycon_update", {
      balanceUnits: account.balanceUnits,
      balance: account.balanceUnits / EYCON_SCALE
    });
    return account;
  }

  async function movementExists(idempotencyKey) {
    if (!idempotencyKey) return null;
    return get(
      `SELECT id, balance_after AS balanceAfter FROM eycon_movements WHERE idempotency_key = ?`,
      [idempotencyKey]
    );
  }

  async function applyMovement({
    userId,
    amountUnits,
    movementType,
    gameKey = null,
    referenceId = null,
    description = "",
    idempotencyKey = null
  }) {
    if (!Number.isInteger(amountUnits) || amountUnits === 0) {
      throw clientError("Movimiento EyCon invalido");
    }

    const previous = await movementExists(idempotencyKey);
    if (previous) {
      return { duplicate: true, balanceUnits: previous.balanceAfter };
    }

    const account = await ensureAccount(userId);
    const nextBalance = account.balanceUnits + amountUnits;
    if (nextBalance < 0) {
      throw clientError("Saldo EyCon insuficiente");
    }

    await run(
      `UPDATE eycon_accounts
       SET balance_units = ?, updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [nextBalance, userId]
    );
    await run(
      `INSERT INTO eycon_movements (
        id, user_id, amount_units, movement_type, balance_before, balance_after,
        game_key, reference_id, description, idempotency_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        userId,
        amountUnits,
        movementType,
        account.balanceUnits,
        nextBalance,
        gameKey,
        referenceId,
        String(description || "").slice(0, 240),
        idempotencyKey
      ]
    );
    return { duplicate: false, balanceUnits: nextBalance };
  }

  async function initSchema() {
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_accounts (
        user_id INTEGER PRIMARY KEY,
        balance_units INTEGER NOT NULL DEFAULT 0 CHECK(balance_units >= 0),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_movements (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        amount_units INTEGER NOT NULL CHECK(amount_units <> 0),
        movement_type TEXT NOT NULL,
        balance_before INTEGER NOT NULL CHECK(balance_before >= 0),
        balance_after INTEGER NOT NULL CHECK(balance_after >= 0),
        game_key TEXT,
        reference_id TEXT,
        description TEXT NOT NULL DEFAULT '',
        idempotency_key TEXT UNIQUE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_eycon_movements_user_date ON eycon_movements(user_id, created_at DESC)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_eycon_movements_reference ON eycon_movements(reference_id)`);
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_products (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        price_units INTEGER NOT NULL CHECK(price_units >= 0),
        game_key TEXT NOT NULL,
        category TEXT NOT NULL,
        slot_key TEXT NOT NULL,
        rarity TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        preview TEXT,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(game_key, category, slug)
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS model_3d_assets (
        asset_key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        file_path TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'BUILTIN',
        fallback_model TEXT NOT NULL DEFAULT 'hat',
        fit_size REAL NOT NULL DEFAULT 1.9,
        uploaded_by INTEGER,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS model_3d_settings (
        product_id TEXT PRIMARY KEY,
        asset_key TEXT NOT NULL,
        file_path TEXT NOT NULL,
        fallback_model TEXT NOT NULL DEFAULT 'hat',
        fit_size REAL NOT NULL DEFAULT 1.9,
        rotation_json TEXT NOT NULL DEFAULT '[0,0,0]',
        offset_json TEXT NOT NULL DEFAULT '[0,0,0]',
        color_locked INTEGER NOT NULL DEFAULT 0,
        tintable INTEGER NOT NULL DEFAULT 1,
        tint_strength REAL NOT NULL DEFAULT 0.75,
        tint_color TEXT NOT NULL DEFAULT '',
        color_mode TEXT NOT NULL DEFAULT 'TINT',
        preview_status TEXT NOT NULL DEFAULT 'DRAFT',
        active INTEGER NOT NULL DEFAULT 1,
        created_by INTEGER,
        updated_by INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES eycon_products(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    await run("ALTER TABLE model_3d_settings ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'ORIGINAL'").catch(() => {});
    await run("ALTER TABLE model_3d_settings ADD COLUMN tint_color TEXT NOT NULL DEFAULT ''").catch(() => {});
    await run(`CREATE INDEX IF NOT EXISTS idx_model_3d_settings_asset ON model_3d_settings(asset_key)`);
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_inventory (
        user_id INTEGER NOT NULL,
        product_id TEXT NOT NULL,
        purchase_price_units INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL DEFAULT 'STORE',
        acquired_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, product_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES eycon_products(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_equipment (
        user_id INTEGER NOT NULL,
        game_key TEXT NOT NULL,
        slot_key TEXT NOT NULL,
        product_id TEXT NOT NULL,
        equipped_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, game_key, slot_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES eycon_products(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_wagers (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        game_key TEXT NOT NULL,
        stake_units INTEGER NOT NULL CHECK(stake_units > 0),
        payout_units INTEGER NOT NULL DEFAULT 0 CHECK(payout_units >= 0),
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        settled_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    for (const product of allProducts) {
      await run(
        `INSERT INTO eycon_products (
          id, slug, name, description, price_units, game_key, category,
          slot_key, rarity, active, preview, metadata_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          description = excluded.description,
          price_units = excluded.price_units,
          game_key = excluded.game_key,
          category = excluded.category,
          slot_key = excluded.slot_key,
          rarity = excluded.rarity,
          active = 1,
          preview = excluded.preview,
          metadata_json = excluded.metadata_json,
          updated_at = CURRENT_TIMESTAMP`,
        [
          product.id,
          product.slug,
          product.name,
          product.description,
          product.priceUnits,
          product.gameKey,
          product.category,
          product.slotKey,
          product.rarity,
          product.preview,
          JSON.stringify(product.metadata)
        ]
      );
    }

    for (const asset of MODEL_3D_ASSETS) {
      await run(
        `INSERT INTO model_3d_assets (
          asset_key, label, file_path, source, fallback_model, fit_size, active
        ) VALUES (?, ?, ?, 'BUILTIN', ?, ?, 1)
        ON CONFLICT(asset_key) DO UPDATE SET
          label = excluded.label,
          file_path = excluded.file_path,
          fallback_model = excluded.fallback_model,
          fit_size = excluded.fit_size,
          active = 1,
          updated_at = CURRENT_TIMESTAMP`,
        [
          asset.assetKey,
          asset.label,
          asset.filePath,
          asset.fallbackModel,
          asset.fitSize
        ]
      );
    }

    for (const product of allProducts) {
      const metadata = product.metadata || {};
      const asset = MODEL_3D_ASSET_BY_KEY.get(String(metadata.assetKey || ""));
      if (metadata.renderer !== "gltf" || !asset) continue;
      const fallbackModel = MODEL_3D_FALLBACK_MODELS.includes(metadata.fallbackModel)
        ? metadata.fallbackModel
        : asset.fallbackModel;
      await run(
        `INSERT OR IGNORE INTO model_3d_settings (
          product_id, asset_key, file_path, fallback_model, fit_size,
          rotation_json, offset_json, color_locked, tintable, tint_strength,
          tint_color, color_mode, preview_status, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'READY', 1)`,
        [
          product.id,
          asset.assetKey,
          asset.filePath,
          fallbackModel,
          Number(metadata.fitSize || asset.fitSize || 1.9),
          JSON.stringify(parseVector(metadata.rotation, [0, 0, 0])),
          JSON.stringify(parseVector(metadata.offset, [0, 0, 0])),
          0,
          1,
          Number(metadata.tintStrength ?? MODEL_3D_DEFAULT_TINT_STRENGTH),
          "",
          metadata.colorMode || MODEL_3D_DEFAULT_COLOR_MODE
        ]
      );
    }

    await applyDefaultTintMigration();
    await applyModel3dSeed();
    await clearSavedModel3dTintColors();

    const managedTokenIds = allProducts
      .filter((product) => product.gameKey === "MONOPOLY" && product.slotKey === "TOKEN")
      .map((product) => product.id);
    if (managedTokenIds.length) {
      await run(
        `UPDATE eycon_products
         SET active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE game_key = 'MONOPOLY'
           AND slot_key = 'TOKEN'
           AND id LIKE 'monopoly-token-%'
           AND id NOT IN (${managedTokenIds.map(() => "?").join(", ")})`,
        managedTokenIds
      );
    }

    const managedFxIds = allProducts
      .filter((product) => product.gameKey === "MONOPOLY" && product.category === "DICE_FX")
      .map((product) => product.id);
    if (managedFxIds.length) {
      await run(
        `UPDATE eycon_products
         SET active = 0, updated_at = CURRENT_TIMESTAMP
         WHERE game_key = 'MONOPOLY'
           AND category = 'DICE_FX'
           AND id LIKE 'monopoly-dice-fx-%'
           AND id NOT IN (${managedFxIds.map(() => "?").join(", ")})`,
        managedFxIds
      );
    }
    await run(
      `DELETE FROM eycon_equipment
       WHERE product_id IN (
         SELECT id FROM eycon_products WHERE active = 0
       )`
    );

    const openWagers = await all(
      `SELECT id, user_id AS userId, game_key AS gameKey, stake_units AS stakeUnits
       FROM eycon_wagers WHERE status = 'ACTIVE'`
    );
    for (const wager of openWagers) {
      await run("BEGIN IMMEDIATE");
      try {
        await applyMovement({
          userId: wager.userId,
          amountUnits: wager.stakeUnits,
          movementType: "WAGER_REFUND",
          gameKey: wager.gameKey,
          referenceId: wager.id,
          description: "Reembolso automatico por reinicio del servidor",
          idempotencyKey: `wager:${wager.id}:restart-refund`
        });
        await run(
          `UPDATE eycon_wagers
           SET status = 'REFUNDED', payout_units = stake_units, settled_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [wager.id]
        );
        await run("COMMIT");
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    }
  }

  async function getProfile(userId) {
    const account = await ensureAccount(userId);
    const inventoryRows = await all(
      `SELECT p.id, p.slug, p.name, p.description, p.price_units AS priceUnits,
              p.game_key AS gameKey, p.category, p.slot_key AS slotKey, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")},
              i.acquired_at AS acquiredAt, i.source
       FROM eycon_inventory i
       JOIN eycon_products p ON p.id = i.product_id
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE i.user_id = ?
       ORDER BY i.acquired_at DESC`,
      [userId]
    );
    const equipmentRows = await all(
      `SELECT e.game_key AS gameKey, e.slot_key AS slotKey, p.id, p.slug, p.name,
              p.description, p.price_units AS priceUnits, p.category, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_equipment e
       JOIN eycon_products p ON p.id = e.product_id
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE e.user_id = ?`,
      [userId]
    );
    return {
      balanceUnits: account.balanceUnits,
      balance: account.balanceUnits / EYCON_SCALE,
      inventory: inventoryRows.map((row) => ({ ...publicProduct(row), acquiredAt: row.acquiredAt, source: row.source })),
      equipment: equipmentRows.reduce((result, row) => {
        result[row.gameKey] ||= {};
        result[row.gameKey][row.slotKey] = publicProduct(row);
        return result;
      }, {})
    };
  }

  async function listCatalog({ userId, gameKey = "MONOPOLY" }) {
    const game = gameDefinitions.find((item) => item.key === gameKey);
    if (!game) throw clientError("Minijuego de tienda no encontrado", 404);
    const products = await all(
      `SELECT p.id, p.slug, p.name, p.description, p.price_units AS priceUnits,
              p.game_key AS gameKey, p.category, p.slot_key AS slotKey, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_products p
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE p.game_key = ? AND p.active = 1
       ORDER BY p.category, p.price_units, p.name`,
      [gameKey]
    );
    const profile = await getProfile(userId);
    const ownedIds = new Set(profile.inventory.map((item) => item.id));
    const equippedIds = new Set(
      Object.values(profile.equipment[gameKey] || {}).map((item) => item.id)
    );
    return {
      ...profile,
      game: {
        ...game,
        available: products.length > 0,
        productCount: products.length
      },
      products: products.map((row) => ({
        ...publicProduct(row),
        owned: ownedIds.has(row.id),
        equipped: equippedIds.has(row.id)
      }))
    };
  }

  async function listGames(userId) {
    const counts = await all(
      `SELECT game_key AS gameKey, COUNT(*) AS productCount
       FROM eycon_products
       WHERE active = 1
       GROUP BY game_key`
    );
    const countByGame = new Map(
      counts.map((item) => [item.gameKey, Number(item.productCount || 0)])
    );
    return {
      ...(await getProfile(userId)),
      games: gameDefinitions.map((game) => {
        const productCount = countByGame.get(game.key) || 0;
        return {
          ...game,
          productCount,
          available: productCount > 0
        };
      })
    };
  }

  async function purchase({ userId, productId }) {
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const product = await get(
          `SELECT id, name, price_units AS priceUnits, game_key AS gameKey, active
           FROM eycon_products WHERE id = ?`,
          [productId]
        );
        if (!product || !product.active) throw clientError("Producto no disponible", 404);
        const owned = await get(
          `SELECT 1 AS owned FROM eycon_inventory WHERE user_id = ? AND product_id = ?`,
          [userId, productId]
        );
        if (owned) throw clientError("Ya tienes este producto", 409);

        const movement = await applyMovement({
          userId,
          amountUnits: -product.priceUnits,
          movementType: "STORE_PURCHASE",
          gameKey: product.gameKey,
          referenceId: productId,
          description: `Compra de ${product.name}`,
          idempotencyKey: `purchase:${userId}:${productId}`
        });
        await run(
          `INSERT INTO eycon_inventory (user_id, product_id, purchase_price_units, source)
           VALUES (?, ?, ?, 'STORE')`,
          [userId, productId, product.priceUnits]
        );
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return { ...result, profile: await getProfile(userId) };
  }

  async function spend({ userId, amountUnits, movementType, referenceId, description, idempotencyKey }) {
    const safeAmount = Number(amountUnits);
    if (!Number.isInteger(safeAmount) || safeAmount <= 0 || safeAmount > 100000) {
      throw clientError("Cargo EyCon invalido");
    }
    const safeMovementType = String(movementType || "SPEND").trim().toUpperCase().slice(0, 48);
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const movement = await applyMovement({
          userId,
          amountUnits: -safeAmount,
          movementType: safeMovementType,
          referenceId: referenceId || null,
          description: description || "Cargo EyCon",
          idempotencyKey
        });
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function equip({ userId, productId }) {
    return serialize(async () => {
      const product = await get(
        `SELECT p.id, p.game_key AS gameKey, p.slot_key AS slotKey, p.active
         FROM eycon_products p
         JOIN eycon_inventory i ON i.product_id = p.id AND i.user_id = ?
         WHERE p.id = ?`,
        [userId, productId]
      );
      if (!product) throw clientError("No posees este personalizable", 403);
      if (!product.active) throw clientError("Este personalizable esta desactivado");
      await run(
        `INSERT INTO eycon_equipment (user_id, game_key, slot_key, product_id)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, game_key, slot_key) DO UPDATE SET
           product_id = excluded.product_id,
           equipped_at = CURRENT_TIMESTAMP`,
        [userId, product.gameKey, product.slotKey, productId]
      );
      return getProfile(userId);
    });
  }

  async function unequip({ userId, gameKey, slotKey }) {
    const safeGameKey = String(gameKey || "").trim().toUpperCase();
    const safeSlotKey = String(slotKey || "").trim().toUpperCase();
    if (!safeGameKey || !safeSlotKey) {
      throw clientError("Juego y tipo de personalizable requeridos");
    }
    await run(
      `DELETE FROM eycon_equipment
       WHERE user_id = ? AND game_key = ? AND slot_key = ?`,
      [userId, safeGameKey, safeSlotKey]
    );
    return getProfile(userId);
  }

  async function awardBlackjackWin({ userId, sessionId, bet }) {
    const idempotencyKey = `blackjack-ai:${sessionId}:user:${userId}:win`;
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const duplicate = await movementExists(idempotencyKey);
        if (duplicate) {
          await run("COMMIT");
          return { duplicate: true, rewardUnits: 0, balanceUnits: duplicate.balanceAfter };
        }
        const earnedToday = await get(
          `SELECT COALESCE(SUM(amount_units), 0) AS amount
           FROM eycon_movements
           WHERE user_id = ? AND movement_type = 'BLACKJACK_AI_REWARD'
             AND date(created_at) = date('now')`,
          [userId]
        );
        const rawReward = Math.max(1, Math.min(5, 1 + Math.floor(Number(bet || 0) / 100)));
        const rewardUnits = Math.min(rawReward, Math.max(0, BLACKJACK_DAILY_CAP_UNITS - Number(earnedToday?.amount || 0)));
        if (rewardUnits <= 0) {
          await run("COMMIT");
          return { duplicate: false, capped: true, rewardUnits: 0 };
        }
        const movement = await applyMovement({
          userId,
          amountUnits: rewardUnits,
          movementType: "BLACKJACK_AI_REWARD",
          gameKey: "BLACKJACK",
          referenceId: sessionId,
          description: `Victoria contra IA con apuesta normal de $${bet}`,
          idempotencyKey
        });
        await run("COMMIT");
        return { ...movement, rewardUnits };
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function awardMonopolyWinner({ tableId, worldId, state }) {
    const turns = Number(state?.turn?.number || state?.turnNumber || 0);
    const winnerId = Number(state?.winnerId);
    if (state?.status !== "FINALIZADO" || !winnerId || turns <= 150) {
      return { awarded: false };
    }
    const rewardUnits = Math.min(200, 100 + Math.floor(Math.max(0, turns - 150) / 50) * 25);
    const idempotencyKey = `monopoly:${tableId}:winner:${winnerId}`;
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const movement = await applyMovement({
          userId: winnerId,
          amountUnits: rewardUnits,
          movementType: "MONOPOLY_REWARD",
          gameKey: "MONOPOLY",
          referenceId: tableId,
          description: `Victoria valida de ${BOLOWPOLY_NAME} tras ${turns} turnos en mundo ${worldId}`,
          idempotencyKey
        });
        await run("COMMIT");
        return { awarded: !movement.duplicate, rewardUnits: movement.duplicate ? 0 : rewardUnits, ...movement };
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(winnerId);
    return result;
  }

  async function placeWager({ userId, wagerId, amountUnits, gameKey }) {
    const safeAmount = Number(amountUnits);
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 10000) {
      throw clientError("Apuesta EyCon invalida");
    }
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const existing = await get(`SELECT status FROM eycon_wagers WHERE id = ?`, [wagerId]);
        if (existing) {
          await run("COMMIT");
          return { duplicate: true, balanceUnits: (await ensureAccount(userId)).balanceUnits };
        }
        const movement = await applyMovement({
          userId,
          amountUnits: -safeAmount,
          movementType: "WAGER_STAKE",
          gameKey,
          referenceId: wagerId,
          description: `Apuesta EyCon en ${gameKey}`,
          idempotencyKey: `wager:${wagerId}:stake`
        });
        await run(
          `INSERT INTO eycon_wagers (id, user_id, game_key, stake_units, status)
           VALUES (?, ?, ?, ?, 'ACTIVE')`,
          [wagerId, userId, gameKey, safeAmount]
        );
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function settleWager({ userId, wagerId, payoutUnits, gameKey, outcome }) {
    const safePayout = Number(payoutUnits);
    if (!Number.isInteger(safePayout) || safePayout < 0 || safePayout > 20000) {
      throw clientError("Pago EyCon invalido");
    }
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const wager = await get(
          `SELECT user_id AS userId, status FROM eycon_wagers WHERE id = ?`,
          [wagerId]
        );
        if (!wager || Number(wager.userId) !== Number(userId)) throw clientError("Apuesta EyCon no encontrada", 404);
        if (wager.status !== "ACTIVE") {
          await run("COMMIT");
          return { duplicate: true, balanceUnits: (await ensureAccount(userId)).balanceUnits };
        }
        const movement = safePayout > 0
          ? await applyMovement({
              userId,
              amountUnits: safePayout,
              movementType: outcome === "push" ? "WAGER_REFUND" : "WAGER_PAYOUT",
              gameKey,
              referenceId: wagerId,
              description: outcome === "push" ? "Devolucion de apuesta EyCon" : `Premio de apuesta EyCon en ${gameKey}`,
              idempotencyKey: `wager:${wagerId}:payout`
            })
          : { balanceUnits: (await ensureAccount(userId)).balanceUnits };
        await run(
          `UPDATE eycon_wagers
           SET status = 'SETTLED', payout_units = ?, settled_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [safePayout, wagerId]
        );
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function creditReward({
    userId,
    amountUnits,
    movementType,
    gameKey = null,
    referenceId = null,
    description = "",
    idempotencyKey
  }) {
    const safeAmount = Math.round(Number(amountUnits) || 0);
    if (!Number.isInteger(safeAmount) || safeAmount === 0) {
      throw clientError("Monto de movimiento EyCon invalido");
    }
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const movement = await applyMovement({
          userId,
          amountUnits: safeAmount,
          movementType,
          gameKey,
          referenceId,
          description,
          idempotencyKey
        });
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function reservePvpStake({ userId, referenceId, amountUnits, gameKey, description }) {
    const safeAmount = Number(amountUnits);
    if (!Number.isInteger(safeAmount) || safeAmount < 1 || safeAmount > 10000) {
      throw clientError("Apuesta EyCon invalida");
    }
    return creditReward({
      userId,
      amountUnits: -safeAmount,
      movementType: "PVP_STAKE",
      gameKey,
      referenceId,
      description: description || `Apuesta EyCon PvP en ${gameKey}`,
      idempotencyKey: `pvp-stake:${referenceId}:${userId}`
    });
  }

  async function settlePvpStake({ userId, referenceId, payoutUnits, gameKey, outcome = "payout", description }) {
    const safePayout = Math.max(0, Math.round(Number(payoutUnits) || 0));
    if (safePayout <= 0) {
      return { balanceUnits: (await ensureAccount(userId)).balanceUnits, skipped: true };
    }
    return creditReward({
      userId,
      amountUnits: safePayout,
      movementType: outcome === "refund" ? "PVP_REFUND" : "PVP_PAYOUT",
      gameKey,
      referenceId,
      description: description || (outcome === "refund" ? "Reembolso de apuesta PvP EyCon" : `Premio de apuesta PvP EyCon en ${gameKey}`),
      idempotencyKey: `pvp-payout:${referenceId}:${userId}`
    });
  }

  async function getPublicEquipment(userIds = [], gameKey = "MONOPOLY") {
    const ids = [...new Set(userIds.map(Number).filter(Number.isFinite))];
    if (!ids.length) return new Map();
    const rows = await all(
      `SELECT e.user_id AS userId, e.slot_key AS slotKey, p.id, p.slug, p.name,
              p.description, p.price_units AS priceUnits, p.game_key AS gameKey,
              p.category, p.rarity, p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_equipment e
       JOIN eycon_products p ON p.id = e.product_id
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE e.game_key = ? AND p.active = 1
         AND e.user_id IN (${ids.map(() => "?").join(",")})`,
      [gameKey, ...ids]
    );
    const result = new Map(ids.map((id) => [id, {}]));
    rows.forEach((row) => {
      result.get(Number(row.userId))[row.slotKey] = publicProduct(row);
    });
    return result;
  }

  async function history(userId, limit = 100) {
    return all(
      `SELECT id, amount_units AS amountUnits, movement_type AS movementType,
              balance_before AS balanceBefore, balance_after AS balanceAfter,
              game_key AS gameKey, reference_id AS referenceId, description,
              created_at AS createdAt
       FROM eycon_movements
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [userId, Math.max(1, Math.min(200, Number(limit) || 100))]
    );
  }

  async function adminOverview() {
    const users = await all(
      `SELECT u.id, u.username, COALESCE(a.balance_units, 0) AS balanceUnits,
              a.updated_at AS updatedAt
       FROM users u
       LEFT JOIN eycon_accounts a ON a.user_id = u.id
       ORDER BY balanceUnits DESC, u.username ASC`
    );
    const movements = await all(
      `SELECT m.id, m.user_id AS userId, u.username, m.amount_units AS amountUnits,
              m.movement_type AS movementType, m.balance_before AS balanceBefore,
              m.balance_after AS balanceAfter, m.game_key AS gameKey,
              m.reference_id AS referenceId, m.description, m.created_at AS createdAt
       FROM eycon_movements m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC
       LIMIT 150`
    );
    const products = await all(
      `SELECT p.id, p.slug, p.name, p.description, p.price_units AS priceUnits,
              p.game_key AS gameKey, p.category, p.slot_key AS slotKey, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_products p
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       ORDER BY p.game_key, p.category, p.name`
    );
    return {
      users,
      movements,
      products: products.map(publicProduct)
    };
  }

  function normalizePreviewStatus(value) {
    const status = String(value || "DRAFT").trim().toUpperCase();
    return MODEL_3D_PREVIEW_STATUSES.includes(status) ? status : "DRAFT";
  }

  function normalizeColorMode(value) {
    const mode = String(value || MODEL_3D_DEFAULT_COLOR_MODE).trim().toUpperCase();
    return MODEL_3D_COLOR_MODES.includes(mode) ? mode : MODEL_3D_DEFAULT_COLOR_MODE;
  }

  function normalizeFallbackModel(value, fallback = "hat") {
    const model = String(value || fallback || "hat").trim();
    return MODEL_3D_FALLBACK_MODELS.includes(model) ? model : "hat";
  }

  function clampNumber(value, fallback, min, max) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
  }

  function normalizeVectorInput(value, fallback = [0, 0, 0], min = -10, max = 10) {
    const source = typeof value === "string"
      ? value.split(/[\s,]+/).filter(Boolean)
      : value;
    if (!Array.isArray(source)) return fallback;
    return [0, 1, 2].map((index) => clampNumber(source[index], fallback[index] || 0, min, max));
  }

  function normalizeProductSlug(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80);
  }

  function normalizeProductRarity(value) {
    const rarity = String(value || "COMMON").toUpperCase();
    if (!["COMMON", "RARE", "EPIC", "LEGENDARY"].includes(rarity)) {
      throw clientError("Rareza invalida");
    }
    return rarity;
  }

  async function ensureEyconMetaTable() {
    await run(`
      CREATE TABLE IF NOT EXISTS eycon_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async function markEyconMeta(key, value = "1") {
    await run(
      `INSERT INTO eycon_meta (key, value, updated_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = CURRENT_TIMESTAMP`,
      [key, value]
    );
  }

  async function applyDefaultTintMigration() {
    await ensureEyconMetaTable();
    const applied = await get("SELECT value FROM eycon_meta WHERE key = ?", [MODEL_3D_TINT_MIGRATION_KEY]);
    if (applied) return false;

    await run(
      `UPDATE model_3d_settings
       SET color_locked = 0,
           tintable = 1,
           tint_strength = ?,
           color_mode = ?,
           updated_at = CURRENT_TIMESTAMP`,
      [MODEL_3D_DEFAULT_TINT_STRENGTH, MODEL_3D_DEFAULT_COLOR_MODE]
    );
    await markEyconMeta(MODEL_3D_TINT_MIGRATION_KEY, "applied");
    return true;
  }

  async function clearSavedModel3dTintColors() {
    await ensureEyconMetaTable();
    const applied = await get("SELECT value FROM eycon_meta WHERE key = ?", [MODEL_3D_LEGACY_COLOR_CLEANUP_KEY]);
    if (applied) return false;

    await run(
      `UPDATE model_3d_settings
       SET tint_color = '', updated_at = CURRENT_TIMESTAMP
       WHERE tint_color <> ''`
    );
    await markEyconMeta(MODEL_3D_LEGACY_COLOR_CLEANUP_KEY, "applied");
    return true;
  }

  function safeSeedArray(value) {
    return Array.isArray(value) ? value : [];
  }

  async function readModel3dSeed() {
    try {
      const raw = await fs.promises.readFile(MODEL_3D_SEED_PATH, "utf8");
      const parsed = JSON.parse(raw);
      return {
        assets: safeSeedArray(parsed.assets),
        settings: safeSeedArray(parsed.settings)
      };
    } catch (error) {
      if (error.code !== "ENOENT") {
        console.error("No se pudo leer model-3d-seed.json", error);
      }
      return { assets: [], settings: [] };
    }
  }

  async function applyModel3dSeed() {
    const seed = await readModel3dSeed();

    for (const asset of seed.assets) {
      const assetKey = String(asset.assetKey || "").trim();
      const filePath = String(asset.filePath || "").trim();
      if (!/^[a-z0-9_]{3,80}$/.test(assetKey) || !filePath) continue;
      await run(
        `INSERT INTO model_3d_assets (
          asset_key, label, file_path, source, fallback_model, fit_size, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_key) DO UPDATE SET
          label = excluded.label,
          file_path = excluded.file_path,
          source = excluded.source,
          fallback_model = excluded.fallback_model,
          fit_size = excluded.fit_size,
          active = excluded.active,
          updated_at = CURRENT_TIMESTAMP`,
        [
          assetKey,
          String(asset.label || assetKey).trim().slice(0, 80),
          filePath,
          String(asset.source || "SEEDED").trim().slice(0, 24) || "SEEDED",
          normalizeFallbackModel(asset.fallbackModel, "hat"),
          clampNumber(asset.fitSize, 1.9, 0.1, 5),
          asset.active === false ? 0 : 1
        ]
      );
    }

    for (const setting of seed.settings) {
      const productId = String(setting.productId || "").trim();
      const assetKey = String(setting.assetKey || "").trim();
      if (!productId || !assetKey) continue;
      const product = await get(
      `SELECT id, game_key AS gameKey, category, slot_key AS slotKey FROM eycon_products WHERE id = ?`,
        [productId]
      );
      const asset = await getModel3dAsset(assetKey);
    if (!product || product.gameKey !== "MONOPOLY" || product.slotKey !== "TOKEN" || !asset) continue;

      const colorMode = normalizeColorMode(setting.colorMode);
      const tintStrength = colorMode === "FORCE"
        ? 1
        : clampNumber(setting.tintStrength, MODEL_3D_DEFAULT_TINT_STRENGTH, 0, 1);
      await run(
        `INSERT INTO model_3d_settings (
          product_id, asset_key, file_path, fallback_model, fit_size,
          rotation_json, offset_json, color_locked, tintable, tint_strength,
          tint_color, color_mode, preview_status, active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(product_id) DO UPDATE SET
          asset_key = excluded.asset_key,
          file_path = excluded.file_path,
          fallback_model = excluded.fallback_model,
          fit_size = excluded.fit_size,
          rotation_json = excluded.rotation_json,
          offset_json = excluded.offset_json,
          color_locked = excluded.color_locked,
          tintable = excluded.tintable,
          tint_strength = excluded.tint_strength,
          tint_color = excluded.tint_color,
          color_mode = excluded.color_mode,
          preview_status = excluded.preview_status,
          active = excluded.active,
          updated_at = CURRENT_TIMESTAMP`,
        [
          productId,
          asset.assetKey,
          asset.filePath,
          normalizeFallbackModel(setting.fallbackModel, asset.fallbackModel),
          clampNumber(setting.fitSize, asset.fitSize || 1.9, 0.1, 5),
          JSON.stringify(normalizeVectorInput(setting.rotation, [0, 0, 0], -12.5664, 12.5664)),
          JSON.stringify(normalizeVectorInput(setting.offset, [0, 0, 0], -5, 5)),
          colorMode === "ORIGINAL" ? 1 : 0,
          colorMode === "ORIGINAL" ? 0 : 1,
          tintStrength,
          "",
          colorMode,
          normalizePreviewStatus(setting.previewStatus || "READY"),
          setting.active === false ? 0 : 1
        ]
      );
    }
  }

  async function exportModel3dSeed() {
    const assets = await all(
      `SELECT asset_key AS assetKey, label, file_path AS filePath, source,
              fallback_model AS fallbackModel, fit_size AS fitSize, active
       FROM model_3d_assets
       ORDER BY source ASC, label ASC`
    );
    const settings = await all(
      `SELECT product_id AS productId, asset_key AS assetKey,
              fallback_model AS fallbackModel, fit_size AS fitSize,
              rotation_json AS rotationJson, offset_json AS offsetJson,
              tint_strength AS tintStrength,
              color_mode AS colorMode, preview_status AS previewStatus, active
       FROM model_3d_settings
       ORDER BY product_id ASC`
    );

    return {
      version: 1,
      defaultColorMode: MODEL_3D_DEFAULT_COLOR_MODE,
      defaultTintStrength: MODEL_3D_DEFAULT_TINT_STRENGTH,
      updatedAt: new Date().toISOString(),
      assets: assets.map((asset) => ({
        assetKey: asset.assetKey,
        label: asset.label,
        filePath: asset.filePath,
        source: asset.source,
        fallbackModel: asset.fallbackModel,
        fitSize: Number(asset.fitSize || 1.9),
        active: asset.active !== 0
      })),
      settings: settings.map((setting) => ({
        productId: setting.productId,
        assetKey: setting.assetKey,
        fallbackModel: setting.fallbackModel,
        fitSize: Number(setting.fitSize || 1.9),
        rotation: parseVector(setting.rotationJson),
        offset: parseVector(setting.offsetJson),
        tintStrength: Number(setting.tintStrength ?? MODEL_3D_DEFAULT_TINT_STRENGTH),
        colorMode: setting.colorMode || MODEL_3D_DEFAULT_COLOR_MODE,
        previewStatus: setting.previewStatus || "READY",
        active: setting.active !== 0
      }))
    };
  }

  async function maybeWriteModel3dSeed() {
    if (!MODEL_3D_WRITE_SEED) return false;
    const seed = await exportModel3dSeed();
    await fs.promises.writeFile(MODEL_3D_SEED_PATH, `${JSON.stringify(seed, null, 2)}\n`, "utf8");
    return true;
  }

  async function getProductWithModel3d(productId) {
    const row = await get(
      `SELECT p.id, p.slug, p.name, p.description, p.price_units AS priceUnits,
              p.game_key AS gameKey, p.category, p.slot_key AS slotKey, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_products p
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE p.id = ?`,
      [productId]
    );
    return row ? publicProduct(row) : null;
  }

  async function listModel3dAssets({ includeInactive = false } = {}) {
    const rows = await all(
      `SELECT asset_key AS assetKey, label, file_path AS filePath, source,
              fallback_model AS fallbackModel, fit_size AS fitSize,
              uploaded_by AS uploadedBy, active, created_at AS createdAt,
              updated_at AS updatedAt
       FROM model_3d_assets
       WHERE (? = 1 OR active = 1)
       ORDER BY source ASC, label ASC`,
      [includeInactive ? 1 : 0]
    );
    return rows.map((row) => ({
      ...row,
      fitSize: Number(row.fitSize || 1.9),
      active: Boolean(row.active),
      assetUrl: String(row.filePath || "").startsWith("/") ? row.filePath : null
    }));
  }

  async function getModel3dAsset(assetKey) {
    const row = await get(
      `SELECT asset_key AS assetKey, label, file_path AS filePath, source,
              fallback_model AS fallbackModel, fit_size AS fitSize, active
       FROM model_3d_assets
       WHERE asset_key = ? AND active = 1`,
      [assetKey]
    );
    return row ? {
      ...row,
      fitSize: Number(row.fitSize || 1.9),
      active: Boolean(row.active),
      assetUrl: String(row.filePath || "").startsWith("/") ? row.filePath : null
    } : null;
  }

  async function adminModel3dOverview() {
    const allowedAssets = await listModel3dAssets();
    const products = await all(
      `SELECT p.id, p.slug, p.name, p.description, p.price_units AS priceUnits,
              p.game_key AS gameKey, p.category, p.slot_key AS slotKey, p.rarity,
              p.active, p.preview, p.metadata_json AS metadataJson,
              ${model3dColumns("m3d")}
       FROM eycon_products p
       LEFT JOIN model_3d_settings m3d ON m3d.product_id = p.id
       LEFT JOIN model_3d_assets a ON a.asset_key = m3d.asset_key
       WHERE p.game_key = 'MONOPOLY' AND p.slot_key = 'TOKEN'
       ORDER BY p.rarity DESC, p.name ASC`
    );
    const publicProducts = products.map(publicProduct);
    return {
      allowedAssets,
      fallbackModels: MODEL_3D_FALLBACK_MODELS,
      previewStatuses: MODEL_3D_PREVIEW_STATUSES,
      colorModes: MODEL_3D_COLOR_MODES,
      seedPath: "backend/model-3d-seed.json",
      seedWriteEnabled: MODEL_3D_WRITE_SEED,
      defaultColorMode: MODEL_3D_DEFAULT_COLOR_MODE,
      defaultTintStrength: MODEL_3D_DEFAULT_TINT_STRENGTH,
      products: publicProducts,
      settings: publicProducts
        .filter((product) => product.model3dSetting)
        .map((product) => product.model3dSetting)
    };
  }

  async function adminCreateModel3dAsset(asset = {}) {
    const assetKey = String(asset.assetKey || "").trim();
    const label = String(asset.label || assetKey).trim().slice(0, 80);
    const filePath = String(asset.filePath || "").trim();
    const fallbackModel = normalizeFallbackModel(asset.fallbackModel, "hat");
    const fitSize = clampNumber(asset.fitSize, 1.9, 0.1, 5);
    if (!/^[a-z0-9_]{3,80}$/.test(assetKey)) throw clientError("assetKey invalido");
    if (!label) throw clientError("Nombre de asset requerido");
    if (!filePath.startsWith("/uploads/models3d/")) throw clientError("Ruta de asset invalida");

    await run(
      `INSERT INTO model_3d_assets (
        asset_key, label, file_path, source, fallback_model, fit_size,
        uploaded_by, active
      ) VALUES (?, ?, ?, 'UPLOAD', ?, ?, ?, 1)
      ON CONFLICT(asset_key) DO UPDATE SET
        label = excluded.label,
        file_path = excluded.file_path,
        source = 'UPLOAD',
        fallback_model = excluded.fallback_model,
        fit_size = excluded.fit_size,
        uploaded_by = excluded.uploaded_by,
        active = 1,
        updated_at = CURRENT_TIMESTAMP`,
      [
        assetKey,
        label,
        filePath,
        fallbackModel,
        fitSize,
        asset.uploadedBy || null
      ]
    );
    const seedWritten = await maybeWriteModel3dSeed();
    return {
      asset: await getModel3dAsset(assetKey),
      model3d: await adminModel3dOverview(),
      seedWritten
    };
  }

  async function adminDeleteModel3dAsset({ assetKey }) {
    const safeAssetKey = String(assetKey || "").trim();
    const asset = await get(
      `SELECT asset_key AS assetKey, label, file_path AS filePath, source,
              fallback_model AS fallbackModel, fit_size AS fitSize, active
       FROM model_3d_assets
       WHERE asset_key = ?`,
      [safeAssetKey]
    );
    if (!asset) throw clientError("Asset 3D no encontrado", 404);
    if (asset.source !== "UPLOAD") throw clientError("Solo se pueden eliminar assets subidos");

    const activeUse = await get(
      `SELECT p.id, p.name
       FROM model_3d_settings m
       JOIN eycon_products p ON p.id = m.product_id
       WHERE m.asset_key = ? AND m.active = 1
       LIMIT 1`,
      [safeAssetKey]
    );
    if (activeUse) {
      throw clientError(`Asset en uso por ${activeUse.name}. Quita el GLB de esa pieza primero.`, 409);
    }

    await run(
      `UPDATE model_3d_assets
       SET active = 0, updated_at = CURRENT_TIMESTAMP
       WHERE asset_key = ?`,
      [safeAssetKey]
    );
    return {
      asset: { ...asset, active: false, fitSize: Number(asset.fitSize || 1.9) },
      model3d: await adminModel3dOverview(),
      filePath: asset.filePath
    };
  }

  async function adminUpsertModel3dSetting({ adminId, productId, settings = {} }) {
    const product = await get(
      `SELECT id, game_key AS gameKey, category, slot_key AS slotKey FROM eycon_products WHERE id = ?`,
      [productId]
    );
    if (!product) throw clientError("Producto EyCon no encontrado", 404);
    if (product.gameKey !== "MONOPOLY" || product.slotKey !== "TOKEN") {
      throw clientError(`Solo se pueden configurar modelos 3D para piezas de ${BOLOWPOLY_NAME}`);
    }

    const assetKey = String(settings.assetKey || "").trim();
    const asset = await getModel3dAsset(assetKey);
    if (!asset) throw clientError("Asset 3D fuera de la lista blanca");

    const fallbackModel = normalizeFallbackModel(settings.fallbackModel, asset.fallbackModel);
    const fitSize = clampNumber(settings.fitSize, asset.fitSize || 1.9, 0.1, 5);
    const rotation = normalizeVectorInput(settings.rotation, [0, 0, 0], -12.5664, 12.5664);
    const offset = normalizeVectorInput(settings.offset, [0, 0, 0], -5, 5);
    const colorMode = normalizeColorMode(settings.colorMode);
    const colorLocked = colorMode === "ORIGINAL";
    const tintable = colorMode !== "ORIGINAL";
    const tintStrength = colorMode === "FORCE" ? 1 : clampNumber(settings.tintStrength, MODEL_3D_DEFAULT_TINT_STRENGTH, 0, 1);
    const previewStatus = normalizePreviewStatus(settings.previewStatus || "READY");
    const active = settings.active !== false;

    await run(
      `INSERT INTO model_3d_settings (
        product_id, asset_key, file_path, fallback_model, fit_size,
        rotation_json, offset_json, color_locked, tintable, tint_strength,
        tint_color, color_mode, preview_status, active, created_by, updated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(product_id) DO UPDATE SET
        asset_key = excluded.asset_key,
        file_path = excluded.file_path,
        fallback_model = excluded.fallback_model,
        fit_size = excluded.fit_size,
        rotation_json = excluded.rotation_json,
        offset_json = excluded.offset_json,
        color_locked = excluded.color_locked,
        tintable = excluded.tintable,
        tint_strength = excluded.tint_strength,
        tint_color = excluded.tint_color,
        color_mode = excluded.color_mode,
        preview_status = excluded.preview_status,
        active = excluded.active,
        updated_by = excluded.updated_by,
        updated_at = CURRENT_TIMESTAMP`,
      [
        productId,
        asset.assetKey,
        asset.filePath,
        fallbackModel,
        fitSize,
        JSON.stringify(rotation),
        JSON.stringify(offset),
        colorLocked ? 1 : 0,
        tintable ? 1 : 0,
        tintStrength,
        "",
        colorMode,
        previewStatus,
        active ? 1 : 0,
        adminId || null,
        adminId || null
      ]
    );
    await run(
      `UPDATE eycon_products
       SET rarity = 'LEGENDARY', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [productId]
    );
    const seedWritten = await maybeWriteModel3dSeed();
    return {
      product: await getProductWithModel3d(productId),
      model3d: await adminModel3dOverview(),
      seedWritten
    };
  }

  async function adminDeleteModel3dSetting({ adminId, productId }) {
    const product = await get(`SELECT id FROM eycon_products WHERE id = ?`, [productId]);
    if (!product) throw clientError("Producto EyCon no encontrado", 404);
    await run(
      `UPDATE model_3d_settings
       SET active = 0, color_mode = 'ORIGINAL', tint_color = '', preview_status = 'DRAFT',
           updated_by = ?, updated_at = CURRENT_TIMESTAMP
       WHERE product_id = ?`,
      [adminId || null, productId]
    );
    const seedWritten = await maybeWriteModel3dSeed();
    return {
      product: await getProductWithModel3d(productId),
      model3d: await adminModel3dOverview(),
      seedWritten
    };
  }

  async function adminAdjust({ adminId, userId, amountUnits, description, requestId }) {
    const safeAmount = Number(amountUnits);
    if (!Number.isInteger(safeAmount) || safeAmount === 0 || Math.abs(safeAmount) > 100000) {
      throw clientError("Ajuste EyCon invalido");
    }
    const result = await serialize(async () => {
      await run("BEGIN IMMEDIATE");
      try {
        const movement = await applyMovement({
          userId,
          amountUnits: safeAmount,
          movementType: "ADMIN_ADJUSTMENT",
          referenceId: String(adminId),
          description: description || `Ajuste administrativo por usuario ${adminId}`,
          idempotencyKey: `admin-adjust:${adminId}:${requestId}`
        });
        await run("COMMIT");
        return movement;
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }
    });
    await emitBalance(userId);
    return result;
  }

  async function adminUpdateProduct({
    productId,
    slug,
    name,
    description,
    priceUnits,
    gameKey,
    category,
    slotKey,
    active,
    rarity,
    preview,
    metadata
  }) {
    const product = await get(`SELECT id FROM eycon_products WHERE id = ?`, [productId]);
    if (!product) throw clientError("Producto no encontrado", 404);
    const updates = [];
    const params = [];
    if (slug !== undefined) {
      const safeSlug = normalizeProductSlug(slug);
      if (!safeSlug) throw clientError("Slug de producto invalido");
      updates.push("slug = ?");
      params.push(safeSlug);
    }
    if (name !== undefined) {
      const safeName = String(name || "").trim().slice(0, 80);
      if (!safeName) throw clientError("Nombre de producto requerido");
      updates.push("name = ?");
      params.push(safeName);
    }
    if (description !== undefined) {
      updates.push("description = ?");
      params.push(String(description || "").slice(0, 300));
    }
    if (priceUnits !== undefined) {
      const safePrice = Number(priceUnits);
      if (!Number.isInteger(safePrice) || safePrice < 0 || safePrice > 100000) {
        throw clientError("Precio EyCon invalido");
      }
      updates.push("price_units = ?");
      params.push(safePrice);
    }
    if (gameKey !== undefined) {
      const safeGameKey = String(gameKey || "").trim().toUpperCase();
      if (!gameDefinitions.some((game) => game.key === safeGameKey)) throw clientError("Minijuego invalido");
      updates.push("game_key = ?");
      params.push(safeGameKey);
    }
    if (category !== undefined) {
      const safeCategory = String(category || "").trim().toUpperCase();
      if (!safeCategory) throw clientError("Categoria requerida");
      updates.push("category = ?");
      params.push(safeCategory);
    }
    if (slotKey !== undefined) {
      const safeSlotKey = String(slotKey || "").trim().toUpperCase();
      if (!safeSlotKey) throw clientError("Slot requerido");
      updates.push("slot_key = ?");
      params.push(safeSlotKey);
    }
    if (active !== undefined) {
      updates.push("active = ?");
      params.push(active ? 1 : 0);
    }
    if (rarity !== undefined) {
      const safeRarity = normalizeProductRarity(rarity);
      updates.push("rarity = ?");
      params.push(safeRarity);
    }
    if (preview !== undefined) {
      updates.push("preview = ?");
      params.push(String(preview || "*").slice(0, 16));
    }
    if (metadata !== undefined) {
      updates.push("metadata_json = ?");
      params.push(JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}));
    }
    if (!updates.length) throw clientError("No hay cambios para guardar");
    params.push(productId);
    await run(
      `UPDATE eycon_products SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      params
    );
    return getProductWithModel3d(productId);
  }

  async function adminCreateProduct(product = {}) {
    const gameKey = String(product.gameKey || "").toUpperCase();
    const category = String(product.category || "").toUpperCase();
    const slotKey = String(product.slotKey || category).toUpperCase();
    const rarity = normalizeProductRarity(product.rarity);
    const name = String(product.name || "").trim().slice(0, 80);
    const slug = normalizeProductSlug(product.slug || name);
    const priceUnits = Number(product.priceUnits);
    if (!name || !slug || !gameKey || !category || !slotKey) throw clientError("Datos de producto incompletos");
    if (!gameDefinitions.some((game) => game.key === gameKey)) throw clientError("Minijuego invalido");
    if (!Number.isInteger(priceUnits) || priceUnits < 0 || priceUnits > 100000) throw clientError("Precio EyCon invalido");
    const id = String(product.id || `${gameKey.toLowerCase()}-${category.toLowerCase()}-${slug}`).slice(0, 120);
    await run(
      `INSERT INTO eycon_products (
        id, slug, name, description, price_units, game_key, category,
        slot_key, rarity, active, preview, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        slug,
        name,
        String(product.description || "").slice(0, 300),
        priceUnits,
        gameKey,
        category,
        slotKey,
        rarity,
        product.active === false ? 0 : 1,
        String(product.preview || "*").slice(0, 16),
        JSON.stringify(product.metadata && typeof product.metadata === "object" ? product.metadata : {})
      ]
    );
    return getProductWithModel3d(id);
  }

  async function adminGrantProduct({ userId, productId }) {
    const product = await get(`SELECT id FROM eycon_products WHERE id = ?`, [productId]);
    if (!product) throw clientError("Producto no encontrado", 404);
    await run(
      `INSERT OR IGNORE INTO eycon_inventory (user_id, product_id, purchase_price_units, source)
       VALUES (?, ?, 0, 'ADMIN')`,
      [userId, productId]
    );
    return getProfile(userId);
  }

  return {
    EYCON_SCALE,
    initSchema,
    ensureAccount,
    emitBalance,
    getProfile,
    listGames,
    listCatalog,
    purchase,
    spend,
    equip,
    unequip,
    awardBlackjackWin,
    awardMonopolyWinner,
    placeWager,
    settleWager,
    creditReward,
    reservePvpStake,
    settlePvpStake,
    getPublicEquipment,
    history,
    adminOverview,
    adminModel3dOverview,
    adminCreateModel3dAsset,
    adminDeleteModel3dAsset,
    adminUpsertModel3dSetting,
    adminDeleteModel3dSetting,
    adminAdjust,
    adminCreateProduct,
    adminUpdateProduct,
    adminGrantProduct
  };
}

module.exports = {
  createEyconService,
  EYCON_SCALE
};
