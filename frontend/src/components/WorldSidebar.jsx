import { Crown, Send, Users, Wifi, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

function playerTone(balance) {
  if (balance <= 0) return "border-rose-300/30 bg-rose-300/10 text-rose-200";
  if (balance >= 10000) return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-emerald-300/20 bg-emerald-300/10 text-emerald-200";
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

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.balance - a.balance || a.username.localeCompare(b.username)),
    [players]
  );

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
    <aside className="grid gap-5 xl:sticky xl:top-24 xl:self-start">
      <section className="arcade-panel p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-cyan-200" />
            <h2 className="font-display text-lg font-extrabold text-white">Conectados</h2>
          </div>
          <div
            className={`rounded-md border px-2 py-1 text-xs font-extrabold ${
              connectionStatus === "online"
                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                : "border-zinc-500/30 bg-zinc-500/10 text-zinc-400"
            }`}
          >
            {connectionStatus === "online" ? <Wifi size={14} /> : <WifiOff size={14} />}
          </div>
        </div>

        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1">
          {sortedPlayers.length === 0 && (
            <div className="rounded-md border border-dashed border-white/10 p-4 text-center text-sm font-bold text-zinc-500">
              Sin jugadores activos.
            </div>
          )}

          {sortedPlayers.map((player, index) => (
            <div
              key={player.userId}
              className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/35 p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  {index === 0 && <Crown size={15} className="text-amber-200" />}
                  <p className="truncate text-sm font-extrabold text-white">
                    {player.username}
                    {player.userId === currentUser.id ? " (tu)" : ""}
                  </p>
                </div>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                  {player.balance <= 0 ? "Quebrado" : player.balance >= 10000 ? "Millonario" : "Activo"}
                </p>
              </div>

              <div className={`shrink-0 rounded-md border px-2 py-1 text-xs font-extrabold ${playerTone(player.balance)}`}>
                {currency.format(player.balance)}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="arcade-panel p-4">
        <div className="mb-4 flex items-center gap-2">
          <Send size={18} className="text-rose-200" />
          <h2 className="font-display text-lg font-extrabold text-white">Chat</h2>
        </div>

        <div className="mb-3 grid h-80 content-start gap-2 overflow-y-auto rounded-md border border-white/10 bg-black/35 p-3">
          {messages.length === 0 && (
            <div className="self-center text-center text-sm font-bold text-zinc-600">
              Aun no hay mensajes.
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`rounded-md border px-3 py-2 ${
                message.userId === currentUser.id
                  ? "border-cyan-300/20 bg-cyan-300/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="truncate text-xs font-extrabold uppercase tracking-[0.12em] text-cyan-200">
                  {message.username}
                </span>
                <span className="text-[11px] font-bold text-zinc-600">
                  {new Date(message.createdAt).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </span>
              </div>
              <p className="break-words text-sm font-semibold leading-5 text-zinc-200">{message.text}</p>
            </div>
          ))}
        </div>

        <form className="flex gap-2" onSubmit={submit}>
          <input
            className="arcade-input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Mensaje"
            maxLength={240}
          />
          <button className="arcade-button px-3" title="Enviar">
            <Send size={18} />
          </button>
        </form>

        {error && (
          <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
            {error}
          </div>
        )}
      </section>
    </aside>
  );
}
