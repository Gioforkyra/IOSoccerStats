import asyncio, os, asyncpg
from dotenv import load_dotenv
load_dotenv('.env.local')

async def t():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))
    with open('prisma/leaderboard_to_table.sql') as f:
        sql = f.read()
    await db.execute(sql)
    print('Migration done.')
    kind = await db.fetchrow(
        "SELECT relkind FROM pg_class WHERE relname = 'mv_player_leaderboard'"
    )
    kinds = {'r': 'regular table', 'm': 'materialized view', 'v': 'view'}
    print('Type now:', kinds.get(kind['relkind'], kind['relkind']) if kind else 'not found')
    await db.close()

asyncio.run(t())
