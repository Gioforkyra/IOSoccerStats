"""Scrape player transfers from IOSoccer API and store in DB."""
import httpx
import asyncio
import asyncpg
from datetime import datetime

API = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
DB_URL = "postgresql://postgres:diodiobibo201@localhost:5432/iosoccer_stats"

REGIONS = {1: "Europe", 2: "South America", 3: "Asia", 4: "North America"}
PAGE_SIZE = 50


async def scrape_transfers_for_region(client: httpx.AsyncClient, pool: asyncpg.Pool, region_id: int, region_name: str):
    """Scrape all transfers for a region."""
    page = 1
    total_inserted = 0

    # First request to get total pages
    body = {
        "regionId": region_id,
        "page": page,
        "pageSize": PAGE_SIZE,
        "filters": {"freeAgentsOnly": False, "playerName": None, "teamName": None}
    }
    r = await client.post(f"{API}/player-team/transfers", json=body)
    data = r.json()
    total_pages = data["totalPages"]
    total_items = data["totalItems"]
    print(f"  {region_name}: {total_items} transfers, {total_pages} pages")

    while page <= total_pages:
        body["page"] = page
        try:
            r = await client.post(f"{API}/player-team/transfers", json=body)
            data = r.json()
        except Exception as e:
            print(f"  Error on page {page}: {e}")
            page += 1
            continue

        items = data.get("items", [])
        if not items:
            break

        async with pool.acquire() as conn:
            for t in items:
                player_name = t.get("playerName", "")
                from_team_id = t.get("transferFromTeamId")
                to_team_id = t.get("transferToTeamId")
                leave_date = t.get("leaveDate")
                join_date = t.get("joinDate")

                # Parse dates
                leave_dt = None
                if leave_date:
                    try:
                        leave_dt = datetime.fromisoformat(leave_date.replace("Z", "+00:00")).replace(tzinfo=None)
                    except:
                        pass

                join_dt = None
                if join_date:
                    try:
                        join_dt = datetime.fromisoformat(join_date.replace("Z", "+00:00")).replace(tzinfo=None)
                    except:
                        pass

                # Use the date that exists (join or leave)
                transfer_date = join_dt or leave_dt
                if not transfer_date:
                    continue

                # We need to find the player's steam_id from our DB by name
                # Since the API doesn't give us steam_id, we match by username
                player_row = await conn.fetchrow(
                    "SELECT steam_id FROM players WHERE LOWER(username) = LOWER($1) LIMIT 1",
                    player_name
                )
                if not player_row:
                    if page == 1:
                        print(f"    Player not found: '{player_name}'")
                    continue

                steam_id = player_row["steam_id"]

                # Determine transfer type
                if from_team_id and to_team_id:
                    transfer_type = "transfer"
                elif to_team_id and not from_team_id:
                    transfer_type = "join"
                elif from_team_id and not to_team_id:
                    transfer_type = "leave"
                else:
                    transfer_type = "unknown"

                # Insert transfer (avoid duplicates based on player+date+teams)
                try:
                    await conn.execute("""
                        INSERT INTO transfers (player_steam_id, from_team_id, to_team_id, date, type)
                        SELECT $1, $2, $3, $4, $5
                        WHERE NOT EXISTS (
                            SELECT 1 FROM transfers
                            WHERE player_steam_id = $1
                              AND COALESCE(from_team_id, 0) = COALESCE($2, 0)
                              AND COALESCE(to_team_id, 0) = COALESCE($3, 0)
                              AND date = $4
                        )
                    """, steam_id, from_team_id, to_team_id, transfer_date, transfer_type)
                    total_inserted += 1
                except Exception as e:
                    if page == 1:
                        print(f"    Insert error for {player_name}: {e}")
                    pass  # skip duplicates

        if page % 20 == 0:
            print(f"    Page {page}/{total_pages} ({total_inserted} inserted)")

        page += 1
        await asyncio.sleep(0.1)  # Rate limit

    return total_inserted


async def main():
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        total = 0
        for region_id, region_name in REGIONS.items():
            inserted = await scrape_transfers_for_region(client, pool, region_id, region_name)
            total += inserted
            print(f"  {region_name}: {inserted} transfers inserted")

    # Stats
    async with pool.acquire() as conn:
        count = await conn.fetchval("SELECT COUNT(*) FROM transfers")
        print(f"\nTotal transfers in DB: {count}")

    await pool.close()
    print(f"Done! {total} new transfers inserted.")


if __name__ == "__main__":
    asyncio.run(main())
