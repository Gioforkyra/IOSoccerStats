"""
Backfill home_score / away_score in the matches table by summing goals + own_goals
from match_player_stats for each match that currently has 0-0.
"""
import asyncio
import asyncpg
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ["DATABASE_URL"]

async def main():
    pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)

    # Count how many 0-0 matches exist
    zero_count = await pool.fetchval(
        "SELECT COUNT(*) FROM matches WHERE home_score = 0 AND away_score = 0"
    )
    print(f"Matches with 0-0 score: {zero_count}")

    # Update scores by summing goals+own_goals from match_player_stats
    # home_score = goals scored by home players + own_goals by away players
    result = await pool.execute("""
        UPDATE matches m
        SET
            home_score = COALESCE((
                SELECT SUM(mps.goals) + SUM(mps.own_goals)
                FROM match_player_stats mps
                JOIN matches m2 ON m2.id = mps.match_id
                WHERE mps.match_id = m.id AND mps.team_side = 'home'
            ), 0) + COALESCE((
                SELECT SUM(mps.own_goals)
                FROM match_player_stats mps
                WHERE mps.match_id = m.id AND mps.team_side = 'away'
            ), 0),
            away_score = COALESCE((
                SELECT SUM(mps.goals) + SUM(mps.own_goals)
                FROM match_player_stats mps
                WHERE mps.match_id = m.id AND mps.team_side = 'away'
            ), 0) + COALESCE((
                SELECT SUM(mps.own_goals)
                FROM match_player_stats mps
                WHERE mps.match_id = m.id AND mps.team_side = 'home'
            ), 0)
        WHERE m.home_score = 0 AND m.away_score = 0
          AND EXISTS (
              SELECT 1 FROM match_player_stats mps WHERE mps.match_id = m.id
          )
    """)
    print(f"Updated: {result}")

    # Verify
    still_zero = await pool.fetchval(
        """SELECT COUNT(*) FROM matches WHERE home_score = 0 AND away_score = 0
           AND EXISTS (SELECT 1 FROM match_player_stats mps WHERE mps.match_id = matches.id)"""
    )
    print(f"Still 0-0 with player stats: {still_zero}")

    await pool.close()

if __name__ == "__main__":
    asyncio.run(main())
