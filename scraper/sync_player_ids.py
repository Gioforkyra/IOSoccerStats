"""Fetch IOSoccer internal player IDs from the player API and update players table."""
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
DB_URL = "postgresql://postgres:diodiobibo201@localhost:5432/iosoccer_stats"
PAGE_SIZE = 100


async def main():
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        page = 1
        total_updated = 0

        while True:
            try:
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

                async with pool.acquire() as conn:
                    for p in items:
                        iosoccer_id = p.get("id")
                        steam_id = p.get("steamID")
                        name = p.get("name", "")
                        rating = p.get("rating")
                        country_id = p.get("countryId")

                        if not steam_id or not iosoccer_id:
                            continue

                        try:
                            await conn.execute("""
                                UPDATE players SET iosoccer_id = $2
                                WHERE steam_id = $1 AND (iosoccer_id IS NULL OR iosoccer_id != $2)
                            """, steam_id, iosoccer_id)
                            total_updated += 1
                        except Exception:
                            pass

                total_items = data.get("totalItems", 0)
                if page % 10 == 0:
                    print(f"  Page {page}: {total_updated} updated so far (total players: {total_items})")

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
        print(f"\nDone! {total_updated} players processed.")
        print(f"Players with IOSoccer ID: {with_id}/{total}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
