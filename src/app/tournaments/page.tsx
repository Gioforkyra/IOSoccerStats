import Link from "next/link";
import { getPastTournaments, getCurrentTournaments, badgeSmallUrl, type ApiTournament } from "@/lib/iosoccer-api";

const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
const FORMAT_LABELS: Record<number, string> = {
  1: "League",
  2: "Knockout",
  3: "Group + Knockout",
  4: "Custom",
  5: "Swiss",
  6: "Round Robin",
  7: "Double Elimination",
  8: "League",
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status || "all";

  const [current, past] = await Promise.all([
    getCurrentTournaments(),
    getPastTournaments(),
  ]);

  const all: (ApiTournament & { _active: boolean })[] = [
    ...current.map((t) => ({ ...t, _active: true })),
    ...past.map((t) => ({ ...t, _active: false })),
  ];

  // Sort: active first, then by start date descending
  all.sort((a, b) => {
    if (a._active !== b._active) return a._active ? -1 : 1;
    const da = a.startDate ? new Date(a.startDate).getTime() : 0;
    const db = b.startDate ? new Date(b.startDate).getTime() : 0;
    return db - da;
  });

  const display =
    statusFilter === "active" ? all.filter((t) => t._active) :
    statusFilter === "completed" ? all.filter((t) => !t._active) :
    all;

  function filterUrl(status: string) {
    return status === "all" ? "/tournaments" : `/tournaments?status=${status}`;
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            TOURNAMENTS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {current.length} active · {past.length} completed
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex items-center gap-3 mb-6">
        {[
          { key: "all", label: "ALL" },
          { key: "active", label: "ACTIVE" },
          { key: "completed", label: "COMPLETED" },
        ].map((s) => (
          <Link
            key={s.key}
            href={filterUrl(s.key)}
            className={`text-sm font-display font-700 tracking-wider uppercase transition-colors pb-1 border-b-2 ${
              statusFilter === s.key
                ? "text-chalk-100 border-[#F4119E]"
                : "text-chalk-400 hover:text-chalk-200 border-transparent"
            }`}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {display.length === 0 ? (
        <div className="text-center py-16 text-chalk-400 font-body">
          No tournaments found.
        </div>
      ) : (
        <div className="space-y-3">
          {display.map((t) => {
            const isActive = t._active;
            const startStr = t.startDate
              ? new Date(t.startDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : "?";
            const endStr = t.endDate
              ? new Date(t.endDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : isActive ? "Ongoing" : "?";

            const winnerLogo = badgeSmallUrl(t.winningTeam?.badgeImage ?? null);
            const org = t.tournamentSeries?.organisation?.acronym ?? null;

            return (
              <div
                key={t.id}
                className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5 hover:border-[#F4119E]/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {winnerLogo ? (
                    <Link href={`/teams/${t.winningTeamId}`} className="shrink-0">
                      <img src={winnerLogo} alt="" className="w-8 h-8 object-contain" />
                    </Link>
                  ) : (
                    <span className="text-lg shrink-0">
                      {isActive ? "\u26BD" : "\u{1F3C6}"}
                    </span>
                  )}
                  <h3 className="font-display font-700 text-lg text-chalk-100">
                    {t.name}
                  </h3>
                  {t.winningTeam?.name && (
                    <Link
                      href={`/teams/${t.winningTeamId}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[10px] font-mono text-[#F4119E] uppercase tracking-wider">{"\u{1F3C6}"}</span>
                      <span className="font-display font-700 text-sm text-[#F4119E]">{t.winningTeam.name}</span>
                    </Link>
                  )}
                  {isActive && (
                    <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                  {org && (
                    <span className="text-[10px] font-mono bg-[#F4119E]/15 text-[#F4119E] px-2 py-0.5 rounded">
                      {org}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-chalk-400 ml-0">
                  <span>{startStr} — {endStr}</span>
                  {t.format > 0 && (
                    <span>{FORMAT_LABELS[t.format] || `Format ${t.format}`}</span>
                  )}
                  {t.teamType > 0 && (
                    <span>{TEAM_TYPES[t.teamType] || "Unknown"}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
