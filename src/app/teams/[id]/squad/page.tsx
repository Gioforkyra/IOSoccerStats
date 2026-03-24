import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

type SquadPlayer = {
  steam_id: string;
  username: string;
  position: string | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
};

export default async function TeamSquadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  // Get players who played in the most recent match for this team
  const squad = await prisma.$queryRaw<SquadPlayer[]>`
    WITH latest_match AS (
      SELECT m.id
      FROM matches m
      WHERE m.home_team_id = ${teamId} OR m.away_team_id = ${teamId}
      ORDER BY m.date DESC
      LIMIT 1
    ),
    squad_players AS (
      SELECT DISTINCT mps.player_steam_id
      FROM match_player_stats mps
      JOIN latest_match lm ON lm.id = mps.match_id
      JOIN matches m ON m.id = mps.match_id
      WHERE (
        (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
        (mps.team_side = 'away' AND m.away_team_id = ${teamId})
      )
    )
    SELECT
      p.steam_id,
      p.username,
      p.position,
      COUNT(DISTINCT mps.match_id) AS apps,
      COALESCE(SUM(mps.goals), 0) AS goals,
      COALESCE(SUM(mps.assists), 0) AS assists
    FROM squad_players sp
    JOIN players p ON p.steam_id = sp.player_steam_id
    JOIN match_player_stats mps ON mps.player_steam_id = p.steam_id
    JOIN matches m ON m.id = mps.match_id
    WHERE (
      (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
      (mps.team_side = 'away' AND m.away_team_id = ${teamId})
    )
    GROUP BY p.steam_id, p.username, p.position
    ORDER BY apps DESC
  `;

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Current Squad
      </h3>
      <p className="text-xs font-mono text-chalk-400 mb-4">
        Players who appeared in this team&apos;s most recent match. Stats shown are for this team only.
      </p>

      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400">PLAYER</th>
              <th className="text-left px-4 py-3 font-mono text-xs text-chalk-400">POS</th>
              <th className="text-right px-4 py-3 font-mono text-xs text-chalk-400">APPS</th>
              <th className="text-right px-4 py-3 font-mono text-xs text-chalk-400">GOALS</th>
              <th className="text-right px-4 py-3 font-mono text-xs text-chalk-400">ASSISTS</th>
            </tr>
          </thead>
          <tbody>
            {squad.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm font-mono text-chalk-400">
                  No squad data available.
                </td>
              </tr>
            ) : (
              squad.map((p, idx) => (
                <tr
                  key={p.steam_id}
                  className={`stat-row ${idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/players/${p.steam_id}`}
                      className="font-body text-chalk-100 hover:text-grass-400 transition-colors"
                    >
                      {p.username}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {p.position ? (
                      <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                        {p.position}
                      </span>
                    ) : (
                      <span className="text-chalk-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {Number(p.apps).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-200 font-medium">
                    {Number(p.goals).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {Number(p.assists).toLocaleString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
