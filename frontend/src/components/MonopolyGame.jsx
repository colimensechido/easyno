import {
  AlertTriangle,
  Bot,
  Building2,
  Bug,
  Chrome,
  Code2,
  Coffee,
  Info,
  Crown,
  Cpu,
  Dice5,
  DoorOpen,
  Gem,
  Gavel,
  Github,
  Globe,
  Hammer,
  Landmark,
  Lightbulb,
  Lock,
  LogIn,
  LogOut,
  Map as MapIcon,
  MessageCircle,
  PauseCircle,
  PlayCircle,
  PlusCircle,
  Receipt,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Pizza,
  Rocket,
  Skull,
  Star,
  TimerReset,
  TrainFront,
  Trophy,
  Users,
  Wallet,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
// Lobby rediseñado: pantalla principal inmersiva + flujos Unirse/Crear.
import { audio } from "../audio";
import { Dice } from "./shared";

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
  brown: { label: "Bolivia", shortLabel: "BOL", color: "#7a4b2a", accent: "#b46d3a" },
  light_blue: { label: "Ecuador", shortLabel: "ECU", color: "#7cd4e8", accent: "#2c9ec7" },
  pink: { label: "Peru", shortLabel: "PER", color: "#d95db4", accent: "#a82a82" },
  orange: { label: "Chile", shortLabel: "CHL", color: "#eb8f2d", accent: "#b76000" },
  red: { label: "Argentina", shortLabel: "ARG", color: "#d4473b", accent: "#a42014" },
  yellow: { label: "Colombia", shortLabel: "COL", color: "#f0d24f", accent: "#b7940b" },
  green: { label: "Brasil", shortLabel: "BRA", color: "#30a44a", accent: "#1a6d2c" },
  dark_blue: { label: "Mexico", shortLabel: "MEX", color: "#274fae", accent: "#163478" }
};

const tokenPalette = [
  { bg: "#d94841", ring: "#7c1510" },
  { bg: "#2f7ef0", ring: "#163b78" },
  { bg: "#20a56d", ring: "#0d5b3d" },
  { bg: "#f0bc3f", ring: "#8a6206" },
  { bg: "#7a58d7", ring: "#47289b" },
  { bg: "#22252f", ring: "#090a0d" }
];

const tokenIconMap = {
  bot: Bot,
  bug: Bug,
  chrome: Chrome,
  code: Code2,
  coffee: Coffee,
  cpu: Cpu,
  dice: Dice5,
  gem: Gem,
  github: Github,
  pizza: Pizza,
  rocket: Rocket,
  skull: Skull,
  star: Star,
  trophy: Trophy
};

const tokenIconPresets = [
  { id: "github", label: "GitHub", copy: "merge lord" },
  { id: "chrome", label: "Google", copy: "RAM gratis" },
  { id: "bug", label: "Bug", copy: "feature raro" },
  { id: "bot", label: "Bot", copy: "modo IA" },
  { id: "code", label: "Code", copy: "semicolons" },
  { id: "cpu", label: "CPU", copy: "lag boss" },
  { id: "coffee", label: "Cafe", copy: "debug fuel" },
  { id: "pizza", label: "Pizza", copy: "deploy night" },
  { id: "rocket", label: "Rocket", copy: "to prod" },
  { id: "skull", label: "Skull", copy: "rip rentas" },
  { id: "gem", label: "Gem", copy: "premium" },
  { id: "star", label: "Star", copy: "main char" },
  { id: "dice", label: "Dice", copy: "RNG" },
  { id: "trophy", label: "Trophy", copy: "tryhard" }
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

const tokenColorChoices = [...new Set(tokenColorPresets.flatMap((color) => [color.bg, color.ring]))];
const tokenFigureColorChoices = ["#ffffff", "#23160c", ...tokenColorChoices.filter((color) => !["#ffffff", "#23160c"].includes(color))];

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
  const playerId = player?.id ?? player?.userId;
  const custom = customTokens?.[playerId] || player?.token;
  const label = custom?.label ?? initialLetters(player?.name ?? player?.username);
  const icon = custom?.icon && tokenIconMap[custom.icon] ? custom.icon : "";
  const bg = custom?.bg ?? palette.bg;
  const ring = custom?.ring ?? palette.ring;
  const fg = custom?.fg ?? "#ffffff";
  const shape = custom?.shape ?? "circle";
  const emoji = isEmojiToken(label);
  return { label, icon, bg, ring, fg, shape, emoji };
}

const previewBoard = [
  { index: 0, id: "go", name: "Salida", type: "SALIDA" },
  { index: 1, id: "mediterranean", name: "La Paz", shortName: "LPZ", type: "PROPIEDAD", colorGroup: "brown", price: 60 },
  { index: 2, id: "cc1", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 3, id: "baltic", name: "Sucre", shortName: "Sucre", type: "PROPIEDAD", colorGroup: "brown", price: 60 },
  { index: 4, id: "tax1", name: "Impuesto", type: "IMPUESTO" },
  { index: 5, id: "rr1", name: "Tren Maya", type: "FERROCARRIL", price: 200 },
  { index: 6, id: "oriental", name: "Quito", shortName: "Quito", type: "PROPIEDAD", colorGroup: "light_blue", price: 100 },
  { index: 7, id: "chance1", name: "Casualidad", type: "CASUALIDAD" },
  { index: 8, id: "vermont", name: "Cuenca", type: "PROPIEDAD", colorGroup: "light_blue", price: 100 },
  { index: 9, id: "connecticut", name: "Guayaquil", shortName: "GYE", type: "PROPIEDAD", colorGroup: "light_blue", price: 120 },
  { index: 10, id: "jail", name: "Carcel", type: "CARCEL_VISITA" },
  { index: 11, id: "stcharles", name: "Arequipa", shortName: "AQP", type: "PROPIEDAD", colorGroup: "pink", price: 140 },
  { index: 12, id: "electric", name: "Red Andina", type: "SERVICIO_PUBLICO", price: 150 },
  { index: 13, id: "states", name: "Cusco", type: "PROPIEDAD", colorGroup: "pink", price: 140 },
  { index: 14, id: "virginia", name: "Lima", type: "PROPIEDAD", colorGroup: "pink", price: 160 },
  { index: 15, id: "rr2", name: "Tren Pacífico", type: "FERROCARRIL", price: 200 },
  { index: 16, id: "stjames", name: "Valparaiso", shortName: "Valpo", type: "PROPIEDAD", colorGroup: "orange", price: 180 },
  { index: 17, id: "cc2", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 18, id: "tennessee", name: "Concepcion", shortName: "CCP", type: "PROPIEDAD", colorGroup: "orange", price: 180 },
  { index: 19, id: "newyork", name: "Santiago", shortName: "STGO", type: "PROPIEDAD", colorGroup: "orange", price: 200 },
  { index: 20, id: "free", name: "Libre", type: "PARADA_LIBRE" },
  { index: 21, id: "kentucky", name: "Rosario", shortName: "ROS", type: "PROPIEDAD", colorGroup: "red", price: 220 },
  { index: 22, id: "chance2", name: "Casualidad", type: "CASUALIDAD" },
  { index: 23, id: "indiana", name: "Cordoba", shortName: "CBA", type: "PROPIEDAD", colorGroup: "red", price: 220 },
  { index: 24, id: "illinois", name: "Buenos Aires", shortName: "BSAS", type: "PROPIEDAD", colorGroup: "red", price: 240 },
  { index: 25, id: "rr3", name: "Tren Pampa", type: "FERROCARRIL", price: 200 },
  { index: 26, id: "atlantic", name: "Cali", shortName: "Cali", type: "PROPIEDAD", colorGroup: "yellow", price: 260 },
  { index: 27, id: "ventnor", name: "Medellin", shortName: "MDE", type: "PROPIEDAD", colorGroup: "yellow", price: 260 },
  { index: 28, id: "water", name: "Aguas Caribe", type: "SERVICIO_PUBLICO", price: 150 },
  { index: 29, id: "marvin", name: "Bogota", shortName: "BOG", type: "PROPIEDAD", colorGroup: "yellow", price: 280 },
  { index: 30, id: "gotojail", name: "Ve a carcel", type: "VAYASE_A_LA_CARCEL" },
  { index: 31, id: "pacific", name: "Brasilia", shortName: "BSB", type: "PROPIEDAD", colorGroup: "green", price: 300 },
  { index: 32, id: "northcarolina", name: "Rio de Janeiro", shortName: "RIO", type: "PROPIEDAD", colorGroup: "green", price: 300 },
  { index: 33, id: "cc3", name: "Arca", type: "ARCA_COMUNAL" },
  { index: 34, id: "pennsylvania", name: "Sao Paulo", shortName: "SP", type: "PROPIEDAD", colorGroup: "green", price: 320 },
  { index: 35, id: "rr4", name: "Tren Austral", type: "FERROCARRIL", price: 200 },
  { index: 36, id: "chance3", name: "Casualidad", type: "CASUALIDAD" },
  { index: 37, id: "park", name: "Guadalajara", shortName: "GDL", type: "PROPIEDAD", colorGroup: "dark_blue", price: 350 },
  { index: 38, id: "tax2", name: "Lujo", type: "IMPUESTO" },
  { index: 39, id: "boardwalk", name: "Ciudad de Mexico", shortName: "CDMX", type: "PROPIEDAD", colorGroup: "dark_blue", price: 400 }
];

const boardShortNameById = {
  mediterranean_avenue: "LPZ",
  baltic_avenue: "Sucre",
  reading_railroad: "Tren Maya",
  oriental_avenue: "Quito",
  vermont_avenue: "Cuenca",
  connecticut_avenue: "GYE",
  st_charles_place: "AQP",
  electric_company: "Red Andina",
  states_avenue: "Cusco",
  virginia_avenue: "Lima",
  pennsylvania_railroad: "Tren PAC",
  st_james_place: "Valpo",
  tennessee_avenue: "CCP",
  new_york_avenue: "STGO",
  kentucky_avenue: "ROS",
  indiana_avenue: "CBA",
  illinois_avenue: "BSAS",
  bo_railroad: "Tren Pampa",
  atlantic_avenue: "Cali",
  ventnor_avenue: "MDE",
  water_works: "Aguas Caribe",
  marvin_gardens: "BOG",
  pacific_avenue: "BSB",
  north_carolina_avenue: "RIO",
  pennsylvania_avenue: "SP",
  short_line: "Tren Austral",
  park_place: "GDL",
  boardwalk: "CDMX"
};

const boardCountryCodeById = {
  mediterranean_avenue: "BOL",
  baltic_avenue: "BOL",
  oriental_avenue: "ECU",
  vermont_avenue: "ECU",
  connecticut_avenue: "ECU",
  st_charles_place: "PER",
  states_avenue: "PER",
  virginia_avenue: "PER",
  st_james_place: "CHL",
  tennessee_avenue: "CHL",
  new_york_avenue: "CHL",
  kentucky_avenue: "ARG",
  indiana_avenue: "ARG",
  illinois_avenue: "ARG",
  atlantic_avenue: "COL",
  ventnor_avenue: "COL",
  marvin_gardens: "COL",
  pacific_avenue: "BRA",
  north_carolina_avenue: "BRA",
  pennsylvania_avenue: "BRA",
  park_place: "MEX",
  boardwalk: "MEX"
};

function boardDisplayName(space) {
  switch (space?.type) {
    case "CASUALIDAD":
      return "Carta";
    case "ARCA_COMUNAL":
      return "Arca";
    case "IMPUESTO":
      return space?.id === "luxury_tax" ? "Imp. lujo" : "Imp. ingresos";
    case "CARCEL_VISITA":
      return "Carcel";
    case "VAYASE_A_LA_CARCEL":
      return "A carcel";
    case "PARADA_LIBRE":
      return "Libre";
    case "SALIDA":
      return "Salida";
    default:
      break;
  }
  return boardShortNameById[space?.id] || space?.shortName || space?.name || "";
}

function boardMetaLabel(space, owner) {
  if (space?.ownerId) return initialLetters(owner?.name || "Propietario");
  if (space?.colorGroup) return boardCountryCodeById[space.id] || colorGroupMeta[space.colorGroup]?.shortLabel || spaceTypeLabel(space);
  switch (space?.type) {
    case "FERROCARRIL":
      return "TREN";
    case "SERVICIO_PUBLICO":
      return "SERV.";
    case "IMPUESTO":
      return "IMP.";
    case "CASUALIDAD":
      return "CARTA";
    case "ARCA_COMUNAL":
      return "ARCA";
    case "CARCEL_VISITA":
      return "CARCEL";
    case "VAYASE_A_LA_CARCEL":
      return "CARCEL";
    case "PARADA_LIBRE":
      return "LIBRE";
    default:
      return spaceTypeLabel(space);
  }
}

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

function sameEntityId(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return String(left) === String(right);
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

const boardTokenColumnWeights = [1.5, ...Array(9).fill(0.9), 1.5];
const boardTokenRowWeights = [1.85, ...Array(9).fill(0.72), 1.85];

function trackCenterPercent(weights, index) {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const before = weights.slice(0, index).reduce((sum, weight) => sum + weight, 0);
  return ((before + weights[index] / 2) / total) * 100;
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
  const me = sameEntityId(state.currentPlayerId, currentUserId);

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
  const myTurn = sameEntityId(state.currentPlayerId, currentUserId);

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
  const Icon = tokenIconMap[tokenStyle.icon];

  return (
    <span
      className={cx(
        "monopoly-token",
        `shape-${tokenStyle.shape}`,
        Icon && "has-icon",
        tokenStyle.emoji && "emoji",
        className
      )}
      style={{ "--token-bg": tokenStyle.bg, "--token-ring": tokenStyle.ring, "--token-fg": tokenStyle.fg || "#ffffff", ...style }}
      title={title}
    >
      <span className="token-glyph">{Icon ? <Icon size="70%" strokeWidth={2.8} /> : tokenStyle.label}</span>
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
  const displayName = boardDisplayName(space);
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
        <div className="monopoly-space-head">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7c5d38]">
            {space.index}
          </span>
          <Icon size={cell.corner ? 16 : 12} className="shrink-0 text-[#3b2b18]" />
        </div>

        <div className="monopoly-space-copy">
          <p className="monopoly-space-name">{displayName}</p>
          <p className="monopoly-space-meta">
            {boardMetaLabel(space, owner)}
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
  const playersById = useMemo(() => {
    const map = new Map();
    sortedPlayers.forEach((player, index) => {
      map.set(String(player.userId), { player, index });
    });
    return map;
  }, [sortedPlayers]);

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
            const tokenStyle = resolveTokenStyle({ id: player.userId, name: player.username, colorIndex: index, token: player.token }, customTokens);
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
              const isMe = sameEntityId(message.userId, currentUser.id);
              const participant = playersById.get(String(message.userId));
              const tokenStyle = resolveTokenStyle({
                id: message.userId,
                name: message.username,
                colorIndex: participant?.index ?? 0,
                token: participant?.player?.token
              }, customTokens);
              return (
                <div key={message.id} className={cx("flex items-end gap-2", isMe && "justify-end")}>
                  {!isMe && <TokenChip tokenStyle={tokenStyle} className="h-8 w-8 shrink-0 text-[10px]" />}
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
                  {isMe && <TokenChip tokenStyle={tokenStyle} className="h-8 w-8 shrink-0 text-[10px]" />}
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

function TokenOverlay({ players, currentPlayerId, tokenStyles = {}, moverId = null, moverPhase = null }) {
  return (
    <div className="monopoly-token-overlay">
      {players.map((player) => {
        const cell = boardCell(player.position);
        const baseX = trackCenterPercent(boardTokenColumnWeights, cell.col);
        const baseY = trackCenterPercent(boardTokenRowWeights, cell.row);
        const sharedCellPlayers = players.filter((candidate) => candidate.position === player.position && !candidate.bankrupt);
        const localIndex = sharedCellPlayers.findIndex((candidate) => candidate.id === player.id);
        const shift = tokenTransformForIndex(localIndex, sharedCellPlayers.length);
        const tokenStyle = tokenStyles[player.id] || resolveTokenStyle(player, {});

        return (
          <div
            key={player.id}
            className={cx(
              "token-piece",
              player.id === currentPlayerId && "active",
              player.bankrupt && "bankrupt",
              player.id === moverId && moverPhase === "move" && "moving",
              player.id === moverId && moverPhase === "settle" && "landing"
            )}
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
  const isMyAuctionTurn = modalState.type === "auction" && sameEntityId(modalState.auction.activeBidderId, currentUserId);
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
      icon: draft.icon || "",
      bg: draft.bg,
      ring: draft.ring,
      fg: draft.fg || "#ffffff",
      shape: draft.shape
    });
    onClose();
  }

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info token-customizer-modal">
        <div className="token-customizer-head">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Personalización</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Tu ficha</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">
              {currentPlayer?.name ? `${currentPlayer.name}, elige cómo te ven en la mesa.` : "Elige cómo se verá tu ficha."}
            </p>
          </div>
          <button type="button" className="toast-close token-customizer-close" onClick={onClose} aria-label="Cerrar editor de ficha">
            <X size={16} />
          </button>
        </div>

        <div className="token-customizer-body">
          <aside className="token-preview-stage">
            <div className="token-preview-orbit">
              <TokenChip tokenStyle={{ ...draft, emoji: isEmojiToken(draft.label) }} className="token-preview-hero monopoly-token-large" />
            </div>
            <div className="token-preview-card">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-75">Vista previa</p>
              <p className="mt-1 text-xl font-black uppercase">{tokenIconPresets.find((icon) => icon.id === draft.icon)?.label || draft.label || "?"}</p>
              <p className="mt-1 text-xs font-semibold opacity-80">Figura: {tokenShapes.find((s) => s.id === draft.shape)?.label || draft.shape}</p>
              <div className="token-preview-swatches">
                <span style={{ background: draft.bg }} title="Interior" />
                <span style={{ background: draft.ring }} title="Exterior" />
                <span style={{ background: draft.fg || "#ffffff" }} title="Figura" />
              </div>
            </div>
          </aside>

          <section className="token-editor-column">
            <div className="token-editor-scroll">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Iniciales de respaldo</p>
                <input
                  className="monopoly-input mt-2"
                  value={draft.label}
                  maxLength={4}
                  onChange={(event) => update({ label: event.target.value.toUpperCase(), icon: "" })}
                  placeholder="Ej: JR, 404, CSS, GG"
                />
                <p className="mt-2 text-xs font-semibold opacity-80">Hasta 4 caracteres. Si eliges un icono, estas iniciales quedan como respaldo.</p>
              </div>

              <div className="mt-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Iconos de personalidad</p>
                <div className="token-customizer-grid mt-2">
                  {tokenIconPresets.map((preset) => {
                    const Icon = tokenIconMap[preset.id];
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        className={cx("token-option", draft.icon === preset.id && "active")}
                        onClick={() => update({ icon: preset.id, label: preset.label.slice(0, 4).toUpperCase() })}
                        title={`${preset.label} - ${preset.copy}`}
                      >
                        {Icon && <Icon size={18} />}
                        <span>{preset.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Figura</p>
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
                        tokenStyle={{ label: draft.label || "A", icon: draft.icon || "", bg: draft.bg, ring: draft.ring, fg: draft.fg || "#ffffff", shape: shape.id, emoji: isEmojiToken(draft.label) }}
                        className="h-9 w-9 text-xs"
                      />
                      <span className="ml-2 align-middle text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#23160c]">{shape.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Interior</p>
                <div className="token-color-row mt-2">
                  {tokenColorChoices.map((color) => (
                    <button
                      key={`bg-${color}`}
                      type="button"
                      className={cx("token-color-swatch", draft.bg === color && "active")}
                      style={{ background: color, borderColor: draft.bg === color ? "#0f766e" : "rgba(35,22,12,0.18)" }}
                      onClick={() => update({ bg: color })}
                      aria-label={`Color interior ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Exterior</p>
                <div className="token-color-row mt-2">
                  {tokenColorChoices.map((color) => (
                    <button
                      key={`ring-${color}`}
                      type="button"
                      className={cx("token-color-swatch token-color-ring", draft.ring === color && "active")}
                      style={{ background: color, borderColor: draft.ring === color ? "#0f766e" : color }}
                      onClick={() => update({ ring: color })}
                      aria-label={`Color exterior ${color}`}
                    />
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Color de figura</p>
                <div className="token-color-row mt-2">
                  {tokenFigureColorChoices.map((color) => (
                    <button
                      key={`fg-${color}`}
                      type="button"
                      className={cx("token-color-swatch token-color-glyph", (draft.fg || "#ffffff") === color && "active")}
                      style={{ background: color, borderColor: (draft.fg || "#ffffff") === color ? "#0f766e" : "rgba(35,22,12,0.18)" }}
                      onClick={() => update({ fg: color })}
                      aria-label={`Color de figura ${color}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="token-customizer-actions">
              <ActionButton onClick={applyAndClose}>Guardar ficha</ActionButton>
              <ActionButton tone="secondary" onClick={() => { onReset(); onClose(); }}>Restablecer</ActionButton>
              <ActionButton tone="secondary" onClick={onClose}>Cancelar</ActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function GameLayout({ children }) {
  return <section className="monopoly-game-layout">{children}</section>;
}

function TopHud({
  tableName,
  state,
  currentPlayer,
  myPlayer,
  myTokenStyle,
  turnCountdown,
  onToken,
  onRules,
  onMenu,
  onLeave,
  onSurrender,
  onCloseTable,
  canLeave,
  canSurrender,
  canCloseTable
}) {
  return (
    <header className="monopoly-top-hud">
      <div className="monopoly-hud-title">
        <div className="monopoly-logo monopoly-hud-logo">MONOPOLY</div>
        <div className="min-w-0">
          <p className="monopoly-hud-kicker">{tableName || "Mesa Monopoly"}</p>
          <h2>{currentPlayer?.name || "Partida"}</h2>
        </div>
      </div>

      <div className="monopoly-hud-stats">
        <div className="monopoly-hud-pill is-current">
          <TokenChip tokenStyle={myTokenStyle} className="h-8 w-8 text-xs" />
          <div>
            <span>Turno</span>
            <strong>{currentPlayer?.name || "-"}</strong>
          </div>
        </div>
        <div className="monopoly-hud-pill">
          <Wallet size={18} />
          <div>
            <span>Dinero</span>
            <strong><Money amount={myPlayer?.cash || 0} /></strong>
          </div>
        </div>
        <div className="monopoly-hud-pill">
          <Building2 size={18} />
          <div>
            <span>Props</span>
            <strong>{myPlayer?.properties?.length || 0}</strong>
          </div>
        </div>
        <div className="monopoly-hud-pill">
          <TimerReset size={18} />
          <div>
            <span>Reloj</span>
            <strong>{turnCountdown}</strong>
          </div>
        </div>
        <div className="monopoly-hud-pill">
          <Sparkles size={18} />
          <div>
            <span>Estado</span>
            <strong>{phaseLabel[state.turn.phase] || state.turn.phase}</strong>
          </div>
        </div>
      </div>

      <div className="monopoly-hud-actions">
        <button type="button" className="monopoly-icon-button" onClick={onToken} title="Personalizar ficha">
          <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
        </button>
        <button type="button" className="monopoly-icon-button" onClick={onRules} title="Reglas">
          <Info size={18} />
        </button>
        <button type="button" className="monopoly-icon-button" onClick={onMenu} title="Menu de mesa">
          <MapIcon size={18} />
        </button>
        <div className="monopoly-table-menu">
          <ActionButton tone="secondary" onClick={onLeave} disabled={!canLeave}>
            <DoorOpen size={16} />
            Salir
          </ActionButton>
          <ActionButton tone="danger" onClick={onSurrender} disabled={!canSurrender}>
            <AlertTriangle size={16} />
            Rendirse
          </ActionButton>
          {canCloseTable && (
            <ActionButton tone="secondary" onClick={onCloseTable}>
              <LogOut size={16} />
              Cerrar
            </ActionButton>
          )}
        </div>
      </div>
    </header>
  );
}

function BoardArea({
  board,
  selectedSpace,
  coloredPlayersById,
  playersById,
  displayBoardPlayers,
  state,
  tokenStylesById,
  cameraFocus,
  cinematic,
  prompt,
  diceFaces,
  rollingDice,
  myPlayer,
  isMyTurn,
  myActions,
  pendingPurchaseSpace,
  pendingTax,
  pendingDebt,
  pendingCard,
  auction,
  bidAmount,
  setBidAmount,
  canBidAuction,
  canPassAuction,
  onAction,
  onSelect
}) {
  const locked = rollingDice || Boolean(cinematic);

  return (
    <section className="monopoly-board-area" aria-label="Tablero de Monopoly">
      <div className="monopoly-table-shell monopoly-board-shell-main monopoly-board-stage">
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
                onSelect={onSelect}
                showTokens={false}
                cameraTarget={cameraFocus?.spaceIndex === space.index}
                tokenStyles={tokenStylesById}
              />
            ))}

            <TokenOverlay
              players={displayBoardPlayers.filter((player) => !player.bankrupt)}
              currentPlayerId={state.currentPlayerId}
              tokenStyles={tokenStylesById}
              moverId={cinematic?.playerId}
              moverPhase={cinematic?.phase}
            />

            <div className={cx("monopoly-center", cinematic?.phase === "dice" && "de-emphasized", cinematic?.phase === "move" && "board-live", cinematic?.phase === "settle" && "board-live")}>
              <div className="monopoly-board-core">
                <div className={cx("monopoly-callout monopoly-center-callout", prompt?.tone && `tone-${prompt.tone}`)}>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] truncate">
                    {cinematic?.phase === "dice" ? "Dados en mesa" : cinematic?.phase === "move" ? "Ficha en movimiento" : cinematic?.phase === "settle" ? "Casilla enfocada" : prompt?.eyebrow}
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase leading-tight line-clamp-2">
                    {cinematic?.phase === "dice"
                      ? `${playersById.get(cinematic.playerId)?.name || "Jugador"} esta lanzando`
                      : cinematic?.phase === "move"
                        ? "La ficha avanza casilla por casilla"
                        : cinematic?.phase === "settle"
                          ? "Resolviendo la casilla"
                          : prompt?.title}
                  </h2>
                </div>

                <div className="monopoly-board-dice-lockup">
                  <div className="monopoly-center-dice" aria-live="polite">
                    <Dice value={diceFaces[0]} rolling={rollingDice} size={64} />
                    <Dice value={diceFaces[1]} rolling={rollingDice} size={64} />
                  </div>
                  <p className="monopoly-center-dice-total">
                    {rollingDice || cinematic
                      ? "Lanzando dados..."
                      : state.turn.lastRoll
                        ? `Total ${state.turn.lastRoll.total}`
                        : "Listo para tirar"}
                  </p>
                  <div className="monopoly-logo monopoly-logo-sm">MONOPOLY</div>
                </div>

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
                      <p>Lider</p>
                      <span className="block text-sm font-black text-[#23160c] truncate">{state.ranking[0]?.name || "-"}</span>
                    </div>
                  </div>
                  <div className="monopoly-center-stat">
                    <Dice5 size={16} />
                    <div className="min-w-0">
                      <p>Turno</p>
                      <span className="block text-sm font-black text-[#23160c] truncate">{state.turn.turnNumber}</span>
                    </div>
                  </div>
                </div>

                <BoardCenterActions
                  locked={locked}
                  isMyTurn={isMyTurn}
                  myActions={myActions}
                  pendingPurchaseSpace={pendingPurchaseSpace}
                  pendingTax={pendingTax}
                  pendingDebt={pendingDebt}
                  pendingCard={pendingCard}
                  auction={auction}
                  playersById={playersById}
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  canBidAuction={canBidAuction}
                  canPassAuction={canPassAuction}
                  onAction={onAction}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function VictoryCeremony({ state, playersById, currentUserId, onExit }) {
  if (!state?.winnerId) return null;

  const winner = playersById.get(state.winnerId);
  const isWinner = sameEntityId(state.winnerId, currentUserId);
  const podium = (state.ranking || []).slice(0, 3);

  return (
    <div className="monopoly-victory-overlay" role="dialog" aria-modal="true" aria-label="Resultado de la partida">
      <section className={cx("monopoly-victory-card", isWinner ? "is-winner" : "is-defeat")}>
        <div className="monopoly-victory-crown">
          {isWinner ? <Crown size={42} /> : <Trophy size={42} />}
        </div>
        <p className="monopoly-victory-kicker">{isWinner ? "Victoria total" : "Partida terminada"}</p>
        <h2>{winner?.name || "Jugador"} domina el tablero</h2>
        <p className="monopoly-victory-copy">
          {isWinner
            ? "Tus rivales quedaron fuera y el tablero queda bajo tu control."
            : "La mesa se cerro y el resultado final ya esta registrado."}
        </p>

        <div className="monopoly-victory-podium">
          {podium.map((entry, index) => (
            <article key={entry.playerId} className={cx(index === 0 && "champion")}>
              <span>{index + 1}</span>
              <strong>{entry.name}</strong>
              <Money amount={entry.wealth} />
            </article>
          ))}
        </div>

        <button type="button" className="monopoly-menu-button primary compact" onClick={onExit}>
          <DoorOpen size={18} /> Volver al lobby
        </button>
      </section>
    </div>
  );
}

function BoardCenterActions({
  locked,
  isMyTurn,
  myActions,
  pendingPurchaseSpace,
  pendingTax,
  pendingDebt,
  pendingCard,
  auction,
  playersById,
  bidAmount,
  setBidAmount,
  canBidAuction,
  canPassAuction,
  onAction
}) {
  const canAct = isMyTurn && myActions.length > 0;

  if (locked) {
    return (
      <div className="monopoly-center-action-zone is-locked">
        <span>Animacion en curso</span>
      </div>
    );
  }

  if (!canAct && !auction) {
    return (
      <div className="monopoly-center-action-zone is-passive">
        <span>{isMyTurn ? "Esperando resolucion" : "Observando turno rival"}</span>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("tirarDados")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => onAction("tirarDados")}>
          <Dice5 size={22} />
          Tirar dados
        </ActionButton>
      </div>
    );
  }

  if (pendingPurchaseSpace && isMyTurn && myActions.includes("comprarPropiedad")) {
    return (
      <div className="monopoly-center-action-zone is-decision">
        <div className="monopoly-board-decision-copy">
          <span>Propiedad disponible</span>
          <strong>{pendingPurchaseSpace.name}</strong>
          <em>{moneyFormatter.format(pendingPurchaseSpace.price || 0)}</em>
        </div>
        <div className="monopoly-board-action-row">
          <ActionButton onClick={() => onAction("comprarPropiedad")}>Comprar</ActionButton>
          <ActionButton tone="danger" onClick={() => onAction("rechazarCompra")}>Subastar</ActionButton>
        </div>
      </div>
    );
  }

  if (pendingCard && isMyTurn && myActions.includes("resolverCarta")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => onAction("resolverCarta")}>
          <Receipt size={20} />
          Tomar carta
        </ActionButton>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("pagarRenta")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" tone="secondary" onClick={() => onAction("pagarRenta")}>
          <Wallet size={22} />
          Pagar renta
        </ActionButton>
      </div>
    );
  }

  if (pendingTax && isMyTurn && myActions.includes("pagarImpuesto")) {
    return (
      <div className="monopoly-center-action-zone is-decision">
        <div className="monopoly-board-decision-copy">
          <span>Impuesto</span>
          <strong>Elige pago</strong>
        </div>
        <div className="monopoly-board-action-row">
          <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto", { opcion: "FIXED" })}>
            Fijo {moneyFormatter.format(pendingTax.fixedAmount)}
          </ActionButton>
          <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto", { opcion: "PERCENT" })}>
            Patrimonio {moneyFormatter.format(pendingTax.percentAmount)}
          </ActionButton>
        </div>
      </div>
    );
  }

  if (auction) {
    return (
      <div className="monopoly-center-action-zone is-decision">
        <div className="monopoly-board-decision-copy">
          <span>Subasta</span>
          <strong>{playersById.get(auction.activeBidderId)?.name || "Jugador"}</strong>
          <em>{moneyFormatter.format(auction.currentBid || 0)}</em>
        </div>
        {(canBidAuction || canPassAuction) && (
          <div className="monopoly-board-auction-row">
            {canBidAuction && (
              <>
                <input
                  className="monopoly-input"
                  type="number"
                  min={(auction.currentBid || 0) + 1}
                  value={bidAmount}
                  onChange={(event) => setBidAmount(Number(event.target.value))}
                />
                <ActionButton onClick={() => onAction("hacerOferta", { monto: bidAmount })}>Ofertar</ActionButton>
              </>
            )}
            {canPassAuction && <ActionButton tone="danger" onClick={() => onAction("retirarseDeSubasta")}>Pasar</ActionButton>}
          </div>
        )}
      </div>
    );
  }

  if (isMyTurn && myActions.includes("pagarMultaCarcel")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" tone="secondary" onClick={() => onAction("pagarMultaCarcel")}>
          Pagar multa
        </ActionButton>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("usarCartaSalirCarcel")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" tone="secondary" onClick={() => onAction("usarCartaSalirCarcel")}>
          Usar carta
        </ActionButton>
      </div>
    );
  }

  if (pendingDebt && isMyTurn && myActions.includes("resolverDeudaPendiente")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => onAction("resolverDeudaPendiente")}>
          Pagar deuda
        </ActionButton>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("terminarTurno")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => onAction("terminarTurno")}>
          <TimerReset size={22} />
          Terminar turno
        </ActionButton>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("resolverQuiebra")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" tone="danger" onClick={() => onAction("resolverQuiebra")}>
          Declarar quiebra
        </ActionButton>
      </div>
    );
  }

  return (
    <div className="monopoly-center-action-zone is-passive">
      <span>Esperando mesa</span>
    </div>
  );
}

function TurnActionPanel({
  state,
  currentPlayer,
  isMyTurn,
  prompt,
  myActions,
  pendingPurchaseSpace,
  pendingTax,
  pendingDebt,
  pendingCard,
  auction,
  playersById,
  bidAmount,
  setBidAmount,
  canBidAuction,
  canPassAuction,
  onAction,
  onOpenRanking,
  onOpenTrade
}) {
  const canAct = isMyTurn && myActions.length > 0;

  return (
    <aside className="monopoly-turn-panel">
      <div className={cx("monopoly-turn-card", prompt?.tone && `tone-${prompt.tone}`)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="monopoly-panel-eyebrow">{prompt?.eyebrow || "Turno"}</p>
            <h3>{prompt?.title || "Esperando accion"}</h3>
            <p>{prompt?.body || "La mesa esta lista."}</p>
          </div>
          <span className={cx("monopoly-chip", isMyTurn ? "bg-[#0f766e] text-white" : "bg-[#ece3cf] text-[#23160c]")}>
            {isMyTurn ? "Tu turno" : currentPlayer?.name || "Mesa"}
          </span>
        </div>
      </div>

      {rollingContextLabel(state.turn.phase, isMyTurn, canAct) && (
        <div className="monopoly-step-hint">
          <Sparkles size={18} />
          <span>{rollingContextLabel(state.turn.phase, isMyTurn, canAct)}</span>
        </div>
      )}

      <div className="monopoly-context-actions">
        {isMyTurn && myActions.includes("tirarDados") && (
          <ActionButton className="monopoly-main-turn-button" onClick={() => onAction("tirarDados")}>
            <Dice5 size={22} />
            Tirar dados
          </ActionButton>
        )}

        {pendingPurchaseSpace && isMyTurn && myActions.includes("comprarPropiedad") && (
          <div className="monopoly-context-box is-buy">
            <p className="monopoly-panel-eyebrow">Propiedad disponible</p>
            <h4>{pendingPurchaseSpace.name}</h4>
            <div className="monopoly-mini-stats">
              <span>Precio <strong>{moneyFormatter.format(pendingPurchaseSpace.price || 0)}</strong></span>
              <span>Renta <strong>{moneyFormatter.format(pendingPurchaseSpace.rent || pendingPurchaseSpace.baseRent || 0)}</strong></span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <ActionButton onClick={() => onAction("comprarPropiedad")}>Comprar propiedad</ActionButton>
              <ActionButton tone="danger" onClick={() => onAction("rechazarCompra")}>Subastar</ActionButton>
            </div>
          </div>
        )}

        {pendingCard && isMyTurn && myActions.includes("resolverCarta") && (
          <div className="monopoly-context-box is-card">
            <p className="monopoly-panel-eyebrow">{pendingCard.deck === "CASUALIDAD" ? "Casualidad" : "Arca comunal"}</p>
            <h4>{pendingCard.card?.title || "Carta activa"}</h4>
            <p>{pendingCard.card?.text || "Resuelve el efecto de la carta."}</p>
            <ActionButton onClick={() => onAction("resolverCarta")}>
              <Receipt size={18} />
              Tomar carta
            </ActionButton>
          </div>
        )}

        {isMyTurn && myActions.includes("pagarRenta") && (
          <ActionButton className="monopoly-main-turn-button" tone="secondary" onClick={() => onAction("pagarRenta")}>
            <Wallet size={22} />
            Pagar renta
          </ActionButton>
        )}

        {pendingTax && isMyTurn && myActions.includes("pagarImpuesto") && (
          <div className="monopoly-context-box is-tax">
            <p className="monopoly-panel-eyebrow">Impuesto pendiente</p>
            <h4>Elige como pagar</h4>
            <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto", { opcion: "FIXED" })}>
              Pagar fijo - {moneyFormatter.format(pendingTax.fixedAmount)}
            </ActionButton>
            <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto", { opcion: "PERCENT" })}>
              Pagar patrimonio - {moneyFormatter.format(pendingTax.percentAmount)}
            </ActionButton>
          </div>
        )}

        {auction && (
          <div className="monopoly-context-box is-auction">
            <p className="monopoly-panel-eyebrow">Subasta en vivo</p>
            <h4>{playersById.get(auction.activeBidderId)?.name || "Jugador"} decide</h4>
            <p>Puja actual: {moneyFormatter.format(auction.currentBid || 0)}</p>
            {(canBidAuction || canPassAuction) && (
              <div className="grid gap-2">
                {canBidAuction && (
                  <>
                    <input
                      className="monopoly-input"
                      type="number"
                      min={(auction.currentBid || 0) + 1}
                      value={bidAmount}
                      onChange={(event) => setBidAmount(Number(event.target.value))}
                    />
                    <ActionButton onClick={() => onAction("hacerOferta", { monto: bidAmount })}>
                      <Gavel size={18} />
                      Ofertar
                    </ActionButton>
                  </>
                )}
                {canPassAuction && <ActionButton tone="danger" onClick={() => onAction("retirarseDeSubasta")}>Pasar</ActionButton>}
              </div>
            )}
          </div>
        )}

        {isMyTurn && myActions.includes("pagarMultaCarcel") && (
          <ActionButton tone="secondary" onClick={() => onAction("pagarMultaCarcel")}>
            <PauseCircle size={18} />
            Pagar multa
          </ActionButton>
        )}

        {isMyTurn && myActions.includes("usarCartaSalirCarcel") && (
          <ActionButton tone="secondary" onClick={() => onAction("usarCartaSalirCarcel")}>
            <ShieldAlert size={18} />
            Usar carta
          </ActionButton>
        )}

        {pendingDebt && isMyTurn && myActions.includes("resolverDeudaPendiente") && (
          <ActionButton onClick={() => onAction("resolverDeudaPendiente")}>
            <Hammer size={18} />
            Pagar deuda - {moneyFormatter.format(pendingDebt.amount)}
          </ActionButton>
        )}

        {isMyTurn && myActions.includes("terminarTurno") && (
          <ActionButton className="monopoly-main-turn-button" onClick={() => onAction("terminarTurno")}>
            <TimerReset size={22} />
            Terminar turno
          </ActionButton>
        )}

        {isMyTurn && myActions.includes("resolverQuiebra") && (
          <ActionButton tone="danger" onClick={() => onAction("resolverQuiebra")}>
            <AlertTriangle size={18} />
            Declarar quiebra
          </ActionButton>
        )}

        {!canAct && (
          <div className="monopoly-wait-card">
            <HourglassMessage />
            <div>
              <strong>{isMyTurn ? "Sin acciones pendientes" : "Observando la mesa"}</strong>
              <span>{isMyTurn ? "El motor abrira la siguiente decision cuando corresponda." : "Cuando sea tu turno, este panel cambiara automaticamente."}</span>
            </div>
          </div>
        )}
      </div>

      <div className="monopoly-secondary-actions">
        <button type="button" onClick={onOpenTrade}>
          <Scale size={16} />
          Negocios
        </button>
        <button type="button" onClick={onOpenRanking}>
          <Trophy size={16} />
          Ranking
        </button>
      </div>
    </aside>
  );
}

function rollingContextLabel(phase, isMyTurn, canAct) {
  if (!isMyTurn) return "Sigue el movimiento rival desde el tablero.";
  if (!canAct) return "El siguiente paso aparecera automaticamente.";
  if (phase === "AWAITING_ROLL") return "Es tu turno: tira los dados.";
  if (phase === "AWAITING_PURCHASE_DECISION") return "Decide si compras o abres subasta.";
  if (phase === "AWAITING_RENT_CLAIM") return "Confirma el pago de renta.";
  if (phase === "AWAITING_TURN_END") return "Accion resuelta: cierra tu turno.";
  return "Resuelve la accion destacada para continuar.";
}

function PlayerStatusBar({ players, currentUserId, currentPlayerId, tokenStylesById, customTokens }) {
  return (
    <div className="monopoly-player-strip">
      {players.map((player, index) => (
        <article
          key={player.id}
          className={cx(
            "monopoly-player-chip-card",
            player.id === currentPlayerId && "active",
            player.bankrupt && "bankrupt"
          )}
        >
          <TokenChip tokenStyle={tokenStylesById[player.id] || resolveTokenStyle({ ...player, colorIndex: index }, customTokens)} className="h-10 w-10 text-xs" />
          <div className="min-w-0">
            <strong>{player.name}{sameEntityId(player.id, currentUserId) ? " - tu" : ""}</strong>
            <span><Money amount={player.cash} /> · {player.properties.length} props</span>
          </div>
        </article>
      ))}
    </div>
  );
}

function PropertySummary({ player, onSelect, onOpenTrade }) {
  const groups = useMemo(() => {
    const next = new Map();
    (player?.properties || []).forEach((property) => {
      const key = property.colorGroup || property.type || "otros";
      if (!next.has(key)) next.set(key, []);
      next.get(key).push(property);
    });
    return [...next.entries()];
  }, [player?.properties]);

  return (
    <div className="monopoly-property-summary">
      <div className="monopoly-bottom-head">
        <div>
          <p className="monopoly-panel-eyebrow">Tus activos</p>
          <h3>{player?.properties?.length || 0} propiedades</h3>
        </div>
        <ActionButton tone="secondary" onClick={onOpenTrade}>
          <Scale size={16} />
          Negocios
        </ActionButton>
      </div>

      {!player?.properties?.length ? (
        <div className="monopoly-empty-state">Todavia no controlas ninguna propiedad.</div>
      ) : (
        <div className="monopoly-property-groups">
          {groups.map(([groupKey, properties]) => {
            const group = colorGroupMeta[groupKey];
            return (
              <section key={groupKey} className="monopoly-property-group">
                <div className="monopoly-property-group-title">
                  <span style={{ backgroundColor: group?.color || "#d8c8ae" }} />
                  <strong>{group?.label || groupKey}</strong>
                  <em>{properties.length}</em>
                </div>
                <div className="monopoly-property-mini-list">
                  {properties.map((property) => (
                    <button key={property.id} type="button" onClick={() => onSelect(property.id)} title={property.name}>
                      <span>{property.name}</span>
                      {property.isMortgaged && <em>Hip.</em>}
                      {property.hasHotel && <em>Hotel</em>}
                      {property.houses > 0 && <em>{property.houses} casas</em>}
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentEvents({ events, playersById, boardById }) {
  const visibleEvents = [...(events || [])].reverse().slice(0, 6);
  return (
    <div className="monopoly-recent-events">
      <div className="monopoly-bottom-head">
        <div>
          <p className="monopoly-panel-eyebrow">Ultimos eventos</p>
          <h3>Bitacora de mesa</h3>
        </div>
      </div>
      {visibleEvents.length === 0 ? (
        <div className="monopoly-empty-state">Todavia no hay eventos para mostrar.</div>
      ) : (
        <div className="monopoly-event-timeline">
          {visibleEvents.map((event) => {
            const summary = describeEvent(event, playersById, boardById);
            return (
              <article key={`${event.id}-${summary.title}`} className={cx("monopoly-event-line", `tone-${eventTone(event.type)}`)}>
                <strong>{summary.title}</strong>
                <span>{summary.body}</span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BottomDock({
  activeTab,
  onTabChange,
  players,
  currentUserId,
  currentPlayerId,
  tokenStylesById,
  customTokens,
  myPlayer,
  selectedSpace,
  selectedOwner,
  selectedVisitors,
  selectedOwnerProperty,
  onSelectSpace,
  onManage,
  events,
  playersById,
  boardById,
  onOpenTrade,
  onOpenRanking,
  onToggleChat
}) {
  const tabs = [
    ["players", "Jugadores", Users],
    ["assets", "Activos", Building2],
    ["events", "Eventos", Receipt],
    ["space", "Casilla", MapIcon]
  ];

  return (
    <section className="monopoly-bottom-dock">
      <div className="monopoly-dock-actions">
        <button type="button" onClick={onOpenTrade}>
          <Scale size={16} />
          Negocios
        </button>
        <button type="button" onClick={onOpenRanking}>
          <Trophy size={16} />
          Ranking
        </button>
        <button type="button" onClick={onToggleChat}>
          <MessageCircle size={16} />
          Chat
        </button>
      </div>

      <nav className="monopoly-dock-tabs" aria-label="Informacion de mesa">
        {tabs.map(([id, label, Icon]) => (
          <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => onTabChange(id)}>
            <Icon size={16} />
            {label}
          </button>
        ))}
      </nav>

      <div className="monopoly-dock-panel">
        {activeTab === "players" && (
          <PlayerStatusBar
            players={players}
            currentUserId={currentUserId}
            currentPlayerId={currentPlayerId}
            tokenStylesById={tokenStylesById}
            customTokens={customTokens}
          />
        )}

        {activeTab === "assets" && (
          <PropertySummary player={myPlayer} onSelect={onSelectSpace} onOpenTrade={onOpenTrade} />
        )}

        {activeTab === "events" && (
          <RecentEvents events={events} playersById={playersById} boardById={boardById} />
        )}

        {activeTab === "space" && (
          <SelectedSpaceCard
            space={selectedSpace}
            owner={selectedOwner}
            visitors={selectedVisitors}
            ownerProperty={selectedOwnerProperty}
            managementOptions={selectedOwnerProperty?.management || null}
            isOwnedByMe={sameEntityId(selectedOwner?.id, currentUserId)}
            onManage={onManage}
          />
        )}
      </div>
    </section>
  );
}

function RulesModal({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-warn">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Reglas</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Reglas de esta mesa</h3>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {ruleCards.map((rule) => (
            <article key={rule.title} className="modal-stat-card">
              <span>{rule.title}</span>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#6b4b2c]">{rule.body}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function RankingModal({ open, onClose, ranking }) {
  if (!open) return null;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-success">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Ranking</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Fortunas</h3>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mt-5 grid gap-3">
          {(ranking || []).map((entry, index) => (
            <div key={entry.playerId} className="flex items-center justify-between rounded-[18px] border border-[#d8c8ae] bg-white/55 px-4 py-3">
              <strong className="text-sm uppercase text-[#23160c]">{index + 1}. {entry.name}</strong>
              <Money amount={entry.wealth} className="font-black text-[#14532d]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TradeModal({
  open,
  onClose,
  myPlayer,
  players,
  currentUserId,
  propertyTrade,
  setPropertyTrade,
  cardTrade,
  setCardTrade,
  onAction
}) {
  if (!open) return null;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Negocios</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Acciones secundarias</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">Transferencias y venta de cartas viven aqui para no ensuciar el turno.</p>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <section className="modal-stat-card">
            <span>Transferir propiedad</span>
            <div className="mt-3 grid gap-3">
              <select
                className="monopoly-input"
                value={propertyTrade.propertyId}
                onChange={(event) => setPropertyTrade((current) => ({ ...current, propertyId: event.target.value }))}
              >
                <option value="">Selecciona propiedad</option>
                {(myPlayer?.properties || []).map((property) => (
                  <option key={property.id} value={property.id}>{property.name}</option>
                ))}
              </select>
              <select
                className="monopoly-input"
                value={propertyTrade.buyerId}
                onChange={(event) => setPropertyTrade((current) => ({ ...current, buyerId: event.target.value }))}
              >
                <option value="">Comprador</option>
                {players.filter((player) => !sameEntityId(player.id, currentUserId) && !player.bankrupt).map((player) => (
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
                onClick={() => onAction("venderPropiedad", {
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
          </section>

          <section className="modal-stat-card">
            <span>Vender carta de carcel</span>
            <div className="mt-3 grid gap-3">
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
                {players.filter((player) => !sameEntityId(player.id, currentUserId) && !player.bankrupt).map((player) => (
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
                onClick={() => onAction("comprarCartaSalirCarcel", {
                  compradorId: Number(cardTrade.buyerId),
                  deck: cardTrade.deck,
                  precio: Number(cardTrade.price)
                })}
                disabled={!cardTrade.buyerId}
              >
                Vender carta
              </ActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function TableMenuModal({ open, onClose, connectionStatus, currentUser, messages, presence, onSendMessage, customTokens }) {
  if (!open) return null;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info monopoly-menu-modal">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Menu</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Sala y chat</h3>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="mt-5">
          <MonopolySocialRail
            connectionStatus={connectionStatus}
            currentUser={currentUser}
            messages={messages}
            players={presence}
            onSendMessage={onSendMessage}
            customTokens={customTokens}
          />
        </div>
      </div>
    </div>
  );
}

function FloatingChat({ open, onToggle, connectionStatus, currentUser, messages, players = [], onSendMessage, customTokens = {} }) {
  const [text, setText] = useState("");
  const [chatError, setChatError] = useState("");
  const chatRef = useRef(null);
  const playersById = useMemo(() => {
    const map = new Map();
    (players || []).forEach((player, index) => {
      const id = player?.id ?? player?.userId;
      if (id != null) {
        map.set(String(id), { player, index });
      }
    });
    return map;
  }, [players]);

  useEffect(() => {
    if (open && chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [open, messages.length]);

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
    <div className={cx("monopoly-floating-chat", open && "open")}>
      {open && (
        <section className="monopoly-floating-chat-panel">
          <header>
            <div>
              <p className="monopoly-panel-eyebrow">Chat</p>
              <h3>Mesa</h3>
            </div>
            <span className={cx("monopoly-chip", connectionStatus === "online" ? "bg-[#0f766e] text-white" : "bg-[#6b7280] text-white")}>
              {connectionStatus === "online" ? "En vivo" : "Offline"}
            </span>
          </header>

          <div ref={chatRef} className="monopoly-floating-chat-log">
            {messages.length === 0 ? (
              <div className="monopoly-empty-state">Aun no hay mensajes.</div>
            ) : (
              messages.slice(-40).map((message) => {
                const isMe = sameEntityId(message.userId, currentUser.id);
                const participant = playersById.get(String(message.userId));
                const tokenStyle = resolveTokenStyle({
                  id: message.userId,
                  name: message.username,
                  colorIndex: participant?.index ?? 0,
                  token: participant?.player?.token
                }, customTokens);
                return (
                  <div key={message.id} className={cx("monopoly-floating-message-row", isMe && "mine")}>
                    {!isMe && <TokenChip tokenStyle={tokenStyle} className="h-7 w-7 shrink-0 text-[9px]" />}
                    <div className={cx("monopoly-floating-message", isMe && "mine")}>
                      <span>{message.username}</span>
                      <p>{message.text}</p>
                    </div>
                    {isMe && <TokenChip tokenStyle={tokenStyle} className="h-7 w-7 shrink-0 text-[9px]" />}
                  </div>
                );
              })
            )}
          </div>

          <form className="monopoly-floating-chat-form" onSubmit={submit}>
            <input
              className="monopoly-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Mensaje..."
              maxLength={240}
            />
            <ActionButton className="px-4">
              <Send size={18} />
            </ActionButton>
          </form>

          {chatError && <div className="monopoly-chat-error">{chatError}</div>}
        </section>
      )}

      <button type="button" className="monopoly-floating-chat-button" onClick={onToggle} title={open ? "Cerrar chat" : "Abrir chat"}>
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>
    </div>
  );
}

function DiceRollOverlay({ open, diceFaces, rolling, playerName }) {
  if (!open) return null;

  return (
    <div className="dice-roll-overlay" aria-hidden="true">
      <div className="dice-roll-card">
        <p>{playerName || "Jugador"} tira los dados</p>
        <div>
          <Dice value={diceFaces[0]} rolling={rolling} size={92} />
          <Dice value={diceFaces[1]} rolling={rolling} size={92} />
        </div>
      </div>
    </div>
  );
}

function PropertyModal(props) {
  return <ActionModal {...props} />;
}

// ============================================================================
// LOBBY REDISEÑADO
// Flujo estilo videojuego multijugador:
//   1) Pantalla principal: tablero como escenario + botones Unirse / Crear.
//   2) Unirse -> selector de salas (lista de servidores) + contraseña.
//   3) Crear  -> configuración de sala.
//   4) Sala de espera al sentarse, antes de que arranque la partida.
// ============================================================================

function roomStatusMeta(table, currentUserId) {
  const max = table.maxPlayers || 4;
  const seated = table.playerCount || 0;
  const mine = (table.players || []).some((player) => sameEntityId(player.id, currentUserId));
  const protectedRoom = Boolean(table.isPrivate || table.hasPassword);
  const full = seated >= max;
  if (table.status === "FINISHED") return { key: "finished", label: "Finalizada", tone: "muted", mine, full };
  if (table.status === "PLAYING") return { key: "playing", label: "En partida", tone: "playing", mine, full };
  if (full) return { key: "full", label: "Llena", tone: "full", mine, full };
  if (protectedRoom) return { key: "private", label: "Privada", tone: "private", mine, full };
  return { key: "waiting", label: "Esperando jugadores", tone: "waiting", mine, full };
}

function LobbyStage({ children, dim = false, overlayClassName = "" }) {
  return (
    <div className={cx("monopoly-lobby-stage", dim && "is-dim")}>
      <div className="monopoly-lobby-board" aria-hidden="true">
        <div className="monopoly-board monopoly-board-preview monopoly-board-stage">
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
          <div className="monopoly-center monopoly-center-stage">
            <div className="monopoly-logo monopoly-logo-preview">MONOPOLY</div>
          </div>
        </div>
      </div>
      <div className={cx("monopoly-lobby-overlay", overlayClassName)}>{children}</div>
    </div>
  );
}

function LobbyMenu({ world, myTokenStyle, onJoin, onCreate, onHelp, onToken, error }) {
  return (
    <section className="monopoly-lobby">
      <div className="monopoly-lobby-topbar">
        <div className="monopoly-lobby-world">
          <span className="monopoly-lobby-world-dot" />
          Mundo · {world.name}
        </div>
        <button type="button" className="monopoly-lobby-token" onClick={onToken} title="Personaliza tu ficha">
          <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
          <span>Mi ficha</span>
        </button>
      </div>

      <LobbyStage overlayClassName="monopoly-lobby-overlay-actions">
        <div className="monopoly-lobby-actions">
          <button type="button" className="monopoly-menu-button primary" onClick={onJoin}>
            <span className="monopoly-menu-button-icon"><LogIn size={26} /></span>
            <span className="monopoly-menu-button-text">
              <span className="monopoly-menu-button-title">Unirse a partida</span>
              <span className="monopoly-menu-button-sub">Explora salas abiertas</span>
            </span>
          </button>
          <button type="button" className="monopoly-menu-button secondary" onClick={onCreate}>
            <span className="monopoly-menu-button-icon"><PlusCircle size={26} /></span>
            <span className="monopoly-menu-button-text">
              <span className="monopoly-menu-button-title">Crear partida</span>
              <span className="monopoly-menu-button-sub">Configura tu propia sala</span>
            </span>
          </button>
        </div>

        <button type="button" className="monopoly-lobby-help" onClick={onHelp}>
          <Info size={16} /> Ayuda / Reglas
        </button>

        {error && <div className="monopoly-lobby-error">{error}</div>}
      </LobbyStage>
    </section>
  );
}

function RoomCard({ table, currentUserId, onJoin, customTokens = {} }) {
  const meta = roomStatusMeta(table, currentUserId);
  const max = table.maxPlayers || 4;
  const seated = table.playerCount || 0;
  const protectedRoom = Boolean(table.isPrivate || table.hasPassword);
  const disabled = (meta.key === "playing" || meta.key === "finished" || meta.full) && !meta.mine;
  const label = meta.mine ? "Volver" : meta.key === "playing" ? "En curso" : meta.full ? "Llena" : "Unirse";

  return (
    <article className={cx("monopoly-room-card", `tone-${meta.tone}`)}>
      <div className="monopoly-room-card-body">
        <div className="monopoly-room-card-head">
          {protectedRoom && <Lock size={15} className="monopoly-room-lock" />}
          <h4 className="monopoly-room-name">{table.name}</h4>
          <span className={cx("monopoly-room-status", `tone-${meta.tone}`)}>{meta.label}</span>
        </div>
        <div className="monopoly-room-meta">
          <span className={cx("monopoly-room-meta-item", meta.full && "is-full")}>
            <Users size={14} /> {seated}/{max}
          </span>
          <span className="monopoly-room-meta-item">
            <MapIcon size={14} /> {modeLabel[table.mode] || table.mode}
          </span>
          <span className="monopoly-room-meta-item">
            <TimerReset size={14} /> {table.turnTimeSeconds}s
          </span>
          {table.mode === "TIMED" && (
            <span className="monopoly-room-meta-item">{table.timedMinutes} min</span>
          )}
        </div>
        <div className="monopoly-room-seats">
          {Array.from({ length: max }, (_, index) => {
            const player = (table.players || [])[index];
            const tokenStyle = player
              ? resolveTokenStyle({ id: player.id, name: player.name, colorIndex: index, token: player.token }, customTokens)
              : null;
            return (
              <span
                key={index}
                className={cx("monopoly-room-seat", player ? "is-taken" : "is-open")}
                title={player ? player.name : "Asiento libre"}
              >
                {player ? <TokenChip tokenStyle={tokenStyle} className="h-full w-full text-[8px]" /> : ""}
              </span>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        className={cx("monopoly-room-join", meta.mine && "is-mine")}
        disabled={disabled}
        onClick={() => onJoin(table)}
      >
        {protectedRoom && !meta.mine && <Lock size={15} />}
        {label}
      </button>
    </article>
  );
}

function JoinGameModal({ open, onClose, tables, currentUserId, onSelectJoin, customTokens = {} }) {
  if (!open) return null;
  const ordered = tables.filter((table) => table.status !== "FINISHED").sort((a, b) => {
    const rank = (table) => (table.status === "WAITING" ? 0 : table.status === "PLAYING" ? 1 : 2);
    return rank(a) - rank(b);
  });

  return (
    <div className="monopoly-modal-backdrop" onClick={onClose}>
      <div className="monopoly-game-modal monopoly-join-modal" onClick={(event) => event.stopPropagation()}>
        <header className="monopoly-game-modal-head">
          <div>
            <p className="monopoly-game-modal-kicker">Multijugador</p>
            <h3 className="monopoly-game-modal-title">Salas disponibles</h3>
          </div>
          <button type="button" className="monopoly-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="monopoly-room-list">
          {ordered.length === 0 ? (
            <div className="monopoly-room-empty">
              <Sparkles size={28} />
              <p>No hay salas todavía.</p>
              <span>Crea la primera y sé el anfitrión.</span>
            </div>
          ) : (
            ordered.map((table) => (
              <RoomCard key={table.id} table={table} currentUserId={currentUserId} onJoin={onSelectJoin} customTokens={customTokens} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordPromptModal({ table, onClose, onSubmit, error }) {
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue("");
  }, [table?.id]);

  if (!table) return null;

  function submit(event) {
    event.preventDefault();
    onSubmit(value);
  }

  return (
    <div className="monopoly-modal-backdrop" onClick={onClose}>
      <form className="monopoly-game-modal monopoly-password-modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <div className="monopoly-password-icon"><Lock size={26} /></div>
        <h3 className="monopoly-game-modal-title">Sala protegida</h3>
        <p className="monopoly-password-copy">«{table.name}» necesita contraseña para entrar.</p>
        <input
          className="monopoly-input"
          type="password"
          autoFocus
          value={value}
          maxLength={32}
          placeholder="Contraseña"
          onChange={(event) => setValue(event.target.value)}
        />
        {error && <p className="monopoly-form-error">{error}</p>}
        <div className="monopoly-modal-actions">
          <button type="button" className="monopoly-ghost-button" onClick={onClose}>Cancelar</button>
          <button type="submit" className="monopoly-menu-button primary compact">
            <LogIn size={18} /> Entrar
          </button>
        </div>
      </form>
    </div>
  );
}

function CreateGameModal({
  open,
  onClose,
  tableName,
  setTableName,
  mode,
  setMode,
  maxPlayers,
  setMaxPlayers,
  turnTimeSeconds,
  setTurnTimeSeconds,
  timedMinutes,
  setTimedMinutes,
  isPrivate,
  setIsPrivate,
  tablePassword,
  setTablePassword,
  onCreate
}) {
  if (!open) return null;

  const canCreate = tableName.trim().length > 0 && (!isPrivate || tablePassword.trim().length > 0);

  return (
    <div className="monopoly-modal-backdrop" onClick={onClose}>
      <div className="monopoly-game-modal monopoly-create-modal" onClick={(event) => event.stopPropagation()}>
        <header className="monopoly-game-modal-head">
          <div>
            <p className="monopoly-game-modal-kicker">Nueva sala</p>
            <h3 className="monopoly-game-modal-title">Crear partida</h3>
          </div>
          <button type="button" className="monopoly-modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="monopoly-create-body">
          <label className="monopoly-field">
            <span className="monopoly-field-label">Nombre de la partida</span>
            <input
              className="monopoly-input"
              value={tableName}
              maxLength={48}
              placeholder="Mesa Monopoly"
              onChange={(event) => setTableName(event.target.value)}
            />
          </label>

          <div className="monopoly-field">
            <span className="monopoly-field-label">Modo de juego</span>
            <div className="monopoly-mode-grid">
              {[
                { id: "NORMAL", label: "Clásico", copy: "Gana el último solvente" },
                { id: "SHORT", label: "Corto", copy: "Hoteles con 3 casas" },
                { id: "TIMED", label: "Con límite", copy: "Gana por riqueza" }
              ].map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={cx("monopoly-mode-chip", mode === choice.id && "is-active")}
                  onClick={() => setMode(choice.id)}
                >
                  <span className="monopoly-mode-chip-title">{choice.label}</span>
                  <span className="monopoly-mode-chip-copy">{choice.copy}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="monopoly-field-row">
            <label className="monopoly-field">
              <span className="monopoly-field-label">Máx. jugadores</span>
              <select className="monopoly-input" value={maxPlayers} onChange={(event) => setMaxPlayers(Number(event.target.value))}>
                {[2, 3, 4, 5, 6, 7, 8].map((count) => (
                  <option key={count} value={count}>{count} jugadores</option>
                ))}
              </select>
            </label>
            <label className="monopoly-field">
              <span className="monopoly-field-label">Tiempo por turno</span>
              <select className="monopoly-input" value={turnTimeSeconds} onChange={(event) => setTurnTimeSeconds(Number(event.target.value))}>
                {[30, 45, 60, 90, 120].map((seconds) => (
                  <option key={seconds} value={seconds}>{seconds} segundos</option>
                ))}
              </select>
            </label>
            <label className="monopoly-field">
              <span className="monopoly-field-label">Duración (min)</span>
              <input
                className="monopoly-input"
                type="number"
                min={30}
                max={240}
                value={timedMinutes}
                disabled={mode !== "TIMED"}
                onChange={(event) => setTimedMinutes(Number(event.target.value))}
              />
            </label>
          </div>

          <div className="monopoly-field">
            <span className="monopoly-field-label">Tipo de sala</span>
            <div className="monopoly-toggle-grid">
              <button
                type="button"
                className={cx("monopoly-toggle-chip", !isPrivate && "is-active")}
                onClick={() => setIsPrivate(false)}
              >
                <Globe size={18} />
                <span>Pública</span>
              </button>
              <button
                type="button"
                className={cx("monopoly-toggle-chip", isPrivate && "is-active")}
                onClick={() => setIsPrivate(true)}
              >
                <Lock size={18} />
                <span>Privada</span>
              </button>
            </div>
          </div>

          {isPrivate && (
            <label className="monopoly-field">
              <span className="monopoly-field-label">Contraseña</span>
              <input
                className="monopoly-input"
                type="text"
                value={tablePassword}
                maxLength={32}
                placeholder="Solo quien la tenga podrá entrar"
                onChange={(event) => setTablePassword(event.target.value)}
              />
            </label>
          )}
        </div>

        <div className="monopoly-modal-actions">
          <button type="button" className="monopoly-ghost-button" onClick={onClose}>Cancelar</button>
          <button type="button" className="monopoly-menu-button primary compact" disabled={!canCreate} onClick={onCreate}>
            <PlusCircle size={18} /> Crear partida
          </button>
        </div>
      </div>
    </div>
  );
}

function WaitingRoom({
  table,
  currentUserId,
  isHost,
  onStart,
  onLeave,
  onCloseTable,
  onToken,
  myTokenStyle,
  connectionStatus,
  currentUser,
  messages,
  onSendMessage,
  customTokens,
  error
}) {
  const max = table.maxPlayers || 4;
  const seated = table.playerCount || 0;
  const seats = Array.from({ length: max }, (_, index) => (table.players || [])[index] || null);
  const canStart = seated >= 2;

  return (
    <section className="monopoly-lobby">
      <div className="monopoly-lobby-topbar">
        <div className="monopoly-lobby-world">
          <span className="monopoly-lobby-world-dot waiting" />
          Sala de espera
        </div>
        <button type="button" className="monopoly-lobby-token" onClick={onToken} title="Personaliza tu ficha">
          <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
          <span>Mi ficha</span>
        </button>
      </div>

      <LobbyStage dim>
        <div className="monopoly-waitroom">
          <div className="monopoly-waitroom-main">
            <div className="monopoly-waitroom-head">
              {table.isPrivate && <Lock size={16} className="monopoly-room-lock" />}
              <h3 className="monopoly-waitroom-title">{table.name}</h3>
              <span className="monopoly-room-status tone-waiting">
                {table.status === "WAITING" ? "Esperando jugadores" : "Lista"}
              </span>
            </div>

            <div className="monopoly-waitroom-tags">
              <span className="monopoly-room-meta-item"><MapIcon size={14} /> {modeLabel[table.mode] || table.mode}</span>
              <span className="monopoly-room-meta-item"><TimerReset size={14} /> {table.turnTimeSeconds}s</span>
              {table.mode === "TIMED" && <span className="monopoly-room-meta-item">{table.timedMinutes} min</span>}
              <span className="monopoly-room-meta-item">{table.isPrivate ? <><Lock size={14} /> Privada</> : <><Globe size={14} /> Pública</>}</span>
            </div>

            <p className="monopoly-waitroom-count">{seated}/{max} jugadores en la sala</p>

            <div className="monopoly-waitroom-seats">
              {seats.map((player, index) => {
                const tokenStyle = player
                  ? resolveTokenStyle({ id: player.id, name: player.name, colorIndex: index, token: player.token }, customTokens)
                  : null;
                return (
                <div key={index} className={cx("monopoly-waitroom-seat", player ? "is-taken" : "is-open")}>
                  <span className="monopoly-waitroom-seat-avatar">
                    {player ? <TokenChip tokenStyle={tokenStyle} className="h-full w-full text-xs" /> : "+"}
                  </span>
                  <span className="monopoly-waitroom-seat-name">
                    {player ? player.name : "Esperando…"}
                    {player && sameEntityId(player.id, table.hostId) && <span className="monopoly-waitroom-host">Anfitrión</span>}
                  </span>
                </div>
                );
              })}
            </div>

            {error && <div className="monopoly-lobby-error">{error}</div>}

            <div className="monopoly-waitroom-actions">
              {isHost && (
                <button type="button" className="monopoly-menu-button primary compact" disabled={!canStart} onClick={onStart}>
                  <PlayCircle size={18} /> {canStart ? "Iniciar partida" : "Faltan jugadores"}
                </button>
              )}
              <button type="button" className="monopoly-ghost-button" onClick={onLeave}>
                <DoorOpen size={18} /> Salir
              </button>
              {isHost && (
                <button type="button" className="monopoly-danger-button" onClick={onCloseTable}>
                  <LogOut size={18} /> Cerrar sala
                </button>
              )}
            </div>
          </div>
        </div>
      </LobbyStage>
    </section>
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
  const [bottomTab, setBottomTab] = useState("players");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  // Lobby rediseñado: control de modales y configuración de sala.
  const [joinOpen, setJoinOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [tablePassword, setTablePassword] = useState("");
  const [passwordPrompt, setPasswordPrompt] = useState(null);
  const [passwordError, setPasswordError] = useState("");
  const seenEventIdsRef = useRef(new Set());
  const lastRollSignatureRef = useRef("");
  const previousSnapshotRef = useRef(null);
  const diceIntervalRef = useRef(null);
  const diceTimeoutRef = useRef(null);
  const cinematicTimeoutsRef = useRef([]);
  // Bloqueo anti doble-clic / reentrada de acciones (robustez de interaccion).
  const actionLockRef = useRef(false);
  const actionLockTimeoutRef = useRef(null);
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
        const shouldAutoOpen = payload.table?.seatedPlayers?.some((player) => sameEntityId(player.id, currentUserId));
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
    if (state?.winnerId && activeTableId) {
      return;
    }

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

    const preferredTable = tables.find((table) =>
      table.players.some((player) => sameEntityId(player.id, currentUserId)) &&
      table.status !== "FINISHED"
    );

    if (preferredTable) {
      setActiveTableId(preferredTable.id);
      return;
    }

    setActiveTableId("");
    setTableMeta(null);
    setState(null);
  }, [tables, activeTableId, currentUserId, state?.winnerId]);

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
  const isMyAuctionTurn = sameEntityId(auction?.activeBidderId, currentUserId);
  const canBidAuction = isMyAuctionTurn || myActions.includes("hacerOferta");
  const canPassAuction = isMyAuctionTurn || myActions.includes("retirarseDeSubasta");
  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) || null,
    [tables, activeTableId]
  );
  const isSeatedAtActiveTable = Boolean(activeTable?.players.some((player) => sameEntityId(player.id, currentUserId)));
  const isHostAtActiveTable = sameEntityId(activeTable?.hostId, currentUserId);
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
    const me = boardPlayers.find((player) => sameEntityId(player.id, currentUserId));
    if (me) return resolveTokenStyle(me, customTokens);
    // Fallback for the pre-game lobby (no in-game player yet)
    const fallbackIndex = boardPlayers.length;
    return resolveTokenStyle({ id: currentUserId, name: currentUser.username || "Tú", colorIndex: fallbackIndex }, customTokens);
  }, [boardPlayers, currentUserId, currentUser.username, customTokens]);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    api("/api/monopoly/token", { token })
      .then((payload) => {
        if (!active || !payload?.token) return;
        setCustomTokens((prev) => {
          const updated = { ...prev, [currentUserId]: payload.token };
          saveCustomTokens(updated);
          return updated;
        });
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [token, currentUserId]);

  useEffect(() => {
    const playersWithTokens = [
      ...tables.flatMap((table) => table.players || []),
      ...(tableMeta?.seatedPlayers || []),
      ...(state?.players || [])
    ].filter((player) => player?.id && player.token);

    if (playersWithTokens.length === 0) return;

    setCustomTokens((prev) => {
      let changed = false;
      const updated = { ...prev };
      playersWithTokens.forEach((player) => {
        const current = updated[player.id];
        if (JSON.stringify(current) !== JSON.stringify(player.token)) {
          updated[player.id] = player.token;
          changed = true;
        }
      });

      if (changed) {
        saveCustomTokens(updated);
      }

      return changed ? updated : prev;
    });
  }, [tables, tableMeta?.seatedPlayers, state?.players]);

  function persistMyToken(next) {
    const normalized = {
      label: String(next.label || "").trim().slice(0, 4).toUpperCase(),
      icon: next.icon || "",
      bg: next.bg,
      ring: next.ring,
      fg: next.fg || "#ffffff",
      shape: next.shape
    };

    setCustomTokens((prev) => {
      const updated = { ...prev, [currentUserId]: normalized };
      saveCustomTokens(updated);
      return updated;
    });

    api("/api/monopoly/token", {
      method: "PUT",
      token,
      body: { token: normalized }
    }).catch((nextError) => {
      setError(nextError.message || "No se pudo guardar tu ficha");
    });
  }

  function resetMyToken() {
    setCustomTokens((prev) => {
      const updated = { ...prev };
      delete updated[currentUserId];
      saveCustomTokens(updated);
      return updated;
    });

    api("/api/monopoly/token", {
      method: "DELETE",
      token
    }).catch((nextError) => {
      setError(nextError.message || "No se pudo restablecer tu ficha");
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
    // No revelar la casilla/propiedad de aterrizaje hasta que la animacion de
    // dados + movimiento termine (cinematic === null y sin tirada en curso).
    if (cinematic || rollingDice) return;
    const focusId =
      pendingPurchaseSpace?.id ||
      board.find((space) => space.index === currentPlayer?.position)?.id ||
      board[0]?.id;

    if (focusId) {
      setSelectedSpaceId(focusId);
    }
  }, [board, currentPlayer?.position, pendingPurchaseSpace?.id, state?.turn?.turnNumber, state?.turn?.lastRoll?.total, cinematic, rollingDice]);

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
  const activeModal = (cinematic || rollingDice)
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

    if (sameEntityId(state.currentPlayerId, currentUserId) && !state.winnerId) {
      // Pequeño delay para no superponer otros audios de cierre del turno previo
      const timeoutId = window.setTimeout(() => {
        audio.play("tuturno");
      }, 240);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [state?.currentPlayerId, state?.turn?.turnNumber, currentUserId, state?.winnerId]);

  // Cuando la partida termina (winnerId aparece): reproducir audio de victoria y
  // volver automáticamente al menú/lobby después de unos segundos.
  const gameEndHandledRef = useRef(false);
  useEffect(() => {
    if (!state?.winnerId) {
      gameEndHandledRef.current = false;
      return undefined;
    }
    if (gameEndHandledRef.current) return undefined;
    gameEndHandledRef.current = true;

    audio.play("win");

    const timer = window.setTimeout(() => {
      setActiveTableId("");
      setTableMeta(null);
      setState(null);
      setMenuOpen(false);
      setChatOpen(false);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [state?.winnerId]);

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
      turnTimeSeconds,
      maxPlayers,
      isPrivate,
      password: isPrivate ? tablePassword : ""
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
      setCreateOpen(false);
    });
  }

  function joinTable(tableId, password = "", { onError } = {}) {
    if (!socket) {
      setError("Socket desconectado");
      return;
    }

    socket.emit("join_monopoly_table", { worldId: world.id, tableId, password }, (response) => {
      if (!response?.ok) {
        const message = response?.error || "No se pudo entrar a la mesa";
        setError(message);
        if (onError) onError(message);
        return;
      }

      setActiveTableId(tableId);
      setError("");
      setJoinOpen(false);
      setPasswordPrompt(null);
      setPasswordError("");
    });
  }

  function requestJoin(table) {
    const mine = (table.players || []).some((player) => sameEntityId(player.id, currentUserId));
    if (!mine && (table.isPrivate || table.hasPassword)) {
      setPasswordError("");
      setPasswordPrompt(table);
      return;
    }
    joinTable(table.id);
  }

  function submitPassword(password) {
    if (!passwordPrompt) return;
    joinTable(passwordPrompt.id, password, { onError: (message) => setPasswordError(message) });
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

    // Guard anti doble-clic: si ya hay una accion en vuelo, ignoramos el clic.
    if (actionLockRef.current) return;
    actionLockRef.current = true;
    if (actionLockTimeoutRef.current) window.clearTimeout(actionLockTimeoutRef.current);
    // Red de seguridad: liberar el bloqueo si el servidor no responde.
    actionLockTimeoutRef.current = window.setTimeout(() => {
      actionLockRef.current = false;
    }, 8000);
    const releaseActionLock = () => {
      actionLockRef.current = false;
      if (actionLockTimeoutRef.current) {
        window.clearTimeout(actionLockTimeoutRef.current);
        actionLockTimeoutRef.current = null;
      }
    };

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
      releaseActionLock();
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

      setActiveTableId("");
      setTableMeta(null);
      setState(null);
      setMenuOpen(false);
      setChatOpen(false);
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
    const seatedWaiting = Boolean(activeTable && isSeatedAtActiveTable && activeTable.status === "WAITING");

    return (
      <>
        {seatedWaiting ? (
          <WaitingRoom
            table={activeTable}
            currentUserId={currentUserId}
            isHost={isHostAtActiveTable}
            onStart={startGame}
            onLeave={leaveTable}
            onCloseTable={closeTable}
            onToken={() => setTokenEditorOpen(true)}
            myTokenStyle={myTokenStyle}
            connectionStatus={connectionStatus}
            currentUser={currentUser}
            messages={messages}
            onSendMessage={onSendMessage}
            customTokens={customTokens}
            error={error}
          />
        ) : (
          <LobbyMenu
            world={world}
            myTokenStyle={myTokenStyle}
            onJoin={() => setJoinOpen(true)}
            onCreate={() => setCreateOpen(true)}
            onHelp={() => setHelpOpen(true)}
            onToken={() => setTokenEditorOpen(true)}
            error={error}
          />
        )}

        <JoinGameModal
          open={joinOpen && !seatedWaiting}
          onClose={() => setJoinOpen(false)}
          tables={tables}
          currentUserId={currentUserId}
          onSelectJoin={requestJoin}
          customTokens={customTokens}
        />

        <CreateGameModal
          open={createOpen && !seatedWaiting}
          onClose={() => setCreateOpen(false)}
          tableName={tableName}
          setTableName={setTableName}
          mode={mode}
          setMode={setMode}
          maxPlayers={maxPlayers}
          setMaxPlayers={setMaxPlayers}
          turnTimeSeconds={turnTimeSeconds}
          setTurnTimeSeconds={setTurnTimeSeconds}
          timedMinutes={timedMinutes}
          setTimedMinutes={setTimedMinutes}
          isPrivate={isPrivate}
          setIsPrivate={setIsPrivate}
          tablePassword={tablePassword}
          setTablePassword={setTablePassword}
          onCreate={createTable}
        />

        <PasswordPromptModal
          table={passwordPrompt}
          onClose={() => { setPasswordPrompt(null); setPasswordError(""); }}
          onSubmit={submitPassword}
          error={passwordError}
        />

        <RulesModal open={helpOpen} onClose={() => setHelpOpen(false)} />

        <TokenCustomizer
          open={tokenEditorOpen}
          onClose={() => setTokenEditorOpen(false)}
          currentPlayer={{ name: currentUser.username || "Tú" }}
          currentTokenStyle={myTokenStyle}
          onChange={persistMyToken}
          onReset={resetMyToken}
        />
      </>
    );
  }

  const isMyTurn = sameEntityId(state.currentPlayerId, currentUserId);

  return (
    <GameLayout>
      <EventToasts toasts={toasts} onDismiss={dismissToast} playersById={playersById} boardById={boardById} />

      <TopHud
        tableName={tableMeta?.name || activeTable?.name || "Mesa Monopoly"}
        state={state}
        currentPlayer={currentPlayer}
        myPlayer={myPlayer}
        myTokenStyle={myTokenStyle}
        turnCountdown={turnCountdown}
        onToken={() => setTokenEditorOpen(true)}
        onRules={() => setRulesOpen(true)}
        onMenu={() => setMenuOpen(true)}
        onLeave={leaveTable}
        onSurrender={surrenderGame}
        onCloseTable={closeTable}
        canLeave={tableMeta?.status !== "PLAYING" || state?.status === "FINALIZADO" || Boolean(state?.winnerId)}
        canSurrender={tableMeta?.status === "PLAYING" && state?.status !== "FINALIZADO" && !state?.winnerId && !myPlayer?.bankrupt}
        canCloseTable={isHostAtActiveTable && (tableMeta?.status !== "PLAYING" || state?.status === "FINALIZADO" || Boolean(state?.winnerId))}
      />

      {error && (
        <div className="monopoly-inline-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <main className="monopoly-game-main">
        <BoardArea
          board={board}
          selectedSpace={selectedSpace}
          coloredPlayersById={coloredPlayersById}
          playersById={playersById}
          displayBoardPlayers={displayBoardPlayers}
          state={state}
          tokenStylesById={tokenStylesById}
          cameraFocus={cameraFocus}
          cinematic={cinematic}
          prompt={prompt}
          diceFaces={diceFaces}
          rollingDice={rollingDice}
          myPlayer={myPlayer}
          isMyTurn={isMyTurn}
          myActions={myActions}
          pendingPurchaseSpace={pendingPurchaseSpace}
          pendingTax={pendingTax}
          pendingDebt={pendingDebt}
          pendingCard={pendingCard}
          auction={auction}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          canBidAuction={canBidAuction}
          canPassAuction={canPassAuction}
          onAction={act}
          onSelect={setSelectedSpaceId}
        />
      </main>

      <BottomDock
        activeTab={bottomTab}
        onTabChange={setBottomTab}
        players={state.players}
        currentUserId={currentUserId}
        currentPlayerId={state.currentPlayerId}
        tokenStylesById={tokenStylesById}
        customTokens={customTokens}
        myPlayer={myPlayer}
        selectedSpace={selectedSpace}
        selectedOwner={selectedOwner}
        selectedVisitors={selectedVisitors}
        selectedOwnerProperty={selectedOwnerProperty}
        onSelectSpace={(spaceId) => {
          setSelectedSpaceId(spaceId);
          setBottomTab("space");
        }}
        onManage={(action, propertyId) => act(action, { propertyId })}
        events={state.recentEvents || []}
        playersById={playersById}
        boardById={boardById}
        onOpenTrade={() => setTradeOpen(true)}
        onOpenRanking={() => setRankingOpen(true)}
        onToggleChat={() => setChatOpen((current) => !current)}
      />

      <PropertyModal
        modalState={activeModal}
        myActions={myActions}
        currentUserId={currentUserId}
        state={state}
        playersById={playersById}
        boardById={boardById}
        onAction={act}
        onClose={() => setModalDismissKey(modalKey)}
      />

      <TradeModal
        open={tradeOpen}
        onClose={() => setTradeOpen(false)}
        myPlayer={myPlayer}
        players={state.players}
        currentUserId={currentUserId}
        propertyTrade={propertyTrade}
        setPropertyTrade={setPropertyTrade}
        cardTrade={cardTrade}
        setCardTrade={setCardTrade}
        onAction={act}
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <RankingModal open={rankingOpen} onClose={() => setRankingOpen(false)} ranking={state.ranking} />
      <VictoryCeremony
        state={state}
        playersById={playersById}
        currentUserId={currentUserId}
        onExit={() => {
          setActiveTableId("");
          setTableMeta(null);
          setState(null);
          setMenuOpen(false);
          setChatOpen(false);
        }}
      />
      <TableMenuModal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        messages={messages}
        presence={presence}
        onSendMessage={onSendMessage}
        customTokens={customTokens}
      />

      <FloatingChat
        open={chatOpen}
        onToggle={() => setChatOpen((current) => !current)}
        connectionStatus={connectionStatus}
        currentUser={currentUser}
        messages={messages}
        players={state.players}
        onSendMessage={onSendMessage}
        customTokens={customTokens}
      />

      <TokenCustomizer
        open={tokenEditorOpen}
        onClose={() => setTokenEditorOpen(false)}
        currentPlayer={myPlayer}
        currentTokenStyle={myTokenStyle}
        onChange={persistMyToken}
        onReset={resetMyToken}
      />

      {(rollingDice || cinematic) && (
        <div className="monopoly-anim-veil" aria-hidden="true" />
      )}
    </GameLayout>
  );

}
