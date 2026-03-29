import asyncio, os, asyncpg
from dotenv import load_dotenv
load_dotenv('../.env.local')

async def t():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    count = await db.fetchval(
        "SELECT COUNT(DISTINCT match_id) FROM match_player_stats WHERE player_steam_id = '76561198391524498'"
    )
    print(f'Matches in DB for Gioforkyra: {count}')

    total = await db.fetchval('SELECT COUNT(*) FROM matches')
    print(f'Total matches in DB: {total}')

    max_id = await db.fetchval('SELECT MAX(id) FROM matches')
    min_id = await db.fetchval('SELECT MIN(id) FROM matches')
    print(f'Match ID range in DB: {min_id} - {max_id}')

    # How many rows total for this player
    rows = await db.fetchval(
        "SELECT COUNT(*) FROM match_player_stats WHERE player_steam_id = '76561198391524498'"
    )
    print(f'Total stat rows for Gioforkyra: {rows}')

    await db.close()

asyncio.run(t())
