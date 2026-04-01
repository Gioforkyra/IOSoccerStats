import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

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

export default async function TeamStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const [appearances, goals, assists, wins] = await Promise.all([
    getLeaderboard(teamId, "apps"),
    getLeaderboard(teamId, "goals"),
    getLeaderboard(teamId, "assists"),
    getLeaderboard(teamId, "wins"),
  ]);

  const leaderboards = [
    { title: "Appearances", data: appearances },
    { title: "Goals", data: goals },
    { title: "Assists", data: assists },
    { title: "Wins", data: wins },
  ];

  return (
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
  );
}
