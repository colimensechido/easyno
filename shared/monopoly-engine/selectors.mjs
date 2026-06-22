export function buildPlayerSnapshot(game, playerId) {
  const player = game.findPlayer(playerId);
  const availableActions = game.listarAccionesDisponibles({ playerId: player.id });

  return {
    id: player.id,
    name: player.name,
    cash: player.cash,
    position: player.position,
    bankrupt: player.bankrupt,
    inJail: player.jail.inJail,
    jailAttempts: player.jail.attempts,
    propertyIds: [...player.propertyIds],
    properties: player.propertyIds.map((propertyId) => {
      const property = game.findSpaceById(propertyId);
      return {
        id: property.id,
        name: property.name,
        type: property.type,
        propertyKind: property.propertyKind || null,
        colorGroup: property.colorGroup || null,
        price: property.price,
        mortgageValue: property.mortgageValue,
        houses: property.houses || 0,
        hasHotel: Boolean(property.hasHotel),
        isMortgaged: Boolean(property.isMortgaged),
        houseCost: property.houseCost || 0,
        hotelCost: property.hotelCost || 0,
        rents: Array.isArray(property.rents) ? [...property.rents] : null,
        rentSchedule: Array.isArray(property.rentSchedule) ? [...property.rentSchedule] : null,
        management: game.describirAccionesDePropiedad(player.id, property.id)
      };
    }),
    getOutOfJailCards: { ...player.getOutOfJailCards },
    wealth: game.calcularRiquezaJugador(player.id),
    availableActions
  };
}

export function buildTurnSnapshot(game) {
  const state = game.getState();

  return {
    gameStatus: state.status,
    turnNumber: state.turn.number,
    currentPlayerId: state.turn.currentPlayerId,
    phase: state.turn.phase,
    lastRoll: state.turn.lastRoll,
    housePurchasesThisTurn: Array.isArray(state.turn.housePurchasesThisTurn) ? [...state.turn.housePurchasesThisTurn] : [],
    pendingPurchase: state.pendingPurchase,
    pendingCard: state.pendingCard,
    pendingTax: state.pendingTax,
    pendingRentClaim: state.pendingRentClaim,
    pendingDebt: state.pendingDebt,
    tradeOffers: (state.tradeOffers || []).filter((offer) => offer.status === "PENDING"),
    auction: state.auction
  };
}

export function buildGameSnapshot(game) {
  const state = game.getState();

  return {
    mode: state.mode,
    status: state.status,
    winnerId: state.winnerId,
    currentPlayerId: state.turn.currentPlayerId,
    board: state.board.spaces.map((space) => ({
      index: space.index,
      id: space.id,
      name: space.name,
      type: space.type,
      propertyKind: space.propertyKind || null,
      colorGroup: space.colorGroup || null,
      ownerId: space.ownerId || null,
      price: space.price || null,
      mortgageValue: space.mortgageValue || null,
      houseCost: space.houseCost || 0,
      hotelCost: space.hotelCost || 0,
      rents: Array.isArray(space.rents) ? [...space.rents] : null,
      rentSchedule: Array.isArray(space.rentSchedule) ? [...space.rentSchedule] : null,
      taxKind: space.taxKind || null,
      fixedAmount: space.fixedAmount || null,
      percentRate: space.percentRate || null,
      houses: space.houses || 0,
      hasHotel: Boolean(space.hasHotel),
      isMortgaged: Boolean(space.isMortgaged)
    })),
    ranking: game.rankearJugadores(),
    players: state.players.map((player) => buildPlayerSnapshot(game, player.id)),
    turn: buildTurnSnapshot(game),
    finalStats: state.finalStats || null,
    recentEvents: (state.events || []).slice(-200)
  };
}
