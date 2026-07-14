import {
  Activity,
  ArrowLeft,
  Boxes,
  Bug,
  Camera,
  CheckCircle2,
  Coins,
  Gem,
  KeyRound,
  Lock,
  MessageSquare,
  Palette,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  Upload,
  UserCog,
  Users
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import BoardThemePainter from "./BoardThemePainter";
import EyconProductPreview3D from "./EyconProductPreview3D";
import BrandLogo from "./shared/BrandLogo";

const tabs = [
  { key: "overview", label: "Resumen", icon: Activity },
  { key: "users", label: "Usuarios", icon: Users },
  { key: "currency", label: "Monedas", icon: Coins },
  { key: "store", label: "Tienda 3D", icon: Boxes },
  { key: "stats", label: "Estadisticas", icon: Activity },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "reports", label: "Reportes", icon: Bug },
  { key: "logs", label: "Logs", icon: Shield }
];

const previewColorPresets = [
  { key: "red", label: "Rojo", bg: "#ef4444", ring: "#7f1d1d" },
  { key: "blue", label: "Azul", bg: "#3b82f6", ring: "#1e3a8a" },
  { key: "green", label: "Verde", bg: "#22c55e", ring: "#14532d" },
  { key: "gold", label: "Dorado", bg: "#fbbf24", ring: "#92400e" },
  { key: "pink", label: "Rosa", bg: "#ec4899", ring: "#831843" }
];

const DEFAULT_MODEL_COLOR_MODE = "TINT";
const DEFAULT_MODEL_TINT_STRENGTH = 0.75;

const colorModeCopy = {
  ORIGINAL: "Conserva materiales y texturas del GLB sin mezclar el color del jugador.",
  TINT: "Mezcla el color del jugador con el material. Default recomendado: 75%.",
  FORCE: "Reemplaza el color del material por el color del jugador."
};

const productRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY"];
const monopolyProductCategories = [
  { key: "TOKEN", label: "Pieza", slotKey: "TOKEN" },
  { key: "TOKEN_ANIMAL", label: "Pieza animal", slotKey: "TOKEN" },
  { key: "TOKEN_VEHICLE", label: "Pieza vehiculo", slotKey: "TOKEN" },
  { key: "TOKEN_OBJECT", label: "Pieza objeto", slotKey: "TOKEN" },
  { key: "TOKEN_FANTASY", label: "Pieza fantasia", slotKey: "TOKEN" },
  { key: "TOKEN_FOOD", label: "Pieza comida", slotKey: "TOKEN" },
  { key: "TOKEN_COLLECTIBLE", label: "Pieza coleccion", slotKey: "TOKEN" },
  { key: "TOKEN_PREMIUM", label: "Pieza especial", slotKey: "TOKEN" },
  { key: "DICE", label: "Dados", slotKey: "DICE" },
  { key: "DICE_FX", label: "FX de dados", slotKey: "DICE_FX" },
  { key: "BOARD_THEME", label: "Tablero", slotKey: "BOARD_THEME" }
];
const visualDesignerCategories = monopolyProductCategories.filter((item) => item.slotKey !== "TOKEN");
const dicePatternOptions = [
  { key: "solid", label: "Solido" },
  { key: "radial", label: "Radial" },
  { key: "split", label: "Split" },
  { key: "stripes", label: "Lineas" },
  { key: "checker", label: "Ajedrez" },
  { key: "speckles", label: "Speckles" },
  { key: "circuit", label: "Circuito" },
  { key: "stars", label: "Estrellas" },
  { key: "danger", label: "Hazard" },
  { key: "marble", label: "Marmol" }
];
const pipShapeOptions = [
  { key: "dot", label: "Circulo" },
  { key: "square", label: "Cuadro" },
  { key: "diamond", label: "Diamante" },
  { key: "ring", label: "Anillo" },
  { key: "star", label: "Estrella" }
];
const diceFxEffectOptions = [
  { key: "sparks", label: "Chispas" },
  { key: "trail", label: "Estela" },
  { key: "flakes", label: "Hielo" },
  { key: "glitch", label: "Glitch" },
  { key: "waves", label: "Ondas" },
  { key: "electric", label: "Electrico" },
  { key: "orbit", label: "Orbita" },
  { key: "galaxy", label: "Galaxia" },
  { key: "confetti", label: "Confeti" },
  { key: "flash", label: "Flash" },
  { key: "flames", label: "Flamas" },
  { key: "smoke", label: "Humo" },
  { key: "embers", label: "Brasas" },
  { key: "coins", label: "Monedas" },
  { key: "hearts", label: "Corazones" },
  { key: "portal", label: "Portal" },
  { key: "laser", label: "Laser" },
  { key: "bubbles", label: "Burbujas" },
  { key: "storm", label: "Tormenta" },
  { key: "runes", label: "Runas" }
];
const designerDefaults = {
  DICE: {
    baseColor: "#fffdf6",
    pipColor: "#3f2b17",
    accentColor: "#fbbf24",
    edgeColor: "#d8c39a",
    pattern: "solid",
    pipShape: "dot",
    roughness: 0.34,
    metalness: 0.04,
    opacity: 1,
    pipScale: 1,
    faceContrast: 0.35
  },
  DICE_FX: {
    effect: "flames",
    color: "#fb451f",
    secondaryColor: "#facc15",
    intensity: 1.15,
    speed: 1,
    spread: 1,
    particleSize: 1,
    ringScale: 1,
    beamJitter: 1,
    gravity: 0.55,
    sparkle: 0.65,
    density: 1
  },
  BOARD_THEME: {
    baseColor: "#2d2418",
    centerColor: "#1f6f59",
    accentColor: "#f4d45d",
    roughness: 0.58,
    metalness: 0.16,
    glow: 0.32,
    boardTexture: ""
  }
};

function slugFromName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function assetLookupKey(value) {
  return slugFromName(value).replace(/-/g, "_");
}

function likelyAssetForProduct(product, allowedAssets = []) {
  const candidates = [assetLookupKey(product?.slug), assetLookupKey(product?.name)].filter(Boolean);
  return allowedAssets.find((asset) => {
    const assetKey = String(asset.assetKey || "");
    const labelKey = assetLookupKey(asset.label);
    return candidates.some((candidate) =>
      assetKey === candidate ||
      assetKey.startsWith(`${candidate}_`) ||
      labelKey === candidate
    );
  }) || null;
}

function emptyProductDraft(category = "TOKEN") {
  const categoryConfig = monopolyProductCategories.find((item) => item.key === category) || monopolyProductCategories[0];
  return {
    id: "",
    slug: "",
    name: "",
    description: "",
    gameKey: "MONOPOLY",
    category: categoryConfig.key,
    slotKey: categoryConfig.slotKey,
    rarity: "LEGENDARY",
    priceUnits: 300,
    active: true,
    preview: "*",
    model: "hat",
    color: "#fbbf24",
    ring: "#92400e",
    reason: ""
  };
}

function draftFromStoreProduct(product) {
  if (!product) return emptyProductDraft();
  const metadata = product.metadata || {};
  return {
    id: product.id || "",
    slug: product.slug || "",
    name: product.name || "",
    description: product.description || "",
    gameKey: product.gameKey || "MONOPOLY",
    category: product.category || "TOKEN",
    slotKey: product.slotKey || product.category || "TOKEN",
    rarity: product.rarity || "COMMON",
    priceUnits: product.priceUnits ?? 0,
    active: product.active !== false,
    preview: product.preview || metadata.glyph || "*",
    model: metadata.model || metadata.fallbackModel || "hat",
    color: metadata.color || "#fbbf24",
    ring: metadata.ring || "#92400e",
    reason: ""
  };
}

function isTokenDraft(draft) {
  return draft?.slotKey === "TOKEN" || String(draft?.category || "").startsWith("TOKEN");
}

function isTokenProduct(product) {
  return product?.slotKey === "TOKEN" || String(product?.category || "").startsWith("TOKEN");
}

function metadataFromProductDraft(draft, currentProduct = null) {
  const metadata = { ...(currentProduct?.metadata || {}) };
  if (isTokenDraft(draft)) {
    metadata.renderer = metadata.renderer || "primitive";
    metadata.model = draft.model || metadata.model || metadata.fallbackModel || "hat";
    metadata.glyph = draft.preview || metadata.glyph || "*";
    metadata.color = draft.color || metadata.color || "#fbbf24";
    metadata.ring = draft.ring || metadata.ring || "#92400e";
  }
  return metadata;
}

function payloadFromProductDraft(draft, currentProduct = null) {
  const name = String(draft.name || "").trim();
  const slug = slugFromName(draft.slug || name);
  const categoryConfig = monopolyProductCategories.find((item) => item.key === draft.category);
  const payload = {
    slug,
    name,
    description: String(draft.description || "").trim(),
    gameKey: "MONOPOLY",
    category: draft.category,
    slotKey: draft.slotKey || categoryConfig?.slotKey || draft.category,
    rarity: draft.rarity,
    priceUnits: Number(draft.priceUnits),
    active: draft.active,
    preview: draft.preview || "*",
    metadata: metadataFromProductDraft(draft, currentProduct),
    reason: draft.reason
  };
  if (draft.id) payload.id = String(draft.id).trim();
  return payload;
}

function formatDate(value) {
  if (!value) return "Sin registro";
  try {
    return new Intl.DateTimeFormat("es-MX", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function formatMoney(value = 0) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatEycon(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
}

function formatPercent(value = 0) {
  return `${Math.round(Number(value || 0) * 100)}%`;
}

function roleLabel(roles = []) {
  const base = roles.includes("admin") ? "admin" : "user";
  return roles.includes("vip") ? `${base} · VIP` : base;
}

function metric(value) {
  return Number(value || 0).toLocaleString("es-MX");
}

function vectorFrom(value, fallback = [0, 0, 0]) {
  if (!Array.isArray(value)) return fallback;
  return [0, 1, 2].map((index) => {
    const parsed = Number(value[index]);
    return Number.isFinite(parsed) ? parsed : fallback[index] || 0;
  });
}

function draftFromModelProduct(product, allowedAssets = []) {
  const metadata = product?.metadata || {};
  const setting = product?.model3dSetting || null;
  const suggestedAsset = !setting && !metadata.assetKey ? likelyAssetForProduct(product, allowedAssets) : null;
  const assetKey = setting?.assetKey || metadata.assetKey || suggestedAsset?.assetKey || "";
  const asset = allowedAssets.find((item) => item.assetKey === assetKey) || suggestedAsset || {};
  const colorMode = setting?.colorMode || metadata.colorMode || DEFAULT_MODEL_COLOR_MODE;
  return {
    productId: product?.id || "",
    assetKey,
    assetUrl: setting?.assetUrl || metadata.assetUrl || asset.assetUrl || null,
    fallbackModel: setting?.fallbackModel || metadata.fallbackModel || asset.fallbackModel || "hat",
    fitSize: setting?.fitSize ?? metadata.fitSize ?? asset.fitSize ?? 1.9,
    rotation: vectorFrom(setting?.rotation || metadata.rotation),
    offset: vectorFrom(setting?.offset || metadata.offset),
    colorLocked: colorMode === "ORIGINAL",
    tintable: colorMode !== "ORIGINAL",
    tintStrength: setting?.tintStrength ?? metadata.tintStrength ?? DEFAULT_MODEL_TINT_STRENGTH,
    colorMode,
    previewStatus: setting?.previewStatus || metadata.previewStatus || "READY",
    active: setting?.active ?? true,
    reason: ""
  };
}

function modelDraftWithAsset(current, asset) {
  return {
    ...current,
    assetKey: asset?.assetKey || "",
    assetUrl: asset?.assetUrl || null,
    fallbackModel: asset?.fallbackModel || current.fallbackModel || "hat",
    fitSize: asset?.fitSize ?? current.fitSize ?? 1.9
  };
}

function modelSettingsFromDraft(draft, assetKey = draft.assetKey) {
  return {
    assetKey,
    fallbackModel: draft.fallbackModel,
    fitSize: Number(draft.fitSize),
    rotation: vectorFrom(draft.rotation),
    offset: vectorFrom(draft.offset),
    colorLocked: draft.colorLocked,
    tintable: draft.tintable,
    tintStrength: Number(draft.tintStrength),
    colorMode: draft.colorMode,
    previewStatus: draft.previewStatus,
    active: draft.active
  };
}

function productWithModelDraft(product, draft) {
  if (!product) return null;
  const active = draft.active !== false;
  const metadata = active
    ? {
        ...(product.metadata || {}),
        renderer: "gltf",
        assetKey: draft.assetKey,
        assetUrl: draft.assetUrl || undefined,
        fallbackModel: draft.fallbackModel,
        fitSize: Number(draft.fitSize || 1.9),
        rotation: vectorFrom(draft.rotation),
        offset: vectorFrom(draft.offset),
        colorLocked: draft.colorLocked !== false,
        tintable: draft.tintable === true,
        tintStrength: Number(draft.tintStrength ?? DEFAULT_MODEL_TINT_STRENGTH),
        colorMode: draft.colorMode || DEFAULT_MODEL_COLOR_MODE,
        previewStatus: draft.previewStatus || "READY"
      }
    : {
        ...(product.metadata || {}),
        renderer: "primitive",
        model: draft.fallbackModel || product.metadata?.fallbackModel || product.metadata?.model || "hat",
        colorLocked: false
      };
  return { ...product, rarity: active ? "LEGENDARY" : product.rarity, metadata };
}

function numberDraft(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function designerCategoryConfig(category) {
  return visualDesignerCategories.find((item) => item.key === category) || visualDesignerCategories[0];
}

function emptyDesignerDraft(category = "DICE") {
  const categoryConfig = designerCategoryConfig(category);
  const defaults = designerDefaults[categoryConfig.key] || designerDefaults.DICE;
  return {
    id: "",
    slug: "",
    name: "",
    description: "",
    gameKey: "MONOPOLY",
    category: categoryConfig.key,
    slotKey: categoryConfig.slotKey,
    rarity: categoryConfig.key === "DICE_FX" ? "EPIC" : "RARE",
    priceUnits: categoryConfig.key === "BOARD_THEME" ? 240 : categoryConfig.key === "DICE_FX" ? 180 : 120,
    active: true,
    preview: categoryConfig.key === "DICE" ? "D6" : categoryConfig.key === "DICE_FX" ? "FX" : "MAP",
    reason: "",
    ...defaults
  };
}

function draftFromDesignerProduct(product, fallbackCategory = "DICE") {
  const category = product?.category || fallbackCategory;
  const metadata = product?.metadata || {};
  const draft = {
    ...emptyDesignerDraft(category),
    id: product?.id || "",
    slug: product?.slug || "",
    name: product?.name || "",
    description: product?.description || "",
    category,
    slotKey: product?.slotKey || category,
    rarity: product?.rarity || "COMMON",
    priceUnits: product?.priceUnits ?? 0,
    active: product?.active !== false,
    preview: product?.preview || (category === "DICE" ? "D6" : category === "DICE_FX" ? "FX" : "MAP"),
    reason: ""
  };
  if (category === "DICE") {
    return {
      ...draft,
      baseColor: metadata.baseColor || draft.baseColor,
      pipColor: metadata.pipColor || draft.pipColor,
      accentColor: metadata.accentColor || draft.accentColor,
      edgeColor: metadata.edgeColor || draft.edgeColor,
      pattern: metadata.pattern || draft.pattern,
      pipShape: metadata.pipShape || draft.pipShape,
      roughness: metadata.roughness ?? draft.roughness,
      metalness: metadata.metalness ?? draft.metalness,
      opacity: metadata.opacity ?? draft.opacity,
      pipScale: metadata.pipScale ?? draft.pipScale,
      faceContrast: metadata.faceContrast ?? draft.faceContrast
    };
  }
  if (category === "DICE_FX") {
    return {
      ...draft,
      effect: metadata.effect || draft.effect,
      color: metadata.color || draft.color,
      secondaryColor: metadata.secondaryColor || draft.secondaryColor,
      intensity: metadata.intensity ?? draft.intensity,
      speed: metadata.speed ?? draft.speed,
      spread: metadata.spread ?? draft.spread,
      particleSize: metadata.particleSize ?? draft.particleSize,
      ringScale: metadata.ringScale ?? draft.ringScale,
      beamJitter: metadata.beamJitter ?? draft.beamJitter,
      gravity: metadata.gravity ?? draft.gravity,
      sparkle: metadata.sparkle ?? draft.sparkle,
      density: metadata.density ?? draft.density
    };
  }
  if (category === "BOARD_THEME") {
    return {
      ...draft,
      baseColor: metadata.baseColor || draft.baseColor,
      centerColor: metadata.centerColor || draft.centerColor,
      accentColor: metadata.accentColor || draft.accentColor,
      roughness: metadata.roughness ?? draft.roughness,
      metalness: metadata.metalness ?? draft.metalness,
      glow: metadata.glow ?? draft.glow,
      boardTexture: metadata.boardTexture || ""
    };
  }
  return draft;
}

function metadataFromDesignerDraft(draft) {
  if (draft.category === "DICE") {
    const opacity = numberDraft(draft.opacity, 1);
    return {
      baseColor: draft.baseColor,
      pipColor: draft.pipColor,
      accentColor: draft.accentColor,
      edgeColor: draft.edgeColor,
      pattern: draft.pattern,
      pipShape: draft.pipShape,
      roughness: numberDraft(draft.roughness, 0.34),
      metalness: numberDraft(draft.metalness, 0.04),
      opacity,
      transparent: opacity < 1,
      pipScale: numberDraft(draft.pipScale, 1),
      faceContrast: numberDraft(draft.faceContrast, 0.35),
      fxCompatible: true
    };
  }
  if (draft.category === "DICE_FX") {
    return {
      effect: draft.effect,
      color: draft.color,
      secondaryColor: draft.secondaryColor,
      intensity: numberDraft(draft.intensity, 1),
      speed: numberDraft(draft.speed, 1),
      spread: numberDraft(draft.spread, 1),
      particleSize: numberDraft(draft.particleSize, 1),
      ringScale: numberDraft(draft.ringScale, 1),
      beamJitter: numberDraft(draft.beamJitter, 1),
      gravity: numberDraft(draft.gravity, 0.55),
      sparkle: numberDraft(draft.sparkle, 0.65),
      density: numberDraft(draft.density, 1)
    };
  }
  if (draft.category === "BOARD_THEME") {
    return {
      baseColor: draft.baseColor,
      centerColor: draft.centerColor,
      accentColor: draft.accentColor,
      roughness: numberDraft(draft.roughness, 0.58),
      metalness: numberDraft(draft.metalness, 0.16),
      glow: numberDraft(draft.glow, 0.32),
      boardTexture: typeof draft.boardTexture === "string" && draft.boardTexture.startsWith("data:image")
        ? draft.boardTexture
        : ""
    };
  }
  return {};
}

function payloadFromDesignerDraft(draft) {
  const categoryConfig = designerCategoryConfig(draft.category);
  const name = String(draft.name || "").trim();
  const slug = slugFromName(draft.slug || name);
  const payload = {
    slug,
    name,
    description: String(draft.description || "").trim(),
    gameKey: "MONOPOLY",
    category: categoryConfig.key,
    slotKey: categoryConfig.slotKey,
    rarity: draft.rarity,
    priceUnits: Number(draft.priceUnits),
    active: draft.active,
    preview: draft.preview || (categoryConfig.key === "DICE" ? "D6" : categoryConfig.key === "DICE_FX" ? "FX" : "MAP"),
    metadata: metadataFromDesignerDraft({ ...draft, category: categoryConfig.key }),
    reason: draft.reason
  };
  if (draft.id) payload.id = String(draft.id).trim();
  return payload;
}

function productFromDesignerDraft(draft) {
  return {
    id: draft.id || "designer-preview",
    slug: draft.slug || slugFromName(draft.name),
    name: draft.name || (draft.category === "DICE" ? "Dados custom" : draft.category === "DICE_FX" ? "FX custom" : "Tablero custom"),
    description: draft.description || "Preview del estudio visual",
    priceUnits: Number(draft.priceUnits || 0),
    gameKey: "MONOPOLY",
    category: draft.category,
    slotKey: draft.slotKey || draft.category,
    rarity: draft.rarity || "COMMON",
    active: draft.active !== false,
    preview: draft.preview || "*",
    metadata: metadataFromDesignerDraft(draft)
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error || new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

export default function AdminPanel({ token, currentUser, onBack, onLogout, onAdminProfile }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [data, setData] = useState(null);
  const [query, setQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [userDraft, setUserDraft] = useState({ username: "", active: true, reason: "" });
  const [roleDraft, setRoleDraft] = useState({ roles: ["user"], reason: "" });
  const [passwordDraft, setPasswordDraft] = useState({ password: "", reason: "" });
  const [currencyDraft, setCurrencyDraft] = useState({
    userId: "",
    currency: "NORMAL",
    worldId: "",
    mode: "DELTA",
    amount: 100,
    reason: ""
  });
  const [selectedStoreProductId, setSelectedStoreProductId] = useState("");
  const [productDraftMode, setProductDraftMode] = useState("create");
  const [productDraft, setProductDraft] = useState(() => emptyProductDraft());
  const [modelDraft, setModelDraft] = useState(() => draftFromModelProduct(null));
  const [designerCategory, setDesignerCategory] = useState("DICE");
  const [designerDraftMode, setDesignerDraftMode] = useState("create");
  const [selectedDesignerProductId, setSelectedDesignerProductId] = useState("");
  const [designerDraft, setDesignerDraft] = useState(() => emptyDesignerDraft("DICE"));
  const [previewTokenColor, setPreviewTokenColor] = useState(previewColorPresets[0]);
  const [uploadDraft, setUploadDraft] = useState({
    file: null,
    label: "",
    fallbackModel: "hat",
    fitSize: 1.9,
    reason: ""
  });
  const [chatFilters, setChatFilters] = useState({ q: "", userId: "", worldId: "", from: "", to: "" });
  const [chatMessages, setChatMessages] = useState([]);
  const [reports, setReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [reportDraft, setReportDraft] = useState({ status: "OPEN", adminNotes: "" });
  const [reportScreenshotUrl, setReportScreenshotUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadOverview(nextQuery = query) {
    setBusy(true);
    try {
      const payload = await api(`/api/admin/overview?q=${encodeURIComponent(nextQuery || "")}`, { token });
      setData(payload);
      onAdminProfile?.(payload.admin);
      setError("");
      const firstUser = payload.users?.[0];
      setSelectedUserId((current) => current || String(firstUser?.id || ""));
      setCurrencyDraft((current) => ({
        ...current,
        userId: current.userId || String(firstUser?.id || ""),
        worldId: current.worldId || String(payload.currencies?.worlds?.[0]?.id || "")
      }));
      const firstModelProduct = payload.store?.model3d?.products?.[0]
        || payload.store?.products?.find((product) => product.gameKey === "MONOPOLY" && isTokenProduct(product));
      const firstStoreProduct = firstModelProduct || payload.store?.products?.[0];
      setSelectedStoreProductId((current) => current || String(firstStoreProduct?.id || ""));
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar administracion");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadOverview("");
  }, [token]);

  const users = data?.users || [];
  const worlds = data?.currencies?.worlds || [];
  const movements = data?.movements || data?.currencies?.movements || [];
  const logs = data?.logs || [];
  const stats = data?.stats || {};
  const store = data?.store || {};
  const productCatalog = store.products || [];
  const model3d = store.model3d || {};
  const model3dProducts = model3d.products || (store.products || []).filter(
    (product) => product.gameKey === "MONOPOLY" && isTokenProduct(product)
  );
  const allowedModelAssets = model3d.allowedAssets || [];
  const fallbackModels = model3d.fallbackModels || [];
  const previewStatuses = model3d.previewStatuses || ["DRAFT", "READY", "NEEDS_REVIEW", "BROKEN"];
  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) || users[0] || null,
    [selectedUserId, users]
  );
  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) || reports[0] || null,
    [reports, selectedReportId]
  );
  const selectedStoreProduct = useMemo(
    () => productCatalog.find((product) => product.id === selectedStoreProductId) || productCatalog[0] || null,
    [productCatalog, selectedStoreProductId]
  );
  const productDraftPreview = useMemo(() => ({
    id: productDraft.id || "preview-product",
    slug: productDraft.slug || slugFromName(productDraft.name),
    name: productDraft.name || "Nueva pieza",
    description: productDraft.description || "Vista previa del customizable",
    priceUnits: Number(productDraft.priceUnits || 0),
    gameKey: productDraft.gameKey || "MONOPOLY",
    category: productDraft.category || "TOKEN",
    slotKey: productDraft.slotKey || productDraft.category || "TOKEN",
    rarity: productDraft.rarity || "COMMON",
    active: productDraft.active !== false,
    preview: productDraft.preview || "*",
    metadata: metadataFromProductDraft(productDraft, productDraftMode === "edit" ? selectedStoreProduct : null)
  }), [productDraft, productDraftMode, selectedStoreProduct]);
  const configuratorPreviewProduct = useMemo(
    () => (isTokenProduct(productDraftPreview) && modelDraft.assetKey
      ? productWithModelDraft(productDraftPreview, modelDraft)
      : productDraftPreview),
    [productDraftPreview, modelDraft]
  );
  const selectedModelAsset = useMemo(
    () => allowedModelAssets.find((asset) => asset.assetKey === modelDraft.assetKey) || null,
    [allowedModelAssets, modelDraft.assetKey]
  );
  const uploadedModelAssets = useMemo(
    () => allowedModelAssets.filter((asset) => asset.source === "UPLOAD"),
    [allowedModelAssets]
  );
  const usedModelAssetKeys = useMemo(
    () => new Set(model3dProducts.map((product) => (
      product.model3dSetting?.active === false ? null : product.model3dSetting?.assetKey
    )).filter(Boolean)),
    [model3dProducts]
  );
  const unlinkedUploadedAssets = useMemo(
    () => uploadedModelAssets.filter((asset) => !usedModelAssetKeys.has(asset.assetKey)),
    [uploadedModelAssets, usedModelAssetKeys]
  );
  const designerProducts = useMemo(
    () => productCatalog.filter((product) => (
      product.gameKey === "MONOPOLY" &&
      product.category === designerCategory &&
      visualDesignerCategories.some((item) => item.key === product.category)
    )),
    [productCatalog, designerCategory]
  );
  const selectedDesignerProduct = useMemo(
    () => designerProducts.find((product) => product.id === selectedDesignerProductId) || null,
    [designerProducts, selectedDesignerProductId]
  );
  const designerPreviewProduct = useMemo(
    () => productFromDesignerDraft(designerDraft),
    [designerDraft]
  );

  useEffect(() => {
    if (!selectedUser) return;
    setUserDraft({
      username: selectedUser.username,
      active: selectedUser.active,
      reason: ""
    });
    setRoleDraft({
      roles: selectedUser.roles?.length ? selectedUser.roles : ["user"],
      reason: ""
    });
    setPasswordDraft({ password: "", reason: "" });
  }, [selectedUser?.id]);

  useEffect(() => {
    if (activeTab !== "reports") return;
    loadReports();
  }, [activeTab]);

  useEffect(() => {
    if (!selectedReport) return;
    setSelectedReportId(selectedReport.id);
    setReportDraft({ status: selectedReport.status, adminNotes: selectedReport.adminNotes || "" });
    if (reportScreenshotUrl) URL.revokeObjectURL(reportScreenshotUrl);
    setReportScreenshotUrl("");
    if (selectedReport.hasScreenshot) {
      fetch(`/api/admin/reports/${selectedReport.id}/screenshot`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then((response) => {
        if (response.status === 401) {
          window.dispatchEvent(new CustomEvent("easyno:auth-expired", {
            detail: { message: "Tu sesión expiró mientras revisabas administración." }
          }));
        }
        if (!response.ok) throw new Error("No se pudo cargar la captura");
        return response.blob();
      }).then((blob) => setReportScreenshotUrl(URL.createObjectURL(blob))).catch(() => {});
    }
  }, [selectedReport?.id]);

  useEffect(() => {
    if (productDraftMode !== "edit" || !selectedStoreProduct) return;
    setProductDraft(draftFromStoreProduct(selectedStoreProduct));
    if (isTokenProduct(selectedStoreProduct)) {
      setModelDraft(draftFromModelProduct(selectedStoreProduct, allowedModelAssets));
    }
  }, [productDraftMode, selectedStoreProduct?.id, selectedStoreProduct?.model3dSetting?.updatedAt, allowedModelAssets.length]);

  useEffect(() => {
    if (productDraftMode !== "create" || !isTokenDraft(productDraft) || modelDraft.assetKey) return;
    const asset = likelyAssetForProduct(productDraft, allowedModelAssets);
    if (asset) setModelDraft((current) => modelDraftWithAsset(current, asset));
  }, [productDraftMode, productDraft.category, productDraft.name, productDraft.slug, modelDraft.assetKey, allowedModelAssets.length]);

  async function searchUsers(event) {
    event?.preventDefault();
    await loadOverview(query);
  }

  async function updateUser() {
    if (!selectedUser) return;
    setBusy(true);
    try {
      const payload = await api(`/api/admin/users/${selectedUser.id}`, {
        method: "PATCH",
        token,
        body: userDraft
      });
      setData((current) => ({ ...current, users: payload.users || current.users }));
      setNotice("Usuario actualizado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo actualizar usuario");
    } finally {
      setBusy(false);
    }
  }

  async function updateRoles() {
    if (!selectedUser) return;
    setBusy(true);
    try {
      const payload = await api(`/api/admin/users/${selectedUser.id}/roles`, {
        method: "PUT",
        token,
        body: roleDraft
      });
      setData((current) => ({ ...current, users: payload.users || current.users }));
      setNotice("Roles actualizados.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudieron actualizar roles");
    } finally {
      setBusy(false);
    }
  }

  async function changePassword() {
    if (!selectedUser) return;
    setBusy(true);
    try {
      await api(`/api/admin/users/${selectedUser.id}/password`, {
        method: "POST",
        token,
        body: passwordDraft
      });
      setPasswordDraft({ password: "", reason: "" });
      setNotice("Contrasena actualizada.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cambiar contrasena");
    } finally {
      setBusy(false);
    }
  }

  async function adjustCurrency(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const payload = await api("/api/admin/currencies/adjust", {
        method: "POST",
        token,
        body: {
          ...currencyDraft,
          userId: Number(currencyDraft.userId),
          worldId: currencyDraft.currency === "NORMAL" ? Number(currencyDraft.worldId) : null,
          amount: Number(currencyDraft.amount)
        }
      });
      setData((current) => ({
        ...current,
        currencies: payload.currencies || current.currencies,
        movements: payload.movements || current.movements
      }));
      setCurrencyDraft((current) => ({ ...current, reason: "" }));
      setNotice("Movimiento de moneda registrado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo ajustar moneda");
    } finally {
      setBusy(false);
    }
  }

  async function loadChat(event) {
    event?.preventDefault();
    const params = new URLSearchParams();
    Object.entries(chatFilters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    setBusy(true);
    try {
      const payload = await api(`/api/admin/chat?${params.toString()}`, { token });
      setChatMessages(payload.messages || []);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar chat");
    } finally {
      setBusy(false);
    }
  }

  async function loadReports() {
    setBusy(true);
    try {
      const payload = await api("/api/admin/reports", { token });
      setReports(payload.reports || []);
      setSelectedReportId((current) => current || payload.reports?.[0]?.id || "");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudieron cargar los reportes");
    } finally {
      setBusy(false);
    }
  }

  async function updateReport(event) {
    event.preventDefault();
    if (!selectedReport) return;
    setBusy(true);
    try {
      const payload = await api(`/api/admin/reports/${selectedReport.id}`, {
        method: "PATCH", token, body: reportDraft
      });
      setReports(payload.reports || []);
      setNotice("Reporte actualizado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo actualizar el reporte");
    } finally {
      setBusy(false);
    }
  }

  async function refreshStoreSnapshot(selectedProductId = selectedStoreProductId) {
    const payload = await api("/api/admin/store-analysis", { token });
    const nextStore = payload.store || {};
    setData((current) => current ? { ...current, store: nextStore } : current);
    const nextProduct = (nextStore.products || []).find((product) => product.id === selectedProductId)
      || nextStore.products?.[0]
      || null;
    if (nextProduct) {
      setSelectedStoreProductId(nextProduct.id);
      setProductDraftMode("edit");
      setProductDraft(draftFromStoreProduct(nextProduct));
      if (nextProduct.gameKey === "MONOPOLY" && isTokenProduct(nextProduct)) {
        setModelDraft(draftFromModelProduct(nextProduct, nextStore.model3d?.allowedAssets || []));
      }
    }
    return nextProduct;
  }

  function startNewProduct(category = "TOKEN") {
    setProductDraftMode("create");
    setSelectedStoreProductId("");
    setProductDraft(emptyProductDraft(category));
    setModelDraft(draftFromModelProduct(null, allowedModelAssets));
    setUploadDraft({ file: null, label: "", fallbackModel: "hat", fitSize: 1.9, reason: "" });
  }

  function selectStoreProduct(product) {
    if (!product) return;
    setSelectedStoreProductId(product.id);
    setProductDraftMode("edit");
    setProductDraft(draftFromStoreProduct(product));
    if (product.gameKey === "MONOPOLY" && isTokenProduct(product)) {
      setModelDraft(draftFromModelProduct(product, allowedModelAssets));
    }
    setUploadDraft({ file: null, label: "", fallbackModel: "hat", fitSize: 1.9, reason: "" });
  }

  function startNewDesigner(category = designerCategory) {
    const nextCategory = designerCategoryConfig(category).key;
    setDesignerCategory(nextCategory);
    setDesignerDraftMode("create");
    setSelectedDesignerProductId("");
    setDesignerDraft(emptyDesignerDraft(nextCategory));
  }

  function selectDesignerProduct(product) {
    if (!product) return;
    setDesignerCategory(product.category);
    setDesignerDraftMode("edit");
    setSelectedDesignerProductId(product.id);
    setDesignerDraft(draftFromDesignerProduct(product, product.category));
  }

  function updateDesignerDraft(field, value) {
    setDesignerDraft((current) => {
      if (field === "name") {
        const next = { ...current, name: value };
        if (!current.slug) next.slug = slugFromName(value);
        return next;
      }
      return { ...current, [field]: value };
    });
  }

  function changeDesignerCategory(category) {
    startNewDesigner(category);
  }

  function updateProductDraft(field, value) {
    setProductDraft((current) => {
      if (field === "name") {
        const next = { ...current, name: value };
        if (!current.slug) next.slug = slugFromName(value);
        return next;
      }
      if (field === "category") {
        const categoryConfig = monopolyProductCategories.find((item) => item.key === value) || monopolyProductCategories[0];
        return {
          ...current,
          category: categoryConfig.key,
          slotKey: categoryConfig.slotKey,
          model: categoryConfig.key === "TOKEN" ? current.model : "hat"
        };
      }
      return { ...current, [field]: value };
    });
  }

  function updateModelDraft(field, value) {
    setModelDraft((current) => ({ ...current, [field]: value }));
  }

  function updateModelVector(field, index, value) {
    setModelDraft((current) => {
      const next = vectorFrom(current[field]);
      next[index] = value;
      return { ...current, [field]: next };
    });
  }

  function setModelColorMode(colorMode) {
    setModelDraft((current) => ({
      ...current,
      colorMode,
      colorLocked: colorMode === "ORIGINAL",
      tintable: colorMode !== "ORIGINAL",
      tintStrength: colorMode === "FORCE" ? 1 : current.tintStrength || DEFAULT_MODEL_TINT_STRENGTH
    }));
  }

  function chooseModelAsset(assetKey) {
    const asset = allowedModelAssets.find((item) => item.assetKey === assetKey);
    setModelDraft((current) => modelDraftWithAsset(current, asset || null));
  }

  async function saveDesignerProduct(event) {
    event.preventDefault();
    const reason = String(designerDraft.reason || "").trim();
    const productPayload = payloadFromDesignerDraft(designerDraft);
    if (!productPayload.name || !productPayload.slug) {
      setError("Nombre y slug son obligatorios para el preset visual.");
      return;
    }
    if (!reason) {
      setError("Agrega un motivo para guardar el preset visual.");
      return;
    }
    setBusy(true);
    try {
      const product = await api(
        designerDraftMode === "edit" && selectedDesignerProduct
          ? `/api/admin/eycon/products/${selectedDesignerProduct.id}`
          : "/api/admin/eycon/products",
        {
          method: designerDraftMode === "edit" && selectedDesignerProduct ? "PUT" : "POST",
          token,
          body: { ...productPayload, reason }
        }
      );
      await refreshStoreSnapshot(selectedStoreProductId);
      setDesignerCategory(product.category);
      setDesignerDraftMode("edit");
      setSelectedDesignerProductId(product.id);
      setDesignerDraft(draftFromDesignerProduct(product, product.category));
      setNotice("Preset visual guardado en la tienda.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar el preset visual");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateDesignerProduct() {
    if (!selectedDesignerProduct) return;
    const reason = String(designerDraft.reason || "Desactivacion de preset visual").trim();
    setBusy(true);
    try {
      const product = await api(`/api/admin/eycon/products/${selectedDesignerProduct.id}`, {
        method: "PUT",
        token,
        body: {
          active: false,
          reason
        }
      });
      await refreshStoreSnapshot(selectedStoreProductId);
      setDesignerDraft(draftFromDesignerProduct(product, product.category));
      setNotice("Preset visual desactivado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo desactivar el preset visual");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPendingModelAsset(reason) {
    if (!uploadDraft.file) {
      return null;
    }
    const fileBase64 = await fileToBase64(uploadDraft.file);
    const payload = await api("/api/admin/model-3d-assets", {
      method: "POST",
      token,
      body: {
        fileName: uploadDraft.file.name,
        label: uploadDraft.label || productDraft.name || uploadDraft.file.name.replace(/\.glb$/i, ""),
        fileBase64,
        fallbackModel: uploadDraft.fallbackModel,
        fitSize: Number(uploadDraft.fitSize),
        reason
      }
    });
    return payload.asset || null;
  }

  async function savePieceConfigurator(event) {
    event.preventDefault();
    const reason = String(productDraft.reason || modelDraft.reason || uploadDraft.reason || "").trim();
    const currentProduct = productDraftMode === "edit" ? selectedStoreProduct : null;
    const productPayload = payloadFromProductDraft(productDraft, currentProduct);
    if (!productPayload.name || !productPayload.slug) {
      setError("Nombre y slug son obligatorios.");
      return;
    }
    if (!reason) {
      setError("Agrega un motivo para guardar el cambio.");
      return;
    }
    if (productPayload.slotKey === "TOKEN" && !uploadDraft.file && !modelDraft.assetKey) {
      setError("Elige un GLB aprobado o selecciona un archivo .glb para esta pieza.");
      return;
    }

    setBusy(true);
    try {
      const uploadedAsset = await uploadPendingModelAsset(reason);
      const assetKey = uploadedAsset?.assetKey || modelDraft.assetKey;
      const nextModelDraft = uploadedAsset
        ? modelDraftWithAsset(modelDraft, uploadedAsset)
        : modelDraft;

      const product = await api(
        productDraftMode === "edit" && selectedStoreProduct
          ? `/api/admin/eycon/products/${selectedStoreProduct.id}`
          : "/api/admin/eycon/products",
        {
          method: productDraftMode === "edit" && selectedStoreProduct ? "PUT" : "POST",
          token,
          body: { ...productPayload, reason }
        }
      );

      if (isTokenProduct(product) && assetKey) {
        await api(`/api/admin/model-3d-settings/${product.id}`, {
          method: "PUT",
          token,
          body: {
            reason,
            settings: modelSettingsFromDraft(nextModelDraft, assetKey)
          }
        });
      }

      setUploadDraft({ file: null, label: "", fallbackModel: "hat", fitSize: 1.9, reason: "" });
      await refreshStoreSnapshot(product.id);
      setNotice(isTokenProduct(product)
        ? "Pieza y modelo 3D guardados en un solo flujo."
        : "Customizable guardado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar la pieza completa");
    } finally {
      setBusy(false);
    }
  }

  async function deactivateProduct() {
    if (!selectedStoreProduct) return;
    const reason = productDraft.reason || "Desactivacion de producto EyCon";
    setBusy(true);
    try {
      const product = await api(`/api/admin/eycon/products/${selectedStoreProduct.id}`, {
        method: "PUT",
        token,
        body: {
          active: false,
          reason
        }
      });
      await refreshStoreSnapshot(product.id);
      setNotice("Customizable desactivado.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo desactivar el customizable");
    } finally {
      setBusy(false);
    }
  }

  async function deleteModel3d() {
    if (!selectedStoreProduct) return;
    const reason = productDraft.reason || modelDraft.reason || "Desactivacion de ajuste 3D";
    setBusy(true);
    try {
      await api(`/api/admin/model-3d-settings/${selectedStoreProduct.id}`, {
        method: "DELETE",
        token,
        body: { reason }
      });
      await refreshStoreSnapshot(selectedStoreProduct.id);
      setModelDraft((current) => ({ ...current, active: false, reason: "" }));
      setNotice("Modelo 3D desactivado para esta pieza.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo desactivar modelo 3D");
    } finally {
      setBusy(false);
    }
  }

  async function deleteModelAsset(assetKey) {
    const reason = String(productDraft.reason || modelDraft.reason || uploadDraft.reason || "").trim();
    if (!assetKey) return;
    if (!reason) {
      setError("Agrega un motivo antes de eliminar el asset.");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/admin/model-3d-assets/${encodeURIComponent(assetKey)}`, {
        method: "DELETE",
        token,
        body: { reason }
      });
      if (modelDraft.assetKey === assetKey) {
        setModelDraft((current) => modelDraftWithAsset(current, null));
      }
      await refreshStoreSnapshot(selectedStoreProductId);
      setNotice(`Asset ${assetKey} eliminado de uploads aprobados.`);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo eliminar el asset");
    } finally {
      setBusy(false);
    }
  }

  function toggleRole(role) {
    setRoleDraft((current) => {
      const roleSet = new Set(current.roles || ["user"]);
      if (roleSet.has(role)) roleSet.delete(role);
      else roleSet.add(role);
      roleSet.add("user");
      return { ...current, roles: [...roleSet] };
    });
  }

  const selectedUserEconomies = (data?.currencies?.economies || []).filter(
    (economy) => String(economy.userId) === String(selectedUser?.id)
  );

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar-brand">
          <BrandLogo size="md" alt="EasyNo" />
          <div>
            <span className="admin-eyebrow"><Shield size={15} /> Panel protegido</span>
            <h1>Administracion</h1>
            <p>Control de usuarios, monedas, tienda, estadisticas y auditoria.</p>
          </div>
        </div>
        <div className="admin-topbar-actions">
          <span className="admin-session-pill">
            <Lock size={14} /> {currentUser?.username || "admin"} - {roleLabel(currentUser?.roles)}
          </span>
          <button type="button" onClick={() => loadOverview(query)} disabled={busy}>
            <RefreshCw size={16} /> Actualizar
          </button>
          <button type="button" onClick={onBack}>
            <ArrowLeft size={16} /> Plataforma
          </button>
          <button type="button" onClick={onLogout}>
            Salir
          </button>
        </div>
      </header>

      {error && <div className="admin-alert is-error">{error}</div>}
      {notice && <div className="admin-alert is-success">{notice}</div>}

      <nav className="admin-tabs" aria-label="Secciones de administracion">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              type="button"
              key={tab.key}
              className={activeTab === tab.key ? "is-active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={16} /> {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" && (
        <section className="admin-grid">
          <article className="admin-metric"><span>Usuarios</span><strong>{metric(stats.totalUsers)}</strong><small>{metric(stats.disabledUsers)} desactivados</small></article>
          <article className="admin-metric"><span>Conectados</span><strong>{metric(stats.connectedUserCount)}</strong><small>Socket activo</small></article>
          <article className="admin-metric"><span>Visitas API</span><strong>{metric(stats.totalVisits)}</strong><small>Registradas</small></article>
          <article className="admin-metric"><span>Productos</span><strong>{metric(store.summary?.productCount)}</strong><small>{metric(store.summary?.glbTokenCount)} piezas GLB</small></article>
          <section className="admin-panel is-wide">
            <header><Activity size={17} /> Actividad reciente</header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>Evento</th><th>Usuario</th><th>Detalle</th><th>Fecha</th></tr></thead>
                <tbody>
                  {logs.slice(0, 10).map((log) => (
                    <tr key={log.id}>
                      <td>{log.action}</td>
                      <td>{log.adminUsername || "Sistema"}</td>
                      <td>{log.reason || log.targetId}</td>
                      <td>{formatDate(log.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="admin-panel">
            <header><Users size={17} /> Conectados</header>
            <div className="admin-list">
              {(stats.connectedUsers || []).map((user) => (
                <span key={`${user.userId}-${user.worldId}`}><strong>{user.username}</strong><small>Mundo {user.worldId} - {user.socketCount} socket</small></span>
              ))}
              {(!stats.connectedUsers || stats.connectedUsers.length === 0) && <em>No hay usuarios conectados.</em>}
            </div>
          </section>
        </section>
      )}

      {activeTab === "users" && (
        <section className="admin-two-column">
          <div className="admin-panel">
            <header><Search size={17} /> Usuarios</header>
            <form className="admin-search" onSubmit={searchUsers}>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por ID o username" />
              <button type="submit"><Search size={15} /> Buscar</button>
            </form>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Username</th><th>Rol</th><th>Estado</th><th>Ultimo login</th></tr></thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className={String(selectedUser?.id) === String(user.id) ? "is-selected" : ""}
                      onClick={() => setSelectedUserId(String(user.id))}
                    >
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{roleLabel(user.roles)}</td>
                      <td>{user.active ? "Activo" : "Inactivo"}</td>
                      <td>{formatDate(user.lastLoginAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <aside className="admin-panel">
            <header><UserCog size={17} /> Editar usuario</header>
            {selectedUser ? (
              <div className="admin-form-stack">
                <label>Username<input value={userDraft.username} onChange={(event) => setUserDraft((current) => ({ ...current, username: event.target.value }))} /></label>
                <label className="admin-check"><input type="checkbox" checked={userDraft.active} onChange={(event) => setUserDraft((current) => ({ ...current, active: event.target.checked }))} /> Usuario activo</label>
                <label>Motivo<input value={userDraft.reason} onChange={(event) => setUserDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Obligatorio" /></label>
                <button type="button" onClick={updateUser} disabled={busy}><CheckCircle2 size={16} /> Guardar datos</button>

                <hr />
                <strong>Roles</strong>
                <label className="admin-check"><input type="checkbox" checked disabled /> user</label>
                <label className="admin-check"><input type="checkbox" checked={roleDraft.roles.includes("admin")} onChange={() => toggleRole("admin")} /> admin</label>
                <label className="admin-check"><input type="checkbox" checked={roleDraft.roles.includes("vip")} onChange={() => toggleRole("vip")} /> vip (nombre dorado)</label>
                <label>Motivo<input value={roleDraft.reason} onChange={(event) => setRoleDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Obligatorio" /></label>
                <button type="button" onClick={updateRoles} disabled={busy}><Shield size={16} /> Actualizar roles</button>

                <hr />
                <strong>Cambiar contrasena</strong>
                <label>Nueva contrasena<input type="password" value={passwordDraft.password} onChange={(event) => setPasswordDraft((current) => ({ ...current, password: event.target.value }))} /></label>
                <label>Motivo<input value={passwordDraft.reason} onChange={(event) => setPasswordDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Obligatorio" /></label>
                <button type="button" onClick={changePassword} disabled={busy}><KeyRound size={16} /> Cambiar contrasena</button>
              </div>
            ) : (
              <p>Selecciona un usuario.</p>
            )}
          </aside>
        </section>
      )}

      {activeTab === "currency" && (
        <section className="admin-two-column">
          <div className="admin-panel">
            <header><Coins size={17} /> Saldos</header>
            <form className="admin-currency-form" onSubmit={adjustCurrency}>
              <select value={currencyDraft.userId} onChange={(event) => setCurrencyDraft((current) => ({ ...current, userId: event.target.value }))}>
                {users.map((user) => <option key={user.id} value={user.id}>{user.username} - ID {user.id}</option>)}
              </select>
              <select value={currencyDraft.currency} onChange={(event) => setCurrencyDraft((current) => ({ ...current, currency: event.target.value }))}>
                <option value="NORMAL">Moneda normal</option>
                <option value="EYCON">EyCon</option>
              </select>
              {currencyDraft.currency === "NORMAL" && (
                <select value={currencyDraft.worldId} onChange={(event) => setCurrencyDraft((current) => ({ ...current, worldId: event.target.value }))}>
                  {worlds.map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}
                </select>
              )}
              <select value={currencyDraft.mode} onChange={(event) => setCurrencyDraft((current) => ({ ...current, mode: event.target.value }))}>
                <option value="DELTA">Sumar/restar</option>
                <option value="SET">Setear saldo</option>
              </select>
              <input type="number" step="1" value={currencyDraft.amount} onChange={(event) => setCurrencyDraft((current) => ({ ...current, amount: event.target.value }))} />
              <input value={currencyDraft.reason} onChange={(event) => setCurrencyDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Motivo obligatorio" />
              <button type="submit" disabled={busy}><CheckCircle2 size={16} /> Registrar movimiento</button>
            </form>

            {selectedUser && (
              <div className="admin-balance-strip">
                <span><small>EyCon</small><strong>{formatEycon(selectedUser.eyconBalanceUnits)}</strong></span>
                <span><small>Normal total</small><strong>{formatMoney(selectedUser.normalBalance)}</strong></span>
                {selectedUserEconomies.map((economy) => (
                  <span key={`${economy.userId}-${economy.worldId}`}><small>{economy.worldName}</small><strong>{formatMoney(economy.balance)}</strong></span>
                ))}
              </div>
            )}
          </div>
          <div className="admin-panel">
            <header><Gem size={17} /> Historial de monedas</header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>Usuario</th><th>Moneda</th><th>Antes</th><th>Despues</th><th>Dif.</th><th>Admin</th><th>Motivo</th></tr></thead>
                <tbody>
                  {movements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{movement.username}</td>
                      <td>{movement.currency}</td>
                      <td>{movement.currency === "EYCON" ? formatEycon(movement.balanceBefore) : formatMoney(movement.balanceBefore)}</td>
                      <td>{movement.currency === "EYCON" ? formatEycon(movement.balanceAfter) : formatMoney(movement.balanceAfter)}</td>
                      <td>{movement.amount > 0 ? "+" : ""}{movement.currency === "EYCON" ? formatEycon(movement.amount) : formatMoney(movement.amount)}</td>
                      <td>{movement.adminUsername || "Sistema"}</td>
                      <td>{movement.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === "store" && (
        <section className="admin-grid">
          <article className="admin-metric"><span>Productos</span><strong>{metric(store.summary?.productCount)}</strong><small>{metric(store.summary?.activeProductCount)} activos</small></article>
          <article className="admin-metric"><span>Piezas BolowPoly</span><strong>{metric(store.summary?.monopolyTokenCount)}</strong><small>{metric(store.summary?.glbTokenCount)} GLB</small></article>
          <article className="admin-metric"><span>Ajustes 3D</span><strong>{metric(store.summary?.model3dSettingCount)}</strong><small>{metric(store.summary?.allowedAssetCount)} assets permitidos</small></article>
          <section className="admin-panel is-wide admin-piece-console">
            <header>
              <span><Boxes size={17} /> Configurador de piezas BolowPoly</span>
              <button type="button" onClick={() => startNewProduct("TOKEN")} disabled={busy}>
                <Upload size={16} /> Nueva pieza
              </button>
            </header>

            <div className="admin-piece-layout">
              <aside className="admin-piece-list" aria-label="Piezas BolowPoly">
                <div className="admin-piece-list-head">
                  <strong>Piezas</strong>
                  <small>{model3dProducts.length} registros</small>
                </div>
                <div className="admin-piece-items">
                  {model3dProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className={productDraftMode === "edit" && selectedStoreProduct?.id === product.id ? "is-selected" : ""}
                      onClick={() => selectStoreProduct(product)}
                    >
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.id}</small>
                      </span>
                      <em className={product.metadata?.renderer === "gltf" ? "tone-ready" : product.active ? "tone-draft" : "tone-off"}>
                        {product.metadata?.renderer === "gltf" ? "GLB" : product.active ? "Base" : "Off"}
                      </em>
                    </button>
                  ))}
                </div>
              </aside>

              <form className="admin-form-stack admin-piece-form" onSubmit={savePieceConfigurator}>
                <div className="admin-piece-section">
                  <span className="admin-section-kicker">{productDraftMode === "edit" ? "Pieza seleccionada" : "Alta de pieza"}</span>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Nombre</strong>
                      <input value={productDraft.name} onChange={(event) => updateProductDraft("name", event.target.value)} placeholder="Minecraft Bee" />
                    </label>
                    <label>
                      <strong>Slug</strong>
                      <input value={productDraft.slug} onChange={(event) => updateProductDraft("slug", slugFromName(event.target.value))} placeholder="minecraft-bee" />
                    </label>
                  </div>
                  {productDraftMode === "create" && (
                    <label>
                      <strong>ID</strong>
                      <input value={productDraft.id} onChange={(event) => updateProductDraft("id", event.target.value)} placeholder="monopoly-token-minecraft-bee" />
                    </label>
                  )}
                  <label>
                    <strong>Descripcion</strong>
                    <input value={productDraft.description} onChange={(event) => updateProductDraft("description", event.target.value)} placeholder="Pieza coleccionable para BolowPoly." />
                  </label>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Rareza</strong>
                      <select value={productDraft.rarity} onChange={(event) => updateProductDraft("rarity", event.target.value)}>
                        {productRarities.map((rarityKey) => <option key={rarityKey} value={rarityKey}>{rarityKey}</option>)}
                      </select>
                    </label>
                    <label>
                      <strong>Precio</strong>
                      <input type="number" min="0" max="100000" step="1" value={productDraft.priceUnits} onChange={(event) => updateProductDraft("priceUnits", event.target.value)} />
                    </label>
                  </div>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Fallback</strong>
                      <select value={productDraft.model} onChange={(event) => updateProductDraft("model", event.target.value)}>
                        {(fallbackModels.length ? fallbackModels : ["hat"]).map((model) => <option key={model} value={model}>{model}</option>)}
                      </select>
                    </label>
                    <label>
                      <strong>Estado</strong>
                      <select value={productDraft.active ? "1" : "0"} onChange={(event) => updateProductDraft("active", event.target.value === "1")}>
                        <option value="1">Activo</option>
                        <option value="0">Inactivo</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="admin-piece-section">
                  <span className="admin-section-kicker">Modelo GLB</span>
                  <label>
                    <strong>Asset aprobado</strong>
                    <select value={modelDraft.assetKey} onChange={(event) => chooseModelAsset(event.target.value)}>
                      <option value="">Sin GLB</option>
                      {allowedModelAssets.map((asset) => (
                        <option key={asset.assetKey} value={asset.assetKey}>{asset.label} - {asset.assetKey}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => deleteModelAsset(modelDraft.assetKey)}
                    disabled={
                      busy ||
                      !selectedModelAsset ||
                      selectedModelAsset.source !== "UPLOAD" ||
                      usedModelAssetKeys.has(selectedModelAsset.assetKey)
                    }
                  >
                    <Trash2 size={16} /> Borrar asset seleccionado
                  </button>
                  <div className="admin-model-drop">
                    <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => setUploadDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                    <span>
                      <strong>{uploadDraft.file?.name || "Sin archivo nuevo"}</strong>
                      <small>{uploadDraft.file ? "Se subira al guardar" : selectedModelAsset?.filePath || "Selecciona asset o archivo"}</small>
                    </span>
                  </div>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Etiqueta upload</strong>
                      <input value={uploadDraft.label} onChange={(event) => setUploadDraft((current) => ({ ...current, label: event.target.value }))} placeholder={productDraft.name || "Nombre visible"} />
                    </label>
                    <label>
                      <strong>Fallback upload</strong>
                      <select value={uploadDraft.fallbackModel} onChange={(event) => setUploadDraft((current) => ({ ...current, fallbackModel: event.target.value }))}>
                        {(fallbackModels.length ? fallbackModels : ["hat"]).map((model) => <option key={model} value={model}>{model}</option>)}
                      </select>
                    </label>
                  </div>
                </div>

                <div className="admin-piece-section">
                  <span className="admin-section-kicker">Render</span>
                  <div className="admin-color-mode">
                    <strong><Palette size={15} /> Color</strong>
                    <div className="admin-segmented">
                      {["ORIGINAL", "TINT", "FORCE"].map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={modelDraft.colorMode === mode ? "is-active" : ""}
                          onClick={() => setModelColorMode(mode)}
                        >
                          {mode === "ORIGINAL" ? "Original" : mode === "TINT" ? "Tinte" : "Forzar"}
                        </button>
                      ))}
                    </div>
                    <small>{colorModeCopy[modelDraft.colorMode || DEFAULT_MODEL_COLOR_MODE]}</small>
                  </div>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Escala</strong>
                      <input type="number" min="0.1" max="5" step="0.01" value={modelDraft.fitSize} onChange={(event) => updateModelDraft("fitSize", event.target.value)} />
                    </label>
                    <label>
                      <strong>Tinte {formatPercent(modelDraft.tintStrength)}</strong>
                      <input type="range" min="0" max="1" step="0.01" value={modelDraft.tintStrength} onChange={(event) => updateModelDraft("tintStrength", event.target.value)} disabled={modelDraft.colorMode !== "TINT"} />
                    </label>
                  </div>
                  <div className="admin-vector-pair">
                    <div className="admin-vector-group">
                      <strong>Rotacion</strong>
                      {[0, 1, 2].map((index) => (
                        <input key={`rotation-${index}`} type="number" step="0.01" value={modelDraft.rotation[index]} onChange={(event) => updateModelVector("rotation", index, event.target.value)} />
                      ))}
                    </div>
                    <div className="admin-vector-group">
                      <strong>Offset</strong>
                      {[0, 1, 2].map((index) => (
                        <input key={`offset-${index}`} type="number" step="0.01" value={modelDraft.offset[index]} onChange={(event) => updateModelVector("offset", index, event.target.value)} />
                      ))}
                    </div>
                  </div>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Preview QA</strong>
                      <select value={modelDraft.previewStatus} onChange={(event) => updateModelDraft("previewStatus", event.target.value)}>
                        {previewStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                      </select>
                    </label>
                    <label>
                      <strong>Publicacion 3D</strong>
                      <select value={modelDraft.active ? "1" : "0"} onChange={(event) => updateModelDraft("active", event.target.value === "1")}>
                        <option value="1">Publicado</option>
                        <option value="0">Oculto</option>
                      </select>
                    </label>
                  </div>
                </div>

                <div className="admin-piece-section">
                  <label>
                    <strong>Motivo</strong>
                    <input value={productDraft.reason} onChange={(event) => updateProductDraft("reason", event.target.value)} placeholder="Alta de pieza, modelo nuevo, ajuste visual..." />
                  </label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={busy || !productDraft.name}>
                      <CheckCircle2 size={16} /> Guardar pieza completa
                    </button>
                    <button type="button" className="is-danger" onClick={deactivateProduct} disabled={busy || productDraftMode !== "edit" || !selectedStoreProduct?.active}>
                      <Trash2 size={16} /> Desactivar pieza
                    </button>
                  </div>
                  <button type="button" className="is-danger" onClick={deleteModel3d} disabled={busy || productDraftMode !== "edit" || !selectedStoreProduct?.model3dSetting}>
                    <Trash2 size={16} /> Quitar solo GLB
                  </button>
                </div>
              </form>

              <aside className="admin-piece-preview">
                <div className="admin-preview-tools">
                  <strong><Palette size={15} /> Color de jugador</strong>
                  <div className="admin-color-swatches">
                    {previewColorPresets.map((preset) => (
                      <button
                        key={preset.key}
                        type="button"
                        className={previewTokenColor.key === preset.key ? "is-active" : ""}
                        style={{ "--swatch": preset.bg }}
                        onClick={() => setPreviewTokenColor(preset)}
                        title={preset.label}
                      />
                    ))}
                  </div>
                  <div className="admin-inline-fields">
                    <input type="color" value={previewTokenColor.bg} onChange={(event) => setPreviewTokenColor((current) => ({ ...current, key: "custom", bg: event.target.value }))} />
                    <input type="color" value={previewTokenColor.ring} onChange={(event) => setPreviewTokenColor((current) => ({ ...current, key: "custom", ring: event.target.value }))} />
                  </div>
                </div>
                <EyconProductPreview3D product={configuratorPreviewProduct} tokenColor={isTokenDraft(productDraft) ? previewTokenColor : null} />
                <div className="admin-list">
                  <span><strong>{productDraft.name || "Nueva pieza"}</strong><small>{modelDraft.assetKey || "Sin GLB"} - {modelDraft.previewStatus}</small></span>
                  <span><strong>Archivo</strong><small>{uploadDraft.file?.name || selectedModelAsset?.filePath || "No seleccionado"}</small></span>
                  <span><strong>Uploads libres</strong><small>{unlinkedUploadedAssets.map((asset) => asset.assetKey).join(", ") || "Ninguno"}</small></span>
                </div>
                {unlinkedUploadedAssets.length > 0 && (
                  <div className="admin-asset-picks">
                    {unlinkedUploadedAssets.slice(0, 6).map((asset) => (
                      <article key={asset.assetKey}>
                        <span>
                          <strong>{asset.label}</strong>
                          <small>{asset.assetKey}</small>
                        </span>
                        <button type="button" onClick={() => chooseModelAsset(asset.assetKey)} disabled={busy}>
                          Usar
                        </button>
                        <button type="button" className="is-danger" onClick={() => deleteModelAsset(asset.assetKey)} disabled={busy}>
                          <Trash2 size={14} />
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </aside>
            </div>
          </section>

          <section className="admin-panel is-wide admin-visual-studio">
            <header>
              <span><Palette size={17} /> Estudio visual BolowPoly</span>
              <button type="button" onClick={() => startNewDesigner(designerCategory)} disabled={busy}>
                <Upload size={16} /> Nuevo preset
              </button>
            </header>

            <div className="admin-designer-tabs" aria-label="Tipos de customizables visuales">
              {visualDesignerCategories.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={designerCategory === category.key ? "is-active" : ""}
                  onClick={() => changeDesignerCategory(category.key)}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <div className="admin-designer-layout">
              <aside className="admin-designer-list" aria-label="Presets visuales">
                <div className="admin-piece-list-head">
                  <strong>{designerCategoryConfig(designerCategory).label}</strong>
                  <small>{designerProducts.length} presets</small>
                </div>
                <div className="admin-designer-items">
                  {designerProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      className={designerDraftMode === "edit" && selectedDesignerProduct?.id === product.id ? "is-selected" : ""}
                      onClick={() => selectDesignerProduct(product)}
                    >
                      <span>
                        <strong>{product.name}</strong>
                        <small>{product.slug}</small>
                      </span>
                      <em className={product.active ? "tone-ready" : "tone-off"}>{product.active ? product.rarity : "Off"}</em>
                    </button>
                  ))}
                </div>
              </aside>

              <form className="admin-form-stack admin-designer-form" onSubmit={saveDesignerProduct}>
                <div className="admin-piece-section">
                  <span className="admin-section-kicker">{designerDraftMode === "edit" ? "Editar preset" : "Crear preset"}</span>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Nombre</strong>
                      <input value={designerDraft.name} onChange={(event) => updateDesignerDraft("name", event.target.value)} placeholder="Flamas reales, dados cyber, tablero lava..." />
                    </label>
                    <label>
                      <strong>Slug</strong>
                      <input value={designerDraft.slug} onChange={(event) => updateDesignerDraft("slug", slugFromName(event.target.value))} placeholder="flamas-reales" />
                    </label>
                  </div>
                  {designerDraftMode === "create" && (
                    <label>
                      <strong>ID opcional</strong>
                      <input value={designerDraft.id} onChange={(event) => updateDesignerDraft("id", event.target.value)} placeholder={`monopoly-${designerDraft.category.toLowerCase()}-${designerDraft.slug || "nuevo"}`} />
                    </label>
                  )}
                  <label>
                    <strong>Descripcion</strong>
                    <input value={designerDraft.description} onChange={(event) => updateDesignerDraft("description", event.target.value)} placeholder="Como se vera en la tienda." />
                  </label>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Rareza</strong>
                      <select value={designerDraft.rarity} onChange={(event) => updateDesignerDraft("rarity", event.target.value)}>
                        {productRarities.map((rarityKey) => <option key={rarityKey} value={rarityKey}>{rarityKey}</option>)}
                      </select>
                    </label>
                    <label>
                      <strong>Precio</strong>
                      <input type="number" min="0" max="100000" step="1" value={designerDraft.priceUnits} onChange={(event) => updateDesignerDraft("priceUnits", event.target.value)} />
                    </label>
                  </div>
                  <div className="admin-inline-fields">
                    <label>
                      <strong>Preview corto</strong>
                      <input value={designerDraft.preview} onChange={(event) => updateDesignerDraft("preview", event.target.value.slice(0, 16))} />
                    </label>
                    <label>
                      <strong>Estado</strong>
                      <select value={designerDraft.active ? "1" : "0"} onChange={(event) => updateDesignerDraft("active", event.target.value === "1")}>
                        <option value="1">Activo</option>
                        <option value="0">Inactivo</option>
                      </select>
                    </label>
                  </div>
                </div>

                {designerDraft.category === "DICE" && (
                  <div className="admin-piece-section">
                    <span className="admin-section-kicker">Paint de dados</span>
                    <div className="admin-paint-grid">
                      <label><strong>Base</strong><input type="color" value={designerDraft.baseColor} onChange={(event) => updateDesignerDraft("baseColor", event.target.value)} /></label>
                      <label><strong>Puntos</strong><input type="color" value={designerDraft.pipColor} onChange={(event) => updateDesignerDraft("pipColor", event.target.value)} /></label>
                      <label><strong>Acento</strong><input type="color" value={designerDraft.accentColor} onChange={(event) => updateDesignerDraft("accentColor", event.target.value)} /></label>
                      <label><strong>Borde</strong><input type="color" value={designerDraft.edgeColor} onChange={(event) => updateDesignerDraft("edgeColor", event.target.value)} /></label>
                    </div>
                    <div className="admin-inline-fields">
                      <label>
                        <strong>Patron</strong>
                        <select value={designerDraft.pattern} onChange={(event) => updateDesignerDraft("pattern", event.target.value)}>
                          {dicePatternOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </select>
                      </label>
                      <label>
                        <strong>Puntos</strong>
                        <select value={designerDraft.pipShape} onChange={(event) => updateDesignerDraft("pipShape", event.target.value)}>
                          {pipShapeOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="admin-paint-grid is-sliders">
                      <label><strong>Rugosidad {Number(designerDraft.roughness).toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={designerDraft.roughness} onChange={(event) => updateDesignerDraft("roughness", event.target.value)} /></label>
                      <label><strong>Metal {Number(designerDraft.metalness).toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={designerDraft.metalness} onChange={(event) => updateDesignerDraft("metalness", event.target.value)} /></label>
                      <label><strong>Opacidad {Number(designerDraft.opacity).toFixed(2)}</strong><input type="range" min="0.25" max="1" step="0.01" value={designerDraft.opacity} onChange={(event) => updateDesignerDraft("opacity", event.target.value)} /></label>
                      <label><strong>Pip scale {Number(designerDraft.pipScale).toFixed(2)}</strong><input type="range" min="0.45" max="1.9" step="0.01" value={designerDraft.pipScale} onChange={(event) => updateDesignerDraft("pipScale", event.target.value)} /></label>
                      <label><strong>Contraste {Number(designerDraft.faceContrast).toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={designerDraft.faceContrast} onChange={(event) => updateDesignerDraft("faceContrast", event.target.value)} /></label>
                    </div>
                  </div>
                )}

                {designerDraft.category === "DICE_FX" && (
                  <div className="admin-piece-section">
                    <span className="admin-section-kicker">Editor de FX</span>
                    <label>
                      <strong>Tipo de efecto</strong>
                      <select value={designerDraft.effect} onChange={(event) => updateDesignerDraft("effect", event.target.value)}>
                        {diceFxEffectOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                      </select>
                    </label>
                    <div className="admin-paint-grid">
                      <label><strong>Color A</strong><input type="color" value={designerDraft.color} onChange={(event) => updateDesignerDraft("color", event.target.value)} /></label>
                      <label><strong>Color B</strong><input type="color" value={designerDraft.secondaryColor} onChange={(event) => updateDesignerDraft("secondaryColor", event.target.value)} /></label>
                    </div>
                    <div className="admin-paint-grid is-sliders">
                      <label><strong>Intensidad {Number(designerDraft.intensity).toFixed(2)}</strong><input type="range" min="0.1" max="3" step="0.01" value={designerDraft.intensity} onChange={(event) => updateDesignerDraft("intensity", event.target.value)} /></label>
                      <label><strong>Velocidad {Number(designerDraft.speed).toFixed(2)}</strong><input type="range" min="0.1" max="4" step="0.01" value={designerDraft.speed} onChange={(event) => updateDesignerDraft("speed", event.target.value)} /></label>
                      <label><strong>Dispersion {Number(designerDraft.spread).toFixed(2)}</strong><input type="range" min="0.1" max="3.5" step="0.01" value={designerDraft.spread} onChange={(event) => updateDesignerDraft("spread", event.target.value)} /></label>
                      <label><strong>Tamano particula {Number(designerDraft.particleSize).toFixed(2)}</strong><input type="range" min="0.35" max="3" step="0.01" value={designerDraft.particleSize} onChange={(event) => updateDesignerDraft("particleSize", event.target.value)} /></label>
                      <label><strong>Anillos {Number(designerDraft.ringScale).toFixed(2)}</strong><input type="range" min="0.2" max="3.5" step="0.01" value={designerDraft.ringScale} onChange={(event) => updateDesignerDraft("ringScale", event.target.value)} /></label>
                      <label><strong>Jitter beam {Number(designerDraft.beamJitter).toFixed(2)}</strong><input type="range" min="0" max="3" step="0.01" value={designerDraft.beamJitter} onChange={(event) => updateDesignerDraft("beamJitter", event.target.value)} /></label>
                      <label><strong>Gravedad {Number(designerDraft.gravity).toFixed(2)}</strong><input type="range" min="0" max="2" step="0.01" value={designerDraft.gravity} onChange={(event) => updateDesignerDraft("gravity", event.target.value)} /></label>
                      <label><strong>Sparkle {Number(designerDraft.sparkle).toFixed(2)}</strong><input type="range" min="0" max="1.8" step="0.01" value={designerDraft.sparkle} onChange={(event) => updateDesignerDraft("sparkle", event.target.value)} /></label>
                      <label><strong>Densidad {Number(designerDraft.density).toFixed(2)}</strong><input type="range" min="0.15" max="1" step="0.01" value={designerDraft.density} onChange={(event) => updateDesignerDraft("density", event.target.value)} /></label>
                    </div>
                  </div>
                )}

                {designerDraft.category === "BOARD_THEME" && (
                  <div className="admin-piece-section">
                    <span className="admin-section-kicker">Pintura de tablero</span>
                    <p className="admin-section-hint">
                      Dibuja el diseno del tablero como si fuera Paint. Lo que pintes aqui es exactamente lo que se vera
                      como fondo y centro del tablero en la partida real (sin elementos 3D extra que no existen en el juego).
                    </p>
                    <BoardThemePainter
                      key={designerDraftMode === "edit" ? (selectedDesignerProduct?.id || "edit") : "new"}
                      value={designerDraft.boardTexture}
                      onChange={(dataUrl) => updateDesignerDraft("boardTexture", dataUrl)}
                      disabled={busy}
                    />
                    <div className="admin-paint-grid">
                      <label><strong>Acento (aro central)</strong><input type="color" value={designerDraft.accentColor} onChange={(event) => updateDesignerDraft("accentColor", event.target.value)} /></label>
                    </div>
                    <div className="admin-paint-grid is-sliders">
                      <label><strong>Rugosidad {Number(designerDraft.roughness).toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={designerDraft.roughness} onChange={(event) => updateDesignerDraft("roughness", event.target.value)} /></label>
                      <label><strong>Metal {Number(designerDraft.metalness).toFixed(2)}</strong><input type="range" min="0" max="1" step="0.01" value={designerDraft.metalness} onChange={(event) => updateDesignerDraft("metalness", event.target.value)} /></label>
                      <label><strong>Glow del aro {Number(designerDraft.glow).toFixed(2)}</strong><input type="range" min="0" max="1.8" step="0.01" value={designerDraft.glow} onChange={(event) => updateDesignerDraft("glow", event.target.value)} /></label>
                    </div>
                  </div>
                )}

                <div className="admin-piece-section">
                  <label>
                    <strong>Motivo</strong>
                    <input value={designerDraft.reason} onChange={(event) => updateDesignerDraft("reason", event.target.value)} placeholder="Nuevo FX, ajuste de textura, balance visual..." />
                  </label>
                  <div className="admin-form-actions">
                    <button type="submit" disabled={busy || !designerDraft.name}>
                      <CheckCircle2 size={16} /> Guardar preset
                    </button>
                    <button type="button" className="is-danger" onClick={deactivateDesignerProduct} disabled={busy || designerDraftMode !== "edit" || !selectedDesignerProduct?.active}>
                      <Trash2 size={16} /> Desactivar
                    </button>
                  </div>
                </div>
              </form>

              <aside className="admin-designer-preview">
                <EyconProductPreview3D product={designerPreviewProduct} />
                <div className="admin-list">
                  <span><strong>{designerPreviewProduct.name}</strong><small>{designerPreviewProduct.category} - {designerPreviewProduct.rarity}</small></span>
                  <span>
                    <strong>Render</strong>
                    <small>
                      {designerDraft.category === "DICE_FX"
                        ? designerDraft.effect
                        : designerDraft.category === "BOARD_THEME"
                          ? (designerDraft.boardTexture ? "Pintado a mano" : "Sin pintura (colores base)")
                          : designerDraft.pattern}
                    </small>
                  </span>
                  <span><strong>Metadata</strong><small>{Object.keys(designerPreviewProduct.metadata || {}).length} controles activos</small></span>
                </div>
              </aside>
            </div>
          </section>
        </section>
      )}

      {activeTab === "reports" && (
        <section className="admin-panel is-wide admin-reports-panel">
          <header><Bug size={17} /> Bugs y sugerencias <button type="button" onClick={loadReports} disabled={busy}><RefreshCw size={14} /> Actualizar</button></header>
          <div className="admin-reports-layout">
            <aside className="admin-report-list">
              {reports.map((report) => (
                <button type="button" key={report.id} className={selectedReport?.id === report.id ? "is-active" : ""} onClick={() => setSelectedReportId(report.id)}>
                  <span><strong>{report.reportType === "BUG" ? "Bug" : "Sugerencia"} · {report.title}</strong><small>{report.username} · {formatDate(report.createdAt)}</small></span>
                  <em className={`report-status is-${report.status.toLowerCase()}`}>{report.status}</em>
                </button>
              ))}
              {!reports.length && <p>No hay reportes todavía.</p>}
            </aside>
            {selectedReport && (
              <article className="admin-report-detail">
                <div className="admin-report-heading"><span><small>#{selectedReport.id.slice(0, 8)}</small><h3>{selectedReport.title}</h3><p>{selectedReport.description}</p></span></div>
                {selectedReport.hasScreenshot && (
                  <div className="admin-report-screenshot">
                    {reportScreenshotUrl ? <img src={reportScreenshotUrl} alt={`Captura de ${selectedReport.title}`} /> : <span><Camera size={24} /> Cargando captura...</span>}
                  </div>
                )}
                <div className="admin-report-context">
                  <span><strong>Vista</strong><small>{selectedReport.context?.view || "—"}</small></span>
                  <span><strong>Ruta</strong><small>{selectedReport.context?.path || "—"}</small></span>
                  <span><strong>Sala</strong><small>{selectedReport.context?.worldName || "—"}</small></span>
                  <span><strong>Viewport</strong><small>{selectedReport.context?.viewport || "—"}</small></span>
                  <span className="is-wide"><strong>Navegador</strong><small>{selectedReport.context?.userAgent || "—"}</small></span>
                  {!!selectedReport.context?.clientErrors?.length && <span className="is-wide"><strong>Errores recientes</strong><small>{selectedReport.context.clientErrors.join(" | ")}</small></span>}
                </div>
                <form className="admin-form-stack" onSubmit={updateReport}>
                  <label><strong>Estado</strong><select value={reportDraft.status} onChange={(event) => setReportDraft((current) => ({ ...current, status: event.target.value }))}><option value="OPEN">Abierto</option><option value="IN_REVIEW">En revisión</option><option value="RESOLVED">Resuelto</option><option value="DISMISSED">Descartado</option></select></label>
                  <label><strong>Notas internas</strong><textarea rows="4" maxLength="2000" value={reportDraft.adminNotes} onChange={(event) => setReportDraft((current) => ({ ...current, adminNotes: event.target.value }))} placeholder="Diagnóstico, responsable, solución..." /></label>
                  <button type="submit" disabled={busy}><CheckCircle2 size={15} /> Guardar seguimiento</button>
                </form>
              </article>
            )}
          </div>
        </section>
      )}

      {activeTab === "stats" && (
        <section className="admin-grid">
          <article className="admin-metric"><span>Logins OK</span><strong>{metric(stats.successfulLogins)}</strong><small>Historico</small></article>
          <article className="admin-metric"><span>Logins fallidos</span><strong>{metric(stats.failedLogins)}</strong><small>Historico</small></article>
          <article className="admin-metric"><span>Activos 7 dias</span><strong>{metric(stats.recentlyActiveUsers)}</strong><small>Por ultimo login</small></article>
          <section className="admin-panel">
            <header><Activity size={17} /> Visitas por dia</header>
            <div className="admin-list">{(stats.visitsByDay || []).map((row) => <span key={row.day}><strong>{row.day}</strong><small>{row.visits} visitas</small></span>)}</div>
          </section>
          <section className="admin-panel is-wide">
            <header><Lock size={17} /> Logins recientes</header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>Usuario</th><th>Estado</th><th>IP</th><th>Motivo</th><th>Fecha</th></tr></thead>
                <tbody>
                  {(stats.recentLogins || []).map((row, index) => (
                    <tr key={`${row.createdAt}-${index}`}><td>{row.username}</td><td>{row.success ? "OK" : "Fallo"}</td><td>{row.ip}</td><td>{row.reason}</td><td>{formatDate(row.createdAt)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      )}

      {activeTab === "chat" && (
        <section className="admin-panel">
          <header><MessageSquare size={17} /> Historico global del chat</header>
          <form className="admin-chat-filters" onSubmit={loadChat}>
            <input value={chatFilters.q} onChange={(event) => setChatFilters((current) => ({ ...current, q: event.target.value }))} placeholder="Buscar texto o usuario" />
            <input value={chatFilters.userId} onChange={(event) => setChatFilters((current) => ({ ...current, userId: event.target.value }))} placeholder="User ID" />
            <select value={chatFilters.worldId} onChange={(event) => setChatFilters((current) => ({ ...current, worldId: event.target.value }))}>
              <option value="">Todos los mundos</option>
              {worlds.map((world) => <option key={world.id} value={world.id}>{world.name}</option>)}
            </select>
            <input type="date" value={chatFilters.from} onChange={(event) => setChatFilters((current) => ({ ...current, from: event.target.value }))} />
            <input type="date" value={chatFilters.to} onChange={(event) => setChatFilters((current) => ({ ...current, to: event.target.value }))} />
            <button type="submit"><Search size={15} /> Buscar</button>
          </form>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Mundo</th><th>Usuario</th><th>Mensaje</th><th>Fecha</th></tr></thead>
              <tbody>
                {chatMessages.map((message) => (
                  <tr key={message.id}>
                    <td>{message.worldName || message.worldId}</td>
                    <td>{message.username}</td>
                    <td>{message.text}</td>
                    <td>{formatDate(message.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {activeTab === "logs" && (
        <section className="admin-panel">
          <header><Shield size={17} /> Auditoria administrativa</header>
          <div className="admin-table-wrap">
            <table>
              <thead><tr><th>Accion</th><th>Admin</th><th>Objetivo</th><th>Motivo</th><th>Fecha</th></tr></thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>{log.action}</td>
                    <td>{log.adminUsername || "Sistema"}</td>
                    <td>{log.targetUsername || log.targetId}</td>
                    <td>{log.reason}</td>
                    <td>{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
