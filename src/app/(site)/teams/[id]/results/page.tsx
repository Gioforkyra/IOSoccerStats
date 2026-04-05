import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";

export const dynamic = "force-dynamic";

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
  match_type: string;
  potm: string | null;
  potm_steam_id: string | null;
  server: string | null;
};

type MatchCount = {
  total: bigint;
};

const PAGE_SIZE = 10;

const SERVER_FLAGS: Record<string, string> = {
  fr: "\u{1F1EB}\u{1F1F7}", de: "\u{1F1E9}\u{1F1EA}", uk: "\u{1F1EC}\u{1F1E7}", gb: "\u{1F1EC}\u{1F1E7}",
  us: "\u{1F1FA}\u{1F1F8}", br: "\u{1F1E7}\u{1F1F7}", es: "\u{1F1EA}\u{1F1F8}", it: "\u{1F1EE}\u{1F1F9}",
  nl: "\u{1F1F3}\u{1F1F1}", pl: "\u{1F1F5}\u{1F1F1}", ru: "\u{1F1F7}\u{1F1FA}", ar: "\u{1F1E6}\u{1F1F7}",
  au: "\u{1F1E6}\u{1F1FA}", se: "\u{1F1F8}\u{1F1EA}", no: "\u{1F1F3}\u{1F1F4}", fi: "\u{1F1EB}\u{1F1EE}",
  pt: "\u{1F1F5}\u{1F1F9}", eu: "\u{1F1EA}\u{1F1FA}",
};

function getServerFlag(server: string | null): string {
  if (!server) return "-";
  const lower = server.toLowerCase();
  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`) || lower.includes(`/${code}]`)) return flag;
  }
  return "-";
}

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
    SELECT COUNT(*) AS total
    FROM matches m
    WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
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
      ta.logo AS away_logo,
      m.match_type,
      m.potm,
      (SELECT p.steam_id FROM players p WHERE LOWER(p.username) = LOWER(m.potm) LIMIT 1) AS potm_steam_id,
      m.server
    FROM matches m
    JOIN teams th ON th.id = m.home_team_id
    JOIN teams ta ON ta.id = m.away_team_id
    WHERE (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  return (
    <div>
      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
        <div className="grid grid-cols-[170px_minmax(340px,1fr)_56px_92px_140px_72px_72px] gap-2 px-4 py-3 border-b border-chalk-100/12 text-[11px] font-mono text-chalk-400 uppercase tracking-wide">
          <div>Date</div>
          <div>Match</div>
          <div className="pl-2">Res</div>
          <div className="pl-2">Type</div>
          <div className="pl-2">POTM</div>
          <div className="text-center">Location</div>
          <div className="text-right pr-2">View</div>
        </div>
        <div className="results-rows-container divide-y divide-chalk-100/20">
          {matches.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm font-mono text-chalk-400">
              No matches found.
            </div>
          ) : (
            matches.map((m, rowIdx) => {
              const isHome = m.home_team_id === teamId;
              const won = isHome
                ? m.home_score > m.away_score
                : m.away_score > m.home_score;
              const draw = m.home_score === m.away_score;
              const rowTone = rowIdx % 2 === 0 ? "bg-black/[0.04]" : "";


              return (
                <div
                  key={m.match_id}
                  className={`relative grid grid-cols-[170px_minmax(340px,1fr)_56px_92px_140px_72px_72px] items-center gap-2 px-4 py-2.5 transition-colors hover:bg-[#F4119E]/10 ${rowTone}`}
                >
                  <Link href={`/matches/${m.match_id}`} className="absolute inset-0 z-0" />

                  <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                    <span className="text-xs font-mono text-chalk-400">
                      {new Date(m.date).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-[10px] font-mono text-chalk-500">
                      {new Date(m.date).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>

                  <div className="relative z-10 font-body text-sm text-chalk-200 flex items-center gap-1.5">
                    <Link href={`/teams/${m.home_team_id}`} className="flex items-center gap-1.5 hover:text-[#F4119E] transition-colors">
                      {m.home_logo && (
                        <img src={proxyImg(m.home_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                      )}
                      <span>{m.home_team}</span>
                    </Link>
                    <span className="font-mono text-sm text-chalk-100 ml-2 mr-2 whitespace-nowrap pointer-events-none">
                      {m.home_score} - {m.away_score}
                    </span>
                    <Link href={`/teams/${m.away_team_id}`} className="flex items-center gap-1.5 hover:text-[#F4119E] transition-colors">
                      {m.away_logo && (
                        <img src={proxyImg(m.away_logo)!} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                      )}
                      <span>{m.away_team}</span>
                    </Link>
                  </div>

                  <div className="relative z-10 pointer-events-none pl-2">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-mono font-700 ${
                      won ? "bg-green-500/20 text-green-400" : draw ? "bg-chalk-400/20 text-chalk-400" : "bg-red-500/20 text-red-400"
                    }`}>
                      {won ? "W" : draw ? "D" : "L"}
                    </span>
                  </div>

                  <div className="relative z-10 text-xs font-mono uppercase pointer-events-none pl-2">
                    <span className={m.match_type === "competitive" ? "text-yellow-400" : "text-chalk-300"}>
                      {m.match_type === "competitive" ? "comp" : "friendly"}
                    </span>
                  </div>

                  <div className="relative z-10 text-xs font-body truncate pointer-events-none pl-2">
                    {m.potm ? (
                      m.potm_steam_id ? (
                        <Link href={`/players/${m.potm_steam_id}`} className="text-[#56a3ff] hover:text-[#F4119E] transition-colors pointer-events-auto">
                          {m.potm}
                        </Link>
                      ) : (
                        <span className="text-[#56a3ff]">{m.potm}</span>
                      )
                    ) : "-"}
                  </div>

                  <div className="relative z-10 text-sm font-mono text-chalk-200 pointer-events-none flex justify-center">
                    <span>{getServerFlag(m.server)}</span>
                  </div>

                  <div className="relative z-10 pointer-events-auto flex justify-end pr-2">
                    <Link
                      href={`/matches/${m.match_id}`}
                      className="inline-flex items-center justify-center rounded-md border border-[#F4119E] bg-transparent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#F4119E] transition-colors hover:bg-[#F4119E] hover:text-white"
                    >
                      View
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
