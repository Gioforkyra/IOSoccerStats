import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getRelatedSteamIds } from "@/lib/player-aliases";

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
  team_name: string;
  team_id: number;
  standing_position: number | null;
};

function ordinal(n: number): string {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default async function PlayerTournamentsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  const tournaments = await prisma.$queryRaw<TournamentRow[]>`
    WITH player_teams AS (
      SELECT
        tr.to_team_id AS team_id,
        tr.date AS join_date,
        COALESCE(
          (SELECT MIN(tr2.date) FROM transfers tr2
           WHERE tr2.player_steam_id = tr.player_steam_id
             AND tr2.from_team_id = tr.to_team_id
             AND tr2.type = 'leave'
             AND tr2.date > tr.date),
          NOW()
        ) AS leave_date
      FROM transfers tr
      WHERE tr.player_steam_id = ANY(${steamIds})
        AND tr.type = 'join'
        AND tr.to_team_id IS NOT NULL
    )
    SELECT DISTINCT
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
      team.name AS team_name,
      team.id AS team_id,
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
              CASE WHEN m.home_team_id = pt.team_id AND m.home_score > m.away_score THEN 3
                   WHEN m.home_team_id = pt.team_id AND m.home_score = m.away_score THEN 1
                   WHEN m.away_team_id = pt.team_id AND m.away_score > m.home_score THEN 3
                   WHEN m.away_team_id = pt.team_id AND m.away_score = m.home_score THEN 1
                   ELSE 0 END), 0)
            FROM matches m
            WHERE m.tournament_id = t.id
              AND (m.home_team_id = pt.team_id OR m.away_team_id = pt.team_id)
          )
      ) END AS standing_position
    FROM player_teams pt
    JOIN tournament_standings ts ON ts.team_id = pt.team_id
    JOIN tournaments t ON t.id = ts.tournament_id
    JOIN teams team ON team.id = pt.team_id
    LEFT JOIN teams wt ON wt.id = t.winning_team_id
    WHERE (t.start_date IS NULL OR t.start_date <= pt.leave_date)
      AND (t.end_date IS NULL OR t.end_date >= pt.join_date)
    ORDER BY t.start_date DESC NULLS LAST
  `;

  const formatLabels: Record<string, string> = {
    league: "League", knockout: "Knockout", group_knockout: "Group+KO", custom: "Custom",
  };
  const teamTypes: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };

  return (
    <>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Tournaments
      </h3>

      {tournaments.length === 0 ? (
        <div className="text-center py-12 text-chalk-400 font-body">
          No tournament data found for this player.
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
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TEAM</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">START</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">END</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">WINNER</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t, i) => {
                const pos = t.standing_position ? Number(t.standing_position) : null;
                return (
                  <tr
                    key={`${t.tournament_id}-${t.team_id}`}
                    className={`stat-row ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}
                  >
                    <td className="px-4 py-0 font-mono text-xs text-chalk-400">
                      {t.organisation || "-"}
                    </td>
                    <td className="px-4 py-0 font-body text-chalk-200">
                      <Link href={`/tournaments/${t.tournament_id}`} className="hover:text-[#F4119E] transition-colors">
                        {t.tournament_name}
                      </Link>
                    </td>
                    <td className="px-4 py-0 font-mono text-xs text-chalk-400">
                      {t.tournament_format ? formatLabels[t.tournament_format] || t.tournament_format : "-"}
                    </td>
                    <td className="px-4 py-0 font-mono text-xs text-chalk-400">
                      {t.team_type_id ? teamTypes[t.team_type_id] || "-" : "-"}
                    </td>
                    <td className="px-4 py-0 text-center font-mono text-xs">
                      {pos != null ? (
                        <span className={pos === 1 ? "medal-shine text-[#FFD700] font-700" : pos === 2 ? "medal-shine text-[#C0C0C0]" : pos === 3 ? "medal-shine text-[#CD7F32]" : "text-chalk-300"}>
                          {ordinal(pos)}
                        </span>
                      ) : (
                        <span className="text-chalk-500">-</span>
                      )}
                    </td>
                    <td className="px-4 py-0">
                      <Link href={`/teams/${t.team_id}`} className="font-body text-xs text-chalk-200 hover:text-[#F4119E] transition-colors">
                        {t.team_name}
                      </Link>
                    </td>
                    <td className="px-4 py-0 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {t.start_date
                        ? new Date(t.start_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-0 font-mono text-xs text-chalk-400 whitespace-nowrap">
                      {t.end_date
                        ? new Date(t.end_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-0">
                      {t.winning_team_name ? (
                        <Link href={`/teams/${t.winning_team_id}`} className="flex items-center gap-1.5 hover:text-grass-400 transition-colors">
                          {t.winning_team_logo && (
                            <img src={proxyImg(t.winning_team_logo)!} alt="" className="w-4 h-4 object-contain" />
                          )}
                          <span className={`font-body text-xs ${t.winning_team_id === t.team_id ? "text-grass-400 font-medium" : "text-chalk-200"}`}>
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
