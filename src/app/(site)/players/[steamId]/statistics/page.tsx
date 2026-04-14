import { getPlayerStatisticsForProfile } from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";
import { getRelatedSteamIds } from "@/lib/player-aliases";
import PerformanceTracker, { type TrackerDataPoint } from "@/components/PerformanceTracker";

export const revalidate = 120;

const POSITION_CARD: Record<string, string> = {
  LW: "Attacking",
  RW: "Attacking",
  CF: "Attacking",
  CM: "Teamplay",
  RB: "Defending",
  CB: "Defending",
  LB: "Defending",
  GK: "Goalkeeping",
};

export default async function PlayerStatisticsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({
    where: { steamId },
    select: { iosoccerId: true, username: true },
  });

  // Derive position card highlight from most-played position (matches layout.tsx logic)
  const steamIds = await getRelatedSteamIds(steamId);
  const positionRows = await prisma.$queryRaw<{ position: string }[]>`
    SELECT position FROM match_player_stats
    WHERE player_steam_id = ANY(${steamIds}) AND position IS NOT NULL
    GROUP BY position ORDER BY COUNT(*) DESC LIMIT 1
  `;
  const derivedPosition = positionRows[0]?.position ?? null;
  const positionCard = (derivedPosition && POSITION_CARD[derivedPosition]) || null;

  // ── Performance Tracker data ──
  type PerfRow = {
    period: string;
    wins: bigint;
    draws: bigint;
    losses: bigint;
    total_goals: bigint;
    total_assists: bigint;
    total_goals_conceded: bigint;
    clean_sheets: bigint;
    potm: bigint;
    apps: bigint;
  };

  const buildPerfQuery = (groupExpr: string, dateFilter: string) =>
    prisma.$queryRawUnsafe<PerfRow[]>(
      `SELECT
         ${groupExpr} AS period,
         SUM(CASE WHEN (
           CASE WHEN mps.team_side = 'home' THEN m.home_score > m.away_score
                ELSE m.away_score > m.home_score END
         ) THEN 1 ELSE 0 END)::bigint AS wins,
         SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END)::bigint AS draws,
         SUM(CASE WHEN (
           CASE WHEN mps.team_side = 'home' THEN m.home_score < m.away_score
                ELSE m.away_score < m.home_score END
         ) THEN 1 ELSE 0 END)::bigint AS losses,
         SUM(mps.goals)::bigint AS total_goals,
         SUM(mps.assists)::bigint AS total_assists,
         SUM(mps.goals_conceded)::bigint AS total_goals_conceded,
         SUM(CASE WHEN mps.goals_conceded = 0 THEN 1 ELSE 0 END)::bigint AS clean_sheets,
         SUM(CASE WHEN mps.is_potm = true THEN 1 ELSE 0 END)::bigint AS potm,
         COUNT(*)::bigint AS apps
       FROM match_player_stats mps
       JOIN matches m ON m.id = mps.match_id
       WHERE mps.player_steam_id = ANY($1)
         ${dateFilter}
       GROUP BY period
       ORDER BY period`,
      steamIds,
    );

  const [monthlyRaw, weeklyRaw, last30Raw] = await Promise.all([
    buildPerfQuery(
      "TO_CHAR(m.date, 'YYYY-MM')",
      "AND m.date >= NOW() - INTERVAL '12 months'",
    ),
    buildPerfQuery(
      "TO_CHAR(m.date, 'IYYY-\"W\"IW')",
      "AND m.date >= NOW() - INTERVAL '52 weeks'",
    ),
    buildPerfQuery(
      "TO_CHAR(m.date, 'YYYY-MM-DD')",
      "AND m.date >= NOW() - INTERVAL '30 days'",
    ),
  ]);

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  function toTracker(rows: PerfRow[], labelFn: (p: string) => string): TrackerDataPoint[] {
    return rows.map((r) => {
      const apps = Number(r.apps);
      return {
        label: labelFn(r.period),
        wins: Number(r.wins),
        draws: Number(r.draws),
        losses: Number(r.losses),
        avgGoals: apps > 0 ? Number(r.total_goals) / apps : 0,
        avgAssists: apps > 0 ? Number(r.total_assists) / apps : 0,
        avgGoalsConceded: apps > 0 ? Number(r.total_goals_conceded) / apps : 0,
        cleanSheets: Number(r.clean_sheets),
        potm: Number(r.potm),
        appearances: apps,
      };
    });
  }

  const emptyPoint: TrackerDataPoint = { label: "", wins: 0, draws: 0, losses: 0, avgGoals: 0, avgAssists: 0, avgGoalsConceded: 0, cleanSheets: 0, potm: 0, appearances: 0 };

  // Fill gaps so spacing is uniform on X axis
  function fillMonthly(rows: PerfRow[]): TrackerDataPoint[] {
    if (rows.length === 0) return [];
    const map = new Map<string, TrackerDataPoint>();
    for (const r of rows) {
      const [y, m] = r.period.split("-");
      const label = `${m}/${y.slice(2)}`;
      const apps = Number(r.apps);
      map.set(r.period, {
        label, wins: Number(r.wins), draws: Number(r.draws), losses: Number(r.losses),
        avgGoals: apps > 0 ? Number(r.total_goals) / apps : 0,
        avgAssists: apps > 0 ? Number(r.total_assists) / apps : 0,
        avgGoalsConceded: apps > 0 ? Number(r.total_goals_conceded) / apps : 0,
        cleanSheets: Number(r.clean_sheets), potm: Number(r.potm), appearances: apps,
      });
    }
    const first = rows[0].period;
    const last = rows[rows.length - 1].period;
    const result: TrackerDataPoint[] = [];
    let [cy, cm] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    while (cy < ly || (cy === ly && cm <= lm)) {
      const key = `${cy}-${String(cm).padStart(2, "0")}`;
      const label = `${String(cm).padStart(2, "0")}/${String(cy).slice(2)}`;
      result.push(map.get(key) ?? { ...emptyPoint, label });
      cm++;
      if (cm > 12) { cm = 1; cy++; }
    }
    return result;
  }

  // Convert ISO year+week to the Monday date of that week
  function isoWeekToDate(year: number, week: number): Date {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7; // Mon=1 ... Sun=7
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7);
    return monday;
  }

  function weekLabel(year: number, week: number): string {
    const d = isoWeekToDate(year, week);
    const day = String(d.getUTCDate()).padStart(2, "0");
    const mon = MONTH_NAMES[d.getUTCMonth()];
    return `${mon} ${day}`;
  }

  function fillWeekly(rows: PerfRow[]): TrackerDataPoint[] {
    if (rows.length === 0) return [];
    const map = new Map<string, TrackerDataPoint>();
    const parseISOWeek = (s: string) => {
      const [y, w] = s.split("-W").map(Number);
      return { year: y, week: w };
    };
    for (const r of rows) {
      const { year, week } = parseISOWeek(r.period);
      const label = weekLabel(year, week);
      const apps = Number(r.apps);
      map.set(r.period, {
        label, wins: Number(r.wins), draws: Number(r.draws), losses: Number(r.losses),
        avgGoals: apps > 0 ? Number(r.total_goals) / apps : 0,
        avgAssists: apps > 0 ? Number(r.total_assists) / apps : 0,
        avgGoalsConceded: apps > 0 ? Number(r.total_goals_conceded) / apps : 0,
        cleanSheets: Number(r.clean_sheets), potm: Number(r.potm), appearances: apps,
      });
    }
    const first = parseISOWeek(rows[0].period);
    const last = parseISOWeek(rows[rows.length - 1].period);
    const result: TrackerDataPoint[] = [];
    let { year: cy, week: cw } = first;
    while (cy < last.year || (cy === last.year && cw <= last.week)) {
      const key = `${cy}-W${String(cw).padStart(2, "0")}`;
      const label = weekLabel(cy, cw);
      result.push(map.get(key) ?? { ...emptyPoint, label });
      cw++;
      if (cw > 52) { cw = 1; cy++; }
    }
    return result;
  }

  const monthlyData = fillMonthly(monthlyRaw);
  const weeklyData = fillWeekly(weeklyRaw);
  const last30Data = toTracker(last30Raw, (p) => {
    const d = new Date(p + "T00:00:00Z");
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });

  let stats = null;
  try {
    stats = await getPlayerStatisticsForProfile({
      steamId,
      iosoccerId: player?.iosoccerId ?? null,
      username: player?.username ?? null,
    });
  } catch {
    stats = null;
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-chalk-400 font-body">
        Player statistics are temporarily unavailable. Please retry in a moment.
      </div>
    );
  }

  const apps = Number(stats.appearances ?? 0);
  const asSub = Number(stats.substituteAppearances ?? 0);
  const wins = Number(stats.wins ?? 0);
  const draws = Number(stats.draws ?? 0);
  const losses = Number(stats.losses ?? 0);
  const goals = Number(stats.goals ?? 0);
  const assists = Number(stats.assists ?? 0);
  const secondAssists = Number(stats.secondAssists ?? 0);
  const avgSecondAssists = Number(stats.secondAssistsAverage ?? 0);
  const shots = Number(stats.shots ?? 0);
  const shotsOnTarget = Number(stats.shotsOnGoal ?? 0);
  const passes = Number(stats.passes ?? 0);
  const passesCompleted = Number(stats.passesCompleted ?? 0);
  const keyPasses = Number(stats.keyPasses ?? 0);
  const avgKeyPasses = Number(stats.keyPassesAverage ?? 0);
  const chancesCreated = Number(stats.chancesCreated ?? 0);
  const avgChancesCreated = Number(stats.chancesCreatedAverage ?? 0);
  const saves = Number(stats.keeperSaves ?? 0);
  const savesCaught = Math.round(Number(stats.keeperSavesCaughtAverage ?? 0) * apps);
  const goalsConceded = Number(stats.goalsConceded ?? 0);
  const ownGoals = Number(stats.ownGoals ?? 0);
  const fouls = Number(stats.fouls ?? 0);
  const foulsSuffered = Number(stats.foulsSuffered ?? 0);
  const yellows = Number(stats.yellowCards ?? 0);
  const reds = Number(stats.redCards ?? 0);
  const interceptions = Number(stats.interceptions ?? 0);
  const tackles = Math.round(Number(stats.slidingTacklesAverage ?? 0) * apps);
  const tacklesCompleted = Math.round(Number(stats.slidingTacklesCompletedAverage ?? 0) * apps);
  const offsides = Number(stats.offsides ?? 0);
  const distance = Math.round(Number(stats.distanceCoveredAverage ?? 0) * apps);

  const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(1) : "0";
  const shotAccuracyRaw = Number(stats.shotAccuracyPercentage ?? 0);
  const passAccuracyRaw = Number(stats.passCompletionPercentageAverage ?? 0);
  const shotAcc = shotAccuracyRaw > 0 && shotAccuracyRaw <= 1 ? (shotAccuracyRaw * 100).toFixed(1) : shotAccuracyRaw.toFixed(1);
  const passAcc = passAccuracyRaw > 0 && passAccuracyRaw <= 1 ? (passAccuracyRaw * 100).toFixed(1) : passAccuracyRaw.toFixed(1);
  const savePct = saves + goalsConceded > 0 ? ((saves / (saves + goalsConceded)) * 100).toFixed(1) : "0";
  const tackleAcc = tackles > 0 ? ((tacklesCompleted / tackles) * 100).toFixed(1) : "0";
  const perApp = (v: number) => apps > 0 ? (v / apps).toFixed(2) : "0.00";
  const avgDistance = apps > 0 ? (distance / apps / 1000).toFixed(2) : "0";

  return (
    <>
      {/* Performance Tracker */}
      <PerformanceTracker
        monthly={monthlyData}
        weekly={weeklyData}
        last30={last30Data}
      />

      {/* Detailed Stats - 3 column grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* General */}
        <StatCard title="General" rows={[
          { label: "Appearances", value: apps.toLocaleString() },
          { label: "As Substitute", value: asSub.toLocaleString() },
          { label: "Wins", value: wins.toLocaleString(), color: "text-grass-500" },
          { label: "Draws", value: draws.toLocaleString() },
          { label: "Losses", value: losses.toLocaleString(), color: "text-red-400" },
          {
            label: "Win Rate",
            value: `${winPct}%`,
            color: Number(winPct) > 55 ? "wr-elite" : Number(winPct) >= 50 ? "text-green-400" : "text-red-400",
          },
        ]}
          footer={apps > 0 ? (
            <div className="mt-3">
              <div className="flex h-4 rounded-full overflow-hidden bg-pitch-700">
                {(() => {
                  const winPct2 = (wins / apps) * 100;
                  const drawPct2 = (draws / apps) * 100;
                  const lossPct2 = (losses / apps) * 100;
                  return (
                    <>
                      {winPct2 >= 1 && (
                        <div className="bg-grass-500 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${winPct2}%` }}>
                          {winPct2.toFixed(0)}%
                        </div>
                      )}
                      {drawPct2 >= 1 && (
                        <div className="bg-chalk-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${drawPct2}%` }}>
                          {drawPct2.toFixed(0)}%
                        </div>
                      )}
                      {lossPct2 >= 1 && (
                        <div className="bg-red-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${lossPct2}%` }}>
                          {lossPct2.toFixed(0)}%
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : undefined}
        />

        {/* Teamplay */}
        <StatCard positionCard={positionCard} title="Teamplay" rows={[
          { label: "Assists", value: `${assists.toLocaleString()} (${perApp(assists)})` },
          { label: "Passes", value: `${passes.toLocaleString()} (${perApp(passes)})` },
          { label: "Passes Completed", value: `${passesCompleted.toLocaleString()} (${perApp(passesCompleted)})` },
          { label: "Pass Accuracy", value: `${passAcc}%` },
          { label: "Key Passes", value: `${keyPasses.toLocaleString()} (${avgKeyPasses.toFixed(2)})` },
          { label: "Chances Created", value: `${chancesCreated.toLocaleString()} (${avgChancesCreated.toFixed(2)})` },
          { label: "Second Assists", value: `${secondAssists.toLocaleString()} (${avgSecondAssists.toFixed(2)})` },
        ]} />

        {/* Discipline */}
        <StatCard title="Discipline" rows={[
          { label: "Fouls", value: `${fouls.toLocaleString()} (${perApp(fouls)})` },
          { label: "Fouls Suffered", value: `${foulsSuffered.toLocaleString()} (${perApp(foulsSuffered)})` },
          { label: "Yellow Cards", value: `${yellows.toLocaleString()} (${perApp(yellows)})`, color: "text-amber-500" },
          { label: "Red Cards", value: `${reds.toLocaleString()} (${perApp(reds)})`, color: "text-red-400" },
          { label: "Offsides", value: `${offsides.toLocaleString()} (${perApp(offsides)})` },
        ]} />

        {/* Goalkeeping */}
        <StatCard positionCard={positionCard} title="Goalkeeping" rows={[
          { label: "Saves", value: `${saves.toLocaleString()} (${perApp(saves)})` },
          { label: "Saves Caught", value: `${savesCaught.toLocaleString()} (${perApp(savesCaught)})` },
          { label: "Save Percentage", value: `${savePct}%` },
          { label: "Goals Conceded", value: `${goalsConceded.toLocaleString()} (${perApp(goalsConceded)})` },
          { label: "Own Goals", value: ownGoals.toLocaleString() },
        ]} />

        {/* Defending */}
        <StatCard positionCard={positionCard} title="Defending" rows={[
          { label: "Interceptions", value: `${interceptions.toLocaleString()} (${perApp(interceptions)})` },
          { label: "Tackles", value: `${tackles.toLocaleString()} (${perApp(tackles)})` },
          { label: "Tackles Completed", value: `${tacklesCompleted.toLocaleString()} (${perApp(tacklesCompleted)})` },
          { label: "Tackle Accuracy", value: `${tackleAcc}%` },
          { label: "Avg Distance", value: `${avgDistance} km` },
        ]} />

        {/* Attacking */}
        <StatCard positionCard={positionCard} title="Attacking" rows={[
          { label: "Goals", value: `${goals.toLocaleString()} (${perApp(goals)})` },
          { label: "Shots", value: `${shots.toLocaleString()} (${perApp(shots)})` },
          { label: "Shots on Target", value: `${shotsOnTarget.toLocaleString()} (${perApp(shotsOnTarget)})` },
          { label: "Shot Accuracy", value: `${shotAcc}%` },
          { label: "Goals/App", value: perApp(goals) },
        ]} />
      </div>
    </>
  );
}

function StatCard({ title, rows, footer, positionCard }: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  footer?: React.ReactNode;
  positionCard?: string | null;
}) {
  const isPositionCard = positionCard === title;
  return (
    <div className={`border rounded-lg p-5 ${isPositionCard ? "stat-card-position" : "bg-pitch-900/40 border-chalk-100/8"}`}>
      <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.map((r) => {
          const labelClass = r.color || "text-chalk-400";
          const valueClass = r.color || "text-chalk-200";
          return (
            <div key={r.label} className="flex justify-between text-sm">
              <span className={`font-body ${labelClass}`}>{r.label}</span>
              <span className={`font-mono ${valueClass}`}>{r.value}</span>
            </div>
          );
        })}
      </div>
      {footer}
    </div>
  );
}
