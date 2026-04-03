"""Sync team metadata (teamType, regionId, logo) from IOSoccer API."""
import httpx
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

API = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DB_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

# regionId -> region name
REGIONS = {1: "Europe", 2: "South America", 3: "Asia", 4: "North America"}

async def fetch_teams(client: httpx.AsyncClient, region_id: int):
    """Fetch all teams (active+inactive) for a region, all team types."""
    teams = []
    for team_type in [1, 2, 3, 4]:  # Club, National, Mix, Draft
        # Active teams with summaries
        for active_endpoint in [
            f"/api/team/region/{region_id}/active/summaries?teamType={team_type}",
            f"/api/team/region/{region_id}?teamType={team_type}",
        ]:
            try:
                r = await client.get(f"{API.rsplit('/api', 1)[0]}{active_endpoint}")
                if r.status_code == 200:
                    data = r.json()
                    if isinstance(data, list):
                        for t in data:
                            teams.append({
                                "id": t["id"],
                                "name": t["name"],
                                "team_type": t.get("teamType", team_type),
                                "region_id": region_id,
                                "color": t.get("color"),
                                "inactive": t.get("inactive", False),
                                "badge_image_id": t.get("badgeImageId"),
                            })
            except Exception as e:
                print(f"  Error fetching {active_endpoint}: {e}")

    # Deduplicate by id
    seen = {}
    for t in teams:
        seen[t["id"]] = t
    return list(seen.values())

async def main():
    if not DB_URL:
        raise RuntimeError("DIRECT_URL or DATABASE_URL is required")

    pool = await asyncpg.create_pool(DB_URL, min_size=1, max_size=3)

    async with httpx.AsyncClient(headers=HEADERS, timeout=30) as client:
        all_teams = []
        for region_id, region_name in REGIONS.items():
            print(f"Fetching teams for {region_name} (region {region_id})...")
            teams = await fetch_teams(client, region_id)
            print(f"  Found {len(teams)} teams")
            all_teams.extend(teams)

        print(f"\nTotal teams from API: {len(all_teams)}")

        # Update DB
        updated = 0
        async with pool.acquire() as conn:
            for t in all_teams:
                # Build logo URL from badgeImageId
                logo = None
                if t["badge_image_id"]:
                    logo = f"https://www.iosoccer.com/images/hub/{t['badge_image_id']}_md.png"

                result = await conn.execute("""
                    UPDATE teams SET
                        team_type = $1,
                        region_id = $2,
                        color = COALESCE($3, color),
                        inactive = $4,
                        logo = COALESCE($5, logo)
                    WHERE id = $6
                """, t["team_type"], t["region_id"], t["color"], t["inactive"], logo, t["id"])

                if "UPDATE 1" in result:
                    updated += 1
                else:
                    # Team not in our DB yet - insert it
                    slug = t["name"].lower().replace(" ", "-")
                    try:
                        await conn.execute("""
                            INSERT INTO teams (id, name, slug, logo, region, region_id, color, team_type, inactive)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                            ON CONFLICT (id) DO UPDATE SET
                                team_type = $8, region_id = $6, color = COALESCE($7, teams.color),
                                inactive = $9, logo = COALESCE($4, teams.logo)
                        """, t["id"], t["name"], slug, logo,
                            REGIONS.get(t["region_id"], "Unknown"),
                            t["region_id"], t["color"], t["team_type"], t["inactive"])
                        updated += 1
                    except Exception as e:
                        print(f"  Error inserting team {t['name']}: {e}")

        print(f"Updated/inserted {updated} teams")

        # Show stats
        async with pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT
                    team_type,
                    region_id,
                    COUNT(*) as cnt,
                    COUNT(*) FILTER (WHERE NOT inactive) as active
                FROM teams
                WHERE team_type IS NOT NULL
                GROUP BY team_type, region_id
                ORDER BY region_id, team_type
            """)
            print("\nTeam breakdown:")
            type_names = {1: "Club", 2: "National", 3: "Mix", 4: "Draft"}
            for r in rows:
                print(f"  Region {r['region_id']} | {type_names.get(r['team_type'], '?'):10} | Total: {r['cnt']:4} | Active: {r['active']:3}")

    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
