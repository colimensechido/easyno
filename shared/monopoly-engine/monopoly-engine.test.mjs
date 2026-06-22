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
  assert.equal(game.state.auction.activeBidderId, "player_2");
  assert.deepEqual(game.state.auction.passedPlayerIds, ["player_1"]);

  game.retirarseDeSubasta({ jugadorId: "player_2" });

  assert.equal(game.findSpaceById("baltic_avenue").ownerId, null);
  assert.equal(game.state.auction, null);
});

test("las subastas exigen al menos 25 por ciento sobre la puja actual", () => {
  const game = createGame({ players: ["Ana", "Luis"] });

  game.iniciarSubasta({ objetivoId: "baltic_avenue" });

  assert.equal(game.state.auction.meta.basePrice, 60);
  assert.equal(game.state.auction.minimumBid, 15);
  assert.throws(() => game.hacerOferta({ jugadorId: "player_1", monto: 14 }), /oferta minima/i);

  game.hacerOferta({ jugadorId: "player_1", monto: 100 });

  assert.equal(game.state.auction.currentBid, 100);
  assert.equal(game.state.auction.minimumBid, 125);
  assert.throws(() => game.hacerOferta({ jugadorId: "player_2", monto: 124 }), /oferta minima/i);
});

test("las subastas saltan automaticamente a jugadores sin dinero para la siguiente puja", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  game.findPlayer("player_2").cash = 120;

  game.iniciarSubasta({ objetivoId: "baltic_avenue" });
  game.hacerOferta({ jugadorId: "player_1", monto: 100 });

  assert.equal(game.state.auction, null);
  assert.equal(game.findSpaceById("baltic_avenue").ownerId, "player_1");
  assert.equal(game.findPlayer("player_1").cash, 1400);
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

test("solo se puede comprar una casa por casilla durante el mismo turno", () => {
  const game = createGame({ players: ["Ana", "Luis", "Marta"] });
  const player = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");
  const baltic = game.findSpaceById("baltic_avenue");

  game.assignPropertyToPlayer(mediterranean, player);
  game.assignPropertyToPlayer(baltic, player);

  game.comprarCasa("mediterranean_avenue");
  game.comprarCasa("baltic_avenue");

  assert.deepEqual(game.state.turn.housePurchasesThisTurn, ["mediterranean_avenue", "baltic_avenue"]);
  assert.throws(() => game.comprarCasa("mediterranean_avenue"), /una casa por casilla/i);

  game.advanceToNextPlayer();
  game.advanceToNextPlayer();
  game.advanceToNextPlayer();

  assert.equal(game.currentPlayer().id, player.id);
  assert.doesNotThrow(() => game.comprarCasa("mediterranean_avenue"));
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

test("las ofertas de propiedad requieren aceptacion del comprador", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.currentPlayer();
  const buyer = game.findPlayer("player_2");
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, seller);
  game.crearOfertaPropiedad({
    vendedorId: seller.id,
    compradorId: buyer.id,
    propiedadId: mediterranean.id,
    precio: 120
  });

  const offer = game.state.tradeOffers[0];
  assert.equal(mediterranean.ownerId, seller.id);
  assert.equal(seller.cash, 1500);
  assert.equal(buyer.cash, 1500);

  game.aceptarOfertaTrato({ offerId: offer.id, actorId: buyer.id });

  assert.equal(mediterranean.ownerId, buyer.id);
  assert.equal(seller.cash, 1620);
  assert.equal(buyer.cash, 1380);
  assert.equal(game.state.tradeOffers.length, 0);
});

test("las ofertas de compra de propiedad requieren aceptacion del vendedor", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.currentPlayer();
  const buyer = game.findPlayer("player_2");
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  game.assignPropertyToPlayer(mediterranean, seller);
  game.crearOfertaCompraPropiedad({
    compradorId: buyer.id,
    vendedorId: seller.id,
    propiedadId: mediterranean.id,
    precio: 140
  });

  const offer = game.state.tradeOffers[0];
  assert.equal(offer.direction, "BUY");
  assert.equal(offer.recipientId, seller.id);
  assert.throws(() => game.aceptarOfertaTrato({ offerId: offer.id, actorId: buyer.id }), /invitado/i);

  game.aceptarOfertaTrato({ offerId: offer.id, actorId: seller.id });

  assert.equal(mediterranean.ownerId, buyer.id);
  assert.equal(seller.cash, 1640);
  assert.equal(buyer.cash, 1360);
  assert.equal(game.state.tradeOffers.length, 0);
});

test("las ofertas de carta de carcel se pueden rechazar", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.findPlayer("player_1");
  const buyer = game.findPlayer("player_2");

  seller.getOutOfJailCards.CASUALIDAD = 1;
  game.crearOfertaCartaCarcel({
    vendedorId: seller.id,
    compradorId: buyer.id,
    deck: "CASUALIDAD",
    precio: 200
  });

  const offer = game.state.tradeOffers[0];
  game.rechazarOfertaTrato({ offerId: offer.id, actorId: buyer.id });

  assert.equal(seller.getOutOfJailCards.CASUALIDAD, 1);
  assert.equal(buyer.getOutOfJailCards.CASUALIDAD, 0);
  assert.equal(game.state.tradeOffers.length, 0);
});

test("las ofertas de compra de carta de carcel las acepta el vendedor", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const seller = game.findPlayer("player_1");
  const buyer = game.findPlayer("player_2");

  seller.getOutOfJailCards.ARCA_COMUNAL = 1;
  game.crearOfertaCompraCartaCarcel({
    compradorId: buyer.id,
    vendedorId: seller.id,
    deck: "ARCA_COMUNAL",
    precio: 180
  });

  const offer = game.state.tradeOffers[0];
  assert.equal(offer.direction, "BUY");
  assert.equal(offer.recipientId, seller.id);

  game.aceptarOfertaTrato({ offerId: offer.id, actorId: seller.id });

  assert.equal(seller.getOutOfJailCards.ARCA_COMUNAL, 0);
  assert.equal(buyer.getOutOfJailCards.ARCA_COMUNAL, 1);
  assert.equal(seller.cash, 1680);
  assert.equal(buyer.cash, 1320);
});

test("la quiebra espera si el jugador aun puede liquidar activos", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const debtor = game.currentPlayer();
  const mediterranean = game.findSpaceById("mediterranean_avenue");

  debtor.cash = 0;
  game.assignPropertyToPlayer(mediterranean, debtor);
  game.state.pendingDebt = {
    debtorId: debtor.id,
    creditorType: CREDITOR_TYPES.BANK,
    creditorId: null,
    amount: mediterranean.mortgageValue,
    reason: "TEST"
  };

  assert.throws(() => game.resolverQuiebra(), /vender casas|hipotecar/i);
  assert.equal(debtor.bankrupt, false);
});

test("la quiebra contra el banco libera la propiedad e inicia subasta si aun hay rivales", () => {
  const game = createGame({ players: ["Ana", "Luis", "Marta"] });
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

test("la quiebra que deja un solo jugador activo finaliza sin subasta", () => {
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
  assert.equal(game.state.status, GAME_STATUSES.FINALIZADO);
  assert.equal(game.state.auction, null);
  assert.ok(game.state.winnerId);
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

test("el impuesto opcional selecciona automaticamente el cobro fijo cuando es mayor", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();

  game.tirarDados({ dados: [2, 2] });

  assert.equal(game.state.pendingTax.fixedAmount, 200);
  assert.ok(game.state.pendingTax.percentAmount > 0);
  assert.equal(game.state.pendingTax.selectedMode, "FIXED");
  assert.equal(game.state.pendingTax.selectedAmount, 200);
  assert.equal(game.state.turn.phase, TURN_PHASES.AWAITING_TAX_DECISION);

  game.pagarImpuesto();
  assert.equal(player.cash, 1300);
  assert.equal(game.state.pendingTax, null);
});

test("el impuesto opcional selecciona automaticamente patrimonio cuando supera al fijo", () => {
  const game = createGame({ players: ["Ana", "Luis"] });
  const player = game.currentPlayer();
  player.cash = 2500;

  game.tirarDados({ dados: [2, 2] });

  assert.equal(game.state.pendingTax.fixedAmount, 200);
  assert.equal(game.state.pendingTax.percentAmount, 250);
  assert.equal(game.state.pendingTax.selectedMode, "PERCENT");
  assert.equal(game.state.pendingTax.selectedAmount, 250);

  game.pagarImpuesto();
  assert.equal(player.cash, 2250);
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
