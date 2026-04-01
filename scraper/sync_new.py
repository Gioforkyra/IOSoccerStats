"""
Sync new matches from IOSoccer API.

Discovers the latest match ID from the API, compares with the last scraped
ID in the DB, and scrapes only the new matches in between.

Usage:
    python sync_new.py                  # Auto-discover and sync new matches
    python sync_new.py --workers 20     # Use 20 concurrent workers
    python sync_new.py --dry-run        # Show what would be scraped, don't write

Schedule this with:
    Windows Task Scheduler  → every 1-2 hours
    Linux cron              → 0 */2 * * * cd /path/to/scraper && python sync_new.py
"""
import asyncio
import argparse
import time
import httpx

from scraper import scrape_match as api_scrape_match
from db import (
    get_pool, upsert_team, upsert_player, insert_match,
    insert_player_stats, get_scraper_state, update_scraper_state, match_exists,
)

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

BATCH_DELAY = 0.3
MAX_EMPTY_BATCHES = 50


async def get_latest_api_match_id(client: httpx.AsyncClient) -> int:
    """Fetch the highest match ID currently available on the API."""
    resp = await client.post(
        f"{API_BASE}/match",
        headers=HEADERS,
        json={
            "page": 1,
            "pageSize": 1,
            "sortBy": "KickOff",
            "sortOrder": "DESC",
            "filters": {"includePast": True},
        },
    )
    resp.raise_for_status()
    data = resp.json()
    items = data.get("items", [])
    if not items:
        raise RuntimeError("API returned no matches")
    return int(items[0]["id"])


async def save_parsed(pool, parsed: dict) -> None:
    for side in ("home", "away"):
        team = parsed["teams"][side]
        if team["id"]:
            await upsert_team(pool, team)
    for player in parsed["players"]:
        await upsert_player(pool, player["steam_id"], player["username"], player.get("position"))
    await insert_match(pool, parsed["match"])
    await insert_player_stats(pool, parsed["player_stats"])


async def scrape_single_safe(client: httpx.AsyncClient, pool, match_id: int) -> bool | None:
    try:
        if await match_exists(pool, match_id):
            return None  # already in DB
        parsed = await api_scrape_match(client, match_id)
        if parsed is None:
            return False
        await save_parsed(pool, parsed)
        return True
    except Exception as e:
        print(f"  [WARN] match {match_id}: {e}")
        return False


async def fetch_ids_from_api_list(client: httpx.AsyncClient, pages: int = 5) -> list[int]:
    """Fetch recent match IDs from the API list endpoint (multiple pages)."""
    all_ids: set[int] = set()
    for page in range(1, pages + 1):
        try:
            resp = await client.post(
                f"{API_BASE}/match",
                headers=HEADERS,
                json={
                    "page": page,
                    "pageSize": 100,
                    "sortBy": "KickOff",
                    "sortOrder": "DESC",
                    "filters": {"includePast": True},
                },
            )
            if not resp.is_success:
                break
            data = resp.json()
            items = data.get("items", [])
            if not items:
                break
            for item in items:
                if isinstance(item.get("id"), int):
                    all_ids.add(item["id"])
        except Exception as e:
            print(f"  [WARN] API list page {page}: {e}")
            break
    # Also fetch competitive matches
    try:
        resp = await client.post(
            f"{API_BASE}/match",
            headers=HEADERS,
            json={
                "page": 1,
                "pageSize": 100,
                "sortBy": "KickOff",
                "sortOrder": "DESC",
                "filters": {"includePast": True, "matchType": 2},
            },
        )
        if resp.is_success:
            for item in resp.json().get("items", []):
                if isinstance(item.get("id"), int):
                    all_ids.add(item["id"])
    except Exception:
        pass
    return sorted(all_ids, reverse=True)


async def run_from_api(args, pool, client: httpx.AsyncClient):
    """Fetch recent match IDs from API list and insert any that are missing from DB."""
    print("Fetching recent match IDs from API list...")
    ids = await fetch_ids_from_api_list(client, pages=args.pages)
    print(f"  Found {len(ids)} match IDs from API")

    missing = [mid for mid in ids if not await match_exists(pool, mid)]
    print(f"  Missing from DB: {len(missing)}")

    if not missing:
        print("Nothing to scrape.")
        return

    if args.dry_run:
        print(f"[dry-run] Would scrape: {missing}")
        return

    total_scraped = total_failed = 0
    for i in range(0, len(missing), args.workers):
        batch = missing[i:i + args.workers]
        tasks = [scrape_single_safe(client, pool, mid) for mid in batch]
        results = await asyncio.gather(*tasks)
        scraped = sum(1 for r in results if r is True)
        failed = sum(1 for r in results if r is False)
        total_scraped += scraped
        total_failed += failed
        print(f"  batch {batch[0]}..{batch[-1]}: {scraped} new, {failed} fail")
        await asyncio.sleep(BATCH_DELAY)

    print(f"\nDone. New: {total_scraped}, Failed: {total_failed}")


async def run(args):
    pool = await get_pool()
    print("Connected to database.")

    async with httpx.AsyncClient(
        timeout=15,
        limits=httpx.Limits(max_connections=args.workers + 5, max_keepalive_connections=args.workers),
    ) as client:

        if args.from_api:
            await run_from_api(args, pool, client)
            await pool.close()
            return

        print("Discovering latest match ID from API...")
        latest_api_id = await get_latest_api_match_id(client)
        print(f"  Latest API match ID: {latest_api_id}")

        last_db_id = await get_scraper_state(pool)
        print(f"  Last DB match ID:    {last_db_id}")

        if latest_api_id <= last_db_id:
            print("Already up to date. Nothing to scrape.")
            await pool.close()
            return

        start_id = last_db_id + 1
        end_id = latest_api_id
        total_to_check = end_id - start_id + 1
        print(f"\nScraping {total_to_check} match IDs: {start_id} → {end_id}")

        if args.dry_run:
            print("[dry-run] Exiting without scraping.")
            await pool.close()
            return

        total_scraped = total_skipped = total_failed = 0
        empty_batches = 0
        start_time = time.time()
        last_successful_id = last_db_id

        current_id = start_id
        while current_id <= end_id:
            batch_ids = list(range(current_id, min(current_id + args.workers, end_id + 1)))
            current_id += args.workers

            tasks = [scrape_single_safe(client, pool, mid) for mid in batch_ids]
            results = await asyncio.gather(*tasks)

            scraped = sum(1 for r in results if r is True)
            failed = sum(1 for r in results if r is False)
            skipped = sum(1 for r in results if r is None)

            total_scraped += scraped
            total_failed += failed
            total_skipped += skipped

            if scraped > 0:
                last_successful_id = batch_ids[-1]
                await update_scraper_state(pool, last_successful_id)
                empty_batches = 0
            else:
                empty_batches += 1

            elapsed = time.time() - start_time
            pct = (current_id - start_id) / total_to_check * 100
            rate = total_scraped / elapsed if elapsed > 0 else 0
            print(
                f"  [{batch_ids[-1]:>7}] {pct:5.1f}% | "
                f"{total_scraped} new | {total_skipped} skip | {total_failed} fail | "
                f"{rate:.1f}/s"
            )

            if empty_batches >= MAX_EMPTY_BATCHES:
                empty_batches = 0  # keep going through gaps until end_id

            await asyncio.sleep(BATCH_DELAY)

        elapsed = time.time() - start_time
        print(f"\nDone in {elapsed:.1f}s")
        print(f"  New matches scraped: {total_scraped}")
        print(f"  Skipped (existing):  {total_skipped}")
        print(f"  Failed (404/error):  {total_failed}")

    await pool.close()


def main():
    parser = argparse.ArgumentParser(description="Sync new IOSoccer matches from API")
    parser.add_argument("--workers", type=int, default=15, help="Concurrent requests (default: 15)")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be scraped without writing")
    parser.add_argument("--from-api", action="store_true", help="Fetch missing matches from API list instead of sequential ID probe")
    parser.add_argument("--pages", type=int, default=5, help="Number of API list pages to fetch in --from-api mode (default: 5)")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
