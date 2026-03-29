"""
Backfill match_player_stats for historical matches.

Fetches all match IDs from the matches table that have NO player stats yet,
then populates match_player_stats using ON CONFLICT DO NOTHING
(existing stats are never overwritten).

Usage:
    python backfill_player_stats.py
    python backfill_player_stats.py --workers 30
    python backfill_player_stats.py --dry-run
"""
import asyncio
import argparse
import time
import os
import asyncpg
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

CONCURRENCY = 30
BATCH_DB_SIZE = 200

STAT = {
    "red_cards": 0, "yellow_cards": 1, "fouls": 2, "fouls_suffered": 3,
    "goals_conceded": 6, "shots": 7, "shots_on_target": 8,
    "passes_completed": 9, "interceptions": 10, "offsides": 11,
    "goals": 12, "own_goals": 13, "assists": 14, "passes": 15,
    "free_kicks": 16, "penalties": 17, "corners": 18, "throw_ins": 19,
    "saves": 20, "goal_kicks": 21, "possession": 22, "distance_run": 23,
    "key_passes": 25, "chances_created": 26, "second_assists": 27,
}

counters = {"fetched": 0, "inserted": 0, "no_data": 0, "errors": 0}


def safe_stat(arr, idx):
    return arr[idx] if idx < len(arr) else 0


def parse_player_stats(raw: dict) -> list[tuple]:
    ms = raw.get("matchStatistics")
    if not ms:
        return []
    md = ms.get("matchData")
    if not md:
        return []

    match_id = raw["id"]
    potm_obj = raw.get("playerOfTheMatch") or {}
    potm_steam_id = str(potm_obj.get("steamID") or "")

    rows = []
    for rp in md.get("players", []):
        info = rp.get("info", {})
        raw_id = info.get("steamId64")
        if not raw_id:
            continue
        steam_id = str(raw_id)

        periods = rp.get("matchPeriodData", [])
        if not periods:
            continue

        by_team: dict[str, dict] = {}
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
                    "is_sub": (pi.get("startSecond") or 0) > 0,
                }
            for i, v in enumerate(stats_arr):
                if i < 30:
                    by_team[side]["totals"][i] += (v or 0)

        for side, data in by_team.items():
            t = data["totals"]
            rows.append((
                match_id, steam_id, side, data["position"],
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
                steam_id == potm_steam_id,
            ))
    return rows


async def fetch_match(client: httpx.AsyncClient, sem: asyncio.Semaphore, match_id: int) -> list[tuple]:
    async with sem:
        try:
            resp = await client.get(f"{API_BASE}/match/{match_id}", timeout=20)
            if resp.status_code == 404:
                counters["no_data"] += 1
                return []
            if resp.status_code != 200:
                counters["errors"] += 1
                return []
            raw = resp.json()
            rows = parse_player_stats(raw)
            if rows:
                counters["fetched"] += 1
            else:
                counters["no_data"] += 1
            return rows
        except Exception:
            counters["errors"] += 1
            return []


async def insert_batch(conn: asyncpg.Connection, rows: list[tuple]):
    if not rows:
        return
    async with conn.transaction():
        await conn.executemany(
            """
            INSERT INTO match_player_stats (
                match_id, player_steam_id, team_side, position,
                goals, assists, second_assists, shots, shots_on_target,
                passes, passes_completed, key_passes, chances_created,
                interceptions, saves, offsides, fouls, fouls_suffered,
                yellow_cards, red_cards, own_goals, goals_conceded,
                corners, throw_ins, free_kicks, goal_kicks, penalties,
                distance_run, possession, is_substitute, is_potm
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
                      $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
            ON CONFLICT (match_id, player_steam_id, team_side) DO NOTHING
            """,
            rows,
        )
    counters["inserted"] += len(rows)


async def main(args):
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print("Connected to PostgreSQL.")

    # Only matches that have zero player stats entries
    rows = await conn.fetch("""
        SELECT m.id
        FROM matches m
        LEFT JOIN match_player_stats mps ON mps.match_id = m.id
        WHERE mps.match_id IS NULL
        ORDER BY m.id
    """)
    missing_ids = [r["id"] for r in rows]
    total = len(missing_ids)
    print(f"Matches with no player stats: {total:,}\n")

    if total == 0:
        print("Nothing to do.")
        await conn.close()
        return

    if args.dry_run:
        print(f"[dry-run] Would process {total} matches. Exiting.")
        await conn.close()
        return

    sem = asyncio.Semaphore(args.workers)
    async with httpx.AsyncClient(headers=HEADERS) as client:
        for i in range(0, total, BATCH_DB_SIZE):
            chunk_ids = missing_ids[i:i + BATCH_DB_SIZE]

            tasks = [fetch_match(client, sem, mid) for mid in chunk_ids]
            results = await asyncio.gather(*tasks)

            all_rows = [row for result in results for row in result]
            if all_rows:
                try:
                    await insert_batch(conn, all_rows)
                except Exception as e:
                    print(f"  DB error at chunk {i}: {e}")

            done = min(i + BATCH_DB_SIZE, total)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate if rate > 0 else 0
            print(
                f"  [{done:,}/{total:,}] "
                f"fetched={counters['fetched']} inserted={counters['inserted']} "
                f"no_data={counters['no_data']} errors={counters['errors']} "
                f"({rate:.0f}/s, ETA {eta/60:.1f}min)",
                flush=True,
            )

    await conn.close()
    elapsed = time.time() - start
    print(f"\nDone in {elapsed/60:.1f} minutes.")
    print(f"  Fetched:  {counters['fetched']}")
    print(f"  Inserted: {counters['inserted']} rows")
    print(f"  No data:  {counters['no_data']}")
    print(f"  Errors:   {counters['errors']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=CONCURRENCY)
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args()))
