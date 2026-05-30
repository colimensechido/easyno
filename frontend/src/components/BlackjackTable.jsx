import {
  ArrowLeft,
  BadgeDollarSign,
  Bot,
  CircleDollarSign,
  Club,
  Coins,
  Crown,
  Diamond,
  Frown,
  Hand,
  Heart,
  Hourglass,
  LockKeyhole,
  PartyPopper,
  Plus,
  RotateCcw,
  Shield,
  Skull,
  Spade,
  Sparkles,
  StepForward,
  Swords,
  Trophy,
  UserPlus,
  Users,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { audio } from "../audio";
import { AnimatedButton } from "./shared";

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
        className={`playing-card-back animate-deal-card ${
          compact ? "w-16" : "w-24 sm:w-28"
        }`}
      >
        <div className="absolute inset-1.5 rounded-md border border-amber-300/40" />
        <div className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full border border-amber-300/50 bg-black/55 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em] text-amber-100">
          <LockKeyhole size={compact ? 9 : 10} />
          Oculta
        </div>
        <div className="relative flex h-full w-full items-center justify-center text-amber-300/80">
          <div className="rotate-12 text-shadow-gold">
            <Spade size={compact ? 20 : 28} />
          </div>
        </div>
      </div>
    );
  }

  const suit = suitInfo[card.suit] || suitInfo.S;
  const color = suit.red ? "text-rose-600" : "text-zinc-900";
  const SuitIcon = suit.symbol === "♠" ? Spade : suit.symbol === "♥" ? Heart : suit.symbol === "♦" ? Diamond : Club;

  return (
    <div
      className={`playing-card animate-deal-card ${compact ? "w-16 p-2" : "w-24 p-3 sm:w-28"}`}
      title={`${card.rank} de ${suit.name}`}
    >
      <div className={`flex items-center justify-between font-display font-extrabold ${compact ? "text-sm" : "text-lg"} ${color}`}>
        <span>{card.rank}</span>
        <SuitIcon size={compact ? 12 : 16} fill="currentColor" />
      </div>
      <div className="grid justify-items-center gap-1">
        <div className={`font-display font-extrabold leading-none ${compact ? "text-2xl" : "text-4xl"} ${color}`}>
          {cardValueLabel(card)}
        </div>
        <SuitIcon size={compact ? 22 : 36} fill="currentColor" className={color} />
      </div>
      <div className={`flex rotate-180 items-center justify-between font-display font-extrabold ${compact ? "text-sm" : "text-lg"} ${color}`}>
        <span>{card.rank}</span>
        <SuitIcon size={compact ? 12 : 16} fill="currentColor" />
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
      ? "border-amber-300/60 shadow-gold"
      : phase === "settled"
        ? "border-emerald-300/50 shadow-emeraldGlow"
        : phase === "betting"
          ? "border-amber-300/40 shadow-goldSoft"
          : "border-violet-300/30";

  const bg =
    phase === "playing" && isMyTurn
      ? "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(245,158,11,0.10))"
      : phase === "settled"
        ? "linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.10))"
        : phase === "betting"
          ? "linear-gradient(135deg, rgba(251,191,36,0.14), rgba(0,0,0,0.4))"
          : "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(0,0,0,0.5))";

  const title =
    phase === "idle"
      ? "Mesa abierta"
      : phase === "betting"
        ? `Apuestas: ${bettingSeconds}s`
        : phase === "playing"
          ? isMyTurn
            ? "TU TURNO"
            : `Turno de ${currentTurnPlayer?.username || "jugador"}`
          : phase === "dealer"
            ? "La banca revela"
            : "Ronda terminada";

  const Icon = phase === "betting" ? Hourglass : phase === "playing" ? Zap : phase === "settled" ? Trophy : Shield;

  return (
    <div className={`relative overflow-hidden rounded-xl border-2 p-4 ${tone}`} style={{ background: bg }}>
      {phase === "playing" && isMyTurn && (
        <div className="pointer-events-none absolute inset-0 opacity-30" style={{
          background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.4) 50%, transparent 70%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 2s linear infinite"
        }} />
      )}
      <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200/80">Fase actual</p>
          <h3 className={`mt-1 font-display text-2xl font-black sm:text-3xl ${isMyTurn && phase === "playing" ? "gold-text" : "text-white"}`}>
            {title}
          </h3>
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/35 px-3 py-2 text-sm font-extrabold text-zinc-100">
            <Icon size={18} className="text-amber-300" />
            {message}
          </div>
        </div>
        <TimerBar seconds={phase === "playing" ? turnSeconds : bettingSeconds} active={phase === "playing" || phase === "betting"} />
      </div>
    </div>
  );
}

// Lluvia de monedas para celebrar
function CoinShower({ count = 24 }) {
  const coins = useMemo(() =>
    Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.6,
      duration: 1.4 + Math.random() * 1.4,
      size: 12 + Math.random() * 14
    })), [count]);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {coins.map((c) => (
        <div
          key={c.id}
          className="absolute top-0 animate-coin-fall"
          style={{
            left: `${c.left}%`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`
          }}
        >
          <div
            className="rounded-full"
            style={{
              width: c.size,
              height: c.size,
              background: "radial-gradient(circle at 35% 30%, #fef3c7, #fbbf24 60%, #b8860b 100%)",
              boxShadow: "0 0 12px rgba(251,191,36,0.8)"
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Destellos / sparkles decorativos
function SparkleField() {
  const sparkles = useMemo(() =>
    Array.from({ length: 14 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 2,
      size: 8 + Math.random() * 8
    })), []);

  return (
    <div className="pointer-events-none absolute inset-0">
      {sparkles.map((s) => (
        <div
          key={s.id}
          className="absolute animate-sparkle text-amber-200"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            animationDelay: `${s.delay}s`
          }}
        >
          <Sparkles size={s.size} />
        </div>
      ))}
    </div>
  );
}

function ResultModal({ notice, onClose }) {
  if (!notice) return null;

  const isWin = notice.tone === "win";
  const isLose = notice.tone === "lose";
  const isPush = notice.tone === "push";

  const config = isWin
    ? {
        ring: "border-amber-300",
        bannerClass: "victory-banner",
        eyebrow: "GANASTE",
        eyebrowColor: "text-amber-900",
        titleColor: "text-amber-50 text-shadow-gold",
        Icon: Crown,
        iconColor: "text-amber-100",
        iconBg: "linear-gradient(135deg, #fbbf24, #b8860b)",
        amountClass: "text-amber-900 bg-amber-200/95 border-amber-700",
        msgColor: "text-amber-900",
        btnClass: "arcade-button",
        animation: "animate-bounce-in"
      }
    : isLose
      ? {
          ring: "border-rose-400",
          bannerClass: "defeat-banner",
          eyebrow: "PERDISTE",
          eyebrowColor: "text-rose-200",
          titleColor: "text-rose-50 text-shadow-ruby",
          Icon: Skull,
          iconColor: "text-rose-100",
          iconBg: "linear-gradient(135deg, #ef4444, #7f1d1d)",
          amountClass: "text-rose-50 bg-black/40 border-rose-300/30",
          msgColor: "text-rose-100",
          btnClass: "danger-button",
          animation: "animate-defeat-shake"
        }
      : {
          ring: "border-cyan-300",
          bannerClass: "push-banner",
          eyebrow: isPush ? "EMPATE" : "AVISO",
          eyebrowColor: "text-cyan-100",
          titleColor: "text-white",
          Icon: Shield,
          iconColor: "text-cyan-100",
          iconBg: "linear-gradient(135deg, #06b6d4, #0e7490)",
          amountClass: "text-white bg-black/40 border-cyan-300/30",
          msgColor: "text-cyan-50",
          btnClass: "arcade-button",
          animation: "animate-bounce-in"
        };

  const { Icon } = config;
  const buttonLabel = notice.buttonLabel || (isWin ? "Cobrar y seguir" : isLose ? "Nueva ronda" : "Continuar");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      {isWin && <CoinShower count={28} />}
      <div className={`relative w-full max-w-md ${config.animation}`}>
        <div className={`${config.bannerClass} relative overflow-hidden`}>
          {isWin && <SparkleField />}

          <div className="relative text-center">
            <p className={`text-xs font-black uppercase tracking-[0.42em] ${config.eyebrowColor}`}>
              {config.eyebrow}
            </p>

            <div className="mx-auto my-4 flex h-20 w-20 items-center justify-center rounded-full border-4 border-white/30 shadow-2xl" style={{ background: config.iconBg }}>
              <Icon size={42} className={config.iconColor} />
            </div>

            <h3 className={`font-display text-4xl font-black uppercase ${config.titleColor}`}>
              {notice.title}
            </h3>

            {notice.amount && (
              <div className={`mx-auto mt-5 inline-flex items-center gap-3 rounded-lg border-2 px-6 py-3 font-display text-3xl font-black ${config.amountClass} ${isWin ? "animate-victory-pulse" : ""}`}>
                {isWin && <Coins size={28} />}
                {notice.amount}
                {isWin && <Coins size={28} />}
              </div>
            )}

            <p className={`mt-5 text-sm font-bold leading-6 ${config.msgColor}`}>
              {notice.message}
            </p>
          </div>
        </div>

        <button className={`${config.btnClass} mt-4 w-full text-base`} onClick={onClose}>
          {isWin ? <PartyPopper size={20} /> : <StepForward size={20} />}
          {buttonLabel}
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
      <div className={`rounded-lg border-2 p-4 transition ${isMyTurn ? "border-amber-300/70 bg-amber-300/15 shadow-gold" : "border-white/10 bg-black/40"}`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">Accion</p>
        <p className="mt-2 font-display text-xl font-extrabold text-white">{action}</p>
      </div>
      <div className="rounded-lg border-2 border-cyan-300/30 bg-cyan-300/10 p-4">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-cyan-200/70">Tu mano</p>
        <p className="mt-2 font-display text-2xl font-black text-cyan-100">{myTotal ?? "-"}</p>
      </div>
      <div className={`rounded-lg border-2 p-4 transition ${turnSeconds <= 5 && phase === "playing" ? "border-rose-400/50 bg-rose-500/15 animate-defeat-shake" : "border-amber-300/30 bg-amber-300/10"}`}>
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">Reloj</p>
        <p className={`mt-2 font-display text-2xl font-black ${turnSeconds <= 5 && phase === "playing" ? "text-rose-200" : "text-amber-200"}`}>
          {phase === "playing" ? `${turnSeconds}s` : phase === "betting" ? `${bettingSeconds}s` : "-"}
        </p>
      </div>
      <div className="rounded-lg border-2 border-emerald-300/30 bg-emerald-300/10 p-4 shadow-emeraldGlow">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-200/70">Pozo / cap</p>
        <p className="mt-2 font-display text-xl font-black text-emerald-200">
          ${tablePot} / ${limits.max}
        </p>
      </div>
    </section>
  );
}

function DealerHand({ table }) {
  const total = table.dealerTotal ?? (table.dealerCards?.length ? handValue(table.dealerCards) : null);

  return (
    <section className="felt-panel p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-rose-300/60 shadow-ruby" style={{ background: "linear-gradient(135deg, #ef4444, #7f1d1d)" }}>
            <Bot size={20} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-rose-200/80">Crupier</p>
            <h3 className="font-display text-lg font-extrabold text-white">Banca IA</h3>
          </div>
        </div>
        <span className="rounded-md border border-rose-300/40 bg-rose-500/20 px-3 py-1.5 text-sm font-extrabold text-rose-100 shadow-ruby">
          {table.phase === "playing" ? "Total ?" : `Total ${total ?? "-"}`}
        </span>
      </div>
      <div className="flex min-h-36 flex-wrap items-end gap-3">
        {table.dealerCards?.length ? (
          table.dealerCards.map((card, index) => (
            <Card key={`${card.rank || "hidden"}-${card.suit || "x"}-${index}`} card={card} />
          ))
        ) : (
          <div className="flex h-32 w-24 items-center justify-center rounded-lg border-2 border-dashed border-amber-300/30 bg-black/30 text-amber-300/50 sm:w-28">
            <Spade size={28} />
          </div>
        )}
      </div>
    </section>
  );
}

// ===== Helpers compartidos para los asientos =====
const SEAT_AVATAR_GRADIENTS = [
  "linear-gradient(135deg, #fbbf24, #b8860b)",
  "linear-gradient(135deg, #f87171, #7f1d1d)",
  "linear-gradient(135deg, #34d399, #065f46)",
  "linear-gradient(135deg, #60a5fa, #1e3a8a)",
  "linear-gradient(135deg, #a78bfa, #4c1d95)",
  "linear-gradient(135deg, #fb923c, #7c2d12)",
  "linear-gradient(135deg, #f472b6, #831843)"
];

function seatGradient(username = "") {
  let h = 0;
  for (let i = 0; i < username.length; i++) h = (h * 31 + username.charCodeAt(i)) % SEAT_AVATAR_GRADIENTS.length;
  return SEAT_AVATAR_GRADIENTS[h];
}

function SeatAvatar({ username, size = 40 }) {
  const initial = (username?.[0] || "?").toUpperCase();
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full border-2 border-white/30 font-display font-black text-white shadow-[0_4px_10px_rgba(0,0,0,0.4)]"
      style={{ width: size, height: size, background: seatGradient(username), fontSize: size * 0.45 }}
    >
      {initial}
    </div>
  );
}

// Cartas desplegadas en abanico horizontal (con superposición).
// Para rivales se oculta solo la primera carta, como en Blackjack real.
function HandFan({ cards, emptyHint = "-", hideFirstOnly = false, spotlight = false }) {
  if (!cards?.length) {
    return (
      <div className={`flex h-28 items-center justify-center rounded-lg border-2 border-dashed bg-black/30 text-amber-300/40 ${spotlight ? "border-amber-300/45 shadow-goldSoft" : "border-amber-300/20"}`}>
        <span className="font-display text-sm font-extrabold uppercase tracking-[0.18em]">
          {emptyHint}
        </span>
      </div>
    );
  }

  // Cuando hay muchas cartas (>4) reducimos un poco más el solape para que no se salgan
  const overlap = cards.length <= 2 ? 0 : cards.length <= 4 ? 28 : 36;

  return (
    <div className={`relative flex items-end justify-center rounded-xl border px-2 py-3 transition ${spotlight ? "border-amber-300/45 bg-amber-300/8 shadow-gold animate-glow-pulse" : "border-white/8 bg-black/15"}`} style={{ minHeight: "7.5rem" }}>
      {cards.map((card, index) => {
        const total = cards.length;
        const mid = (total - 1) / 2;
        const angle = total === 1 ? 0 : (index - mid) * 4;
        const offsetY = total === 1 ? 0 : Math.abs(index - mid) * 2;
        const renderCard = hideFirstOnly && index === 0 ? { hidden: true } : card;
        return (
          <div
            key={`${card.rank || "h"}-${card.suit || "x"}-${index}`}
            className="relative transition-transform hover:-translate-y-2 hover:z-10"
            style={{
              marginLeft: index === 0 ? 0 : -overlap,
              transform: `rotate(${angle}deg) translateY(${offsetY}px)`,
              zIndex: index
            }}
          >
            <Card card={renderCard} compact />
          </div>
        );
      })}
    </div>
  );
}

// Pie del asiento: total + outcome con jerarquía
function SeatFooter({ total, outcome, payout, formatPayout, hideTotal = false }) {
  const outcomeStyles = {
    win: {
      cls: "border-amber-300 bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-gold animate-glow-pulse",
      Icon: Crown,
      label: "Ganaste"
    },
    lose: {
      cls: "border-rose-400 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-ruby",
      Icon: Frown,
      label: "Perdiste"
    },
    push: {
      cls: "border-cyan-300 bg-gradient-to-br from-cyan-400 to-cyan-600 text-cyan-950",
      Icon: Shield,
      label: "Empate"
    }
  };

  const o = outcome ? outcomeStyles[outcome] : null;

  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 rounded-md border-2 border-cyan-300/30 bg-cyan-300/10 px-3 py-1.5 font-display text-xs font-black uppercase tracking-wider text-cyan-100">
        Total <span className="text-base">{hideTotal ? "??" : (total || "-")}</span>
      </span>
      {o && (
        <span className={`inline-flex items-center gap-1.5 rounded-md border-2 px-3 py-1.5 font-display text-xs font-black uppercase tracking-wider ${o.cls}`}>
          <o.Icon size={14} />
          {o.label}
          {payout ? ` ${formatPayout ? formatPayout(payout) : `+$${payout}`}` : ""}
        </span>
      )}
    </div>
  );
}

function PlayerSeat({ player, currentUserId, active, phase }) {
  const isCurrentUser = player.userId === currentUserId;
  const connected = player.connected !== false;
  // Ocultar solo la primera carta y el total de rivales hasta que se resuelva la ronda.
  const hideRivalInfo = !isCurrentUser && phase !== "settled";
  const spotlightHand = isCurrentUser && ["betting", "playing", "dealer"].includes(phase);

  return (
    <article
      className={`relative overflow-hidden rounded-xl border-2 p-4 transition ${
        active
          ? "border-amber-300/70 pt-10 shadow-gold animate-glow-pulse"
          : isCurrentUser
            ? "border-amber-300/40"
            : "border-white/10"
      }`}
      style={{
        background: active
          ? "radial-gradient(ellipse at top, rgba(251,191,36,0.18), rgba(15,74,48,0.65) 60%, rgba(6,21,15,0.85))"
          : isCurrentUser
            ? "radial-gradient(ellipse at top, rgba(251,191,36,0.10), rgba(15,74,48,0.55) 60%, rgba(6,21,15,0.85))"
            : "radial-gradient(ellipse at top, rgba(124,58,237,0.08), rgba(10,36,24,0.7) 60%, rgba(6,21,15,0.85))"
      }}
    >
      {active && (
        <div className="absolute left-4 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.45)]">
          <Zap size={12} />
          Turno
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <SeatAvatar username={player.username} size={44} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-base font-black text-white">
            {player.username}
            {isCurrentUser ? " (tu)" : ""}
          </h4>
          <p className={`mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] ${connected ? "text-amber-200/70" : "text-rose-300"}`}>
            {connected ? (active ? "Turno activo" : statusLabel[player.status] || player.status) : "Desconectado"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-extrabold text-amber-100 shadow-goldSoft">
          <Coins size={12} />
          ${player.bet}
        </div>
      </div>

      <HandFan cards={player.cards} hideFirstOnly={hideRivalInfo} spotlight={spotlightHand} />

      <SeatFooter total={player.total} outcome={player.outcome} payout={player.payout} hideTotal={hideRivalInfo} />
    </article>
  );
}

function PvpSeat({ seat, currentUserId, active, buyIn, phase }) {
  const isCurrentUser = seat.userId === currentUserId;
  const cards = seat.cards || [];
  const connected = seat.connected !== false;
  const hideRivalInfo = !isCurrentUser && phase !== "settled";
  const spotlightHand = isCurrentUser && phase !== "waiting";

  return (
    <article
      className={`relative overflow-hidden rounded-xl border-2 p-4 transition ${
        active
          ? "border-amber-300/70 pt-10 shadow-gold animate-glow-pulse"
          : isCurrentUser
            ? "border-amber-300/40"
            : "border-white/10"
      }`}
      style={{
        background: active
          ? "radial-gradient(ellipse at top, rgba(251,191,36,0.18), rgba(15,74,48,0.65) 60%, rgba(6,21,15,0.85))"
          : isCurrentUser
            ? "radial-gradient(ellipse at top, rgba(251,191,36,0.10), rgba(15,74,48,0.55) 60%, rgba(6,21,15,0.85))"
            : "radial-gradient(ellipse at top, rgba(124,58,237,0.08), rgba(10,36,24,0.7) 60%, rgba(6,21,15,0.85))"
      }}
    >
      {active && (
        <div className="absolute left-4 top-3 z-10 inline-flex items-center gap-1.5 rounded-full border border-amber-200/90 bg-amber-300 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-amber-950 shadow-[0_8px_24px_rgba(251,191,36,0.45)]">
          <Zap size={12} />
          Turno
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <SeatAvatar username={seat.username} size={44} />
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-display text-base font-black text-white">
            {seat.username}
            {isCurrentUser ? " (tu)" : ""}
          </h4>
          <p className={`mt-0.5 text-[11px] font-bold uppercase tracking-[0.14em] ${connected ? "text-amber-200/70" : "text-rose-300"}`}>
            {connected ? (active ? "Turno activo" : statusLabel[seat.status] || seat.status) : "Desconectado"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-amber-300/40 bg-amber-300/15 px-2.5 py-1 text-xs font-extrabold text-amber-100 shadow-goldSoft">
          <Coins size={12} />
          {formatMoney(buyIn)}
        </div>
      </div>

      <HandFan cards={cards} hideFirstOnly={hideRivalInfo} spotlight={spotlightHand || active} />

      <SeatFooter total={seat.total} outcome={seat.outcome} payout={seat.payout} formatPayout={(p) => `+${formatMoney(p)}`} hideTotal={hideRivalInfo} />
    </article>
  );
}

function PvpArena({ table, currentUser, turnSeconds, rematchSeconds, onAction, onRequestRematch, onConfirmRematch }) {
  const [controlsOpen, setControlsOpen] = useState(false);
  const currentTurnSeat = table.seats.find((seat) => seat.userId === table.currentTurnUserId);
  const me = table.seats.find((seat) => seat.userId === currentUser.id);
  const isMyTurn = table.phase === "playing" && table.currentTurnUserId === currentUser.id;
  const isHost = table.hostId === currentUser.id;
  const activePlayers = table.seats.filter((seat) => seat.status === "playing").length;
  const connectedSeats = table.seats.filter((seat) => seat.connected !== false);
  const rematchConfirmations = new Set(table.rematchConfirmations || []);
  const rematchRequested = Boolean(table.rematchRequestedBy);
  const hasConfirmedRematch = rematchConfirmations.has(currentUser.id);
  const rematchConfirmedCount = connectedSeats.filter((seat) => rematchConfirmations.has(seat.userId)).length;
  const winnerNames = table.seats
    .filter((seat) => table.winners?.includes(seat.userId))
    .map((seat) => seat.username)
    .join(", ");

  useEffect(() => {
    if (table.phase === "playing") {
      setControlsOpen(false);
    }
  }, [table.id, table.phase]);

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
          <TimerBar
            seconds={table.phase === "settled" ? rematchSeconds : turnSeconds}
            active={table.phase === "playing" || table.phase === "settled"}
            totalSeconds={table.phase === "settled" ? 20 : 15}
          />
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

      <section className="felt-panel p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-amber-300" />
            <h3 className="font-display text-lg font-extrabold text-white">Asientos en vivo</h3>
          </div>
          <span className="rounded-md border-2 border-amber-300/40 bg-amber-300/15 px-3 py-1 font-display text-sm font-black text-amber-100 shadow-goldSoft">
            {table.seats.length}/{table.maxSeats}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {table.seats.map((seat) => (
            <PvpSeat
              key={seat.userId}
              seat={seat}
              currentUserId={currentUser.id}
              active={seat.userId === table.currentTurnUserId}
              buyIn={table.buyIn}
              phase={table.phase}
            />
          ))}
        </div>
      </section>

      {table.phase === "playing" && (
        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Controles</p>
              <p className="text-sm font-bold text-zinc-300">Abrelos solo cuando vayas a jugar tu mano.</p>
            </div>
            <button className="ghost-button" onClick={() => setControlsOpen((open) => !open)}>
              {controlsOpen ? <LockKeyhole size={18} /> : <Hand size={18} />}
              {controlsOpen ? "Ocultar controles" : "Mostrar controles"}
            </button>
          </div>

          {controlsOpen && (
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
      )}

      {table.phase === "settled" && (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">Revancha</p>
            <h4 className="mt-2 font-display text-xl font-extrabold text-white">
              {rematchRequested ? "Confirmaciones activas" : isHost ? "Tu decides si abres revancha" : "Esperando al anfitrion"}
            </h4>
            <p className="mt-2 text-sm font-bold text-zinc-300">
              {rematchRequested
                ? `${rematchConfirmedCount}/${connectedSeats.length} jugadores listos para volver a jugar.`
                : "Si no se arma la revancha a tiempo, la mesa vuelve al lobby."}
            </p>
          </div>
          <div className="grid gap-3">
            {isHost && !rematchRequested && (
              <button className="arcade-button w-full" onClick={() => onRequestRematch(table.id)}>
                <RotateCcw size={18} />
                Pedir revancha
              </button>
            )}
            {rematchRequested && !hasConfirmedRematch && (
              <button className="arcade-button w-full" onClick={() => onConfirmRematch(table.id)}>
                <Shield size={18} />
                Confirmar revancha
              </button>
            )}
            {rematchRequested && hasConfirmedRematch && (
              <button className="ghost-button w-full" disabled>
                <LockKeyhole size={18} />
                Esperando a los demas
              </button>
            )}
            {!isHost && !rematchRequested && (
              <button className="ghost-button w-full" disabled>
                <Hourglass size={18} />
                Esperando propuesta del host
              </button>
            )}
          </div>
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
  const showCreatePanel = !myTable || myTable.phase === "waiting";
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
      buttonLabel: "Cerrar",
      message:
        seat.outcome === "win"
          ? `Te llevaste el pozo de ${settledTable.name}.`
          : `La ronda de ${settledTable.name} termino. Si quieren otra mano, el host debe abrir la revancha.`
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

  function requestRematch(tableId) {
    socket.emit("request_player_table_rematch", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo pedir revancha");
        return;
      }

      setError("");
    });
  }

  function confirmRematch(tableId) {
    socket.emit("confirm_player_table_rematch", { worldId: world.id, tableId }, (response) => {
      if (!response?.ok) {
        setError(response?.error || "No se pudo confirmar revancha");
        return;
      }

      setError("");
    });
  }

  return (
    <section className={showCreatePanel ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]" : "grid gap-5"}>
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
                const rematchSeconds = table.rematchEndsAt ? Math.max(0, Math.ceil((table.rematchEndsAt - now) / 1000)) : 0;
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
                            <TimerBar seconds={startSeconds} active totalSeconds={180} />
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
                        rematchSeconds={rematchSeconds}
                        onAction={playerAction}
                        onRequestRematch={requestRematch}
                        onConfirmRematch={confirmRematch}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showCreatePanel && (
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
      )}
    </section>
  );
}

function TableSelection({ balance, onSelect }) {
  const choices = [
    {
      id: "ai",
      icon: Bot,
      eyebrow: "Mesa con dealer IA",
      title: "Vs la Banca",
      subtitle: "Blackjack clasico contra la casa",
      accent: "border-amber-300/50",
      bg: "linear-gradient(135deg, rgba(251,191,36,0.18), rgba(15,74,48,0.5))",
      chipClass: "chip-gold",
      stat: "Cap $500",
      action: "Entrar a la mesa",
      details: ["Turnos con timer", "Dealer se planta en 17", "Apuesta reservada"]
    },
    {
      id: "pvp",
      icon: Swords,
      eyebrow: "Mesa con jugadores",
      title: "Vs Jugadores",
      subtitle: "Mesas PvP sin limite de apuesta",
      accent: "border-rose-400/50",
      bg: "linear-gradient(135deg, rgba(220,38,38,0.22), rgba(15,74,48,0.5))",
      chipClass: "chip-red",
      stat: "Sin limite",
      action: "Ver mesas PvP",
      details: ["Crea mesas privadas", "Turnos reales con timer", "Buy-in libre segun saldo"]
    }
  ];

  return (
    <section className="grid gap-5">
      <div className="casino-panel overflow-hidden marquee-lights">
        <div className="border-b border-amber-300/15 bg-black/40 p-5">
          <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.28em] text-amber-200">
            <Spade size={14} />
            Blackjack &middot; Casino Arcade
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <h2 className="font-display text-4xl font-black"><span className="gold-text">Elige tu mesa</span></h2>
            <div className="flex items-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 font-display text-sm font-extrabold text-emerald-200 shadow-emeraldGlow">
              <Coins size={16} />
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
                className={`group relative min-h-[320px] overflow-hidden rounded-xl border-2 p-5 text-left text-white transition hover:-translate-y-1 ${choice.accent}`}
                style={{ background: choice.bg, boxShadow: "0 8px 28px rgba(0,0,0,0.5)" }}
                onClick={() => onSelect(choice.id)}
              >
                <div className="pointer-events-none absolute inset-0 opacity-0 transition group-hover:opacity-100" style={{
                  background: "radial-gradient(circle at center, rgba(251,191,36,0.18), transparent 60%)"
                }} />

                <div className="relative mb-5 flex items-start justify-between gap-3">
                  <div className={`chip ${choice.chipClass} scale-90`}>
                    <Icon size={22} />
                  </div>
                  <span className="rounded-md border border-amber-300/30 bg-black/40 px-3 py-2 font-display text-sm font-extrabold text-amber-200">
                    {choice.stat}
                  </span>
                </div>

                <p className="relative text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200/80">
                  {choice.eyebrow}
                </p>
                <h3 className="relative mt-2 font-display text-3xl font-black uppercase">
                  {choice.title}
                </h3>
                <p className="relative mt-1 text-sm font-semibold text-zinc-300">{choice.subtitle}</p>

                <div className="relative mt-5 grid gap-2">
                  {choice.details.map((detail) => (
                    <div key={detail} className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                      <Sparkles size={14} className="text-amber-300" />
                      {detail}
                    </div>
                  ))}
                </div>

                <div className="relative mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-amber-300/40 bg-black/40 px-4 py-2 text-sm font-extrabold text-amber-200 transition group-hover:bg-amber-300/15 group-hover:text-amber-100">
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
  const [aiControlsOpen, setAiControlsOpen] = useState(false);
  const lastAiResultKey = useRef("");
  const lastNoticeKeyRef = useRef(null);

  // Reproducir audio cada vez que aparezca un notice nuevo win/lose
  useEffect(() => {
    if (!notice) {
      lastNoticeKeyRef.current = null;
      return;
    }
    const key = `${notice.tone}-${notice.title}-${notice.amount || ""}-${notice.message || ""}`;
    if (lastNoticeKeyRef.current === key) return;
    lastNoticeKeyRef.current = key;
    if (notice.tone === "win") audio.play("win");
    else if (notice.tone === "lose") audio.play("pierdes");
  }, [notice]);

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
        buttonLabel: "Cerrar",
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
  const maxPlayers = table.maxPlayers || 12;
  const seatsFull = table.players.length >= maxPlayers;
  const validBet = betValue >= limits.min && betValue <= limits.max;
  const canPlaceBet =
    socket?.connected &&
    validBet &&
    balance >= betValue &&
    !seatsFull &&
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

  useEffect(() => {
    if (mode === "ai" && (phase === "playing" || phase === "dealer")) {
      setAiControlsOpen(false);
    }
  }, [mode, phase, table.roundId]);

  function placeBet() {
    if (!socket?.connected) {
      setError("Socket desconectado");
      return Promise.resolve();
    }

    // Devolvemos una promesa que se resuelve con el ack del servidor: asi el
    // AnimatedButton queda en estado "cargando" y bloquea el doble clic hasta
    // que la apuesta se confirma o falla.
    return new Promise((resolve) => {
      socket.emit("place_bet_multiplayer", { worldId: world.id, bet: betValue }, (response) => {
        if (!response?.ok) {
          setError(response?.error || "No se pudo apostar");
        }
        resolve();
      });
    });
  }

  function playerAction(action) {
    if (!socket?.connected) {
      setError("Socket desconectado");
      return Promise.resolve();
    }

    // Promesa resuelta con el ack: el boton se bloquea mientras la accion
    // (pedir carta / plantarse) viaja al servidor, evitando envios duplicados.
    return new Promise((resolve) => {
      socket.emit("player_action", { worldId: world.id, action }, (response) => {
        if (!response?.ok) {
          setError(response?.error || "No se pudo procesar accion");
        }
        resolve();
      });
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

          <div className="casino-panel marquee-lights p-5">
            <div className="mb-5 flex flex-col gap-3 border-b border-amber-300/15 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-rose-200">
                  <Heart size={12} fill="currentColor" />
                  Casino sincronizado
                </p>
                <h2 className="mt-1 font-display text-3xl font-black"><span className="gold-text">Blackjack Vs IA</span></h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-amber-200/60">Mesa</p>
                  <p className="font-display text-lg font-extrabold text-amber-200">${tablePot}</p>
                </div>
                <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-cyan-200/60">Jugadores</p>
                  <p className="font-display text-lg font-extrabold text-cyan-200">{table.players.length}/{maxPlayers}</p>
                </div>
                <div className="rounded-md border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-center">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-rose-200/60">Apuesta max</p>
                  <p className="font-display text-lg font-extrabold text-rose-200">${limits.max}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4">
              <DealerHand table={table} />

              <section className="felt-panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-amber-300" />
                    <h3 className="font-display text-lg font-extrabold text-white">Asientos</h3>
                  </div>
                  <span className="rounded-md border-2 border-amber-300/40 bg-amber-300/15 px-3 py-1 font-display text-sm font-black text-amber-100 shadow-goldSoft">
                    {table.players.length}/{maxPlayers}
                  </span>
                </div>

                {table.players.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-amber-300/20 bg-black/30 p-8 text-center">
                    <Spade className="mx-auto mb-2 text-amber-300/40" size={28} />
                    <p className="font-display text-sm font-extrabold uppercase tracking-[0.18em] text-zinc-500">
                      La mesa esta vacia
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {table.players.map((player) => (
                      <PlayerSeat
                        key={player.userId}
                        player={player}
                        currentUserId={currentUser.id}
                        active={player.userId === table.currentTurnUserId}
                        phase={phase}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        <aside className="casino-panel p-5">
          <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
            <Spade size={12} />
            Tu control
          </p>
          <h3 className="mt-1 font-display text-xl font-extrabold text-white">{myInstruction}</h3>

          <div className="mt-4 rounded-lg border border-amber-300/15 bg-black/40 p-4">
            <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">
              <Coins size={16} />
              Apuesta actual
            </label>
            <input
              className="arcade-input text-center font-display text-lg"
              type="number"
              min={limits.min}
              max={limits.max}
              value={bet}
              disabled={phase === "playing" || phase === "dealer" || !!me}
              onChange={(event) => setBet(event.target.value)}
            />
            <p className="mt-3 mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">Elige tu ficha</p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 50, cls: "chip-red" },
                { value: 100, cls: "chip-blue" },
                { value: 500, cls: "chip-gold" }
              ].map((chip) => (
                <button
                  key={chip.value}
                  className={`chip ${chip.cls} mx-auto scale-90 transition hover:scale-100 disabled:opacity-40 disabled:saturate-50`}
                  onClick={() => setBet(chip.value)}
                  disabled={phase === "playing" || phase === "dealer" || !!me}
                  type="button"
                >
                  ${chip.value}
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
              <AnimatedButton baseClassName="arcade-button w-full" onClick={placeBet} disabled={!canPlaceBet} ignoreGate>
                {phase === "settled" ? <RotateCcw size={18} /> : me ? <LockKeyhole size={18} /> : <BadgeDollarSign size={18} />}
                {phase === "settled"
                  ? seatsFull && !me
                    ? "Sala llena"
                    : "Nueva apuesta"
                  : me
                    ? "Apuesta reservada"
                    : seatsFull
                      ? "Sala llena"
                      : "Confirmar apuesta"}
              </AnimatedButton>
            )}

            {phase === "betting" && (
              <div className={`rounded-lg border-2 px-4 py-3 text-center font-display text-sm font-extrabold ${bettingSeconds <= 5 ? "border-rose-400 bg-rose-500/20 text-rose-100 animate-defeat-shake" : "border-amber-300/40 bg-amber-300/15 text-amber-100 shadow-goldSoft"}`}>
                <Hourglass className="mr-2 inline animate-spin-slow" size={18} />
                Cierre en <span className="text-shadow-gold">{bettingSeconds}s</span>
              </div>
            )}

            {(phase === "playing" || phase === "dealer") && (
              <div className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Controles</p>
                    <p className="text-sm font-bold text-zinc-300">Ocultalos para centrar la atencion en cartas y asientos.</p>
                  </div>
                  <button className="ghost-button" onClick={() => setAiControlsOpen((open) => !open)}>
                    {aiControlsOpen ? <LockKeyhole size={18} /> : <Hand size={18} />}
                    {aiControlsOpen ? "Ocultar controles" : "Mostrar controles"}
                  </button>
                </div>

                {aiControlsOpen && (
                  <div className="grid gap-3">
                    <AnimatedButton baseClassName="arcade-button w-full" onClick={() => playerAction("hit")} disabled={!isMyTurn} ignoreGate>
                      <Hand size={18} />
                      Pedir carta
                    </AnimatedButton>
                    <AnimatedButton baseClassName="danger-button w-full" onClick={() => playerAction("stand")} disabled={!isMyTurn} ignoreGate>
                      <StepForward size={18} />
                      Plantarse
                    </AnimatedButton>
                  </div>
                )}
              </div>
            )}

            {phase === "settled" && me?.outcome && (
              <div
                className={`relative overflow-hidden rounded-lg border-2 px-4 py-3 text-center font-display text-xl font-black uppercase ${
                  me.outcome === "win"
                    ? "border-amber-300 bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950 shadow-gold animate-glow-pulse"
                    : me.outcome === "lose"
                      ? "border-rose-400 bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-ruby"
                      : "border-cyan-300 bg-gradient-to-br from-cyan-400 to-cyan-600 text-cyan-950"
                }`}
              >
                {me.outcome === "win" ? <Crown className="mr-2 inline" size={22} /> : me.outcome === "lose" ? <Frown className="mr-2 inline" size={22} /> : <Shield className="mr-2 inline" size={22} />}
                {outcomeLabel[me.outcome]}
                {me.payout ? ` +$${me.payout}` : ""}
              </div>
            )}

            <div className="flex items-center justify-center gap-2 rounded-lg border-2 border-emerald-300/40 bg-emerald-300/10 px-4 py-3 font-display text-lg font-black text-emerald-200 shadow-emeraldGlow">
              <span className="coin"><CircleDollarSign size={12} /></span>
              <span>${Math.max(0, balance)}</span>
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
