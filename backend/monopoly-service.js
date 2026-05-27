const crypto = require("crypto");
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
  PLAYING: "PLAYING",
  FINISHED: "FINISHED"
});

let modulePromise = null;

function asClientError(error, fallbackMessage = "No se pudo completar la accion de Monopoly", status = 400) {
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
    const modulePath = pathToFileURL(path.join(__dirname, "shared", "monopoly-engine", "index.mjs")).href;
    modulePromise = import(modulePath);
  }

  return modulePromise;
}

function createMonopolyService({ get, run, all, io, roomName }) {
  const queues = new Map();
  const turnTimers = new Map();

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
    return {
      hostId: config.hostId || row.createdBy,
      mode: config.mode || "NORMAL",
      timedMinutes: Number(config.timedMinutes || 60),
      turnTimeSeconds: Number(config.turnTimeSeconds || 60),
      seatedPlayerIds: Array.isArray(config.seatedPlayerIds) ? config.seatedPlayerIds.map(Number).filter(Number.isInteger) : [],
      createdAt: config.createdAt || row.createdAt
    };
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
    await run("DELETE FROM monopoly_tables WHERE id = ?", [tableId]);
  }

  async function listPlayersForWorld(worldId) {
    return all(
      `
        SELECT
          users.id AS id,
          users.username AS name,
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
    const byId = new Map(rows.map((row) => [row.id, row]));

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
      hostId: config.hostId,
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
        inJail: Boolean(player.inJail)
      })),
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
    const game = engine ? buildGameSnapshot(engine) : null;

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
        turnDeadlineAt: turnTimers.get(row.id)?.deadlineAt || null,
        hostId: config.hostId,
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
            inJail: Boolean(gamePlayer?.inJail)
          };
        }),
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

  async function assertPlayerCanSeat(worldId, actorId, excludedTableId = null) {
    const rows = await listTableRows(worldId);
    for (const row of rows) {
      if (excludedTableId && row.id === excludedTableId) {
        continue;
      }

      const config = parseConfig(row);
      if (
        config.seatedPlayerIds.includes(actorId) &&
        [TABLE_STATUS.WAITING, TABLE_STATUS.PLAYING].includes(row.status)
      ) {
        throw asClientError(new Error("Ya estas sentado en otra mesa de Monopoly de este mundo"));
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
      return {
        actorId: engine.state.pendingDebt.debtorId,
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
          await scheduleTurnTimeoutForRow(freshRow);
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
      throw new Error("No puedes rendirte durante una subasta activa");
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

    engine.log("PLAYER_FORFEITED", { playerId: actorId, reason });
    engine.resolveBankruptcy(player, "BANCO", null, reason);
    engine.checkGameEnd(Date.now());
  }

  return {
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

    async createTable({ worldId, actorId, name, mode, timedMinutes, turnTimeSeconds }) {
      return queueByKey(`monopoly-world:${worldId}`, async () => {
        await assertPlayerCanSeat(worldId, actorId);

        const tableId = crypto.randomUUID();
        const config = {
          hostId: actorId,
          mode: mode || "NORMAL",
          timedMinutes: Number(timedMinutes || 60),
          turnTimeSeconds: Number(turnTimeSeconds || 60),
          seatedPlayerIds: [actorId],
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
            String(name || "Mesa Monopoly").trim().slice(0, 48) || "Mesa Monopoly",
            TABLE_STATUS.WAITING,
            JSON.stringify(config),
            actorId,
            actorId
          ]
        );

        return emitAll(worldId, tableId);
      });
    },

    async joinTable({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        await assertPlayerCanSeat(worldId, actorId, tableId);
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        if (row.status !== TABLE_STATUS.WAITING) {
          throw asClientError(new Error("La partida ya empezo"));
        }

        const config = parseConfig(row);
        if (!config.seatedPlayerIds.includes(actorId)) {
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
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        const config = parseConfig(row);
        const isSeated = config.seatedPlayerIds.includes(actorId);

        if (!isSeated) {
          throw asClientError(new Error("No estas sentado en esta mesa"));
        }

        if (row.status === TABLE_STATUS.PLAYING) {
          throw asClientError(new Error("Usa rendirte para salir de una partida en curso"));
        }

        config.seatedPlayerIds = config.seatedPlayerIds.filter((playerId) => playerId !== actorId);
        if (config.hostId === actorId) {
          config.hostId = config.seatedPlayerIds[0] || null;
        }

        if (config.seatedPlayerIds.length === 0) {
          await deleteTableRow(tableId);
          return emitAll(worldId, null);
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

    async closeTable({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        await assertHost(row, actorId);
        if (row.status === TABLE_STATUS.PLAYING) {
          throw asClientError(new Error("No puedes cerrar una mesa con la partida en curso"));
        }
        await deleteTableRow(tableId);
        return emitAll(worldId, null);
      });
    },

    async startGame({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        await assertHost(row, actorId);

        if (row.status !== TABLE_STATUS.WAITING) {
          throw asClientError(new Error("La mesa ya esta en curso"));
        }

        const config = parseConfig(row);
        const playersById = await mapPlayersById(worldId, config.seatedPlayerIds);
        const players = config.seatedPlayerIds.map((playerId) => playersById.get(playerId)).filter(Boolean);

        if (players.length < 2) {
          throw asClientError(new Error("Necesitas al menos 2 jugadores sentados"));
        }

        const { MonopolyGameEngine, buildGameSnapshot } = await loadMonopolyModule();
        const engine = new MonopolyGameEngine({
          players,
          mode: config.mode,
          endAt: pickTimedEndAt(config.mode, config.timedMinutes)
        });

        engine.iniciarPartida();
        row.status = TABLE_STATUS.PLAYING;
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
          game: buildGameSnapshot(engine)
        };
      });
    },

    async performAction({ worldId, tableId, actorId, actionName, payload = {} }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        if (row.status !== TABLE_STATUS.PLAYING || !row.stateJson) {
          throw asClientError(new Error("No hay una partida activa en esta mesa"));
        }

        const engine = await loadEngineFromRow(row);

        try {
          ensurePlayerCanAct(engine, actorId, actionName, payload);
          engine.ejecutarAccion(actionName, payload);
        } catch (error) {
          throw asClientError(error, "La accion de Monopoly no es valida");
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
        await scheduleTurnTimeoutForRow(nextRow);
        return response;
      });
    },

    async surrender({ worldId, tableId, actorId }) {
      return queueByKey(`monopoly:${tableId}`, async () => {
        const row = await getTableRow(tableId);

        if (!row || row.worldId !== worldId) {
          throw asClientError(new Error("Mesa Monopoly no encontrada"), "Mesa no encontrada", 404);
        }

        if (row.status !== TABLE_STATUS.PLAYING || !row.stateJson) {
          throw asClientError(new Error("No hay una partida activa en esta mesa"));
        }

        const engine = await loadEngineFromRow(row);
        const actor = engine.getState().players.find((player) => player.id === actorId);

        if (!actor) {
          throw asClientError(new Error("No formas parte de esta mesa"));
        }

        try {
          await forcePlayerBankruptcy(engine, actorId, "RENDICION");
        } catch (error) {
          throw asClientError(error, "No se pudo rendir la partida");
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
        await scheduleTurnTimeoutForRow(nextRow);
        return response;
      });
    }
  };
}

module.exports = {
  createMonopolyService
};
