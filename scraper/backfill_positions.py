"""
Backfill position in match_player_stats by reading matchPeriodData from GET /api/match/{id}.
Position lives in matchData.players[].matchPeriodData[].info.position, not in player-statistics.
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


def extract_positions_from_match(raw: dict) -> dict[tuple[str, str], str]:
    """
    Returns {(steamId64, side): position} from GET /api/match/{id} response.
    Uses the period with the longest playtime as the player's primary position.
    """
    ms = raw.get("matchStatistics") or {}
    md = ms.get("matchData") or {}
    result: dict[tuple[str, str], str] = {}

    for rp in (md.get("players") or []):
        pi = rp.get("info") or {}
        sid64 = pi.get("steamId64")
        if not sid64:
            continue

        best_pos: dict[str, str] = {}  # side -> position (longest period)
        best_dur: dict[str, int] = {}  # side -> duration

        for period in (rp.get("matchPeriodData") or []):
            pinfo = period.get("info") or {}
            pos = pinfo.get("position")
            side = pinfo.get("team")
            if not pos or not side:
                continue
            duration = (pinfo.get("endSecond") or 0) - (pinfo.get("startSecond") or 0)
            if duration > best_dur.get(side, -1):
                best_dur[side] = duration
                best_pos[side] = pos

        for side, pos in best_pos.items():
            result[(sid64, side)] = pos

    return result


async def process_match(
    client: httpx.AsyncClient,
    pool: asyncpg.Pool,
    match_id: int,
    sem: asyncio.Semaphore,
) -> int:
    async with sem:
        try:
            resp = await client.get(
                f"{API_BASE}/match/{match_id}", headers=HEADERS, timeout=15
            )
            if resp.status_code != 200:
                return 0
            pos_lookup = extract_positions_from_match(resp.json())
        except Exception:
            return 0

        if not pos_lookup:
            return 0

        updates = [
            (pos, match_id, sid64, side)
            for (sid64, side), pos in pos_lookup.items()
        ]

        async with pool.acquire() as conn:
            await conn.executemany(
                """UPDATE match_player_stats
                   SET position = $1
                   WHERE match_id = $2 AND player_steam_id = $3 AND team_side = $4
                     AND position IS NULL""",
                updates,
            )
        return len(updates)


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

    rows = await pool.fetch(
        """SELECT DISTINCT match_id FROM match_player_stats
           WHERE position IS NULL
           ORDER BY match_id DESC"""
    )
    match_ids = [r["match_id"] for r in rows]
    print(f"Matches with null positions: {len(match_ids)}")

    if not match_ids:
        print("Nothing to do.")
        await pool.close()
        return

    sem = asyncio.Semaphore(CONCURRENCY)
    total_updated = 0

    async with httpx.AsyncClient(timeout=15) as client:
        tasks = [process_match(client, pool, mid, sem) for mid in match_ids]
        results = await asyncio.gather(*tasks)
        total_updated = sum(results)

    # Report remaining nulls
    remaining = await pool.fetchval(
        "SELECT COUNT(*) FROM match_player_stats WHERE position IS NULL"
    )
    print(f"Total positions updated: {total_updated}")
    print(f"Remaining null positions: {remaining}")
    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
