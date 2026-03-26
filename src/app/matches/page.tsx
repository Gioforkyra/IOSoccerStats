import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { proxyImg } from "@/lib/img";
import SyncMatches from "@/components/SyncMatches";

const PAGE_SIZE = 20;

type MatchRow = {
  id: number;
  date: Date;
  home_team_id: number;
  away_team_id: number;
  home_score: number;
  away_score: number;
  match_type: string;
  map: string | null;
  server: string | null;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
};

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const offset = (page - 1) * PAGE_SIZE;

  const matches = await prisma.$queryRaw<MatchRow[]>`
    SELECT
      m.id,
      m.date,
      m.home_team_id,
      m.away_team_id,
      m.home_score,
      m.away_score,
      m.match_type,
      m.map,
      m.server,
      ht.name AS home_name,
      at.name AS away_name,
      ht.logo AS home_logo,
      at.logo AS away_logo
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total FROM matches
  `;
  const totalMatches = Number(countResult[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  function pageUrl(p: number) {
    return p === 1 ? "/matches" : `/matches?page=${p}`;
  }

  // Group matches by date
  const grouped: { date: string; matches: MatchRow[] }[] = [];
  for (const m of matches) {
    const dateStr = new Date(m.date).toLocaleDateString("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateStr) {
      last.matches.push(m);
    } else {
      grouped.push({ date: dateStr, matches: [m] });
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <SyncMatches />
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            MATCHES
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {totalMatches.toLocaleString()} matches played
          </p>
        </div>
      </div>

      {grouped.map((group) => (
        <div key={group.date} className="mb-6">
          <h2 className="text-xs font-mono text-chalk-400 mb-2 uppercase tracking-wider">
            {group.date}
          </h2>
          <div className="rounded-lg border border-chalk-100/8 overflow-hidden bg-pitch-900/40 divide-y divide-chalk-100/5">
            {group.matches.map((m, i) => {
              const homeLogo = m.home_logo ? proxyImg(m.home_logo) : null;
              const awayLogo = m.away_logo ? proxyImg(m.away_logo) : null;
              const time = new Date(m.date).toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <Link
                  key={m.id}
                  href={`/matches/${m.id}`}
                  className={`flex items-center gap-3 px-4 py-2 pink-hover group ${
                    i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"
                  }`}
                >
                  {/* Time */}
                  <span className="text-xs font-mono text-chalk-400 w-12 shrink-0">
                    {time}
                  </span>

                  {/* Home team */}
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="font-body text-sm text-chalk-100 truncate text-right">
                      {m.home_name}
                    </span>
                    {homeLogo ? (
                      <img src={homeLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-pitch-700 shrink-0" />
                    )}
                  </div>

                  {/* Score */}
                  <div className="font-display font-800 text-base flex items-center gap-1.5 w-16 justify-center shrink-0">
                    <span className="text-chalk-100">
                      {m.home_score}
                    </span>
                    <span className="text-chalk-400/30 text-xs">-</span>
                    <span className="text-chalk-100">
                      {m.away_score}
                    </span>
                  </div>

                  {/* Away team */}
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {awayLogo ? (
                      <img src={awayLogo} alt="" className="w-5 h-5 object-contain shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded bg-pitch-700 shrink-0" />
                    )}
                    <span className="font-body text-sm text-chalk-100 truncate">
                      {m.away_name}
                    </span>
                  </div>

                  {/* Match type badge */}
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 ${
                    m.match_type === "competitive"
                      ? "text-amber-400 bg-amber-400/10"
                      : "text-chalk-400 bg-pitch-800"
                  }`}>
                    {m.match_type === "competitive" ? "COMP" : "FR"}
                  </span>

                  {/* Arrow */}
                  <span className="text-chalk-400/20 group-hover:text-[#F4119E] transition-colors shrink-0">
                    {"\u2192"}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {matches.length === 0 && (
        <div className="text-center py-16 text-chalk-400 font-body">
          No matches found. Data is being scraped...
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs font-mono text-chalk-400">
            Page {page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            {page > 1 && (
              <Link
                href={pageUrl(1)}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="First page"
              >
                &laquo;
              </Link>
            )}
            {page > 1 && (
              <Link
                href={pageUrl(Math.max(1, page - 10))}
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
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <Link
                  key={p}
                  href={pageUrl(p)}
                  className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${
                    p === page
                      ? "bg-[#F4119E] text-white font-700"
                      : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
            {page < totalPages && (
              <Link
                href={pageUrl(Math.min(totalPages, page + 10))}
                className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center"
                title="Forward 10 pages"
              >
                &gt;
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={pageUrl(totalPages)}
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
