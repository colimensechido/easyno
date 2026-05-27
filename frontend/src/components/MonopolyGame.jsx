import {
  AlertTriangle,
  Building2,
  Info,
  Crown,
  Dice5,
  DoorOpen,
  Gavel,
  Hammer,
  Landmark,
  Lightbulb,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  Receipt,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  TimerReset,
  TrainFront,
  Trophy,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { audio } from "../audio";

const actionAudioMap = {
  tirarDados: null, // se reproduce en la cinemática para sincronizar
  comprarPropiedad: "buypropiedad",
  comprarCasa: "comprarcasa",
  comprarHotel: "comprarcasa",
  venderCasa: "vender",
  venderHotel: "vender",
  venderPropiedad: "vender",
  rechazarCompra: "vender",
  hacerOferta: "vender",
  retirarseDeSubasta: "selectmenu",
  hipotecarPropiedad: "vender",
  levantarHipoteca: "buypropiedad",
  comprarCartaSalirCarcel: "vender",
  usarCartaSalirCarcel: "selectmenu",
  pagarMultaCarcel: "selectmenu",
  pagarImpuesto: "selectmenu",
  pagarRenta: "selectmenu",
  resolverCarta: "selectmenu",
  resolverDeudaPendiente: "selectmenu",
  resolverQuiebra: "selectmenu",
  terminarTurno: "selectmenu"
};

const actionLabel = {
  tirarDados: "Tirar dados",
  comprarPropiedad: "Comprar propiedad",
  rechazarCompra: "Mandar a subasta",
  resolverCarta: "Resolver carta",
  pagarRenta: "Cobrar renta",
  pagarImpuesto: "Pagar impuesto",
  comprarCasa: "Comprar casa",
  comprarHotel: "Comprar hotel",
  venderCasa: "Vender casa",
  venderHotel: "Vender hotel",
  hipotecarPropiedad: "Hipotecar",
  levantarHipoteca: "Levantar hipoteca",
  venderPropiedad: "Transferir propiedad",
  comprarCartaSalirCarcel: "Vender carta de carcel",
  usarCartaSalirCarcel: "Usar carta de carcel",
  pagarMultaCarcel: "Pagar multa",
  resolverDeudaPendiente: "Resolver deuda",
  resolverQuiebra: "Declarar quiebra",
  terminarTurno: "Terminar turno",
  hacerOferta: "Ofertar",
  retirarseDeSubasta: "Pasar"
};

const phaseLabel = {
  AWAITING_ROLL: "Lanza los dados",
  AWAITING_PURCHASE_DECISION: "Decide si compras",
  AWAITING_CARD_RESOLUTION: "Resuelve la carta",
  AWAITING_JAIL_DECISION: "Turno de carcel",
  AWAITING_TAX_DECISION: "Resuelve impuesto",
  AWAITING_RENT_CLAIM: "Cobro de renta",
  AWAITING_DEBT_RESOLUTION: "Resuelve deuda",
  AWAITING_TURN_END: "Cierra el turno",
  AWAITING_AUCTION: "Subasta activa",
  COMPLETED: "Partida terminada"
};

const modeLabel = {
  NORMAL: "Clasico",
  SHORT: "Corto",
  TIMED: "Con limite"
};

const colorGroupMeta = {
  brown: { label: "Cafe", color: "#7a4b2a", accent: "#b46d3a" },
  light_blue: { label: "Celeste", color: "#7cd4e8", accent: "#2c9ec7" },
  pink: { label: "Rosa", color: "#d95db4", accent: "#a82a82" },
  orange: { label: "Naranja", color: "#eb8f2d", accent: "#b76000" },
  red: { label: "Rojo", color: "#d4473b", accent: "#a42014" },
  yellow: { label: "Amarillo", color: "#f0d24f", accent: "#b7940b" },
  green: { label: "Verde", color: "#30a44a", accent: "#1a6d2c" },
  dark_blue: { label: "Azul", color: "#274fae", accent: "#163478" }
};

const tokenPalette = [
  { bg: "#d94841", ring: "#7c1510" },
  { bg: "#2f7ef0", ring: "#163b78" },
  { bg: "#20a56d", ring: "#0d5b3d" },
  { bg: "#f0bc3f", ring: "#8a6206" },
  { bg: "#7a58d7", ring: "#47289b" },
  { bg: "#22252f", ring: "#090a0d" }
];

const tokenEmojiPresets = [
  "TOP", "CAR", "DOG", "CAT", "TRN", "SHOE", "SHIP", "DICE",
  "UNI", "DRG", "FOX", "TUR", "LION", "PAN", "FROG", "OWL",
  "KING", "GEM", "STAR", "FIRE", "BOLT", "LUCK", "SUN", "AIM",
  "SPAD", "HART", "DIAM", "CLUB", "GAME", "ROKT", "CAST", "SWRD"
];

const tokenShapes = [
  { id: "circle", label: "Círculo" },
  { id: "rounded", label: "Suave" },
  { id: "square", label: "Cuadro" },
  { id: "diamond", label: "Rombo" },
  { id: "hexagon", label: "Hexágono" },
  { id: "shield", label: "Escudo" },
  { id: "star", label: "Estrella" }
];

const tokenColorPresets = [
  { bg: "#d94841", ring: "#7c1510" },
  { bg: "#2f7ef0", ring: "#163b78" },
  { bg: "#20a56d", ring: "#0d5b3d" },
  { bg: "#f0bc3f", ring: "#8a6206" },
  { bg: "#7a58d7", ring: "#47289b" },
  { bg: "#22252f", ring: "#090a0d" },
  { bg: "#ec4899", ring: "#831843" },
  { bg: "#0ea5e9", ring: "#075985" },
  { bg: "#f97316", ring: "#9a3412" },
  { bg: "#65a30d", ring: "#365314" },
  { bg: "#c026d3", ring: "#701a75" },
  { bg: "#fef3c7", ring: "#b45309" }
];

const TOKEN_STORAGE_KEY = "monopoly-custom-tokens-v1";

function loadCustomTokens() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCustomTokens(value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

function isEmojiToken(value) {
  if (!value) return false;
  // Detect non-latin/non-digit characters (emojis, symbols)
  return /[^\p{L}\p{N}\s]/u.test(value) && value.length <= 4;
}

function resolveTokenStyle(player, customTokens) {
  const palette = playerAccent(player.colorIndex ?? 0);
  const custom = customTokens?.[player.id];
  const label = custom?.label ?? initialLetters(player.name);
  const bg = custom?.bg ?? palette.bg;
  const ring = custom?.ring ?? palette.ring;
  const shape = custom?.shape ?? "circle";
  const emoji = isEmojiToken(label);
  return { label, bg, ring, shape, emoji };
}

const previewBoard = [
  { index: 0, id: "go", name: "Salida", type: "SALIDA" },
  { index: 1, id: "mediterranean", name: "Mediterranea", type: "PROPIEDAD", colorGroup: "brown", price: 60 },
  { index: 2, id: "cc1", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 3, id: "baltic", name: "Baltica", type: "PROPIEDAD", colorGroup: "brown", price: 60 },
  { index: 4, id: "tax1", name: "Impuesto", type: "IMPUESTO" },
  { index: 5, id: "rr1", name: "Reading", type: "FERROCARRIL", price: 200 },
  { index: 6, id: "oriental", name: "Oriental", type: "PROPIEDAD", colorGroup: "light_blue", price: 100 },
  { index: 7, id: "chance1", name: "Casualidad", type: "CASUALIDAD" },
  { index: 8, id: "vermont", name: "Vermont", type: "PROPIEDAD", colorGroup: "light_blue", price: 100 },
  { index: 9, id: "connecticut", name: "Connecticut", type: "PROPIEDAD", colorGroup: "light_blue", price: 120 },
  { index: 10, id: "jail", name: "Carcel", type: "CARCEL_VISITA" },
  { index: 11, id: "stcharles", name: "St. Charles", type: "PROPIEDAD", colorGroup: "pink", price: 140 },
  { index: 12, id: "electric", name: "Electrica", type: "SERVICIO_PUBLICO", price: 150 },
  { index: 13, id: "states", name: "States", type: "PROPIEDAD", colorGroup: "pink", price: 140 },
  { index: 14, id: "virginia", name: "Virginia", type: "PROPIEDAD", colorGroup: "pink", price: 160 },
  { index: 15, id: "rr2", name: "Pennsylvania RR", type: "FERROCARRIL", price: 200 },
  { index: 16, id: "stjames", name: "St. James", type: "PROPIEDAD", colorGroup: "orange", price: 180 },
  { index: 17, id: "cc2", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 18, id: "tennessee", name: "Tennessee", type: "PROPIEDAD", colorGroup: "orange", price: 180 },
  { index: 19, id: "newyork", name: "Nueva York", type: "PROPIEDAD", colorGroup: "orange", price: 200 },
  { index: 20, id: "free", name: "Libre", type: "PARADA_LIBRE" },
  { index: 21, id: "kentucky", name: "Kentucky", type: "PROPIEDAD", colorGroup: "red", price: 220 },
  { index: 22, id: "chance2", name: "Casualidad", type: "CASUALIDAD" },
  { index: 23, id: "indiana", name: "Indiana", type: "PROPIEDAD", colorGroup: "red", price: 220 },
  { index: 24, id: "illinois", name: "Illinois", type: "PROPIEDAD", colorGroup: "red", price: 240 },
  { index: 25, id: "rr3", name: "B&O", type: "FERROCARRIL", price: 200 },
  { index: 26, id: "atlantic", name: "Atlantic", type: "PROPIEDAD", colorGroup: "yellow", price: 260 },
  { index: 27, id: "ventnor", name: "Ventnor", type: "PROPIEDAD", colorGroup: "yellow", price: 260 },
  { index: 28, id: "water", name: "Agua", type: "SERVICIO_PUBLICO", price: 150 },
  { index: 29, id: "marvin", name: "Marvin", type: "PROPIEDAD", colorGroup: "yellow", price: 280 },
  { index: 30, id: "gotojail", name: "Ve a carcel", type: "VAYASE_A_LA_CARCEL" },
  { index: 31, id: "pacific", name: "Pacific", type: "PROPIEDAD", colorGroup: "green", price: 300 },
  { index: 32, id: "northcarolina", name: "N. Carolina", type: "PROPIEDAD", colorGroup: "green", price: 300 },
  { index: 33, id: "cc3", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 34, id: "pennsylvania", name: "Pennsylvania", type: "PROPIEDAD", colorGroup: "green", price: 320 },
  { index: 35, id: "rr4", name: "Short Line", type: "FERROCARRIL", price: 200 },
  { index: 36, id: "chance3", name: "Casualidad", type: "CASUALIDAD" },
  { index: 37, id: "park", name: "Park Place", type: "PROPIEDAD", colorGroup: "dark_blue", price: 350 },
  { index: 38, id: "tax2", name: "Lujo", type: "IMPUESTO" },
  { index: 39, id: "boardwalk", name: "Boardwalk", type: "PROPIEDAD", colorGroup: "dark_blue", price: 400 }
];

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

const ruleCards = [
  {
    title: "Turnos con reloj",
    body: "Cada mesa define su propio tiempo por turno al crearse. Si alguien se queda quieto, el servidor resuelve la accion minima para que la partida siga."
  },
  {
    title: "Casas y hoteles",
    body: "Solo construyes si posees todo el grupo de color, sin hipotecas en ese grupo y manteniendo la construccion pareja entre calles."
  },
  {
    title: "Hipotecas y renta",
    body: "Una propiedad hipotecada no cobra renta. Para levantarla pagas el valor de hipoteca mas 10%."
  },
  {
    title: "Salida y carcel",
    body: "Pasar o caer en Salida paga $200. Ir directo a la carcel no paga Salida. Tres dobles seguidos tambien te mandan a la carcel."
  }
];

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function Money({ amount, className = "" }) {
  return <span className={className}>{moneyFormatter.format(amount || 0)}</span>;
}

function InfoTip({ label, className = "" }) {
  return (
    <span
      className={cx("inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#cbb18b] bg-[#fff7e7] text-[#8a5a00]", className)}
      title={label}
      aria-label={label}
    >
      <Info size={14} />
    </span>
  );
}

function initialLetters(value) {
  return (value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
}

function playerAccent(index) {
  return tokenPalette[index % tokenPalette.length];
}

function spaceIcon(space) {
  switch (space.type) {
    case "FERROCARRIL":
      return TrainFront;
    case "SERVICIO_PUBLICO":
      return Lightbulb;
    case "IMPUESTO":
      return Landmark;
    case "CASUALIDAD":
    case "ARCA_COMUNAL":
      return Receipt;
    case "VAYASE_A_LA_CARCEL":
      return ShieldAlert;
    default:
      return MapIcon;
  }
}

function boardCell(index) {
  if (index === 0) return { row: 10, col: 10, side: "bottom", corner: true };
  if (index > 0 && index < 10) return { row: 10, col: 10 - index, side: "bottom", corner: false };
  if (index === 10) return { row: 10, col: 0, side: "left", corner: true };
  if (index > 10 && index < 20) return { row: 20 - index, col: 0, side: "left", corner: false };
  if (index === 20) return { row: 0, col: 0, side: "top", corner: true };
  if (index > 20 && index < 30) return { row: 0, col: index - 20, side: "top", corner: false };
  if (index === 30) return { row: 0, col: 10, side: "right", corner: true };
  return { row: index - 30, col: 10, side: "right", corner: false };
}

function spaceTypeLabel(space) {
  if (space.colorGroup) return colorGroupMeta[space.colorGroup]?.label || "Solar";
  switch (space.type) {
    case "SALIDA":
      return "Salida";
    case "FERROCARRIL":
      return "Ferrocarril";
    case "SERVICIO_PUBLICO":
      return "Servicio";
    case "IMPUESTO":
      return "Impuesto";
    case "CASUALIDAD":
      return "Casualidad";
    case "ARCA_COMUNAL":
      return "Arca comunal";
    case "CARCEL_VISITA":
      return "Carcel";
    case "VAYASE_A_LA_CARCEL":
      return "Directo";
    case "PARADA_LIBRE":
      return "Libre";
    default:
      return space.type;
  }
}

function currentPrompt({ state, playersById, currentUserId, pendingPurchaseSpace, pendingTax, pendingDebt, pendingCard, auction }) {
  const currentPlayer = playersById.get(state.currentPlayerId);
  const me = state.currentPlayerId === currentUserId;

  if (state.winnerId) {
    return {
      tone: "success",
      eyebrow: "Final de partida",
      title: `${playersById.get(state.winnerId)?.name || "Jugador"} domina el tablero`,
      body: "La partida termino. Puedes revisar propiedades y reiniciar cuando quieran."
    };
  }

  if (auction) {
    return {
      tone: "danger",
      eyebrow: "Subasta en vivo",
      title: `${playersById.get(auction.activeBidderId)?.name || "Jugador"} decide la siguiente puja`,
      body: `Puja actual ${moneyFormatter.format(auction.currentBid || 0)} por ${auction.assetId}.`
    };
  }

  if (pendingPurchaseSpace) {
    return {
      tone: "info",
      eyebrow: "Compra pendiente",
      title: `${pendingPurchaseSpace.name} esta libre`,
      body: `${me ? "Te toca" : `Le toca a ${currentPlayer?.name || "otro jugador"}`} decidir si la compra o la manda a subasta.`
    };
  }

  if (pendingTax) {
    return {
      tone: "warn",
      eyebrow: "Impuesto",
      title: `${currentPlayer?.name || "Jugador"} debe resolver un impuesto`,
      body: `Puede pagar ${moneyFormatter.format(pendingTax.fixedAmount)} fijo o ${moneyFormatter.format(pendingTax.percentAmount)} por patrimonio.`
    };
  }

  if (pendingCard?.card) {
    return {
      tone: "info",
      eyebrow: pendingCard.deck === "CASUALIDAD" ? "Casualidad" : "Arca comunal",
      title: pendingCard.card.title || pendingCard.card.text || "Carta pendiente",
      body: pendingCard.card.text || "La carta debe resolverse antes de continuar."
    };
  }

  if (pendingDebt) {
    return {
      tone: "danger",
      eyebrow: "Deuda abierta",
      title: `${playersById.get(pendingDebt.debtorId)?.name || "Jugador"} debe ${moneyFormatter.format(pendingDebt.amount)}`,
      body: "Vende, hipoteca o transfiere activos antes de poder cerrar el turno."
    };
  }

  if (currentPlayer?.inJail) {
    return {
      tone: "warn",
      eyebrow: "Turno de carcel",
      title: `${currentPlayer.name} esta encerrado`,
      body: me
        ? "Puedes pagar la multa, usar una carta o probar suerte con dobles."
        : "La mesa espera a que resuelva su salida de la carcel."
    };
  }

  return {
    tone: me ? "success" : "info",
    eyebrow: me ? "Tu movimiento" : "Turno actual",
    title: me ? "Todo listo para tu siguiente decision" : `${currentPlayer?.name || "Jugador"} controla el turno`,
    body: phaseLabel[state.turn.phase] || "La partida sigue en curso."
  };
}

function quickAction({ myActions, pendingCard, pendingDebt, pendingPurchaseSpace, auction, pendingTax }) {
  if (pendingPurchaseSpace && myActions.includes("comprarPropiedad")) {
    return { action: "comprarPropiedad", label: "Comprar casilla" };
  }

  if (pendingCard && myActions.includes("resolverCarta")) {
    return { action: "resolverCarta", label: "Resolver carta" };
  }

  if (pendingDebt && myActions.includes("resolverDeudaPendiente")) {
    return { action: "resolverDeudaPendiente", label: "Resolver deuda" };
  }

  if (auction && myActions.includes("hacerOferta")) {
    return null;
  }

  if (pendingTax && myActions.includes("pagarImpuesto")) {
    return null;
  }

  if (myActions.includes("tirarDados")) {
    return { action: "tirarDados", label: "Tirar dados" };
  }

  if (myActions.includes("terminarTurno")) {
    return { action: "terminarTurno", label: "Terminar turno" };
  }

  return null;
}

const reasonLabel = {
  PASO_POR_SALIDA: "paso por salida",
  RENTA: "renta",
  IMPUESTO: "impuesto",
  TERCER_INTENTO_CARCEL: "multa de carcel",
  SUBASTA: "subasta",
  PAGO_RENTA: "pago de renta",
  INTERES_HIPOTECA_TRANSFERIDA: "interes por transferencia hipotecada",
  INTERESES_HIPOTECAS_QUIEBRA: "intereses de hipotecas por quiebra",
  RECIBIR_DINERO: "cobro de carta",
  PAGAR_DINERO: "pago de carta",
  PAGAR_A_CADA_JUGADOR: "pago a la mesa",
  RECIBIR_DE_CADA_JUGADOR: "cobro a la mesa",
  REPARACIONES: "reparaciones"
};

function eventTone(type) {
  if (type.includes("BANKRUPTCY") || type.includes("JAIL") || type.includes("DEBT")) return "danger";
  if (type.includes("PURCHASED") || type.includes("RECEIVED") || type.includes("EXTRA_TURN") || type === "GAME_STARTED") return "success";
  if (type.includes("AUCTION") || type.includes("PAID") || type.includes("MORTGAGE")) return "warn";
  return "info";
}

function describeEvent(event, playersById, boardById) {
  const payload = event?.payload || {};
  const playerName = (id) => playersById.get(id)?.name || "Jugador";
  const propertyName = (id) => boardById.get(id)?.name || "propiedad";

  switch (event?.type) {
    case "GAME_STARTED":
      return { title: "Partida iniciada", body: `Arranco una partida ${modeLabel[payload.mode] || payload.mode || "normal"}.` };
    case "PROPERTY_PURCHASED":
      return { title: `${playerName(payload.playerId)} compro ${propertyName(payload.propertyId)}`, body: `Pago ${moneyFormatter.format(payload.price || 0)} al banco.` };
    case "PLAYER_RECEIVED_MONEY":
      return { title: `${playerName(payload.playerId)} recibe dinero`, body: `${moneyFormatter.format(payload.amount || 0)} por ${reasonLabel[payload.reason] || "evento del tablero"}.` };
    case "PLAYER_PAID":
      return { title: `${playerName(payload.playerId)} pago ${moneyFormatter.format(payload.amount || 0)}`, body: `Motivo: ${reasonLabel[payload.reason] || payload.reason || "movimiento"}.` };
    case "PLAYER_SENT_TO_JAIL":
      return { title: `${playerName(payload.playerId)} va a la carcel`, body: "Pierde libertad hasta resolver su salida." };
    case "PLAYER_LEFT_JAIL_WITH_DOUBLES":
      return { title: `${playerName(payload.playerId)} salio con dobles`, body: `Avanza ${payload.total} casillas sin turno extra.` };
    case "PLAYER_LEFT_JAIL_AFTER_THIRD_FAIL":
      return { title: `${playerName(payload.playerId)} paga para salir`, body: `Tras el tercer intento avanza ${payload.total} casillas.` };
    case "CARD_DRAWN":
      return { title: `${playerName(payload.playerId)} toma una carta`, body: payload.deck === "CASUALIDAD" ? "Casualidad entra en juego." : "Arca comunal entra en juego." };
    case "CARD_RESOLVED":
      return { title: `${playerName(payload.playerId)} resolvio su carta`, body: "El efecto ya fue aplicado al tablero." };
    case "AUCTION_STARTED":
      return { title: `Subasta por ${propertyName(payload.assetId)}`, body: "La mesa decide quien se queda la propiedad." };
    case "AUCTION_BID":
      return { title: `${playerName(payload.playerId)} sube la puja`, body: `Oferta actual: ${moneyFormatter.format(payload.amount || 0)}.` };
    case "AUCTION_FINISHED":
      return { title: payload.winnerId ? `${playerName(payload.winnerId)} gana la subasta` : "Subasta finalizada", body: payload.amount ? `Precio final ${moneyFormatter.format(payload.amount)}.` : "Nadie compro la propiedad." };
    case "HOUSE_PURCHASED":
      return { title: `${playerName(payload.playerId)} construyo una casa`, body: `Sobre ${propertyName(payload.propertyId)}.` };
    case "HOTEL_PURCHASED":
      return { title: `${playerName(payload.playerId)} construyo un hotel`, body: `En ${propertyName(payload.propertyId)}.` };
    case "PROPERTY_MORTGAGED":
      return { title: `${playerName(payload.playerId)} hipoteco ${propertyName(payload.propertyId)}`, body: "La renta queda desactivada hasta levantarla." };
    case "MORTGAGE_LIFTED":
      return { title: `${playerName(payload.playerId)} levanto una hipoteca`, body: `${propertyName(payload.propertyId)} vuelve a producir renta.` };
    case "PROPERTY_TRADED":
      return { title: `${playerName(payload.sellerId)} transfiere ${propertyName(payload.propertyId)}`, body: `${playerName(payload.buyerId)} paga ${moneyFormatter.format(payload.price || 0)}.` };
    case "JAIL_CARD_TRADED":
      return { title: `${playerName(payload.sellerId)} vende carta de carcel`, body: `${playerName(payload.buyerId)} paga ${moneyFormatter.format(payload.price || 0)}.` };
    case "JAIL_CARD_USED":
      return { title: `${playerName(payload.playerId)} usa carta de carcel`, body: "Se libera sin pagar multa." };
    case "JAIL_FINE_PAID":
      return { title: `${playerName(payload.playerId)} paga multa`, body: `${moneyFormatter.format(payload.amount || 0)} para salir de la carcel.` };
    case "PLAYER_FORFEITED":
      return { title: `${playerName(payload.playerId)} se rinde`, body: "El banco liquida sus activos y la mesa continua." };
    case "DEBT_CREATED":
      return { title: `${playerName(payload.debtorId)} entra en deuda`, body: `Debe reunir ${moneyFormatter.format(payload.amount || 0)} antes de continuar.` };
    case "DEBT_PAID":
      return { title: `${playerName(payload.debtorId)} salda su deuda`, body: `${moneyFormatter.format(payload.amount || 0)} pagados.` };
    case "EXTRA_TURN_GRANTED":
      return { title: `${playerName(payload.playerId)} saco dobles`, body: "Gana un turno extra." };
    case "TURN_ADVANCED":
      return { title: `Turno de ${playerName(payload.currentPlayerId)}`, body: "La mesa espera su siguiente accion." };
    case "GAME_FINISHED":
      return { title: `${playerName(payload.winnerId)} gana la partida`, body: "No quedan rivales solventes en el tablero." };
    default:
      return { title: event?.type || "Evento", body: "El tablero acaba de actualizarse." };
  }
}

function formatCountdown(deadlineAt) {
  if (!deadlineAt) {
    return "--";
  }

  const remainingMs = Math.max(0, deadlineAt - Date.now());
  const totalSeconds = Math.ceil(remainingMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function buildModalState({ state, currentUserId, playersById, boardById }) {
  const currentPlayerName = playersById.get(state.currentPlayerId)?.name || "Jugador";
  const myTurn = state.currentPlayerId === currentUserId;

  if (state.turn.pendingPurchase) {
    const property = boardById.get(state.turn.pendingPurchase.propertyId);
    return {
      type: "purchase",
      tone: "success",
      blocking: false,
      title: `${property?.name || "Propiedad"} esta disponible`,
      body: myTurn
        ? "Puedes comprarla ahora mismo o mandarla a subasta para toda la mesa."
        : `${currentPlayerName} esta decidiendo si la compra o la subasta.`,
      property
    };
  }

  if (state.turn.pendingTax) {
    return {
      type: "tax",
      tone: "warn",
      blocking: false,
      title: `Impuesto para ${currentPlayerName}`,
      body: myTurn
        ? "Elige como quieres pagar este impuesto."
        : `${currentPlayerName} debe elegir como pagarlo antes de seguir.`,
      tax: state.turn.pendingTax
    };
  }

  if (state.turn.pendingCard?.card) {
    return {
      type: "card",
      tone: "info",
      blocking: false,
      title: state.turn.pendingCard.card.title || "Carta de tablero",
      body: state.turn.pendingCard.card.text || "Debes resolver esta carta para continuar.",
      card: state.turn.pendingCard.card,
      deck: state.turn.pendingCard.deck
    };
  }

  if (state.turn.pendingDebt) {
    return {
      type: "debt",
      tone: "danger",
      blocking: false,
      title: `Deuda pendiente de ${playersById.get(state.turn.pendingDebt.debtorId)?.name || "jugador"}`,
      body: "Antes de terminar el turno debe vender, hipotecar o declarar quiebra.",
      debt: state.turn.pendingDebt
    };
  }

  if (state.turn.auction) {
    return {
      type: "auction",
      tone: "warn",
      blocking: false,
      title: `Subasta de ${boardById.get(state.turn.auction.assetId)?.name || "propiedad"}`,
      body: `${playersById.get(state.turn.auction.activeBidderId)?.name || "Jugador"} tiene la palabra.`,
      auction: state.turn.auction
    };
  }

  const currentPlayer = playersById.get(state.currentPlayerId);
  if (currentPlayer?.inJail && myTurn) {
    return {
      type: "jail",
      tone: "danger",
      blocking: false,
      title: "Estas en la carcel",
      body: "Paga, usa carta o prueba suerte con dobles para seguir jugando."
    };
  }

  return null;
}

function tokenTransformForIndex(index, count) {
  const layouts = {
    1: [{ x: 0, y: 0 }],
    2: [{ x: -11, y: 0 }, { x: 11, y: 0 }],
    3: [{ x: -12, y: -10 }, { x: 12, y: -10 }, { x: 0, y: 12 }],
    4: [{ x: -12, y: -12 }, { x: 12, y: -12 }, { x: -12, y: 12 }, { x: 12, y: 12 }]
  };
  const safeCount = Math.min(Math.max(count, 1), 4);
  return layouts[safeCount][index] || { x: 0, y: 0 };
}

function advanceIndex(start, steps, size) {
  return ((start + steps) % size + size) % size;
}

function buildMovementPath(from, total, boardSize) {
  return Array.from({ length: total }, (_, index) => advanceIndex(from, index + 1, boardSize));
}

function ActionButton({ tone = "primary", children, className = "", tooltip = "", ...props }) {
  return (
    <button
      className={cx(
        tone === "primary" && "monopoly-primary-button",
        tone === "secondary" && "monopoly-secondary-button",
        tone === "danger" && "monopoly-danger-button",
        className
      )}
      title={tooltip}
      {...props}
    >
      {children}
    </button>
  );
}

function TokenChip({ tokenStyle, className = "", style = {}, title }) {
  return (
    <span
      className={cx(
        "monopoly-token",
        `shape-${tokenStyle.shape}`,
        tokenStyle.emoji && "emoji",
        className
      )}
      style={{ "--token-bg": tokenStyle.bg, "--token-ring": tokenStyle.ring, ...style }}
      title={title}
    >
      <span className="token-glyph">{tokenStyle.label}</span>
    </span>
  );
}

function PlayerStandee({ player, index, isCurrent, isMe, tokenStyle }) {
  return (
    <article
      className={cx(
        "rounded-[20px] border-2 p-3 transition",
        isCurrent ? "border-[#0f766e] bg-[#eff8f2] shadow-[0_10px_28px_rgba(15,118,110,0.16)]" : "border-[#d3c2a4] bg-[#fbf5e8]",
        player.bankrupt && "opacity-60 grayscale"
      )}
    >
      <div className="flex items-start gap-3">
        <TokenChip
          tokenStyle={tokenStyle}
          className="h-11 w-11 text-sm"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-black uppercase text-[#23160c]">
              {player.name}{isMe ? " - tu" : ""}
            </h3>
            {isCurrent && <span className="monopoly-chip bg-[#0f766e] text-white">Turno</span>}
            {player.inJail && <span className="monopoly-chip bg-[#f59e0b] text-[#23160c]">Carcel {player.jailAttempts}/3</span>}
            {player.bankrupt && <span className="monopoly-chip bg-[#b91c1c] text-white">Quiebra</span>}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#7c5d38]">
            <div className="rounded-2xl border border-[#ddcfb7] bg-white/70 px-2 py-2">
              <p>Efectivo</p>
              <Money amount={player.cash} className="mt-1 block text-sm font-black normal-case tracking-normal text-[#14532d]" />
            </div>
            <div className="rounded-2xl border border-[#ddcfb7] bg-white/70 px-2 py-2">
              <p>Riqueza</p>
              <Money amount={player.wealth} className="mt-1 block text-sm font-black normal-case tracking-normal text-[#8a5a00]" />
            </div>
            <div className="rounded-2xl border border-[#ddcfb7] bg-white/70 px-2 py-2">
              <p>Props</p>
              <span className="mt-1 block text-sm font-black normal-case tracking-normal text-[#23160c]">{player.properties.length}</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function BoardSpace({ space, owner, players, selected, current, onSelect, showTokens = true, cameraTarget = false, tokenStyles = {} }) {
  const cell = boardCell(space.index);
  const Icon = spaceIcon(space);
  const group = colorGroupMeta[space.colorGroup];
  const ownerAccent = owner?.colorIndex !== undefined ? playerAccent(owner.colorIndex) : null;
  const style = {
    gridRowStart: cell.row + 1,
    gridColumnStart: cell.col + 1
  };
  const buildings = Array.from({ length: Math.min(space.houses || 0, 4) });
  const tooltip = [
    space.name,
    spaceTypeLabel(space),
    space.price ? `Precio ${moneyFormatter.format(space.price)}` : null,
    owner ? `Dueno: ${owner.name}` : "Sin dueno",
    space.isMortgaged ? "Hipotecada: no cobra renta" : null,
    players.length ? `Fichas aqui: ${players.map((player) => player.name).join(", ")}` : null
  ].filter(Boolean).join(" - ");

  return (
    <button
      type="button"
      style={style}
      onClick={() => onSelect(space.id)}
      title={tooltip}
      className={cx(
        "monopoly-space",
        `side-${cell.side}`,
        owner && "owned",
        cell.corner && "corner",
        selected && "selected",
        current && "current",
        cameraTarget && "cam-target"
      )}
      data-owner={owner ? "yes" : "no"}
      data-side={cell.side}
    >
      {group && <span className="monopoly-band" style={{ "--group-color": group.color }} />}
      {ownerAccent && <span className="monopoly-owner-mark" style={{ "--owner-color": ownerAccent.bg }} />}
      <div className="monopoly-space-inner">
        <div className="flex items-start justify-between gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7c5d38]">
            {space.index}
          </span>
          <Icon size={cell.corner ? 16 : 12} className="shrink-0 text-[#3b2b18]" />
        </div>

        <div className="flex-1">
          <p className="monopoly-space-name">{space.name}</p>
          <p className="monopoly-space-meta">
            {space.ownerId ? owner?.name || "Propietario" : spaceTypeLabel(space)}
          </p>
        </div>

        {(space.price || space.houses || space.hasHotel || space.isMortgaged) && (
          <div className="space-footer">
            {space.price ? <span className="monopoly-space-price">{moneyFormatter.format(space.price)}</span> : <span className="monopoly-space-price">{spaceTypeLabel(space)}</span>}
            {(space.houses > 0 || space.hasHotel) && (
              <span className="monopoly-buildings">
                {buildings.map((_, index) => (
                  <span key={`${space.id}-house-${index}`} className="monopoly-house-dot" />
                ))}
                {space.hasHotel ? <span className="monopoly-hotel-dot" /> : null}
              </span>
            )}
            {space.isMortgaged ? <span className="monopoly-mortgage-stamp">Hip.</span> : null}
            {owner && <span className="space-owner-badge">{initialLetters(owner.name)}</span>}
          </div>
        )}

        {showTokens && players.length > 0 && (
          <div className="monopoly-token-stack">
            {players.slice(0, 4).map((player) => {
              const tokenStyle = tokenStyles[player.id] || resolveTokenStyle(player, {});
              return (
                <TokenChip
                  key={`${space.id}-${player.id}`}
                  tokenStyle={tokenStyle}
                  title={player.name}
                />
              );
            })}
            {players.length > 4 && <span className="monopoly-token monopoly-token-count">+{players.length - 4}</span>}
          </div>
        )}
      </div>
    </button>
  );
}

const propertyActionOrder = [
  ["hipotecarPropiedad", "Hipotecar"],
  ["levantarHipoteca", "Levantar"],
  ["comprarCasa", "Comprar casa"],
  ["comprarHotel", "Comprar hotel"],
  ["venderCasa", "Vender casa"],
  ["venderHotel", "Vender hotel"]
];

function SelectedSpaceCard({ space, owner, visitors, ownerProperty, onManage, managementOptions, isOwnedByMe }) {
  const group = colorGroupMeta[space?.colorGroup];
  const buildings = ownerProperty || space;

  if (!space) return null;

  return (
    <section className="deed-card">
      <div
        className="deed-header"
        style={{ background: group ? `linear-gradient(135deg, ${group.color}, ${group.accent})` : "linear-gradient(135deg, #e2d4b5, #bca37d)" }}
      >
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/80">
            {spaceTypeLabel(space)}
          </p>
          <h3 className="mt-1 text-xl font-black uppercase text-white">{space.name}</h3>
        </div>
        <div className="rounded-2xl border border-white/30 bg-white/12 px-3 py-2 text-right text-white">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.16em]">Dueno</p>
          <p className="mt-1 text-sm font-black">{owner?.name || "Banco"}</p>
        </div>
      </div>

      <div className="deed-grid">
        <div className="deed-stat">
          <span>Precio</span>
          {space.price ? <Money amount={space.price} className="deed-value" /> : <span className="deed-value">--</span>}
        </div>
        <div className="deed-stat">
          <span>Hipoteca</span>
          {space.mortgageValue ? <Money amount={space.mortgageValue} className="deed-value" /> : <span className="deed-value">--</span>}
        </div>
        <div className="deed-stat">
          <span>Casas</span>
          <span className="deed-value">{buildings.houses || 0}</span>
        </div>
        <div className="deed-stat">
          <span>Hotel</span>
          <span className="deed-value">{buildings.hasHotel ? "Si" : "No"}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {space.isMortgaged && <span className="monopoly-chip bg-[#4b5563] text-white">Hipotecada</span>}
        {group && <span className="monopoly-chip text-white" style={{ backgroundColor: group.accent }}>{group.label}</span>}
        {visitors.length > 0 && (
          <span className="monopoly-chip bg-[#0f766e] text-white">
            {visitors.length} en casilla
          </span>
        )}
      </div>

      <div className="mt-4 rounded-[20px] border border-[#ddcfb7] bg-[#fff8ec] p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Jugadores presentes</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {visitors.length === 0 ? (
            <span className="text-sm font-semibold text-[#7c5d38]">Sin fichas encima ahora mismo.</span>
          ) : (
            visitors.map((player) => (
              <span key={player.id} className="monopoly-chip bg-[#ece3cf] text-[#23160c]">
                {player.name}
              </span>
            ))
          )}
        </div>
      </div>

      {isOwnedByMe && managementOptions && (
        <div className="mt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Gestion de propiedad</p>
            <span className="text-[11px] font-bold text-[#9a7b55]">El motor valida estas acciones en tiempo real</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {propertyActionOrder.map(([actionName, label]) => {
              const option = managementOptions[actionName];
              return (
                <div key={actionName} className="rounded-[18px] border border-[#ddcfb7] bg-[#fff8ec] p-3">
                  <ActionButton
                    tone="secondary"
                    className="w-full"
                    disabled={!option?.allowed}
                    title={option?.reason || label}
                    onClick={() => onManage(actionName, space.id)}
                  >
                    {label}
                  </ActionButton>
                  <p className="mt-2 min-h-[32px] text-xs font-semibold leading-5 text-[#7c5d38]">
                    {option?.allowed ? "Disponible ahora." : option?.reason || "No disponible en este momento."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function MonopolySocialRail({ connectionStatus, currentUser, messages, players, onSendMessage, customTokens = {} }) {
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState("");
  const chatRef = useRef(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.balance - a.balance || a.username.localeCompare(b.username)),
    [players]
  );

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length]);

  function submit(event) {
    event.preventDefault();
    const nextText = text.trim();
    if (!nextText) return;

    onSendMessage(nextText, (response) => {
      if (!response?.ok) {
        setChatError(response?.error || "No se pudo enviar");
        return;
      }

      setText("");
      setChatError("");
    });
  }

  return (
    <aside className="grid gap-5 xl:sticky xl:top-24 xl:self-start">
      <section className="monopoly-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Sala</p>
            <h3 className="text-2xl font-black uppercase text-[#23160c]">Jugadores</h3>
          </div>
          <span className={cx(
            "monopoly-chip",
            connectionStatus === "online" ? "bg-[#0f766e] text-white" : "bg-[#6b7280] text-white"
          )}>
            {connectionStatus === "online" ? "En vivo" : "Offline"}
          </span>
        </div>

        <div className="grid gap-3">
          {sortedPlayers.map((player, index) => {
            const tokenStyle = resolveTokenStyle({ id: player.userId, name: player.username, colorIndex: index }, customTokens);
            return (
              <div key={player.userId} className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4">
                <div className="flex items-center gap-3">
                  <TokenChip tokenStyle={tokenStyle} className="h-11 w-11 text-sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-black uppercase text-[#23160c]">
                        {player.username}{player.userId === currentUser.id ? " - tu" : ""}
                      </p>
                      {index === 0 && <Crown size={14} className="text-[#c08a1a]" />}
                    </div>
                    <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#7c5d38]">
                      {player.balance <= 0 ? "Quebrado" : player.balance >= 10000 ? "Magnate" : "Activo"}
                    </p>
                  </div>
                  <Money amount={player.balance} className="text-sm font-black text-[#14532d]" />
                </div>
              </div>
            );
          })}

          {sortedPlayers.length === 0 && (
            <div className="rounded-[20px] border-2 border-dashed border-[#d3c2a4] bg-[#fff8ec] px-4 py-5 text-sm font-semibold text-[#7c5d38]">
              Nadie conectado en este mundo todavia.
            </div>
          )}
        </div>
      </section>

      <section className="monopoly-panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <MessageCircle size={20} className="text-[#b02016]" />
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Comunidad</p>
            <h3 className="text-2xl font-black uppercase text-[#23160c]">Chat de mesa</h3>
          </div>
        </div>

        <div ref={chatRef} className="monopoly-chat-shell">
          {messages.length === 0 ? (
            <div className="self-center px-6 text-center text-sm font-semibold text-[#7c5d38]">
              Aun no hay mensajes.
              <div className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#b48a5a]">
                Saluda a la mesa
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isMe = message.userId === currentUser.id;
              return (
                <div key={message.id} className={cx("flex gap-2", isMe && "justify-end")}>
                  <div className={cx("monopoly-chat-bubble", isMe ? "mine" : "theirs")}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="text-[10px] font-extrabold uppercase tracking-[0.16em]">
                        {message.username}
                      </span>
                      <span className="text-[10px] font-bold opacity-65">
                        {new Date(message.createdAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit"
                        })}
                      </span>
                    </div>
                    <p className="break-words text-sm font-semibold leading-5">{message.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form className="mt-3 flex gap-2" onSubmit={submit}>
          <input
            className="monopoly-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Habla con la mesa..."
            maxLength={240}
          />
          <ActionButton className="px-4">
            <Send size={18} />
          </ActionButton>
        </form>

        {chatError && (
          <div className="mt-3 rounded-[16px] border border-[#d8a5a0] bg-[#fff1ef] px-3 py-2 text-sm font-bold text-[#7f1d1d]">
            {chatError}
          </div>
        )}
      </section>
    </aside>
  );
}

function DiceStage({ rolling, dice, playerName, total, cinematicActive }) {
  return (
    <section className={cx("dice-stage", rolling && "rolling", cinematicActive && "cinematic-active")}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Lanzamiento</p>
          <h3 className="truncate text-base font-black uppercase text-[#23160c]">{playerName || "Esperando dados"}</h3>
        </div>
        <span className="monopoly-chip bg-[#ece3cf] text-[#23160c]">
          Total {total || 0}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-center gap-3">
        {dice.map((value, index) => (
          <div key={`die-${index}`} className={cx("die-face", rolling && "rolling")}>
            <span>{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs font-semibold text-[#7c5d38]">
        {rolling ? "Los dados están rodando⬦" : "Resultado visible para toda la mesa."}
      </p>
    </section>
  );
}

function TokenOverlay({ players, currentPlayerId, tokenStyles = {} }) {
  return (
    <div className="monopoly-token-overlay">
      {players.map((player) => {
        const cell = boardCell(player.position);
        const baseX = ((cell.col + 0.5) / 11) * 100;
        const baseY = ((cell.row + 0.5) / 11) * 100;
        const sharedCellPlayers = players.filter((candidate) => candidate.position === player.position && !candidate.bankrupt);
        const localIndex = sharedCellPlayers.findIndex((candidate) => candidate.id === player.id);
        const shift = tokenTransformForIndex(localIndex, sharedCellPlayers.length);
        const tokenStyle = tokenStyles[player.id] || resolveTokenStyle(player, {});

        return (
          <div
            key={player.id}
            className={cx("token-piece", player.id === currentPlayerId && "active", player.bankrupt && "bankrupt")}
            style={{
              left: `${baseX}%`,
              top: `${baseY}%`,
              transform: `translate(calc(-50% + ${shift.x}px), calc(-50% + ${shift.y}px))`
            }}
          >
            <TokenChip tokenStyle={tokenStyle} className="monopoly-token-large" title={player.name} />
          </div>
        );
      })}
    </div>
  );
}

function modalNeedsAction(modalState, myActions) {
  if (!modalState) return false;

  switch (modalState.type) {
    case "purchase":
      return myActions.includes("comprarPropiedad") || myActions.includes("rechazarCompra");
    case "tax":
      return myActions.includes("pagarImpuesto");
    case "card":
      return myActions.includes("resolverCarta");
    case "debt":
      return myActions.includes("resolverDeudaPendiente") || myActions.includes("resolverQuiebra");
    case "auction":
      return myActions.includes("hacerOferta") || myActions.includes("retirarseDeSubasta");
    case "jail":
      return myActions.includes("pagarMultaCarcel") || myActions.includes("usarCartaSalirCarcel") || myActions.includes("tirarDados");
    default:
      return false;
  }
}

function EventFeed({ events, playersById, boardById }) {
  return (
    <section className="monopoly-panel p-5">
      <div className="mb-4 flex items-center gap-3">
        <Receipt size={20} className="text-[#b02016]" />
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Historial</p>
          <h3 className="text-2xl font-black uppercase text-[#23160c]">Eventos recientes</h3>
        </div>
      </div>

      <div className="grid max-h-[360px] gap-3 overflow-y-auto pr-1">
        {events.length === 0 ? (
          <div className="rounded-[20px] border-2 border-dashed border-[#d3c2a4] bg-[#fff8ec] px-4 py-5 text-sm font-semibold text-[#7c5d38]">
            Todavia no hay eventos para mostrar.
          </div>
        ) : (
          [...events].reverse().map((event) => {
            const summary = describeEvent(event, playersById, boardById);
            return (
              <div key={`${event.id}-${summary.title}`} className={cx("event-feed-card", `tone-${eventTone(event.type)}`)}>
                <p className="text-sm font-black uppercase">{summary.title}</p>
                <p className="mt-1 text-sm font-semibold opacity-85">{summary.body}</p>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function EventToasts({ toasts, onDismiss, playersById, boardById }) {
  return (
    <div className="monopoly-toast-stack">
      {toasts.map((toast) => {
        const summary = describeEvent(toast, playersById, boardById);
        return (
          <div key={`${toast.id}-${summary.title}`} className={cx("monopoly-toast", `tone-${eventTone(toast.type)}`)}>
            <div className="min-w-0">
              <p className="text-sm font-black uppercase">{summary.title}</p>
              <p className="mt-1 text-sm font-semibold opacity-90">{summary.body}</p>
            </div>
            <button type="button" className="toast-close" onClick={() => onDismiss(toast.id)}>
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TurnAssist({ currentPlayer, isMyTurn, phase, modalState, myActions, onAction }) {
  const canAct = isMyTurn && myActions.length > 0;

  return (
    <section className={cx("monopoly-panel turn-assist p-4", !isMyTurn && "opacity-95")}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Turno actual</p>
          <h3 className="text-lg font-black uppercase text-[#23160c] truncate">
            {isMyTurn ? "Te toca jugar" : `Juega ${currentPlayer?.name || "otro jugador"}`}
          </h3>
        </div>
        <span className={cx("monopoly-chip", isMyTurn ? "bg-[#0f766e] text-white" : "bg-[#ece3cf] text-[#23160c]")}>
          {phaseLabel[phase] || phase}
        </span>
      </div>

      <div className="turn-assist-grid">
        <div className="turn-assist-card">
          <p className="turn-assist-label">Siguiente paso</p>
          <p className="turn-assist-value">{modalState?.title || (isMyTurn ? "Ejecuta tu accion principal" : "Espera el movimiento rival")}</p>
        </div>
        <div className="turn-assist-card">
          <p className="turn-assist-label">Tu estado</p>
          <p className="turn-assist-value">{canAct ? "Puedes actuar ahora" : "Observando la mesa"}</p>
        </div>
      </div>

      {!isMyTurn && (
        <div className="wait-banner">
          <HourglassMessage />
          <div>
            <p className="text-sm font-black uppercase text-[#23160c]">Modo espectador temporal</p>
            <p className="mt-1 text-sm font-semibold text-[#7c5d38]">Puedes seguir el tablero, leer eventos y preparar tus decisiones.</p>
          </div>
        </div>
      )}

      {isMyTurn && myActions.includes("tirarDados") && (
        <ActionButton className="mt-4 w-full" onClick={() => onAction("tirarDados")}>
          <Dice5 size={18} />
          Tirar dados ahora
        </ActionButton>
      )}
    </section>
  );
}

function HourglassMessage() {
  return (
    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#d0be9d] bg-[#fff8ec] text-[#b02016]">
      <TimerReset size={20} />
    </span>
  );
}

function ActionModal({ modalState, myActions, currentUserId, state, playersById, boardById, onAction, onClose }) {
  const [modalBidAmount, setModalBidAmount] = useState(1);

  useEffect(() => {
    if (modalState?.type === "auction") {
      setModalBidAmount((modalState.auction.currentBid || 0) + 1);
    }
  }, [modalState?.type, modalState?.auction?.id, modalState?.auction?.currentBid]);

  if (!modalState) return null;

  const closeAllowed = !modalState.blocking;
  const property = modalState.property;
  const isMyAuctionTurn = modalState.type === "auction" && modalState.auction.activeBidderId === currentUserId;
  const canBidAuction = isMyAuctionTurn || myActions.includes("hacerOferta");
  const canPassAuction = isMyAuctionTurn || myActions.includes("retirarseDeSubasta");

  return (
    <div className="monopoly-modal-backdrop">
      <div className={cx("monopoly-modal", `tone-${modalState.tone}`)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Accion de tablero</p>
            <h3 className="mt-2 text-3xl font-black uppercase">{modalState.title}</h3>
            <p className="mt-3 text-sm font-semibold leading-6 opacity-90">{modalState.body}</p>
          </div>
          {closeAllowed && (
            <button type="button" className="toast-close" onClick={onClose}>
              <X size={16} />
            </button>
          )}
        </div>

        {modalState.type === "purchase" && property && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="modal-stat-card">
              <span>Precio</span>
              <Money amount={property.price} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Hipoteca</span>
              <Money amount={property.mortgageValue} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Tipo</span>
              <span className="modal-stat-value">{spaceTypeLabel(property)}</span>
            </div>
          </div>
        )}

        {modalState.type === "tax" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="modal-stat-card">
              <span>Pago fijo</span>
              <Money amount={modalState.tax.fixedAmount} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Pago por patrimonio</span>
              <Money amount={modalState.tax.percentAmount} className="modal-stat-value" />
            </div>
          </div>
        )}

        {modalState.type === "debt" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="modal-stat-card">
              <span>Deuda</span>
              <Money amount={modalState.debt.amount} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Deudor</span>
              <span className="modal-stat-value">{playersById.get(modalState.debt.debtorId)?.name || "Jugador"}</span>
            </div>
          </div>
        )}

        {modalState.type === "auction" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="modal-stat-card">
              <span>Propiedad</span>
              <span className="modal-stat-value">{boardById.get(modalState.auction.assetId)?.name || "Activo"}</span>
            </div>
            <div className="modal-stat-card">
              <span>Puja actual</span>
              <Money amount={modalState.auction.currentBid || 0} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Turno de puja</span>
              <span className="modal-stat-value">{playersById.get(modalState.auction.activeBidderId)?.name || "Jugador"}</span>
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {modalState.type === "purchase" && myActions.includes("comprarPropiedad") && (
            <>
              <ActionButton onClick={() => onAction("comprarPropiedad")}>Comprar</ActionButton>
              <ActionButton tone="danger" onClick={() => onAction("rechazarCompra")}>Subastar</ActionButton>
            </>
          )}

          {modalState.type === "tax" && myActions.includes("pagarImpuesto") && (
            <>
              <ActionButton onClick={() => onAction("pagarImpuesto", { opcion: "FIXED" })}>Pagar fijo</ActionButton>
              <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto", { opcion: "PERCENT" })}>Pagar patrimonio</ActionButton>
            </>
          )}

          {modalState.type === "card" && myActions.includes("resolverCarta") && (
            <ActionButton onClick={() => onAction("resolverCarta")}>Resolver carta</ActionButton>
          )}

          {modalState.type === "debt" && myActions.includes("resolverDeudaPendiente") && (
            <>
              <ActionButton onClick={() => onAction("resolverDeudaPendiente")}>Pagar deuda</ActionButton>
              {myActions.includes("resolverQuiebra") && <ActionButton tone="danger" onClick={() => onAction("resolverQuiebra")}>Quiebra</ActionButton>}
            </>
          )}

          {modalState.type === "jail" && (
            <>
              {myActions.includes("pagarMultaCarcel") && <ActionButton onClick={() => onAction("pagarMultaCarcel")}>Pagar multa</ActionButton>}
              {myActions.includes("usarCartaSalirCarcel") && <ActionButton tone="secondary" onClick={() => onAction("usarCartaSalirCarcel")}>Usar carta</ActionButton>}
              {myActions.includes("tirarDados") && <ActionButton tone="secondary" onClick={() => onAction("tirarDados")}>Intentar dobles</ActionButton>}
            </>
          )}

          {modalState.type === "auction" && (canBidAuction || canPassAuction) && (
            <div className="auction-modal-actions">
              {canBidAuction && (
                <>
                  <input
                    className="monopoly-input auction-bid-input"
                    type="number"
                    min={(modalState.auction.currentBid || 0) + 1}
                    value={modalBidAmount}
                    onChange={(event) => setModalBidAmount(Number(event.target.value))}
                  />
                  <ActionButton onClick={() => onAction("hacerOferta", { monto: modalBidAmount })}>
                    <Gavel size={18} />
                    Ofertar
                  </ActionButton>
                </>
              )}
              {canPassAuction && (
                <ActionButton tone="danger" onClick={() => onAction("retirarseDeSubasta")}>
                  Pasar
                </ActionButton>
              )}
            </div>
          )}

          {closeAllowed && (
            <ActionButton tone="secondary" onClick={onClose}>Cerrar</ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenCustomizer({ open, onClose, currentPlayer, currentTokenStyle, onChange, onReset }) {
  const [draft, setDraft] = useState(currentTokenStyle);

  useEffect(() => {
    if (open) {
      setDraft(currentTokenStyle);
    }
  }, [open, currentTokenStyle]);

  if (!open) return null;

  function update(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function applyAndClose() {
    onChange({
      label: draft.label,
      bg: draft.bg,
      ring: draft.ring,
      shape: draft.shape
    });
    onClose();
  }

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info" style={{ maxWidth: "640px" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Personalización</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Tu ficha en el tablero</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">
              {currentPlayer?.name ? `${currentPlayer.name}, elige cómo te ven en la mesa.` : "Elige cómo se verá tu ficha."}
            </p>
          </div>
          <button type="button" className="toast-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-[18px] border border-[#86c9b2] bg-white/60 px-4 py-4">
          <TokenChip tokenStyle={{ ...draft, emoji: isEmojiToken(draft.label) }} className="h-16 w-16 text-lg monopoly-token-large" />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-75">Vista previa</p>
            <p className="text-lg font-black uppercase">{draft.label || "?"}</p>
            <p className="text-xs font-semibold opacity-80">Forma: {tokenShapes.find((s) => s.id === draft.shape)?.label || draft.shape}</p>
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Texto / iniciales</p>
          <input
            className="monopoly-input mt-2"
            value={draft.label}
            maxLength={4}
            onChange={(event) => update({ label: event.target.value })}
            placeholder="Ej: JR, STAR, K, 7"
          />
          <p className="mt-2 text-xs font-semibold opacity-80">Hasta 4 caracteres. Acepta letras, números o símbolos.</p>
        </div>

        <div className="mt-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Emojis sugeridos</p>
          <div className="token-customizer-grid mt-2">
            {tokenEmojiPresets.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={cx("token-option", draft.label === emoji && "active")}
                onClick={() => update({ label: emoji })}
                title={emoji}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Forma</p>
          <div className="token-shape-row mt-2">
            {tokenShapes.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className={cx(draft.shape === shape.id && "active")}
                onClick={() => update({ shape: shape.id })}
                title={shape.label}
              >
                <TokenChip
                  tokenStyle={{ label: draft.label || "A", bg: draft.bg, ring: draft.ring, shape: shape.id, emoji: isEmojiToken(draft.label) }}
                  className="h-9 w-9 text-xs"
                />
                <span className="ml-2 align-middle text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#23160c]">{shape.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Color</p>
          <div className="token-color-row mt-2">
            {tokenColorPresets.map((color) => (
              <button
                key={color.bg}
                type="button"
                className={cx("token-color-swatch", draft.bg === color.bg && "active")}
                style={{ background: color.bg, borderColor: draft.bg === color.bg ? "#0f766e" : color.ring }}
                onClick={() => update({ bg: color.bg, ring: color.ring })}
                aria-label={`Color ${color.bg}`}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <ActionButton onClick={applyAndClose}>Guardar ficha</ActionButton>
          <ActionButton tone="secondary" onClick={() => { onReset(); onClose(); }}>Restablecer</ActionButton>
          <ActionButton tone="secondary" onClick={onClose}>Cancelar</ActionButton>
        </div>
      </div>
    </div>
  );
}

export default function MonopolyGame({ token, socket, currentUser, world, presence, messages, connectionStatus, onSendMessage }) {
  const [state, setState] = useState(null);
  const [tableMeta, setTableMeta] = useState(null);
  const [tables, setTables] = useState([]);
  const [activeTableId, setActiveTableId] = useState("");
  const [error, setError] = useState("");
  const [tableName, setTableName] = useState("Mesa Monopoly");
  const [mode, setMode] = useState("NORMAL");
  const [timedMinutes, setTimedMinutes] = useState(60);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(60);
  const [bidAmount, setBidAmount] = useState(100);
  const [selectedSpaceId, setSelectedSpaceId] = useState("go");
  const [propertyTrade, setPropertyTrade] = useState({ propertyId: "", buyerId: "", price: 100, liftMortgage: false });
  const [cardTrade, setCardTrade] = useState({ deck: "CASUALIDAD", buyerId: "", price: 100 });
  const [toasts, setToasts] = useState([]);
  const [diceFaces, setDiceFaces] = useState([1, 6]);
  const [rollingDice, setRollingDice] = useState(false);
  const [modalDismissKey, setModalDismissKey] = useState("");
  const [displayPositions, setDisplayPositions] = useState(new Map());
  const [cinematic, setCinematic] = useState(null);
  const [customTokens, setCustomTokens] = useState(() => loadCustomTokens());
  const [tokenEditorOpen, setTokenEditorOpen] = useState(false);
  const seenEventIdsRef = useRef(new Set());
  const lastRollSignatureRef = useRef("");
  const previousSnapshotRef = useRef(null);
  const diceIntervalRef = useRef(null);
  const diceTimeoutRef = useRef(null);
  const cinematicTimeoutsRef = useRef([]);
  const [tick, setTick] = useState(Date.now());
  const currentUserId = Number.isFinite(Number(currentUser.id)) ? Number(currentUser.id) : currentUser.id;

  useEffect(() => {
    if (!world || !token) return undefined;

    let active = true;

    async function loadTables() {
      try {
        const payload = await api(`/api/monopoly/tables?worldId=${world.id}`, { token });

        if (active) {
          setTables(payload.tables || []);
          setError("");
        }
      } catch (nextError) {
        if (active) {
          setTables([]);
          setError(nextError.message || "No se pudo cargar Monopoly");
        }
      }
    }

    loadTables();
    return () => {
      active = false;
    };
  }, [token, world?.id]);

  useEffect(() => {
    if (!socket || !world) return undefined;

    function handleTablesState(payload) {
      if (payload.worldId !== world.id) return;
      setTables(payload.tables || []);
    }

    function handleMonopolyState(payload) {
      if (payload.worldId !== world.id) return;
      if (payload.tableId && activeTableId && payload.tableId !== activeTableId) {
        return;
      }
      if (payload.tableId && !activeTableId) {
        const shouldAutoOpen = payload.table?.seatedPlayers?.some((player) => player.id === currentUserId);
        if (!shouldAutoOpen) {
          return;
        }
        setActiveTableId(payload.tableId);
      }
      setTableMeta(payload.table || null);
      setState(payload.table?.game || null);
      setError("");
    }

    function handleMonopolyError(payload) {
      setError(payload.message || "Error en Monopoly");
    }

    socket.on("monopoly_tables_state", handleTablesState);
    socket.on("monopoly_state", handleMonopolyState);
    socket.on("monopoly_error", handleMonopolyError);
    socket.emit("request_monopoly_tables", { worldId: world.id });
    if (activeTableId) {
      socket.emit("request_monopoly_state", { worldId: world.id, tableId: activeTableId });
    }

    return () => {
      socket.off("monopoly_tables_state", handleTablesState);
      socket.off("monopoly_state", handleMonopolyState);
      socket.off("monopoly_error", handleMonopolyError);
    };
  }, [socket, world?.id, activeTableId, currentUserId]);

  useEffect(() => {
    const timerId = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!tables.length) {
      setActiveTableId("");
      setTableMeta(null);
      setState(null);
      return;
    }

    const stillExists = activeTableId && tables.some((table) => table.id === activeTableId);
    if (stillExists) {
      return;
    }

    const preferredTable =
      tables.find((table) => table.players.some((player) => player.id === currentUserId) && table.status !== "FINISHED") ||
      tables[0];

    if (preferredTable) {
      setActiveTableId(preferredTable.id);
    }
  }, [tables, activeTableId, currentUserId]);

  useEffect(() => {
    if (!socket || !world || !activeTableId) {
      if (!activeTableId) {
        setTableMeta(null);
        setState(null);
      }
      return;
    }

    socket.emit("request_monopoly_state", { worldId: world.id, tableId: activeTableId });
  }, [socket, world?.id, activeTableId]);

  const playersById = useMemo(() => new Map((state?.players || []).map((player) => [player.id, player])), [state?.players]);
  const currentPlayer = playersById.get(state?.currentPlayerId);
  const myPlayer = playersById.get(currentUserId);
  const myActions = myPlayer?.availableActions || [];
  const board = state?.board || [];
  const pendingPurchaseSpace = state?.turn?.pendingPurchase ? board.find((space) => space.id === state.turn.pendingPurchase.propertyId) : null;
  const pendingTax = state?.turn?.pendingTax || null;
  const pendingDebt = state?.turn?.pendingDebt || null;
  const pendingCard = state?.turn?.pendingCard || null;
  const auction = state?.turn?.auction || null;
  const isMyAuctionTurn = auction?.activeBidderId === currentUserId;
  const canBidAuction = isMyAuctionTurn || myActions.includes("hacerOferta");
  const canPassAuction = isMyAuctionTurn || myActions.includes("retirarseDeSubasta");
  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) || null,
    [tables, activeTableId]
  );
  const isSeatedAtActiveTable = Boolean(activeTable?.players.some((player) => player.id === currentUserId));
  const isHostAtActiveTable = activeTable?.hostId === currentUserId;
  const turnCountdown = formatCountdown(tableMeta?.turnDeadlineAt || activeTable?.turnDeadlineAt || null);

  useEffect(() => {
    if (auction) {
      setBidAmount((auction.currentBid || 0) + 1);
    }
  }, [auction?.id, auction?.currentBid]);

  const boardPlayers = useMemo(
    () =>
      (state?.players || []).map((player, index) => ({
        ...player,
        colorIndex: index
      })),
    [state?.players]
  );
  const coloredPlayersById = useMemo(() => new Map(boardPlayers.map((player) => [player.id, player])), [boardPlayers]);
  const displayBoardPlayers = useMemo(
    () => boardPlayers.map((player) => ({
      ...player,
      position: displayPositions.get(player.id) ?? player.position
    })),
    [boardPlayers, displayPositions]
  );

  const tokenStylesById = useMemo(() => {
    const map = {};
    boardPlayers.forEach((player) => {
      map[player.id] = resolveTokenStyle(player, customTokens);
    });
    return map;
  }, [boardPlayers, customTokens]);

  const myTokenStyle = useMemo(() => {
    const me = boardPlayers.find((player) => player.id === currentUserId);
    if (me) return resolveTokenStyle(me, customTokens);
    // Fallback for the pre-game lobby (no in-game player yet)
    const fallbackIndex = boardPlayers.length;
    return resolveTokenStyle({ id: currentUserId, name: currentUser.username || "Tú", colorIndex: fallbackIndex }, customTokens);
  }, [boardPlayers, currentUserId, currentUser.username, customTokens]);

  function persistMyToken(next) {
    setCustomTokens((prev) => {
      const updated = { ...prev, [currentUserId]: next };
      saveCustomTokens(updated);
      return updated;
    });
  }

  function resetMyToken() {
    setCustomTokens((prev) => {
      const updated = { ...prev };
      delete updated[currentUserId];
      saveCustomTokens(updated);
      return updated;
    });
  }

  const cameraFocus = useMemo(() => {
    if (!cinematic) return null;
    if (cinematic.phase === "dice") return null;
    const mover = displayBoardPlayers.find((player) => player.id === cinematic.playerId);
    if (!mover) return null;
    const cell = boardCell(mover.position);
    return {
      x: ((cell.col + 0.5) / 11) * 100,
      y: ((cell.row + 0.5) / 11) * 100,
      spaceIndex: mover.position,
      scale: cinematic.phase === "settle" ? 1.28 : 1.18
    };
  }, [cinematic, displayBoardPlayers]);

  useEffect(() => {
    if (!board.length) return;
    const focusId =
      pendingPurchaseSpace?.id ||
      board.find((space) => space.index === currentPlayer?.position)?.id ||
      board[0]?.id;

    if (focusId) {
      setSelectedSpaceId(focusId);
    }
  }, [board, currentPlayer?.position, pendingPurchaseSpace?.id, state?.turn?.turnNumber, state?.turn?.lastRoll?.total]);

  const selectedSpace =
    board.find((space) => space.id === selectedSpaceId) ||
    board.find((space) => space.index === currentPlayer?.position) ||
    board[0] ||
    null;
  const selectedOwner = selectedSpace?.ownerId ? playersById.get(selectedSpace.ownerId) : null;
  const selectedOwnerProperty = selectedOwner?.properties.find((property) => property.id === selectedSpace?.id) || null;
  const selectedVisitors = displayBoardPlayers.filter((player) => player.position === selectedSpace?.index && !player.bankrupt);
  const prompt = state
    ? currentPrompt({ state, playersById, currentUserId, pendingPurchaseSpace, pendingTax, pendingDebt, pendingCard, auction })
    : null;
  const mainQuickAction = state
    ? quickAction({ myActions, pendingCard, pendingDebt, pendingPurchaseSpace, auction, pendingTax })
    : null;
  const boardById = useMemo(() => new Map(board.map((space) => [space.id, space])), [board]);
  const rawModalState = state ? buildModalState({ state, currentUserId, playersById, boardById }) : null;
  const modalShouldBlock = modalNeedsAction(rawModalState, myActions);
  const modalKey = rawModalState
    ? `${rawModalState.type}:${rawModalState.property?.id || rawModalState.card?.id || rawModalState.auction?.id || rawModalState.debt?.debtorId || state.turn.currentPlayerId}:${state.turn.turnNumber}`
    : "";
  const activeModal = cinematic
    ? null
    : rawModalState && modalShouldBlock
    ? { ...rawModalState, blocking: true }
    : rawModalState && modalDismissKey !== modalKey
      ? { ...rawModalState, blocking: false }
      : null;

  useEffect(() => {
    return () => {
      if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
      if (diceTimeoutRef.current) window.clearTimeout(diceTimeoutRef.current);
      cinematicTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!boardPlayers.length) return;

    setDisplayPositions((current) => {
      if (cinematic) return current;
      const next = new Map();
      boardPlayers.forEach((player) => {
        next.set(player.id, player.position);
      });
      return next;
    });
  }, [boardPlayers, cinematic]);

  useEffect(() => {
    if (!state?.recentEvents) return;

    const currentIds = new Set(state.recentEvents.map((event) => event.id));
    if (seenEventIdsRef.current.size === 0) {
      seenEventIdsRef.current = currentIds;
      return;
    }

    const newEvents = state.recentEvents.filter((event) => !seenEventIdsRef.current.has(event.id));
    if (newEvents.length > 0) {
      setToasts((current) => [...current, ...newEvents].slice(-4));
      newEvents.forEach((event, index) => {
        window.setTimeout(() => {
          setToasts((current) => current.filter((toast) => toast.id !== event.id));
        }, 4200 + index * 350);
      });
    }

    seenEventIdsRef.current = currentIds;
  }, [state?.recentEvents]);

  useEffect(() => {
    if (!state?.turn?.lastRoll) return;
    const signature = `${state.turn.turnNumber}:${state.turn.lastRoll.dice.join("-")}:${state.currentPlayerId}`;
    if (lastRollSignatureRef.current === signature) return;
    lastRollSignatureRef.current = signature;

    const previous = previousSnapshotRef.current;
    const moverId = previous?.currentPlayerId;
    const previousPlayer = previous?.players?.find((player) => player.id === moverId);
    const nextPlayer = state.players.find((player) => player.id === moverId);
    const boardSize = state.board.length || 40;
    const from = previousPlayer?.position;
    const to = nextPlayer?.position;
    const path = Number.isInteger(from) && state.turn.lastRoll?.total
      ? buildMovementPath(from, state.turn.lastRoll.total, boardSize)
      : [];

    if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
    if (diceTimeoutRef.current) window.clearTimeout(diceTimeoutRef.current);
    cinematicTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    cinematicTimeoutsRef.current = [];

    if (moverId && Number.isInteger(from)) {
      setDisplayPositions((current) => {
        const next = new Map(current);
        next.set(moverId, from);
        return next;
      });
    }

    setRollingDice(true);
    setCinematic({ phase: "dice", playerId: moverId || previous?.currentPlayerId || state.currentPlayerId });
    // Solo reproducir si todavía no se disparó al clickear (evita duplicado)
    if (!rollingDice) {
      audio.playRandomDice();
    }
    diceIntervalRef.current = window.setInterval(() => {
      setDiceFaces([
        Math.floor(Math.random() * 6) + 1,
        Math.floor(Math.random() * 6) + 1
      ]);
    }, 180);

    // Timings cinemáticos (más visibles y disfrutables):
    //  dice phase  : 2400ms  (cara final visible al final, +800ms para reposo antes de mover)
    //  step delay  : 460ms   (paso entre casillas durante el recorrido)
    //  settle hold : 1500ms  (zoom en la casilla destino antes de soltar el control)
    const DICE_PHASE_MS = 3000;
    const DICE_REST_MS = 900;
    const STEP_MS = 520;
    const SETTLE_HOLD_MS = 1700;

    diceTimeoutRef.current = window.setTimeout(() => {
      if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
      setDiceFaces(state.turn.lastRoll.dice);
      setRollingDice(false);
      // Mantener el foco en los dados un instante más para que sí se aprecien
      const stepStartTimeoutId = window.setTimeout(() => {
        setCinematic((current) => current ? { ...current, phase: "move" } : current);

        if (moverId && path.length > 0) {
          path.forEach((position, index) => {
            const timeoutId = window.setTimeout(() => {
              setDisplayPositions((current) => {
                const next = new Map(current);
                next.set(moverId, position);
                return next;
              });
            }, index * STEP_MS);
            cinematicTimeoutsRef.current.push(timeoutId);
          });

          const settleTimeoutId = window.setTimeout(() => {
            setDisplayPositions((current) => {
              const next = new Map(current);
              next.set(moverId, to ?? path[path.length - 1]);
              return next;
            });
            setCinematic({ phase: "settle", playerId: moverId });
          }, path.length * STEP_MS + 120);
          cinematicTimeoutsRef.current.push(settleTimeoutId);

          const finishTimeoutId = window.setTimeout(() => {
            setCinematic(null);
          }, path.length * STEP_MS + SETTLE_HOLD_MS);
          cinematicTimeoutsRef.current.push(finishTimeoutId);
        } else {
          const finishTimeoutId = window.setTimeout(() => {
            setCinematic(null);
          }, 1100);
          cinematicTimeoutsRef.current.push(finishTimeoutId);
        }
      }, DICE_REST_MS);
      cinematicTimeoutsRef.current.push(stepStartTimeoutId);
    }, DICE_PHASE_MS);
  }, [state?.turn?.lastRoll, state?.turn?.turnNumber, state?.currentPlayerId]);

  useEffect(() => {
    if (state) {
      previousSnapshotRef.current = state;
    }
  }, [state]);

  // "Tu turno" audio: se reproduce cuando cambia el turno y eres tú quien juega.
  const lastTurnAudioKeyRef = useRef("");
  useEffect(() => {
    if (!state || !state.currentPlayerId) return;
    const key = `${state.turn?.turnNumber || 0}:${state.currentPlayerId}`;
    if (lastTurnAudioKeyRef.current === key) return;
    lastTurnAudioKeyRef.current = key;

    if (state.currentPlayerId === currentUserId && !state.winnerId) {
      // Pequeño delay para no superponer otros audios de cierre del turno previo
      const timeoutId = window.setTimeout(() => {
        audio.play("tuturno");
      }, 240);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [state?.currentPlayerId, state?.turn?.turnNumber, currentUserId, state?.winnerId]);

  // Audio cuando el cinematic cambia a fase "settle" (la ficha llegó a destino).
  // También dispara sonidos especiales de compra cuando llega a propiedades libres.
  const lastSettlePhaseRef = useRef("");
  useEffect(() => {
    if (!cinematic) {
      lastSettlePhaseRef.current = "";
      return;
    }
    if (cinematic.phase === "settle" && lastSettlePhaseRef.current !== "settle") {
      lastSettlePhaseRef.current = "settle";
      // Sonido sutil al asentarse: usamos selectmenu como "tick" de llegada
      audio.play("selectmenu");
    } else if (cinematic.phase !== "settle") {
      lastSettlePhaseRef.current = cinematic.phase;
    }
  }, [cinematic]);

  function createTable() {
    if (!socket) {
      setError("Socket desconectado");
      return;
    }

    socket.emit("create_monopoly_table", {
      worldId: world.id,
      name: tableName,
      mode,
      timedMinutes,
      turnTimeSeconds
    }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo crear la mesa");
        return;
      }

      const nextTableId = response.state?.table?.id || response.state?.tableId || "";
      if (nextTableId) {
        setActiveTableId(nextTableId);
      }
      setError("");
    });
  }

  function joinTable(tableId) {
    if (!socket) {
      setError("Socket desconectado");
      return;
    }

    socket.emit("join_monopoly_table", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo entrar a la mesa");
        return;
      }

      setActiveTableId(tableId);
      setError("");
    });
  }

  function startGame() {
    if (!socket || !activeTableId) {
      setError("Primero elige una mesa");
      return;
    }

    socket.emit("start_monopoly_game", { worldId: world.id, tableId: activeTableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo iniciar Monopoly");
        return;
      }

      setError("");
    });
  }

  function act(action, payload = {}) {
    if (!socket) {
      setError("Socket desconectado");
      return;
    }

    // Sonido de feedback de menú/acción
    const audioKey = actionAudioMap[action];
    if (audioKey) {
      audio.play(audioKey);
    }

    if (action === "tirarDados") {
      if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
      if (diceTimeoutRef.current) window.clearTimeout(diceTimeoutRef.current);
      setRollingDice(true);
      audio.playRandomDice();
      diceIntervalRef.current = window.setInterval(() => {
        setDiceFaces([
          Math.floor(Math.random() * 6) + 1,
          Math.floor(Math.random() * 6) + 1
        ]);
      }, 130);
    }

    socket.emit("monopoly_action", { worldId: world.id, tableId: activeTableId, action, payload }, (response) => {
      if (!response?.ok) {
        if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
        setRollingDice(false);
        setError(response?.error || "No se pudo ejecutar la accion");
        return;
      }

      if (response.state?.tables) {
        setTables(response.state.tables);
      }
      if (response.state?.table) {
        setTableMeta(response.state.table);
        setState(response.state.table.game || null);
      }
      setError("");
    });
  }

  function leaveTable() {
    if (!socket || !activeTableId) return;
    socket.emit("leave_monopoly_table", { worldId: world.id, tableId: activeTableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo salir de la mesa");
        return;
      }

      setActiveTableId("");
      setTableMeta(null);
      setState(null);
      setError("");
    });
  }

  function surrenderGame() {
    if (!socket || !activeTableId) return;
    socket.emit("surrender_monopoly_game", { worldId: world.id, tableId: activeTableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo rendir la partida");
        return;
      }

      setError("");
    });
  }

  function closeTable() {
    if (!socket || !activeTableId) return;
    socket.emit("close_monopoly_table", { worldId: world.id, tableId: activeTableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo cerrar la mesa");
        return;
      }

      setActiveTableId("");
      setTableMeta(null);
      setState(null);
      setError("");
    });
  }

  function dismissToast(toastId) {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }

  if (!state) {
    return (
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="monopoly-panel overflow-hidden p-0">
          <div className="border-b-2 border-[#d3c2a4] bg-[linear-gradient(180deg,#fbf5e8,#f0e2c7)] px-6 py-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.28em] text-[#b02016]">Monopoly</p>
                <h2 className="mt-2 text-4xl font-black uppercase text-[#23160c]">Mesas de Monopoly</h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold text-[#6b4b2c]">
                  Crea una mesa, define el reloj por turno y entra a jugar sin perderte: cada mesa tiene reglas visibles, estado claro y controles de anfitrion.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setTokenEditorOpen(true)}
                  className="monopoly-secondary-button"
                  title="Personaliza tu ficha: elige un emoji, letra o forma propia."
                >
                  <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
                  <span className="ml-1">Mi ficha</span>
                </button>
                <div className="flex items-center gap-2 rounded-[18px] border-2 border-[#cdb591] bg-white/75 px-4 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-[#6b4b2c]">
                  Mundo - {world.name}
                  <InfoTip label="Las mesas de Monopoly viven dentro de este mundo. Puedes observar cualquier mesa y sentarte solo en una mesa activa a la vez." />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 p-6 2xl:grid-cols-[minmax(0,1.28fr)_360px]">
            <div className="grid gap-6">
              <div className="monopoly-table-shell">
                <div className="monopoly-board monopoly-board-preview">
                  {previewBoard.map((space) => (
                    <BoardSpace
                      key={space.id}
                      space={space}
                      owner={null}
                      players={[]}
                      selected={false}
                      current={false}
                      onSelect={() => {}}
                      showTokens={false}
                    />
                  ))}
                  <div className="monopoly-center">
                    <div className="monopoly-logo">MONOPOLY</div>
                    <div className="mx-auto mt-5 max-w-2xl rounded-[24px] border border-[#d8c8ae] bg-[#fff8ec]/90 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
                      <p className="text-center text-sm font-extrabold uppercase tracking-[0.18em] text-[#6b4b2c]">
                        Crea tu propia mesa
                      </p>
                      <div className="mt-4 grid gap-3">
                        <label className="grid gap-2">
                          <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">
                            Nombre de mesa
                            <InfoTip label="Ponle un nombre corto para distinguirla del resto. Ejemplo: Mesa Clasica, Reloj 60s o Solo valientes." />
                          </span>
                          <input
                            className="monopoly-input"
                            value={tableName}
                            maxLength={48}
                            onChange={(event) => setTableName(event.target.value)}
                          />
                        </label>

                        <div className="grid gap-3 sm:grid-cols-3">
                          {[
                            { id: "NORMAL", label: "Clasico", copy: "Gana el ultimo jugador solvente" },
                            { id: "SHORT", label: "Corto", copy: "Hotels con 3 casas; termina antes" },
                            { id: "TIMED", label: "Con limite", copy: "Se decide por riqueza al acabar el reloj" }
                          ].map((choice) => (
                            <button
                              key={choice.id}
                              type="button"
                              title={choice.copy}
                              className={cx(
                                "rounded-[20px] border-2 px-4 py-4 text-left transition",
                                mode === choice.id
                                  ? "border-[#0f766e] bg-[#ebfaf3] shadow-[0_12px_28px_rgba(15,118,110,0.14)]"
                                  : "border-[#d3c2a4] bg-[#fff8ec] hover:border-[#bfa57f]"
                              )}
                              onClick={() => setMode(choice.id)}
                            >
                              <p className="text-sm font-black uppercase text-[#23160c]">{choice.label}</p>
                              <p className="mt-1 text-xs font-semibold text-[#7c5d38]">{choice.copy}</p>
                            </button>
                          ))}
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">
                              Tiempo por turno
                              <InfoTip label="Cuando el reloj llega a cero, el servidor resuelve la accion minima para que la mesa no quede atorada." />
                            </span>
                            <select
                              className="monopoly-input"
                              value={turnTimeSeconds}
                              onChange={(event) => setTurnTimeSeconds(Number(event.target.value))}
                            >
                              {[30, 45, 60, 90, 120].map((seconds) => (
                                <option key={seconds} value={seconds}>{seconds} segundos</option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">
                              Duracion de partida
                              <InfoTip label="Solo aplica al modo con limite. En Clasico y Corto, la partida termina por quiebras y reglas del modo." />
                            </span>
                            <input
                              className="monopoly-input"
                              type="number"
                              min={30}
                              max={240}
                              value={timedMinutes}
                              onChange={(event) => setTimedMinutes(Number(event.target.value))}
                              disabled={mode !== "TIMED"}
                            />
                          </label>
                        </div>

                        <ActionButton onClick={createTable} tooltip="Crea una mesa nueva y te sienta como anfitrion.">
                          <PlayCircle size={18} />
                          Crear mesa
                        </ActionButton>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid gap-3">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-[#0f766e]" />
                  <p className="text-sm font-black uppercase text-[#23160c]">Mesas disponibles en {world.name}</p>
                  <InfoTip label="Puedes observar cualquier mesa. Solo puedes estar sentado en una mesa activa de Monopoly a la vez." />
                </div>
                {tables.length === 0 ? (
                  <div className="rounded-[20px] border-2 border-dashed border-[#d3c2a4] bg-[#fff8ec] px-4 py-6 text-sm font-semibold text-[#7c5d38]">
                    Aun no hay mesas creadas. La primera mesa buena puede ser tuya.
                  </div>
                ) : (
                  <div className="grid gap-3 lg:grid-cols-2">
                    {tables.map((table) => (
                      <button
                        key={table.id}
                        type="button"
                        className={cx(
                          "rounded-[20px] border-2 px-4 py-4 text-left transition",
                          activeTableId === table.id ? "border-[#0f766e] bg-[#eef7f2]" : "border-[#d3c2a4] bg-[#fbf5e8]"
                        )}
                        onClick={() => setActiveTableId(table.id)}
                        title={`Mesa ${table.name}. ${table.playerCount} jugador(es). Turnos de ${table.turnTimeSeconds}s.`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black uppercase text-[#23160c]">{table.name}</p>
                            <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#7c5d38]">
                              {modeLabel[table.mode] || table.mode} - {table.playerCount} jugadores
                            </p>
                          </div>
                          <span className={cx(
                            "monopoly-chip",
                            table.status === "PLAYING" ? "bg-[#0f766e] text-white" : table.status === "FINISHED" ? "bg-[#c08a1a] text-white" : "bg-[#ece3cf] text-[#23160c]"
                          )}>
                            {table.status === "WAITING" ? "Lobby" : table.status === "PLAYING" ? "En juego" : "Finalizada"}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className="monopoly-chip bg-[#fff] text-[#23160c]">Turno {table.turnTimeSeconds}s</span>
                          {table.mode === "TIMED" && <span className="monopoly-chip bg-[#fff] text-[#23160c]">{table.timedMinutes} min</span>}
                          {table.players.slice(0, 3).map((player) => (
                            <span key={player.id} className="monopoly-chip bg-[#ece3cf] text-[#23160c]">{player.name}</span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <aside className="grid gap-5">
              <section className="monopoly-panel p-5">
                <div className="flex items-center gap-3">
                  <Users size={20} className="text-[#0f766e]" />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Mesa</p>
                    <h3 className="text-2xl font-black uppercase text-[#23160c]">Resumen de mesa</h3>
                  </div>
                </div>
                <div className="mt-5 grid gap-3">
                  {!activeTable ? (
                    <div className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-5 text-sm font-semibold text-[#7c5d38]">
                      Selecciona una mesa para ver sus asientos, reloj y reglas activas.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Nombre</p>
                        <p className="mt-2 text-2xl font-black text-[#23160c]">{activeTable.name}</p>
                        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#7c5d38]">
                          {activeTable.status === "WAITING" ? "Esperando jugadores" : activeTable.status === "PLAYING" ? "Partida en curso" : "Partida cerrada"}
                        </p>
                      </div>
                      <div className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Reglas activas</p>
                        <div className="mt-3 grid gap-2 text-sm font-semibold text-[#6b4b2c]">
                          <p>Modo: {modeLabel[activeTable.mode] || activeTable.mode}</p>
                          <p>Reloj por turno: {activeTable.turnTimeSeconds} segundos</p>
                          {activeTable.mode === "TIMED" && <p>Limite total: {activeTable.timedMinutes} minutos</p>}
                          <p>Jugadores sentados: {activeTable.playerCount}</p>
                        </div>
                      </div>
                      <div className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4">
                        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#7c5d38]">Asientos</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {activeTable.players.map((player) => (
                            <span key={player.id} className="monopoly-chip bg-[#ece3cf] text-[#23160c]">
                              {player.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid gap-2">
                        {!isSeatedAtActiveTable && activeTable.status === "WAITING" && (
                          <ActionButton onClick={() => joinTable(activeTable.id)} tooltip="Te sienta en la mesa seleccionada mientras siga en lobby.">
                            <PlayCircle size={18} />
                            Sentarme en mesa
                          </ActionButton>
                        )}
                        {isSeatedAtActiveTable && isHostAtActiveTable && activeTable.status === "WAITING" && (
                          <ActionButton onClick={startGame} disabled={activeTable.playerCount < 2} tooltip="El anfitrion inicia la partida usando a los jugadores sentados en esta mesa.">
                            <PlayCircle size={18} />
                            Iniciar partida
                          </ActionButton>
                        )}
                        {isSeatedAtActiveTable && activeTable.status === "WAITING" && (
                          <ActionButton tone="secondary" onClick={leaveTable} tooltip="Te levanta de la mesa antes de empezar la partida.">
                            <DoorOpen size={18} />
                            Salir de mesa
                          </ActionButton>
                        )}
                        {isHostAtActiveTable && activeTable.status !== "PLAYING" && (
                          <ActionButton tone="danger" onClick={closeTable} tooltip="Cierra la mesa completa y la elimina del mundo.">
                            <LogOut size={18} />
                            Cerrar mesa
                          </ActionButton>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </section>

              <section className="monopoly-panel p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Info size={20} className="text-[#8a5a00]" />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Reglas</p>
                    <h3 className="text-2xl font-black uppercase text-[#23160c]">Ayuda rapida</h3>
                  </div>
                </div>
                <div className="grid gap-3">
                  {ruleCards.map((rule) => (
                    <div key={rule.title} className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4" title={rule.body}>
                      <p className="text-sm font-black uppercase text-[#23160c]">{rule.title}</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#6b4b2c]">{rule.body}</p>
                    </div>
                  ))}
                </div>
              </section>

              {error && (
                <div className="rounded-[20px] border-2 border-[#b91c1c] bg-[#fee2e2] px-4 py-4 text-sm font-bold text-[#7f1d1d]">
                  {error}
                </div>
              )}
            </aside>
          </div>
        </div>

        <MonopolySocialRail
          connectionStatus={connectionStatus}
          currentUser={currentUser}
          messages={messages}
          players={presence}
          onSendMessage={onSendMessage}
          customTokens={customTokens}
        />

        <TokenCustomizer
          open={tokenEditorOpen}
          onClose={() => setTokenEditorOpen(false)}
          currentPlayer={{ name: currentUser.username || "Tú" }}
          currentTokenStyle={myTokenStyle}
          onChange={persistMyToken}
          onReset={resetMyToken}
        />
      </section>
    );
  }

  return (
    <section className="grid gap-6">
      <EventToasts toasts={toasts} onDismiss={dismissToast} playersById={playersById} boardById={boardById} />
      <div className="monopoly-toolbar">
        <div className="flex flex-wrap items-center gap-3">
          <span className="monopoly-chip bg-[#b02016] text-white" title="Estas jugando una partida de Monopoly dentro de la mesa seleccionada.">Monopoly</span>
          <span className="monopoly-chip bg-[#ece3cf] text-[#23160c]" title="Modo de juego actual de la mesa.">
            {modeLabel[state.mode] || state.mode}
          </span>
          <span className="monopoly-chip bg-[#ece3cf] text-[#23160c]" title="Fase exacta del turno segun el motor.">
            {phaseLabel[state.turn.phase] || state.turn.phase}
          </span>
          <span className="monopoly-chip bg-[#fff8ec] text-[#23160c]" title="Tiempo restante antes de que el servidor resuelva automaticamente el turno.">
            Reloj {turnCountdown}
          </span>
          {state.turn.lastRoll && (
            <span className="monopoly-chip bg-[#0f766e] text-white" title="Ultimo resultado de dados que movio una ficha en esta mesa.">
              Dados {state.turn.lastRoll.dice.join(" + ")} = {state.turn.lastRoll.total}
            </span>
          )}
          {state.winnerId && (
            <span className="monopoly-chip bg-[#c08a1a] text-white" title="Ganador segun las reglas del modo actual.">
              Ganador - {playersById.get(state.winnerId)?.name}
            </span>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <button
            type="button"
            onClick={() => setTokenEditorOpen(true)}
            className="monopoly-secondary-button w-full sm:w-auto"
            title="Personaliza tu ficha: elige un emoji, letra o forma propia."
          >
            <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
            <span className="ml-1">Mi ficha</span>
          </button>
          <ActionButton
            tone="secondary"
            onClick={leaveTable}
            className="w-full sm:w-auto"
            tooltip="Abandonas la mesa cuando la partida ya termino. Si sigue en curso, usa Rendirse."
            disabled={tableMeta?.status === "PLAYING"}
          >
            <DoorOpen size={18} />
            Salir mesa
          </ActionButton>
          <ActionButton
            tone="danger"
            onClick={surrenderGame}
            className="w-full sm:w-auto"
            tooltip="Te declaras fuera de la partida. El banco liquida tus activos y la mesa continua."
            disabled={tableMeta?.status !== "PLAYING" || myPlayer?.bankrupt}
          >
            <AlertTriangle size={18} />
            Rendirse
          </ActionButton>
          {isHostAtActiveTable && (
            <ActionButton
              tone="secondary"
              onClick={closeTable}
              className="w-full sm:w-auto"
              tooltip="Cierra por completo la mesa seleccionada y la elimina de este mundo."
              disabled={tableMeta?.status === "PLAYING"}
            >
              <LogOut size={18} />
              Cerrar mesa
            </ActionButton>
          )}
        </div>
      </div>

      <div className="monopoly-play-layout">
        <div className="grid min-w-0 gap-4">
          <div className="monopoly-tabletop-row">
            <div className="monopoly-table-shell monopoly-board-shell-main">
            <div className="monopoly-board-viewport monopoly-board-viewport-main">
            <div
              className={cx("monopoly-board", cameraFocus && "cam-zoom")}
              style={cameraFocus ? {
                "--cam-x": `${cameraFocus.x}%`,
                "--cam-y": `${cameraFocus.y}%`,
                "--cam-scale": cameraFocus.scale
              } : undefined}
            >
              {board.map((space) => (
                <BoardSpace
                  key={space.id}
                  space={space}
                  owner={space.ownerId ? coloredPlayersById.get(space.ownerId) || playersById.get(space.ownerId) : null}
                  players={displayBoardPlayers.filter((player) => player.position === space.index && !player.bankrupt)}
                  selected={selectedSpace?.id === space.id}
                  current={displayBoardPlayers.find((player) => player.id === state.currentPlayerId)?.position === space.index}
                  onSelect={setSelectedSpaceId}
                  showTokens={false}
                  cameraTarget={cameraFocus?.spaceIndex === space.index}
                  tokenStyles={tokenStylesById}
                />
              ))}

              <TokenOverlay players={displayBoardPlayers.filter((player) => !player.bankrupt)} currentPlayerId={state.currentPlayerId} tokenStyles={tokenStylesById} />

              <div className={cx("monopoly-center", cinematic?.phase === "dice" && "de-emphasized", cinematic?.phase === "move" && "board-live", cinematic?.phase === "settle" && "board-live")}>
                <div className="monopoly-center-stack">
                  <div className={cx("monopoly-callout monopoly-center-callout", prompt?.tone && `tone-${prompt.tone}`)}>
                    <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] truncate">
                      {cinematic?.phase === "dice" ? "Lanzamiento en curso" : cinematic?.phase === "move" ? "Recorrido de ficha" : cinematic?.phase === "settle" ? "Casilla de destino" : prompt?.eyebrow}
                    </p>
                    <h2 className="mt-1 text-xl font-black uppercase leading-tight line-clamp-2">
                      {cinematic?.phase === "dice"
                        ? `${playersById.get(cinematic.playerId)?.name || "Jugador"} está lanzando`
                        : cinematic?.phase === "move"
                          ? "La ficha avanza paso a paso"
                          : cinematic?.phase === "settle"
                            ? "Preparando la resolución"
                            : prompt?.title}
                    </h2>
                  </div>

                  <div className="monopoly-center-board-block">
                    <div className="monopoly-logo monopoly-logo-sm">MONOPOLY</div>
                    <div className="monopoly-center-stats-row">
                      <div className="monopoly-center-stat">
                        <Wallet size={16} />
                        <div className="min-w-0">
                          <p>Efectivo</p>
                          <Money amount={myPlayer?.cash || 0} className="block text-sm font-black text-[#14532d] truncate" />
                        </div>
                      </div>
                      <div className="monopoly-center-stat">
                        <Crown size={16} />
                        <div className="min-w-0">
                          <p>Líder</p>
                          <span className="block text-sm font-black text-[#23160c] truncate">{state.ranking[0]?.name || "-"}</span>
                        </div>
                      </div>
                      <div className="monopoly-center-stat">
                        <Dice5 size={16} />
                        <div className="min-w-0">
                          <p>Turno</p>
                          <span className="block text-sm font-black text-[#23160c] truncate">{currentPlayer?.name || "-"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="monopoly-center-action">
                    {mainQuickAction ? (
                      <ActionButton onClick={() => act(mainQuickAction.action)} className="min-w-[220px]">
                        <Sparkles size={18} />
                        {mainQuickAction.label}
                      </ActionButton>
                    ) : (
                      <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38] opacity-70">
                        {phaseLabel[state.turn.phase] || ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            </div>
            </div>

            <div className="monopoly-status-strip">
              <TurnAssist
                currentPlayer={currentPlayer}
                isMyTurn={state.currentPlayerId === currentUserId}
                phase={state.turn.phase}
                modalState={activeModal}
                myActions={myActions}
                onAction={act}
              />
              <DiceStage
                rolling={rollingDice}
                dice={diceFaces}
                playerName={playersById.get(cinematic?.playerId || state.currentPlayerId)?.name || currentPlayer?.name}
                total={state.turn.lastRoll?.total || diceFaces[0] + diceFaces[1]}
                cinematicActive={cinematic?.phase === "dice"}
              />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="grid gap-5">
              <section className="monopoly-panel p-5">
                <div className="mb-4 flex items-center gap-3">
                  <Users size={20} className="text-[#0f766e]" />
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Jugadores</p>
                    <h3 className="text-2xl font-black uppercase text-[#23160c]">Mesa activa</h3>
                  </div>
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                  {state.players.map((player, index) => (
                    <PlayerStandee
                      key={player.id}
                      player={player}
                      index={index}
                      isCurrent={player.id === state.currentPlayerId}
                      isMe={player.id === currentUserId}
                      tokenStyle={tokenStylesById[player.id] || resolveTokenStyle({ ...player, colorIndex: index }, customTokens)}
                    />
                  ))}
                </div>
              </section>

              <SelectedSpaceCard
                space={selectedSpace}
                owner={selectedOwner}
                visitors={selectedVisitors}
                ownerProperty={selectedOwnerProperty}
                managementOptions={selectedOwnerProperty?.management || null}
                isOwnedByMe={selectedOwner?.id === currentUserId}
                onManage={(action, propertyId) => act(action, { propertyId })}
              />

              <EventFeed events={state.recentEvents || []} playersById={playersById} boardById={boardById} />
            </div>

            <aside className="grid gap-4">
              {myPlayer && (
                <section className="monopoly-panel p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <Building2 size={20} className="text-[#0f766e]" />
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Propiedades</p>
                      <h3 className="text-2xl font-black uppercase text-[#23160c]">Tus activos</h3>
                    </div>
                  </div>

                  <div className="grid gap-3">
                    {myPlayer.properties.length === 0 ? (
                      <div className="rounded-[20px] border-2 border-dashed border-[#d3c2a4] bg-[#fff8ec] px-4 py-5 text-sm font-semibold text-[#7c5d38]">
                        Todavia no controlas ninguna propiedad.
                      </div>
                    ) : (
                      myPlayer.properties.map((property) => {
                        const group = colorGroupMeta[property.colorGroup];
                        return (
                          <button
                            key={property.id}
                            type="button"
                            className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4 text-left transition hover:border-[#bfa57f]"
                            onClick={() => setSelectedSpaceId(property.id)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black uppercase text-[#23160c]">{property.name}</p>
                                <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#7c5d38]">
                                  {group?.label || property.type}
                                </p>
                              </div>
                              {group ? (
                                <span className="h-5 w-12 rounded-full border border-black/15" style={{ backgroundColor: group.color }} />
                              ) : (
                                <span className="monopoly-chip bg-[#ece3cf] text-[#23160c]">{property.type}</span>
                              )}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <span className="monopoly-chip bg-[#e7f6ed] text-[#14532d]">
                                <Money amount={property.price} />
                              </span>
                              {property.houses > 0 && <span className="monopoly-chip bg-[#d9f8e8] text-[#14532d]">{property.houses} casas</span>}
                              {property.hasHotel && <span className="monopoly-chip bg-[#fce7f3] text-[#831843]">Hotel</span>}
                              {property.isMortgaged && <span className="monopoly-chip bg-[#4b5563] text-white">Hipotecada</span>}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              )}
            </aside>
          </div>
        </div>

        <aside className="monopoly-action-rail">
          <section className="monopoly-panel monopoly-action-panel p-4">
            <div className="mb-4 flex items-center gap-3">
              <Sparkles size={20} className="text-[#b02016]" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Control</p>
                <h3 className="text-xl font-black uppercase text-[#23160c]">Acciones del turno</h3>
              </div>
            </div>

            <div className="monopoly-action-stack">
              {myActions.includes("tirarDados") && (
                <ActionButton onClick={() => act("tirarDados")} tooltip="Lanza dos dados. Si sacas dobles, normalmente juegas otra vez; tres dobles seguidos te mandan a la carcel.">
                  <Dice5 size={18} />
                  {actionLabel.tirarDados}
                </ActionButton>
              )}

              {pendingPurchaseSpace && myActions.includes("comprarPropiedad") && (
                <div className="rounded-[22px] border-2 border-[#86c9b2] bg-[#edf9f3] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#0f766e]">Compra pendiente</p>
                  <p className="mt-2 text-lg font-black uppercase text-[#23160c]">{pendingPurchaseSpace.name}</p>
                  <p className="mt-1 text-sm font-semibold text-[#6b4b2c]">
                    Precio de compra: {moneyFormatter.format(pendingPurchaseSpace.price || 0)}
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <ActionButton onClick={() => act("comprarPropiedad")} tooltip="Pagas el precio impreso y la propiedad pasa a tu inventario.">Comprar</ActionButton>
                    <ActionButton tone="danger" onClick={() => act("rechazarCompra")} tooltip="Si no compras, el banco abre una subasta para toda la mesa.">Subastar</ActionButton>
                  </div>
                </div>
              )}

              {pendingCard && myActions.includes("resolverCarta") && (
                <ActionButton onClick={() => act("resolverCarta")} tooltip="Aplica el efecto completo de la carta y deja que el motor resuelva su consecuencia.">
                  <Receipt size={18} />
                  Resolver carta
                </ActionButton>
              )}

              {myActions.includes("pagarRenta") && (
                <ActionButton tone="secondary" onClick={() => act("pagarRenta")} tooltip="Confirma el cobro de renta correspondiente a la casilla donde cayo el rival.">
                  <Wallet size={18} />
                  Cobrar renta
                </ActionButton>
              )}

              {pendingTax && myActions.includes("pagarImpuesto") && (
                <div className="rounded-[22px] border-2 border-[#e7c98f] bg-[#fff4dc] p-4">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#8a5a00]">Impuesto pendiente</p>
                  <div className="mt-4 grid gap-2">
                    <ActionButton tone="secondary" onClick={() => act("pagarImpuesto", { opcion: "FIXED" })} tooltip="Pagas la cuota fija indicada por la casilla de impuesto.">
                      Pagar fijo - {moneyFormatter.format(pendingTax.fixedAmount)}
                    </ActionButton>
                    <ActionButton tone="secondary" onClick={() => act("pagarImpuesto", { opcion: "PERCENT" })} tooltip="Pagas el porcentaje sobre tu patrimonio calculado por el motor.">
                      Pagar patrimonio - {moneyFormatter.format(pendingTax.percentAmount)}
                    </ActionButton>
                  </div>
                </div>
              )}

              {auction && (
                <div className="rounded-[22px] border-2 border-[#d8a5a0] bg-[#fff1ef] p-4">
                  <div className="flex items-center gap-2">
                    <Gavel size={18} className="text-[#b02016]" />
                    <p className="text-sm font-black uppercase text-[#23160c]">Subasta abierta</p>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[#6b4b2c]">
                    Turno de {playersById.get(auction.activeBidderId)?.name || "-"} - actual {moneyFormatter.format(auction.currentBid || 0)}
                  </p>
                  {(canBidAuction || canPassAuction) && (
                    <div className="mt-4 grid gap-2">
                      {canBidAuction && (
                        <>
                          <input
                            className="monopoly-input"
                            type="number"
                            min={(auction.currentBid || 0) + 1}
                            value={bidAmount}
                            onChange={(event) => setBidAmount(Number(event.target.value))}
                          />
                          <ActionButton onClick={() => act("hacerOferta", { monto: bidAmount })} tooltip="Ofreces una cantidad mayor a la puja actual, siempre que tengas ese efectivo.">
                            <Gavel size={18} />
                            Ofertar
                          </ActionButton>
                        </>
                      )}
                      {canPassAuction && (
                        <ActionButton tone="danger" onClick={() => act("retirarseDeSubasta")} tooltip="Te retiras de la subasta y dejas de competir por esta propiedad.">
                          Pasar
                        </ActionButton>
                      )}
                    </div>
                  )}
                </div>
              )}

              {myActions.includes("usarCartaSalirCarcel") && (
                <ActionButton tone="secondary" onClick={() => act("usarCartaSalirCarcel")} tooltip="Gastas una carta para salir de la carcel sin pagar multa.">
                  <ShieldAlert size={18} />
                  {actionLabel.usarCartaSalirCarcel}
                </ActionButton>
              )}

              {myActions.includes("pagarMultaCarcel") && (
                <ActionButton tone="secondary" onClick={() => act("pagarMultaCarcel")} tooltip="Pagas $50 al banco para salir de la carcel y continuar tu turno normal.">
                  <PauseCircle size={18} />
                  {actionLabel.pagarMultaCarcel}
                </ActionButton>
              )}

              {myActions.includes("resolverDeudaPendiente") && pendingDebt && (
                <ActionButton onClick={() => act("resolverDeudaPendiente")} tooltip="Paga la deuda abierta solo cuando ya reuniste el efectivo suficiente.">
                  <Hammer size={18} />
                  Pagar deuda - {moneyFormatter.format(pendingDebt.amount)}
                </ActionButton>
              )}

              {myActions.includes("terminarTurno") && (
                <ActionButton onClick={() => act("terminarTurno")} tooltip="Cierra tu turno actual. Si habias sacado dobles, el motor te dara la repeticion correspondiente.">
                  <TimerReset size={18} />
                  {actionLabel.terminarTurno}
                </ActionButton>
              )}

              {myActions.includes("resolverQuiebra") && (
                <ActionButton tone="danger" onClick={() => act("resolverQuiebra")} tooltip="Declara que no puedes cubrir la deuda ni liquidando activos; el motor resuelve la quiebra.">
                  <AlertTriangle size={18} />
                  Declarar quiebra
                </ActionButton>
              )}
            </div>
          </section>

          <section className="monopoly-panel p-4">
            <div className="mb-4 flex items-center gap-3">
              <Info size={20} className="text-[#8a5a00]" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Ayuda</p>
                  <h3 className="text-xl font-black uppercase text-[#23160c]">Reglas de esta mesa</h3>
              </div>
            </div>

            <div className="grid gap-3">
              {ruleCards.map((rule) => (
                <div key={rule.title} className="rounded-[18px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4" title={rule.body}>
                  <p className="text-sm font-black uppercase text-[#23160c]">{rule.title}</p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[#6b4b2c]">{rule.body}</p>
                </div>
              ))}
            </div>
          </section>

          {myPlayer && (
            <section className="monopoly-panel p-4">
              <div className="mb-4 flex items-center gap-3">
                <Scale size={20} className="text-[#0f766e]" />
                <div>
                  <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Gestion</p>
                  <h3 className="text-xl font-black uppercase text-[#23160c]">Negocios</h3>
                </div>
              </div>

              <div className="grid gap-4">
                <details className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] p-4" open>
                  <summary className="cursor-pointer list-none text-sm font-black uppercase text-[#23160c]">
                    Transferir propiedad
                  </summary>
                  <div className="mt-4 grid gap-3">
                    <select
                      className="monopoly-input"
                      value={propertyTrade.propertyId}
                      onChange={(event) => setPropertyTrade((current) => ({ ...current, propertyId: event.target.value }))}
                    >
                      <option value="">Selecciona propiedad</option>
                      {myPlayer.properties.map((property) => (
                        <option key={property.id} value={property.id}>{property.name}</option>
                      ))}
                    </select>
                    <select
                      className="monopoly-input"
                      value={propertyTrade.buyerId}
                      onChange={(event) => setPropertyTrade((current) => ({ ...current, buyerId: event.target.value }))}
                    >
                      <option value="">Comprador</option>
                      {state.players.filter((player) => player.id !== currentUserId && !player.bankrupt).map((player) => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                    <input
                      className="monopoly-input"
                      type="number"
                      min={0}
                      value={propertyTrade.price}
                      onChange={(event) => setPropertyTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                    />
                    <label className="flex items-center gap-3 rounded-[16px] border border-[#d8c8ae] bg-white/70 px-3 py-3 text-sm font-semibold text-[#6b4b2c]">
                      <input
                        type="checkbox"
                        checked={propertyTrade.liftMortgage}
                        onChange={(event) => setPropertyTrade((current) => ({ ...current, liftMortgage: event.target.checked }))}
                      />
                      Levantar hipoteca al transferir
                    </label>
                    <ActionButton
                      tone="secondary"
                      onClick={() => act("venderPropiedad", {
                        compradorId: Number(propertyTrade.buyerId),
                        propiedadId: propertyTrade.propertyId,
                        precio: Number(propertyTrade.price),
                        levantarHipotecaAhora: propertyTrade.liftMortgage
                      })}
                      disabled={!propertyTrade.propertyId || !propertyTrade.buyerId}
                    >
                      Transferir propiedad
                    </ActionButton>
                  </div>
                </details>

                <details className="rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] p-4">
                  <summary className="cursor-pointer list-none text-sm font-black uppercase text-[#23160c]">
                    Vender carta de salir de carcel
                  </summary>
                  <div className="mt-4 grid gap-3">
                    <select
                      className="monopoly-input"
                      value={cardTrade.deck}
                      onChange={(event) => setCardTrade((current) => ({ ...current, deck: event.target.value }))}
                    >
                      <option value="CASUALIDAD">Casualidad</option>
                      <option value="ARCA_COMUNAL">Arca comunal</option>
                    </select>
                    <select
                      className="monopoly-input"
                      value={cardTrade.buyerId}
                      onChange={(event) => setCardTrade((current) => ({ ...current, buyerId: event.target.value }))}
                    >
                      <option value="">Comprador</option>
                      {state.players.filter((player) => player.id !== currentUserId && !player.bankrupt).map((player) => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                    <input
                      className="monopoly-input"
                      type="number"
                      min={0}
                      value={cardTrade.price}
                      onChange={(event) => setCardTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                    />
                    <ActionButton
                      tone="secondary"
                      onClick={() => act("comprarCartaSalirCarcel", {
                        compradorId: Number(cardTrade.buyerId),
                        deck: cardTrade.deck,
                        precio: Number(cardTrade.price)
                      })}
                      disabled={!cardTrade.buyerId}
                    >
                      Vender carta
                    </ActionButton>
                  </div>
                </details>
              </div>
            </section>
          )}

          <section className="monopoly-panel p-5">
            <div className="mb-4 flex items-center gap-3">
              <Trophy size={20} className="text-[#c08a1a]" />
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#7c5d38]">Ranking</p>
                <h3 className="text-2xl font-black uppercase text-[#23160c]">Fortunas</h3>
              </div>
            </div>

            <div className="grid gap-3">
              {state.ranking.map((entry, index) => (
                <div key={entry.playerId} className="flex items-center justify-between rounded-[20px] border border-[#d8c8ae] bg-[#fff8ec] px-4 py-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black uppercase text-[#23160c]">{index + 1}. {entry.name}</p>
                    <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.14em] text-[#7c5d38]">Patrimonio</p>
                  </div>
                  <Money amount={entry.wealth} className="text-sm font-black text-[#14532d]" />
                </div>
              ))}
            </div>
          </section>

          {error && (
            <div className="rounded-[20px] border-2 border-[#b91c1c] bg-[#fee2e2] px-4 py-4 text-sm font-bold text-[#7f1d1d]">
              {error}
            </div>
          )}

          <MonopolySocialRail
            connectionStatus={connectionStatus}
            currentUser={currentUser}
            messages={messages}
            players={presence}
            onSendMessage={onSendMessage}
            customTokens={customTokens}
          />
        </aside>
      </div>

      <ActionModal
        modalState={activeModal}
        myActions={myActions}
        currentUserId={currentUserId}
        state={state}
        playersById={playersById}
        boardById={boardById}
        onAction={act}
        onClose={() => setModalDismissKey(modalKey)}
      />

      <TokenCustomizer
        open={tokenEditorOpen}
        onClose={() => setTokenEditorOpen(false)}
        currentPlayer={myPlayer}
        currentTokenStyle={myTokenStyle}
        onChange={persistMyToken}
        onReset={resetMyToken}
      />
    </section>
  );
}
