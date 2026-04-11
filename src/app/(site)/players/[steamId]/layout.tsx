import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getSteamAvatar } from "@/lib/steam-avatar";
import { getRelatedSteamIds } from "@/lib/player-aliases";
import { getPlayerTeams } from "@/lib/iosoccer-api";
import { getCardContrastPalette } from "@/lib/card-contrast";
import PlayerTabs from "./PlayerTabs";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

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
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({
    where: { steamId },
  });

  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  // Current team — prefer live API if player has iosoccerId
  let currentTeam: CurrentTeam | null = null;

  if (player.iosoccerId != null) {
    try {
      const apiTeams = await getPlayerTeams(player.iosoccerId, true);
      const EXCLUDED = ["IOSoccer All", "IOSoccer Overlap", "IOSoccer Challenge", "IOSoccer Premier"];
      const apiCurrent = apiTeams.find(
        (e) => e.isCurrentTeam && e.team.teamType === 1 && !e.team.inactive && !EXCLUDED.includes(e.team.name)
      );
      if (apiCurrent) {
        // Look up logo/color from DB (API badge may be null)
        const dbTeam = await prisma.team.findUnique({ where: { id: apiCurrent.teamId } });
        currentTeam = {
          team_id: apiCurrent.teamId,
          team_name: apiCurrent.team.name,
          team_logo: dbTeam?.logo ?? null,
          team_color: dbTeam?.color ?? apiCurrent.team.color ?? null,
        };
      }
      // If apiCurrent is undefined → player has no current team → currentTeam stays null
    } catch {
      // API failed, fall through to DB query
    }
  }

  // DB fallback (no iosoccerId or API failed)
  if (currentTeam === null && player.iosoccerId == null) {
    const currentTeams = await prisma.$queryRaw<CurrentTeam[]>`
      SELECT
        t.id AS team_id,
        t.name AS team_name,
        t.logo AS team_logo,
        t.color AS team_color
      FROM transfers tr
      JOIN teams t ON t.id = tr.to_team_id
      WHERE tr.player_steam_id = ANY(${steamIds})
        AND tr.type = 'join'
        AND t.inactive = false
        AND t.team_type = 1
        AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
        AND NOT EXISTS (
          SELECT 1 FROM transfers tr2
          WHERE tr2.player_steam_id = ANY(${steamIds})
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        )
      ORDER BY tr.date DESC
      LIMIT 1
    `;
    currentTeam = currentTeams[0] || null;
  }

  // Most played position across all matches (hub shows preferred position,
  // but the API returns it as null for most players — derive it from full match history instead)
  const positionRows = await prisma.$queryRaw<{ position: string; cnt: number }[]>`
    SELECT position, COUNT(*)::int AS cnt
    FROM match_player_stats
    WHERE player_steam_id = ANY(${steamIds})
      AND position IS NOT NULL
    GROUP BY position
    ORDER BY cnt DESC
    LIMIT 1
  `;
  const derivedPosition = positionRows[0]?.position ?? null;

  // Form (last 5)
  const formResults = await prisma.$queryRaw<FormResult[]>`
    SELECT m.home_score, m.away_score, mps.team_side
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ANY(${steamIds})
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
  const teamColor = currentTeam?.team_color ?? null;
  const isNoTeam = currentTeam == null;
  const cardPalette = getCardContrastPalette(teamColor ?? "#171717");

  type ActivityRow = { day: string; count: number };
  const activityRows = await prisma.$queryRaw<ActivityRow[]>`
    SELECT
      TO_CHAR(m.date, 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT m.id)::int AS count
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ANY(${steamIds})
      AND m.date >= NOW() - INTERVAL '365 days'
    GROUP BY TO_CHAR(m.date, 'YYYY-MM-DD')
  `;
  const activityData: Record<string, number> = {};
  for (const row of activityRows) activityData[row.day] = row.count;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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
        className={`relative rounded-xl border border-chalk-100/8 overflow-hidden mb-6 ${isNoTeam ? "player-no-team-card" : ""}`}
        style={{
          backgroundColor: isNoTeam ? "var(--player-no-team-card-bg, #171717)" : cardPalette.background,
        }}
      >
        <div className="relative flex flex-col md:flex-row items-start md:items-center gap-4 p-4 md:p-5">
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
                className="w-20 h-20 md:w-24 md:h-24 rounded-lg border-2 border-chalk-100/10 object-cover group-hover/avatar:border-grass-500/50 transition-colors"
              />
            ) : (
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg border-2 border-chalk-100/10 bg-pitch-700 flex items-center justify-center text-3xl font-display font-900 text-chalk-300 group-hover/avatar:border-grass-500/50 transition-colors">
                {player.username[0]?.toUpperCase() || "?"}
              </div>
            )}
          </a>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1
                className="font-display font-900 text-3xl md:text-3xl tracking-tight uppercase"
                style={{ color: isNoTeam ? "var(--player-no-team-primary, #ffffff)" : cardPalette.primaryText }}
              >
                {player.username}
              </h1>
              {player.iosoccerId && (
                <a
                  href={`https://www.iosoccer.com/player-profile/${player.iosoccerId}/statistics`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border text-[11px] font-mono hover:text-[#F4119E] hover:border-[#F4119E]/30 transition-colors"
                  style={{
                    color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText,
                    borderColor: isNoTeam
                      ? "var(--player-no-team-border, rgba(255,255,255,0.15))"
                      : cardPalette.isBright
                        ? "rgba(17,24,39,0.2)"
                        : "rgba(255,255,255,0.15)",
                  }}
                  title="View on IOSoccer Hub"
                >
                  HUB #{player.iosoccerId}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 mt-2">
              {derivedPosition && (
                <div>
                  <div className="text-[10px] font-mono uppercase" style={{ color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText }}>Position</div>
                  <div className="text-lg font-display font-700" style={{ color: isNoTeam ? "var(--player-no-team-primary, #ffffff)" : cardPalette.primaryText }}>{derivedPosition}</div>
                </div>
              )}

              {player.rating != null && (
                <div>
                  <div className="text-[10px] font-mono uppercase" style={{ color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText }}>Rating</div>
                  <div className="text-lg font-display font-700" style={{ color: isNoTeam ? "var(--player-no-team-primary, #ffffff)" : cardPalette.primaryText }}>{player.rating.toFixed(1)}</div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-mono uppercase" style={{ color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText }}>Club Team</div>
                {currentTeam ? (
                  <Link
                    href={`/teams/${currentTeam.team_id}`}
                    className="flex items-center gap-2 text-lg font-display font-700 hover:text-[#F4119E] transition-colors"
                    style={{ color: isNoTeam ? "var(--player-no-team-primary, #ffffff)" : cardPalette.primaryText }}
                  >
                    {currentTeam.team_logo && (
                      <img src={proxyImg(currentTeam.team_logo)!} alt="" className="w-8 h-8 object-contain" />
                    )}
                    {currentTeam.team_name}
                  </Link>
                ) : (
                  <div className="text-lg font-display font-700" style={{ color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText }}>None</div>
                )}
              </div>

              {form.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono uppercase" style={{ color: isNoTeam ? "var(--player-no-team-muted, rgba(209,213,219,0.9))" : cardPalette.mutedText }}>Form</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {form.map((r, i) => (
                      <span
                        key={i}
                        className={`w-6 h-6 rounded text-xs font-mono font-700 flex items-center justify-center border border-black/20 ${
                          r === "W"
                            ? "bg-[#15803d] text-white"
                            : r === "D"
                              ? "bg-[#4b5563] text-white"
                              : "bg-[#b91c1c] text-white"
                        }`}
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Team logo on the right */}
          {currentTeam?.team_logo && (
            <Link href={`/teams/${currentTeam.team_id}`} className="hidden md:block shrink-0">
              <img
                src={proxyImg(currentTeam.team_logo)!}
                alt={currentTeam.team_name}
                className="w-20 h-20 lg:w-24 lg:h-24 object-contain opacity-40 hover:opacity-60 transition-opacity"
              />
            </Link>
          )}
        </div>
      </div>

      {/* Activity heatmap */}
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/40 px-5 py-4 mb-6">
        <ActivityHeatmap data={activityData} color={teamColor ?? undefined} />
      </div>

      {/* Tabs */}
      <PlayerTabs steamId={steamId} />

      {/* Tab content */}
      {children}
    </div>
  );
}
