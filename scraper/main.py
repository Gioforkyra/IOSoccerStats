"""
IOSoccerStats Scraper -- Main entry point.

Fetches match data from IOSoccer API by concurrent GET requests,
parses player stats and shot events, calculates xG,
and stores everything in PostgreSQL (Supabase).

Usage:
    python main.py                  # Resume from last scraped ID
    python main.py --test           # Scrape 5 matches to test
    python main.py --from 229800    # Start from specific ID
    python main.py --latest         # Scrape only the latest 100 IDs
    python main.py --workers 20     # Use 20 concurrent workers (default: 15)
"""
import asyncio
import argparse
import sys
import time
import httpx

from scraper import scrape_match as api_scrape_match
from db import (
    get_pool, upsert_team, upsert_player, insert_match,
    insert_player_stats, get_scraper_state,
    update_scraper_state, match_exists,
)

# Max known match ID (discovered via binary search)
MAX_MATCH_ID = 231325
# Delay between batches (seconds)
BATCH_DELAY = 0.3
# How many consecutive empty batches before we stop
# High value because there are large gaps in match IDs
MAX_EMPTY_BATCHES = 200


async def scrape_match(client: httpx.AsyncClient, pool, match_id: int) -> bool:
    """Scrape a single match. Returns True if successful."""
    parsed = await api_scrape_match(client, match_id)
    if parsed is None:
        return False

    # Upsert teams
    for side in ("home", "away"):
        team = parsed["teams"][side]
        if team["id"]:
            await upsert_team(pool, team)

    # Upsert players
    for player in parsed["players"]:
        await upsert_player(pool, player["steam_id"], player["username"], player.get("position"))

    # Insert match
    await insert_match(pool, parsed["match"])

    # Insert player stats
    await insert_player_stats(pool, parsed["player_stats"])

    return True


async def scrape_batch(client: httpx.AsyncClient, pool, ids: list[int], force: bool = False) -> tuple[int, int]:
    """Scrape a batch of match IDs concurrently. Returns (scraped, failed)."""
    tasks = []
    for mid in ids:
        tasks.append(scrape_single_safe(client, pool, mid, force))

    results = await asyncio.gather(*tasks)
    scraped = sum(1 for r in results if r is True)
    failed = sum(1 for r in results if r is False)
    return scraped, failed


async def scrape_single_safe(client: httpx.AsyncClient, pool, match_id: int, force: bool = False) -> bool | None:
    """Scrape one match, catching errors. Returns True/False/None(skipped)."""
    try:
        if not force and await match_exists(pool, match_id):
            return None  # skipped
        return await scrape_match(client, pool, match_id)
    except Exception as e:
        return False


async def run(args):
    pool = await get_pool()
    print("Connected to database.")

    workers = args.workers

    # Determine start ID
    if args.from_id:
        start_id = args.from_id
    elif args.latest:
        start_id = MAX_MATCH_ID - 100
    elif args.test:
        start_id = 229800
    else:
        start_id = await get_scraper_state(pool)
        if start_id == 0:
            start_id = 1
        else:
            start_id += 1
        print(f"Resuming from match ID {start_id}")

    end_id = start_id + 5 if args.test else MAX_MATCH_ID

    print(f"Scraping matches {start_id} -> {end_id} ({end_id - start_id + 1} IDs)")
    print(f"Concurrent workers: {workers}")
    print(f"Batch delay: {BATCH_DELAY}s")
    print()

    total_scraped = 0
    total_skipped = 0
    total_failed = 0
    start_time = time.time()
    last_successful_id = start_id
    empty_batches = 0

    async with httpx.AsyncClient(
        timeout=15,
        limits=httpx.Limits(max_connections=workers + 5, max_keepalive_connections=workers),
    ) as client:
        current_id = start_id
        while current_id <= end_id:
            # Build batch of IDs
            batch_ids = list(range(current_id, min(current_id + workers, end_id + 1)))
            current_id += workers

            scraped, failed = await scrape_batch(client, pool, batch_ids, force=args.force)
            skipped = len(batch_ids) - scraped - failed

            total_scraped += scraped
            total_skipped += skipped
            total_failed += failed

            if scraped > 0:
                last_successful_id = batch_ids[-1]
                await update_scraper_state(pool, last_successful_id)
                empty_batches = 0
            else:
                empty_batches += 1

            # Progress update every 10 batches
            if (current_id - start_id) % (workers * 10) < workers:
                elapsed = time.time() - start_time
                rate = total_scraped / elapsed if elapsed > 0 else 0
                pct = (current_id - start_id) / (end_id - start_id + 1) * 100
                print(
                    f"  [{current_id - 1:>7}] {pct:5.1f}% | "
                    f"{total_scraped} scraped | {total_skipped} skip | {total_failed} fail | "
                    f"{rate:.1f}/s | "
                    f"ETA {((end_id - current_id) / rate / 60):.0f}min"
                    if rate > 0 else
                    f"  [{current_id - 1:>7}] {pct:5.1f}% | "
                    f"{total_scraped} scraped | {total_skipped} skip | {total_failed} fail"
                )

            if args.test and total_scraped >= 5:
                break

            # Stop if too many empty batches (gap in IDs / end of data)
            if empty_batches >= MAX_EMPTY_BATCHES and current_id > start_id + 1000:
                print(f"\n{MAX_EMPTY_BATCHES} empty batches in a row -- stopping.")
                break

            await asyncio.sleep(BATCH_DELAY)

    elapsed = time.time() - start_time
    rate = total_scraped / elapsed if elapsed > 0 else 0
    print(f"\nDone in {elapsed:.1f}s ({elapsed / 60:.1f}min)")
    print(f"  Scraped: {total_scraped} ({rate:.1f}/s)")
    print(f"  Skipped: {total_skipped} (already in DB)")
    print(f"  Failed:  {total_failed} (404/500/invalid)")
    print(f"  Last ID: {last_successful_id}")

    await pool.close()


def main():
    global BATCH_DELAY

    parser = argparse.ArgumentParser(description="IOSoccerStats Scraper")
    parser.add_argument("--test", action="store_true", help="Scrape only 5 matches for testing")
    parser.add_argument("--from", dest="from_id", type=int, help="Start from this match ID")
    parser.add_argument("--latest", action="store_true", help="Scrape only the latest 100 matches")
    parser.add_argument("--workers", type=int, default=15, help="Concurrent requests (default: 15)")
    parser.add_argument("--delay", type=float, default=BATCH_DELAY, help="Delay between batches")
    parser.add_argument("--force", action="store_true", help="Re-scrape existing matches (update stats)")
    args = parser.parse_args()

    BATCH_DELAY = args.delay

    asyncio.run(run(args))


if __name__ == "__main__":
    main()
