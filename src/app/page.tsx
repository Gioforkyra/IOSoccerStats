import Link from "next/link";
import HomeSearchPanel from "@/components/HomeSearchPanel";

export const dynamic = "force-dynamic";

import {
  getMatches,
  getActiveTeams,
  getCurrentTournaments,
  getPlayers,
  badgeSmallUrl,
  badgeUrl,
} from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";
import ParticlesBackground from "@/components/ParticlesBackground";
import Footer from "@/components/Footer";
import KofiSupportButton from "@/components/KofiSupportButton";
import ThemeToggle from "@/components/ThemeToggle";


export default async function HomePage() {
  const [
    matchData,
    playerData,
    activeTeams,
    currentTournaments,
  ] = await Promise.all([
    getMatches({ page: 1, pageSize: 6, matchType: 1, regionId: 1 }),
    getPlayers({ page: 1, pageSize: 1 }),
    getActiveTeams(1, 1),
    getCurrentTournaments(),
  ]);

  const playersCount = playerData.totalItems;
  const teamsCount = activeTeams.length;
  const recentMatches = matchData.items;

  // Top teams by avg rating
  const activeIds = activeTeams.map((t) => t.id);
  const topTeamsDb = activeIds.length > 0
    ? await prisma.$queryRaw<{ id: number; avg_rating: number | null }[]>`
        SELECT id, avg_rating FROM teams WHERE id = ANY(${activeIds}) AND avg_rating IS NOT NULL
        ORDER BY avg_rating DESC LIMIT 4
      `
    : [];
  const topTeams = topTeamsDb
    .map((r) => {
      const team = activeTeams.find((t) => t.id === r.id);
      if (!team) return null;
      return { ...team, avgRating: r.avg_rating };
    })
    .filter(Boolean) as (typeof activeTeams[0] & { avgRating: number | null })[];

  // Top rated players (latest period)
  const topPlayers = await prisma.$queryRaw<{ steam_id: string; username: string; rating: number }[]>`
    SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
    FROM player_rating_history prh
    JOIN players p ON p.steam_id = prh.steam_id
    WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = (
      SELECT TO_CHAR(DATE_TRUNC('month', MAX(recorded_at)), 'YYYY-MM') FROM player_rating_history
    )
    AND prh.rating > 0
    GROUP BY prh.steam_id, p.username
    HAVING AVG(prh.rating) > 0
    ORDER BY rating DESC
    LIMIT 5
  `;

  return (
    <div className="min-h-screen relative overflow-hidden bg-pitch-950 flex flex-col">
      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        <section className="flex-1">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-12">
            {/* Header */}
            <div className="mb-6">
              <div className="min-w-0">
                <h1 className="flex items-center justify-center gap-3 text-center font-display text-6xl font-black uppercase leading-[0.95] tracking-tight text-chalk-100 md:text-8xl">
                  <img src="/favicon/favicon-96x96.png" alt="IOSHUBv2" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
                  <span>IOS<span className="text-[#F4119E]">HUB</span>V2</span>
                </h1>
              </div>
            </div>

            {/* Search + Best Teams row */}
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <HomeSearchPanel playersCount={playersCount} teamsCount={teamsCount} />

              {/* Best Teams card */}
              <div className="home-card rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-3 hover:border-[#F4119E]/30 transition-colors">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Best Teams
                </div>
                <div className="space-y-1.5">
                  {topTeams.map((team, i) => {
                    const logo = badgeUrl(team.badgeImageId);
                    return (
                      <Link
                        key={team.id}
                        href={`/teams/${team.id}`}
                        className="flex items-center gap-2.5 rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover"
                      >
                        <span className="w-4 text-[10px] font-mono text-chalk-400 text-center shrink-0">
                          {i + 1}
                        </span>
                        {logo ? (
                          <img src={logo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                        ) : (
                          <div className="h-5 w-5 shrink-0 rounded-full bg-pitch-700" />
                        )}
                        <span className="min-w-0 flex-1 truncate font-body text-sm text-chalk-100">
                          {team.name}
                        </span>
                        <span className="text-[11px] font-mono text-[#F4119E] shrink-0">
                          {team.avgRating?.toFixed(2)}
                        </span>
                      </Link>
                    );
                  })}
                  {topTeams.length === 0 && (
                    <div className="text-xs text-chalk-400 font-mono py-2">No rating data</div>
                  )}
                </div>
                <Link
                  href="/teams"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  Full Rankings {"->"}
                </Link>
              </div>
            </div>

            {/* Bottom row: Leaderboards, Recent Matches, Live Scores, Teams */}
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {/* Active Tournaments */}
              <div className="home-card rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-3 hover:border-[#F4119E]/30 transition-colors">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Active Tournaments
                </div>
                <div className="space-y-1.5">
                  {currentTournaments.slice(0, 4).map((t) => (
                    <Link
                      key={t.id}
                      href="/tournaments?status=active"
                      className="flex items-center gap-2.5 rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-grass-500/15 text-grass-400 text-[11px]">
                        ⚽
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-body text-sm text-chalk-100">
                          {t.name}
                        </div>
                        <div className="text-[10px] font-mono text-chalk-400">
                          {t.tournamentSeries?.organisation?.acronym || "Tournament"}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-grass-400">LIVE</span>
                    </Link>
                  ))}
                  {currentTournaments.length === 0 && (
                    <div className="text-xs text-chalk-400 font-mono py-2">No active tournaments</div>
                  )}
                </div>
                <Link
                  href="/tournaments"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  All Tournaments {"->"}
                </Link>
              </div>

              {/* Recent Matches */}
              <div className="home-card rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-3 hover:border-[#F4119E]/30 transition-colors">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Recent Matches
                </div>
                <div className="space-y-1.5">
                  {recentMatches.map((match) => {
                    const homeLogo = badgeSmallUrl(match.teamHome.badgeImage);
                    const awayLogo = badgeSmallUrl(match.teamAway.badgeImage);
                    return (
                      <Link
                        key={match.id}
                        href={`/matches/${match.id}`}
                        className="flex items-center gap-1.5 rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover"
                      >
                        <span className="truncate text-xs font-body text-chalk-100 flex-1 text-right">
                          {match.teamHome.name}
                        </span>
                        {homeLogo ? (
                          <img src={homeLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded-full bg-pitch-700" />
                        )}
                        <span className="font-display text-sm font-700 text-chalk-100 shrink-0 w-8 text-center">
                          {match.matchStatistics?.matchGoalsHome ?? "?"}-{match.matchStatistics?.matchGoalsAway ?? "?"}
                        </span>
                        {awayLogo ? (
                          <img src={awayLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                        ) : (
                          <div className="h-4 w-4 shrink-0 rounded-full bg-pitch-700" />
                        )}
                        <span className="truncate text-xs font-body text-chalk-100 flex-1">
                          {match.teamAway.name}
                        </span>
                      </Link>
                    );
                  })}
                </div>
                <Link
                  href="/matches"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  Match Archive {"->"}
                </Link>
              </div>

              {/* Top Rated Players */}
              <div className="home-card rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Top Rated Players
                </div>
                <div className="space-y-1.5">
                  {topPlayers.map((player, i) => (
                    <Link
                      key={player.steam_id}
                      href={`/players/${player.steam_id}`}
                      className={`top-rated-player-item flex items-center gap-2.5 rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover ${
                        i === 0
                          ? "top-rated-medal top-rated-gold"
                          : i === 1
                            ? "top-rated-medal top-rated-silver"
                            : i === 2
                              ? "top-rated-medal top-rated-bronze"
                              : ""
                      }`}
                    >
                      <span className="w-4 text-[10px] font-mono text-chalk-400 text-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-body text-sm text-chalk-100">
                        {player.username}
                      </span>
                      <span className="text-[11px] font-mono text-[#F4119E] shrink-0">
                        {player.rating.toFixed(2)}
                      </span>
                    </Link>
                  ))}
                  {topPlayers.length === 0 && (
                    <div className="text-xs text-chalk-400 font-mono py-2">No rating data</div>
                  )}
                </div>
                <Link
                  href="/players/leaderboards?stat=rating"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  View Leaderboards {"->"}
                </Link>
              </div>

              {/* Ko-fi + Live Scores + Theme Toggle */}
              <div className="space-y-3">
                <KofiSupportButton username="bybl0s" label="Support me on Ko-fi" />
                <Link
                  href="/matches/live"
                  className="home-card group block rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-1">
                    Live
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="live-dot inline-block h-2 w-2 rounded-full bg-grass-500" />
                    <span className="font-display text-base font-700 text-chalk-100">Live Scores</span>
                  </div>
                  <span className="mt-1.5 inline-block text-xs font-mono text-[#F4119E] group-hover:text-[#F4119E]/70 transition-colors">
                    Open Live {"->"}
                  </span>
                </Link>
                <div className="flex justify-start">
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </div>
        </section>
        <Footer className="mt-6" />
      </div>
    </div>
  );
}
