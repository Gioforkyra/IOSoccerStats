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

  const data = await getMatches({
    page,
    pageSize: PAGE_SIZE,
    matchType: 2,
    includePast: false,
  });

  const matches = data.items ?? [];
  const totalPages = data.totalPages ?? 1;

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
        <div className="text-center py-16 text-chalk-400 font-body">No upcoming fixtures found.</div>
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
                    <td className="px-4 py-2.5 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      <div className="text-chalk-300">{fmtDate(m.kickOff)}</div>
                      <div className="text-chalk-500">{fmtTime(m.kickOff)} UTC</div>
                    </td>
                    <td className="px-4 py-2.5">
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
                    <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                      {tournamentName ? (
                        <span className="font-body text-[#F4119E]">{tournamentName}</span>
                      ) : (
                        <span className={`font-mono ${isComp ? "text-[#F4119E]" : "text-chalk-400"}`}>{isComp ? "COMP" : "FRIENDLY"}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {format}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-chalk-500 max-w-[200px]">
                      {serverName ?? "-"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-sm text-center">
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
        <div className="flex items-center justify-center gap-2 mt-6 font-mono text-xs">
          {page > 1 && <Link href={pageUrl(page - 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 transition-colors">←</Link>}
          <span className="text-chalk-400">Page {page} / {totalPages}</span>
          {page < totalPages && <Link href={pageUrl(page + 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 hover:text-chalk-100 transition-colors">→</Link>}
        </div>
      )}
    </div>
  );
}
