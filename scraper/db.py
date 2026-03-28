"""Database operations for the IOSoccer scraper using asyncpg."""
import asyncpg
import os
from dotenv import load_dotenv

# Load from parent .env.local
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

# Use DIRECT_URL (port 5432) for direct connection
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")


async def get_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)


async def upsert_team(pool: asyncpg.Pool, team_data: dict) -> int:
    """Upsert a team and return its id."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            INSERT INTO teams (id, name, slug, logo, region, color, inactive)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                logo = EXCLUDED.logo,
                region = EXCLUDED.region,
                color = COALESCE(EXCLUDED.color, teams.color),
                inactive = EXCLUDED.inactive
            RETURNING id
            """,
            team_data["id"],
            team_data["name"],
            team_data["slug"],
            team_data.get("logo"),
            team_data.get("region"),
            team_data.get("color"),
            team_data.get("inactive", False),
        )
        return row["id"]


async def upsert_player(pool: asyncpg.Pool, steam_id: str, username: str, position: str | None = None):
    """Upsert a player."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO players (steam_id, username, position, updated_at)
            VALUES ($1, $2, $3, NOW())
            ON CONFLICT (steam_id) DO UPDATE SET
                username = CASE
                    WHEN players.username IS NULL OR players.username = '' OR LOWER(players.username) = 'unknown'
                    THEN EXCLUDED.username
                    ELSE players.username
                END,
                position = COALESCE(EXCLUDED.position, players.position),
                updated_at = NOW()
            """,
            steam_id,
            username,
            position,
        )


async def insert_match(pool: asyncpg.Pool, match: dict):
    """Insert a match. Skip if already exists."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score,
                                 match_type, status, map, server, potm,
                                 field_min_x, field_min_y, field_max_x, field_max_y)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (id) DO UPDATE SET
                map = EXCLUDED.map, server = EXCLUDED.server, potm = EXCLUDED.potm
            """,
            match["id"],
            match["date"],
            match["home_team_id"],
            match["away_team_id"],
            match["home_score"],
            match["away_score"],
            match["match_type"],
            match["status"],
            match.get("map"),
            match.get("server"),
            match.get("potm"),
            match.get("field_min_x"),
            match.get("field_min_y"),
            match.get("field_max_x"),
            match.get("field_max_y"),
        )


async def insert_player_stats(pool: asyncpg.Pool, stats: list[dict]):
    """Batch insert player match stats."""
    if not stats:
        return
    async with pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO match_player_stats (
                match_id, player_steam_id, team_side, position,
                goals, assists, second_assists, shots, shots_on_target,
                passes, passes_completed, key_passes, chances_created,
                interceptions, saves, offsides, fouls, fouls_suffered,
                yellow_cards, red_cards, own_goals, goals_conceded,
                corners, throw_ins, free_kicks, goal_kicks, penalties,
                distance_run, possession
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
            ON CONFLICT (match_id, player_steam_id, team_side) DO UPDATE SET
                goals = EXCLUDED.goals, assists = EXCLUDED.assists,
                second_assists = EXCLUDED.second_assists,
                shots = EXCLUDED.shots, shots_on_target = EXCLUDED.shots_on_target,
                passes = EXCLUDED.passes, passes_completed = EXCLUDED.passes_completed,
                key_passes = EXCLUDED.key_passes, chances_created = EXCLUDED.chances_created,
                interceptions = EXCLUDED.interceptions, saves = EXCLUDED.saves,
                offsides = EXCLUDED.offsides, fouls = EXCLUDED.fouls,
                fouls_suffered = EXCLUDED.fouls_suffered,
                yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
                own_goals = EXCLUDED.own_goals, goals_conceded = EXCLUDED.goals_conceded,
                corners = EXCLUDED.corners, throw_ins = EXCLUDED.throw_ins,
                free_kicks = EXCLUDED.free_kicks, goal_kicks = EXCLUDED.goal_kicks,
                penalties = EXCLUDED.penalties,
                distance_run = EXCLUDED.distance_run, possession = EXCLUDED.possession
            """,
            [
                (
                    s["match_id"], s["player_steam_id"], s["team_side"], s.get("position"),
                    s["goals"], s["assists"], s["second_assists"],
                    s["shots"], s["shots_on_target"],
                    s["passes"], s["passes_completed"], s["key_passes"], s["chances_created"],
                    s["interceptions"], s["saves"], s["offsides"],
                    s["fouls"], s["fouls_suffered"],
                    s["yellow_cards"], s["red_cards"],
                    s["own_goals"], s["goals_conceded"],
                    s["corners"], s["throw_ins"], s["free_kicks"], s["goal_kicks"], s["penalties"],
                    s["distance_run"], s["possession"],
                )
                for s in stats
            ],
        )



async def get_scraper_state(pool: asyncpg.Pool) -> int:
    """Get last scraped match ID."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT last_page FROM scraper_state WHERE id = 1")
        return row["last_page"] if row else 0


async def update_scraper_state(pool: asyncpg.Pool, last_id: int):
    """Update last scraped match ID."""
    async with pool.acquire() as conn:
        await conn.execute(
            """
            INSERT INTO scraper_state (id, last_page, last_run)
            VALUES (1, $1, NOW())
            ON CONFLICT (id) DO UPDATE SET last_page = $1, last_run = NOW()
            """,
            last_id,
        )


async def match_exists(pool: asyncpg.Pool, match_id: int) -> bool:
    """Check if a match already exists in the database."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow("SELECT 1 FROM matches WHERE id = $1", match_id)
        return row is not None
