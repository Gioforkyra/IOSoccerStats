import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { proxyImg } from "@/lib/img";
import HomeSearchPanel from "@/components/HomeSearchPanel";

const HIDDEN_TEAMS = [
  "IOSoccer All",
  "IOSoccer Overlap",
  "IOSoccer Challenge",
  "IOSoccer Premier",
];

function formatMatchTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export default async function HomePage() {
  const [
    playersCount,
    matchesCount,
    teamsCount,
    tournamentsCount,
    ratingAggregate,
    featuredPlayers,
    recentMatches,
  ] = await Promise.all([
    prisma.player.count(),
    prisma.match.count(),
    prisma.team.count({
      where: {
        name: {
          notIn: HIDDEN_TEAMS,
        },
      },
    }),
    prisma.tournament.count(),
    prisma.player.aggregate({
      _avg: { rating: true },
      where: {
        rating: {
          not: null,
        },
      },
    }),
    prisma.player.findMany({
      where: {
        rating: {
          not: null,
        },
      },
      orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
      take: 4,
      select: {
        steamId: true,
        username: true,
        rating: true,
        position: true,
      },
    }),
    prisma.match.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 4,
      select: {
        id: true,
        date: true,
        map: true,
        homeScore: true,
        awayScore: true,
        homeTeam: {
          select: {
            name: true,
            logo: true,
          },
        },
        awayTeam: {
          select: {
            name: true,
            logo: true,
          },
        },
      },
    }),
  ]);

  const avgRating = ratingAggregate._avg.rating ?? 0;

  return (
    <div className="min-h-screen relative overflow-hidden bg-pitch-950">
      {/* Scrolling background pattern */}
      <div className="scroll-bg" />

      {/* Content */}
      <div className="relative z-10">
        <section>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-12">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center flex-wrap">
                <h1 className="font-display text-5xl font-900 leading-[0.95] tracking-tight text-chalk-100 md:text-7xl">
                  IOSoccer-
                  <span className="pink-gradient-text">Stats</span>
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

            {/* Search + Database row */}
            <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
              <HomeSearchPanel playersCount={playersCount} teamsCount={teamsCount} />

              {/* Database stats card */}
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-4">
                  Database
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-display text-2xl font-800 text-chalk-100">
                      {playersCount.toLocaleString("en-GB")}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Players
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-800 pink-gradient-text inline-block">
                      {avgRating.toFixed(2)}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Avg Rating
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-800 text-chalk-100">
                      {matchesCount.toLocaleString("en-GB")}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Matches
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-2xl font-800 text-chalk-100">
                      {tournamentsCount.toLocaleString("en-GB")}
                    </div>
                    <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Tournaments
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom row: Leaderboards, Recent Matches, Live Scores, Teams */}
            <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {/* Leaderboards */}
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Leaderboards
                </div>
                <div className="space-y-1.5">
                  {featuredPlayers.map((player, index) => (
                    <Link
                      key={player.steamId}
                      href={`/players/${player.steamId}`}
                      className="flex items-center gap-2.5 rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover"
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F4119E]/15 text-[#F4119E] text-[11px] font-display font-700">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-body text-sm text-chalk-100">
                          {player.username}
                        </div>
                        <div className="text-[10px] font-mono text-chalk-400">
                          {player.position || "Player"}
                        </div>
                      </div>
                      <span className="text-xs font-mono text-[#F4119E]">
                        {player.rating?.toFixed(1)}
                      </span>
                    </Link>
                  ))}
                </div>
                <Link
                  href="/players?sort=rating"
                  className="mt-3 inline-block text-xs font-mono text-[#F4119E] hover:text-[#F4119E]/70 transition-colors"
                >
                  View Rankings {"->"}
                </Link>
              </div>

              {/* Recent Matches */}
              <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4">
                <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-3">
                  Recent Matches
                </div>
                <div className="space-y-1.5">
                  {recentMatches.map((match) => {
                    const homeLogo = proxyImg(match.homeTeam.logo);
                    const awayLogo = proxyImg(match.awayTeam.logo);
                    return (
                      <Link
                        key={match.id}
                        href={`/matches/${match.id}`}
                        className="block rounded-md bg-pitch-800/40 px-2.5 py-2 pink-hover"
                      >
                        <div className="text-[10px] font-mono text-chalk-400 mb-1">
                          {formatMatchTime(match.date)}
                          {match.map ? ` · ${match.map}` : ""}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-xs font-body text-chalk-100">
                            {match.homeTeam.name}
                          </span>
                          {homeLogo ? (
                            <img src={homeLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                          ) : (
                            <div className="h-4 w-4 shrink-0 rounded-full bg-pitch-700" />
                          )}
                          <span className="font-display text-sm font-700 text-chalk-100 mx-0.5">
                            {match.homeScore}-{match.awayScore}
                          </span>
                          {awayLogo ? (
                            <img src={awayLogo} alt="" className="h-4 w-4 shrink-0 object-contain" />
                          ) : (
                            <div className="h-4 w-4 shrink-0 rounded-full bg-pitch-700" />
                          )}
                          <span className="truncate text-xs font-body text-chalk-100">
                            {match.awayTeam.name}
                          </span>
                        </div>
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

              {/* Teams + Tournaments */}
              <div className="space-y-3">
                <Link
                  href="/teams"
                  className="group block rounded-xl border border-chalk-100/8 bg-pitch-900/50 p-4 hover:border-[#F4119E]/30 transition-colors"
                >
                  <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-chalk-400 mb-1">
                    Teams
                  </div>
                  <div className="font-display text-base font-700 text-chalk-100">
                    {teamsCount.toLocaleString("en-GB")} Teams
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
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
