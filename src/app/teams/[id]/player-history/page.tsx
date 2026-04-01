import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeamRoster } from "@/lib/iosoccer-api";

type PlayerMeta = {
  steam_id: string;
  username: string;
  position: string | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
};

const PAGE_SIZE = 15;

export default async function TeamPlayerHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam, q: queryParam } = await searchParams;
  const query = (queryParam ?? "").trim().toLowerCase();
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  // 1. Get full roster history from IOSoccer API
  let rosterEntries: Awaited<ReturnType<typeof getTeamRoster>> = [];
  try {
    rosterEntries = await getTeamRoster(teamId, true);
  } catch {
    // API unavailable
  }

  // Deduplicate steam IDs (a player may have multiple stints)
  const seenIds = new Set<string>();
  const uniqueEntries = rosterEntries.filter((e) => {
    const sid = e.player.steamID;
    if (!sid || seenIds.has(sid)) return false;
    seenIds.add(sid);
    return true;
  });

  const allSteamIds = uniqueEntries.map((e) => e.player.steamID);

  // Build a join/leave date map for each steam ID (most recent stint)
  const datesMap = new Map<string, { join: string | null; leave: string | null }>();
  for (const e of rosterEntries) {
    if (!e.player.steamID) continue;
    const existing = datesMap.get(e.player.steamID);
    if (!existing) {
      datesMap.set(e.player.steamID, { join: e.joinDate, leave: e.leaveDate });
    } else if (e.isCurrentTeam) {
      // Prefer the current stint's dates
      datesMap.set(e.player.steamID, { join: e.joinDate, leave: null });
    }
  }

  // 2. Query DB for player details + team stats for those steam IDs
  const metaRows: PlayerMeta[] = allSteamIds.length > 0
    ? await prisma.$queryRaw<PlayerMeta[]>`
        SELECT
          p.steam_id,
          p.username,
          p.position,
          COALESCE(ts.apps, 0)    AS apps,
          COALESCE(ts.goals, 0)   AS goals,
          COALESCE(ts.assists, 0) AS assists
        FROM players p
        LEFT JOIN (
          SELECT
            mps.player_steam_id,
            COUNT(DISTINCT mps.match_id)  AS apps,
            COALESCE(SUM(mps.goals), 0)   AS goals,
            COALESCE(SUM(mps.assists), 0) AS assists
          FROM match_player_stats mps
          JOIN matches m ON m.id = mps.match_id
          WHERE mps.player_steam_id = ANY(${allSteamIds})
            AND (
              (mps.team_side = 'home' AND m.home_team_id = ${teamId}) OR
              (mps.team_side = 'away' AND m.away_team_id = ${teamId})
            )
          GROUP BY mps.player_steam_id
        ) ts ON ts.player_steam_id = p.steam_id
        WHERE p.steam_id = ANY(${allSteamIds})
      `
    : [];

  const metaMap = new Map(metaRows.map((r) => [r.steam_id, r]));

  // 3. Build combined list, sort by apps DESC
  type CombinedPlayer = {
    steam_id: string;
    username: string;
    position: string | null;
    apps: number;
    goals: number;
    assists: number;
    join_date: string | null;
    leave_date: string | null;
    is_current: boolean;
  };

  const allPlayers: CombinedPlayer[] = uniqueEntries.map((entry) => {
    const meta = metaMap.get(entry.player.steamID);
    const dates = datesMap.get(entry.player.steamID);
    const isCurrentTeam = rosterEntries.some(
      (e) => e.player.steamID === entry.player.steamID && e.isCurrentTeam
    );
    return {
      steam_id: entry.player.steamID,
      username: meta?.username ?? entry.player.name,
      position: meta?.position ?? null,
      apps: Number(meta?.apps ?? 0),
      goals: Number(meta?.goals ?? 0),
      assists: Number(meta?.assists ?? 0),
      join_date: dates?.join ?? null,
      leave_date: isCurrentTeam ? null : (dates?.leave ?? null),
      is_current: isCurrentTeam,
    };
  });

  allPlayers.sort((a, b) => b.apps - a.apps);

  const filteredPlayers = query
    ? allPlayers.filter((p) => p.username.toLowerCase().includes(query))
    : allPlayers;

  const totalPlayers = allPlayers.length;
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / PAGE_SIZE));
  const players = filteredPlayers.slice(offset, offset + PAGE_SIZE);

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";

  return (
    <div>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        All-Time Player History
      </h3>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-mono text-chalk-400">
          {totalPlayers.toLocaleString()} players have represented this team.
        </p>
        {/* Search */}
        <form method="GET" className="flex items-center gap-2">
        <input
          type="text"
          name="q"
          defaultValue={queryParam ?? ""}
          placeholder="Search player…"
          className="bg-pitch-800 border border-chalk-100/10 rounded px-3 py-1.5 text-sm text-chalk-100 placeholder:text-chalk-400/50 font-body focus:outline-none focus:border-[#F4119E]/50 w-52"
        />
        {query && (
          <a href={`/teams/${teamId}/player-history`} className="text-xs font-mono text-chalk-400 hover:text-[#F4119E] transition-colors">
            clear
          </a>
        )}
        {query && (
          <span className="text-xs font-mono text-chalk-400">
            {filteredPlayers.length} result{filteredPlayers.length !== 1 ? "s" : ""}
          </span>
        )}
        </form>
      </div>

      <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-chalk-100/8">
              <th className="text-left px-4 py-1.5 font-mono text-xs text-chalk-400">PLAYER</th>
              <th className="text-left px-4 py-1.5 font-mono text-xs text-chalk-400">POS</th>
              <th className="text-right px-4 py-1.5 font-mono text-xs text-chalk-400">APPS</th>
              <th className="text-right px-4 py-1.5 font-mono text-xs text-chalk-400">GOALS</th>
              <th className="text-right px-4 py-1.5 font-mono text-xs text-chalk-400">ASSISTS</th>
              <th className="text-right px-4 py-1.5 font-mono text-xs text-chalk-400 hidden md:table-cell">JOINED</th>
              <th className="text-right px-4 py-1.5 font-mono text-xs text-chalk-400 hidden md:table-cell">LEFT</th>
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
                  className={idx % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}
                >
                  <td className="px-4 py-1.5">
                    <Link
                      href={`/players/${p.steam_id}`}
                      className="font-body text-chalk-100 hover:text-[#F4119E] transition-colors"
                    >
                      {p.username}
                    </Link>
                  </td>
                  <td className="px-4 py-1.5">
                    {p.position ? (
                      <span className="text-[10px] font-mono text-chalk-400 bg-pitch-800 px-1.5 py-0.5 rounded">
                        {p.position}
                      </span>
                    ) : (
                      <span className="text-chalk-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-200 font-medium">
                    {Number(p.apps).toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-200">
                    {Number(p.goals).toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-300">
                    {Number(p.assists).toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-400 text-xs hidden md:table-cell">
                    {fmt(p.join_date)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono text-chalk-400 text-xs hidden md:table-cell">
                    {p.is_current ? (
                      <span className="text-green-400">Current</span>
                    ) : (
                      fmt(p.leave_date)
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs font-mono text-chalk-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <Link
                href={`/teams/${teamId}/player-history?${query ? `q=${encodeURIComponent(query)}&` : ""}page=1`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="First page"
              >
                &laquo;
              </Link>
            )}
            {currentPage > 1 && (
              <Link
                href={`/teams/${teamId}/player-history?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${Math.max(1, currentPage - 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Back 10 pages"
              >
                &lt;
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (currentPage <= 3) {
                p = i + 1;
              } else if (currentPage >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = currentPage - 2 + i;
              }
              return (
                <Link
                  key={p}
                  href={`/teams/${teamId}/player-history?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${p}`}
                  className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                    p === currentPage
                      ? "bg-[#F4119E] text-white font-700"
                      : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {currentPage < totalPages && (
              <Link
                href={`/teams/${teamId}/player-history?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${Math.min(totalPages, currentPage + 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Forward 10 pages"
              >
                &gt;
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/teams/${teamId}/player-history?${query ? `q=${encodeURIComponent(query)}&` : ""}page=${totalPages}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Last page"
              >
                &raquo;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
