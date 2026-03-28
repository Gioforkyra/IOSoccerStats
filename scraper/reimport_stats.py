"""
Quick re-import of match_player_stats from the DB export, then rebuild the materialized view.
Run from project root: python scraper/reimport_stats.py
"""
import asyncio
import asyncpg
import json
import os
import time
import glob
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = (os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")).strip('"').strip("'")
EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "data_export")
RAW_DIR = os.path.join(EXPORT_DIR, "raw_matches")

# Stat index mapping (same as sync-matches route)
S_IDX = {
    "red_cards": 0, "yellow_cards": 1, "fouls": 2, "fouls_suffered": 3,
    "sliding_tackles": 4, "sliding_tackles_completed": 5, "goals_conceded": 6,
    "shots": 7, "shots_on_target": 8, "passes_completed": 9, "interceptions": 10,
    "offsides": 11, "goals": 12, "own_goals": 13, "assists": 14, "passes": 15,
    "free_kicks": 16, "penalties": 17, "corners": 18, "throw_ins": 19,
    "saves": 20, "goal_kicks": 21, "possession": 22, "distance_run": 23,
    "saves_caught": 24, "key_passes": 25, "chances_created": 26, "second_assists": 27,
}


def safe_stat(arr, idx):
    if idx < len(arr):
        return arr[idx] or 0
    return 0


def steam3_to_64(raw):
    """Convert [U:1:X] to Steam64."""
    if raw.startswith("[U:1:"):
        x = int(raw.split(":")[2].rstrip("]"))
        return str(x + 76561197960265728)
    return raw


async def main():
    print(f"Connecting to database...")
    conn = await asyncpg.connect(DATABASE_URL)

    # ---- Phase 1: Import DB export (match_player_stats.json) ----
    export_path = os.path.join(EXPORT_DIR, "match_player_stats.json")
    if os.path.exists(export_path):
        print(f"Phase 1: Importing match_player_stats.json...")
        t0 = time.time()
        with open(export_path, "r", encoding="utf-8") as f:
            stats = json.load(f)

        batch = []
        count = 0
        for s in stats:
            batch.append((
                s["match_id"], s["player_steam_id"], s["team_side"], s.get("position"),
                s.get("goals", 0), s.get("assists", 0), s.get("shots", 0),
                s.get("shots_on_target", 0), s.get("passes", 0), s.get("passes_completed", 0),
                s.get("saves", 0), s.get("fouls", 0), s.get("yellow_cards", 0),
                s.get("red_cards", 0), s.get("interceptions", 0), float(s.get("possession", 0)),
                s.get("minutes_played", 0), s.get("is_substitute", False), s.get("is_potm", False),
            ))
            if len(batch) >= 5000:
                await conn.executemany(
                    """INSERT INTO match_player_stats (
                        match_id, player_steam_id, team_side, position,
                        goals, assists, shots, shots_on_target,
                        passes, passes_completed, saves, fouls,
                        yellow_cards, red_cards, interceptions, possession,
                        minutes_played, is_substitute, is_potm
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                    ON CONFLICT (match_id, player_steam_id, team_side) DO NOTHING""",
                    batch
                )
                count += len(batch)
                batch = []
                if count % 100000 == 0:
                    elapsed = time.time() - t0
                    print(f"  {count}/{len(stats)} rows ({elapsed:.1f}s)")

        if batch:
            await conn.executemany(
                """INSERT INTO match_player_stats (
                    match_id, player_steam_id, team_side, position,
                    goals, assists, shots, shots_on_target,
                    passes, passes_completed, saves, fouls,
                    yellow_cards, red_cards, interceptions, possession,
                    minutes_played, is_substitute, is_potm
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
                ON CONFLICT (match_id, player_steam_id, team_side) DO NOTHING""",
                batch
            )
            count += len(batch)

        elapsed = time.time() - t0
        print(f"  Phase 1 done: {count} rows inserted ({elapsed:.1f}s)")
    else:
        print(f"  Skipping Phase 1: {export_path} not found")

    # ---- Phase 2: Re-process raw_matches with full 28-stat logic ----
    batch_files = sorted(glob.glob(os.path.join(RAW_DIR, "batch_*.json")))
    if batch_files:
        print(f"\nPhase 2: Re-processing {len(batch_files)} raw_match batches with full stats...")
        t0 = time.time()
        total_upserted = 0

        for bf in batch_files:
            with open(bf, "r", encoding="utf-8") as f:
                matches = json.load(f)

            batch = []
            for raw in matches:
                ms = raw.get("matchStatistics")
                if not ms:
                    continue
                md = ms.get("matchData")
                if not md:
                    continue

                match_id = raw.get("id")
                potm_obj = raw.get("playerOfTheMatch", {}) or {}
                potm_name = potm_obj.get("name")

                for rp in md.get("players", []):
                    info = rp.get("info", {})
                    steam_id_raw = info.get("steamId", "")
                    steam_id64 = info.get("steamId64", "")
                    name = info.get("name", "")
                    if not (steam_id_raw or steam_id64) or not name:
                        continue
                    if not steam_id64:
                        steam_id64 = steam3_to_64(steam_id_raw)

                    periods = rp.get("matchPeriodData", [])
                    if not periods:
                        continue

                    # Group periods by team side (handles shared GK)
                    by_team = {}
                    for period in periods:
                        pi = period.get("info", {})
                        side = "away" if pi.get("team") == "away" else "home"
                        if side not in by_team:
                            by_team[side] = {
                                "totals": [0] * 28,
                                "position": pi.get("position"),
                                "is_sub": (pi.get("startSecond", 0) or 0) > 0,
                            }
                        if not by_team[side]["position"]:
                            by_team[side]["position"] = pi.get("position")
                        stats_arr = period.get("statistics", [])
                        for i, v in enumerate(stats_arr):
                            if i < 28:
                                by_team[side]["totals"][i] += (v or 0)

                    for side, data in by_team.items():
                        t = data["totals"]
                        batch.append((
                            match_id, steam_id64, side, data["position"],
                            safe_stat(t, S_IDX["goals"]),
                            safe_stat(t, S_IDX["assists"]),
                            safe_stat(t, S_IDX["second_assists"]),
                            safe_stat(t, S_IDX["shots"]),
                            safe_stat(t, S_IDX["shots_on_target"]),
                            safe_stat(t, S_IDX["passes"]),
                            safe_stat(t, S_IDX["passes_completed"]),
                            safe_stat(t, S_IDX["key_passes"]),
                            safe_stat(t, S_IDX["chances_created"]),
                            safe_stat(t, S_IDX["interceptions"]),
                            safe_stat(t, S_IDX["saves"]),
                            safe_stat(t, S_IDX["saves_caught"]),
                            safe_stat(t, S_IDX["offsides"]),
                            safe_stat(t, S_IDX["fouls"]),
                            safe_stat(t, S_IDX["fouls_suffered"]),
                            safe_stat(t, S_IDX["yellow_cards"]),
                            safe_stat(t, S_IDX["red_cards"]),
                            safe_stat(t, S_IDX["own_goals"]),
                            safe_stat(t, S_IDX["goals_conceded"]),
                            safe_stat(t, S_IDX["corners"]),
                            safe_stat(t, S_IDX["throw_ins"]),
                            safe_stat(t, S_IDX["free_kicks"]),
                            safe_stat(t, S_IDX["goal_kicks"]),
                            safe_stat(t, S_IDX["penalties"]),
                            safe_stat(t, S_IDX["distance_run"]),
                            float(safe_stat(t, S_IDX["possession"])),
                            round(safe_stat(t, S_IDX["possession"]) / 10),  # minutes_played
                            data["is_sub"],
                            name == potm_name,
                            safe_stat(t, S_IDX["sliding_tackles"]),
                            safe_stat(t, S_IDX["sliding_tackles_completed"]),
                        ))

            if batch:
                await conn.executemany(
                    """INSERT INTO match_player_stats (
                        match_id, player_steam_id, team_side, position,
                        goals, assists, second_assists, shots, shots_on_target,
                        passes, passes_completed, key_passes, chances_created,
                        interceptions, saves, saves_caught, offsides, fouls, fouls_suffered,
                        yellow_cards, red_cards, own_goals, goals_conceded,
                        corners, throw_ins, free_kicks, goal_kicks, penalties,
                        distance_run, possession, minutes_played,
                        is_substitute, is_potm,
                        sliding_tackles, sliding_tackles_completed
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35)
                    ON CONFLICT (match_id, player_steam_id, team_side) DO UPDATE SET
                        position = EXCLUDED.position,
                        goals = EXCLUDED.goals, assists = EXCLUDED.assists,
                        second_assists = EXCLUDED.second_assists,
                        shots = EXCLUDED.shots, shots_on_target = EXCLUDED.shots_on_target,
                        passes = EXCLUDED.passes, passes_completed = EXCLUDED.passes_completed,
                        key_passes = EXCLUDED.key_passes, chances_created = EXCLUDED.chances_created,
                        interceptions = EXCLUDED.interceptions, saves = EXCLUDED.saves,
                        saves_caught = EXCLUDED.saves_caught, offsides = EXCLUDED.offsides,
                        fouls = EXCLUDED.fouls, fouls_suffered = EXCLUDED.fouls_suffered,
                        yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
                        own_goals = EXCLUDED.own_goals, goals_conceded = EXCLUDED.goals_conceded,
                        corners = EXCLUDED.corners, throw_ins = EXCLUDED.throw_ins,
                        free_kicks = EXCLUDED.free_kicks, goal_kicks = EXCLUDED.goal_kicks,
                        penalties = EXCLUDED.penalties,
                        distance_run = EXCLUDED.distance_run, possession = EXCLUDED.possession,
                        minutes_played = EXCLUDED.minutes_played,
                        is_substitute = EXCLUDED.is_substitute, is_potm = EXCLUDED.is_potm,
                        sliding_tackles = EXCLUDED.sliding_tackles,
                        sliding_tackles_completed = EXCLUDED.sliding_tackles_completed""",
                    batch
                )
                total_upserted += len(batch)

            print(f"  {os.path.basename(bf)}: {len(batch)} rows")

        elapsed = time.time() - t0
        print(f"  Phase 2 done: {total_upserted} rows upserted ({elapsed:.1f}s)")
    else:
        print("  Skipping Phase 2: no raw_match batch files found")

    # ---- Phase 3: Rebuild materialized view ----
    print(f"\nPhase 3: Rebuilding materialized view...")
    t0 = time.time()
    refresh_sql_path = os.path.join(os.path.dirname(__file__), "..", "prisma", "refresh_leaderboard.sql")
    with open(refresh_sql_path, "r", encoding="utf-8") as f:
        sql = f.read()

    # Execute each statement separately
    for stmt in sql.split(";"):
        stmt = stmt.strip()
        if stmt and not stmt.startswith("--"):
            await conn.execute(stmt)

    elapsed = time.time() - t0
    print(f"  Materialized view rebuilt ({elapsed:.1f}s)")

    # Final count
    count = await conn.fetchval("SELECT COUNT(*) FROM match_player_stats")
    mv_count = await conn.fetchval("SELECT COUNT(*) FROM mv_player_leaderboard")
    print(f"\nDone! match_player_stats: {count} rows, mv_player_leaderboard: {mv_count} players")

    await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
