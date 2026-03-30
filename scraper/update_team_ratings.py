"""
Update avg_rating for all teams in DB.
For each team: fetch current roster from API, exclude Loaned players (role=3),
take top 10 by rating from DB, compute average, store in teams.avg_rating.
"""
import asyncio
import os
import httpx
import asyncpg
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
LOANED_ROLE = 3
TOP_N = 10
CONCURRENCY = 20


async def fetch_roster(client: httpx.AsyncClient, team_id: int) -> list[str]:
    """Return list of non-loaned steam IDs for a team."""
    try:
        resp = await client.post(
            f"{API_BASE}/player-team/team",
            json={"id": team_id, "includeInactive": False},
            timeout=10,
        )
        if resp.status_code != 200:
            return []
        entries = resp.json()
        return [
            e["player"]["steamID"]
            for e in entries
            if isinstance(e, dict)
            and e.get("teamRole") != LOANED_ROLE
            and e.get("player", {}).get("steamID")
        ]
    except Exception:
        return []


async def process_team(
    sem: asyncio.Semaphore,
    client: httpx.AsyncClient,
    pool: asyncpg.Pool,
    team_id: int,
) -> tuple[int, float | None]:
    async with sem:
        steam_ids = await fetch_roster(client, team_id)
        avg = None
        if steam_ids:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT rating FROM players
                    WHERE steam_id = ANY($1) AND rating IS NOT NULL AND rating > 0
                    ORDER BY rating DESC LIMIT $2
                    """,
                    steam_ids,
                    TOP_N,
                )
            if rows:
                ratings = [r["rating"] for r in rows]
                avg = sum(ratings) / len(ratings)

        async with pool.acquire() as conn:
            await conn.execute(
                "UPDATE teams SET avg_rating = $1 WHERE id = $2",
                avg,
                team_id,
            )
        return team_id, avg


async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=5, max_size=CONCURRENCY + 5)

    async with pool.acquire() as conn:
        rows = await conn.fetch("SELECT id FROM teams ORDER BY id")
    team_ids = [r["id"] for r in rows]
    print(f"Processing {len(team_ids)} teams from DB")

    async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
        sem = asyncio.Semaphore(CONCURRENCY)
        tasks = [process_team(sem, client, pool, tid) for tid in team_ids]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    updated = sum(1 for r in results if isinstance(r, tuple) and r[1] is not None)
    no_rating = sum(1 for r in results if isinstance(r, tuple) and r[1] is None)
    errs = [r for r in results if isinstance(r, Exception)]
    if errs:
        print(f"Sample errors: {errs[:3]}")

    await pool.close()
    print(f"Done. Updated: {updated}, No rating data: {no_rating}, Errors: {len(errs)}")


if __name__ == "__main__":
    asyncio.run(main())
