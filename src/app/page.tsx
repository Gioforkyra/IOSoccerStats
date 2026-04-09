import Link from "next/link";
import HomeSearchPanel from "@/components/HomeSearchPanel";

export const dynamic = "force-dynamic";

import {
  getMatches,
  getActiveTeams,
  getPastTournaments,
  getCurrentTournaments,
  getPlayers,
  badgeSmallUrl,
  badgeUrl,
} from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";
import ParticlesBackground from "@/components/ParticlesBackground";


export default async function HomePage() {
  const [
    matchData,
    playerData,
    activeTeams,
    pastTournaments,
    currentTournaments,
  ] = await Promise.all([
    getMatches({ page: 1, pageSize: 7, matchType: 1, regionId: 1 }),
    getPlayers({ page: 1, pageSize: 1 }),
    getActiveTeams(1, 1),
    getPastTournaments(),
    getCurrentTournaments(),
  ]);

  const matchesCount = matchData.totalItems;
  const playersCount = playerData.totalItems;
  const teamsCount = activeTeams.length;
  const tournamentsCount = pastTournaments.length + currentTournaments.length;
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
    <div className="min-h-screen relative overflow-hidden bg-pitch-950">
      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        <section>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-12">
            {/* Header */}
            <div className="mb-8 flex items-start justify-between gap-6">
              {/* Left: title + description */}
              <div>
                <h1 className="flex items-center gap-3 font-display text-5xl font-black uppercase leading-[0.95] tracking-tight text-chalk-100 md:text-7xl">
                  <img src="/favicon/favicon-96x96.png" alt="IOSHUBv2" className="w-12 h-12 md:w-16 md:h-16 object-contain" />
                  <span>IOS<span className="text-[#F4119E]">HUB</span>V2</span>
                </h1>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-chalk-100/15 bg-pitch-800/50 px-3 py-1.5 text-xs font-mono uppercase tracking-[0.18em] text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/30 transition-all"
                  >
                    About this project {"->"}
                  </Link>
                  <a
                    href="https://ko-fi.com/bybl0s"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="md:hidden inline-flex items-center gap-1.5 rounded-lg border-2 border-[#FF5E5B]/60 bg-[#FF5E5B]/15 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-[0.18em] text-[#FF5E5B] hover:bg-[#FF5E5B]/30 hover:border-[#FF5E5B] transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{width:"14px",height:"14px"}} className="shrink-0">
                      <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
                    </svg>
                    Support
                  </a>
                </div>
              </div>

              {/* Right: Online badge + Ko-fi button stacked */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#F4119E]/30 bg-[#F4119E]/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-[#F4119E]">
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#F4119E]" />
                  Online
                </div>
                <a
                  href="https://ko-fi.com/bybl0s"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden md:inline-flex items-center gap-2 rounded-xl border-2 border-[#FF5E5B]/60 bg-[#FF5E5B]/15 px-5 py-2.5 text-sm font-mono font-bold uppercase tracking-[0.18em] text-[#FF5E5B] hover:bg-[#FF5E5B]/30 hover:border-[#FF5E5B] transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{width:"18px",height:"18px"}} className="shrink-0">
                    <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z"/>
                  </svg>
                  Support on Ko-fi
                </a>
              </div>
            </div>

            {/* Search + Best Teams row */}
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <HomeSearchPanel playersCount={playersCount} teamsCount={teamsCount} />

              {/* Best Teams card */}
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors">
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
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors">
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
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors">
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
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors">
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
                  href="/ratings"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  View Ratings {"->"}
                </Link>
              </div>

              {/* Live Scores + Tournaments + DB Stats */}
              <div className="space-y-3">
                <Link
                  href="/matches/live"
                  className="group block rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
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
                <Link
                  href="/tournaments"
                  className="group block rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-1">
                    Tournaments
                  </div>
                  <div className="font-display text-base font-700 text-chalk-100">
                    Leagues & Cups
                  </div>
                  <span className="mt-1.5 inline-block text-xs font-mono text-[#F4119E] group-hover:text-[#F4119E]/70 transition-colors">
                    Browse {"->"}
                  </span>
                </Link>
                {/* DB Stats */}
                <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 px-4 py-3">
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2">
                    Database
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                    <div>
                      <div className="font-display text-base font-800 text-chalk-100">
                        {playersCount.toLocaleString("en-GB")}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-chalk-400">Players</div>
                    </div>
                    <div>
                      <div className="font-display text-base font-800 text-chalk-100">
                        {teamsCount.toLocaleString("en-GB")}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-chalk-400">Teams</div>
                    </div>
                    <div>
                      <div className="font-display text-base font-800 text-chalk-100">
                        {matchesCount.toLocaleString("en-GB")}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-chalk-400">Matches</div>
                    </div>
                    <div>
                      <div className="font-display text-base font-800 text-chalk-100">
                        {tournamentsCount.toLocaleString("en-GB")}
                      </div>
                      <div className="text-[9px] font-mono uppercase tracking-[0.16em] text-chalk-400">Tournaments</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
