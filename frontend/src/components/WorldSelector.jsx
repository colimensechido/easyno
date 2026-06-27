import {
  ArrowRight,
  Check,
  Coins,
  Copy,
  Gem,
  Loader2,
  Lock,
  Plus,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

const PRIVATE_ROOM_COST_UNITS = 100;

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

function money(value) {
  return value == null ? currency.format(5000) : currency.format(value);
}

function eyconLabel(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
}

function playersLabel(count = 0) {
  const players = Number(count || 0);
  return `${players} ${players === 1 ? "jugador" : "jugadores"}`;
}

export default function WorldSelector({ token, onWorldJoined, eyconProfile, onEyconProfileChange }) {
  const [mainWorld, setMainWorld] = useState(null);
  const [activeWorlds, setActiveWorlds] = useState([]);
  const [myPrivateWorlds, setMyPrivateWorlds] = useState([]);
  const [privateWorlds, setPrivateWorlds] = useState([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState(null);
  const nameInputRef = useRef(null);

  const myRoom = myPrivateWorlds[0] || null;
  const searchResults = activeQuery ? privateWorlds : [];
  const livePrivateWorlds = useMemo(
    () => activeWorlds.filter((world) => world?.kind !== "MAIN" && world?.id !== mainWorld?.id),
    [activeWorlds, mainWorld?.id]
  );
  const canCreate = useMemo(() => name.trim().length >= 3, [name]);
  const eyconUnits = Number(eyconProfile?.balanceUnits || 0);
  const canAffordPrivateRoom = eyconUnits >= PRIVATE_ROOM_COST_UNITS;
  const mainPlayerCount = Number(mainWorld?.playerCount || 0);

  const games = [
    { key: "berichie", icon: "BR", title: "BeRichie", text: "Inmobiliario por turnos.", status: "Activo" },
    { key: "blackjack", icon: "21", title: "Blackjack", text: "Banca, IA y mesas.", status: "Disponible" },
    { key: "poker", icon: "PK", title: "Poker", text: "Mesas privadas.", status: "Proximamente", locked: true }
  ];

  async function loadWorlds(query = activeQuery) {
    setError("");
    setLoading(true);
    try {
      const suffix = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : "";
      const data = await api(`/api/worlds${suffix}`, { token });
      setMainWorld(data.mainWorld || data.worlds?.[0] || null);
      setActiveWorlds(data.activeWorlds || []);
      setMyPrivateWorlds(data.myPrivateWorlds || []);
      setPrivateWorlds(data.privateWorlds || []);
      setActiveQuery(query.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorlds("");
  }, []);

  async function createWorld(event) {
    event.preventDefault();
    if (!canCreate || !canAffordPrivateRoom) return;
    setError("");
    setCreating(true);

    try {
      const data = await api("/api/worlds/create", {
        method: "POST",
        token,
        body: { name }
      });
      if (data.eyconBalanceUnits != null) {
        onEyconProfileChange?.((current) => ({
          ...current,
          balanceUnits: Number(data.eyconBalanceUnits || 0),
          balance: Number(data.eyconBalance || 0)
        }));
      }
      onWorldJoined(data.world, data.balance);
    } catch (err) {
      setError(err.message);
      await loadWorlds(activeQuery);
    } finally {
      setCreating(false);
    }
  }

  async function joinWorld(worldId) {
    setError("");
    setJoiningId(worldId);
    try {
      const data = await api("/api/worlds/join", {
        method: "POST",
        token,
        body: { worldId }
      });
      if (data.eyconBalanceUnits != null) {
        onEyconProfileChange?.((current) => ({
          ...current,
          balanceUnits: Number(data.eyconBalanceUnits || 0),
          balance: Number(data.eyconBalance || 0)
        }));
      }
      onWorldJoined(data.world, data.balance);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoiningId(null);
    }
  }

  function joinMainWorld() {
    if (mainWorld?.id) joinWorld(mainWorld.id);
  }

  function joinMyRoom() {
    if (myRoom?.id) joinWorld(myRoom.id);
  }

  function handleSearch(event) {
    event.preventDefault();
    loadWorlds(search);
  }

  function focusCreateRoom() {
    nameInputRef.current?.focus();
  }

  async function copyRoomCode(code) {
    if (!code) return;
    try {
      await navigator.clipboard?.writeText(code);
    } catch {
      // El codigo queda visible para copiar manualmente.
    }
  }

  return (
    <section className="easyno-lobby" aria-labelledby="main-room-title">
      <div className="lobby-hero lobby-hero--focused">
        <div className="lobby-hero__copy">
          <p className="lobby-kicker">
            <Sparkles size={14} />
            Plataforma social beta
          </p>
          <h2 id="main-room-title">Elige como jugar</h2>
          <p>
            MAIN es la puerta principal de EasyNo. Entra a la sala publica primero o crea una privada para jugar con amigos.
          </p>

          <div className="lobby-hero__actions">
            <button className="primary-action" onClick={joinMainWorld} type="button" disabled={!mainWorld || joiningId === mainWorld?.id}>
              {joiningId === mainWorld?.id ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
              Empezar a jugar
            </button>
            <button className="secondary-action" onClick={myRoom ? joinMyRoom : focusCreateRoom} type="button" disabled={joiningId === myRoom?.id}>
              {myRoom ? "Entrar a mi sala" : "Crear sala privada"}
              <ArrowRight size={17} />
            </button>
          </div>

          <div className="lobby-hero__facts" aria-label="Resumen de economia">
            <span>
              <Gem size={16} />
              {eyconLabel(eyconUnits)}
            </span>
            <span>
              <Users size={16} />
              MAIN: {playersLabel(mainPlayerCount)}
            </span>
            <span>
              <ShieldCheck size={16} />
              MAIN siempre activa
            </span>
          </div>
        </div>

        <div className="lobby-visual" aria-hidden="true">
          <div className="lobby-visual__table">
            <span className="visual-orbit visual-orbit--one" />
            <span className="visual-orbit visual-orbit--two" />
            <div className="visual-card visual-card--one">
              <small>MAIN</small>
              <strong>Sala publica</strong>
            </div>
            <div className="visual-card visual-card--two">
              <small>1 EC</small>
              <strong>Privada</strong>
            </div>
            <div className="visual-chip visual-chip--gold">$</div>
            <div className="visual-chip visual-chip--copper">E</div>
            <div className="visual-dice">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="lobby-alert" role="alert">
          {error}
        </div>
      )}

      <section className="play-hub" id="easyno-room" aria-label="Opciones de juego">
        <article className="play-option play-option--main">
          <div className="play-option__icon">
            <Rocket size={22} />
          </div>
          <div className="play-option__body">
            <p>Sala publica</p>
            <h3>MAIN</h3>
            <span>La prioridad es entrar aqui: siempre existe, todos pueden llegar y su economia vive en esta sala.</span>
          </div>
          <dl>
            <div>
              <dt>Saldo aqui</dt>
              <dd>{money(mainWorld?.balance)}</dd>
            </div>
            <div>
              <dt>Jugadores</dt>
              <dd>{playersLabel(mainPlayerCount)}</dd>
            </div>
            <div>
              <dt>Estado</dt>
              <dd>Siempre activa</dd>
            </div>
          </dl>
          <button className="primary-action" onClick={joinMainWorld} disabled={!mainWorld || joiningId === mainWorld?.id} type="button">
            {joiningId === mainWorld?.id ? <Loader2 className="animate-spin" size={18} /> : <Rocket size={18} />}
            Empezar a jugar
          </button>
        </article>

        <article className="play-option play-option--private" id="easyno-private-rooms">
          <div className="play-option__icon">
            <Users size={22} />
          </div>
          <div className="play-option__body">
            <p>Sala privada</p>
            <h3>{myRoom ? "Entrar a mi sala" : "Crea tu sala"}</h3>
            <span>{myRoom ? "Tu sala privada lista para invitar amigos." : "Crear cuesta 1 EyCon y arranca economia nueva."}</span>
          </div>

          {myRoom ? (
            <>
              <div className="my-room-card">
                <span className="room-code">
                  {myRoom.roomCode || `SALA-${myRoom.id}`}
                  <button type="button" onClick={() => copyRoomCode(myRoom.roomCode)} title="Copiar codigo">
                    <Copy size={13} />
                  </button>
                </span>
                <strong>{myRoom.name}</strong>
                <em>{money(myRoom.balance)} disponibles en esta sala</em>
                <em>{playersLabel(myRoom.playerCount)} ahora</em>
              </div>
              <button className="primary-action" onClick={joinMyRoom} disabled={joiningId === myRoom.id} type="button">
                {joiningId === myRoom.id ? <Loader2 className="animate-spin" size={18} /> : <Users size={18} />}
                Entrar a mi sala
              </button>
            </>
          ) : (
            <form className="create-room-inline" onSubmit={createWorld}>
              <label className="field-label" htmlFor="world-name">
                Nombre de sala
              </label>
              <input
                ref={nameInputRef}
                id="world-name"
                className="arcade-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Noche de fichas"
                maxLength={48}
              />
              <button className="primary-action" disabled={!canCreate || !canAffordPrivateRoom || creating} type="submit">
                {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Crear por 1 EyCon
              </button>
              <small className={canAffordPrivateRoom ? "" : "is-warning"}>
                Tienes {eyconLabel(eyconUnits)}.
              </small>
            </form>
          )}
        </article>

        <article className="play-option play-option--search">
          <div className="play-option__icon">
            <Search size={22} />
          </div>
          <div className="play-option__body">
            <p>Salas con gente</p>
            <h3>Activas ahora</h3>
            <span>MAIN va primero; aqui aparecen privadas con jugadores conectados.</span>
          </div>

          <div className="live-room-list">
            {livePrivateWorlds.length > 0 ? (
              livePrivateWorlds.map((room) => (
                <article className="private-room-card live-room-card" key={room.id}>
                  <div>
                    <span className="room-code">{room.roomCode || `SALA-${room.id}`}</span>
                    <strong>{room.name}</strong>
                    <em>{playersLabel(room.playerCount)} ahora</em>
                  </div>
                  <button className="game-card__action" onClick={() => joinWorld(room.id)} disabled={joiningId === room.id} type="button">
                    {joiningId === room.id ? <Loader2 className="animate-spin" size={16} /> : "Entrar"}
                    {joiningId !== room.id && <ArrowRight size={16} />}
                  </button>
                </article>
              ))
            ) : (
              <div className="private-room-empty">
                <Users size={18} />
                No hay salas privadas con gente ahora.
              </div>
            )}
          </div>

          <form className="private-room-search" onSubmit={handleSearch}>
            <div>
              <input
                id="private-room-search"
                className="arcade-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Codigo o nombre"
                maxLength={48}
              />
              <button className="secondary-action" disabled={loading} type="submit">
                {loading ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
                Buscar
              </button>
            </div>
          </form>

          {activeQuery && (
            <div className="private-room-list">
              {searchResults.length > 0 ? (
                searchResults.map((room) => (
                  <article className="private-room-card" key={room.id}>
                    <div>
                      <span className="room-code">{room.roomCode || `SALA-${room.id}`}</span>
                      <strong>{room.name}</strong>
                      <em>{money(room.balance)} en esta sala</em>
                      <em>{playersLabel(room.playerCount)} ahora</em>
                    </div>
                    <button className="game-card__action" onClick={() => joinWorld(room.id)} disabled={joiningId === room.id} type="button">
                      {joiningId === room.id ? <Loader2 className="animate-spin" size={16} /> : "Entrar"}
                      {joiningId !== room.id && <ArrowRight size={16} />}
                    </button>
                  </article>
                ))
              ) : (
                <div className="private-room-empty">
                  <Lock size={18} />
                  No encontramos esa sala.
                </div>
              )}
            </div>
          )}
        </article>
      </section>

      <section className="games-strip" id="easyno-games" aria-labelledby="games-title">
        <div className="section-heading">
          <div>
            <p>Juegos dentro de cada sala</p>
            <h3 id="games-title">La sala decide con quien juegas; EyCon sigue contigo.</h3>
          </div>
          <button className="quiet-refresh" onClick={() => loadWorlds(activeQuery)} type="button" title="Recargar estado">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Recargar
          </button>
        </div>

        <div className="game-card-grid game-card-grid--compact">
          {games.map((game) => (
            <article className={`game-card ${game.locked ? "is-locked" : ""}`} key={game.key}>
              <div className="game-card__top">
                <span className="game-card__icon">{game.icon}</span>
                <span className={`game-status ${game.locked ? "is-muted" : "is-live"}`}>
                  {game.locked ? <Lock size={13} /> : <Check size={13} />}
                  {game.status}
                </span>
              </div>
              <div>
                <h4>{game.title}</h4>
                <p>{game.text}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
