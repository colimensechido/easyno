import test from "node:test";
import assert from "node:assert/strict";

import { MonopolyGameEngine } from "./engine.mjs";
import { ENGINE_ACTIONS } from "./actions.mjs";
import { CREDITOR_TYPES, GAME_MODES, GAME_STATUSES, TURN_PHASES } from "./constants.mjs";

function createGame(overrides = {}) {
  const game = new MonopolyGameEngine({
    players: ["Ana", "Luis", "Marta"],
    ...overrides
  });

  game.iniciarPartida({ now: overrides.now || Date.now() });
  return game;
}

function setCurrentPlayer(game, playerId) {
  const nextIndex = game.state.players.findIndex((player) => player.id === playerId);
  game.state.currentPlayerIndex = nextIndex;
  game.state.turn.currentPlayerId = playerId;
  game.state.turn.phase = game.findPlayer(playerId).jail.inJail ? TURN_PHASES.AWAITING_JAIL_DECISION : TURN_PHASES.AWAITING_ROLL;
}

function clearAllOwnership(game) {
  for (const player of game.state.players) {
    player.propertyIds = [];
  }

  for (const space of game.state.board.spaces) {
    if (space.ownerId) {
      space.ownerId = null;
    }
    if ("houses" in space) {
      space.houses = 0;
    }
    if ("hasHotel" in space) {
      space.hasHotel = false;
    }
    if ("isMortgaged" in space) {
      space.isMortgaged = false;
    }
  }

  game.state.bank.propertyIds = game.state.board.spaces.filter((space) => space.ownerId === null && "price" in space).map((space) => space.id);
}

test("si el jugador no puede comprar una propiedad, se abre subasta y puede quedar sin ganador", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const current = game.currentPlayer();

  current.cash = 0;
  game.tirarDados({ dados: [1, 2] });
  assert.equal(game.state.pendingPurchase.propertyId, "baltic_avenue");

  game.comprarPropiedad();
  assert.equal(game.state.status, GAME_STATUSES.SUBASTA);

  game.retirarseDeSubasta({ jugadorId: "player_1" });
  game.retirarseDeSubasta({ jugadorId: "player_2" });

  assert.equal(game.findSpaceById("baltic_avenue").ownerId, null);
  assert.equal(game.state.auction, null);
});

test("tres dobles consecutivos envian al jugador a la carcel", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  const illinois = game.findSpaceById("illinois_avenue");

  game.assignPropertyToPlayer(illinois, player);
  player.position = 18;

  game.tirarDados({ dados: [1, 1] });
  game.terminarTurno();
  game.tirarDados({ dados: [2, 2] });
  game.terminarTurno();
  game.tirarDados({ dados: [3, 3] });

  assert.equal(player.jail.inJail, true);
  assert.equal(player.position, 10);
});

test("salir de la carcel con dobles no concede turno extra", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  game.sendPlayerToJail(player, "TEST");
  setCurrentPlayer(game, player.id);
  game.tirarDados({ dados: [5, 5] });
  game.terminarTurno();

  assert.equal(player.jail.inJail, false);
  assert.equal(player.position, 20);
  assert.equal(game.currentPlayer().id, "player_2");
});

test("en el tercer intento fallido de carcel se paga multa y se avanza", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  game.sendPlayerToJail(player, "TEST");
  setCurrentPlayer(game, player.id);

  game.tirarDados({ dados: [4, 6] });
  setCurrentPlayer(game, player.id);
  game.tirarDados({ dados: [4, 6] });
  setCurrentPlayer(game, player.id);
  game.tirarDados({ dados: [4, 6] });

  assert.equal(player.jail.inJail, false);
  assert.equal(player.position, 20);
  assert.equal(player.cash, 1450);
});

test("no se puede construir sin el grupo completo", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, player);

  assert.throws(() => game.comprarCasa("mediterranean_avenue"), /grupo completo/i);
});

test("solo el jugador del turno ve acciones de construccion e hipoteca", () => {
  const game = createGame({ players: ["Ana", "Luis"] });

  assert.ok(game.listarAccionesDisponibles({ playerId: "player_1" }).includes(ENGINE_ACTIONS.COMPRAR_CASA));
  assert.ok(!game.listarAccionesDisponibles({ playerId: "player_2" }).includes(ENGINE_ACTIONS.COMPRAR_CASA));
  assert.ok(!game.listarAccionesDisponibles({ playerId: "player_2" }).includes(ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD));
});

test("al pasar por salida el jugador cobra 200", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  player.position = 39;
  game.tirarDados({ dados: [1, 2] });

  assert.equal(player.cash, 1700);
  assert.equal(player.position, 2);
});

test("ir directamente a la carcel no paga 200 aunque el jugador este cerca de salida", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  player.position = 39;
  game.sendPlayerToJail(player, "TEST_DIRECT_JAIL");

  assert.equal(player.cash, 1500);
  assert.equal(player.position, 10);
  assert.equal(player.jail.inJail, true);
});

test("una propiedad hipotecada no cobra renta", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const owner = game.findPlayer("player_1");
  const visitor = game.findPlayer("player_2");
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, owner);
  mediterranean.isMortgaged = true;
  visitor.position = mediterranean.index;
  setCurrentPlayer(game, visitor.id);
  game.resolveCurrentSpace(visitor, { diceTotal: 2, rentMultiplier: 1, utilityMultiplierOverride: null });

  assert.equal(visitor.cash, 1500);
  assert.equal(owner.cash, 1500);
  assert.equal(game.state.pendingRentClaim, null);
});

test("no se puede construir si una propiedad del grupo esta hipotecada", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");
  const baltic = game.findSpaceById("baltic_avenue");

  game.assignPropertyToPlayer(mediterranean, player);
  game.assignPropertyToPlayer(baltic, player);
  baltic.isMortgaged = true;

  assert.throws(() => game.comprarCasa("mediterranean_avenue"), /hipotecadas/i);
});

test("los hoteles requieren 4 casas en juego normal y 3 en juego corto", () => {
  const normalGame = createGame({ players: ["Ana", "Luis"] });
  const shortGame = createGame({ players: ["Ana", "Luis"], mode: GAME_MODES.SHORT });
  const normalPlayer = normalGame.currentPlayer();
  const shortPlayer = shortGame.currentPlayer();
  const normalMediterranean = normalGame.findSpaceById("mediterranean_avenue");
  const normalBaltic = normalGame.findSpaceById("baltic_avenue");
  const shortMediterranean = shortGame.findSpaceById("mediterranean_avenue");
  const shortBaltic = shortGame.findSpaceById("baltic_avenue");

  normalGame.assignPropertyToPlayer(normalMediterranean, normalPlayer);
  normalGame.assignPropertyToPlayer(normalBaltic, normalPlayer);
  normalMediterranean.houses = 3;
  normalBaltic.houses = 3;

  assert.throws(() => normalGame.comprarHotel("mediterranean_avenue"), /numero requerido de casas/i);

  normalMediterranean.houses = 4;
  normalBaltic.houses = 4;
  assert.doesNotThrow(() => normalGame.comprarHotel("mediterranean_avenue"));
  assert.equal(normalMediterranean.hasHotel, true);

  shortGame.assignPropertyToPlayer(shortMediterranean, shortPlayer);
  shortGame.assignPropertyToPlayer(shortBaltic, shortPlayer);
  shortMediterranean.houses = 3;
  shortBaltic.houses = 3;
  assert.doesNotThrow(() => shortGame.comprarHotel("mediterranean_avenue"));
  assert.equal(shortMediterranean.hasHotel, true);
});

test("las casas y hoteles se venden a mitad de precio", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");
  const baltic = game.findSpaceById("baltic_avenue");

  game.assignPropertyToPlayer(mediterranean, player);
  game.assignPropertyToPlayer(baltic, player);

  mediterranean.houses = 1;
  const cashAfterHouse = player.cash;
  game.venderCasa("mediterranean_avenue");
  assert.equal(player.cash, cashAfterHouse + Math.floor(mediterranean.houseCost / 2));

  mediterranean.hasHotel = true;
  mediterranean.houses = 0;
  const cashAfterHotel = player.cash;
  game.venderHotel("mediterranean_avenue");
  assert.equal(player.cash, cashAfterHotel + Math.floor(mediterranean.hotelCost / 2));
  assert.equal(mediterranean.hasHotel, false);
  assert.equal(mediterranean.houses, 4);
});

test("parada libre no entrega premio", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  const startingCash = player.cash;

  player.position = 20;
  game.resolveCurrentSpace(player, { diceTotal: 0, rentMultiplier: 1, utilityMultiplierOverride: null });

  assert.equal(player.cash, startingCash);
});

test("no se puede vender una propiedad si su grupo tiene edificios", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.currentPlayer();
  const buyer = game.findPlayer("player_2");
  const mediterranean = game.findSpaceById("mediterranean_avenue");
  const baltic = game.findSpaceById("baltic_avenue");

  game.assignPropertyToPlayer(mediterranean, seller);
  game.assignPropertyToPlayer(baltic, seller);
  mediterranean.houses = 1;

  assert.throws(() => game.venderPropiedad({
    vendedorId: seller.id,
    compradorId: buyer.id,
    propiedadId: baltic.id,
    precio: 100
  }), /edificios/i);
});

test("al transferir una propiedad hipotecada se cobra el 10 por ciento al nuevo dueno", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.currentPlayer();
  const buyer = game.findPlayer("player_2");
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, seller);
  mediterranean.isMortgaged = true;

  game.venderPropiedad({
    vendedorId: seller.id,
    compradorId: buyer.id,
    propiedadId: mediterranean.id,
    precio: 100
  });

  assert.equal(mediterranean.ownerId, buyer.id);
  assert.equal(buyer.cash, 1397);
  assert.equal(seller.cash, 1600);
});

test("la quiebra contra el banco libera la propiedad e inicia subasta inmediata", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const debtor = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, debtor);
  game.state.pendingDebt = {
    debtorId: debtor.id,
    creditorType: CREDITOR_TYPES.BANK,
    creditorId: null,
    amount: 9999,
    reason: "TEST"
  };

  game.resolverQuiebra();

  assert.equal(debtor.bankrupt, true);
  assert.equal(mediterranean.ownerId, null);
  assert.equal(game.state.status, GAME_STATUSES.SUBASTA);
  assert.equal(game.state.auction.assetId, mediterranean.id);
});

test("en modo corto la segunda quiebra finaliza la partida", () => {
  const game = createGame({ players: ["Ana", "Luis", "Marta"], mode: GAME_MODES.SHORT });

  clearAllOwnership(game);

  game.state.pendingDebt = {
    debtorId: "player_1",
    creditorType: CREDITOR_TYPES.BANK,
    creditorId: null,
    amount: 9999,
    reason: "TEST"
  };
  game.resolverQuiebra();
  assert.equal(game.state.status, GAME_STATUSES.JUGANDO);

  game.state.pendingDebt = {
    debtorId: "player_2",
    creditorType: CREDITOR_TYPES.BANK,
    creditorId: null,
    amount: 9999,
    reason: "TEST"
  };
  game.resolverQuiebra();

  assert.equal(game.state.status, GAME_STATUSES.FINALIZADO);
  assert.ok(game.state.winnerId);
});

test("en modo con limite de tiempo gana el jugador mas rico cuando se alcanza el final", () => {
  const futureEnd = Date.now() + 60_000;
  const game = createGame({
    players: ["Ana", "Luis"],
    mode: GAME_MODES.TIMED,
    endAt: futureEnd,
    options: { timedModeDealsInitialProperties: false }
  });

  game.findPlayer("player_1").cash = 2500;
  game.findPlayer("player_2").cash = 900;
  game.terminarTurno({ now: futureEnd + 1 });

  assert.equal(game.state.status, GAME_STATUSES.FINALIZADO);
  assert.equal(game.consultarGanador().id, "player_1");
});

test("el impuesto opcional queda pendiente hasta elegir monto fijo o porcentaje", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  game.tirarDados({ dados: [2, 2] });

  assert.equal(game.state.pendingTax.fixedAmount, 200);
  assert.ok(game.state.pendingTax.percentAmount > 0);
  assert.equal(game.state.turn.phase, TURN_PHASES.AWAITING_TAX_DECISION);

  game.pagarImpuesto({ opcion: "FIXED" });
  assert.equal(player.cash, 1300);
  assert.equal(game.state.pendingTax, null);
});

test("se puede comprar una carta de salir de la carcel a otro jugador", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.findPlayer("player_1");
  const buyer = game.findPlayer("player_2");

  seller.getOutOfJailCards.CASUALIDAD = 1;
  game.comprarCartaSalirCarcel({
    vendedorId: seller.id,
    compradorId: buyer.id,
    deck: "CASUALIDAD",
    precio: 125
  });

  assert.equal(seller.getOutOfJailCards.CASUALIDAD, 0);
  assert.equal(buyer.getOutOfJailCards.CASUALIDAD, 1);
  assert.equal(seller.cash, 1625);
  assert.equal(buyer.cash, 1375);
});

test("el motor expone acciones disponibles y dispatch generico", () => {
  const game = new MonopolyGameEngine({ players: ["Ana", "Luis"] });

  assert.deepEqual(game.listarAccionesDisponibles(), [ENGINE_ACTIONS.INICIAR_PARTIDA]);
  game.ejecutarAccion(ENGINE_ACTIONS.INICIAR_PARTIDA);

  const actions = game.listarAccionesDisponibles();
  assert.ok(actions.includes(ENGINE_ACTIONS.TIRAR_DADOS));
  assert.ok(actions.includes(ENGINE_ACTIONS.COMPRAR_CASA));

  game.ejecutarAccion(ENGINE_ACTIONS.TIRAR_DADOS, { dados: [1, 2] });
  assert.equal(game.state.pendingPurchase.propertyId, "baltic_avenue");
});
