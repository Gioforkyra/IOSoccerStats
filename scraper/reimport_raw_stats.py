"""Re-import raw match files with UPSERT to overwrite old bad stats."""
import asyncio
import asyncpg
import json
import os
import glob
import time
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")
RAW_DIR = os.path.join(os.path.dirname(__file__), "..", "data_export", "raw_matches")

# Import from scraper modules for parsing raw matches
from scraper import parse_match


async def main():
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print(f"Connected to PostgreSQL.\n")

    batch_files = sorted(glob.glob(os.path.join(RAW_DIR, "batch_*.json")))
    if not batch_files:
        print("No raw match files found.")
        return

    print(f"Re-importing {len(batch_files)} raw match batch files with UPSERT...")
    total_stats = 0

    for bf in batch_files:
        with open(bf, "r", encoding="utf-8") as f:
            raw_matches = json.load(f)

        batch_stats = 0
        for raw in raw_matches:
            parsed = parse_match(raw)
            if not parsed or not parsed["player_stats"]:
                continue

            try:
                await conn.executemany(
                    """INSERT INTO match_player_stats (
                        match_id, player_steam_id, team_side, position,
                        goals, assists, second_assists, shots, shots_on_target,
                        passes, passes_completed, key_passes, chances_created,
                        interceptions, saves, offsides, fouls, fouls_suffered,
                        yellow_cards, red_cards, own_goals, goals_conceded,
                        corners, throw_ins, free_kicks, goal_kicks, penalties,
                        distance_run, possession, is_substitute, is_potm
                    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
                    ON CONFLICT (match_id, player_steam_id, team_side) DO UPDATE SET
                        position = EXCLUDED.position,
                        goals = EXCLUDED.goals, assists = EXCLUDED.assists,
                        second_assists = EXCLUDED.second_assists,
                        shots = EXCLUDED.shots, shots_on_target = EXCLUDED.shots_on_target,
                        passes = EXCLUDED.passes, passes_completed = EXCLUDED.passes_completed,
                        key_passes = EXCLUDED.key_passes, chances_created = EXCLUDED.chances_created,
                        interceptions = EXCLUDED.interceptions, saves = EXCLUDED.saves,
                        offsides = EXCLUDED.offsides, fouls = EXCLUDED.fouls,
                        fouls_suffered = EXCLUDED.fouls_suffered,
                        yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
                        own_goals = EXCLUDED.own_goals, goals_conceded = EXCLUDED.goals_conceded,
                        corners = EXCLUDED.corners, throw_ins = EXCLUDED.throw_ins,
                        free_kicks = EXCLUDED.free_kicks, goal_kicks = EXCLUDED.goal_kicks,
                        penalties = EXCLUDED.penalties,
                        distance_run = EXCLUDED.distance_run, possession = EXCLUDED.possession,
                        is_substitute = EXCLUDED.is_substitute, is_potm = EXCLUDED.is_potm
                    """,
                    [(
                        s["match_id"], s["player_steam_id"], s["team_side"], s.get("position"),
                        s["goals"], s["assists"], s.get("second_assists", 0),
                        s["shots"], s["shots_on_target"],
                        s["passes"], s["passes_completed"],
                        s.get("key_passes", 0), s.get("chances_created", 0),
                        s["interceptions"], s["saves"], s.get("offsides", 0),
                        s["fouls"], s.get("fouls_suffered", 0),
                        s["yellow_cards"], s["red_cards"],
                        s.get("own_goals", 0), s.get("goals_conceded", 0),
                        s.get("corners", 0), s.get("throw_ins", 0),
                        s.get("free_kicks", 0), s.get("goal_kicks", 0), s.get("penalties", 0),
                        s.get("distance_run", 0), s["possession"],
                        s.get("is_substitute", False), s.get("is_potm", False),
                    ) for s in parsed["player_stats"]]
                )
                batch_stats += len(parsed["player_stats"])
            except Exception as e:
                print(f"  Error: {e}")

        total_stats += batch_stats
        print(f"  {os.path.basename(bf)}: {batch_stats} stats upserted")

    await conn.close()
    elapsed = time.time() - start
    print(f"\nDone. {total_stats} player stats upserted in {elapsed:.1f}s.")


if __name__ == "__main__":
    asyncio.run(main())
