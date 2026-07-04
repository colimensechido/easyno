import {
  ArrowLeft,
  Boxes,
  Check,
  ChevronRight,
  Coins,
  Gamepad2,
  PackageCheck,
  Search,
  Settings,
  Shield,
  ShoppingBag,
  Sparkles,
  WalletCards,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { BOLOWPOLY_DISPLAY_NAME, BOLOWPOLY_TAGLINE } from "../content/bolowpolyBrand";
import EyconProductPreview3D from "./EyconProductPreview3D";
import BrandLogo from "./shared/BrandLogo";
import { monopolyTokenColors } from "./monopoly3d/monopolyTokenColors";

const BOLOWPOLY_GAME_KEY = "MONOPOLY";
const BOLOWPOLY_STORE_DESCRIPTION = `${BOLOWPOLY_TAGLINE}. Piezas, dados, efectos y tableros para personalizar cada partida.`;

function normalizeStoreGame(game) {
  if (!game || game.key !== BOLOWPOLY_GAME_KEY) return game;
  return {
    ...game,
    name: BOLOWPOLY_DISPLAY_NAME,
    description: BOLOWPOLY_STORE_DESCRIPTION
  };
}

const rarities = [
  { key: "ALL", label: "Todas" },
  { key: "COMMON", label: "Común" },
  { key: "RARE", label: "Rara" },
  { key: "EPIC", label: "Épica" },
  { key: "LEGENDARY", label: "Legendaria" }
];

const primaryCategories = [
  { key: "ALL", label: "Todo" },
  { key: "TOKEN", label: "Piezas" },
  { key: "DICE", label: "Dados" },
  { key: "DICE_FX", label: "FX de dados" },
  { key: "BOARD_THEME", label: "Tableros" }
];

const categoryLabels = {
  TOKEN: "Piezas",
  DICE: "Dados",
  DICE_FX: "FX de dados",
  BOARD_THEME: "Tableros",
  TOKEN_ANIMAL: "Animales",
  TOKEN_VEHICLE: "Vehículos",
  TOKEN_OBJECT: "Objetos",
  TOKEN_FANTASY: "Fantasía",
  TOKEN_FOOD: "Comida",
  TOKEN_COLLECTIBLE: "Colección",
  TOKEN_PREMIUM: "Especiales"
};

const ownershipOptions = [
  { key: "ALL", label: "Todos" },
  { key: "OWNED", label: "Comprados" },
  { key: "AVAILABLE", label: "No comprados" },
  { key: "EQUIPPED", label: "Equipados" },
  { key: "LOCKED", label: "Bloqueados" }
];

const sortOptions = [
  { key: "FEATURED", label: "Recomendados" },
  { key: "NEWEST", label: "Más recientes" },
  { key: "PRICE_ASC", label: "Precio: menor" },
  { key: "PRICE_DESC", label: "Precio: mayor" },
  { key: "RARITY", label: "Rareza" },
  { key: "NAME", label: "Nombre" }
];

const rarityRank = {
  COMMON: 1,
  RARE: 2,
  EPIC: 3,
  LEGENDARY: 4
};

function formatEycon(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
}

function isTokenCosmetic(product) {
  return product?.slotKey === "TOKEN" || product?.category === "TOKEN" || String(product?.category || "").startsWith("TOKEN_");
}

function primaryCategoryFor(product) {
  if (isTokenCosmetic(product)) return "TOKEN";
  return product?.slotKey || product?.category || "ALL";
}

function categoryLabelFor(product) {
  return categoryLabels[product?.category] || categoryLabels[primaryCategoryFor(product)] || product?.category || "Cosmético";
}

function isProductLocked(product) {
  return Boolean(product?.locked || product?.metadata?.locked || product?.active === false);
}

function productStatus(product, balanceUnits = 0) {
  if (isProductLocked(product)) return { key: "LOCKED", label: "Bloqueado" };
  if (product?.equipped) return { key: "EQUIPPED", label: "En uso" };
  if (product?.owned) return { key: "OWNED", label: "Adquirido" };
  if (Number(balanceUnits || 0) < Number(product?.priceUnits || 0)) return { key: "INSUFFICIENT", label: "Sin saldo" };
  return { key: "AVAILABLE", label: "Comprar" };
}

function isTokenColorLocked(product) {
  const metadata = product?.metadata || {};
  const colorMode = String(metadata.colorMode || "").toUpperCase();
  if (
    colorMode === "TINT" ||
    colorMode === "FORCE" ||
    metadata.tintable === true ||
    metadata.forceColor === true ||
    metadata.tintMode === "multiply" ||
    metadata.tintMode === "replace"
  ) return false;
  if (colorMode === "ORIGINAL") return true;
  return Boolean(metadata.colorLocked);
}

export default function EyconStore({ token, onProfileChange, isAdmin = false, onRecharge }) {
  const [data, setData] = useState({
    products: [],
    inventory: [],
    equipment: {},
    balanceUnits: 0,
    game: null
  });
  const [games, setGames] = useState([]);
  const [selectedGameKey, setSelectedGameKey] = useState("");
  const [category, setCategory] = useState("ALL");
  const [rarity, setRarity] = useState("ALL");
  const [ownership, setOwnership] = useState("ALL");
  const [sortBy, setSortBy] = useState("FEATURED");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [previewTokenColor, setPreviewTokenColor] = useState(monopolyTokenColors[0]);
  const [monopolyToken, setMonopolyToken] = useState(null);
  const [colorBusy, setColorBusy] = useState(false);
  const [purchaseCandidate, setPurchaseCandidate] = useState(null);
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminData, setAdminData] = useState({ users: [], movements: [], products: [] });
  const [adminUserId, setAdminUserId] = useState("");
  const [adminAmount, setAdminAmount] = useState("100");

  async function loadGames() {
    setLoading(true);
    try {
      const payload = await api("/api/eycon/games", { token });
      setGames((payload.games || []).map(normalizeStoreGame));
      setData((current) => ({
        ...current,
        balanceUnits: payload.balanceUnits || 0,
        balance: payload.balance || 0,
        inventory: payload.inventory || [],
        equipment: payload.equipment || {}
      }));
      onProfileChange?.(payload);
      const tokenPayload = await api("/api/monopoly/token", { token }).catch(() => null);
      if (tokenPayload?.token) {
        setMonopolyToken(tokenPayload.token);
        const activeColor = monopolyTokenColors.find(
          (color) => color.bg.toLowerCase() === String(tokenPayload.token.bg || "").toLowerCase()
        );
        if (activeColor) setPreviewTokenColor(activeColor);
      }
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar la tienda");
    } finally {
      setLoading(false);
    }
  }

  async function loadCatalog(gameKey = selectedGameKey, { resetFilters = true } = {}) {
    if (!gameKey) return;
    setLoading(true);
    try {
      const payload = await api(`/api/eycon/catalog?gameKey=${encodeURIComponent(gameKey)}`, { token });
      setData({ ...payload, game: normalizeStoreGame(payload.game) });
      setSelectedGameKey(gameKey);
      setSelectedId((current) => (
        !resetFilters && payload.products?.some((product) => product.id === current)
          ? current
          : payload.products?.[0]?.id || ""
      ));
      if (resetFilters) {
        setCategory("ALL");
        setRarity("ALL");
        setOwnership("ALL");
        setQuery("");
      }
      onProfileChange?.(payload);
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar el catálogo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGames();
  }, [token]);

  useEffect(() => {
    if (!purchaseCandidate) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !busyId) setPurchaseCandidate(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [busyId, purchaseCandidate]);

  const selectedGame = data.game || games.find((game) => game.key === selectedGameKey) || null;
  const categories = useMemo(() => primaryCategories.filter((item) => (
    item.key === "ALL" || (data.products || []).some((product) => primaryCategoryFor(product) === item.key)
  )), [data.products]);
  const filteredProducts = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase("es");
      const products = (data.products || []).map((product, index) => ({ product, index })).filter(({ product }) => {
        const status = productStatus(product, data.balanceUnits);
        const searchable = `${product.name} ${product.description} ${categoryLabelFor(product)} ${product.rarity}`.toLocaleLowerCase("es");
        return (
          (category === "ALL" || primaryCategoryFor(product) === category) &&
          (rarity === "ALL" || product.rarity === rarity) &&
          (ownership === "ALL" ||
            (ownership === "OWNED" && product.owned) ||
            (ownership === "AVAILABLE" && !product.owned && !isProductLocked(product)) ||
            (ownership === "EQUIPPED" && product.equipped) ||
            (ownership === "LOCKED" && isProductLocked(product))) &&
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (ownership !== "LOCKED" || status.key === "LOCKED")
        );
      });
      return [...products].sort((leftEntry, rightEntry) => {
        const left = leftEntry.product;
        const right = rightEntry.product;
        if (sortBy === "PRICE_ASC") return left.priceUnits - right.priceUnits;
        if (sortBy === "PRICE_DESC") return right.priceUnits - left.priceUnits;
        if (sortBy === "RARITY") return (rarityRank[right.rarity] || 0) - (rarityRank[left.rarity] || 0) || left.name.localeCompare(right.name, "es");
        if (sortBy === "NEWEST") return rightEntry.index - leftEntry.index;
        if (sortBy === "NAME") return left.name.localeCompare(right.name, "es");
        if (left.equipped !== right.equipped) return left.equipped ? -1 : 1;
        if (left.owned !== right.owned) return left.owned ? -1 : 1;
        return (rarityRank[right.rarity] || 0) - (rarityRank[left.rarity] || 0) || right.priceUnits - left.priceUnits;
      }).map(({ product }) => product);
    },
    [category, data.balanceUnits, data.products, ownership, query, rarity, sortBy]
  );
  const selected = filteredProducts.find((product) => product.id === selectedId) || filteredProducts[0] || null;
  const categoryLabel = selected ? categoryLabelFor(selected) : "";
  const selectedTokenColorLocked = isTokenColorLocked(selected);
  const selectedStatus = selected ? productStatus(selected, data.balanceUnits) : null;
  const selectedIsToken = isTokenCosmetic(selected);
  const collectionCount = (data.products || []).filter((product) => product.owned).length;
  const collectionTotal = (data.products || []).length;
  const categoryCounts = useMemo(() => (
    (data.products || []).reduce((counts, product) => {
      counts.ALL = (counts.ALL || 0) + 1;
      const primaryCategory = primaryCategoryFor(product);
      counts[primaryCategory] = (counts[primaryCategory] || 0) + 1;
      return counts;
    }, {})
  ), [data.products]);

  async function purchase(product) {
    if (!product || busyId) return;
    setBusyId(product.id);
    setError("");
    setNotice("");
    try {
      await api("/api/eycon/purchase", {
        method: "POST",
        token,
        body: { productId: product.id }
      });
      setNotice(`${product.name} se agregó a tu inventario.`);
      setPurchaseCandidate(null);
      await loadCatalog(product.gameKey, { resetFilters: false });
    } catch (nextError) {
      setError(nextError.message || "No se pudo comprar");
    } finally {
      setBusyId("");
    }
  }

  async function equip(product) {
    if (!product || busyId) return;
    setBusyId(product.id);
    setError("");
    setNotice("");
    try {
      const profile = await api("/api/eycon/equip", {
        method: "POST",
        token,
        body: { productId: product.id }
      });
      setNotice(`${product.name} quedó equipado en ${selectedGame?.name || "el minijuego"}.`);
      onProfileChange?.(profile);
      await loadCatalog(product.gameKey, { resetFilters: false });
    } catch (nextError) {
      setError(nextError.message || "No se pudo equipar");
    } finally {
      setBusyId("");
    }
  }

  async function savePreviewTokenColor() {
    if (colorBusy) return;
    setColorBusy(true);
    setError("");
    try {
      const payload = await api("/api/monopoly/token", {
        method: "PUT",
        token,
        body: {
          token: {
            ...(monopolyToken || {}),
            bg: previewTokenColor.bg,
            ring: previewTokenColor.ring
          }
        }
      });
      setMonopolyToken(payload.token);
      setNotice(`Tu color de ficha ahora es ${previewTokenColor.name}.`);
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar el color de tu ficha");
    } finally {
      setColorBusy(false);
    }
  }

  async function loadAdmin() {
    try {
      const payload = await api("/api/admin/eycon", { token });
      setAdminData(payload);
      setAdminUserId((current) => current || String(payload.users?.[0]?.id || ""));
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar administración");
    }
  }

  async function toggleAdmin() {
    const next = !adminOpen;
    setAdminOpen(next);
    if (next) await loadAdmin();
  }

  async function adjustEycon() {
    try {
      await api("/api/admin/eycon/adjust", {
        method: "POST",
        token,
        body: {
          userId: Number(adminUserId),
          amountUnits: Number(adminAmount),
          description: "Ajuste desde panel administrativo",
          requestId: globalThis.crypto?.randomUUID?.() || `${Date.now()}`
        }
      });
      setNotice("Ajuste administrativo registrado.");
      await loadAdmin();
      if (selectedGameKey) {
        await loadCatalog(selectedGameKey, { resetFilters: false });
      } else {
        await loadGames();
      }
    } catch (nextError) {
      setError(nextError.message || "No se pudo ajustar EyCon");
    }
  }

  function returnToGames() {
    setSelectedGameKey("");
    setSelectedId("");
    setCategory("ALL");
    setRarity("ALL");
    setOwnership("ALL");
    setSortBy("FEATURED");
    setQuery("");
    setPurchaseCandidate(null);
    setData((current) => ({ ...current, products: [], game: null }));
    setNotice("");
    setError("");
  }

  return (
    <section className="eycon-store">
      <header className="eycon-store-hero">
        <div className="eycon-store-hero-copy">
          <BrandLogo size="lg" className="eycon-store-logo" alt="EasyNo" />
          <div>
            <span className="eycon-store-eyebrow"><Sparkles size={15} /> Cosméticos de plataforma</span>
            <h2>Tienda EyCon</h2>
            <p>
              {selectedGame
                ? `Explora los personalizables disponibles para ${selectedGame.name}.`
                : "¿De qué juego quieres comprar personalizables?"}
            </p>
          </div>
        </div>
        <div className="eycon-store-stats">
          <div className="eycon-balance-stack">
            <div className="eycon-balance-card">
              <span><Coins size={18} /> Tu saldo</span>
              <strong>{formatEycon(data.balanceUnits)}</strong>
            </div>
            {typeof onRecharge === "function" && (
              <button type="button" className="eycon-recharge-button" onClick={onRecharge} title="Comprar EyCon con Mercado Pago">
                <WalletCards size={16} />
                Recargar
              </button>
            )}
          </div>
          <div className="eycon-balance-card">
            <span><PackageCheck size={18} /> Colección</span>
            <strong>{collectionCount}/{collectionTotal || 0}</strong>
          </div>
          {selectedGame && (
            <button type="button" className="eycon-game-switch" onClick={returnToGames} style={{ "--game-accent": selectedGame.accent }}>
              <i>{selectedGame.icon}</i>
              <span>{selectedGame.name}</span>
              <ChevronRight size={14} />
            </button>
          )}
          {isAdmin && (
            <button className={`eycon-admin-toggle ${adminOpen ? "is-active" : ""}`} onClick={toggleAdmin}>
              <Shield size={14} /> Admin
            </button>
          )}
        </div>
      </header>

      {error && <div className="eycon-store-message is-error">{error}</div>}
      {notice && <div className="eycon-store-message is-success">{notice}</div>}

      {!selectedGameKey ? (
        <section className="eycon-game-picker" aria-label="Seleccionar minijuego">
          <header>
            <span><Gamepad2 size={18} /> Elige un minijuego</span>
            <small>Tu saldo e inventario EyCon son globales; cada cosmético pertenece a un juego.</small>
          </header>
          <div className="eycon-game-grid">
            {games.map((game) => (
              <button
                type="button"
                key={game.key}
                className={`eycon-game-card ${game.available ? "is-available" : "is-upcoming"}`}
                style={{ "--game-accent": game.accent }}
                disabled={!game.available || loading}
                onClick={() => loadCatalog(game.key)}
              >
                <span className="eycon-game-icon">{game.icon}</span>
                <span className="eycon-game-copy">
                  <small>{game.available ? `${game.productCount} productos` : "Próximamente"}</small>
                  <strong>{game.name}</strong>
                  <p>{game.description}</p>
                  <em>{game.available ? "Entrar al catálogo" : "Catálogo en preparación"}</em>
                </span>
              </button>
            ))}
          </div>
          {!loading && games.length === 0 && (
            <div className="eycon-empty-state">No hay minijuegos configurados en la tienda.</div>
          )}
        </section>
      ) : (
        <>
          {loading ? (
            <div className="eycon-empty-state">Cargando catálogo...</div>
          ) : (
            <>
              <nav className="eycon-category-rail" aria-label="Categorías de tienda">
                {categories.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={category === item.key ? "is-active" : ""}
                    onClick={() => {
                      setCategory(item.key);
                      setSelectedId("");
                    }}
                  >
                    <span>{item.label}</span>
                    <small>{categoryCounts[item.key] || 0}</small>
                  </button>
                ))}
              </nav>

              <div className="eycon-catalog-tools">
                <label className="eycon-search-field">
                  <Search size={15} />
                  <input
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setSelectedId("");
                    }}
                    placeholder="Buscar por nombre o categoría..."
                  />
                  {query && <button type="button" onClick={() => setQuery("")}><X size={13} /></button>}
                </label>
                <select
                  value={rarity}
                  onChange={(event) => {
                    setRarity(event.target.value);
                    setSelectedId("");
                  }}
                  aria-label="Filtrar por rareza"
                >
                  {rarities.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
                <select
                  value={ownership}
                  onChange={(event) => {
                    setOwnership(event.target.value);
                    setSelectedId("");
                  }}
                  aria-label="Filtrar por estado"
                >
                  {ownershipOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar productos">
                  {sortOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                </select>
              </div>

              <div className="eycon-market-layout">
                <section className="eycon-catalog-browser">
                  <header className="eycon-results-heading">
                    <span>
                      <strong>{categories.find((item) => item.key === category)?.label || "Catálogo"}</strong>
                      <small>{filteredProducts.length} de {data.products?.length || 0} cosméticos</small>
                    </span>
                    <em>Selecciona para previsualizar</em>
                  </header>

                  <div className="eycon-products-grid">
                    {filteredProducts.map((product) => {
                      const status = productStatus(product, data.balanceUnits);
                      return (
                        <button
                          type="button"
                          key={product.id}
                          className={`eycon-product-card rarity-${String(product.rarity || "common").toLowerCase()} status-${status.key.toLowerCase()} ${selected?.id === product.id ? "is-selected" : ""}`}
                          onClick={() => setSelectedId(product.id)}
                        >
                          <span className="eycon-product-preview" style={{ color: product.metadata?.color || product.metadata?.pipColor || product.metadata?.accentColor }}>
                            {product.preview || "✦"}
                          </span>
                          <span className="eycon-product-copy">
                            <small>{categoryLabelFor(product)}</small>
                            <strong>{product.name}</strong>
                            <em>{product.rarity} · {formatEycon(product.priceUnits)}</em>
                          </span>
                          <span className={`eycon-product-state is-${status.key.toLowerCase()}`}>
                            {status.key === "EQUIPPED" ? <Check size={12} /> : status.key === "OWNED" ? <PackageCheck size={12} /> : <ShoppingBag size={12} />}
                            {status.label}
                          </span>
                        </button>
                      );
                    })}
                    {filteredProducts.length === 0 && (
                      <div className="eycon-empty-state">
                        No encontramos productos con esos filtros. Prueba otra categoría o búsqueda.
                      </div>
                    )}
                  </div>
                </section>

                <section className="eycon-preview-panel">
                  {selected ? (
                    <EyconProductPreview3D
                      product={selected}
                      tokenColor={selectedIsToken && !selectedTokenColorLocked ? previewTokenColor : null}
                    />
                  ) : (
                    <div className="eycon-detail-empty">
                      <Boxes size={30} />
                      <p>Selecciona un personalizable para inspeccionarlo.</p>
                    </div>
                  )}
                </section>

                <aside className="eycon-product-detail">
                {selected ? (
                  <>
                    <span className="eycon-detail-category">
                      <Gamepad2 size={14} /> {selectedGame?.name} · {categoryLabel}
                    </span>
                    <div className="eycon-detail-title">
                      <span>
                        <small>{selected.rarity}</small>
                        <h3>{selected.name}</h3>
                      </span>
                      {selectedStatus && <em className={`status-${selectedStatus.key.toLowerCase()}`}>{selectedStatus.label}</em>}
                    </div>
                    <p>{selected.description}</p>
                    {selected.category === "BOARD_THEME" && (
                      <div className="eycon-host-note">
                        <Shield size={14} />
                        <span><strong>Diseño del anfitrión</strong><small>Este tablero se muestra para todos únicamente cuando tú eres host de la mesa.</small></span>
                      </div>
                    )}
                    {selectedIsToken && !selectedTokenColorLocked && (
                      <div className="eycon-token-color-preview">
                        <header>
                          <span>Color principal</span>
                          <small>Actual: {previewTokenColor.name}</small>
                        </header>
                        <div>
                          {monopolyTokenColors.map((color) => (
                            <button
                              type="button"
                              key={color.bg}
                              className={previewTokenColor.bg === color.bg ? "is-active" : ""}
                              style={{ "--preview-color": color.bg, "--preview-ring": color.ring }}
                              onClick={() => setPreviewTokenColor(color)}
                              title={color.name}
                              aria-label={`Previsualizar pieza en color ${color.name}`}
                            />
                          ))}
                        </div>
                        <small>Esta sección sólo controla el color de tu ficha. Comprar/equipar está separado abajo.</small>
                        <button
                          type="button"
                          className="eycon-save-token-color"
                          disabled={colorBusy || monopolyToken?.bg?.toLowerCase() === previewTokenColor.bg.toLowerCase()}
                          onClick={savePreviewTokenColor}
                        >
                          {colorBusy
                            ? "Guardando..."
                            : monopolyToken?.bg?.toLowerCase() === previewTokenColor.bg.toLowerCase()
                              ? "Este es tu color activo"
                              : `Usar ${previewTokenColor.name} como mi color`}
                        </button>
                      </div>
                    )}
                    <div className="eycon-detail-meta">
                      <span><small>Precio</small><strong>{formatEycon(selected.priceUnits)}</strong></span>
                      <span><small>Tu saldo</small><strong>{formatEycon(data.balanceUnits)}</strong></span>
                      {!selected.owned && !isProductLocked(selected) && data.balanceUnits >= selected.priceUnits && (
                        <span><small>Después de compra</small><strong>{formatEycon(data.balanceUnits - selected.priceUnits)}</strong></span>
                      )}
                    </div>
                    {isProductLocked(selected) ? (
                      <button className="eycon-store-primary is-locked" disabled>Bloqueado</button>
                    ) : selected.equipped ? (
                      <button className="eycon-store-primary is-equipped" disabled><Check size={17} /> Ya está equipado</button>
                    ) : selected.owned ? (
                      <button className="eycon-store-primary" disabled={Boolean(busyId)} onClick={() => equip(selected)}>
                        <PackageCheck size={17} /> {busyId === selected.id ? "Equipando..." : selected.category === "BOARD_THEME" ? "Usar cuando sea host" : "Equipar ahora"}
                      </button>
                    ) : (
                      <>
                        <button
                          className="eycon-store-primary"
                          disabled={Boolean(busyId) || data.balanceUnits < selected.priceUnits}
                          onClick={() => setPurchaseCandidate(selected)}
                        >
                          <ShoppingBag size={17} />
                          {data.balanceUnits < selected.priceUnits ? "Saldo insuficiente" : "Revisar compra"}
                        </button>
                        <small className="eycon-purchase-note">
                          {data.balanceUnits >= selected.priceUnits
                            ? `Después de comprar tendrás ${formatEycon(data.balanceUnits - selected.priceUnits)}.`
                            : `Te faltan ${formatEycon(selected.priceUnits - data.balanceUnits)}.`}
                        </small>
                      </>
                    )}
                  </>
                ) : (
                  <div className="eycon-detail-empty">
                    <Boxes size={30} />
                    <p>Selecciona un personalizable para inspeccionarlo.</p>
                  </div>
                )}
                </aside>
              </div>
            </>
          )}
        </>
      )}

      {purchaseCandidate && (
        <div className="eycon-purchase-overlay" role="presentation" onMouseDown={() => !busyId && setPurchaseCandidate(null)}>
          <section className="eycon-purchase-dialog" role="dialog" aria-modal="true" aria-labelledby="eycon-purchase-title" onMouseDown={(event) => event.stopPropagation()}>
            <button className="eycon-purchase-close" type="button" disabled={Boolean(busyId)} onClick={() => setPurchaseCandidate(null)}>
              <X size={17} />
            </button>
            <div className="eycon-purchase-preview">
              <EyconProductPreview3D
                product={purchaseCandidate}
                tokenColor={isTokenCosmetic(purchaseCandidate) && !isTokenColorLocked(purchaseCandidate) ? previewTokenColor : null}
              />
            </div>
            <div className="eycon-purchase-copy">
              <small>Confirmar compra</small>
              <h3 id="eycon-purchase-title">{purchaseCandidate.name}</h3>
              <p>Se agregará permanentemente a tu colección de {selectedGame?.name}.</p>
            </div>
            <div className="eycon-purchase-balance">
              <span><small>Saldo actual</small><strong>{formatEycon(data.balanceUnits)}</strong></span>
              <ChevronRight size={18} />
              <span><small>Saldo final</small><strong>{formatEycon(data.balanceUnits - purchaseCandidate.priceUnits)}</strong></span>
            </div>
            <div className="eycon-purchase-actions">
              <button type="button" disabled={Boolean(busyId)} onClick={() => setPurchaseCandidate(null)}>Cancelar</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => purchase(purchaseCandidate)}>
                <WalletCards size={16} />
                {busyId === purchaseCandidate.id ? "Procesando..." : `Pagar ${formatEycon(purchaseCandidate.priceUnits)}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {isAdmin && adminOpen && (
        <section className="eycon-admin-panel">
          <header>
            <span><Settings size={17} /> Administración EyCon</span>
            <small>Los ajustes quedan registrados en el historial.</small>
          </header>
          <div className="eycon-admin-grid">
            <div className="eycon-admin-card">
              <h3>Ajustar saldo</h3>
              <select value={adminUserId} onChange={(event) => setAdminUserId(event.target.value)}>
                {adminData.users.map((user) => (
                  <option key={user.id} value={user.id}>{user.username} · {formatEycon(user.balanceUnits)}</option>
                ))}
              </select>
              <input type="number" step="1" value={adminAmount} onChange={(event) => setAdminAmount(event.target.value)} />
              <small>Usa unidades internas: 100 = 1 EyCon; admite valores negativos.</small>
              <button onClick={adjustEycon}>Registrar ajuste</button>
            </div>
            <div className="eycon-admin-card is-wide">
              <h3>Movimientos recientes</h3>
              <div className="eycon-admin-movements">
                {adminData.movements.slice(0, 24).map((movement) => (
                  <article key={movement.id}>
                    <span><strong>{movement.username}</strong><small>{movement.movementType}</small></span>
                    <em className={movement.amountUnits > 0 ? "is-positive" : "is-negative"}>
                      {movement.amountUnits > 0 ? "+" : ""}{formatEycon(movement.amountUnits)}
                    </em>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </section>
  );
}
