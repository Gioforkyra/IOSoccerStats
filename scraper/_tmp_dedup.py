import asyncio, os, asyncpg
from dotenv import load_dotenv
load_dotenv('../.env.local')

STEAM_ID = '76561198391524498'

async def t():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    # Matches where player has >1 row (home+away duplicate)
    dups = await db.fetch(
        """
        SELECT match_id, COUNT(*) as cnt, array_agg(team_side) as sides
        FROM match_player_stats
        WHERE player_steam_id = $1
        GROUP BY match_id HAVING COUNT(*) > 1
        ORDER BY match_id LIMIT 20
        """, STEAM_ID
    )
    print(f'Matches with duplicate rows: {len(dups)} (showing first 20)')
    for r in dups[:10]:
        print(f'  match {r["match_id"]}: sides={r["sides"]}')

    # Correct appearances = distinct match_ids
    apps = await db.fetchval(
        "SELECT COUNT(DISTINCT match_id) FROM match_player_stats WHERE player_steam_id = $1",
        STEAM_ID
    )
    print(f'\nCorrect appearances: {apps}')

    # Stats using only DISTINCT match_ids (take max per match to avoid double-counting)
    agg = await db.fetchrow(
        """
        WITH per_match AS (
            SELECT DISTINCT ON (match_id) match_id,
                goals, assists, second_assists, shots, shots_on_target,
                passes, passes_completed, key_passes, chances_created,
                saves, interceptions, fouls, yellow_cards, red_cards,
                own_goals, goals_conceded
            FROM match_player_stats
            WHERE player_steam_id = $1
            ORDER BY match_id, goals DESC
        )
        SELECT
            COUNT(*) as appearances,
            SUM(goals) as goals,
            SUM(assists) as assists,
            SUM(second_assists) as second_assists,
            SUM(shots) as shots,
            SUM(shots_on_target) as shots_on_target,
            SUM(passes) as passes,
            SUM(passes_completed) as passes_completed,
            SUM(key_passes) as key_passes,
            SUM(chances_created) as chances_created,
            SUM(saves) as saves,
            SUM(interceptions) as interceptions,
            SUM(fouls) as fouls,
            SUM(yellow_cards) as yellow_cards,
            SUM(red_cards) as red_cards,
            SUM(own_goals) as own_goals,
            SUM(goals_conceded) as goals_conceded
        FROM per_match
        """, STEAM_ID
    )
    print('\nStats (deduplicated per match):')
    for k, v in dict(agg).items():
        print(f'  {k}: {v}')

    await db.close()

asyncio.run(t())
