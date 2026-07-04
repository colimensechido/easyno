const BATTLE_PASS_WEEKLY_TOTAL_UNITS = 500; // 5.00 EyCon repartidos entre los 7 dias
const BATTLE_PASS_STREAK_BONUS_UNITS = 200; // +2.00 EyCon extra por racha completa
const BATTLE_PASS_DAILY_GAMES_TARGET = 5;
const BATTLE_PASS_MONOPOLY_TURNS_TARGET = 100;
const WEEK_LENGTH = 7;

const MISSIONS = [
  {
    key: "PLAY_ONE",
    label: "Juega 1 partida (cualquier juego)",
    target: 1,
    metric: "gamesPlayed",
    rewardUnits: 10
  },
  {
    key: "PLAY_BLACKJACK",
    label: "Juega 1 partida de Blackjack",
    target: 1,
    metric: "blackjackPlayed",
    rewardUnits: 10
  },
  {
    key: "WIN_BLACKJACK",
    label: "Gana 1 partida de Blackjack",
    target: 1,
    metric: "blackjackWins",
    rewardUnits: 10
  },
  {
    key: "PLAY_MONOPOLY",
    label: "Juega 1 partida de BolowPoly",
    target: 1,
    metric: "monopolyPlayed",
    rewardUnits: 10
  },
  {
    key: "PLAY_FIVE",
    label: "Juega 5 partidas hoy",
    target: 5,
    metric: "gamesPlayed",
    rewardUnits: 10
  }
];
const MISSIONS_BY_KEY = new Map(MISSIONS.map((mission) => [mission.key, mission]));

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function mondayOf(dateKey) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateKey, amount) {
  const d = new Date(`${dateKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}

function weekDaysFrom(weekStart) {
  return Array.from({ length: WEEK_LENGTH }, (_, index) => addDays(weekStart, index));
}

function emptyDay(activityDate) {
  return {
    activityDate,
    gamesPlayed: 0,
    blackjackPlayed: 0,
    blackjackWins: 0,
    monopolyPlayed: 0,
    monopolyMaxTurns: 0
  };
}

function isDayComplete(day) {
  return (
    day.gamesPlayed >= BATTLE_PASS_DAILY_GAMES_TARGET ||
    day.monopolyMaxTurns >= BATTLE_PASS_MONOPOLY_TURNS_TARGET
  );
}

function dailyRewardUnits(dayIndex) {
  const base = Math.floor(BATTLE_PASS_WEEKLY_TOTAL_UNITS / WEEK_LENGTH);
  const remainder = BATTLE_PASS_WEEKLY_TOTAL_UNITS % WEEK_LENGTH;
  return base + (dayIndex >= WEEK_LENGTH - remainder ? 1 : 0);
}

function createProgressionService({ get, run, all, creditReward }) {
  let queue = Promise.resolve();

  function serialize(work) {
    const next = queue.then(work, work);
    queue = next.catch(() => undefined);
    return next;
  }

  function clientError(message, status = 400) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  async function initSchema() {
    await run(`
      CREATE TABLE IF NOT EXISTS player_activity_daily (
        user_id INTEGER NOT NULL,
        activity_date TEXT NOT NULL,
        games_played INTEGER NOT NULL DEFAULT 0,
        blackjack_played INTEGER NOT NULL DEFAULT 0,
        blackjack_wins INTEGER NOT NULL DEFAULT 0,
        monopoly_played INTEGER NOT NULL DEFAULT 0,
        monopoly_max_turns INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, activity_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`CREATE INDEX IF NOT EXISTS idx_activity_daily_date ON player_activity_daily(activity_date)`);
    await run(`
      CREATE TABLE IF NOT EXISTS battle_pass_day_claims (
        user_id INTEGER NOT NULL,
        activity_date TEXT NOT NULL,
        week_start TEXT NOT NULL,
        reward_units INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, activity_date),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS battle_pass_claims (
        user_id INTEGER NOT NULL,
        week_start TEXT NOT NULL,
        reward_units INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, week_start),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`
      CREATE TABLE IF NOT EXISTS mission_claims (
        user_id INTEGER NOT NULL,
        activity_date TEXT NOT NULL,
        mission_key TEXT NOT NULL,
        reward_units INTEGER NOT NULL DEFAULT 0,
        claimed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, activity_date, mission_key),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
  }

  async function recordActivity({ userId, gameKey = "OTHER", won = false, monopolyTurns = 0 }) {
    if (!Number.isInteger(Number(userId))) return;
    const activityDate = todayKey();
    const isBlackjack = gameKey === "BLACKJACK";
    const isMonopoly = gameKey === "MONOPOLY";
    const turns = Math.max(0, Math.floor(Number(monopolyTurns) || 0));

    return serialize(async () => {
      await run(
        `INSERT INTO player_activity_daily (
          user_id, activity_date, games_played, blackjack_played, blackjack_wins,
          monopoly_played, monopoly_max_turns
        ) VALUES (?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(user_id, activity_date) DO UPDATE SET
          games_played = games_played + 1,
          blackjack_played = blackjack_played + excluded.blackjack_played,
          blackjack_wins = blackjack_wins + excluded.blackjack_wins,
          monopoly_played = monopoly_played + excluded.monopoly_played,
          monopoly_max_turns = MAX(monopoly_max_turns, excluded.monopoly_max_turns),
          updated_at = CURRENT_TIMESTAMP`,
        [
          userId,
          activityDate,
          isBlackjack ? 1 : 0,
          isBlackjack && won ? 1 : 0,
          isMonopoly ? 1 : 0,
          isMonopoly ? turns : 0
        ]
      );

      const [day] = await loadDays(userId, [activityDate]);
      if (isDayComplete(day)) {
        await maybeCreditDailyBattlePass(userId, activityDate);
      }
    });
  }

  async function maybeCreditDailyBattlePass(userId, activityDate) {
    return serialize(async () => {
      const weekStart = mondayOf(activityDate);
      const dayIndex = weekDaysFrom(weekStart).indexOf(activityDate);
      if (dayIndex < 0) return;

      const existing = await get(
        `SELECT 1 FROM battle_pass_day_claims WHERE user_id = ? AND activity_date = ?`,
        [userId, activityDate]
      );
      if (existing) return;

      const [day] = await loadDays(userId, [activityDate]);
      if (!isDayComplete(day)) return;

      const rewardUnits = dailyRewardUnits(dayIndex);
      await creditReward({
        userId,
        amountUnits: rewardUnits,
        movementType: "BATTLE_PASS_DAILY_REWARD",
        gameKey: null,
        referenceId: activityDate,
        description: `Recompensa diaria del pase de batalla (${activityDate})`,
        idempotencyKey: `battlepass-day:${userId}:${activityDate}`
      });

      await run(
        `INSERT INTO battle_pass_day_claims (user_id, activity_date, week_start, reward_units) VALUES (?, ?, ?, ?)`,
        [userId, activityDate, weekStart, rewardUnits]
      );
    });
  }

  async function syncPendingDailyRewards(userId, dateKeys) {
    const days = await loadDays(userId, dateKeys);
    for (const day of days) {
      if (!isDayComplete(day)) continue;
      await maybeCreditDailyBattlePass(userId, day.activityDate);
    }
  }

  async function loadDays(userId, dateKeys) {
    const rows = await all(
      `SELECT activity_date AS activityDate, games_played AS gamesPlayed,
              blackjack_played AS blackjackPlayed, blackjack_wins AS blackjackWins,
              monopoly_played AS monopolyPlayed, monopoly_max_turns AS monopolyMaxTurns
       FROM player_activity_daily
       WHERE user_id = ? AND activity_date IN (${dateKeys.map(() => "?").join(",")})`,
      [userId, ...dateKeys]
    );
    const byDate = new Map(rows.map((row) => [row.activityDate, row]));
    return dateKeys.map((date) => byDate.get(date) || emptyDay(date));
  }

  async function getOverview(userId) {
    const today = todayKey();
    const weekStart = mondayOf(today);
    const dateKeys = weekDaysFrom(weekStart);
    await syncPendingDailyRewards(userId, dateKeys);
    const days = await loadDays(userId, dateKeys);
    const daysWithStatus = days.map((day) => ({ ...day, complete: isDayComplete(day) }));
    const weekComplete = daysWithStatus.every((day) => day.complete);

    const claim = await get(
      `SELECT reward_units AS rewardUnits, claimed_at AS claimedAt
       FROM battle_pass_claims WHERE user_id = ? AND week_start = ?`,
      [userId, weekStart]
    );

    const dayClaimRows = await all(
      `SELECT activity_date AS activityDate, reward_units AS rewardUnits
       FROM battle_pass_day_claims
       WHERE user_id = ? AND activity_date IN (${dateKeys.map(() => "?").join(",")})`,
      [userId, ...dateKeys]
    );
    const dayClaimsByDate = new Map(dayClaimRows.map((row) => [row.activityDate, row]));

    const todayRow = daysWithStatus.find((day) => day.activityDate === today) || emptyDay(today);
    const claimedMissionRows = await all(
      `SELECT mission_key AS missionKey FROM mission_claims WHERE user_id = ? AND activity_date = ?`,
      [userId, today]
    );
    const claimedMissionKeys = new Set(claimedMissionRows.map((row) => row.missionKey));

    return {
      today,
      weekStart,
      weekEnd: dateKeys[dateKeys.length - 1],
      dailyGamesTarget: BATTLE_PASS_DAILY_GAMES_TARGET,
      monopolyTurnsTarget: BATTLE_PASS_MONOPOLY_TURNS_TARGET,
      days: daysWithStatus.map((day, index) => {
        const dayClaim = dayClaimsByDate.get(day.activityDate);
        const rewardUnits = dailyRewardUnits(index);
        return {
          ...day,
          rewardUnits,
          reward: rewardUnits / 100,
          dailyClaimed: Boolean(dayClaim)
        };
      }),
      battlePass: {
        weekComplete,
        claimed: Boolean(claim),
        claimable: weekComplete && !claim,
        rewardUnits: BATTLE_PASS_STREAK_BONUS_UNITS,
        reward: BATTLE_PASS_STREAK_BONUS_UNITS / 100,
        weeklyTotalUnits: BATTLE_PASS_WEEKLY_TOTAL_UNITS,
        weeklyTotal: BATTLE_PASS_WEEKLY_TOTAL_UNITS / 100,
        streakBonusUnits: BATTLE_PASS_STREAK_BONUS_UNITS,
        streakBonus: BATTLE_PASS_STREAK_BONUS_UNITS / 100,
        maxWeeklyUnits: BATTLE_PASS_WEEKLY_TOTAL_UNITS + BATTLE_PASS_STREAK_BONUS_UNITS,
        maxWeekly: (BATTLE_PASS_WEEKLY_TOTAL_UNITS + BATTLE_PASS_STREAK_BONUS_UNITS) / 100
      },
      missions: MISSIONS.map((mission) => {
        const progress = Math.min(mission.target, Number(todayRow[mission.metric] || 0));
        const completed = progress >= mission.target;
        const claimed = claimedMissionKeys.has(mission.key);
        return {
          key: mission.key,
          label: mission.label,
          target: mission.target,
          progress,
          completed,
          claimed,
          claimable: completed && !claimed,
          rewardUnits: mission.rewardUnits,
          reward: mission.rewardUnits / 100
        };
      })
    };
  }

  async function claimBattlePass(userId) {
    return serialize(async () => {
      const today = todayKey();
      const weekStart = mondayOf(today);
      const dateKeys = weekDaysFrom(weekStart);
      const days = await loadDays(userId, dateKeys);
      const weekComplete = days.every((day) => isDayComplete(day));

      if (!weekComplete) {
        throw clientError("Aun no completas los 7 dias de esta semana");
      }

      const existing = await get(
        `SELECT 1 FROM battle_pass_claims WHERE user_id = ? AND week_start = ?`,
        [userId, weekStart]
      );
      if (existing) {
        throw clientError("Ya reclamaste la recompensa de esta semana", 409);
      }

      await creditReward({
        userId,
        amountUnits: BATTLE_PASS_STREAK_BONUS_UNITS,
        movementType: "BATTLE_PASS_STREAK_BONUS",
        gameKey: null,
        referenceId: weekStart,
        description: "Bonificacion por racha semanal completa (+2 EyCon)",
        idempotencyKey: `battlepass-streak:${userId}:${weekStart}`
      });

      await run(
        `INSERT INTO battle_pass_claims (user_id, week_start, reward_units) VALUES (?, ?, ?)`,
        [userId, weekStart, BATTLE_PASS_STREAK_BONUS_UNITS]
      );

      return getOverview(userId);
    });
  }

  async function claimMission(userId, missionKey) {
    const mission = MISSIONS_BY_KEY.get(String(missionKey || "").toUpperCase());
    if (!mission) {
      throw clientError("Mision no encontrada", 404);
    }

    return serialize(async () => {
      const today = todayKey();
      const [todayRow] = await loadDays(userId, [today]);
      const progress = Number(todayRow[mission.metric] || 0);

      if (progress < mission.target) {
        throw clientError("Aun no completas esta mision");
      }

      const existing = await get(
        `SELECT 1 FROM mission_claims WHERE user_id = ? AND activity_date = ? AND mission_key = ?`,
        [userId, today, mission.key]
      );
      if (existing) {
        throw clientError("Ya reclamaste esta mision hoy", 409);
      }

      await creditReward({
        userId,
        amountUnits: mission.rewardUnits,
        movementType: "MISSION_REWARD",
        gameKey: null,
        referenceId: `${today}:${mission.key}`,
        description: mission.label,
        idempotencyKey: `mission:${userId}:${today}:${mission.key}`
      });

      await run(
        `INSERT INTO mission_claims (user_id, activity_date, mission_key, reward_units) VALUES (?, ?, ?, ?)`,
        [userId, today, mission.key, mission.rewardUnits]
      );

      return getOverview(userId);
    });
  }

  return {
    initSchema,
    recordActivity,
    getOverview,
    claimBattlePass,
    claimMission
  };
}

module.exports = {
  createProgressionService
};
