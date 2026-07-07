import type { Metadata } from "next";
import Link from "next/link";
import { getMatches, badgeSmallUrl, type ApiMatchListItem } from "@/lib/iosoccer-api";
import ApiUnavailableNotice from "@/components/ApiUnavailableNotice";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Fixtures — IOSHUBv2",
  description: "Upcoming IOSoccer fixtures and scheduled matches.",
};

const PAGE_SIZE = 10;

const SERVER_FLAGS: Record<string, string> = {
  fr: "🇫🇷", de: "🇩🇪", uk: "🇬🇧", gb: "🇬🇧", us: "🇺🇸", br: "🇧🇷",
  es: "🇪🇸", it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", ru: "🇷🇺",
};

function getServerFlag(server: string | null): string {
  if (!server) return "-";
  const lower = server.toLowerCase();
  if (lower.includes("paris") || lower.includes("france") || lower.includes("[eu/fr]")) return "🇫🇷";
  if (lower.includes("amsterdam") || lower.includes("ams") || lower.includes("[eu/nl]")) return "🇳🇱";
  if (lower.includes("frankfurt") || lower.includes("germany") || lower.includes("[eu/de]") || lower.includes("| de |")) return "🇩🇪";
  if (lower.includes("[eu/gb]") || lower.includes("[eu/uk]")) return "🇬🇧";
  if (lower.includes("europe") || lower.includes("[eu/")) return "🇪🇺";
  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`)) return flag;
  }
  return "-";
}

function getMatchFormat(server: string | null): string {
  if (!server) return "-";
  const m = server.match(/(\d+v\d+)/i);
  return m ? m[1] : "-";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string) {
  const d = new Date(iso);
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return `${days[d.getUTCDay()]}, ${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));

  let matches: Awaited<ReturnType<typeof getMatches>>["items"] = [];
  let totalPages = 1;
  let apiUnavailable = false;
  try {
    const data = await getMatches({
      page,
      pageSize: PAGE_SIZE,
      matchType: 2,
      includePast: false,
    });
    matches = data.items ?? [];
    totalPages = data.totalPages ?? 1;
  } catch {
    // Live API is down — try upcoming matches from our DB. Fixtures are future
    // matches which the scrapers may not store, so this can legitimately be
    // empty; in that case we show a neutral "no fixtures" state rather than the
    // alarming "API unreachable" message.
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const rows = await prisma.$queryRaw<{
        id: number; date: Date; home_team_id: number; away_team_id: number;
        home_name: string; away_name: string; home_logo: string | null; away_logo: string | null;
        match_type: string; server: string | null; tournament_id: number | null; tournament_name: string | null;
      }[]>`
        SELECT
          m.id, m.date, m.home_team_id, m.away_team_id,
          th.name AS home_name, ta.name AS away_name,
          th.logo AS home_logo, ta.logo AS away_logo,
          m.match_type, m.server, m.tournament_id,
          tr.name AS tournament_name
        FROM matches m
        JOIN teams th ON th.id = m.home_team_id
        JOIN teams ta ON ta.id = m.away_team_id
        LEFT JOIN tournaments tr ON tr.id = m.tournament_id
        WHERE m.date > NOW() AND m.match_type = 'competitive'
        ORDER BY m.date ASC
        LIMIT ${PAGE_SIZE} OFFSET ${offset}
      `;
      matches = rows.map((r) => ({
        id: r.id,
        teamHomeId: r.home_team_id,
        teamAwayId: r.away_team_id,
        teamHome: { name: r.home_name, badgeImage: r.home_logo ? { smallUrl: r.home_logo } : null, color: null },
        teamAway: { name: r.away_name, badgeImage: r.away_logo ? { smallUrl: r.away_logo } : null, color: null },
        matchStatistics: null,
        kickOff: new Date(r.date).toISOString(),
        matchType: r.match_type === "competitive" ? 2 : 1,
        format: null,
        server: r.server ? { name: r.server } : null,
        playerOfTheMatch: null,
        tournament: r.tournament_id ? { id: r.tournament_id, name: r.tournament_name ?? "" } : null,
        tournamentGroupMatches: null,
      })) satisfies ApiMatchListItem[];
      // DB reached (even if empty) — don't show the unreachable notice.
      apiUnavailable = false;
    } catch {
      apiUnavailable = true;
    }
  }

  function pageUrl(p: number) {
    return p === 1 ? "/fixtures" : `/fixtures?page=${p}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">FIXTURES</h1>
        <p className="text-chalk-400 text-sm font-body mt-1">Upcoming scheduled matches · EU · Competitive</p>
      </div>

      {matches.length === 0 ? (
        apiUnavailable ? (
          <ApiUnavailableNotice variant="empty" />
        ) : (
          <div className="text-center py-16 text-chalk-400 font-body">No upcoming fixtures found.</div>
        )
      ) : (
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk-100/8">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400 whitespace-nowrap">DATE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">MATCH</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400 whitespace-nowrap">MATCH TYPE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400 whitespace-nowrap">FORMAT</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">VENUE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400"></th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m: any, i: number) => {
                const homeLogo = badgeSmallUrl(m.teamHome?.badgeImage ?? null);
                const awayLogo = badgeSmallUrl(m.teamAway?.badgeImage ?? null);
                const serverName: string | null = m.server?.name ?? null;
                const flag = getServerFlag(serverName);
                const format = getMatchFormat(serverName);
                const tournamentName: string | null = m.tournament?.name ?? null;
                const isComp = m.matchType === 2;
                return (
                  <tr key={m.id} className={`border-b border-chalk-100/4 last:border-0 ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}>
                    <td className="px-4 py-1.5 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      <div className="text-chalk-300">{fmtDate(m.kickOff)}</div>
                      <div className="text-chalk-500">{fmtTime(m.kickOff)} UTC</div>
                    </td>
                    <td className="px-4 py-1.5">
                      <Link href={`/matches/${m.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {homeLogo && <img src={homeLogo} alt="" className="w-4 h-4 object-contain" />}
                          <span className="font-body font-600 text-chalk-100">{m.teamHome?.name}</span>
                        </div>
                        <span className="font-mono text-xs text-chalk-500">vs</span>
                        <div className="flex items-center gap-1.5">
                          {awayLogo && <img src={awayLogo} alt="" className="w-4 h-4 object-contain" />}
                          <span className="font-body font-600 text-chalk-100">{m.teamAway?.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-1.5 text-xs whitespace-nowrap">
                      {tournamentName ? (
                        <span className="font-body text-[#F4119E]">{tournamentName}</span>
                      ) : (
                        <span className={`font-mono ${isComp ? "text-[#F4119E]" : "text-chalk-400"}`}>{isComp ? "COMP" : "FRIENDLY"}</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {format}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs text-chalk-500 max-w-[200px]">
                      {serverName ?? "-"}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-sm text-center">
                      {flag}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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
              <Link href={pageUrl(1)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="First page">
                &laquo;
              </Link>
            )}
            {page > 1 && (
              <Link href={pageUrl(Math.max(1, page - 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Back 10 pages">
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
              <Link href={pageUrl(Math.min(totalPages, page + 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Forward 10 pages">
                &gt;
              </Link>
            )}
            {page < totalPages && (
              <Link href={pageUrl(totalPages)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Last page">
                &raquo;
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
