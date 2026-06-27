import {
  AlertTriangle,
  Building2,
  Cuboid,
  Info,
  Crown,
  Dice5,
  DoorOpen,
  Eye,
  EyeOff,
  Gavel,
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
  TimerReset,
  TrainFront,
  Trophy,
  Users,
  Wallet,
  X
} from "lucide-react";
import { Suspense, lazy, memo, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
// Lobby rediseñado: pantalla principal inmersiva + flujos Unirse/Crear.
import { audio } from "../audio";
import { useRadio } from "../radio/RadioContext";
import { monopolyTokenColors } from "./monopoly3d/monopolyTokenColors";
import { Dice } from "./shared";

const loadMonopoly3DView = () => import("./monopoly3d/Monopoly3DView");
const Monopoly3DView = lazy(loadMonopoly3DView);
const loadEyconProductPreview3D = () => import("./EyconProductPreview3D");
const EyconProductPreview3D = lazy(loadEyconProductPreview3D);

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
  crearOfertaPropiedad: "selectmenu",
  crearOfertaCartaCarcel: "selectmenu",
  crearOfertaCompraPropiedad: "selectmenu",
  crearOfertaCompraCartaCarcel: "selectmenu",
  aceptarOfertaTrato: "buypropiedad",
  rechazarOfertaTrato: null,
  cancelarOfertaTrato: null,
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
  resolverCarta: "Ver carta",
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
  crearOfertaPropiedad: "Enviar oferta",
  crearOfertaCartaCarcel: "Ofrecer pase",
  crearOfertaCompraPropiedad: "Ofertar compra",
  crearOfertaCompraCartaCarcel: "Comprar pase",
  aceptarOfertaTrato: "Aceptar oferta",
  rechazarOfertaTrato: "Rechazar oferta",
  cancelarOfertaTrato: "Cancelar oferta",
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

/* const tokenShapes = [
  { id: "circle", label: "Círculo" },
  { id: "rounded", label: "Suave" },
  { id: "square", label: "Cuadro" },
  { id: "diamond", label: "Rombo" },
  { id: "hexagon", label: "Hexágono" },
  { id: "shield", label: "Escudo" },
  { id: "star", label: "Estrella" }
]; */

const tokenColorPresets = monopolyTokenColors;

const tokenIconMap = {};
const tokenIconPresets = [];
const tokenShapes = [];
const tokenColorChoices = [];
const tokenFigureColorChoices = [];

const TOKEN_STORAGE_KEY = "monopoly-custom-tokens-v1";
const MONOPOLY_GAME_KEY = "MONOPOLY";

function normalizeTokenColor(value) {
  return String(value || "").trim().toLowerCase();
}

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

function isTokenColorLocked(product) {
  const metadata = product?.metadata || {};
  const colorMode = String(metadata.colorMode || "").toUpperCase();
  if (colorMode === "TINT" || colorMode === "FORCE" || metadata.tintable === true) return false;
  if (colorMode === "ORIGINAL") return true;
  return Boolean(metadata.colorLocked);
}

function resolveTokenStyle(player, customTokens) {
  const palette = playerAccent(player.colorIndex ?? 0);
  const playerId = player?.id ?? player?.userId;
  const tokenCosmetic = player?.cosmetics?.TOKEN?.metadata;
  const selectedColor = customTokens?.[playerId] || player?.token;
  const custom = tokenCosmetic
    ? {
        label: tokenCosmetic.glyph,
        bg: selectedColor?.bg ?? palette.bg,
        ring: selectedColor?.ring ?? palette.ring
      }
    : selectedColor;
  const label = custom?.label || initialLetters(player?.name ?? player?.username) || "?";
  const bg = custom?.bg ?? palette.bg;
  const ring = custom?.ring ?? palette.ring;
  return { label, icon: "", bg, ring, fg: "#ffffff", shape: "circle", emoji: false };
}

function buildUniqueTokenStyleMap(players = [], customTokens = {}) {
  const usedColors = new Set();
  const map = {};

  (players || []).forEach((player, index) => {
    if (!player) return;

    const playerId = player.id ?? player.userId;
    if (!playerId) return;

    const baseStyle = resolveTokenStyle({
      ...player,
      colorIndex: player.colorIndex ?? index
    }, customTokens);
    const baseColor = normalizeTokenColor(baseStyle.bg);

    if (baseColor && !usedColors.has(baseColor)) {
      usedColors.add(baseColor);
      map[playerId] = baseStyle;
      return;
    }

    const fallbackPreset = [...tokenColorPresets, ...tokenPalette].find((option) => {
      const colorKey = normalizeTokenColor(option?.bg);
      return colorKey && !usedColors.has(colorKey);
    });

    const nextStyle = fallbackPreset
      ? { ...baseStyle, bg: fallbackPreset.bg, ring: fallbackPreset.ring || baseStyle.ring }
      : baseStyle;
    const nextColor = normalizeTokenColor(nextStyle.bg);

    if (nextColor) {
      usedColors.add(nextColor);
    }

    map[playerId] = nextStyle;
  });

  return map;
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

function boardBaseRentLabel(space) {
  if (!space) return "";
  if (Array.isArray(space.rents) && space.rents.length > 0) {
    return moneyFormatter.format(space.rents[0] || 0);
  }
  if (Array.isArray(space.rentSchedule) && space.rentSchedule.length > 0) {
    return moneyFormatter.format(space.rentSchedule[0] || 0);
  }
  if (space.type === "SERVICIO_PUBLICO") {
    return "4x dados";
  }
  if (space.type === "IMPUESTO" && space.fixedAmount) {
    return moneyFormatter.format(space.fixedAmount);
  }
  return "";
}

const moneyFormatter = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

function percentRateLabel(rate) {
  return `${Math.round((Number(rate) || 0) * 100)}%`;
}

function boardTaxCardValue(space) {
  if (!space || space.type !== "IMPUESTO") return "";
  if (space.taxKind === "OPTIONAL_PERCENT") {
    return `MAX ${moneyFormatter.format(space.fixedAmount || 0)} / ${percentRateLabel(space.percentRate)}`;
  }
  return moneyFormatter.format(space.fixedAmount || 0);
}

function boardTaxRuleText(space) {
  if (!space || space.type !== "IMPUESTO") return "";
  if (space.taxKind === "OPTIONAL_PERCENT") {
    return `Se cobra automaticamente el mayor entre ${moneyFormatter.format(space.fixedAmount || 0)} y ${percentRateLabel(space.percentRate)} de patrimonio.`;
  }
  return `Pago fijo de ${moneyFormatter.format(space.fixedAmount || 0)} al banco.`;
}

function resolvePendingTaxSelection(pendingTax) {
  if (!pendingTax) return { amount: 0, mode: "FIXED" };

  const fixedAmount = pendingTax.fixedAmount || 0;
  const percentAmount = pendingTax.percentAmount || 0;

  if (pendingTax.selectedAmount !== undefined && pendingTax.selectedAmount !== null) {
    return {
      amount: pendingTax.selectedAmount,
      mode: pendingTax.selectedMode || (pendingTax.selectedAmount > fixedAmount ? "PERCENT" : "FIXED")
    };
  }

  return percentAmount > fixedAmount
    ? { amount: percentAmount, mode: "PERCENT" }
    : { amount: fixedAmount, mode: "FIXED" };
}

function pendingTaxAppliedLabel(pendingTax) {
  const selection = resolvePendingTaxSelection(pendingTax);
  return selection.mode === "PERCENT"
    ? `Patrimonio ${moneyFormatter.format(selection.amount)}`
    : `Fijo ${moneyFormatter.format(selection.amount)}`;
}

function pendingTaxAppliedReason(pendingTax) {
  const selection = resolvePendingTaxSelection(pendingTax);
  const fixedAmount = pendingTax?.fixedAmount || 0;
  const percentAmount = pendingTax?.percentAmount || 0;

  if (selection.mode === "PERCENT") {
    return `El patrimonio (${moneyFormatter.format(percentAmount)}) supera el fijo (${moneyFormatter.format(fixedAmount)}).`;
  }

  return `El fijo (${moneyFormatter.format(fixedAmount)}) supera o empata el patrimonio (${moneyFormatter.format(percentAmount)}).`;
}

const MONOPOLY_3D_DEBUG_KEY = "monopoly3dDebug";

function isMonopoly3DDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MONOPOLY_3D_DEBUG_KEY) === "1";
  } catch (error) {
    return false;
  }
}

function debugMonopoly3DSelection(label, payload) {
  if (!isMonopoly3DDebugEnabled()) return;
  console.debug(`[Monopoly3D] ${label}`, payload);
}

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

function stableHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function pickVariant(seed, variants) {
  if (!variants?.length) return "";
  return variants[stableHash(seed) % variants.length];
}

function sameEntityId(left, right) {
  if (left === null || left === undefined || right === null || right === undefined) {
    return false;
  }

  return String(left) === String(right);
}

function tradeOfferRecipientId(offer) {
  return offer?.recipientId ?? offer?.buyerId;
}

function tradeOfferInitiatorId(offer) {
  return offer?.initiatorId ?? offer?.sellerId;
}

const defaultPropertyTrade = Object.freeze({
  intent: "sell",
  propertyId: "",
  buyerId: "",
  sellerId: "",
  price: 100,
  liftMortgage: false,
  source: "market"
});

const defaultCardTrade = Object.freeze({
  intent: "sell",
  deck: "CASUALIDAD",
  buyerId: "",
  sellerId: "",
  price: 100
});

function Money({ amount, className = "" }) {
  return <span className={className}>{moneyFormatter.format(amount || 0)}</span>;
}

function auctionMinimumBid(auction) {
  if (!auction) return 1;
  if (auction.minimumBid) return auction.minimumBid;
  if (auction.currentBid > 0) return Math.ceil(auction.currentBid * 1.25);
  return Math.max(1, Math.ceil((auction.meta?.basePrice || 0) * 0.25));
}

function quickAuctionBids(auction, availableCash = 0) {
  const minimum = auctionMinimumBid(auction);
  const current = auction?.currentBid || 0;
  return [...new Set([
    minimum,
    Math.max(minimum, current + 50),
    Math.max(minimum, current + 100),
    Math.max(minimum, Math.ceil(minimum * 1.25)),
    availableCash
  ])].filter((amount) => amount > 0 && amount <= availableCash).sort((left, right) => left - right).slice(0, 5);
}

function hasPendingDoubleReroll(state) {
  return Boolean(
    state?.turn?.phase === "AWAITING_TURN_END" &&
    state?.turn?.extraTurnEarned &&
    !state?.turn?.noExtraTurnBecauseJail
  );
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
      return AlertTriangle;
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

const boardTokenColumnWeights = Array(11).fill(1);
const boardTokenRowWeights = Array(11).fill(1);
const CINEMATIC_DICE_FOCUS_MS = 520;
const CINEMATIC_DICE_ROLL_MS = 1180;
const CINEMATIC_DICE_PHASE_MS = CINEMATIC_DICE_FOCUS_MS + CINEMATIC_DICE_ROLL_MS;
const CINEMATIC_DICE_REST_MS = 320;
const CINEMATIC_DICE_MAX_ROLL_MS = 4600;
const CINEMATIC_DICE_SETTLE_POLL_MS = 50;
const CINEMATIC_TARGET_HIGHLIGHT_MS = 220;
const CINEMATIC_STEP_MS = 330;
const CINEMATIC_SETTLE_HOLD_MS = 900;
const MIN_DICE_STATE_HOLD_MS = 420;
const CARD_MODAL_REVEAL_DELAY_MS = 1150;
const MONEY_BURST_LIFETIME_MS = 2800;

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
    const selectedTax = resolvePendingTaxSelection(pendingTax);
    return {
      tone: "warn",
      eyebrow: "Impuesto",
      title: `${currentPlayer?.name || "Jugador"} debe resolver un impuesto`,
      body: `Se aplicara ${moneyFormatter.format(selectedTax.amount)} automaticamente. ${pendingTaxAppliedReason(pendingTax)}`
    };
  }

  if (pendingCard?.card) {
    const actorName = playersById.get(state.currentPlayerId)?.name || "Jugador";
    return {
      tone: "info",
      eyebrow: cardDeckLabel(pendingCard.deck),
      title: pendingCard.card.title || pendingCard.card.text || "Carta pendiente",
      body: cardSceneCopy(pendingCard.card, pendingCard.deck, actorName)
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

function quickAction({ state, myActions, pendingCard, pendingDebt, pendingPurchaseSpace, auction, pendingTax }) {
  if (pendingPurchaseSpace && myActions.includes("comprarPropiedad")) {
    return { action: "comprarPropiedad", label: "Comprar casilla" };
  }

  if (pendingCard && myActions.includes("resolverCarta")) {
    return { action: "resolverCarta", label: "Ver carta" };
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
    return { action: "terminarTurno", label: hasPendingDoubleReroll(state) ? "Volver a tirar" : "Terminar turno" };
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
  REPARACIONES: "reparaciones",
  COMPRA_CASA: "compra de casa",
  COMPRA_HOTEL: "compra de hotel",
  VENTA_CASA: "venta de casa",
  VENTA_HOTEL: "venta de hotel",
  HIPOTECA: "hipoteca",
  LEVANTAR_HIPOTECA: "levantar hipoteca"
};

function eventTone(type) {
  if (type.includes("BANKRUPTCY") || type.includes("JAIL") || type.includes("DEBT")) return "danger";
  if (type.includes("PURCHASED") || type.includes("RECEIVED") || type.includes("EXTRA_TURN") || type === "GAME_STARTED") return "success";
  if (type.includes("AUCTION") || type.includes("PAID") || type.includes("MORTGAGE")) return "warn";
  return "info";
}

function shouldShowEvent(event) {
  return !["PLAYER_MOVED", "PLAYER_MOVED_TO", "SPACE_RESOLVED"].includes(event?.type);
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
      return {
        title: payload.reason === "PASO_POR_SALIDA" ? `${playerName(payload.playerId)} paso por salida` : `${playerName(payload.playerId)} recibe dinero`,
        body: `${moneyFormatter.format(payload.amount || 0)} por ${reasonLabel[payload.reason] || "evento del tablero"}. Saldo: ${moneyFormatter.format(payload.cashBefore || 0)} -> ${moneyFormatter.format(payload.cashAfter || 0)}.`
      };
    case "PLAYER_PAID":
      return {
        title: `${playerName(payload.playerId)} pago ${moneyFormatter.format(payload.amount || 0)}`,
        body: payload.creditorId
          ? `${playerName(payload.creditorId)} recibio el pago por ${reasonLabel[payload.reason] || payload.reason || "movimiento"}. Saldo: ${moneyFormatter.format(payload.cashBefore || 0)} -> ${moneyFormatter.format(payload.cashAfter || 0)}.`
          : `${reasonLabel[payload.reason] || payload.reason || "movimiento"}. Saldo: ${moneyFormatter.format(payload.cashBefore || 0)} -> ${moneyFormatter.format(payload.cashAfter || 0)}.`
      };
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
      return { title: `${playerName(payload.playerId)} construyo una casa`, body: `Pago ${moneyFormatter.format(payload.amount || 0)} sobre ${propertyName(payload.propertyId)}.` };
    case "HOTEL_PURCHASED":
      return { title: `${playerName(payload.playerId)} construyo un hotel`, body: `Pago ${moneyFormatter.format(payload.amount || 0)} en ${propertyName(payload.propertyId)}.` };
    case "HOUSE_SOLD":
      return { title: `${playerName(payload.playerId)} vendio una casa`, body: `Recibio ${moneyFormatter.format(payload.amount || 0)} por ${propertyName(payload.propertyId)}.` };
    case "HOTEL_SOLD":
      return { title: `${playerName(payload.playerId)} vendio un hotel`, body: `Recibio ${moneyFormatter.format(payload.amount || 0)} por ${propertyName(payload.propertyId)}.` };
    case "PROPERTY_MORTGAGED":
      return { title: `${playerName(payload.playerId)} hipoteco ${propertyName(payload.propertyId)}`, body: `Recibio ${moneyFormatter.format(payload.amount || 0)}. La renta queda desactivada.` };
    case "MORTGAGE_LIFTED":
      return { title: `${playerName(payload.playerId)} levanto una hipoteca`, body: `Pago ${moneyFormatter.format(payload.liftCost || 0)} y ${propertyName(payload.propertyId)} vuelve a producir renta.` };
    case "PROPERTY_TRADED":
      return { title: `${playerName(payload.sellerId)} transfiere ${propertyName(payload.propertyId)}`, body: `${playerName(payload.buyerId)} paga ${moneyFormatter.format(payload.price || 0)}.` };
    case "JAIL_CARD_TRADED":
      return { title: `${playerName(payload.sellerId)} vende carta de carcel`, body: `${playerName(payload.buyerId)} paga ${moneyFormatter.format(payload.price || 0)}.` };
    case "TRADE_OFFER_CREATED":
      return {
        title: payload.direction === "BUY"
          ? `${playerName(payload.buyerId)} quiere comprar`
          : `${playerName(payload.sellerId)} envia una oferta`,
        body: payload.type === "PROPERTY"
          ? payload.direction === "BUY"
            ? `${propertyName(payload.propertyId)} por ${moneyFormatter.format(payload.price || 0)} a ${playerName(payload.sellerId)}.`
            : `${propertyName(payload.propertyId)} por ${moneyFormatter.format(payload.price || 0)} para ${playerName(payload.buyerId)}.`
          : payload.direction === "BUY"
            ? `Pase de ${cardDeckLabel(payload.deck)} por ${moneyFormatter.format(payload.price || 0)} a ${playerName(payload.sellerId)}.`
            : `Pase de ${cardDeckLabel(payload.deck)} por ${moneyFormatter.format(payload.price || 0)} para ${playerName(payload.buyerId)}.`
      };
    case "TRADE_OFFER_ACCEPTED":
      return { title: `${playerName(payload.buyerId)} acepta una oferta`, body: "El trato se ejecuto y la mesa actualizo activos." };
    case "TRADE_OFFER_REJECTED":
      return { title: `${playerName(payload.buyerId)} rechaza una oferta`, body: "No hubo transferencia. Nadie firmo nada raro." };
    case "TRADE_OFFER_CANCELLED":
      return { title: `${playerName(payload.sellerId)} cancela una oferta`, body: "El trato salio del mercado." };
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

function cardDeckLabel(deck) {
  return deck === "CASUALIDAD" ? "Casualidad" : "Arca comunal";
}

function cardDeckClass(deck) {
  return deck === "CASUALIDAD" ? "deck-chance" : "deck-chest";
}

function cardActionLabel(card) {
  return card?.effect === "SALIR_LIBRE_CARCEL" ? "Guardar carta" : "Aceptar efecto";
}

function cardPreviewLabel(card) {
  return card?.effect === "SALIR_LIBRE_CARCEL" ? "Carta guardable" : "Efecto inmediato";
}

function cardPreviewIcon(card, deck) {
  if (card?.effect === "SALIR_LIBRE_CARCEL") return DoorOpen;
  return deck === "CASUALIDAD" ? Sparkles : Landmark;
}

function cardPlayerName(playerName = "Jugador") {
  const normalized = String(playerName || "Jugador").trim() || "Jugador";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function cardSceneCopy(card, deck, playerName = "Jugador") {
  const title = card?.title || "Carta";
  const effect = card?.effect || "GENERICA";
  const name = cardPlayerName(playerName);
  const seed = `${deck}:${effect}:${name}:${title}:scene`;
  const jailFree = card?.effect === "SALIR_LIBRE_CARCEL";
  const variants = jailFree
    ? [
        `${name} acaba de lootear un salvoconducto con olor a abogado caro.`,
        `Inventario actualizado: ${name} ahora trae fuga legal en el bolsillo.`,
        `${name} encontro el boton de "no era penal, arbitro". Guardalo con respeto.`
      ]
    : deck === "CASUALIDAD"
      ? [
          `${name} jalo la palanca del caos y el tablero dijo: va de nuevo.`,
          `Casualidad acaba de mandarle a ${name} un plot twist con risa de villano.`,
          `${name} abrio el sobre prohibido. Huele a meme financiero y peligro.`
        ]
      : [
          `La comunidad se junto cinco minutos y ya le armo lore a ${name}.`,
          `${name} recibio carta vecinal: medio apoyo, medio chisme, cero paz.`,
          `Arca comunal saco el altavoz. ${name}, ven tantito, no te va a doler mucho.`
        ];
  return pickVariant(seed, variants);
}

function cardBodyCopy(card, deck, playerName = "Jugador") {
  const title = card?.title || "Carta";
  const effect = card?.effect || "GENERICA";
  const seed = `${deck}:${effect}:${playerName}:${title}:body`;
  const jailFree = card?.effect === "SALIR_LIBRE_CARCEL";
  const variants = jailFree
    ? [
        `Si ${playerName} acaba cayendo preso, esta joyita evitara la caminata de la vergüenza.`,
        `${playerName} puede guardarla y sonreir con discrecion cuando llegue la patrulla.`,
        `Conviene guardarla: ${playerName} podria agradecer este comodin mas adelante.`,
        `Es una carta para el inventario de ${playerName}; futuro problema, futura solucion.`,
        `${playerName} no la juega hoy: la atesora para un escape con clase cuando toque.`
      ]
    : [
        `${playerName} necesita aceptar el efecto para que el drama siga su curso natural.`,
        `Cuando ${playerName} pulse el boton, el tablero hara lo suyo sin pedir permiso.`,
        `Toca resolverla para que ${playerName} siga con el turno y con su destino dudoso.`,
        `El mazo ya hizo su parte; ahora ${playerName} tiene que comerse el efecto.`,
        `${playerName} esta a un click de descubrir si esto fue premio, castigo o comedia.`
      ];
  return pickVariant(seed, variants);
}

function cardDisplayTitle(card) {
  const titles = {
    chance_advance_go: "Turbo hasta Salida",
    chance_advance_illinois: "Fast travel a Buenos Aires",
    chance_advance_st_charles: "Mision express: Arequipa",
    chance_nearest_utility: "Servicio cercano: modo boss",
    chance_nearest_railroad_1: "Tren mas cercano x2",
    chance_nearest_railroad_2: "Otro tren, doble drama",
    chance_bank_dividend: "Dividendos inesperados",
    chance_get_out_jail: "Llave ninja de carcel",
    chance_go_back_three: "Rollback de tres casillas",
    chance_go_to_jail: "Patrulla activada",
    chance_general_repairs: "Parche de edificios",
    chance_poor_tax: "Impuesto anti suerte",
    chance_reading_railroad: "Ruta directa al Tren Maya",
    chance_boardwalk: "Portal a Ciudad de Mexico",
    chance_chairman: "Presidente del consejo",
    chance_building_loan: "Prestamo cobrado",
    chest_advance_go: "La comunidad te empuja a Salida",
    chest_bank_error: "Bug bancario premium",
    chest_doctors_fee: "Consulta medica premium",
    chest_sale_of_stock: "Acciones vendidas en verde",
    chest_get_out_jail: "Pase vecinal anti carcel",
    chest_go_to_jail: "Vecinos llamaron patrulla",
    chest_holiday_fund: "Fondo navideno liberado",
    chest_income_tax_refund: "Reembolso fiscal mini",
    chest_birthday: "Cumple con loot vecinal",
    chest_life_insurance: "Seguro de vida cobrado",
    chest_hospital_fees: "Factura de hospital",
    chest_school_fees: "Colegiatura legendaria",
    chest_consultancy_fee: "Consultoria cobrada",
    chest_street_repairs: "Calles en mantenimiento",
    chest_beauty_contest: "Concurso ganado por carisma",
    chest_inheritance: "Herencia sorpresa"
  };

  return titles[card?.id] || card?.title || "Carta de tablero";
}

function cardFlavorCopy(card, deck, playerName = "Jugador") {
  if (card?.text && card.text !== card.title) {
    return card.text;
  }

  const name = cardPlayerName(playerName);
  const amount = moneyFormatter.format(card?.amount || 0);
  const effect = card?.effect || "";
  const seed = `${deck}:${effect}:${card?.id || card?.title}:${name}:flavor`;
  const byEffect = {
    RECIBIR_DINERO: [
      `El banco se distrajo y ${name} acaba de agarrar botin limpio: ${amount}.`,
      `${name} recibe ${amount}. No preguntes de donde salio; agradece el bug.`,
      `Loot financiero desbloqueado: ${amount} directo a la cartera de ${name}.`
    ],
    PAGAR_DINERO: [
      `${name} paga ${amount}. El tablero cobro peaje emocional y fiscal.`,
      `Factura sorpresa para ${name}: ${amount}. Duele, pero con estilo.`,
      `${name} suelta ${amount}. El banco sonrie como jefe final.`
    ],
    RECIBIR_DE_CADA_JUGADOR: [
      `Todos cooperan con ${name}. Cumpleanos, extorsion cute o milagro vecinal.`,
      `${name} activa modo vaquita: cada rival pone su monedita y cara de resignacion.`,
      `La mesa financia a ${name}. Democracia economica, pero chistosa.`
    ],
    PAGAR_A_CADA_JUGADOR: [
      `${name} fue nombrado importante y ahora paga la fiesta. Clasico.`,
      `Cargo honorifico desbloqueado: ${name} le debe a todos y encima con sonrisa.`,
      `${name} reparte ${amount} por jugador. Liderazgo, pero en modo cartera rota.`
    ],
    MOVER_A: [
      `${name} hace fast travel. Si la casilla trae renta, que Dios reparta suerte.`,
      `Teletransporte de mesa: ${name} va directo al siguiente problema elegante.`,
      `${name} cambia de escena sin tutorial. El mapa acaba de ponerse picante.`
    ],
    MOVER_A_FERROCARRIL_MAS_CERCANO: [
      `${name} corre al tren mas cercano. El boleto puede venir con impuesto de drama.`,
      `Sube al vagon, ${name}. Si hay dueno, la renta viene en version remix.`,
      `Tren localizado. ${name} aborda con fe y la cartera sudando.`
    ],
    MOVER_A_SERVICIO_MAS_CERCANO: [
      `${name} visita servicios publicos. Spoiler: la factura trae esteroides.`,
      `Agua, luz o caos: ${name} va al servicio mas cercano y el medidor se rie.`,
      `Servicio localizado. ${name} acaba de desbloquear recibo premium.`
    ],
    RETROCEDER: [
      `${name} retrocede tres espacios. No es error, es rollback con humillacion.`,
      `El tablero le dio Ctrl+Z a ${name}. Tres pasos atras y cara de "era bait".`,
      `${name} hace moonwalk obligatorio. Tres casillas, cero dignidad.`
    ],
    IR_A_CARCEL: [
      `${name} activo alerta roja. Directo a carcel, sin pasar por la tienda.`,
      `La patrulla spawneo encima de ${name}. GG libertad, nos vemos luego.`,
      `${name} recibe teleport policial. La celda ya tenia su nombre en marcador.`
    ],
    REPARACIONES: [
      `${name} abre mantenimiento de emergencia. Cada casa y hotel pide su mordida.`,
      `El imperio de ${name} necesita parche. El changelog viene con factura.`,
      `Reparaciones generales: el tablero vio edificios y olio efectivo.`
    ],
    SALIR_LIBRE_CARCEL: [
      `${name} guarda una fuga legal. No brilla mucho, pero salva partidas.`,
      `Carta equipable: ${name} ahora tiene permiso para hacer vanish de la carcel.`,
      `Esto no paga renta, pero compra paz mental carcelaria. Mucha clase.`
    ]
  };

  return pickVariant(seed, byEffect[effect] || [cardBodyCopy(card, deck, name)]);
}

function cardRuleCopy(card, deck) {
  const effect = card?.effect || "";
  switch (effect) {
    case "RECIBIR_DINERO":
      return `Ganas ${moneyFormatter.format(card.amount || 0)}.`;
    case "PAGAR_DINERO":
      return `Pagas ${moneyFormatter.format(card.amount || 0)} al banco.`;
    case "RECIBIR_DE_CADA_JUGADOR":
      return `Cada rival te paga ${moneyFormatter.format(card.amount || 0)}.`;
    case "PAGAR_A_CADA_JUGADOR":
      return `Pagas ${moneyFormatter.format(card.amount || 0)} a cada rival.`;
    case "RETROCEDER":
      return `Retrocedes ${card.steps || 0} casillas.`;
    case "MOVER_A":
      return "Te mueves a la casilla indicada.";
    case "MOVER_A_FERROCARRIL_MAS_CERCANO":
      return "Avanzas al tren mas cercano; si tiene dueno, la renta se duplica.";
    case "MOVER_A_SERVICIO_MAS_CERCANO":
      return "Avanzas al servicio mas cercano y la renta usa multiplicador especial.";
    case "IR_A_CARCEL":
      return "Vas directo a la carcel.";
    case "REPARACIONES":
      return "Pagas reparaciones por cada casa y hotel.";
    case "SALIR_LIBRE_CARCEL":
      return `Se guarda como pase de ${cardDeckLabel(deck)}.`;
    default:
      return "";
  }
}

function cardFooterCopy(card, deck, playerName = "Jugador") {
  const title = card?.title || "Carta";
  const effect = card?.effect || "GENERICA";
  const seed = `${deck}:${effect}:${playerName}:${title}:footer`;
  const jailFree = card?.effect === "SALIR_LIBRE_CARCEL";
  const variants = jailFree
    ? [
        "Se queda en tu inventario para una fuga premium",
        "Carta guardable para futuros problemas carcelarios",
        "Se archiva con cariño en tu kit de supervivencia",
        "Pasa directo a tu reserva de escapes con estilo",
        "Se equipa como comodin legal de emergencia"
      ]
    : [
        "Se ejecuta al instante y sin boton de deshacer",
        "Impacto inmediato, cero burocracia",
        "El efecto cae ahora mismo sobre la mesa",
        "Se activa en este turno con todo y drama",
        "Resolucion instantanea, que el destino reparta"
      ];
  return pickVariant(seed, variants);
}

function cardContentDensityClass(card, deck, playerName = "Jugador") {
  const copy = [
    cardDeckLabel(deck),
    cardPreviewLabel(card),
    cardDisplayTitle(card),
    cardFlavorCopy(card, deck, playerName),
    cardRuleCopy(card, deck),
    cardFooterCopy(card, deck, playerName)
  ].filter(Boolean).join(" ");

  if (copy.length >= 260) return "copy-xl";
  if (copy.length >= 190) return "copy-long";
  return "";
}

function amountPresets(baseAmount, extras = []) {
  const normalizedBase = Math.max(50, Math.round((Number(baseAmount) || 100) / 50) * 50);
  const values = [
    normalizedBase,
    Math.max(50, normalizedBase - 100),
    normalizedBase + 100,
    normalizedBase + 250,
    normalizedBase + 500,
    ...extras
  ];
  return [...new Set(values.map((value) => Math.max(0, Math.round(Number(value) || 0))))]
    .filter((value) => value > 0)
    .sort((left, right) => left - right)
    .slice(0, 6);
}

function propertyTradeBanter({ sellerName = "Tú", buyerName = "alguien", propertyName = "esa propiedad", price = 0 }) {
  const seed = `${sellerName}:${buyerName}:${propertyName}:${price}:property-trade`;
  return pickVariant(seed, [
    `${sellerName} le esta poniendo moño a ${propertyName} para ver si ${buyerName} cae con la cartera abierta.`,
    `${buyerName} puede salir de aqui con ${propertyName} y una sonrisa de villano inmobiliario.`,
    `${sellerName} esta a nada de convertir ${propertyName} en trato cerrado y mirada sospechosa de ${buyerName}.`,
    `${propertyName} ya esta en vitrina. Falta ver si ${buyerName} compra o solo vino a pasear.`,
    `${sellerName} y ${buyerName} estan negociando como si esto fuera un mercado negro elegante de Monopoly.`,
    `${propertyName} podria cambiar de manos hoy si ${buyerName} no se hace el dificil con el precio.`,
    `${sellerName} ya puso a ${propertyName} bajo reflectores. Ahora que hable la billetera de ${buyerName}.`
  ]);
}

function jailCardTradeBanter({ sellerName = "Tú", buyerName = "alguien", deckLabel = "Carta", price = 0 }) {
  const seed = `${sellerName}:${buyerName}:${deckLabel}:${price}:jail-card`;
  return pickVariant(seed, [
    `${sellerName} esta vendiendo libertad embotellada y ${buyerName} podria necesitarla pronto.`,
    `${buyerName} puede comprar tranquilidad futura antes de que lo visite la patrulla.`,
    `${sellerName} saco al mercado una salida de emergencia con precio de amigo dudoso.`,
    `${deckLabel} viene con promesa de escape elegante si ${buyerName} afloja la lana.`,
    `${sellerName} ofrece un "por si acaso" carcelario que ${buyerName} podria agradecer bastante.`,
    `${buyerName} esta a un clic de comprar paz mental para su yo del futuro.`,
    `No es una carta, es un seguro anti drama. Falta ver si ${buyerName} lo entiende.`
  ]);
}

function tradePropertyGroup(property) {
  if (property?.colorGroup && colorGroupMeta[property.colorGroup]) {
    return {
      key: property.colorGroup,
      label: colorGroupMeta[property.colorGroup].label,
      accent: colorGroupMeta[property.colorGroup].color,
      copy: "Pais / grupo de color"
    };
  }

  if (property?.propertyKind === "FERROCARRIL" || property?.type === "FERROCARRIL") {
    return { key: "transportes", label: "Transportes", accent: "#8a5a00", copy: "Rutas y trenes" };
  }

  if (property?.propertyKind === "SERVICIO_PUBLICO" || property?.type === "SERVICIO_PUBLICO") {
    return { key: "servicios", label: "Servicios", accent: "#0f766e", copy: "Agua, luz y facturas" };
  }

  return { key: "otros", label: "Otros activos", accent: "#7c5d38", copy: "Propiedades especiales" };
}

function groupTradeProperties(properties = []) {
  const groups = new Map();
  properties.forEach((property) => {
    const meta = tradePropertyGroup(property);
    if (!groups.has(meta.key)) {
      groups.set(meta.key, { ...meta, properties: [] });
    }
    groups.get(meta.key).properties.push(property);
  });

  return [...groups.values()].map((group) => ({
    ...group,
    properties: [...group.properties].sort((left, right) => {
      const leftPrice = left.price || left.mortgageValue || 0;
      const rightPrice = right.price || right.mortgageValue || 0;
      return rightPrice - leftPrice;
    })
  }));
}

function propertyTradeBlockReason(property, properties = []) {
  if (!property?.colorGroup) return "";
  const groupHasBuildings = properties.some((candidate) => (
    candidate.colorGroup === property.colorGroup &&
    ((candidate.houses || 0) > 0 || candidate.hasHotel)
  ));

  return groupHasBuildings ? "Primero vende las casas u hoteles de este color." : "";
}

function mortgageTransferCost(property, liftMortgage) {
  if (!property?.isMortgaged) return 0;
  const transferInterest = Math.ceil((property.mortgageValue || 0) * 0.1);
  return transferInterest + (liftMortgage ? property.mortgageValue || 0 : 0);
}

function moneyBurstText(amount, prefix) {
  return `${prefix}${moneyFormatter.format(Math.abs(amount || 0))}`;
}

function buildMoneyBursts(event, playersById, boardById) {
  const payload = event?.payload || {};
  const player = playersById.get(payload.playerId || payload.debtorId);
  const playerSpace = Number.isFinite(player?.position) ? player.position : 0;
  const creditor = playersById.get(payload.creditorId);
  const creditorSpace = Number.isFinite(creditor?.position) ? creditor.position : playerSpace;
  const bursts = [];

  if (event?.type === "PLAYER_RECEIVED_MONEY" && payload.amount > 0) {
    bursts.push({
      id: `${event.id}-gain`,
      spaceIndex: payload.reason === "PASO_POR_SALIDA" ? 0 : playerSpace,
      playerId: payload.playerId || null,
      label: moneyBurstText(payload.amount, "+"),
      tone: "gain",
      slot: 0
    });
  }

  if (event?.type === "PLAYER_PAID" && payload.amount > 0) {
    bursts.push({
      id: `${event.id}-loss`,
      spaceIndex: playerSpace,
      playerId: payload.playerId || null,
      label: moneyBurstText(payload.amount, "-"),
      tone: "loss",
      slot: 0
    });

    if (payload.creditorId) {
      bursts.push({
        id: `${event.id}-creditor-gain`,
        spaceIndex: creditorSpace,
        playerId: payload.creditorId,
        label: moneyBurstText(payload.amount, "+"),
        tone: "gain",
        slot: 0
      });
    }
  }

  if (event?.type === "PROPERTY_PURCHASED" && payload.price > 0) {
    const space = boardById.get(payload.propertyId);
    bursts.push({
      id: `${event.id}-purchase`,
      spaceIndex: Number.isFinite(space?.index) ? space.index : playerSpace,
      playerId: payload.playerId || null,
      label: moneyBurstText(payload.price, "-"),
      tone: "loss",
      slot: 0
    });
  }

  if ((event?.type === "JAIL_FINE_PAID" || event?.type === "DEBT_PAID") && payload.amount > 0) {
    bursts.push({
      id: `${event.id}-paid`,
      spaceIndex: playerSpace,
      playerId: payload.playerId || payload.debtorId || null,
      label: moneyBurstText(payload.amount, "-"),
      tone: "loss",
      slot: 0
    });
  }

  return bursts;
}

function eventBurstDelay(event, movementTimeline) {
  if (!movementTimeline) return 0;
  const payload = event?.payload || {};
  const stepStart = CINEMATIC_DICE_PHASE_MS + CINEMATIC_DICE_REST_MS + CINEMATIC_TARGET_HIGHLIGHT_MS;

  if (event?.type === "PLAYER_RECEIVED_MONEY" && payload.reason === "PASO_POR_SALIDA") {
    const passGoIndex = movementTimeline.path.findIndex((position) => position === 0);
    if (passGoIndex >= 0) {
      return stepStart + passGoIndex * CINEMATIC_STEP_MS + Math.floor(CINEMATIC_STEP_MS * 0.42);
    }
  }

  if (["PLAYER_PAID", "PROPERTY_PURCHASED", "JAIL_FINE_PAID", "DEBT_PAID"].includes(event?.type)) {
    return stepStart + movementTimeline.path.length * CINEMATIC_STEP_MS + 240;
  }

  return 0;
}

function eventToastDelay(event, movementTimeline) {
  if (!movementTimeline) return 0;
  const payload = event?.payload || {};
  const stepStart = CINEMATIC_DICE_PHASE_MS + CINEMATIC_DICE_REST_MS + CINEMATIC_TARGET_HIGHLIGHT_MS;
  const landingDelay = stepStart + movementTimeline.path.length * CINEMATIC_STEP_MS + 220;

  if (event?.type === "PLAYER_RECEIVED_MONEY" && payload.reason === "PASO_POR_SALIDA") {
    const passGoIndex = movementTimeline.path.findIndex((position) => position === 0);
    if (passGoIndex >= 0) {
      return stepStart + passGoIndex * CINEMATIC_STEP_MS + Math.floor(CINEMATIC_STEP_MS * 0.42);
    }
  }

  if ([
    "CARD_DRAWN",
    "SPACE_RESOLVED",
    "PLAYER_PAID",
    "DEBT_CREATED",
    "PLAYER_SENT_TO_JAIL",
    "AUCTION_STARTED",
    "PLAYER_RECEIVED_MONEY"
  ].includes(event?.type)) {
    return landingDelay;
  }

  return 0;
}

function eventSoundDelay(event, movementTimeline) {
  if (event?.type === "CARD_DRAWN") {
    const movementDelay = movementTimeline
      ? CINEMATIC_DICE_PHASE_MS + CINEMATIC_DICE_REST_MS + CINEMATIC_TARGET_HIGHLIGHT_MS + movementTimeline.path.length * CINEMATIC_STEP_MS
      : 0;
    return movementDelay + 360;
  }
  if (!movementTimeline) return 0;
  if (event?.type === "PLAYER_SENT_TO_JAIL") {
    return CINEMATIC_DICE_PHASE_MS + CINEMATIC_DICE_REST_MS + CINEMATIC_TARGET_HIGHLIGHT_MS + movementTimeline.path.length * CINEMATIC_STEP_MS + 180;
  }
  return eventBurstDelay(event, movementTimeline);
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
  const tradeOffers = state.turn.tradeOffers || [];
  const incomingOffer = tradeOffers.find((offer) => sameEntityId(tradeOfferRecipientId(offer), currentUserId));
  const outgoingOffer = tradeOffers.find((offer) => sameEntityId(tradeOfferInitiatorId(offer), currentUserId));

  if (incomingOffer || outgoingOffer) {
    const offer = incomingOffer || outgoingOffer;
    const property = offer.type === "PROPERTY" ? boardById.get(offer.propertyId) : null;
    const sellerName = playersById.get(offer.sellerId)?.name || "Jugador";
    const buyerName = playersById.get(offer.buyerId)?.name || "Jugador";
    const incoming = Boolean(incomingOffer);
    const buyRequest = offer.direction === "BUY";
    const requesterName = playersById.get(offer.initiatorId)?.name || (buyRequest ? buyerName : sellerName);

    return {
      type: "tradeOffer",
      tone: incoming ? "success" : "info",
      blocking: incoming,
      title: offer.type === "PROPERTY"
        ? buyRequest
          ? `${buyerName} quiere ${property?.name || "una propiedad"}`
          : `${sellerName} ofrece ${property?.name || "una propiedad"}`
        : buyRequest
          ? `${buyerName} quiere un pase de carcel`
          : `${sellerName} ofrece un pase de carcel`,
      body: incoming
        ? buyRequest
          ? `${buyerName} quiere comprartelo por ${moneyFormatter.format(offer.price || 0)}. Si aceptas, el activo sale de tu inventario.`
          : `${sellerName} quiere vendertelo por ${moneyFormatter.format(offer.price || 0)}. Revisa y decide si aceptas el trato.`
        : `Oferta enviada por ${requesterName}. Falta que ${playersById.get(tradeOfferRecipientId(offer))?.name || "el otro jugador"} la acepte.`,
      offer,
      property,
      sellerName,
      buyerName,
      incoming,
      buyRequest
    };
  }

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
    const selectedTax = resolvePendingTaxSelection(state.turn.pendingTax);
    return {
      type: "tax",
      tone: "warn",
      blocking: false,
      title: `Impuesto para ${currentPlayerName}`,
      body: myTurn
        ? `Se aplicara ${moneyFormatter.format(selectedTax.amount)} automaticamente a este turno.`
        : `${currentPlayerName} debe pagar ${moneyFormatter.format(selectedTax.amount)} antes de seguir.`,
      tax: state.turn.pendingTax
    };
  }

  if (state.turn.pendingCard?.card) {
    const actorName = playersById.get(state.currentPlayerId)?.name || "Jugador";
    return {
      type: "card",
      tone: "info",
      blocking: false,
      title: state.turn.pendingCard.card.title || "Carta de tablero",
      body: cardSceneCopy(state.turn.pendingCard.card, state.turn.pendingCard.deck, actorName),
      card: state.turn.pendingCard.card,
      deck: state.turn.pendingCard.deck,
      playerName: actorName
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
        "shape-circle",
        className
      )}
      style={{ "--token-bg": tokenStyle.bg, "--token-ring": tokenStyle.ring, "--token-fg": tokenStyle.fg || "#ffffff", ...style }}
      title={title}
    >
      <span className="token-glyph">{tokenStyle.label || "?"}</span>
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
  const CardArtIcon = space.type === "CASUALIDAD" ? Sparkles : Landmark;
  const group = colorGroupMeta[space.colorGroup];
  const displayName = boardDisplayName(space);
  const ownerAccent = owner?.colorIndex !== undefined ? playerAccent(owner.colorIndex) : null;
  const ownerTokenStyle = owner ? tokenStyles[owner.id] || resolveTokenStyle(owner, {}) : null;
  const isCardSpace = space.type === "CASUALIDAD" || space.type === "ARCA_COMUNAL";
  const isTaxSpace = space.type === "IMPUESTO";
  const isGoSpace = space.type === "SALIDA";
  const cardDeckName = space.type === "CASUALIDAD" ? "Casualidad" : "Arca comunal";
  const cardDeckCode = space.type === "CASUALIDAD" ? "?" : "!";
  const rentLabel = isTaxSpace ? "" : boardBaseRentLabel(space);
  const taxRuleText = isTaxSpace ? boardTaxRuleText(space) : "";
  const propertyBand = group && !isCardSpace && !isTaxSpace ? group : null;
  const style = {
    gridRowStart: cell.row + 1,
    gridColumnStart: cell.col + 1
  };
  const buildings = Array.from({ length: Math.min(space.houses || 0, 4) });
  const tooltip = [
    space.name,
    spaceTypeLabel(space),
    space.price ? `Precio ${moneyFormatter.format(space.price)}` : null,
    isTaxSpace ? taxRuleText : null,
    rentLabel ? `Renta ${rentLabel}` : null,
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
        isGoSpace && "go-space",
        isCardSpace && "card-space",
        isTaxSpace && "tax-space",
        space.type === "CASUALIDAD" && "deck-chance",
        space.type === "ARCA_COMUNAL" && "deck-chest",
        selected && "selected",
        current && "current",
        cameraTarget && "cam-target"
      )}
      data-owner={owner ? "yes" : "no"}
      data-index={space.index}
      data-side={cell.side}
    >
      {propertyBand && <span className="monopoly-band" style={{ "--group-color": propertyBand.color }} />}
      {ownerAccent && <span className="monopoly-owner-mark" style={{ "--owner-color": ownerAccent.bg }} />}
      <div className="monopoly-space-inner">
        <div className="monopoly-space-head">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-[#7c5d38]">
            {space.index}
          </span>
          <Icon size={cell.corner ? 16 : 12} className="shrink-0 text-[#3b2b18]" />
        </div>

        <div className="monopoly-space-copy">
          {isGoSpace ? (
            <div className="monopoly-go-space-art" aria-hidden="true">
              <span className="go-mini-arrow">➜</span>
              <strong>SALIDA</strong>
              <em>Cobra $200</em>
            </div>
          ) : isCardSpace ? (
            <div className="monopoly-card-space-art" aria-hidden="true">
              <span className="card-mini-corner top">{cardDeckCode}</span>
              <span className="card-mini-corner bottom">{cardDeckCode}</span>
              <span className="card-mini-deck">{cardDeckName}</span>
              <span className="card-mini-stamp">{space.type === "CASUALIDAD" ? "Efecto sorpresa" : "Fondo comun"}</span>
              <span className="card-mini-icon"><CardArtIcon size={14} /></span>
              <strong>{displayName}</strong>
              <em>{space.type === "CASUALIDAD" ? "Caos inmediato" : "Carta vecinal"}</em>
            </div>
          ) : isTaxSpace ? (
            <div className="monopoly-tax-space-art" aria-hidden="true">
              <span className="tax-mini-corner top">$</span>
              <span className="tax-mini-corner bottom">$</span>
              <span className="tax-mini-stamp">{space.taxKind === "OPTIONAL_PERCENT" ? "Cobro mayor" : "Banco"}</span>
              <span className="tax-mini-icon"><AlertTriangle size={14} /></span>
              <strong>{displayName}</strong>
              <em>{space.taxKind === "OPTIONAL_PERCENT" ? "Mayor automatico" : "Pago obligatorio"}</em>
              <span className="monopoly-tax-space-value">{boardTaxCardValue(space)}</span>
            </div>
          ) : (
            <>
              <p className="monopoly-space-name">{displayName}</p>
              <p className="monopoly-space-meta">
                {boardMetaLabel(space, owner)}
              </p>
            </>
          )}
        </div>

        {!isTaxSpace && (space.price || rentLabel || space.houses || space.hasHotel || space.isMortgaged) && (
          <div className="space-footer">
            {space.price ? <span className="monopoly-space-price">P {moneyFormatter.format(space.price)}</span> : <span className="monopoly-space-price">{spaceTypeLabel(space)}</span>}
            {rentLabel ? <span className="monopoly-space-rent">R {rentLabel}</span> : null}
            {(space.houses > 0 || space.hasHotel) && (
              <span className="monopoly-buildings">
                {buildings.map((_, index) => (
                  <span key={`${space.id}-house-${index}`} className="monopoly-house-dot" />
                ))}
                {space.hasHotel ? <span className="monopoly-hotel-dot" /> : null}
              </span>
            )}
            {space.isMortgaged ? <span className="monopoly-mortgage-stamp">Hip.</span> : null}
            {owner && ownerTokenStyle ? (
              <span className="space-owner-badge" title={`Propiedad de ${owner.name}`}>
                <TokenChip tokenStyle={ownerTokenStyle} className="space-owner-token" />
              </span>
            ) : null}
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

const debtActionMeta = {
  hipotecarPropiedad: {
    label: "Hipotecar",
    eyebrow: "Liquidez inmediata",
    icon: Hammer
  },
  levantarHipoteca: {
    label: "Levantar",
    eyebrow: "Recuperar renta",
    icon: Landmark
  },
  comprarCasa: {
    label: "Comprar casa",
    eyebrow: "Invertir",
    icon: Building2
  },
  comprarHotel: {
    label: "Comprar hotel",
    eyebrow: "Mejora mayor",
    icon: Crown
  },
  venderCasa: {
    label: "Vender casa",
    eyebrow: "Recuperas efectivo",
    icon: Wallet
  },
  venderHotel: {
    label: "Vender hotel",
    eyebrow: "Liquidas edificios",
    icon: Wallet
  }
};

function debtActionCopy(actionName, property) {
  switch (actionName) {
    case "hipotecarPropiedad":
      return `Recibes ${moneyFormatter.format(property.mortgageValue || 0)} ahora mismo.`;
    case "levantarHipoteca":
      return `Pagas ${moneyFormatter.format((property.mortgageValue || 0) + Math.ceil((property.mortgageValue || 0) * 0.1))} para reactivar la renta.`;
    case "comprarCasa":
      return `Inviertes ${moneyFormatter.format(property.houseCost || 0)} en esta calle.`;
    case "comprarHotel":
      return `Inviertes ${moneyFormatter.format(property.hotelCost || property.houseCost || 0)} para subir a hotel.`;
    case "venderCasa":
      return `Recibes ${moneyFormatter.format(Math.floor((property.houseCost || 0) / 2))} por casa vendida.`;
    case "venderHotel":
      return `Recibes ${moneyFormatter.format(Math.floor((property.hotelCost || property.houseCost || 0) / 2))} por el hotel.`;
    default:
      return "Accion disponible.";
  }
}

function estimatePropertyLiquidity(property) {
  let total = 0;
  if (property.management?.hipotecarPropiedad?.allowed) {
    total += property.mortgageValue || 0;
  }
  if (property.management?.venderCasa?.allowed && property.houses > 0) {
    total += Math.floor((property.houseCost || 0) / 2) * property.houses;
  }
  if (property.management?.venderHotel?.allowed && property.hasHotel) {
    total += Math.floor((property.hotelCost || property.houseCost || 0) / 2);
  }
  return total;
}

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
        {buildings.houseCost > 0 && (
          <>
            <div className="deed-stat">
              <span>Costo casa</span>
              <Money amount={buildings.houseCost} className="deed-value" />
            </div>
            <div className="deed-stat">
              <span>Costo hotel</span>
              <span className="deed-value">
                {moneyFormatter.format(buildings.hotelCost || buildings.houseCost)} + casas requeridas
              </span>
            </div>
          </>
        )}
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
              const actionCost = {
                hipotecarPropiedad: `Obtienes ${moneyFormatter.format(space.mortgageValue || 0)}.`,
                levantarHipoteca: `Pagas ${moneyFormatter.format((space.mortgageValue || 0) + Math.ceil((space.mortgageValue || 0) * 0.1))}.`,
                comprarCasa: `Pagas ${moneyFormatter.format(buildings.houseCost || 0)} por casa.`,
                comprarHotel: `Pagas ${moneyFormatter.format(buildings.hotelCost || buildings.houseCost || 0)} al construir hotel.`,
                venderCasa: `Obtienes ${moneyFormatter.format(Math.floor((buildings.houseCost || 0) / 2))}.`,
                venderHotel: `Obtienes ${moneyFormatter.format(Math.floor((buildings.hotelCost || buildings.houseCost || 0) / 2))}.`
              }[actionName];
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
                    {option?.allowed ? actionCost : option?.reason || "No disponible en este momento."}
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

function MoneyBurstOverlay({ bursts = [] }) {
  if (!bursts.length) return null;

  return (
    <div className="monopoly-money-burst-overlay">
      {bursts.map((burst) => {
        const cell = boardCell(burst.spaceIndex || 0);
        const x = trackCenterPercent(boardTokenColumnWeights, cell.col);
        const y = trackCenterPercent(boardTokenRowWeights, cell.row);
        const slot = burst.slot || 0;
        return (
          <span
            key={burst.id}
            className={cx("money-burst", `tone-${burst.tone || "gain"}`, slot && "alt")}
            style={{
              left: `${x}%`,
              top: `${y}%`,
              "--burst-x": `${slot * 22 - 10}px`
            }}
          >
            {burst.label}
          </span>
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
    case "tradeOffer":
      return myActions.includes("aceptarOfertaTrato") || myActions.includes("rechazarOfertaTrato") || myActions.includes("cancelarOfertaTrato");
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

function AuctionControls({
  auction,
  playersById,
  boardById,
  bidAmount,
  setBidAmount,
  canBidAuction,
  canPassAuction,
  onAction,
  compact = false
}) {
  if (!auction) return null;

  const property = boardById?.get(auction.assetId);
  const activeBidder = playersById.get(auction.activeBidderId);
  const highBidder = playersById.get(auction.currentBidderId);
  const minimum = auctionMinimumBid(auction);
  const activeCash = activeBidder?.cash || 0;
  const bidIsValid = bidAmount >= minimum && bidAmount <= activeCash;
  const quickBids = quickAuctionBids(auction, activeCash);
  const visibleParticipants = (auction.participantIds || []).map((playerId) => {
    const player = playersById.get(playerId);
    return {
      id: playerId,
      name: player?.name || "Jugador",
      cash: player?.cash || 0,
      passed: (auction.passedPlayerIds || []).includes(playerId)
    };
  });

  return (
    <div className={cx("auction-play-panel", compact && "compact")}>
      <div className="auction-play-head">
        <div>
          <p className="monopoly-panel-eyebrow">Subasta en vivo</p>
          <h4>{property?.name || "Propiedad"}</h4>
        </div>
        <span className="auction-pulse"><Gavel size={16} /> 25%</span>
      </div>

      <div className="auction-stats-grid">
        <div>
          <span>Precio base</span>
          <strong>{moneyFormatter.format(auction.meta?.basePrice || property?.price || 0)}</strong>
        </div>
        <div>
          <span>Puja actual</span>
          <strong>{moneyFormatter.format(auction.currentBid || 0)}</strong>
        </div>
        <div>
          <span>Mayor postor</span>
          <strong>{highBidder?.name || "Sin ofertas"}</strong>
        </div>
        <div>
          <span>Minima siguiente</span>
          <strong>{moneyFormatter.format(minimum)}</strong>
        </div>
      </div>

      <div className="auction-player-bank">
        {visibleParticipants.map((player) => (
          <span key={player.id} className={cx(player.id === auction.activeBidderId && "active", player.passed && "passed")}>
            {player.name}
            <em>{moneyFormatter.format(player.cash)}</em>
          </span>
        ))}
      </div>

      {(canBidAuction || canPassAuction) && (
        <div className="auction-bid-console">
          {canBidAuction && (
            <>
              <div className="auction-quick-bids">
                {quickBids.map((amount) => (
                  <button key={amount} type="button" onClick={() => setBidAmount(amount)}>
                    {moneyFormatter.format(amount)}
                  </button>
                ))}
              </div>
              <input
                className="monopoly-input auction-bid-input"
                type="number"
                min={minimum}
                max={activeCash}
                value={bidAmount}
                onChange={(event) => setBidAmount(Number(event.target.value))}
              />
              <ActionButton
                disabled={!bidIsValid}
                onClick={() => onAction("hacerOferta", { monto: bidAmount })}
              >
                <Gavel size={18} />
                Ofertar
              </ActionButton>
            </>
          )}
          {canPassAuction && (
            <ActionButton tone="danger" onClick={() => onAction("retirarseDeSubasta")}>
              Retirarse
            </ActionButton>
          )}
          {canBidAuction && !bidIsValid && (
            <p className="auction-bid-warning">
              La puja debe ser minimo {moneyFormatter.format(minimum)} y no superar tu dinero disponible.
            </p>
          )}
        </div>
      )}
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

function ActionModal({ modalState, myActions, currentUserId, state, playersById, boardById, onAction, onClose, onManageDebt }) {
  const [modalBidAmount, setModalBidAmount] = useState(1);

  useEffect(() => {
    if (modalState?.type === "auction") {
      setModalBidAmount(auctionMinimumBid(modalState.auction));
    }
  }, [modalState?.type, modalState?.auction?.id, modalState?.auction?.currentBid]);

  if (!modalState) return null;

  const closeAllowed = !modalState.blocking;
  const isCardModal = modalState.type === "card";
  const property = modalState.property;
  const isMyAuctionTurn = modalState.type === "auction" && sameEntityId(modalState.auction.activeBidderId, currentUserId);
  const canBidAuction = isMyAuctionTurn || myActions.includes("hacerOferta");
  const canPassAuction = isMyAuctionTurn || myActions.includes("retirarseDeSubasta");
  const debtPlayer = modalState.type === "debt" ? playersById.get(modalState.debt.debtorId) : null;
  const debtShortfall = modalState.type === "debt" ? Math.max(0, (modalState.debt.amount || 0) - (debtPlayer?.cash || 0)) : 0;
  const canPayDebt = modalState.type === "debt" && myActions.includes("resolverDeudaPendiente") && debtShortfall === 0;
  const taxSelection = modalState.type === "tax" ? resolvePendingTaxSelection(modalState.tax) : null;
  const debtRescueLiquidity = modalState.type === "debt"
    ? (debtPlayer?.properties || []).reduce((sum, debtProperty) => sum + estimatePropertyLiquidity(debtProperty), 0)
    : 0;
  const shouldManageBeforeBankruptcy = modalState.type === "debt" && debtShortfall > 0 && debtRescueLiquidity >= debtShortfall;

  if (isCardModal) {
    const DeckIcon = cardPreviewIcon(modalState.card, modalState.deck);
    const ruleCopy = cardRuleCopy(modalState.card, modalState.deck);
    const cardCopyDensity = cardContentDensityClass(modalState.card, modalState.deck, modalState.playerName);

    return (
      <div className="monopoly-modal-backdrop card-table-backdrop">
        <div className="card-table-stage">
          {closeAllowed && (
            <button type="button" className="card-table-close" onClick={onClose} aria-label="Cerrar carta">
              <X size={16} />
            </button>
          )}
          <div className="game-card-reveal game-card-reveal-standalone">
            <div className={cx("game-card-face real-game-card", cardDeckClass(modalState.deck), cardCopyDensity, modalState.card.effect === "SALIR_LIBRE_CARCEL" && "jail-free")}>
              <span className="game-card-corner top">{modalState.deck === "CASUALIDAD" ? "?" : "!"}</span>
              <span className="game-card-corner bottom">{modalState.deck === "CASUALIDAD" ? "?" : "!"}</span>
              <div className="game-card-topline">
                <span className="game-card-deck">{cardDeckLabel(modalState.deck)}</span>
                <span className="game-card-stamp">{cardPreviewLabel(modalState.card)}</span>
              </div>
              <div className="game-card-medallion">
                <DeckIcon size={44} />
              </div>
              <div className="game-card-body">
                <strong className="game-card-title">{cardDisplayTitle(modalState.card)}</strong>
                <p>{cardFlavorCopy(modalState.card, modalState.deck, modalState.playerName)}</p>
                {ruleCopy && <span className="game-card-rule">{ruleCopy}</span>}
              </div>
              <div className="game-card-footer">
                <span>{cardFooterCopy(modalState.card, modalState.deck, modalState.playerName)}</span>
              </div>
            </div>
            {myActions.includes("resolverCarta") && (
              <div className="game-card-action-row">
                <ActionButton onClick={() => onAction("resolverCarta")}>{cardActionLabel(modalState.card)}</ActionButton>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="monopoly-modal-backdrop">
      <div className={cx("monopoly-modal", `tone-${modalState.tone}`)}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">
              Accion de tablero
            </p>
            <h3 className="mt-2 text-3xl font-black uppercase">
              {modalState.title}
            </h3>
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
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="modal-stat-card">
              <span>Pago fijo</span>
              <Money amount={modalState.tax.fixedAmount} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Pago por patrimonio</span>
              <Money amount={modalState.tax.percentAmount} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Cobro aplicado</span>
              <strong className="modal-stat-value">{pendingTaxAppliedLabel(modalState.tax)}</strong>
            </div>
          </div>
        )}

        {modalState.type === "debt" && (
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="modal-stat-card">
              <span>Deuda</span>
              <Money amount={modalState.debt.amount} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Efectivo actual</span>
              <Money amount={debtPlayer?.cash || 0} className="modal-stat-value" />
            </div>
            <div className="modal-stat-card">
              <span>Falta reunir</span>
              <Money amount={debtShortfall} className="modal-stat-value" />
            </div>
            {debtShortfall > 0 && (
              <div className="debt-management-callout sm:col-span-3">
                <Hammer size={18} />
                <p>
                  Administra propiedades antes de declararte en quiebra: vende casas u hoteles, hipoteca activos y vuelve a pagar cuando el saldo alcance la deuda.
                </p>
              </div>
            )}
          </div>
        )}

        {modalState.type === "auction" && (
          <div className="mt-5">
            <AuctionControls
              auction={modalState.auction}
              playersById={playersById}
              boardById={boardById}
              bidAmount={modalBidAmount}
              setBidAmount={setModalBidAmount}
              canBidAuction={canBidAuction}
              canPassAuction={canPassAuction}
              onAction={onAction}
            />
          </div>
        )}

        {modalState.type === "tradeOffer" && (
          <div className="trade-offer-card">
            <div className="trade-offer-main">
              <div className="trade-offer-icon">
                {modalState.offer.type === "PROPERTY" ? <Scale size={28} /> : <ShieldAlert size={28} />}
              </div>
              <div>
                <p className="monopoly-panel-eyebrow">{modalState.incoming ? "Invitacion de trato" : "Oferta enviada"}</p>
                <h4>
                  {modalState.offer.type === "PROPERTY"
                    ? modalState.property?.name || "Propiedad"
                    : `Pase de ${cardDeckLabel(modalState.offer.deck)}`}
                </h4>
                <p>
                  {modalState.incoming
                    ? modalState.buyRequest
                      ? `${modalState.buyerName} te propone comprartelo por ${moneyFormatter.format(modalState.offer.price || 0)}.`
                      : `${modalState.sellerName} te propone vendertelo por ${moneyFormatter.format(modalState.offer.price || 0)}.`
                    : modalState.buyRequest
                      ? `${modalState.sellerName} debe aceptar para venderte este activo.`
                      : `${modalState.buyerName} debe aceptar para comprar este activo.`}
                </p>
              </div>
            </div>

            <div className="trade-offer-stats">
              <article className="modal-stat-card">
                <span>Vendedor</span>
                <strong className="modal-stat-value">{modalState.sellerName}</strong>
              </article>
              <article className="modal-stat-card">
                <span>Comprador</span>
                <strong className="modal-stat-value">{modalState.buyerName}</strong>
              </article>
              <article className="modal-stat-card">
                <span>Precio</span>
                <Money amount={modalState.offer.price || 0} className="modal-stat-value" />
              </article>
              {modalState.property?.isMortgaged && (
                <article className="modal-stat-card">
                  <span>Hipoteca</span>
                  <strong className="modal-stat-value">{modalState.offer.liftMortgageNow ? "Se levanta al aceptar" : "Se transfiere con interes"}</strong>
                </article>
              )}
            </div>
          </div>
        )}

        {modalState.type === "card" && (
          <div className="game-card-reveal">
            {(() => {
              const DeckIcon = cardPreviewIcon(modalState.card, modalState.deck);
              const ruleCopy = cardRuleCopy(modalState.card, modalState.deck);
              const cardCopyDensity = cardContentDensityClass(modalState.card, modalState.deck, modalState.playerName);
              return (
                <div className={cx("game-card-face", cardDeckClass(modalState.deck), cardCopyDensity, modalState.card.effect === "SALIR_LIBRE_CARCEL" && "jail-free")}>
                  <span className="game-card-corner top">{modalState.deck === "CASUALIDAD" ? "?" : "!"}</span>
                  <span className="game-card-corner bottom">{modalState.deck === "CASUALIDAD" ? "?" : "!"}</span>
                  <div className="game-card-topline">
                    <span className="game-card-deck">{cardDeckLabel(modalState.deck)}</span>
                    <span className="game-card-stamp">{cardPreviewLabel(modalState.card)}</span>
                  </div>
                  <div className="game-card-medallion">
                    <DeckIcon size={38} />
                  </div>
                  <div className="game-card-body">
                    <strong className="game-card-title">{cardDisplayTitle(modalState.card)}</strong>
                    <p>{cardFlavorCopy(modalState.card, modalState.deck, modalState.playerName)}</p>
                    {ruleCopy && <span className="game-card-rule">{ruleCopy}</span>}
                  </div>
                  <div className="game-card-footer">
                    <span>{cardFooterCopy(modalState.card, modalState.deck, modalState.playerName)}</span>
                  </div>
                </div>
            );
            })()}
            {myActions.includes("resolverCarta") && (
              <div className="game-card-action-row">
                <ActionButton onClick={() => onAction("resolverCarta")}>{cardActionLabel(modalState.card)}</ActionButton>
              </div>
            )}
          </div>
        )}

        <div className={cx("mt-6 flex flex-wrap gap-3", isCardModal && "hidden")}>
          {modalState.type === "purchase" && myActions.includes("comprarPropiedad") && (
            <>
              <ActionButton onClick={() => onAction("comprarPropiedad")}>Comprar</ActionButton>
              <ActionButton tone="danger" onClick={() => onAction("rechazarCompra")}>Subastar</ActionButton>
            </>
          )}

          {modalState.type === "tax" && myActions.includes("pagarImpuesto") && (
            <ActionButton onClick={() => onAction("pagarImpuesto")}>
              Pagar {taxSelection?.amount ? moneyFormatter.format(taxSelection.amount) : ""}
            </ActionButton>
          )}

          {modalState.type === "debt" && myActions.includes("resolverDeudaPendiente") && (
            <>
              <ActionButton onClick={() => canPayDebt ? onAction("resolverDeudaPendiente") : onManageDebt?.()}>
                {canPayDebt ? "Pagar deuda" : "Abrir rescate"}
              </ActionButton>
              {myActions.includes("resolverQuiebra") && (
                <ActionButton tone="danger" onClick={() => shouldManageBeforeBankruptcy ? onManageDebt?.() : onAction("resolverQuiebra")}>
                  {shouldManageBeforeBankruptcy ? "Liquidar antes" : "Quiebra"}
                </ActionButton>
              )}
            </>
          )}

          {modalState.type === "tradeOffer" && (
            <>
              {modalState.incoming && myActions.includes("aceptarOfertaTrato") && (
                <ActionButton onClick={() => onAction("aceptarOfertaTrato", { offerId: modalState.offer.id })}>Aceptar trato</ActionButton>
              )}
              {modalState.incoming && myActions.includes("rechazarOfertaTrato") && (
                <ActionButton tone="danger" onClick={() => onAction("rechazarOfertaTrato", { offerId: modalState.offer.id })}>Rechazar</ActionButton>
              )}
              {!modalState.incoming && myActions.includes("cancelarOfertaTrato") && (
                <ActionButton tone="danger" onClick={() => onAction("cancelarOfertaTrato", { offerId: modalState.offer.id })}>Cancelar oferta</ActionButton>
              )}
            </>
          )}

          {modalState.type === "jail" && (
            <>
              {myActions.includes("pagarMultaCarcel") && <ActionButton onClick={() => onAction("pagarMultaCarcel")}>Pagar multa</ActionButton>}
              {myActions.includes("usarCartaSalirCarcel") && <ActionButton tone="secondary" onClick={() => onAction("usarCartaSalirCarcel")}>Usar carta</ActionButton>}
              {myActions.includes("tirarDados") && <ActionButton tone="secondary" onClick={() => onAction("tirarDados")}>Intentar dobles</ActionButton>}
            </>
          )}

          {closeAllowed && (
            <ActionButton tone="secondary" onClick={onClose}>Cerrar</ActionButton>
          )}
        </div>
      </div>
    </div>
  );
}

function TokenCustomizer({
  open,
  onClose,
  currentPlayer,
  currentTokenStyle,
  onChange,
  onReset,
  figures = [],
  activeFigureId = "",
  onFigureChange,
  colorOnly = true,
  reservedTokenColors = []
}) {
  const [draft, setDraft] = useState(() => colorOnly ? buildColorOnlyDraft(currentTokenStyle) : currentTokenStyle);
  const [selectedFigureId, setSelectedFigureId] = useState(activeFigureId || "");
  const [submitting, setSubmitting] = useState(false);
  const reservedColorSet = useMemo(
    () => new Set((reservedTokenColors || []).map(normalizeTokenColor).filter(Boolean)),
    [reservedTokenColors]
  );

  function buildColorOnlyDraft(style = {}) {
    const fallbackLabel = initialLetters(currentPlayer?.name || currentPlayer?.username || "");
    const bg = style?.bg || tokenColorPresets[0].bg;
    const preset = tokenColorPresets.find((option) => normalizeTokenColor(option.bg) === normalizeTokenColor(bg));

    return {
      ...style,
      label: String(style?.label || fallbackLabel || "?").trim().slice(0, 4).toUpperCase(),
      icon: "",
      bg,
      ring: preset?.ring || style?.ring || tokenColorPresets[0].ring,
      fg: "#ffffff",
      shape: "circle"
    };
  }

  useEffect(() => {
    if (open) {
      setDraft(colorOnly ? buildColorOnlyDraft(currentTokenStyle) : currentTokenStyle);
      setSelectedFigureId(activeFigureId || "");
    }
  }, [activeFigureId, open, currentTokenStyle, colorOnly]);

  if (!open) return null;

  function update(patch) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  async function applyAndClose() {
    const finalDraft = colorOnly ? buildColorOnlyDraft(draft) : draft;
    setSubmitting(true);
    try {
      await onChange({
        label: finalDraft.label,
        icon: finalDraft.icon || "",
        bg: finalDraft.bg,
        ring: finalDraft.ring,
        fg: finalDraft.fg || "#ffffff",
        shape: finalDraft.shape
      });
      await onFigureChange?.(selectedFigureId);
      onClose();
    } catch {
      // El controlador muestra el error y mantiene abierto el selector.
    } finally {
      setSubmitting(false);
    }
  }

  const selectedFigure = figures.find((figure) => figure.id === selectedFigureId) || null;
  const selectedFigureColorLocked = isTokenColorLocked(selectedFigure);

  if (colorOnly) {
    return (
      <div className="monopoly-modal-backdrop fullscreen" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="monopoly-modal tone-info token-customizer-modal color-only fullscreen">
          <div className="token-customizer-head">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Personalizar ficha</p>
              <h3 className="mt-1 text-2xl font-black uppercase">Figura y color</h3>
              <p className="mt-2 text-sm font-semibold opacity-85">
                {currentPlayer?.name ? `${currentPlayer.name}, elige tu figura y su color.` : "Elige la figura y el color que usarás."}
              </p>
            </div>
            <button type="button" className="toast-close token-customizer-close" onClick={onClose} aria-label="Cerrar editor de color">
              <X size={16} />
            </button>
          </div>

          <div className="token-customizer-body">
            <aside className="token-preview-stage">
              <div className="token-preview-orbit">
                {selectedFigure ? (
                  <Suspense fallback={<TokenChip tokenStyle={draft} className="token-preview-hero monopoly-token-large" />}>
                    <EyconProductPreview3D
                      product={selectedFigure}
                      tokenColor={selectedFigureColorLocked ? null : { bg: draft.bg, ring: draft.ring }}
                    />
                  </Suspense>
                ) : (
                  <TokenChip tokenStyle={draft} className="token-preview-hero monopoly-token-large" />
                )}
              </div>
              <div className="token-preview-card">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-75">Vista previa</p>
                <p className="mt-1 text-xl font-black uppercase">{selectedFigure?.name || "Ficha clásica"}</p>
                <p className="mt-1 text-xs font-semibold opacity-80">{selectedFigure ? "Pieza EyCon comprada" : "Figura incluida"}</p>
                <div className="token-preview-swatches">
                  <span style={{ background: draft.bg }} title="Interior" />
                  <span style={{ background: draft.ring }} title="Exterior" />
                </div>
              </div>
            </aside>

            <section className="token-editor-column">
              <div className="token-editor-scroll">
                <div className="token-color-only-card token-figure-picker">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Figuras disponibles</p>
                  <div className="token-figure-grid mt-3">
                    <button
                      type="button"
                      className={cx("token-figure-option", !selectedFigureId && "active")}
                      onClick={() => setSelectedFigureId("")}
                    >
                      <span className="token-figure-glyph" style={{ "--figure-color": draft.bg, "--figure-ring": draft.ring }}>
                        {initialLetters(currentPlayer?.name || currentPlayer?.username || "") || "TÚ"}
                      </span>
                      <strong>Clásica</strong>
                      <small>Incluida</small>
                    </button>
                    {figures.map((figure) => (
                      <button
                        type="button"
                        key={figure.id}
                        className={cx("token-figure-option", selectedFigureId === figure.id && "active")}
                        onClick={() => setSelectedFigureId(figure.id)}
                      >
                        <span className="token-figure-glyph" style={{ "--figure-color": draft.bg, "--figure-ring": draft.ring }}>
                          {figure.preview || "✦"}
                        </span>
                        <strong>{figure.name}</strong>
                        <small>{selectedFigureId === figure.id ? "Seleccionada" : "Comprada"}</small>
                      </button>
                    ))}
                  </div>
                  {figures.length === 0 && (
                    <p className="mt-3 text-xs font-semibold opacity-65">Aún no tienes figuras EyCon. Puedes comprarlas en la tienda.</p>
                  )}
                </div>
                {!selectedFigureColorLocked && <div className="token-color-only-card">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Colores disponibles</p>
                  <div className="token-3d-color-grid mt-3">
                    {tokenColorPresets.map((preset) => {
                      const colorKey = normalizeTokenColor(preset.bg);
                      const selected = normalizeTokenColor(draft.bg) === colorKey;
                      const unavailable = reservedColorSet.has(colorKey) && !selected;
                      return (
                        <button
                          key={`color-${preset.bg}`}
                          type="button"
                          className={cx("token-3d-color-option", selected && "active", unavailable && "unavailable")}
                          style={{ "--token-bg": preset.bg, "--token-ring": preset.ring }}
                          disabled={unavailable}
                          onClick={() => {
                            if (!unavailable) update(buildColorOnlyDraft({ ...draft, bg: preset.bg, ring: preset.ring }));
                          }}
                          aria-label={unavailable ? `Color ${preset.bg} ocupado` : `Usar color ${preset.bg}`}
                        >
                          <span className="token-3d-color-dot" />
                          <span>{unavailable ? "En uso" : selected ? "Actual" : "Libre"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>}
              </div>

              <div className="token-customizer-actions">
                <ActionButton onClick={applyAndClose} disabled={submitting}>{submitting ? "Guardando..." : "Guardar ficha"}</ActionButton>
                <ActionButton tone="secondary" disabled={submitting} onClick={async () => {
                  setSubmitting(true);
                  try {
                    await onReset();
                    await onFigureChange?.("");
                    onClose();
                  } catch {
                    // El controlador muestra el error y conserva el selector abierto.
                  } finally {
                    setSubmitting(false);
                  }
                }}>Restablecer</ActionButton>
                <ActionButton tone="secondary" onClick={onClose}>Cancelar</ActionButton>
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className={cx("monopoly-modal tone-info token-customizer-modal", colorOnly && "color-only")}>
        <div className="token-customizer-head">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Color de ficha</p>
            <h3 className="mt-1 text-2xl font-black uppercase">{colorOnly ? "Elige tu color" : "Tu ficha"}</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">
              {currentPlayer?.name ? `${currentPlayer.name}, elige el color de tu ficha.` : "Elige el color que usara tu ficha."}
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
              <p className="mt-1 text-xl font-black uppercase">{colorOnly ? "Color unico" : tokenIconPresets.find((icon) => icon.id === draft.icon)?.label || draft.label || "?"}</p>
              <p className="mt-1 text-xs font-semibold opacity-80">{colorOnly ? "Ficha circular" : `Figura: ${tokenShapes.find((s) => s.id === draft.shape)?.label || draft.shape}`}</p>
              <div className="token-preview-swatches">
                <span style={{ background: draft.bg }} title="Interior" />
                <span style={{ background: draft.ring }} title="Exterior" />
              </div>
            </div>
          </aside>

          <section className="token-editor-column">
            <div className="token-editor-scroll">
              {colorOnly && (
                <div className="token-color-only-card">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] opacity-75">Colores disponibles</p>
                  <div className="token-3d-color-grid mt-3">
                    {tokenColorPresets.map((preset) => {
                      const colorKey = normalizeTokenColor(preset.bg);
                      const selected = normalizeTokenColor(draft.bg) === colorKey;
                      const unavailable = reservedColorSet.has(colorKey) && !selected;
                      return (
                        <button
                          key={`3d-${preset.bg}`}
                          type="button"
                          className={cx("token-3d-color-option", selected && "active", unavailable && "unavailable")}
                          style={{ "--token-bg": preset.bg, "--token-ring": preset.ring }}
                          disabled={unavailable}
                          onClick={() => {
                            if (unavailable) return;
                            update(buildColorOnlyDraft({ ...draft, bg: preset.bg, ring: preset.ring }));
                          }}
                          aria-label={unavailable ? `Color ${preset.bg} ocupado` : `Usar color ${preset.bg}`}
                        >
                          <span className="token-3d-color-dot" />
                          <span>{unavailable ? "En uso" : selected ? "Actual" : "Libre"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
              <ActionButton onClick={applyAndClose}>{colorOnly ? "Guardar color" : "Guardar ficha"}</ActionButton>
              <ActionButton tone="secondary" onClick={() => { onReset(); onClose(); }}>Restablecer</ActionButton>
              <ActionButton tone="secondary" onClick={onClose}>Cancelar</ActionButton>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BoardThemeCustomizer({
  open,
  onClose,
  themes = [],
  activeThemeId = "",
  onChange
}) {
  const [selectedId, setSelectedId] = useState(activeThemeId || "");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) setSelectedId(activeThemeId || "");
  }, [activeThemeId, open]);

  if (!open) return null;
  const selectedTheme = themes.find((theme) => theme.id === selectedId) || null;

  async function saveTheme() {
    setSubmitting(true);
    try {
      await onChange(selectedId);
      onClose();
    } catch {
      // El controlador conserva abierto el selector y muestra el error.
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="monopoly-modal-backdrop fullscreen" onClick={(event) => { if (event.target === event.currentTarget && !submitting) onClose(); }}>
      <div className="monopoly-modal tone-info monopoly-board-theme-modal fullscreen">
        <div className="token-customizer-head">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Configuración del anfitrión</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Diseño del tablero</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">El tema elegido se mostrará para todos los jugadores de esta mesa.</p>
          </div>
          <button type="button" className="toast-close token-customizer-close" disabled={submitting} onClick={onClose} aria-label="Cerrar selector de tablero">
            <X size={16} />
          </button>
        </div>

        <div className="monopoly-board-theme-body">
          <aside className="monopoly-board-theme-preview">
            {selectedTheme ? (
              <Suspense fallback={<MonopolyViewLoading mode="3d" />}>
                <EyconProductPreview3D product={selectedTheme} />
              </Suspense>
            ) : (
              <div className="monopoly-board-classic-preview">
                <MapIcon size={38} />
                <strong>Tablero clásico</strong>
                <small>Diseño original de la mesa</small>
              </div>
            )}
            <div>
              <small>Vista seleccionada</small>
              <strong>{selectedTheme?.name || "Clásico"}</strong>
              <p>{selectedTheme?.description || "La apariencia original de Monopoly."}</p>
            </div>
          </aside>

          <section className="monopoly-board-theme-list">
            <button
              type="button"
              className={cx("monopoly-board-theme-option", !selectedId && "active")}
              onClick={() => setSelectedId("")}
            >
              <span style={{ "--board-a": "#2d2418", "--board-b": "#1f6f59", "--board-c": "#f4d45d" }}><MapIcon size={22} /></span>
              <strong>Clásico</strong>
              <small>Incluido</small>
            </button>
            {themes.map((theme) => (
              <button
                type="button"
                key={theme.id}
                className={cx("monopoly-board-theme-option", selectedId === theme.id && "active")}
                onClick={() => setSelectedId(theme.id)}
              >
                <span style={{
                  "--board-a": theme.metadata?.baseColor,
                  "--board-b": theme.metadata?.centerColor,
                  "--board-c": theme.metadata?.accentColor
                }}>{theme.preview || "▦"}</span>
                <strong>{theme.name}</strong>
                <small>{selectedId === theme.id ? "Seleccionado" : "Comprado"}</small>
              </button>
            ))}
            {themes.length === 0 && (
              <p className="monopoly-board-theme-empty">No tienes diseños comprados. Puedes conseguirlos en la tienda EyCon.</p>
            )}
          </section>
        </div>

        <div className="monopoly-board-theme-actions">
          <ActionButton onClick={saveTheme} disabled={submitting}>{submitting ? "Aplicando..." : "Usar en esta mesa"}</ActionButton>
          <ActionButton tone="secondary" disabled={submitting} onClick={onClose}>Cancelar</ActionButton>
        </div>
      </div>
    </div>
  );
}

function GameLayout({ children, immersive = false }) {
  return <section className={cx("monopoly-game-layout", immersive && "is-immersive")}>{children}</section>;
}

function MonopolyViewLoading({ mode = "3d" }) {
  const isThreeD = mode === "3d";

  return (
    <section className="monopoly-view-loading" role="status" aria-live="polite">
      <div className="monopoly-view-loading-mark">
        {isThreeD ? <Cuboid size={34} /> : <MapIcon size={34} />}
      </div>
      <div>
        <p>{isThreeD ? "Preparando mesa 3D" : "Abriendo tablero legacy"}</p>
        <span>{isThreeD ? "Cargando escena, camara y tablero." : "Cargando vista clasica 2D."}</span>
      </div>
      <i aria-hidden="true" />
    </section>
  );
}

function TopHud({
  tableName,
  state,
  currentPlayer,
  myPlayer,
  myTokenStyle,
  turnCountdown,
  onToken,
  onBoardTheme,
  onRules,
  onMenu,
  boardViewMode,
  onBoardViewModeChange,
  cameraAutoFollow,
  onCameraAutoFollowChange,
  onLeave,
  onSurrender,
  onCloseTable,
  canLeave,
  canSurrender,
  canCloseTable,
  canChooseBoardTheme = false,
  canChangeColor = true,
  immersive = false
}) {
  if (immersive) {
    const leaveAction = canLeave ? onLeave : onSurrender;

    return (
      <header className="monopoly-top-hud monopoly-top-hud--immersive">
        <div className="monopoly-hud-title">
          <div className="monopoly-logo monopoly-hud-logo">MONOPOLY</div>
          <div className="min-w-0">
            <p className="monopoly-hud-kicker">{tableName}</p>
            <h2>{currentPlayer?.name || "Partida"} <span>en turno</span></h2>
          </div>
        </div>

        <div className="monopoly-hud-stats">
          <div className="monopoly-hud-pill">
            <Wallet size={17} />
            <div>
              <span>Mi saldo</span>
              <strong><Money amount={myPlayer?.cash || 0} /></strong>
            </div>
          </div>
          <div className="monopoly-hud-pill">
            <TimerReset size={17} />
            <div>
              <span>Turno</span>
              <strong>{turnCountdown}</strong>
            </div>
          </div>
          <div className="monopoly-hud-pill is-current">
            <Sparkles size={17} />
            <div>
              <span>Fase</span>
              <strong>{phaseLabel[state.turn.phase] || state.turn.phase}</strong>
            </div>
          </div>
        </div>

        <div className="monopoly-hud-actions">
          <button
            type="button"
            className={cx("monopoly-icon-button", cameraAutoFollow && "is-active")}
            onClick={() => onCameraAutoFollowChange?.(!cameraAutoFollow)}
            title={cameraAutoFollow ? "Liberar camara" : "Centrar y seguir la accion"}
          >
            {cameraAutoFollow ? <Eye size={17} /> : <EyeOff size={17} />}
          </button>
          <button
            type="button"
            className="monopoly-icon-button"
            onClick={() => onBoardViewModeChange?.("2d")}
            title="Cambiar a vista 2D"
          >
            <MapIcon size={17} />
          </button>
          <button
            type="button"
            className="monopoly-icon-button"
            onClick={onToken}
            disabled={!canChangeColor}
            title={canChangeColor ? "Cambiar figura y color" : "Personalización bloqueada después del turno 10"}
          >
            <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
          </button>
          {canChooseBoardTheme && (
            <button type="button" className="monopoly-icon-button" onClick={onBoardTheme} title="Elegir diseño del tablero">
              <MapIcon size={17} />
            </button>
          )}
          <button type="button" className="monopoly-icon-button" onClick={onRules} title="Reglas">
            <Info size={17} />
          </button>
          <button type="button" className="monopoly-icon-button" onClick={onMenu} title="Menu de mesa">
            <MapIcon size={17} />
          </button>
          {leaveAction && (
            <button type="button" className="monopoly-hud-exit" onClick={leaveAction}>
              <DoorOpen size={16} />
              Salir
            </button>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="monopoly-top-hud">
      <div className="monopoly-hud-title">
        <div className="monopoly-logo monopoly-hud-logo">MONOPOLY</div>
        <div className="min-w-0">
          <p className="monopoly-hud-kicker">Turno de</p>
          <h2>{currentPlayer?.name || "Partida"}</h2>
        </div>
      </div>

      <div className="monopoly-hud-stats">
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
        <div className="monopoly-hud-view-switch monopoly-hud-view-switch--3d-first" aria-label="Cambiar vista del tablero">
          <button
            type="button"
            className={cx("monopoly-hud-view-button", boardViewMode === "3d" && "is-active")}
            onClick={() => onBoardViewModeChange?.("3d")}
            title="Vista 3D principal"
          >
            <Cuboid size={16} />
            3D
          </button>
          <button
            type="button"
            className={cx("monopoly-hud-view-button monopoly-hud-view-button--legacy", boardViewMode === "2d" && "is-active")}
            onClick={() => onBoardViewModeChange?.("2d")}
            title="Vista clasica legacy"
            aria-label="Vista clasica legacy"
          >
            <MapIcon size={16} />
            <span>Legacy</span>
          </button>
        </div>
        <button
          type="button"
          className={cx("monopoly-hud-camera-button", cameraAutoFollow && "is-active")}
          onClick={() => onCameraAutoFollowChange?.(!cameraAutoFollow)}
          title={cameraAutoFollow ? "Desactivar seguimiento de camara" : "Activar seguimiento de camara"}
        >
          {cameraAutoFollow ? <Eye size={16} /> : <EyeOff size={16} />}
          {cameraAutoFollow ? "Sigue camara" : "Camara libre"}
        </button>
        <button
          type="button"
          className="monopoly-icon-button"
          onClick={onToken}
          disabled={!canChangeColor}
          title={canChangeColor ? "Cambiar figura y color" : "Personalización bloqueada después del turno 10"}
        >
          <TokenChip tokenStyle={myTokenStyle} className="h-7 w-7 text-xs" />
        </button>
        {canChooseBoardTheme && (
          <button type="button" className="monopoly-icon-button" onClick={onBoardTheme} title="Elegir diseño del tablero">
            <MapIcon size={18} />
          </button>
        )}
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
  boardTheme,
  selectedSpace,
  coloredPlayersById,
  playersById,
  displayBoardPlayers,
  state,
  tokenStylesById,
  moneyBursts,
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
  onManageDebt,
  onSelect
}) {
  const locked = rollingDice || Boolean(cinematic);
  const boardThemeMetadata = boardTheme?.metadata || {};
  const boardThemeStyle = boardTheme ? {
    "--monopoly-theme-base": boardThemeMetadata.baseColor || "#2d2418",
    "--monopoly-theme-center": boardThemeMetadata.centerColor || "#1f6f59",
    "--monopoly-theme-accent": boardThemeMetadata.accentColor || "#f4d45d"
  } : undefined;
  const boardById = useMemo(() => new Map((board || []).map((space) => [space.id, space])), [board]);
  const diceCinematicActive = ["cameraFocusDice", "diceRolling", "dice"].includes(cinematic?.phase);
  const canRollFromDice = isMyTurn && myActions.includes("tirarDados") && !locked;

  return (
    <section className="monopoly-board-area" aria-label="Tablero de Monopoly" style={boardThemeStyle}>
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

            <MoneyBurstOverlay bursts={moneyBursts} />

            <div className={cx("monopoly-center", diceCinematicActive && "de-emphasized", cinematic?.phase === "move" && "board-live", cinematic?.phase === "settle" && "board-live")}>
              <div className="monopoly-board-core">
                <div className={cx("monopoly-callout monopoly-center-callout", prompt?.tone && `tone-${prompt.tone}`)}>
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] truncate">
                    {diceCinematicActive ? "Dados en mesa" : cinematic?.phase === "move" ? "Ficha en movimiento" : cinematic?.phase === "settle" ? "Casilla enfocada" : prompt?.eyebrow}
                  </p>
                  <h2 className="mt-1 text-xl font-black uppercase leading-tight line-clamp-2">
                    {diceCinematicActive
                      ? `${playersById.get(cinematic.playerId)?.name || "Jugador"} esta lanzando`
                      : cinematic?.phase === "move"
                        ? "La ficha avanza casilla por casilla"
                        : cinematic?.phase === "settle"
                          ? "Resolviendo la casilla"
                          : prompt?.title}
                  </h2>
                </div>

                <div className={cx("monopoly-board-dice-lockup", canRollFromDice && "is-roll-ready")}>
                  <button
                    type="button"
                    className="monopoly-center-dice monopoly-center-dice-button"
                    disabled={!canRollFromDice}
                    onClick={() => onAction("tirarDados")}
                    title={canRollFromDice ? "Tirar dados" : "Dados"}
                    aria-label={canRollFromDice ? "Tirar dados" : "Dados"}
                  >
                    <Dice value={diceFaces[0]} rolling={rollingDice} size={64} />
                    <Dice value={diceFaces[1]} rolling={rollingDice} size={64} />
                  </button>
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
                  boardById={boardById}
                  state={state}
                  bidAmount={bidAmount}
                  setBidAmount={setBidAmount}
                  canBidAuction={canBidAuction}
                  canPassAuction={canPassAuction}
                  onAction={onAction}
                  onManageDebt={onManageDebt}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const LegacyBoardArea = memo(BoardArea);

function ThreeDBoardActionPanel({
  prompt,
  playersById,
  state,
  rollingDice,
  cinematic,
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
  onManageDebt,
  onOpenTrade
}) {
  const boardById = useMemo(() => new Map((state?.board || []).map((space) => [space.id, space])), [state?.board]);
  const locked = rollingDice || Boolean(cinematic);
  const diceRollingVisual = rollingDice || cinematic?.phase === "diceRolling";
  const canRollFromDice = isMyTurn && myActions.includes("tirarDados") && !locked;
  const displayPrompt = locked
    ? {
        tone: "info",
        eyebrow: "Escena 3D",
        title: diceRollingVisual ? "Dados en movimiento" : "Animacion en curso",
        body: "El tablero esta resolviendo la secuencia visual."
      }
    : canRollFromDice
      ? {
          tone: "info",
          eyebrow: "Tu turno",
          title: "Haz click en los dados",
          body: "La tirada empieza directamente desde el tablero 3D."
        }
      : prompt;
  const actionPanel = canRollFromDice
    ? {
        tone: "info",
        title: "Dados listos",
        body: "Usa los dados del centro del tablero para tirar."
      }
    : null;

  return (
    <section className="monopoly-turn-panel monopoly-3d-turn-panel">
      <div className={cx("monopoly-turn-card", displayPrompt?.tone && `tone-${displayPrompt.tone}`)}>
        <p className="monopoly-panel-eyebrow">{displayPrompt?.eyebrow || "Turno"}</p>
        <h3>{displayPrompt?.title || "Mesa en curso"}</h3>
        <p>{displayPrompt?.body || "La partida sigue en tiempo real."}</p>
      </div>

      <div className="monopoly-turn-card monopoly-3d-support-card">
        {actionPanel ? (
          <div className="monopoly-center-action-zone is-passive">
            <span>{actionPanel.title}</span>
            <small>{actionPanel.body}</small>
          </div>
        ) : (
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
            boardById={boardById}
            state={state}
            bidAmount={bidAmount}
            setBidAmount={setBidAmount}
            canBidAuction={canBidAuction}
            canPassAuction={canPassAuction}
            onAction={onAction}
            onManageDebt={onManageDebt}
          />
        )}

        {pendingDebt && isMyTurn && myActions.includes("resolverDeudaPendiente") && (
          <div className="monopoly-secondary-actions">
            <button type="button" onClick={onOpenTrade}>
              <Scale size={16} />
              Negocios
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function suggestedPropertyTradePrice(property) {
  if (!property) return 100;
  return Math.max(
    property.mortgageValue || 0,
    Math.round(((property.price || property.mortgageValue || 100) * 0.7) / 50) * 50
  );
}

function ownerControlsColorGroup(space, owner = null, board = []) {
  if (!space?.colorGroup || !owner) return false;
  const groupSpaces = board.filter((candidate) => candidate.colorGroup === space.colorGroup);
  if (groupSpaces.length === 0) return false;
  const ownedInGroup = (owner.properties || []).filter((candidate) => candidate.colorGroup === space.colorGroup).length;
  return ownedInGroup >= groupSpaces.length;
}

function buildThreeDRentRows(space, owner = null, ownerProperty = null, board = []) {
  const property = ownerProperty || space;
  if (!property) return [];

  if (Array.isArray(property.rents) && property.rents.length > 0) {
    const groupOwned = ownerControlsColorGroup(space, owner, board);
    const hasBuildings = Boolean(property.hasHotel || property.houses > 0);
    const rows = [
      { label: "Base", value: moneyFormatter.format(property.rents[0] || 0), active: !groupOwned && !hasBuildings },
      { label: "Grupo completo", value: moneyFormatter.format((property.rents[0] || 0) * 2), active: groupOwned && !hasBuildings }
    ];
    const buildingLabels = ["1 casa", "2 casas", "3 casas", "4 casas", "Hotel"];
    for (let index = 1; index <= 5; index += 1) {
      rows.push({
        label: buildingLabels[index - 1],
        value: moneyFormatter.format(property.rents[index] || 0),
        active: property.hasHotel ? index === 5 : (property.houses || 0) === index
      });
    }
    return rows;
  }

  if (Array.isArray(property.rentSchedule) && property.rentSchedule.length > 0) {
    return property.rentSchedule.map((rent, index) => ({
      label: `${index + 1} tren${index === 0 ? "" : "es"}`,
      value: moneyFormatter.format(rent || 0),
      active: false
    }));
  }

  if (property.propertyKind === "SERVICIO_PUBLICO" || property.type === "SERVICIO_PUBLICO") {
    return [
      { label: "1 servicio", value: "4x dados", active: false },
      { label: "2 servicios", value: "10x dados", active: false }
    ];
  }

  return [];
}

function currentRentPreview(space, owner = null, ownerProperty = null, board = []) {
  const property = ownerProperty || space;
  if (!property || property.isMortgaged) return "Sin renta";

  if (Array.isArray(property.rents) && property.rents.length > 0) {
    if (property.hasHotel) return moneyFormatter.format(property.rents[5] || 0);
    if ((property.houses || 0) > 0) return moneyFormatter.format(property.rents[property.houses] || 0);
    const groupOwned = ownerControlsColorGroup(space, owner, board);
    return moneyFormatter.format(groupOwned ? (property.rents[0] || 0) * 2 : (property.rents[0] || 0));
  }

  if (Array.isArray(property.rentSchedule) && property.rentSchedule.length > 0) {
    const railroadsOwned = Math.max(
      1,
      (owner?.properties || []).filter((candidate) => candidate.propertyKind === "FERROCARRIL").length || 1
    );
    return moneyFormatter.format(property.rentSchedule[Math.min(railroadsOwned - 1, property.rentSchedule.length - 1)] || 0);
  }

  if (property.propertyKind === "SERVICIO_PUBLICO" || property.type === "SERVICIO_PUBLICO") {
    const utilitiesOwned = (owner?.properties || []).filter((candidate) => candidate.propertyKind === "SERVICIO_PUBLICO").length;
    return utilitiesOwned >= 2 ? "10x dados" : "4x dados";
  }

  return "--";
}

function buildThreeDSpaceSummary(space, owner = null, ownerProperty = null, visitors = [], board = []) {
  const property = ownerProperty || space;
  const ownerName = owner?.name || "Banco";
  const visitorCount = visitors.length;

  if (!space) {
    return {
      statusLabel: "Sin datos",
      description: "Selecciona una casilla para ver detalles.",
      rentPreviewLabel: "--"
    };
  }

  if (space.price) {
    const statusLabel = property?.isMortgaged
      ? "Hipotecada"
      : property?.hasHotel
      ? "Con hotel"
      : property?.houses
      ? `${property.houses} casas`
      : owner
      ? "En renta"
      : "Disponible";

    const description = property?.isMortgaged
      ? "No cobra renta hasta levantar la hipoteca."
      : space.propertyKind === "FERROCARRIL"
      ? `La renta escala segun los trenes que tenga ${ownerName}.`
      : space.propertyKind === "SERVICIO_PUBLICO"
      ? `La renta depende del resultado de los dados y de cuantos servicios controle ${ownerName}.`
      : owner
      ? `${ownerName} controla esta propiedad.${visitorCount ? ` Hay ${visitorCount} ficha${visitorCount === 1 ? "" : "s"} aqui.` : ""}`
      : "Puede comprarse si caes aqui y el turno lo permite.";

    return {
      statusLabel,
      description,
      rentPreviewLabel: currentRentPreview(space, owner, ownerProperty, board)
    };
  }

  switch (space.type) {
    case "SALIDA":
      return {
        statusLabel: "Bonificacion",
        description: "Al pasar por aqui cobras 200 del banco.",
        rentPreviewLabel: "Cobras 200"
      };
    case "CASUALIDAD":
      return {
        statusLabel: "Carta",
        description: "Robas una carta de Casualidad al caer en esta casilla.",
        rentPreviewLabel: "Evento"
      };
    case "ARCA_COMUNAL":
      return {
        statusLabel: "Carta",
        description: "Robas una carta de Arca comunal al caer en esta casilla.",
        rentPreviewLabel: "Evento"
      };
    case "IMPUESTO":
      return {
        statusLabel: space.taxKind === "OPTIONAL_PERCENT" ? "Cobro automatico" : "Impuesto fijo",
        description: space.taxKind === "OPTIONAL_PERCENT"
          ? `Se cobra automaticamente el mayor entre ${moneyFormatter.format(space.fixedAmount || 0)} y ${percentRateLabel(space.percentRate)} de patrimonio.`
          : `Pagas ${moneyFormatter.format(space.fixedAmount || 0)} al banco.`,
        rentPreviewLabel: space.taxKind === "OPTIONAL_PERCENT"
          ? boardTaxCardValue(space)
          : moneyFormatter.format(space.fixedAmount || 0)
      };
    case "CARCEL_VISITA":
      return {
        statusLabel: "Visita / carcel",
        description: "Aqui solo visitas. Si te envian preso, quedas bloqueado hasta resolver tu salida.",
        rentPreviewLabel: "Sin renta"
      };
    case "VAYASE_A_LA_CARCEL":
      return {
        statusLabel: "Directo a carcel",
        description: "Te envia inmediatamente a la carcel y no cobras por pasar por Salida.",
        rentPreviewLabel: "Pierdes turno"
      };
    case "PARADA_LIBRE":
      return {
        statusLabel: "Descanso",
        description: "No pagas ni cobras nada. Es una casilla neutral.",
        rentPreviewLabel: "Sin efecto"
      };
    default:
      return {
        statusLabel: "Especial",
        description: "Casilla especial del tablero.",
        rentPreviewLabel: "--"
      };
  }
}

function mergeThreeDSpaceProperty(space, ownerProperty = null) {
  if (!space) return null;
  if (!ownerProperty) return space;

  return {
    ...space,
    ...ownerProperty,
    index: space.index,
    id: space.id,
    name: ownerProperty.name || space.name,
    type: ownerProperty.type || space.type,
    propertyKind: ownerProperty.propertyKind || space.propertyKind || null,
    colorGroup: ownerProperty.colorGroup || space.colorGroup || null,
    ownerId: space.ownerId || ownerProperty.ownerId || null,
    price: ownerProperty.price ?? space.price ?? null,
    mortgageValue: ownerProperty.mortgageValue ?? space.mortgageValue ?? null,
    houseCost: ownerProperty.houseCost ?? space.houseCost ?? 0,
    hotelCost: ownerProperty.hotelCost ?? space.hotelCost ?? 0,
    rents: Array.isArray(ownerProperty.rents) ? ownerProperty.rents : space.rents,
    rentSchedule: Array.isArray(ownerProperty.rentSchedule) ? ownerProperty.rentSchedule : space.rentSchedule,
    houses: ownerProperty.houses ?? space.houses ?? 0,
    hasHotel: Boolean(ownerProperty.hasHotel ?? space.hasHotel),
    isMortgaged: Boolean(ownerProperty.isMortgaged ?? space.isMortgaged),
    management: ownerProperty.management || space.management || null
  };
}

function threeDGroupLabel(property) {
  if (property?.colorGroup) return colorGroupMeta[property.colorGroup]?.label || property.colorGroup;
  if (property?.propertyKind === "FERROCARRIL" || property?.type === "FERROCARRIL") return "Estacion";
  if (property?.propertyKind === "SERVICIO_PUBLICO" || property?.type === "SERVICIO_PUBLICO") return "Servicio";
  return "Especial";
}

function threeDBaseRentLabel(property) {
  if (!property?.price) return "--";
  if (Array.isArray(property.rents) && property.rents.length > 0) {
    return moneyFormatter.format(property.rents[0] || 0);
  }
  if (Array.isArray(property.rentSchedule) && property.rentSchedule.length > 0) {
    return moneyFormatter.format(property.rentSchedule[0] || 0);
  }
  if (property.propertyKind === "SERVICIO_PUBLICO" || property.type === "SERVICIO_PUBLICO") {
    return "4x dados";
  }
  return "Informacion no disponible";
}

function mortgageLiftAmount(property) {
  return (property?.mortgageValue || 0) + Math.ceil((property?.mortgageValue || 0) * 0.1);
}

function threeDActionMoneyDetail(actionName, property) {
  switch (actionName) {
    case "comprarPropiedad":
      return property?.price ? `-${moneyFormatter.format(property.price)}` : "";
    case "comprarCasa":
      return `-${moneyFormatter.format(property?.houseCost || 0)}`;
    case "comprarHotel":
      return `-${moneyFormatter.format(property?.hotelCost || property?.houseCost || 0)}`;
    case "levantarHipoteca":
      return `-${moneyFormatter.format(mortgageLiftAmount(property))}`;
    case "hipotecarPropiedad":
      return `+${moneyFormatter.format(property?.mortgageValue || 0)}`;
    case "venderCasa":
      return `+${moneyFormatter.format(Math.floor((property?.houseCost || 0) / 2))}`;
    case "venderHotel":
      return `+${moneyFormatter.format(Math.floor((property?.hotelCost || property?.houseCost || 0) / 2))}`;
    default:
      return "";
  }
}

function threeDBuildLabel(property, statusLabel) {
  if (!property?.price) return statusLabel || "No aplica";
  if (property.hasHotel) return "Hotel";
  if ((property.houses || 0) > 0) return `${property.houses} casas`;
  if (property.propertyKind === "SOLAR") return "Sin construcciones";
  return statusLabel || "Sin construcciones";
}

function buildThreeDSelectedSpaceModel({ space, owner = null, ownerProperty = null, visitors = [], board = [] }) {
  if (!space) return null;

  const property = mergeThreeDSpaceProperty(space, ownerProperty);
  const summary = buildThreeDSpaceSummary(space, owner, property, visitors, board);
  const typeLabel = spaceTypeLabel(property);
  const groupLabel = threeDGroupLabel(property);
  const ownerName = owner?.name || (property?.price ? "Banco" : "No aplica");

  return {
    space,
    property,
    owner,
    visitors,
    typeLabel,
    groupLabel,
    ownerName,
    statusLabel: summary.statusLabel || "Informacion no disponible",
    description: summary.description || "Informacion no disponible para esta casilla.",
    priceLabel: property?.price ? moneyFormatter.format(property.price) : "No aplica",
    baseRentLabel: threeDBaseRentLabel(property),
    rentPreviewLabel: summary.rentPreviewLabel || "Informacion no disponible",
    mortgageLabel: property?.mortgageValue ? moneyFormatter.format(property.mortgageValue) : "No aplica",
    buildLabel: threeDBuildLabel(property, summary.statusLabel),
    visitorLabel: visitors.length ? visitors.map((player) => player.name).join(", ") : "Sin visitas",
    accent: property?.colorGroup
      ? colorGroupMeta[property.colorGroup]?.accent || colorGroupMeta[property.colorGroup]?.color || "#fbbf24"
      : "#fbbf24",
    rentRows: buildThreeDRentRows(space, owner, property, board)
  };
}

function buildThreeDSpaceActions({
  spaceModel,
  visiblePendingPurchaseSpace,
  isMyTurn,
  myActions,
  currentUserId
}) {
  if (!spaceModel?.space) return [];

  const { space, property, owner } = spaceModel;
  const isOwnedByMe = sameEntityId(owner?.id, currentUserId);
  const isTradableSpace = Boolean(property?.price && property?.id);
  const purchaseIsHere = visiblePendingPurchaseSpace?.id === space.id && isMyTurn;
  const actions = [];

  if (purchaseIsHere && myActions.includes("comprarPropiedad")) {
    actions.push(
      { label: "Comprar", detail: threeDActionMoneyDetail("comprarPropiedad", property), type: "engine", actionName: "comprarPropiedad", tone: "success" },
      { label: "Subastar", type: "engine", actionName: "rechazarCompra", tone: "danger" }
    );
  }

  if (isOwnedByMe && property?.management) {
    propertyActionOrder.forEach(([actionName, label]) => {
      if (property.management[actionName]?.allowed) {
        actions.push({
          label,
          detail: threeDActionMoneyDetail(actionName, property),
          type: "engine",
          actionName,
          payload: { propertyId: property.id }
        });
      }
    });
  }

  if (isTradableSpace && isOwnedByMe) {
    actions.push({ label: "Vender", type: "trade", intent: "sell" });
  }

  if (isTradableSpace && owner && !isOwnedByMe) {
    actions.push({ label: "Ofertar", type: "trade", intent: "buy" });
  }

  return actions.slice(0, 4);
}

function buildThreeDSelectedSpaceInfo(spaceModel, actions = [], ownerDisplay = null) {
  if (!spaceModel?.property) return null;

  const { property, typeLabel, groupLabel } = spaceModel;
  const typeWithGroup = groupLabel && groupLabel !== "Especial"
    ? `${typeLabel} - ${groupLabel}`
    : typeLabel || groupLabel || "Especial";

  return {
    id: property.id,
    index: Number.isInteger(property.index) ? property.index : 0,
    name: property.name || "Informacion no disponible",
    type: typeWithGroup,
    groupLabel,
    ownerName: spaceModel.ownerName || "Banco",
    statusLabel: spaceModel.statusLabel || "Informacion no disponible",
    description: spaceModel.description || "Informacion no disponible",
    priceLabel: spaceModel.priceLabel || "Informacion no disponible",
    baseRentLabel: spaceModel.baseRentLabel || "Informacion no disponible",
    rentPreviewLabel: spaceModel.rentPreviewLabel || "Informacion no disponible",
    mortgageLabel: spaceModel.mortgageLabel || "Informacion no disponible",
    buildLabel: spaceModel.buildLabel || "Informacion no disponible",
    visitorLabel: spaceModel.visitorLabel || "Sin visitas",
    accent: spaceModel.accent || "#fbbf24",
    ownerColor: ownerDisplay?.color || null,
    rentRows: spaceModel.rentRows || [],
    actions
  };
}

const ThreeDTablePanel = memo(function ThreeDTablePanel({
  state,
  players,
  currentUserId,
  currentPlayerId,
  tokenStylesById,
  customTokens,
  myPlayer,
  selectedSpace,
  selectionVersion,
  selectedOwner,
  selectedVisitors,
  selectedOwnerProperty,
  events,
  playersById,
  boardById,
  onSelectSpace,
  onManage,
  onOpenTrade,
  onPrepareTrade
}) {
  const [utilityPanel, setUtilityPanel] = useState("");
  const currentPlayer = players.find((player) => sameEntityId(player.id, currentPlayerId));
  const dice = state?.turn?.lastRoll?.dice || [];
  const diceTotal = state?.turn?.lastRoll?.total ?? dice.reduce((sum, value) => sum + value, 0);
  const recentEvents = (events || []).slice(-5).reverse();
  const ranking = state?.ranking?.length
    ? state.ranking
    : [...players]
      .sort((left, right) => (right.cash || 0) - (left.cash || 0))
      .map((player) => ({
        playerId: player.id,
        name: player.name,
        wealth: player.cash || 0,
        properties: player.properties?.length || 0,
        bankrupt: player.bankrupt
      }));
  const propertyGroups = useMemo(
    () => groupTradeProperties(myPlayer?.properties || []),
    [myPlayer?.properties]
  );
  const propertyPortfolioValue = (myPlayer?.properties || []).reduce(
    (total, property) => total + Number(property.price || property.mortgageValue || 0),
    0
  );
  const mortgagedProperties = (myPlayer?.properties || []).filter((property) => property.isMortgaged).length;

  return (
    <>
      <aside className="monopoly-3d-left-hud" aria-label="Turno e historial">
        <div className="monopoly-3d-turn-focus">
          <span className="monopoly-3d-panel-label">Turno actual</span>
          <div className="monopoly-3d-turn-player">
            <TokenChip
              tokenStyle={tokenStylesById[currentPlayer?.id] || resolveTokenStyle(currentPlayer || {}, customTokens || {})}
              className="h-10 w-10 text-xs"
            />
            <div>
              <strong>{currentPlayer?.name || "Jugador"}</strong>
              <em>{phaseLabel[state?.turn?.phase] || state?.turn?.phase || "Esperando"}</em>
            </div>
          </div>
          <div className="monopoly-3d-turn-metrics">
            <span>
              <small>Ronda</small>
              <strong>{state?.turn?.turnNumber || 1}</strong>
            </span>
            <span>
              <small>Ultima tirada</small>
              <strong>{dice.length ? `${dice.join(" + ")} = ${diceTotal}` : "--"}</strong>
            </span>
          </div>
        </div>

        <div className="monopoly-3d-event-log">
          <header>
            <span className="monopoly-3d-panel-label">Actividad reciente</span>
            <i aria-hidden="true" />
          </header>
          {recentEvents.length === 0 ? (
            <p className="monopoly-3d-empty">La mesa esta lista. La actividad aparecera aqui.</p>
          ) : (
            recentEvents.map((event) => {
              const summary = describeEvent(event, playersById, boardById);
              return (
                <article key={event.id}>
                  <i className={`tone-${eventTone(event.type)}`} aria-hidden="true" />
                  <div>
                    <strong>{summary.title}</strong>
                    <p>{summary.body}</p>
                  </div>
                </article>
              );
            })
          )}
        </div>

        <nav className="monopoly-3d-utility-actions" aria-label="Informacion de la partida">
          <button
            type="button"
            className={cx(utilityPanel === "assets" && "is-active")}
            onClick={() => setUtilityPanel((current) => current === "assets" ? "" : "assets")}
          >
            <Building2 size={15} />
            Propiedades
          </button>
          <button
            type="button"
            className={cx(utilityPanel === "ranking" && "is-active")}
            onClick={() => setUtilityPanel((current) => current === "ranking" ? "" : "ranking")}
          >
            <Trophy size={15} />
            Ranking
          </button>
        </nav>
      </aside>

      {utilityPanel && (
        <aside className="monopoly-3d-utility-panel" aria-label={utilityPanel === "assets" ? "Mis propiedades" : "Ranking"}>
          <header>
            <span>
              {utilityPanel === "assets" ? <Building2 size={17} /> : <Trophy size={17} />}
              <strong>{utilityPanel === "assets" ? "Mis propiedades" : "Ranking de la mesa"}</strong>
            </span>
            <button type="button" onClick={() => setUtilityPanel("")} title="Cerrar">
              <X size={16} />
            </button>
          </header>

          {utilityPanel === "assets" && (
            <div className="monopoly-3d-utility-list">
              {(myPlayer?.properties || []).length === 0 ? (
                <p className="monopoly-3d-empty">Todavia no tienes propiedades.</p>
              ) : (
                <>
                  <div className="monopoly-3d-portfolio-summary">
                    <span>
                      <small>Activos</small>
                      <strong>{myPlayer.properties.length}</strong>
                    </span>
                    <span>
                      <small>Valor base</small>
                      <strong>{moneyFormatter.format(propertyPortfolioValue)}</strong>
                    </span>
                    <span className={mortgagedProperties ? "is-warning" : ""}>
                      <small>Hipotecas</small>
                      <strong>{mortgagedProperties}</strong>
                    </span>
                  </div>
                  <button type="button" className="monopoly-3d-market-button" onClick={onOpenTrade}>
                    <Gavel size={15} />
                    Abrir mercado
                  </button>
                  <div className="monopoly-3d-portfolio-groups">
                    {propertyGroups.map((group) => (
                      <section key={group.key} className="monopoly-3d-portfolio-group">
                        <header>
                          <i style={{ background: group.accent }} />
                          <span>
                            <strong>{group.label}</strong>
                            <small>{group.copy}</small>
                          </span>
                          <b>{group.properties.length}</b>
                        </header>
                        <div>
                          {group.properties.map((property) => (
                            <button
                              key={property.id}
                              type="button"
                              className={cx("monopoly-3d-utility-row", property.isMortgaged && "is-mortgaged")}
                              onClick={() => {
                                setUtilityPanel("");
                                onSelectSpace(property.id);
                              }}
                            >
                              <span>
                                <strong>{property.name}</strong>
                                <small>
                                  {property.isMortgaged
                                    ? "Hipotecada"
                                    : property.hasHotel
                                      ? "Hotel construido"
                                      : property.houses
                                        ? `${property.houses} casas`
                                        : "Disponible para gestionar"}
                                </small>
                              </span>
                              <em>{moneyFormatter.format(property.price || property.mortgageValue || 0)}</em>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {utilityPanel === "ranking" && (
            <div className="monopoly-3d-utility-list">
              {ranking.map((entry, index) => {
                const playerId = entry.playerId ?? entry.id;
                const player = playersById.get(playerId) || entry;
                return (
                  <article key={playerId || index} className={cx("monopoly-3d-ranking-row", index === 0 && "is-leading")}>
                    <b>{index + 1}</b>
                    <span>
                      <strong>{entry.name || player.name || "Jugador"}</strong>
                      <small>{entry.bankrupt ? "En quiebra" : `${entry.properties ?? player.properties?.length ?? 0} propiedades`}</small>
                    </span>
                    <Money amount={entry.wealth ?? player.cash ?? 0} />
                  </article>
                );
              })}
            </div>
          )}
        </aside>
      )}

      <section
        className="monopoly-3d-player-dock"
        aria-label="Jugadores"
        style={{ "--player-count": Math.max(1, Math.min(players.length, 6)) }}
      >
        {players.map((player, index) => {
          const tokenStyle = tokenStylesById[player.id] || customTokens?.[player.id] || resolveTokenStyle({ ...player, colorIndex: index }, customTokens || {});
          const isCurrent = sameEntityId(player.id, currentPlayerId);
          const isLocal = sameEntityId(player.id, currentUserId);
          const space = state?.board?.find((entry) => entry.index === player.position);

          return (
          <button
            key={player.id}
            type="button"
            className={cx("monopoly-3d-player-card", isCurrent && "is-current", player.bankrupt && "is-bankrupt")}
            onClick={() => space && onSelectSpace(space.id)}
          >
            <TokenChip tokenStyle={tokenStyle} className="h-9 w-9 text-xs" />
            <span className="monopoly-3d-player-card-main">
              <small>{isCurrent ? "En turno" : isLocal ? "Tu ficha" : `Casilla ${player.position}`}</small>
              <strong>{player.name}</strong>
            </span>
            <span className="monopoly-3d-player-card-stats">
              <strong><Money amount={player.cash} /></strong>
              <small>{player.properties?.length || 0} props</small>
            </span>
          </button>
          );
        })}
      </section>
    </>
  );
}, areThreeDTablePanelPropsEqual);

function areThreeDTablePanelPropsEqual(previous, next) {
  return (
    previous.state === next.state &&
    previous.players === next.players &&
    previous.currentUserId === next.currentUserId &&
    previous.currentPlayerId === next.currentPlayerId &&
    previous.tokenStylesById === next.tokenStylesById &&
    previous.customTokens === next.customTokens &&
    previous.myPlayer === next.myPlayer &&
    previous.selectedSpace === next.selectedSpace &&
    previous.selectionVersion === next.selectionVersion &&
    previous.selectedOwner === next.selectedOwner &&
    previous.selectedVisitors === next.selectedVisitors &&
    previous.selectedOwnerProperty === next.selectedOwnerProperty &&
    previous.events === next.events &&
    previous.playersById === next.playersById &&
    previous.boardById === next.boardById
  );
}

function VictoryCeremony({ state, playersById, boardById, currentUserId, onExit }) {
  if (!state?.winnerId) return null;

  const winner = playersById.get(state.winnerId);
  const isWinner = sameEntityId(state.winnerId, currentUserId);
  const finalStats = state.finalStats || null;
  const statRowsById = new Map((finalStats?.players || []).map((row) => [row.playerId, row]));
  const finalRows = (state.ranking?.length ? state.ranking : finalStats?.players?.length ? finalStats.players : state.players || [])
    .map((entry, index) => {
      const playerId = entry.playerId ?? entry.id;
      const player = playersById.get(playerId) || entry;
      const statsRow = statRowsById.get(playerId) || {};
      const properties = player?.properties || [];
      const propertyValue = properties.reduce((total, property) => (
        total + (property.price || (property.mortgageValue ? property.mortgageValue * 2 : 0))
      ), 0);
      const cash = Number(player?.cash ?? entry.cash ?? 0) || 0;
      const wealth = Number(entry.wealth ?? player?.wealth ?? cash + propertyValue) || 0;
      const houses = properties.reduce((total, property) => total + (Number(property.houses) || 0), 0);
      const hotels = properties.filter((property) => property.hasHotel).length;
      const mortgaged = properties.filter((property) => property.isMortgaged).length;

      return {
        id: playerId ?? index,
        name: entry.name || player?.name || `Jugador ${index + 1}`,
        cash,
        wealth,
        propertyValue,
        properties: properties.length,
        houses,
        hotels,
        mortgaged,
        bankrupt: Boolean(player?.bankrupt),
        moneyReceived: statsRow.moneyReceived || 0,
        moneyPaid: statsRow.moneyPaid || 0,
        rentPaid: statsRow.rentPaid || 0,
        rentReceived: statsRow.rentReceived || 0,
        cardsDrawn: statsRow.cardsDrawn || 0,
        jailVisits: statsRow.jailVisits || 0,
        trades: statsRow.trades || 0
      };
    })
    .sort((left, right) => right.wealth - left.wealth);
  const podium = finalRows.slice(0, 3);
  const winnerRow = finalRows.find((row) => sameEntityId(row.id, state.winnerId)) || podium[0] || null;
  const maxWealth = Math.max(1, ...finalRows.map((row) => Math.max(0, row.wealth)));
  const totalWealth = finalRows.reduce((total, row) => total + Math.max(0, row.wealth), 0);
  const totalProperties = finalRows.reduce((total, row) => total + row.properties, 0);
  const bankruptCount = finalRows.filter((row) => row.bankrupt).length;
  const turnCount = Number(finalStats?.totals?.turns || state.turn?.turnNumber || 0);
  const moneyMoved = Number(finalStats?.totals?.moneyMoved || 0);
  const highlightRows = finalStats?.highlights || [];
  const timelineRows = (finalStats?.timeline || state.recentEvents || []).slice(-8).reverse();
  const statCards = [
    { label: "Turnos", value: turnCount || "--" },
    { label: "Patrimonio ganador", value: <Money amount={winnerRow?.wealth || 0} /> },
    { label: "Dinero movido", value: <Money amount={moneyMoved} /> },
    { label: "Propiedades", value: totalProperties },
    { label: "Subastas", value: finalStats?.totals?.auctions || 0 },
    { label: "Tratos", value: finalStats?.totals?.trades || 0 },
    { label: "Cartas", value: finalStats?.totals?.cardsDrawn || 0 },
    { label: "Jugadores fuera", value: bankruptCount }
  ];

  return (
    <div className="monopoly-victory-overlay" role="dialog" aria-modal="true" aria-label="Resultado de la partida">
      <section className={cx("monopoly-victory-card", isWinner ? "is-winner" : "is-defeat")}>
        <div className="monopoly-victory-hero">
          <div className="monopoly-victory-crown">
            {isWinner ? <Crown size={44} /> : <Trophy size={44} />}
          </div>
          <div className="monopoly-victory-title">
            <p className="monopoly-victory-kicker">{isWinner ? "Victoria total" : "Partida terminada"}</p>
            <h2>{winner?.name || "Jugador"} domina el tablero</h2>
            <p className="monopoly-victory-copy">
              {isWinner
                ? "Cerraste la mesa con el mejor patrimonio y el control final de la partida."
                : "Resultado final registrado. Aqui esta el cierre completo de la mesa."}
            </p>
          </div>
        </div>

        <div className="monopoly-victory-stats">
          {statCards.map((card) => (
            <article key={card.label}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </article>
          ))}
        </div>

        <div className="monopoly-victory-grid">
          <section className="monopoly-victory-panel">
            <header>
              <Trophy size={18} />
              <h3>Podio final</h3>
            </header>
            <div className="monopoly-victory-podium">
              {podium.map((entry, index) => (
                <article key={entry.id} className={cx(index === 0 && "champion")}>
                  <span>{index + 1}</span>
                  <strong>{entry.name}</strong>
                  <Money amount={entry.wealth} />
                </article>
              ))}
            </div>
          </section>

          <section className="monopoly-victory-panel">
            <header>
              <Wallet size={18} />
              <h3>Patrimonio</h3>
            </header>
            <div className="monopoly-victory-bars">
              {finalRows.map((row, index) => {
                const width = `${Math.max(4, Math.round((Math.max(0, row.wealth) / maxWealth) * 100))}%`;
                const share = totalWealth > 0 ? Math.round((Math.max(0, row.wealth) / totalWealth) * 100) : 0;
                return (
                  <article key={row.id}>
                    <span>
                      <strong>{index + 1}. {row.name}</strong>
                      <em>{share}%</em>
                    </span>
                    <div className="monopoly-victory-bar-track">
                      <i style={{ width }} />
                    </div>
                    <Money amount={row.wealth} />
                  </article>
                );
              })}
            </div>
          </section>

          <section className="monopoly-victory-panel monopoly-victory-panel-wide">
            <header>
              <Building2 size={18} />
              <h3>Activos por jugador</h3>
            </header>
            <div className="monopoly-victory-assets">
              {finalRows.map((row) => {
                const assetTotal = Math.max(1, Math.max(0, row.cash) + Math.max(0, row.propertyValue));
                const cashWidth = `${Math.round((Math.max(0, row.cash) / assetTotal) * 100)}%`;
                const propertyWidth = `${Math.max(0, 100 - Math.round((Math.max(0, row.cash) / assetTotal) * 100))}%`;
                return (
                  <article key={row.id}>
                    <div>
                      <strong>{row.name}</strong>
                      <span>{row.properties} props · {row.houses} casas · {row.hotels} hoteles · {row.mortgaged} hipotecas</span>
                    </div>
                    <div className="monopoly-victory-stack" aria-label={`Activos de ${row.name}`}>
                      <i className="cash" style={{ width: cashWidth }} />
                      <i className="property" style={{ width: propertyWidth }} />
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="monopoly-victory-legend">
              <span><i className="cash" /> Efectivo</span>
              <span><i className="property" /> Propiedades</span>
            </div>
          </section>

          <section className="monopoly-victory-panel">
            <header>
              <Sparkles size={18} />
              <h3>Momentos clave</h3>
            </header>
            <div className="monopoly-victory-highlights">
              {highlightRows.length ? highlightRows.map((item) => (
                <article key={`${item.type}-${item.playerId || item.label}`}>
                  <span>{item.label}</span>
                  <strong>{item.playerName || "Mesa"}</strong>
                  <em>{item.detail || (typeof item.value === "number" ? moneyFormatter.format(item.value) : item.value)}</em>
                </article>
              )) : (
                <p className="monopoly-victory-empty">No hubo suficientes eventos guardados para destacar jugadas.</p>
              )}
            </div>
          </section>

          <section className="monopoly-victory-panel">
            <header>
              <Receipt size={18} />
              <h3>Ultimos eventos</h3>
            </header>
            <div className="monopoly-victory-timeline">
              {timelineRows.length ? timelineRows.map((event) => {
                const summary = describeEvent(event, playersById, boardById);
                return (
                  <article key={event.id}>
                    <span>T{event.turnNumber || "--"}</span>
                    <strong>{summary.title}</strong>
                    <em>{summary.body}</em>
                  </article>
                );
              }) : (
                <p className="monopoly-victory-empty">Sin historial reciente disponible.</p>
              )}
            </div>
          </section>
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
  boardById,
  state,
  bidAmount,
  setBidAmount,
  canBidAuction,
  canPassAuction,
  onAction,
  onManageDebt
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
          Ver carta
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
    const selectedTax = resolvePendingTaxSelection(pendingTax);
    return (
      <div className="monopoly-center-action-zone is-decision">
        <div className="monopoly-board-decision-copy">
          <span>Impuesto</span>
          <strong>{pendingTaxAppliedLabel(pendingTax)}</strong>
        </div>
        <div className="monopoly-board-action-row">
          <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto")}>
            Pagar {moneyFormatter.format(selectedTax.amount)}
          </ActionButton>
        </div>
      </div>
    );
  }

  if (auction) {
    return (
      <div className="monopoly-center-action-zone is-auction-live">
        <AuctionControls
          auction={auction}
          playersById={playersById}
          boardById={boardById}
          bidAmount={bidAmount}
          setBidAmount={setBidAmount}
          canBidAuction={canBidAuction}
          canPassAuction={canPassAuction}
          onAction={onAction}
          compact
        />
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
    const debtPlayer = state?.players?.find((player) => sameEntityId(player.id, pendingDebt.debtorId));
    const canPayDebt = (debtPlayer?.cash || 0) >= (pendingDebt.amount || 0);
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => canPayDebt ? onAction("resolverDeudaPendiente") : onManageDebt?.()}>
          {canPayDebt ? "Pagar deuda" : "Abrir rescate"}
        </ActionButton>
      </div>
    );
  }

  if (isMyTurn && myActions.includes("terminarTurno")) {
    return (
      <div className="monopoly-center-action-zone">
        <ActionButton className="monopoly-board-main-action" onClick={() => onAction("terminarTurno")}>
          <TimerReset size={22} />
          {hasPendingDoubleReroll(state) ? "Volver a tirar" : "Terminar turno"}
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
            <p className="monopoly-panel-eyebrow">{cardDeckLabel(pendingCard.deck)}</p>
            <h4>{pendingCard.card?.title || "Carta activa"}</h4>
            <p>{cardSceneCopy(pendingCard.card, pendingCard.deck, state?.players?.find((player) => sameEntityId(player.id, state.currentPlayerId))?.name || "Jugador")}</p>
            <ActionButton onClick={() => onAction("resolverCarta")}>
              <Receipt size={18} />
              Ver carta
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
            <h4>{pendingTaxAppliedLabel(pendingTax)}</h4>
            <p>{pendingTaxAppliedReason(pendingTax)}</p>
            <ActionButton tone="secondary" onClick={() => onAction("pagarImpuesto")}>
              Pagar {moneyFormatter.format(resolvePendingTaxSelection(pendingTax).amount)}
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
                      min={auctionMinimumBid(auction)}
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
          <ActionButton
            onClick={() => {
              const debtPlayer = state?.players?.find((player) => sameEntityId(player.id, pendingDebt.debtorId));
              if ((debtPlayer?.cash || 0) >= (pendingDebt.amount || 0)) {
                onAction("resolverDeudaPendiente");
              } else {
                onOpenTrade();
              }
            }}
          >
            <Hammer size={18} />
            {(state?.players?.find((player) => sameEntityId(player.id, pendingDebt.debtorId))?.cash || 0) >= (pendingDebt.amount || 0)
              ? `Pagar deuda - ${moneyFormatter.format(pendingDebt.amount)}`
              : "Abrir rescate"}
          </ActionButton>
        )}

        {isMyTurn && myActions.includes("terminarTurno") && (
          <ActionButton className="monopoly-main-turn-button" onClick={() => onAction("terminarTurno")}>
            <TimerReset size={22} />
            {hasPendingDoubleReroll(state) ? "Volver a tirar" : "Terminar turno"}
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
      {players.map((player, index) => {
        const jailCardCount = Object.values(player.getOutOfJailCards || {}).reduce((total, count) => total + Number(count || 0), 0);
        return (
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
            {jailCardCount > 0 && (
              <span className="jail-card-badge"><ShieldAlert size={13} /> {jailCardCount} carta carcel</span>
            )}
          </div>
        </article>
        );
      })}
    </div>
  );
}

function PropertySummary({ player, onSelect, onOpenTrade }) {
  const mortgagedCount = (player?.properties || []).filter((property) => property.isMortgaged).length;
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
          {mortgagedCount > 0 && (
            <span className="monopoly-asset-alert">
              <AlertTriangle size={13} />
              {mortgagedCount} hipotecada{mortgagedCount === 1 ? "" : "s"}
            </span>
          )}
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
                    <button
                      key={property.id}
                      type="button"
                      className={property.isMortgaged ? "is-mortgaged" : ""}
                      onClick={() => onSelect(property.id)}
                      title={property.isMortgaged ? `${property.name} hipotecada` : property.name}
                    >
                      <span>{property.name}</span>
                      {property.isMortgaged && <em className="mortgage-badge">Hipotecada</em>}
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

function TradeModalV2({
  open,
  onClose,
  myPlayer,
  players,
  currentUserId,
  propertyTrade,
  setPropertyTrade,
  cardTrade,
  setCardTrade,
  onAction,
  customTokens
}) {
  const [marketAsset, setMarketAsset] = useState("properties");
  const propertyIntent = propertyTrade.intent || "sell";
  const cardIntent = cardTrade.intent || "sell";
  const activeIntent = marketAsset === "properties" ? propertyIntent : cardIntent;
  const tradeTargets = useMemo(
    () => players.filter((player) => !sameEntityId(player.id, currentUserId) && !player.bankrupt),
    [players, currentUserId]
  );
  const tokenById = useMemo(() => {
    const map = new Map();
    tradeTargets.forEach((player, index) => {
      map.set(player.id, customTokens?.[player.id] || resolveTokenStyle({ ...player, colorIndex: index }, customTokens || {}));
    });
    return map;
  }, [tradeTargets, customTokens]);
  const buyableProperties = useMemo(() => tradeTargets.flatMap((owner) => (
    (owner.properties || []).map((property) => ({
      ...property,
      sellerId: owner.id,
      sellerName: owner.name,
      sellerProperties: owner.properties || []
    }))
  )), [tradeTargets]);
  const activePropertyPool = propertyIntent === "sell" ? (myPlayer?.properties || []) : buyableProperties;
  const tradePropertyGroups = useMemo(() => groupTradeProperties(activePropertyPool), [activePropertyPool]);
  const selectedProperty = activePropertyPool.find((property) => property.id === propertyTrade.propertyId) || null;
  const selectedSeller = propertyIntent === "buy"
    ? tradeTargets.find((player) => sameEntityId(player.id, selectedProperty?.sellerId || propertyTrade.sellerId)) || null
    : myPlayer;
  const selectedBuyer = propertyIntent === "sell"
    ? tradeTargets.find((player) => sameEntityId(player.id, propertyTrade.buyerId)) || null
    : myPlayer;
  const sellerProperties = propertyIntent === "buy" ? (selectedProperty?.sellerProperties || selectedSeller?.properties || []) : (myPlayer?.properties || []);
  const propertyTradeBlock = propertyTradeBlockReason(selectedProperty, sellerProperties);
  const propertyTradePrice = Math.max(0, Number(propertyTrade.price) || 0);
  const transferCost = mortgageTransferCost(selectedProperty, propertyTrade.liftMortgage);
  const buyerCash = Number(selectedBuyer?.cash || 0);
  const buyerCanPayProperty = Boolean(selectedBuyer) && buyerCash >= propertyTradePrice;
  const buyerCanLiftMortgage = !selectedProperty?.isMortgaged || !propertyTrade.liftMortgage || buyerCash >= propertyTradePrice + transferCost;
  const propertyTradeWarning = propertyTradeBlock ||
    (selectedProperty && !selectedBuyer ? "Elige con quien quieres cerrar este trato." : "") ||
    (selectedBuyer && !buyerCanPayProperty ? `${selectedBuyer.name} no tiene efectivo suficiente para ese precio.` : "") ||
    (selectedBuyer && !buyerCanLiftMortgage ? `${selectedBuyer.name} necesita cubrir precio, interes y levantamiento de hipoteca.` : "");
  const canSubmitPropertyTrade = Boolean(selectedProperty && selectedSeller && selectedBuyer && !propertyTradeBlock && buyerCanPayProperty && buyerCanLiftMortgage);
  const propertyBaseAmount = selectedProperty
    ? Math.max(
        selectedProperty.mortgageValue || 0,
        Math.round(((selectedProperty.price || selectedProperty.mortgageValue || 100) * 0.7) / 50) * 50
      )
    : 100;
  const propertyPresets = amountPresets(propertyBaseAmount, [selectedProperty?.price, selectedProperty?.mortgageValue]);
  const totalJailCards = Object.values(myPlayer?.getOutOfJailCards || {}).reduce((total, count) => total + Number(count || 0), 0);
  const buyableCards = useMemo(() => tradeTargets.flatMap((seller) => (
    ["CASUALIDAD", "ARCA_COMUNAL"]
      .filter((deck) => Number(seller.getOutOfJailCards?.[deck] || 0) > 0)
      .map((deck) => ({
        id: `${seller.id}:${deck}`,
        sellerId: seller.id,
        sellerName: seller.name,
        sellerCash: seller.cash,
        deck,
        count: Number(seller.getOutOfJailCards?.[deck] || 0)
      }))
  )), [tradeTargets]);
  const selectedDeckCount = Number(myPlayer?.getOutOfJailCards?.[cardTrade.deck] || 0);
  const selectedCardBuyer = tradeTargets.find((player) => sameEntityId(player.id, cardTrade.buyerId)) || null;
  const selectedCardSeller = cardIntent === "buy"
    ? buyableCards.find((option) => sameEntityId(option.sellerId, cardTrade.sellerId) && option.deck === cardTrade.deck) || null
    : null;
  const cardTradePrice = Math.max(0, Number(cardTrade.price) || 0);
  const cardBuyer = cardIntent === "sell" ? selectedCardBuyer : myPlayer;
  const cardSellerName = cardIntent === "sell" ? (myPlayer?.name || "Tu") : selectedCardSeller?.sellerName;
  const cardBuyerName = cardIntent === "sell" ? selectedCardBuyer?.name : (myPlayer?.name || "tu jugador");
  const cardCanSubmit = cardIntent === "sell"
    ? Boolean(selectedCardBuyer && selectedDeckCount > 0)
    : Boolean(selectedCardSeller && Number(myPlayer?.cash || 0) >= cardTradePrice);
  const cardWarning = cardIntent === "sell" && selectedDeckCount <= 0
    ? "No tienes pase de ese mazo. Ese comodin sigue en manos del destino."
    : cardIntent === "buy" && selectedCardSeller && Number(myPlayer?.cash || 0) < cardTradePrice
      ? "Tu cartera no alcanza para esta invitacion de compra."
      : "";
  const cardBaseAmount = Math.max(100, cardIntent === "sell" && selectedDeckCount ? 250 : 200);
  const cardPresets = amountPresets(cardBaseAmount, [250, 400, 600]);
  const contextualPropertyTrade = marketAsset === "properties" && propertyTrade.source === "space" && Boolean(selectedProperty);

  if (!open) return null;

  const resetTrades = () => {
    setPropertyTrade({ ...defaultPropertyTrade });
    setCardTrade({ ...defaultCardTrade });
  };
  const chooseAsset = (asset) => setMarketAsset(asset);
  const chooseIntent = (intent) => {
    if (marketAsset === "properties") {
      setPropertyTrade({ ...defaultPropertyTrade, intent });
    } else {
      setCardTrade({ ...defaultCardTrade, intent });
    }
  };
  const submitPropertyTrade = () => {
    if (!canSubmitPropertyTrade) return;
    if (propertyIntent === "sell") {
      onAction("crearOfertaPropiedad", {
        compradorId: propertyTrade.buyerId,
        propiedadId: selectedProperty.id,
        precio: propertyTradePrice,
        levantarHipotecaAhora: propertyTrade.liftMortgage
      });
    } else {
      onAction("crearOfertaCompraPropiedad", {
        vendedorId: selectedProperty.sellerId,
        propiedadId: selectedProperty.id,
        precio: propertyTradePrice,
        levantarHipotecaAhora: propertyTrade.liftMortgage
      });
    }
    resetTrades();
    onClose();
  };
  const submitCardTrade = () => {
    if (!cardCanSubmit) return;
    if (cardIntent === "sell") {
      onAction("crearOfertaCartaCarcel", {
        compradorId: cardTrade.buyerId,
        deck: cardTrade.deck,
        precio: cardTradePrice
      });
    } else {
      onAction("crearOfertaCompraCartaCarcel", {
        vendedorId: selectedCardSeller.sellerId,
        deck: selectedCardSeller.deck,
        precio: cardTradePrice
      });
    }
    resetTrades();
    onClose();
  };

  if (contextualPropertyTrade) {
    const group = tradePropertyGroup(selectedProperty);
    return (
      <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
        <div className="monopoly-modal tone-info monopoly-trade-modal monopoly-trade-modal-v2 is-contextual">
          <div className="monopoly-trade-head">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">
                {propertyIntent === "buy" ? "Oferta de compra" : "Oferta de venta"}
              </p>
              <h3 className="mt-1 text-2xl font-black uppercase">Negociar {selectedProperty.name}</h3>
              <p className="mt-2 text-sm font-semibold opacity-85">
                La propiedad ya esta seleccionada. Solo define la contraparte y el precio.
              </p>
            </div>
            <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
          </div>

          <div className="monopoly-trade-context-grid">
            <section className="monopoly-trade-context-property">
              <div className="monopoly-trade-context-accent" style={{ background: group.accent }} />
              <span className="monopoly-panel-eyebrow">{group.label}</span>
              <h4>{selectedProperty.name}</h4>
              <p>{spaceTypeLabel(selectedProperty)}</p>
              <div className="monopoly-trade-context-stats">
                <span>Valor <strong>{moneyFormatter.format(selectedProperty.price || 0)}</strong></span>
                <span>Hipoteca <strong>{moneyFormatter.format(selectedProperty.mortgageValue || 0)}</strong></span>
                <span>Estado <strong>{selectedProperty.isMortgaged ? "Hipotecada" : selectedProperty.hasHotel ? "Hotel" : selectedProperty.houses ? `${selectedProperty.houses} casas` : "Libre"}</strong></span>
              </div>
              {propertyTradeBlock && (
                <div className="monopoly-trade-warning">
                  <AlertTriangle size={16} />
                  <span>{propertyTradeBlock}</span>
                </div>
              )}
            </section>

            <section className="monopoly-trade-context-editor">
              {propertyIntent === "sell" ? (
                <div className="monopoly-trade-step">
                  <p className="monopoly-trade-step-label">Elige comprador</p>
                  <div className="monopoly-trade-target-grid is-compact">
                    {tradeTargets.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className={cx("monopoly-trade-target-card", sameEntityId(propertyTrade.buyerId, player.id) && "active")}
                        onClick={() => setPropertyTrade((current) => ({ ...current, buyerId: player.id }))}
                      >
                        <TokenChip tokenStyle={tokenById.get(player.id)} className="h-10 w-10 text-xs" />
                        <div>
                          <strong>{player.name}</strong>
                          <span><Money amount={player.cash} /> disponibles</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="monopoly-trade-fixed-party">
                  <span>Vendedor</span>
                  <strong>{selectedSeller?.name || "Jugador"}</strong>
                  <small>Recibira tu invitacion de compra.</small>
                </div>
              )}

              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">Define el precio</p>
                <div className="monopoly-trade-price-presets">
                  {propertyPresets.map((amount) => (
                    <button
                      key={`context-price-${amount}`}
                      type="button"
                      className={propertyTrade.price === amount ? "active" : ""}
                      onClick={() => setPropertyTrade((current) => ({ ...current, price: amount }))}
                    >
                      {moneyFormatter.format(amount)}
                    </button>
                  ))}
                </div>
                <label className="monopoly-trade-context-price">
                  <span>Oferta personalizada</span>
                  <input
                    className="monopoly-input monopoly-trade-price-input"
                    type="number"
                    min={0}
                    value={propertyTrade.price}
                    onChange={(event) => setPropertyTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                  />
                </label>
                {selectedProperty.isMortgaged && (
                  <label className="monopoly-trade-toggle">
                    <input
                      type="checkbox"
                      checked={propertyTrade.liftMortgage}
                      onChange={(event) => setPropertyTrade((current) => ({ ...current, liftMortgage: event.target.checked }))}
                    />
                    <span>Levantar hipoteca al transferir</span>
                  </label>
                )}
              </div>
            </section>

            <aside className="monopoly-trade-context-summary">
              <span className="monopoly-panel-eyebrow">Resumen</span>
              <h5>{selectedBuyer?.name || (propertyIntent === "buy" ? myPlayer?.name : "Elige comprador")}</h5>
              <div className="monopoly-trade-context-flow">
                <span>Precio acordado <strong>{moneyFormatter.format(propertyTradePrice)}</strong></span>
                <span>Vendedor <strong>{selectedSeller?.name || "..."}</strong></span>
                <span>Comprador <strong>{selectedBuyer?.name || "..."}</strong></span>
              </div>
              {propertyTradeWarning && (
                <div className="monopoly-trade-warning">
                  <AlertTriangle size={16} />
                  <span>{propertyTradeWarning}</span>
                </div>
              )}
              <ActionButton tone="secondary" className="w-full justify-center" onClick={submitPropertyTrade} disabled={!canSubmitPropertyTrade}>
                <Scale size={18} />
                Enviar oferta
              </ActionButton>
              <button
                type="button"
                className="monopoly-trade-open-market"
                onClick={() => setPropertyTrade((current) => ({ ...current, source: "market" }))}
              >
                Ver mercado completo
              </button>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info monopoly-trade-modal monopoly-trade-modal-v2">
        <div className="monopoly-trade-head">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Mercado de mesa</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Centro de ofertas</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">
              Primero eliges botin, luego si compras o vendes. Todo queda como invitacion hasta que la otra persona acepte.
            </p>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="monopoly-trade-route">
          <aside className="monopoly-trade-route-menu">
            <div className="monopoly-trade-choice-grid">
              <button type="button" className={cx("monopoly-trade-choice-card", marketAsset === "properties" && "active")} onClick={() => chooseAsset("properties")}>
                <Building2 size={22} />
                <strong>Propiedades</strong>
                <span>Calles, trenes y servicios agrupados por pais/color.</span>
              </button>
              <button type="button" className={cx("monopoly-trade-choice-card", marketAsset === "cards" && "active")} onClick={() => chooseAsset("cards")}>
                <ShieldAlert size={22} />
                <strong>Cartas</strong>
                <span>Solo pases de salir de la carcel; las cartas normales se resuelven al caer.</span>
              </button>
            </div>

            <div className="monopoly-trade-intent-grid">
              {["buy", "sell"].map((intent) => (
                <button
                  key={intent}
                  type="button"
                  className={cx("monopoly-trade-intent-card", activeIntent === intent && "active")}
                  onClick={() => chooseIntent(intent)}
                >
                  {intent === "buy" ? <Wallet size={19} /> : <Send size={19} />}
                  <strong>{intent === "buy" ? "Comprar" : "Vender"}</strong>
                  <span>{intent === "buy" ? "Invitas al duenio a soltarte el activo." : "Invitas a alguien a comprarte el activo."}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="monopoly-trade-workbench">
            {marketAsset === "properties" ? (
              <>
                <div className="monopoly-trade-panel-head">
                  <div>
                    <p className="monopoly-panel-eyebrow">{propertyIntent === "buy" ? "Comprar propiedad" : "Vender propiedad"}</p>
                    <h4>{propertyIntent === "buy" ? "Elige que quieres comprar" : "Elige que quieres poner en vitrina"}</h4>
                  </div>
                  <span>{activePropertyPool.length} activos</span>
                </div>

                <div className="monopoly-trade-pickers">
                  <div className="monopoly-trade-help-card">
                    <Scale size={18} />
                    <p>
                      Las propiedades aparecen agrupadas por pais/color para encontrarlas rapido. Si el grupo tiene casas u hoteles, primero hay que vender edificios.
                    </p>
                  </div>
                  <div className="monopoly-trade-step">
                    <p className="monopoly-trade-step-label">1. Selecciona propiedad</p>
                    {activePropertyPool.length === 0 ? (
                      <div className="monopoly-empty-state">{propertyIntent === "buy" ? "Nadie tiene propiedades disponibles para venderte." : "No tienes propiedades para negociar ahora mismo."}</div>
                    ) : (
                      <div className="monopoly-trade-group-list">
                        {tradePropertyGroups.map((group) => (
                          <section key={group.key} className="monopoly-trade-property-group">
                            <div className="monopoly-trade-property-group-head">
                              <span style={{ backgroundColor: group.accent }} />
                              <div>
                                <strong>{group.label}</strong>
                                <em>{group.copy} · {group.properties.length} activos</em>
                              </div>
                            </div>
                            <div className="monopoly-trade-property-grid">
                              {group.properties.map((property) => {
                                const owner = propertyIntent === "buy" ? tradeTargets.find((player) => sameEntityId(player.id, property.sellerId)) : myPlayer;
                                const blockedReason = propertyTradeBlockReason(property, propertyIntent === "buy" ? property.sellerProperties : myPlayer?.properties || []);
                                return (
                                  <button
                                    key={`${propertyIntent}-${property.id}`}
                                    type="button"
                                    className={cx("monopoly-trade-property-card", propertyTrade.propertyId === property.id && "active", blockedReason && "is-locked")}
                                    onClick={() => {
                                      const suggestedPrice = Math.max(
                                        property.mortgageValue || 0,
                                        Math.round(((property.price || property.mortgageValue || 100) * 0.7) / 50) * 50
                                      );
                                      setPropertyTrade((current) => ({
                                        ...current,
                                        propertyId: property.id,
                                        sellerId: property.sellerId || "",
                                        price: current.propertyId === property.id && current.price > 0 ? current.price : suggestedPrice
                                      }));
                                    }}
                                  >
                                    <div className="monopoly-trade-property-top">
                                      <div>
                                        <span>{spaceTypeLabel(property)}</span>
                                        <strong>{property.name}</strong>
                                        {propertyIntent === "buy" && <small>Dueno: {owner?.name || property.sellerName}</small>}
                                      </div>
                                      <i style={{ backgroundColor: group.accent }} />
                                    </div>
                                    <div className="monopoly-trade-property-tags">
                                      <em>{property.price ? moneyFormatter.format(property.price) : "--"}</em>
                                      {property.isMortgaged && <em className="warn">Hipotecada</em>}
                                      {property.hasHotel && <em>Hotel</em>}
                                      {property.houses > 0 && <em>{property.houses} casas</em>}
                                      {blockedReason && <em className="warn">Bloqueada por edificios</em>}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>

                  {propertyIntent === "sell" && (
                    <div className="monopoly-trade-step">
                      <p className="monopoly-trade-step-label">2. Elige comprador</p>
                      <div className="monopoly-trade-target-grid">
                        {tradeTargets.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            className={cx("monopoly-trade-target-card", sameEntityId(propertyTrade.buyerId, player.id) && "active")}
                            onClick={() => setPropertyTrade((current) => ({ ...current, buyerId: player.id }))}
                          >
                            <TokenChip tokenStyle={tokenById.get(player.id)} className="h-11 w-11 text-sm" />
                            <div>
                              <strong>{player.name}</strong>
                              <span><Money amount={player.cash} /> en caja</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="monopoly-trade-step">
                    <p className="monopoly-trade-step-label">{propertyIntent === "sell" ? "3" : "2"}. Ajusta el precio</p>
                    <div className="monopoly-trade-price-presets">
                      {propertyPresets.map((amount) => (
                        <button
                          key={`property-price-${amount}`}
                          type="button"
                          className={propertyTrade.price === amount ? "active" : ""}
                          onClick={() => setPropertyTrade((current) => ({ ...current, price: amount }))}
                        >
                          {moneyFormatter.format(amount)}
                        </button>
                      ))}
                    </div>
                    <input
                      className="monopoly-input monopoly-trade-price-input"
                      type="number"
                      min={0}
                      value={propertyTrade.price}
                      onChange={(event) => setPropertyTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                    />
                    {selectedProperty?.isMortgaged && (
                      <label className="monopoly-trade-toggle">
                        <input
                          type="checkbox"
                          checked={propertyTrade.liftMortgage}
                          onChange={(event) => setPropertyTrade((current) => ({ ...current, liftMortgage: event.target.checked }))}
                        />
                        <span>Levantar hipoteca al transferir</span>
                      </label>
                    )}
                  </div>
                </div>

                <div className="monopoly-trade-summary">
                  <p className="monopoly-panel-eyebrow">Resumen del trato</p>
                  <h5>{selectedProperty ? selectedProperty.name : "Elige una propiedad para empezar"}</h5>
                  <p>
                    {selectedProperty && selectedSeller && selectedBuyer
                      ? propertyTradeBanter({
                          sellerName: selectedSeller.name || "Tu",
                          buyerName: selectedBuyer.name || "tu jugador",
                          propertyName: selectedProperty.name,
                          price: propertyTradePrice
                        })
                      : propertyIntent === "buy"
                        ? "Selecciona la propiedad rival y manda una invitacion de compra con flow diplomatico."
                        : "Selecciona propiedad y comprador para que el trato deje de flotar en el limbo."}
                  </p>
                  <div className="monopoly-trade-money-flow">
                    <span>Comprador <strong>{selectedBuyer?.name || "..."}</strong> pagara <strong>{moneyFormatter.format(propertyTradePrice)}</strong></span>
                    <span>Vendedor <strong>{selectedSeller?.name || "..."}</strong> recibira <strong>{moneyFormatter.format(propertyTradePrice)}</strong></span>
                    {selectedProperty?.isMortgaged && (
                      <span>Coste extra para comprador <strong>{moneyFormatter.format(transferCost)}</strong> {propertyTrade.liftMortgage ? "incluyendo levantar hipoteca" : "por interes de transferencia"}</span>
                    )}
                  </div>
                  {propertyTradeWarning && (
                    <div className="monopoly-trade-warning">
                      <AlertTriangle size={16} />
                      <span>{propertyTradeWarning}</span>
                    </div>
                  )}
                  <ActionButton tone="secondary" className="w-full justify-center" onClick={submitPropertyTrade} disabled={!canSubmitPropertyTrade}>
                    <Scale size={18} />
                    {propertyIntent === "buy" ? "Enviar oferta de compra" : "Enviar oferta de venta"}
                  </ActionButton>
                </div>
              </>
            ) : (
              <>
                <div className="monopoly-trade-panel-head">
                  <div>
                    <p className="monopoly-panel-eyebrow">{cardIntent === "buy" ? "Comprar carta" : "Vender carta"}</p>
                    <h4>Pases de salir de la carcel</h4>
                  </div>
                  <span>{cardIntent === "buy" ? `${buyableCards.length} en mesa` : `${totalJailCards} tuyas`}</span>
                </div>

                <div className="monopoly-trade-pickers">
                  <div className="monopoly-trade-help-card">
                    <ShieldAlert size={18} />
                    <p>
                      En Monopoly solo se comercian las cartas <strong>Salir libre de la carcel</strong>. Casualidad y Arca comunal normales son eventos: salen, se resuelven y hacen su travesura.
                    </p>
                  </div>

                  <div className="monopoly-trade-step">
                    <p className="monopoly-trade-step-label">1. Elige pase</p>
                    {cardIntent === "sell" ? (
                      <div className="monopoly-trade-deck-grid">
                        {["CASUALIDAD", "ARCA_COMUNAL"].map((deck) => (
                          <button
                            key={deck}
                            type="button"
                            className={cx("monopoly-trade-deck-card", cardTrade.deck === deck && "active")}
                            onClick={() => setCardTrade((current) => ({ ...current, deck }))}
                          >
                            <strong>{cardDeckLabel(deck)}</strong>
                            <span>{Number(myPlayer?.getOutOfJailCards?.[deck] || 0)} pases disponibles</span>
                            <em>{deck === "CASUALIDAD" ? "Caos amarillo, fuga con suerte." : "Vecinos organizados, escape comunitario."}</em>
                          </button>
                        ))}
                      </div>
                    ) : buyableCards.length === 0 ? (
                      <div className="monopoly-empty-state">Nadie tiene pases de carcel para comprarlos ahora.</div>
                    ) : (
                      <div className="monopoly-trade-deck-grid">
                        {buyableCards.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className={cx("monopoly-trade-deck-card", sameEntityId(cardTrade.sellerId, option.sellerId) && cardTrade.deck === option.deck && "active")}
                            onClick={() => setCardTrade((current) => ({ ...current, sellerId: option.sellerId, deck: option.deck }))}
                          >
                            <strong>{cardDeckLabel(option.deck)}</strong>
                            <span>{option.sellerName} tiene {option.count}</span>
                            <em>Invitacion de compra: si acepta, el pase cambia de bolsillo.</em>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {cardIntent === "sell" && (
                    <div className="monopoly-trade-step">
                      <p className="monopoly-trade-step-label">2. Elige comprador</p>
                      <div className="monopoly-trade-target-grid">
                        {tradeTargets.map((player) => (
                          <button
                            key={`card-${player.id}`}
                            type="button"
                            className={cx("monopoly-trade-target-card", sameEntityId(cardTrade.buyerId, player.id) && "active")}
                            onClick={() => setCardTrade((current) => ({ ...current, buyerId: player.id }))}
                          >
                            <TokenChip tokenStyle={tokenById.get(player.id)} className="h-11 w-11 text-sm" />
                            <div>
                              <strong>{player.name}</strong>
                              <span><Money amount={player.cash} /> en caja</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="monopoly-trade-step">
                    <p className="monopoly-trade-step-label">{cardIntent === "sell" ? "3" : "2"}. Precio del pase</p>
                    <div className="monopoly-trade-price-presets">
                      {cardPresets.map((amount) => (
                        <button
                          key={`card-price-${amount}`}
                          type="button"
                          className={cardTrade.price === amount ? "active" : ""}
                          onClick={() => setCardTrade((current) => ({ ...current, price: amount }))}
                        >
                          {moneyFormatter.format(amount)}
                        </button>
                      ))}
                    </div>
                    <input
                      className="monopoly-input monopoly-trade-price-input"
                      type="number"
                      min={0}
                      value={cardTrade.price}
                      onChange={(event) => setCardTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                    />
                  </div>
                </div>

                <div className="monopoly-trade-summary">
                  <p className="monopoly-panel-eyebrow">Resumen del trato</p>
                  <h5>{cardDeckLabel(cardTrade.deck)}</h5>
                  <p>
                    {cardSellerName && cardBuyerName
                      ? jailCardTradeBanter({
                          sellerName: cardSellerName,
                          buyerName: cardBuyerName,
                          deckLabel: cardDeckLabel(cardTrade.deck),
                          price: cardTradePrice
                        })
                      : cardIntent === "buy"
                        ? "Elige quien tiene el pase y manda una invitacion de compra sin patear la puerta."
                        : "Primero elige a quien le quieres vender este pase anti-prision."}
                  </p>
                  <div className="monopoly-trade-money-flow">
                    <span>Comprador <strong>{cardBuyer?.name || cardBuyerName || "..."}</strong> pagara <strong>{moneyFormatter.format(cardTradePrice)}</strong></span>
                    <span>Vendedor <strong>{cardSellerName || "..."}</strong> recibira <strong>{moneyFormatter.format(cardTradePrice)}</strong></span>
                  </div>
                  {cardWarning && (
                    <div className="monopoly-trade-warning">
                      <AlertTriangle size={16} />
                      <span>{cardWarning}</span>
                    </div>
                  )}
                  <ActionButton tone="secondary" className="w-full justify-center" onClick={submitCardTrade} disabled={!cardCanSubmit}>
                    <ShieldAlert size={18} />
                    {cardIntent === "buy" ? "Enviar oferta de compra" : "Enviar oferta de venta"}
                  </ActionButton>
                </div>
              </>
            )}
          </section>
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
  onAction,
  customTokens
}) {
  const tradeTargets = useMemo(
    () => players.filter((player) => !sameEntityId(player.id, currentUserId) && !player.bankrupt),
    [players, currentUserId]
  );
  const tradePropertyGroups = useMemo(() => {
    const groups = new Map();
    (myPlayer?.properties || []).forEach((property) => {
      const meta = tradePropertyGroup(property);
      if (!groups.has(meta.key)) {
        groups.set(meta.key, { ...meta, properties: [] });
      }
      groups.get(meta.key).properties.push(property);
    });

    return [...groups.values()].map((group) => ({
      ...group,
      properties: [...group.properties].sort((left, right) => {
        const leftPrice = left.price || left.mortgageValue || 0;
        const rightPrice = right.price || right.mortgageValue || 0;
        return rightPrice - leftPrice;
      })
    }));
  }, [myPlayer?.properties]);
  const selectedProperty = (myPlayer?.properties || []).find((property) => property.id === propertyTrade.propertyId) || null;
  const selectedBuyer = tradeTargets.find((player) => String(player.id) === String(propertyTrade.buyerId)) || null;
  const propertyTradeBlock = propertyTradeBlockReason(selectedProperty, myPlayer?.properties || []);
  const propertyTradePrice = Math.max(0, Number(propertyTrade.price) || 0);
  const transferCost = mortgageTransferCost(selectedProperty, propertyTrade.liftMortgage);
  const selectedBuyerCash = Number(selectedBuyer?.cash || 0);
  const buyerCanPayProperty = Boolean(selectedBuyer) && selectedBuyerCash >= propertyTradePrice;
  const buyerCanAbsorbMortgage = !selectedProperty?.isMortgaged || !propertyTrade.liftMortgage || selectedBuyerCash >= propertyTradePrice + transferCost;
  const canSubmitPropertyTrade = Boolean(selectedProperty && selectedBuyer && !propertyTradeBlock && buyerCanPayProperty && buyerCanAbsorbMortgage);
  const propertyTradeWarning = propertyTradeBlock ||
    (selectedBuyer && !buyerCanPayProperty ? `${selectedBuyer.name} no tiene efectivo suficiente para ese precio.` : "") ||
    (selectedBuyer && !buyerCanAbsorbMortgage ? `${selectedBuyer.name} necesita cubrir precio, interes y levantamiento de hipoteca.` : "");
  const propertyBaseAmount = selectedProperty
    ? Math.max(
        selectedProperty.mortgageValue || 0,
        Math.round(((selectedProperty.price || selectedProperty.mortgageValue || 100) * 0.7) / 50) * 50
      )
    : 100;
  const propertyPresets = amountPresets(propertyBaseAmount, [selectedProperty?.price, selectedProperty?.mortgageValue]);
  const propertyTradeTokenById = useMemo(() => {
    const map = new Map();
    tradeTargets.forEach((player, index) => {
      map.set(player.id, customTokens?.[player.id] || resolveTokenStyle({ ...player, colorIndex: index }, customTokens || {}));
    });
    return map;
  }, [tradeTargets, customTokens]);
  const totalJailCards = Object.values(myPlayer?.getOutOfJailCards || {}).reduce((total, count) => total + Number(count || 0), 0);
  const selectedCardBuyer = tradeTargets.find((player) => String(player.id) === String(cardTrade.buyerId)) || null;
  const selectedDeckCount = Number(myPlayer?.getOutOfJailCards?.[cardTrade.deck] || 0);
  const cardBaseAmount = Math.max(100, selectedDeckCount ? 250 : 100);
  const cardPresets = amountPresets(cardBaseAmount, [250, 400, 600]);

  if (!open) return null;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-info monopoly-trade-modal">
        <div className="monopoly-trade-head">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] opacity-75">Mercado de mesa</p>
            <h3 className="mt-1 text-2xl font-black uppercase">Negocios y tratos raramente honestos</h3>
            <p className="mt-2 text-sm font-semibold opacity-85">
              Aqui cierras ventas, pasas activos y negocias comodines sin que el turno se sienta como hoja de calculo.
            </p>
          </div>
          <button type="button" className="toast-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="monopoly-trade-layout">
          <section className="monopoly-trade-panel">
            <div className="monopoly-trade-panel-head">
              <div>
                <p className="monopoly-panel-eyebrow">Propiedad en vitrina</p>
                <h4>Transferir propiedad</h4>
              </div>
              <span>{myPlayer?.properties?.length || 0} disponibles</span>
            </div>

            <div className="monopoly-trade-pickers">
              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">1. Elige propiedad</p>
                {(myPlayer?.properties || []).length === 0 ? (
                  <div className="monopoly-empty-state">No tienes propiedades para negociar ahora mismo.</div>
                ) : (
                  <div className="monopoly-trade-group-list">
                    {tradePropertyGroups.map((group) => (
                      <section key={group.key} className="monopoly-trade-property-group">
                        <div className="monopoly-trade-property-group-head">
                          <span style={{ backgroundColor: group.accent }} />
                          <div>
                            <strong>{group.label}</strong>
                            <em>{group.copy} · {group.properties.length} activos</em>
                          </div>
                        </div>
                        <div className="monopoly-trade-property-grid">
                          {group.properties.map((property) => {
                            const blockedReason = propertyTradeBlockReason(property, myPlayer?.properties || []);
                            return (
                              <button
                                key={property.id}
                                type="button"
                                className={cx("monopoly-trade-property-card", propertyTrade.propertyId === property.id && "active", blockedReason && "is-locked")}
                                onClick={() => {
                                  const suggestedPrice = Math.max(
                                    property.mortgageValue || 0,
                                    Math.round(((property.price || property.mortgageValue || 100) * 0.7) / 50) * 50
                                  );
                                  setPropertyTrade((current) => ({
                                    ...current,
                                    propertyId: property.id,
                                    price: current.propertyId === property.id && current.price > 0 ? current.price : suggestedPrice
                                  }));
                                }}
                              >
                                <div className="monopoly-trade-property-top">
                                  <div>
                                    <span>{spaceTypeLabel(property)}</span>
                                    <strong>{property.name}</strong>
                                  </div>
                                  <i style={{ backgroundColor: group.accent }} />
                                </div>
                                <div className="monopoly-trade-property-tags">
                                  <em>{property.price ? moneyFormatter.format(property.price) : "--"}</em>
                                  {property.isMortgaged && <em>Hipotecada</em>}
                                  {property.hasHotel && <em>Hotel</em>}
                                  {property.houses > 0 && <em>{property.houses} casas</em>}
                                  {blockedReason && <em className="warn">Bloqueada por edificios</em>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </div>

              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">2. Elige comprador</p>
                <div className="monopoly-trade-target-grid">
                  {tradeTargets.map((player) => (
                    <button
                      key={player.id}
                      type="button"
                      className={cx("monopoly-trade-target-card", String(propertyTrade.buyerId) === String(player.id) && "active")}
                      onClick={() => setPropertyTrade((current) => ({ ...current, buyerId: String(player.id) }))}
                    >
                      <TokenChip tokenStyle={propertyTradeTokenById.get(player.id)} className="h-11 w-11 text-sm" />
                      <div>
                        <strong>{player.name}</strong>
                        <span><Money amount={player.cash} /> en caja</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">3. Ajusta el precio</p>
                <div className="monopoly-trade-price-presets">
                  {propertyPresets.map((amount) => (
                    <button
                      key={`property-price-${amount}`}
                      type="button"
                      className={propertyTrade.price === amount ? "active" : ""}
                      onClick={() => setPropertyTrade((current) => ({ ...current, price: amount }))}
                    >
                      {moneyFormatter.format(amount)}
                    </button>
                  ))}
                </div>
                <input
                  className="monopoly-input monopoly-trade-price-input"
                  type="number"
                  min={0}
                  value={propertyTrade.price}
                  onChange={(event) => setPropertyTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                />
                <label className="monopoly-trade-toggle">
                  <input
                    type="checkbox"
                    checked={propertyTrade.liftMortgage}
                    onChange={(event) => setPropertyTrade((current) => ({ ...current, liftMortgage: event.target.checked }))}
                  />
                  <span>Levantar hipoteca al transferir</span>
                </label>
              </div>
            </div>

            <div className="monopoly-trade-summary">
              <p className="monopoly-panel-eyebrow">Resumen del trato</p>
              <h5>{selectedProperty ? selectedProperty.name : "Elige una propiedad para empezar"}</h5>
              <p>
                {selectedProperty && selectedBuyer
                  ? propertyTradeBanter({
                      sellerName: myPlayer?.name || "Tu",
                      buyerName: selectedBuyer.name,
                      propertyName: selectedProperty.name,
                      price: propertyTrade.price
                    })
                  : "Selecciona propiedad y comprador para que el trato deje de flotar en el limbo."}
              </p>
              <div className="monopoly-trade-money-flow">
                <span>Se pagará <strong>{moneyFormatter.format(propertyTrade.price || 0)}</strong> por parte de {selectedBuyer?.name || "..."}</span>
                <span>Se recibirá <strong>{moneyFormatter.format(propertyTrade.price || 0)}</strong> en caja de {myPlayer?.name || "tu jugador"}</span>
                {selectedProperty?.isMortgaged && (
                  <span>Coste extra para comprador <strong>{moneyFormatter.format(transferCost)}</strong> {propertyTrade.liftMortgage ? "incluyendo levantar hipoteca" : "por interes de transferencia"}</span>
                )}
              </div>
              {propertyTradeWarning && (
                <div className="monopoly-trade-warning">
                  <AlertTriangle size={16} />
                  <span>{propertyTradeWarning}</span>
                </div>
              )}
              <ActionButton
                tone="secondary"
                className="w-full justify-center"
                onClick={() => {
                  onAction("crearOfertaPropiedad", {
                    compradorId: Number(propertyTrade.buyerId),
                    propiedadId: propertyTrade.propertyId,
                    precio: Number(propertyTrade.price),
                    levantarHipotecaAhora: propertyTrade.liftMortgage
                  });
                  onClose();
                }}
                disabled={!canSubmitPropertyTrade}
              >
                <Scale size={18} />
                Enviar oferta de propiedad
              </ActionButton>
            </div>
          </section>

          <section className="monopoly-trade-panel">
            <div className="monopoly-trade-panel-head">
              <div>
                <p className="monopoly-panel-eyebrow">Pases especiales</p>
                <h4>Vender salida de carcel</h4>
              </div>
              <span>{totalJailCards} pases</span>
            </div>

            <div className="monopoly-trade-pickers">
              <div className="monopoly-trade-help-card">
                <ShieldAlert size={18} />
                <p>
                  Aqui solo vendes cartas de <strong>Salir libre de la carcel</strong>. Las cartas normales de Casualidad y Arca comunal se resuelven al instante y no se pueden comerciar.
                </p>
              </div>
              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">1. Elige de que mazo viene tu pase</p>
                <div className="monopoly-trade-deck-grid">
                  {["CASUALIDAD", "ARCA_COMUNAL"].map((deck) => (
                    <button
                      key={deck}
                      type="button"
                      className={cx("monopoly-trade-deck-card", cardTrade.deck === deck && "active")}
                      onClick={() => setCardTrade((current) => ({ ...current, deck }))}
                    >
                      <strong>{cardDeckLabel(deck)}</strong>
                      <span>{Number(myPlayer?.getOutOfJailCards?.[deck] || 0)} pases disponibles</span>
                      <em>{deck === "CASUALIDAD" ? "Caos amarillo, fuga con suerte." : "Vecinos organizados, escape comunitario."}</em>
                    </button>
                  ))}
                </div>
              </div>

              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">2. Elige comprador</p>
                <div className="monopoly-trade-target-grid">
                  {tradeTargets.map((player) => (
                    <button
                      key={`card-${player.id}`}
                      type="button"
                      className={cx("monopoly-trade-target-card", String(cardTrade.buyerId) === String(player.id) && "active")}
                      onClick={() => setCardTrade((current) => ({ ...current, buyerId: String(player.id) }))}
                    >
                      <TokenChip tokenStyle={propertyTradeTokenById.get(player.id)} className="h-11 w-11 text-sm" />
                      <div>
                        <strong>{player.name}</strong>
                        <span><Money amount={player.cash} /> en caja</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="monopoly-trade-step">
                <p className="monopoly-trade-step-label">3. Precio del pase</p>
                <div className="monopoly-trade-price-presets">
                  {cardPresets.map((amount) => (
                    <button
                      key={`card-price-${amount}`}
                      type="button"
                      className={cardTrade.price === amount ? "active" : ""}
                      onClick={() => setCardTrade((current) => ({ ...current, price: amount }))}
                    >
                      {moneyFormatter.format(amount)}
                    </button>
                  ))}
                </div>
                <input
                  className="monopoly-input monopoly-trade-price-input"
                  type="number"
                  min={0}
                  value={cardTrade.price}
                  onChange={(event) => setCardTrade((current) => ({ ...current, price: Number(event.target.value) }))}
                />
              </div>
            </div>

            <div className="monopoly-trade-summary">
              <p className="monopoly-panel-eyebrow">Resumen del trato</p>
              <h5>{cardDeckLabel(cardTrade.deck)}</h5>
              <p>
                {selectedCardBuyer
                  ? jailCardTradeBanter({
                      sellerName: myPlayer?.name || "Tu",
                      buyerName: selectedCardBuyer.name,
                      deckLabel: cardDeckLabel(cardTrade.deck),
                      price: cardTrade.price
                    })
                  : "Primero elige a quien le quieres vender este pase anti-prision."}
              </p>
              <div className="monopoly-trade-money-flow">
                <span>Se pagará <strong>{moneyFormatter.format(cardTrade.price || 0)}</strong> por parte de {selectedCardBuyer?.name || "..."}</span>
                <span>Se recibirá <strong>{moneyFormatter.format(cardTrade.price || 0)}</strong> en caja de {myPlayer?.name || "tu jugador"}</span>
              </div>
              <ActionButton
                tone="secondary"
                className="w-full justify-center"
                onClick={() => {
                  onAction("crearOfertaCartaCarcel", {
                    compradorId: Number(cardTrade.buyerId),
                    deck: cardTrade.deck,
                    precio: Number(cardTrade.price)
                  });
                  onClose();
                }}
                disabled={!cardTrade.buyerId || selectedDeckCount <= 0}
              >
                <ShieldAlert size={18} />
                Enviar oferta de pase
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

function TurnStartBanner({ banner }) {
  if (!banner) return null;

  return (
    <div className="monopoly-turn-start-banner" aria-live="assertive">
      <div>
        <span>{banner.playerName || "Jugador"}</span>
        <strong>ES TU TURNO</strong>
      </div>
    </div>
  );
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

function DebtManagementModal({
  open,
  onClose,
  debt,
  player,
  onAction,
  onResolveDebt,
  onOpenTrade,
  onFocusProperty
}) {
  const groupedProperties = useMemo(() => {
    const next = new Map();
    (player?.properties || []).forEach((property) => {
      const key = property.colorGroup || property.type || "otros";
      if (!next.has(key)) next.set(key, []);
      next.get(key).push(property);
    });

    return [...next.entries()].map(([groupKey, properties]) => ({
      key: groupKey,
      meta: colorGroupMeta[groupKey] || null,
      properties: [...properties].sort((left, right) => {
        const rightActions = propertyActionOrder.filter(([actionName]) => right.management?.[actionName]?.allowed).length;
        const leftActions = propertyActionOrder.filter(([actionName]) => left.management?.[actionName]?.allowed).length;
        if (rightActions !== leftActions) return rightActions - leftActions;
        return estimatePropertyLiquidity(right) - estimatePropertyLiquidity(left);
      })
    }));
  }, [player?.properties]);

  if (!open || !debt || !player) return null;

  const cash = player.cash || 0;
  const shortfall = Math.max(0, (debt.amount || 0) - cash);
  const canResolveDebt = shortfall === 0;
  const totalLiquidity = (player.properties || []).reduce((sum, property) => sum + estimatePropertyLiquidity(property), 0);
  const canStillRescue = shortfall > 0 && totalLiquidity >= shortfall;

  return (
    <div className="monopoly-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="monopoly-modal tone-warn monopoly-debt-manager-modal">
        <div className="monopoly-debt-manager-head">
          <div>
            <p className="monopoly-panel-eyebrow">Rescate financiero</p>
            <h3>Salva tu partida</h3>
            <p className="monopoly-debt-manager-copy">
              Liquida edificios, hipoteca activos y cuando tu efectivo alcance la deuda, remata con un solo toque.
            </p>
          </div>
          <button type="button" className="toast-close" onClick={onClose} aria-label="Cerrar rescate financiero">
            <X size={16} />
          </button>
        </div>

        <div className="monopoly-debt-manager-layout">
          <aside className="monopoly-debt-hero">
            <div className="monopoly-debt-hero-card">
              <span className="monopoly-debt-hero-kicker">Objetivo</span>
              <strong>{canResolveDebt ? "Ya puedes pagar" : "Necesitas reunir efectivo"}</strong>
              <p>
                {canResolveDebt
                  ? "Tu caja ya aguanta el golpe. Cobra aire y paga la deuda."
                  : "Todavia no cubres la deuda. Usa las maniobras disponibles debajo."}
              </p>
            </div>

            <div className="monopoly-debt-hero-stats">
              <article className="modal-stat-card">
                <span>Deuda actual</span>
                <Money amount={debt.amount || 0} className="modal-stat-value" />
              </article>
              <article className="modal-stat-card">
                <span>Efectivo</span>
                <Money amount={cash} className="modal-stat-value" />
              </article>
              <article className="modal-stat-card">
                <span>Falta reunir</span>
                <Money amount={shortfall} className="modal-stat-value" />
              </article>
              <article className="modal-stat-card">
                <span>Liquidez posible</span>
                <Money amount={totalLiquidity} className="modal-stat-value" />
              </article>
            </div>

            <div className="monopoly-debt-hero-footer">
              <ActionButton className="w-full justify-center" onClick={onResolveDebt} disabled={!canResolveDebt}>
                <Wallet size={18} />
                {canResolveDebt ? `Pagar deuda - ${moneyFormatter.format(debt.amount || 0)}` : "Aun no alcanzas a pagar"}
              </ActionButton>
              <ActionButton tone="secondary" className="w-full justify-center" onClick={onOpenTrade}>
                <Scale size={18} />
                Negociar propiedad
              </ActionButton>
              <ActionButton tone="danger" className="w-full justify-center" onClick={() => onAction("resolverQuiebra")} disabled={canStillRescue}>
                <AlertTriangle size={18} />
                {canStillRescue ? "Aun puedes rescatarte" : "Declarar quiebra"}
              </ActionButton>
              {canStillRescue && (
                <p className="monopoly-debt-rescue-note">Todavia hay liquidez suficiente en tus activos. Vende o hipoteca antes del game over.</p>
              )}
            </div>
          </aside>

          <section className="monopoly-debt-arsenal">
            <div className="monopoly-debt-arsenal-head">
              <div>
                <p className="monopoly-panel-eyebrow">Tus propiedades</p>
                <h4>Elige un activo para mover</h4>
              </div>
              <span>{player.properties?.length || 0} activos</span>
            </div>

            {!player.properties?.length ? (
              <div className="monopoly-empty-state">No tienes propiedades que liquidar. Si no puedes pagar, la partida termina en quiebra.</div>
            ) : (
              <div className="monopoly-debt-group-list">
                {groupedProperties.map((group) => (
                  <section key={group.key} className="monopoly-debt-group">
                    <div className="monopoly-debt-group-title">
                      <div className="monopoly-debt-group-label">
                        <span style={{ backgroundColor: group.meta?.color || "#d8c8ae" }} />
                        <strong>{group.meta?.label || group.key}</strong>
                      </div>
                      <em>{group.properties.length}</em>
                    </div>

                    <div className="monopoly-debt-property-grid">
                      {group.properties.map((property) => {
                        const availableActions = propertyActionOrder.filter(([actionName]) => property.management?.[actionName]?.allowed);
                        const liquidity = estimatePropertyLiquidity(property);
                        return (
                          <article key={property.id} className="monopoly-debt-property-card">
                            <div className="monopoly-debt-property-head">
                              <div>
                                <p>{spaceTypeLabel(property)}</p>
                                <h5>{property.name}</h5>
                              </div>
                              <button type="button" className="monopoly-debt-focus-button" onClick={() => onFocusProperty(property.id)}>
                                Ver casilla
                              </button>
                            </div>

                            <div className="monopoly-debt-property-badges">
                              {property.isMortgaged && <span className="monopoly-chip bg-[#4b5563] text-white">Hipotecada</span>}
                              {property.hasHotel && <span className="monopoly-chip bg-[#b02016] text-white">Hotel</span>}
                              {property.houses > 0 && <span className="monopoly-chip bg-[#14532d] text-white">{property.houses} casas</span>}
                              {liquidity > 0 && <span className="monopoly-chip bg-[#fff4dc] text-[#8a5a00]">Caja {moneyFormatter.format(liquidity)}</span>}
                            </div>

                            <div className="monopoly-debt-property-stats">
                              <div>
                                <span>Precio</span>
                                <strong>{property.price ? moneyFormatter.format(property.price) : "--"}</strong>
                              </div>
                              <div>
                                <span>Hipoteca</span>
                                <strong>{property.mortgageValue ? moneyFormatter.format(property.mortgageValue) : "--"}</strong>
                              </div>
                              <div>
                                <span>Construccion</span>
                                <strong>{property.hasHotel ? "Hotel" : property.houses > 0 ? `${property.houses} casas` : "Base"}</strong>
                              </div>
                            </div>

                            {availableActions.length > 0 ? (
                              <div className="monopoly-debt-action-grid">
                                {availableActions.map(([actionName]) => {
                                  const meta = debtActionMeta[actionName];
                                  const Icon = meta?.icon || Hammer;
                                  return (
                                    <button
                                      key={actionName}
                                      type="button"
                                      className="monopoly-debt-action-button"
                                      onClick={() => onAction(actionName, { propertyId: property.id })}
                                    >
                                      <span className="monopoly-debt-action-icon"><Icon size={16} /></span>
                                      <span>
                                        <strong>{meta?.label || actionLabel[actionName]}</strong>
                                        <em>{debtActionCopy(actionName, property)}</em>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="monopoly-debt-action-locked">
                                <Info size={16} />
                                <span>Esta propiedad no tiene maniobras legales disponibles ahora mismo.</span>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
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
        <button type="button" className="monopoly-lobby-token" onClick={onToken} title="Elegir figura y color">
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
  const seatedPlayers = table.players || [];
  const tokenStylesById = buildUniqueTokenStyleMap(
    seatedPlayers.map((player, index) => ({ ...player, colorIndex: index })),
    customTokens
  );

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
            const player = seatedPlayers[index];
            const tokenStyle = player ? tokenStylesById[player.id] : null;
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
  onBoardTheme,
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
  const tokenStylesById = useMemo(
    () => buildUniqueTokenStyleMap(
      (table.players || []).map((player, index) => ({ ...player, colorIndex: index })),
      customTokens
    ),
    [customTokens, table.players]
  );

  return (
    <section className="monopoly-lobby">
      <div className="monopoly-lobby-topbar">
        <div className="monopoly-lobby-world">
          <span className="monopoly-lobby-world-dot waiting" />
          Sala de espera
        </div>
        <button type="button" className="monopoly-lobby-token" onClick={onToken} title="Elegir figura y color">
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

            <button type="button" className="monopoly-waitroom-color" onClick={onToken}>
              <TokenChip tokenStyle={myTokenStyle} className="h-10 w-10 text-sm" />
              <span>
                <strong>Figura y color</strong>
                <em>Personalizar ficha</em>
              </span>
            </button>
            {isHost && (
              <button type="button" className="monopoly-waitroom-color monopoly-waitroom-board-theme" onClick={onBoardTheme}>
                <MapIcon size={24} />
                <span>
                  <strong>Diseño del tablero</strong>
                  <em>Visible para todos</em>
                </span>
              </button>
            )}

            <div className="monopoly-waitroom-seats">
              {seats.map((player, index) => {
                const tokenStyle = player ? tokenStylesById[player.id] : null;
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

export default function MonopolyGame({
  token,
  socket,
  currentUser,
  world,
  presence,
  messages,
  connectionStatus,
  onSendMessage,
  preferredBoardViewMode = "3d",
  onBoardViewModeChange,
  equippedCosmetics = {},
  eyconInventory = [],
  onEyconProfileChange
}) {
  const { loadDefaultStation, setActiveGameKey } = useRadio();
  const [state, setState] = useState(null);
  const [tableMeta, setTableMeta] = useState(null);
  const [tables, setTables] = useState([]);
  const [activeTableId, setActiveTableId] = useState("");
  const [error, setError] = useState("");
  const [localEyconProfile, setLocalEyconProfile] = useState(() => ({
    inventory: eyconInventory || [],
    equipment: { MONOPOLY: equippedCosmetics || {} }
  }));
  const ownedTokenFigures = useMemo(
    () => (localEyconProfile.inventory || []).filter((product) => (
      product.gameKey === MONOPOLY_GAME_KEY &&
      product.category === "TOKEN"
    )),
    [localEyconProfile.inventory]
  );
  const ownedBoardThemes = useMemo(
    () => (localEyconProfile.inventory || []).filter((product) => (
      product.gameKey === MONOPOLY_GAME_KEY &&
      product.category === "BOARD_THEME"
    )),
    [localEyconProfile.inventory]
  );
  const [tableName, setTableName] = useState("Mesa Monopoly");
  const [mode, setMode] = useState("NORMAL");
  const [timedMinutes, setTimedMinutes] = useState(60);
  const [turnTimeSeconds, setTurnTimeSeconds] = useState(60);
  const [bidAmount, setBidAmount] = useState(100);
  const [selectedSpaceId, setSelectedSpaceId] = useState("go");
  const [threeDInfoSpaceId, setThreeDInfoSpaceId] = useState("");
  const [propertyTrade, setPropertyTrade] = useState(() => ({ ...defaultPropertyTrade }));
  const [cardTrade, setCardTrade] = useState(() => ({ ...defaultCardTrade }));
  const [toasts, setToasts] = useState([]);
  const [visibleRecentEvents, setVisibleRecentEvents] = useState([]);
  const [moneyBursts, setMoneyBursts] = useState([]);
  const [diceFaces, setDiceFaces] = useState([1, 6]);
  const [rollingDice, setRollingDice] = useState(false);
  const [modalDismissKey, setModalDismissKey] = useState("");
  const [cardModalRevealKey, setCardModalRevealKey] = useState("");
  const [displayPositions, setDisplayPositions] = useState(new Map());
  const [cinematic, setCinematic] = useState(null);
  const [customTokens, setCustomTokens] = useState(() => loadCustomTokens());
  const [tokenEditorOpen, setTokenEditorOpen] = useState(false);
  const [boardThemeEditorOpen, setBoardThemeEditorOpen] = useState(false);
  const [bottomTab, setBottomTab] = useState("players");
  const [threeDSelectionVersion, setThreeDSelectionVersion] = useState(0);
  const [boardViewMode, setBoardViewMode] = useState(preferredBoardViewMode === "2d" ? "2d" : "3d");
  const [cameraAutoFollow, setCameraAutoFollow] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [rankingOpen, setRankingOpen] = useState(false);
  const [tradeOpen, setTradeOpen] = useState(false);
  const [debtManagerOpen, setDebtManagerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [turnBanner, setTurnBanner] = useState(null);
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
  const autoEndTurnSignatureRef = useRef("");
  const diceIntervalRef = useRef(null);
  const diceFocusTimeoutRef = useRef(null);
  const diceTimeoutRef = useRef(null);
  const diceSequenceStartedAtRef = useRef(0);
  const diceRollStartedAtRef = useRef(0);
  const dicePhysicsActiveRef = useRef(false);
  const rollingDiceRef = useRef(false);
  const cinematicRef = useRef(null);
  const cinematicTimeoutsRef = useRef([]);
  const cardModalRevealTimeoutRef = useRef(null);
  const moneyBurstTimeoutsRef = useRef([]);
  const turnBannerTimeoutRef = useRef(null);
  // Bloqueo anti doble-clic / reentrada de acciones (robustez de interaccion).
  const actionLockRef = useRef(false);
  const diceMotionSequenceRef = useRef("");
  const diceMotionAuthorizedRef = useRef(false);
  const diceMotionFrameRef = useRef(0);
  const pendingDiceMotionsRef = useRef([]);
  const lastDiceMotionSentAtRef = useRef({ move: 0, state: 0 });
  const diceMotionAuthorizationRef = useRef({ sequenceId: "", promise: null, resolve: null });
  const remoteDiceMotionSinkRef = useRef(null);
  const bufferedRemoteDiceMotionsRef = useRef([]);
  const actionLockTimeoutRef = useRef(null);
  const diceStateHoldUntilRef = useRef(0);
  const heldMonopolyStateTimeoutRef = useRef(null);
  const [tick, setTick] = useState(Date.now());
  const currentUserId = Number.isFinite(Number(currentUser.id)) ? Number(currentUser.id) : currentUser.id;
  const currentEquippedCosmetics = localEyconProfile.equipment?.MONOPOLY || equippedCosmetics || {};
  const boardViewModeRef = useRef(boardViewMode);
  const bindRemoteDiceMotionSink = useMemo(() => (sink) => {
    remoteDiceMotionSinkRef.current = typeof sink === "function" ? sink : null;
    if (!remoteDiceMotionSinkRef.current || bufferedRemoteDiceMotionsRef.current.length === 0) {
      return;
    }

    const bufferedMotions = bufferedRemoteDiceMotionsRef.current.splice(0);
    bufferedMotions.forEach((motion) => remoteDiceMotionSinkRef.current?.(motion));
  }, []);
  const handleDicePhysicsChange = useMemo(() => (active) => {
    dicePhysicsActiveRef.current = Boolean(active);
  }, []);

  useEffect(() => {
    rollingDiceRef.current = rollingDice;
  }, [rollingDice]);

  useEffect(() => {
    setLocalEyconProfile((current) => ({
      ...current,
      inventory: eyconInventory || current.inventory || [],
      equipment: {
        ...(current.equipment || {}),
        MONOPOLY: equippedCosmetics || {}
      }
    }));
  }, [equippedCosmetics, eyconInventory]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api("/api/eycon/profile", { token })
      .then((profile) => {
        if (!active) return;
        setLocalEyconProfile(profile);
        onEyconProfileChange?.(profile);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    cinematicRef.current = cinematic;
  }, [cinematic]);

  useEffect(() => {
    setBoardViewMode(preferredBoardViewMode === "2d" ? "2d" : "3d");
  }, [preferredBoardViewMode]);

  useEffect(() => {
    boardViewModeRef.current = boardViewMode;
  }, [boardViewMode]);

  useEffect(() => {
    if (boardViewMode === "3d") {
      void loadMonopoly3DView();
    }
  }, [boardViewMode]);

  useEffect(() => {
    loadDefaultStation(MONOPOLY_GAME_KEY);
  }, [loadDefaultStation]);

  useEffect(() => {
    setActiveGameKey(MONOPOLY_GAME_KEY);
    return () => {
      setActiveGameKey("");
    };
  }, [setActiveGameKey]);

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

      if (payload.visualOnly && payload.diceMotion) {
        const diceMotion = payload.diceMotion;
        if (!sameEntityId(diceMotion.actorId, currentUserId)) {
          if (remoteDiceMotionSinkRef.current) {
            remoteDiceMotionSinkRef.current(diceMotion);
          } else {
            bufferedRemoteDiceMotionsRef.current.push(diceMotion);
            if (bufferedRemoteDiceMotionsRef.current.length > 120) {
              bufferedRemoteDiceMotionsRef.current.splice(0, bufferedRemoteDiceMotionsRef.current.length - 120);
            }
          }
        }
        return;
      }

      const applyPayload = () => {
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
      };

      const holdUntil = diceStateHoldUntilRef.current;
      if (holdUntil && performance.now() < holdUntil && payload.table?.game?.turn?.lastRoll) {
        if (heldMonopolyStateTimeoutRef.current) {
          window.clearTimeout(heldMonopolyStateTimeoutRef.current);
        }
        heldMonopolyStateTimeoutRef.current = window.setTimeout(() => {
          heldMonopolyStateTimeoutRef.current = null;
          diceStateHoldUntilRef.current = 0;
          applyPayload();
        }, Math.max(0, holdUntil - performance.now()));
        return;
      }

      applyPayload();
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
    diceMotionSequenceRef.current = "";
    diceMotionAuthorizedRef.current = false;
    diceMotionFrameRef.current = 0;
    pendingDiceMotionsRef.current = [];
    lastDiceMotionSentAtRef.current = { move: 0, state: 0 };
    diceMotionAuthorizationRef.current.resolve?.(false);
    diceMotionAuthorizationRef.current = { sequenceId: "", promise: null, resolve: null };
    dicePhysicsActiveRef.current = false;
    bufferedRemoteDiceMotionsRef.current = [];
  }, [activeTableId]);

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
  const pendingPurchase = state?.turn?.pendingPurchase || null;
  const pendingPurchaseSpace = pendingPurchase ? board.find((space) => space.id === pendingPurchase.propertyId) : null;
  const pendingTax = state?.turn?.pendingTax || null;
  const pendingDebt = state?.turn?.pendingDebt || null;
  const pendingCard = state?.turn?.pendingCard || null;
  const pendingRentClaim = state?.turn?.pendingRentClaim || null;
  const auction = state?.turn?.auction || null;
  const isMyAuctionTurn = sameEntityId(auction?.activeBidderId, currentUserId);
  const canBidAuction = isMyAuctionTurn || myActions.includes("hacerOferta");
  const canPassAuction = isMyAuctionTurn || myActions.includes("retirarseDeSubasta");
  const canChangeMyColor = !state || Number(state?.turn?.turnNumber || 0) <= 10;
  const activeTable = useMemo(
    () => tables.find((table) => table.id === activeTableId) || null,
    [tables, activeTableId]
  );
  const isSeatedAtActiveTable = Boolean(activeTable?.players.some((player) => sameEntityId(player.id, currentUserId)));
  const isHostAtActiveTable = sameEntityId(activeTable?.hostId, currentUserId);
  const turnCountdown = formatCountdown(tableMeta?.turnDeadlineAt || activeTable?.turnDeadlineAt || null);

  useEffect(() => {
    if (auction) {
      setBidAmount(auctionMinimumBid(auction));
    }
  }, [auction?.id, auction?.currentBid]);

  useEffect(() => {
    if (!canChangeMyColor) {
      setTokenEditorOpen(false);
    }
  }, [canChangeMyColor]);

  const boardPlayers = useMemo(
    () =>
      (state?.players || []).map((player, index) => ({
        ...player,
        colorIndex: index
      })),
    [state?.players]
  );
  const seatedPlayers = useMemo(
    () =>
      (activeTable?.players?.length
        ? activeTable.players
        : tableMeta?.seatedPlayers || []
      ).map((player, index) => ({
        ...player,
        colorIndex: index
      })),
    [activeTable?.players, tableMeta?.seatedPlayers]
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
    return buildUniqueTokenStyleMap(
      boardPlayers.map((player) => sameEntityId(player.id, currentUserId)
        ? { ...player, cosmetics: { ...(player.cosmetics || {}), ...currentEquippedCosmetics } }
        : player),
      customTokens
    );
  }, [boardPlayers, currentEquippedCosmetics, currentUserId, customTokens]);
  const seatedTokenStylesById = useMemo(
    () => buildUniqueTokenStyleMap(
      seatedPlayers.map((player) => sameEntityId(player.id, currentUserId)
        ? { ...player, cosmetics: { ...(player.cosmetics || {}), ...currentEquippedCosmetics } }
        : player),
      customTokens
    ),
    [currentEquippedCosmetics, currentUserId, customTokens, seatedPlayers]
  );

  const threeDPlayers = useMemo(
    () => displayBoardPlayers.map((player) => {
      const resolvedPlayer = sameEntityId(player.id, currentUserId)
        ? { ...player, cosmetics: { ...(player.cosmetics || {}), ...currentEquippedCosmetics } }
        : player;
      const tokenStyle = tokenStylesById[player.id] || resolveTokenStyle(resolvedPlayer, customTokens);
      return {
        ...resolvedPlayer,
        color: tokenStyle.bg,
        tokenRing: tokenStyle.ring
      };
    }),
    [currentEquippedCosmetics, currentUserId, customTokens, displayBoardPlayers, tokenStylesById]
  );
  const activeDiceCosmetics = useMemo(() => {
    const actorId = state?.currentPlayerId || cinematic?.playerId;
    const actor = boardPlayers.find((player) => sameEntityId(player.id, actorId));
    if (actor && sameEntityId(actor.id, currentUserId)) {
      return { ...(actor.cosmetics || {}), ...currentEquippedCosmetics };
    }
    return actor?.cosmetics || {};
  }, [boardPlayers, cinematic?.playerId, currentEquippedCosmetics, currentUserId, state?.currentPlayerId]);
  const hostBoardTheme = useMemo(() => {
    const hostId = activeTable?.hostId || tableMeta?.hostId;
    if (!hostId) return null;
    const host = boardPlayers.find((player) => sameEntityId(player.id, hostId))
      || seatedPlayers.find((player) => sameEntityId(player.id, hostId));
    const hostCosmetics = sameEntityId(hostId, currentUserId)
      ? { ...(host?.cosmetics || {}), ...currentEquippedCosmetics }
      : host?.cosmetics || {};
    return hostCosmetics.BOARD_THEME || null;
  }, [activeTable?.hostId, boardPlayers, currentEquippedCosmetics, currentUserId, seatedPlayers, tableMeta?.hostId]);

  const myTokenStyle = useMemo(() => {
    const me = boardPlayers.find((player) => sameEntityId(player.id, currentUserId));
    if (me) return tokenStylesById[me.id] || resolveTokenStyle(me, customTokens);
    const seatedMe = seatedPlayers.find((player) => sameEntityId(player.id, currentUserId));
    if (seatedMe) return seatedTokenStylesById[seatedMe.id] || resolveTokenStyle(seatedMe, customTokens);
    // Fallback for the pre-game lobby (no in-game player yet)
    const fallbackIndex = seatedPlayers.length || boardPlayers.length;
    return resolveTokenStyle({ id: currentUserId, name: currentUser.username || "Tú", colorIndex: fallbackIndex }, customTokens);
  }, [boardPlayers, currentUserId, currentUser.username, customTokens, seatedPlayers, seatedTokenStylesById, tokenStylesById]);

  const reservedTokenColorsForMe = useMemo(() => {
    const activeStyles = boardPlayers.length ? tokenStylesById : seatedTokenStylesById;

    return Object.entries(activeStyles)
      .filter(([playerId]) => !sameEntityId(playerId, currentUserId))
      .map(([, tokenStyle]) => tokenStyle?.bg)
      .map(normalizeTokenColor)
      .filter(Boolean);
  }, [boardPlayers.length, currentUserId, seatedTokenStylesById, tokenStylesById]);

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

  async function persistMyToken(next) {
    if (!canChangeMyColor) {
      setError("Solo puedes cambiar tu color durante los primeros 10 turnos.");
      throw new Error("Color bloqueado");
    }

    const preset = tokenColorPresets.find((option) => normalizeTokenColor(option.bg) === normalizeTokenColor(next.bg));
    const normalized = {
      label: initialLetters(myPlayer?.name || currentUser.username || "") || String(next.label || "").trim().slice(0, 4).toUpperCase(),
      icon: "",
      bg: next.bg,
      ring: preset?.ring || next.ring,
      fg: "#ffffff",
      shape: "circle"
    };

    if (reservedTokenColorsForMe.includes(normalizeTokenColor(normalized.bg))) {
      setError("Ese color ya esta ocupado en esta mesa. Elige otro color.");
      throw new Error("Color ocupado");
    }

    try {
      const payload = await api("/api/monopoly/token", {
        method: "PUT",
        token,
        body: { token: normalized }
      });
      setCustomTokens((prev) => {
        const updated = { ...prev, [currentUserId]: payload.token || normalized };
        saveCustomTokens(updated);
        return updated;
      });
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar tu ficha");
      throw nextError;
    }
  }

  async function resetMyToken() {
    if (!canChangeMyColor) {
      setError("Solo puedes cambiar tu color durante los primeros 10 turnos.");
      throw new Error("Color bloqueado");
    }

    try {
      await api("/api/monopoly/token", {
        method: "DELETE",
        token
      });
      setCustomTokens((prev) => {
        const updated = { ...prev };
        delete updated[currentUserId];
        saveCustomTokens(updated);
        return updated;
      });
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo restablecer tu ficha");
      throw nextError;
    }
  }

  async function equipMyTokenFigure(productId) {
    const currentId = currentEquippedCosmetics?.TOKEN?.id || "";
    if (String(productId || "") === String(currentId || "")) return;
    try {
      const profile = productId
        ? await api("/api/eycon/equip", {
            method: "POST",
            token,
            body: { productId }
          })
        : await api("/api/eycon/unequip", {
            method: "POST",
            token,
            body: { gameKey: MONOPOLY_GAME_KEY, slotKey: "TOKEN" }
          });
      setLocalEyconProfile(profile);
      onEyconProfileChange?.(profile);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cambiar tu figura");
      throw nextError;
    }
  }

  async function equipHostBoardTheme(productId) {
    if (!isHostAtActiveTable) {
      const nextError = new Error("Sólo el anfitrión puede cambiar el tablero de esta mesa");
      setError(nextError.message);
      throw nextError;
    }
    const currentId = currentEquippedCosmetics?.BOARD_THEME?.id || "";
    if (String(productId || "") === String(currentId || "")) return;
    try {
      const profile = productId
        ? await api("/api/eycon/equip", {
            method: "POST",
            token,
            body: { productId }
          })
        : await api("/api/eycon/unequip", {
            method: "POST",
            token,
            body: { gameKey: MONOPOLY_GAME_KEY, slotKey: "BOARD_THEME" }
          });
      setLocalEyconProfile(profile);
      onEyconProfileChange?.(profile);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cambiar el diseño del tablero");
      throw nextError;
    }
  }

  function clearDiceVisualTimers({ clearFocus = true, clearResult = true } = {}) {
    if (diceIntervalRef.current) {
      window.clearInterval(diceIntervalRef.current);
      diceIntervalRef.current = null;
    }
    if (clearFocus && diceFocusTimeoutRef.current) {
      window.clearTimeout(diceFocusTimeoutRef.current);
      diceFocusTimeoutRef.current = null;
    }
    if (clearResult && diceTimeoutRef.current) {
      window.clearTimeout(diceTimeoutRef.current);
      diceTimeoutRef.current = null;
    }
  }

  function clearMovementTimers() {
    cinematicTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    cinematicTimeoutsRef.current = [];
  }

  function setCinematicPhase(nextCinematic) {
    cinematicRef.current = nextCinematic;
    setCinematic(nextCinematic);
  }

  function setRollingDiceVisual(nextRolling) {
    rollingDiceRef.current = nextRolling;
    setRollingDice(nextRolling);
  }

  function startDiceRollVisual() {
    if (diceRollStartedAtRef.current) return;
    if (diceFocusTimeoutRef.current) {
      window.clearTimeout(diceFocusTimeoutRef.current);
      diceFocusTimeoutRef.current = null;
    }

    diceRollStartedAtRef.current = performance.now();
    if (boardViewModeRef.current !== "3d") {
      setRollingDiceVisual(true);
    }
    window.setTimeout(() => audio.playRandomDice(), 90);
  }

  function startDiceCameraFocus(playerId, { restart = false, optimistic = false } = {}) {
    const phase = cinematicRef.current?.phase;
    const preserveStartedRoll = !restart && Boolean(diceRollStartedAtRef.current);
    const alreadyInDiceFlow =
      phase === "cameraFocusDice" ||
      phase === "diceRolling" ||
      phase === "dice" ||
      rollingDiceRef.current;

    if (!restart && alreadyInDiceFlow) {
      if (!diceRollStartedAtRef.current && !diceFocusTimeoutRef.current) {
        startDiceRollVisual();
      }
      return;
    }

    clearDiceVisualTimers();
    clearMovementTimers();
    if (!preserveStartedRoll || !diceSequenceStartedAtRef.current) {
      diceSequenceStartedAtRef.current = performance.now();
    }
    if (!preserveStartedRoll) {
      diceRollStartedAtRef.current = 0;
    }
    if (!(optimistic && boardViewModeRef.current === "3d")) {
      setCinematicPhase({ phase: "cameraFocusDice", playerId });
    }
    if (!preserveStartedRoll) {
      startDiceRollVisual();
    }
  }

  function stopDiceCinematic() {
    clearDiceVisualTimers();
    clearMovementTimers();
    diceSequenceStartedAtRef.current = 0;
    diceRollStartedAtRef.current = 0;
    setRollingDiceVisual(false);
    setCinematicPhase(null);
  }

  useEffect(() => {
    const dicePhase = ["cameraFocusDice", "diceRolling", "dice"].includes(cinematic?.phase);
    if (!rollingDice && !dicePhase) return undefined;

    const timeoutId = window.setTimeout(() => {
      stopDiceCinematic();
    }, 12000);

    return () => window.clearTimeout(timeoutId);
  }, [cinematic?.phase, rollingDice]);

  const cameraFocus = useMemo(() => {
    if (!cinematic) return null;
    if (cinematic.phase === "cameraFocusDice" || cinematic.phase === "diceRolling" || cinematic.phase === "dice" || cinematic.phase === "highlightTarget") return null;
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
  const selectedVisitors = useMemo(
    () => displayBoardPlayers.filter((player) => player.position === selectedSpace?.index && !player.bankrupt),
    [displayBoardPlayers, selectedSpace?.index]
  );
  const lastRollSignatureForUi = state?.turn?.lastRoll
    ? `${state.turn.turnNumber}:${state.turn.lastRoll.dice.join("-")}:${state.currentPlayerId}`
    : "";
  const rollSequencePending = Boolean(lastRollSignatureForUi && lastRollSignatureRef.current !== lastRollSignatureForUi);
  const outcomeUiLocked = Boolean(cinematic || rollingDice || rollSequencePending);
  const visiblePendingPurchaseSpace = outcomeUiLocked ? null : pendingPurchaseSpace;
  const visiblePendingTax = outcomeUiLocked ? null : pendingTax;
  const visiblePendingDebt = outcomeUiLocked ? null : pendingDebt;
  const visiblePendingCard = outcomeUiLocked ? null : pendingCard;
  const visibleAuction = outcomeUiLocked ? null : auction;
  const autoEndIsMyTurn = state ? sameEntityId(state.currentPlayerId, currentUserId) : false;
  const prompt = state
    ? currentPrompt({
        state,
        playersById,
        currentUserId,
        pendingPurchaseSpace: visiblePendingPurchaseSpace,
        pendingTax: visiblePendingTax,
        pendingDebt: visiblePendingDebt,
        pendingCard: visiblePendingCard,
        auction: visibleAuction
      })
    : null;
  const mainQuickAction = state
    ? quickAction({
        state,
        myActions,
        pendingCard: visiblePendingCard,
        pendingDebt: visiblePendingDebt,
        pendingPurchaseSpace: visiblePendingPurchaseSpace,
        auction: visibleAuction,
        pendingTax: visiblePendingTax
      })
    : null;
  const boardById = useMemo(() => new Map(board.map((space) => [space.id, space])), [board]);
  const rawModalState = state && !outcomeUiLocked ? buildModalState({ state, currentUserId, playersById, boardById }) : null;
  const modalShouldBlock = modalNeedsAction(rawModalState, myActions);
  const modalKey = rawModalState
    ? `${rawModalState.type}:${rawModalState.offer?.id || rawModalState.property?.id || rawModalState.card?.id || rawModalState.auction?.id || rawModalState.debt?.debtorId || state.turn.currentPlayerId}:${state.turn.turnNumber}`
    : "";
  const cardModalReady = rawModalState?.type !== "card" || boardViewMode !== "3d" || cardModalRevealKey === modalKey;
  const activeModal = outcomeUiLocked
    ? null
    : !cardModalReady
    ? null
    : rawModalState && modalShouldBlock
    ? { ...rawModalState, blocking: true }
    : rawModalState && modalDismissKey !== modalKey
      ? { ...rawModalState, blocking: false }
      : null;

  useEffect(() => {
    if (cardModalRevealTimeoutRef.current) {
      window.clearTimeout(cardModalRevealTimeoutRef.current);
      cardModalRevealTimeoutRef.current = null;
    }

    if (boardViewMode !== "3d" || outcomeUiLocked || rawModalState?.type !== "card" || !modalKey) {
      setCardModalRevealKey("");
      return undefined;
    }

    cardModalRevealTimeoutRef.current = window.setTimeout(() => {
      setCardModalRevealKey(modalKey);
      cardModalRevealTimeoutRef.current = null;
    }, CARD_MODAL_REVEAL_DELAY_MS);

    return () => {
      if (cardModalRevealTimeoutRef.current) {
        window.clearTimeout(cardModalRevealTimeoutRef.current);
        cardModalRevealTimeoutRef.current = null;
      }
    };
  }, [boardViewMode, modalKey, outcomeUiLocked, rawModalState?.type]);

  function scheduleMoneyBursts(bursts, delay = 0) {
    if (!bursts.length) return;

    const addTimeoutId = window.setTimeout(() => {
      setMoneyBursts((current) => [...current, ...bursts].slice(-8));
      const removeTimeoutId = window.setTimeout(() => {
        const burstIds = new Set(bursts.map((burst) => burst.id));
        setMoneyBursts((current) => current.filter((item) => !burstIds.has(item.id)));
      }, MONEY_BURST_LIFETIME_MS);
      moneyBurstTimeoutsRef.current.push(removeTimeoutId);
    }, Math.max(0, delay));

    moneyBurstTimeoutsRef.current.push(addTimeoutId);
  }

  useEffect(() => {
    if (!pendingDebt) {
      setDebtManagerOpen(false);
    }
  }, [pendingDebt]);

  function openDebtManager() {
    setBottomTab("assets");
    setDebtManagerOpen(true);
  }

  function openTradeMarket() {
    setPropertyTrade({ ...defaultPropertyTrade });
    setCardTrade({ ...defaultCardTrade });
    setTradeOpen(true);
  }

  function preparePropertyTradeFromSpace(intent, space, owner) {
    if (!space?.id) return;
    setPropertyTrade({
      ...defaultPropertyTrade,
      intent,
      propertyId: space.id,
      sellerId: intent === "buy" ? owner?.id || "" : "",
      price: suggestedPropertyTradePrice(space),
      source: "space"
    });
    setTradeOpen(true);
  }

  useEffect(() => {
    return () => {
      if (diceIntervalRef.current) window.clearInterval(diceIntervalRef.current);
      if (diceFocusTimeoutRef.current) window.clearTimeout(diceFocusTimeoutRef.current);
      if (diceTimeoutRef.current) window.clearTimeout(diceTimeoutRef.current);
      if (heldMonopolyStateTimeoutRef.current) window.clearTimeout(heldMonopolyStateTimeoutRef.current);
      if (cardModalRevealTimeoutRef.current) window.clearTimeout(cardModalRevealTimeoutRef.current);
      if (turnBannerTimeoutRef.current) window.clearTimeout(turnBannerTimeoutRef.current);
      cinematicTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      moneyBurstTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
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
      setVisibleRecentEvents((state.recentEvents || []).filter(shouldShowEvent));
      return;
    }

    const newEvents = state.recentEvents.filter((event) => !seenEventIdsRef.current.has(event.id));
    if (newEvents.length > 0) {
      const shouldUpdateEventUi = boardViewModeRef.current !== "3d";
      const previous = previousSnapshotRef.current;
      const previousRoll = previous?.turn?.lastRoll;
      const currentRoll = state.turn?.lastRoll;
      const previousRollSignature = previousRoll
        ? `${previous.turn.turnNumber}:${previousRoll.dice.join("-")}:${previous.currentPlayerId}`
        : "";
      const currentRollSignature = currentRoll
        ? `${state.turn.turnNumber}:${currentRoll.dice.join("-")}:${state.currentPlayerId}`
        : "";
      const movementTimeline = previous && currentRollSignature && currentRollSignature !== previousRollSignature
        ? (() => {
            const moverId = previous.currentPlayerId;
            const previousPlayer = previous.players?.find((player) => player.id === moverId);
            const from = previousPlayer?.position;
            const boardSize = state.board?.length || 40;
            const path = Number.isInteger(from) && currentRoll?.total
              ? buildMovementPath(from, currentRoll.total, boardSize)
              : [];
            return path.length ? { moverId, path } : null;
          })()
        : null;

      if (shouldUpdateEventUi) {
        newEvents.filter(shouldShowEvent).forEach((event, index) => {
          const delay = eventToastDelay(event, movementTimeline);
          const addTimeoutId = window.setTimeout(() => {
            setVisibleRecentEvents((current) => [...current, event].slice(-60));
            setToasts((current) => [...current, event].slice(-4));
            const removeTimeoutId = window.setTimeout(() => {
              setToasts((current) => current.filter((toast) => toast.id !== event.id));
            }, 4200 + index * 350);
            moneyBurstTimeoutsRef.current.push(removeTimeoutId);
          }, Math.max(0, delay));
          moneyBurstTimeoutsRef.current.push(addTimeoutId);
        });
      } else {
        const visibleEvents = newEvents.filter(shouldShowEvent);
        if (visibleEvents.length > 0) {
          const delay = eventToastDelay(visibleEvents[visibleEvents.length - 1], movementTimeline);
          const addTimeoutId = window.setTimeout(() => {
            setVisibleRecentEvents((current) => [...current, ...visibleEvents].slice(-60));
          }, Math.max(0, delay));
          moneyBurstTimeoutsRef.current.push(addTimeoutId);
        }
      }

      const burstGroups = new Map();
      newEvents.forEach((event) => {
        const delay = eventBurstDelay(event, movementTimeline);
        const bursts = buildMoneyBursts(event, playersById, boardById);
        if (!bursts.length) return;
        burstGroups.set(delay, [...(burstGroups.get(delay) || []), ...bursts]);
      });

      for (const [delay, bursts] of burstGroups.entries()) {
        scheduleMoneyBursts(bursts, delay);
      }

      const soundGroups = new Map();
      newEvents.forEach((event) => {
        const soundName =
          event.type === "CARD_DRAWN"
            ? "takecard"
            : event.type === "PLAYER_SENT_TO_JAIL"
              ? "prison"
            : ["PLAYER_RECEIVED_MONEY", "PLAYER_PAID", "JAIL_FINE_PAID", "DEBT_PAID"].includes(event.type)
              ? "payevent"
              : "";
        if (!soundName) return;
        const delay = eventSoundDelay(event, movementTimeline);
        const current = soundGroups.get(delay) || new Set();
        current.add(soundName);
        soundGroups.set(delay, current);
      });

      for (const [delay, names] of soundGroups.entries()) {
        const timeoutId = window.setTimeout(() => {
          names.forEach((name) => audio.play(name));
        }, Math.max(0, delay));
        moneyBurstTimeoutsRef.current.push(timeoutId);
      }

    }

    seenEventIdsRef.current = currentIds;
    setVisibleRecentEvents((current) => current.filter((event) => currentIds.has(event.id)));
  }, [state?.recentEvents, playersById, boardById]);

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

    clearDiceVisualTimers({ clearFocus: false, clearResult: true });
    clearMovementTimers();

    if (moverId && Number.isInteger(from)) {
      setDisplayPositions((current) => {
        const next = new Map(current);
        next.set(moverId, from);
        return next;
      });
    }

    const cinematicPlayerId = moverId || previous?.currentPlayerId || state.currentPlayerId;
    // El resultado del servidor es la fuente de verdad. Se carga antes de
    // detener la animacion para que los dados se asienten en esas caras.
    setDiceFaces(state.turn.lastRoll.dice);
    startDiceCameraFocus(cinematicPlayerId);

    // La tirada conserva un mínimo cinematográfico, pero en 3D espera a que
    // ambos dados se asienten. El máximo evita bloquear el turno si una
    // colisión excepcional nunca converge.
    //  camera focus: 520ms
    //  dice roll   : 1180ms
    //  step delay  : 330ms
    //  settle hold : 900ms
    const now = performance.now();
    const finishDelay = diceRollStartedAtRef.current
      ? Math.max(420, CINEMATIC_DICE_ROLL_MS - (now - diceRollStartedAtRef.current))
      : Math.max(0, CINEMATIC_DICE_FOCUS_MS - (now - diceSequenceStartedAtRef.current)) + CINEMATIC_DICE_ROLL_MS;

    const completeDiceRoll = () => {
      if (!diceRollStartedAtRef.current) {
        startDiceRollVisual();
      }
      clearDiceVisualTimers({ clearFocus: true, clearResult: false });
      setRollingDiceVisual(false);
      setCinematicPhase({ phase: "dice", playerId: cinematicPlayerId });
      // Mantener el foco en los dados un instante más para que sí se aprecien
      const highlightTimeoutId = window.setTimeout(() => {
        setCinematicPhase({ phase: "highlightTarget", playerId: cinematicPlayerId });

        const stepStartTimeoutId = window.setTimeout(() => {
          setCinematicPhase({ phase: "move", playerId: cinematicPlayerId });

          if (moverId && path.length > 0) {
            path.forEach((position, index) => {
              const timeoutId = window.setTimeout(() => {
                setDisplayPositions((current) => {
                  const next = new Map(current);
                  next.set(moverId, position);
                  return next;
                });
              }, index * CINEMATIC_STEP_MS);
              cinematicTimeoutsRef.current.push(timeoutId);
            });

            const settleTimeoutId = window.setTimeout(() => {
              setDisplayPositions((current) => {
                const next = new Map(current);
                next.set(moverId, to ?? path[path.length - 1]);
                return next;
              });
              setCinematicPhase({ phase: "settle", playerId: moverId });
            }, path.length * CINEMATIC_STEP_MS + 120);
            cinematicTimeoutsRef.current.push(settleTimeoutId);

            const finishTimeoutId = window.setTimeout(() => {
              diceSequenceStartedAtRef.current = 0;
              diceRollStartedAtRef.current = 0;
              setCinematicPhase(null);
            }, path.length * CINEMATIC_STEP_MS + CINEMATIC_SETTLE_HOLD_MS);
            cinematicTimeoutsRef.current.push(finishTimeoutId);
          } else {
            const finishTimeoutId = window.setTimeout(() => {
              diceSequenceStartedAtRef.current = 0;
              diceRollStartedAtRef.current = 0;
              setCinematicPhase(null);
            }, 1100);
            cinematicTimeoutsRef.current.push(finishTimeoutId);
          }
        }, CINEMATIC_TARGET_HIGHLIGHT_MS);
        cinematicTimeoutsRef.current.push(stepStartTimeoutId);
      }, CINEMATIC_DICE_REST_MS);
      cinematicTimeoutsRef.current.push(highlightTimeoutId);
    };

    const waitForPhysicalSettle = () => {
      const currentTime = performance.now();
      const rollStartedAt = diceRollStartedAtRef.current || diceSequenceStartedAtRef.current || currentTime;
      const reachedMaximum = currentTime - rollStartedAt >= CINEMATIC_DICE_MAX_ROLL_MS;
      if (boardViewModeRef.current !== "3d" || !dicePhysicsActiveRef.current || reachedMaximum) {
        diceTimeoutRef.current = null;
        completeDiceRoll();
        return;
      }
      diceTimeoutRef.current = window.setTimeout(waitForPhysicalSettle, CINEMATIC_DICE_SETTLE_POLL_MS);
    };

    diceTimeoutRef.current = window.setTimeout(waitForPhysicalSettle, finishDelay);
  }, [state?.turn?.lastRoll, state?.turn?.turnNumber, state?.currentPlayerId]);

  useEffect(() => {
    if (cinematic || rollingDice) return;
    if (!autoEndIsMyTurn || !myActions.includes("terminarTurno")) return;
    if (hasPendingDoubleReroll(state)) return;
    if (pendingPurchase || pendingCard || pendingTax || pendingDebt || pendingRentClaim || auction) return;
    if (state.turn.phase !== "AWAITING_TURN_END") return;

    const rollKey = state.turn.lastRoll?.dice?.join("-") || "no-roll";
    const signature = `${state.turn.turnNumber}:${rollKey}:${state.currentPlayerId}:${state.turn.phase}:auto-end`;
    if (autoEndTurnSignatureRef.current === signature) return;

    let cancelled = false;
    let timeoutId = null;
    const startedAt = performance.now();

    const tryAutoEndTurn = () => {
      if (cancelled) return;
      if (actionLockRef.current) {
        if (performance.now() - startedAt < 9000) {
          timeoutId = window.setTimeout(tryAutoEndTurn, 180);
        }
        return;
      }

      autoEndTurnSignatureRef.current = signature;
      act("terminarTurno", { auto: true });
    };

    timeoutId = window.setTimeout(tryAutoEndTurn, 260);

    return () => {
      cancelled = true;
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [
    auction,
    autoEndIsMyTurn,
    cinematic,
    myActions,
    pendingCard,
    pendingDebt,
    pendingPurchase,
    pendingRentClaim,
    pendingTax,
    rollingDice,
    state?.currentPlayerId,
    state?.turn?.lastRoll,
    state?.turn?.phase,
    state?.turn?.turnNumber
  ]);

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
      setTurnBanner({ key, playerName: currentPlayer?.name || myPlayer?.name || currentUser.username || "Jugador" });
      if (turnBannerTimeoutRef.current) {
        window.clearTimeout(turnBannerTimeoutRef.current);
      }
      turnBannerTimeoutRef.current = window.setTimeout(() => {
        setTurnBanner(null);
        turnBannerTimeoutRef.current = null;
      }, 1850);
      // Pequeño delay para no superponer otros audios de cierre del turno previo
      const timeoutId = window.setTimeout(() => {
        audio.play("tuturno");
      }, 240);
      return () => window.clearTimeout(timeoutId);
    }
    return undefined;
  }, [currentPlayer?.name, currentUser.username, currentUserId, myPlayer?.name, state?.currentPlayerId, state?.turn?.turnNumber, state?.winnerId]);

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
    return undefined;
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
      diceStateHoldUntilRef.current = performance.now() + MIN_DICE_STATE_HOLD_MS;
      startDiceCameraFocus(state?.currentPlayerId || myPlayer?.id || currentUserId, { restart: true, optimistic: true });
    }

    const emitAction = () => socket.emit("monopoly_action", { worldId: world.id, tableId: activeTableId, action, payload }, (response) => {
      if (!response?.ok) {
        releaseActionLock();
        diceStateHoldUntilRef.current = 0;
        if (action === "tirarDados") {
          stopDiceCinematic();
        }
        setError(response?.error || "No se pudo ejecutar la accion");
        return;
      }

      const applyResponse = () => {
        if (heldMonopolyStateTimeoutRef.current) {
          window.clearTimeout(heldMonopolyStateTimeoutRef.current);
          heldMonopolyStateTimeoutRef.current = null;
        }
        diceStateHoldUntilRef.current = 0;
        if (response.state?.tables) {
          setTables(response.state.tables);
        }
        if (response.state?.table) {
          setTableMeta(response.state.table);
          setState(response.state.table.game || null);
        }
        setError("");
        releaseActionLock();
      };

      if (action === "tirarDados") {
        const delay = Math.max(0, diceStateHoldUntilRef.current - performance.now());
        if (delay > 0) {
          const timeoutId = window.setTimeout(applyResponse, delay);
          cinematicTimeoutsRef.current.push(timeoutId);
          return;
        }
      }

      applyResponse();
    });

    if (action === "tirarDados") {
      const scheduleEmit = () => {
        if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
          window.requestAnimationFrame(() => {
            window.setTimeout(emitAction, 0);
          });
          return;
        }
        emitAction();
      };
      const authorization = diceMotionAuthorizationRef.current;
      if (
        diceMotionSequenceRef.current &&
        !diceMotionAuthorizedRef.current &&
        authorization.sequenceId === diceMotionSequenceRef.current &&
        authorization.promise
      ) {
        Promise.race([
          authorization.promise,
          new Promise((resolve) => window.setTimeout(() => resolve(false), 2500))
        ]).then((authorized) => {
          if (authorized) {
            scheduleEmit();
            return;
          }
          releaseActionLock();
          diceStateHoldUntilRef.current = 0;
          stopDiceCinematic();
          setError("No se pudo sincronizar el gesto de dados. Intenta de nuevo.");
        });
        return;
      }
      scheduleEmit();
      return;
    }

    emitAction();
  }

  function emitDiceMotion(motion) {
    if (!socket || !activeTableId || !motion) return;
    const now = performance.now();
    const isTerminal = motion.phase === "settled" || motion.phase === "cancel";

    const sendMotion = (payloadMotion, { volatile = false } = {}) => {
      const payload = {
        worldId: world.id,
        tableId: activeTableId,
        sequenceId: diceMotionSequenceRef.current,
        frame: diceMotionFrameRef.current,
        motion: payloadMotion
      };
      diceMotionFrameRef.current += 1;
      if (volatile && socket.volatile?.emit) {
        socket.volatile.emit("monopoly_dice_motion", payload);
      } else {
        socket.emit("monopoly_dice_motion", payload);
      }
    };

    if (motion.phase === "grab") {
      diceMotionSequenceRef.current = globalThis.crypto?.randomUUID?.() || `${currentUserId}-${Date.now()}`;
      diceMotionAuthorizedRef.current = false;
      diceMotionFrameRef.current = 1;
      pendingDiceMotionsRef.current = [];
      lastDiceMotionSentAtRef.current = { move: 0, state: 0 };
      let resolveAuthorization;
      const authorizationPromise = new Promise((resolve) => {
        resolveAuthorization = resolve;
      });
      diceMotionAuthorizationRef.current.resolve?.(false);
      diceMotionAuthorizationRef.current = {
        sequenceId: diceMotionSequenceRef.current,
        promise: authorizationPromise,
        resolve: resolveAuthorization
      };
      const payload = {
        worldId: world.id,
        tableId: activeTableId,
        sequenceId: diceMotionSequenceRef.current,
        frame: 0,
        motion
      };
      socket.emit("monopoly_dice_motion", payload, (response) => {
        if (!response?.ok || payload.sequenceId !== diceMotionSequenceRef.current) {
          if (diceMotionAuthorizationRef.current.sequenceId === payload.sequenceId) {
            diceMotionAuthorizationRef.current.resolve?.(false);
            diceMotionAuthorizationRef.current = { sequenceId: "", promise: null, resolve: null };
          }
          if (!response?.ok && response?.error) {
            setError(response.error);
          }
          diceMotionSequenceRef.current = "";
          diceMotionAuthorizedRef.current = false;
          diceMotionFrameRef.current = 0;
          pendingDiceMotionsRef.current = [];
          return;
        }

        diceMotionAuthorizedRef.current = true;
        if (diceMotionAuthorizationRef.current.sequenceId === payload.sequenceId) {
          diceMotionAuthorizationRef.current.resolve?.(true);
          diceMotionAuthorizationRef.current = { sequenceId: payload.sequenceId, promise: Promise.resolve(true), resolve: null };
        }
        const queuedMotions = pendingDiceMotionsRef.current;
        pendingDiceMotionsRef.current = [];
        queuedMotions.forEach((queuedMotion) => {
          sendMotion(queuedMotion, { volatile: queuedMotion.phase === "move" || queuedMotion.phase === "state" });
        });
        if (queuedMotions.some((queuedMotion) => queuedMotion.phase === "settled" || queuedMotion.phase === "cancel")) {
          diceMotionSequenceRef.current = "";
          diceMotionAuthorizedRef.current = false;
          diceMotionFrameRef.current = 0;
        }
      });
      return;
    }
    if (!diceMotionSequenceRef.current) return;
    const throttleMs = motion.phase === "move" ? 34 : motion.phase === "state" ? 45 : 0;
    if (throttleMs > 0) {
      const lastSentAt = lastDiceMotionSentAtRef.current[motion.phase] || 0;
      if (now - lastSentAt < throttleMs) return;
      lastDiceMotionSentAtRef.current[motion.phase] = now;
    }

    if (!diceMotionAuthorizedRef.current) {
      if (motion.phase === "move" || motion.phase === "state") {
        const existingIndex = pendingDiceMotionsRef.current.findIndex((queuedMotion) => queuedMotion.phase === motion.phase);
        if (existingIndex >= 0) {
          pendingDiceMotionsRef.current[existingIndex] = motion;
        } else {
          pendingDiceMotionsRef.current.push(motion);
        }
      } else {
        if (isTerminal) {
          pendingDiceMotionsRef.current = pendingDiceMotionsRef.current.filter((queuedMotion) => queuedMotion.phase !== "state");
        }
        pendingDiceMotionsRef.current.push(motion);
      }
      return;
    }

    sendMotion(motion, { volatile: motion.phase === "move" || motion.phase === "state" });
    if (isTerminal) {
      diceMotionSequenceRef.current = "";
      diceMotionAuthorizedRef.current = false;
      diceMotionFrameRef.current = 0;
      pendingDiceMotionsRef.current = [];
      diceMotionAuthorizationRef.current = { sequenceId: "", promise: null, resolve: null };
    }
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
            onBoardTheme={() => setBoardThemeEditorOpen(true)}
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
          figures={ownedTokenFigures}
          activeFigureId={currentEquippedCosmetics?.TOKEN?.id || ""}
          onFigureChange={equipMyTokenFigure}
          colorOnly
          reservedTokenColors={reservedTokenColorsForMe}
        />
        {isHostAtActiveTable && (
          <BoardThemeCustomizer
            open={boardThemeEditorOpen}
            onClose={() => setBoardThemeEditorOpen(false)}
            themes={ownedBoardThemes}
            activeThemeId={currentEquippedCosmetics?.BOARD_THEME?.id || ""}
            onChange={equipHostBoardTheme}
          />
        )}
      </>
    );
  }

  const isMyTurn = sameEntityId(state.currentPlayerId, currentUserId);
  const showThreeDSpaceCard = Boolean(
    threeDInfoSpaceId
  );
  const threeDInfoSpace = board.find((space) => space.id === threeDInfoSpaceId) || null;
  const threeDInfoOwner = threeDInfoSpace?.ownerId ? playersById.get(threeDInfoSpace.ownerId) : null;
  const threeDInfoOwnerDisplay = displayBoardPlayers.find((player) => sameEntityId(player.id, threeDInfoOwner?.id));
  const threeDInfoOwnerProperty = threeDInfoOwner?.properties.find((property) => property.id === threeDInfoSpace?.id) || null;
  const threeDInfoVisitors = displayBoardPlayers.filter((player) => player.position === threeDInfoSpace?.index && !player.bankrupt);
  const threeDSelectedSpaceModel = showThreeDSpaceCard
    ? buildThreeDSelectedSpaceModel({
      space: threeDInfoSpace,
      owner: threeDInfoOwner,
      ownerProperty: threeDInfoOwnerProperty,
      visitors: threeDInfoVisitors,
      board
    })
    : null;
  const selectedSpaceActions3D = buildThreeDSpaceActions({
    spaceModel: threeDSelectedSpaceModel,
    visiblePendingPurchaseSpace,
    isMyTurn,
    myActions,
    currentUserId
  });
  const selectedSpaceInfo3D = buildThreeDSelectedSpaceInfo(
    threeDSelectedSpaceModel,
    selectedSpaceActions3D,
    threeDInfoOwnerDisplay
  );

  function handleThreeDSelectionAction(action) {
    if (!action) return;
    debugMonopoly3DSelection("action", {
      action,
      space: threeDSelectedSpaceModel?.space || null,
      property: threeDSelectedSpaceModel?.property || null,
      owner: threeDSelectedSpaceModel?.owner || null,
      info: selectedSpaceInfo3D
    });
    if (action.type === "close") {
      setThreeDInfoSpaceId("");
      return;
    }
    if (action.type === "trade") {
      preparePropertyTradeFromSpace(action.intent, threeDInfoSpace, threeDInfoOwner);
      return;
    }
    if (action.type === "engine" && action.actionName) {
      act(action.actionName, action.payload || {});
    }
  }

  function selectThreeDSpace(spaceId, source = "board") {
    const nextSpace = board.find((space) => space.id === spaceId) || null;
    const nextOwner = nextSpace?.ownerId ? playersById.get(nextSpace.ownerId) : null;
    const nextOwnerProperty = nextOwner?.properties.find((property) => property.id === nextSpace?.id) || null;
    const nextVisitors = displayBoardPlayers.filter((player) => player.position === nextSpace?.index && !player.bankrupt);
    const nextModel = buildThreeDSelectedSpaceModel({
      space: nextSpace,
      owner: nextOwner,
      ownerProperty: nextOwnerProperty,
      visitors: nextVisitors,
      board
    });

    debugMonopoly3DSelection("select", {
      source,
      spaceId,
      space: nextSpace,
      owner: nextOwner,
      ownerProperty: nextOwnerProperty,
      normalizedProperty: nextModel?.property || null
    });

    setSelectedSpaceId(spaceId);
    setThreeDInfoSpaceId(spaceId);
    setBottomTab("space");
    setThreeDSelectionVersion((current) => current + 1);
  }

  return (
    <GameLayout immersive={boardViewMode === "3d"}>
      <TurnStartBanner banner={turnBanner} />

      {boardViewMode !== "3d" && (
        <EventToasts toasts={toasts} onDismiss={dismissToast} playersById={playersById} boardById={boardById} />
      )}

      <TopHud
        tableName={tableMeta?.name || activeTable?.name || "Mesa Monopoly"}
        state={state}
        currentPlayer={currentPlayer}
        myPlayer={myPlayer}
        myTokenStyle={myTokenStyle}
        turnCountdown={turnCountdown}
        onToken={() => setTokenEditorOpen(true)}
        onBoardTheme={() => setBoardThemeEditorOpen(true)}
        onRules={() => setRulesOpen(true)}
        onMenu={() => setMenuOpen(true)}
        boardViewMode={boardViewMode}
        onBoardViewModeChange={(nextMode) => {
          setBoardViewMode(nextMode);
          onBoardViewModeChange?.(nextMode);
        }}
        cameraAutoFollow={cameraAutoFollow}
        onCameraAutoFollowChange={setCameraAutoFollow}
        onLeave={leaveTable}
        onSurrender={surrenderGame}
        onCloseTable={closeTable}
        canLeave={tableMeta?.status !== "PLAYING" || state?.status === "FINALIZADO" || Boolean(state?.winnerId)}
        canSurrender={tableMeta?.status === "PLAYING" && state?.status !== "FINALIZADO" && !state?.winnerId && !myPlayer?.bankrupt}
        canCloseTable={isHostAtActiveTable && (tableMeta?.status !== "PLAYING" || state?.status === "FINALIZADO" || Boolean(state?.winnerId))}
        canChooseBoardTheme={isHostAtActiveTable}
        canChangeColor={canChangeMyColor}
        immersive={boardViewMode === "3d"}
      />

      {error && (
        <div className="monopoly-inline-error">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <main className="monopoly-game-main">
        {boardViewMode === "3d" ? (
          <Suspense fallback={<MonopolyViewLoading mode="3d" />}>
            <Monopoly3DView
              currentUser={currentUser}
              gameState={state}
              players={threeDPlayers}
              currentPlayerId={state.currentPlayerId}
              selectedSpaceId={selectedSpace?.id}
              onSelectSpaceId={(spaceId) => selectThreeDSpace(spaceId, "board")}
              rollingDice={rollingDice}
              diceFaces={diceFaces}
              diceCosmetics={activeDiceCosmetics}
              boardTheme={hostBoardTheme}
              onRemoteDiceMotionSink={bindRemoteDiceMotionSink}
              cinematic={cinematic}
              moneyBursts={moneyBursts}
              pendingCard={visiblePendingCard}
              selectedSpaceInfo={selectedSpaceInfo3D}
              cameraFocus={cameraAutoFollow ? cameraFocus : null}
              cameraAutoFollow={cameraAutoFollow}
              onCameraAutoFollowChange={setCameraAutoFollow}
              canRollDice={isMyTurn && myActions.includes("tirarDados") && !rollingDice && !cinematic}
              onRollDice={() => act("tirarDados")}
              onDicePhysicsChange={handleDicePhysicsChange}
              onDiceMotion={emitDiceMotion}
              onSelectionAction={handleThreeDSelectionAction}
              tableName={tableMeta?.name || activeTable?.name || "Mesa Monopoly"}
              statusTitle={prompt?.title || prompt?.eyebrow || ""}
              statusBody={prompt?.body || ""}
              sidePanel={(
                <ThreeDTablePanel
                  state={state}
                  players={state.players}
                  currentUserId={currentUserId}
                  currentPlayerId={state.currentPlayerId}
                  tokenStylesById={tokenStylesById}
                  customTokens={customTokens}
                  myPlayer={myPlayer}
                  selectedSpace={selectedSpace}
                  selectionVersion={threeDSelectionVersion}
                  selectedOwner={selectedOwner}
                  selectedVisitors={selectedVisitors}
                  selectedOwnerProperty={selectedOwnerProperty}
                  events={visibleRecentEvents}
                  playersById={playersById}
                  boardById={boardById}
                  onSelectSpace={(spaceId) => selectThreeDSpace(spaceId, "side-panel")}
                  onManage={(action, propertyId) => act(action, { propertyId })}
                  onOpenTrade={openTradeMarket}
                  onPrepareTrade={preparePropertyTradeFromSpace}
                />
              )}
            />
          </Suspense>
        ) : (
          <LegacyBoardArea
            board={board}
            boardTheme={hostBoardTheme}
            selectedSpace={selectedSpace}
            coloredPlayersById={coloredPlayersById}
            playersById={playersById}
            displayBoardPlayers={displayBoardPlayers}
            state={state}
            tokenStylesById={tokenStylesById}
            moneyBursts={moneyBursts}
            cameraFocus={cameraAutoFollow ? cameraFocus : null}
            cinematic={cinematic}
            prompt={prompt}
            diceFaces={diceFaces}
            rollingDice={rollingDice}
            myPlayer={myPlayer}
            isMyTurn={isMyTurn}
            myActions={myActions}
            pendingPurchaseSpace={visiblePendingPurchaseSpace}
            pendingTax={visiblePendingTax}
            pendingDebt={visiblePendingDebt}
            pendingCard={visiblePendingCard}
            auction={visibleAuction}
            bidAmount={bidAmount}
            setBidAmount={setBidAmount}
            canBidAuction={canBidAuction}
            canPassAuction={canPassAuction}
            onAction={act}
            onManageDebt={() => openDebtManager()}
            onSelect={setSelectedSpaceId}
          />
        )}
      </main>

      {boardViewMode !== "3d" && (
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
          events={visibleRecentEvents}
          playersById={playersById}
          boardById={boardById}
          onOpenTrade={openTradeMarket}
          onOpenRanking={() => setRankingOpen(true)}
          onToggleChat={() => setChatOpen((current) => !current)}
        />
      )}

      <PropertyModal
        modalState={debtManagerOpen ? null : activeModal}
        myActions={myActions}
        currentUserId={currentUserId}
        state={state}
        playersById={playersById}
        boardById={boardById}
        onAction={act}
        onManageDebt={() => openDebtManager()}
        onClose={() => setModalDismissKey(modalKey)}
      />

      <DebtManagementModal
        open={debtManagerOpen}
        onClose={() => setDebtManagerOpen(false)}
        debt={pendingDebt}
        player={myPlayer}
        onAction={act}
        onResolveDebt={() => act("resolverDeudaPendiente")}
        onOpenTrade={() => {
          setDebtManagerOpen(false);
          openTradeMarket();
        }}
        onFocusProperty={(propertyId) => {
          setSelectedSpaceId(propertyId);
          setBottomTab("space");
        }}
      />

      <TradeModalV2
        open={tradeOpen}
        onClose={() => {
          setTradeOpen(false);
          setPropertyTrade({ ...defaultPropertyTrade });
          setCardTrade({ ...defaultCardTrade });
        }}
        myPlayer={myPlayer}
        players={state.players}
        currentUserId={currentUserId}
        propertyTrade={propertyTrade}
        setPropertyTrade={setPropertyTrade}
        cardTrade={cardTrade}
        setCardTrade={setCardTrade}
        onAction={act}
        customTokens={customTokens}
      />

      <RulesModal open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <RankingModal open={rankingOpen} onClose={() => setRankingOpen(false)} ranking={state.ranking} />
      <VictoryCeremony
        state={state}
        playersById={playersById}
        boardById={boardById}
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
        figures={ownedTokenFigures}
        activeFigureId={currentEquippedCosmetics?.TOKEN?.id || ""}
        onFigureChange={equipMyTokenFigure}
        colorOnly
        reservedTokenColors={reservedTokenColorsForMe}
      />
      {isHostAtActiveTable && (
        <BoardThemeCustomizer
          open={boardThemeEditorOpen}
          onClose={() => setBoardThemeEditorOpen(false)}
          themes={ownedBoardThemes}
          activeThemeId={currentEquippedCosmetics?.BOARD_THEME?.id || ""}
          onChange={equipHostBoardTheme}
        />
      )}

      {boardViewMode !== "3d" && (rollingDice || cinematic) && (
        <div className="monopoly-anim-veil" aria-hidden="true" />
      )}
    </GameLayout>
  );

}
