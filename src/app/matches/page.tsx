import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { proxyImg } from "@/lib/img";
import SyncMatches from "@/components/SyncMatches";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

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
  potm: string | null;
  potm_steam_id: string | null;
  home_name: string;
  away_name: string;
  home_logo: string | null;
  away_logo: string | null;
};

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

  // City / region-first parsing (most reliable with IOSoccer naming)
  if (lower.includes("| paris |") || lower.includes(" paris ")) return "\u{1F1EB}\u{1F1F7}"; // FR
  if (lower.includes("| amsterdam |") || lower.includes("| ams |") || lower.includes(" amsterdam ")) return "\u{1F1F3}\u{1F1F1}"; // NL
  if (lower.includes("| de |") || lower.includes(" germany ") || lower.includes(" deutschland ") || lower.includes(" frankfurt ")) return "\u{1F1E9}\u{1F1EA}"; // DE

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
  searchParams: Promise<{ page?: string; region?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const region = ["all", "eu", "am"].includes((params.region || "all").toLowerCase())
    ? (params.region || "all").toLowerCase()
    : "all";
  const offset = (page - 1) * PAGE_SIZE;

  const regionPatterns =
    region === "eu"
      ? [
          "%[fr]%", "%[de]%", "%[uk]%", "%[gb]%", "%[es]%", "%[it]%", "%[nl]%", "%[pl]%",
          "%[ru]%", "%[se]%", "%[no]%", "%[fi]%", "%[pt]%", "%[eu]%", "%[eu/%", "%/eu]%", "%/nl]%",
          "%france%", "%germany%", "%italy%", "%spain%", "%europe%",
          "%amsterdam%", "%ams%", "%paris%", "%london%", "%netherlands%", "%dutch%",
        ]
      : region === "am"
        ? [
            "%[us]%", "%[br]%", "%[ar]%", "%[mx]%", "%[cl]%", "%[co]%", "%[pe]%", "%[sa]%",
            "%usa%", "%brazil%", "%argentina%", "%mexico%", "%sudamerica%", "%south america%",
          ]
        : null;

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
      m.potm,
      (SELECT p.steam_id FROM players p WHERE p.username = m.potm LIMIT 1) AS potm_steam_id,
      ht.name AS home_name,
      at.name AS away_name,
      ht.logo AS home_logo,
      at.logo AS away_logo
    FROM matches m
    JOIN teams ht ON ht.id = m.home_team_id
    JOIN teams at ON at.id = m.away_team_id
    WHERE (${region} = 'all' OR LOWER(COALESCE(m.server, '')) LIKE ANY(${regionPatterns || ["%"]}))
    ORDER BY m.date DESC, m.id DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `;

  const countResult = await prisma.$queryRaw<{ total: bigint }[]>`
    SELECT COUNT(*) AS total
    FROM matches m
    WHERE (${region} = 'all' OR LOWER(COALESCE(m.server, '')) LIKE ANY(${regionPatterns || ["%"]}))
  `;
  const totalMatches = Number(countResult[0]?.total || 0);
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));

  function pageUrl(p: number, r = region) {
    const q = new URLSearchParams();
    if (p > 1) q.set("page", String(p));
    if (r !== "all") q.set("region", r);
    const qs = q.toString();
    return qs ? `/matches?${qs}` : "/matches";
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

      <div className="flex items-center gap-2 mb-4">
        {[
          { key: "all", label: "ALL" },
          { key: "eu", label: "EU" },
          { key: "am", label: "AMERICA" },
        ].map((r) => (
          <Link
            key={r.key}
            href={pageUrl(1, r.key)}
            className={`h-8 px-3 rounded text-xs font-mono border transition-colors flex items-center ${
              region === r.key
                ? "bg-[#F4119E] text-white border-[#F4119E]"
                : "text-chalk-400 border-chalk-100/10 hover:text-chalk-100 hover:border-chalk-100/30"
            }`}
          >
            {r.label}
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-hidden">
        <div className="grid grid-cols-[190px_1fr_90px_190px_90px] gap-2 px-4 py-3 border-b border-chalk-100/12 text-[11px] font-mono text-chalk-400 uppercase tracking-wide">
          <div>Date</div>
          <div>Match</div>
          <div>Type</div>
          <div>POTM</div>
          <div>Location</div>
        </div>
        <div className="divide-y divide-chalk-100/20">
          {matches.map((m, i) => {
            const homeLogo = m.home_logo ? proxyImg(m.home_logo) : null;
            const awayLogo = m.away_logo ? proxyImg(m.away_logo) : null;
            const matchDate = new Date(m.date);

            return (
              <div
                key={m.id}
                className={`relative grid grid-cols-[190px_1fr_90px_190px_90px] items-center gap-2 px-4 py-2.5 hover:brightness-125 transition ${
                  i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"
                }`}
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

                <div className="relative z-10 font-body text-sm text-chalk-200 flex items-center gap-1.5 min-w-0">
                  <Link href={`/teams/${m.home_team_id}`} className="relative z-10 flex items-center gap-1.5 hover:text-[#F4119E] transition-colors truncate">
                    {homeLogo && (
                      <img src={homeLogo} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                    )}
                    <span className="truncate">{m.home_name}</span>
                  </Link>
                  <span className="font-mono text-sm text-chalk-100 mx-2 whitespace-nowrap min-w-[54px] text-center pointer-events-none">
                    {m.home_score} - {m.away_score}
                  </span>
                  <Link href={`/teams/${m.away_team_id}`} className="relative z-10 flex items-center gap-1.5 hover:text-[#F4119E] transition-colors truncate">
                    {awayLogo && (
                      <img src={awayLogo} alt="" className="w-5 h-5 object-contain inline-block shrink-0" />
                    )}
                    <span className="truncate">{m.away_name}</span>
                  </Link>
                </div>

                <div className="relative z-10 text-xs font-mono uppercase pointer-events-none">
                  <span className={m.match_type === "competitive" ? "text-yellow-400" : "text-chalk-300"}>
                    {m.match_type === "competitive" ? "comp" : "friendly"}
                  </span>
                </div>

                <div className="relative z-10 text-xs font-body truncate pointer-events-none">
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

                <div className="relative z-10 text-sm font-mono text-chalk-200 pointer-events-none">
                  {getServerFlag(m.server)}
                </div>
              </div>
            );
          })}
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
