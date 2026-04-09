import type { Metadata } from "next";
import Link from "next/link";
import { getMatches, badgeSmallUrl } from "@/lib/iosoccer-api";

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

export default async function MatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; type?: string; region?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const matchTypeFilter = params.type || "all";
  const regionFilter = params.region || "eu";

  const matchType = matchTypeFilter === "all" ? undefined : matchTypeFilter === "comp" ? 2 : 1;
  const regionId = regionFilter === "all" ? undefined : regionFilter === "am" ? 2 : 1;

  const data = await getMatches({ page, pageSize: PAGE_SIZE, matchType, regionId });
  const matches = data.items;
  const totalMatches = data.totalItems;
  const totalPages = data.totalPages;

  function pageUrl(p: number, t = matchTypeFilter, r = regionFilter) {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (t !== "all") q.set("type", t);
    if (r !== "eu") q.set("region", r);
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
        ].map((r) => (
          <Link
            key={r.key}
            href={pageUrl(1, matchTypeFilter, r.key)}
            className={`h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
              regionFilter === r.key
                ? "bg-[#F4119E] text-white border-[#F4119E]"
                : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
            }`}
          >
            {r.label}
          </Link>
        ))}

        <div className="w-px h-6 bg-chalk-100/15 mx-1" />

        {[
          { key: "all", label: "ALL" },
          { key: "comp", label: "COMP" },
          { key: "friendly", label: "FRIENDLY" },
        ].map((t) => (
          <Link
            key={t.key}
            href={pageUrl(1, t.key, regionFilter)}
            className={`h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
              matchTypeFilter === t.key
                ? "bg-[#F4119E] text-white border-[#F4119E]"
                : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-x-auto">
        <div className="w-max min-w-full">
        <div className="grid grid-cols-[160px_1fr_70px_140px_70px] gap-2 px-4 py-3 border-b border-chalk-100/12 text-[11px] font-mono text-chalk-400 uppercase tracking-wide">
          <div>Date</div>
          <div>Match</div>
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
                className="relative grid grid-cols-[160px_1fr_70px_140px_70px] items-center gap-2 px-4 py-2.5 transition-colors"
              >
                <Link href={`/matches/${m.id}`} className="absolute inset-0 z-0" aria-label="View match details" />

                <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                  <span className="text-xs font-mono text-chalk-400">
                    {matchDate.toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-[10px] font-mono text-chalk-500">
                    {matchDate.toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
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
