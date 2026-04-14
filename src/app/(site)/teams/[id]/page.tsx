import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import PerformanceTracker, { type TrackerDataPoint } from "@/components/PerformanceTracker";

type LeaderboardEntry = {
  steam_id: string;
  username: string;
  value: bigint;
};

async function getLeaderboard(teamId: number, stat: "apps" | "goals" | "assists" | "wins") {
  if (stat === "apps") {
    return prisma.$queryRaw<LeaderboardEntry[]>`
      SELECT
        p.steam_id,
        p.username,
        COUNT(DISTINCT mps.match_id) AS value
      FROM match_player_stats mps
      JOIN players p ON p.steam_id = mps.player_steam_id
      JOIN matches m ON m.id = mps.match_id
      WHERE (
        (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
        (mps.team_side = 'away' AND m.away_team_id = ${teamId})
      )
      GROUP BY p.steam_id, p.username
      ORDER BY value DESC
      LIMIT 10
    `;
  }

  if (stat === "goals") {
    return prisma.$queryRaw<LeaderboardEntry[]>`
      SELECT
        p.steam_id,
        p.username,
        COALESCE(SUM(mps.goals), 0) AS value
      FROM match_player_stats mps
      JOIN players p ON p.steam_id = mps.player_steam_id
      JOIN matches m ON m.id = mps.match_id
      WHERE (
        (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
        (mps.team_side = 'away' AND m.away_team_id = ${teamId})
      )
      GROUP BY p.steam_id, p.username
      HAVING SUM(mps.goals) > 0
      ORDER BY value DESC
      LIMIT 10
    `;
  }

  if (stat === "assists") {
    return prisma.$queryRaw<LeaderboardEntry[]>`
      SELECT
        p.steam_id,
        p.username,
        COALESCE(SUM(mps.assists), 0) AS value
      FROM match_player_stats mps
      JOIN players p ON p.steam_id = mps.player_steam_id
      JOIN matches m ON m.id = mps.match_id
      WHERE (
        (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
        (mps.team_side = 'away' AND m.away_team_id = ${teamId})
      )
      GROUP BY p.steam_id, p.username
      HAVING SUM(mps.assists) > 0
      ORDER BY value DESC
      LIMIT 10
    `;
  }

  // wins
  return prisma.$queryRaw<LeaderboardEntry[]>`
    SELECT
      p.steam_id,
      p.username,
      COUNT(DISTINCT CASE
        WHEN (mps.team_side = 'home' AND m.home_score > m.away_score) OR
             (mps.team_side = 'away' AND m.away_score > m.home_score)
        THEN m.id END) AS value
    FROM match_player_stats mps
    JOIN players p ON p.steam_id = mps.player_steam_id
    JOIN matches m ON m.id = mps.match_id
    WHERE (
      (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
      (mps.team_side = 'away' AND m.away_team_id = ${teamId})
    )
    GROUP BY p.steam_id, p.username
    ORDER BY value DESC
    LIMIT 10
  `;
}

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

function buildTeamPerfQuery(teamId: number, groupExpr: string, dateFilter: string) {
  return prisma.$queryRawUnsafe<PerfRow[]>(
    `SELECT
       ${groupExpr} AS period,
       SUM(CASE WHEN (
         CASE WHEN m.home_team_id = $1 THEN m.home_score > m.away_score
              ELSE m.away_score > m.home_score END
       ) THEN 1 ELSE 0 END)::bigint AS wins,
       SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END)::bigint AS draws,
       SUM(CASE WHEN (
         CASE WHEN m.home_team_id = $1 THEN m.home_score < m.away_score
              ELSE m.away_score < m.home_score END
       ) THEN 1 ELSE 0 END)::bigint AS losses,
       SUM(CASE WHEN m.home_team_id = $1 THEN m.home_score ELSE m.away_score END)::bigint AS total_goals,
       0::bigint AS total_assists,
       SUM(CASE WHEN m.home_team_id = $1 THEN m.away_score ELSE m.home_score END)::bigint AS total_goals_conceded,
       SUM(CASE WHEN (
         CASE WHEN m.home_team_id = $1 THEN m.away_score = 0
              ELSE m.home_score = 0 END
       ) THEN 1 ELSE 0 END)::bigint AS clean_sheets,
       0::bigint AS potm,
       COUNT(*)::bigint AS apps
     FROM matches m
     WHERE (m.home_team_id = $1 OR m.away_team_id = $1)
       ${dateFilter}
     GROUP BY period
     ORDER BY period`,
    teamId,
  );
}

export default async function TeamStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const [appearances, goals, assists, wins, monthlyRaw, weeklyRaw, last30Raw] = await Promise.all([
    getLeaderboard(teamId, "apps"),
    getLeaderboard(teamId, "goals"),
    getLeaderboard(teamId, "assists"),
    getLeaderboard(teamId, "wins"),
    buildTeamPerfQuery(teamId, "TO_CHAR(m.date, 'YYYY-MM')", "AND m.date >= NOW() - INTERVAL '12 months'"),
    buildTeamPerfQuery(teamId, "TO_CHAR(m.date, 'IYYY-\"W\"IW')", "AND m.date >= NOW() - INTERVAL '52 weeks'"),
    buildTeamPerfQuery(teamId, "TO_CHAR(m.date, 'YYYY-MM-DD')", "AND m.date >= NOW() - INTERVAL '30 days'"),
  ]);

  const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  const emptyPoint: TrackerDataPoint = { label: "", wins: 0, draws: 0, losses: 0, avgGoals: 0, avgAssists: 0, avgGoalsConceded: 0, cleanSheets: 0, potm: 0, appearances: 0 };

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

  function isoWeekToDate(year: number, week: number): Date {
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const dayOfWeek = jan4.getUTCDay() || 7;
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

  const leaderboards = [
    { title: "Appearances", data: appearances },
    { title: "Goals", data: goals },
    { title: "Assists", data: assists },
    { title: "Wins", data: wins },
  ];

  return (
    <>
      <PerformanceTracker
        monthly={monthlyData}
        weekly={weeklyData}
        last30={last30Data}
        variant="team"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {leaderboards.map((board) => (
          <div
            key={board.title}
            className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-chalk-100/8">
              <h3 className="font-display font-700 text-sm uppercase tracking-wider text-chalk-100">
                {board.title}
              </h3>
            </div>
            <div className="divide-y divide-chalk-100/5">
              {board.data.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm font-mono text-chalk-400">
                  No data
                </div>
              ) : (
                board.data.map((entry, idx) => (
                  <div
                    key={entry.steam_id}
                    className={`flex items-center px-4 py-2.5 ${
                      idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"
                    }`}
                  >
                    <span className={`w-6 text-xs font-mono shrink-0 ${idx === 0 ? "text-[#FFD700]" : idx === 1 ? "text-[#C0C0C0]" : idx === 2 ? "text-[#CD7F32]" : "text-chalk-400"}`}>
                      {idx + 1}.
                    </span>
                    <Link
                      href={`/players/${entry.steam_id}`}
                      className="flex-1 font-body text-sm text-chalk-200 hover:text-[#F4119E] transition-colors truncate"
                    >
                      {entry.username}
                    </Link>
                    <span className="font-mono text-sm font-medium text-chalk-100 ml-2">
                      {Number(entry.value).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
