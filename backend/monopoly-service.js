const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const CURRENT_TURN_ACTIONS = new Set([
  "tirarDados",
  "comprarPropiedad",
  "rechazarCompra",
  "resolverCarta",
  "pagarImpuesto",
  "comprarCasa",
  "comprarHotel",
  "venderCasa",
  "venderHotel",
  "hipotecarPropiedad",
  "levantarHipoteca",
  "usarCartaSalirCarcel",
  "pagarMultaCarcel",
  "resolverDeudaPendiente",
  "resolverQuiebra",
  "terminarTurno"
]);

const TABLE_STATUS = Object.freeze({
  WAITING: "WAITING",
  ORDERING: "ORDERING",
  PLAYING: "PLAYING",
  FINISHED: "FINISHED"
});

const MONOPOLY_MIN_TURNS_FOR_ACTIVITY = 10;

let modulePromise = null;

const { displayName: BOLOWPOLY_NAME, defaultTableName: BOLOWPOLY_DEFAULT_TABLE } = require("../shared/bolowpoly-brand");

function resolveMonopolyModulePath() {
  const engineFromEnv = process.env.MONOPOLY_ENGINE_PATH;
  const candidates = [
    engineFromEnv,
    path.join(__dirname, "shared", "monopoly-engine", "index.mjs"),
    path.join(__dirname, "..", "shared", "monopoly-engine", "index.mjs")
  ].filter(Boolean);

  for (const candidate of candidates) {
    const modulePath = path.resolve(candidate);
    if (fs.existsSync(modulePath)) {
      return modulePath;
    }
  }

  throw new Error(`No se encontro el motor de Monopoly. Rutas probadas: ${candidates.map((candidate) => path.resolve(candidate)).join(", ")}`);
}

function asClientError(error, fallbackMessage = `No se pudo completar la accion de ${BOLOWPOLY_NAME}`, status = 400) {
  if (error instanceof Error) {
    if (!error.status) {
      error.status = status;
    }
    return error;
  }

  const wrapped = new Error(fallbackMessage);
  wrapped.status = status;
  return wrapped;
}

function loadMonopolyModule() {
  if (!modulePromise) {
    const modulePath = pathToFileURL(resolveMonopolyModulePath()).href;
    modulePromise = import(modulePath);
  }

  return modulePromise;
}

function createMonopolyService({
  get,
  run,
  all,
  io,
  roomName,
  getEquippedCosmetics = async () => new Map(),
  onGameFinished = async () => null,
  chargeEyconStakes = null,
  refundEyconStakes = null,
  recordPlayActivity = null
}) {
  const queues = new Map();
  const turnTimers = new Map();
  const finishedCleanupTimers = new Map();

  function queueByKey(key, work) {
    const previous = queues.get(key) || Promise.resolve();
    const next = previous.then(work, work);
    const tail = next.catch(() => undefined);
    const settled = tail.finally(() => {
      if (queues.get(key) === settled) {
        queues.delete(key);
      }
    });
    queues.set(key, settled);
    return next;
  }

  function tableChannel(worldId, tableId) {
    return `${roomName(worldId)}:monopoly:${tableId}`;
  }

  function clearTurnTimer(tableId) {
    const timer = turnTimers.get(tableId);
    if (timer) {
      clearTimeout(timer.timeoutId);
      turnTimers.delete(tableId);
    }
  }

  function clearFinishedCleanupTimer(tableId) {
    const timerId = finishedCleanupTimers.get(tableId);
    if (timerId) {
      clearTimeout(timerId);
      finishedCleanupTimers.delete(tableId);
    }
  }

  async function getTableRow(tableId) {
    return get(
      `
        SELECT
          id,
          world_id AS worldId,
          name,
          status,
          config_json AS configJson,
          state_json AS stateJson,
          created_by AS createdBy,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM monopoly_tables
        WHERE id = ?
      `,
      [tableId]
    );
  }

  async function listTableRows(worldId) {
    return all(
      `
        SELECT
          id,
          world_id AS worldId,
          name,
          status,
          config_json AS configJson,
          state_json AS stateJson,
          created_by AS createdBy,
          updated_by AS updatedBy,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM monopoly_tables
        WHERE world_id = ?
        ORDER BY updated_at DESC, created_at DESC
      `,
      [worldId]
    );
  }

  function parseConfig(row) {
    const config = row?.configJson ? JSON.parse(row.configJson) : {};
    const seatedPlayerIds = Array.isArray(config.seatedPlayerIds)
      ? config.seatedPlayerIds.map(Number).filter(Number.isInteger)
      : [];
    return {
      hostId: config.hostId || row.createdBy,
      mode: config.mode || "NORMAL",
      timedMinutes: Number(config.timedMinutes || 60),
      turnTimeSeconds: Number(config.turnTimeSeconds || 60),
      maxPlayers: clampMaxPlayers(config.maxPlayers),
      isPrivate: Boolean(config.isPrivate),
      password: typeof config.password === "string" ? config.password : "",
      seatedPlayerIds,
      turnOrderRolls: normalizeTurnOrderRolls(config.turnOrderRolls, seatedPlayerIds),
      turnOrderStartedAt: typeof config.turnOrderStartedAt === "string" ? config.turnOrderStartedAt : null,
      turnOrderCompletedAt: typeof config.turnOrderCompletedAt === "string" ? config.turnOrderCompletedAt : null,
      eyconRewardEligible: config.eyconRewardEligible !== false,
      eyconStakeUnits: Math.max(0, Math.min(100, Math.floor(Number(config.eyconStakeUnits) || 0))),
      eyconStakeParticipants: Array.isArray(config.eyconStakeParticipants)
        ? config.eyconStakeParticipants.map(Number).filter(Number.isInteger)
        : [],
      activityCreditedIds: Array.isArray(config.activityCreditedIds)
        ? config.activityCreditedIds.map(Number).filter(Number.isInteger)
        : [],
      createdAt: config.createdAt || row.createdAt
    };
  }

  function normalizeDicePair(value) {
    const dice = Array.isArray(value) ? value.slice(0, 2).map(Number) : [];
    if (dice.length !== 2 || dice.some((die) => !Number.isInteger(die) || die < 1 || die > 6)) {
      return null;
    }
    return dice;
  }

  function normalizeTurnOrderRoll(value) {
    if (!value || typeof value !== "object") {
      return null;
    }

    const playerId = Number(value.playerId);
    const dice = normalizeDicePair(value.dice);
    if (!Number.isInteger(playerId) || !dice) {
      return null;
    }

    const high = Math.max(dice[0], dice[1]);
    const low = Math.min(dice[0], dice[1]);
    return {
      playerId,
      dice,
      total: dice[0] + dice[1],
      isDouble: dice[0] === dice[1],
      high,
      low,
      rolledAt: typeof value.rolledAt === "string" ? value.rolledAt : null
    };
  }

  function normalizeTurnOrderRolls(value, seatedPlayerIds = []) {
    const seatedSet = new Set((seatedPlayerIds || []).map(Number));
    const seen = new Set();
    return (Array.isArray(value) ? value : [])
      .map(normalizeTurnOrderRoll)
      .filter((roll) => {
        if (!roll || seen.has(roll.playerId)) {
          return false;
        }
        if (seatedSet.size > 0 && !seatedSet.has(roll.playerId)) {
          return false;
        }
        seen.add(roll.playerId);
        return true;
      });
  }

  function rollTurnOrderDice() {
    const dice = [
      Math.floor(Math.random() * 6) + 1,
      Math.floor(Math.random() * 6) + 1
    ];
    const high = Math.max(dice[0], dice[1]);
    const low = Math.min(dice[0], dice[1]);
    return {
      dice,
      total: dice[0] + dice[1],
      isDouble: dice[0] === dice[1],
      high,
      low
    };
  }

  function compareTurnOrderEntries(left, right) {
    return Number(right.total || 0) - Number(left.total || 0) ||
      Number(Boolean(right.isDouble)) - Number(Boolean(left.isDouble)) ||
      Number(right.high || 0) - Number(left.high || 0) ||
      Number(right.low || 0) - Number(left.low || 0) ||
      Number(left.seatIndex || 0) - Number(right.seatIndex || 0) ||
      Number(left.playerId || 0) - Number(right.playerId || 0);
  }

  function buildTurnOrderState(config, playersById = new Map()) {
    const rollsById = new Map(normalizeTurnOrderRolls(config.turnOrderRolls, config.seatedPlayerIds).map((roll) => [roll.playerId, roll]));
    const rolls = (config.seatedPlayerIds || []).map((playerId, seatIndex) => {
      const roll = rollsById.get(playerId);
      const player = playersById.get(playerId);
      return {
        playerId,
        name: player?.name || "Jugador",
        seatIndex,
        rolled: Boolean(roll),
        dice: roll?.dice || null,
        total: roll?.total ?? null,
        isDouble: Boolean(roll?.isDouble),
        high: roll?.high ?? null,
        low: roll?.low ?? null,
        rolledAt: roll?.rolledAt || null
      };
    });
    const ranking = rolls
      .filter((roll) => roll.rolled)
      .sort(compareTurnOrderEntries)
      .map((roll, index) => ({
        ...roll,
        rank: index + 1
      }));

    return {
      startedAt: config.turnOrderStartedAt,
      completedAt: config.turnOrderCompletedAt,
      rolls,
      ranking,
      pendingPlayerIds: rolls.filter((roll) => !roll.rolled).map((roll) => roll.playerId),
      complete: rolls.length >= 2 && rolls.every((roll) => roll.rolled)
    };
  }

  function resetTurnOrderConfig(config) {
    config.turnOrderRolls = [];
    config.turnOrderStartedAt = null;
    config.turnOrderCompletedAt = null;
    config.activityCreditedIds = [];
  }

  function clampMaxPlayers(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 4;
    return Math.min(8, Math.max(2, Math.round(parsed)));
  }

  async function saveTableRow(row, { name, status, config, stateJson, updatedBy }) {
    await run(
      `
        UPDATE monopoly_tables
        SET
          name = ?,
          status = ?,
          config_json = ?,
          state_json = ?,
          updated_by = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        name,
        status,
        JSON.stringify(config),
        stateJson,
        updatedBy,
        row.id
      ]
    );
  }

  async function deleteTableRow(tableId) {
    clearTurnTimer(tableId);
    clearFinishedCleanupTimer(tableId);
    await run("DELETE FROM monopoly_tables WHERE id = ?", [tableId]);
  }

  function scheduleFinishedCleanup(row, delayMs = 12_000) {
    clearTurnTimer(row.id);
    clearFinishedCleanupTimer(row.id);

    const timeoutId = setTimeout(() => {
      queueByKey(`monopoly:${row.id}`, async () => {
        const freshRow = await getTableRow(row.id);
        if (!freshRow || freshRow.status !== TABLE_STATUS.FINISHED) {
          clearFinishedCleanupTimer(row.id);
          return;
        }

        await deleteTableRow(row.id);
        await emitTables(freshRow.worldId);
      }).catch((error) => {
        console.error("No se pudo limpiar la mesa Monopoly finalizada", error);
      });
    }, delayMs);

    finishedCleanupTimers.set(row.id, timeoutId);
  }

  async function listPlayersForWorld(worldId) {
    return all(
      `
        SELECT
          users.id AS id,
          users.username AS name,
          users.monopoly_token_json AS tokenJson,
          economies.balance AS balance
        FROM economies
        JOIN users ON users.id = economies.user_id
        WHERE economies.world_id = ?
        ORDER BY users.username ASC
      `,
      [worldId]
    );
  }

  async function mapPlayersById(worldId, playerIds = []) {
    const rows = await listPlayersForWorld(worldId);
    const byId = new Map(rows.map((row) => [row.id, {
      ...row,
      token: parsePlayerToken(row.tokenJson)
    }]));

    if (playerIds.length === 0) {
      return byId;
    }

    return new Map(playerIds.map((playerId) => [playerId, byId.get(playerId)]).filter(([, value]) => Boolean(value)));
  }

  async function loadEngineFromRow(row) {
    if (!row?.stateJson) {
      return null;
    }

    const { MonopolyGameEngine } = await loadMonopolyModule();
    return new MonopolyGameEngine({ state: JSON.parse(row.stateJson) });
  }

  async function buildTableSummary(row, playersById) {
    const config = parseConfig(row);
    const deadline = turnTimers.get(row.id)?.deadlineAt || null;
    const engine = await loadEngineFromRow(row);
    const { buildGameSnapshot } = await loadMonopolyModule();
    const game = engine ? buildGameSnapshot(engine) : null;
    const turnOrder = buildTurnOrderState(config, playersById);
    const seatedPlayers = (game?.players || config.seatedPlayerIds.map((playerId) => {
      const player = playersById.get(playerId);
      return player ? {
        id: player.id,
        name: player.name,
        cash: player.balance,
        bankrupt: false,
        inJail: false
      } : null;
    }).filter(Boolean));

    return {
      id: row.id,
      worldId: row.worldId,
      name: row.name,
      status: row.status,
      mode: config.mode,
      timedMinutes: config.timedMinutes,
      turnTimeSeconds: config.turnTimeSeconds,
      maxPlayers: config.maxPlayers,
      isPrivate: config.isPrivate,
      hasPassword: config.isPrivate && Boolean(config.password),
      hostId: config.hostId,
      eyconStakeUnits: config.eyconStakeUnits,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      turnDeadlineAt: deadline,
      playerCount: seatedPlayers.length,
      players: seatedPlayers.map((player) => ({
        id: player.id,
        name: player.name,
        cash: player.cash,
        bankrupt: Boolean(player.bankrupt),
        inJail: Boolean(player.inJail),
        token: player.token || playersById.get(player.id)?.token || null
      })),
      turnOrder,
      currentPlayerId: game?.currentPlayerId || null,
      winnerId: game?.winnerId || null
    };
  }

  async function buildTablesPayload(worldId) {
    const rows = await listTableRows(worldId);
    const playersById = await mapPlayersById(worldId);
    const tables = await Promise.all(rows.map((row) => buildTableSummary(row, playersById)));
    return { worldId, tables };
  }

  function parsePlayerToken(tokenJson) {
    if (!tokenJson) return null;
    try {
      const token = JSON.parse(tokenJson);
      return token && typeof token === "object" ? token : null;
    } catch {
      return null;
    }
  }

  async function emitTables(worldId) {
    const payload = await buildTablesPayload(worldId);
    io.to(roomName(worldId)).emit("monopoly_tables_state", payload);
    return payload;
  }

  async function buildTableStatePayload(worldId, tableId) {
    const row = await getTableRow(tableId);

    if (!row || row.worldId !== worldId) {
      return { worldId, tableId, table: null };
    }

    const config = parseConfig(row);
    const engine = await loadEngineFromRow(row);
    const { buildGameSnapshot } = await loadMonopolyModule();
    const playersById = await mapPlayersById(worldId, config.seatedPlayerIds);
    const cosmeticsById = await getEquippedCosmetics(config.seatedPlayerIds);
    const game = engine ? buildGameSnapshot(engine) : null;
    const turnOrder = buildTurnOrderState(config, playersById);

    if (game?.players) {
      game.players = game.players.map((player) => ({
        ...player,
        token: playersById.get(player.id)?.token || null,
        cosmetics: cosmeticsById.get(Number(player.id)) || {}
      }));
    }

    return {
      worldId,
      tableId,
      table: {
        id: row.id,
        worldId: row.worldId,
        name: row.name,
        status: row.status,
        mode: config.mode,
        timedMinutes: config.timedMinutes,
        turnTimeSeconds: config.turnTimeSeconds,
        maxPlayers: config.maxPlayers,
        isPrivate: config.isPrivate,
        hasPassword: config.isPrivate && Boolean(config.password),
        turnDeadlineAt: turnTimers.get(row.id)?.deadlineAt || null,
        hostId: config.hostId,
        eyconStakeUnits: config.eyconStakeUnits,
        createdBy: row.createdBy,
        updatedBy: row.updatedBy,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        seatedPlayers: config.seatedPlayerIds.map((playerId) => {
          const player = playersById.get(playerId);
          const gamePlayer = game?.players?.find((candidate) => candidate.id === playerId);
          return {
            id: playerId,
            name: gamePlayer?.name || player?.name || "Jugador",
            balance: player?.balance ?? gamePlayer?.cash ?? 0,
            bankrupt: Boolean(gamePlayer?.bankrupt),
            inJail: Boolean(gamePlayer?.inJail),
            token: player?.token || null,
            cosmetics: cosmeticsById.get(Number(playerId)) || {}
          };
        }),
        turnOrder,
        game
      }
    };
  }

  async function emitTableState(worldId, tableId) {
    const payload = await buildTableStatePayload(worldId, tableId);
    io.to(roomName(worldId)).emit("monopoly_state", payload);
    io.to(tableChannel(worldId, tableId)).emit("monopoly_state", payload);
    return payload;
  }

  async function emitAll(worldId, tableId) {
    const [tablesPayload, statePayload] = await Promise.all([
      emitTables(worldId),
      tableId ? emitTableState(worldId, tableId) : Promise.resolve(null)
    ]);
    return {
      worldId,
      tables: tablesPayload.tables,
      table: statePayload?.table || null
    };
  }

  async function refreshUserPresentation(userId) {
    const rows = await all(
      `SELECT id, world_id AS worldId, config_json AS configJson
       FROM monopoly_tables
       WHERE status IN (?, ?, ?)`,
      [TABLE_STATUS.WAITING, TABLE_STATUS.ORDERING, TABLE_STATUS.PLAYING]
    );
    const matchingRows = rows.filter((row) => parseConfig(row).seatedPlayerIds.includes(Number(userId)));
    for (const row of matchingRows) {
      await emitAll(row.worldId, row.id);
    }
    return { refreshedTables: matchingRows.length };
  }

  async function assertPlayerCanSeat(worldId, actorId, excludedTableId = null) {
    const rows = await listTableRows(worldId);
    for (const row of rows) {
      if (excludedTableId && row.id === excludedTableId) {
        continue;
      }

      const config = parseConfig(row);
      if (
        config.seatedPlayerIds.includes(actorId) &&
        [TABLE_STATUS.WAITING, TABLE_STATUS.ORDERING, TABLE_STATUS.PLAYING].includes(row.status)
      ) {
        throw asClientError(new Error(`Ya estas sentado en otra mesa de ${BOLOWPOLY_NAME} de este mundo`));
      }
    }
  }

  async function assertHost(row, actorId) {
    const config = parseConfig(row);
    if (config.hostId !== actorId) {
      throw asClientError(new Error("Solo el anfitrion puede hacer eso"), "No autorizado", 403);
    }
  }

  function ensurePlayerCanAct(engine, actorId, actionName, payload) {
    const actorSnapshot = engine.getState().players.find((player) => player.id === actorId);

    if (!actorSnapshot || actorSnapshot.bankrupt) {
      throw new Error("No perteneces a esta partida o ya estas en quiebra");
    }

    if (CURRENT_TURN_ACTIONS.has(actionName) && engine.currentPlayer().id !== actorId) {
      throw new Error("Solo el jugador actual puede realizar esa accion");
    }

    if (actionName === "hacerOferta" || actionName === "retirarseDeSubasta") {
      payload.jugadorId = actorId;
    }

    if (actionName === "venderPropiedad") {
      payload.vendedorId = actorId;
    }

    if (actionName === "comprarCartaSalirCarcel") {
      payload.vendedorId = actorId;
    }

    if (actionName === "crearOfertaPropiedad" || actionName === "crearOfertaCartaCarcel") {
      payload.vendedorId = actorId;
    }

    if (actionName === "crearOfertaCompraPropiedad" || actionName === "crearOfertaCompraCartaCarcel") {
      payload.compradorId = actorId;
    }

    if (actionName === "aceptarOfertaTrato" || actionName === "rechazarOfertaTrato" || actionName === "cancelarOfertaTrato") {
      payload.actorId = actorId;
    }
  }

  function syncRowStatusFromEngine(row, engine) {
    row.status = engine.state.status === "FINALIZADO" ? TABLE_STATUS.FINISHED : TABLE_STATUS.PLAYING;
  }

  function pickTimedEndAt(mode, timedMinutes) {
    if (mode !== "TIMED") {
      return null;
    }

    return Date.now() + Number(timedMinutes || 60) * 60_000;
  }

  function chooseAutoAction(engine) {
    if (engine.state.auction) {
      return {
        actorId: engine.state.auction.activeBidderId,
        actionName: "retirarseDeSubasta",
        payload: {}
      };
    }

    if (engine.state.pendingPurchase) {
      return {
        actorId: engine.state.pendingPurchase.playerId,
        actionName: "rechazarCompra",
        payload: {}
      };
    }

    if (engine.state.pendingCard) {
      return {
        actorId: engine.state.pendingCard.playerId,
        actionName: "resolverCarta",
        payload: {}
      };
    }

    if (engine.state.pendingTax) {
      return {
        actorId: engine.state.pendingTax.playerId,
        actionName: "pagarImpuesto",
        payload: { opcion: "FIXED" }
      };
    }

    if (engine.state.pendingDebt) {
      const debt = engine.state.pendingDebt;
      const debtor = engine.findPlayer(debt.debtorId);

      if (debtor.cash >= debt.amount) {
        return {
          actorId: debt.debtorId,
          actionName: "resolverDeudaPendiente",
          payload: {}
        };
      }

      for (const actionName of ["venderHotel", "venderCasa", "hipotecarPropiedad"]) {
        const propertyId = debtor.propertyIds.find((candidateId) => {
          const management = engine.describirAccionesDePropiedad(debtor.id, candidateId);
          return management?.[actionName]?.allowed;
        });

        if (propertyId) {
          return {
            actorId: debt.debtorId,
            actionName,
            payload: { propertyId }
          };
        }
      }

      return {
        actorId: debt.debtorId,
        actionName: "resolverQuiebra",
        payload: {}
      };
    }

    if (engine.state.pendingRentClaim) {
      return {
        actorId: engine.state.pendingRentClaim.ownerId,
        actionName: "pagarRenta",
        payload: {}
      };
    }

    const actorId = engine.currentPlayer().id;
    const actions = engine.listarAccionesDisponibles({ playerId: actorId });

    if (actions.includes("terminarTurno")) {
      return { actorId, actionName: "terminarTurno", payload: {} };
    }

    if (actions.includes("tirarDados")) {
      return { actorId, actionName: "tirarDados", payload: {} };
    }

    if (actions.includes("pagarMultaCarcel")) {
      return { actorId, actionName: "pagarMultaCarcel", payload: {} };
    }

    if (actions.includes("usarCartaSalirCarcel")) {
      return { actorId, actionName: "usarCartaSalirCarcel", payload: {} };
    }

    return null;
  }

  async function scheduleTurnTimeoutForRow(row) {
    clearTurnTimer(row.id);

    if (row.status !== TABLE_STATUS.PLAYING || !row.stateJson) {
      return;
    }

    const config = parseConfig(row);
    const turnTimeSeconds = Number(config.turnTimeSeconds || 0);

    if (!Number.isFinite(turnTimeSeconds) || turnTimeSeconds <= 0) {
      return;
    }

    const deadlineAt = Date.now() + turnTimeSeconds * 1000;

    const timeoutId = setTimeout(() => {
      queueByKey(`monopoly:${row.id}`, async () => {
        try {
          const freshRow = await getTableRow(row.id);
          if (!freshRow || freshRow.status !== TABLE_STATUS.PLAYING || !freshRow.stateJson) {
            clearTurnTimer(row.id);
            return;
          }

          const engine = await loadEngineFromRow(freshRow);
          const autoAction = chooseAutoAction(engine);

          if (!autoAction) {
            clearTurnTimer(row.id);
            return;
          }

          ensurePlayerCanAct(engine, autoAction.actorId, autoAction.actionName, autoAction.payload);
          engine.ejecutarAccion(autoAction.actionName, autoAction.payload);
          syncRowStatusFromEngine(freshRow, engine);

          await saveTableRow(freshRow, {
            name: freshRow.name,
            status: freshRow.status,
            config: parseConfig(freshRow),
            stateJson: JSON.stringify(engine.getState()),
            updatedBy: freshRow.updatedBy
          });

          await emitAll(freshRow.worldId, freshRow.id);
          if (freshRow.status === TABLE_STATUS.FINISHED) {
            await onGameFinished({
              tableId: freshRow.id,
              worldId: freshRow.worldId,
              state: engine.getState(),
              config: parseConfig(freshRow)
            }).catch((error) => {
              console.error("No se pudo finalizar recompensas de Monopoly", error);
            });
            scheduleFinishedCleanup(freshRow);
          } else {
            await scheduleTurnTimeoutForRow(freshRow);
          }
        } catch (error) {
          console.error("No se pudo resolver el timeout de turno Monopoly", error);
        }
      }).catch((error) => {
        console.error("Fallo la cola de timeout Monopoly", error);
      });
    }, turnTimeSeconds * 1000);

    turnTimers.set(row.id, {
      timeoutId,
      deadlineAt
    });
  }

  async function forcePlayerBankruptcy(engine, actorId, reason = "RENDICION") {
    const player = engine.findPlayer(actorId);

    if (player.bankrupt) {
      throw new Error("Ya estas fuera de la partida");
    }

    if (engine.state.auction) {
      const auction = engine.state.auction;
      auction.participantIds = auction.participantIds.filter((playerId) => playerId !== actorId);
      auction.passedPlayerIds = auction.passedPlayerIds.filter((playerId) => playerId !== actorId);

      if (auction.currentBidderId === actorId) {
        auction.currentBidderId = null;
        auction.currentBid = 0;
      }

      if (auction.activeBidderId === actorId) {
        auction.activeBidderId = auction.participantIds.find((playerId) => !auction.passedPlayerIds.includes(playerId)) || null;
      }

      if (auction.participantIds.length === 0) {
        engine.finalizeAuction(null);
      }
    }

    if (engine.state.pendingPurchase?.playerId === actorId) {
      engine.state.pendingPurchase = null;
    }

    if (engine.state.pendingCard?.playerId === actorId) {
      engine.state.pendingCard = null;
    }

    if (engine.state.pendingTax?.playerId === actorId) {
      engine.state.pendingTax = null;
    }

    if (engine.state.pendingRentClaim && (
      engine.state.pendingRentClaim.ownerId === actorId ||
      engine.state.pendingRentClaim.debtorId === actorId
    )) {
      engine.state.pendingRentClaim = null;
    }

    if (engine.state.pendingDebt?.debtorId === actorId) {
      engine.state.pendingDebt = null;
      engine.state.pendingContinuation = null;
    }

    if (Array.isArray(engine.state.tradeOffers)) {
      engine.state.tradeOffers = engine.state.tradeOffers.filter((offer) => (
        offer.sellerId !== actorId && offer.buyerId !== actorId
      ));
    }

    engine.log("PLAYER_FORFEITED", { playerId: actorId, reason });
    engine.resolveBankruptcy(player, "BANCO", null, reason);
    engine.checkGameEnd(Date.now());
  }

  function creditMonopolyActivityIfEligible(config, actorId, turns) {
    if (typeof recordPlayActivity !== "function") return;
    if (!Number.isInteger(actorId)) return;
    if (Number(turns || 0) < MONOPOLY_MIN_TURNS_FOR_ACTIVITY) return;
    if (!Array.isArray(config.activityCreditedIds)) {
      config.activityCreditedIds = [];
    }
    if (config.activityCreditedIds.includes(actorId)) return;

    config.activityCreditedIds.push(actorId);
    recordPlayActivity(actorId, { monopolyTurns: turns });
  }

  function removePlayerFromTableConfig(config, actorId) {
    config.seatedPlayerIds = config.seatedPlayerIds.filter((playerId) => playerId !== actorId);
    if (config.hostId === actorId) {
      config.hostId = config.seatedPlayerIds[0] || null;
    }
  }

  return {
    refreshUserPresentation,
    async listTables(worldId) {
      return buildTablesPayload(worldId);
    },

    async getState({ worldId, tableId = null }) {
      if (!tableId) {
        return {
          worldId,
          tableId: null,
          tables: (await buildTablesPayload(worldId)).tables,
          table: null
        };
      }

      const [tablesPayload, tablePayload] = await Promise.all([
        buildTablesPayload(worldId),
        buildTableStatePayload(worldId, tableId)
      ]);

      return {
        worldId,
        tableId,
        tables: tablesPayload.tables,
        table: tablePayload.table
      };
    },

    async createTable({ worldId, actorId, name, mode, timedMinutes, turnTimeSeconds, maxPlayers, isPrivate, password, eyconStake }) {
      return queueByKey(`monopoly-world:${worldId}`, async () => {
        await assertPlayerCanSeat(worldId, actorId);

        const wantsPrivate = Boolean(isPrivate);
        const cleanPassword = wantsPrivate ? String(password || "").trim().slice(0, 32) : "";
        if (wantsPrivate && !cleanPassword) {
          throw asClientError(new Error("Una sala privada necesita contraseña"));
        }

        const stakeUnits = Math.max(0, Math.min(100, Math.floor(Number(eyconStake) || 0)));
        if (stakeUnits > 0 && stakeUnits < 1) {
          throw asClientError(new Error("La apuesta EyCon minima es 0.01"));
        }

        const tableId = crypto.randomUUID();
        const config = {
          hostId: actorId,
          mode: mode || "NORMAL",
          timedMinutes: Number(timedMinutes || 60),
          turnTimeSeconds: Number(turnTimeSeconds || 60),
          maxPlayers: clampMaxPlayers(maxPlayers),
          isPrivate: wantsPrivate,
          password: cleanPassword,
          seatedPlayerIds: [actorId],
          turnOrderRolls: [],
          turnOrderStartedAt: null,
          turnOrderCompletedAt: null,
          eyconRewardEligible: true,
          eyconStakeUnits: stakeUnits,
          eyconStakeParticipants: [],
          createdAt: new Date().toISOString()
        };

        await run(
          `
            INSERT INTO monopoly_tables (
              id,
              world_id,
              name,
              status,
              config_json,
              state_json,
              created_by,
              updated_by,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
          `,
          [
            tableId,
            worldId,
            String(name || BOLOWPOLY_DEFAULT_TABLE).trim().slice(0, 48) || BOLOWPOLY_DEFAULT_TABLE,
            TABLE_STATUS.WAITING,
            JSON.stringify(config),
            actorId,
            actorId
          ]
        );

        return emitAll(worldId, tableId);
      });
    },

    async joinTable({ worldId, tableId, actorId, password }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        await assertPlayerCanSeat(worldId, actorId, tableId);
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        const config = parseConfig(row);
        const alreadySeated = config.seatedPlayerIds.includes(actorId);

        if (row.status !== TABLE_STATUS.WAITING) {
          if (alreadySeated) {
            return emitAll(worldId, tableId);
          }
          throw asClientError(new Error("La partida ya empezo"));
        }

        if (!alreadySeated && config.isPrivate && config.password) {
          if (String(password || "").trim() !== config.password) {
            throw asClientError(new Error("Contraseña incorrecta"), "Contraseña incorrecta", 403);
          }
        }

        if (!alreadySeated && config.seatedPlayerIds.length >= config.maxPlayers) {
          throw asClientError(new Error("La sala está llena"));
        }

        if (!alreadySeated) {
          config.seatedPlayerIds.push(actorId);
        }

        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config,
          stateJson: row.stateJson,
          updatedBy: actorId
        });

        return emitAll(worldId, tableId);
      });
    },

    async leaveTable({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        const config = parseConfig(row);
        const isSeated = config.seatedPlayerIds.includes(actorId);

        if (!isSeated) {
          throw asClientError(new Error("No estas sentado en esta mesa"));
        }

        if (row.status === TABLE_STATUS.PLAYING) {
          throw asClientError(new Error("Usa rendirte para salir de una partida en curso"));
        }

        removePlayerFromTableConfig(config, actorId);
        if (row.status === TABLE_STATUS.ORDERING) {
          resetTurnOrderConfig(config);
          row.status = TABLE_STATUS.WAITING;
        }

        if (config.seatedPlayerIds.length === 0) {
          await deleteTableRow(tableId);
          return emitAll(worldId, null);
        }

        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config,
          stateJson: row.status === TABLE_STATUS.WAITING ? null : row.stateJson,
          updatedBy: actorId
        });

        return emitAll(worldId, tableId);
      });
    },

    async surrender({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        const config = parseConfig(row);
        if (!config.seatedPlayerIds.includes(actorId)) {
          throw asClientError(new Error("No estas sentado en esta mesa"));
        }

        if (row.status !== TABLE_STATUS.PLAYING || !row.stateJson) {
          const wasOrdering = row.status === TABLE_STATUS.ORDERING;
          removePlayerFromTableConfig(config, actorId);
          if (wasOrdering) {
            resetTurnOrderConfig(config);
            row.status = TABLE_STATUS.WAITING;
            if (config.eyconStakeParticipants.length && typeof refundEyconStakes === "function") {
              const toRefund = config.eyconStakeParticipants;
              const stakeAmount = Number(config.eyconStakeUnits || 0);
              config.eyconStakeParticipants = [];
              await refundEyconStakes(tableId, toRefund, stakeAmount).catch((error) => {
                console.error("No se pudo reembolsar la apuesta EyCon de Monopoly", error);
              });
            }
          }

          if (config.seatedPlayerIds.length === 0) {
            await deleteTableRow(tableId);
            return emitAll(worldId, null);
          }

          await saveTableRow(row, {
            name: row.name,
            status: row.status,
            config,
            stateJson: row.status === TABLE_STATUS.WAITING ? null : row.stateJson,
            updatedBy: actorId
          });

          return emitAll(worldId, tableId);
        }

        const engine = await loadEngineFromRow(row);
        config.eyconRewardEligible = false;
        try {
          await forcePlayerBankruptcy(engine, actorId, "SALIDA_DE_PARTIDA");
        } catch (error) {
          throw asClientError(error, "No se pudo abandonar la partida");
        }

        creditMonopolyActivityIfEligible(config, actorId, engine.getState().turn?.number);
        removePlayerFromTableConfig(config, actorId);
        syncRowStatusFromEngine(row, engine);

        if (row.status === TABLE_STATUS.FINISHED) {
          clearTurnTimer(row.id);
        }

        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config,
          stateJson: JSON.stringify(engine.getState()),
          updatedBy: actorId
        });

        const response = await emitAll(worldId, tableId);
        const nextRow = await getTableRow(tableId);
        if (nextRow?.status === TABLE_STATUS.FINISHED) {
          await onGameFinished({
            tableId,
            worldId,
            state: engine.getState(),
            config: parseConfig(nextRow)
          }).catch((error) => {
            console.error("No se pudo finalizar recompensas de Monopoly", error);
          });
          scheduleFinishedCleanup(nextRow);
        } else if (nextRow) {
          await scheduleTurnTimeoutForRow(nextRow);
        }

        return response;
      });
    },

    async closeTable({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        await assertHost(row, actorId);
        if (row.status === TABLE_STATUS.PLAYING) {
          throw asClientError(new Error("No puedes cerrar una mesa con la partida en curso"));
        }
        const config = parseConfig(row);
        if (config.eyconStakeParticipants.length && typeof refundEyconStakes === "function") {
          await refundEyconStakes(tableId, config.eyconStakeParticipants, Number(config.eyconStakeUnits || 0)).catch((error) => {
            console.error("No se pudo reembolsar la apuesta EyCon al cerrar la mesa", error);
          });
        }
        await deleteTableRow(tableId);
        return emitAll(worldId, null);
      });
    },

    async startGame({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        await assertHost(row, actorId);

        if (row.status === TABLE_STATUS.ORDERING) {
          return emitAll(worldId, tableId);
        }

        if (row.status !== TABLE_STATUS.WAITING) {
          throw asClientError(new Error("La mesa ya esta en curso"));
        }

        const config = parseConfig(row);
        const playersById = await mapPlayersById(worldId, config.seatedPlayerIds);
        const players = config.seatedPlayerIds.map((playerId) => playersById.get(playerId)).filter(Boolean);

        if (players.length < 2) {
          throw asClientError(new Error("Necesitas al menos 2 jugadores sentados"));
        }

        const stakeUnits = Number(config.eyconStakeUnits || 0);
        if (stakeUnits > 0) {
          if (typeof chargeEyconStakes !== "function") {
            throw asClientError(new Error("Las apuestas EyCon no estan disponibles en este momento"));
          }
          try {
            await chargeEyconStakes(tableId, config.seatedPlayerIds, stakeUnits);
          } catch (error) {
            throw asClientError(error, "No se pudo cobrar la apuesta EyCon a todos los jugadores");
          }
          config.eyconStakeParticipants = [...config.seatedPlayerIds];
        }

        resetTurnOrderConfig(config);
        config.turnOrderStartedAt = new Date().toISOString();
        row.status = TABLE_STATUS.ORDERING;
        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config,
          stateJson: null,
          updatedBy: actorId
        });

        return emitAll(worldId, tableId);
      });
    },

    async rollTurnOrder({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        if (row.status !== TABLE_STATUS.ORDERING) {
          throw asClientError(new Error("El sorteo de turnos no esta activo"));
        }

        const config = parseConfig(row);
        if (!config.seatedPlayerIds.includes(actorId)) {
          throw asClientError(new Error("No estas sentado en esta mesa"));
        }
        if (config.turnOrderRolls.some((roll) => roll.playerId === actorId)) {
          throw asClientError(new Error("Ya tiraste los dados para definir tu turno"));
        }

        const rolledAt = new Date().toISOString();
        const roll = {
          playerId: actorId,
          ...rollTurnOrderDice(),
          rolledAt
        };
        config.turnOrderRolls = [
          ...config.turnOrderRolls.filter((existing) => existing.playerId !== actorId),
          roll
        ];

        const playersById = await mapPlayersById(worldId, config.seatedPlayerIds);
        const turnOrder = buildTurnOrderState(config, playersById);
        if (!turnOrder.complete) {
          await saveTableRow(row, {
            name: row.name,
            status: row.status,
            config,
            stateJson: null,
            updatedBy: actorId
          });
          return {
            ...(await emitAll(worldId, tableId)),
            rolled: roll
          };
        }

        const orderedPlayerIds = turnOrder.ranking.map((entry) => entry.playerId);
        const orderedPlayers = orderedPlayerIds.map((playerId) => playersById.get(playerId)).filter(Boolean);

        if (orderedPlayers.length < 2) {
          throw asClientError(new Error("Necesitas al menos 2 jugadores disponibles"));
        }

        const { MonopolyGameEngine, buildGameSnapshot } = await loadMonopolyModule();
        const engine = new MonopolyGameEngine({
          players: orderedPlayers,
          mode: config.mode,
          endAt: pickTimedEndAt(config.mode, config.timedMinutes)
        });

        engine.iniciarPartida();
        row.status = TABLE_STATUS.PLAYING;
        config.seatedPlayerIds = orderedPlayerIds;
        config.turnOrderCompletedAt = new Date().toISOString();
        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config,
          stateJson: JSON.stringify(engine.getState()),
          updatedBy: actorId
        });

        const payload = await emitAll(worldId, tableId);
        await scheduleTurnTimeoutForRow(await getTableRow(tableId));
        return {
          ...payload,
          rolled: roll,
          game: buildGameSnapshot(engine)
        };
      });
    },

    async performAction({ worldId, tableId, actorId, actionName, payload = {} }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error(`Mesa ${BOLOWPOLY_NAME} no encontrada`), "Mesa no encontrada", 404);
        }

        if (row.status !== TABLE_STATUS.PLAYING || !row.stateJson) {
          throw asClientError(new Error("No hay una partida activa en esta mesa"));
        }

        const engine = await loadEngineFromRow(row);

        try {
          if (actionName === "venderPropiedad") {
            actionName = "crearOfertaPropiedad";
          } else if (actionName === "comprarCartaSalirCarcel") {
            actionName = "crearOfertaCartaCarcel";
          }

          ensurePlayerCanAct(engine, actorId, actionName, payload);
          engine.ejecutarAccion(actionName, payload);
        } catch (error) {
          throw asClientError(error, `La accion de ${BOLOWPOLY_NAME} no es valida`);
        }

        syncRowStatusFromEngine(row, engine);
        await saveTableRow(row, {
          name: row.name,
          status: row.status,
          config: parseConfig(row),
          stateJson: JSON.stringify(engine.getState()),
          updatedBy: actorId
        });

        const nextRow = await getTableRow(tableId);
        const response = await emitAll(worldId, tableId);
        if (nextRow?.status === TABLE_STATUS.FINISHED) {
          await onGameFinished({
            tableId,
            worldId,
            state: engine.getState(),
            config: parseConfig(nextRow)
          }).catch((error) => {
            console.error("No se pudo finalizar recompensas de Monopoly", error);
          });
          scheduleFinishedCleanup(nextRow);
        } else if (nextRow) {
          await scheduleTurnTimeoutForRow(nextRow);
        }
        return response;
      });
    }
  };
}

module.exports = {
  createMonopolyService
};
