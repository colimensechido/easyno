import { Coins, Loader2, Plus, RefreshCw, Rocket, SatelliteDish } from "lucide-react";
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
    <section className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">
            Mundo unico
          </p>
          <h2 className="mt-1 font-display text-3xl font-extrabold text-white">Sala principal</h2>
        </div>
        <button className="ghost-button" onClick={loadWorlds} title="Recargar estado">
          <RefreshCw size={18} />
          Recargar
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <article className="arcade-panel overflow-hidden">
          <div className="border-b border-white/10 bg-black/40 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md border border-cyan-300/40 bg-cyan-300/10 text-cyan-200">
                <SatelliteDish size={24} />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-zinc-500">
                  Estado de sala
                </p>
                <h3 className="font-display text-xl font-extrabold text-white">
                  {loading ? "Buscando mundo" : activeWorld ? activeWorld.name : "Sin mundo activo"}
                </h3>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Modo</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-white">1 Mundo</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Entrada</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-white">$5,000</p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/35 p-4">
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-zinc-500">Tu saldo</p>
              <p className="mt-2 font-display text-2xl font-extrabold text-emerald-200">
                {activeWorld?.balance == null ? "$5,000" : currency.format(activeWorld.balance)}
              </p>
            </div>
          </div>

          <div className="border-t border-white/10 p-5">
            {activeWorld ? (
              <button className="arcade-button w-full" onClick={() => joinWorld(activeWorld.id)}>
                <Rocket size={18} />
                Entrar a la sala
              </button>
            ) : (
              <div className="rounded-md border border-dashed border-white/10 p-5 text-center text-sm font-bold text-zinc-500">
                Crea la sala principal para abrir el casino.
              </div>
            )}
          </div>
        </article>

        <form className="arcade-panel p-5" onSubmit={createWorld}>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-200">
                Slot unico
              </p>
              <h3 className="mt-1 font-display text-2xl font-extrabold text-white">
                {activeWorld ? "Sala bloqueada" : "Crear sala"}
              </h3>
            </div>
            {activeWorld && (
              <div className="rounded-md border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-emerald-200">
                <Coins size={18} />
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
            <div className="mt-4 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
              {error}
            </div>
          )}
        </form>
      </div>
    </section>
  );
}
