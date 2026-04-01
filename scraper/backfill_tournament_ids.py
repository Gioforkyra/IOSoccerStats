"""
Backfill tournament_id on existing matches that have tournament_id = NULL.

For each tournament in the DB, fetches all its matches from the API list endpoint
(much faster than fetching each match individually) and sets tournament_id in bulk.

Usage:
    python backfill_tournament_ids.py
    python backfill_tournament_ids.py --workers 10
    python backfill_tournament_ids.py --dry-run
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
    "Content-Type": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

PAGE_SIZE = 200
counters = {"tournaments": 0, "matches_updated": 0, "errors": 0}


async def fetch_tournament_match_ids(client: httpx.AsyncClient, sem: asyncio.Semaphore, tournament_id: int) -> list[int]:
    """Fetch all match IDs for a tournament by paginating the match list endpoint."""
    ids = []
    page = 1
    while True:
        async with sem:
            try:
                resp = await client.post(
                    f"{API_BASE}/match",
                    json={
                        "page": page,
                        "pageSize": PAGE_SIZE,
                        "sortBy": "KickOff",
                        "sortOrder": "DESC",
                        "filters": {
                            "includePast": True,
                            "tournamentId": tournament_id,
                        },
                    },
                    timeout=30,
                )
                if resp.status_code != 200:
                    counters["errors"] += 1
                    break
                data = resp.json()
                items = data.get("items", [])
                ids.extend(item["id"] for item in items)
                if page >= data.get("totalPages", 1):
                    break
                page += 1
            except Exception as e:
                counters["errors"] += 1
                break
    return ids


async def main(args):
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print("Connected to PostgreSQL.")

    # Get all tournaments that have at least one match in the DB with NULL tournament_id
    rows = await conn.fetch("""
        SELECT DISTINCT t.id
        FROM tournaments t
        JOIN matches m ON (m.home_team_id IN (
                SELECT team_id FROM tournament_standings WHERE tournament_id = t.id
            ) OR m.away_team_id IN (
                SELECT team_id FROM tournament_standings WHERE tournament_id = t.id
            ))
        WHERE m.tournament_id IS NULL
        ORDER BY t.id DESC
    """)

    # Simpler fallback: just get all tournaments
    if not rows:
        rows = await conn.fetch("SELECT id FROM tournaments ORDER BY id DESC")

    tournament_ids = [r["id"] for r in rows]
    total = len(tournament_ids)
    print(f"Tournaments to process: {total}\n")

    if args.dry_run:
        print(f"[dry-run] Would process {total} tournaments. Exiting.")
        await conn.close()
        return

    sem = asyncio.Semaphore(args.workers)
    async with httpx.AsyncClient(headers=HEADERS) as client:
        for i, tid in enumerate(tournament_ids):
            match_ids = await fetch_tournament_match_ids(client, sem, tid)
            if match_ids:
                result = await conn.execute(
                    "UPDATE matches SET tournament_id = $1 WHERE id = ANY($2) AND tournament_id IS NULL",
                    tid,
                    match_ids,
                )
                updated = int(result.split()[-1])
                counters["matches_updated"] += updated
                if updated > 0:
                    print(f"  Tournament {tid}: {len(match_ids)} API matches → {updated} DB rows updated")

            counters["tournaments"] += 1
            if (i + 1) % 20 == 0:
                elapsed = time.time() - start
                print(f"  [{i+1}/{total}] {counters['matches_updated']} matches updated so far ({elapsed:.0f}s)")

            await asyncio.sleep(0.1)

    await conn.close()
    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")
    print(f"  Tournaments processed : {counters['tournaments']}")
    print(f"  Matches updated       : {counters['matches_updated']}")
    print(f"  Errors                : {counters['errors']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args()))
