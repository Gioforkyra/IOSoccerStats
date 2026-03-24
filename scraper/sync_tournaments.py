"""Scrape tournament data from IOSoccer API."""
import httpx
import asyncio
import asyncpg
from datetime import datetime

API = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
DB_URL = "postgresql://postgres:diodiobibo201@localhost:5432/iosoccer_stats"

# Tournament types from JS: League=0, Knockout=1, GroupKnockout=2, Custom=10
TOURNAMENT_TYPES = {0: "league", 1: "knockout", 2: "group_knockout", 10: "custom"}
# Team types: Club=1, National=2, Mix=3, Draft=4
TEAM_TYPES = {1: "club", 2: "national", 3: "mix", 4: "draft"}


async def main():
    pool = await asyncpg.create_pool(DB_URL, min_size=2, max_size=5)

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        # Fetch past + current tournaments
        print("Fetching past tournaments...")
        r_past = await client.get(f"{API}/tournaments/past")
        past = r_past.json()
        print(f"  Found {len(past)} past tournaments")

        print("Fetching current tournaments...")
        r_current = await client.get(f"{API}/tournaments/current")
        current = r_current.json()
        print(f"  Found {len(current)} current tournaments")

        all_tournaments = past + current
        print(f"Total: {len(all_tournaments)} tournaments")

        async with pool.acquire() as conn:
            # First, ensure we have the right schema
            # Update tournaments table with new fields
            await conn.execute("""
                ALTER TABLE tournaments
                ADD COLUMN IF NOT EXISTS organisation TEXT,
                ADD COLUMN IF NOT EXISTS tournament_format TEXT,
                ADD COLUMN IF NOT EXISTS team_type_id INT,
                ADD COLUMN IF NOT EXISTS match_format INT,
                ADD COLUMN IF NOT EXISTS winning_team_id INT
            """)

            for t in all_tournaments:
                tid = t["id"]
                name = t["name"]
                series = t.get("tournamentSeries")
                org_name = series["organisation"]["acronym"] if series and series.get("organisation") else None
                ttype = TOURNAMENT_TYPES.get(t.get("tournamentType"), "unknown")
                team_type_id = t.get("teamType")
                match_format = t.get("format")
                start_date = None
                if t.get("startDate"):
                    try:
                        start_date = datetime.fromisoformat(t["startDate"].replace("Z", "+00:00")).replace(tzinfo=None)
                    except:
                        pass
                end_date = None
                if t.get("endDate"):
                    try:
                        end_date = datetime.fromisoformat(t["endDate"].replace("Z", "+00:00")).replace(tzinfo=None)
                    except:
                        pass

                winning_team_id = t.get("winningTeamId")
                has_ended = t.get("hasEnded", False)
                status = "completed" if has_ended else "active"
                region = "Europe"  # All tournaments seem to be from the EU hub

                await conn.execute("""
                    INSERT INTO tournaments (id, name, type, region, start_date, end_date, status,
                                            organisation, tournament_format, team_type_id, match_format, winning_team_id)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    ON CONFLICT (id) DO UPDATE SET
                        name = $2, type = $3, region = $4, start_date = $5, end_date = $6, status = $7,
                        organisation = $8, tournament_format = $9, team_type_id = $10, match_format = $11, winning_team_id = $12
                """, tid, name, ttype, region, start_date, end_date, status,
                     org_name, ttype, team_type_id, match_format, winning_team_id)

            print(f"Inserted/updated {len(all_tournaments)} tournaments")

            # Now fetch tournament teams for each tournament
            print("\nFetching tournament teams...")
            teams_inserted = 0
            for i, t in enumerate(all_tournaments):
                tid = t["id"]
                try:
                    r = await client.get(f"{API}/tournaments/{tid}/teams")
                    if r.status_code == 200:
                        teams = r.json()
                        for team_data in teams:
                            team_id = team_data.get("teamId") or team_data.get("id")
                            if not team_id:
                                continue
                            # Insert into tournament_standings with minimal data
                            await conn.execute("""
                                INSERT INTO tournament_standings (tournament_id, team_id)
                                VALUES ($1, $2)
                                ON CONFLICT (tournament_id, team_id) DO NOTHING
                            """, tid, team_id)
                            teams_inserted += 1
                except Exception as e:
                    pass  # Some tournaments may not have teams accessible

                if (i + 1) % 10 == 0:
                    print(f"  Processed {i+1}/{len(all_tournaments)} tournaments ({teams_inserted} team entries)")

                await asyncio.sleep(0.15)  # Rate limit

            print(f"\nTotal tournament team entries: {teams_inserted}")

            # Stats
            count = await conn.fetchval("SELECT COUNT(*) FROM tournaments")
            ts_count = await conn.fetchval("SELECT COUNT(*) FROM tournament_standings")
            print(f"\nDB stats: {count} tournaments, {ts_count} tournament standings")

    await pool.close()
    print("Done!")


if __name__ == "__main__":
    asyncio.run(main())
