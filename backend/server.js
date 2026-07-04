require("dotenv").config();

const path = require("path");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createMonopolyService } = require("./monopoly-service");
const { loadShared } = require("./load-shared");
const { displayName: BOLOWPOLY_NAME, defaultTableName: BOLOWPOLY_DEFAULT_TABLE } = loadShared("bolowpoly-brand");
const { createEyconService } = require("./eycon-service");
const { createProgressionService } = require("./progression-service");
const { createPaymentsService } = require("./payments-service");
const mercadopagoService = require("./mercadopago-service");
const { isExplicitAdminUsername, resolveEffectiveRoles } = require("./admin-roles");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "local-dev-secret-change-me";
const STARTING_BALANCE = 5000;
const REQUIRED_DISH_SCRUBS = 100;
const BETTING_WINDOW_MS = 7000;
const TURN_WINDOW_MS = 15000;
const SETTLED_TABLE_VISIBLE_MS = 12000;
const PVP_START_WINDOW_MS = 180000;
const PVP_REMATCH_WINDOW_MS = 20000;
const TABLE_MAX_PLAYERS = 12;
const AI_TABLE_MIN_BET = 25;
const AI_TABLE_MAX_BET = 500;
const EYCON_PVP_MIN_UNITS = 1;
const EYCON_PVP_MAX_UNITS = 100;
const MONOPOLY_MIN_TURNS_FOR_ACTIVITY = 10;
const USERNAME_PATTERN = /^[a-z0-9_]{3,16}$/;
const PASSWORD_MIN_LENGTH = 8;
const ROLE_KEYS = new Set(["user", "admin", "vip"]);
const WORLD_KIND_MAIN = "MAIN";
const WORLD_KIND_PRIVATE = "PRIVATE";
const MAIN_WORLD_NAME = "MAIN";
const MAIN_WORLD_CODE = "MAIN";
const PRIVATE_ROOM_CODE_LENGTH = 6;
const PRIVATE_ROOM_CREATE_COST_UNITS = 100;
const ADMIN_ENV_USER_IDS = String(process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => Number(value))
  .filter(Number.isInteger);
const ADMIN_ENV_USERNAMES = String(process.env.ADMIN_USERNAMES || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_ORIGIN
].filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, "database.sqlite");
const modelUploadsDir = path.join(__dirname, "uploads", "models3d");
const modelSeedUploadsDir = path.join(__dirname, "seed-uploads", "models3d");
const db = new sqlite3.Database(dbPath);
const blackjackSessions = new Map();
const worldPresence = new Map();
const multiplayerBlackjackTables = new Map();
const playerOnlyTables = new Map();
const eyconService = createEyconService({ get, run, all, io, userRoom });
const progressionService = createProgressionService({
  get,
  run,
  all,
  creditReward: eyconService.creditReward
});
const paymentsService = createPaymentsService({
  get,
  run,
  all,
  creditReward: eyconService.creditReward,
  grantRole: (userId, roleKey, options) => grantRole(userId, roleKey, options),
  mercadopago: mercadopagoService
});

function recordPlayActivity(userId, gameKey, extra = {}) {
  progressionService.recordActivity({ userId, gameKey, ...extra }).catch((error) => {
    console.error("No se pudo registrar actividad de progresion", error);
  });
}

async function chargeBolowPolyEyconStakes(tableId, userIds, amountUnits) {
  const charged = [];
  try {
    for (const userId of userIds) {
      const account = await eyconService.ensureAccount(userId);
      if (Number(account.balanceUnits) < amountUnits) {
        throw new Error("Uno de los jugadores no tiene saldo EyCon suficiente para la apuesta");
      }
      await eyconService.reservePvpStake({
        userId,
        referenceId: `monopoly:${tableId}`,
        amountUnits,
        gameKey: "MONOPOLY_PVP"
      });
      charged.push(userId);
    }
  } catch (error) {
    for (const userId of charged) {
      await eyconService.settlePvpStake({
        userId,
        referenceId: `monopoly:${tableId}`,
        payoutUnits: amountUnits,
        gameKey: "MONOPOLY_PVP",
        outcome: "refund"
      }).catch(() => {});
    }
    throw error;
  }
}

async function refundBolowPolyEyconStakes(tableId, userIds, amountUnits) {
  for (const userId of userIds) {
    await eyconService.settlePvpStake({
      userId,
      referenceId: `monopoly:${tableId}`,
      payoutUnits: amountUnits,
      gameKey: "MONOPOLY_PVP",
      outcome: "refund"
    }).catch((error) => {
      console.error("No se pudo reembolsar apuesta EyCon de BolowPoly", error);
    });
  }
}

async function settleBolowPolyEyconStake({ tableId, state, config }) {
  const stakeUnits = Number(config?.eyconStakeUnits || 0);
  const participants = Array.isArray(config?.eyconStakeParticipants)
    ? [...new Set(config.eyconStakeParticipants.map(Number))]
    : [];
  if (stakeUnits <= 0 || participants.length < 2) return;

  const potUnits = stakeUnits * participants.length;
  const winnerId = Number(state?.winnerId) || null;
  const winnerInPot = winnerId && participants.includes(winnerId);

  for (const userId of participants) {
    const payoutUnits = winnerInPot
      ? (userId === winnerId ? potUnits : 0)
      : Math.floor(potUnits / participants.length);
    if (payoutUnits <= 0) continue;
    await eyconService.settlePvpStake({
      userId,
      referenceId: `monopoly:${tableId}`,
      payoutUnits,
      gameKey: "MONOPOLY_PVP",
      outcome: winnerInPot ? "payout" : "refund"
    }).catch((error) => {
      console.error(`No se pudo liquidar apuesta EyCon de BolowPoly para usuario ${userId}`, error);
    });
  }
}

const monopolyService = createMonopolyService({
  get,
  run,
  all,
  io,
  roomName,
  getEquippedCosmetics: (userIds) => eyconService.getPublicEquipment(userIds, "MONOPOLY"),
  chargeEyconStakes: chargeBolowPolyEyconStakes,
  refundEyconStakes: refundBolowPolyEyconStakes,
  recordPlayActivity: (userId, extra) => recordPlayActivity(userId, "MONOPOLY", extra),
  onGameFinished: async ({ tableId, worldId, state, config }) => {
    if (config?.eyconRewardEligible) {
      await eyconService.awardMonopolyWinner({ tableId, worldId, state }).catch((error) => {
        console.error("No se pudo entregar recompensa EyCon de BolowPoly", error);
      });
    }
    await settleBolowPolyEyconStake({ tableId, state, config }).catch((error) => {
      console.error("No se pudo liquidar apuesta EyCon de BolowPoly", error);
    });
    const participantIds = Array.isArray(state?.players)
      ? state.players.map((player) => Number(player.id)).filter(Number.isInteger)
      : [];
    const alreadyCredited = new Set(
      Array.isArray(config?.activityCreditedIds) ? config.activityCreditedIds.map(Number) : []
    );
    const turns = Number(state?.turn?.number || 0);
    if (turns >= MONOPOLY_MIN_TURNS_FOR_ACTIVITY) {
      for (const userId of participantIds) {
        if (alreadyCredited.has(userId)) continue;
        recordPlayActivity(userId, "MONOPOLY", { monopolyTurns: turns });
      }
    }
  }
});

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json({ limit: "12mb" }));
app.use("/uploads/models3d", express.static(modelUploadsDir, {
  immutable: true,
  maxAge: "7d"
}));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

async function initDatabase() {
  await syncSeededModelUploads();
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  await run("ALTER TABLE users ADD COLUMN monopoly_token_json TEXT").catch(() => {});
  await run("ALTER TABLE users ADD COLUMN active INTEGER NOT NULL DEFAULT 1").catch(() => {});
  await run("ALTER TABLE users ADD COLUMN created_at TEXT").catch(() => {});
  await run("ALTER TABLE users ADD COLUMN updated_at TEXT").catch(() => {});
  await run("ALTER TABLE users ADD COLUMN last_login_at TEXT").catch(() => {});
  await run("UPDATE users SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)");
  await run("UPDATE users SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");

  await run(`
    CREATE TABLE IF NOT EXISTS worlds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`ALTER TABLE worlds ADD COLUMN kind TEXT NOT NULL DEFAULT '${WORLD_KIND_PRIVATE}'`).catch(() => {});
  await run("ALTER TABLE worlds ADD COLUMN room_code TEXT").catch(() => {});
  await run("ALTER TABLE worlds ADD COLUMN visibility TEXT NOT NULL DEFAULT 'PRIVATE'").catch(() => {});
  await run("ALTER TABLE worlds ADD COLUMN created_at TEXT").catch(() => {});
  await run("ALTER TABLE worlds ADD COLUMN updated_at TEXT").catch(() => {});
  await run("UPDATE worlds SET kind = ? WHERE kind IS NULL OR kind = ''", [WORLD_KIND_PRIVATE]);
  await run("UPDATE worlds SET visibility = 'PRIVATE' WHERE visibility IS NULL OR visibility = ''");
  await run("UPDATE worlds SET created_at = COALESCE(created_at, CURRENT_TIMESTAMP)");
  await run("UPDATE worlds SET updated_at = COALESCE(updated_at, CURRENT_TIMESTAMP)");
  await run("CREATE UNIQUE INDEX IF NOT EXISTS idx_worlds_room_code ON worlds(room_code) WHERE room_code IS NOT NULL");
  await run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_worlds_main_kind ON worlds(kind) WHERE kind = '${WORLD_KIND_MAIN}'`);

  await run(`
    CREATE TABLE IF NOT EXISTS economies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      world_id INTEGER NOT NULL,
      balance INTEGER NOT NULL DEFAULT ${STARTING_BALANCE},
      UNIQUE(user_id, world_id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS monopoly_games (
      world_id INTEGER PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_by INTEGER NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS monopoly_tables (
      id TEXT PRIMARY KEY,
      world_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'WAITING',
      config_json TEXT NOT NULL,
      state_json TEXT,
      created_by INTEGER NOT NULL,
      updated_by INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS roles (
      key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS user_roles (
      user_id INTEGER NOT NULL,
      role_key TEXT NOT NULL,
      granted_by INTEGER,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, role_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (role_key) REFERENCES roles(key) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS admin_logs (
      id TEXT PRIMARY KEY,
      admin_user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT '',
      target_id TEXT NOT NULL DEFAULT '',
      target_user_id INTEGER,
      reason TEXT NOT NULL DEFAULT '',
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS currency_movements (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      world_id INTEGER,
      currency TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_before INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      admin_user_id INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
      FOREIGN KEY (admin_user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS login_logs (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      username TEXT NOT NULL DEFAULT '',
      success INTEGER NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      reason TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      path TEXT NOT NULL,
      method TEXT NOT NULL,
      ip TEXT NOT NULL DEFAULT '',
      user_agent TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      world_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      hidden INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (world_id) REFERENCES worlds(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await backfillPrivateRoomCodes();
  await ensureRoleSeeds();
  await bootstrapAdminRoles();
  await eyconService.initSchema();
  await progressionService.initSchema();
  await paymentsService.initSchema();
}

async function syncSeededModelUploads() {
  await fs.promises.mkdir(modelUploadsDir, { recursive: true });

  let entries;
  try {
    entries = await fs.promises.readdir(modelSeedUploadsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.warn("No se pudieron preparar uploads 3D versionados", error);
    }
    return;
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".glb")) continue;
    const sourcePath = path.join(modelSeedUploadsDir, entry.name);
    const targetPath = path.join(modelUploadsDir, entry.name);
    await fs.promises.copyFile(sourcePath, targetPath, fs.constants.COPYFILE_EXCL).catch((error) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
}

function requestIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "")
    .split(",")[0]
    .trim()
    .slice(0, 80);
}

function requestUserAgent(req) {
  return String(req.headers["user-agent"] || "").slice(0, 240);
}

function normalizeRoleKey(value) {
  return String(value || "").trim().toLowerCase();
}

function cleanAdminReason(value) {
  return String(value || "").trim().slice(0, 240);
}

function normalizeAssetKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

function safeGlbUploadBuffer(fileBase64) {
  const raw = String(fileBase64 || "").replace(/^data:[^,]+,/, "");
  if (!raw) {
    throw Object.assign(new Error("Archivo GLB requerido"), { status: 400 });
  }
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length < 20 || buffer.length > 10 * 1024 * 1024) {
    throw Object.assign(new Error("El GLB debe pesar entre 20 bytes y 10 MB"), { status: 400 });
  }
  if (buffer.subarray(0, 4).toString("utf8") !== "glTF") {
    throw Object.assign(new Error("El archivo no parece ser un GLB valido"), { status: 400 });
  }
  return buffer;
}

async function ensureRoleSeeds() {
  await run(
    `INSERT OR IGNORE INTO roles (key, label, description) VALUES
      ('user', 'Usuario', 'Acceso normal a juegos y tienda'),
      ('admin', 'Administrador', 'Acceso al panel administrativo de plataforma'),
      ('vip', 'VIP', 'Recarga el 100% de EyCon; nombre dorado en las tablas de jugadores')`
  );
  await run(
    `INSERT OR IGNORE INTO user_roles (user_id, role_key, source)
     SELECT id, 'user', 'system-default' FROM users`
  );
}

async function grantRole(userId, roleKey, { grantedBy = null, source = "manual" } = {}) {
  const safeRole = normalizeRoleKey(roleKey);
  if (!ROLE_KEYS.has(safeRole)) {
    throw Object.assign(new Error("Rol invalido"), { status: 400 });
  }
  await run(
    `INSERT OR IGNORE INTO user_roles (user_id, role_key, granted_by, source)
     VALUES (?, ?, ?, ?)`,
    [userId, safeRole, grantedBy, source]
  );
}

async function bootstrapAdminRoles() {
  await ensureRoleSeeds();

  for (const userId of ADMIN_ENV_USER_IDS) {
    await grantRole(userId, "admin", { source: "env:ADMIN_USER_IDS" }).catch(() => {});
  }

  for (const username of ADMIN_ENV_USERNAMES) {
    const user = await get("SELECT id FROM users WHERE username = ?", [username]);
    if (user) {
      await grantRole(user.id, "admin", { source: "env:ADMIN_USERNAMES" });
    }
  }

  const explicitAdminUser = await get(
    "SELECT id FROM users WHERE LOWER(username) = ?",
    [normalizeUsername("colimense")]
  );
  if (explicitAdminUser) {
    await grantRole(explicitAdminUser.id, "admin", { source: "username:colimense" }).catch(() => {});
  }

  const existingAdmin = await get(
    `SELECT 1 AS ok FROM user_roles WHERE role_key = 'admin' LIMIT 1`
  );
  if (existingAdmin) return;

  const legacyAdmin = await get(
    `SELECT created_by AS createdBy FROM worlds ORDER BY id ASC LIMIT 1`
  );
  if (legacyAdmin?.createdBy) {
    await grantRole(legacyAdmin.createdBy, "admin", { source: "legacy-first-world-creator" });
    await writeAdminLog({
      adminUserId: null,
      action: "ROLE_BOOTSTRAP",
      targetType: "user",
      targetId: String(legacyAdmin.createdBy),
      targetUserId: legacyAdmin.createdBy,
      reason: "Migracion inicial desde regla anterior: creador del primer mundo",
      metadata: { source: "legacy-first-world-creator" }
    });
  }
}

async function getUserRoles(userId) {
  const rows = await all(
    `SELECT r.key
     FROM user_roles ur
     JOIN roles r ON r.key = ur.role_key
     WHERE ur.user_id = ?
     ORDER BY r.key ASC`,
    [userId]
  );
  const persistedRoles = rows.map((row) => row.key);
  const user = await get("SELECT username FROM users WHERE id = ?", [userId]);
  return resolveEffectiveRoles(persistedRoles, user?.username);
}

async function loadAuthUser(userId) {
  const row = await get(
    `SELECT id, username, active, created_at AS createdAt, last_login_at AS lastLoginAt
     FROM users
     WHERE id = ?`,
    [userId]
  );
  if (!row || row.active === 0) return null;
  const roles = await getUserRoles(row.id);
  const safeRoles = roles.length ? roles : ["user"];
  return {
    id: row.id,
    username: row.username,
    active: Boolean(row.active),
    roles: safeRoles,
    isAdmin: safeRoles.includes("admin"),
    isVip: safeRoles.includes("vip"),
    createdAt: row.createdAt,
    lastLoginAt: row.lastLoginAt
  };
}

async function writeAdminLog({
  adminUserId,
  action,
  targetType = "",
  targetId = "",
  targetUserId = null,
  reason = "",
  metadata = {}
}) {
  await run(
    `INSERT INTO admin_logs (
      id, admin_user_id, action, target_type, target_id, target_user_id,
      reason, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      adminUserId || null,
      String(action || "").slice(0, 80),
      String(targetType || "").slice(0, 80),
      String(targetId || "").slice(0, 120),
      targetUserId || null,
      cleanAdminReason(reason),
      JSON.stringify(metadata && typeof metadata === "object" ? metadata : {})
    ]
  );
}

async function recordLoginAttempt(req, { userId = null, username = "", success = false, reason = "" } = {}) {
  await run(
    `INSERT INTO login_logs (id, user_id, username, success, ip, user_agent, reason)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId || null,
      String(username || "").slice(0, 80),
      success ? 1 : 0,
      requestIp(req),
      requestUserAgent(req),
      String(reason || "").slice(0, 160)
    ]
  ).catch((error) => console.error("No se pudo guardar login log", error));
}

async function recordSiteVisit(req, userId = null) {
  await run(
    `INSERT INTO site_visits (id, user_id, path, method, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId || null,
      String(req.originalUrl || req.path || "").slice(0, 240),
      String(req.method || "GET").slice(0, 12),
      requestIp(req),
      requestUserAgent(req)
    ]
  ).catch((error) => console.error("No se pudo guardar visita", error));
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

async function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadAuthUser(payload.id);
    if (!user) {
      return res.status(401).json({ error: "Usuario inactivo o no encontrado" });
    }
    req.user = user;
    recordSiteVisit(req, user.id);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

async function requirePlatformAdmin(userId) {
  const roles = await getUserRoles(userId);
  if (!roles.includes("admin")) {
    const error = new Error("Permisos administrativos requeridos");
    error.status = 403;
    throw error;
  }
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeWorldName(name) {
  return String(name || "").trim().slice(0, 48);
}

function normalizeRoomCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 16);
}

function normalizeWorldSearch(query) {
  return String(query || "").trim().slice(0, 48);
}

function publicWorld(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdBy: row.createdBy ?? row.created_by,
    kind: row.kind || WORLD_KIND_PRIVATE,
    roomCode: row.roomCode ?? row.room_code ?? null,
    visibility: row.visibility || "PRIVATE",
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    balance: row.balance == null ? null : Number(row.balance),
    playerCount: Number(row.playerCount ?? row.player_count ?? 0),
    isLive: Boolean(row.isLive ?? row.is_live ?? false)
  };
}

function worldPlayerCount(worldId) {
  const players = worldPresence.get(Number(worldId));
  return players ? players.size : 0;
}

function withWorldPresence(world) {
  if (!world) return null;
  const playerCount = worldPlayerCount(world.id);
  return {
    ...world,
    playerCount,
    isLive: playerCount > 0
  };
}

function sortActiveWorlds(first, second) {
  if (first.kind === WORLD_KIND_MAIN && second.kind !== WORLD_KIND_MAIN) return -1;
  if (first.kind !== WORLD_KIND_MAIN && second.kind === WORLD_KIND_MAIN) return 1;
  if (second.playerCount !== first.playerCount) return second.playerCount - first.playerCount;
  return String(first.name || "").localeCompare(String(second.name || ""), "es");
}

async function generatePrivateRoomCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = crypto
      .randomBytes(5)
      .toString("base64url")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, PRIVATE_ROOM_CODE_LENGTH);
    if (code.length < PRIVATE_ROOM_CODE_LENGTH || code === MAIN_WORLD_CODE) continue;
    const existing = await get("SELECT id FROM worlds WHERE room_code = ?", [code]);
    if (!existing) return code;
  }

  return `R${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

async function backfillPrivateRoomCodes() {
  const rows = await all(
    `SELECT id FROM worlds
     WHERE (kind IS NULL OR kind != ?)
       AND (room_code IS NULL OR room_code = '')`,
    [WORLD_KIND_MAIN]
  );

  for (const row of rows) {
    const code = await generatePrivateRoomCode();
    await run(
      "UPDATE worlds SET kind = ?, visibility = 'PRIVATE', room_code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [WORLD_KIND_PRIVATE, code, row.id]
    );
  }
}

async function ensureMainWorld(createdByUserId) {
  let world = await get(
    `SELECT
       id,
       name,
       created_by AS createdBy,
       kind,
       room_code AS roomCode,
       visibility,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM worlds
     WHERE kind = ? OR room_code = ?
     ORDER BY CASE WHEN kind = ? THEN 0 ELSE 1 END, id ASC
     LIMIT 1`,
    [WORLD_KIND_MAIN, MAIN_WORLD_CODE, WORLD_KIND_MAIN]
  );

  if (world) {
    await run(
      `UPDATE worlds
       SET name = ?, kind = ?, visibility = 'PUBLIC', room_code = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [MAIN_WORLD_NAME, WORLD_KIND_MAIN, MAIN_WORLD_CODE, world.id]
    );
    return publicWorld({ ...world, name: MAIN_WORLD_NAME, kind: WORLD_KIND_MAIN, visibility: "PUBLIC", roomCode: MAIN_WORLD_CODE });
  }

  const result = await run(
    `INSERT INTO worlds (name, created_by, kind, room_code, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'PUBLIC', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [MAIN_WORLD_NAME, createdByUserId, WORLD_KIND_MAIN, MAIN_WORLD_CODE]
  );

  const existingAdmin = await get("SELECT 1 AS ok FROM user_roles WHERE role_key = 'admin' LIMIT 1");
  if (!existingAdmin) {
    await grantRole(createdByUserId, "admin", { source: "main-world-bootstrap" });
    await writeAdminLog({
      adminUserId: createdByUserId,
      action: "ROLE_BOOTSTRAP",
      targetType: "user",
      targetId: String(createdByUserId),
      targetUserId: createdByUserId,
      reason: "Sala MAIN inicial creada sin administrador existente",
      metadata: { source: "main-world-bootstrap", worldId: result.id }
    });
  }

  return publicWorld({
    id: result.id,
    name: MAIN_WORLD_NAME,
    createdBy: createdByUserId,
    kind: WORLD_KIND_MAIN,
    roomCode: MAIN_WORLD_CODE,
    visibility: "PUBLIC",
    createdAt: null,
    updatedAt: null,
    balance: null
  });
}

async function loadWorldForUser(worldId, userId) {
  const row = await get(
    `SELECT
       worlds.id,
       worlds.name,
       worlds.created_by AS createdBy,
       worlds.kind,
       worlds.room_code AS roomCode,
       worlds.visibility,
       worlds.created_at AS createdAt,
       worlds.updated_at AS updatedAt,
       economies.balance AS balance
     FROM worlds
     LEFT JOIN economies
       ON economies.world_id = worlds.id
       AND economies.user_id = ?
     WHERE worlds.id = ?`,
    [userId, worldId]
  );
  return publicWorld(row);
}

function validateUsername(username) {
  if (!USERNAME_PATTERN.test(username)) {
    return "El usuario debe tener 3 a 16 caracteres: letras, numeros o guion bajo";
  }

  return null;
}

function validatePassword(password) {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "La contrasena debe tener minimo 8 caracteres";
  }

  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "La contrasena debe incluir al menos una letra y un numero";
  }

  if (/\s/.test(password)) {
    return "La contrasena no puede tener espacios";
  }

  return null;
}

const MONOPOLY_TOKEN_COLORS = [
  "#d94841", "#2f7ef0", "#20a56d", "#f0bc3f", "#7a58d7", "#22252f",
  "#ec4899", "#0ea5e9", "#f97316", "#65a30d", "#c026d3", "#fef3c7"
];

function sanitizeBolowPolyToken(input) {
  const token = input && typeof input === "object" ? input : {};
  const clean = {
    label: String(token.label || "").trim().slice(0, 4).toUpperCase(),
    icon: "",
    bg: /^#[0-9a-fA-F]{6}$/.test(token.bg) ? token.bg : "#d94841",
    ring: /^#[0-9a-fA-F]{6}$/.test(token.ring) ? token.ring : "#7c1510",
    fg: "#ffffff",
    shape: "circle"
  };

  if (!clean.icon && !clean.label) {
    clean.label = "TOP";
  }

  return clean;
}

function parseStoredBolowPolyToken(value) {
  if (!value) return null;
  try {
    return sanitizeBolowPolyToken(JSON.parse(value));
  } catch {
    return null;
  }
}

function roomName(worldId) {
  return `world:${worldId}`;
}

function tableChannel(worldId, tableId) {
  return `${roomName(worldId)}:monopoly:${tableId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function getEconomyOrFail(userId, worldId) {
  const economy = await get(
    "SELECT id, user_id, world_id, balance FROM economies WHERE user_id = ? AND world_id = ?",
    [userId, worldId]
  );

  if (!economy) {
    const error = new Error("Primero debes unirte a este mundo");
    error.status = 404;
    throw error;
  }

  return economy;
}

async function ensureWorldMembership(userId, worldId) {
  if (!Number.isInteger(worldId)) {
    const error = new Error("worldId invalido");
    error.status = 400;
    throw error;
  }

  const row = await get(
    `SELECT
       id,
       name,
       created_by AS createdBy,
       kind,
       room_code AS roomCode,
       visibility,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM worlds
     WHERE id = ?`,
    [worldId]
  );

  if (!row) {
    const error = new Error("Mundo no encontrado");
    error.status = 404;
    throw error;
  }

  await run(
    "INSERT OR IGNORE INTO economies (user_id, world_id, balance) VALUES (?, ?, ?)",
    [userId, worldId, STARTING_BALANCE]
  );

  const economy = await getEconomyOrFail(userId, worldId);
  const world = publicWorld(row);
  return { world, economy };
}

// Construye un "shoe" de `deckCount` barajas de 52 cartas mezcladas juntas con
// Fisher-Yates (crypto.randomInt para aleatoriedad segura). Un solo mazo de 52
// puede agotarse con muchos jugadores; por eso permitimos varios mazos.
function makeDeck(deckCount = 1) {
  const suits = ["S", "H", "D", "C"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  const totalDecks = Math.max(1, Math.floor(deckCount) || 1);
  for (let d = 0; d < totalDecks; d += 1) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push({ suit, rank });
      }
    }
  }

  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// Cantidad de mazos recomendada segun jugadores en la mesa. Con repartos de 2
// cartas + posibles hits + la banca, ~7 cartas por jugador es un techo prudente.
function deckCountFor(playerCount = 1) {
  const cardsNeeded = (Math.max(1, playerCount) + 1) * 7;
  return Math.max(1, Math.ceil(cardsNeeded / 52));
}

// Saca una carta del tope del mazo. Red de seguridad: si el shoe se agota a
// mitad de ronda, lo reabastecemos con una baraja nueva mezclada para no
// devolver `undefined` (que rompia el calculo de manos).
function draw(deck) {
  if (!Array.isArray(deck) || deck.length === 0) {
    if (Array.isArray(deck)) {
      deck.push(...makeDeck(1));
    } else {
      return { suit: "S", rank: "A" };
    }
  }
  return deck.pop();
}

function cardPoints(card) {
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}

function handValue(cards) {
  let total = cards.reduce((sum, card) => sum + cardPoints(card), 0);
  let aces = cards.filter((card) => card.rank === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function hasBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

function addPresenceSocket(socket, worldId) {
  if (!worldPresence.has(worldId)) {
    worldPresence.set(worldId, new Map());
  }

  const players = worldPresence.get(worldId);
  const existing = players.get(socket.user.id) || {
    userId: socket.user.id,
    username: socket.user.username,
    sockets: new Set()
  };

  existing.sockets.add(socket.id);
  players.set(socket.user.id, existing);
}

function removePresenceSocket(socket, worldId) {
  const players = worldPresence.get(worldId);

  if (!players) {
    return false;
  }

  const player = players.get(socket.user.id);

  if (!player) {
    return false;
  }

  player.sockets.delete(socket.id);

  if (player.sockets.size > 0) {
    return false;
  }

  players.delete(socket.user.id);

  if (players.size === 0) {
    worldPresence.delete(worldId);
  }

  return true;
}

async function emitWorldPresence(worldId) {
  const players = worldPresence.get(worldId);

  if (!players || players.size === 0) {
    io.to(roomName(worldId)).emit("world_presence", { worldId, players: [] });
    return;
  }

  const ids = [...players.keys()];
  const placeholders = ids.map(() => "?").join(",");
  const rows = await all(
    `
      SELECT
        users.id AS userId,
        users.username AS username,
        users.monopoly_token_json AS tokenJson,
        economies.balance AS balance,
        EXISTS(
          SELECT 1 FROM user_roles
          WHERE user_roles.user_id = users.id AND user_roles.role_key = 'vip'
        ) AS isVip
      FROM users
      JOIN economies
        ON economies.user_id = users.id
        AND economies.world_id = ?
      WHERE users.id IN (${placeholders})
      ORDER BY economies.balance DESC, users.username ASC
    `,
    [worldId, ...ids]
  );

  io.to(roomName(worldId)).emit("world_presence", {
    worldId,
    players: rows.map((row) => ({
      userId: row.userId,
      username: row.username,
      balance: row.balance,
      isVip: Boolean(row.isVip),
      token: parseStoredBolowPolyToken(row.tokenJson)
    }))
  });
}

async function broadcastEconomyChange(userId, worldId, balance) {
  io.to(userRoom(userId)).emit("balance_update", { worldId, balance });
  await emitWorldPresence(worldId);
}

async function settleBlackjackSession(session, outcome) {
  if (session.status === "settled") {
    return session;
  }

  const payout = outcome === "win" ? session.bet * 2 : outcome === "push" ? session.bet : 0;

  if (session.currency === "EYCON") {
    const eyconPayoutUnits = outcome === "win"
      ? session.eyconBetUnits * 2
      : outcome === "push"
        ? session.eyconBetUnits
        : 0;
    const settledWager = await eyconService.settleWager({
      userId: session.userId,
      wagerId: session.id,
      payoutUnits: eyconPayoutUnits,
      gameKey: "BLACKJACK",
      outcome
    });
    session.eyconPayoutUnits = eyconPayoutUnits;
    session.eyconBalanceUnits = settledWager.balanceUnits;
  } else if (payout > 0) {
    await run(
      "UPDATE economies SET balance = balance + ? WHERE user_id = ? AND world_id = ?",
      [payout, session.userId, session.worldId]
    );
  }

  const economy = await getEconomyOrFail(session.userId, session.worldId);
  session.status = "settled";
  session.outcome = outcome;
  session.payout = session.currency === "EYCON" ? 0 : payout;
  session.balance = economy.balance;
  session.eyconRewardUnits = 0;
  if (outcome === "win" && session.currency !== "EYCON") {
    try {
      const reward = await eyconService.awardBlackjackWin({
        userId: session.userId,
        sessionId: session.id,
        bet: session.bet
      });
      session.eyconRewardUnits = Number(reward.rewardUnits || 0);
    } catch (error) {
      console.error("No se pudo entregar recompensa EyCon de Blackjack", error);
    }
  }
  blackjackSessions.set(session.id, session);
  await broadcastEconomyChange(session.userId, session.worldId, economy.balance);
  recordPlayActivity(session.userId, "BLACKJACK", { won: outcome === "win" });
  return session;
}

function publicBlackjackState(session) {
  const active = session.status === "active";

  return {
    sessionId: session.id,
    status: session.status,
    outcome: session.outcome || null,
    bet: session.bet,
    payout: session.payout || 0,
    currency: session.currency || "NORMAL",
    eyconBetUnits: session.eyconBetUnits || 0,
    eyconPayoutUnits: session.eyconPayoutUnits || 0,
    eyconBalanceUnits: session.eyconBalanceUnits || null,
    eyconRewardUnits: session.eyconRewardUnits || 0,
    eyconReward: (session.eyconRewardUnits || 0) / eyconService.EYCON_SCALE,
    balance: session.balance,
    playerCards: session.player,
    dealerCards: active ? [session.dealer[0], { hidden: true }] : session.dealer,
    playerTotal: handValue(session.player),
    dealerTotal: active ? null : handValue(session.dealer)
  };
}

async function resolveDealerTurn(session) {
  while (handValue(session.dealer) < 17) {
    session.dealer.push(draw(session.deck));
  }

  const playerTotal = handValue(session.player);
  const dealerTotal = handValue(session.dealer);
  let outcome = "push";

  if (dealerTotal > 21 || playerTotal > dealerTotal) {
    outcome = "win";
  } else if (playerTotal < dealerTotal) {
    outcome = "lose";
  }

  return settleBlackjackSession(session, outcome);
}

function emptyMultiplayerTable(worldId) {
  return {
    worldId,
    roundId: null,
    phase: "idle",
    message: "Mesa abierta",
    bettingEndsAt: null,
    turnEndsAt: null,
    betLimits: {
      min: AI_TABLE_MIN_BET,
      max: AI_TABLE_MAX_BET
    },
    maxPlayers: TABLE_MAX_PLAYERS,
    dealerCards: [],
    dealerTotal: null,
    currentTurnUserId: null,
    players: []
  };
}

function publicMultiplayerTable(worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table) {
    return emptyMultiplayerTable(worldId);
  }

  const activeDealer = table.phase === "playing";
  const dealerCards = activeDealer && table.dealer.length > 1
    ? [table.dealer[0], { hidden: true }]
    : table.dealer;

  return {
    worldId,
    roundId: table.roundId,
    phase: table.phase,
    message: table.message,
    bettingEndsAt: table.bettingEndsAt,
    turnEndsAt: table.turnEndsAt,
    betLimits: {
      min: AI_TABLE_MIN_BET,
      max: AI_TABLE_MAX_BET
    },
    maxPlayers: table.maxPlayers || TABLE_MAX_PLAYERS,
    dealerCards,
    dealerTotal: activeDealer || table.dealer.length === 0 ? null : handValue(table.dealer),
    currentTurnUserId: table.currentTurnUserId,
    players: table.order
      .map((userId) => table.players.get(userId))
      .filter(Boolean)
      .map((player) => ({
        userId: player.userId,
        username: player.username,
        bet: player.bet,
        cards: player.cards,
        total: player.cards.length ? handValue(player.cards) : 0,
        status: player.status,
        outcome: player.outcome,
        payout: player.payout,
        eyconRewardUnits: player.eyconRewardUnits || 0,
        balance: player.balance,
        connected: player.connected !== false
      }))
  };
}

function emitMultiplayerTable(worldId) {
  io.to(roomName(worldId)).emit("blackjack_state", publicMultiplayerTable(worldId));
}

function clearBettingTimer(table) {
  if (table && table.bettingTimer) {
    clearTimeout(table.bettingTimer);
    table.bettingTimer = null;
  }
}

function clearTurnTimer(table) {
  if (table && table.turnTimer) {
    clearTimeout(table.turnTimer);
    table.turnTimer = null;
  }
}

function clearResetTimer(table) {
  if (table && table.resetTimer) {
    clearTimeout(table.resetTimer);
    table.resetTimer = null;
  }
}

function clearTableTimers(table) {
  clearBettingTimer(table);
  clearTurnTimer(table);
  clearResetTimer(table);
}

function createBettingTable(worldId) {
  const table = {
    worldId,
    roundId: crypto.randomUUID(),
    phase: "betting",
    message: "Esperando apuestas",
    bettingEndsAt: null,
    turnEndsAt: null,
    bettingTimer: null,
    turnTimer: null,
    resetTimer: null,
    deck: [],
    dealer: [],
    maxPlayers: TABLE_MAX_PLAYERS,
    players: new Map(),
    order: [],
    turnIndex: -1,
    currentTurnUserId: null
  };

  multiplayerBlackjackTables.set(worldId, table);
  return table;
}

function getOrCreateBettingTable(worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table || table.phase === "settled" || table.phase === "idle") {
    if (table) {
      clearTableTimers(table);
    }
    return createBettingTable(worldId);
  }

  return table;
}

function startBettingCountdown(table) {
  table.bettingEndsAt = Date.now() + BETTING_WINDOW_MS;
  table.bettingTimer = setTimeout(() => {
    startMultiplayerRound(table.worldId).catch((error) => {
      console.error("No se pudo iniciar la mesa multijugador", error);
    });
  }, BETTING_WINDOW_MS);
}

function scheduleTurnTimeout(table) {
  clearTurnTimer(table);
  table.turnEndsAt = Date.now() + TURN_WINDOW_MS;
  const expectedUserId = table.currentTurnUserId;

  table.turnTimer = setTimeout(() => {
    const currentTable = multiplayerBlackjackTables.get(table.worldId);

    if (
      !currentTable ||
      currentTable.phase !== "playing" ||
      currentTable.currentTurnUserId !== expectedUserId
    ) {
      return;
    }

    const player = currentTable.players.get(expectedUserId);

    if (!player || player.status !== "playing") {
      return;
    }

    player.status = "stood";
    currentTable.message = `${player.username} agoto el tiempo y se planta`;
    advanceMultiplayerTurn(currentTable.worldId).catch((error) => {
      console.error("No se pudo avanzar el turno automatico", error);
    });
  }, TURN_WINDOW_MS);
}

function scheduleSettledCleanup(table) {
  clearResetTimer(table);
  table.resetTimer = setTimeout(() => {
    const currentTable = multiplayerBlackjackTables.get(table.worldId);

    if (currentTable && currentTable.roundId === table.roundId && currentTable.phase === "settled") {
      clearTableTimers(currentTable);
      multiplayerBlackjackTables.delete(table.worldId);
      emitMultiplayerTable(table.worldId);
    }
  }, SETTLED_TABLE_VISIBLE_MS);
}

function setCurrentTurn(table, turnIndex) {
  table.turnIndex = turnIndex;
  table.currentTurnUserId = table.order[turnIndex];
  table.turnEndsAt = null;
  const player = table.players.get(table.currentTurnUserId);
  table.message = `Turno de ${player.username}`;
  scheduleTurnTimeout(table);
  emitMultiplayerTable(table.worldId);
}

async function startMultiplayerRound(worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table || table.phase !== "betting") {
    return;
  }

  clearBettingTimer(table);

  if (table.order.length === 0) {
    clearTableTimers(table);
    multiplayerBlackjackTables.delete(worldId);
    emitMultiplayerTable(worldId);
    return;
  }

  table.phase = "playing";
  table.status = "playing";
  table.deck = makeDeck(deckCountFor(table.order.length));
  table.dealer = [draw(table.deck), draw(table.deck)];
  table.turnIndex = -1;
  table.currentTurnUserId = null;
  table.turnEndsAt = null;

  for (const userId of table.order) {
    const player = table.players.get(userId);
    player.cards = [draw(table.deck), draw(table.deck)];
    player.status = hasBlackjack(player.cards) ? "blackjack" : "playing";
      player.outcome = null;
      player.payout = 0;
      player.eyconRewardUnits = 0;
  }

  const firstTurnIndex = table.order.findIndex((userId) => {
    const player = table.players.get(userId);
    return player && player.status === "playing";
  });

  if (firstTurnIndex === -1) {
    await settleMultiplayerTable(worldId);
    return;
  }

  setCurrentTurn(table, firstTurnIndex);
}

async function advanceMultiplayerTurn(worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table || table.phase !== "playing") {
    return;
  }

  clearTurnTimer(table);

  for (let index = table.turnIndex + 1; index < table.order.length; index += 1) {
    const userId = table.order[index];
    const player = table.players.get(userId);

    if (player && player.status === "playing") {
      setCurrentTurn(table, index);
      return;
    }
  }

  await settleMultiplayerTable(worldId);
}

function settleOutcome(player, dealerTotal) {
  const total = handValue(player.cards);

  if (player.status === "busted" || total > 21) {
    return "lose";
  }

  if (dealerTotal > 21 || total > dealerTotal) {
    return "win";
  }

  if (total === dealerTotal) {
    return "push";
  }

  return "lose";
}

async function settleMultiplayerTable(worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table || table.phase === "settled") {
    return;
  }

  clearTurnTimer(table);
  table.phase = "dealer";
  table.currentTurnUserId = null;
  table.turnEndsAt = null;
  table.message = "La banca juega";
  emitMultiplayerTable(worldId);

  while (handValue(table.dealer) < 17) {
    table.dealer.push(draw(table.deck));
  }

  const dealerTotal = handValue(table.dealer);
  const updates = [];

  await run("BEGIN IMMEDIATE");

  try {
    for (const userId of table.order) {
      const player = table.players.get(userId);
      const outcome = settleOutcome(player, dealerTotal);
      const payout = outcome === "win" ? player.bet * 2 : outcome === "push" ? player.bet : 0;
      const economy = await getEconomyOrFail(userId, worldId);
      const nextBalance = Math.max(0, economy.balance + payout);

      await run("UPDATE economies SET balance = ? WHERE user_id = ? AND world_id = ?", [
        nextBalance,
        userId,
        worldId
      ]);

      player.status = "done";
      player.outcome = outcome;
      player.payout = payout;
      player.balance = nextBalance;
      updates.push({ userId, balance: nextBalance });
    }

    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    throw error;
  }

  table.phase = "settled";
  table.status = "settled";
  table.message = "Ronda resuelta";
  table.bettingEndsAt = null;
  table.turnEndsAt = null;

  for (const userId of table.order) {
    const player = table.players.get(userId);
    recordPlayActivity(userId, "BLACKJACK", { won: player?.outcome === "win" });
    if (player?.outcome !== "win") continue;
    try {
      const reward = await eyconService.awardBlackjackWin({
        userId,
        sessionId: table.roundId,
        bet: player.bet
      });
      player.eyconRewardUnits = Number(reward.rewardUnits || 0);
    } catch (error) {
      console.error("No se pudo entregar recompensa EyCon de mesa IA", error);
    }
  }

  for (const update of updates) {
    io.to(userRoom(update.userId)).emit("balance_update", {
      worldId,
      balance: update.balance
    });
  }

  await emitWorldPresence(worldId);
  emitMultiplayerTable(worldId);
  scheduleSettledCleanup(table);
}

async function refundBet(player, worldId) {
  await run(
    "UPDATE economies SET balance = balance + ? WHERE user_id = ? AND world_id = ?",
    [player.bet, player.userId, worldId]
  );

  const economy = await getEconomyOrFail(player.userId, worldId);
  player.balance = economy.balance;
  await broadcastEconomyChange(player.userId, worldId, economy.balance);
}

async function handlePlayerLeftWorld(userId, worldId) {
  const table = multiplayerBlackjackTables.get(worldId);

  if (!table) {
    return;
  }

  const player = table.players.get(userId);

  if (!player) {
    return;
  }

  if (table.phase === "betting") {
    await refundBet(player, worldId);
    table.players.delete(userId);
    table.order = table.order.filter((id) => id !== userId);
    table.message = `${player.username} salio de la mesa`;

    if (table.order.length === 0) {
      clearTableTimers(table);
      multiplayerBlackjackTables.delete(worldId);
    }

    emitMultiplayerTable(worldId);
    return;
  }

  if (
    table.phase === "playing" &&
    table.currentTurnUserId === userId &&
    player.status === "playing"
  ) {
    player.connected = false;
    player.status = "stood";
    table.message = `${player.username} se desconecto; turno saltado`;
    await advanceMultiplayerTurn(worldId);
    return;
  }

  if (table.phase === "playing") {
    player.connected = false;
    table.message = `${player.username} se desconecto`;
    emitMultiplayerTable(worldId);
  }
}

function getPlayerTableMap(worldId) {
  if (!playerOnlyTables.has(worldId)) {
    playerOnlyTables.set(worldId, new Map());
  }

  return playerOnlyTables.get(worldId);
}

function publicPlayerTables(worldId) {
  const tables = playerOnlyTables.get(worldId);

  if (!tables) {
    return { worldId, betLimits: { min: AI_TABLE_MIN_BET, max: null }, tables: [] };
  }

  return {
    worldId,
    betLimits: { min: AI_TABLE_MIN_BET, max: null },
    tables: [...tables.values()].map((table) => ({
      id: table.id,
      name: table.name,
      status: table.status,
      buyIn: table.buyIn,
      currency: table.currency || "NORMAL",
      maxSeats: table.maxSeats,
      hostId: table.hostId,
      createdAt: table.createdAt,
      phase: table.phase,
      message: table.message,
      pot: table.buyIn * table.seats.length,
      startEndsAt: table.startEndsAt,
      turnEndsAt: table.turnEndsAt,
      rematchEndsAt: table.rematchEndsAt || null,
      rematchRequestedBy: table.rematchRequestedBy || null,
      rematchConfirmations: Array.from(table.rematchConfirmations || []),
      currentTurnUserId: table.currentTurnUserId,
      winners: table.winners || [],
      seats: table.seats.map((seat) => ({
        userId: seat.userId,
        username: seat.username,
        cards: seat.cards || [],
        total: seat.cards && seat.cards.length ? handValue(seat.cards) : 0,
        status: seat.status || "waiting",
        outcome: seat.outcome || null,
        payout: seat.payout || 0,
        connected: seat.connected !== false
      }))
    }))
  };
}

function publicPlayerTableById(worldId, tableId) {
  return publicPlayerTables(worldId).tables.find((table) => table.id === tableId) || null;
}

function emitPlayerTables(worldId) {
  io.to(roomName(worldId)).emit("player_tables_state", publicPlayerTables(worldId));
}

function createPlayerTableSeat(user) {
  return {
    userId: user.id,
    username: user.username,
    cards: [],
    status: "waiting",
    outcome: null,
    payout: 0,
    connected: true
  };
}

async function reservePlayerTableBuyIn(userId, worldId, buyIn) {
  let nextBalance = 0;

  await run("BEGIN IMMEDIATE");

  try {
    const economy = await getEconomyOrFail(userId, worldId);

    if (economy.balance < buyIn) {
      throw new Error("Saldo insuficiente para sentarte");
    }

    nextBalance = economy.balance - buyIn;
    await run("UPDATE economies SET balance = ? WHERE user_id = ? AND world_id = ?", [
      nextBalance,
      userId,
      worldId
    ]);
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    throw error;
  }

  return nextBalance;
}

function clearPlayerTableTimers(table) {
  if (table.startTimer) {
    clearTimeout(table.startTimer);
    table.startTimer = null;
  }

  if (table.turnTimer) {
    clearTimeout(table.turnTimer);
    table.turnTimer = null;
  }

  if (table.resetTimer) {
    clearTimeout(table.resetTimer);
    table.resetTimer = null;
  }

  if (table.rematchTimer) {
    clearTimeout(table.rematchTimer);
    table.rematchTimer = null;
  }
}

async function refundPlayerTableSeat(seat, worldId, buyIn, currency = "NORMAL", tableId = null) {
  if (currency === "EYCON") {
    await eyconService.settlePvpStake({
      userId: seat.userId,
      referenceId: `bj-pvp:${tableId}`,
      payoutUnits: buyIn,
      gameKey: "BLACKJACK_PVP",
      outcome: "refund"
    });
    return;
  }
  await run("UPDATE economies SET balance = balance + ? WHERE user_id = ? AND world_id = ?", [
    buyIn,
    seat.userId,
    worldId
  ]);
  const economy = await getEconomyOrFail(seat.userId, worldId);
  await broadcastEconomyChange(seat.userId, worldId, economy.balance);
}

function clearPvpRematchState(table) {
  if (table.rematchTimer) {
    clearTimeout(table.rematchTimer);
    table.rematchTimer = null;
  }

  table.rematchEndsAt = null;
  table.rematchRequestedBy = null;
  table.rematchConfirmations = new Set();
}

function resetPvpTableToWaiting(table, message = "Esperando jugadores") {
  const connectedSeats = table.seats.filter((seat) => seat.connected !== false);

  clearPlayerTableTimers(table);
  clearPvpRematchState(table);

  table.phase = "waiting";
  table.status = "waiting";
  table.startEndsAt = null;
  table.turnEndsAt = null;
  table.turnIndex = -1;
  table.currentTurnUserId = null;
  table.deck = [];
  table.winners = [];
  table.seats = connectedSeats.map((seat) => ({
    ...seat,
    cards: [],
    status: "waiting",
    outcome: null,
    payout: 0
  }));

  if (table.seats.length > 0) {
    table.hostId = table.seats[0].userId;
  }

  table.message = message;
}

function schedulePlayerTableCleanup(table, worldId) {
  if (table.resetTimer) {
    clearTimeout(table.resetTimer);
  }

  table.resetTimer = setTimeout(() => {
    const tables = playerOnlyTables.get(worldId);
    const currentTable = tables && tables.get(table.id);

    if (!currentTable || currentTable.phase !== "settled") {
      return;
    }

    resetPvpTableToWaiting(currentTable, "La revancha expiro. Vuelvan al lobby.");

    if (currentTable.seats.length === 0) {
      tables.delete(table.id);

      if (tables.size === 0) {
        playerOnlyTables.delete(worldId);
      }
    }

    emitPlayerTables(worldId);
  }, PVP_REMATCH_WINDOW_MS);
}

async function tryStartPvpRematch(worldId, tableId) {
  const { table } = findPlayerTable(worldId, tableId);

  if (table.phase !== "settled") {
    return false;
  }

  const connectedSeats = table.seats.filter((seat) => seat.connected !== false);
  const confirmations = table.rematchConfirmations instanceof Set
    ? table.rematchConfirmations
    : new Set(table.rematchConfirmations || []);

  if (
    connectedSeats.length < 2 ||
    !connectedSeats.every((seat) => confirmations.has(seat.userId))
  ) {
    return false;
  }

  resetPvpTableToWaiting(table, "Revancha confirmada");
  emitPlayerTables(worldId);
  await startPvpTableRound(worldId, tableId);
  return true;
}

function findPlayerTable(worldId, tableId) {
  const tables = playerOnlyTables.get(worldId);
  const table = tables && tables.get(tableId);

  if (!table) {
    const error = new Error("Mesa PvP no encontrada");
    error.status = 404;
    throw error;
  }

  return { tables, table };
}

function getNextPvpTurnIndex(table, fromIndex) {
  for (let index = fromIndex + 1; index < table.seats.length; index += 1) {
    const seat = table.seats[index];

    if (seat.status === "playing") {
      return index;
    }
  }

  return -1;
}

function schedulePvpTurnTimeout(table, worldId) {
  if (table.turnTimer) {
    clearTimeout(table.turnTimer);
  }

  table.turnEndsAt = Date.now() + TURN_WINDOW_MS;
  const tableId = table.id;
  const expectedUserId = table.currentTurnUserId;

  table.turnTimer = setTimeout(() => {
    try {
      const { table: currentTable } = findPlayerTable(worldId, tableId);

      if (
        currentTable.phase !== "playing" ||
        currentTable.currentTurnUserId !== expectedUserId
      ) {
        return;
      }

      const seat = currentTable.seats.find((candidate) => candidate.userId === expectedUserId);

      if (!seat || seat.status !== "playing") {
        return;
      }

      seat.status = "stood";
      currentTable.message = `${seat.username} agoto el tiempo y se planta`;
      advancePvpTurn(worldId, tableId).catch((error) => {
        console.error("No se pudo avanzar turno PvP", error);
      });
    } catch (error) {
      console.error("No se pudo resolver timeout PvP", error);
    }
  }, TURN_WINDOW_MS);
}

function setPvpTurn(table, worldId, turnIndex) {
  table.turnIndex = turnIndex;
  table.currentTurnUserId = table.seats[turnIndex].userId;
  table.message = `Turno de ${table.seats[turnIndex].username}`;
  schedulePvpTurnTimeout(table, worldId);
  emitPlayerTables(worldId);
}

async function startPvpTableRound(worldId, tableId) {
  const { table } = findPlayerTable(worldId, tableId);

  if (table.phase !== "waiting" || table.seats.length < 2) {
    return;
  }

  if (table.startTimer) {
    clearTimeout(table.startTimer);
    table.startTimer = null;
  }

  table.phase = "playing";
  table.deck = makeDeck(deckCountFor(table.seats.length));
  table.turnIndex = -1;
  table.currentTurnUserId = null;
  table.startEndsAt = null;
  table.turnEndsAt = null;
  table.winners = [];
  clearPvpRematchState(table);

  for (const seat of table.seats) {
    seat.cards = [draw(table.deck), draw(table.deck)];
    seat.status = hasBlackjack(seat.cards) ? "blackjack" : "playing";
    seat.outcome = null;
    seat.payout = 0;
  }

  const firstTurn = getNextPvpTurnIndex(table, -1);

  if (firstTurn === -1) {
    await settlePvpTable(worldId, tableId);
    return;
  }

  setPvpTurn(table, worldId, firstTurn);
}

function schedulePvpStart(table, worldId) {
  if (table.startTimer || table.seats.length < 2 || table.phase !== "waiting") {
    return;
  }

  table.startEndsAt = Date.now() + PVP_START_WINDOW_MS;
  table.message = "La mesa arranca en breve";
  table.startTimer = setTimeout(() => {
    startPvpTableRound(worldId, table.id).catch((error) => {
      console.error("No se pudo iniciar mesa PvP", error);
    });
  }, PVP_START_WINDOW_MS);
  emitPlayerTables(worldId);
}

async function advancePvpTurn(worldId, tableId) {
  const { table } = findPlayerTable(worldId, tableId);

  if (table.phase !== "playing") {
    return;
  }

  if (table.turnTimer) {
    clearTimeout(table.turnTimer);
    table.turnTimer = null;
  }

  const nextTurn = getNextPvpTurnIndex(table, table.turnIndex);

  if (nextTurn === -1) {
    await settlePvpTable(worldId, tableId);
    return;
  }

  setPvpTurn(table, worldId, nextTurn);
}

async function settlePvpTable(worldId, tableId) {
  const { table } = findPlayerTable(worldId, tableId);

  if (table.phase === "settled") {
    return;
  }

  if (table.turnTimer) {
    clearTimeout(table.turnTimer);
    table.turnTimer = null;
  }

  table.phase = "settled";
  table.currentTurnUserId = null;
  table.turnEndsAt = null;
  table.rematchEndsAt = Date.now() + PVP_REMATCH_WINDOW_MS;
  table.rematchRequestedBy = null;
  table.rematchConfirmations = new Set();

  const validSeats = table.seats.filter((seat) => handValue(seat.cards || []) <= 21);
  const bestTotal = validSeats.length
    ? Math.max(...validSeats.map((seat) => handValue(seat.cards || [])))
    : 0;
  const winners = validSeats.filter((seat) => handValue(seat.cards || []) === bestTotal);
  const pot = table.buyIn * table.seats.length;
  const payout = winners.length ? Math.floor(pot / winners.length) : 0;

  table.winners = winners.map((seat) => seat.userId);
  const isEycon = table.currency === "EYCON";
  table.message = winners.length
    ? `Ganador: ${winners.map((seat) => seat.username).join(", ")}.${isEycon ? "" : " El anfitrion puede pedir revancha."}`
    : `Todos se pasaron.${isEycon ? "" : " El anfitrion puede pedir revancha."}`;

  if (isEycon) {
    for (const seat of table.seats) {
      const won = table.winners.includes(seat.userId);
      const nextPayout = won ? payout : 0;
      seat.status = "done";
      seat.outcome = won ? "win" : "lose";
      seat.payout = nextPayout;
      if (nextPayout > 0) {
        await eyconService.settlePvpStake({
          userId: seat.userId,
          referenceId: `bj-pvp:${table.id}`,
          payoutUnits: nextPayout,
          gameKey: "BLACKJACK_PVP",
          outcome: "payout"
        }).catch((error) => {
          console.error(`No se pudo liquidar apuesta EyCon PvP para usuario ${seat.userId}`, error);
        });
      }
      recordPlayActivity(seat.userId, "BLACKJACK", { won });
    }
  } else {
    await run("BEGIN IMMEDIATE");

    try {
      for (const seat of table.seats) {
        const won = table.winners.includes(seat.userId);
        const nextPayout = won ? payout : 0;
        const economy = await getEconomyOrFail(seat.userId, worldId);
        const nextBalance = economy.balance + nextPayout;

        await run("UPDATE economies SET balance = ? WHERE user_id = ? AND world_id = ?", [
          nextBalance,
          seat.userId,
          worldId
        ]);

        seat.status = "done";
        seat.outcome = won ? "win" : "lose";
        seat.payout = nextPayout;
      }

      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK").catch(() => {});
      throw error;
    }

    for (const seat of table.seats) {
      const economy = await getEconomyOrFail(seat.userId, worldId);
      io.to(userRoom(seat.userId)).emit("balance_update", { worldId, balance: economy.balance });
      recordPlayActivity(seat.userId, "BLACKJACK", { won: table.winners.includes(seat.userId) });
    }
  }

  await emitWorldPresence(worldId);
  emitPlayerTables(worldId);
  schedulePlayerTableCleanup(table, worldId);
}

async function handlePlayerLeftPlayerTables(userId, worldId) {
  const tables = playerOnlyTables.get(worldId);

  if (!tables) {
    return;
  }

  for (const [tableId, table] of tables.entries()) {
    const leavingSeat = table.seats.find((seat) => seat.userId === userId);

    if (!leavingSeat) {
      continue;
    }

    if (table.phase === "playing") {
      leavingSeat.connected = false;
      leavingSeat.status = "stood";
      table.message = `${leavingSeat.username} se desconecto`;

      if (table.currentTurnUserId === userId) {
        await advancePvpTurn(worldId, tableId);
      }

      continue;
    }

    if (table.phase === "waiting" && leavingSeat) {
      await refundPlayerTableSeat(leavingSeat, worldId, table.buyIn, table.currency, table.id);
    }

    const nextSeats = table.seats.filter((seat) => seat.userId !== userId);

    if (nextSeats.length === 0) {
      clearPlayerTableTimers(table);
      tables.delete(tableId);
      continue;
    }

    table.seats = nextSeats;
    table.hostId = nextSeats[0].userId;

    if (table.phase === "settled") {
      clearPvpRematchState(table);
      table.message = "El anfitrion puede pedir revancha";
    }

    if (table.phase === "waiting" && table.seats.length < 2 && table.startTimer) {
      clearTimeout(table.startTimer);
      table.startTimer = null;
      table.startEndsAt = null;
      table.message = "Esperando jugadores";
    }
  }

  if (tables.size === 0) {
    playerOnlyTables.delete(worldId);
  }

  emitPlayerTables(worldId);
}

async function leaveCurrentWorld(socket) {
  const previousWorldId = socket.data.worldId;

  if (!previousWorldId) {
    return;
  }

  socket.leave(roomName(previousWorldId));
  socket.data.worldId = null;
  const fullyLeft = removePresenceSocket(socket, previousWorldId);

  if (fullyLeft) {
    await handlePlayerLeftWorld(socket.user.id, previousWorldId);
    await handlePlayerLeftPlayerTables(socket.user.id, previousWorldId);
  }

  await emitWorldPresence(previousWorldId);
}

function normalizeAdminQuery(value) {
  return String(value || "").trim().toLowerCase().slice(0, 80);
}

function parseAdminDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function parseAdminMetadata(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

async function countAdmins() {
  const rows = await all(
    `SELECT u.id, u.username, GROUP_CONCAT(ur.role_key) AS roleKeys
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     GROUP BY u.id`
  );
  return rows.filter((row) => {
    const persistedRoles = String(row.roleKeys || "")
      .split(",")
      .map(normalizeRoleKey)
      .filter(Boolean);
    return resolveEffectiveRoles(persistedRoles, row.username).includes("admin");
  }).length;
}

async function listAdminUsers(query = "") {
  const normalizedQuery = normalizeAdminQuery(query);
  const like = `%${normalizedQuery}%`;
  const rows = await all(
    `SELECT
       u.id,
       u.username,
       u.active,
       u.created_at AS createdAt,
       u.updated_at AS updatedAt,
       u.last_login_at AS lastLoginAt,
       COALESCE(GROUP_CONCAT(DISTINCT ur.role_key), 'user') AS roleKeys,
       COALESCE(e.normalBalance, 0) AS normalBalance,
       COALESCE(e.worldCount, 0) AS worldCount,
       COALESCE(a.balance_units, 0) AS eyconBalanceUnits
     FROM users u
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN (
       SELECT user_id, SUM(balance) AS normalBalance, COUNT(*) AS worldCount
       FROM economies
       GROUP BY user_id
     ) e ON e.user_id = u.id
     LEFT JOIN eycon_accounts a ON a.user_id = u.id
     WHERE ? = ''
        OR LOWER(u.username) LIKE ?
        OR CAST(u.id AS TEXT) = ?
     GROUP BY u.id
     ORDER BY u.id ASC`,
    [normalizedQuery, like, normalizedQuery]
  );

  return rows.map((row) => {
    const persistedRoles = String(row.roleKeys || "user")
      .split(",")
      .map(normalizeRoleKey)
      .filter(Boolean);
    const roles = resolveEffectiveRoles(persistedRoles, row.username);
    return {
      id: row.id,
      username: row.username,
      active: Boolean(row.active),
      roles: roles.length ? roles : ["user"],
      isAdmin: roles.includes("admin"),
      isVip: roles.includes("vip"),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lastLoginAt: row.lastLoginAt,
      normalBalance: Number(row.normalBalance || 0),
      worldCount: Number(row.worldCount || 0),
      eyconBalanceUnits: Number(row.eyconBalanceUnits || 0),
      eyconBalance: Number(row.eyconBalanceUnits || 0) / eyconService.EYCON_SCALE
    };
  });
}

async function listAdminCurrencyState(query = "") {
  const users = await listAdminUsers(query);
  const worlds = await all(
    `SELECT
       id,
       name,
       created_by AS createdBy,
       kind,
       room_code AS roomCode,
       visibility,
       created_at AS createdAt,
       updated_at AS updatedAt
     FROM worlds
     ORDER BY kind ASC, id ASC`
  );
  const economies = await all(
    `SELECT e.user_id AS userId, e.world_id AS worldId, e.balance, w.name AS worldName
     FROM economies e
     JOIN worlds w ON w.id = e.world_id
     ORDER BY e.world_id ASC, e.balance DESC`
  );
  return { users, worlds, economies };
}

async function listCurrencyMovements({ limit = 120 } = {}) {
  return all(
    `SELECT
       cm.id,
       cm.user_id AS userId,
       u.username AS username,
       cm.world_id AS worldId,
       w.name AS worldName,
       cm.currency,
       cm.amount,
       cm.balance_before AS balanceBefore,
       cm.balance_after AS balanceAfter,
       cm.reason,
       cm.admin_user_id AS adminUserId,
       au.username AS adminUsername,
       cm.created_at AS createdAt
     FROM currency_movements cm
     JOIN users u ON u.id = cm.user_id
     LEFT JOIN worlds w ON w.id = cm.world_id
     LEFT JOIN users au ON au.id = cm.admin_user_id
     ORDER BY cm.created_at DESC
     LIMIT ?`,
    [Math.max(1, Math.min(300, Number(limit) || 120))]
  );
}

async function writeCurrencyMovement({
  userId,
  worldId = null,
  currency,
  amount,
  balanceBefore,
  balanceAfter,
  reason,
  adminUserId
}) {
  await run(
    `INSERT INTO currency_movements (
      id, user_id, world_id, currency, amount, balance_before,
      balance_after, reason, admin_user_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      crypto.randomUUID(),
      userId,
      worldId,
      currency,
      amount,
      balanceBefore,
      balanceAfter,
      reason,
      adminUserId
    ]
  );
}

async function adjustAdminCurrency({ adminId, userId, currency, worldId, mode, amount, reason }) {
  const safeUserId = Number(userId);
  const safeCurrency = String(currency || "").toUpperCase();
  const safeMode = String(mode || "DELTA").toUpperCase();
  const safeAmount = Number(amount);
  const safeReason = cleanAdminReason(reason);

  if (!Number.isInteger(safeUserId)) {
    throw Object.assign(new Error("Usuario requerido"), { status: 400 });
  }
  if (!["NORMAL", "EYCON"].includes(safeCurrency)) {
    throw Object.assign(new Error("Moneda invalida"), { status: 400 });
  }
  if (!["SET", "DELTA"].includes(safeMode)) {
    throw Object.assign(new Error("Modo de ajuste invalido"), { status: 400 });
  }
  if (!Number.isInteger(safeAmount)) {
    throw Object.assign(new Error("Cantidad invalida"), { status: 400 });
  }
  if (!safeReason) {
    throw Object.assign(new Error("El motivo es obligatorio para auditar el cambio"), { status: 400 });
  }

  const targetUser = await get("SELECT id, username FROM users WHERE id = ?", [safeUserId]);
  if (!targetUser) {
    throw Object.assign(new Error("Usuario no encontrado"), { status: 404 });
  }

  if (safeCurrency === "EYCON") {
    const account = await eyconService.ensureAccount(safeUserId);
    const balanceBefore = Number(account.balanceUnits || 0);
    const delta = safeMode === "SET" ? safeAmount - balanceBefore : safeAmount;
    if (delta === 0) {
      throw Object.assign(new Error("El ajuste no cambia el saldo"), { status: 400 });
    }
    await eyconService.adminAdjust({
      adminId,
      userId: safeUserId,
      amountUnits: delta,
      description: safeReason,
      requestId: crypto.randomUUID()
    });
    const nextAccount = await eyconService.ensureAccount(safeUserId);
    const balanceAfter = Number(nextAccount.balanceUnits || 0);
    await writeCurrencyMovement({
      userId: safeUserId,
      currency: "EYCON",
      amount: delta,
      balanceBefore,
      balanceAfter,
      reason: safeReason,
      adminUserId: adminId
    });
    await writeAdminLog({
      adminUserId: adminId,
      action: "CURRENCY_ADJUST",
      targetType: "currency",
      targetId: `EYCON:${safeUserId}`,
      targetUserId: safeUserId,
      reason: safeReason,
      metadata: { currency: "EYCON", mode: safeMode, amount: delta, balanceBefore, balanceAfter }
    });
    return { currency: "EYCON", userId: safeUserId, amount: delta, balanceBefore, balanceAfter };
  }

  const safeWorldId = Number(worldId);
  if (!Number.isInteger(safeWorldId)) {
    throw Object.assign(new Error("Mundo requerido para monedas normales"), { status: 400 });
  }
  const world = await get("SELECT id FROM worlds WHERE id = ?", [safeWorldId]);
  if (!world) {
    throw Object.assign(new Error("Mundo no encontrado"), { status: 404 });
  }

  await run(
    "INSERT OR IGNORE INTO economies (user_id, world_id, balance) VALUES (?, ?, ?)",
    [safeUserId, safeWorldId, STARTING_BALANCE]
  );

  await run("BEGIN IMMEDIATE");
  try {
    const economy = await getEconomyOrFail(safeUserId, safeWorldId);
    const balanceBefore = Number(economy.balance || 0);
    const balanceAfter = safeMode === "SET" ? safeAmount : balanceBefore + safeAmount;
    if (balanceAfter < 0) {
      throw Object.assign(new Error("El saldo no puede quedar negativo"), { status: 400 });
    }
    const delta = balanceAfter - balanceBefore;
    if (delta === 0) {
      throw Object.assign(new Error("El ajuste no cambia el saldo"), { status: 400 });
    }
    await run(
      `UPDATE economies SET balance = ? WHERE user_id = ? AND world_id = ?`,
      [balanceAfter, safeUserId, safeWorldId]
    );
    await writeCurrencyMovement({
      userId: safeUserId,
      worldId: safeWorldId,
      currency: "NORMAL",
      amount: delta,
      balanceBefore,
      balanceAfter,
      reason: safeReason,
      adminUserId: adminId
    });
    await run("COMMIT");
    await broadcastEconomyChange(safeUserId, safeWorldId, balanceAfter);
    await writeAdminLog({
      adminUserId: adminId,
      action: "CURRENCY_ADJUST",
      targetType: "currency",
      targetId: `NORMAL:${safeWorldId}:${safeUserId}`,
      targetUserId: safeUserId,
      reason: safeReason,
      metadata: { currency: "NORMAL", worldId: safeWorldId, mode: safeMode, amount: delta, balanceBefore, balanceAfter }
    });
    return { currency: "NORMAL", userId: safeUserId, worldId: safeWorldId, amount: delta, balanceBefore, balanceAfter };
  } catch (error) {
    await run("ROLLBACK").catch(() => {});
    throw error;
  }
}

async function listAdminLogs({ limit = 160 } = {}) {
  const rows = await all(
    `SELECT
       l.id,
       l.admin_user_id AS adminUserId,
       au.username AS adminUsername,
       l.action,
       l.target_type AS targetType,
       l.target_id AS targetId,
       l.target_user_id AS targetUserId,
       tu.username AS targetUsername,
       l.reason,
       l.metadata_json AS metadataJson,
       l.created_at AS createdAt
     FROM admin_logs l
     LEFT JOIN users au ON au.id = l.admin_user_id
     LEFT JOIN users tu ON tu.id = l.target_user_id
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [Math.max(1, Math.min(300, Number(limit) || 160))]
  );
  return rows.map((row) => ({ ...row, metadata: parseAdminMetadata(row.metadataJson) }));
}

function connectedUsersSnapshot() {
  const connected = new Map();
  for (const [worldId, players] of worldPresence.entries()) {
    for (const player of players.values()) {
      connected.set(player.userId, {
        userId: player.userId,
        username: player.username,
        worldId,
        socketCount: player.sockets?.size || 0
      });
    }
  }
  return [...connected.values()];
}

async function getAdminStats() {
  const [
    userCounts,
    loginCounts,
    visitCount,
    visitsByDay,
    recentVisits,
    recentLogins
  ] = await Promise.all([
    get(
      `SELECT
         COUNT(*) AS totalUsers,
         SUM(CASE WHEN active = 1 THEN 1 ELSE 0 END) AS activeUsers,
         SUM(CASE WHEN active = 0 THEN 1 ELSE 0 END) AS disabledUsers,
         SUM(CASE WHEN last_login_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) AS recentlyActiveUsers
       FROM users`
    ),
    get(
      `SELECT
         SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) AS successfulLogins,
         SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) AS failedLogins
       FROM login_logs`
    ),
    get(`SELECT COUNT(*) AS totalVisits FROM site_visits`),
    all(
      `SELECT date(created_at) AS day, COUNT(*) AS visits
       FROM site_visits
       GROUP BY date(created_at)
       ORDER BY day DESC
       LIMIT 14`
    ),
    all(
      `SELECT v.user_id AS userId, u.username, v.path, v.method, v.ip, v.user_agent AS userAgent, v.created_at AS createdAt
       FROM site_visits v
       LEFT JOIN users u ON u.id = v.user_id
       ORDER BY v.created_at DESC
       LIMIT 40`
    ),
    all(
      `SELECT user_id AS userId, username, success, ip, user_agent AS userAgent, reason, created_at AS createdAt
       FROM login_logs
       ORDER BY created_at DESC
       LIMIT 40`
    )
  ]);

  const connectedUsers = connectedUsersSnapshot();
  return {
    ...userCounts,
    ...loginCounts,
    totalVisits: Number(visitCount?.totalVisits || 0),
    connectedUsers,
    connectedUserCount: connectedUsers.length,
    visitsByDay,
    recentVisits,
    recentLogins
  };
}

async function listChatMessages({ query = "", userId = null, worldId = null, from = "", to = "" } = {}) {
  const params = [];
  const clauses = ["m.hidden = 0"];
  const normalizedQuery = String(query || "").trim().slice(0, 80);
  if (normalizedQuery) {
    clauses.push("(LOWER(m.text) LIKE ? OR LOWER(m.username) LIKE ?)");
    params.push(`%${normalizedQuery.toLowerCase()}%`, `%${normalizedQuery.toLowerCase()}%`);
  }
  if (Number.isInteger(Number(userId))) {
    clauses.push("m.user_id = ?");
    params.push(Number(userId));
  }
  if (Number.isInteger(Number(worldId))) {
    clauses.push("m.world_id = ?");
    params.push(Number(worldId));
  }
  const safeFrom = parseAdminDate(from);
  const safeTo = parseAdminDate(to);
  if (safeFrom) {
    clauses.push("date(m.created_at) >= date(?)");
    params.push(safeFrom);
  }
  if (safeTo) {
    clauses.push("date(m.created_at) <= date(?)");
    params.push(safeTo);
  }
  params.push(160);
  return all(
    `SELECT
       m.id,
       m.world_id AS worldId,
       w.name AS worldName,
       m.user_id AS userId,
       m.username,
       m.text,
       m.created_at AS createdAt
     FROM chat_messages m
     LEFT JOIN worlds w ON w.id = m.world_id
     WHERE ${clauses.join(" AND ")}
     ORDER BY m.created_at DESC
     LIMIT ?`,
    params
  );
}

async function getAdminStoreAnalysis() {
  const [overview, model3d] = await Promise.all([
    eyconService.adminOverview(),
    eyconService.adminModel3dOverview()
  ]);
  const products = overview.products || [];
  const monopolyTokens = products.filter((product) => product.gameKey === "MONOPOLY" && product.slotKey === "TOKEN");
  const glbTokens = monopolyTokens.filter((product) => product.metadata?.renderer === "gltf");
  return {
    products,
    model3d,
    summary: {
      productCount: products.length,
      monopolyTokenCount: monopolyTokens.length,
      glbTokenCount: glbTokens.length,
      activeProductCount: products.filter((product) => product.active).length,
      model3dSettingCount: model3d.settings.length,
      allowedAssetCount: model3d.allowedAssets.length
    },
    modelArchitecture: {
      currentState: [
        "Los productos EyCon viven en eycon_products con metadata_json.",
        "Los assets GLB aprobados viven en model_3d_assets; los uploads se sirven desde /uploads/models3d.",
        "Los ajustes por producto viven en model_3d_settings y se mezclan en la metadata publica.",
        "El seed versionable vive en backend/model-3d-seed.json; con MODEL_3D_WRITE_SEED=1 se actualiza al guardar desde admin local.",
        "Escala, offset, rotacion y modo de color se leen desde base de datos cuando el ajuste esta activo.",
        "TINTE y FORZAR usan el color activo del jugador; no guardan un color propio."
      ],
      recommendation: [
        "Sube un .glb en Cargar GLB nuevo para agregarlo a model_3d_assets.",
        "Elige un producto BolowPoly TOKEN y asignale un asset aprobado.",
        "Usa Tinte 75% como base y ajusta escala, rotacion u offset con la vista previa.",
        "Guarda con motivo; en localhost activa MODEL_3D_WRITE_SEED=1 para llevar cambios por Git."
      ]
    }
  };
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);

    if (usernameError || passwordError) {
      return res.status(400).json({ error: usernameError || passwordError });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO users (username, password_hash, active, created_at, updated_at) VALUES (?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
      [username, passwordHash]
    );
    await grantRole(result.id, "user", { source: "register" });

    const effectiveRoles = resolveEffectiveRoles(["user"], username);
    const user = {
      id: result.id,
      username,
      active: true,
      roles: effectiveRoles,
      isAdmin: effectiveRoles.includes("admin"),
      isVip: effectiveRoles.includes("vip")
    };
    return res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    if (error && error.code === "SQLITE_CONSTRAINT") {
      return res.status(409).json({ error: "Ese usuario ya existe" });
    }

    console.error(error);
    return res.status(500).json({ error: "No se pudo registrar el usuario" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || "");
    const usernameError = validateUsername(username);

    if (usernameError || !password) {
      await recordLoginAttempt(req, { username, success: false, reason: usernameError || "password_required" });
      return res.status(400).json({ error: usernameError || "La contrasena es requerida" });
    }

    const user = await get("SELECT id, username, password_hash, active FROM users WHERE username = ?", [
      username
    ]);

    if (!user) {
      await recordLoginAttempt(req, { username, success: false, reason: "user_not_found" });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    if (user.active === 0) {
      await recordLoginAttempt(req, { userId: user.id, username, success: false, reason: "inactive_user" });
      return res.status(403).json({ error: "Usuario desactivado" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      await recordLoginAttempt(req, { userId: user.id, username, success: false, reason: "bad_password" });
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    await run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
    await recordLoginAttempt(req, { userId: user.id, username, success: true, reason: "ok" });
    const authUser = await loadAuthUser(user.id);
    return res.json({
      user: authUser,
      token: signToken(authUser)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo iniciar sesion" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  return res.json({ user: req.user });
});

app.get("/api/worlds", authRequired, async (req, res) => {
  try {
    const mainWorld = await ensureMainWorld(req.user.id);
    const mainWorldWithBalance = withWorldPresence(await loadWorldForUser(mainWorld.id, req.user.id));
    const query = normalizeWorldSearch(req.query.q);
    const normalizedCode = normalizeRoomCode(query);

    const myPrivateWorlds = (await all(
      `
        SELECT
          worlds.id,
          worlds.name,
          worlds.created_by AS createdBy,
          worlds.kind,
          worlds.room_code AS roomCode,
          worlds.visibility,
          worlds.created_at AS createdAt,
          worlds.updated_at AS updatedAt,
          economies.balance AS balance
        FROM worlds
        LEFT JOIN economies
          ON economies.world_id = worlds.id
          AND economies.user_id = ?
        WHERE worlds.kind = ?
          AND worlds.created_by = ?
        ORDER BY worlds.updated_at DESC, worlds.id DESC
        LIMIT 12
      `,
      [req.user.id, WORLD_KIND_PRIVATE, req.user.id]
    )).map(publicWorld).map(withWorldPresence);

    let privateWorlds = [];
    if (query.length >= 2) {
      privateWorlds = (await all(
        `
          SELECT
            worlds.id,
            worlds.name,
            worlds.created_by AS createdBy,
            worlds.kind,
            worlds.room_code AS roomCode,
            worlds.visibility,
            worlds.created_at AS createdAt,
            worlds.updated_at AS updatedAt,
            economies.balance AS balance
          FROM worlds
          LEFT JOIN economies
            ON economies.world_id = worlds.id
            AND economies.user_id = ?
          WHERE worlds.kind = ?
            AND (
              worlds.room_code = ?
              OR worlds.room_code LIKE ?
              OR LOWER(worlds.name) LIKE LOWER(?)
            )
          ORDER BY
            CASE WHEN worlds.room_code = ? THEN 0 ELSE 1 END,
            worlds.updated_at DESC,
            worlds.id DESC
          LIMIT 12
        `,
        [
          req.user.id,
          WORLD_KIND_PRIVATE,
          normalizedCode,
          `${normalizedCode}%`,
          `%${query}%`,
          normalizedCode
        ]
      )).map(publicWorld).map(withWorldPresence);
    }

    const activeWorldIds = [...worldPresence.entries()]
      .filter(([, players]) => players && players.size > 0)
      .map(([worldId]) => Number(worldId))
      .filter((worldId) => Number.isInteger(worldId));
    let activeWorlds = [];

    if (activeWorldIds.length > 0) {
      const placeholders = activeWorldIds.map(() => "?").join(",");
      activeWorlds = (await all(
        `
          SELECT
            worlds.id,
            worlds.name,
            worlds.created_by AS createdBy,
            worlds.kind,
            worlds.room_code AS roomCode,
            worlds.visibility,
            worlds.created_at AS createdAt,
            worlds.updated_at AS updatedAt,
            economies.balance AS balance
          FROM worlds
          LEFT JOIN economies
            ON economies.world_id = worlds.id
            AND economies.user_id = ?
          WHERE worlds.id IN (${placeholders})
          ORDER BY worlds.updated_at DESC, worlds.id DESC
        `,
        [req.user.id, ...activeWorldIds]
      ))
        .map(publicWorld)
        .map(withWorldPresence)
        .filter((world) => world && world.playerCount > 0)
        .sort(sortActiveWorlds);
    }

    const worldsById = new Map();
    for (const world of [mainWorldWithBalance, ...myPrivateWorlds, ...privateWorlds, ...activeWorlds]) {
      if (world) worldsById.set(world.id, world);
    }

    return res.json({
      mainWorld: mainWorldWithBalance,
      activeWorlds,
      myPrivateWorlds,
      privateWorlds,
      worlds: [...worldsById.values()]
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudieron listar los mundos" });
  }
});

app.post("/api/worlds/create", authRequired, async (req, res) => {
  try {
    const name = normalizeWorldName(req.body.name);

    if (name.length < 3) {
      return res.status(400).json({ error: "El nombre de la sala es muy corto" });
    }

    await ensureMainWorld(req.user.id);
    const account = await eyconService.ensureAccount(req.user.id);
    if (Number(account.balanceUnits || 0) < PRIVATE_ROOM_CREATE_COST_UNITS) {
      return res.status(400).json({ error: "Necesitas 1.00 EyCon para crear una sala privada" });
    }

    const roomCode = await generatePrivateRoomCode();
    const result = await run(
      `INSERT INTO worlds (name, created_by, kind, room_code, visibility, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'PRIVATE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [name, req.user.id, WORLD_KIND_PRIVATE, roomCode]
    );

    await run(
      "INSERT INTO economies (user_id, world_id, balance) VALUES (?, ?, ?)",
      [req.user.id, result.id, STARTING_BALANCE]
    );

    let eyconMovement;
    try {
      eyconMovement = await eyconService.spend({
        userId: req.user.id,
        amountUnits: PRIVATE_ROOM_CREATE_COST_UNITS,
        movementType: "PRIVATE_ROOM_CREATE",
        referenceId: String(result.id),
        description: `Creacion de sala privada ${name}`,
        idempotencyKey: `private-room-create:${result.id}`
      });
    } catch (error) {
      await run("DELETE FROM worlds WHERE id = ? AND created_by = ?", [result.id, req.user.id]).catch(() => {});
      throw error;
    }

    const existingAdmin = await get("SELECT 1 AS ok FROM user_roles WHERE role_key = 'admin' LIMIT 1");
    if (!existingAdmin) {
      await grantRole(req.user.id, "admin", { source: "first-world-bootstrap" });
      await writeAdminLog({
        adminUserId: req.user.id,
        action: "ROLE_BOOTSTRAP",
        targetType: "user",
        targetId: String(req.user.id),
        targetUserId: req.user.id,
        reason: "Primer mundo creado sin administrador existente",
        metadata: { source: "first-world-bootstrap", worldId: result.id }
      });
    }

    const world = await loadWorldForUser(result.id, req.user.id);
    return res.status(201).json({
      world,
      balance: STARTING_BALANCE,
      eyconBalanceUnits: eyconMovement.balanceUnits,
      eyconBalance: eyconMovement.balanceUnits / eyconService.EYCON_SCALE
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo crear la sala privada" });
  }
});

app.post("/api/worlds/join", authRequired, async (req, res) => {
  try {
    await ensureMainWorld(req.user.id);
    let worldId = Number(req.body.worldId);
    const roomCode = normalizeRoomCode(req.body.roomCode);

    if (!Number.isInteger(worldId) && roomCode) {
      const target = await get("SELECT id FROM worlds WHERE room_code = ?", [roomCode]);
      if (target) {
        worldId = Number(target.id);
      } else {
        const error = new Error("Sala privada no encontrada");
        error.status = 404;
        throw error;
      }
    }

    const { world, economy } = await ensureWorldMembership(req.user.id, worldId);
    const eycon = await eyconService.ensureAccount(req.user.id);
    return res.json({
      world,
      balance: economy.balance,
      eyconBalanceUnits: eycon.balanceUnits,
      eyconBalance: eycon.balanceUnits / eyconService.EYCON_SCALE
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo cargar el mundo"
    });
  }
});

app.get("/api/eycon/profile", authRequired, async (req, res) => {
  try {
    return res.json(await eyconService.getProfile(req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar EyCon" });
  }
});

app.get("/api/eycon/health", (req, res) => {
  return res.json({
    ok: true,
    apiVersion: "eycon-v1",
    capabilities: {
      globalStore: true,
      gameCatalogs: true
    }
  });
});

app.get("/api/payments/packages", (req, res) => {
  return res.json({ packages: paymentsService.listPackages() });
});

app.post("/api/payments/checkout", authRequired, async (req, res) => {
  try {
    const packageId = String(req.body.packageId || "");
    const result = await paymentsService.createCheckout({ userId: req.user.id, packageId });
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo iniciar la compra"
    });
  }
});

app.post("/api/payments/return-sync", authRequired, async (req, res) => {
  try {
    const paymentIntentId = req.body.paymentIntentId ? String(req.body.paymentIntentId) : null;
    const paymentId = req.body.paymentId || req.body.collectionId || null;
    const externalReference = req.body.externalReference ? String(req.body.externalReference) : null;
    const paymentIntent = await paymentsService.returnSync({
      userId: req.user.id,
      paymentIntentId,
      paymentId,
      externalReference
    });
    const eycon = await eyconService.ensureAccount(req.user.id);
    return res.json({
      paymentIntent,
      eyconBalanceUnits: eycon.balanceUnits,
      isVip: (await getUserRoles(req.user.id)).includes("vip")
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo sincronizar el pago"
    });
  }
});

app.get("/api/payments/history", authRequired, async (req, res) => {
  try {
    return res.json({ payments: await paymentsService.listUserHistory(req.user.id) });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: "No se pudo cargar el historial de pagos" });
  }
});

app.post("/api/payments/webhook", async (req, res) => {
  try {
    const result = await paymentsService.handleWebhook({ query: req.query, payload: req.body || {} });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error procesando webhook de Mercado Pago", error);
    return res.status(200).json({ processed: false });
  }
});

app.get("/api/payments/webhook", async (req, res) => {
  try {
    const result = await paymentsService.handleWebhook({ query: req.query, payload: {} });
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error procesando webhook de Mercado Pago", error);
    return res.status(200).json({ processed: false });
  }
});

app.get("/api/eycon/games", authRequired, async (req, res) => {
  try {
    return res.json(await eyconService.listGames(req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron cargar los minijuegos" });
  }
});

app.get("/api/eycon/catalog", authRequired, async (req, res) => {
  try {
    const gameKey = String(req.query.gameKey || "MONOPOLY").toUpperCase();
    return res.json(await eyconService.listCatalog({ userId: req.user.id, gameKey }));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar la tienda" });
  }
});

app.get("/api/eycon/history", authRequired, async (req, res) => {
  try {
    const movements = await eyconService.history(req.user.id, req.query.limit);
    return res.json({ movements });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar el historial EyCon" });
  }
});

app.get("/api/progression/overview", authRequired, async (req, res) => {
  try {
    return res.json(await progressionService.getOverview(req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar el progreso" });
  }
});

app.post("/api/progression/battlepass/claim", authRequired, async (req, res) => {
  try {
    return res.json(await progressionService.claimBattlePass(req.user.id));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo reclamar el pase de batalla" });
  }
});

app.post("/api/progression/missions/:key/claim", authRequired, async (req, res) => {
  try {
    return res.json(await progressionService.claimMission(req.user.id, req.params.key));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.status ? error.message : "No se pudo reclamar la mision" });
  }
});

app.post("/api/eycon/purchase", authRequired, async (req, res) => {
  try {
    const productId = String(req.body?.productId || "");
    if (!productId) return res.status(400).json({ error: "Producto requerido" });
    return res.json(await eyconService.purchase({ userId: req.user.id, productId }));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo completar la compra" });
  }
});

app.post("/api/eycon/equip", authRequired, async (req, res) => {
  try {
    const productId = String(req.body?.productId || "");
    if (!productId) return res.status(400).json({ error: "Producto requerido" });
    const profile = await eyconService.equip({ userId: req.user.id, productId });
    await monopolyService.refreshUserPresentation(req.user.id);
    return res.json(profile);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo equipar el producto" });
  }
});

app.post("/api/eycon/unequip", authRequired, async (req, res) => {
  try {
    const gameKey = String(req.body?.gameKey || "").toUpperCase();
    const slotKey = String(req.body?.slotKey || "").toUpperCase();
    const profile = await eyconService.unequip({
      userId: req.user.id,
      gameKey,
      slotKey
    });
    await monopolyService.refreshUserPresentation(req.user.id);
    return res.json(profile);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo desequipar el personalizable" });
  }
});

app.get("/api/admin/overview", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const [users, currencies, movements, logs, stats, store] = await Promise.all([
      listAdminUsers(req.query.q),
      listAdminCurrencyState(req.query.q),
      listCurrencyMovements({ limit: 80 }),
      listAdminLogs({ limit: 80 }),
      getAdminStats(),
      getAdminStoreAnalysis()
    ]);
    return res.json({
      admin: req.user,
      roles: ["user", "admin"],
      users,
      currencies,
      movements,
      logs,
      stats,
      store
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar administracion" });
  }
});

app.get("/api/admin/users", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({ users: await listAdminUsers(req.query.q) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron cargar usuarios" });
  }
});

app.patch("/api/admin/users/:userId", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const targetUserId = Number(req.params.userId);
    const reason = cleanAdminReason(req.body?.reason);
    if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: "Usuario invalido" });
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });

    const target = await get("SELECT id, username, active FROM users WHERE id = ?", [targetUserId]);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

    const updates = [];
    const params = [];
    const metadata = { before: { username: target.username, active: Boolean(target.active) } };

    if (req.body?.username !== undefined) {
      const nextUsername = normalizeUsername(req.body.username);
      const usernameError = validateUsername(nextUsername);
      if (usernameError) return res.status(400).json({ error: usernameError });
      updates.push("username = ?");
      params.push(nextUsername);
      metadata.afterUsername = nextUsername;
    }

    if (req.body?.active !== undefined) {
      const nextActive = req.body.active ? 1 : 0;
      if (nextActive === 0) {
        const roles = await getUserRoles(targetUserId);
        if (roles.includes("admin") && (await countAdmins()) <= 1) {
          return res.status(400).json({ error: "No puedes desactivar al ultimo administrador" });
        }
        if (Number(targetUserId) === Number(req.user.id)) {
          return res.status(400).json({ error: "No puedes desactivar tu propia cuenta desde esta sesion" });
        }
      }
      updates.push("active = ?");
      params.push(nextActive);
      metadata.afterActive = Boolean(nextActive);
    }

    if (!updates.length) return res.status(400).json({ error: "No hay cambios para guardar" });
    updates.push("updated_at = CURRENT_TIMESTAMP");
    params.push(targetUserId);
    await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "USER_UPDATE",
      targetType: "user",
      targetId: String(targetUserId),
      targetUserId,
      reason,
      metadata
    });
    return res.json({ users: await listAdminUsers() });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo actualizar usuario" });
  }
});

app.post("/api/admin/users/:userId/password", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const targetUserId = Number(req.params.userId);
    const password = String(req.body?.password || "");
    const reason = cleanAdminReason(req.body?.reason);
    if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: "Usuario invalido" });
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const target = await get("SELECT id FROM users WHERE id = ?", [targetUserId]);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
    const passwordHash = await bcrypt.hash(password, 10);
    await run(
      "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [passwordHash, targetUserId]
    );
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "USER_PASSWORD_CHANGE",
      targetType: "user",
      targetId: String(targetUserId),
      targetUserId,
      reason
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cambiar contrasena" });
  }
});

app.put("/api/admin/users/:userId/roles", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const targetUserId = Number(req.params.userId);
    const reason = cleanAdminReason(req.body?.reason);
    const requestedRoles = Array.isArray(req.body?.roles) ? req.body.roles.map(normalizeRoleKey) : [];
    const roles = [...new Set(["user", ...requestedRoles])].filter((role) => ROLE_KEYS.has(role));
    if (!Number.isInteger(targetUserId)) return res.status(400).json({ error: "Usuario invalido" });
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });
    if (roles.length === 0 || requestedRoles.some((role) => !ROLE_KEYS.has(role))) {
      return res.status(400).json({ error: "Roles invalidos" });
    }
    const target = await get("SELECT id FROM users WHERE id = ?", [targetUserId]);
    if (!target) return res.status(404).json({ error: "Usuario no encontrado" });

    const currentRoles = await getUserRoles(targetUserId);
    if (currentRoles.includes("admin") && !roles.includes("admin") && (await countAdmins()) <= 1) {
      return res.status(400).json({ error: "No puedes quitar al ultimo administrador" });
    }
    if (Number(targetUserId) === Number(req.user.id) && currentRoles.includes("admin") && !roles.includes("admin")) {
      return res.status(400).json({ error: "No puedes quitarte tu propio rol admin desde esta sesion" });
    }

    await run("BEGIN IMMEDIATE");
    try {
      await run("DELETE FROM user_roles WHERE user_id = ?", [targetUserId]);
      for (const role of roles) {
        await run(
          `INSERT INTO user_roles (user_id, role_key, granted_by, source)
           VALUES (?, ?, ?, 'admin-panel')`,
          [targetUserId, role, req.user.id]
        );
      }
      await run("UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [targetUserId]);
      await run("COMMIT");
    } catch (error) {
      await run("ROLLBACK").catch(() => {});
      throw error;
    }
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "USER_ROLES_UPDATE",
      targetType: "user",
      targetId: String(targetUserId),
      targetUserId,
      reason,
      metadata: { before: currentRoles, after: roles }
    });
    return res.json({ users: await listAdminUsers() });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron actualizar roles" });
  }
});

app.get("/api/admin/currencies", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({
      ...(await listAdminCurrencyState(req.query.q)),
      movements: await listCurrencyMovements({ limit: req.query.limit })
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron cargar monedas" });
  }
});

app.post("/api/admin/currencies/adjust", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const adjustment = await adjustAdminCurrency({
      adminId: req.user.id,
      userId: req.body?.userId,
      currency: req.body?.currency,
      worldId: req.body?.worldId,
      mode: req.body?.mode,
      amount: req.body?.amount,
      reason: req.body?.reason
    });
    return res.json({
      adjustment,
      currencies: await listAdminCurrencyState(),
      movements: await listCurrencyMovements({ limit: 80 })
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo ajustar moneda" });
  }
});

app.get("/api/admin/logs", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({ logs: await listAdminLogs({ limit: req.query.limit }) });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron cargar logs" });
  }
});

app.get("/api/admin/stats", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({ stats: await getAdminStats() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudieron cargar estadisticas" });
  }
});

app.get("/api/admin/chat", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({
      messages: await listChatMessages({
        query: req.query.q,
        userId: req.query.userId,
        worldId: req.query.worldId,
        from: req.query.from,
        to: req.query.to
      })
    });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar chat" });
  }
});

app.get("/api/admin/store-analysis", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({ store: await getAdminStoreAnalysis() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar analisis de tienda" });
  }
});

app.get("/api/admin/model-3d-settings", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json({ model3d: await eyconService.adminModel3dOverview() });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar CRUD 3D" });
  }
});

app.post("/api/admin/model-3d-assets", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const reason = cleanAdminReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });

    const originalName = String(req.body?.fileName || "modelo.glb").trim();
    if (!originalName.toLowerCase().endsWith(".glb")) {
      return res.status(400).json({ error: "Solo se permiten archivos .glb" });
    }
    const label = String(req.body?.label || originalName.replace(/\.glb$/i, "")).trim().slice(0, 80);
    const baseKey = normalizeAssetKey(req.body?.assetKey || label || originalName.replace(/\.glb$/i, ""));
    if (baseKey.length < 3) return res.status(400).json({ error: "Nombre de asset invalido" });

    const buffer = safeGlbUploadBuffer(req.body?.fileBase64);
    await fs.promises.mkdir(modelUploadsDir, { recursive: true });
    const suffix = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    const assetKey = `${baseKey}_${suffix}`.slice(0, 80);
    const storedName = `${assetKey}.glb`;
    const targetPath = path.join(modelUploadsDir, storedName);
    await fs.promises.writeFile(targetPath, buffer, { flag: "wx" });

    const result = await eyconService.adminCreateModel3dAsset({
      assetKey,
      label,
      filePath: `/uploads/models3d/${storedName}`,
      fallbackModel: req.body?.fallbackModel,
      fitSize: req.body?.fitSize,
      uploadedBy: req.user.id
    });
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "MODEL_3D_ASSET_UPLOAD",
      targetType: "model_3d_asset",
      targetId: assetKey,
      reason,
      metadata: { label, originalName, bytes: buffer.length, filePath: `/uploads/models3d/${storedName}` }
    });
    return res.status(201).json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar modelo 3D" });
  }
});

app.delete("/api/admin/model-3d-assets/:assetKey", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const reason = cleanAdminReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });

    const result = await eyconService.adminDeleteModel3dAsset({
      assetKey: req.params.assetKey
    });

    let fileDeleted = false;
    const filePath = String(result.filePath || "");
    if (filePath.startsWith("/uploads/models3d/")) {
      const targetPath = path.resolve(modelUploadsDir, path.basename(filePath));
      const uploadsRoot = path.resolve(modelUploadsDir);
      if (targetPath.startsWith(`${uploadsRoot}${path.sep}`)) {
        await fs.promises.unlink(targetPath).then(() => {
          fileDeleted = true;
        }).catch((error) => {
          if (error.code !== "ENOENT") throw error;
        });
      }
    }

    await writeAdminLog({
      adminUserId: req.user.id,
      action: "MODEL_3D_ASSET_DELETE",
      targetType: "model_3d_asset",
      targetId: result.asset.assetKey,
      reason,
      metadata: { asset: result.asset, fileDeleted }
    });
    return res.json({ ...result, fileDeleted });
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo eliminar asset 3D" });
  }
});

app.put("/api/admin/model-3d-settings/:productId", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const reason = cleanAdminReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });
    const result = await eyconService.adminUpsertModel3dSetting({
      adminId: req.user.id,
      productId: req.params.productId,
      settings: req.body?.settings || {}
    });
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "MODEL_3D_UPSERT",
      targetType: "eycon_product",
      targetId: req.params.productId,
      reason,
      metadata: { settings: req.body?.settings || {} }
    });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo guardar modelo 3D" });
  }
});

app.delete("/api/admin/model-3d-settings/:productId", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const reason = cleanAdminReason(req.body?.reason);
    if (!reason) return res.status(400).json({ error: "El motivo es obligatorio" });
    const result = await eyconService.adminDeleteModel3dSetting({
      adminId: req.user.id,
      productId: req.params.productId
    });
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "MODEL_3D_DELETE",
      targetType: "eycon_product",
      targetId: req.params.productId,
      reason
    });
    return res.json(result);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ error: error.message || "No se pudo eliminar ajuste 3D" });
  }
});

app.get("/api/admin/eycon", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    return res.json(await eyconService.adminOverview());
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo cargar administracion EyCon" });
  }
});

app.post("/api/admin/eycon/adjust", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const adjustment = await adjustAdminCurrency({
      adminId: req.user.id,
      userId: Number(req.body?.userId),
      currency: "EYCON",
      mode: "DELTA",
      amount: Number(req.body?.amountUnits),
      reason: String(req.body?.description || "")
    });
    return res.json(adjustment);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo ajustar EyCon" });
  }
});

app.put("/api/admin/eycon/products/:productId", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const productId = String(req.params.productId);
    const result = await eyconService.adminUpdateProduct({
      productId,
      slug: req.body?.slug,
      name: req.body?.name,
      description: req.body?.description,
      priceUnits: req.body?.priceUnits,
      gameKey: req.body?.gameKey,
      category: req.body?.category,
      slotKey: req.body?.slotKey,
      active: req.body?.active,
      rarity: req.body?.rarity,
      preview: req.body?.preview,
      metadata: req.body?.metadata
    });
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "STORE_PRODUCT_UPDATE",
      targetType: "eycon_product",
      targetId: productId,
      reason: String(req.body?.reason || "Actualizacion de producto EyCon").slice(0, 240),
      metadata: { patch: req.body || {}, result }
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo actualizar el producto" });
  }
});

app.post("/api/admin/eycon/products", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const result = await eyconService.adminCreateProduct(req.body || {});
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "STORE_PRODUCT_CREATE",
      targetType: "eycon_product",
      targetId: result.id,
      reason: String(req.body?.reason || "Creacion de producto EyCon").slice(0, 240),
      metadata: { product: req.body || {} }
    });
    return res.status(201).json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo crear el producto" });
  }
});

app.post("/api/admin/eycon/grant-product", authRequired, async (req, res) => {
  try {
    await requirePlatformAdmin(req.user.id);
    const userId = Number(req.body?.userId);
    const productId = String(req.body?.productId || "");
    const result = await eyconService.adminGrantProduct({
      userId,
      productId
    });
    await writeAdminLog({
      adminUserId: req.user.id,
      action: "STORE_PRODUCT_GRANT",
      targetType: "eycon_product",
      targetId: productId,
      targetUserId: userId,
      reason: String(req.body?.reason || "Asignacion administrativa de producto").slice(0, 240)
    });
    return res.json(result);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "No se pudo asignar el producto" });
  }
});

app.get("/api/monopoly/token", authRequired, async (req, res) => {
  try {
    const row = await get("SELECT monopoly_token_json AS tokenJson FROM users WHERE id = ?", [req.user.id]);
    const token = row?.tokenJson ? JSON.parse(row.tokenJson) : null;
    return res.json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo cargar tu ficha" });
  }
});

app.put("/api/monopoly/token", authRequired, async (req, res) => {
  try {
    const token = sanitizeBolowPolyToken(req.body?.token);
    const activeRows = await all(
      `SELECT config_json AS configJson
       FROM monopoly_tables
       WHERE status IN ('WAITING', 'PLAYING')`
    );
    const activeTable = activeRows.find((row) => {
      try {
        const config = JSON.parse(row.configJson || "{}");
        return (config.seatedPlayerIds || []).map(Number).includes(Number(req.user.id));
      } catch {
        return false;
      }
    });
    if (activeTable) {
      const config = JSON.parse(activeTable.configJson || "{}");
      const otherIds = (config.seatedPlayerIds || [])
        .map(Number)
        .filter((userId) => Number.isFinite(userId) && userId !== Number(req.user.id));
      if (otherIds.length) {
        const otherPlayers = await all(
          `SELECT id, monopoly_token_json AS tokenJson
           FROM users
           WHERE id IN (${otherIds.map(() => "?").join(",")})`,
          otherIds
        );
        const colorTaken = otherPlayers.some((player) => {
          const seatIndex = (config.seatedPlayerIds || []).map(Number).indexOf(Number(player.id));
          const occupiedColor = parseStoredBolowPolyToken(player.tokenJson)?.bg
            || MONOPOLY_TOKEN_COLORS[Math.max(0, seatIndex) % MONOPOLY_TOKEN_COLORS.length];
          return occupiedColor?.toLowerCase() === token.bg.toLowerCase();
        });
        if (colorTaken) {
          return res.status(409).json({ error: "Ese color ya está ocupado en tu mesa de BolowPoly" });
        }
      }
    }
    await run("UPDATE users SET monopoly_token_json = ? WHERE id = ?", [
      JSON.stringify(token),
      req.user.id
    ]);
    await monopolyService.refreshUserPresentation(req.user.id);
    return res.json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo guardar tu ficha" });
  }
});

app.delete("/api/monopoly/token", authRequired, async (req, res) => {
  try {
    await run("UPDATE users SET monopoly_token_json = NULL WHERE id = ?", [req.user.id]);
    await monopolyService.refreshUserPresentation(req.user.id);
    return res.json({ token: null });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo restablecer tu ficha" });
  }
});

app.get("/api/monopoly/tables", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.query.worldId);
    await ensureWorldMembership(req.user.id, worldId);
    const payload = await monopolyService.listTables(worldId);
    return res.json(payload);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudieron obtener las mesas de BolowPoly"
    });
  }
});

app.get("/api/monopoly/state", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.query.worldId);
    const tableId = req.query.tableId ? String(req.query.tableId) : null;
    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.getState({ worldId, tableId });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo obtener el estado de BolowPoly"
    });
  }
});

app.post("/api/monopoly/create", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const name = String(req.body.name || "Mesa BolowPoly");
    const mode = String(req.body.mode || "NORMAL");
    const timedMinutes = Number(req.body.timedMinutes || 60);
    const turnTimeSeconds = Number(req.body.turnTimeSeconds || 60);
    const maxPlayers = Number(req.body.maxPlayers || 4);
    const isPrivate = Boolean(req.body.isPrivate);
    const password = String(req.body.password || "");
    const eyconStake = Number(req.body.eyconStake || 0);

    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.createTable({
      worldId,
      actorId: req.user.id,
      name,
      mode,
      timedMinutes,
      turnTimeSeconds,
      maxPlayers,
      isPrivate,
      password,
      eyconStake
    });
    return res.status(201).json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo crear la mesa BolowPoly"
    });
  }
});

app.post("/api/monopoly/join", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");
    const password = String(req.body.password || "");
    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.joinTable({
      worldId,
      tableId,
      actorId: req.user.id,
      password
    });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo unir a la mesa BolowPoly"
    });
  }
});

app.post("/api/monopoly/start", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");

    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.startGame({
      worldId,
      tableId,
      actorId: req.user.id
    });
    return res.status(201).json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo iniciar BolowPoly"
    });
  }
});

app.post("/api/monopoly/action", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");
    const action = String(req.body.action || "");
    const payload = req.body.payload && typeof req.body.payload === "object" ? req.body.payload : {};

    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.performAction({
      worldId,
      tableId,
      actorId: req.user.id,
      actionName: action,
      payload
    });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo ejecutar la accion de BolowPoly"
    });
  }
});

app.post("/api/monopoly/leave", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");
    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.leaveTable({
      worldId,
      tableId,
      actorId: req.user.id
    });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo salir de la mesa BolowPoly"
    });
  }
});

app.post("/api/monopoly/surrender", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");
    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.surrender({
      worldId,
      tableId,
      actorId: req.user.id
    });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo rendir la partida de BolowPoly"
    });
  }
});

app.post("/api/monopoly/close", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const tableId = String(req.body.tableId || "");
    await ensureWorldMembership(req.user.id, worldId);
    const state = await monopolyService.closeTable({
      worldId,
      tableId,
      actorId: req.user.id
    });
    return res.json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo cerrar la mesa BolowPoly"
    });
  }
});

app.post("/api/game/reward-dishes", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const durationMs = Number(req.body.durationMs);
    const scrubScore = Number(req.body.scrubs ?? req.body.clicks);

    if (!Number.isInteger(worldId) || !Number.isFinite(durationMs) || !Number.isFinite(scrubScore)) {
      return res.status(400).json({ error: "Datos del minijuego invalidos" });
    }

    if (scrubScore < REQUIRED_DISH_SCRUBS || durationMs < 500) {
      return res.status(400).json({ error: "Ronda incompleta" });
    }

    await getEconomyOrFail(req.user.id, worldId);

    const cappedDuration = clamp(durationMs, 1800, 12000);
    const speedRatio = 1 - (cappedDuration - 1800) / (12000 - 1800);
    const reward = clamp(Math.round(25 + speedRatio * 125), 25, 150);

    await run(
      "UPDATE economies SET balance = balance + ? WHERE user_id = ? AND world_id = ?",
      [reward, req.user.id, worldId]
    );

    const economy = await getEconomyOrFail(req.user.id, worldId);
    await broadcastEconomyChange(req.user.id, worldId, economy.balance);
    recordPlayActivity(req.user.id, "OTHER");
    return res.json({ reward, balance: economy.balance });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo otorgar la recompensa"
    });
  }
});

app.post("/api/game/blackjack/start", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const bet = Number(req.body.bet);
    const currency = String(req.body.currency || "NORMAL").toUpperCase();
    const sessionId = crypto.randomUUID();

    if (!Number.isInteger(worldId) || !Number.isInteger(bet) || bet <= 0 || !["NORMAL", "EYCON"].includes(currency)) {
      return res.status(400).json({ error: "Apuesta invalida" });
    }

    if (currency === "NORMAL" && (bet < AI_TABLE_MIN_BET || bet > AI_TABLE_MAX_BET)) {
      return res.status(400).json({
        error: `La mesa IA acepta apuestas de $${AI_TABLE_MIN_BET} a $${AI_TABLE_MAX_BET}`
      });
    }
    if (currency === "EYCON" && (bet < 1 || bet > 100)) {
      return res.status(400).json({ error: "La mesa EyCon acepta apuestas de 0.01 a 1.00 EyCon" });
    }

    const world = await get("SELECT id FROM worlds WHERE id = ?", [worldId]);

    if (!world) {
      return res.status(404).json({ error: "Mundo no encontrado" });
    }

    if (currency === "EYCON") {
      await eyconService.placeWager({
        userId: req.user.id,
        wagerId: sessionId,
        amountUnits: bet,
        gameKey: "BLACKJACK"
      });
    } else {
      await run("BEGIN IMMEDIATE");
      try {
        const economy = await getEconomyOrFail(req.user.id, worldId);

        if (economy.balance < bet) {
          await run("ROLLBACK");
          return res.status(400).json({ error: "Saldo insuficiente" });
        }

        await run(
          "UPDATE economies SET balance = balance - ? WHERE user_id = ? AND world_id = ?",
          [bet, req.user.id, worldId]
        );

        await run("COMMIT");
      } catch (error) {
        await run("ROLLBACK");
        throw error;
      }
    }

    const deck = makeDeck();
    const session = {
      id: sessionId,
      userId: req.user.id,
      worldId,
      bet,
      currency,
      eyconBetUnits: currency === "EYCON" ? bet : 0,
      eyconPayoutUnits: 0,
      deck,
      player: [draw(deck), draw(deck)],
      dealer: [draw(deck), draw(deck)],
      status: "active",
      outcome: null,
      payout: 0,
      balance: 0
    };

    const afterBet = await getEconomyOrFail(req.user.id, worldId);
    session.balance = afterBet.balance;
    blackjackSessions.set(session.id, session);
    await broadcastEconomyChange(req.user.id, worldId, afterBet.balance);

    if (hasBlackjack(session.player) || hasBlackjack(session.dealer)) {
      let outcome = "push";

      if (hasBlackjack(session.player) && !hasBlackjack(session.dealer)) {
        outcome = "win";
      } else if (!hasBlackjack(session.player) && hasBlackjack(session.dealer)) {
        outcome = "lose";
      }

      await settleBlackjackSession(session, outcome);
    }

    return res.status(201).json(publicBlackjackState(session));
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo iniciar Blackjack"
    });
  }
});

app.post("/api/game/blackjack/hit", authRequired, async (req, res) => {
  try {
    const sessionId = String(req.body.sessionId || "");
    const session = blackjackSessions.get(sessionId);

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Ronda no encontrada" });
    }

    if (session.status !== "active") {
      return res.json(publicBlackjackState(session));
    }

    session.player.push(draw(session.deck));

    if (handValue(session.player) > 21) {
      await settleBlackjackSession(session, "lose");
    }

    return res.json(publicBlackjackState(session));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo pedir carta" });
  }
});

async function handleBlackjackResult(req, res) {
  try {
    const sessionId = String(req.body.sessionId || "");
    const session = blackjackSessions.get(sessionId);

    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ error: "Ronda no encontrada" });
    }

    if (session.status === "active") {
      await resolveDealerTurn(session);
    }

    return res.json(publicBlackjackState(session));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo resolver Blackjack" });
  }
}

app.post("/api/game/blackjack-result", authRequired, handleBlackjackResult);
app.post("/api/game/blackjack/stand", authRequired, handleBlackjackResult);

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Token requerido"));
    }

    const payload = jwt.verify(token, JWT_SECRET);
    const user = await loadAuthUser(payload.id);
    if (!user) {
      return next(new Error("Usuario inactivo o no encontrado"));
    }
    socket.user = user;
    return next();
  } catch (error) {
    return next(new Error("Token invalido"));
  }
});

io.on("connection", (socket) => {
  socket.join(userRoom(socket.user.id));

  socket.on("join_world", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const { world, economy } = await ensureWorldMembership(socket.user.id, worldId);

      if (socket.data.worldId && socket.data.worldId !== worldId) {
        await leaveCurrentWorld(socket);
      }

      socket.join(roomName(worldId));
      socket.data.worldId = worldId;
      addPresenceSocket(socket, worldId);

      const activeTable = multiplayerBlackjackTables.get(worldId);
      const activeSeat = activeTable && activeTable.players.get(socket.user.id);

      if (activeSeat) {
        activeSeat.connected = true;
      }

      const pvpTables = playerOnlyTables.get(worldId);
      let restoredPlayerTable = false;

      if (pvpTables) {
        for (const table of pvpTables.values()) {
          const seat = table.seats.find((candidate) => candidate.userId === socket.user.id);

          if (seat) {
            seat.connected = true;
            restoredPlayerTable = true;
          }
        }
      }

      const eycon = await eyconService.ensureAccount(socket.user.id);
      socket.emit("joined_world", {
        world,
        balance: economy.balance,
        eyconBalanceUnits: eycon.balanceUnits,
        eyconBalance: eycon.balanceUnits / eyconService.EYCON_SCALE
      });
      socket.emit("blackjack_state", publicMultiplayerTable(worldId));
      socket.emit("player_tables_state", publicPlayerTables(worldId));
      socket.emit("monopoly_tables_state", await monopolyService.listTables(worldId));
      emitMultiplayerTable(worldId);
      if (restoredPlayerTable) {
        emitPlayerTables(worldId);
      }
      await emitWorldPresence(worldId);

      if (typeof callback === "function") {
        callback({
          ok: true,
          world,
          balance: economy.balance,
          eyconBalanceUnits: eycon.balanceUnits,
          eyconBalance: eycon.balanceUnits / eyconService.EYCON_SCALE
        });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo unir al mundo" });
      }
    }
  });

  socket.on("leave_world", async (payload, callback) => {
    try {
      await leaveCurrentWorld(socket);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo salir del mundo" });
      }
    }
  });

  socket.on("send_message", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const text = String((payload && payload.text) || "").trim().slice(0, 240);

      if (!text) {
        throw new Error("Mensaje vacio");
      }

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const message = {
        id: crypto.randomUUID(),
        worldId,
        userId: socket.user.id,
        username: socket.user.username,
        text,
        createdAt: new Date().toISOString()
      };

      await run(
        `INSERT INTO chat_messages (id, world_id, user_id, username, text, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [message.id, message.worldId, message.userId, message.username, message.text, message.createdAt]
      );

      io.to(roomName(worldId)).emit("chat_message", message);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo enviar el mensaje" });
      }
    }
  });

  socket.on("request_blackjack_state", (payload) => {
    const worldId = Number(payload && payload.worldId);
    socket.emit("blackjack_state", publicMultiplayerTable(worldId));
  });

  socket.on("request_player_tables", (payload) => {
    const worldId = Number(payload && payload.worldId);
    socket.emit("player_tables_state", publicPlayerTables(worldId));
  });

  socket.on("request_monopoly_tables", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.listTables(worldId);
      socket.emit("monopoly_tables_state", state);

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudieron obtener las mesas de BolowPoly" });
      }
    }
  });

  socket.on("request_monopoly_state", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.getState({
        worldId,
        tableId
      });
      if (state?.table?.seatedPlayers?.some((player) => String(player.id) === String(socket.user.id))) {
        socket.join(tableChannel(worldId, tableId));
      }
      socket.emit("monopoly_state", state);

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo obtener BolowPoly" });
      }
    }
  });

  socket.on("create_monopoly_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const name = String((payload && payload.name) || "Mesa BolowPoly");
      const mode = String((payload && payload.mode) || "NORMAL");
      const timedMinutes = Number((payload && payload.timedMinutes) || 60);
      const turnTimeSeconds = Number((payload && payload.turnTimeSeconds) || 60);
      const maxPlayers = Number((payload && payload.maxPlayers) || 4);
      const isPrivate = Boolean(payload && payload.isPrivate);
      const password = String((payload && payload.password) || "");
      const eyconStake = Number((payload && payload.eyconStake) || 0);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.createTable({
        worldId,
        actorId: socket.user.id,
        name,
        mode,
        timedMinutes,
        turnTimeSeconds,
        maxPlayers,
        isPrivate,
        password,
        eyconStake
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo crear la mesa BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo crear la mesa BolowPoly" });
      }
    }
  });

  socket.on("join_monopoly_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const password = String((payload && payload.password) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      socket.join(tableChannel(worldId, tableId));
      const state = await monopolyService.joinTable({
        worldId,
        tableId,
        actorId: socket.user.id,
        password
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo entrar a la mesa BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo entrar a la mesa BolowPoly" });
      }
    }
  });

  socket.on("start_monopoly_game", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      socket.join(tableChannel(worldId, tableId));
      const state = await monopolyService.startGame({
        worldId,
        tableId,
        actorId: socket.user.id
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo iniciar BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo iniciar BolowPoly" });
      }
    }
  });

  socket.on("roll_monopoly_turn_order", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      socket.join(tableChannel(worldId, tableId));
      const state = await monopolyService.rollTurnOrder({
        worldId,
        tableId,
        actorId: socket.user.id
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo tirar para definir turnos" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo tirar para definir turnos" });
      }
    }
  });

  socket.on("monopoly_action", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const action = String((payload && payload.action) || "");
      const actionPayload = payload && payload.payload && typeof payload.payload === "object" ? payload.payload : {};

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      socket.join(tableChannel(worldId, tableId));
      const state = await monopolyService.performAction({
        worldId,
        tableId,
        actorId: socket.user.id,
        actionName: action,
        payload: actionPayload
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo ejecutar la accion de BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo ejecutar la accion de BolowPoly" });
      }
    }
  });

  socket.on("monopoly_dice_motion", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const motion = payload && payload.motion && typeof payload.motion === "object" ? payload.motion : null;

      if (!socket.data.worldId || socket.data.worldId !== worldId || !tableId || !motion) {
        if (typeof callback === "function") callback({ ok: false });
        return;
      }

      const now = Date.now();
      const phase = String(motion.phase || "");
      const sequenceId = String(payload.sequenceId || "").slice(0, 80);
      const frame = Number(payload.frame);
      if (
        !["grab", "move", "release", "state", "settled", "cancel"].includes(phase) ||
        !sequenceId ||
        !Number.isInteger(frame) ||
        frame < 0
      ) {
        if (typeof callback === "function") callback({ ok: false });
        return;
      }
      if (
        (phase === "move" || phase === "state") &&
        now - Number(socket.data.lastMonopolyDiceMotionAt || 0) < 32
      ) {
        if (typeof callback === "function") callback({ ok: true, throttled: true });
        return;
      }

      if (phase === "grab") {
        const state = await monopolyService.getState({ worldId, tableId });
        const game = state?.table?.game;
        const actor = game?.players?.find((player) => String(player.id) === String(socket.user.id));
        if (
          !actor ||
          actor.bankrupt ||
          String(game.currentPlayerId) !== String(socket.user.id) ||
          !Array.isArray(actor.availableActions) ||
          !actor.availableActions.includes("tirarDados")
        ) {
          if (typeof callback === "function") {
            callback({
              ok: false,
              error: "El servidor no autorizo el gesto de dados para este turno"
            });
          }
          return;
        }
        socket.data.monopolyDiceGesture = {
          worldId,
          tableId,
          sequenceId,
          expiresAt: now + 12000,
          released: false,
          lastFrame: frame
        };
      } else {
        const gesture = socket.data.monopolyDiceGesture;
        if (
          !gesture ||
          gesture.worldId !== worldId ||
          gesture.tableId !== tableId ||
          gesture.sequenceId !== sequenceId ||
          gesture.expiresAt < now ||
          frame <= Number(gesture.lastFrame)
        ) {
          if (typeof callback === "function") callback({ ok: false });
          return;
        }
        if (
          (phase === "move" && gesture.released) ||
          (phase === "release" && gesture.released) ||
          ((phase === "state" || phase === "settled") && !gesture.released)
        ) {
          if (typeof callback === "function") callback({ ok: false });
          return;
        }
        gesture.lastFrame = frame;
        if (phase === "release") {
          gesture.released = true;
        }
        gesture.expiresAt = now + 12000;
      }

      const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
      const clamp = (value, min, max, fallback = 0) => Math.min(max, Math.max(min, finite(value, fallback)));
      const normalizeVector = (value, limit, fallbackY = 0) => ({
        x: clamp(value?.x, -limit, limit),
        y: clamp(value?.y, -limit, limit, fallbackY),
        z: clamp(value?.z, -limit, limit)
      });
      let safeMotion;
      if (phase === "grab" || phase === "move") {
        safeMotion = {
          phase,
          point: {
            x: clamp(motion.point?.x, -5, 5),
            y: 1.45,
            z: clamp(motion.point?.z, -5, 5)
          }
        };
      } else if (phase === "release" || phase === "state" || phase === "settled") {
        safeMotion = {
          phase,
          active: phase === "settled" ? false : motion.active !== false,
          dice: (Array.isArray(motion.dice) ? motion.dice : []).slice(0, 2).map((die) => ({
            position: {
              x: clamp(die?.position?.x, -5, 5),
              y: clamp(die?.position?.y, 0.55, 4, 1.45),
              z: clamp(die?.position?.z, -5, 5)
            },
            quaternion: {
              x: clamp(die?.quaternion?.x, -1, 1),
              y: clamp(die?.quaternion?.y, -1, 1),
              z: clamp(die?.quaternion?.z, -1, 1),
              w: clamp(die?.quaternion?.w, -1, 1, 1)
            },
            velocity: normalizeVector(die?.velocity, 20),
            angularVelocity: normalizeVector(die?.angularVelocity, 30),
            sleeping: phase === "settled" || Boolean(die?.sleeping)
          }))
        };
        if (safeMotion.dice.length !== 2) {
          if (typeof callback === "function") callback({ ok: false });
          return;
        }
      } else {
        safeMotion = { phase: "cancel" };
      }

      socket.data.lastMonopolyDiceMotionAt = now;
      socket.join(tableChannel(worldId, tableId));
      const diceMotionPayload = {
        worldId,
        tableId,
        actorId: socket.user.id,
        sequenceId,
        frame,
        sentAt: now,
        motion: safeMotion
      };
      io.to(roomName(worldId)).emit("monopoly_dice_motion", diceMotionPayload);
      io.to(roomName(worldId)).emit("monopoly_state", {
        worldId,
        tableId,
        visualOnly: true,
        diceMotion: diceMotionPayload
      });
      if (phase === "settled" || phase === "cancel") {
        socket.data.monopolyDiceGesture = null;
      }
      if (typeof callback === "function") callback({ ok: true });
    } catch {
      // Ephemeral motion must never interrupt the authoritative game flow.
      if (typeof callback === "function") callback({ ok: false });
    }
  });

  socket.on("leave_monopoly_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.leaveTable({
        worldId,
        tableId,
        actorId: socket.user.id
      });

      socket.leave(tableChannel(worldId, tableId));

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo salir de la mesa BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo salir de la mesa BolowPoly" });
      }
    }
  });

  socket.on("surrender_monopoly_game", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.surrender({
        worldId,
        tableId,
        actorId: socket.user.id
      });
      socket.leave(tableChannel(worldId, tableId));

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo rendir la partida de BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo rendir la partida de BolowPoly" });
      }
    }
  });

  socket.on("close_monopoly_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const state = await monopolyService.closeTable({
        worldId,
        tableId,
        actorId: socket.user.id
      });
      socket.leave(tableChannel(worldId, tableId));

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo cerrar la mesa BolowPoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo cerrar la mesa BolowPoly" });
      }
    }
  });

  socket.on("create_player_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const currency = String((payload && payload.currency) || "NORMAL").toUpperCase();
      const name = String((payload && payload.name) || "Mesa PvP").trim().slice(0, 32);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (!["NORMAL", "EYCON"].includes(currency)) {
        throw new Error("Divisa de mesa invalida");
      }

      const buyIn = Number(payload && payload.buyIn);

      if (currency === "EYCON") {
        if (!Number.isInteger(buyIn) || buyIn < EYCON_PVP_MIN_UNITS || buyIn > EYCON_PVP_MAX_UNITS) {
          throw new Error("Las mesas EyCon aceptan apuestas de 0.01 a 1.00 EyCon");
        }
      } else if (!Number.isInteger(buyIn) || buyIn < AI_TABLE_MIN_BET) {
        throw new Error(`Las mesas PvP aceptan buy-in desde $${AI_TABLE_MIN_BET}, sin limite fijo`);
      }

      const tables = getPlayerTableMap(worldId);
      const existingSeat = [...tables.values()].some((table) =>
        table.seats.some((seat) => seat.userId === socket.user.id)
      );

      if (existingSeat) {
        throw new Error("Ya estas sentado en una mesa PvP");
      }

      const tableId = crypto.randomUUID();

      if (currency === "EYCON") {
        const account = await eyconService.ensureAccount(socket.user.id);
        if (Number(account.balanceUnits) < buyIn) {
          throw new Error("Saldo EyCon insuficiente para sentarte");
        }
        await eyconService.reservePvpStake({
          userId: socket.user.id,
          referenceId: `bj-pvp:${tableId}`,
          amountUnits: buyIn,
          gameKey: "BLACKJACK_PVP"
        });
      } else {
        const economy = await getEconomyOrFail(socket.user.id, worldId);
        if (economy.balance < buyIn) {
          throw new Error("Saldo insuficiente para sentarte");
        }
        const nextBalance = await reservePlayerTableBuyIn(socket.user.id, worldId, buyIn);
        await broadcastEconomyChange(socket.user.id, worldId, nextBalance);
      }

      const table = {
        id: tableId,
        name: name || "Mesa PvP",
        status: "waiting",
        phase: "waiting",
        message: "Esperando jugadores",
        buyIn,
        currency,
        maxSeats: TABLE_MAX_PLAYERS,
        hostId: socket.user.id,
        createdAt: new Date().toISOString(),
        startEndsAt: null,
        turnEndsAt: null,
        startTimer: null,
        turnTimer: null,
        resetTimer: null,
        rematchEndsAt: null,
        rematchRequestedBy: null,
        rematchConfirmations: new Set(),
        rematchTimer: null,
        deck: [],
        turnIndex: -1,
        currentTurnUserId: null,
        winners: [],
        seats: [createPlayerTableSeat(socket.user)]
      };

      tables.set(table.id, table);
      emitPlayerTables(worldId);

      if (typeof callback === "function") {
        callback({ ok: true, table: publicPlayerTableById(worldId, table.id) });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo crear mesa PvP" });
      }
    }
  });

  socket.on("join_player_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      const tables = getPlayerTableMap(worldId);
      const table = tables.get(tableId);

      if (!table) {
        throw new Error("Mesa PvP no encontrada");
      }

      if (table.seats.some((seat) => seat.userId === socket.user.id)) {
        throw new Error("Ya estas sentado en esta mesa");
      }

      if (table.phase !== "waiting") {
        throw new Error("La ronda ya empezo");
      }

      if (table.seats.length >= table.maxSeats) {
        throw new Error("Mesa llena");
      }

      if (table.currency === "EYCON") {
        const account = await eyconService.ensureAccount(socket.user.id);
        if (Number(account.balanceUnits) < table.buyIn) {
          throw new Error("Saldo EyCon insuficiente para sentarte");
        }
        await eyconService.reservePvpStake({
          userId: socket.user.id,
          referenceId: `bj-pvp:${table.id}`,
          amountUnits: table.buyIn,
          gameKey: "BLACKJACK_PVP"
        });
      } else {
        const nextBalance = await reservePlayerTableBuyIn(socket.user.id, worldId, table.buyIn);
        await broadcastEconomyChange(socket.user.id, worldId, nextBalance);
      }

      table.seats.push(createPlayerTableSeat(socket.user));
      table.message = `${socket.user.username} se sento`;
      schedulePvpStart(table, worldId);
      emitPlayerTables(worldId);

      if (typeof callback === "function") {
        callback({ ok: true, table: publicPlayerTableById(worldId, table.id) });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo entrar a mesa PvP" });
      }
    }
  });

  socket.on("leave_player_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const tables = getPlayerTableMap(worldId);
      const table = tables.get(tableId);

      if (!table) {
        throw new Error("Mesa PvP no encontrada");
      }

      const leavingSeat = table.seats.find((seat) => seat.userId === socket.user.id);

      if (!leavingSeat) {
        throw new Error("No estas sentado en esta mesa");
      }

      if (table.phase === "playing") {
        leavingSeat.connected = false;
        leavingSeat.status = "stood";
        table.message = `${leavingSeat.username} salio; turno saltado`;

        if (table.currentTurnUserId === socket.user.id) {
          await advancePvpTurn(worldId, tableId);
        } else {
          emitPlayerTables(worldId);
        }

        if (typeof callback === "function") {
          callback({ ok: true });
        }

        return;
      }

      if (table.phase === "waiting") {
        await refundPlayerTableSeat(leavingSeat, worldId, table.buyIn, table.currency, table.id);
      }

      table.seats = table.seats.filter((seat) => seat.userId !== socket.user.id);

      if (table.seats.length === 0) {
        clearPlayerTableTimers(table);
        tables.delete(tableId);
      } else {
        table.hostId = table.seats[0].userId;

        if (table.phase === "settled") {
          clearPvpRematchState(table);
          table.message = "El anfitrion puede pedir revancha";
        }

        if (table.phase === "waiting" && table.seats.length < 2 && table.startTimer) {
          clearTimeout(table.startTimer);
          table.startTimer = null;
          table.startEndsAt = null;
          table.message = "Esperando jugadores";
        }
      }

      if (tables.size === 0) {
        playerOnlyTables.delete(worldId);
      }

      emitPlayerTables(worldId);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo salir de mesa PvP" });
      }
    }
  });

  socket.on("start_player_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const { table } = findPlayerTable(worldId, tableId);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (table.hostId !== socket.user.id) {
        throw new Error("Solo el anfitrion puede iniciar");
      }

      if (table.phase !== "waiting") {
        throw new Error("La mesa ya esta en curso");
      }

      if (table.seats.length < 2) {
        throw new Error("Necesitas al menos 2 jugadores");
      }

      await startPvpTableRound(worldId, tableId);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      socket.emit("player_table_error", { message: error.message || "No se pudo iniciar mesa PvP" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo iniciar mesa PvP" });
      }
    }
  });

  socket.on("pvp_player_action", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const action = String((payload && payload.action) || "");
      const { table } = findPlayerTable(worldId, tableId);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (table.phase !== "playing") {
        throw new Error("No hay ronda activa");
      }

      if (table.currentTurnUserId !== socket.user.id) {
        throw new Error("No es tu turno");
      }

      const seat = table.seats.find((candidate) => candidate.userId === socket.user.id);

      if (!seat || seat.status !== "playing") {
        throw new Error("No puedes actuar en esta ronda");
      }

      if (action === "hit") {
        seat.cards.push(draw(table.deck));
        const total = handValue(seat.cards);

        if (total > 21) {
          seat.status = "busted";
          table.message = `${seat.username} se paso`;
          await advancePvpTurn(worldId, tableId);
        } else if (total === 21) {
          seat.status = "stood";
          table.message = `${seat.username} llego a 21`;
          await advancePvpTurn(worldId, tableId);
        } else {
          table.message = `${seat.username} pidio carta`;
          schedulePvpTurnTimeout(table, worldId);
          emitPlayerTables(worldId);
        }
      } else if (action === "stand") {
        seat.status = "stood";
        table.message = `${seat.username} se planta`;
        await advancePvpTurn(worldId, tableId);
      } else {
        throw new Error("Accion invalida");
      }

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      socket.emit("player_table_error", { message: error.message || "No se pudo procesar accion PvP" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo procesar accion PvP" });
      }
    }
  });

  socket.on("request_player_table_rematch", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const { table } = findPlayerTable(worldId, tableId);

      if (table.currency === "EYCON") {
        throw new Error("Las mesas con apuesta EyCon no permiten revancha. Crea una nueva mesa para volver a apostar.");
      }

      if (table.phase !== "settled") {
        throw new Error("La revancha solo se puede pedir al terminar la ronda");
      }

      if (table.hostId !== socket.user.id) {
        throw new Error("Solo el anfitrion puede pedir revancha");
      }

      const seat = table.seats.find((candidate) => candidate.userId === socket.user.id && candidate.connected !== false);

      if (!seat) {
        throw new Error("Debes seguir en la mesa para pedir revancha");
      }

      table.rematchRequestedBy = socket.user.id;
      table.rematchConfirmations = new Set([socket.user.id]);
      table.message = `${socket.user.username} pidio revancha`;
      emitPlayerTables(worldId);

      await tryStartPvpRematch(worldId, tableId);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo pedir revancha" });
      }
    }
  });

  socket.on("confirm_player_table_rematch", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const tableId = String((payload && payload.tableId) || "");
      const { table } = findPlayerTable(worldId, tableId);

      if (table.currency === "EYCON") {
        throw new Error("Las mesas con apuesta EyCon no permiten revancha. Crea una nueva mesa para volver a apostar.");
      }

      if (table.phase !== "settled") {
        throw new Error("La revancha ya no esta disponible");
      }

      if (!table.rematchRequestedBy) {
        throw new Error("Primero el anfitrion debe pedir revancha");
      }

      const seat = table.seats.find((candidate) => candidate.userId === socket.user.id && candidate.connected !== false);

      if (!seat) {
        throw new Error("Debes seguir en la mesa para confirmar revancha");
      }

      if (!(table.rematchConfirmations instanceof Set)) {
        table.rematchConfirmations = new Set(table.rematchConfirmations || []);
      }

      table.rematchConfirmations.add(socket.user.id);

      const connectedSeats = table.seats.filter((candidate) => candidate.connected !== false);
      const confirmedCount = connectedSeats.filter((candidate) => table.rematchConfirmations.has(candidate.userId)).length;
      table.message = `${seat.username} confirmo revancha (${confirmedCount}/${connectedSeats.length})`;
      emitPlayerTables(worldId);

      await tryStartPvpRematch(worldId, tableId);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo confirmar revancha" });
      }
    }
  });

  socket.on("place_bet_multiplayer", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const bet = Number(payload && payload.bet);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (!Number.isInteger(bet) || bet <= 0) {
        throw new Error("Apuesta invalida");
      }

      if (bet < AI_TABLE_MIN_BET || bet > AI_TABLE_MAX_BET) {
        throw new Error(`La mesa IA acepta apuestas de $${AI_TABLE_MIN_BET} a $${AI_TABLE_MAX_BET}`);
      }

      const table = getOrCreateBettingTable(worldId);

      if (table.phase !== "betting") {
        throw new Error("La ronda ya esta en curso");
      }

      if (table.players.has(socket.user.id)) {
        throw new Error("Ya apostaste en esta ronda");
      }

      if (table.order.length >= (table.maxPlayers || TABLE_MAX_PLAYERS)) {
        throw new Error(`La mesa VS Banca admite hasta ${table.maxPlayers || TABLE_MAX_PLAYERS} jugadores`);
      }

      let nextBalance = 0;

      await run("BEGIN IMMEDIATE");

      try {
        const economy = await getEconomyOrFail(socket.user.id, worldId);

        if (economy.balance < bet) {
          await run("ROLLBACK");
          throw new Error("Saldo insuficiente");
        }

        nextBalance = economy.balance - bet;
        await run("UPDATE economies SET balance = ? WHERE user_id = ? AND world_id = ?", [
          nextBalance,
          socket.user.id,
          worldId
        ]);
        await run("COMMIT");
      } catch (error) {
        await run("ROLLBACK").catch(() => {});
        throw error;
      }

      table.players.set(socket.user.id, {
        userId: socket.user.id,
        username: socket.user.username,
        bet,
        cards: [],
        status: "ready",
        outcome: null,
        payout: 0,
        balance: nextBalance,
        connected: true
      });
      table.order.push(socket.user.id);
      table.message = `${socket.user.username} aposto $${bet}`;

      await broadcastEconomyChange(socket.user.id, worldId, nextBalance);

      if (!table.bettingTimer) {
        startBettingCountdown(table);
      }

      emitMultiplayerTable(worldId);

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      socket.emit("blackjack_error", { message: error.message || "No se pudo apostar" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo apostar" });
      }
    }
  });

  socket.on("player_action", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const action = String((payload && payload.action) || "");
      const table = multiplayerBlackjackTables.get(worldId);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (!table || table.phase !== "playing") {
        throw new Error("No hay ronda activa");
      }

      if (table.currentTurnUserId !== socket.user.id) {
        throw new Error("No es tu turno");
      }

      const player = table.players.get(socket.user.id);

      if (!player || player.status !== "playing") {
        throw new Error("No puedes actuar en esta ronda");
      }

      if (action === "hit") {
        player.cards.push(draw(table.deck));
        const total = handValue(player.cards);

        if (total > 21) {
          player.status = "busted";
          table.message = `${player.username} se paso`;
          await advanceMultiplayerTurn(worldId);
        } else if (total === 21) {
          player.status = "stood";
          table.message = `${player.username} llego a 21`;
          await advanceMultiplayerTurn(worldId);
        } else {
          table.message = `${player.username} pidio carta`;
          scheduleTurnTimeout(table);
          emitMultiplayerTable(worldId);
        }
      } else if (action === "stand") {
        player.status = "stood";
        table.message = `${player.username} se planta`;
        await advanceMultiplayerTurn(worldId);
      } else {
        throw new Error("Accion invalida");
      }

      if (typeof callback === "function") {
        callback({ ok: true });
      }
    } catch (error) {
      socket.emit("blackjack_error", { message: error.message || "No se pudo procesar accion" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo procesar accion" });
      }
    }
  });

  socket.on("disconnect", () => {
    const worldId = socket.data.worldId;

    if (!worldId) {
      return;
    }

    const fullyLeft = removePresenceSocket(socket, worldId);

    if (fullyLeft) {
      handlePlayerLeftWorld(socket.user.id, worldId)
        .then(async () => {
          await handlePlayerLeftPlayerTables(socket.user.id, worldId);
          await emitWorldPresence(worldId);
        })
        .catch((error) => console.error("Error al desconectar jugador", error));
    } else {
      emitWorldPresence(worldId).catch((error) =>
        console.error("Error al actualizar presencia", error)
      );
    }
  });
});

initDatabase()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`API y Socket.io listos en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("No se pudo inicializar SQLite", error);
    process.exit(1);
  });
