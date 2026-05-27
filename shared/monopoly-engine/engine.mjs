import {
  AUCTION_KINDS,
  BANK_HOTEL_COUNT,
  BANK_HOUSE_COUNT,
  CARD_DECKS,
  CARD_EFFECTS,
  CREDITOR_TYPES,
  DEFAULT_ENGINE_OPTIONS,
  GAME_MODES,
  GAME_STATUSES,
  GO_SALARY,
  JAIL_FINE,
  MAX_CONSECUTIVE_DOUBLES,
  MAX_JAIL_ATTEMPTS,
  PROPERTY_KINDS,
  SPACE_TYPES,
  STARTING_CASH,
  TURN_PHASES
} from "./constants.mjs";
import { ENGINE_ACTIONS } from "./actions.mjs";
import { createClassicBoard } from "./data/board-data.mjs";
import { createChanceDeck, createCommunityChestDeck } from "./data/card-data.mjs";
import { assert, clone, createId, groupBy, modulo, rollTwoDice, shuffle } from "./utils.mjs";

function isOwnable(space) {
  return [
    SPACE_TYPES.PROPERTY,
    SPACE_TYPES.RAILROAD,
    SPACE_TYPES.UTILITY
  ].includes(space.type);
}

function isStreet(space) {
  return isOwnable(space) && space.propertyKind === PROPERTY_KINDS.STREET;
}

function isRailroad(space) {
  return isOwnable(space) && space.propertyKind === PROPERTY_KINDS.RAILROAD;
}

function isUtility(space) {
  return isOwnable(space) && space.propertyKind === PROPERTY_KINDS.UTILITY;
}

function buildPlayer(player, index) {
  const normalized = typeof player === "string"
    ? { id: `player_${index + 1}`, name: player }
    : { id: player.id || `player_${index + 1}`, name: player.name || `Jugador ${index + 1}` };

  return {
    id: normalized.id,
    name: normalized.name,
    cash: STARTING_CASH,
    position: 0,
    propertyIds: [],
    bankrupt: false,
    jail: {
      inJail: false,
      attempts: 0
    },
    getOutOfJailCards: {
      [CARD_DECKS.CHANCE]: 0,
      [CARD_DECKS.COMMUNITY_CHEST]: 0
    },
    deferredBankDebts: []
  };
}

export class MonopolyGameEngine {
  constructor(config) {
    assert(config, "Debes proporcionar configuracion para el motor Monopoly");

    if (config.state) {
      this.random = config.random || Math.random;
      this.state = clone(config.state);
      this.options = {
        ...DEFAULT_ENGINE_OPTIONS,
        ...((this.state.meta && this.state.meta.options) || {})
      };
      this.mode = this.state.mode;
      this.endAt = this.state.meta?.endAt || null;
      this.sequence = (this.state.events?.length || 0) + 1;
      this.spacesById = new Map(this.state.board.spaces.map((space) => [space.id, space]));
      this.streetGroups = groupBy(this.state.board.spaces.filter(isStreet), (space) => space.colorGroup);
      return;
    }

    assert(Array.isArray(config.players), "Debes proporcionar una lista de jugadores");
    assert(config.players.length >= 2, "Monopoly requiere al menos 2 jugadores");

    this.random = config.random || Math.random;
    this.options = {
      ...DEFAULT_ENGINE_OPTIONS,
      ...(config.options || {})
    };
    this.mode = config.mode || GAME_MODES.NORMAL;
    this.endAt = config.endAt || null;
    this.sequence = 1;

    const boardSpaces = createClassicBoard();

    this.state = {
      mode: this.mode,
      meta: {
        endAt: this.endAt,
        options: clone(this.options)
      },
      status: GAME_STATUSES.PREPARACION,
      board: {
        spaces: boardSpaces,
        size: boardSpaces.length
      },
      players: config.players.map(buildPlayer),
      bank: {
        cash: Number.POSITIVE_INFINITY,
        housesAvailable: BANK_HOUSE_COUNT,
        hotelsAvailable: BANK_HOTEL_COUNT,
        propertyIds: boardSpaces.filter(isOwnable).map((space) => space.id)
      },
      decks: {
        [CARD_DECKS.CHANCE]: {
          drawPile: shuffle(createChanceDeck(), this.random),
          discardPile: []
        },
        [CARD_DECKS.COMMUNITY_CHEST]: {
          drawPile: shuffle(createCommunityChestDeck(), this.random),
          discardPile: []
        }
      },
      currentPlayerIndex: 0,
      turn: {
        number: 0,
        currentPlayerId: null,
        phase: TURN_PHASES.AWAITING_ROLL,
        lastRoll: null,
        consecutiveDoubles: 0,
        extraTurnEarned: false,
        noExtraTurnBecauseJail: false
      },
      pendingPurchase: null,
      pendingCard: null,
      pendingTax: null,
      pendingRentClaim: null,
      pendingDebt: null,
      pendingContinuation: null,
      pendingBankruptcyAuctions: [],
      auction: null,
      winnerId: null,
      endedAt: null,
      events: []
    };

    this.spacesById = new Map(boardSpaces.map((space) => [space.id, space]));
    this.streetGroups = groupBy(boardSpaces.filter(isStreet), (space) => space.colorGroup);
  }

  getState() {
    return clone(this.state);
  }

  iniciarPartida({ now = Date.now() } = {}) {
    assert(this.state.status === GAME_STATUSES.PREPARACION, "La partida ya fue iniciada");

    if (this.options.randomizeStartingPlayer) {
      this.state.currentPlayerIndex = Math.floor(this.random() * this.state.players.length);
    }

    if (this.mode === GAME_MODES.SHORT || (this.mode === GAME_MODES.TIMED && this.options.timedModeDealsInitialProperties)) {
      this.repartirPropiedadesIniciales();
    }

    this.state.status = GAME_STATUSES.JUGANDO;
    this.state.turn.currentPlayerId = this.currentPlayer().id;
    this.state.turn.phase = TURN_PHASES.AWAITING_ROLL;
    this.state.turn.number = 1;
    this.log("GAME_STARTED", { mode: this.mode, currentPlayerId: this.currentPlayer().id });
    this.checkTimeLimit(now);
    return this.getState();
  }

  tirarDados({ dados = null, now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    this.expirePendingRentClaim();

    const player = this.currentPlayer();
    this.ensurePlayerCanAct(player.id);
    this.ensureNoBlockingActionForRoll(player);

    if (player.jail.inJail) {
      return this.resolveJailRoll(player, this.normalizeRoll(dados));
    }

    const roll = this.normalizeRoll(dados);
    this.state.turn.lastRoll = roll;
    this.state.turn.extraTurnEarned = false;
    this.state.turn.noExtraTurnBecauseJail = false;

    if (roll.isDouble) {
      this.state.turn.consecutiveDoubles += 1;
    } else {
      this.state.turn.consecutiveDoubles = 0;
    }

    if (this.state.turn.consecutiveDoubles >= MAX_CONSECUTIVE_DOUBLES) {
      this.sendPlayerToJail(player, "TRIPLE_DOBLE");
      this.state.turn.consecutiveDoubles = 0;
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      return this.getState();
    }

    this.state.status = GAME_STATUSES.RESOLVIENDO_CASILLA;
    this.movePlayerBy(player, roll.total, { collectSalary: true });
    this.resolveCurrentSpace(player, {
      diceTotal: roll.total,
      rentMultiplier: 1,
      utilityMultiplierOverride: null
    });

    if (!this.hasBlockingAction()) {
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    }

    this.state.turn.extraTurnEarned = roll.isDouble && !player.jail.inJail;
    this.checkGameEnd(now);
    return this.getState();
  }

  comprarPropiedad({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const pending = this.state.pendingPurchase;
    assert(pending, "No hay compra pendiente");
    assert(pending.playerId === this.currentPlayer().id, "Solo el jugador actual puede comprar");

    const player = this.findPlayer(pending.playerId);
    const property = this.findSpaceById(pending.propertyId);
    assert(isOwnable(property), "La casilla pendiente no es comprable");

    if (player.cash < property.price) {
      this.state.pendingPurchase = null;
      this.iniciarSubasta({ tipo: AUCTION_KINDS.PROPERTY, objetivoId: property.id });
      return this.getState();
    }

    this.transferCash(player, CREDITOR_TYPES.BANK, property.price, "COMPRA_PROPIEDAD");
    this.assignPropertyToPlayer(property, player);
    this.state.pendingPurchase = null;
    this.state.status = GAME_STATUSES.JUGANDO;
    this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    this.log("PROPERTY_PURCHASED", { playerId: player.id, propertyId: property.id, price: property.price });
    return this.getState();
  }

  rechazarCompra({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const pending = this.state.pendingPurchase;
    assert(pending, "No hay compra pendiente");
    this.state.pendingPurchase = null;
    this.iniciarSubasta({ tipo: AUCTION_KINDS.PROPERTY, objetivoId: pending.propertyId });
    return this.getState();
  }

  iniciarSubasta({ tipo = AUCTION_KINDS.PROPERTY, objetivoId, cantidad = 1, participantes = null, meta = {}, now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    assert(!this.state.auction, "Ya existe una subasta activa");
    assert(objetivoId, "La subasta requiere un objetivo");

    const activePlayers = (participantes || this.activePlayers().map((player) => player.id))
      .map((playerId) => this.findPlayer(playerId))
      .filter((player) => !player.bankrupt);

    assert(activePlayers.length > 0, "No hay jugadores activos para la subasta");

    this.state.auction = {
      id: createId("auction", this.sequence++),
      kind: tipo,
      assetId: objetivoId,
      quantity: cantidad,
      meta,
      currentBid: 0,
      currentBidderId: null,
      activeBidderId: activePlayers[0].id,
      participantIds: activePlayers.map((player) => player.id),
      passedPlayerIds: [],
      status: "ACTIVE"
    };
    this.state.status = GAME_STATUSES.SUBASTA;
    this.state.turn.phase = TURN_PHASES.AWAITING_AUCTION;
    this.log("AUCTION_STARTED", { kind: tipo, assetId: objetivoId, participantIds: activePlayers.map((player) => player.id) });
    return this.getState();
  }

  hacerOferta({ jugadorId, monto, now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const auction = this.state.auction;
    assert(auction && auction.status === "ACTIVE", "No hay subasta activa");
    assert(auction.activeBidderId === jugadorId, "No es el turno de puja de este jugador");
    const bidder = this.findPlayer(jugadorId);

    assert(!bidder.bankrupt, "Un jugador en quiebra no puede pujar");
    assert(monto > auction.currentBid, "La oferta debe superar la puja actual");
    assert(bidder.cash >= monto, "El jugador no puede ofrecer mas dinero del que posee");

    auction.currentBid = monto;
    auction.currentBidderId = jugadorId;
    auction.passedPlayerIds = auction.passedPlayerIds.filter((playerId) => playerId !== jugadorId);
    this.log("AUCTION_BID", { auctionId: auction.id, playerId: jugadorId, amount: monto });
    this.advanceAuctionTurn();
    return this.getState();
  }

  retirarseDeSubasta({ jugadorId, now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const auction = this.state.auction;
    assert(auction && auction.status === "ACTIVE", "No hay subasta activa");
    assert(auction.activeBidderId === jugadorId, "No es el turno de este jugador en la subasta");

    if (!auction.passedPlayerIds.includes(jugadorId)) {
      auction.passedPlayerIds.push(jugadorId);
    }

    this.log("AUCTION_PASS", { auctionId: auction.id, playerId: jugadorId });
    this.advanceAuctionTurn();
    return this.getState();
  }

  resolverCarta({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const pending = this.state.pendingCard;
    assert(pending, "No hay carta pendiente por resolver");
    const player = this.findPlayer(pending.playerId);
    const card = pending.card;

    this.state.pendingCard = null;
    this.state.status = GAME_STATUSES.RESOLVIENDO_CASILLA;
    this.log("CARD_RESOLVED", { playerId: player.id, cardId: card.id, effect: card.effect });

    switch (card.effect) {
      case CARD_EFFECTS.RECEIVE_MONEY:
        this.receiveMoney(player, card.amount, card.effect);
        break;
      case CARD_EFFECTS.PAY_BANK:
        this.chargePlayer(player, CREDITOR_TYPES.BANK, null, card.amount, card.effect);
        break;
      case CARD_EFFECTS.PAY_EACH_PLAYER:
        this.processTransferQueue(this.activePlayers()
          .filter((candidate) => candidate.id !== player.id)
          .map((candidate) => ({
            fromPlayerId: player.id,
            creditorType: CREDITOR_TYPES.PLAYER,
            creditorId: candidate.id,
            amount: card.amount,
            reason: card.effect
          })));
        break;
      case CARD_EFFECTS.RECEIVE_FROM_EACH_PLAYER:
        this.processTransferQueue(this.activePlayers()
          .filter((candidate) => candidate.id !== player.id)
          .map((candidate) => ({
            fromPlayerId: candidate.id,
            creditorType: CREDITOR_TYPES.PLAYER,
            creditorId: player.id,
            amount: card.amount,
            reason: card.effect
          })));
        break;
      case CARD_EFFECTS.MOVE_TO:
        this.movePlayerTo(player, this.findSpaceById(card.target).index, { collectSalary: true });
        this.resolveCurrentSpace(player, { diceTotal: this.lastDiceTotal(), rentMultiplier: 1, utilityMultiplierOverride: null });
        break;
      case CARD_EFFECTS.MOVE_TO_NEAREST_RAILROAD:
        this.movePlayerToNearest(player, PROPERTY_KINDS.RAILROAD, { collectSalary: true });
        this.resolveCurrentSpace(player, {
          diceTotal: this.lastDiceTotal(),
          rentMultiplier: card.meta.rentMultiplier || 1,
          utilityMultiplierOverride: null
        });
        break;
      case CARD_EFFECTS.MOVE_TO_NEAREST_UTILITY:
        this.movePlayerToNearest(player, PROPERTY_KINDS.UTILITY, { collectSalary: true });
        this.resolveCurrentSpace(player, {
          diceTotal: this.lastDiceTotal(),
          rentMultiplier: 1,
          utilityMultiplierOverride: card.meta.utilityMultiplier || 10
        });
        break;
      case CARD_EFFECTS.MOVE_BACK:
        this.movePlayerBy(player, -card.steps, { collectSalary: false });
        this.resolveCurrentSpace(player, { diceTotal: this.lastDiceTotal(), rentMultiplier: 1, utilityMultiplierOverride: null });
        break;
      case CARD_EFFECTS.GO_TO_JAIL:
        this.sendPlayerToJail(player, card.id);
        break;
      case CARD_EFFECTS.GET_OUT_OF_JAIL:
        player.getOutOfJailCards[card.deck] += 1;
        break;
      case CARD_EFFECTS.REPAIRS:
        this.chargePlayer(
          player,
          CREDITOR_TYPES.BANK,
          null,
          this.calculateRepairCost(player, card.meta.perHouse, card.meta.perHotel),
          card.effect
        );
        break;
      default:
        throw new Error(`Efecto de carta no soportado: ${card.effect}`);
    }

    this.recycleCard(card, player);

    if (!this.hasBlockingAction()) {
      this.state.status = GAME_STATUSES.JUGANDO;
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    }

    return this.getState();
  }

  pagarRenta({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const claim = this.state.pendingRentClaim;
    assert(claim, "No hay renta pendiente");
    const debtor = this.findPlayer(claim.debtorId);

    this.state.pendingRentClaim = null;
    this.chargePlayer(debtor, CREDITOR_TYPES.PLAYER, claim.ownerId, claim.amount, "PAGO_RENTA");

    if (!this.hasBlockingAction()) {
      this.state.status = GAME_STATUSES.JUGANDO;
      if (this.state.turn.phase !== TURN_PHASES.AWAITING_ROLL) {
        this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      }
    }

    return this.getState();
  }

  pagarImpuesto({ opcion = "FIXED", now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const pending = this.state.pendingTax;
    assert(pending, "No hay impuesto pendiente");
    assert(pending.playerId === this.currentPlayer().id, "Solo el jugador actual puede pagar este impuesto");

    const amount = opcion === "PERCENT" ? pending.percentAmount : pending.fixedAmount;
    this.state.pendingTax = null;
    this.chargePlayer(this.currentPlayer(), CREDITOR_TYPES.BANK, null, amount, "IMPUESTO");

    if (!this.hasBlockingAction()) {
      this.state.status = GAME_STATUSES.JUGANDO;
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    }

    return this.getState();
  }

  comprarCasa(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);

    this.validateHousePurchase(player, property);
    this.transferCash(player, CREDITOR_TYPES.BANK, property.houseCost, "COMPRA_CASA");
    property.houses += 1;
    this.state.bank.housesAvailable -= 1;
    this.log("HOUSE_PURCHASED", { playerId: player.id, propertyId: property.id });
    return this.getState();
  }

  comprarHotel(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);
    const requiredHouses = this.requiredHousesForHotel();

    this.validateHotelPurchase(player, property, requiredHouses);
    this.transferCash(player, CREDITOR_TYPES.BANK, property.hotelCost, "COMPRA_HOTEL");
    property.houses = 0;
    property.hasHotel = true;
    this.state.bank.housesAvailable += requiredHouses;
    this.state.bank.hotelsAvailable -= 1;
    this.log("HOTEL_PURCHASED", { playerId: player.id, propertyId: property.id });
    return this.getState();
  }

  venderCasa(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);

    this.validateHouseSale(player, property);
    property.houses -= 1;
    this.state.bank.housesAvailable += 1;
    this.receiveMoney(player, Math.floor(property.houseCost / 2), "VENTA_CASA");
    this.log("HOUSE_SOLD", { playerId: player.id, propertyId: property.id });
    return this.getState();
  }

  venderHotel(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);
    const requiredHouses = this.requiredHousesForHotel();

    this.validateHotelSale(player, property, requiredHouses);
    property.hasHotel = false;
    property.houses = requiredHouses;
    this.state.bank.hotelsAvailable += 1;
    this.state.bank.housesAvailable -= requiredHouses;
    this.receiveMoney(player, Math.floor(property.hotelCost / 2), "VENTA_HOTEL");
    this.log("HOTEL_SOLD", { playerId: player.id, propertyId: property.id });
    return this.getState();
  }

  hipotecarPropiedad(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);

    this.validateMortgage(player, property);
    property.isMortgaged = true;
    this.receiveMoney(player, property.mortgageValue, "HIPOTECA");
    this.log("PROPERTY_MORTGAGED", { playerId: player.id, propertyId: property.id });
    return this.getState();
  }

  levantarHipoteca(propertyId, { now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();
    const property = this.findSpaceById(propertyId);
    const liftCost = this.calculateMortgageLiftCost(property);

    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(property.isMortgaged, "La propiedad no esta hipotecada");
    assert(player.cash >= liftCost, "No hay dinero suficiente para levantar la hipoteca");

    this.transferCash(player, CREDITOR_TYPES.BANK, liftCost, "LEVANTAR_HIPOTECA");
    property.isMortgaged = false;
    this.log("MORTGAGE_LIFTED", { playerId: player.id, propertyId: property.id, liftCost });
    return this.getState();
  }

  venderPropiedad({
    vendedorId,
    compradorId,
    propiedadId,
    precio,
    levantarHipotecaAhora = false,
    now = Date.now()
  } = {}) {
    this.ensureGameRunning(now);
    assert(vendedorId && compradorId && propiedadId, "La venta requiere vendedor, comprador y propiedad");
    const seller = this.findPlayer(vendedorId);
    const buyer = this.findPlayer(compradorId);
    const property = this.findSpaceById(propiedadId);

    assert(property.ownerId === seller.id, "La propiedad no pertenece al vendedor");
    assert(!seller.bankrupt && !buyer.bankrupt, "Los jugadores en quiebra no pueden comerciar");
    assert(precio >= 0, "El precio acordado es invalido");
    assert(buyer.cash >= precio, "El comprador no tiene dinero suficiente");
    assert(!this.groupHasBuildings(property), "No se puede vender una propiedad con edificios en su grupo");

    this.transferCash(buyer, CREDITOR_TYPES.PLAYER, precio, "VENTA_PROPIEDAD", seller.id);
    this.transferPropertyOwnership(property, seller, buyer);

    if (property.isMortgaged) {
      const transferInterest = Math.ceil(property.mortgageValue * 0.1);

      if (buyer.cash >= transferInterest) {
        this.transferCash(buyer, CREDITOR_TYPES.BANK, transferInterest, "INTERES_HIPOTECA_TRANSFERIDA");
      } else {
        buyer.deferredBankDebts.push({
          amount: transferInterest,
          reason: "INTERES_HIPOTECA_TRANSFERIDA"
        });
      }

      if (levantarHipotecaAhora) {
        const liftCost = property.mortgageValue;
        assert(buyer.cash >= liftCost, "El comprador no puede levantar la hipoteca inmediatamente");
        this.transferCash(buyer, CREDITOR_TYPES.BANK, liftCost, "LEVANTAR_HIPOTECA_TRANSFERIDA");
        property.isMortgaged = false;
      }
    }

    this.log("PROPERTY_TRADED", {
      sellerId: seller.id,
      buyerId: buyer.id,
      propertyId: property.id,
      price: precio
    });
    return this.getState();
  }

  comprarCartaSalirCarcel({
    vendedorId,
    compradorId,
    deck,
    precio,
    now = Date.now()
  } = {}) {
    this.ensureGameRunning(now);
    assert(vendedorId && compradorId && deck, "Debes indicar vendedor, comprador y mazo");
    assert(precio >= 0, "El precio acordado es invalido");
    assert(vendedorId !== compradorId, "La carta debe cambiar de un jugador a otro");
    assert(Object.values(CARD_DECKS).includes(deck), "Mazo invalido para carta de carcel");

    const seller = this.findPlayer(vendedorId);
    const buyer = this.findPlayer(compradorId);

    assert(!seller.bankrupt && !buyer.bankrupt, "Los jugadores en quiebra no pueden comerciar");
    assert(seller.getOutOfJailCards[deck] > 0, "El vendedor no posee esa carta");
    assert(buyer.cash >= precio, "El comprador no tiene efectivo suficiente");

    this.transferCash(buyer, CREDITOR_TYPES.PLAYER, precio, "COMPRA_CARTA_SALIR_CARCEL", seller.id);
    seller.getOutOfJailCards[deck] -= 1;
    buyer.getOutOfJailCards[deck] += 1;
    this.log("JAIL_CARD_TRADED", { sellerId: seller.id, buyerId: buyer.id, deck, price: precio });
    return this.getState();
  }

  usarCartaSalirCarcel({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();

    assert(player.jail.inJail, "El jugador actual no esta en la carcel");
    const deck = Object.values(CARD_DECKS).find((deckName) => player.getOutOfJailCards[deckName] > 0);
    assert(deck, "El jugador no tiene carta para salir de la carcel");

    player.getOutOfJailCards[deck] -= 1;
    this.state.decks[deck].drawPile.push(
      (deck === CARD_DECKS.CHANCE ? createChanceDeck() : createCommunityChestDeck())
        .find((card) => card.effect === CARD_EFFECTS.GET_OUT_OF_JAIL)
    );
    player.jail.inJail = false;
    player.jail.attempts = 0;
    this.state.turn.phase = TURN_PHASES.AWAITING_ROLL;
    this.log("JAIL_CARD_USED", { playerId: player.id, deck });
    return this.getState();
  }

  pagarMultaCarcel({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();

    assert(player.jail.inJail, "El jugador actual no esta en la carcel");
    this.chargePlayer(player, CREDITOR_TYPES.BANK, null, JAIL_FINE, "MULTA_CARCEL");

    if (!this.state.pendingDebt) {
      player.jail.inJail = false;
      player.jail.attempts = 0;
      this.state.turn.phase = TURN_PHASES.AWAITING_ROLL;
    } else {
      this.state.pendingContinuation = {
        type: "LEAVE_JAIL_AFTER_DEBT",
        playerId: player.id
      };
    }

    this.log("JAIL_FINE_PAID", { playerId: player.id, amount: JAIL_FINE });
    return this.getState();
  }

  resolverDeudaPendiente({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const debt = this.state.pendingDebt;
    assert(debt, "No hay deuda pendiente por resolver");
    const debtor = this.findPlayer(debt.debtorId);

    assert(debtor.cash >= debt.amount, "El jugador todavia no tiene efectivo suficiente para pagar");
    this.state.pendingDebt = null;
    this.transferCash(debtor, debt.creditorType, debt.amount, debt.reason, debt.creditorId);
    this.log("DEBT_PAID", { debtorId: debtor.id, amount: debt.amount, creditorType: debt.creditorType, creditorId: debt.creditorId });
    this.runPendingContinuation();

    if (!this.hasBlockingAction()) {
      this.state.status = GAME_STATUSES.JUGANDO;
      if (this.state.turn.phase !== TURN_PHASES.AWAITING_ROLL) {
        this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      }
    }

    this.checkGameEnd(now);
    return this.getState();
  }

  declararQuiebra({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const debt = this.state.pendingDebt;
    assert(debt, "Solo se puede declarar quiebra durante una deuda pendiente");

    this.resolveBankruptcy(this.findPlayer(debt.debtorId), debt.creditorType, debt.creditorId, debt.reason);
    this.state.pendingDebt = null;
    this.state.pendingContinuation = null;
    this.checkGameEnd(now);
    return this.getState();
  }

  resolverQuiebra(options = {}) {
    return this.declararQuiebra(options);
  }

  terminarTurno({ now = Date.now() } = {}) {
    this.ensureGameRunning(now);
    const player = this.currentPlayer();

    assert(!this.state.pendingPurchase, "No se puede terminar el turno con una compra pendiente");
    assert(!this.state.pendingCard, "No se puede terminar el turno con una carta pendiente");
    assert(!this.state.pendingTax, "No se puede terminar el turno con un impuesto pendiente");
    assert(!this.state.pendingDebt, "No se puede terminar el turno con deudas pendientes");
    assert(!this.state.auction, "No se puede terminar el turno durante una subasta");

    this.checkGameEnd(now);

    if (this.state.status === GAME_STATUSES.FINALIZADO) {
      return this.getState();
    }

    const shouldRepeatTurn =
      this.state.turn.extraTurnEarned &&
      !this.state.turn.noExtraTurnBecauseJail &&
      !player.bankrupt &&
      !player.jail.inJail;

    if (shouldRepeatTurn) {
      this.state.status = GAME_STATUSES.JUGANDO;
      this.state.turn.phase = TURN_PHASES.AWAITING_ROLL;
      this.state.turn.extraTurnEarned = false;
      this.state.turn.lastRoll = null;
      this.log("EXTRA_TURN_GRANTED", { playerId: player.id });
      return this.getState();
    }

    this.advanceToNextPlayer();
    this.checkGameEnd(now);
    return this.getState();
  }

  consultarGanador() {
    if (this.state.winnerId) {
      return clone(this.findPlayer(this.state.winnerId));
    }

    return null;
  }

  calcularRiquezaJugador(playerId) {
    const player = this.findPlayer(playerId);
    const propertyValue = player.propertyIds.reduce((total, propertyId) => {
      const property = this.findSpaceById(propertyId);
      const adjustedValue = property.isMortgaged ? Math.floor(property.price / 2) : property.price;
      const housesValue = (property.houses || 0) * (property.houseCost || 0);
      const hotelBase = property.hasHotel ? (property.hotelCost || 0) : 0;

      return total + adjustedValue + housesValue + hotelBase;
    }, 0);

    return player.cash + propertyValue;
  }

  rankearJugadores() {
    return this.activePlayers()
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        wealth: this.calcularRiquezaJugador(player.id)
      }))
      .sort((left, right) => right.wealth - left.wealth);
  }

  listarAccionesDisponibles({ playerId = this.currentPlayer().id } = {}) {
    const player = this.findPlayer(playerId);
    const actions = [];

    if (this.state.status === GAME_STATUSES.PREPARACION) {
      return [ENGINE_ACTIONS.INICIAR_PARTIDA];
    }

    if (this.state.status === GAME_STATUSES.FINALIZADO || player.bankrupt) {
      return actions;
    }

    if (this.state.auction) {
      if (this.state.auction.activeBidderId === playerId) {
        actions.push(ENGINE_ACTIONS.HACER_OFERTA, ENGINE_ACTIONS.RETIRARSE_DE_SUBASTA);
      }
      return actions;
    }

    if (this.state.pendingPurchase?.playerId === playerId) {
      return [ENGINE_ACTIONS.COMPRAR_PROPIEDAD, ENGINE_ACTIONS.RECHAZAR_COMPRA];
    }

    if (this.state.pendingCard?.playerId === playerId) {
      return [ENGINE_ACTIONS.RESOLVER_CARTA];
    }

    if (this.state.pendingTax?.playerId === playerId) {
      return [ENGINE_ACTIONS.PAGAR_IMPUESTO];
    }

    if (this.state.pendingDebt?.debtorId === playerId) {
      return [
        ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD,
        ENGINE_ACTIONS.LEVANTAR_HIPOTECA,
        ENGINE_ACTIONS.VENDER_PROPIEDAD,
        ENGINE_ACTIONS.COMPRAR_CARTA_SALIR_CARCEL,
        ENGINE_ACTIONS.VENDER_CASA,
        ENGINE_ACTIONS.VENDER_HOTEL,
        ENGINE_ACTIONS.RESOLVER_DEUDA_PENDIENTE,
        ENGINE_ACTIONS.RESOLVER_QUIEBRA
      ];
    }

    if (this.state.pendingRentClaim?.ownerId === playerId) {
      actions.push(ENGINE_ACTIONS.PAGAR_RENTA);
    }

    const isCurrentPlayer = this.currentPlayer().id === playerId;

    if (isCurrentPlayer) {
      if (player.jail.inJail) {
        actions.push(ENGINE_ACTIONS.TIRAR_DADOS, ENGINE_ACTIONS.PAGAR_MULTA_CARCEL);

        if (Object.values(player.getOutOfJailCards).some((count) => count > 0)) {
          actions.push(ENGINE_ACTIONS.USAR_CARTA_SALIR_CARCEL);
        }
      } else if (this.state.turn.phase === TURN_PHASES.AWAITING_ROLL) {
        actions.push(ENGINE_ACTIONS.TIRAR_DADOS);
      }

      if (this.state.turn.phase === TURN_PHASES.AWAITING_TURN_END) {
        actions.push(ENGINE_ACTIONS.TERMINAR_TURNO);
      }

      actions.push(
        ENGINE_ACTIONS.COMPRAR_CASA,
        ENGINE_ACTIONS.COMPRAR_HOTEL,
        ENGINE_ACTIONS.VENDER_CASA,
        ENGINE_ACTIONS.VENDER_HOTEL,
        ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD,
        ENGINE_ACTIONS.LEVANTAR_HIPOTECA
      );
    }

    actions.push(
      ENGINE_ACTIONS.VENDER_PROPIEDAD,
      ENGINE_ACTIONS.COMPRAR_CARTA_SALIR_CARCEL
    );

    return [...new Set(actions)];
  }

  describirAccionesDePropiedad(playerId, propertyId) {
    const player = this.findPlayer(playerId);
    const property = this.findSpaceById(propertyId);
    const allowedActions = new Set(this.listarAccionesDisponibles({ playerId }));

    const evaluate = (actionName, validator) => {
      if (!allowedActions.has(actionName)) {
        return {
          allowed: false,
          reason: this.explainUnavailableAction(player, actionName)
        };
      }

      try {
        validator();
        return { allowed: true, reason: null };
      } catch (error) {
        return {
          allowed: false,
          reason: error?.message || "Esta accion no esta disponible en este momento"
        };
      }
    };

    return {
      comprarCasa: evaluate(ENGINE_ACTIONS.COMPRAR_CASA, () => this.validateHousePurchase(player, property)),
      comprarHotel: evaluate(ENGINE_ACTIONS.COMPRAR_HOTEL, () => this.validateHotelPurchase(player, property, this.requiredHousesForHotel())),
      venderCasa: evaluate(ENGINE_ACTIONS.VENDER_CASA, () => this.validateHouseSale(player, property)),
      venderHotel: evaluate(ENGINE_ACTIONS.VENDER_HOTEL, () => this.validateHotelSale(player, property, this.requiredHousesForHotel())),
      hipotecarPropiedad: evaluate(ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD, () => this.validateMortgage(player, property)),
      levantarHipoteca: evaluate(ENGINE_ACTIONS.LEVANTAR_HIPOTECA, () => this.validateMortgageLift(player, property))
    };
  }

  ejecutarAccion(actionName, payload = {}) {
    assert(actionName, "Debes indicar una accion");

    switch (actionName) {
      case ENGINE_ACTIONS.INICIAR_PARTIDA:
        return this.iniciarPartida(payload);
      case ENGINE_ACTIONS.TIRAR_DADOS:
        return this.tirarDados(payload);
      case ENGINE_ACTIONS.COMPRAR_PROPIEDAD:
        return this.comprarPropiedad(payload);
      case ENGINE_ACTIONS.RECHAZAR_COMPRA:
        return this.rechazarCompra(payload);
      case ENGINE_ACTIONS.INICIAR_SUBASTA:
        return this.iniciarSubasta(payload);
      case ENGINE_ACTIONS.HACER_OFERTA:
        return this.hacerOferta(payload);
      case ENGINE_ACTIONS.RETIRARSE_DE_SUBASTA:
        return this.retirarseDeSubasta(payload);
      case ENGINE_ACTIONS.RESOLVER_CARTA:
        return this.resolverCarta(payload);
      case ENGINE_ACTIONS.PAGAR_RENTA:
        return this.pagarRenta(payload);
      case ENGINE_ACTIONS.PAGAR_IMPUESTO:
        return this.pagarImpuesto(payload);
      case ENGINE_ACTIONS.COMPRAR_CASA:
        return this.comprarCasa(payload.propertyId, payload);
      case ENGINE_ACTIONS.COMPRAR_HOTEL:
        return this.comprarHotel(payload.propertyId, payload);
      case ENGINE_ACTIONS.VENDER_CASA:
        return this.venderCasa(payload.propertyId, payload);
      case ENGINE_ACTIONS.VENDER_HOTEL:
        return this.venderHotel(payload.propertyId, payload);
      case ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD:
        return this.hipotecarPropiedad(payload.propertyId, payload);
      case ENGINE_ACTIONS.LEVANTAR_HIPOTECA:
        return this.levantarHipoteca(payload.propertyId, payload);
      case ENGINE_ACTIONS.VENDER_PROPIEDAD:
        return this.venderPropiedad(payload);
      case ENGINE_ACTIONS.COMPRAR_CARTA_SALIR_CARCEL:
        return this.comprarCartaSalirCarcel(payload);
      case ENGINE_ACTIONS.USAR_CARTA_SALIR_CARCEL:
        return this.usarCartaSalirCarcel(payload);
      case ENGINE_ACTIONS.PAGAR_MULTA_CARCEL:
        return this.pagarMultaCarcel(payload);
      case ENGINE_ACTIONS.RESOLVER_DEUDA_PENDIENTE:
        return this.resolverDeudaPendiente(payload);
      case ENGINE_ACTIONS.RESOLVER_QUIEBRA:
        return this.resolverQuiebra(payload);
      case ENGINE_ACTIONS.TERMINAR_TURNO:
        return this.terminarTurno(payload);
      default:
        throw new Error(`Accion no soportada: ${actionName}`);
    }
  }

  normalizeRoll(forcedDice) {
    if (!forcedDice) {
      return rollTwoDice(this.random);
    }

    assert(Array.isArray(forcedDice) && forcedDice.length === 2, "Los dados forzados deben ser un arreglo de dos valores");
    const [dieOne, dieTwo] = forcedDice;
    assert(Number.isInteger(dieOne) && dieOne >= 1 && dieOne <= 6, "El primer dado es invalido");
    assert(Number.isInteger(dieTwo) && dieTwo >= 1 && dieTwo <= 6, "El segundo dado es invalido");

    return {
      dice: [dieOne, dieTwo],
      total: dieOne + dieTwo,
      isDouble: dieOne === dieTwo
    };
  }

  currentPlayer() {
    return this.state.players[this.state.currentPlayerIndex];
  }

  findPlayer(playerId) {
    const player = this.state.players.find((candidate) => candidate.id === playerId);
    assert(player, `Jugador no encontrado: ${playerId}`);
    return player;
  }

  findSpaceById(spaceId) {
    const space = this.spacesById.get(spaceId);
    assert(space, `Casilla no encontrada: ${spaceId}`);
    return space;
  }

  findSpaceByIndex(index) {
    const space = this.state.board.spaces[index];
    assert(space, `Indice de casilla invalido: ${index}`);
    return space;
  }

  activePlayers() {
    return this.state.players.filter((player) => !player.bankrupt);
  }

  ensureGameRunning(now) {
    assert(this.state.status !== GAME_STATUSES.PREPARACION, "La partida todavia no ha comenzado");
    assert(this.state.status !== GAME_STATUSES.FINALIZADO, "La partida ya finalizo");
    this.checkTimeLimit(now);
  }

  ensurePlayerCanAct(playerId) {
    const player = this.findPlayer(playerId);
    assert(!player.bankrupt, "Un jugador en quiebra no puede jugar");
  }

  ensureNoBlockingActionForRoll(player) {
    assert(!this.state.pendingPurchase, "Debes resolver la compra pendiente antes de tirar");
    assert(!this.state.pendingCard, "Debes resolver la carta pendiente antes de tirar");
    assert(!this.state.pendingTax, "Debes resolver el impuesto pendiente antes de tirar");
    assert(!this.state.pendingDebt, "Debes resolver la deuda pendiente antes de tirar");
    assert(!this.state.auction, "Debes terminar la subasta antes de tirar");

    if (player.deferredBankDebts.length > 0) {
      const deferred = player.deferredBankDebts.shift();
      this.state.pendingDebt = {
        debtorId: player.id,
        creditorType: CREDITOR_TYPES.BANK,
        creditorId: null,
        amount: deferred.amount,
        reason: deferred.reason
      };
      this.state.status = GAME_STATUSES.RESOLVIENDO_DEUDA;
      this.state.turn.phase = TURN_PHASES.AWAITING_DEBT_RESOLUTION;
      throw new Error("El jugador tiene cargos pendientes con el Banco que debe resolver antes de tirar");
    }

    assert(this.state.turn.phase === TURN_PHASES.AWAITING_ROLL || this.state.turn.phase === TURN_PHASES.AWAITING_JAIL_DECISION, "El turno no esta listo para tirar dados");
  }

  hasBlockingAction() {
    return Boolean(this.state.pendingPurchase || this.state.pendingCard || this.state.pendingTax || this.state.pendingDebt || this.state.auction);
  }

  receiveMoney(player, amount, reason) {
    player.cash += amount;
    this.log("PLAYER_RECEIVED_MONEY", { playerId: player.id, amount, reason });
  }

  transferCash(player, creditorType, amount, reason, creditorId = null) {
    assert(player.cash >= amount, "El jugador no tiene suficiente efectivo para transferir esa cantidad");
    player.cash -= amount;

    if (creditorType === CREDITOR_TYPES.PLAYER && creditorId) {
      this.findPlayer(creditorId).cash += amount;
    }

    this.log("PLAYER_PAID", {
      playerId: player.id,
      amount,
      creditorType,
      creditorId,
      reason
    });
  }

  chargePlayer(player, creditorType, creditorId, amount, reason) {
    if (amount <= 0) {
      return;
    }

    if (player.cash >= amount) {
      this.transferCash(player, creditorType, amount, reason, creditorId);
      return;
    }

    this.state.pendingDebt = {
      debtorId: player.id,
      creditorType,
      creditorId,
      amount,
      reason
    };
    this.state.status = GAME_STATUSES.RESOLVIENDO_DEUDA;
    this.state.turn.phase = TURN_PHASES.AWAITING_DEBT_RESOLUTION;
    this.log("DEBT_CREATED", { debtorId: player.id, creditorType, creditorId, amount, reason });
  }

  movePlayerBy(player, steps, { collectSalary }) {
    const currentPosition = player.position;
    const rawPosition = currentPosition + steps;
    const nextPosition = modulo(rawPosition, this.state.board.size);

    if (collectSalary && steps > 0 && rawPosition >= this.state.board.size) {
      this.receiveMoney(player, GO_SALARY, "PASO_POR_SALIDA");
    }

    player.position = nextPosition;
    this.log("PLAYER_MOVED", {
      playerId: player.id,
      from: currentPosition,
      to: nextPosition,
      steps
    });
  }

  movePlayerTo(player, targetIndex, { collectSalary }) {
    const currentPosition = player.position;

    if (collectSalary && targetIndex < currentPosition) {
      this.receiveMoney(player, GO_SALARY, "PASO_POR_SALIDA");
    }

    player.position = targetIndex;
    this.log("PLAYER_MOVED_TO", { playerId: player.id, from: currentPosition, to: targetIndex });
  }

  movePlayerToNearest(player, propertyKind, { collectSalary }) {
    let cursor = player.position;

    do {
      cursor = modulo(cursor + 1, this.state.board.size);
      const candidate = this.findSpaceByIndex(cursor);

      if (candidate.propertyKind === propertyKind) {
        this.movePlayerTo(player, cursor, { collectSalary });
        return;
      }
    } while (cursor !== player.position);

    throw new Error(`No se encontro una casilla del tipo ${propertyKind}`);
  }

  resolveCurrentSpace(player, movementContext) {
    const space = this.findSpaceByIndex(player.position);
    this.log("SPACE_RESOLVED", { playerId: player.id, spaceId: space.id, type: space.type });

    switch (space.type) {
      case SPACE_TYPES.GO:
      case SPACE_TYPES.FREE_PARKING:
      case SPACE_TYPES.JAIL:
        this.state.status = GAME_STATUSES.JUGANDO;
        break;
      case SPACE_TYPES.GO_TO_JAIL:
        this.sendPlayerToJail(player, "GO_TO_JAIL_SPACE");
        break;
      case SPACE_TYPES.TAX:
        this.resolveTax(player, space);
        break;
      case SPACE_TYPES.CHANCE:
        this.drawCard(player, CARD_DECKS.CHANCE);
        break;
      case SPACE_TYPES.COMMUNITY_CHEST:
        this.drawCard(player, CARD_DECKS.COMMUNITY_CHEST);
        break;
      case SPACE_TYPES.PROPERTY:
      case SPACE_TYPES.RAILROAD:
      case SPACE_TYPES.UTILITY:
        this.resolveOwnableSpace(player, space, movementContext);
        break;
      default:
        throw new Error(`Tipo de casilla no soportado: ${space.type}`);
    }
  }

  resolveTax(player, taxSpace) {
    if (taxSpace.taxKind === "OPTIONAL_PERCENT") {
      this.state.pendingTax = {
        playerId: player.id,
        fixedAmount: taxSpace.fixedAmount,
        percentAmount: Math.ceil(this.calculateEstateForTax(player) * taxSpace.percentRate)
      };
      this.state.status = GAME_STATUSES.ESPERANDO_ACCION_DEL_JUGADOR;
      this.state.turn.phase = TURN_PHASES.AWAITING_TAX_DECISION;
      return;
    }

    this.chargePlayer(player, CREDITOR_TYPES.BANK, null, taxSpace.fixedAmount, "IMPUESTO");
  }

  resolveOwnableSpace(player, space, movementContext) {
    if (!space.ownerId) {
      this.state.pendingPurchase = {
        playerId: player.id,
        propertyId: space.id
      };
      this.state.status = GAME_STATUSES.ESPERANDO_ACCION_DEL_JUGADOR;
      this.state.turn.phase = TURN_PHASES.AWAITING_PURCHASE_DECISION;
      return;
    }

    if (space.ownerId === player.id || space.isMortgaged) {
      this.state.status = GAME_STATUSES.JUGANDO;
      return;
    }

    const amount = this.calculateRent(space, movementContext);

    if (amount <= 0) {
      this.state.status = GAME_STATUSES.JUGANDO;
      return;
    }

    if (this.options.requireRentClaim) {
      this.state.pendingRentClaim = {
        ownerId: space.ownerId,
        debtorId: player.id,
        propertyId: space.id,
        amount,
        expiresBeforePlayerId: this.peekNextActivePlayerId()
      };
      this.state.status = GAME_STATUSES.ESPERANDO_ACCION_DEL_JUGADOR;
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      return;
    }

    this.chargePlayer(player, CREDITOR_TYPES.PLAYER, space.ownerId, amount, "RENTA");
  }

  calculateRent(space, movementContext) {
    if (space.isMortgaged) {
      return 0;
    }

    if (isStreet(space)) {
      if (space.hasHotel) {
        return space.rents[5];
      }

      if (space.houses > 0) {
        return space.rents[space.houses];
      }

      const ownerOwnsGroup = this.playerOwnsCompleteGroup(space.ownerId, space.colorGroup);
      const groupHasMortgage = this.groupSpaces(space.colorGroup).some((candidate) => candidate.isMortgaged);
      return ownerOwnsGroup && !groupHasMortgage ? space.rents[0] * 2 : space.rents[0];
    }

    if (isRailroad(space)) {
      const count = this.playerOwnedRailroads(space.ownerId).filter((candidate) => !candidate.isMortgaged).length;
      const baseRent = space.rentSchedule[Math.max(0, count - 1)] || 0;
      return baseRent * (movementContext.rentMultiplier || 1);
    }

    if (isUtility(space)) {
      const count = this.playerOwnedUtilities(space.ownerId).filter((candidate) => !candidate.isMortgaged).length;
      const multiplier = movementContext.utilityMultiplierOverride || (count === 2 ? 10 : 4);
      return (movementContext.diceTotal || this.lastDiceTotal()) * multiplier;
    }

    return 0;
  }

  drawCard(player, deckName) {
    const deck = this.state.decks[deckName];
    assert(deck.drawPile.length > 0, `No hay cartas disponibles en ${deckName}`);

    const card = deck.drawPile.shift();
    this.state.pendingCard = {
      playerId: player.id,
      deck: deckName,
      card
    };
    this.state.status = GAME_STATUSES.ESPERANDO_ACCION_DEL_JUGADOR;
    this.state.turn.phase = TURN_PHASES.AWAITING_CARD_RESOLUTION;
    this.log("CARD_DRAWN", { playerId: player.id, deck: deckName, cardId: card.id });
  }

  recycleCard(card) {
    if (!card.keepable) {
      this.state.decks[card.deck].drawPile.push(card);
    }
  }

  sendPlayerToJail(player, reason) {
    const jailSpace = this.findSpaceById("jail");
    player.position = jailSpace.index;
    player.jail.inJail = true;
    player.jail.attempts = 0;
    this.state.turn.consecutiveDoubles = 0;
    this.state.turn.extraTurnEarned = false;
    this.state.turn.noExtraTurnBecauseJail = true;
    this.state.status = GAME_STATUSES.JUGANDO;
    this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    this.log("PLAYER_SENT_TO_JAIL", { playerId: player.id, reason });
  }

  resolveJailRoll(player, roll) {
    this.state.turn.lastRoll = roll;
    this.state.turn.consecutiveDoubles = 0;
    this.state.turn.extraTurnEarned = false;
    this.state.turn.noExtraTurnBecauseJail = true;

    if (roll.isDouble) {
      player.jail.inJail = false;
      player.jail.attempts = 0;
      this.movePlayerBy(player, roll.total, { collectSalary: true });
      this.resolveCurrentSpace(player, {
        diceTotal: roll.total,
        rentMultiplier: 1,
        utilityMultiplierOverride: null
      });

      if (!this.hasBlockingAction()) {
        this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      }

      this.log("PLAYER_LEFT_JAIL_WITH_DOUBLES", { playerId: player.id, total: roll.total });
      return this.getState();
    }

    player.jail.attempts += 1;

    if (player.jail.attempts >= MAX_JAIL_ATTEMPTS) {
      this.chargePlayer(player, CREDITOR_TYPES.BANK, null, JAIL_FINE, "TERCER_INTENTO_CARCEL");

      if (!this.state.pendingDebt) {
        player.jail.inJail = false;
        player.jail.attempts = 0;
        this.movePlayerBy(player, roll.total, { collectSalary: true });
        this.resolveCurrentSpace(player, {
          diceTotal: roll.total,
          rentMultiplier: 1,
          utilityMultiplierOverride: null
        });
      } else {
        this.state.pendingContinuation = {
          type: "MOVE_AFTER_JAIL_FINE",
          playerId: player.id,
          total: roll.total
        };
      }

      if (!this.hasBlockingAction()) {
        this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      }

      this.log("PLAYER_LEFT_JAIL_AFTER_THIRD_FAIL", { playerId: player.id, total: roll.total });
      return this.getState();
    }

    this.state.status = GAME_STATUSES.JUGANDO;
    this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    this.log("PLAYER_REMAINS_IN_JAIL", { playerId: player.id, attempts: player.jail.attempts });
    return this.getState();
  }

  runPendingContinuation() {
    const continuation = this.state.pendingContinuation;

    if (!continuation) {
      return;
    }

    this.state.pendingContinuation = null;

    if (continuation.type === "MOVE_AFTER_JAIL_FINE") {
      const player = this.findPlayer(continuation.playerId);
      player.jail.inJail = false;
      player.jail.attempts = 0;
      this.movePlayerBy(player, continuation.total, { collectSalary: true });
      this.resolveCurrentSpace(player, {
        diceTotal: continuation.total,
        rentMultiplier: 1,
        utilityMultiplierOverride: null
      });
      return;
    }

    if (continuation.type === "LEAVE_JAIL_AFTER_DEBT") {
      const player = this.findPlayer(continuation.playerId);
      player.jail.inJail = false;
      player.jail.attempts = 0;
      this.state.turn.phase = TURN_PHASES.AWAITING_ROLL;
      return;
    }

    if (continuation.type === "TRANSFER_QUEUE") {
      this.processTransferQueue(continuation.transfers, continuation.index);
      return;
    }

    if (continuation.type === "BANKRUPTCY_AUCTIONS") {
      this.startNextBankruptcyAuction();
    }
  }

  processTransferQueue(transfers, startIndex = 0) {
    for (let index = startIndex; index < transfers.length; index += 1) {
      const transfer = transfers[index];
      const debtor = this.findPlayer(transfer.fromPlayerId);
      this.chargePlayer(debtor, transfer.creditorType, transfer.creditorId, transfer.amount, transfer.reason);

      if (this.state.pendingDebt) {
        this.state.pendingContinuation = {
          type: "TRANSFER_QUEUE",
          transfers,
          index: index + 1
        };
        return;
      }
    }
  }

  advanceAuctionTurn() {
    const auction = this.state.auction;
    const stillIn = auction.participantIds.filter((playerId) => !auction.passedPlayerIds.includes(playerId));

    if (stillIn.length === 0) {
      this.finalizeAuction(null);
      return;
    }

    if (stillIn.length === 1 && auction.currentBidderId) {
      this.finalizeAuction(auction.currentBidderId);
      return;
    }

    let cursor = auction.participantIds.indexOf(auction.activeBidderId);

    do {
      cursor = (cursor + 1) % auction.participantIds.length;
      const candidateId = auction.participantIds[cursor];

      if (!auction.passedPlayerIds.includes(candidateId)) {
        auction.activeBidderId = candidateId;
        return;
      }
    } while (cursor !== auction.participantIds.indexOf(auction.activeBidderId));
  }

  finalizeAuction(winnerId) {
    const auction = this.state.auction;

    if (winnerId) {
      const winner = this.findPlayer(winnerId);
      this.transferCash(winner, CREDITOR_TYPES.BANK, auction.currentBid, "SUBASTA");

      if (auction.kind === AUCTION_KINDS.PROPERTY) {
        const property = this.findSpaceById(auction.assetId);
        this.assignPropertyToPlayer(property, winner);
      }
    }

    this.log("AUCTION_FINISHED", {
      auctionId: auction.id,
      winnerId,
      amount: auction.currentBid
    });

    this.state.auction = null;
    this.state.status = GAME_STATUSES.JUGANDO;

    if (this.state.pendingBankruptcyAuctions.length > 0) {
      this.startNextBankruptcyAuction();
      return;
    }

    if (this.currentPlayer().bankrupt) {
      this.advanceToNextPlayer();
      this.checkGameEnd(Date.now());
      return;
    }

    this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
    this.checkGameEnd(Date.now());
  }

  startNextBankruptcyAuction() {
    if (this.state.pendingBankruptcyAuctions.length === 0) {
      this.state.turn.phase = TURN_PHASES.AWAITING_TURN_END;
      return;
    }

    const nextPropertyId = this.state.pendingBankruptcyAuctions.shift();
    this.iniciarSubasta({ tipo: AUCTION_KINDS.PROPERTY, objetivoId: nextPropertyId });
  }

  assignPropertyToPlayer(property, player) {
    property.ownerId = player.id;
    if (!player.propertyIds.includes(property.id)) {
      player.propertyIds.push(property.id);
    }
    this.state.bank.propertyIds = this.state.bank.propertyIds.filter((propertyId) => propertyId !== property.id);
  }

  transferPropertyOwnership(property, seller, buyer) {
    seller.propertyIds = seller.propertyIds.filter((propertyId) => propertyId !== property.id);
    property.ownerId = buyer.id;
    if (!buyer.propertyIds.includes(property.id)) {
      buyer.propertyIds.push(property.id);
    }
  }

  playerOwnsCompleteGroup(playerId, colorGroup) {
    const group = this.groupSpaces(colorGroup);
    return group.every((space) => space.ownerId === playerId);
  }

  playerOwnedRailroads(playerId) {
    return this.state.board.spaces.filter((space) => isRailroad(space) && space.ownerId === playerId);
  }

  playerOwnedUtilities(playerId) {
    return this.state.board.spaces.filter((space) => isUtility(space) && space.ownerId === playerId);
  }

  groupSpaces(colorGroup) {
    return this.streetGroups.get(colorGroup) || [];
  }

  groupHasBuildings(property) {
    if (!isStreet(property)) {
      return false;
    }

    return this.groupSpaces(property.colorGroup).some((space) => space.houses > 0 || space.hasHotel);
  }

  validateHousePurchase(player, property) {
    assert(isStreet(property), "Solo se pueden construir casas en solares");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(!property.hasHotel, "No se puede construir una casa sobre un hotel");
    assert(property.houses < this.requiredHousesForHotel(), "La propiedad ya tiene el maximo de casas permitido");
    assert(this.playerOwnsCompleteGroup(player.id, property.colorGroup), "Debes poseer el grupo completo para construir");
    assert(!this.groupSpaces(property.colorGroup).some((space) => space.isMortgaged), "No se puede construir con propiedades hipotecadas en el grupo");
    assert(this.state.bank.housesAvailable > 0, "El banco no tiene casas disponibles");
    assert(player.cash >= property.houseCost, "No hay dinero suficiente para comprar la casa");
    this.assertUniformHouseDelta(property, +1);
  }

  validateHotelPurchase(player, property, requiredHouses) {
    assert(isStreet(property), "Solo se pueden comprar hoteles en solares");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(this.playerOwnsCompleteGroup(player.id, property.colorGroup), "Debes poseer el grupo completo para construir hoteles");
    assert(!this.groupSpaces(property.colorGroup).some((space) => space.isMortgaged), "No se puede construir con propiedades hipotecadas en el grupo");
    assert(!property.hasHotel, "La propiedad ya tiene hotel");
    assert(this.groupSpaces(property.colorGroup).every((space) => space.houses === requiredHouses && !space.hasHotel), "Cada solar del grupo debe tener el numero requerido de casas antes del hotel");
    assert(this.state.bank.hotelsAvailable > 0, "El banco no tiene hoteles disponibles");
    assert(player.cash >= property.hotelCost, "No hay dinero suficiente para comprar el hotel");
  }

  validateHouseSale(player, property) {
    assert(isStreet(property), "Solo se pueden vender casas en solares");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(property.houses > 0, "La propiedad no tiene casas para vender");
    assert(!property.hasHotel, "No se puede vender una casa mientras exista un hotel");
    this.assertUniformHouseDelta(property, -1);
  }

  validateHotelSale(player, property, requiredHouses) {
    assert(isStreet(property), "Solo se pueden vender hoteles en solares");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(property.hasHotel, "La propiedad no tiene hotel");
    assert(this.state.bank.housesAvailable >= requiredHouses, "El banco no tiene casas suficientes para reemplazar el hotel");
  }

  validateMortgage(player, property) {
    assert(isOwnable(property), "Solo se pueden hipotecar propiedades del tablero");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(!property.isMortgaged, "La propiedad ya esta hipotecada");

    if (isStreet(property)) {
      assert(!this.groupHasBuildings(property), "No se puede hipotecar una propiedad con edificios en su grupo");
    }
  }

  validateMortgageLift(player, property) {
    assert(isOwnable(property), "Solo se pueden levantar hipotecas de propiedades del tablero");
    assert(property.ownerId === player.id, "La propiedad no pertenece al jugador actual");
    assert(property.isMortgaged, "La propiedad no esta hipotecada");
    assert(player.cash >= this.calculateMortgageLiftCost(property), "No hay dinero suficiente para levantar la hipoteca");
  }

  explainUnavailableAction(player, actionName) {
    if (this.state.status === GAME_STATUSES.FINALIZADO) {
      return "La partida ya termino";
    }

    if (player.bankrupt) {
      return "Los jugadores en quiebra no pueden realizar acciones";
    }

    if (this.state.auction) {
      return "Hay una subasta activa que debes resolver primero";
    }

    if (this.state.pendingPurchase) {
      return "Primero debes decidir que hacer con la propiedad recien descubierta";
    }

    if (this.state.pendingCard) {
      return "Primero debes resolver la carta pendiente";
    }

    if (this.state.pendingTax) {
      return "Primero debes resolver el impuesto pendiente";
    }

    if (this.state.pendingDebt && this.state.pendingDebt.debtorId !== player.id) {
      return "Otro jugador esta resolviendo una deuda en este momento";
    }

    if (this.currentPlayer().id !== player.id && [
      ENGINE_ACTIONS.COMPRAR_CASA,
      ENGINE_ACTIONS.COMPRAR_HOTEL,
      ENGINE_ACTIONS.VENDER_CASA,
      ENGINE_ACTIONS.VENDER_HOTEL,
      ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD,
      ENGINE_ACTIONS.LEVANTAR_HIPOTECA
    ].includes(actionName)) {
      return "Solo el jugador del turno puede administrar construcciones e hipotecas";
    }

    return "Esta accion no esta disponible en este momento";
  }

  assertUniformHouseDelta(property, delta) {
    const group = this.groupSpaces(property.colorGroup);
    const nextValues = group.map((space) => {
      if (space.id === property.id) {
        return space.houses + delta;
      }

      return space.houses;
    });

    assert(nextValues.every((value) => value >= 0), "La operacion de casas dejaria un valor invalido");
    assert(Math.max(...nextValues) - Math.min(...nextValues) <= 1, "La construccion o venta debe mantenerse uniforme");
  }

  calculateMortgageLiftCost(property) {
    return property.mortgageValue + Math.ceil(property.mortgageValue * 0.1);
  }

  calculateRepairCost(player, perHouse, perHotel) {
    return player.propertyIds.reduce((total, propertyId) => {
      const property = this.findSpaceById(propertyId);
      return total + (property.houses || 0) * perHouse + (property.hasHotel ? perHotel : 0);
    }, 0);
  }

  calculateEstateForTax(player) {
    return player.cash + player.propertyIds.reduce((total, propertyId) => {
      const property = this.findSpaceById(propertyId);
      const buildingValue = (property.houses || 0) * (property.houseCost || 0) + (property.hasHotel ? property.hotelCost || 0 : 0);
      return total + property.price + buildingValue;
    }, 0);
  }

  resolveBankruptcy(debtor, creditorType, creditorId, reason) {
    this.state.status = GAME_STATUSES.RESOLVIENDO_QUIEBRA;
    this.log("BANKRUPTCY_STARTED", { debtorId: debtor.id, creditorType, creditorId, reason });

    if (creditorType === CREDITOR_TYPES.PLAYER && creditorId) {
      const creditor = this.findPlayer(creditorId);
      creditor.cash += debtor.cash;
      debtor.cash = 0;

      let immediateInterestDue = 0;

      for (const propertyId of [...debtor.propertyIds]) {
        const property = this.findSpaceById(propertyId);
        this.transferPropertyOwnership(property, debtor, creditor);

        if (property.isMortgaged) {
          immediateInterestDue += Math.ceil(property.mortgageValue * 0.1);
        }
      }

      debtor.propertyIds = [];
      Object.values(CARD_DECKS).forEach((deckName) => {
        creditor.getOutOfJailCards[deckName] += debtor.getOutOfJailCards[deckName];
        debtor.getOutOfJailCards[deckName] = 0;
      });

      if (immediateInterestDue > 0) {
        if (creditor.cash >= immediateInterestDue) {
          this.transferCash(creditor, CREDITOR_TYPES.BANK, immediateInterestDue, "INTERESES_HIPOTECAS_QUIEBRA");
        } else {
          creditor.deferredBankDebts.push({
            amount: immediateInterestDue,
            reason: "INTERESES_HIPOTECAS_QUIEBRA"
          });
        }
      }
    } else {
      for (const propertyId of [...debtor.propertyIds]) {
        const property = this.findSpaceById(propertyId);

        if (property.hasHotel) {
          this.state.bank.hotelsAvailable += 1;
          property.hasHotel = false;
        }

        if (property.houses > 0) {
          this.state.bank.housesAvailable += property.houses;
          property.houses = 0;
        }

        property.ownerId = null;
        property.isMortgaged = false;
        this.state.bank.propertyIds.push(property.id);
        this.state.pendingBankruptcyAuctions.push(property.id);
      }

      debtor.propertyIds = [];
      debtor.cash = 0;

      if (this.state.pendingBankruptcyAuctions.length > 0) {
        this.state.pendingContinuation = { type: "BANKRUPTCY_AUCTIONS" };
      }
    }

    debtor.bankrupt = true;
    debtor.jail.inJail = false;
    debtor.jail.attempts = 0;

    this.log("BANKRUPTCY_RESOLVED", { debtorId: debtor.id, creditorType, creditorId });
    this.state.status = GAME_STATUSES.JUGANDO;

    if (this.state.pendingContinuation) {
      this.runPendingContinuation();
      return;
    }

    if (this.state.auction) {
      return;
    }

    if (this.currentPlayer().bankrupt && this.activePlayers().length > 1) {
      this.advanceToNextPlayer();
    }
  }

  advanceToNextPlayer() {
    const activePlayers = this.activePlayers();

    if (activePlayers.length <= 1) {
      this.finishGame();
      return;
    }

    let nextIndex = this.state.currentPlayerIndex;

    do {
      nextIndex = (nextIndex + 1) % this.state.players.length;
    } while (this.state.players[nextIndex].bankrupt);

    this.state.currentPlayerIndex = nextIndex;
    this.state.turn.currentPlayerId = this.currentPlayer().id;
    this.state.turn.phase = this.currentPlayer().jail.inJail ? TURN_PHASES.AWAITING_JAIL_DECISION : TURN_PHASES.AWAITING_ROLL;
    this.state.turn.lastRoll = null;
    this.state.turn.consecutiveDoubles = 0;
    this.state.turn.extraTurnEarned = false;
    this.state.turn.noExtraTurnBecauseJail = false;
    this.state.turn.number += 1;
    this.state.status = GAME_STATUSES.JUGANDO;
    this.log("TURN_ADVANCED", { currentPlayerId: this.currentPlayer().id });
  }

  peekNextActivePlayerId() {
    let nextIndex = this.state.currentPlayerIndex;

    do {
      nextIndex = (nextIndex + 1) % this.state.players.length;
    } while (this.state.players[nextIndex].bankrupt);

    return this.state.players[nextIndex].id;
  }

  expirePendingRentClaim() {
    const claim = this.state.pendingRentClaim;

    if (!claim) {
      return;
    }

    if (claim.expiresBeforePlayerId === this.currentPlayer().id) {
      this.log("RENT_CLAIM_EXPIRED", { propertyId: claim.propertyId, ownerId: claim.ownerId, debtorId: claim.debtorId });
      this.state.pendingRentClaim = null;
    }
  }

  checkTimeLimit(now) {
    if (this.mode !== GAME_MODES.TIMED || !this.endAt || now < this.endAt || this.state.status === GAME_STATUSES.FINALIZADO) {
      return;
    }

    this.finishGame();
  }

  checkGameEnd(now) {
    if (this.state.status === GAME_STATUSES.FINALIZADO) {
      return;
    }

    if (this.state.auction || this.state.pendingBankruptcyAuctions.length > 0 || (this.state.pendingContinuation && this.state.pendingContinuation.type === "BANKRUPTCY_AUCTIONS")) {
      return;
    }

    const bankruptCount = this.state.players.filter((player) => player.bankrupt).length;

    if (this.mode === GAME_MODES.SHORT && bankruptCount >= 2) {
      this.finishGame();
      return;
    }

    if (this.activePlayers().length <= 1) {
      this.finishGame();
      return;
    }

    this.checkTimeLimit(now);
  }

  finishGame() {
    const ranking = this.rankearJugadores();
    const winner = ranking[0] || null;

    this.state.status = GAME_STATUSES.FINALIZADO;
    this.state.winnerId = winner ? winner.playerId : null;
    this.state.endedAt = Date.now();
    this.state.turn.phase = TURN_PHASES.COMPLETED;
    this.log("GAME_FINISHED", { winnerId: this.state.winnerId });
  }

  repartirPropiedadesIniciales() {
    const deedIds = shuffle([...this.state.bank.propertyIds], this.random);
    let pointer = 0;

    for (const player of this.state.players) {
      for (let drawCount = 0; drawCount < 2; drawCount += 1) {
        const propertyId = deedIds[pointer];
        pointer += 1;
        const property = this.findSpaceById(propertyId);

        assert(player.cash >= property.price, "El jugador no puede pagar una propiedad inicial");
        this.transferCash(player, CREDITOR_TYPES.BANK, property.price, "PROPIEDAD_INICIAL");
        this.assignPropertyToPlayer(property, player);
      }
    }
  }

  requiredHousesForHotel() {
    return this.mode === GAME_MODES.SHORT ? 3 : 4;
  }

  lastDiceTotal() {
    return this.state.turn.lastRoll ? this.state.turn.lastRoll.total : 0;
  }

  log(type, payload = {}) {
    this.state.events.push({
      id: createId("event", this.sequence++),
      type,
      payload
    });
  }
}
