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

              const rowBg = draw
                ? "border-l-[#5a6e94] bg-[#5a6e94]/10"
                : won
                  ? "border-l-[#22c55e] bg-[#22c55e]/10"
                  : "border-l-[#ef4444] bg-[#ef4444]/10";

              const badgeClass = draw
                ? "bg-[#5a6e94]/20 text-[#5a6e94]"
                : won
                  ? "bg-[#22c55e]/20 text-[#22c55e]"
                  : "bg-[#ef4444]/20 text-[#ef4444]";

              return (
                <Link
                  key={m.match_id}
                  href={`/matches/${m.match_id}`}
                  className={`flex items-center px-4 py-2 border-l-4 pink-hover ${rowBg}`}
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
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs font-mono text-chalk-400">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <Link
                href={`/teams/${teamId}/results?page=1`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="First page"
              >
                &laquo;
              </Link>
            )}
            {currentPage > 1 && (
              <Link
                href={`/teams/${teamId}/results?page=${Math.max(1, currentPage - 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Back 10 pages"
              >
                &lt;
              </Link>
            )}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (currentPage <= 3) {
                p = i + 1;
              } else if (currentPage >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = currentPage - 2 + i;
              }
              return (
                <Link
                  key={p}
                  href={`/teams/${teamId}/results?page=${p}`}
                  className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                    p === currentPage
                      ? "bg-[#F4119E] text-white font-700"
                      : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {currentPage < totalPages && (
              <Link
                href={`/teams/${teamId}/results?page=${Math.min(totalPages, currentPage + 10)}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Forward 10 pages"
              >
                &gt;
              </Link>
            )}
            {currentPage < totalPages && (
              <Link
                href={`/teams/${teamId}/results?page=${totalPages}`}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Last page"
              >
                &raquo;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
