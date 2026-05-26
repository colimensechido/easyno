import { Club, Coins, Diamond, Heart, Loader2, Plus, RefreshCw, Rocket, SatelliteDish, Spade, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0
});

export default function WorldSelector({ token, onWorldJoined }) {
  const [worlds, setWorlds] = useState([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const activeWorld = worlds[0] || null;
  const canCreate = useMemo(() => name.trim().length >= 3 && !activeWorld, [name, activeWorld]);

  async function loadWorlds() {
    setError("");
    setLoading(true);
    try {
      const data = await api("/api/worlds", { token });
      setWorlds(data.worlds);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorlds();
  }, []);

  async function createWorld(event) {
    event.preventDefault();
    if (!canCreate) return;
    setError("");
    setCreating(true);

    try {
      const data = await api("/api/worlds/create", {
        method: "POST",
        token,
        body: { name }
      });
      onWorldJoined(data.world, data.balance);
    } catch (err) {
      setError(err.message);
      await loadWorlds();
    } finally {
      setCreating(false);
    }
  }

  async function joinWorld(worldId) {
    setError("");
    try {
      const data = await api("/api/worlds/join", {
        method: "POST",
        token,
        body: { worldId }
      });
      onWorldJoined(data.world, data.balance);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <section className="relative mx-auto max-w-5xl">
      {/* Hero header */}
      <div className="relative mb-7 overflow-hidden rounded-2xl border border-amber-300/25 p-6 shadow-gold marquee-lights" style={{
        background: "radial-gradient(ellipse at center, rgba(124,58,237,0.20) 0%, rgba(8,9,13,0.85) 60%), linear-gradient(135deg, rgba(184,134,11,0.18), rgba(0,0,0,0.85))"
      }}>
        <div className="absolute right-4 top-3 text-amber-300/15">
          <Spade size={140} strokeWidth={0.5} />
        </div>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.28em] text-amber-200">
              <Sparkles size={12} />
              Gran Salon
            </p>
            <h2 className="mt-3 font-display text-4xl font-black sm:text-5xl">
              <span className="gold-text">Sala principal</span>
            </h2>
            <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-zinc-300">
              Entra al casino compartido. Trabaja para conseguir fichas y arriesgalo todo en la mesa.
            </p>
          </div>

          <button className="ghost-button" onClick={loadWorlds} title="Recargar estado">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Recargar
          </button>
        </div>

        {/* fila de palos decorativos */}
        <div className="relative mt-6 flex items-center gap-3 text-amber-300/25">
          <Spade size={20} />
          <Heart size={20} className="text-rose-400/40" />
          <Diamond size={20} className="text-rose-400/40" />
          <Club size={20} />
          <div className="neon-divider flex-1" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="casino-panel overflow-hidden">
          <div className="border-b border-amber-300/15 bg-black/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-amber-300/40 bg-amber-300/10 text-amber-200 shadow-goldSoft">
                <SatelliteDish size={24} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200/70">
                  Estado de sala
                </p>
                <h3 className="font-display text-xl font-extrabold text-white">
                  {loading ? "Buscando mundo..." : activeWorld ? activeWorld.name : "Sin sala activa"}
                </h3>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg border border-violet-300/25 bg-violet-300/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-violet-200/70">Modo</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-violet-100">1 Mundo</p>
            </div>
            <div className="rounded-lg border border-amber-300/25 bg-amber-300/10 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200/70">Entrada</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-amber-200 text-shadow-gold">$5,000</p>
            </div>
            <div className="rounded-lg border border-emerald-300/25 bg-emerald-300/10 p-4 shadow-emeraldGlow">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-200/70">Tu saldo</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-emerald-200">
                {activeWorld?.balance == null ? "$5,000" : currency.format(activeWorld.balance)}
              </p>
            </div>
          </div>

          <div className="border-t border-amber-300/15 p-5">
            {activeWorld ? (
              <button className="arcade-button w-full text-base" onClick={() => joinWorld(activeWorld.id)}>
                <Rocket size={20} />
                Entrar al casino
              </button>
            ) : (
              <div className="rounded-lg border border-dashed border-amber-300/20 bg-black/30 p-6 text-center">
                <Sparkles className="mx-auto mb-2 text-amber-300/60" size={24} />
                <p className="text-sm font-bold text-zinc-400">
                  Crea la sala principal para abrir el casino.
                </p>
              </div>
            )}
          </div>
        </article>

        <form className="casino-panel p-5" onSubmit={createWorld}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
                Slot unico
              </p>
              <h3 className="mt-1 font-display text-2xl font-extrabold text-white">
                {activeWorld ? "Sala bloqueada" : "Crear sala"}
              </h3>
            </div>
            {activeWorld ? (
              <div className="chip chip-gold scale-75">
                <Coins size={20} />
              </div>
            ) : (
              <div className="chip chip-red scale-75">
                <Plus size={20} />
              </div>
            )}
          </div>

          <input
            className="arcade-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nombre del mundo"
            maxLength={48}
            disabled={!!activeWorld}
          />
          <button className="arcade-button mt-4 w-full" disabled={!canCreate || creating}>
            {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {activeWorld ? "Ya existe una sala" : "Crear sala principal"}
          </button>

          {error && (
            <div className="mt-4 rounded-md border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
