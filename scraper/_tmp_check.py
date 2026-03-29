import asyncio, os, asyncpg
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

async def t():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))
    cols = await db.fetch("SELECT column_name FROM information_schema.columns WHERE table_name='players' ORDER BY ordinal_position")
    print('columns:', [r['column_name'] for r in cols])
    await db.close()

asyncio.run(t())
