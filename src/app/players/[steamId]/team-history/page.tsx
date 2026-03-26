import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { getRelatedSteamIds } from "@/lib/player-aliases";

type TeamTransfer = {
  team_id: number;
  team_name: string;
  team_logo: string | null;
  team_color: string | null;
  join_date: Date | null;
  leave_date: Date | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
};

export default async function PlayerTeamHistoryPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  const teams = await prisma.$queryRaw<TeamTransfer[]>`
    WITH team_stints AS (
      SELECT
        tr.to_team_id AS team_id,
        tr.date AS join_date,
        (
          SELECT MIN(tr2.date)
          FROM transfers tr2
          WHERE tr2.player_steam_id = tr.player_steam_id
            AND tr2.from_team_id = tr.to_team_id
            AND tr2.type = 'leave'
            AND tr2.date > tr.date
        ) AS leave_date
      FROM transfers tr
      WHERE tr.player_steam_id = ANY(${steamIds})
        AND tr.type = 'join'
        AND tr.to_team_id IS NOT NULL
    ),
    stint_stats AS (
      SELECT
        ts.team_id,
        ts.join_date,
        ts.leave_date,
        COUNT(DISTINCT mps.match_id) AS apps,
        COALESCE(SUM(mps.goals), 0) AS goals,
        COALESCE(SUM(mps.assists), 0) AS assists,
        COUNT(DISTINCT CASE WHEN
          (mps.team_side = 'home' AND m.home_score > m.away_score) OR
          (mps.team_side = 'away' AND m.away_score > m.home_score)
        THEN m.id END) AS wins,
        COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.id END) AS draws,
        COUNT(DISTINCT CASE WHEN
          (mps.team_side = 'home' AND m.home_score < m.away_score) OR
          (mps.team_side = 'away' AND m.away_score < m.home_score)
        THEN m.id END) AS losses
      FROM team_stints ts
      LEFT JOIN matches m ON (
        m.home_team_id = ts.team_id OR m.away_team_id = ts.team_id
      )
      LEFT JOIN match_player_stats mps ON mps.match_id = m.id
        AND mps.player_steam_id = ANY(${steamIds})
        AND (
          (mps.team_side = 'home' AND m.home_team_id = ts.team_id) OR
          (mps.team_side = 'away' AND m.away_team_id = ts.team_id)
        )
      WHERE mps.match_id IS NOT NULL
      GROUP BY ts.team_id, ts.join_date, ts.leave_date
    )
    SELECT
      t.id AS team_id,
      t.name AS team_name,
      t.logo AS team_logo,
      t.color AS team_color,
      ss.join_date,
      ss.leave_date,
      COALESCE(ss.apps, 0) AS apps,
      COALESCE(ss.goals, 0) AS goals,
      COALESCE(ss.assists, 0) AS assists,
      COALESCE(ss.wins, 0) AS wins,
      COALESCE(ss.draws, 0) AS draws,
      COALESCE(ss.losses, 0) AS losses
    FROM stint_stats ss
    JOIN teams t ON t.id = ss.team_id
    WHERE t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
    ORDER BY ss.join_date DESC NULLS LAST
  `;

  return (
    <>
      <h3 className="font-display font-700 text-lg tracking-wider text-chalk-100 uppercase mb-4">
        Team History
      </h3>

      {teams.length === 0 ? (
        <div className="text-center py-12 text-chalk-400 font-body">No team history found.</div>
      ) : (
        <div className="space-y-3">
          {teams.map((t, i) => {
            const apps = Number(t.apps);
            const wins = Number(t.wins);
            const draws = Number(t.draws);
            const losses = Number(t.losses);
            const goals = Number(t.goals);
            const assists = Number(t.assists);
            const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(0) : "0";
            const isCurrent = !t.leave_date;
            const from = t.join_date
              ? new Date(t.join_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : "?";
            const to = t.leave_date
              ? new Date(t.leave_date).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
              : "Present";

            return (
              <Link
                key={`${t.team_id}-${i}`}
                href={`/teams/${t.team_id}`}
                className="block border border-chalk-100/30 rounded-lg p-4 relative overflow-hidden transition-colors hover:border-[#F4119E]"
                style={{
                  backgroundColor: t.team_color ? `${t.team_color}25` : "rgba(28,28,28,0.4)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-pitch-950/60 to-transparent pointer-events-none" />

                <div className="relative z-10 flex items-start gap-4">
                  <div className="shrink-0">
                    {t.team_logo ? (
                      <img src={proxyImg(t.team_logo)!} alt="" className="w-12 h-12 object-contain" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-pitch-700 flex items-center justify-center text-sm font-display font-700 text-chalk-300">
                        {t.team_name.slice(0, 3).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-display font-700 text-lg text-chalk-100">{t.team_name}</span>
                      <span className="text-xs font-mono text-chalk-400">{from} - {to}</span>
                      {isCurrent && (
                        <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">CURRENT</span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-mono">
                      <span className="text-chalk-300">APPS <span className="text-chalk-100 font-medium">{apps}</span></span>
                      <span className="text-chalk-300">GOALS <span className="text-chalk-100">{goals}</span></span>
                      <span className="text-chalk-300">ASSISTS <span className="text-chalk-100">{assists}</span></span>
                      <span className="text-chalk-300">RECORD <span className="text-grass-500">{wins}W</span> <span className="text-chalk-400">{draws}D</span> <span className="text-red-400">{losses}L</span></span>
                      <span className="text-chalk-300">WIN % <span className="text-chalk-100">{winPct}%</span></span>
                      <span className="text-chalk-300">G/APP <span className="text-chalk-100">{apps > 0 ? (goals / apps).toFixed(2) : "0"}</span></span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
