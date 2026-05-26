import {
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  CircleDollarSign,
  Coins,
  Hand,
  Hourglass,
  LockKeyhole,
  Plus,
  RotateCcw,
  Shield,
  StepForward,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const suitInfo = {
  S: { symbol: "♠", name: "Picas", red: false },
  H: { symbol: "♥", name: "Corazones", red: true },
  D: { symbol: "♦", name: "Diamantes", red: true },
  C: { symbol: "♣", name: "Treboles", red: false }
};

const statusLabel = {
  waiting: "Esperando",
  ready: "Apuesta lista",
  playing: "Decidiendo",
  stood: "Plantado",
  busted: "Pasado",
  blackjack: "Blackjack",
  done: "Final"
};

const outcomeLabel = {
  win: "Ganaste",
  lose: "Perdiste",
  push: "Empate"
};

function formatMoney(value) {
  return `$${Math.max(0, Number(value) || 0).toLocaleString("en-US")}`;
}

function cardPoints(card) {
  if (!card || card.hidden) return 0;
  if (card.rank === "A") return 11;
  if (["K", "Q", "J"].includes(card.rank)) return 10;
  return Number(card.rank);
}

function cardValueLabel(card) {
  if (!card || card.hidden) return "?";
  if (card.rank === "A") return "1/11";
  if (["K", "Q", "J"].includes(card.rank)) return "10";
  return card.rank;
}

function handValue(cards) {
  const visible = cards.filter((card) => !card.hidden);
  let total = visible.reduce((sum, card) => sum + cardPoints(card), 0);
  let aces = visible.filter((card) => card.rank === "A").length;

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function Card({ card, compact = false }) {
  if (card.hidden) {
    return (
      <div
        className={`relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border border-cyan-300/40 bg-cyan-950 shadow-neon ${
          compact ? "w-16" : "w-24 sm:w-28"
        }`}
      >
        <div className="absolute inset-2 rounded-md border border-cyan-200/20" />
        <Shield className="text-cyan-200" size={compact ? 22 : 32} />
      </div>
    );
  }

  const suit = suitInfo[card.suit] || suitInfo.S;
  const color = suit.red ? "text-rose-600" : "text-zinc-950";

  return (
    <div
      className={`flex aspect-[3/4] flex-col justify-between rounded-lg border border-white/30 bg-zinc-100 text-zinc-950 shadow-lg ${
        compact ? "w-16 p-2" : "w-24 p-3 sm:w-28"
      }`}
      title={`${card.rank} de ${suit.name}`}
    >
      <div className={`flex items-center justify-between font-display font-extrabold ${compact ? "text-sm" : "text-lg"} ${color}`}>
        <span>{card.rank}</span>
        <span>{suit.symbol}</span>
      </div>
      <div className="grid justify-items-center gap-1">
        <div className={`font-display font-extrabold leading-none ${compact ? "text-3xl" : "text-5xl"} ${color}`}>
          {cardValueLabel(card)}
        </div>
        <div className={`font-display font-extrabold ${compact ? "text-xl" : "text-3xl"} ${color}`}>
          {suit.symbol}
        </div>
      </div>
      <div className={`flex rotate-180 items-center justify-between font-display font-extrabold ${compact ? "text-sm" : "text-lg"} ${color}`}>
        <span>{card.rank}</span>
        <span>{suit.symbol}</span>
      </div>
    </div>
  );
}

function TimerBar({ seconds, active, totalSeconds = 15 }) {
  const percent = active ? Math.max(0, Math.min(100, (seconds / totalSeconds) * 100)) : 0;

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.14em] text-zinc-500">
        <span>Timer</span>
        <span>{active ? `${seconds}s` : "-"}</span>
      </div>
      <div className="h-3 overflow-hidden rounded-md border border-white/10 bg-black/50">
        <div
          className={`h-full transition-all ${seconds <= 5 ? "bg-rose-400" : "bg-cyan-300"}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function PhaseBanner({ phase, bettingSeconds, turnSeconds, currentTurnPlayer, isMyTurn, message }) {
  const tone =
    phase === "playing" && isMyTurn
      ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100 shadow-neon"
      : phase === "settled"
        ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
        : phase === "betting"
          ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
          : "border-white/10 bg-white/5 text-zinc-100";

  const title =
    phase === "idle"
      ? "Mesa abierta"
      : phase === "betting"
        ? `Apuestas abiertas: ${bettingSeconds}s`
        : phase === "playing"
          ? isMyTurn
            ? "Tu turno"
            : `Turno de ${currentTurnPlayer?.username || "jugador"}`
          : phase === "dealer"
            ? "La banca revela"
            : "Ronda terminada";

  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-current/60">Fase actual</p>
          <h3 className="mt-1 font-display text-2xl font-extrabold">{title}</h3>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm font-extrabold">
            {phase === "betting" ? <Hourglass size={18} /> : phase === "playing" ? <Zap size={18} /> : <Shield size={18} />}
            {message}
          </div>
        </div>
        <TimerBar seconds={phase === "playing" ? turnSeconds : bettingSeconds} active={phase === "playing" || phase === "betting"} />
      </div>
    </div>
  );
}

function ResultModal({ notice, onClose }) {
  if (!notice) return null;

  const tone =
    notice.tone === "win"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
      : notice.tone === "lose"
        ? "border-rose-300/40 bg-rose-300/10 text-rose-100"
        : "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className={`w-full max-w-md rounded-lg border p-5 shadow-neon ${tone}`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-current/60">
              Evento de mesa
            </p>
            <h3 className="mt-2 font-display text-3xl font-extrabold text-white">{notice.title}</h3>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-md border border-white/10 bg-black/35">
            <Trophy size={28} />
          </div>
        </div>
        {notice.amount && (
          <div className="mt-5 rounded-md border border-white/10 bg-black/35 px-4 py-3 text-center font-display text-3xl font-extrabold text-white">
            {notice.amount}
          </div>
        )}
        <p className="mt-4 text-sm font-bold leading-6 text-zinc-200">{notice.message}</p>
        <button className="arcade-button mt-5 w-full" onClick={onClose}>
          <StepForward size={18} />
          Continuar
        </button>
      </div>
    </div>
  );
}

function CommandCenter({ phase, me, isMyTurn, currentTurnPlayer, turnSeconds, bettingSeconds, tablePot, limits }) {
  const myTotal = me?.cards?.length ? handValue(me.cards) : null;
  const action =
    phase === "betting"
      ? me
        ? "Apuesta bloqueada"
        : "Confirma apuesta"
      : phase === "playing"
        ? isMyTurn
          ? "Pide o plantate"
          : `Espera a ${currentTurnPlayer?.username || "la mesa"}`
        : phase === "dealer"
          ? "Resolviendo banca"
          : phase === "settled"
            ? "Ronda finalizada"
            : "Mesa lista";

  return (
    <section className="grid gap-3 md:grid-cols-4">
      <div className={`rounded-lg border p-4 ${isMyTurn ? "border-cyan-300/60 bg-cyan-300/15 shadow-neon" : "border-white/10 bg-black/35"}`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Accion</p>
        <p className="mt-2 font-display text-xl font-extrabold text-white">{action}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Tu mano</p>
        <p className="mt-2 font-display text-xl font-extrabold text-cyan-200">{myTotal ?? "-"}</p>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Reloj</p>
        <p className={`mt-2 font-display text-xl font-extrabold ${turnSeconds <= 5 && phase === "playing" ? "text-rose-200" : "text-amber-200"}`}>
          {phase === "playing" ? `${turnSeconds}s` : phase === "betting" ? `${bettingSeconds}s` : "-"}
        </p>
      </div>
      <div className="rounded-lg border border-white/10 bg-black/35 p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Pozo / cap</p>
        <p className="mt-2 font-display text-xl font-extrabold text-emerald-200">
          ${tablePot} / ${limits.max}
        </p>
      </div>
    </section>
  );
}

function DealerHand({ table }) {
  const total = table.dealerTotal ?? (table.dealerCards?.length ? handValue(table.dealerCards) : null);

  return (
    <section className="rounded-lg border border-white/10 bg-black/35 p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-rose-200">Crupier</p>
          <h3 className="font-display text-lg font-extrabold text-white">Banca IA</h3>
        </div>
        <span className="rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-1 text-sm font-extrabold text-rose-200">
          {table.phase === "playing" ? "Total oculto" : `Total ${total ?? "-"}`}
        </span>
      </div>
      <div className="flex min-h-36 flex-wrap gap-3">
        {table.dealerCards?.length ? (
          table.dealerCards.map((card, index) => (
            <Card key={`${card.rank || "hidden"}-${card.suit || "x"}-${index}`} card={card} />
          ))
        ) : (
          <div className="flex min-h-32 w-24 items-center justify-center rounded-lg border border-dashed border-white/10 text-zinc-600 sm:w-28">
            -
          </div>
        )}
      </div>
    </section>
  );
}

function PlayerSeat({ player, currentUserId, active }) {
  const isCurrentUser = player.userId === currentUserId;
  const connected = player.connected !== false;
  const outcomeTone =
    player.outcome === "win"
      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
      : player.outcome === "lose"
        ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
        : "border-amber-300/30 bg-amber-300/10 text-amber-200";

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        active
          ? "border-cyan-300/70 bg-cyan-300/10 shadow-neon"
          : isCurrentUser
            ? "border-amber-300/30 bg-amber-300/10"
            : "border-white/10 bg-black/35"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-display text-base font-extrabold text-white">
            {player.username}
            {isCurrentUser ? " (tu)" : ""}
          </h4>
          <p className={`mt-1 text-xs font-bold uppercase tracking-[0.14em] ${connected ? "text-zinc-500" : "text-rose-300"}`}>
            {connected ? (active ? "Turno activo" : statusLabel[player.status] || player.status) : "Desconectado"}
          </p>
        </div>
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-extrabold text-amber-200">
          ${player.bet}
        </div>
      </div>

      <div className="mb-3 flex min-h-24 flex-wrap gap-2">
        {player.cards.length ? (
          player.cards.map((card, index) => (
            <Card key={`${card.rank}-${card.suit}-${index}`} card={card} compact />
          ))
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-lg border border-dashed border-white/10 text-zinc-600">
            -
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-extrabold text-cyan-200">
          Total {player.total || "-"}
        </span>
        {player.outcome && (
          <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${outcomeTone}`}>
            {outcomeLabel[player.outcome]} {player.payout ? `$${player.payout}` : ""}
          </span>
        )}
      </div>
    </article>
  );
}

function PvpSeat({ seat, currentUserId, active, buyIn }) {
  const isCurrentUser = seat.userId === currentUserId;
  const cards = seat.cards || [];
  const connected = seat.connected !== false;
  const outcomeTone =
    seat.outcome === "win"
      ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
      : seat.outcome === "lose"
        ? "border-rose-300/40 bg-rose-300/10 text-rose-200"
        : "border-white/10 bg-black/35 text-zinc-200";

  return (
    <article
      className={`rounded-lg border p-4 transition ${
        active
          ? "border-cyan-300/70 bg-cyan-300/10 shadow-neon"
          : isCurrentUser
            ? "border-amber-300/40 bg-amber-300/10"
            : "border-white/10 bg-black/35"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="truncate font-display text-base font-extrabold text-white">
            {seat.username}
            {isCurrentUser ? " (tu)" : ""}
          </h4>
          <p className={`mt-1 text-xs font-bold uppercase tracking-[0.14em] ${connected ? "text-zinc-500" : "text-rose-300"}`}>
            {connected ? (active ? "Turno activo" : statusLabel[seat.status] || seat.status) : "Desconectado"}
          </p>
        </div>
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs font-extrabold text-amber-200">
          {formatMoney(buyIn)}
        </div>
      </div>

      <div className="mb-3 flex min-h-24 flex-wrap gap-2">
        {cards.length ? (
          cards.map((card, index) => (
            <Card key={`${card.rank}-${card.suit}-${index}`} card={card} compact />
          ))
        ) : (
          <div className="flex h-24 w-16 items-center justify-center rounded-lg border border-dashed border-white/10 text-zinc-600">
            -
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-2 py-1 text-xs font-extrabold text-cyan-200">
          Total {seat.total || "-"}
        </span>
        {seat.outcome && (
          <span className={`rounded-md border px-2 py-1 text-xs font-extrabold ${outcomeTone}`}>
            {outcomeLabel[seat.outcome]} {seat.payout ? formatMoney(seat.payout) : ""}
          </span>
        )}
      </div>
    </article>
  );
}

function PvpArena({ table, currentUser, turnSeconds, onAction }) {
  const currentTurnSeat = table.seats.find((seat) => seat.userId === table.currentTurnUserId);
  const me = table.seats.find((seat) => seat.userId === currentUser.id);
  const isMyTurn = table.phase === "playing" && table.currentTurnUserId === currentUser.id;
  const activePlayers = table.seats.filter((seat) => seat.status === "playing").length;
  const winnerNames = table.seats
    .filter((seat) => table.winners?.includes(seat.userId))
    .map((seat) => seat.username)
    .join(", ");

  return (
    <div className="grid gap-4">
      <div
        className={`rounded-lg border p-4 ${
          isMyTurn
            ? "border-cyan-300/60 bg-cyan-300/15 text-cyan-100 shadow-neon"
            : table.phase === "settled"
              ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
              : "border-white/10 bg-black/35 text-zinc-100"
        }`}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-current/60">
              Sala PvP
            </p>
            <h3 className="mt-1 font-display text-2xl font-extrabold">
              {table.phase === "playing"
                ? isMyTurn
                  ? "Tu turno"
                  : `Turno de ${currentTurnSeat?.username || "jugador"}`
                : table.phase === "settled"
                  ? winnerNames
                    ? `Gana ${winnerNames}`
                    : "Sin ganador"
                  : "Preparando ronda"}
            </h3>
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/10 bg-black/25 px-3 py-2 text-sm font-extrabold">
              {table.phase === "playing" ? <Zap size={18} /> : <Trophy size={18} />}
              {table.message || "Mesa sincronizada"}
            </div>
          </div>
          <TimerBar seconds={turnSeconds} active={table.phase === "playing"} totalSeconds={15} />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-200/60">Pozo</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-emerald-200">{formatMoney(table.pot)}</p>
        </div>
        <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/60">Buy-in</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-amber-200">{formatMoney(table.buyIn)}</p>
        </div>
        <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-200/60">Activos</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-cyan-200">{activePlayers}</p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/35 p-4">
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Tu mano</p>
          <p className="mt-2 font-display text-2xl font-extrabold text-white">{me?.total || "-"}</p>
        </div>
      </div>

      <section className="rounded-lg border border-white/10 bg-black/35 p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-cyan-200" />
            <h3 className="font-display text-lg font-extrabold text-white">Asientos en vivo</h3>
          </div>
          <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm font-extrabold text-cyan-200">
            {table.seats.length}/{table.maxSeats}
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {table.seats.map((seat) => (
            <PvpSeat
              key={seat.userId}
              seat={seat}
              currentUserId={currentUser.id}
              active={seat.userId === table.currentTurnUserId}
              buyIn={table.buyIn}
            />
          ))}
        </div>
      </section>

      {table.phase === "playing" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button className="arcade-button w-full" onClick={() => onAction(table.id, "hit")} disabled={!isMyTurn}>
            <Hand size={18} />
            Pedir carta
          </button>
          <button className="danger-button w-full" onClick={() => onAction(table.id, "stand")} disabled={!isMyTurn}>
            <StepForward size={18} />
            Plantarse
          </button>
        </div>
      )}
    </div>
  );
}

function PlayerTablesLobby({ socket, world, currentUser, balance, state, now, onNotice }) {
  const [name, setName] = useState("Mesa PvP");
  const [buyIn, setBuyIn] = useState(100);
  const [error, setError] = useState("");
  const lastResultKey = useRef("");
  const limits = state.betLimits || { min: 25, max: null };
  const hasMax = Number.isFinite(limits.max);
  const buyInValue = Math.max(limits.min, Math.floor(Number(buyIn) || limits.min));
  const myTable = state.tables.find((table) => table.seats.some((seat) => seat.userId === currentUser.id));
  const openTables = state.tables.filter((table) => table.phase === "waiting").length;

  useEffect(() => {
    const settledTable = state.tables.find((table) =>
      table.phase === "settled" &&
      table.seats.some((seat) => seat.userId === currentUser.id && seat.outcome)
    );

    if (!settledTable) return;

    const seat = settledTable.seats.find((candidate) => candidate.userId === currentUser.id);
    const key = `${settledTable.id}-${seat.outcome}-${seat.payout}`;

    if (lastResultKey.current === key) return;

    lastResultKey.current = key;
    onNotice({
      tone: seat.outcome,
      title: seat.outcome === "win" ? "Pozo ganado" : "Pozo perdido",
      amount: seat.payout ? `+${formatMoney(seat.payout)}` : formatMoney(0),
      message:
        seat.outcome === "win"
          ? `Te llevaste el pozo de ${settledTable.name}.`
          : `La ronda de ${settledTable.name} termino. Reagrupa y vuelve a la mesa.`
    });
  }, [currentUser.id, onNotice, state.tables]);

  function createTable() {
    socket.emit("create_player_table", { worldId: world.id, name, buyIn: buyInValue }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo crear la mesa");
        return;
      }

      setError("");
    });
  }

  function joinTable(tableId) {
    socket.emit("join_player_table", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo entrar");
        return;
      }

      setError("");
    });
  }

  function leaveTable(tableId) {
    socket.emit("leave_player_table", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo salir");
        return;
      }

      setError("");
    });
  }

  function startTable(tableId) {
    socket.emit("start_player_table", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo iniciar");
        return;
      }

      setError("");
    });
  }

  function playerAction(tableId, action) {
    socket.emit("pvp_player_action", { worldId: world.id, tableId, action }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo procesar accion");
        return;
      }

      setError("");
    });
  }

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="grid gap-5">
        <div className="arcade-panel p-5">
          <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">Mesas PvP</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white">Jugadores vs jugadores</h2>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-center">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/60">Min</p>
                <p className="font-display text-lg font-extrabold text-amber-200">{formatMoney(limits.min)}</p>
              </div>
              <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-center">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/60">Tope</p>
                <p className="font-display text-lg font-extrabold text-emerald-200">Libre</p>
              </div>
              <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-center">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/60">Abiertas</p>
                <p className="font-display text-lg font-extrabold text-cyan-200">{openTables}</p>
              </div>
            </div>
          </div>

          {state.tables.length === 0 ? (
            <div className="rounded-md border border-dashed border-white/10 p-8 text-center">
              <p className="font-display text-xl font-extrabold text-white">No hay mesas PvP abiertas</p>
              <p className="mt-2 text-sm font-bold text-zinc-500">Crea una mesa y el buy-in queda reservado hasta que salgas o termine la ronda.</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {state.tables.map((table) => {
                const seated = table.seats.some((seat) => seat.userId === currentUser.id);
                const full = table.seats.length >= table.maxSeats;
                const isHost = table.hostId === currentUser.id;
                const startSeconds = table.startEndsAt ? Math.max(0, Math.ceil((table.startEndsAt - now) / 1000)) : 0;
                const turnSeconds = table.turnEndsAt ? Math.max(0, Math.ceil((table.turnEndsAt - now) / 1000)) : 0;
                const canJoin = table.phase === "waiting" && !seated && !full && balance >= table.buyIn && !myTable;
                const canLeave = seated && table.phase !== "settled";

                return (
                  <article key={table.id} className="rounded-lg border border-white/10 bg-black/35 p-4">
                    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate font-display text-xl font-extrabold text-white">{table.name}</h3>
                          <span
                            className={`rounded-md border px-2 py-1 text-xs font-extrabold uppercase tracking-[0.12em] ${
                              table.phase === "playing"
                                ? "border-cyan-300/30 bg-cyan-300/10 text-cyan-200"
                                : table.phase === "settled"
                                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                                  : "border-amber-300/30 bg-amber-300/10 text-amber-200"
                            }`}
                          >
                            {table.phase === "playing" ? "En juego" : table.phase === "settled" ? "Finalizada" : "Lobby"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-zinc-500">
                          {table.message || `${table.seats.length}/${table.maxSeats} sentados`}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:min-w-[300px]">
                        <div className="rounded-md border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-center">
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/60">Buy-in</p>
                          <p className="font-display text-lg font-extrabold text-amber-200">{formatMoney(table.buyIn)}</p>
                        </div>
                        <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-center">
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-200/60">Pozo</p>
                          <p className="font-display text-lg font-extrabold text-emerald-200">{formatMoney(table.pot)}</p>
                        </div>
                        <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-center">
                          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/60">Sillas</p>
                          <p className="font-display text-lg font-extrabold text-cyan-200">{table.seats.length}/{table.maxSeats}</p>
                        </div>
                      </div>
                    </div>

                    {table.phase === "waiting" && (
                      <div className="grid gap-4">
                        <div className="flex flex-wrap gap-2">
                          {table.seats.map((seat) => (
                            <span
                              key={seat.userId}
                              className={`rounded-md border px-2 py-1 text-xs font-extrabold ${
                                seat.userId === currentUser.id
                                  ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                                  : "border-cyan-300/20 bg-cyan-300/10 text-cyan-200"
                              }`}
                            >
                              {seat.username}{seat.userId === table.hostId ? " / host" : ""}
                            </span>
                          ))}
                        </div>

                        {table.startEndsAt && (
                          <div className="rounded-md border border-cyan-300/20 bg-cyan-300/10 p-3">
                            <TimerBar seconds={startSeconds} active totalSeconds={5} />
                          </div>
                        )}

                        <div className="grid gap-2 sm:grid-cols-3">
                          <button
                            className={seated ? "danger-button w-full" : "arcade-button w-full"}
                            onClick={() => (seated ? leaveTable(table.id) : joinTable(table.id))}
                            disabled={seated ? !canLeave : !canJoin}
                          >
                            {seated ? <RotateCcw size={18} /> : <UserPlus size={18} />}
                            {seated ? "Salir" : full ? "Llena" : myTable ? "Ya estas sentado" : "Sentarse"}
                          </button>
                          <button
                            className="ghost-button w-full sm:col-span-2"
                            onClick={() => startTable(table.id)}
                            disabled={!isHost || table.seats.length < 2}
                          >
                            <Zap size={18} />
                            Iniciar ahora
                          </button>
                        </div>
                      </div>
                    )}

                    {table.phase !== "waiting" && (
                      <PvpArena
                        table={table}
                        currentUser={currentUser}
                        turnSeconds={turnSeconds}
                        onAction={playerAction}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <aside className="arcade-panel p-5">
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">Crear mesa</p>
        <h3 className="mt-1 font-display text-xl font-extrabold text-white">Buy-in sin limite</h3>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-2">
            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Nombre</span>
            <input className="arcade-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={32} />
          </label>
          <label className="grid gap-2">
            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Buy-in</span>
            <input
              className="arcade-input"
              type="number"
              min={limits.min}
              max={hasMax ? limits.max : undefined}
              value={buyIn}
              onChange={(event) => setBuyIn(event.target.value)}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[100, 500, 1000].map((chip) => (
              <button key={chip} className="ghost-button px-2" onClick={() => setBuyIn(chip)}>
                {formatMoney(chip)}
              </button>
            ))}
          </div>
          <button
            className="arcade-button w-full"
            onClick={createTable}
            disabled={!socket?.connected || buyInValue > balance || (hasMax && buyInValue > limits.max) || !!myTable}
          >
            <Plus size={18} />
            Abrir mesa
          </button>
        </div>
        <div className="mt-4 rounded-md border border-white/10 bg-black/35 px-3 py-3 text-sm font-bold leading-6 text-zinc-400">
          El buy-in se descuenta al sentarte. Si sales antes de que empiece, vuelve a tu saldo; si la ronda empieza, se reparte el pozo al final.
        </div>
        {error && (
          <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
            {error}
          </div>
        )}
      </aside>
    </section>
  );
}

function TableSelection({ balance, onSelect }) {
  const choices = [
    {
      id: "ai",
      icon: Bot,
      eyebrow: "Mesa con dealer IA",
      title: "Blackjack contra la banca",
      accent: "border-cyan-300/40 bg-cyan-300/10 text-cyan-100",
      stat: "Cap $500",
      action: "Entrar a IA",
      details: ["Turnos con timer", "Dealer se planta en 17", "Apuesta reservada"]
    },
    {
      id: "pvp",
      icon: Swords,
      eyebrow: "Mesa con jugadores",
      title: "Mesas PvP sin limite",
      accent: "border-amber-300/40 bg-amber-300/10 text-amber-100",
      stat: "Sin limite",
      action: "Ver mesas PvP",
      details: ["Crea mesas privadas", "Turnos reales con timer", "Buy-in libre segun saldo"]
    }
  ];

  return (
    <section className="grid gap-5">
      <div className="arcade-panel overflow-hidden">
        <div className="border-b border-white/10 bg-black/40 p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">
            Blackjack
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-3xl font-extrabold text-white">Elige mesa</h2>
            <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 font-display text-sm font-extrabold text-emerald-200">
              Saldo ${Math.max(0, balance)}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {choices.map((choice) => {
            const Icon = choice.icon;

            return (
              <button
                key={choice.id}
                type="button"
                className={`group min-h-[300px] rounded-lg border p-5 text-left transition hover:-translate-y-1 hover:shadow-neon ${choice.accent}`}
                onClick={() => onSelect(choice.id)}
              >
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-md border border-white/10 bg-black/35">
                    <Icon size={28} />
                  </div>
                  <span className="rounded-md border border-white/10 bg-black/35 px-3 py-2 font-display text-sm font-extrabold">
                    {choice.stat}
                  </span>
                </div>

                <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-current/60">
                  {choice.eyebrow}
                </p>
                <h3 className="mt-2 font-display text-3xl font-extrabold text-white">
                  {choice.title}
                </h3>

                <div className="mt-5 grid gap-2">
                  {choice.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2 text-sm font-bold text-zinc-200">
                      <span className="h-2 w-2 rounded-full bg-current" />
                      {detail}
                    </div>
                  ))}
                </div>

                <div className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/10 px-4 py-2 text-sm font-extrabold text-white transition group-hover:bg-white/15">
                  {choice.action}
                  <StepForward size={18} />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function BlackjackTable({ socket, currentUser, world, balance }) {
  const [mode, setMode] = useState(null);
  const [bet, setBet] = useState(100);
  const [table, setTable] = useState({
    worldId: world.id,
    phase: "idle",
    message: "Mesa abierta",
    bettingEndsAt: null,
    turnEndsAt: null,
    betLimits: { min: 25, max: 500 },
    dealerCards: [],
    dealerTotal: null,
    currentTurnUserId: null,
    players: []
  });
  const [playerTables, setPlayerTables] = useState({
    worldId: world.id,
    betLimits: { min: 25, max: null },
    tables: []
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(null);
  const [now, setNow] = useState(Date.now());
  const lastAiResultKey = useRef("");

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 400);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    function handleState(nextTable) {
      if (nextTable.worldId === world.id) {
        setTable(nextTable);
        setError("");
      }
    }

    function handlePlayerTables(nextState) {
      if (nextState.worldId === world.id) {
        setPlayerTables(nextState);
      }
    }

    function handleError(payload) {
      setError(payload.message || "Error en la mesa");
    }

    function handlePlayerTableError(payload) {
      const message = payload.message || "Error en mesa PvP";
      setError(message);
      setNotice({
        tone: "lose",
        title: "Accion bloqueada",
        message
      });
    }

    socket.on("blackjack_state", handleState);
    socket.on("blackjack_error", handleError);
    socket.on("player_table_error", handlePlayerTableError);
    socket.on("player_tables_state", handlePlayerTables);
    socket.emit("request_blackjack_state", { worldId: world.id });
    socket.emit("request_player_tables", { worldId: world.id });

    return () => {
      socket.off("blackjack_state", handleState);
      socket.off("blackjack_error", handleError);
      socket.off("player_table_error", handlePlayerTableError);
      socket.off("player_tables_state", handlePlayerTables);
    };
  }, [socket, world.id]);

  const phase = table?.phase || "idle";
  const limits = table.betLimits || { min: 25, max: 1000 };
  const betValue = useMemo(() => Math.max(1, Math.floor(Number(bet) || 0)), [bet]);
  const me = table.players.find((player) => player.userId === currentUser.id);
  const currentTurnPlayer = table.players.find((player) => player.userId === table.currentTurnUserId);
  const isMyTurn = table.currentTurnUserId === currentUser.id && phase === "playing";
  const bettingSeconds = table.bettingEndsAt ? Math.max(0, Math.ceil((table.bettingEndsAt - now) / 1000)) : 0;
  const turnSeconds = table.turnEndsAt ? Math.max(0, Math.ceil((table.turnEndsAt - now) / 1000)) : 0;
  const tablePot = table.players.reduce((total, player) => total + player.bet, 0);
  const validBet = betValue >= limits.min && betValue <= limits.max;
  const canPlaceBet =
    socket?.connected &&
    validBet &&
    balance >= betValue &&
    (phase === "idle" || phase === "settled" || (phase === "betting" && !me));
  const myInstruction =
    phase === "idle"
      ? "Elige ficha y entra a la ronda"
      : phase === "betting"
        ? me
          ? "Apuesta reservada, esperando cierre"
          : "Aun puedes sentarte"
        : phase === "playing"
          ? isMyTurn
            ? "Decide antes del timer"
            : "Espera tu turno"
          : phase === "dealer"
            ? "La banca esta jugando"
            : me?.outcome
              ? `${outcomeLabel[me.outcome]} en esta ronda`
              : "Nueva ronda disponible";

  useEffect(() => {
    if (mode !== "ai" || phase !== "settled" || !me?.outcome) return;

    const key = `${table.roundId}-${me.outcome}-${me.payout}`;

    if (lastAiResultKey.current === key) return;

    lastAiResultKey.current = key;
    setNotice({
      tone: me.outcome,
      title: outcomeLabel[me.outcome] || "Ronda resuelta",
      amount: me.payout ? `+${formatMoney(me.payout)}` : formatMoney(0),
      message:
        me.outcome === "win"
          ? "La banca pago la ronda. Puedes volver a entrar cuando la mesa se reinicie."
          : me.outcome === "push"
            ? "Empate: recuperaste tu apuesta."
            : "La banca se quedo con esta mano. Ajusta apuesta y vuelve al siguiente ciclo."
    });
  }, [me?.outcome, me?.payout, mode, phase, table.roundId]);

  function placeBet() {
    if (!socket?.connected) {
      setError("Socket desconectado");
      return;
    }

    socket.emit("place_bet_multiplayer", { worldId: world.id, bet: betValue }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo apostar");
      }
    });
  }

  function playerAction(action) {
    if (!socket?.connected) {
      setError("Socket desconectado");
      return;
    }

    socket.emit("player_action", { worldId: world.id, action }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo procesar accion");
      }
    });
  }

  if (!mode) {
    return (
      <>
        <ResultModal notice={notice} onClose={() => setNotice(null)} />
        <TableSelection balance={balance} onSelect={setMode} />
      </>
    );
  }

  if (mode === "pvp") {
    return (
      <div className="grid gap-5">
        <ResultModal notice={notice} onClose={() => setNotice(null)} />
        <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/35 p-2 sm:flex-row sm:items-center sm:justify-between">
          <button className="ghost-button" onClick={() => setMode(null)}>
            <ArrowLeft size={18} />
            Cambiar mesa
          </button>
          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-sm font-extrabold text-amber-200">
            <Swords size={18} />
            Mesa con jugadores
          </div>
        </div>
        <PlayerTablesLobby
          socket={socket}
          world={world}
          currentUser={currentUser}
          balance={balance}
          state={playerTables}
          now={now}
          onNotice={setNotice}
        />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <ResultModal notice={notice} onClose={() => setNotice(null)} />
      <div className="flex flex-col gap-2 rounded-lg border border-white/10 bg-black/35 p-2 sm:flex-row sm:items-center sm:justify-between">
        <button className="ghost-button" onClick={() => setMode(null)}>
          <ArrowLeft size={18} />
          Cambiar mesa
        </button>
        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-extrabold text-cyan-200">
          <Bot size={18} />
          Mesa con dealer IA
        </div>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <PhaseBanner
            phase={phase}
            bettingSeconds={bettingSeconds}
            turnSeconds={turnSeconds}
            currentTurnPlayer={currentTurnPlayer}
            isMyTurn={isMyTurn}
            message={table.message}
          />

          <CommandCenter
            phase={phase}
            me={me}
            isMyTurn={isMyTurn}
            currentTurnPlayer={currentTurnPlayer}
            turnSeconds={turnSeconds}
            bettingSeconds={bettingSeconds}
            tablePot={tablePot}
            limits={limits}
          />

          <div className="arcade-panel p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-rose-200">
                  Casino sincronizado
                </p>
                <h2 className="mt-1 font-display text-2xl font-extrabold text-white">Blackjack Vs IA</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/60">Mesa</p>
                  <p className="font-display text-lg font-extrabold text-amber-200">${tablePot}</p>
                </div>
                <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/60">Jugadores</p>
                  <p className="font-display text-lg font-extrabold text-cyan-200">{table.players.length}</p>
                </div>
                <div className="rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-rose-200/60">Cap</p>
                  <p className="font-display text-lg font-extrabold text-rose-200">${limits.max}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <DealerHand table={table} />

              <section className="rounded-lg border border-white/10 bg-black/35 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-cyan-200" />
                    <h3 className="font-display text-lg font-extrabold text-white">Asientos</h3>
                  </div>
                  <span className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm font-extrabold text-cyan-200">
                    {table.players.length}
                  </span>
                </div>

                {table.players.length === 0 ? (
                  <div className="rounded-md border border-dashed border-white/10 p-6 text-center text-sm font-bold text-zinc-500">
                    La mesa esta vacia.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                    {table.players.map((player) => (
                      <PlayerSeat
                        key={player.userId}
                        player={player}
                        currentUserId={currentUser.id}
                        active={player.userId === table.currentTurnUserId}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <aside className="arcade-panel p-5">
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
            Tu control
          </p>
          <h3 className="mt-1 font-display text-xl font-extrabold text-white">{myInstruction}</h3>

          <div className="mt-4 rounded-lg border border-white/10 bg-black/35 p-4">
            <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">
              <Coins size={16} />
              Apuesta
            </label>
            <input
              className="arcade-input"
              type="number"
              min={limits.min}
              max={limits.max}
              value={bet}
              disabled={phase === "playing" || phase === "dealer" || !!me}
              onChange={(event) => setBet(event.target.value)}
            />
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[50, 100, 500].map((chip) => (
                <button
                  key={chip}
                  className="ghost-button px-2"
                  onClick={() => setBet(chip)}
                  disabled={phase === "playing" || phase === "dealer" || !!me}
                >
                  ${chip}
                </button>
              ))}
            </div>
            {!validBet && (
              <p className="mt-3 text-xs font-bold text-rose-200">
                Limite: ${limits.min} a ${limits.max}
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </div>
          )}

          <div className="mt-5 grid gap-3">
            {(phase === "idle" || phase === "betting" || phase === "settled") && (
              <button className="arcade-button w-full" onClick={placeBet} disabled={!canPlaceBet}>
                {phase === "settled" ? <RotateCcw size={18} /> : me ? <LockKeyhole size={18} /> : <BadgeDollarSign size={18} />}
                {phase === "settled" ? "Nueva apuesta" : me ? "Apuesta reservada" : "Confirmar apuesta"}
              </button>
            )}

            {phase === "betting" && (
              <div className="rounded-md border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-center text-sm font-extrabold text-amber-200">
                <Hourglass className="mr-2 inline" size={18} />
                Cierre en {bettingSeconds}s
              </div>
            )}

            {(phase === "playing" || phase === "dealer") && (
              <>
                <button className="arcade-button w-full" onClick={() => playerAction("hit")} disabled={!isMyTurn}>
                  <Hand size={18} />
                  Pedir carta
                </button>
                <button className="danger-button w-full" onClick={() => playerAction("stand")} disabled={!isMyTurn}>
                  <StepForward size={18} />
                  Plantarse
                </button>
              </>
            )}

            {phase === "settled" && me?.outcome && (
              <div
                className={`rounded-md border px-4 py-3 text-center font-display text-lg font-extrabold ${
                  me.outcome === "win"
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                    : me.outcome === "lose"
                      ? "border-rose-300/30 bg-rose-300/10 text-rose-200"
                      : "border-amber-300/30 bg-amber-300/10 text-amber-200"
                }`}
              >
                <Trophy className="mr-2 inline" size={20} />
                {outcomeLabel[me.outcome]}
              </div>
            )}

            <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-center font-display text-lg font-extrabold text-emerald-200">
              <CircleDollarSign className="mr-2 inline" size={20} />
              ${Math.max(0, balance)}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
