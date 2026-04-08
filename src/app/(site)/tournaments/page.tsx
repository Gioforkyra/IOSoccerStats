import type { Metadata } from "next";
import Link from "next/link";
import { getPastTournaments, getCurrentTournaments, badgeSmallUrl, type ApiTournament } from "@/lib/iosoccer-api";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Tournaments — IOSHUBv2",
  description: "Browse all IOSoccer tournaments, leagues and cups — active and past.",
};

const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
const FORMAT_LABELS: Record<number, string> = {
  1: "League", 2: "Knockout", 3: "Group+KO", 4: "Custom",
  5: "Swiss", 6: "Round Robin", 7: "Double Elim", 8: "League",
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fmtDate(iso: string | null) {
  if (!iso) return "?";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status || "all";
  const typeFilter = params.type || "all";

  const [current, past] = await Promise.all([
    getCurrentTournaments(),
    getPastTournaments(),
  ]);

  const all: (ApiTournament & { _active: boolean })[] = [
    ...current.map((t) => ({ ...t, _active: true })),
    ...past.map((t) => ({ ...t, _active: false })),
  ];

  all.sort((a, b) => {
    if (a._active !== b._active) return a._active ? -1 : 1;
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return db - da;
  });

  let display = all;
  if (statusFilter === "active") display = all.filter((t) => t._active);
  else if (statusFilter === "completed") display = all.filter((t) => !t._active);
  if (typeFilter !== "all") {
    const typeInt = parseInt(typeFilter);
    display = display.filter((t) => t.teamType === typeInt);
  }

  function filterUrl(overrides: Record<string, string>) {
    const sp = new URLSearchParams({ status: statusFilter, type: typeFilter, ...overrides });
    return `/tournaments?${sp.toString()}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">TOURNAMENTS</h1>
        <p className="text-chalk-400 text-sm font-body mt-1">
          {current.length} active · {past.length} completed
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-1 text-xs font-mono">
          {[{ v: "all", l: "ALL" }, { v: "active", l: "ACTIVE" }, { v: "completed", l: "COMPLETED" }].map(({ v, l }) => (
            <Link key={v} href={filterUrl({ status: v })}
              className={`px-3 py-1.5 rounded border transition-colors ${statusFilter === v ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>
              {l}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 text-xs font-mono">
          {[{ v: "all", l: "ALL" }, { v: "1", l: "CLUB" }, { v: "2", l: "NATIONAL" }, { v: "3", l: "MIX" }, { v: "4", l: "DRAFT" }].map(({ v, l }) => (
            <Link key={v} href={filterUrl({ type: v })}
              className={`px-3 py-1.5 rounded border transition-colors ${typeFilter === v ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>
              {l}
            </Link>
          ))}
        </div>
      </div>

      {display.length === 0 ? (
        <div className="text-center py-16 text-chalk-400 font-body">No tournaments found.</div>
      ) : (
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk-100/8">
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">STATUS</th>
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">TOURNAMENT</th>
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">FORMAT</th>
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">TYPE</th>
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">WINNER</th>
                <th className="text-left px-4 py-1.5 font-mono text-[10px] text-chalk-400">DATES</th>
              </tr>
            </thead>
            <tbody>
              {display.map((t, i) => {
                const isActive = t._active;
                const winnerLogo = badgeSmallUrl(t.winningTeam?.badgeImage ?? null);
                const org = t.tournamentSeries?.organisation?.acronym ?? null;
                return (
                  <tr key={t.id} className={`border-b border-chalk-100/4 last:border-0 ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}>
                    <td className="px-4 py-1">
                      {isActive ? (
                        <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">ACTIVE</span>
                      ) : (
                        <span className="text-[10px] font-mono text-chalk-500">DONE</span>
                      )}
                    </td>
                    <td className="px-4 py-1">
                      <div className="flex items-center gap-2">
                        <Link href={`/tournaments/${t.id}`} className="font-body text-chalk-100 hover:text-[#F4119E] transition-colors">
                          {t.name}
                        </Link>
                        {org && (
                          <span className="text-[10px] font-mono bg-[#F4119E]/15 text-[#F4119E] px-1.5 py-0.5 rounded shrink-0">{org}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-1 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {t.format > 0 ? FORMAT_LABELS[t.format] || `Format ${t.format}` : "-"}
                    </td>
                    <td className="px-4 py-1 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {t.teamType > 0 ? TEAM_TYPES[t.teamType] || "-" : "-"}
                    </td>
                    <td className="px-4 py-1">
                      {t.winningTeam ? (
                        <Link href={`/teams/${t.winningTeamId}`} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
                          {winnerLogo && <img src={winnerLogo} alt="" className="w-4 h-4 object-contain" />}
                          <span className="font-body text-sm text-[#F4119E]">{t.winningTeam.name}</span>
                        </Link>
                      ) : (
                        <span className="text-chalk-500 font-mono text-xs">-</span>
                      )}
                    </td>
                    <td className="px-4 py-1 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {fmtDate(t.startDate)}
                      {t.endDate && !isActive && <span className="text-chalk-500"> → {fmtDate(t.endDate)}</span>}
                      {isActive && <span className="text-grass-400"> → ongoing</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
