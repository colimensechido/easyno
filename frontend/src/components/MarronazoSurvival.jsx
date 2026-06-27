import {
  Backpack,
  Bone,
  Crosshair,
  Droplets,
  Gauge,
  HeartPulse,
  Keyboard,
  Loader2,
  Map as MapIcon,
  MousePointer2,
  Package,
  RotateCcw,
  Skull,
  Trees,
  Utensils,
  X,
  Zap
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SurvivalScene from "./survival/SurvivalScene";

const BINDINGS_KEY = "marronazo-keybindings-v2";
const DEFAULT_BINDINGS = Object.freeze({
  moveUp: "KeyW",
  moveDown: "KeyS",
  moveLeft: "KeyA",
  moveRight: "KeyD",
  fire: "Mouse0",
  dash: "ShiftLeft",
  rotateLeft: "KeyQ",
  rotateRight: "KeyE",
  interact: "KeyF",
  inventory: "KeyI",
  reload: "KeyR"
});

const ACTIONS = [
  ["moveUp", "Mover arriba"],
  ["moveDown", "Mover abajo"],
  ["moveLeft", "Mover izquierda"],
  ["moveRight", "Mover derecha"],
  ["fire", "Disparar"],
  ["dash", "Sprint / Dash"],
  ["rotateLeft", "Rotar cámara izquierda"],
  ["rotateRight", "Rotar cámara derecha"],
  ["interact", "Interactuar"],
  ["inventory", "Inventario"],
  ["reload", "Recargar"]
];

const ITEM_META = {
  ammo_pistol: { name: "Munición pistola", icon: "P", tone: "ammo" },
  ammo_shotgun: { name: "Cartuchos", icon: "E", tone: "ammo" },
  ammo_rifle: { name: "Munición rifle", icon: "R", tone: "ammo" },
  medkit: { name: "Botiquín", icon: "+", tone: "medical" },
  weapon_shotgun: { name: "Escopeta", icon: "SG", tone: "weapon" },
  weapon_rifle: { name: "Rifle", icon: "AR", tone: "weapon" },
  weapon_sniper: { name: "Francotirador", icon: "SR", tone: "weapon" },
  wood: { name: "Madera", icon: "M", tone: "material" },
  metal: { name: "Metal", icon: "Fe", tone: "material" }
};

const WEAPON_NAMES = {
  pistol: "Pistola",
  shotgun: "Escopeta",
  rifle: "Rifle",
  sniper: "Francotirador"
};

const BIOME_LABELS = {
  forest: "Bosque",
  city: "Ciudad destruida",
  field: "Campo abierto"
};

function loadBindings() {
  try {
    return { ...DEFAULT_BINDINGS, ...JSON.parse(localStorage.getItem(BINDINGS_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_BINDINGS };
  }
}

function saveBindings(bindings) {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch {
    // El juego sigue funcionando aunque el navegador bloquee localStorage.
  }
}

function keyLabel(code) {
  if (!code) return "Sin asignar";
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Mouse")) return `Mouse ${Number(code.slice(5)) + 1}`;
  const labels = {
    ShiftLeft: "Shift izq.",
    ShiftRight: "Shift der.",
    Space: "Espacio",
    Tab: "Tab",
    Escape: "Esc",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→"
  };
  return labels[code] || code.replace(/Left|Right/, "");
}

function emitAck(socket, event, payload) {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      resolve({ ok: false, error: "Socket desconectado" });
      return;
    }
    socket.emit(event, payload, (response) => resolve(response || { ok: false }));
  });
}

function Bar({ value, tone, icon: Icon, label }) {
  return (
    <div className={`survival-vital is-${tone}`}>
      <span><Icon size={13} /> {label}</span>
      <div><i style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} /></div>
      <b>{Math.ceil(value || 0)}</b>
    </div>
  );
}

function MiniMap({ state, chunks, currentUserId }) {
  const half = state?.map?.halfSize || 100;
  const toPercent = (value) => `${((value + half) / (half * 2)) * 100}%`;
  return (
    <div className="survival-open-minimap">
      <div className="survival-open-minimap-biomes">
        {chunks.map((chunk) => {
          const counts = { forest: 0, city: 0, field: 0 };
          chunk.tiles.forEach((tile) => { counts[tile.biome] += 1; });
          const biome = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "field";
          return (
            <i
              key={chunk.key}
              className={`is-${biome}`}
              style={{
                left: toPercent(chunk.chunkX * state.map.chunkSize - half),
                top: toPercent(chunk.chunkZ * state.map.chunkSize - half),
                width: `${(state.map.chunkSize / state.map.size) * 100}%`,
                height: `${(state.map.chunkSize / state.map.size) * 100}%`
              }}
            />
          );
        })}
      </div>
      {(state?.zombies || []).filter((zombie) => !zombie.sleeping).map((zombie) => (
        <i
          key={zombie.id}
          className="is-zombie"
          style={{ left: toPercent(zombie.x), top: toPercent(zombie.z) }}
        />
      ))}
      {(state?.loot || []).map((item) => (
        <i
          key={item.id}
          className="is-loot"
          style={{ left: toPercent(item.x), top: toPercent(item.z) }}
        />
      ))}
      {(state?.players || []).filter((player) => player.alive).map((player) => (
        <i
          key={player.id}
          className={String(player.id) === String(currentUserId) ? "is-player is-local" : "is-player"}
          style={{ left: toPercent(player.x), top: toPercent(player.z) }}
        />
      ))}
      <span><MapIcon size={11} /> {state.map.size}×{state.map.size}</span>
    </div>
  );
}

function InventoryPanel({ player, busySlot, error, onUse, onClose }) {
  return (
    <div className="survival-modal-backdrop">
      <section className="survival-inventory">
        <header>
          <span><Backpack size={19} /><strong>Inventario</strong></span>
          <small>Haz clic en un arma para equiparla o en un botiquín para usarlo.</small>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="survival-inventory-grid">
          {Array.from({ length: 24 }).map((_, slot) => {
            const item = player?.inventory?.[slot];
            const meta = item ? ITEM_META[item.itemId] : null;
            return (
              <button
                key={slot}
                type="button"
                className={meta ? `has-item is-${meta.tone}` : ""}
                disabled={!item || busySlot === slot}
                onClick={() => onUse(slot)}
                title={meta?.name || `Slot ${slot + 1}`}
              >
                {busySlot === slot ? (
                  <Loader2 className="animate-spin" size={17} />
                ) : meta ? (
                  <>
                    <i>{meta.icon}</i>
                    <span>{meta.name}</span>
                    {item.quantity > 1 && <b>{item.quantity}</b>}
                  </>
                ) : (
                  <small>{slot + 1}</small>
                )}
              </button>
            );
          })}
        </div>
        <footer>
          <span><Package size={14} /> 4 × 6 slots</span>
          {error && <strong>{error}</strong>}
        </footer>
      </section>
    </div>
  );
}

function BindingsPanel({ bindings, listening, onListen, onReset, onClose }) {
  return (
    <div className="survival-modal-backdrop">
      <section className="survival-bindings">
        <header>
          <span><Keyboard size={19} /><strong>Controles</strong></span>
          <small>Selecciona una acción y pulsa una tecla o botón del ratón.</small>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </header>
        <div>
          {ACTIONS.map(([action, label]) => (
            <button
              key={action}
              type="button"
              className={listening === action ? "is-listening" : ""}
              onClick={() => onListen(action)}
            >
              <span>{label}</span>
              <kbd>{listening === action ? "Pulsa una tecla…" : keyLabel(bindings[action])}</kbd>
            </button>
          ))}
        </div>
        <footer>
          <span>Escape o K abre este menú.</span>
          <button type="button" onClick={onReset}><RotateCcw size={14} /> Restablecer</button>
        </footer>
      </section>
    </div>
  );
}

export default function MarronazoSurvival({
  socket,
  currentUser,
  world,
  connectionStatus
}) {
  const [state, setState] = useState(null);
  const [chunksByKey, setChunksByKey] = useState(() => new Map());
  const [bindings, setBindings] = useState(loadBindings);
  const [bindingsOpen, setBindingsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [listening, setListening] = useState("");
  const [busySlot, setBusySlot] = useState(-1);
  const [error, setError] = useState("");
  const [cameraQuarter, setCameraQuarter] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [spectating, setSpectating] = useState(false);
  const stateRef = useRef(null);
  const keysDownRef = useRef(new Set());
  const mouseDownRef = useRef(new Set());
  const aimRef = useRef({ x: 0, z: 0 });
  const dashPulseRef = useRef(false);
  const reloadPulseRef = useRef(false);
  const requestedChunksRef = useRef(new Set());

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const handleState = (nextState) => {
      if (nextState?.worldId !== world.id) return;
      setState(nextState);
      setError("");
    };
    const join = () => {
      socket.emit("join_survival", { worldId: world.id }, (response) => {
        if (!response?.ok) {
          setError(response?.error || "No se pudo entrar al mundo");
          return;
        }
        setState(response.state);
        setSpectating(Boolean(response.spectating));
      });
    };
    socket.on("survival_state", handleState);
    if (socket.connected) join();
    socket.on("connect", join);
    return () => {
      socket.off("survival_state", handleState);
      socket.off("connect", join);
      socket.emit("leave_survival", { worldId: world.id });
    };
  }, [socket, world.id]);

  const me = useMemo(
    () => state?.players?.find((player) => String(player.id) === String(currentUser.id)) || null,
    [currentUser.id, state?.players]
  );
  const chunks = useMemo(() => [...chunksByKey.values()], [chunksByKey]);

  useEffect(() => {
    if (!state?.map || !me || !socket?.connected) return;
    const centerX = Math.floor((me.x + state.map.halfSize) / state.map.chunkSize);
    const centerZ = Math.floor((me.z + state.map.halfSize) / state.map.chunkSize);
    const maxChunk = Math.ceil(state.map.size / state.map.chunkSize) - 1;
    const needed = [];
    for (let dx = -2; dx <= 2; dx += 1) {
      for (let dz = -2; dz <= 2; dz += 1) {
        const chunkX = centerX + dx;
        const chunkZ = centerZ + dz;
        if (chunkX < 0 || chunkZ < 0 || chunkX > maxChunk || chunkZ > maxChunk) continue;
        const key = `${chunkX}:${chunkZ}`;
        if (!chunksByKey.has(key) && !requestedChunksRef.current.has(key)) {
          requestedChunksRef.current.add(key);
          needed.push(key);
        }
      }
    }
    if (!needed.length) return;
    socket.emit("request_survival_chunks", { worldId: world.id, keys: needed }, (response) => {
      needed.forEach((key) => requestedChunksRef.current.delete(key));
      if (!response?.ok) {
        setError(response?.error || "No se pudo cargar el mapa");
        return;
      }
      setChunksByKey((current) => {
        const next = new Map(current);
        response.chunks.forEach((chunk) => next.set(chunk.key, chunk));
        for (const [key, chunk] of next) {
          if (Math.abs(chunk.chunkX - centerX) > 3 || Math.abs(chunk.chunkZ - centerZ) > 3) {
            next.delete(key);
          }
        }
        return next;
      });
    });
  }, [chunksByKey, me?.x, me?.z, socket, state?.map, world.id]);

  const actionPressed = useCallback((action) => {
    const code = bindings[action];
    if (code?.startsWith("Mouse")) return mouseDownRef.current.has(code);
    return keysDownRef.current.has(code);
  }, [bindings]);

  const sendInput = useCallback(() => {
    if (!socket?.connected || !stateRef.current || spectating || bindingsOpen || inventoryOpen) return;
    const vertical = Number(actionPressed("moveUp")) - Number(actionPressed("moveDown"));
    const horizontal = Number(actionPressed("moveRight")) - Number(actionPressed("moveLeft"));
    const orbit = Math.PI / 4 + cameraQuarter * (Math.PI / 2);
    const forwardX = -Math.cos(orbit);
    const forwardZ = -Math.sin(orbit);
    const rightX = Math.sin(orbit);
    const rightZ = -Math.cos(orbit);
    const moveX = forwardX * vertical + rightX * horizontal;
    const moveZ = forwardZ * vertical + rightZ * horizontal;
    socket.emit("survival_input", {
      worldId: world.id,
      input: {
        moveX,
        moveZ,
        shooting: actionPressed("fire"),
        aimX: aimRef.current.x,
        aimZ: aimRef.current.z,
        dash: dashPulseRef.current,
        reload: reloadPulseRef.current
      }
    });
    dashPulseRef.current = false;
    reloadPulseRef.current = false;
  }, [actionPressed, bindingsOpen, cameraQuarter, inventoryOpen, socket, spectating, world.id]);

  useEffect(() => {
    const timer = window.setInterval(sendInput, 50);
    return () => window.clearInterval(timer);
  }, [sendInput]);

  useEffect(() => {
    const assignBinding = (action, code) => {
      setBindings((current) => {
        const next = { ...current, [action]: code };
        saveBindings(next);
        return next;
      });
      setListening("");
    };

    const keyDown = (event) => {
      if (listening) {
        event.preventDefault();
        assignBinding(listening, event.code);
        return;
      }
      if (event.code === "Escape" || event.code === "KeyK") {
        event.preventDefault();
        if (inventoryOpen) setInventoryOpen(false);
        else setBindingsOpen((current) => !current);
        return;
      }
      if (bindingsOpen) return;
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      keysDownRef.current.add(event.code);
      if (event.code === bindings.inventory || event.code === "Tab") {
        event.preventDefault();
        setInventoryOpen((current) => !current);
      }
      if (event.code === bindings.rotateLeft && !event.repeat) {
        setCameraQuarter((current) => current - 1);
      }
      if (event.code === bindings.rotateRight && !event.repeat) {
        setCameraQuarter((current) => current + 1);
      }
      if (event.code === bindings.dash && !event.repeat) dashPulseRef.current = true;
      if (event.code === bindings.reload && !event.repeat) reloadPulseRef.current = true;
      sendInput();
    };

    const keyUp = (event) => {
      keysDownRef.current.delete(event.code);
      sendInput();
    };

    const pointerDown = (event) => {
      const code = `Mouse${event.button}`;
      if (listening) {
        event.preventDefault();
        assignBinding(listening, code);
      }
    };

    const stopAll = () => {
      keysDownRef.current.clear();
      mouseDownRef.current.clear();
      sendInput();
    };

    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("pointerdown", pointerDown, true);
    window.addEventListener("blur", stopAll);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointerdown", pointerDown, true);
      window.removeEventListener("blur", stopAll);
    };
  }, [bindings, bindingsOpen, inventoryOpen, listening, sendInput]);

  const handleAim = useCallback((point) => {
    aimRef.current = point;
  }, []);

  const handleMouseAction = useCallback((code, active) => {
    if (active) mouseDownRef.current.add(code);
    else mouseDownRef.current.delete(code);
    sendInput();
  }, [sendInput]);

  async function useInventorySlot(slot) {
    setBusySlot(slot);
    setError("");
    const response = await emitAck(socket, "survival_use_item", { worldId: world.id, slot });
    setBusySlot(-1);
    if (!response.ok) setError(response.error || "No se pudo usar el objeto");
  }

  const currentTile = useMemo(() => {
    if (!me || !state?.map) return null;
    const tileX = Math.floor(me.x);
    const tileZ = Math.floor(me.z);
    for (const chunk of chunks) {
      const tile = chunk.tiles.find((entry) => entry.x === tileX && entry.z === tileZ);
      if (tile) return tile;
    }
    return null;
  }, [chunks, me?.x, me?.z, state?.map]);

  const dashRemaining = Math.max(0, (me?.dashCooldownUntil || 0) - now);
  const dashReady = dashRemaining <= 0;
  const dashProgress = dashReady ? 100 : 100 - (dashRemaining / 2000) * 100;
  const reloadRemaining = Math.max(0, (me?.reloadingUntil || 0) - now);

  if (!state) {
    return (
      <section className="survival-shell is-loading">
        <Loader2 className="animate-spin" size={32} />
        <strong>Generando mundo abierto…</strong>
        {error && <span>{error}</span>}
      </section>
    );
  }

  return (
    <section className="survival-shell survival-open-world">
      <SurvivalScene
        gameState={state}
        currentUserId={currentUser.id}
        chunks={chunks}
        cameraQuarter={cameraQuarter}
        onAim={handleAim}
        onMouseAction={handleMouseAction}
      />

      <div className="survival-open-hud survival-open-vitals">
        <div className="survival-open-health">
          <header>
            <span><HeartPulse size={15} /> {me?.username || "Espectador"}</span>
            <b>{Math.ceil(me?.hp || 0)} / {me?.maxHp || 100}</b>
          </header>
          <div><i style={{ width: `${((me?.hp || 0) / (me?.maxHp || 100)) * 100}%` }} /></div>
        </div>
        <Bar value={me?.hunger} tone="hunger" icon={Utensils} label="Hambre" />
        <Bar value={me?.thirst} tone="thirst" icon={Droplets} label="Sed" />
      </div>

      <div className="survival-open-hud survival-open-status">
        <span className={`is-biome is-${currentTile?.biome || "field"}`}>
          {currentTile?.biome === "forest" ? <Trees size={14} /> : currentTile?.biome === "city" ? <Bone size={14} /> : <Zap size={14} />}
          <small>Bioma</small>
          <strong>{BIOME_LABELS[currentTile?.biome] || "Explorando"}</strong>
        </span>
        <span>
          <Skull size={14} />
          <small>Kills</small>
          <strong>{me?.kills || 0}</strong>
        </span>
        <span className={connectionStatus === "online" ? "is-online" : "is-offline"}>
          <Gauge size={14} />
          <small>Co-op</small>
          <strong>{connectionStatus === "online" ? `${state.players.length}/4` : "Offline"}</strong>
        </span>
      </div>

      <div className="survival-open-hud survival-open-minimap-wrap">
        <MiniMap state={state} chunks={chunks} currentUserId={currentUser.id} />
      </div>

      <div className="survival-open-hud survival-open-weapon">
        <div>
          <Crosshair size={21} />
          <span>
            <small>Arma equipada</small>
            <strong>{WEAPON_NAMES[me?.weapon] || "Pistola"}</strong>
          </span>
          <b>{me?.ammo?.clip || 0}<em>/ {me?.ammo?.reserve || 0}</em></b>
        </div>
        {reloadRemaining > 0 && (
          <p><i style={{ width: `${100 - (reloadRemaining / 1900) * 100}%` }} /> Recargando…</p>
        )}
        <footer>
          <span><kbd>{keyLabel(bindings.reload)}</kbd> Recargar</span>
          <span><kbd>{keyLabel(bindings.inventory)}</kbd> Inventario</span>
        </footer>
      </div>

      <div className="survival-open-hud survival-open-dash">
        <div style={{ "--dash-progress": `${dashProgress * 3.6}deg` }}>
          <Zap size={18} />
        </div>
        <span>
          <small>Dash</small>
          <strong>{dashReady ? "LISTO" : `${(dashRemaining / 1000).toFixed(1)}s`}</strong>
          <kbd>{keyLabel(bindings.dash)}</kbd>
        </span>
      </div>

      <button className="survival-controls-trigger" type="button" onClick={() => setBindingsOpen(true)}>
        <Keyboard size={15} /> Controles <kbd>K</kbd>
      </button>

      {spectating && (
        <div className="survival-open-spectating">
          <MousePointer2 size={15} /> Mundo lleno · modo espectador
        </div>
      )}

      {inventoryOpen && me && (
        <InventoryPanel
          player={me}
          busySlot={busySlot}
          error={error}
          onUse={useInventorySlot}
          onClose={() => setInventoryOpen(false)}
        />
      )}

      {bindingsOpen && (
        <BindingsPanel
          bindings={bindings}
          listening={listening}
          onListen={setListening}
          onReset={() => {
            const next = { ...DEFAULT_BINDINGS };
            setBindings(next);
            saveBindings(next);
            setListening("");
          }}
          onClose={() => {
            setBindingsOpen(false);
            setListening("");
          }}
        />
      )}

      {error && !inventoryOpen && !bindingsOpen && (
        <button className="survival-error" type="button" onClick={() => setError("")}>
          {error}<X size={14} />
        </button>
      )}
    </section>
  );
}
