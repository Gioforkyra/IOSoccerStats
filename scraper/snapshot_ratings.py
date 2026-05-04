"""Fetch fresh player ratings from the IOSoccer API and snapshot them.

Rationale: the paginated /api/player listing silently skips many players
(e.g. iosoccerID=6 / aryan is missing from page 1 even though /api/player/6
returns him). Relying on the listing produces stale ratings.

This script iterates each iosoccer_id we have in our DB and calls
/api/player/{id} directly — same endpoint as the official player-profile page —
so we always pick up the current value. It also stays idempotent: re-running
on the same UTC day deletes that day's existing rows before inserting fresh.
"""
import asyncio
import os
import sys
from datetime import datetime

import asyncpg
import httpx
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


async def fetch_one(client: httpx.AsyncClient, iosoccer_id: int) -> tuple[int, str | None, float | None]:
    try:
        r = await client.get(f"{API_BASE}/player/{iosoccer_id}", timeout=15)
        if r.status_code != 200:
            return iosoccer_id, None, None
        data = r.json()
        return iosoccer_id, data.get("steamID"), data.get("rating")
    except Exception:
        return iosoccer_id, None, None


async def main():
    snapshot_at = datetime.utcnow()
    print(f"Snapshot timestamp: {snapshot_at.isoformat()} (naive UTC)")

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            "SELECT steam_id, iosoccer_id FROM players WHERE iosoccer_id IS NOT NULL"
        )
        print(f"DB has {len(rows)} players with iosoccer_id")
        # iosoccer_id -> our steam_id (so we can detect any mismatch)
        iso_to_steam = {r["iosoccer_id"]: r["steam_id"] for r in rows}
        ids = list(iso_to_steam.keys())
    finally:
        await conn.close()

    print(f"Step 1: Fetching {len(ids)} players from /api/player/{{id}}...")
    sem = asyncio.Semaphore(CONCURRENCY)

    async def bounded(client, iid):
        async with sem:
            res = await fetch_one(client, iid)
            await asyncio.sleep(0.02)
            return res

    results: list[tuple[int, str | None, float | None]] = []
    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        tasks = [bounded(client, iid) for iid in ids]
        for i, fut in enumerate(asyncio.as_completed(tasks), 1):
            results.append(await fut)
            if i % 250 == 0 or i == len(tasks):
                print(f"  {i}/{len(tasks)} fetched")

    # Build write rows. Trust DB steam_id as source of truth, but log mismatches.
    update_rows: list[tuple[str, float]] = []
    history_rows: list[tuple[str, float, datetime]] = []
    not_found = 0
    mismatches = 0
    for iid, api_steam, rating in results:
        if api_steam is None or rating is None:
            not_found += 1
            continue
        db_steam = iso_to_steam.get(iid)
        if db_steam is None:
            continue
        if db_steam != api_steam:
            mismatches += 1
            # API steamID has changed for this iosoccer_id — skip to avoid corrupting our row
            continue
        update_rows.append((db_steam, float(rating)))
        if rating > 0:
            history_rows.append((db_steam, float(rating), snapshot_at))

    print(
        f"\nFetch summary: usable {len(update_rows)} | rating>0 {len(history_rows)} | "
        f"not found/no rating {not_found} | steamID mismatch {mismatches}"
    )

    if not update_rows:
        print("No usable rows — aborting writes.")
        return

    print("\nStep 2: Writing to DB...")
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        async with conn.transaction():
            # Make today's snapshot idempotent
            deleted = await conn.execute(
                "DELETE FROM player_rating_history WHERE recorded_at::date = $1::date",
                snapshot_at.date(),
            )
            print(f"  Cleared today's history rows: {deleted}")

            await conn.executemany(
                "UPDATE players SET rating = $2 WHERE steam_id = $1",
                update_rows,
            )
            await conn.executemany(
                "INSERT INTO player_rating_history (steam_id, rating, recorded_at) VALUES ($1, $2, $3)",
                history_rows,
            )

        period_row = await conn.fetchrow(
            """
            SELECT TO_CHAR(DATE_TRUNC('month', recorded_at), 'YYYY-MM') AS period,
                   COUNT(*) AS n
            FROM player_rating_history
            WHERE recorded_at::date = $1::date
            GROUP BY DATE_TRUNC('month', recorded_at)
            """,
            snapshot_at.date(),
        )
        print(f"\nDone! players.rating updated: {len(update_rows)}")
        print(f"player_rating_history rows inserted: {len(history_rows)}")
        if period_row:
            print(f"Snapshot period {period_row['period']}: {period_row['n']} rows for today")
    finally:
        await conn.close()


if __name__ == "__main__":
    if not DATABASE_URL:
        print("DATABASE_URL not set", file=sys.stderr)
        sys.exit(1)
    asyncio.run(main())
