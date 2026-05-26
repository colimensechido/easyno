import { Coins, Gamepad2, Globe2, LogOut, Sparkles, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "./api";
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
  const worldRef = useRef(null);

  const token = session?.token;

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

    const nextSocket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
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
      if (payload.worldId === worldRef.current?.id) {
        setPresence(payload.players || []);
      }
    }

    function handleMessage(message) {
      if (message.worldId === worldRef.current?.id) {
        setMessages((current) => [...current.slice(-79), message]);
      }
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

  function handleAuth(nextSession) {
    setSession(nextSession);
    setWorld(null);
    setBalance(0);
    setView("worlds");
    setPresence([]);
    setMessages([]);
  }

  function handleLogout() {
    socket?.disconnect();
    setSession(null);
    setWorld(null);
    setBalance(0);
    setView("worlds");
    setPresence([]);
    setMessages([]);
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
      <header className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
              <Gamepad2 size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-lg font-extrabold text-white sm:text-xl">
                Economy Arcade
              </h1>
              <p className="truncate text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {world ? world.name : session.user.username}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {world && (
              <div className="flex min-h-11 items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 font-display text-sm font-extrabold text-amber-200">
                <Coins size={18} />
                <span>{money}</span>
              </div>
            )}
            <div
              className={`flex min-h-11 items-center gap-2 rounded-md border px-3 text-xs font-extrabold uppercase tracking-[0.14em] ${
                socketStatus === "online"
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                  : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
              }`}
              title={socketError || "Estado de Socket.io"}
            >
              {socketStatus === "online" ? <Wifi size={17} /> : <WifiOff size={17} />}
              {socketStatus}
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
