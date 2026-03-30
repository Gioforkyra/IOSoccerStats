import Link from "next/link";
import HomeSearchPanel from "@/components/HomeSearchPanel";
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
    getMatches({ page: 1, pageSize: 4, matchType: 1 }),
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

  return (
    <div className="min-h-screen relative overflow-hidden bg-pitch-950">
      <ParticlesBackground />

      {/* Content */}
      <div className="relative z-10">
        <section>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-12 pb-12">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center flex-wrap">
                <h1 className="font-display text-5xl font-black uppercase leading-[0.95] tracking-tight text-chalk-100 md:text-7xl">
                  IOS<span className="text-[#F4119E]">HUB</span>v2
                </h1>
                <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-[#F4119E]/30 bg-[#F4119E]/8 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em] text-[#F4119E]">
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-[#F4119E]" />
                  Online
                </div>
              </div>
              <p className="mt-4 max-w-xl text-sm font-body leading-6 text-chalk-300">
                Broadcast-grade analytics for the IOSoccer community. Players, teams,
                live scores, match breakdowns and tournament tracking from one hub.
              </p>
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
                  href="/ratings"
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

              {/* Live Scores */}
              <Link
                href="/matches/live"
                className="group rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
              >
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-2">
                  Live
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="live-dot inline-block h-2 w-2 rounded-full bg-grass-500" />
                  <span className="font-display text-lg font-700 text-chalk-100">Live Scores</span>
                </div>
                <p className="text-xs font-body text-chalk-300 leading-5 mb-3">
                  Follow active matches in real time with scorelines, events and server info.
                </p>
                <span className="text-xs font-mono text-[#F4119E] group-hover:text-[#F4119E]/70 transition-colors">
                  Open Live {"->"}
                </span>
              </Link>

              {/* Players + Tournaments + DB Stats */}
              <div className="space-y-3">
                <Link
                  href="/players"
                  className="group block rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-1">
                    Players
                  </div>
                  <div className="font-display text-base font-700 text-chalk-100">
                    {playersCount.toLocaleString("en-GB")} Players
                  </div>
                  <span className="mt-1.5 inline-block text-xs font-mono text-[#F4119E] group-hover:text-[#F4119E]/70 transition-colors">
                    Browse {"->"}
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
