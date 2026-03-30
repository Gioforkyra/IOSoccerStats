"""One-time script: sync team slug (teamCode) from API for all active teams."""
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


async def fetch_all_teams(client: httpx.AsyncClient) -> list[dict]:
    teams = {}
    for team_type in range(1, 5):
        for region_id in range(1, 5):
            try:
                resp = await client.get(
                    f"{API_BASE}/team/region/{region_id}/active/summaries?teamType={team_type}",
                )
                if resp.status_code == 200:
                    for t in resp.json():
                        tid = t.get("id")
                        code = t.get("teamCode") or t.get("slug")
                        if tid and code:
                            teams[int(tid)] = code
            except Exception as e:
                print(f"  region {region_id} type {team_type}: {e}")
            await asyncio.sleep(0.05)
    return teams


async def main():
    print("Fetching team codes from API...")
    async with httpx.AsyncClient(headers=HEADERS, timeout=20) as client:
        teams = await fetch_all_teams(client)

    print(f"Found {len(teams)} teams from API")

    conn = await asyncpg.connect(DATABASE_URL)
    updated = 0
    for team_id, code in teams.items():
        result = await conn.execute(
            "UPDATE teams SET slug = $1 WHERE id = $2 AND slug != $1",
            code,
            team_id,
        )
        if result == "UPDATE 1":
            updated += 1

    await conn.close()
    print(f"Updated {updated} team slugs")


if __name__ == "__main__":
    asyncio.run(main())
