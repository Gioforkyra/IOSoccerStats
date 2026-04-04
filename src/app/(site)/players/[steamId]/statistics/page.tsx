import { getPlayerStatisticsForProfile } from "@/lib/iosoccer-api";
import { prisma } from "@/lib/prisma";

export const revalidate = 120;

export default async function PlayerStatisticsPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId: rawSteamId } = await params;
  const steamId = decodeURIComponent(rawSteamId);

  const player = await prisma.player.findUnique({
    where: { steamId },
    select: { iosoccerId: true, username: true },
  });

  let stats = null;
  try {
    stats = await getPlayerStatisticsForProfile({
      steamId,
      iosoccerId: player?.iosoccerId ?? null,
      username: player?.username ?? null,
    });
  } catch {
    stats = null;
  }

  if (!stats) {
    return (
      <div className="text-center py-16 text-chalk-400 font-body">
        Player statistics are temporarily unavailable. Please retry in a moment.
      </div>
    );
  }

  const apps = Number(stats.appearances ?? 0);
  const asSub = Number(stats.substituteAppearances ?? 0);
  const wins = Number(stats.wins ?? 0);
  const draws = Number(stats.draws ?? 0);
  const losses = Number(stats.losses ?? 0);
  const goals = Number(stats.goals ?? 0);
  const assists = Number(stats.assists ?? 0);
  const secondAssists = Number(stats.secondAssists ?? 0);
  const shots = Number(stats.shots ?? 0);
  const shotsOnTarget = Number(stats.shotsOnGoal ?? 0);
  const passes = Number(stats.passes ?? 0);
  const passesCompleted = Number(stats.passesCompleted ?? 0);
  const keyPasses = Number(stats.keyPasses ?? 0);
  const chancesCreated = Number(stats.chancesCreated ?? 0);
  const saves = Number(stats.keeperSaves ?? 0);
  const savesCaught = Math.round(Number(stats.keeperSavesCaughtAverage ?? 0) * apps);
  const goalsConceded = Number(stats.goalsConceded ?? 0);
  const ownGoals = Number(stats.ownGoals ?? 0);
  const fouls = Number(stats.fouls ?? 0);
  const foulsSuffered = Number(stats.foulsSuffered ?? 0);
  const yellows = Number(stats.yellowCards ?? 0);
  const reds = Number(stats.redCards ?? 0);
  const interceptions = Number(stats.interceptions ?? 0);
  const tackles = Math.round(Number(stats.slidingTacklesAverage ?? 0) * apps);
  const tacklesCompleted = Math.round(Number(stats.slidingTacklesCompletedAverage ?? 0) * apps);
  const offsides = Number(stats.offsides ?? 0);
  const distance = Math.round(Number(stats.distanceCoveredAverage ?? 0) * apps);

  const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(1) : "0";
  const shotAccuracyRaw = Number(stats.shotAccuracyPercentage ?? 0);
  const passAccuracyRaw = Number(stats.passCompletionPercentageAverage ?? 0);
  const shotAcc = shotAccuracyRaw > 0 && shotAccuracyRaw <= 1 ? (shotAccuracyRaw * 100).toFixed(1) : shotAccuracyRaw.toFixed(1);
  const passAcc = passAccuracyRaw > 0 && passAccuracyRaw <= 1 ? (passAccuracyRaw * 100).toFixed(1) : passAccuracyRaw.toFixed(1);
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
