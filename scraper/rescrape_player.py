"""
Rescrape all matches for a specific player, then print aggregated stats
to compare with iosoccer.com.

Usage:
    python rescrape_player.py 196
"""
import asyncio
import sys
import os
import time
import httpx
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

from scraper import scrape_match as api_scrape_match
from db import get_pool, upsert_team, upsert_player, insert_match, insert_player_stats

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {"Accept": "application/json", "Content-Type": "application/json",
           "Origin": "https://www.iosoccer.com", "Referer": "https://www.iosoccer.com/"}

CONCURRENCY = 10


async def get_player_match_ids(db, steam_id: str) -> list[int]:
    rows = await db.fetch(
        "SELECT DISTINCT match_id FROM match_player_stats WHERE player_steam_id = $1 ORDER BY match_id",
        steam_id
    )
    return [r["match_id"] for r in rows]


async def get_player_steam_id(db, iosoccer_id: int) -> tuple[str, str]:
    row = await db.fetchrow("SELECT steam_id, username FROM players WHERE iosoccer_id = $1", iosoccer_id)
    if not row:
        raise ValueError(f"Player iosoccer_id={iosoccer_id} not found in DB")
    return row["steam_id"], row["username"]


async def save_parsed(pool, parsed: dict):
    for side in ("home", "away"):
        team = parsed["teams"][side]
        if team["id"]:
            await upsert_team(pool, team)
    for player in parsed["players"]:
        await upsert_player(pool, player["steam_id"], player["username"], player.get("position"))
    await insert_match(pool, parsed["match"])
    await insert_player_stats(pool, parsed["player_stats"])


async def rescrape_single(client, pool, match_id: int) -> bool | None:
    try:
        parsed = await api_scrape_match(client, match_id)
        if parsed is None:
            return False
        await save_parsed(pool, parsed)
        return True
    except Exception as e:
        print(f"  [WARN] match {match_id}: {e}")
        return False


async def print_player_stats(db, steam_id: str, username: str):
    rows = await db.fetch(
        """
        SELECT
            COUNT(*) as appearances,
            SUM(goals) as goals,
            SUM(assists) as assists,
            SUM(second_assists) as second_assists,
            SUM(shots) as shots,
            SUM(shots_on_target) as shots_on_target,
            SUM(passes) as passes,
            SUM(passes_completed) as passes_completed,
            SUM(key_passes) as key_passes,
            SUM(chances_created) as chances_created,
            SUM(saves) as saves,
            SUM(interceptions) as interceptions,
            SUM(fouls) as fouls,
            SUM(yellow_cards) as yellow_cards,
            SUM(red_cards) as red_cards,
            SUM(own_goals) as own_goals,
            SUM(goals_conceded) as goals_conceded,
            SUM(CASE WHEN team_side = (SELECT CASE WHEN home_score > away_score THEN 'home' WHEN away_score > home_score THEN 'away' END FROM matches WHERE id = match_id) THEN 1 ELSE 0 END) as wins
        FROM match_player_stats mps
        WHERE player_steam_id = $1
        """,
        steam_id
    )
    r = dict(rows[0])
    print(f"\n{'='*50}")
    print(f"  {username} (iosoccer.com stats — all time)")
    print(f"{'='*50}")
    print(f"  Appearances:     {r['appearances']}")
    print(f"  Goals:           {r['goals']}")
    print(f"  Assists:         {r['assists']}")
    print(f"  2nd Assists:     {r['second_assists']}")
    print(f"  Shots:           {r['shots']}")
    print(f"  Shots on Target: {r['shots_on_target']}")
    print(f"  Passes:          {r['passes']}")
    print(f"  Passes Comp:     {r['passes_completed']}")
    print(f"  Key Passes:      {r['key_passes']}")
    print(f"  Chances Created: {r['chances_created']}")
    print(f"  Saves:           {r['saves']}")
    print(f"  Interceptions:   {r['interceptions']}")
    print(f"  Fouls:           {r['fouls']}")
    print(f"  Yellow Cards:    {r['yellow_cards']}")
    print(f"  Red Cards:       {r['red_cards']}")
    print(f"  Own Goals:       {r['own_goals']}")
    print(f"  Goals Conceded:  {r['goals_conceded']}")
    print(f"{'='*50}")


async def run(iosoccer_id: int):
    pool = await get_pool()
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    steam_id, username = await get_player_steam_id(db, iosoccer_id)
    print(f"Player: {username} ({steam_id})")

    match_ids = await get_player_match_ids(db, steam_id)
    print(f"Matches in DB: {len(match_ids)}")

    print(f"\nRescraping {len(match_ids)} matches with new endpoint...")
    start = time.time()
    ok = fail = 0

    async with httpx.AsyncClient(
        timeout=15,
        limits=httpx.Limits(max_connections=CONCURRENCY + 2, max_keepalive_connections=CONCURRENCY),
    ) as client:
        for i in range(0, len(match_ids), CONCURRENCY):
            batch = match_ids[i:i + CONCURRENCY]
            results = await asyncio.gather(*[rescrape_single(client, pool, mid) for mid in batch])
            ok += sum(1 for r in results if r is True)
            fail += sum(1 for r in results if r is False)
            pct = (i + len(batch)) / len(match_ids) * 100
            elapsed = time.time() - start
            rate = ok / elapsed if elapsed > 0 else 0
            print(f"  {i+len(batch)}/{len(match_ids)} ({pct:.0f}%) | {ok} ok | {fail} fail | {rate:.1f}/s")

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s — {ok} updated, {fail} failed")

    print("\nAggregated stats from DB (compare with iosoccer.com):")
    await print_player_stats(db, steam_id, username)

    await db.close()
    await pool.close()


if __name__ == "__main__":
    pid = int(sys.argv[1]) if len(sys.argv) > 1 else 196
    asyncio.run(run(pid))
