import { Coins, Cuboid, Gamepad2, Gem, Globe2, LogOut, MessageSquare, Shield, Sparkles, Trophy, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "./api";
import { audio } from "./audio";
import AdminPanel from "./components/AdminPanel";
import AuthPanel from "./components/AuthPanel";
import BlackjackTable from "./components/BlackjackTable";
import DishesGame from "./components/DishesGame";
import EyconStore from "./components/EyconStore";
import MonopolyGame from "./components/MonopolyGame";
import PlatformRadioPlayer from "./components/PlatformRadioPlayer";
import { useRadio } from "./radio/RadioContext";
import WorldSelector from "./components/WorldSelector";
import WorldSidebar from "./components/WorldSidebar";

const APP_RADIO_GAME_KEY = "MONOPOLY";
const GAME_VIEWS = new Set(["games", "dishes", "blackjack", "monopoly", "monopoly3d"]);
const appCurrency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

function formatMoney(value) {
  return appCurrency.format(Number(value || 0));
}

function RoomGamesHub({ world, onSelectGame }) {
  const games = [
    { key: "dishes", icon: Sparkles, title: "Trabajo", text: "Lavar platos", status: "Listo" },
    { key: "blackjack", icon: Gamepad2, title: "Blackjack", text: "Mesa contra la banca", status: "Activo" },
    { key: "monopoly3d", icon: Cuboid, title: "Monopoly", text: "Tablero 3D", status: "Activo" }
  ];

  return (
    <section className="games-strip room-games-hub" id="easyno-games" aria-labelledby="room-games-title">
      <div className="section-heading">
        <div>
          <p><Gamepad2 size={15} /> Juegos</p>
          <h3 id="room-games-title">{world?.name || "MAIN"}</h3>
        </div>
      </div>

      <div className="game-card-grid">
        {games.map((game) => {
          const Icon = game.icon;
          return (
            <article className="game-card" key={game.key}>
              <div className="game-card__top">
                <span className="game-card__icon"><Icon size={20} /></span>
                <span className="game-status is-live">{game.status}</span>
              </div>
              <div>
                <h4>{game.title}</h4>
                <p>{game.text}</p>
              </div>
              <button className="game-card__action" onClick={() => onSelectGame(game.key)} type="button">
                Abrir
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoomRankingPanel({ world, presence, currentUser, onOpenRooms, onOpenGames }) {
  const ranking = useMemo(
    () => [...presence].sort((a, b) => Number(b.balance || 0) - Number(a.balance || 0) || a.username.localeCompare(b.username)),
    [presence]
  );

  if (!world) {
    return (
      <section className="activity-panel room-ranking-panel" id="easyno-activity">
        <div className="section-heading">
          <div>
            <p><Trophy size={15} /> Ranking</p>
            <h3>El ranking aparece cuando entras a una sala.</h3>
          </div>
          <button className="primary-action" onClick={onOpenRooms} type="button">
            <Globe2 size={17} />
            Ver salas
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="activity-panel room-ranking-panel" id="easyno-activity" aria-labelledby="room-ranking-title">
      <div className="section-heading">
        <div>
          <p><Trophy size={15} /> Ranking</p>
          <h3 id="room-ranking-title">Ranking en vivo de {world.name}</h3>
        </div>
        <button className="secondary-action" onClick={onOpenGames} type="button">
          <Gamepad2 size={17} />
          Juegos
        </button>
      </div>

      <div className="activity-list room-ranking-list">
        {ranking.length > 0 ? (
          ranking.map((player, index) => (
            <span className={player.userId === currentUser?.id ? "is-current" : ""} key={player.userId}>
              <Trophy size={17} />
              <strong>
                #{index + 1} {player.username}
                {player.userId === currentUser?.id ? " (tu)" : ""}
              </strong>
              <em>{formatMoney(player.balance)} en esta sala</em>
            </span>
          ))
        ) : (
          <span>
            <Sparkles size={17} />
            <strong>Sin jugadores conectados</strong>
            <em>Cuando entren a la sala apareceran aqui.</em>
          </span>
        )}
      </div>
    </section>
  );
}

const savedSession = () => {
  try {
    return JSON.parse(localStorage.getItem("easyno-session")) || null;
  } catch {
    return null;
  }
};

export default function App() {
  const { loadDefaultStation, pause } = useRadio();
  const [session, setSession] = useState(savedSession);
  const [world, setWorld] = useState(null);
  const [balance, setBalance] = useState(0);
  const [eyconProfile, setEyconProfile] = useState({ balanceUnits: 0, balance: 0, inventory: [], equipment: {} });
  const [view, setView] = useState("worlds");
  const [routePath, setRoutePath] = useState(() => window.location.pathname);
  const [socket, setSocket] = useState(null);
  const [socketStatus, setSocketStatus] = useState("offline");
  const [socketError, setSocketError] = useState("");
  const [presence, setPresence] = useState([]);
  const [messages, setMessages] = useState([]);
  const [muted, setMuted] = useState(() => audio.isMuted());
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const worldRef = useRef(null);
  const presenceIdsRef = useRef(new Set());
  const lastMessageIdRef = useRef(null);

  const token = session?.token;
  const monopolyView = Boolean(world && (view === "monopoly" || view === "monopoly3d"));
  const adminRoute = routePath.startsWith("/admin");
  const isAdmin = Boolean(session?.user?.isAdmin || session?.user?.roles?.includes("admin"));

  useEffect(() => {
    function syncPath() {
      setRoutePath(window.location.pathname);
    }
    window.addEventListener("popstate", syncPath);
    return () => window.removeEventListener("popstate", syncPath);
  }, []);

  function navigate(pathname) {
    window.history.pushState({}, "", pathname);
    setRoutePath(pathname);
  }

  // Mantener el estado local sincronizado con el módulo de audio
  useEffect(() => audio.subscribe(setMuted), []);

  // El panel de jugadores/chat se oculta por defecto en Blackjack para dar
  // toda la pantalla a la mesa; en el resto de vistas se muestra.
  useEffect(() => {
    setSidebarOpen(view !== "blackjack");
  }, [view]);

  // Preload de audios + desbloqueo en el primer click/teclado (autoplay policy)
  useEffect(() => {
    audio.preload();
    function unlock() {
      // Reproducir y pausar un audio silencioso desbloquea el contexto en algunos navegadores.
      try {
        const a = new Audio();
        a.volume = 0;
        a.play().catch(() => {});
      } catch { /* noop */ }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("easyno-session", JSON.stringify(session));
    } else {
      localStorage.removeItem("easyno-session");
    }
  }, [session]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api("/api/me", { token })
      .then((payload) => {
        if (!active || !payload?.user) return;
        setSession((current) => current ? { ...current, user: payload.user } : current);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!session) {
      pause();
      return;
    }

    loadDefaultStation(APP_RADIO_GAME_KEY, {
      forcePlay: true,
      resetPlaybackIntent: true
    });
  }, [loadDefaultStation, pause, session]);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      setSocketStatus("offline");
      return undefined;
    }

    // En producción (Docker) no se pasa URL: socket.io conecta al mismo origen
    // y nginx proxea /socket.io/ al backend.
    // En desarrollo, VITE_SOCKET_URL puede apuntar a http://localhost:4000.
    const socketUrl = import.meta.env.VITE_SOCKET_URL ?? "";
    const nextSocket = io(socketUrl || undefined, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.disconnect();
      setSocket(null);
    };
  }, [token]);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    api("/api/eycon/profile", { token })
      .then((profile) => {
        if (active) setEyconProfile(profile);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    if (!socket) return undefined;

    function handleConnect() {
      setSocketStatus("online");
      setSocketError("");
    }

    function handleDisconnect() {
      setSocketStatus("offline");
    }

    function handleConnectError(error) {
      setSocketStatus("offline");
      setSocketError(error.message || "Socket desconectado");
    }

    function handlePresence(payload) {
      if (payload.worldId !== worldRef.current?.id) return;

      const players = payload.players || [];
      const nextIds = new Set(players.map((p) => p.userId));
      const prevIds = presenceIdsRef.current;

      // Detectar quién entró / quién salió (sin contar al propio usuario en el primer load)
      const myId = session?.user?.id;
      const isInitial = prevIds.size === 0;

      if (!isInitial) {
        for (const id of nextIds) {
          if (!prevIds.has(id) && id !== myId) {
            audio.play("login");
            break;
          }
        }
        for (const id of prevIds) {
          if (!nextIds.has(id) && id !== myId) {
            audio.play("logout");
            break;
          }
        }
      }

      presenceIdsRef.current = nextIds;
      setPresence(players);
    }

    function handleMessage(message) {
      if (message.worldId !== worldRef.current?.id) return;

      // Reproducir sonido sólo para mensajes ajenos y nuevos
      if (
        message.userId !== session?.user?.id &&
        message.id !== lastMessageIdRef.current
      ) {
        audio.play("msg");
      }
      lastMessageIdRef.current = message.id;

      setMessages((current) => [...current.slice(-79), message]);
    }

    function handleBalance(payload) {
      if (payload.worldId === worldRef.current?.id) {
        setBalance(payload.balance);
      }
    }

    function handleEycon(payload) {
      setEyconProfile((current) => ({
        ...current,
        balanceUnits: Number(payload.balanceUnits || 0),
        balance: Number(payload.balance || 0)
      }));
    }

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("world_presence", handlePresence);
    socket.on("chat_message", handleMessage);
    socket.on("balance_update", handleBalance);
    socket.on("eycon_update", handleEycon);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("world_presence", handlePresence);
      socket.off("chat_message", handleMessage);
      socket.off("balance_update", handleBalance);
      socket.off("eycon_update", handleEycon);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !world) return undefined;

    setPresence([]);
    setMessages([]);

    function joinCurrentWorld() {
      socket.emit("join_world", { worldId: world.id }, (response) => {
        if (!response?.ok) {
          setSocketError(response?.error || "No se pudo entrar al mundo");
          return;
        }

        setWorld(response.world);
        setBalance(response.balance);
        setEyconProfile((current) => ({
          ...current,
          balanceUnits: Number(response.eyconBalanceUnits || 0),
          balance: Number(response.eyconBalance || 0)
        }));
      });
    }

    if (socket.connected) {
      joinCurrentWorld();
    }

    socket.on("connect", joinCurrentWorld);

    return () => {
      socket.off("connect", joinCurrentWorld);
      socket.emit("leave_world", { worldId: world.id });
    };
  }, [socket, world?.id]);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 0
      }).format(balance),
    [balance]
  );
  const eyconLabel = `${(Number(eyconProfile.balanceUnits || 0) / 100).toFixed(2)} EyCon`;

  function resetClientSession() {
    presenceIdsRef.current = new Set();
    setSession(null);
    setWorld(null);
    setBalance(0);
    setEyconProfile({ balanceUnits: 0, balance: 0, inventory: [], equipment: {} });
    setView("worlds");
    setPresence([]);
    setMessages([]);
  }

  function handleAuth(nextSession) {
    setSession(nextSession);
    setWorld(null);
    setBalance(0);
    setEyconProfile({ balanceUnits: 0, balance: 0, inventory: [], equipment: {} });
    setView("worlds");
    setPresence([]);
    setMessages([]);
  }

  function handleLogout() {
    const activeWorldId = worldRef.current?.id;

    let finished = false;
    const finishLogout = () => {
      if (finished) return;
      finished = true;
      socket?.disconnect();
      resetClientSession();
    };

    if (socket?.connected && activeWorldId) {
      socket.emit("leave_world", { worldId: activeWorldId }, () => {
        finishLogout();
      });
      window.setTimeout(() => {
        finishLogout();
      }, 400);
      return;
    }

    finishLogout();
  }

  async function reloadWorld() {
    if (!world || !token) return;
    const data = await api("/api/worlds/join", {
      method: "POST",
      token,
      body: { worldId: world.id }
    });
    setWorld(data.world);
    setBalance(data.balance);
    setEyconProfile((current) => ({
      ...current,
      balanceUnits: Number(data.eyconBalanceUnits ?? current.balanceUnits ?? 0),
      balance: Number(data.eyconBalance ?? current.balance ?? 0)
    }));
  }

  function leaveWorld() {
    presenceIdsRef.current = new Set();
    setWorld(null);
    setBalance(0);
    setEyconProfile({ balanceUnits: 0, balance: 0, inventory: [], equipment: {} });
    setView("worlds");
    setPresence([]);
    setMessages([]);
  }

  function sendWorldMessage(text, callback) {
    if (!socket || !world) {
      callback?.({ ok: false, error: "Socket desconectado" });
      return;
    }

    socket.emit("send_message", { worldId: world.id, text }, callback);
  }

  function scrollToLobbySection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openGamesTab() {
    if (world) {
      setView("games");
      return;
    }

    setView("worlds");
    window.setTimeout(() => scrollToLobbySection("easyno-games"), 0);
  }

  function openRoomsTab() {
    setView("worlds");
    window.setTimeout(() => scrollToLobbySection("easyno-private-rooms"), 0);
  }

  function openRankingTab() {
    setView("ranking");
  }

  function openStoreTab() {
    setView("eycon-store");
  }

  function handleWorldJoined(nextWorld, nextBalance) {
    setWorld(nextWorld);
    setBalance(nextBalance);
    setView("games");
    api("/api/me", { token })
      .then((payload) => {
        if (!payload?.user) return;
        setSession((current) => current ? { ...current, user: payload.user } : current);
      })
      .catch(() => {});
  }

  if (!session) {
    return (
      <main className="app-shell min-h-screen px-4 py-8 text-[#F4EEDC]">
        <AuthPanel onAuth={handleAuth} />
      </main>
    );
  }

  if (adminRoute) {
    if (!isAdmin) {
      return (
        <main className="admin-shell">
          <section className="admin-topbar">
            <div>
              <span className="admin-eyebrow"><Shield size={14} /> Acceso restringido</span>
              <h1>Administracion</h1>
              <p>Tu usuario no tiene rol admin activo.</p>
            </div>
            <div className="admin-topbar-actions">
              <button type="button" onClick={() => navigate("/")}>
                <X size={16} /> Volver
              </button>
              <button type="button" onClick={handleLogout}>
                <LogOut size={16} /> Salir
              </button>
            </div>
          </section>
        </main>
      );
    }

    return (
      <AdminPanel
        token={token}
        currentUser={session.user}
        onBack={() => navigate("/")}
        onLogout={handleLogout}
        onAdminProfile={(adminUser) => {
          if (!adminUser) return;
          setSession((current) => current ? { ...current, user: adminUser } : current);
        }}
      />
    );
  }

  return (
    <main className="app-shell min-h-screen text-[#F4EEDC]">
      <header className={`${monopolyView ? "relative app-header-monopoly platform-header--compact" : "sticky top-0"} platform-header z-30`}>
        <div className={`platform-header__inner ${monopolyView ? "platform-header__inner--game" : ""}`}>
          {/* Marca */}
          <div className="platform-brand">
            <div className={`brand-mark ${monopolyView ? "h-8 w-8" : "h-11 w-11"}`}>
              <span className={`${monopolyView ? "text-base" : "text-xl"} font-display font-black leading-none`}>EN</span>
              <span className={`${monopolyView ? "-bottom-0.5 -right-0.5 h-4 w-4" : "-bottom-1 -right-1 h-5 w-5"} absolute flex items-center justify-center rounded-full border border-[#25362F] bg-[#050807] text-[#F4C542]`}>
                <Coins size={11} />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className={`${monopolyView ? "text-base" : "text-xl"} font-display font-black leading-none tracking-tight`}>
                <span className="brand-word">EasyNo</span>
              </h1>
              <p className={`${monopolyView ? "hidden" : "block"} platform-brand__subtitle`}>
                {world ? world.name : "Plataforma social de juegos"}
              </p>
            </div>
          </div>

          {/* Navegación central (segmented) */}
          <nav className="app-main-nav platform-nav" aria-label="Navegacion principal">
            <button className={`nav-tab ${GAME_VIEWS.has(view) ? "is-active" : ""}`} onClick={openGamesTab} type="button">
              <Gamepad2 size={17} />
              Juegos
            </button>
            <button className={`nav-tab ${view === "worlds" ? "is-active" : ""}`} onClick={openRoomsTab} type="button">
              <Globe2 size={17} />
              Salas
            </button>
            <button className={`nav-tab ${view === "ranking" ? "is-active" : ""}`} onClick={openRankingTab} type="button">
              <Trophy size={17} />
              Ranking
            </button>
            <button className={`nav-tab ${view === "eycon-store" ? "is-active" : ""}`} onClick={openStoreTab} type="button">
              <Gem size={17} />
              Tienda
            </button>
          </nav>

          {/* Acciones a la derecha */}
          <div className="platform-actions">
            {world && (
              <div className="hud-pill hud-pill--gold">
                <span className="coin"><Coins size={12} /></span>
                <span key={balance} className="tabnum inline-block animate-count-pop">{money}</span>
              </div>
            )}
            {world && (
              <div className="hud-pill hud-pill--eycon" title="Moneda para cosméticos">
                <Gem size={14} />
                <span key={eyconProfile.balanceUnits} className="tabnum inline-block animate-count-pop">{eyconLabel}</span>
              </div>
            )}
            {isAdmin && (
              <button className="ghost-button px-3" onClick={() => navigate("/admin")} title="Administracion">
                <Shield size={18} />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <div
              className={`hud-pill ${socketStatus === "online" ? "hud-pill--emerald" : "hud-pill--muted"} text-xs uppercase tracking-[0.14em]`}
              title={socketError || "Estado de conexión"}
            >
              {socketStatus === "online" ? (
                <span className="relative flex items-center">
                  <span className="absolute inset-0 -m-0.5 animate-ping rounded-full bg-emerald-400/40" />
                  <Wifi size={15} className="relative" />
                </span>
              ) : (
                <WifiOff size={15} />
              )}
              {socketStatus === "online" ? "En vivo" : "offline"}
            </div>
            {world && (
              <button className="ghost-button px-3" onClick={leaveWorld} title="Cambiar de sala">
                <Globe2 size={18} />
                <span className="hidden sm:inline">Sala</span>
              </button>
            )}
            <button
              className="ghost-button px-3"
              onClick={() => audio.toggleMuted()}
              title={muted ? "Activar audio" : "Silenciar audio"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button className="ghost-button px-3" onClick={handleLogout} title="Cerrar sesión">
              <LogOut size={18} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <section className={`mx-auto px-4 ${monopolyView ? "max-w-[1800px] py-3" : "max-w-7xl py-8"}`}>
        {view === "worlds" ? (
          <WorldSelector
            token={token}
            eyconProfile={eyconProfile}
            onEyconProfileChange={setEyconProfile}
            onWorldJoined={handleWorldJoined}
          />
        ) : view === "eycon-store" ? (
          <EyconStore
            token={token}
            onProfileChange={setEyconProfile}
            isAdmin={isAdmin}
          />
        ) : view === "ranking" ? (
          <RoomRankingPanel
            world={world}
            presence={presence}
            currentUser={session.user}
            onOpenRooms={openRoomsTab}
            onOpenGames={openGamesTab}
          />
        ) : !world ? (
          <WorldSelector
            token={token}
            eyconProfile={eyconProfile}
            onEyconProfileChange={setEyconProfile}
            onWorldJoined={handleWorldJoined}
          />
        ) : (
          <>
            {view === "games" ? (
              <RoomGamesHub world={world} onSelectGame={setView} />
            ) : view === "monopoly" || view === "monopoly3d" ? (
              <MonopolyGame
                token={token}
                socket={socket}
                currentUser={session.user}
                world={world}
                presence={presence}
                messages={messages}
                connectionStatus={socketStatus}
                onSendMessage={sendWorldMessage}
                preferredBoardViewMode={view === "monopoly3d" ? "3d" : "2d"}
                onBoardViewModeChange={(nextMode) => setView(nextMode === "3d" ? "monopoly3d" : "monopoly")}
                equippedCosmetics={eyconProfile.equipment?.MONOPOLY || {}}
                eyconInventory={eyconProfile.inventory || []}
                onEyconProfileChange={setEyconProfile}
              />
            ) : (
            <>
              <div className={`grid gap-5 ${sidebarOpen ? "xl:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1"}`}>
                <div className="min-w-0">
                  {view === "dishes" && (
                    <DishesGame
                      token={token}
                      world={world}
                      onBalanceChange={setBalance}
                      onReloadWorld={reloadWorld}
                    />
                  )}

                  {view === "blackjack" && (
                    <BlackjackTable
                      socket={socket}
                      currentUser={session.user}
                      world={world}
                      balance={balance}
                    />
                  )}
                </div>

                {sidebarOpen && (
                  <div className="flex flex-col gap-2 xl:sticky xl:top-20 xl:self-start">
                    <button
                      className="ghost-button self-end px-3 py-1.5 text-xs"
                      onClick={() => setSidebarOpen(false)}
                      title="Ocultar panel"
                    >
                      <X size={14} />
                      Ocultar
                    </button>
                    <WorldSidebar
                      connectionStatus={socketStatus}
                      currentUser={session.user}
                      messages={messages}
                      players={presence}
                      onSendMessage={sendWorldMessage}
                    />
                  </div>
                )}
              </div>

              {/* Botón flotante para reabrir el panel cuando está oculto */}
              {!sidebarOpen && (
                <button
                  className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full border border-white/12 bg-black/70 px-4 py-3 text-sm font-bold text-zinc-200 shadow-[0_8px_24px_rgba(0,0,0,0.5)] backdrop-blur transition hover:border-amber-300/40 hover:text-amber-100"
                  onClick={() => setSidebarOpen(true)}
                  title="Mostrar jugadores y chat"
                >
                  <MessageSquare size={18} />
                  <span className="hidden sm:inline">Jugadores y chat</span>
                  {presence.length > 0 && (
                    <span className="tabnum rounded-full bg-amber-300/20 px-1.5 text-xs font-extrabold text-amber-100">{presence.length}</span>
                  )}
                </button>
              )}
            </>
            )}
          </>
        )}
      </section>
      <PlatformRadioPlayer compact={!world} />
    </main>
  );
}
