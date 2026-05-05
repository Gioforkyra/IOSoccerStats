import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";

type TournamentRow = {
  tournament_id: number;
  tournament_name: string;
  organisation: string | null;
  tournament_format: string | null;
  team_type_id: number | null;
  match_format: number | null;
  start_date: Date | null;
  end_date: Date | null;
  winning_team_id: number | null;
  winning_team_name: string | null;
  winning_team_logo: string | null;
  standing_position: number | null;
};

function ordinal(n: number): string {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function TeamTournamentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const teamId = parseInt(id, 10);
  if (isNaN(teamId)) return notFound();

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return notFound();

  const showOnlyWins = sp.filter === "wins";

  const tournaments = await prisma.$queryRaw<TournamentRow[]>`
    SELECT
      t.id AS tournament_id,
      t.name AS tournament_name,
      t.organisation,
      t.tournament_format,
      t.team_type_id,
      t.match_format,
      t.start_date,
      t.end_date,
      t.winning_team_id,
      wt.name AS winning_team_name,
      wt.logo AS winning_team_logo,
      CASE WHEN (SELECT COUNT(*) FROM matches WHERE tournament_id = t.id) = 0 THEN NULL
      ELSE (
        SELECT COUNT(*) + 1
        FROM tournament_standings ts2
        WHERE ts2.tournament_id = t.id
          AND (
            SELECT COALESCE(SUM(
              CASE WHEN m.home_team_id = ts2.team_id AND m.home_score > m.away_score THEN 3
                   WHEN m.home_team_id = ts2.team_id AND m.home_score = m.away_score THEN 1
                   WHEN m.away_team_id = ts2.team_id AND m.away_score > m.home_score THEN 3
                   WHEN m.away_team_id = ts2.team_id AND m.away_score = m.home_score THEN 1
                   ELSE 0 END), 0)
            FROM matches m
            WHERE m.tournament_id = t.id
              AND (m.home_team_id = ts2.team_id OR m.away_team_id = ts2.team_id)
          ) > (
            SELECT COALESCE(SUM(
              CASE WHEN m.home_team_id = ${teamId} AND m.home_score > m.away_score THEN 3
                   WHEN m.home_team_id = ${teamId} AND m.home_score = m.away_score THEN 1
                   WHEN m.away_team_id = ${teamId} AND m.away_score > m.home_score THEN 3
                   WHEN m.away_team_id = ${teamId} AND m.away_score = m.home_score THEN 1
                   ELSE 0 END), 0)
            FROM matches m
            WHERE m.tournament_id = t.id
              AND (m.home_team_id = ${teamId} OR m.away_team_id = ${teamId})
          )
      ) END AS standing_position
    FROM tournament_standings ts
    JOIN tournaments t ON t.id = ts.tournament_id
    LEFT JOIN teams wt ON wt.id = t.winning_team_id
    WHERE ts.team_id = ${teamId}
    ORDER BY t.start_date DESC NULLS LAST
  `;

  const formatLabels: Record<string, string> = {
    league: "League", knockout: "Knockout", group_knockout: "Group+KO", custom: "Custom"
  };
  const teamTypes: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };

  const wonCount = tournaments.filter((t) => t.winning_team_id === teamId).length;
  const visibleTournaments = showOnlyWins
    ? tournaments.filter((t) => t.winning_team_id === teamId)
    : tournaments;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase">
          Tournaments
        </h3>
        <div className="flex items-center gap-1 text-xs font-mono">
          <Link
            href={`/teams/${teamId}/tournaments`}
            className={`px-3 py-1.5 rounded border transition-colors ${
              !showOnlyWins
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
            }`}
          >
            ALL
          </Link>
          <Link
            href={`/teams/${teamId}/tournaments?filter=wins`}
            className={`px-3 py-1.5 rounded border transition-colors ${
              showOnlyWins
                ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10"
                : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"
            }`}
          >
            WON [{wonCount}]
          </Link>
        </div>
      </div>

      {visibleTournaments.length === 0 ? (
        <div className="text-center py-12 text-chalk-400 font-body">
          {showOnlyWins ? "No tournaments won by this team." : "No tournament data found for this team."}
        </div>
      ) : (
        <div className="rounded-lg border border-chalk-100/8 overflow-x-auto bg-pitch-900/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-chalk-100/8">
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">ORG</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TOURNAMENT</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">FORMAT</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TYPE</th>
                <th className="text-center px-4 py-3 font-mono text-[10px] text-chalk-400">POS</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">START</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">END</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">WINNER</th>
              </tr>
            </thead>
            <tbody>
              {visibleTournaments.map((t, i) => {
                const isWinner = t.winning_team_id === teamId;
                const pos = t.standing_position ? Number(t.standing_position) : null;
                return (
                  <tr
                    key={t.tournament_id}
                    className={`stat-row ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}
                  >
                    <td className="px-4 py-0.5 font-mono text-xs text-chalk-400">
                      {t.organisation || "-"}
                    </td>
                    <td className="px-4 py-0.5 font-body text-chalk-200">
                      <Link href={`/tournaments/${t.tournament_id}`} className="hover:text-[#F4119E] transition-colors">
                        {t.tournament_name}
                      </Link>
                    </td>
                    <td className="px-4 py-0.5 font-mono text-xs text-chalk-400">
                      {t.tournament_format ? formatLabels[t.tournament_format] || t.tournament_format : "-"}
                    </td>
                    <td className="px-4 py-0.5 font-mono text-xs text-chalk-400">
                      {t.team_type_id ? teamTypes[t.team_type_id] || "-" : "-"}
                    </td>
                    <td className="px-4 py-0.5 text-center font-mono text-xs">
                      {pos != null ? (
                        <span className={pos === 1 ? "medal-shine text-[#FFD700] font-700" : pos === 2 ? "medal-shine text-[#C0C0C0]" : pos === 3 ? "medal-shine text-[#CD7F32]" : "text-chalk-300"}>
                          {ordinal(pos)}
                        </span>
                      ) : (
                        <span className="text-chalk-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-0.5 font-mono text-xs text-chalk-400">
                      {t.start_date
                        ? new Date(t.start_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-0.5 font-mono text-xs text-chalk-400">
                      {t.end_date
                        ? new Date(t.end_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-0.5">
                      {t.winning_team_name ? (
                        <Link href={`/teams/${t.winning_team_id}`} className="flex items-center gap-1.5 hover:text-grass-400 transition-colors">
                          {t.winning_team_logo && (
                            <img src={proxyImg(t.winning_team_logo)!} alt="" className="w-4 h-4 object-contain" />
                          )}
                          <span className={`font-body text-xs ${isWinner ? "text-grass-400 font-medium" : "text-chalk-200"}`}>
                            {t.winning_team_name}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-xs font-mono text-chalk-400">TBD</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
