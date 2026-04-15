import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import RatingsDistributionChart from "@/components/RatingsDistributionChart";

export const metadata: Metadata = {
  title: "Player Ratings — IOSHUBv2",
  description: "IOSoccer player ratings leaderboard and historical rating distribution.",
};

export const revalidate = 604800; // 1 week

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MIN_MATCHES_OPTIONS = [0, 50, 100, 500, 1000, 2000];
function fmtPeriod(ym: string) {
  const [y, m] = ym.split("-");
  return `${MONTHS[parseInt(m) - 1]} ${y}`;
}

function buildHref(period: string, minMatches: number) {
  const params = new URLSearchParams();
  params.set("period", period);
  if (minMatches > 0) params.set("min", String(minMatches));
  return `/ratings?${params.toString()}`;
}

export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; min?: string }>;
}) {
  const { period, min } = await searchParams;
  const minMatches = Math.max(0, parseInt(min ?? "0") || 0);

  const periodsRaw = await prisma.$queryRaw<{ period: string }[]>`
    SELECT TO_CHAR(DATE_TRUNC('month', recorded_at), 'YYYY-MM') AS period
    FROM player_rating_history
    GROUP BY DATE_TRUNC('month', recorded_at)
    ORDER BY DATE_TRUNC('month', recorded_at) DESC
  `;
  const periods = periodsRaw.map((r) => r.period);
  const selectedPeriod = period && periods.includes(period) ? period : periods[0];

  const rows = selectedPeriod
    ? await prisma.$queryRaw<{ steam_id: string; username: string; rating: number }[]>`
        SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
        FROM player_rating_history prh
        JOIN players p ON p.steam_id = prh.steam_id
        WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = ${selectedPeriod}
          AND prh.rating > 0
          AND EXISTS (
            SELECT 1 FROM match_player_stats mps
            JOIN matches m ON m.id = mps.match_id
            JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
            WHERE mps.player_steam_id = prh.steam_id
              AND t.region_id = 1
          )
          AND (
            ${minMatches} = 0
            OR (
              SELECT COUNT(DISTINCT mps2.match_id)
              FROM match_player_stats mps2
              JOIN matches m2 ON m2.id = mps2.match_id
              JOIN teams t2 ON t2.id = m2.home_team_id OR t2.id = m2.away_team_id
              WHERE mps2.player_steam_id = prh.steam_id
                AND t2.region_id = 1
            ) >= ${minMatches}
          )
        GROUP BY prh.steam_id, p.username
        HAVING AVG(prh.rating) > 0
        ORDER BY rating ASC
      `
    : [];

  return (
    <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display font-900 text-3xl tracking-wider text-chalk-100 uppercase mb-1">
          Ratings
        </h1>
        <p className="text-sm font-body text-chalk-400">
          Rating distribution — {rows.length} players
        </p>
      </div>

      {/* Filters row */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        {/* Period selector */}
        <div className="flex flex-wrap gap-2">
          {periods.map((p) => (
            <Link
              key={p}
              href={buildHref(p, minMatches)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-600 transition-colors border ${
                p === selectedPeriod
                  ? "bg-[#F4119E]/15 border-[#F4119E]/50 text-chalk-100"
                  : "bg-pitch-900/40 border-chalk-100/10 text-chalk-400 hover:text-chalk-100 hover:border-chalk-100/20"
              }`}
            >
              {fmtPeriod(p)}
            </Link>
          ))}
        </div>

        <div className="w-px h-4 bg-chalk-100/10" />

        {/* Min matches filter */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">min matches</span>
          <div className="flex gap-1">
            {MIN_MATCHES_OPTIONS.map((m) => (
              <Link
                key={m}
                href={buildHref(selectedPeriod ?? "", m)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors border ${
                  m === minMatches
                    ? "bg-chalk-100/10 border-chalk-100/30 text-chalk-100"
                    : "bg-transparent border-chalk-100/8 text-chalk-500 hover:text-chalk-300 hover:border-chalk-100/20"
                }`}
              >
                {m === 0 ? "all" : `${m}+`}
              </Link>
            ))}
          </div>
        </div>

        <div className="w-px h-4 bg-chalk-100/10" />

        <span className="text-[10px] font-mono text-chalk-500 uppercase tracking-wider">EU players only</span>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 text-chalk-400 font-body">
          No rating data for this period.
        </div>
      ) : (
        <RatingsDistributionChart players={rows} />
      )}
    </main>
  );
}
