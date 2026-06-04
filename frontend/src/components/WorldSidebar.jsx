import { Crown, MessageCircle, Send, Skull, Sparkles, Users, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #fbbf24, #b8860b)",
  "linear-gradient(135deg, #f87171, #7f1d1d)",
  "linear-gradient(135deg, #34d399, #065f46)",
  "linear-gradient(135deg, #60a5fa, #1e3a8a)",
  "linear-gradient(135deg, #a78bfa, #4c1d95)",
  "linear-gradient(135deg, #fb923c, #7c2d12)",
  "linear-gradient(135deg, #f472b6, #831843)"
];

function gradientFor(username = "") {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) % AVATAR_GRADIENTS.length;
  }
  return AVATAR_GRADIENTS[h];
}

function playerTone(balance) {
  if (balance <= 0) return { border: "border-rose-400/40", bg: "bg-rose-500/15", text: "text-rose-100" };
  if (balance >= 10000) return { border: "border-amber-300/50", bg: "bg-amber-300/15", text: "text-amber-100" };
  return { border: "border-emerald-300/30", bg: "bg-emerald-300/10", text: "text-emerald-100" };
}

function playerStatusInfo(balance) {
  if (balance <= 0) return { label: "Quebrado", Icon: Skull, color: "text-rose-300" };
  if (balance >= 10000) return { label: "VIP", Icon: Crown, color: "text-amber-300" };
  return { label: "Activo", Icon: Sparkles, color: "text-emerald-300" };
}

function Avatar({ username, size = 36 }) {
  const initial = (username?.[0] || "?").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-white/40 font-display font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
      style={{ width: size, height: size, background: gradientFor(username), fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
}

export default function WorldSidebar({
  connectionStatus,
  currentUser,
  messages,
  players,
  onSendMessage
}) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const chatRef = useRef(null);

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.balance - a.balance || a.username.localeCompare(b.username)),
    [players]
  );

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length]);

  function submit(event) {
    event.preventDefault();
    const nextText = text.trim();

    if (!nextText) return;

    onSendMessage(nextText, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo enviar");
        return;
      }

      setText("");
      setError("");
    });
  }

  return (
    <aside className="grid gap-4">
      <section className="casino-panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-amber-300" />
            <h2 className="font-display text-lg font-extrabold text-white">Jugadores</h2>
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] font-extrabold text-amber-200">
              {sortedPlayers.length}
            </span>
          </div>
          <div
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-extrabold ${
              connectionStatus === "online"
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200 shadow-emeraldGlow"
                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            }`}
          >
            {connectionStatus === "online" ? <Wifi size={13} /> : <WifiOff size={13} />}
          </div>
        </div>

        <div className="scrollbar-slim grid max-h-72 gap-2 overflow-y-auto pr-1">
          {sortedPlayers.length === 0 && (
            <div className="rounded-lg border border-dashed border-amber-300/20 bg-black/30 p-4 text-center text-sm font-bold text-zinc-500">
              <Sparkles className="mx-auto mb-2 text-amber-300/40" size={20} />
              Sin jugadores conectados.
            </div>
          )}

          {sortedPlayers.map((player, index) => {
            const tone = playerTone(player.balance);
            const status = playerStatusInfo(player.balance);
            const isMe = player.userId === currentUser.id;
            const isLeader = index === 0;
            return (
              <div
                key={player.userId}
                className={`relative flex items-center gap-3 rounded-lg border-2 p-2.5 transition animate-slide-up-fade ${
                  isMe
                    ? "border-amber-300/40 bg-amber-300/10 shadow-goldSoft"
                    : "border-white/10 bg-black/40 hover:border-amber-300/30"
                }`}
              >
                <Avatar username={player.username} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {isLeader && <Crown size={14} className="text-amber-300 animate-sparkle" />}
                    <p className="truncate text-sm font-extrabold text-white">
                      {player.username}
                      {isMe ? " (tu)" : ""}
                    </p>
                  </div>
                  <p className={`mt-0.5 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.14em] ${status.color}`}>
                    <status.Icon size={11} />
                    {status.label}
                  </p>
                </div>

                <div className={`tabnum shrink-0 rounded-md border px-2 py-1 text-xs font-extrabold ${tone.border} ${tone.bg} ${tone.text}`}>
                  {currency.format(player.balance)}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="casino-panel p-4">
        <div className="mb-4 flex items-center gap-2">
          <MessageCircle size={18} className="text-rose-300" />
          <h2 className="font-display text-lg font-extrabold text-white">Chat de mesa</h2>
        </div>

        <div ref={chatRef} className="scrollbar-slim mb-3 grid h-80 content-start gap-2 overflow-y-auto rounded-lg border border-amber-300/15 bg-black/45 p-3 scanline">
          {messages.length === 0 && (
            <div className="self-center text-center text-sm font-bold text-zinc-500">
              <MessageCircle className="mx-auto mb-2 text-amber-300/30" size={28} />
              Aun no hay mensajes.
              <br />
              <span className="text-xs">Saluda a la mesa.</span>
            </div>
          )}

          {messages.map((message) => {
            const isMe = message.userId === currentUser.id;
            return (
              <div
                key={message.id}
                className={`flex animate-slide-up-fade gap-2 ${isMe ? "flex-row-reverse" : ""}`}
              >
                <Avatar username={message.username} size={28} />
                <div
                  className={`max-w-[80%] rounded-2xl border px-3 py-2 ${
                    isMe
                      ? "border-amber-300/40 bg-amber-300/15 text-amber-50 rounded-tr-sm"
                      : "border-white/10 bg-white/5 text-zinc-200 rounded-tl-sm"
                  }`}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-amber-200/80">
                      {message.username}
                    </span>
                    <span className="text-[10px] font-bold text-zinc-500">
                      {new Date(message.createdAt).toLocaleTimeString("es-MX", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <p className="break-words text-sm font-semibold leading-5">{message.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <form className="flex gap-2" onSubmit={submit}>
          <input
            className="arcade-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Saluda a la mesa..."
            maxLength={240}
          />
          <button className="arcade-button px-3" title="Enviar">
            <Send size={18} />
          </button>
        </form>

        {error && (
          <div className="mt-3 rounded-md border-2 border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-bold text-rose-100">
            {error}
          </div>
        )}
      </section>
    </aside>
  );
}
