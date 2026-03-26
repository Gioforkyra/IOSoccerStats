import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getRelatedSteamIds } from "@/lib/player-aliases";

type PlayerStats = {
  apps: bigint;
  total_goals: bigint;
  total_assists: bigint;
  total_shots: bigint;
  total_shots_on_target: bigint;
  total_passes: bigint;
  total_passes_completed: bigint;
  total_saves: bigint;
  total_fouls: bigint;
  total_yellow_cards: bigint;
  total_red_cards: bigint;
  total_interceptions: bigint;
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
      COALESCE(SUM(mps.goals), 0) AS total_goals,
      COALESCE(SUM(mps.assists), 0) AS total_assists,
      COALESCE(SUM(mps.shots), 0) AS total_shots,
      COALESCE(SUM(mps.shots_on_target), 0) AS total_shots_on_target,
      COALESCE(SUM(mps.passes), 0) AS total_passes,
      COALESCE(SUM(mps.passes_completed), 0) AS total_passes_completed,
      COALESCE(SUM(mps.saves), 0) AS total_saves,
      COALESCE(SUM(mps.fouls), 0) AS total_fouls,
      COALESCE(SUM(mps.yellow_cards), 0) AS total_yellow_cards,
      COALESCE(SUM(mps.red_cards), 0) AS total_red_cards,
      COALESCE(SUM(mps.interceptions), 0) AS total_interceptions,
      COUNT(DISTINCT CASE WHEN
        (mps.team_side = 'home' AND m.home_score > m.away_score) OR
        (mps.team_side = 'away' AND m.away_score > m.home_score)
      THEN m.id END) AS wins,
      COUNT(DISTINCT CASE WHEN
        (mps.team_side = 'home' AND m.home_score < m.away_score) OR
        (mps.team_side = 'away' AND m.away_score < m.home_score)
      THEN m.id END) AS losses,
      COUNT(DISTINCT CASE WHEN m.home_score = m.away_score THEN m.id END) AS draws
    FROM match_player_stats mps
    JOIN matches m ON m.id = mps.match_id
    WHERE mps.player_steam_id = ANY(${steamIds})
  `;

  const apps = Number(stats.apps);
  const goals = Number(stats.total_goals);
  const assists = Number(stats.total_assists);
  const wins = Number(stats.wins);
  const losses = Number(stats.losses);
  const draws = Number(stats.draws);
  const shots = Number(stats.total_shots);
  const shotsOnTarget = Number(stats.total_shots_on_target);
  const passes = Number(stats.total_passes);
  const passesCompleted = Number(stats.total_passes_completed);
  const saves = Number(stats.total_saves);
  const fouls = Number(stats.total_fouls);
  const yellows = Number(stats.total_yellow_cards);
  const reds = Number(stats.total_red_cards);
  const interceptions = Number(stats.total_interceptions);
  const winPct = apps > 0 ? ((wins / apps) * 100).toFixed(1) : "0";
  const shotAcc = shots > 0 ? ((shotsOnTarget / shots) * 100).toFixed(1) : "0";
  const passAcc = passes > 0 ? ((passesCompleted / passes) * 100).toFixed(1) : "0";
  const goalsPerApp = apps > 0 ? (goals / apps).toFixed(2) : "0";
  const assistsPerApp = apps > 0 ? (assists / apps).toFixed(2) : "0";

  return (
    <>
      {/* Key Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-8">
        {[
          { label: "Appearances", value: apps.toLocaleString() },
          { label: "Goals", value: goals.toLocaleString() },
          { label: "Assists", value: assists.toLocaleString() },
          { label: "Win Rate", value: `${winPct}%` },
          { label: "Goals/App", value: goalsPerApp },
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

      {/* Detailed Stats */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Winrate */}
        <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
          <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">Winrate</h3>
          <div className="space-y-3">
            {[
              { label: "Wins", value: wins, color: "text-grass-500" },
              { label: "Draws", value: draws, color: "text-chalk-400" },
              { label: "Losses", value: losses, color: "text-red-400" },
              { label: "Win Rate", value: `${winPct}%` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="font-body text-chalk-400">{r.label}</span>
                <span className={`font-mono ${r.color || "text-chalk-200"}`}>
                  {typeof r.value === "number" ? r.value.toLocaleString() : r.value}
                </span>
              </div>
            ))}
            {apps > 0 && (
              <div className="mt-3">
                <div className="flex h-4 rounded-full overflow-hidden bg-pitch-700">
                  {(wins / apps) * 100 >= 1 && (
                    <div className="bg-grass-500 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${(wins / apps) * 100}%` }}>
                      {((wins / apps) * 100).toFixed(0)}%
                    </div>
                  )}
                  {(draws / apps) * 100 >= 1 && (
                    <div className="bg-chalk-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${(draws / apps) * 100}%` }}>
                      {((draws / apps) * 100).toFixed(0)}%
                    </div>
                  )}
                  {(losses / apps) * 100 >= 1 && (
                    <div className="bg-red-400 flex items-center justify-center text-[11px] font-mono font-900 text-pitch-950 drop-shadow-sm" style={{ width: `${(losses / apps) * 100}%` }}>
                      {((losses / apps) * 100).toFixed(0)}%
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Attacking */}
        <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
          <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">Attacking</h3>
          <div className="space-y-3">
            {[
              { label: "Goals", value: goals.toLocaleString() },
              { label: "Goals/App", value: goalsPerApp },
              { label: "Assists", value: assists.toLocaleString() },
              { label: "Assists/App", value: assistsPerApp },
              { label: "Shot Accuracy", value: `${shotAcc}%` },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="font-body text-chalk-400">{r.label}</span>
                <span className="font-mono text-chalk-200">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Passing */}
        <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
          <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">Passing</h3>
          <div className="space-y-3">
            {[
              { label: "Total Passes", value: passes.toLocaleString() },
              { label: "Completed", value: passesCompleted.toLocaleString() },
              { label: "Accuracy", value: `${passAcc}%` },
              { label: "Per App", value: apps > 0 ? (passes / apps).toFixed(1) : "0" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="font-body text-chalk-400">{r.label}</span>
                <span className="font-mono text-chalk-200">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Defense & Discipline */}
        <div className="bg-pitch-900/40 border border-chalk-100/8 rounded-lg p-5">
          <h3 className="font-display font-700 text-sm tracking-wider text-[#F4119E] uppercase mb-4">Defense & Discipline</h3>
          <div className="space-y-3">
            {[
              { label: "Saves", value: saves.toLocaleString() },
              { label: "Interceptions", value: interceptions.toLocaleString() },
              { label: "Fouls", value: fouls.toLocaleString() },
              { label: "Yellow Cards", value: yellows.toLocaleString(), color: "text-amber-500" },
              { label: "Red Cards", value: reds.toLocaleString(), color: "text-red-400" },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="font-body text-chalk-400">{r.label}</span>
                <span className={`font-mono ${r.color || "text-chalk-200"}`}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
