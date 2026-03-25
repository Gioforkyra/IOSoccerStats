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

function formatDateLabel(date: Date | null | undefined) {
  if (!date) return "Waiting for sync";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function formatMatchTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function PanelLink({
  eyebrow,
  title,
  description,
  href,
  cta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group home-card-hover rounded-[28px] border border-chalk-100/8 bg-[linear-gradient(180deg,rgba(10,24,22,0.92),rgba(11,20,19,0.88))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]"
    >
      <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
        {eyebrow}
      </div>
      <h3 className="mt-4 font-display text-2xl font-700 tracking-wide text-chalk-100">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm font-body leading-6 text-chalk-300">
        {description}
      </p>
      <div className="home-accent-link mt-6 text-sm font-mono">
        {cta} {"->"}
      </div>
    </Link>
  );
}

export default async function HomePage() {
  const [
    playersCount,
    matchesCount,
    teamsCount,
    tournamentsCount,
    ratingAggregate,
    latestSync,
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
    prisma.match.findFirst({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        createdAt: true,
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
  const dbUpdatedLabel = formatDateLabel(latestSync?.createdAt);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(131,208,203,0.18),transparent_36%),linear-gradient(180deg,#061724_0%,#0d2e40_30%,#07161f_100%)]">
      <section className="border-b border-chalk-100/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-14 pb-14">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl">
              <div className="stats-accent-pill inline-flex items-center gap-2 rounded-full border bg-pitch-950/50 px-3 py-1 text-[11px] font-mono uppercase tracking-[0.22em]">
                <span className="live-dot stats-accent-dot inline-block h-2 w-2 rounded-full" />
                Europe Region Data
              </div>
              <h1 className="mt-6 font-display text-6xl font-900 leading-[0.9] tracking-tight text-chalk-100 md:text-8xl">
                IOSoccer-
                <span className="stats-accent-text">Stats</span>
              </h1>
              <p className="mt-5 max-w-2xl text-lg font-body leading-8 text-chalk-200">
                Broadcast-grade analytics for the IOSoccer community. Search players and teams,
                break down recent matches, follow live scores and dive into tournament tracking
                from one hub.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:min-w-[360px]">
              <div className="rounded-[24px] border border-chalk-100/8 bg-pitch-950/60 px-5 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
                  Database Updated
                </div>
                <div className="mt-3 font-display text-2xl font-700 text-chalk-100">
                  {dbUpdatedLabel}
                </div>
                <div className="mt-1 text-xs font-body text-chalk-400">
                  Latest imported match data
                </div>
              </div>
              <div className="rounded-[24px] border border-chalk-100/8 bg-pitch-950/60 px-5 py-4 backdrop-blur-sm">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
                  Coverage
                </div>
                <div className="stats-accent-text mt-3 inline-block font-display text-2xl font-700">
                  Players, Teams, Matches
                </div>
                <div className="mt-1 text-xs font-body text-chalk-400">
                  xG, lineups, live scores and standings
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 grid gap-4 xl:grid-cols-[1.65fr_0.95fr]">
            <HomeSearchPanel playersCount={playersCount} teamsCount={teamsCount} />

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[28px] border border-chalk-100/8 bg-[linear-gradient(180deg,rgba(12,30,28,0.94),rgba(11,20,19,0.88))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
                <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
                  Database Snapshot
                </div>
                <div className="mt-6 grid grid-cols-2 gap-5">
                  <div>
                    <div className="font-display text-4xl font-800 text-chalk-100">
                      {playersCount.toLocaleString("en-GB")}
                    </div>
                    <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Total Players
                    </div>
                  </div>
                  <div>
                    <div className="stats-accent-text inline-block font-display text-4xl font-800">
                      {avgRating.toFixed(2)}
                    </div>
                    <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Avg Rating
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-4xl font-800 text-chalk-100">
                      {matchesCount.toLocaleString("en-GB")}
                    </div>
                    <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Matches Tracked
                    </div>
                  </div>
                  <div>
                    <div className="font-display text-4xl font-800 text-chalk-100">
                      {tournamentsCount.toLocaleString("en-GB")}
                    </div>
                    <div className="mt-1 text-[11px] font-mono uppercase tracking-[0.18em] text-chalk-400">
                      Tournaments
                    </div>
                  </div>
                </div>
              </div>

              <PanelLink
                eyebrow="Live"
                title="Follow Matches In Real Time"
                description="Jump into the live scores board to keep track of active games, scorelines and current server activity."
                href="/matches/live"
                cta="Open Live Scores"
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="home-card-hover rounded-[28px] border border-chalk-100/8 bg-[linear-gradient(180deg,rgba(12,30,28,0.94),rgba(11,20,19,0.88))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
                Leaderboards
              </div>
              <div className="mt-4 space-y-3">
                {featuredPlayers.map((player, index) => (
                  <Link
                    key={player.steamId}
                    href={`/players/${player.steamId}`}
                    className="home-card-hover flex items-center gap-3 rounded-2xl bg-pitch-950/45 px-3 py-3"
                  >
                    <span className="stats-accent-badge flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-display font-700">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-body text-sm font-medium text-chalk-100">
                        {player.username}
                      </div>
                      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-chalk-400">
                        {player.position || "Player"}
                      </div>
                    </div>
                    <span className="home-accent-link text-sm font-mono">
                      {player.rating?.toFixed(1)}
                    </span>
                  </Link>
                ))}
              </div>
              <Link
                href="/players?sort=rating"
                className="home-accent-link mt-5 inline-block text-sm font-mono"
              >
                View Player Rankings {"->"}
              </Link>
            </div>

            <div className="home-card-hover rounded-[28px] border border-chalk-100/8 bg-[linear-gradient(180deg,rgba(12,30,28,0.94),rgba(11,20,19,0.88))] p-6 shadow-[0_22px_60px_rgba(0,0,0,0.28)]">
              <div className="text-[11px] font-mono uppercase tracking-[0.22em] text-chalk-400">
                Recent Matches
              </div>
              <div className="mt-4 space-y-3">
                {recentMatches.map((match) => {
                  const homeLogo = proxyImg(match.homeTeam.logo);
                  const awayLogo = proxyImg(match.awayTeam.logo);
                  return (
                    <Link
                      key={match.id}
                      href={`/matches/${match.id}`}
                      className="home-card-hover block rounded-2xl bg-pitch-950/45 px-3 py-3"
                    >
                      <div className="text-[11px] font-mono uppercase tracking-[0.16em] text-chalk-400">
                        {formatMatchTime(match.date)}
                        {match.map ? ` | ${match.map}` : ""}
                      </div>
                      <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <div className="flex min-w-0 items-center justify-end gap-2">
                          <span className="truncate text-right text-sm font-body text-chalk-100">
                            {match.homeTeam.name}
                          </span>
                          {homeLogo ? (
                            <img src={homeLogo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full bg-pitch-700" />
                          )}
                        </div>
                        <div className="font-display text-lg font-700 text-chalk-100">
                          {match.homeScore}-{match.awayScore}
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          {awayLogo ? (
                            <img src={awayLogo} alt="" className="h-5 w-5 shrink-0 object-contain" />
                          ) : (
                            <div className="h-5 w-5 shrink-0 rounded-full bg-pitch-700" />
                          )}
                          <span className="truncate text-sm font-body text-chalk-100">
                            {match.awayTeam.name}
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/matches"
                className="home-accent-link mt-5 inline-block text-sm font-mono"
              >
                Open Match Archive {"->"}
              </Link>
            </div>

            <PanelLink
              eyebrow="Teams"
              title={`${teamsCount.toLocaleString("en-GB")} Teams Tracked`}
              description="Browse club and national team pages with squad views, results, player history and tournament appearances."
              href="/teams"
              cta="View Teams"
            />

            <PanelLink
              eyebrow="Tournaments"
              title="League And Cup Coverage"
              description="Check active and completed tournaments, winners, formats and the competitions linked to tracked matches."
              href="/tournaments"
              cta="Browse Tournaments"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
