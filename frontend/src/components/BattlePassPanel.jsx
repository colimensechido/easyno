import { Calendar, Check, Gem, Gift, Loader2, Sparkles, Target, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function formatEycon(units = 0) {
  return `${(Number(units || 0) / 100).toFixed(2)} EyCon`;
}

export default function BattlePassPanel({ token, onProfileChange }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [claimingKey, setClaimingKey] = useState("");

  function load() {
    setLoading(true);
    api("/api/progression/overview", { token })
      .then((data) => {
        setOverview(data);
        setError("");
      })
      .catch((err) => setError(err.message || "No se pudo cargar el progreso"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function refreshEyconProfile() {
    if (!onProfileChange) return;
    try {
      const profile = await api("/api/eycon/profile", { token });
      onProfileChange(profile);
    } catch {
      // silencioso: el balance se sincroniza por socket de todas formas
    }
  }

  async function claimBattlePass() {
    setClaimingKey("battlepass");
    try {
      const data = await api("/api/progression/battlepass/claim", { method: "POST", token });
      setOverview(data);
      setError("");
      await refreshEyconProfile();
    } catch (err) {
      setError(err.message || "No se pudo reclamar el pase de batalla");
    } finally {
      setClaimingKey("");
    }
  }

  async function claimMission(key) {
    setClaimingKey(key);
    try {
      const data = await api(`/api/progression/missions/${key}/claim`, { method: "POST", token });
      setOverview(data);
      setError("");
      await refreshEyconProfile();
    } catch (err) {
      setError(err.message || "No se pudo reclamar la mision");
    } finally {
      setClaimingKey("");
    }
  }

  if (loading && !overview) {
    return (
      <section className="battlepass-panel">
        <div className="battlepass-loading">
          <Loader2 size={28} className="animate-spin" />
          <p>Cargando tu progreso...</p>
        </div>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className="battlepass-panel">
        <div className="battlepass-loading">
          <p>{error || "No se pudo cargar el progreso"}</p>
        </div>
      </section>
    );
  }

  const { battlePass, missions, days, dailyGamesTarget, monopolyTurnsTarget } = overview;
  const dailyEarnedUnits = days.reduce(
    (sum, day) => sum + (day.dailyClaimed ? Number(day.rewardUnits || 0) : 0),
    0
  );

  return (
    <section className="battlepass-panel">
      <header className="battlepass-header">
        <div>
          <p className="battlepass-eyebrow"><Trophy size={15} /> Pase de batalla semanal</p>
          <h2>Juega toda la semana y gana EyCon</h2>
          <p className="battlepass-subtitle">
            Completa {dailyGamesTarget} partidas cada día (o una partida de BolowPoly de +{monopolyTurnsTarget} turnos) para
            marcar el día y recibir tu parte de los {battlePass.weeklyTotal.toFixed(0)} EyCon semanales.
            Si completas los 7 días, reclama una bonificación extra de +{battlePass.streakBonus.toFixed(0)} EyCon.
          </p>
        </div>
        <div className="battlepass-reward-chip">
          <span><Gem size={18} /> {formatEycon(battlePass.maxWeeklyUnits)}</span>
          <small>Hasta por semana</small>
        </div>
      </header>

      <div className="battlepass-week">
        {days.map((day, index) => (
          <div
            key={day.activityDate}
            className={`battlepass-day ${day.complete ? "is-complete" : ""} ${day.dailyClaimed ? "is-claimed" : ""}`}
          >
            <span className="battlepass-day-label">{DAY_LABELS[index] || day.activityDate.slice(5)}</span>
            <span className="battlepass-day-icon">{day.complete ? <Check size={16} /> : <Calendar size={14} />}</span>
            <span className="battlepass-day-progress">{day.gamesPlayed}/{dailyGamesTarget}</span>
            <span className="battlepass-day-reward">
              {day.dailyClaimed ? formatEycon(day.rewardUnits) : `+${(day.rewardUnits / 100).toFixed(2)}`}
            </span>
          </div>
        ))}
      </div>

      <div className="battlepass-claim-row">
        <p>
          {dailyEarnedUnits > 0 && (
            <>
              Esta semana llevas {formatEycon(dailyEarnedUnits)} de {formatEycon(battlePass.weeklyTotalUnits)} repartidos.{" "}
            </>
          )}
          {battlePass.claimed
            ? "Ya reclamaste la bonificación por racha completa."
            : battlePass.weekComplete
              ? "¡Racha completa! Reclama tus +2 EyCon extra."
              : "Completa los 7 días para desbloquear la bonificación extra."}
        </p>
        <button
          type="button"
          className="battlepass-claim-button"
          disabled={!battlePass.claimable || claimingKey === "battlepass"}
          onClick={claimBattlePass}
        >
          {claimingKey === "battlepass" ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />}
          {battlePass.claimed ? "Bonificación reclamada" : `+${battlePass.streakBonus.toFixed(0)} EyCon extra`}
        </button>
      </div>

      <header className="battlepass-header battlepass-header--missions">
        <div>
          <p className="battlepass-eyebrow"><Target size={15} /> Misiones diarias</p>
          <h3>Se reinician cada día</h3>
        </div>
      </header>

      <div className="battlepass-missions">
        {missions.map((mission) => (
          <article key={mission.key} className={`battlepass-mission ${mission.completed ? "is-complete" : ""}`}>
            <div className="battlepass-mission-icon">
              {mission.claimed ? <Check size={18} /> : <Sparkles size={18} />}
            </div>
            <div className="battlepass-mission-body">
              <h4>{mission.label}</h4>
              <div className="battlepass-mission-bar">
                <div
                  className="battlepass-mission-bar-fill"
                  style={{ width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }}
                />
              </div>
              <p>{mission.progress}/{mission.target}</p>
            </div>
            <div className="battlepass-mission-reward">
              <Gem size={14} />
              {formatEycon(mission.rewardUnits)}
            </div>
            <button
              type="button"
              className="battlepass-mission-claim"
              disabled={!mission.claimable || claimingKey === mission.key}
              onClick={() => claimMission(mission.key)}
            >
              {claimingKey === mission.key ? (
                <Loader2 size={14} className="animate-spin" />
              ) : mission.claimed ? (
                "Listo"
              ) : (
                "Reclamar"
              )}
            </button>
          </article>
        ))}
      </div>

      {error && <div className="battlepass-error">{error}</div>}
    </section>
  );
}
