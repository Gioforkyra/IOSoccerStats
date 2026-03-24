"""Fetch all player ratings from the IOSoccer API and update database."""
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


async def main():
    # Step 1: Download all players from API into a steamID->rating map
    print("Step 1: Downloading all player ratings from API...")
    rating_map = {}  # steamID -> rating

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        page = 1
        while True:
            resp = await client.post(
                f"{API_BASE}/player",
                json={},
                params={"page": page, "pageSize": 100},
            )
            if resp.status_code != 200:
                print(f"  Page {page}: HTTP {resp.status_code}, stopping")
                break

            data = resp.json()
            items = data.get("items", [])
            total_pages = data.get("totalPages", 0)

            for p in items:
                steam_id = p.get("steamID", "")
                rating = p.get("rating")
                if steam_id and rating is not None:
                    rating_map[steam_id] = float(rating)

            print(f"  Page {page}/{total_pages} — {len(rating_map)} ratings collected")

            if page >= total_pages or not items:
                break
            page += 1
            await asyncio.sleep(0.05)

    print(f"\nCollected {len(rating_map)} ratings from API.")

    # Step 2: Batch update our database
    print("\nStep 2: Updating database...")
    conn = await asyncpg.connect(DATABASE_URL)

    # Get all our player steam_ids
    our_players = await conn.fetch("SELECT steam_id FROM players")
    print(f"  Our DB has {len(our_players)} players")

    updated = 0
    not_found = 0
    for row in our_players:
        sid = row["steam_id"]
        if sid in rating_map:
            await conn.execute(
                "UPDATE players SET rating = $1 WHERE steam_id = $2",
                rating_map[sid],
                sid,
            )
            updated += 1
        else:
            not_found += 1

    await conn.close()
    print(f"\nDone! Updated: {updated}, Not in API: {not_found}")


if __name__ == "__main__":
    asyncio.run(main())
