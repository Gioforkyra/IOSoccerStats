"""Export all data from Supabase to local JSON files, then clear the database."""
import asyncio
import asyncpg
import json
import os
from datetime import datetime, date
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "data_export")


def json_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    return str(obj)


async def export_table(conn, table_name: str):
    """Export a table to JSON."""
    rows = await conn.fetch(f"SELECT * FROM {table_name}")
    data = [dict(r) for r in rows]
    filepath = os.path.join(EXPORT_DIR, f"{table_name}.json")
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, default=json_serializer, ensure_ascii=False)
    print(f"  {table_name}: {len(data)} rows exported")
    return len(data)


async def main():
    os.makedirs(EXPORT_DIR, exist_ok=True)
    conn = await asyncpg.connect(DATABASE_URL)

    # Export all tables
    print("=== Exporting data ===")
    tables = [
        "scraper_state",
        "teams",
        "players",
        "matches",
        "match_player_stats",
        "tournaments",
        "tournament_standings",
        "transfers",
    ]

    total = 0
    for table in tables:
        try:
            count = await export_table(conn, table)
            total += count
        except Exception as e:
            print(f"  {table}: skipped ({e})")

    print(f"\nTotal: {total} rows exported to {EXPORT_DIR}/")

    # Clear tables (in reverse order to respect foreign keys)
    print("\n=== Clearing database ===")
    clear_order = [
        "transfers",
        "tournament_standings",
        "match_player_stats",
        "matches",
        "tournaments",
        "players",
        "teams",
        "scraper_state",
    ]

    for table in clear_order:
        try:
            result = await conn.execute(f"DELETE FROM {table}")
            print(f"  {table}: cleared ({result})")
        except Exception as e:
            print(f"  {table}: skip ({e})")

    await conn.close()
    print("\nDone! Data saved locally, database cleared.")


if __name__ == "__main__":
    asyncio.run(main())
