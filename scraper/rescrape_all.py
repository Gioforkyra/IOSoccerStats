"""
Re-scrape ALL old matches from the IOSoccer API and UPSERT correct stats.
Handles shared GK (player on both teams) by splitting periods by team_side.
"""
import asyncio
import asyncpg
import httpx
import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

# Correct stat index mapping
STAT = {
    "red_cards": 0, "yellow_cards": 1, "fouls": 2, "fouls_suffered": 3,
    "goals_conceded": 6, "shots": 7, "shots_on_target": 8,
    "passes_completed": 9, "interceptions": 10, "offsides": 11,
    "goals": 12, "own_goals": 13, "assists": 14, "passes": 15,
    "free_kicks": 16, "penalties": 17, "corners": 18, "throw_ins": 19,
    "saves": 20, "goal_kicks": 21, "possession": 22, "distance_run": 23,
    "key_passes": 25, "chances_created": 26, "second_assists": 27,
}

CONCURRENCY = 15
BATCH_DB_SIZE = 200  # upsert every N matches

# Progress tracking
stats = {
    "fetched": 0, "updated": 0, "no_data": 0, "errors": 0, "skipped": 0,
}


def safe_stat(arr, idx):
    return arr[idx] if idx < len(arr) else 0


def parse_player_stats(raw):
    """Parse match API response into player stat rows, split by team_side."""
    ms = raw.get("matchStatistics")
    if not ms:
        return []
    md = ms.get("matchData")
    if not md:
        return []

    match_id = raw["id"]
    potm_obj = raw.get("playerOfTheMatch") or {}
    potm_steam_id = potm_obj.get("steamID")

    rows = []
    for rp in md.get("players", []):
        info = rp.get("info", {})
        raw_id = info.get("steamId64")
        if not raw_id:
            continue
        steam_id64 = str(raw_id)

        periods = rp.get("matchPeriodData", [])
        if not periods:
            continue

        # Group periods by team_side (handles shared GK)
        by_team = {}
        for period in periods:
            pi = period.get("info", {})
            side = pi.get("team", "")
            if not side:
                continue
            stats_arr = period.get("statistics", [])

            if side not in by_team:
                by_team[side] = {
                    "totals": [0] * 30,
                    "position": pi.get("position"),
                    "is_sub": (pi.get("startSecond", 0) or 0) > 0,
                }
            for i, v in enumerate(stats_arr):
                if i < 30:
                    by_team[side]["totals"][i] += (v or 0)

        for side, data in by_team.items():
            t = data["totals"]
            rows.append((
                match_id, steam_id64, side, data["position"],
                safe_stat(t, STAT["goals"]),
                safe_stat(t, STAT["assists"]),
                safe_stat(t, STAT["second_assists"]),
                safe_stat(t, STAT["shots"]),
                safe_stat(t, STAT["shots_on_target"]),
                safe_stat(t, STAT["passes"]),
                safe_stat(t, STAT["passes_completed"]),
                safe_stat(t, STAT["key_passes"]),
                safe_stat(t, STAT["chances_created"]),
                safe_stat(t, STAT["interceptions"]),
                safe_stat(t, STAT["saves"]),
                safe_stat(t, STAT["offsides"]),
                safe_stat(t, STAT["fouls"]),
                safe_stat(t, STAT["fouls_suffered"]),
                safe_stat(t, STAT["yellow_cards"]),
                safe_stat(t, STAT["red_cards"]),
                safe_stat(t, STAT["own_goals"]),
                safe_stat(t, STAT["goals_conceded"]),
                safe_stat(t, STAT["corners"]),
                safe_stat(t, STAT["throw_ins"]),
                safe_stat(t, STAT["free_kicks"]),
                safe_stat(t, STAT["goal_kicks"]),
                safe_stat(t, STAT["penalties"]),
                safe_stat(t, STAT["distance_run"]),
                safe_stat(t, STAT["possession"]),
                data["is_sub"],
                steam_id64 == potm_steam_id,
            ))

    return rows


async def fetch_and_parse(client, sem, match_id):
    """Fetch a single match from API and return parsed rows."""
    async with sem:
        try:
            resp = await client.get(f"{API_BASE}/match/{match_id}", timeout=20)
            if resp.status_code == 404:
                stats["no_data"] += 1
                return []
            if resp.status_code != 200:
                stats["errors"] += 1
                return []
            raw = resp.json()
            rows = parse_player_stats(raw)
            if rows:
                stats["fetched"] += 1
            else:
                stats["no_data"] += 1
            return rows
        except Exception:
            stats["errors"] += 1
            return []


async def upsert_batch(conn, all_rows):
    """Upsert a batch of player stat rows."""
    if not all_rows:
        return
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
        all_rows,
    )
    stats["updated"] += len(all_rows)


async def main():
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print("Connected to PostgreSQL.")

    # Get all match IDs that need rescraping (new range only - old range already done)
    rows = await conn.fetch("SELECT id FROM matches WHERE id >= 183557 ORDER BY id")
    match_ids = [r["id"] for r in rows]
    total = len(match_ids)
    print(f"Matches to rescrape: {total:,}\n")

    sem = asyncio.Semaphore(CONCURRENCY)
    async with httpx.AsyncClient(headers=HEADERS, http2=False) as client:
        # Process in chunks
        chunk_size = BATCH_DB_SIZE
        for i in range(0, total, chunk_size):
            chunk = match_ids[i:i + chunk_size]

            # Fetch all matches in chunk concurrently
            tasks = [fetch_and_parse(client, sem, mid) for mid in chunk]
            results = await asyncio.gather(*tasks)

            # Flatten and upsert
            all_rows = []
            for r in results:
                all_rows.extend(r)

            if all_rows:
                try:
                    await upsert_batch(conn, all_rows)
                except Exception as e:
                    print(f"  DB error at chunk {i}: {e}")

            # Progress
            done = min(i + chunk_size, total)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate if rate > 0 else 0
            print(
                f"  [{done:,}/{total:,}] "
                f"fetched={stats['fetched']} no_data={stats['no_data']} "
                f"errors={stats['errors']} upserted={stats['updated']} "
                f"({rate:.0f}/s, ETA {eta/60:.1f}min)",
                flush=True,
            )

    await conn.close()
    elapsed = time.time() - start
    print(f"\nDone in {elapsed/60:.1f} minutes.")
    print(f"  Fetched: {stats['fetched']}")
    print(f"  No data: {stats['no_data']}")
    print(f"  Errors:  {stats['errors']}")
    print(f"  Upserted rows: {stats['updated']}")


if __name__ == "__main__":
    asyncio.run(main())
