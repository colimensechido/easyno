// ============================================================================
// Bots de Monopoly
// ----------------------------------------------------------------------------
// Estos bots NO conocen los detalles internos del motor: solo consultan las
// acciones disponibles (`listarAccionesDisponibles`) y el estado publico, y
// deciden la siguiente accion. Asi quedan desacoplados de la logica de reglas
// y son reutilizables tanto en la simulacion como en partidas reales.
//
// Tipos de bot:
//  - BASIC:        compra casi siempre que puede, construye con reserva minima.
//  - CONSERVATIVE: guarda colchon de efectivo, puja bajo, construye con cautela.
//  - AGGRESSIVE:   compra todo lo posible, puja alto y construye agresivamente.
//
// Arquitectura para estrategia futura: cada perfil es solo un conjunto de
// numeros (PROFILES). Para una IA mas avanzada basta con reemplazar
// `decideAction` por una funcion que evalue el estado completo, manteniendo la
// misma firma `(engine, playerId, type) -> { action, payload }`.
// ============================================================================

import { ENGINE_ACTIONS } from "./actions.mjs";

export const BOT_TYPES = Object.freeze({
  BASIC: "BASIC",
  CONSERVATIVE: "CONSERVATIVE",
  AGGRESSIVE: "AGGRESSIVE"
});

// Parametros que definen el "caracter" de cada bot.
const PROFILES = Object.freeze({
  BASIC: {
    cashBuffer: 0, // efectivo minimo a conservar tras comprar una propiedad
    buildCashBuffer: 200, // efectivo minimo a conservar tras construir
    maxAuctionFactor: 0.6, // tope de puja como fraccion del precio de lista
    buildsHotels: false
  },
  CONSERVATIVE: {
    cashBuffer: 200,
    buildCashBuffer: 500,
    maxAuctionFactor: 0.45,
    buildsHotels: false
  },
  AGGRESSIVE: {
    cashBuffer: 0,
    buildCashBuffer: 50,
    maxAuctionFactor: 1.1,
    buildsHotels: true
  }
});

export function getBotProfile(type) {
  return PROFILES[type] || PROFILES.BASIC;
}

// Recorre las propiedades del jugador y devuelve el id de la primera donde la
// accion de gestion indicada este permitida (segun el propio motor).
function findManageableProperty(engine, player, key) {
  for (const propertyId of player.propertyIds) {
    const management = engine.describirAccionesDePropiedad(player.id, propertyId);
    if (management?.[key]?.allowed) {
      return propertyId;
    }
  }
  return null;
}

// Decision durante una subasta: puja en incrementos razonables hasta un tope
// dependiente del caracter del bot; si no le conviene, se retira.
function decideAuction(engine, player, profile) {
  const auction = engine.state.auction;
  const asset = engine.findSpaceById(auction.assetId);
  const listPrice = asset.price || 0;
  const maxBid = Math.min(player.cash, Math.floor(listPrice * profile.maxAuctionFactor));
  const increment = Math.max(10, Math.floor(listPrice * 0.1));
  const minimumBid = auction.minimumBid || (
    auction.currentBid > 0
      ? Math.ceil(auction.currentBid * 1.25)
      : Math.max(1, Math.ceil(listPrice * 0.25))
  );
  const nextBid = Math.max(minimumBid, auction.currentBid + increment);

  if (nextBid <= maxBid && nextBid <= player.cash) {
    return { action: ENGINE_ACTIONS.HACER_OFERTA, payload: { jugadorId: player.id, monto: nextBid } };
  }

  return { action: ENGINE_ACTIONS.RETIRARSE_DE_SUBASTA, payload: { jugadorId: player.id } };
}

// Decision ante una deuda pendiente: primero intenta pagar; si no le alcanza,
// liquida activos (hoteles, casas, hipotecas) y, como ultimo recurso, quiebra.
function decideDebt(engine, player) {
  const debt = engine.state.pendingDebt;

  if (player.cash >= debt.amount) {
    return { action: ENGINE_ACTIONS.RESOLVER_DEUDA_PENDIENTE };
  }

  let propertyId = findManageableProperty(engine, player, "venderHotel");
  if (propertyId) {
    return { action: ENGINE_ACTIONS.VENDER_HOTEL, payload: { propertyId } };
  }

  propertyId = findManageableProperty(engine, player, "venderCasa");
  if (propertyId) {
    return { action: ENGINE_ACTIONS.VENDER_CASA, payload: { propertyId } };
  }

  propertyId = findManageableProperty(engine, player, "hipotecarPropiedad");
  if (propertyId) {
    return { action: ENGINE_ACTIONS.HIPOTECAR_PROPIEDAD, payload: { propertyId } };
  }

  // Sin forma de cubrir la deuda: declarar quiebra.
  return { action: ENGINE_ACTIONS.RESOLVER_QUIEBRA };
}

// Antes de terminar el turno, intenta construir si el caracter del bot lo
// permite y le sobra efectivo; si no, termina el turno.
function decideBuildOrEnd(engine, player, profile) {
  if (profile.buildsHotels) {
    const hotelId = findManageableProperty(engine, player, "comprarHotel");
    if (hotelId) {
      const hotel = engine.findSpaceById(hotelId);
      if (player.cash - (hotel.hotelCost || 0) >= profile.buildCashBuffer) {
        return { action: ENGINE_ACTIONS.COMPRAR_HOTEL, payload: { propertyId: hotelId } };
      }
    }
  }

  const houseId = findManageableProperty(engine, player, "comprarCasa");
  if (houseId) {
    const house = engine.findSpaceById(houseId);
    if (player.cash - (house.houseCost || 0) >= profile.buildCashBuffer) {
      return { action: ENGINE_ACTIONS.COMPRAR_CASA, payload: { propertyId: houseId } };
    }
  }

  return { action: ENGINE_ACTIONS.TERMINAR_TURNO };
}

// ----------------------------------------------------------------------------
// Punto de entrada principal: decide la accion para `playerId`.
// Devuelve { action, payload } o null si no hay nada que hacer.
// ----------------------------------------------------------------------------
export function decideAction(engine, playerId, type = BOT_TYPES.BASIC) {
  const profile = getBotProfile(type);
  const actions = new Set(engine.listarAccionesDisponibles({ playerId }));

  if (actions.size === 0) {
    return null;
  }

  const player = engine.findPlayer(playerId);
  const state = engine.state;

  // 1. Arrancar la partida.
  if (actions.has(ENGINE_ACTIONS.INICIAR_PARTIDA)) {
    return { action: ENGINE_ACTIONS.INICIAR_PARTIDA };
  }

  // 2. Subasta activa en la que este bot debe pujar.
  if (actions.has(ENGINE_ACTIONS.HACER_OFERTA)) {
    return decideAuction(engine, player, profile);
  }

  // 3. Decision de compra de la casilla donde cayo.
  if (actions.has(ENGINE_ACTIONS.COMPRAR_PROPIEDAD)) {
    const property = engine.findSpaceById(state.pendingPurchase.propertyId);
    const affordable = player.cash >= property.price;
    const keepsBuffer = player.cash - property.price >= profile.cashBuffer;

    if (affordable && keepsBuffer) {
      return { action: ENGINE_ACTIONS.COMPRAR_PROPIEDAD };
    }
    return { action: ENGINE_ACTIONS.RECHAZAR_COMPRA };
  }

  // 4. Resolver carta de suerte / arca comunal.
  if (actions.has(ENGINE_ACTIONS.RESOLVER_CARTA)) {
    return { action: ENGINE_ACTIONS.RESOLVER_CARTA };
  }

  // 5. Pagar impuesto eligiendo la opcion mas barata.
  if (actions.has(ENGINE_ACTIONS.PAGAR_IMPUESTO)) {
    const tax = state.pendingTax;
    const opcion = tax.percentAmount < tax.fixedAmount ? "PERCENT" : "FIXED";
    return { action: ENGINE_ACTIONS.PAGAR_IMPUESTO, payload: { opcion } };
  }

  // 6. Resolver una deuda pendiente (este bot es el deudor).
  if (state.pendingDebt && state.pendingDebt.debtorId === playerId) {
    return decideDebt(engine, player);
  }

  // 7. Cobrar renta pendiente (modo requireRentClaim).
  if (actions.has(ENGINE_ACTIONS.PAGAR_RENTA)) {
    return { action: ENGINE_ACTIONS.PAGAR_RENTA };
  }

  // 8. Tirar dados (incluye intento de salir de la carcel).
  if (actions.has(ENGINE_ACTIONS.TIRAR_DADOS)) {
    if (player.jail.inJail && actions.has(ENGINE_ACTIONS.USAR_CARTA_SALIR_CARCEL)) {
      return { action: ENGINE_ACTIONS.USAR_CARTA_SALIR_CARCEL };
    }
    return { action: ENGINE_ACTIONS.TIRAR_DADOS };
  }

  // 9. Terminar turno (con posible construccion previa).
  if (actions.has(ENGINE_ACTIONS.TERMINAR_TURNO)) {
    return decideBuildOrEnd(engine, player, profile);
  }

  // 10. Sin accion requerida clara: no hacer nada (la simulacion lo detecta).
  return null;
}

// Helper de conveniencia: crea un "bot" como objeto con su tipo y un metodo
// decide() ligado. Util si en el futuro se quiere mantener estado por bot.
export function createBot(type = BOT_TYPES.BASIC) {
  return {
    type,
    decide(engine, playerId) {
      return decideAction(engine, playerId, type);
    }
  };
}
