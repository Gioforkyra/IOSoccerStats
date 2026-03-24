"""
Scraper that saves raw API responses to local JSON files.
No database needed — saves one JSON file per batch of matches.

Usage:
    python scrape_local.py                    # Resume from last saved ID
    python scrape_local.py --from 183557      # Start from specific ID
    python scrape_local.py --workers 20       # Concurrent requests
"""
import asyncio
import argparse
import json
import os
import time
from datetime import datetime
import httpx

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
MAX_MATCH_ID = 231325
BATCH_DELAY = 0.3
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data_export", "raw_matches")
STATE_FILE = os.path.join(os.path.dirname(__file__), "..", "data_export", "scraper_local_state.json")
# Save a batch file every N matches
BATCH_SIZE = 500
MAX_EMPTY_BATCHES = 200


def load_state() -> int:
    """Load last scraped match ID from state file."""
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f:
            return json.load(f).get("last_id", 0)
    return 0


def save_state(last_id: int):
    with open(STATE_FILE, "w") as f:
        json.dump({"last_id": last_id, "updated": datetime.utcnow().isoformat()}, f)


async def fetch_match(client: httpx.AsyncClient, match_id: int) -> dict | None:
    try:
        resp = await client.get(f"{API_BASE}/match/{match_id}", headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            # Only keep matches with actual stats
            if data.get("matchStatistics") and data["matchStatistics"].get("matchData"):
                return data
        return None
    except Exception:
        return None


async def fetch_batch(client: httpx.AsyncClient, ids: list[int]) -> list[dict]:
    tasks = [fetch_match(client, mid) for mid in ids]
    results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


def save_batch(matches: list[dict], batch_num: int):
    """Save a batch of matches to a JSON file."""
    if not matches:
        return
    ids = [m["id"] for m in matches]
    filename = f"batch_{batch_num:05d}_{min(ids)}_{max(ids)}.json"
    filepath = os.path.join(DATA_DIR, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(matches, f, ensure_ascii=False)
    return filepath


async def run(args):
    os.makedirs(DATA_DIR, exist_ok=True)

    workers = args.workers
    start_id = args.from_id or (load_state() + 1)
    if start_id <= 1:
        start_id = 5417  # First valid match ID

    print(f"Scraping matches {start_id} -> {MAX_MATCH_ID}")
    print(f"Workers: {workers} | Saving to: {DATA_DIR}")
    print()

    total_scraped = 0
    total_failed = 0
    start_time = time.time()
    current_batch = []
    batch_num = 0
    empty_batches = 0
    last_id = start_id

    async with httpx.AsyncClient(
        timeout=15,
        limits=httpx.Limits(max_connections=workers + 5, max_keepalive_connections=workers),
    ) as client:
        current_id = start_id
        while current_id <= MAX_MATCH_ID:
            batch_ids = list(range(current_id, min(current_id + workers, MAX_MATCH_ID + 1)))
            current_id += workers

            matches = await fetch_batch(client, batch_ids)
            failed = len(batch_ids) - len(matches)

            total_scraped += len(matches)
            total_failed += failed
            current_batch.extend(matches)

            if matches:
                empty_batches = 0
                last_id = batch_ids[-1]
            else:
                empty_batches += 1

            # Save batch to disk when big enough
            if len(current_batch) >= BATCH_SIZE:
                batch_num += 1
                save_batch(current_batch, batch_num)
                save_state(last_id)
                current_batch = []

            # Progress
            if (current_id - start_id) % (workers * 10) < workers:
                elapsed = time.time() - start_time
                rate = total_scraped / elapsed if elapsed > 0 else 0
                pct = (current_id - start_id) / (MAX_MATCH_ID - start_id + 1) * 100
                eta = ((MAX_MATCH_ID - current_id) / (rate if rate else 1) / 60)
                print(
                    f"  [{current_id - 1:>7}] {pct:5.1f}% | "
                    f"{total_scraped} saved | {total_failed} skip | "
                    f"{rate:.1f}/s | ETA {eta:.0f}min"
                )

            if empty_batches >= MAX_EMPTY_BATCHES and current_id > start_id + 5000:
                print(f"\n{MAX_EMPTY_BATCHES} empty batches -- stopping.")
                break

            await asyncio.sleep(BATCH_DELAY)

    # Save remaining
    if current_batch:
        batch_num += 1
        save_batch(current_batch, batch_num)
    save_state(last_id)

    elapsed = time.time() - start_time
    print(f"\nDone in {elapsed / 60:.1f}min")
    print(f"  Saved: {total_scraped} matches in {batch_num} files")
    print(f"  Skipped: {total_failed}")
    print(f"  Last ID: {last_id}")


def main():
    global BATCH_DELAY
    parser = argparse.ArgumentParser(description="IOSoccer Local Scraper")
    parser.add_argument("--from", dest="from_id", type=int, help="Start from match ID")
    parser.add_argument("--workers", type=int, default=20, help="Concurrent requests")
    parser.add_argument("--delay", type=float, default=BATCH_DELAY, help="Batch delay")
    args = parser.parse_args()
    BATCH_DELAY = args.delay
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
