// ============================================================================
// Runner CLI de simulacion de Monopoly
// ----------------------------------------------------------------------------
// Ejemplos:
//   node shared/monopoly-engine/simulate.mjs --runs 100
//   node shared/monopoly-engine/simulate.mjs --runs 1 --players 4 --seed 42 --verbose
//   node shared/monopoly-engine/simulate.mjs --mode SHORT --runs 200
//
// Sale con codigo 1 si detecta errores de logica o partidas atascadas, para
// poder usarlo en integracion continua.
// ============================================================================

import { simulateGame, simulateMany } from "./simulation.mjs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const runs = Number(args.runs || 50);
const players = Number(args.players || 4);
const mode = args.mode || "NORMAL";
const maxSteps = Number(args.maxSteps || 50000);
const botTypes = args.bots ? String(args.bots).split(",") : null;

if (runs === 1) {
  const seed = args.seed !== undefined ? Number(args.seed) : (Math.random() * 0xffffffff) >>> 0;
  const result = simulateGame({ players, mode, seed, maxSteps, botTypes, keepLog: Boolean(args.verbose) });

  console.log("=== Simulacion de 1 partida ===");
  console.log(`Semilla:      ${result.seed}`);
  console.log(`Modo:         ${result.mode}`);
  console.log(`Jugadores:    ${result.players} (${Object.values(result.botTypes).join(", ")})`);
  console.log(`Pasos:        ${result.steps}`);
  console.log(`Turnos:       ${result.turns}`);
  console.log(`Finalizada:   ${result.finished}`);
  console.log(`Atascada:     ${result.stalled}`);
  console.log(`Tope pasos:   ${result.reachedStepCap}`);
  console.log(`Ganador:      ${result.winnerId || "-"} (${result.winnerType || "-"})`);
  console.log("Ranking:");
  for (const entry of result.ranking) {
    console.log(`  ${entry.name}: riqueza ${entry.wealth}`);
  }
  console.log("Acciones ejecutadas:", result.actionCounts);

  if (result.errors.length > 0) {
    console.log(`\n!! ${result.errors.length} ERRORES detectados:`);
    for (const error of result.errors) {
      console.log(`  [${error.type}] paso ${error.step} ${error.action || ""} -> ${error.message}`);
    }
  }
  if (args.verbose && result.log) {
    console.log("\nLog de acciones:");
    for (const entry of result.log) {
      console.log(`  ${entry.step}: ${entry.actorId} -> ${entry.action}`);
    }
  }

  process.exit(result.ok ? 0 : 1);
} else {
  const baseSeed = args.seed !== undefined ? Number(args.seed) : 1;
  const summary = simulateMany({ runs, players, mode, maxSteps, botTypes, baseSeed });

  console.log(`=== Simulacion de ${summary.runs} partidas (modo ${mode}, ${players} jugadores) ===`);
  console.log(`Finalizadas:        ${summary.finished}/${summary.runs}`);
  console.log(`Con errores:        ${summary.withErrors}`);
  console.log(`Atascadas:          ${summary.stalled}`);
  console.log(`Llegaron al tope:   ${summary.reachedStepCap}`);
  console.log(`Promedio de pasos:  ${summary.avgSteps}`);
  console.log(`Promedio de turnos: ${summary.avgTurns}`);
  console.log("Victorias por tipo:", summary.winsByType);

  if (summary.failures.length > 0) {
    console.log(`\n!! Partidas con problemas (mostrando hasta 10):`);
    for (const failure of summary.failures.slice(0, 10)) {
      console.log(`  Semilla ${failure.seed}:`);
      for (const error of failure.errors) {
        console.log(`    [${error.type}] paso ${error.step} ${error.action || ""} -> ${error.message}`);
      }
    }
  }

  console.log(`\nResultado global: ${summary.ok ? "OK (sin errores de logica)" : "FALLOS DETECTADOS"}`);
  process.exit(summary.ok ? 0 : 1);
}
