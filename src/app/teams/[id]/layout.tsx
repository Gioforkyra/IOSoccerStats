import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import TeamTabs from "./TeamTabs";

type TeamStats = {
  total_matches: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
  goals_for: bigint;
  goals_against: bigint;
  goal_diff: bigint;
};

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return notFound();

  const [stats] = await prisma.$queryRaw<[TeamStats]>`
    SELECT
      COUNT(DISTINCT m.id) AS total_matches,
      COUNT(DISTINCT CASE
        WHEN (m.home_team_id = ${teamId} AND m.home_score > m.away_score) OR
             (m.away_team_id = ${teamId} AND m.away_score > m.home_score)
        THEN m.id END) AS wins,
      COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.id END) AS draws,
      COUNT(DISTINCT CASE
        WHEN (m.home_team_id = ${teamId} AND m.home_score < m.away_score) OR
             (m.away_team_id = ${teamId} AND m.away_score < m.home_score)
        THEN m.id END) AS losses,
      COALESCE(SUM(CASE WHEN m.home_team_id = ${teamId} THEN m.home_score
                        WHEN m.away_team_id = ${teamId} THEN m.away_score END), 0) AS goals_for,
      COALESCE(SUM(CASE WHEN m.home_team_id = ${teamId} THEN m.away_score
                        WHEN m.away_team_id = ${teamId} THEN m.home_score END), 0) AS goals_against,
      COALESCE(SUM(CASE WHEN m.home_team_id = ${teamId} THEN m.home_score - m.away_score
                        WHEN m.away_team_id = ${teamId} THEN m.away_score - m.home_score END), 0) AS goal_diff
    FROM matches m
    WHERE m.home_team_id = ${teamId} OR m.away_team_id = ${teamId}
  `;

  const matches = Number(stats.total_matches);
  const wins = Number(stats.wins);
  const draws = Number(stats.draws);
  const losses = Number(stats.losses);
  const gf = Number(stats.goals_for);
  const gd = Number(stats.goal_diff);
  const winPct = matches > 0 ? ((wins / matches) * 100).toFixed(1) : "0";

  const winPctBar = matches > 0 ? (wins / matches) * 100 : 0;
  const drawPctBar = matches > 0 ? (draws / matches) * 100 : 0;
  const lossPctBar = matches > 0 ? (losses / matches) * 100 : 0;

  const teamColor = team.color || null;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/teams" className="hover:text-grass-500 transition-colors">
          Teams
        </Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">{team.name}</span>
      </div>

      {/* Hero Card */}
      <div
        className="relative rounded-xl border border-chalk-100/8 overflow-hidden mb-6"
        style={{
          background: teamColor
            ? `linear-gradient(135deg, ${teamColor}40 0%, ${teamColor}25 50%, rgba(23,23,23,0.95) 100%)`
            : undefined,
          backgroundColor: teamColor ? undefined : "rgb(var(--pitch-900))",
        }}
      >
        {team.logo && (
          <div className="absolute right-6 md:right-10 top-1/2 -translate-y-1/2 opacity-[0.15] pointer-events-none">
            <img src={proxyImg(team.logo)!} alt="" className="w-28 h-28 md:w-40 md:h-40 object-contain" />
          </div>
        )}

        <div className="relative flex items-center gap-6 p-6 md:p-8">
          {team.logo ? (
            <img
              src={proxyImg(team.logo)!}
              alt={team.name}
              className="w-20 h-20 md:w-24 md:h-24 object-contain shrink-0"
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 flex items-center justify-center text-2xl font-display font-900 text-chalk-300 shrink-0 rounded-lg border-2 border-chalk-100/10 bg-pitch-700">
              {team.slug?.slice(0, 3).toUpperCase() || "?"}
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1 className="font-display font-900 text-3xl md:text-4xl tracking-tight text-chalk-100 uppercase">
              {team.name}
            </h1>
            <div className="flex items-center gap-3 mt-2 text-sm font-mono text-chalk-400">
              <span className="bg-pitch-800/60 px-2 py-0.5 rounded text-chalk-300">
                {team.slug}
              </span>
              {team.region && <span>{team.region}</span>}
              {team.inactive && (
                <span className="text-red-400/80 text-xs">Inactive</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {[
          { label: "Played", value: matches.toLocaleString() },
          { label: "Wins", value: wins.toLocaleString() },
          { label: "Draws", value: draws.toLocaleString() },
          { label: "Losses", value: losses.toLocaleString() },
          { label: "Win%", value: `${winPct}%`, highlight: true },
          { label: "GF", value: gf.toLocaleString() },
          { label: "GD", value: `${gd > 0 ? "+" : ""}${gd.toLocaleString()}`, highlight: gd > 0 },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4"
          >
            <div className="text-[10px] font-mono text-chalk-400 uppercase mb-1">
              {s.label}
            </div>
            <div
              className={`text-2xl font-display font-800 ${
                s.highlight ? "text-grass-500" : "text-chalk-100"
              }`}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* W/D/L Bar */}
      {matches > 0 && (
        <div className="mb-6">
          <div className="flex h-2.5 rounded-full overflow-hidden bg-pitch-800 border border-chalk-100/8">
            {winPctBar > 0 && (
              <div
                className="bg-grass-500 transition-all"
                style={{ width: `${winPctBar}%` }}
                title={`Wins: ${wins} (${winPctBar.toFixed(1)}%)`}
              />
            )}
            {drawPctBar > 0 && (
              <div
                className="bg-chalk-400/40 transition-all"
                style={{ width: `${drawPctBar}%` }}
                title={`Draws: ${draws} (${drawPctBar.toFixed(1)}%)`}
              />
            )}
            {lossPctBar > 0 && (
              <div
                className="bg-red-400 transition-all"
                style={{ width: `${lossPctBar}%` }}
                title={`Losses: ${losses} (${lossPctBar.toFixed(1)}%)`}
              />
            )}
          </div>
          <div className="flex items-center gap-6 mt-2 text-sm font-mono">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-grass-500" />
              <span className="text-grass-500 font-700">W {winPctBar.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-chalk-400/40" />
              <span className="text-chalk-300 font-700">D {drawPctBar.toFixed(1)}%</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="text-red-400 font-700">L {lossPctBar.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <TeamTabs teamId={teamId} />

      {/* Tab content */}
      {children}
    </div>
  );
}
