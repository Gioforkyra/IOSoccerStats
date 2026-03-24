import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

type HistoryPlayer = {
  steam_id: string;
  username: string;
  position: string | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  first_match: Date;
  last_match: Date;
};

type PlayerCount = {
  total: bigint;
};

const PAGE_SIZE = 25;

export default async function TeamPlayerHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [countResult] = await prisma.$queryRaw<[PlayerCount]>`
    SELECT COUNT(DISTINCT mps.player_steam_id) AS total
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE (
      (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
      (mps.team_side = 'away' AND m.away_team_id = ${teamId})
    )
  `;
  const totalPlayers = Number(countResult.total);
  const totalPages = Math.ceil(totalPlayers / PAGE_SIZE);

  const players = await prisma.$queryRaw<HistoryPlayer[]>`
    SELECT
      p.steam_id,
      p.username,
      p.position,
      COUNT(DISTINCT mps.match_id) AS apps,
      COALESCE(SUM(mps.goals), 0) AS goals,
      COALESCE(SUM(mps.assists), 0) AS assists,
      MIN(m.date) AS first_match,
      MAX(m.date) AS last_match
    FROM match_player_stats mps
    JOIN players p ON p.steam_id = mps.player_steam_id
    JOIN matches m ON m.id = mps.match_id
    WHERE (
      (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
      (mps.team_side = 'away' AND m.away_team_id = ${teamId})
    )
    GROUP BY p.steam_id, p.username, p.position
    ORDER BY apps DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        All-Time Player History
      </h3>
      <p className="text-xs font-mono text-chalk-400 mb-4">
        {totalPlayers.toLocaleString()} players have represented this team.
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
              <th className="text-right px-4 py-3 font-mono text-xs text-chalk-400 hidden md:table-cell">FIRST</th>
              <th className="text-right px-4 py-3 font-mono text-xs text-chalk-400 hidden md:table-cell">LAST</th>
            </tr>
          </thead>
          <tbody>
            {players.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm font-mono text-chalk-400">
                  No player data available.
                </td>
              </tr>
            ) : (
              players.map((p, idx) => (
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
                  <td className="px-4 py-3 text-right font-mono text-chalk-200 font-medium">
                    {Number(p.apps).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-200">
                    {Number(p.goals).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-300">
                    {Number(p.assists).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-400 text-xs hidden md:table-cell">
                    {new Date(p.first_match).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-chalk-400 text-xs hidden md:table-cell">
                    {new Date(p.last_match).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {currentPage > 1 && (
            <Link
              href={`/teams/${teamId}/player-history?page=${currentPage - 1}`}
              className="px-3 py-1.5 rounded text-sm font-mono text-chalk-300 bg-pitch-800 border border-chalk-100/8 hover:bg-pitch-700 transition-colors"
            >
              Prev
            </Link>
          )}
          <span className="text-sm font-mono text-chalk-400">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/teams/${teamId}/player-history?page=${currentPage + 1}`}
              className="px-3 py-1.5 rounded text-sm font-mono text-chalk-300 bg-pitch-800 border border-chalk-100/8 hover:bg-pitch-700 transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
