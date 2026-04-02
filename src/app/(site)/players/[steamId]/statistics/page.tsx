import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

type LeaderboardRow = {
  apps: bigint;
  as_sub: bigint;
  wins: bigint;
  draws: bigint;
  losses: bigint;
  total_goals: bigint;
  total_assists: bigint;
  total_second_assists: bigint;
  total_shots: bigint;
  total_shots_on_target: bigint;
  total_key_passes: bigint;
  total_chances_created: bigint;
  total_offsides: bigint;
  total_own_goals: bigint;
  total_passes: bigint;
  total_passes_completed: bigint;
  total_saves: bigint;
  total_saves_caught: bigint;
  total_goals_conceded: bigint;
  total_interceptions: bigint;
  total_tackles: bigint;
  total_tackles_completed: bigint;
  total_fouls: bigint;
  total_fouls_suffered: bigint;
  total_yellow_cards: bigint;
  total_red_cards: bigint;
  total_distance: bigint;
  total_possession: bigint;
  avg_possession_pct: number;
  shot_accuracy: number;
  pass_accuracy: number;
};

export default async function PlayerStatisticsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({ where: { steamId } });
  if (!player) return notFound();

  const rows = await prisma.$queryRaw<LeaderboardRow[]>`
    SELECT
      apps, as_sub, wins, draws, losses,
      total_goals, total_assists, total_second_assists,
      total_shots, total_shots_on_target,
      total_key_passes, total_chances_created, total_offsides, total_own_goals,
      total_passes, total_passes_completed,
      total_saves, total_saves_caught, total_goals_conceded,
      total_interceptions, total_tackles, total_tackles_completed,
      total_fouls, total_fouls_suffered,
      total_yellow_cards, total_red_cards,
      total_distance, total_possession,
      avg_possession_pct, shot_accuracy, pass_accuracy
    FROM mv_player_leaderboard
    WHERE player_steam_id = ${steamId}
  `;

  const raw = rows[0];
  if (!raw) {
    return (
      <div className="text-center py-16 text-chalk-400 font-body">
        No statistics available for this player.
      </div>
    );
  }
  const stats = raw;

  const apps = Number(stats.apps);
  const asSub = Number(stats.as_sub);
  const wins = Number(stats.wins);
  const draws = Number(stats.draws);
  const losses = Number(stats.losses);
  const goals = Number(stats.total_goals);
  const assists = Number(stats.total_assists);
  const secondAssists = Number(stats.total_second_assists);
  const shots = Number(stats.total_shots);
  const shotsOnTarget = Number(stats.total_shots_on_target);
  const passes = Number(stats.total_passes);
  const passesCompleted = Number(stats.total_passes_completed);
  const keyPasses = Number(stats.total_key_passes);
  const chancesCreated = Number(stats.total_chances_created);
  const saves = Number(stats.total_saves);
  const savesCaught = Number(stats.total_saves_caught);
  const goalsConceded = Number(stats.total_goals_conceded);
  const ownGoals = Number(stats.total_own_goals);
  const fouls = Number(stats.total_fouls);
  const foulsSuffered = Number(stats.total_fouls_suffered);
  const yellows = Number(stats.total_yellow_cards);
  const reds = Number(stats.total_red_cards);
  const interceptions = Number(stats.total_interceptions);
  const tackles = Number(stats.total_tackles);
  const tacklesCompleted = Number(stats.total_tackles_completed);
  const offsides = Number(stats.total_offsides);
  const distance = Number(stats.total_distance);

  const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(1) : "0";
  const shotAcc = stats.shot_accuracy > 0 ? stats.shot_accuracy.toFixed(1) : "0";
  const passAcc = stats.pass_accuracy > 0 ? stats.pass_accuracy.toFixed(1) : "0";
  const savePct = saves + goalsConceded > 0 ? ((saves / (saves + goalsConceded)) * 100).toFixed(1) : "0";
  const tackleAcc = tackles > 0 ? ((tacklesCompleted / tackles) * 100).toFixed(1) : "0";
  const perApp = (v: number) => apps > 0 ? (v / apps).toFixed(2) : "0.00";
  const avgDistance = apps > 0 ? (distance / apps / 1000).toFixed(2) : "0";

  return (
    <>
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Appearances", value: apps.toLocaleString(), colorClass: "text-chalk-100" },
          { label: "Goals", value: goals.toLocaleString(), colorClass: "text-chalk-100" },
          { label: "Assists", value: assists.toLocaleString(), colorClass: "text-chalk-100" },
          {
            label: "Win Rate", value: `${winPct}%`,
            colorClass: Number(winPct) > 51 ? "wr-elite" : Number(winPct) >= 45 ? "text-green-400" : "text-red-400",
          },
          { label: "Goals/App", value: perApp(goals), colorClass: "text-chalk-100" },
          { label: "Shot Accuracy", value: `${shotAcc}%`, colorClass: "text-chalk-100" },
        ].map((s) => (
          <div key={s.label} className="bg-pitch-900/60 border border-chalk-100/8 rounded-lg p-4">
            <div className="text-[10px] font-mono text-chalk-400 uppercase mb-1">{s.label}</div>
            <div className={`text-2xl font-display font-800 ${s.colorClass}`}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Stats - 3 column grid */}
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
          { label: "Saves Caught", value: `${savesCaught.toLocaleString()} (${perApp(savesCaught)})` },
          { label: "Save Percentage", value: `${savePct}%` },
          { label: "Goals Conceded", value: `${goalsConceded.toLocaleString()} (${perApp(goalsConceded)})` },
          { label: "Own Goals", value: ownGoals.toLocaleString() },
        ]} />

        {/* Defending */}
        <StatCard title="Defending" rows={[
          { label: "Interceptions", value: `${interceptions.toLocaleString()} (${perApp(interceptions)})` },
          { label: "Tackles", value: `${tackles.toLocaleString()} (${perApp(tackles)})` },
          { label: "Tackles Completed", value: `${tacklesCompleted.toLocaleString()} (${perApp(tacklesCompleted)})` },
          { label: "Tackle Accuracy", value: `${tackleAcc}%` },
          { label: "Avg Distance", value: `${avgDistance} km` },
        ]} />

        {/* Attacking */}
        <StatCard title="Attacking" rows={[
          { label: "Goals", value: `${goals.toLocaleString()} (${perApp(goals)})` },
          { label: "Shots", value: `${shots.toLocaleString()} (${perApp(shots)})` },
          { label: "Shots on Target", value: `${shotsOnTarget.toLocaleString()} (${perApp(shotsOnTarget)})` },
          { label: "Shot Accuracy", value: `${shotAcc}%` },
          { label: "Offsides", value: `${offsides.toLocaleString()} (${perApp(offsides)})` },
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
