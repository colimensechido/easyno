import { Clock, MousePointer2, RotateCcw, Sparkles, Target, Trophy } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

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
      <div className="arcade-panel overflow-hidden">
        <div className="border-b border-white/10 bg-black/40 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">
                Trabajo seguro
              </p>
              <h2 className="mt-1 font-display text-2xl font-extrabold text-white">Lavar Platos</h2>
            </div>
            <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 font-display text-sm font-extrabold text-emerald-200">
              Recompensa $25-$150
            </div>
          </div>
        </div>

        <div className="p-5">
          <div className="mb-5 h-5 overflow-hidden rounded-md border border-white/10 bg-black/50">
            <div
              className="h-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-300 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={`relative flex min-h-[390px] select-none items-center justify-center overflow-hidden rounded-lg border p-6 text-center transition ${
              status === "running"
                ? "cursor-grab border-cyan-300/40 bg-cyan-300/10 shadow-neon active:cursor-grabbing"
                : "border-white/10 bg-black/35"
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerCancel={stopDrag}
            onPointerLeave={stopDrag}
            style={{ touchAction: "none" }}
          >
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:36px_36px]" />

            <div className="relative grid justify-items-center gap-5">
              <div ref={plateRef} className="relative h-64 w-64 rounded-full border-8 border-zinc-200 bg-zinc-100 shadow-2xl">
                <div className="absolute inset-8 rounded-full border-4 border-zinc-300 bg-white" />
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
                <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-cyan-300/50 bg-cyan-300/20 text-cyan-900">
                  <Sparkles size={34} />
                </div>
              </div>

              <div>
                <p className="font-display text-5xl font-extrabold text-white">{progress}%</p>
                <p className="mt-2 text-sm font-extrabold uppercase tracking-[0.2em] text-zinc-400">
                  {status === "running"
                    ? dragging
                      ? "Fregando manchas"
                      : "Arrastra sobre las manchas"
                    : status === "submitting"
                      ? "Calculando"
                      : "Listo"}
                </p>
              </div>
            </div>
          </div>

          {reward != null && (
            <div className="mt-5 flex items-center justify-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 p-4 text-center font-display text-2xl font-extrabold text-emerald-200">
              <Trophy size={24} />
              +${reward}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </div>
          )}
        </div>
      </div>

      <aside className="arcade-panel p-5">
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-white/10 bg-black/35 p-4">
            <div className="mb-2 flex items-center gap-2 text-zinc-500">
              <Clock size={17} />
              <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Tiempo</span>
            </div>
            <p className="font-display text-2xl font-extrabold text-white">{seconds}s</p>
          </div>
          <div className="rounded-md border border-white/10 bg-black/35 p-4">
            <div className="mb-2 flex items-center gap-2 text-zinc-500">
              <Target size={17} />
              <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Manchas</span>
            </div>
            <p className="font-display text-2xl font-extrabold text-white">{dirtySpots}</p>
          </div>
        </div>

        <div className="mb-5 rounded-md border border-cyan-300/20 bg-cyan-300/10 p-4">
          <div className="mb-2 flex items-center gap-2 text-cyan-200">
            <MousePointer2 size={17} />
            <span className="text-xs font-extrabold uppercase tracking-[0.16em]">Lavado</span>
          </div>
          <p className="font-display text-3xl font-extrabold text-white">{progress}%</p>
        </div>

        <button
          className={status === "running" ? "danger-button w-full" : "arcade-button w-full"}
          onClick={status === "running" ? () => setStatus("idle") : start}
          disabled={status === "submitting"}
        >
          {status === "running" ? <RotateCcw size={18} /> : <Sparkles size={18} />}
          {status === "running" ? "Cancelar ronda" : "Iniciar lavado"}
        </button>
      </aside>
    </section>
  );
}
