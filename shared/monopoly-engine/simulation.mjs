// ============================================================================
// Simulacion automatica de partidas de Monopoly
// ----------------------------------------------------------------------------
// Permite correr partidas completas conducidas por bots para:
//   - validar que los turnos avanzan y la partida finaliza,
//   - detectar errores de logica (excepciones del motor, estados invalidos),
//   - vigilar invariantes de dinero y propiedades,
//   - generar logs reproducibles (RNG determinista por semilla).
//
// Uso programatico:
//   import { simulateGame, simulateMany } from "./simulation.mjs";
//   const result = simulateGame({ players: 4, seed: 123 });
//
// Uso por CLI: ver simulate.mjs
// ============================================================================

import { MonopolyGameEngine } from "./engine.mjs";
import { GAME_STATUSES, GAME_MODES } from "./constants.mjs";
import { decideAction, BOT_TYPES } from "./bots.mjs";

// RNG determinista (mulberry32). Misma semilla => misma partida.
export function createSeededRandom(seed = 1) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Determina que jugador debe actuar a continuacion segun el estado.
export function whoActsNext(state) {
  if (state.status === GAME_STATUSES.FINALIZADO) return null;
  if (state.status === GAME_STATUSES.PREPARACION) {
    return state.turn.currentPlayerId || state.players[state.currentPlayerIndex]?.id || null;
  }
  if (state.auction) return state.auction.activeBidderId;
  if (state.pendingPurchase) return state.pendingPurchase.playerId;
  if (state.pendingCard) return state.pendingCard.playerId;
  if (state.pendingTax) return state.pendingTax.playerId;
  if (state.pendingDebt) return state.pendingDebt.debtorId;
  if (state.pendingRentClaim) return state.pendingRentClaim.ownerId;
  return state.turn.currentPlayerId;
}

const OWNABLE_TYPES = new Set(["PROPIEDAD", "FERROCARRIL", "SERVICIO_PUBLICO"]);

// Huella ligera del estado para detectar si una accion hizo avanzar la partida.
// El motor usa algunas excepciones como senal de control (p.ej. una deuda
// diferida con el banco que "aflora" al intentar tirar dados): en esos casos el
// estado SI cambia aunque se lance una excepcion. Comparando la huella antes y
// despues distinguimos una senal legitima de un error real (las aserciones del
// motor lanzan sin mutar, dejando la huella intacta).
function stateSignature(state) {
  const cashSum = state.players.reduce((total, player) => total + player.cash, 0);
  const bankrupts = state.players.filter((player) => player.bankrupt).length;
  return [
    state.status,
    state.turn.phase,
    state.turn.number,
    state.turn.currentPlayerId,
    state.pendingDebt ? `D:${state.pendingDebt.debtorId}:${state.pendingDebt.amount}` : "",
    state.pendingPurchase ? "P" : "",
    state.pendingCard ? "C" : "",
    state.pendingTax ? "T" : "",
    state.auction ? `A:${state.auction.currentBid}:${state.auction.activeBidderId}` : "",
    cashSum,
    bankrupts
  ].join("|");
}

// Comprueba invariantes basicas sobre el estado. Devuelve un array de strings
// (vacio si todo esta bien). Estas son las "reglas que nunca deben romperse".
export function checkInvariants(state) {
  const problems = [];
  const playersById = new Map(state.players.map((p) => [p.id, p]));

  let activeCount = 0;
  for (const player of state.players) {
    if (!Number.isFinite(player.cash)) {
      problems.push(`Efectivo no finito en ${player.id}: ${player.cash}`);
    }
    if (player.cash < 0) {
      problems.push(`Efectivo negativo en ${player.id}: ${player.cash}`);
    }
    if (player.bankrupt) {
      if (player.cash !== 0) {
        problems.push(`Jugador en quiebra ${player.id} con efectivo ${player.cash} (deberia ser 0)`);
      }
      if (player.propertyIds.length > 0) {
        problems.push(`Jugador en quiebra ${player.id} todavia posee propiedades`);
      }
    } else {
      activeCount += 1;
    }
  }

  // Consistencia de propietarios en el tablero.
  for (const space of state.board.spaces) {
    if (!OWNABLE_TYPES.has(space.type)) continue;
    if (!space.ownerId) continue;
    const owner = playersById.get(space.ownerId);
    if (!owner) {
      problems.push(`Casilla ${space.id} pertenece a un jugador inexistente ${space.ownerId}`);
    } else if (owner.bankrupt) {
      problems.push(`Casilla ${space.id} pertenece a un jugador en quiebra ${space.ownerId}`);
    } else if (!owner.propertyIds.includes(space.id)) {
      problems.push(`Casilla ${space.id} marca dueno ${space.ownerId} pero no aparece en sus propiedades`);
    }
  }

  if (state.status !== GAME_STATUSES.FINALIZADO && activeCount === 0) {
    problems.push("No quedan jugadores activos pero la partida no esta finalizada");
  }

  return problems;
}

function normalizeBotTypes(players, botTypes) {
  const cycle = botTypes && botTypes.length
    ? botTypes
    : [BOT_TYPES.AGGRESSIVE, BOT_TYPES.CONSERVATIVE, BOT_TYPES.BASIC];
  const map = {};
  for (let i = 0; i < players; i += 1) {
    map[`bot_${i + 1}`] = cycle[i % cycle.length];
  }
  return map;
}

// Corre UNA partida completa. Opciones:
//   players      cantidad de jugadores (default 4)
//   botTypes     array de BOT_TYPES asignado ciclicamente
//   mode         GAME_MODES (default NORMAL)
//   seed         semilla del RNG (default aleatoria)
//   maxSteps     tope de acciones para evitar bucles infinitos
//   keepLog      si true, guarda el log completo de acciones
export function simulateGame(options = {}) {
  const {
    players = 4,
    botTypes = null,
    mode = GAME_MODES.NORMAL,
    seed = (Math.random() * 0xffffffff) >>> 0,
    maxSteps = 50000,
    keepLog = false,
    engineOptions = {}
  } = options;

  const random = createSeededRandom(seed);
  const typeByPlayer = normalizeBotTypes(players, botTypes);
  const playerConfigs = Object.keys(typeByPlayer).map((id, index) => ({
    id,
    name: `${typeByPlayer[id]}-${index + 1}`
  }));

  // liveState: la simulacion trata el estado como solo-lectura, por lo que no
  // necesita el clon defensivo de getState() en cada accion (gran ahorro de CPU
  // en partidas largas). La app real NO usa esta opcion.
  const engine = new MonopolyGameEngine({ players: playerConfigs, mode, random, options: engineOptions, liveState: true });

  const errors = [];
  const log = [];
  const actionCounts = {};
  let steps = 0;
  let stalled = false;

  while (steps < maxSteps) {
    const state = engine.state; // lectura directa (no se muta)
    if (state.status === GAME_STATUSES.FINALIZADO) break;

    const actorId = whoActsNext(state);
    if (!actorId) {
      errors.push({ step: steps, type: "SIN_ACTOR", message: "No se pudo determinar quien debe actuar" });
      stalled = true;
      break;
    }

    const botType = typeByPlayer[actorId] || BOT_TYPES.BASIC;
    let decision;
    try {
      decision = decideAction(engine, actorId, botType);
    } catch (error) {
      errors.push({ step: steps, type: "ERROR_DECISION", actorId, message: error.message });
      break;
    }

    if (!decision) {
      errors.push({
        step: steps,
        type: "SIN_DECISION",
        actorId,
        message: `El bot ${botType} no pudo decidir. Acciones: ${engine.listarAccionesDisponibles({ playerId: actorId }).join(", ") || "ninguna"}`
      });
      stalled = true;
      break;
    }

    const signatureBefore = stateSignature(engine.state);
    let signal = null;
    let fatal = false;
    try {
      engine.ejecutarAccion(decision.action, decision.payload || {});
    } catch (error) {
      const advanced = stateSignature(engine.state) !== signatureBefore;
      if (advanced) {
        // Excepcion usada como senal de control: el estado avanzo, continuamos.
        signal = error.message;
      } else {
        errors.push({
          step: steps,
          type: "ERROR_MOTOR",
          actorId,
          action: decision.action,
          payload: decision.payload || null,
          message: error.message
        });
        fatal = true;
      }
    }

    if (fatal) break;

    actionCounts[decision.action] = (actionCounts[decision.action] || 0) + 1;
    if (keepLog) {
      log.push({ step: steps, actorId, action: decision.action, payload: decision.payload || null, signal });
    }

    const invariantProblems = checkInvariants(engine.state);
    if (invariantProblems.length > 0) {
      for (const message of invariantProblems) {
        errors.push({ step: steps, type: "INVARIANTE", actorId, action: decision.action, message });
      }
      break;
    }

    steps += 1;
  }

  const finalState = engine.getState();
  const finished = finalState.status === GAME_STATUSES.FINALIZADO;
  const reachedStepCap = steps >= maxSteps;
  const winner = engine.consultarGanador();

  return {
    seed,
    mode,
    players,
    botTypes: typeByPlayer,
    steps,
    turns: finalState.turn.number,
    finished,
    stalled,
    reachedStepCap,
    winnerId: winner ? winner.id : finalState.winnerId || null,
    winnerType: winner ? typeByPlayer[winner.id] : null,
    ranking: engine.rankearJugadores(),
    actionCounts,
    errors,
    log: keepLog ? log : undefined,
    ok: errors.length === 0 && (finished || reachedStepCap) && !stalled
  };
}

// Corre un LOTE de partidas y agrega resultados. Util para encontrar bugs raros.
export function simulateMany(options = {}) {
  const {
    runs = 50,
    baseSeed = 1,
    players = 4,
    botTypes = null,
    mode = GAME_MODES.NORMAL,
    maxSteps = 50000,
    engineOptions = {}
  } = options;

  const summary = {
    runs,
    finished: 0,
    withErrors: 0,
    stalled: 0,
    reachedStepCap: 0,
    totalSteps: 0,
    totalTurns: 0,
    winsByType: {},
    failures: []
  };

  for (let i = 0; i < runs; i += 1) {
    const result = simulateGame({
      players,
      botTypes,
      mode,
      seed: baseSeed + i,
      maxSteps,
      engineOptions
    });

    summary.totalSteps += result.steps;
    summary.totalTurns += result.turns;
    if (result.finished) summary.finished += 1;
    if (result.stalled) summary.stalled += 1;
    if (result.reachedStepCap) summary.reachedStepCap += 1;
    if (result.errors.length > 0) {
      summary.withErrors += 1;
      summary.failures.push({ seed: result.seed, errors: result.errors.slice(0, 5) });
    }
    if (result.winnerType) {
      summary.winsByType[result.winnerType] = (summary.winsByType[result.winnerType] || 0) + 1;
    }
  }

  summary.avgSteps = Math.round(summary.totalSteps / runs);
  summary.avgTurns = Math.round(summary.totalTurns / runs);
  summary.ok = summary.withErrors === 0 && summary.stalled === 0;
  return summary;
}
