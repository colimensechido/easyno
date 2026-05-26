import { Clock, Coins, MousePointer2, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { audio } from "../audio";

const SPOT_TEMPLATE = [
  { id: "salsa", x: 30, y: 32, size: 23, color: "rgba(120,53,15,.95)" },
  { id: "grasa", x: 63, y: 42, size: 28, color: "rgba(63,63,70,.88)" },
  { id: "cafe", x: 44, y: 66, size: 19, color: "rgba(161,98,7,.9)" },
  { id: "borde", x: 69, y: 70, size: 16, color: "rgba(87,83,78,.85)" },
  { id: "centro", x: 48, y: 45, size: 21, color: "rgba(146,64,14,.9)" }
];

function makeSpots() {
  return SPOT_TEMPLATE.map((spot) => ({ ...spot, clean: 0 }));
}

function averageClean(spots) {
  return spots.reduce((sum, spot) => sum + spot.clean, 0) / spots.length;
}

// Mini lluvia de monedas al ganar (versión ligera del componente del Blackjack)
function MiniCoinShower() {
  const coins = useMemo(() =>
    Array.from({ length: 16 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 1.4 + Math.random() * 1.4,
      size: 10 + Math.random() * 12
    })), []);

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
              boxShadow: "0 0 12px rgba(251,191,36,0.7)"
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function DishesGame({ token, world, onBalanceChange }) {
  const [status, setStatus] = useState("idle");
  const [spots, setSpots] = useState(makeSpots);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [reward, setReward] = useState(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const startRef = useRef(0);
  const finishedRef = useRef(false);
  const lastPointRef = useRef(null);
  const plateRef = useRef(null);

  useEffect(() => {
    if (status !== "running") return undefined;

    const id = window.setInterval(() => {
      setElapsedMs(performance.now() - startRef.current);
    }, 80);

    return () => window.clearInterval(id);
  }, [status]);

  const progress = Math.min(100, Math.round(averageClean(spots)));
  const dirtySpots = useMemo(() => spots.filter((spot) => spot.clean < 92).length, [spots]);

  function start() {
    finishedRef.current = false;
    lastPointRef.current = null;
    startRef.current = performance.now();
    setSpots(makeSpots());
    setElapsedMs(0);
    setReward(null);
    setError("");
    setDragging(false);
    setStatus("running");
  }

  async function finish(finalScore) {
    if (finishedRef.current) return;

    finishedRef.current = true;
    const durationMs = Math.max(0, performance.now() - startRef.current);
    setElapsedMs(durationMs);
    setDragging(false);
    setStatus("submitting");

    try {
      const data = await api("/api/game/reward-dishes", {
        method: "POST",
        token,
        body: {
          worldId: world.id,
          durationMs,
          scrubs: finalScore
        }
      });
      setReward(data.reward);
      onBalanceChange(data.balance);
      setStatus("done");
      audio.play("cleandish");
    } catch (err) {
      setError(err.message);
      setStatus("idle");
    }
  }

  function pointInPlate(event) {
    const plate = plateRef.current;

    if (!plate) return null;

    const rect = plate.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height
    };
  }

  function handlePointerDown(event) {
    if (status !== "running") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointInPlate(event);
    lastPointRef.current = point;
    setDragging(true);
  }

  function handlePointerMove(event) {
    if (status !== "running" || !dragging || !lastPointRef.current) return;

    const point = pointInPlate(event);
    const lastPoint = lastPointRef.current;

    if (!point) return;

    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    lastPointRef.current = point;

    if (distance < 1) return;

    setSpots((currentSpots) => {
      let changed = false;
      const nextSpots = currentSpots.map((spot) => {
        const spotX = (spot.x / 100) * point.width;
        const spotY = (spot.y / 100) * point.height;
        const radius = (spot.size / 100) * point.width * 0.75;
        const proximity = Math.max(0, 1 - Math.hypot(point.x - spotX, point.y - spotY) / radius);

        if (proximity <= 0) {
          return spot;
        }

        changed = true;
        return {
          ...spot,
          clean: Math.min(100, spot.clean + distance * proximity * 0.42)
        };
      });

      if (!changed) {
        return currentSpots;
      }

      if (averageClean(nextSpots) >= 100) {
        finish(100);
      }

      return nextSpots;
    });
  }

  function stopDrag() {
    setDragging(false);
    lastPointRef.current = null;
  }

  const seconds = (elapsedMs / 1000).toFixed(2);

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="casino-panel marquee-lights overflow-hidden">
        <div className="border-b border-amber-300/15 bg-black/40 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                <Sparkles size={12} />
                Trabajo seguro
              </p>
              <h2 className="mt-1 font-display text-3xl font-black"><span className="gold-text">Lavar Platos</span></h2>
            </div>
            <div className="flex items-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-3 py-2 font-display text-sm font-extrabold text-emerald-200 shadow-emeraldGlow">
              <Coins size={16} />
              Recompensa $25-$150
            </div>
          </div>
        </div>

        <div className="relative p-5">
          {/* Progreso */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">
              <span>Limpieza</span>
              <span className="text-shadow-gold">{progress}%</span>
            </div>
            <div className="h-5 overflow-hidden rounded-full border-2 border-amber-300/20 bg-black/60 shadow-inner">
              <div
                className="relative h-full transition-all"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #f87171, #fbbf24 50%, #10b981)"
                }}
              >
                <div className="absolute inset-0 opacity-50" style={{
                  background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.5) 50%, transparent 70%)",
                  backgroundSize: "200% 100%",
                  animation: "shimmer 1.6s linear infinite"
                }} />
              </div>
            </div>
          </div>

          <div
            className={`relative flex min-h-[400px] select-none items-center justify-center overflow-hidden rounded-xl border-2 p-6 text-center transition ${
              status === "running"
                ? "cursor-grab border-amber-300/50 shadow-gold active:cursor-grabbing"
                : "border-white/10"
            }`}
            style={{
              background: status === "running"
                ? "radial-gradient(ellipse at center, rgba(19,107,70,0.85), rgba(10,36,24,0.95))"
                : "radial-gradient(ellipse at center, rgba(15,74,48,0.6), rgba(10,36,24,0.95))"
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onPointerLeave={stopDrag}
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(251,191,36,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,.04)_1px,transparent_1px)] bg-[size:36px_36px]" />

            <div className="relative grid justify-items-center gap-5" style={{ touchAction: "none" }}>
              <div ref={plateRef} className={`relative h-64 w-64 rounded-full border-8 shadow-2xl transition ${status === "running" ? "border-amber-200" : "border-zinc-300"}`} style={{
                background: "radial-gradient(circle at 35% 25%, #ffffff, #e4e4e7 75%)"
              }}>
                <div className="absolute inset-8 rounded-full border-4 border-zinc-300/70 bg-white" />
                {spots.map((spot) => (
                  <div
                    key={spot.id}
                    className="absolute rounded-full blur-[1px] transition-all"
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      width: `${spot.size}%`,
                      height: `${spot.size}%`,
                      background: spot.color,
                      opacity: Math.max(0, 1 - spot.clean / 100),
                      transform: `translate(-50%, -50%) scale(${Math.max(0.25, 1 - spot.clean / 145)})`
                    }}
                  />
                ))}
                <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-cyan-300/50 bg-cyan-300/20 text-cyan-900 shadow-neon">
                  <Sparkles size={34} className={dragging ? "animate-sparkle" : ""} />
                </div>
              </div>

              <div>
                <p className={`font-display text-6xl font-black ${progress >= 95 ? "gold-text animate-victory-pulse" : "text-white"}`}>{progress}%</p>
                <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.22em] text-amber-200/70">
                  {status === "running"
                    ? dragging
                      ? "Fregando..."
                      : "Arrastra sobre las manchas"
                    : status === "submitting"
                      ? "Calculando recompensa..."
                      : "Listo para empezar"}
                </p>
              </div>
            </div>
          </div>

          {/* CARTEL DE PREMIO con explosión de monedas */}
          {reward != null && (
            <div className="relative mt-5">
              <div className="victory-banner relative animate-bounce-in">
                <MiniCoinShower />
                <div className="relative text-center">
                  <p className="text-xs font-black uppercase tracking-[0.42em] text-amber-900">
                    Trabajo completado
                  </p>
                  <div className="mx-auto my-3 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/40 shadow-2xl" style={{
                    background: "linear-gradient(135deg, #fef3c7, #fbbf24 60%, #b8860b)"
                  }}>
                    <Trophy size={32} className="text-amber-900" />
                  </div>
                  <h3 className="font-display text-3xl font-black uppercase text-amber-50 text-shadow-gold">
                    Ganaste
                  </h3>
                  <div className="mx-auto mt-3 inline-flex items-center gap-2 rounded-lg border-2 border-amber-700 bg-amber-200/95 px-5 py-2 font-display text-3xl font-black text-amber-900 animate-victory-pulse">
                    <Coins size={26} />
                    +${reward}
                    <Coins size={26} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-md border-2 border-rose-400/50 bg-rose-500/15 px-3 py-2 text-sm font-bold text-rose-100">
              {error}
            </div>
          )}
        </div>
      </div>

      <aside className="casino-panel p-5">
        <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
          <Target size={12} />
          Tablero
        </p>
        <h3 className="mt-1 mb-5 font-display text-xl font-extrabold text-white">Estado del turno</h3>

        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-lg border-2 border-cyan-300/30 bg-cyan-300/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-cyan-200/70">
              <Clock size={16} />
              <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Tiempo</span>
            </div>
            <p className="font-display text-2xl font-black text-cyan-100">{seconds}s</p>
          </div>
          <div className="rounded-lg border-2 border-rose-400/30 bg-rose-500/10 p-4">
            <div className="mb-2 flex items-center gap-2 text-rose-200/70">
              <Target size={16} />
              <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Manchas</span>
            </div>
            <p className="font-display text-2xl font-black text-rose-100">{dirtySpots}</p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border-2 border-amber-300/30 bg-amber-300/10 p-4 shadow-goldSoft">
          <div className="mb-2 flex items-center gap-2 text-amber-200/70">
            <MousePointer2 size={16} />
            <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Limpieza</span>
          </div>
          <p className="font-display text-4xl font-black text-amber-100 text-shadow-gold">{progress}%</p>
        </div>

        <button
          className={status === "running" ? "danger-button w-full" : "arcade-button w-full"}
          onClick={status === "running" ? () => setStatus("idle") : start}
          disabled={status === "submitting"}
        >
          {status === "running" ? <RotateCcw size={18} /> : <Sparkles size={18} />}
          {status === "running" ? "Cancelar ronda" : "Iniciar lavado"}
        </button>

        <p className="mt-3 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Limpia rapido para mejor pago
        </p>
      </aside>
    </section>
  );
}
