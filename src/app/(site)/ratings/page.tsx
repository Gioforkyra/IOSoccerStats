import { prisma } from "@/lib/prisma";
import Link from "next/link";
import RatingsDistributionChart from "@/components/RatingsDistributionChart";
import { getPlayerStatisticsTotals } from "@/lib/iosoccer-api";

export const revalidate = 0;

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MIN_MATCHES_OPTIONS = [0, 10, 25, 50, 100, 200];
const API_PAGE_SIZE = 500;

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

async function getEligibleSteamIdsByMinApps(minMatches: number): Promise<Set<string> | null> {
  if (minMatches <= 0) return null;

  const result = new Set<string>();
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 200) {
    const res = await getPlayerStatisticsTotals({
      page,
      pageSize: API_PAGE_SIZE,
      sortBy: "PlayerId",
      sortOrder: "ASC",
      minApps: minMatches,
      includeSubstituteAppearances: true,
      matchFormat: 8,
      regionId: 1,
      timePeriod: 0,
    });

    totalPages = Math.max(1, res.totalPages || 1);
    for (const item of res.items) {
      const steamId = String(item.steamID ?? "").trim();
      if (steamId) result.add(steamId);
    }
    page += 1;
  }

  return result;
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

  const eligibleSteamIds = await getEligibleSteamIdsByMinApps(minMatches);

  const baseRows = selectedPeriod
    ? await prisma.$queryRaw<{ steam_id: string; username: string; rating: number }[]>`
        SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
        FROM player_rating_history prh
        JOIN players p ON p.steam_id = prh.steam_id
        WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = ${selectedPeriod}
          AND prh.rating > 0
        GROUP BY prh.steam_id, p.username
        HAVING AVG(prh.rating) > 0
        ORDER BY rating ASC
      `
    : [];

  const rows = eligibleSteamIds
    ? baseRows.filter((r) => eligibleSteamIds.has(r.steam_id))
    : baseRows;

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
