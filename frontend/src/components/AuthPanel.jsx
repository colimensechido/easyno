import { AlertTriangle, Check, Club, Diamond, Heart, Lock, LogIn, Spade, Sparkles, User, UserPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "../api";

const usernamePattern = /^[a-z0-9_]{3,16}$/;

function passwordRules(password) {
  return [
    { label: "8+ caracteres", ok: password.length >= 8 },
    { label: "Incluye letra", ok: /[a-zA-Z]/.test(password) },
    { label: "Incluye numero", ok: /[0-9]/.test(password) },
    { label: "Sin espacios", ok: password.length > 0 && !/\s/.test(password) }
  ];
}

export default function AuthPanel({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const cleanUsername = username.trim().toLowerCase();
  const rules = useMemo(() => passwordRules(password), [password]);
  const usernameOk = usernamePattern.test(cleanUsername);
  const passwordOk = rules.every((rule) => rule.ok);
  const confirmOk = mode === "login" || password === confirmPassword;
  const canSubmit =
    !loading &&
    usernameOk &&
    (mode === "login" ? password.length > 0 : passwordOk && confirmOk);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Revisa usuario y contrasena antes de continuar");
      return;
    }

    setLoading(true);

    try {
      const data = await api(`/api/auth/${mode}`, {
        method: "POST",
        body: { username: cleanUsername, password }
      });
      onAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_440px]">
      {/* fondos decorativos */}
      <div className="pointer-events-none absolute -left-12 top-12 hidden text-amber-300/10 md:block">
        <Spade size={220} strokeWidth={0.5} />
      </div>
      <div className="pointer-events-none absolute right-8 bottom-12 hidden text-rose-400/10 md:block">
        <Heart size={180} strokeWidth={0.5} />
      </div>

      <div className="relative z-10 max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.28em] text-amber-200 shadow-goldSoft">
          <Sparkles size={15} />
          Acceso VIP &middot; Casino Arcade
        </div>

        <h1 className="font-display text-5xl font-black leading-[1.05] sm:text-7xl">
          <span className="gold-text">Economy</span>
          <br />
          <span className="text-white drop-shadow-[0_0_20px_rgba(251,191,36,0.35)]">Arcade</span>
        </h1>

        <p className="mt-6 max-w-xl text-lg font-semibold leading-8 text-zinc-300">
          Entra al gran salon: apuesta, trabaja por monedas y juega Blackjack contra la banca o contra otros jugadores en mesas en vivo.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-200">
            <Sparkles size={14} />
            $5,000 de bienvenida
          </div>
          <div className="flex items-center gap-2 rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-amber-200">
            <Heart size={14} />
            Mesas en vivo
          </div>
          <div className="flex items-center gap-2 rounded-md border border-violet-300/30 bg-violet-300/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-violet-200">
            <Club size={14} />
            Chat global
          </div>
        </div>

        {/* fila de palos decorativos */}
        <div className="mt-10 flex items-center gap-3 text-amber-200/40">
          <Spade size={22} />
          <Heart size={22} className="text-rose-400/50" />
          <div className="neon-divider flex-1" />
          <Diamond size={22} className="text-rose-400/50" />
          <Club size={22} />
        </div>
      </div>

      <form className="casino-panel marquee-lights relative z-10 overflow-visible" onSubmit={submit}>
        <div className="relative border-b border-amber-300/15 bg-black/40 p-4">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-black/60 p-1">
            <button
              type="button"
              className={mode === "login" ? "arcade-button" : "ghost-button"}
              onClick={() => {
                setMode("login");
                setError("");
              }}
            >
              <LogIn size={18} />
              Entrar
            </button>
            <button
              type="button"
              className={mode === "register" ? "arcade-button" : "ghost-button"}
              onClick={() => {
                setMode("register");
                setError("");
              }}
            >
              <UserPlus size={18} />
              Registro
            </button>
          </div>
        </div>

        <div className="p-5">
          <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200/80">
            <User size={15} />
            Usuario
          </label>
          <input
            className="arcade-input mb-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="jugador_01"
            autoComplete="username"
            maxLength={16}
          />
          <div className={`mb-4 flex items-center gap-2 text-xs font-bold ${usernameOk || !username ? "text-zinc-500" : "text-rose-200"}`}>
            {usernameOk ? <Check size={14} /> : <X size={14} />}
            3 a 16 caracteres, solo letras, numeros o _
          </div>

          <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200/80">
            <Lock size={15} />
            Contrasena
          </label>
          <input
            className="arcade-input mb-3"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="minimo 8 caracteres"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />

          {mode === "register" && (
            <>
              <div className="mb-4 grid grid-cols-2 gap-2">
                {rules.map((rule) => (
                  <div
                    key={rule.label}
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-extrabold ${
                      rule.ok
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
                        : "border-white/10 bg-white/5 text-zinc-500"
                    }`}
                  >
                    {rule.ok ? <Check size={14} /> : <X size={14} />}
                    {rule.label}
                  </div>
                ))}
              </div>

              <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-amber-200/80">
                <Lock size={15} />
                Confirmar
              </label>
              <input
                className="arcade-input mb-2"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="repite tu contrasena"
                autoComplete="new-password"
              />
              <div className={`mb-4 flex items-center gap-2 text-xs font-bold ${confirmOk ? "text-emerald-200" : "text-rose-200"}`}>
                {confirmOk ? <Check size={14} /> : <X size={14} />}
                Las contrasenas coinciden
              </div>
            </>
          )}

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm font-bold text-rose-200">
              <AlertTriangle size={17} />
              {error}
            </div>
          )}

          <button className="arcade-button w-full" disabled={!canSubmit}>
            {mode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
            {loading ? "Conectando" : mode === "login" ? "Entrar al casino" : "Crear jugador"}
          </button>

          <p className="mt-4 text-center text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
            Apuesta responsable &middot; Solo diversion
          </p>
        </div>
      </form>
    </section>
  );
}
