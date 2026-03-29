import asyncio, asyncpg, os
from dotenv import load_dotenv
load_dotenv('../.env.local')

async def main():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))
    rows = await db.fetch("""
        SELECT p.username, p.iosoccer_id, agg.apps, agg.total_goals, agg.total_assists,
               agg.total_saves, agg.total_yellow_cards, agg.total_red_cards, agg.total_goals_conceded
        FROM players p
        JOIN mv_player_leaderboard agg ON agg.player_steam_id = p.steam_id
        WHERE p.iosoccer_id IN (191, 1, 100, 500, 1000)
        ORDER BY p.iosoccer_id
    """)
    print(f"{'ID':<6} {'Name':<22} {'Apps':<6} {'Goals':<7} {'Assists':<8} {'Saves':<7} {'YC':<4} {'RC':<4} {'GC':<6}")
    print('-' * 75)
    for r in rows:
        print(f"{r['iosoccer_id']:<6} {r['username']:<22} {r['apps']:<6} {r['total_goals']:<7} {r['total_assists']:<8} {r['total_saves']:<7} {r['total_yellow_cards']:<4} {r['total_red_cards']:<4} {r['total_goals_conceded']:<6}")
    await db.close()

asyncio.run(main())
