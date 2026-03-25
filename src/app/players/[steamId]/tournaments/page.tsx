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
  status: string;
  winning_team_id: number | null;
  winning_team_name: string | null;
  winning_team_logo: string | null;
  team_name: string;
  team_id: number;
  team_logo: string | null;
  team_color: string | null;
};

export default async function PlayerTournamentsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  // Find tournaments where the player's team participated
  // Uses transfer history to find which teams the player was on,
  // then checks tournament_standings to find tournaments those teams were in
  const tournaments = await prisma.$queryRaw<TournamentRow[]>`
    WITH player_teams AS (
      -- All teams this player joined (with date ranges)
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
      WHERE tr.player_steam_id = ${steamId}
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
      t.status,
      t.winning_team_id,
      wt.name AS winning_team_name,
      wt.logo AS winning_team_logo,
      team.name AS team_name,
      team.id AS team_id,
      team.logo AS team_logo,
      team.color AS team_color
    FROM player_teams pt
    JOIN tournament_standings ts ON ts.team_id = pt.team_id
    JOIN tournaments t ON t.id = ts.tournament_id
    JOIN teams team ON team.id = pt.team_id
    LEFT JOIN teams wt ON wt.id = t.winning_team_id
    WHERE (t.start_date IS NULL OR t.start_date <= pt.leave_date)
      AND (t.end_date IS NULL OR t.end_date >= pt.join_date)
    ORDER BY t.start_date DESC NULLS LAST
  `;

  const teamTypes: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
  const formatLabels: Record<string, string> = {
    league: "League", knockout: "Knockout", group_knockout: "Group + Knockout", custom: "Custom"
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
        <div className="space-y-3">
          {tournaments.map((t, i) => {
            const isActive = t.status === "active";
            const startStr = t.start_date
              ? new Date(t.start_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : "?";
            const endStr = t.end_date
              ? new Date(t.end_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : isActive ? "Ongoing" : "?";
            const isWinner = t.winning_team_id === t.team_id;

            return (
              <div
                key={`${t.tournament_id}-${t.team_id}`}
                className="border border-chalk-100/8 rounded-lg p-5 relative overflow-hidden"
                style={{ backgroundColor: t.team_color ? `${t.team_color}20` : "rgba(28,28,28,0.4)" }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pitch-950/60 to-transparent pointer-events-none" />

                <div className="relative z-10 flex items-start gap-4">
                  {/* Team logo */}
                  <Link href={`/teams/${t.team_id}`} className="shrink-0">
                    {t.team_logo ? (
                      <img src={proxyImg(t.team_logo)!} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-pitch-700 flex items-center justify-center text-sm font-display font-700 text-chalk-300">
                        {t.team_name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <h4 className="font-display font-700 text-base text-chalk-100">
                        {t.tournament_name}
                      </h4>
                      {isActive && (
                        <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">ACTIVE</span>
                      )}
                      {isWinner && (
                        <span className="text-[10px] font-mono bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded">WINNER</span>
                      )}
                      {t.organisation && (
                        <span className="text-[10px] font-mono bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded">{t.organisation}</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-chalk-400 mb-2">
                      <span>{startStr} — {endStr}</span>
                      {t.tournament_format && <span>{formatLabels[t.tournament_format] || t.tournament_format}</span>}
                      {t.team_type_id && <span>{teamTypes[t.team_type_id] || "Unknown"}</span>}
                      {t.match_format && <span>{t.match_format}v{t.match_format}</span>}
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-[10px] font-mono text-chalk-400 uppercase">With:</span>
                      <Link href={`/teams/${t.team_id}`} className="font-body text-chalk-200 hover:text-grass-400 transition-colors">
                        {t.team_name}
                      </Link>
                    </div>

                    {t.winning_team_name && (
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-[10px] font-mono text-amber-400 uppercase">Winner:</span>
                        <Link
                          href={`/teams/${t.winning_team_id}`}
                          className="flex items-center gap-1.5 font-body text-chalk-200 hover:text-grass-400 transition-colors"
                        >
                          {t.winning_team_logo && <img src={proxyImg(t.winning_team_logo)!} alt="" className="w-4 h-4 object-contain" />}
                          {t.winning_team_name}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
