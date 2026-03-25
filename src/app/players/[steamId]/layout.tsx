import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getSteamAvatar } from "@/lib/steam-avatar";
import PlayerTabs from "./PlayerTabs";

type CurrentTeam = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_color: string | null;
};

type FormResult = {
  home_score: number;
  away_score: number;
  team_side: string;
};

export default async function PlayerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;

  const player = await prisma.player.findUnique({
    where: { steamId },
  });

  if (!player) return notFound();

  // Current team from transfer data (official roster)
  const currentTeams = await prisma.$queryRaw<CurrentTeam[]>`
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.logo AS team_logo,
      t.color AS team_color
    FROM transfers tr
    JOIN teams t ON t.id = tr.to_team_id
    WHERE tr.player_steam_id = ${steamId}
      AND tr.type = 'join'
      AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
      AND NOT EXISTS (
        SELECT 1 FROM transfers tr2
        WHERE tr2.player_steam_id = tr.player_steam_id
          AND tr2.from_team_id = tr.to_team_id
          AND tr2.type = 'leave'
          AND tr2.date > tr.date
      )
    ORDER BY tr.date DESC
    LIMIT 1
  `;
  // Fall back to match-based detection if no transfer data
  const currentTeamFromTransfers = currentTeams[0] || null;
  let currentTeam = currentTeamFromTransfers;
  if (!currentTeam) {
    const fallback = await prisma.$queryRaw<CurrentTeam[]>`
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.logo AS team_logo,
        t.color AS team_color
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      JOIN teams t ON t.id = CASE
        WHEN mps.team_side = 'home' THEN m.home_team_id
        WHEN mps.team_side = 'away' THEN m.away_team_id
      END
      WHERE mps.player_steam_id = ${steamId}
        AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
      ORDER BY m.date DESC
      LIMIT 1
    `;
    currentTeam = fallback[0] || null;
  }

  // Form (last 5)
  const formResults = await prisma.$queryRaw<FormResult[]>`
    SELECT m.home_score, m.away_score, mps.team_side
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ${steamId}
    ORDER BY m.date DESC
    LIMIT 5
  `;
  const form = formResults.map((m) => {
    const isHome = m.team_side === "home";
    const won = isHome ? m.home_score > m.away_score : m.away_score > m.home_score;
    const draw = m.home_score === m.away_score;
    return draw ? "D" : won ? "W" : "L";
  });

  const avatarUrl = await getSteamAvatar(player.steamId, player.avatar, player.avatarUpdatedAt);
  const teamColor = currentTeam?.team_color || null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/players" className="hover:text-grass-500 transition-colors">
          Players
        </Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">{player.username}</span>
      </div>

      {/* Hero Card */}
      <div
        className="relative rounded-xl border border-chalk-100/8 overflow-hidden mb-6"
        style={{
          backgroundColor: teamColor ? `${teamColor}35` : "rgb(var(--pitch-900))",
        }}
      >
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6 p-6 md:p-8">
          <a
            href={`https://steamcommunity.com/profiles/${player.steamId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 group/avatar"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={player.username}
                className="w-24 h-24 md:w-28 md:h-28 rounded-lg border-2 border-chalk-100/10 object-cover group-hover/avatar:border-grass-500/50 transition-colors"
              />
            ) : (
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg border-2 border-chalk-100/10 bg-pitch-700 flex items-center justify-center text-4xl font-display font-900 text-chalk-300 group-hover/avatar:border-grass-500/50 transition-colors">
                {player.username[0]?.toUpperCase() || "?"}
              </div>
            )}
          </a>

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-900 text-3xl md:text-4xl tracking-tight text-chalk-100 uppercase">
              {player.username}
            </h1>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
              {player.position && (
                <div>
                  <div className="text-[10px] font-mono text-chalk-400 uppercase">Position</div>
                  <div className="text-lg font-display font-700 text-chalk-100">{player.position}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-mono text-chalk-400 uppercase">Club Team</div>
                {currentTeam ? (
                  <Link
                    href={`/teams/${currentTeam.team_id}`}
                    className="flex items-center gap-2 text-lg font-display font-700 text-chalk-100 hover:text-grass-400 transition-colors"
                  >
                    {currentTeam.team_logo && (
                      <img src={proxyImg(currentTeam.team_logo)!} alt="" className="w-8 h-8 object-contain" />
                    )}
                    {currentTeam.team_name}
                  </Link>
                ) : (
                  <div className="text-lg font-display font-700 text-chalk-400">None</div>
                )}
              </div>
            </div>

            {form.length > 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-chalk-400 uppercase mr-1">Form</span>
                {form.map((r, i) => (
                  <span
                    key={i}
                    className={`w-6 h-6 rounded text-xs font-mono font-700 flex items-center justify-center ${
                      r === "W"
                        ? "bg-grass-500/20 text-grass-500"
                        : r === "D"
                          ? "bg-chalk-400/20 text-chalk-400"
                          : "bg-red-400/20 text-red-400"
                    }`}
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Team logo on the right */}
          {currentTeam?.team_logo && (
            <Link href={`/teams/${currentTeam.team_id}`} className="hidden md:block shrink-0">
              <img
                src={proxyImg(currentTeam.team_logo)!}
                alt={currentTeam.team_name}
                className="w-28 h-28 lg:w-36 lg:h-36 object-contain opacity-40 hover:opacity-60 transition-opacity"
              />
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <PlayerTabs steamId={steamId} />

      {/* Tab content */}
      {children}
    </div>
  );
}
