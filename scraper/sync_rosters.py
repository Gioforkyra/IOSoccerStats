"""Scrape team rosters from IOSoccer API to populate transfers table.

Uses POST /api/player-team/team with {id, includeInactive: true} to get
each team's full roster history including join/leave dates and steam IDs.
"""
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


def parse_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str.replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


async def scrape_team_roster(client: httpx.AsyncClient, pool: asyncpg.Pool, team_id: int) -> int:
    """Scrape roster for a single team, insert transfers. Returns count inserted."""
    try:
        r = await client.post(
            f"{API}/player-team/team",
            json={"id": team_id, "includeInactive": True},
            timeout=20,
        )
        if r.status_code != 200:
            return 0
        roster = r.json()
    except Exception:
        return 0

    if not roster:
        return 0

    inserted = 0
    async with pool.acquire() as conn:
        for entry in roster:
            player = entry.get("player")
            if not player:
                continue

            steam_id = player.get("steamID")
            if not steam_id:
                continue

            iosoccer_id = player.get("id")  # IOSoccer internal player ID
            join_date = parse_date(entry.get("joinDate"))
            leave_date = parse_date(entry.get("leaveDate"))
            is_current = entry.get("isCurrentTeam", False)
            team_role = entry.get("teamRole")  # 1=Owner,2=Manager,3=Captain,4=ViceCaptain,5=Coach,6=Player,7=Reserve,8=Loaned

            # Insert "join" transfer
            if join_date:
                try:
                    await conn.execute("""
                        INSERT INTO transfers (player_steam_id, from_team_id, to_team_id, date, type, role)
                        SELECT $1, NULL, $2, $3, 'join', $4
                        WHERE NOT EXISTS (
                            SELECT 1 FROM transfers
                            WHERE player_steam_id = $1
                              AND to_team_id = $2
                              AND date = $3
                              AND type = 'join'
                        )
                    """, steam_id, team_id, join_date, team_role)
                    inserted += 1
                except Exception:
                    pass

            # Update role on existing join transfers
            if join_date and team_role is not None:
                try:
                    await conn.execute("""
                        UPDATE transfers SET role = $4
                        WHERE player_steam_id = $1
                          AND to_team_id = $2
                          AND date = $3
                          AND type = 'join'
                          AND (role IS NULL OR role != $4)
                    """, steam_id, team_id, join_date, team_role)
                except Exception:
                    pass

            # Insert "leave" transfer (only if player has left)
            if leave_date and not is_current:
                try:
                    await conn.execute("""
                        INSERT INTO transfers (player_steam_id, from_team_id, to_team_id, date, type)
                        SELECT $1, $2, NULL, $3, 'leave'
                        WHERE NOT EXISTS (
                            SELECT 1 FROM transfers
                            WHERE player_steam_id = $1
                              AND from_team_id = $2
                              AND date = $3
                              AND type = 'leave'
                        )
                    """, steam_id, team_id, leave_date)
                    inserted += 1
                except Exception:
                    pass

            # Ensure the player exists and has iosoccer_id
            player_name = player.get("name", "")
            if steam_id and player_name:
                try:
                    await conn.execute("""
                        INSERT INTO players (steam_id, iosoccer_id, username, created_at, updated_at)
                        VALUES ($1, $2, $3, NOW(), NOW())
                        ON CONFLICT (steam_id) DO UPDATE SET
                          iosoccer_id = COALESCE(EXCLUDED.iosoccer_id, players.iosoccer_id),
                          username = EXCLUDED.username
                    """, steam_id, iosoccer_id, player_name)
                except Exception:
                    pass

    return inserted


async def main():
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)

    # Clear old transfer data that was badly scraped
    async with pool.acquire() as conn:
        old_count = await conn.fetchval("SELECT COUNT(*) FROM transfers")
        if old_count < 100:
            await conn.execute("DELETE FROM transfers")
            print(f"Cleared {old_count} old transfers")

    # Get all team IDs
    async with pool.acquire() as conn:
        teams = await conn.fetch("SELECT id, name FROM teams ORDER BY id")

    print(f"Scraping rosters for {len(teams)} teams...")

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        total_inserted = 0
        errors = 0

        for i, team in enumerate(teams):
            team_id = team["id"]
            team_name = team["name"]

            count = await scrape_team_roster(client, pool, team_id)
            total_inserted += count

            if (i + 1) % 50 == 0:
                print(f"  [{i+1}/{len(teams)}] {total_inserted} transfers inserted so far")

            await asyncio.sleep(0.12)  # Rate limit

    # Stats
    async with pool.acquire() as conn:
        total = await conn.fetchval("SELECT COUNT(*) FROM transfers")
        players_with_transfers = await conn.fetchval(
            "SELECT COUNT(DISTINCT player_steam_id) FROM transfers"
        )
        print(f"\nDone! {total_inserted} new transfer entries inserted.")
        print(f"Total transfers in DB: {total}")
        print(f"Players with transfer history: {players_with_transfers}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
