import {
  Activity,
  ArrowLeft,
  Boxes,
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
import EyconProductPreview3D from "./EyconProductPreview3D";

const tabs = [
  { key: "overview", label: "Resumen", icon: Activity },
  { key: "users", label: "Usuarios", icon: Users },
  { key: "currency", label: "Monedas", icon: Coins },
  { key: "store", label: "Tienda 3D", icon: Boxes },
  { key: "stats", label: "Estadisticas", icon: Activity },
  { key: "chat", label: "Chat", icon: MessageSquare },
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
  return roles.includes("admin") ? "admin" : "user";
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
  const firstAsset = allowedAssets[0] || {};
  const assetKey = setting?.assetKey || metadata.assetKey || firstAsset.assetKey || "";
  const asset = allowedAssets.find((item) => item.assetKey === assetKey) || firstAsset;
  const colorMode = setting?.colorMode || metadata.colorMode || DEFAULT_MODEL_COLOR_MODE;
  const tintColor = setting?.tintColor || metadata.tintColor || metadata.color || previewColorPresets[0].bg;
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
    tintColor,
    colorMode,
    previewStatus: setting?.previewStatus || metadata.previewStatus || "READY",
    active: setting?.active ?? true,
    reason: ""
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
        tintColor: draft.tintColor || undefined,
        colorMode: draft.colorMode || DEFAULT_MODEL_COLOR_MODE,
        forceColor: draft.colorMode === "FORCE",
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
  const [selectedModelProductId, setSelectedModelProductId] = useState("");
  const [modelDraft, setModelDraft] = useState(() => draftFromModelProduct(null));
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
        || payload.store?.products?.find((product) => product.gameKey === "MONOPOLY" && product.category === "TOKEN");
      setSelectedModelProductId((current) => current || String(firstModelProduct?.id || ""));
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
  const model3d = store.model3d || {};
  const model3dProducts = model3d.products || (store.products || []).filter(
    (product) => product.gameKey === "MONOPOLY" && product.category === "TOKEN"
  );
  const allowedModelAssets = model3d.allowedAssets || [];
  const fallbackModels = model3d.fallbackModels || [];
  const previewStatuses = model3d.previewStatuses || ["DRAFT", "READY", "NEEDS_REVIEW", "BROKEN"];
  const seedWriteEnabled = Boolean(model3d.seedWriteEnabled);
  const modelDefaultTint = model3d.defaultTintStrength ?? DEFAULT_MODEL_TINT_STRENGTH;
  const selectedUser = useMemo(
    () => users.find((user) => String(user.id) === String(selectedUserId)) || users[0] || null,
    [selectedUserId, users]
  );
  const selectedModelProduct = useMemo(
    () => model3dProducts.find((product) => product.id === selectedModelProductId) || model3dProducts[0] || null,
    [model3dProducts, selectedModelProductId]
  );
  const modelPreviewProduct = useMemo(
    () => productWithModelDraft(selectedModelProduct, modelDraft),
    [selectedModelProduct, modelDraft]
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
    if (!selectedModelProduct) return;
    setModelDraft(draftFromModelProduct(selectedModelProduct, allowedModelAssets));
  }, [selectedModelProduct?.id, selectedModelProduct?.model3dSetting?.updatedAt, allowedModelAssets.length]);

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

  function patchStoreModel3d(payload) {
    setData((current) => {
      if (!current?.store) return current;
      const nextProducts = (current.store.products || []).map((product) =>
        payload.product && product.id === payload.product.id ? payload.product : product
      );
      const glbTokenCount = nextProducts.filter(
        (product) => product.gameKey === "MONOPOLY"
          && product.category === "TOKEN"
          && product.metadata?.renderer === "gltf"
      ).length;
      return {
        ...current,
        store: {
          ...current.store,
          products: nextProducts,
          model3d: payload.model3d || current.store.model3d,
          summary: {
            ...(current.store.summary || {}),
            glbTokenCount,
            model3dSettingCount: payload.model3d?.settings?.length ?? current.store.summary?.model3dSettingCount
          }
        }
      };
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

  async function uploadModelAsset(event) {
    event.preventDefault();
    if (!uploadDraft.file) {
      setError("Selecciona un archivo .glb");
      return;
    }
    setBusy(true);
    try {
      const fileBase64 = await fileToBase64(uploadDraft.file);
      const payload = await api("/api/admin/model-3d-assets", {
        method: "POST",
        token,
        body: {
          fileName: uploadDraft.file.name,
          label: uploadDraft.label || uploadDraft.file.name.replace(/\.glb$/i, ""),
          fileBase64,
          fallbackModel: uploadDraft.fallbackModel,
          fitSize: Number(uploadDraft.fitSize),
          reason: uploadDraft.reason
        }
      });
      setData((current) => current ? {
        ...current,
        store: {
          ...(current.store || {}),
          model3d: payload.model3d || current.store?.model3d,
          summary: {
            ...(current.store?.summary || {}),
            allowedAssetCount: payload.model3d?.allowedAssets?.length ?? current.store?.summary?.allowedAssetCount
          }
        }
      } : current);
      setModelDraft((current) => ({
        ...current,
        assetKey: payload.asset?.assetKey || current.assetKey,
        assetUrl: payload.asset?.assetUrl || current.assetUrl,
        fallbackModel: payload.asset?.fallbackModel || current.fallbackModel,
        fitSize: payload.asset?.fitSize ?? current.fitSize
      }));
      setUploadDraft({ file: null, label: "", fallbackModel: "hat", fitSize: 1.9, reason: "" });
      setNotice(payload.seedWritten
        ? "Modelo GLB cargado y seed Git actualizado."
        : "Modelo GLB cargado en la DB local. Activa MODEL_3D_WRITE_SEED=1 para escribir el seed Git.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo cargar modelo GLB");
    } finally {
      setBusy(false);
    }
  }

  async function saveModel3d(event) {
    event.preventDefault();
    if (!selectedModelProduct) return;
    setBusy(true);
    try {
      const payload = await api(`/api/admin/model-3d-settings/${selectedModelProduct.id}`, {
        method: "PUT",
        token,
        body: {
          reason: modelDraft.reason,
          settings: {
            assetKey: modelDraft.assetKey,
            fallbackModel: modelDraft.fallbackModel,
            fitSize: Number(modelDraft.fitSize),
            rotation: vectorFrom(modelDraft.rotation),
            offset: vectorFrom(modelDraft.offset),
            colorLocked: modelDraft.colorLocked,
            tintable: modelDraft.tintable,
            tintStrength: Number(modelDraft.tintStrength),
            tintColor: modelDraft.tintColor,
            colorMode: modelDraft.colorMode,
            previewStatus: modelDraft.previewStatus,
            active: modelDraft.active
          }
        }
      });
      patchStoreModel3d(payload);
      setModelDraft((current) => ({ ...current, reason: "" }));
      setNotice(payload.seedWritten
        ? "Modelo 3D guardado y seed Git actualizado."
        : "Modelo 3D guardado en la DB. Activa MODEL_3D_WRITE_SEED=1 para llevarlo por Git.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo guardar modelo 3D");
    } finally {
      setBusy(false);
    }
  }

  async function deleteModel3d() {
    if (!selectedModelProduct) return;
    setBusy(true);
    try {
      const payload = await api(`/api/admin/model-3d-settings/${selectedModelProduct.id}`, {
        method: "DELETE",
        token,
        body: { reason: modelDraft.reason }
      });
      patchStoreModel3d(payload);
      setModelDraft((current) => ({ ...current, active: false, reason: "" }));
      setNotice(payload.seedWritten
        ? "Ajuste 3D desactivado y seed Git actualizado."
        : "Ajuste 3D desactivado en la DB. Activa MODEL_3D_WRITE_SEED=1 para llevarlo por Git.");
      setError("");
    } catch (nextError) {
      setError(nextError.message || "No se pudo desactivar modelo 3D");
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
        <div>
          <span className="admin-eyebrow"><Shield size={15} /> Panel protegido</span>
          <h1>Administracion</h1>
          <p>Control de usuarios, monedas, tienda, estadisticas y auditoria.</p>
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
          <article className="admin-metric"><span>Piezas Monopoly</span><strong>{metric(store.summary?.monopolyTokenCount)}</strong><small>{metric(store.summary?.glbTokenCount)} GLB</small></article>
          <article className="admin-metric"><span>Ajustes 3D</span><strong>{metric(store.summary?.model3dSettingCount)}</strong><small>{metric(store.summary?.allowedAssetCount)} assets permitidos</small></article>
          <section className="admin-panel">
            <header><Boxes size={17} /> Estado actual</header>
            <div className="admin-list">{(store.modelArchitecture?.currentState || []).map((item) => <span key={item}>{item}</span>)}</div>
          </section>
          <section className="admin-panel">
            <header><Shield size={17} /> CRUD 3D implementado</header>
            <div className="admin-list">{(store.modelArchitecture?.recommendation || []).map((item) => <span key={item}>{item}</span>)}</div>
          </section>
          <section className="admin-panel is-wide">
            <header><Boxes size={17} /> Editor de modelos 3D</header>
            <div className="admin-model-brief">
              <span>
                <strong>Localhost</strong>
                <small>Guardar edita SQLite local. Para generar archivo Git usa MODEL_3D_WRITE_SEED=1.</small>
              </span>
              <span>
                <strong>Seed Git</strong>
                <small>{model3d.seedPath || "backend/model-3d-seed.json"} {seedWriteEnabled ? "se actualiza al guardar." : "esta en solo lectura."}</small>
              </span>
              <span>
                <strong>Default color</strong>
                <small>Modo TINTE al {formatPercent(modelDefaultTint)} para guardados existentes y nuevos.</small>
              </span>
            </div>
            {selectedModelProduct ? (
              <div className="admin-model-workbench">
                <form className="admin-model-upload" onSubmit={uploadModelAsset}>
                  <div>
                    <strong><Upload size={15} /> Cargar GLB nuevo</strong>
                    <small>Se guarda en backend y aparece como asset aprobado.</small>
                  </div>
                  <input type="file" accept=".glb,model/gltf-binary" onChange={(event) => setUploadDraft((current) => ({ ...current, file: event.target.files?.[0] || null }))} />
                  <input value={uploadDraft.label} onChange={(event) => setUploadDraft((current) => ({ ...current, label: event.target.value }))} placeholder="Nombre visible del modelo" />
                  <div className="admin-inline-fields">
                    <select value={uploadDraft.fallbackModel} onChange={(event) => setUploadDraft((current) => ({ ...current, fallbackModel: event.target.value }))}>
                      {fallbackModels.map((model) => <option key={model} value={model}>{model}</option>)}
                    </select>
                    <input type="number" min="0.1" max="5" step="0.01" value={uploadDraft.fitSize} onChange={(event) => setUploadDraft((current) => ({ ...current, fitSize: event.target.value }))} />
                  </div>
                  <input value={uploadDraft.reason} onChange={(event) => setUploadDraft((current) => ({ ...current, reason: event.target.value }))} placeholder="Motivo obligatorio de carga" />
                  <button type="submit" disabled={busy || !uploadDraft.file}><Upload size={16} /> Subir asset</button>
                </form>

                <div className="admin-model-editor">
                  <form className="admin-form-stack admin-model-settings-form" onSubmit={saveModel3d}>
                    <div className="admin-model-section">
                      <span className="admin-section-kicker">Producto y asset</span>
                    <label>
                      <strong>1. Producto a personalizar</strong>
                      <small>Selecciona la pieza EyCon que recibira este modelo.</small>
                      <select value={selectedModelProduct.id} onChange={(event) => setSelectedModelProductId(event.target.value)}>
                        {model3dProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} - {product.rarity} - {product.model3dSetting?.active === false ? "3D inactivo" : product.metadata?.renderer === "gltf" ? "GLB" : "Primitivo"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <strong>2. Modelo GLB aprobado</strong>
                      <small>Debe existir en assets aprobados. Si subes uno nuevo en local, committea tambien el .glb.</small>
                      <select
                        value={modelDraft.assetKey}
                        onChange={(event) => {
                          const asset = allowedModelAssets.find((item) => item.assetKey === event.target.value);
                          setModelDraft((current) => ({
                            ...current,
                            assetKey: event.target.value,
                            assetUrl: asset?.assetUrl || null,
                            fallbackModel: asset?.fallbackModel || current.fallbackModel,
                            fitSize: asset?.fitSize ?? current.fitSize
                          }));
                        }}
                      >
                        {allowedModelAssets.map((asset) => (
                          <option key={asset.assetKey} value={asset.assetKey}>{asset.label} - {asset.source}</option>
                        ))}
                      </select>
                    </label>
                    </div>

                    <div className="admin-color-mode admin-model-section">
                      <strong><Palette size={15} /> 3. Modo de color</strong>
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
                      <label className="admin-tint-color-control">
                        <strong>Color guardado del tinte</strong>
                        <small>Este color si se guarda y se usa en tienda/juego. No es el color de prueba.</small>
                        <input type="color" value={modelDraft.tintColor || previewColorPresets[0].bg} onChange={(event) => updateModelDraft("tintColor", event.target.value)} disabled={modelDraft.colorMode === "ORIGINAL"} />
                      </label>
                    </div>

                    <div className="admin-model-section">
                      <span className="admin-section-kicker">Render y publicacion</span>
                    <div className="admin-inline-fields">
                      <label>
                        <strong>Fallback</strong>
                        <small>Modelo simple si el GLB falla.</small>
                        <select value={modelDraft.fallbackModel} onChange={(event) => updateModelDraft("fallbackModel", event.target.value)}>
                          {fallbackModels.map((model) => <option key={model} value={model}>{model}</option>)}
                        </select>
                      </label>
                      <label>
                        <strong>Estado preview</strong>
                        <small>Control interno para QA visual.</small>
                        <select value={modelDraft.previewStatus} onChange={(event) => updateModelDraft("previewStatus", event.target.value)}>
                          {previewStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                        </select>
                      </label>
                    </div>
                    <div className="admin-inline-fields">
                      <label>
                        <strong>Escala</strong>
                        <small>Tamano relativo en tablero y previews.</small>
                        <input type="number" min="0.1" max="5" step="0.01" value={modelDraft.fitSize} onChange={(event) => updateModelDraft("fitSize", event.target.value)} />
                      </label>
                      <label>
                        <strong>Fuerza de tinte: {formatPercent(modelDraft.tintStrength)}</strong>
                        <small>Default recomendado {formatPercent(DEFAULT_MODEL_TINT_STRENGTH)}.</small>
                        <input type="range" min="0" max="1" step="0.01" value={modelDraft.tintStrength} onChange={(event) => updateModelDraft("tintStrength", event.target.value)} disabled={modelDraft.colorMode !== "TINT"} />
                      </label>
                    </div>
                    </div>
                    <div className="admin-model-section">
                      <span className="admin-section-kicker">Ajuste fino</span>
                    <div className="admin-vector-pair">
                      <div className="admin-vector-group">
                        <strong>Rotacion XYZ</strong>
                        {[0, 1, 2].map((index) => (
                          <input key={`rotation-${index}`} type="number" step="0.01" value={modelDraft.rotation[index]} onChange={(event) => updateModelVector("rotation", index, event.target.value)} />
                        ))}
                      </div>
                      <div className="admin-vector-group">
                        <strong>Offset XYZ</strong>
                        {[0, 1, 2].map((index) => (
                          <input key={`offset-${index}`} type="number" step="0.01" value={modelDraft.offset[index]} onChange={(event) => updateModelVector("offset", index, event.target.value)} />
                        ))}
                      </div>
                    </div>
                    </div>
                    <div className="admin-model-section">
                    <label className="admin-check"><input type="checkbox" checked={modelDraft.active} onChange={(event) => updateModelDraft("active", event.target.checked)} /> Publicar ajuste 3D</label>
                    <label>
                      <strong>Motivo</strong>
                      <small>Obligatorio para auditoria.</small>
                      <input value={modelDraft.reason} onChange={(event) => updateModelDraft("reason", event.target.value)} placeholder="Cambio visual, prueba de escala, baja temporal..." />
                    </label>
                    <div className="admin-form-actions">
                      <button type="submit" disabled={busy || !modelDraft.assetKey}><CheckCircle2 size={16} /> Guardar 3D</button>
                      <button type="button" className="is-danger" onClick={deleteModel3d} disabled={busy}><Trash2 size={16} /> Desactivar</button>
                    </div>
                    </div>
                  </form>

                  <div className="admin-model-preview">
                    <div className="admin-preview-tools">
                      <strong><Palette size={15} /> Color de jugador simulado</strong>
                      <small>Solo afecta esta vista previa. El color final del tinte es el campo guardado.</small>
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
                    <EyconProductPreview3D product={modelPreviewProduct} tokenColor={previewTokenColor} />
                    <div className="admin-list">
                      <span><strong>{selectedModelProduct.name}</strong><small>{modelDraft.assetKey || "Sin asset"} - {modelDraft.colorMode || "ORIGINAL"} - {modelDraft.previewStatus} - {modelDraft.tintColor || "sin color"}</small></span>
                      <span><strong>Archivo</strong><small>{allowedModelAssets.find((asset) => asset.assetKey === modelDraft.assetKey)?.filePath || "No seleccionado"}</small></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="admin-list"><em>No hay piezas Monopoly disponibles para configurar.</em></div>
            )}
          </section>
          <section className="admin-panel is-wide">
            <header><Gem size={17} /> Catalogo EyCon</header>
            <div className="admin-table-wrap">
              <table>
                <thead><tr><th>ID</th><th>Juego</th><th>Tipo</th><th>Rareza</th><th>Precio</th><th>Estado</th><th>Renderer</th><th>Asset</th></tr></thead>
                <tbody>
                  {(store.products || []).map((product) => (
                    <tr key={product.id}>
                      <td>{product.id}</td>
                      <td>{product.gameKey}</td>
                      <td>{product.category}</td>
                      <td>{product.rarity}</td>
                      <td>{formatEycon(product.priceUnits)}</td>
                      <td>{product.active ? "Activo" : "Inactivo"}</td>
                      <td>{product.metadata?.renderer || "material"}</td>
                      <td>{product.model3dSetting?.assetKey || product.metadata?.assetKey || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
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
