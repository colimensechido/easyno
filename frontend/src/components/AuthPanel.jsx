import { AlertTriangle, Check, Lock, LogIn, User, UserPlus, X } from "lucide-react";
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
    <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 md:grid-cols-[minmax(0,1fr)_430px]">
      <div className="max-w-2xl">
        <div className="mb-5 inline-flex items-center gap-2 rounded-md border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-200">
          <Lock size={16} />
          Acceso arcade
        </div>
        <h1 className="font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
          Economy Arcade
        </h1>
        <p className="mt-5 max-w-xl text-lg font-semibold leading-8 text-zinc-300">
          Entra al casino compartido, trabaja por monedas y juega Blackjack contra la banca con otros jugadores.
        </p>
      </div>

      <form className="arcade-panel overflow-hidden" onSubmit={submit}>
        <div className="border-b border-white/10 bg-black/40 p-4">
          <div className="grid grid-cols-2 gap-2 rounded-md bg-black/50 p-1">
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
          <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-zinc-500">
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

          <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-zinc-500">
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
                        ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                        : "border-white/10 bg-white/5 text-zinc-500"
                    }`}
                  >
                    {rule.ok ? <Check size={14} /> : <X size={14} />}
                    {rule.label}
                  </div>
                ))}
              </div>

              <label className="mb-2 flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-zinc-500">
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
            {loading ? "Conectando" : mode === "login" ? "Entrar al mundo" : "Crear jugador"}
          </button>
        </div>
      </form>
    </section>
  );
}
