-- Migration: Change match_player_stats PK from (match_id, player_steam_id)
--            to (match_id, player_steam_id, team_side)
-- This is needed to support shared GK who play for both teams in one match.

-- Step 1: Drop the old primary key
ALTER TABLE match_player_stats DROP CONSTRAINT match_player_stats_pkey;

-- Step 2: Add the new composite primary key including team_side
ALTER TABLE match_player_stats ADD PRIMARY KEY (match_id, player_steam_id, team_side);

-- Step 3: After re-syncing all matches, rebuild the materialized view
-- Run refresh_leaderboard.sql after data is re-imported
