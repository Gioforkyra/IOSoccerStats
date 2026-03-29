-- Converts mv_player_leaderboard from a materialized view to a writable table.
-- Run this ONCE in your database before using the /api/sync-leaderboard route.
--
--   psql $DATABASE_URL -f prisma/leaderboard_to_table.sql

DROP MATERIALIZED VIEW IF EXISTS mv_player_leaderboard CASCADE;

CREATE TABLE mv_player_leaderboard (
  player_steam_id         TEXT    NOT NULL,
  apps                    BIGINT  NOT NULL DEFAULT 0,
  as_sub                  BIGINT  NOT NULL DEFAULT 0,
  wins                    BIGINT  NOT NULL DEFAULT 0,
  draws                   BIGINT  NOT NULL DEFAULT 0,
  losses                  BIGINT  NOT NULL DEFAULT 0,
  total_goals             BIGINT  NOT NULL DEFAULT 0,
  total_assists           BIGINT  NOT NULL DEFAULT 0,
  total_second_assists    BIGINT  NOT NULL DEFAULT 0,
  total_shots             BIGINT  NOT NULL DEFAULT 0,
  total_shots_on_target   BIGINT  NOT NULL DEFAULT 0,
  total_key_passes        BIGINT  NOT NULL DEFAULT 0,
  total_chances_created   BIGINT  NOT NULL DEFAULT 0,
  total_offsides          BIGINT  NOT NULL DEFAULT 0,
  total_own_goals         BIGINT  NOT NULL DEFAULT 0,
  total_passes            BIGINT  NOT NULL DEFAULT 0,
  total_passes_completed  BIGINT  NOT NULL DEFAULT 0,
  total_saves             BIGINT  NOT NULL DEFAULT 0,
  total_saves_caught      BIGINT  NOT NULL DEFAULT 0,
  total_goals_conceded    BIGINT  NOT NULL DEFAULT 0,
  total_interceptions     BIGINT  NOT NULL DEFAULT 0,
  total_tackles           BIGINT  NOT NULL DEFAULT 0,
  total_tackles_completed BIGINT  NOT NULL DEFAULT 0,
  total_fouls             BIGINT  NOT NULL DEFAULT 0,
  total_fouls_suffered    BIGINT  NOT NULL DEFAULT 0,
  total_yellow_cards      BIGINT  NOT NULL DEFAULT 0,
  total_red_cards         BIGINT  NOT NULL DEFAULT 0,
  total_distance          BIGINT  NOT NULL DEFAULT 0,
  total_possession        BIGINT  NOT NULL DEFAULT 0,
  avg_possession_pct      FLOAT8  NOT NULL DEFAULT 0,
  shot_accuracy           FLOAT8  NOT NULL DEFAULT 0,
  pass_accuracy           FLOAT8  NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX idx_mv_player_lb_steam_id ON mv_player_leaderboard (player_steam_id);
