const path = require("path");
const http = require("http");
const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { createMonopolyService } = require("./monopoly-service");

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
const USERNAME_PATTERN = /^[a-z0-9_]{3,16}$/;
const PASSWORD_MIN_LENGTH = 8;

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
const db = new sqlite3.Database(dbPath);
const blackjackSessions = new Map();
const worldPresence = new Map();
const multiplayerBlackjackTables = new Map();
const playerOnlyTables = new Map();
const monopolyService = createMonopolyService({ get, run, all, io, roomName });

app.use(
  cors({
    origin: allowedOrigins
  })
);
app.use(express.json());

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
  await run("PRAGMA foreign_keys = ON");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `);

  await run("ALTER TABLE users ADD COLUMN monopoly_token_json TEXT").catch(() => {});

  await run(`
    CREATE TABLE IF NOT EXISTS worlds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

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
}

function signToken(user) {
  return jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
    expiresIn: "7d"
  });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function normalizeWorldName(name) {
  return String(name || "").trim().slice(0, 48);
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

function sanitizeMonopolyToken(input) {
  const token = input && typeof input === "object" ? input : {};
  const clean = {
    label: String(token.label || "").trim().slice(0, 4).toUpperCase(),
    icon: String(token.icon || "").trim().slice(0, 32),
    bg: /^#[0-9a-fA-F]{6}$/.test(token.bg) ? token.bg : "#d94841",
    ring: /^#[0-9a-fA-F]{6}$/.test(token.ring) ? token.ring : "#7c1510",
    fg: /^#[0-9a-fA-F]{6}$/.test(token.fg) ? token.fg : "#ffffff",
    shape: ["circle", "rounded", "square", "diamond", "hexagon", "shield", "star"].includes(token.shape)
      ? token.shape
      : "circle"
  };

  if (!clean.icon && !clean.label) {
    clean.label = "TOP";
  }

  return clean;
}

function parseStoredMonopolyToken(value) {
  if (!value) return null;
  try {
    return sanitizeMonopolyToken(JSON.parse(value));
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

  const world = await get("SELECT id, name, created_by AS createdBy FROM worlds WHERE id = ?", [
    worldId
  ]);

  if (!world) {
    const error = new Error("Mundo no encontrado");
    error.status = 404;
    throw error;
  }

  await run(
    "INSERT OR IGNORE INTO economies (user_id, world_id, balance) VALUES (?, ?, ?)",
    [userId, worldId, STARTING_BALANCE]
  );

  const economy = await getEconomyOrFail(userId, worldId);
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
        economies.balance AS balance
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
      token: parseStoredMonopolyToken(row.tokenJson)
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

  if (payout > 0) {
    await run(
      "UPDATE economies SET balance = balance + ? WHERE user_id = ? AND world_id = ?",
      [payout, session.userId, session.worldId]
    );
  }

  const economy = await getEconomyOrFail(session.userId, session.worldId);
  session.status = "settled";
  session.outcome = outcome;
  session.payout = payout;
  session.balance = economy.balance;
  blackjackSessions.set(session.id, session);
  await broadcastEconomyChange(session.userId, session.worldId, economy.balance);
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

async function refundPlayerTableSeat(seat, worldId, buyIn) {
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
  table.message = winners.length
    ? `Ganador: ${winners.map((seat) => seat.username).join(", ")}. El anfitrion puede pedir revancha.`
    : "Todos se pasaron. El anfitrion puede pedir revancha.";

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
      await refundPlayerTableSeat(leavingSeat, worldId, table.buyIn);
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
      "INSERT INTO users (username, password_hash) VALUES (?, ?)",
      [username, passwordHash]
    );

    const user = { id: result.id, username };
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
      return res.status(400).json({ error: usernameError || "La contrasena es requerida" });
    }

    const user = await get("SELECT id, username, password_hash FROM users WHERE username = ?", [
      username
    ]);

    if (!user) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);

    if (!ok) {
      return res.status(401).json({ error: "Credenciales invalidas" });
    }

    return res.json({
      user: { id: user.id, username: user.username },
      token: signToken(user)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo iniciar sesion" });
  }
});

app.get("/api/worlds", authRequired, async (req, res) => {
  try {
    const worlds = await all(
      `
        SELECT
          worlds.id,
          worlds.name,
          worlds.created_by AS createdBy,
          economies.balance AS balance
        FROM worlds
        LEFT JOIN economies
          ON economies.world_id = worlds.id
          AND economies.user_id = ?
        ORDER BY worlds.id ASC
        LIMIT 1
      `,
      [req.user.id]
    );

    return res.json({ worlds });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudieron listar los mundos" });
  }
});

app.post("/api/worlds/create", authRequired, async (req, res) => {
  try {
    const name = normalizeWorldName(req.body.name);

    if (name.length < 3) {
      return res.status(400).json({ error: "El nombre del mundo es muy corto" });
    }

    const existingWorld = await get("SELECT id FROM worlds ORDER BY id ASC LIMIT 1");

    if (existingWorld) {
      return res.status(409).json({ error: "Ya existe un mundo activo. Solo se permite uno." });
    }

    const result = await run("INSERT INTO worlds (name, created_by) VALUES (?, ?)", [
      name,
      req.user.id
    ]);

    await run(
      "INSERT INTO economies (user_id, world_id, balance) VALUES (?, ?, ?)",
      [req.user.id, result.id, STARTING_BALANCE]
    );

    return res.status(201).json({
      world: { id: result.id, name, createdBy: req.user.id },
      balance: STARTING_BALANCE
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo crear el mundo" });
  }
});

app.post("/api/worlds/join", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const { world, economy } = await ensureWorldMembership(req.user.id, worldId);
    return res.json({ world, balance: economy.balance });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.status ? error.message : "No se pudo cargar el mundo"
    });
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
    const token = sanitizeMonopolyToken(req.body?.token);
    await run("UPDATE users SET monopoly_token_json = ? WHERE id = ?", [
      JSON.stringify(token),
      req.user.id
    ]);
    return res.json({ token });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "No se pudo guardar tu ficha" });
  }
});

app.delete("/api/monopoly/token", authRequired, async (req, res) => {
  try {
    await run("UPDATE users SET monopoly_token_json = NULL WHERE id = ?", [req.user.id]);
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
      error: error.status ? error.message : "No se pudieron obtener las mesas de Monopoly"
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
      error: error.status ? error.message : "No se pudo obtener el estado de Monopoly"
    });
  }
});

app.post("/api/monopoly/create", authRequired, async (req, res) => {
  try {
    const worldId = Number(req.body.worldId);
    const name = String(req.body.name || "Mesa Monopoly");
    const mode = String(req.body.mode || "NORMAL");
    const timedMinutes = Number(req.body.timedMinutes || 60);
    const turnTimeSeconds = Number(req.body.turnTimeSeconds || 60);
    const maxPlayers = Number(req.body.maxPlayers || 4);
    const isPrivate = Boolean(req.body.isPrivate);
    const password = String(req.body.password || "");

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
      password
    });
    return res.status(201).json(state);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({
      error: error.message || "No se pudo crear la mesa Monopoly"
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
      error: error.message || "No se pudo unir a la mesa Monopoly"
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
      error: error.message || "No se pudo iniciar Monopoly"
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
      error: error.message || "No se pudo ejecutar la accion de Monopoly"
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
      error: error.message || "No se pudo salir de la mesa Monopoly"
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
      error: error.message || "No se pudo rendir la partida de Monopoly"
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
      error: error.message || "No se pudo cerrar la mesa Monopoly"
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

    if (!Number.isInteger(worldId) || !Number.isInteger(bet) || bet <= 0) {
      return res.status(400).json({ error: "Apuesta invalida" });
    }

    if (bet < AI_TABLE_MIN_BET || bet > AI_TABLE_MAX_BET) {
      return res.status(400).json({
        error: `La mesa IA acepta apuestas de $${AI_TABLE_MIN_BET} a $${AI_TABLE_MAX_BET}`
      });
    }

    const world = await get("SELECT id FROM worlds WHERE id = ?", [worldId]);

    if (!world) {
      return res.status(404).json({ error: "Mundo no encontrado" });
    }

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

    const deck = makeDeck();
    const session = {
      id: crypto.randomUUID(),
      userId: req.user.id,
      worldId,
      bet,
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

io.use((socket, next) => {
  try {
    const token = socket.handshake.auth && socket.handshake.auth.token;

    if (!token) {
      return next(new Error("Token requerido"));
    }

    socket.user = jwt.verify(token, JWT_SECRET);
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

      socket.emit("joined_world", { world, balance: economy.balance });
      socket.emit("blackjack_state", publicMultiplayerTable(worldId));
      socket.emit("player_tables_state", publicPlayerTables(worldId));
      socket.emit("monopoly_tables_state", await monopolyService.listTables(worldId));
      emitMultiplayerTable(worldId);
      if (restoredPlayerTable) {
        emitPlayerTables(worldId);
      }
      await emitWorldPresence(worldId);

      if (typeof callback === "function") {
        callback({ ok: true, world, balance: economy.balance });
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
        callback({ ok: false, error: error.message || "No se pudieron obtener las mesas de Monopoly" });
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
      socket.emit("monopoly_state", state);

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo obtener Monopoly" });
      }
    }
  });

  socket.on("create_monopoly_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const name = String((payload && payload.name) || "Mesa Monopoly");
      const mode = String((payload && payload.mode) || "NORMAL");
      const timedMinutes = Number((payload && payload.timedMinutes) || 60);
      const turnTimeSeconds = Number((payload && payload.turnTimeSeconds) || 60);
      const maxPlayers = Number((payload && payload.maxPlayers) || 4);
      const isPrivate = Boolean(payload && payload.isPrivate);
      const password = String((payload && payload.password) || "");

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
        password
      });

      if (typeof callback === "function") {
        callback({ ok: true, state });
      }
    } catch (error) {
      socket.emit("monopoly_error", { message: error.message || "No se pudo crear la mesa Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo crear la mesa Monopoly" });
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo entrar a la mesa Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo entrar a la mesa Monopoly" });
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo iniciar Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo iniciar Monopoly" });
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo ejecutar la accion de Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo ejecutar la accion de Monopoly" });
      }
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo salir de la mesa Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo salir de la mesa Monopoly" });
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo rendir la partida de Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo rendir la partida de Monopoly" });
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
      socket.emit("monopoly_error", { message: error.message || "No se pudo cerrar la mesa Monopoly" });

      if (typeof callback === "function") {
        callback({ ok: false, error: error.message || "No se pudo cerrar la mesa Monopoly" });
      }
    }
  });

  socket.on("create_player_table", async (payload, callback) => {
    try {
      const worldId = Number(payload && payload.worldId);
      const buyIn = Number(payload && payload.buyIn);
      const name = String((payload && payload.name) || "Mesa PvP").trim().slice(0, 32);

      if (!socket.data.worldId || socket.data.worldId !== worldId) {
        throw new Error("Primero debes entrar a este mundo");
      }

      if (!Number.isInteger(buyIn) || buyIn < AI_TABLE_MIN_BET) {
        throw new Error(`Las mesas PvP aceptan buy-in desde $${AI_TABLE_MIN_BET}, sin limite fijo`);
      }

      const economy = await getEconomyOrFail(socket.user.id, worldId);

      if (economy.balance < buyIn) {
        throw new Error("Saldo insuficiente para sentarte");
      }

      const tables = getPlayerTableMap(worldId);
      const existingSeat = [...tables.values()].some((table) =>
        table.seats.some((seat) => seat.userId === socket.user.id)
      );

      if (existingSeat) {
        throw new Error("Ya estas sentado en una mesa PvP");
      }

      const nextBalance = await reservePlayerTableBuyIn(socket.user.id, worldId, buyIn);
      await broadcastEconomyChange(socket.user.id, worldId, nextBalance);

      const table = {
        id: crypto.randomUUID(),
        name: name || "Mesa PvP",
        status: "waiting",
        phase: "waiting",
        message: "Esperando jugadores",
        buyIn,
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

      const nextBalance = await reservePlayerTableBuyIn(socket.user.id, worldId, table.buyIn);
      await broadcastEconomyChange(socket.user.id, worldId, nextBalance);

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
        await refundPlayerTableSeat(leavingSeat, worldId, table.buyIn);
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
