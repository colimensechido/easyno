import { Club, Coins, Gamepad2, Globe2, LogOut, Sparkles, Spade, Volume2, VolumeX, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "./api";
import { audio } from "./audio";
import AuthPanel from "./components/AuthPanel";
import BlackjackTable from "./components/BlackjackTable";
import DishesGame from "./components/DishesGame";
import WorldSelector from "./components/WorldSelector";
import WorldSidebar from "./components/WorldSidebar";

const savedSession = () => {
  try {
    return JSON.parse(localStorage.getItem("economy-arcade-session")) || null;
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
  const worldRef = useRef(null);
  const presenceIdsRef = useRef(new Set());
  const lastMessageIdRef = useRef(null);

  const token = session?.token;

  // Mantener el estado local sincronizado con el módulo de audio
  useEffect(() => audio.subscribe(setMuted), []);

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
      localStorage.setItem("economy-arcade-session", JSON.stringify(session));
    } else {
      localStorage.removeItem("economy-arcade-session");
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
      <header className="sticky top-0 z-20 border-b border-amber-300/20 bg-black/80 backdrop-blur">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/60 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent" />
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-amber-300/60 text-amber-200 shadow-goldSoft" style={{ background: "radial-gradient(circle at 35% 30%, #fef3c7, #fbbf24 60%, #b8860b 100%)" }}>
              <Spade size={20} className="text-zinc-950" />
              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-200 bg-zinc-950 text-[8px] font-black text-amber-200">
                <Club size={9} />
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-black tracking-wide sm:text-xl">
                <span className="gold-text">Economy Arcade</span>
              </h1>
              <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-amber-200/60">
                {world ? world.name : `Bienvenido, ${session.user.username}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {world && (
              <div className="flex min-h-11 items-center gap-2 rounded-md border border-amber-300/40 px-4 font-display text-sm font-extrabold text-amber-100 shadow-goldSoft" style={{ background: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(184,134,11,0.18))" }}>
                <span className="coin"><Coins size={12} /></span>
                <span className="text-shadow-gold">{money}</span>
              </div>
            )}
            <div
              className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-extrabold uppercase tracking-[0.14em] ${
                socketStatus === "online"
                  ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200 shadow-emeraldGlow"
                  : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
              }`}
              title={socketError || "Estado de Socket.io"}
            >
              {socketStatus === "online" ? (
                <span className="relative flex items-center">
                  <span className="absolute inset-0 -m-0.5 animate-ping rounded-full bg-emerald-400/40" />
                  <Wifi size={17} className="relative" />
                </span>
              ) : (
                <WifiOff size={17} />
              )}
              {socketStatus === "online" ? "EN VIVO" : "offline"}
            </div>
            {world && (
              <>
                <button
                  className={view === "dishes" ? "arcade-button" : "ghost-button"}
                  onClick={() => setView("dishes")}
                  title="Lavar platos"
                >
                  <Sparkles size={18} />
                  Trabajo
                </button>
                <button
                  className={view === "blackjack" ? "arcade-button" : "ghost-button"}
                  onClick={() => setView("blackjack")}
                  title="Blackjack"
                >
                  <Gamepad2 size={18} />
                  Blackjack
                </button>
                <button
                  className="ghost-button"
                  onClick={leaveWorld}
                  title="Cambiar mundo"
                >
                  <Globe2 size={18} />
                  Sala
                </button>
              </>
            )}
            <button
              className="ghost-button px-3"
              onClick={() => audio.toggleMuted()}
              title={muted ? "Activar audio" : "Silenciar audio"}
            >
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button className="ghost-button" onClick={handleLogout} title="Cerrar sesion">
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8">
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
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
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

            <WorldSidebar
              connectionStatus={socketStatus}
              currentUser={session.user}
              messages={messages}
              players={presence}
              onSendMessage={sendWorldMessage}
            />
          </div>
        )}
      </section>
    </main>
  );
}
