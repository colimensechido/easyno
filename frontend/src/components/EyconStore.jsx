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
import EyconProductPreview3D from "./EyconProductPreview3D";
import { monopolyTokenColors } from "./monopoly3d/monopolyTokenColors";

const rarities = [
  { key: "ALL", label: "Todas" },
  { key: "COMMON", label: "Común" },
  { key: "RARE", label: "Rara" },
  { key: "EPIC", label: "Épica" },
  { key: "LEGENDARY", label: "Legendaria" }
];

function formatEycon(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
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

export default function EyconStore({ token, onProfileChange, isAdmin = false }) {
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
      setGames(payload.games || []);
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
      setData(payload);
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
  const categories = useMemo(() => {
    const configured = selectedGame?.categories || [];
    const knownKeys = new Set(configured.map((item) => item.key));
    const extra = (data.products || [])
      .filter((product) => !knownKeys.has(product.category))
      .map((product) => ({ key: product.category, label: product.category }));
    return [{ key: "ALL", label: "Todo" }, ...configured, ...extra];
  }, [data.products, selectedGame]);
  const filteredProducts = useMemo(
    () => {
      const normalizedQuery = query.trim().toLocaleLowerCase("es");
      const products = (data.products || []).filter((product) => (
        (category === "ALL" || product.category === category) &&
        (rarity === "ALL" || product.rarity === rarity) &&
        (ownership === "ALL" || (ownership === "OWNED" ? product.owned : !product.owned)) &&
        (!normalizedQuery || `${product.name} ${product.description}`.toLocaleLowerCase("es").includes(normalizedQuery))
      ));
      return [...products].sort((left, right) => {
        if (sortBy === "PRICE_ASC") return left.priceUnits - right.priceUnits;
        if (sortBy === "PRICE_DESC") return right.priceUnits - left.priceUnits;
        if (sortBy === "NAME") return left.name.localeCompare(right.name, "es");
        if (left.equipped !== right.equipped) return left.equipped ? -1 : 1;
        if (left.owned !== right.owned) return left.owned ? -1 : 1;
        return right.priceUnits - left.priceUnits;
      });
    },
    [category, data.products, ownership, query, rarity, sortBy]
  );
  const selected = filteredProducts.find((product) => product.id === selectedId) || filteredProducts[0] || null;
  const categoryLabel = categories.find((item) => item.key === selected?.category)?.label || selected?.category;
  const selectedTokenColorLocked = isTokenColorLocked(selected);
  const categoryCounts = useMemo(() => (
    (data.products || []).reduce((counts, product) => {
      counts.ALL = (counts.ALL || 0) + 1;
      counts[product.category] = (counts[product.category] || 0) + 1;
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
        <div>
          <span className="eycon-store-eyebrow"><Sparkles size={15} /> Cosméticos de plataforma</span>
          <h2>Tienda EyCon</h2>
          <p>
            {selectedGame
              ? `Explora los personalizables disponibles para ${selectedGame.name}.`
              : "¿De qué juego quieres comprar personalizables?"}
          </p>
        </div>
        <div className="eycon-balance-card">
          <span><Coins size={18} /> Tu saldo</span>
          <strong>{formatEycon(data.balanceUnits)}</strong>
          {isAdmin && (
            <button className={adminOpen ? "is-active" : ""} onClick={toggleAdmin}>
              <Shield size={14} /> Administrar
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
          <div className="eycon-game-heading">
            <button type="button" onClick={returnToGames}><ArrowLeft size={16} /> Cambiar juego</button>
            <span style={{ "--game-accent": selectedGame?.accent }}>
              <i>{selectedGame?.icon}</i>
              <strong>{selectedGame?.name}</strong>
              <small>{data.products?.length || 0} personalizables disponibles</small>
            </span>
          </div>

          {loading ? (
            <div className="eycon-empty-state">Cargando catálogo...</div>
          ) : (
            <div className="eycon-market-layout">
              <aside className="eycon-category-rail">
                <header><Boxes size={16} /> Categorías</header>
                <nav>
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
                      <ChevronRight size={13} />
                    </button>
                  ))}
                </nav>
                <div className="eycon-inventory-summary">
                  <PackageCheck size={17} />
                  <span>
                    <strong>{(data.products || []).filter((product) => product.owned).length}</strong>
                    <small>En tu colección</small>
                  </span>
                </div>
              </aside>

              <section className="eycon-catalog-browser">
                <div className="eycon-catalog-tools">
                  <label className="eycon-search-field">
                    <Search size={15} />
                    <input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value);
                        setSelectedId("");
                      }}
                      placeholder="Buscar personalizable..."
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
                  <select value={ownership} onChange={(event) => setOwnership(event.target.value)} aria-label="Filtrar por propiedad">
                    <option value="ALL">Todos</option>
                    <option value="AVAILABLE">Por comprar</option>
                    <option value="OWNED">Mi colección</option>
                  </select>
                  <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Ordenar productos">
                    <option value="FEATURED">Destacados</option>
                    <option value="PRICE_ASC">Precio: menor</option>
                    <option value="PRICE_DESC">Precio: mayor</option>
                    <option value="NAME">Nombre</option>
                  </select>
                </div>

                <header className="eycon-results-heading">
                  <span>
                    <strong>{categories.find((item) => item.key === category)?.label || "Catálogo"}</strong>
                    <small>{filteredProducts.length} resultados</small>
                  </span>
                  <em>Selecciona uno para verlo en 3D</em>
                </header>

                <div className="eycon-products-grid">
                  {filteredProducts.map((product) => (
                    <button
                      type="button"
                      key={product.id}
                      className={`eycon-product-card rarity-${product.rarity.toLowerCase()} ${selected?.id === product.id ? "is-selected" : ""}`}
                      onClick={() => setSelectedId(product.id)}
                    >
                      <span className="eycon-product-preview" style={{ color: product.metadata?.color || product.metadata?.pipColor || product.metadata?.accentColor }}>
                        {product.preview || "✦"}
                      </span>
                      <span className="eycon-product-copy">
                        <small>{categories.find((item) => item.key === product.category)?.label || product.category} · {product.rarity}</small>
                        <strong>{product.name}</strong>
                        <em>{formatEycon(product.priceUnits)}</em>
                      </span>
                      <span className={`eycon-product-state ${product.equipped ? "is-equipped" : product.owned ? "is-owned" : ""}`}>
                        {product.equipped ? <><Check size={12} /> Equipado</> : product.owned ? <><PackageCheck size={12} /> Comprado</> : <><ShoppingBag size={12} /> Disponible</>}
                      </span>
                    </button>
                  ))}
                  {filteredProducts.length === 0 && (
                    <div className="eycon-empty-state">
                      No encontramos productos con esos filtros. Prueba otra categoría o búsqueda.
                    </div>
                  )}
                </div>
              </section>

              <aside className="eycon-product-detail">
                {selected ? (
                  <>
                    <EyconProductPreview3D
                      product={selected}
                      tokenColor={selected.category === "TOKEN" && !selectedTokenColorLocked ? previewTokenColor : null}
                    />
                    <span className="eycon-detail-category">
                      <Gamepad2 size={14} /> {selectedGame?.name} · {categoryLabel}
                    </span>
                    <div className="eycon-detail-title">
                      <span>
                        <small>{selected.rarity}</small>
                        <h3>{selected.name}</h3>
                      </span>
                      {selected.equipped && <em><Check size={12} /> En uso</em>}
                    </div>
                    {selected.category === "TOKEN" && !selectedTokenColorLocked && (
                      <div className="eycon-token-color-preview">
                        <header>
                          <span>Probar color de Monopoly</span>
                          <small>{previewTokenColor.name}</small>
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
                        <small>La pieza usa tu color activo; puedes cambiarlo también desde Monopoly.</small>
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
                    <p>{selected.description}</p>
                    {selected.category === "BOARD_THEME" && (
                      <div className="eycon-host-note">
                        <Shield size={14} />
                        <span><strong>Diseño del anfitrión</strong><small>Este tablero se muestra para todos únicamente cuando tú eres host de la mesa.</small></span>
                      </div>
                    )}
                    <div className="eycon-detail-meta">
                      <span><small>Precio</small><strong>{formatEycon(selected.priceUnits)}</strong></span>
                      <span><small>Tu saldo</small><strong>{formatEycon(data.balanceUnits)}</strong></span>
                    </div>
                    {selected.equipped ? (
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
                tokenColor={purchaseCandidate.category === "TOKEN" && !isTokenColorLocked(purchaseCandidate) ? previewTokenColor : null}
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
