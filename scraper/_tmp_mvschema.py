import asyncio, os, asyncpg
from dotenv import load_dotenv
load_dotenv('../.env.local')

async def t():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    cols = await db.fetch(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name = 'mv_player_leaderboard' ORDER BY ordinal_position"
    )
    print('Columns:')
    for c in cols:
        print(f'  {c["column_name"]}: {c["data_type"]}')

    kind = await db.fetchrow(
        "SELECT relkind FROM pg_class WHERE relname = 'mv_player_leaderboard'"
    )
    kinds = {'r': 'table', 'm': 'materialized view', 'v': 'view', 'i': 'index'}
    k = kind['relkind'] if kind else '?'
    print(f'\nType: {kinds.get(k, k)}')

    # Also get the view definition if it's a matview or view
    vdef = await db.fetchrow(
        "SELECT definition FROM pg_views WHERE viewname = 'mv_player_leaderboard'"
    )
    if vdef:
        print('\nView def (first 500):', vdef['definition'][:500])

    await db.close()

asyncio.run(t())
