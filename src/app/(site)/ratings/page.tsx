import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import RatingsDistributionChart from "@/components/RatingsDistributionChart";
import { RatingsFilters } from "./RatingsFilters";

export const metadata: Metadata = {
  title: "Player Ratings — IOSHUBv2",
  description: "IOSoccer player ratings leaderboard and historical rating distribution.",
};

export const revalidate = 604800; // 1 week

const getPeriods = unstable_cache(
  async () => {
    const periodsRaw = await prisma.$queryRaw<{ period: string }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', recorded_at), 'YYYY-MM') AS period
      FROM player_rating_history
      GROUP BY DATE_TRUNC('month', recorded_at)
      ORDER BY DATE_TRUNC('month', recorded_at) DESC
    `;
    return periodsRaw.map((r) => r.period);
  },
  ["ratings-periods"],
  { revalidate: 604800, tags: ["ratings"] }
);

const getRatingsForPeriod = unstable_cache(
  async (selectedPeriod: string, minMatches: number) => {
    return prisma.$queryRaw<{ steam_id: string; username: string; rating: number }[]>`
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
    `;
  },
  ["ratings-by-period"],
  { revalidate: 604800, tags: ["ratings"] }
);

export default async function RatingsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; min?: string }>;
}) {
  const { period, min } = await searchParams;
  const minMatches = min === undefined ? 100 : Math.max(0, parseInt(min) || 0);

  const periods = await getPeriods();
  const selectedPeriod = period && periods.includes(period) ? period : periods[0];

  const rows = selectedPeriod
    ? await getRatingsForPeriod(selectedPeriod, minMatches)
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

      <RatingsFilters
        periods={periods}
        selectedPeriod={selectedPeriod ?? ""}
        minMatches={minMatches}
      />

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
