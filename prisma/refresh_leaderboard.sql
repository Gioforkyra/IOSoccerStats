-- Recreate materialized view with comprehensive player stats
-- Run this after schema changes

-- Pre-compute total possession per match (needed for percentage calculation)
DROP MATERIALIZED VIEW IF EXISTS mv_player_leaderboard;

CREATE MATERIALIZED VIEW mv_player_leaderboard AS
WITH match_poss AS (
  SELECT match_id, SUM(possession) AS total_poss
  FROM match_player_stats
  GROUP BY match_id
)
SELECT
  mps.player_steam_id,
  COUNT(DISTINCT CASE WHEN mps.is_substitute THEN mps.match_id END) AS as_sub,
  -- Win / Draw / Loss: counted per team-side performance.
  -- A player on both teams in the same match gets both outcomes counted.
  COUNT(CASE WHEN
    (mps.team_side = 'home' AND m.home_score > m.away_score) OR
    (mps.team_side = 'away' AND m.away_score > m.home_score)
  THEN 1 END) AS wins,
  COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END) AS draws,
  COUNT(CASE WHEN
    (mps.team_side = 'home' AND m.home_score < m.away_score) OR
    (mps.team_side = 'away' AND m.away_score < m.home_score)
  THEN 1 END) AS losses,
  -- apps = wins + draws + losses (per team-side performances, consistent with profile page)
  COUNT(CASE WHEN
    (mps.team_side = 'home' AND m.home_score > m.away_score) OR
    (mps.team_side = 'away' AND m.away_score > m.home_score)
  THEN 1 END) +
  COUNT(CASE WHEN m.home_score = m.away_score THEN 1 END) +
  COUNT(CASE WHEN
    (mps.team_side = 'home' AND m.home_score < m.away_score) OR
    (mps.team_side = 'away' AND m.away_score < m.home_score)
  THEN 1 END) AS apps,
  -- Attacking
  SUM(mps.goals) AS total_goals,
  SUM(mps.assists) AS total_assists,
  SUM(COALESCE(mps.second_assists, 0)) AS total_second_assists,
  SUM(mps.shots) AS total_shots,
  SUM(mps.shots_on_target) AS total_shots_on_target,
  SUM(COALESCE(mps.key_passes, 0)) AS total_key_passes,
  SUM(COALESCE(mps.chances_created, 0)) AS total_chances_created,
  SUM(COALESCE(mps.offsides, 0)) AS total_offsides,
  SUM(COALESCE(mps.own_goals, 0)) AS total_own_goals,
  -- Passing
  SUM(mps.passes) AS total_passes,
  SUM(mps.passes_completed) AS total_passes_completed,
  -- Goalkeeping
  SUM(mps.saves) AS total_saves,
  SUM(COALESCE(mps.saves_caught, 0)) AS total_saves_caught,
  SUM(mps.goals_conceded) AS total_goals_conceded,
  -- Defending
  SUM(mps.interceptions) AS total_interceptions,
  SUM(COALESCE(mps.sliding_tackles, 0)) AS total_tackles,
  SUM(COALESCE(mps.sliding_tackles_completed, 0)) AS total_tackles_completed,
  -- Discipline
  SUM(mps.fouls) AS total_fouls,
  SUM(mps.fouls_suffered) AS total_fouls_suffered,
  SUM(mps.yellow_cards) AS total_yellow_cards,
  SUM(mps.red_cards) AS total_red_cards,
  -- Other
  SUM(mps.distance_run) AS total_distance,
  SUM(mps.possession) AS total_possession,
  -- Possession: average percentage per match (player_poss / match_total_poss * 100)
  ROUND(AVG(
    CASE WHEN mp.total_poss > 0
      THEN mps.possession::numeric / mp.total_poss * 100
      ELSE 0
    END
  )::numeric, 2) AS avg_possession_pct,
  -- Accuracies
  CASE WHEN SUM(mps.shots) > 0
    THEN ROUND(SUM(mps.shots_on_target)::numeric / SUM(mps.shots) * 100, 2)
    ELSE 0 END AS shot_accuracy,
  CASE WHEN SUM(mps.passes) > 0
    THEN ROUND(SUM(mps.passes_completed)::numeric / SUM(mps.passes) * 100, 2)
    ELSE 0 END AS pass_accuracy
FROM match_player_stats mps
JOIN matches m ON m.id = mps.match_id
JOIN match_poss mp ON mp.match_id = mps.match_id
GROUP BY mps.player_steam_id;

CREATE UNIQUE INDEX idx_mv_player_lb_steam_id ON mv_player_leaderboard (player_steam_id);

-- To refresh after new data: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_player_leaderboard;
