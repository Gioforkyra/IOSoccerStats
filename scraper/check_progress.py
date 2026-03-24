import asyncio, asyncpg, os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

async def check():
    conn = await asyncpg.connect(os.getenv("DIRECT_URL"))
    m = await conn.fetchval("SELECT COUNT(*) FROM matches")
    p = await conn.fetchval("SELECT COUNT(*) FROM players")
    s = await conn.fetchval("SELECT COUNT(*) FROM shots")
    t = await conn.fetchval("SELECT COUNT(*) FROM teams")
    row = await conn.fetchrow("SELECT last_page FROM scraper_state WHERE id=1")
    last_id = row["last_page"] if row else 0
    print(f"Matches: {m} | Teams: {t} | Players: {p} | Shots: {s} | Last ID: {last_id}")
    await conn.close()

asyncio.run(check())
