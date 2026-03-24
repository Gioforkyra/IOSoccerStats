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
  team_name: string;
  team_id: number;
  apps: bigint;
  goals: bigint;
  assists: bigint;
};

export default async function PlayerTournamentsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  // Find tournaments this player participated in via match data
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
      team.name AS team_name,
      team.id AS team_id,
      COUNT(DISTINCT mps.match_id) AS apps,
      COALESCE(SUM(mps.goals), 0) AS goals,
      COALESCE(SUM(mps.assists), 0) AS assists
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    JOIN tournaments t ON t.id = m.tournament_id
    JOIN teams team ON team.id = CASE
      WHEN mps.team_side = 'home' THEN m.home_team_id
      WHEN mps.team_side = 'away' THEN m.away_team_id
    END
    LEFT JOIN teams wt ON wt.id = t.winning_team_id
    WHERE mps.player_steam_id = ${steamId}
      AND m.tournament_id IS NOT NULL
    GROUP BY t.id, t.name, t.organisation, t.tournament_format, t.team_type_id, t.match_format,
             t.start_date, t.end_date, t.winning_team_id, wt.name, wt.logo, team.name, team.id
    ORDER BY t.start_date DESC NULLS LAST
  `;

  const teamTypes: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
  const formatLabels: Record<string, string> = {
    league: "League", knockout: "Knockout", group_knockout: "Group Knockout", custom: "Custom"
  };

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
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TEAM TYPE</th>
                <th className="text-center px-4 py-3 font-mono text-[10px] text-chalk-400">MATCHES</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">START</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">END</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">TEAM</th>
                <th className="text-center px-4 py-3 font-mono text-[10px] text-chalk-400">G</th>
                <th className="text-center px-4 py-3 font-mono text-[10px] text-chalk-400">A</th>
                <th className="text-left px-4 py-3 font-mono text-[10px] text-chalk-400">WINNER</th>
              </tr>
            </thead>
            <tbody>
              {tournaments.map((t, i) => (
                <tr
                  key={`${t.tournament_id}-${t.team_id}`}
                  className={`stat-row ${i % 2 === 0 ? "bg-pitch-600/15" : "bg-transparent"}`}
                >
                  <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                    {t.organisation || "-"}
                  </td>
                  <td className="px-4 py-3 font-body text-chalk-200">
                    {t.tournament_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                    {t.tournament_format ? formatLabels[t.tournament_format] || t.tournament_format : "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                    {t.team_type_id ? teamTypes[t.team_type_id] || "-" : "-"}
                  </td>
                  <td className="px-4 py-3 text-center font-mono text-xs text-chalk-300">
                    {t.match_format ? `${t.match_format}v${t.match_format}` : "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                    {t.start_date
                      ? new Date(t.start_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                      : "-"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-chalk-400">
                    {t.end_date
                      ? new Date(t.end_date).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/teams/${t.team_id}`} className="font-body text-xs text-chalk-200 hover:text-grass-400 transition-colors">
                      {t.team_name}
                    </Link>
                  </td>
                  <td className={`px-4 py-3 text-center font-mono text-xs ${Number(t.goals) > 0 ? "text-grass-400" : "text-chalk-300"}`}>
                    {Number(t.goals)}
                  </td>
                  <td className={`px-4 py-3 text-center font-mono text-xs ${Number(t.assists) > 0 ? "text-grass-400" : "text-chalk-300"}`}>
                    {Number(t.assists)}
                  </td>
                  <td className="px-4 py-3">
                    {t.winning_team_name ? (
                      <Link href={`/teams/${t.winning_team_id}`} className="flex items-center gap-1.5 hover:text-grass-400 transition-colors">
                        {t.winning_team_logo && (
                          <img src={proxyImg(t.winning_team_logo)!} alt="" className="w-4 h-4 object-contain" />
                        )}
                        <span className="font-body text-xs text-chalk-200">{t.winning_team_name}</span>
                      </Link>
                    ) : (
                      <span className="text-xs font-mono text-chalk-400">TBD</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
