import Link from "next/link";
import { getMatches, badgeSmallUrl } from "@/lib/iosoccer-api";

export const revalidate = 60;

const PAGE_SIZE = 20;

const SERVER_FLAGS: Record<string, string> = {
  fr: "🇫🇷", de: "🇩🇪", uk: "🇬🇧", gb: "🇬🇧", us: "🇺🇸", br: "🇧🇷",
  es: "🇪🇸", it: "🇮🇹", nl: "🇳🇱", pl: "🇵🇱", ru: "🇷🇺",
};

function getServerFlag(server: string | null): string {
  if (!server) return "-";
  const lower = server.toLowerCase();
  if (lower.includes("paris") || lower.includes("france")) return "🇫🇷";
  if (lower.includes("amsterdam") || lower.includes("ams")) return "🇳🇱";
  if (lower.includes("frankfurt") || lower.includes("germany") || lower.includes("| de |")) return "🇩🇪";
  if (lower.includes("europe")) return "🇪🇺";
  for (const [code, flag] of Object.entries(SERVER_FLAGS)) {
    if (lower.includes(`[${code}]`) || lower.includes(`[${code}/`)) return flag;
  }
  return "-";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

export default async function FixturesPage({
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

  const data = await getMatches({
    page,
    pageSize: PAGE_SIZE,
    matchType,
    regionId,
    includePast: false,
  });

  const matches = data.items ?? [];
  const totalPages = data.totalPages ?? 1;

  function filterUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams({ page: "1", type: matchTypeFilter, region: regionFilter, ...overrides });
    return `/fixtures?${sp.toString()}`;
  }

  function pageUrl(p: number) {
    const sp = new URLSearchParams({ page: String(p), type: matchTypeFilter, region: regionFilter });
    return `/fixtures?${sp.toString()}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">FIXTURES</h1>
        <p className="text-chalk-400 text-sm font-body mt-1">Upcoming scheduled matches</p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 text-xs font-mono">
          {[{ v: "eu", l: "EU" }, { v: "am", l: "AM" }, { v: "all", l: "ALL" }].map(({ v, l }) => (
            <Link key={v} href={filterUrl({ region: v })}
              className={`px-3 py-1.5 rounded border transition-colors ${regionFilter === v ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>
              {l}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs font-mono">
          {[{ v: "all", l: "ALL" }, { v: "comp", l: "COMP" }, { v: "friendly", l: "FRIENDLY" }].map(({ v, l }) => (
            <Link key={v} href={filterUrl({ type: v })}
              className={`px-3 py-1.5 rounded border transition-colors ${matchTypeFilter === v ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      {matches.length === 0 ? (
        <div className="text-center py-16 text-chalk-400 font-body">No upcoming fixtures found.</div>
      ) : (
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk-100/8">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">DATE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">MATCH</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TYPE</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">LOCATION</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m: any, i: number) => {
                const homeLogo = badgeSmallUrl(m.teamHome?.badgeImage ?? null);
                const awayLogo = badgeSmallUrl(m.teamAway?.badgeImage ?? null);
                const flag = getServerFlag(m.server ?? null);
                const isComp = m.matchType === 2;
                return (
                  <tr key={m.id} className={`border-b border-chalk-100/4 last:border-0 ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}>
                    <td className="px-4 py-2.5 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      <div>{fmtDate(m.kickOff)}</div>
                      <div className="text-chalk-500">{fmtTime(m.kickOff)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/matches/${m.id}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <div className="flex items-center gap-1.5">
                          {homeLogo && <img src={homeLogo} alt="" className="w-4 h-4 object-contain" />}
                          <span className="font-body text-chalk-200">{m.teamHome?.name}</span>
                        </div>
                        <span className="font-mono text-xs text-chalk-500">vs</span>
                        <div className="flex items-center gap-1.5">
                          {awayLogo && <img src={awayLogo} alt="" className="w-4 h-4 object-contain" />}
                          <span className="font-body text-chalk-200">{m.teamAway?.name}</span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs">
                      <span className={isComp ? "text-[#F4119E]" : "text-chalk-400"}>{isComp ? "COMP" : "FRIENDLY"}</span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm">{flag}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6 font-mono text-xs">
          {page > 1 && <Link href={pageUrl(page - 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 transition-colors">←</Link>}
          <span className="text-chalk-400">Page {page} / {totalPages}</span>
          {page < totalPages && <Link href={pageUrl(page + 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 transition-colors">→</Link>}
        </div>
      )}
    </div>
  );
}
