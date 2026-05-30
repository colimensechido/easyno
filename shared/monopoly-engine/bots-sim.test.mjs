// ============================================================================
// Tests de bots y simulacion de Monopoly
// ----------------------------------------------------------------------------
// Validan que:
//   - el RNG sembrado es determinista,
//   - la simulacion es reproducible (misma semilla => mismo resultado),
//   - las partidas de 2 jugadores finalizan con un ganador valido,
//   - los bots siempre saben decidir cuando hay acciones disponibles,
//   - no se rompen invariantes de dinero/propiedades en partidas largas,
//   - simulateMany agrega resultados sin errores ni atascos,
//   - el bug de "tirar dados en la carcel al final del turno" no regresa.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { MonopolyGameEngine } from "./engine.mjs";
import { GAME_STATUSES, TURN_PHASES } from "./constants.mjs";
import { BOT_TYPES, decideAction, getBotProfile } from "./bots.mjs";
import {
  createSeededRandom,
  whoActsNext,
  checkInvariants,
  simulateGame,
  simulateMany
} from "./simulation.mjs";

test("createSeededRandom es determinista para la misma semilla", () => {
  const a = createSeededRandom(123);
  const b = createSeededRandom(123);
  const seqA = Array.from({ length: 5 }, () => a());
  const seqB = Array.from({ length: 5 }, () => b());
  assert.deepEqual(seqA, seqB);
  for (const value of seqA) {
    assert.ok(value >= 0 && value < 1, `valor fuera de rango: ${value}`);
  }
});

test("createSeededRandom produce secuencias distintas para semillas distintas", () => {
  const a = createSeededRandom(1);
  const b = createSeededRandom(2);
  assert.notDeepEqual(
    Array.from({ length: 5 }, () => a()),
    Array.from({ length: 5 }, () => b())
  );
});

test("simulateGame es reproducible con la misma semilla", () => {
  const r1 = simulateGame({ players: 4, seed: 7, maxSteps: 8000 });
  const r2 = simulateGame({ players: 4, seed: 7, maxSteps: 8000 });
  assert.equal(r1.steps, r2.steps);
  assert.equal(r1.turns, r2.turns);
  assert.equal(r1.finished, r2.finished);
  assert.equal(r1.winnerId, r2.winnerId);
  assert.deepEqual(r1.actionCounts, r2.actionCounts);
});

test("una partida de 2 jugadores finaliza con un ganador valido y sin errores", () => {
  // Con 2 jugadores las propiedades se concentran, se forman monopolios y la
  // partida termina por quiebra: asi ejercitamos el endgame del motor.
  const result = simulateGame({ players: 2, seed: 1, maxSteps: 8000 });
  assert.equal(result.errors.length, 0, JSON.stringify(result.errors));
  assert.ok(result.finished, "la partida de 2 jugadores deberia finalizar");
  assert.ok(result.winnerId, "deberia haber un ganador");
  assert.ok(result.ok, "el resultado deberia marcarse como ok");
  // El ganador debe ser uno de los jugadores y el ranking debe estar ordenado.
  const ids = Object.keys(result.botTypes);
  assert.ok(ids.includes(result.winnerId));
  const wealths = result.ranking.map((entry) => entry.wealth);
  const sorted = [...wealths].sort((a, b) => b - a);
  assert.deepEqual(wealths, sorted, "el ranking deberia ir de mayor a menor riqueza");
});

test("varias partidas de 2 jugadores finalizan sin romper invariantes", () => {
  for (let seed = 1; seed <= 8; seed += 1) {
    const result = simulateGame({ players: 2, seed, maxSteps: 8000 });
    assert.equal(result.errors.length, 0, `seed ${seed}: ${JSON.stringify(result.errors)}`);
    assert.ok(result.ok, `seed ${seed} no quedo ok`);
  }
});

test("regresion: jugador encarcelado al final del turno no rompe la simulacion", () => {
  // La semilla 42 (4 jugadores) reproducia el bug en el que un jugador caia en
  // la carcel tras sacar dobles: el motor listaba TIRAR_DADOS pero al ejecutarlo
  // lanzaba "El turno no esta listo para tirar dados". Debe correr limpio.
  const result = simulateGame({ players: 4, seed: 42, maxSteps: 8000 });
  const motorErrors = result.errors.filter((e) => e.type === "ERROR_MOTOR");
  assert.equal(motorErrors.length, 0, JSON.stringify(motorErrors));
  assert.equal(result.stalled, false);
});

test("listarAccionesDisponibles no ofrece TIRAR_DADOS en fase AWAITING_TURN_END estando en la carcel", () => {
  const engine = new MonopolyGameEngine({ players: ["Ana", "Luis"] });
  engine.iniciarPartida();
  const player = engine.currentPlayer();
  // Simulamos el estado "recien encarcelado al terminar el movimiento".
  player.jail.inJail = true;
  engine.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
  const actions = engine.listarAccionesDisponibles({ playerId: player.id });
  assert.ok(!actions.includes("tirarDados"), `no deberia poder tirar: ${actions.join(",")}`);
  assert.ok(actions.includes("terminarTurno"), "deberia poder terminar el turno");
});

test("los bots siempre deciden algo cuando hay acciones disponibles (partida completa)", () => {
  // Recorremos una partida y verificamos que en cada turno con acciones
  // disponibles el bot devuelve una decision (nunca null inesperado).
  const random = createSeededRandom(99);
  const typeByPlayer = { bot_1: BOT_TYPES.AGGRESSIVE, bot_2: BOT_TYPES.CONSERVATIVE };
  const engine = new MonopolyGameEngine({
    players: Object.keys(typeByPlayer).map((id) => ({ id, name: id })),
    random,
    liveState: true
  });

  let steps = 0;
  while (steps < 8000) {
    const state = engine.state;
    if (state.status === GAME_STATUSES.FINALIZADO) break;
    const actorId = whoActsNext(state);
    assert.ok(actorId, `paso ${steps}: no se determino actor`);
    const available = engine.listarAccionesDisponibles({ playerId: actorId });
    const decision = decideAction(engine, actorId, typeByPlayer[actorId]);
    if (available.length > 0) {
      assert.ok(decision, `paso ${steps}: bot sin decision con acciones [${available.join(",")}]`);
      assert.ok(available.includes(decision.action), `paso ${steps}: accion ${decision.action} no estaba disponible`);
    }
    try {
      engine.ejecutarAccion(decision.action, decision.payload || {});
    } catch {
      // Excepciones de control de flujo del motor: el bucle continua.
    }
    steps += 1;
  }
  assert.ok(steps > 0);
});

test("checkInvariants detecta efectivo negativo", () => {
  const engine = new MonopolyGameEngine({ players: ["Ana", "Luis"] });
  engine.iniciarPartida();
  engine.state.players[0].cash = -50;
  const problems = checkInvariants(engine.state);
  assert.ok(problems.some((p) => p.includes("negativo")), problems.join(" | "));
});

test("checkInvariants detecta propiedad de un jugador en quiebra", () => {
  const engine = new MonopolyGameEngine({ players: ["Ana", "Luis"] });
  engine.iniciarPartida();
  const space = engine.state.board.spaces.find((s) => s.type === "PROPIEDAD");
  space.ownerId = engine.state.players[0].id;
  engine.state.players[0].bankrupt = true;
  engine.state.players[0].cash = 0;
  engine.state.players[0].propertyIds = [];
  const problems = checkInvariants(engine.state);
  assert.ok(problems.some((p) => p.includes("quiebra")), problems.join(" | "));
});

test("checkInvariants no reporta problemas en un estado recien iniciado", () => {
  const engine = new MonopolyGameEngine({ players: ["Ana", "Luis", "Marta"] });
  engine.iniciarPartida();
  assert.deepEqual(checkInvariants(engine.state), []);
});

test("whoActsNext devuelve null cuando la partida esta finalizada", () => {
  const engine = new MonopolyGameEngine({ players: ["Ana", "Luis"] });
  engine.iniciarPartida();
  engine.state.status = GAME_STATUSES.FINALIZADO;
  assert.equal(whoActsNext(engine.state), null);
});

test("simulateMany agrega un lote de partidas de 2 jugadores sin errores ni atascos", () => {
  const summary = simulateMany({ runs: 8, players: 2, baseSeed: 1, maxSteps: 8000 });
  assert.equal(summary.runs, 8);
  assert.equal(summary.withErrors, 0, JSON.stringify(summary.failures));
  assert.equal(summary.stalled, 0);
  assert.ok(summary.ok, "el lote deberia marcarse ok");
  assert.ok(summary.finished >= 1, "al menos una partida deberia finalizar");
  assert.ok(summary.avgSteps > 0 && summary.avgTurns > 0);
  // Las victorias por tipo deben sumar (a lo sumo) las partidas finalizadas.
  const totalWins = Object.values(summary.winsByType).reduce((a, b) => a + b, 0);
  assert.ok(totalWins <= summary.finished);
});

test("los perfiles de bot existen y tienen los campos esperados", () => {
  for (const type of Object.values(BOT_TYPES)) {
    const profile = getBotProfile(type);
    assert.ok(profile);
    assert.equal(typeof profile.cashBuffer, "number");
    assert.equal(typeof profile.buildCashBuffer, "number");
    assert.equal(typeof profile.maxAuctionFactor, "number");
    assert.equal(typeof profile.buildsHotels, "boolean");
  }
  // Un tipo desconocido cae al perfil BASIC (defensivo).
  assert.deepEqual(getBotProfile("DESCONOCIDO"), getBotProfile(BOT_TYPES.BASIC));
});
