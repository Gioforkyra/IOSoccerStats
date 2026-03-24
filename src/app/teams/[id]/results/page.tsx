import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";

type RecentMatch = {
  match_id: number;
  date: Date;
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  home_logo: string | null;
  away_logo: string | null;
};

type MatchCount = {
  total: bigint;
};

const PAGE_SIZE = 20;

export default async function TeamResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { id } = await params;
  const { page: pageParam } = await searchParams;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const currentPage = Math.max(1, parseInt(pageParam || "1", 10) || 1);
  const offset = (currentPage - 1) * PAGE_SIZE;

  const [countResult] = await prisma.$queryRaw<[MatchCount]>`
    SELECT COUNT(DISTINCT m.id) AS total
    FROM matches m
    WHERE m.home_team_id = ${teamId} OR m.away_team_id = ${teamId}
  `;
  const totalMatches = Number(countResult.total);
  const totalPages = Math.ceil(totalMatches / PAGE_SIZE);

  const matches = await prisma.$queryRaw<RecentMatch[]>`
    SELECT
      m.id AS match_id,
      m.date,
      th.name AS home_team,
      ta.name AS away_team,
      m.home_team_id,
      m.away_team_id,
      m.home_score,
      m.away_score,
      th.logo AS home_logo,
      ta.logo AS away_logo
    FROM matches m
    JOIN teams th ON th.id = m.home_team_id
    JOIN teams ta ON ta.id = m.away_team_id
    WHERE m.home_team_id = ${teamId} OR m.away_team_id = ${teamId}
    ORDER BY m.date DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return (
    <div>
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
        <div className="divide-y divide-chalk-100/8">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-mono text-chalk-400">
              No matches found.
            </div>
          ) : (
            matches.map((m) => {
              const isHome = m.home_team_id === teamId;
              const won = isHome
                ? m.home_score > m.away_score
                : m.away_score > m.home_score;
              const draw = m.home_score === m.away_score;
              const result = draw ? "D" : won ? "W" : "L";

              const borderClass = draw
                ? "border-l-chalk-400 bg-chalk-300/5"
                : won
                  ? "border-l-green-500 bg-green-500/10"
                  : "border-l-red-500 bg-red-500/10";

              const badgeClass = draw
                ? "bg-chalk-400/20 text-chalk-400"
                : won
                  ? "bg-grass-500/20 text-grass-500"
                  : "bg-red-400/20 text-red-400";

              return (
                <Link
                  key={m.match_id}
                  href={`/matches/${m.match_id}`}
                  className={`flex items-center px-4 py-3 border-l-4 hover:bg-pitch-800/50 transition-colors ${borderClass}`}
                >
                  <span className="text-xs font-mono text-chalk-400 w-24 shrink-0">
                    {new Date(m.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <span className="flex-1 font-body text-sm text-chalk-200 truncate flex items-center gap-1.5">
                    {m.home_logo && (
                      <img
                        src={proxyImg(m.home_logo)!}
                        alt=""
                        className="w-5 h-5 object-contain inline-block shrink-0"
                      />
                    )}
                    <span className={isHome ? "font-semibold text-chalk-100" : ""}>
                      {m.home_team}
                    </span>
                    <span className="text-chalk-400 mx-1">vs</span>
                    {m.away_logo && (
                      <img
                        src={proxyImg(m.away_logo)!}
                        alt=""
                        className="w-5 h-5 object-contain inline-block shrink-0"
                      />
                    )}
                    <span className={!isHome ? "font-semibold text-chalk-100" : ""}>
                      {m.away_team}
                    </span>
                  </span>

                  <span className="font-mono text-sm text-chalk-100 font-medium mx-3">
                    {m.home_score} - {m.away_score}
                  </span>

                  <span
                    className={`w-7 h-7 rounded text-xs font-mono font-700 flex items-center justify-center ${badgeClass}`}
                  >
                    {result}
                  </span>
                </Link>
              );
            })
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {currentPage > 1 && (
            <Link
              href={`/teams/${teamId}/results?page=${currentPage - 1}`}
              className="px-3 py-1.5 rounded text-sm font-mono text-chalk-300 bg-pitch-800 border border-chalk-100/8 hover:bg-pitch-700 transition-colors"
            >
              Prev
            </Link>
          )}
          <span className="text-sm font-mono text-chalk-400">
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/teams/${teamId}/results?page=${currentPage + 1}`}
              className="px-3 py-1.5 rounded text-sm font-mono text-chalk-300 bg-pitch-800 border border-chalk-100/8 hover:bg-pitch-700 transition-colors"
            >
              Next
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
