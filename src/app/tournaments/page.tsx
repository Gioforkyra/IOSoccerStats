import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { proxyImg } from "@/lib/img";

type TournamentRow = {
  id: number;
  name: string;
  type: string;
  region: string | null;
  start_date: Date | null;
  end_date: Date | null;
  status: string;
  organisation: string | null;
  tournament_format: string | null;
  team_type_id: number | null;
  match_format: number | null;
  winning_team_id: number | null;
  winner_name: string | null;
  winner_logo: string | null;
  winner_color: string | null;
  team_count: bigint;
  match_count: bigint;
};

export default async function TournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status || "all";

  const tournaments = await prisma.$queryRaw<TournamentRow[]>`
    SELECT
      t.id,
      t.name,
      t.type,
      t.region,
      t.start_date,
      t.end_date,
      t.status,
      t.organisation,
      t.tournament_format,
      t.team_type_id,
      t.match_format,
      t.winning_team_id,
      wt.name AS winner_name,
      wt.logo AS winner_logo,
      wt.color AS winner_color,
      (SELECT COUNT(*) FROM tournament_standings ts2 WHERE ts2.tournament_id = t.id) AS team_count,
      (SELECT COUNT(*) FROM matches m WHERE m.tournament_id = t.id) AS match_count
    FROM tournaments t
    LEFT JOIN teams wt ON wt.id = t.winning_team_id
    ORDER BY
      CASE WHEN t.status = 'active' THEN 0 ELSE 1 END,
      t.start_date DESC NULLS LAST
  `;

  const active = tournaments.filter((t) => t.status === "active");
  const completed = tournaments.filter((t) => t.status === "completed");
  const display = statusFilter === "active" ? active : statusFilter === "completed" ? completed : tournaments;

  function filterUrl(status: string) {
    return status === "all" ? "/tournaments" : `/tournaments?status=${status}`;
  }

  const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
  const FORMAT_LABELS: Record<string, string> = {
    league: "League",
    knockout: "Knockout",
    group_knockout: "Group + Knockout",
    custom: "Custom",
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display font-800 text-4xl tracking-tight text-chalk-100">
            TOURNAMENTS
          </h1>
          <p className="text-chalk-400 text-sm font-body mt-1">
            {active.length} active · {completed.length} completed
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
            const teams = Number(t.team_count);
            const matches = Number(t.match_count);
            const isActive = t.status === "active";
            const startStr = t.start_date
              ? new Date(t.start_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : "?";
            const endStr = t.end_date
              ? new Date(t.end_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : isActive ? "Ongoing" : "?";

            return (
              <div
                key={t.id}
                className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5 hover:border-[#F4119E]/20 transition-colors"
              >
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  {/* Winner logo as icon, or emoji fallback */}
                  {t.winner_logo ? (
                    <Link href={`/teams/${t.winning_team_id}`} className="shrink-0">
                      <img src={proxyImg(t.winner_logo)!} alt="" className="w-8 h-8 object-contain" />
                    </Link>
                  ) : (
                    <span className="text-lg shrink-0">
                      {isActive ? "\u26BD" : "\u{1F3C6}"}
                    </span>
                  )}
                  <h3 className="font-display font-700 text-lg text-chalk-100">
                    {t.name}
                  </h3>
                  {t.winner_name && (
                    <Link
                      href={`/teams/${t.winning_team_id}`}
                      className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                    >
                      <span className="text-[10px] font-mono text-[#F4119E] uppercase tracking-wider">{"\u{1F3C6}"}</span>
                      <span className="font-display font-700 text-sm text-[#F4119E]">{t.winner_name}</span>
                    </Link>
                  )}
                  {isActive && (
                    <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">
                      ACTIVE
                    </span>
                  )}
                  {t.organisation && (
                    <span className="text-[10px] font-mono bg-[#F4119E]/15 text-[#F4119E] px-2 py-0.5 rounded">
                      {t.organisation}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-chalk-400 ml-0">
                  <span>{startStr} — {endStr}</span>
                  {t.tournament_format && (
                    <span>{FORMAT_LABELS[t.tournament_format] || t.tournament_format}</span>
                  )}
                  {t.team_type_id && (
                    <span>{TEAM_TYPES[t.team_type_id] || "Unknown"}</span>
                  )}
                  {t.match_format && <span>{t.match_format}v{t.match_format}</span>}
                  <span>{teams} teams</span>
                  <span>{matches} matches</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
