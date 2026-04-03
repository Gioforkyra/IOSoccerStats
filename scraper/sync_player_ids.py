"""Fetch IOSoccer player data from the hub API and upsert players table.

Updates/inserts: steam_id, iosoccer_id, username, rating, country, position.
"""
import httpx
import asyncio
import asyncpg

API = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DB_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")
PAGE_SIZE = 100
MAX_PAGES = 500

# IOSoccer position IDs to abbreviations
POSITION_MAP = {
    1: "GK", 2: "LB", 3: "CB", 4: "RB", 5: "LWB", 6: "RWB",
    7: "DMF", 8: "CMF", 9: "AMF", 10: "LMF", 11: "RMF",
    12: "LWF", 13: "RWF", 14: "SS", 15: "CF",
}


async def main():
    if not DB_URL:
        raise RuntimeError("DIRECT_URL or DATABASE_URL is required")

    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)

    timeout = httpx.Timeout(connect=10.0, read=25.0, write=20.0, pool=10.0)
    async with httpx.AsyncClient(headers=HEADERS, timeout=timeout) as client:

        page = 1
        total_updated = 0
        last_first_id = None

        while True:
            try:
                if page > MAX_PAGES:
                    print(f"Reached MAX_PAGES={MAX_PAGES}, stopping for safety")
                    break

                r = await client.post(
                    f"{API}/player",
                    json={"steamID": "", "page": page, "pageSize": PAGE_SIZE},
                    timeout=20,
                )
                if r.status_code != 200:
                    print(f"Error on page {page}: {r.status_code}")
                    break

                data = r.json()
                items = data.get("items", [])
                if not items:
                    break

                first_id = items[0].get("id")
                if first_id is not None and first_id == last_first_id:
                    print(f"Detected repeated page payload at page {page}, stopping")
                    break
                last_first_id = first_id

                async with pool.acquire() as conn:
                    for p in items:
                        iosoccer_id = p.get("id")
                        steam_id = p.get("steamID")
                        name = p.get("name")
                        rating = p.get("rating")
                        country = p.get("country")
                        position_id = p.get("preferredPositionId")

                        if not steam_id or not iosoccer_id:
                            continue

                        position = POSITION_MAP.get(position_id)

                        try:
                            await conn.execute("""
                                INSERT INTO players (steam_id, iosoccer_id, username, rating, country, position, created_at, updated_at)
                                VALUES ($1, $2, COALESCE($3, 'Unknown'), $4, $5, $6, NOW(), NOW())
                                ON CONFLICT (steam_id) DO UPDATE SET
                                    iosoccer_id = COALESCE(EXCLUDED.iosoccer_id, players.iosoccer_id),
                                    username = COALESCE(NULLIF(EXCLUDED.username, ''), players.username),
                                    rating = COALESCE(EXCLUDED.rating, players.rating),
                                    country = COALESCE(EXCLUDED.country, players.country),
                                    position = COALESCE(EXCLUDED.position, players.position),
                                    updated_at = NOW()
                            """, steam_id, iosoccer_id, name, rating, country, position)
                            total_updated += 1
                        except Exception:
                            pass

                total_items = data.get("totalItems", 0)
                total_pages = data.get("totalPages")
                print(f"  Page {page}{f'/{total_pages}' if total_pages else ''}: {total_updated} updated so far (total players: {total_items})")

                if isinstance(total_pages, int) and total_pages > 0 and page >= total_pages:
                    break

                if len(items) < PAGE_SIZE:
                    break

                page += 1
                await asyncio.sleep(0.1)

            except Exception as e:
                print(f"Error on page {page}: {e}")
                break

    # Stats
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM players")
        with_id = await conn.fetchval("SELECT COUNT(*) FROM players WHERE iosoccer_id IS NOT NULL")
        with_rating = await conn.fetchval("SELECT COUNT(*) FROM players WHERE rating IS NOT NULL")
        print(f"\nDone! {total_updated} players processed.")
        print(f"Players with IOSoccer ID: {with_id}/{total}")
        print(f"Players with rating: {with_rating}/{total}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
