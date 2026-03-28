import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getRelatedSteamIds } from "@/lib/player-aliases";

type PlayerStats = {
  apps: bigint;
  as_sub: bigint;
  total_goals: bigint;
  total_assists: bigint;
  total_second_assists: bigint;
  total_shots: bigint;
  total_shots_on_target: bigint;
  total_passes: bigint;
  total_passes_completed: bigint;
  total_key_passes: bigint;
  total_chances_created: bigint;
  total_saves: bigint;
  total_goals_conceded: bigint;
  total_own_goals: bigint;
  total_fouls: bigint;
  total_fouls_suffered: bigint;
  total_yellow_cards: bigint;
  total_red_cards: bigint;
  total_interceptions: bigint;
  total_offsides: bigint;
  total_distance: bigint;
  total_possession: bigint;
  total_corners: bigint;
  total_throw_ins: bigint;
  total_free_kicks: bigint;
  total_penalties: bigint;
  wins: bigint;
  losses: bigint;
  draws: bigint;
};

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const steamIds = await getRelatedSteamIds(steamId);

  const [stats] = await prisma.$queryRaw<[PlayerStats]>`
    SELECT
      COUNT(DISTINCT mps.match_id) AS apps,
      COUNT(DISTINCT CASE WHEN mps.is_substitute THEN mps.match_id END) AS as_sub,
      COALESCE(SUM(mps.goals), 0) AS total_goals,
      COALESCE(SUM(mps.assists), 0) AS total_assists,
      COALESCE(SUM(COALESCE(mps.second_assists, 0)), 0) AS total_second_assists,
      COALESCE(SUM(mps.shots), 0) AS total_shots,
      COALESCE(SUM(mps.shots_on_target), 0) AS total_shots_on_target,
      COALESCE(SUM(mps.passes), 0) AS total_passes,
      COALESCE(SUM(mps.passes_completed), 0) AS total_passes_completed,
      COALESCE(SUM(COALESCE(mps.key_passes, 0)), 0) AS total_key_passes,
      COALESCE(SUM(COALESCE(mps.chances_created, 0)), 0) AS total_chances_created,
      COALESCE(SUM(mps.saves), 0) AS total_saves,
      COALESCE(SUM(mps.goals_conceded), 0) AS total_goals_conceded,
      COALESCE(SUM(COALESCE(mps.own_goals, 0)), 0) AS total_own_goals,
      COALESCE(SUM(mps.fouls), 0) AS total_fouls,
      COALESCE(SUM(mps.fouls_suffered), 0) AS total_fouls_suffered,
      COALESCE(SUM(mps.yellow_cards), 0) AS total_yellow_cards,
      COALESCE(SUM(mps.red_cards), 0) AS total_red_cards,
      COALESCE(SUM(mps.interceptions), 0) AS total_interceptions,
      COALESCE(SUM(COALESCE(mps.offsides, 0)), 0) AS total_offsides,
      COALESCE(SUM(mps.distance_run), 0) AS total_distance,
      COALESCE(SUM(mps.possession), 0) AS total_possession,
      COALESCE(SUM(COALESCE(mps.corners, 0)), 0) AS total_corners,
      COALESCE(SUM(COALESCE(mps.throw_ins, 0)), 0) AS total_throw_ins,
      COALESCE(SUM(COALESCE(mps.free_kicks, 0)), 0) AS total_free_kicks,
      COALESCE(SUM(COALESCE(mps.penalties, 0)), 0) AS total_penalties,
      COUNT(CASE WHEN
        (mps.team_side = 'home' AND m.home_score > m.away_score) OR
        (mps.team_side = 'away' AND m.away_score > m.home_score)
      THEN 1 END) AS wins,
      COUNT(CASE WHEN
        (mps.team_side = 'home' AND m.home_score < m.away_score) OR
        (mps.team_side = 'away' AND m.away_score < m.home_score)
      THEN 1 END) AS losses,
      COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END) AS draws
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ANY(${steamIds})
  `;

  const asSub = Number(stats.as_sub);
  const goals = Number(stats.total_goals);
  const assists = Number(stats.total_assists);
  const secondAssists = Number(stats.total_second_assists);
  const wins = Number(stats.wins);
  const losses = Number(stats.losses);
  const draws = Number(stats.draws);
  const apps = wins + draws + losses;
  const shots = Number(stats.total_shots);
  const shotsOnTarget = Number(stats.total_shots_on_target);
  const passes = Number(stats.total_passes);
  const passesCompleted = Number(stats.total_passes_completed);
  const keyPasses = Number(stats.total_key_passes);
  const chancesCreated = Number(stats.total_chances_created);
  const saves = Number(stats.total_saves);
  const goalsConceded = Number(stats.total_goals_conceded);
  const ownGoals = Number(stats.total_own_goals);
  const fouls = Number(stats.total_fouls);
  const foulsSuffered = Number(stats.total_fouls_suffered);
  const yellows = Number(stats.total_yellow_cards);
  const reds = Number(stats.total_red_cards);
  const interceptions = Number(stats.total_interceptions);
  const offsides = Number(stats.total_offsides);
  const distance = Number(stats.total_distance);
  const corners = Number(stats.total_corners);
  const throwIns = Number(stats.total_throw_ins);
  const freeKicks = Number(stats.total_free_kicks);
  const penalties = Number(stats.total_penalties);

  const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(1) : "0";
  const shotAcc = shots > 0 ? ((shotsOnTarget / shots) * 100).toFixed(1) : "0";
  const passAcc = passes > 0 ? ((passesCompleted / passes) * 100).toFixed(1) : "0";
  const savePct = saves + goalsConceded > 0 ? ((saves / (saves + goalsConceded)) * 100).toFixed(1) : "0";
  const perApp = (v: number) => apps > 0 ? (v / apps).toFixed(2) : "0.00";
  const avgDistance = apps > 0 ? (distance / apps / 1000).toFixed(2) : "0";

  return (
    <>
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Appearances", value: apps.toLocaleString() },
          { label: "Goals", value: goals.toLocaleString() },
          { label: "Assists", value: assists.toLocaleString() },
          { label: "Win Rate", value: `${winPct}%` },
          { label: "Goals/App", value: perApp(goals) },
          { label: "Shot Accuracy", value: `${shotAcc}%` },
        ].map((s) => (
          <div key={s.label} className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4">
            <div className="text-[10px] font-mono text-chalk-400 uppercase mb-1">{s.label}</div>
            <div className="text-2xl font-display font-800 text-chalk-100">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Stats - 3 column grid like official site */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* General */}
        <StatCard title="General" rows={[
          { label: "Appearances", value: apps.toLocaleString() },
          { label: "As Substitute", value: asSub.toLocaleString() },
          { label: "Wins", value: wins.toLocaleString(), color: "text-grass-500" },
          { label: "Draws", value: draws.toLocaleString() },
          { label: "Losses", value: losses.toLocaleString(), color: "text-red-400" },
          { label: "Win Rate", value: `${winPct}%` },
        ]}
          footer={apps > 0 ? (
            <div className="mt-3">
              <div className="flex h-4 rounded-full overflow-hidden bg-pitch-700">
                {(() => {
                  const winPct2 = (wins / apps) * 100;
                  const drawPct2 = (draws / apps) * 100;
                  const lossPct2 = (losses / apps) * 100;
                  return (
                    <>
                      {winPct2 >= 1 && (
                        <div className="bg-grass-500 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${winPct2}%` }}>
                          {winPct2.toFixed(0)}%
                        </div>
                      )}
                      {drawPct2 >= 1 && (
                        <div className="bg-chalk-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${drawPct2}%` }}>
                          {drawPct2.toFixed(0)}%
                        </div>
                      )}
                      {lossPct2 >= 1 && (
                        <div className="bg-red-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${lossPct2}%` }}>
                          {lossPct2.toFixed(0)}%
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ) : undefined}
        />

        {/* Teamplay */}
        <StatCard title="Teamplay" rows={[
          { label: "Assists", value: `${assists.toLocaleString()} (${perApp(assists)})` },
          { label: "Passes", value: `${passes.toLocaleString()} (${perApp(passes)})` },
          { label: "Passes Completed", value: `${passesCompleted.toLocaleString()} (${perApp(passesCompleted)})` },
          { label: "Pass Accuracy", value: `${passAcc}%` },
          { label: "Key Passes", value: `${keyPasses.toLocaleString()} (${perApp(keyPasses)})` },
          { label: "Chances Created", value: `${chancesCreated.toLocaleString()} (${perApp(chancesCreated)})` },
          { label: "Second Assists", value: `${secondAssists.toLocaleString()} (${perApp(secondAssists)})` },
        ]} />

        {/* Discipline */}
        <StatCard title="Discipline" rows={[
          { label: "Fouls", value: `${fouls.toLocaleString()} (${perApp(fouls)})` },
          { label: "Fouls Suffered", value: `${foulsSuffered.toLocaleString()} (${perApp(foulsSuffered)})` },
          { label: "Yellow Cards", value: `${yellows.toLocaleString()} (${perApp(yellows)})`, color: "text-amber-500" },
          { label: "Red Cards", value: `${reds.toLocaleString()} (${perApp(reds)})`, color: "text-red-400" },
          { label: "Offsides", value: `${offsides.toLocaleString()} (${perApp(offsides)})` },
        ]} />

        {/* Goalkeeping */}
        <StatCard title="Goalkeeping" rows={[
          { label: "Saves", value: `${saves.toLocaleString()} (${perApp(saves)})` },
          { label: "Save Percentage", value: `${savePct}%` },
          { label: "Goals Conceded", value: `${goalsConceded.toLocaleString()} (${perApp(goalsConceded)})` },
          { label: "Own Goals", value: ownGoals.toLocaleString() },
        ]} />

        {/* Defending */}
        <StatCard title="Defending" rows={[
          { label: "Interceptions", value: `${interceptions.toLocaleString()} (${perApp(interceptions)})` },
          { label: "Corners", value: `${corners.toLocaleString()} (${perApp(corners)})` },
          { label: "Free Kicks", value: `${freeKicks.toLocaleString()} (${perApp(freeKicks)})` },
          { label: "Throw Ins", value: `${throwIns.toLocaleString()} (${perApp(throwIns)})` },
          { label: "Avg Distance", value: `${avgDistance} km` },
        ]} />

        {/* Attacking */}
        <StatCard title="Attacking" rows={[
          { label: "Goals", value: `${goals.toLocaleString()} (${perApp(goals)})` },
          { label: "Shots", value: `${shots.toLocaleString()} (${perApp(shots)})` },
          { label: "Shots on Target", value: `${shotsOnTarget.toLocaleString()} (${perApp(shotsOnTarget)})` },
          { label: "Shot Accuracy", value: `${shotAcc}%` },
          { label: "Penalties", value: penalties.toLocaleString() },
        ]} />
      </div>
    </>
  );
}

function StatCard({ title, rows, footer }: {
  title: string;
  rows: { label: string; value: string; color?: string }[];
  footer?: React.ReactNode;
}) {
  return (
    <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
      <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">{title}</h3>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <span className="font-body text-chalk-400">{r.label}</span>
            <span className={`font-mono ${r.color || "text-chalk-200"}`}>{r.value}</span>
          </div>
        ))}
      </div>
      {footer}
    </div>
  );
}
