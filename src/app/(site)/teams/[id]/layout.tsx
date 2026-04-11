import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getCardContrastPalette } from "@/lib/card-contrast";
import TeamTabs from "./TeamTabs";
import { ActivityHeatmap } from "@/components/ActivityHeatmap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return { title: "Team — IOSHUBv2" };
  const rows = await prisma.$queryRaw<{ name: string }[]>`SELECT name FROM teams WHERE id = ${teamId} LIMIT 1`;
  if (!rows.length) return { title: "Team — IOSHUBv2" };
  return {
    title: `${rows[0].name} — IOSHUBv2`,
    description: `Stats, squad, match history and results for ${rows[0].name} on IOSoccer.`,
  };
}

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

  const teamRows = await prisma.$queryRaw<{ id: number; name: string; slug: string; logo: string | null; region: string | null; color: string | null; inactive: boolean; avg_rating: number | null }[]>`
    SELECT id, name, slug, logo, region, color, inactive, avg_rating FROM teams WHERE id = ${teamId} LIMIT 1
  `;
  if (!teamRows.length) return notFound();
  const teamRaw = teamRows[0];
  const team = { ...teamRaw, avgRating: teamRaw.avg_rating };

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
  const cardPalette = getCardContrastPalette(teamColor);

  type ActivityRow = { day: string; count: number };
  const activityRows = await prisma.$queryRaw<ActivityRow[]>`
    SELECT
      TO_CHAR(m.date, 'YYYY-MM-DD') AS day,
      COUNT(DISTINCT m.id)::int AS count
    FROM matches m
    WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
      AND m.date >= NOW() - INTERVAL '365 days'
    GROUP BY TO_CHAR(m.date, 'YYYY-MM-DD')
  `;
  const activityData: Record<string, number> = {};
  for (const row of activityRows) activityData[row.day] = row.count;

  const teamRatingAvg = team.avgRating ?? null;

  // Team form — last 5 matches
  type TeamFormRow = { home_team_id: number; home_score: number; away_score: number };
  const formRows = await prisma.$queryRaw<TeamFormRow[]>`
    SELECT home_team_id, home_score, away_score
    FROM matches
    WHERE home_team_id = ${teamId} OR away_team_id = ${teamId}
    ORDER BY date DESC
    LIMIT 5
  `;
  const teamForm = formRows.map((m) => {
    const isHome = m.home_team_id === teamId;
    const won = isHome ? m.home_score > m.away_score : m.away_score > m.home_score;
    const draw = m.home_score === m.away_score;
    return draw ? "D" : won ? "W" : "L";
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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
          backgroundColor: cardPalette.background,
        }}
      >
        <div className="relative flex items-center gap-4 p-4 md:p-5">
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
            <div className="flex items-baseline gap-3 flex-wrap">
              <h1
                className="font-display font-900 text-3xl md:text-3xl tracking-tight uppercase"
                style={{ color: cardPalette.primaryText }}
              >
                {team.name}
              </h1>
              {teamRatingAvg != null && (
                <span
                  className="font-display font-900 text-3xl"
                  style={{
                    color: cardPalette.accentValue,
                    textShadow: cardPalette.isBright
                      ? "0 1px 0 rgba(255,255,255,0.35)"
                      : "0 1px 2px rgba(0,0,0,0.5)",
                  }}
                >
                  {teamRatingAvg.toFixed(2)}
                </span>
              )}
            </div>
            <div
              className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2 text-sm font-mono"
              style={{ color: cardPalette.secondaryText }}
            >
              <span
                className="px-2 py-0.5 rounded"
                style={{ backgroundColor: cardPalette.chipBackground, color: cardPalette.chipText }}
              >
                {team.slug}
              </span>
              {team.region && <span style={{ color: cardPalette.secondaryText }}>{team.region}</span>}
              {team.inactive && (
                <span
                  className="text-xs"
                  style={{ color: cardPalette.isBright ? "#7f1d1d" : "#fecaca" }}
                >
                  Inactive
                </span>
              )}
              {teamForm.length > 0 && (
                <span className="flex items-center gap-1.5 sm:ml-2">
                  {teamForm.map((r, i) => (
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
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
        {[
          { label: "Played", value: matches.toLocaleString(), colorClass: "text-chalk-100" },
          { label: "Wins", value: wins.toLocaleString(), colorClass: "text-chalk-100" },
          { label: "Draws", value: draws.toLocaleString(), colorClass: "text-chalk-100" },
          { label: "Losses", value: losses.toLocaleString(), colorClass: "text-chalk-100" },
          {
            label: "Win%",
            value: `${winPct}%`,
            colorClass: Number(winPct) > 51 ? "wr-elite" : Number(winPct) >= 45 ? "text-green-400" : "text-red-400",
          },
          { label: "GF", value: gf.toLocaleString(), colorClass: "text-chalk-100" },
          {
            label: "GD",
            value: `${gd > 0 ? "+" : ""}${gd.toLocaleString()}`,
            colorClass: gd > 0 ? "text-green-400" : gd < 0 ? "text-red-400" : "text-chalk-100",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4"
          >
            <div className="text-[10px] font-mono text-chalk-400 uppercase mb-1">
              {s.label}
            </div>
            <div className={`text-2xl font-display font-800 ${s.colorClass}`}>
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

      {/* Activity heatmap */}
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/40 px-5 py-4 mb-6">
        <ActivityHeatmap data={activityData} color={teamColor ?? undefined} />
      </div>

      {/* Tabs */}
      <TeamTabs teamId={teamId} />

      {/* Tab content */}
      {children}
    </div>
  );
}
