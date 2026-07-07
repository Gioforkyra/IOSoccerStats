import type { Metadata } from "next";
import Link from "next/link";
import { getMatches, badgeSmallUrl, type ApiMatchListItem } from "@/lib/iosoccer-api";
import ApiUnavailableNotice from "@/components/ApiUnavailableNotice";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Matches — IOSHUBv2",
  description: "Browse the full IOSoccer match archive. Filter by type, region and page.",
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

  if (lower.includes("| paris |") || lower.includes(" paris ")) return "\u{1F1EB}\u{1F1F7}";
  if (lower.includes("| amsterdam |") || lower.includes("| ams |") || lower.includes(" amsterdam ")) return "\u{1F1F3}\u{1F1F1}";
  if (lower.includes("| de |") || lower.includes(" germany ") || lower.includes(" deutschland ") || lower.includes(" frankfurt ")) return "\u{1F1E9}\u{1F1EA}";

  if (lower.includes("sudamerica") || lower.includes("south america")) return "\u{1F30E}";
  if (lower.includes("europe")) return "\u{1F1EA}\u{1F1FA}";
  if (lower.includes("france")) return "\u{1F1EB}\u{1F1F7}";
  if (lower.includes("germany")) return "\u{1F1E9}\u{1F1EA}";
  if (lower.includes("italy")) return "\u{1F1EE}\u{1F1F9}";
  if (lower.includes("spain")) return "\u{1F1EA}\u{1F1F8}";
  if (lower.includes("usa") || lower.includes("united states")) return "\u{1F1FA}\u{1F1F8}";
  if (lower.includes("brazil")) return "\u{1F1E7}\u{1F1F7}";
  if (lower.includes("argentina")) return "\u{1F1E6}\u{1F1F7}";
  if (lower.includes("mexico")) return "\u{1F1F2}\u{1F1FD}";

  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`) || lower.includes(`/${code}]`)) return flag;
  }
  return "-";
}

type DbMatchRow = {
  id: number;
  date: Date;
  home_team_id: number;
  away_team_id: number;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
  home_score: number;
  away_score: number;
  match_type: string;
  potm: string | null;
  potm_steam_id: string | null;
  server: string | null;
};

// Fallback used when the live IOSoccer API is unreachable: serve matches from
// our own DB (kept fresh by the scrapers) so the page always renders real data
// instead of an "API unreachable" message. Region is filtered via the home
// team; match format (8v8/4v4) isn't stored, so it's not filtered here.
async function getMatchesFromDb(opts: {
  page: number;
  pageSize: number;
  regionId?: number;
  matchType?: number;
}): Promise<{ items: ApiMatchListItem[]; totalItems: number; totalPages: number }> {
  const offset = (opts.page - 1) * opts.pageSize;
  const regionParam = opts.regionId ?? 0; // 0 = all regions
  const typeParam = opts.matchType === 2 ? "competitive" : opts.matchType === 1 ? "friendly" : "";

  const [countRow] = await prisma.$queryRaw<[{ total: bigint }]>`
    SELECT COUNT(*) AS total
    FROM matches m
    JOIN teams th ON th.id = m.home_team_id
    WHERE (${typeParam}::text = '' OR m.match_type = ${typeParam}::text)
      AND (${regionParam}::int = 0 OR th.region_id = ${regionParam}::int)
  `;
  const totalItems = Number(countRow?.total ?? 0);

  const rows = await prisma.$queryRaw<DbMatchRow[]>`
    SELECT
      m.id,
      m.date,
      m.home_team_id,
      m.away_team_id,
      th.name AS home_name,
      ta.name AS away_name,
      th.logo AS home_logo,
      ta.logo AS away_logo,
      m.home_score,
      m.away_score,
      m.match_type,
      m.potm,
      (SELECT p.steam_id FROM players p WHERE LOWER(p.username) = LOWER(m.potm) LIMIT 1) AS potm_steam_id,
      m.server
    FROM matches m
    JOIN teams th ON th.id = m.home_team_id
    JOIN teams ta ON ta.id = m.away_team_id
    WHERE (${typeParam}::text = '' OR m.match_type = ${typeParam}::text)
      AND (${regionParam}::int = 0 OR th.region_id = ${regionParam}::int)
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${opts.pageSize} OFFSET ${offset}
  `;

  const items: ApiMatchListItem[] = rows.map((r) => ({
    id: r.id,
    teamHomeId: r.home_team_id,
    teamAwayId: r.away_team_id,
    teamHome: { name: r.home_name, badgeImage: r.home_logo ? { smallUrl: r.home_logo } : null, color: null },
    teamAway: { name: r.away_name, badgeImage: r.away_logo ? { smallUrl: r.away_logo } : null, color: null },
    matchStatistics: { matchGoalsHome: r.home_score, matchGoalsAway: r.away_score },
    kickOff: new Date(r.date).toISOString(),
    matchType: r.match_type === "competitive" ? 2 : 1,
    format: null,
    server: r.server ? { name: r.server } : null,
    playerOfTheMatch: r.potm ? { name: r.potm, steamID: r.potm_steam_id ?? "" } : null,
    tournament: null,
    tournamentGroupMatches: null,
  }));

  return { items, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / opts.pageSize)) };
}

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; region?: string; format?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const matchTypeFilter = params.type || "all";
  const regionFilter = params.region || "eu";
  const formatFilter = params.format === "4v4" ? "4v4" : "8v8";

  const matchType = matchTypeFilter === "all" ? undefined : matchTypeFilter === "comp" ? 2 : 1;
  const regionId = regionFilter === "all" ? undefined : regionFilter === "am" ? 2 : 1;
  const matchFormat = formatFilter === "4v4" ? 4 : 8;

  let matches: Awaited<ReturnType<typeof getMatches>>["items"] = [];
  let totalMatches = 0;
  let totalPages = 1;
  let apiUnavailable = false;
  try {
    const data = await getMatches({ page, pageSize: PAGE_SIZE, matchType, matchFormat, regionId });
    matches = data.items;
    totalMatches = data.totalItems;
    totalPages = data.totalPages;
  } catch {
    // Live API is down — fall back to our own DB so the page still shows real
    // data instead of an "unreachable" message.
    try {
      const db = await getMatchesFromDb({ page, pageSize: PAGE_SIZE, regionId, matchType });
      matches = db.items;
      totalMatches = db.totalItems;
      totalPages = db.totalPages;
      if (db.items.length === 0) apiUnavailable = true;
    } catch {
      apiUnavailable = true;
    }
  }

  function pageUrl(p: number, t = matchTypeFilter, r = regionFilter, f = formatFilter) {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (t !== "all") q.set("type", t);
    if (r !== "eu") q.set("region", r);
    if (f !== "8v8") q.set("format", f);
    const qs = q.toString();
    return qs ? `/matches?${qs}` : "/matches";
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
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

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {[
          { key: "eu", label: "EU" },
          { key: "am", label: "AM" },
          { key: "all", label: "ALL" },
        ].map((r) => {
          const active = regionFilter === r.key;
          const cn = `h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
            active
              ? "bg-[#F4119E] text-white border-[#F4119E] cursor-default"
              : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
          }`;
          return active ? (
            <span key={r.key} className={cn} aria-current="page">{r.label}</span>
          ) : (
            <Link key={r.key} href={pageUrl(1, matchTypeFilter, r.key, formatFilter)} className={cn}>{r.label}</Link>
          );
        })}

        <div className="w-px h-6 bg-chalk-100/15 mx-1" />

        {[
          { key: "all", label: "ALL" },
          { key: "comp", label: "COMP" },
          { key: "friendly", label: "FRIENDLY" },
        ].map((t) => {
          const active = matchTypeFilter === t.key;
          const cn = `h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
            active
              ? "bg-[#F4119E] text-white border-[#F4119E] cursor-default"
              : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
          }`;
          return active ? (
            <span key={t.key} className={cn} aria-current="page">{t.label}</span>
          ) : (
            <Link key={t.key} href={pageUrl(1, t.key, regionFilter, formatFilter)} className={cn}>{t.label}</Link>
          );
        })}

        <div className="w-px h-6 bg-chalk-100/15 mx-1" />

        {[
          { key: "8v8", label: "8V8" },
          { key: "4v4", label: "4V4" },
        ].map((f) => {
          const active = formatFilter === f.key;
          const cn = `h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
            active
              ? "bg-[#F4119E] text-white border-[#F4119E] cursor-default"
              : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
          }`;
          return active ? (
            <span key={f.key} className={cn} aria-current="page">{f.label}</span>
          ) : (
            <Link key={f.key} href={pageUrl(1, matchTypeFilter, regionFilter, f.key)} className={cn}>{f.label}</Link>
          );
        })}
      </div>

      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-x-auto">
        <div className="w-max min-w-full">
        <div className="grid grid-cols-[160px_1fr_60px_70px_140px_70px] gap-2 px-4 py-3 border-b border-chalk-100/12 text-[11px] font-mono text-chalk-400 uppercase tracking-wide">
          <div>Date</div>
          <div>Match</div>
          <div>Format</div>
          <div>Type</div>
          <div>POTM</div>
          <div>Location</div>
        </div>
        <div className="matches-list-container divide-y divide-chalk-100/20">
          {matches.map((m, i) => {
            const homeLogo = badgeSmallUrl(m.teamHome.badgeImage);
            const awayLogo = badgeSmallUrl(m.teamAway.badgeImage);
            const matchDate = new Date(m.kickOff);
            const isComp = m.matchType === 2;

            return (
              <div
                key={m.id}
                className="relative grid grid-cols-[160px_1fr_60px_70px_140px_70px] items-center gap-2 px-4 py-2.5 transition-colors"
              >
                <Link href={`/matches/${m.id}`} className="absolute inset-0 z-0" aria-label="View match details" />

                <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <span className="text-xs font-mono text-chalk-400">
                    {matchDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      timeZone: "Europe/Rome",
                    })}
                  </span>
                  <span className="text-[10px] font-mono text-chalk-500">
                    {matchDate.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "Europe/Rome",
                    })}
                  </span>
                </div>

                <div className="relative z-10 font-body text-sm text-chalk-200 flex items-center gap-1.5 min-w-0 pointer-events-none">
                  <Link href={`/teams/${m.teamHomeId}`} className="relative z-10 flex items-center gap-1.5 hover:text-[#F4119E] transition-colors truncate pointer-events-auto">
                    {homeLogo && (
                      <img src={homeLogo} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                    )}
                    <span className="truncate">{m.teamHome.name}</span>
                  </Link>
                  <span className="font-mono text-sm text-chalk-100 mx-2 whitespace-nowrap min-w-[54px] text-center">
                    {m.matchStatistics?.matchGoalsHome ?? "?"} - {m.matchStatistics?.matchGoalsAway ?? "?"}
                  </span>
                  <Link href={`/teams/${m.teamAwayId}`} className="relative z-10 flex items-center gap-1.5 hover:text-[#F4119E] transition-colors truncate pointer-events-auto">
                    {awayLogo && (
                      <img src={awayLogo} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                    )}
                    <span className="truncate">{m.teamAway.name}</span>
                  </Link>
                </div>

                <div className="relative z-10 text-[10px] font-mono text-chalk-300 pointer-events-none">
                  {m.format ? `${m.format}v${m.format}` : "-"}
                </div>

                <div className="relative z-10 text-xs font-mono uppercase pointer-events-none">
                  <span className={isComp ? "text-yellow-400" : "text-chalk-300"}>
                    {isComp ? "comp" : "friendly"}
                  </span>
                </div>

                <div className="relative z-20 text-xs font-body truncate">
                  {m.playerOfTheMatch ? (
                    m.playerOfTheMatch.steamID ? (
                      <Link href={`/players/${m.playerOfTheMatch.steamID}`} className="text-[#56a3ff] hover:text-[#F4119E] transition-colors">
                        {m.playerOfTheMatch.name}
                      </Link>
                    ) : (
                      <span className="text-[#56a3ff]">{m.playerOfTheMatch.name}</span>
                    )
                  ) : "-"}
                </div>

                <div className="relative z-10 text-sm font-mono text-chalk-200 pointer-events-none">
                  {getServerFlag(m.server?.name ?? null)}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </div>

      {matches.length === 0 && (
        apiUnavailable ? (
          <ApiUnavailableNotice variant="empty" />
        ) : (
          <div className="text-center py-16 text-chalk-400 font-body">
            No matches found. Data is being scraped...
          </div>
        )
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
