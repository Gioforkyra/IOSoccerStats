"""
Backfill position in match_player_stats by re-fetching player stats from the API
for matches where position is null.
"""
import asyncio
import asyncpg
import httpx
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
CONCURRENCY = 20


async def fetch_player_stats(client: httpx.AsyncClient, match_id: int) -> list:
    try:
        resp = await client.post(
            f"{API_BASE}/player-statistics/matches",
            json={"matchId": match_id},
            headers=HEADERS,
            timeout=15,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data if isinstance(data, list) else data.get("items", [])
    except Exception:
        pass
    return []


async def fetch_name_lookup(client: httpx.AsyncClient, match_id: int) -> dict:
    """Build (name.lower, side) -> steamId64 lookup from match detail."""
    try:
        resp = await client.get(f"{API_BASE}/match/{match_id}", headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            raw = resp.json()
            ms = raw.get("matchStatistics") or {}
            md = ms.get("matchData") or {}
            lookup = {}
            for rp in (md.get("players") or []):
                pi = rp.get("info") or {}
                sid64 = pi.get("steamId64", "")
                name = (pi.get("name") or "").lower()
                for period in (rp.get("matchPeriodData") or []):
                    side = (period.get("info") or {}).get("team", "")
                    if name and sid64 and side:
                        lookup[(name, side)] = sid64
            return lookup
    except Exception:
        pass
    return {}


def extract_position(item: dict) -> str | None:
    pos = item.get("position")
    if isinstance(pos, dict):
        return pos.get("name")
    if isinstance(pos, str) and pos:
        return pos
    return item.get("positionName")


async def process_match(client: httpx.AsyncClient, pool: asyncpg.Pool, match_id: int, sem: asyncio.Semaphore):
    async with sem:
        stat_items = await fetch_player_stats(client, match_id)
        if not stat_items:
            return 0

        lookup = await fetch_name_lookup(client, match_id)
        if not lookup:
            return 0

        updates = []
        for item in stat_items:
            side = "home" if item.get("matchTeamType") == 1 else "away"
            nick = (item.get("nickname") or "").lower()
            steam_id64 = lookup.get((nick, side), "")
            if not steam_id64:
                continue
            pos = extract_position(item)
            if pos:
                updates.append((pos, match_id, steam_id64, side))

        if not updates:
            return 0

        async with pool.acquire() as conn:
            await conn.executemany(
                "UPDATE match_player_stats SET position = $1 WHERE match_id = $2 AND player_steam_id = $3 AND team_side = $4",
                updates,
            )
        return len(updates)


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

    # Get all match IDs with at least one null position
    rows = await pool.fetch(
        """SELECT DISTINCT match_id FROM match_player_stats
           WHERE position IS NULL
           ORDER BY match_id DESC"""
    )
    match_ids = [r["match_id"] for r in rows]
    print(f"Matches with null positions: {len(match_ids)}")

    sem = asyncio.Semaphore(CONCURRENCY)
    total_updated = 0
    async with httpx.AsyncClient() as client:
        tasks = [process_match(client, pool, mid, sem) for mid in match_ids]
        results = await asyncio.gather(*tasks)
        total_updated = sum(results)

    print(f"Total positions updated: {total_updated}")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
