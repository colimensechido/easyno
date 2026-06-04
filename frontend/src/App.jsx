import { Coins, Gamepad2, Globe2, LogOut, MessageSquare, Sparkles, Spade, Volume2, VolumeX, Wifi, WifiOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "./api";
import { audio } from "./audio";
import AuthPanel from "./components/AuthPanel";
import BlackjackTable from "./components/BlackjackTable";
import DishesGame from "./components/DishesGame";
import MonopolyGame from "./components/MonopolyGame";
import WorldSelector from "./components/WorldSelector";
import WorldSidebar from "./components/WorldSidebar";

const savedSession = () => {
  try {
    return JSON.parse(localStorage.getItem("easyno-session")) || null;
  } catch {
    return null;
  }
};

export default function App() {
  const [session, setSession] = useState(savedSession);
  const [world, setWorld] = useState(null);
  const [balance, setBalance] = useState(0);
  const [view, setView] = useState("worlds");
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
  const monopolyView = Boolean(world && view === "monopoly");

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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("world_presence", handlePresence);
    socket.on("chat_message", handleMessage);
    socket.on("balance_update", handleBalance);

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

  function resetClientSession() {
    presenceIdsRef.current = new Set();
    setSession(null);
    setWorld(null);
    setBalance(0);
    setView("worlds");
    setPresence([]);
    setMessages([]);
  }

  function handleAuth(nextSession) {
    setSession(nextSession);
    setWorld(null);
    setBalance(0);
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
  }

  function leaveWorld() {
    presenceIdsRef.current = new Set();
    setWorld(null);
    setBalance(0);
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

  if (!session) {
    return (
      <main className="min-h-screen px-4 py-8 text-zinc-100">
        <AuthPanel onAuth={handleAuth} />
      </main>
    );
  }

  return (
    <main className="min-h-screen text-zinc-100">
      <header className={`${monopolyView ? "relative app-header-monopoly" : "sticky top-0"} z-30 border-b border-amber-300/20 bg-black/75 backdrop-blur-xl`}>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
          {/* Marca */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark h-11 w-11">
              <span className="font-display text-2xl font-black leading-none">e</span>
              <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-amber-200/70 bg-zinc-950 text-amber-200">
                <Spade size={11} fill="currentColor" />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-black leading-none tracking-tight">
                <span className="brand-word">easyno</span>
              </h1>
              <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200/55">
                {world ? world.name : `Bienvenido, ${session.user.username}`}
              </p>
            </div>
          </div>

          {/* Navegación central (segmented) */}
          {world && (
            <nav className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1">
              <button className={`nav-tab ${view === "dishes" ? "is-active" : ""}`} onClick={() => setView("dishes")} title="Lavar platos">
                <Sparkles size={17} />
                Trabajo
              </button>
              <button className={`nav-tab ${view === "blackjack" ? "is-active" : ""}`} onClick={() => setView("blackjack")} title="Blackjack">
                <Gamepad2 size={17} />
                Blackjack
              </button>
              <button className={`nav-tab ${view === "monopoly" ? "is-active" : ""}`} onClick={() => setView("monopoly")} title="Monopoly">
                <Coins size={17} />
                Monopoly
              </button>
            </nav>
          )}

          {/* Acciones a la derecha */}
          <div className="flex flex-wrap items-center gap-2">
            {world && (
              <div className="hud-pill hud-pill--gold">
                <span className="coin"><Coins size={12} /></span>
                <span key={balance} className="tabnum inline-block animate-count-pop">{money}</span>
              </div>
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
        {!world && (
          <WorldSelector
            token={token}
            onWorldJoined={(nextWorld, nextBalance) => {
              setWorld(nextWorld);
              setBalance(nextBalance);
              setView("dishes");
            }}
          />
        )}

        {world && (
          monopolyView ? (
            <MonopolyGame
              token={token}
              socket={socket}
              currentUser={session.user}
              world={world}
              presence={presence}
              messages={messages}
              connectionStatus={socketStatus}
              onSendMessage={sendWorldMessage}
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
          )
        )}
      </section>
    </main>
  );
}
