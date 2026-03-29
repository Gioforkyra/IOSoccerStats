"""
Sync missing match records for matches that have player stats but no entry in matches table.

Finds all match IDs in match_player_stats that are missing from matches,
fetches their details from the API, and inserts ONLY the match + team records.
Does NOT touch match_player_stats.

Usage:
    python sync_missing_matches.py
    python sync_missing_matches.py --workers 20
    python sync_missing_matches.py --dry-run
"""
import asyncio
import argparse
import time
import os
import asyncpg
import httpx
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

CONCURRENCY = 30
BATCH_DB_SIZE = 200

counters = {"fetched": 0, "inserted": 0, "no_data": 0, "errors": 0}


def parse_match(raw: dict) -> dict | None:
    ms = raw.get("matchStatistics")
    if not ms:
        return None
    md = ms.get("matchData")
    if not md:
        return None

    home = raw.get("teamHome") or {}
    away = raw.get("teamAway") or {}
    mi = md.get("matchInfo") or {}
    field_min = mi.get("fieldMin") or {"x": -1554, "y": -2406}
    field_max = mi.get("fieldMax") or {"x": 1554, "y": 2406}
    potm = raw.get("playerOfTheMatch") or {}

    kick_off = raw.get("kickOff") or ms.get("kickOff") or ""
    try:
        from datetime import datetime
        date = datetime.fromisoformat(kick_off.replace("Z", "+00:00"))
    except Exception:
        from datetime import datetime
        date = datetime.utcnow()

    match_type = "competitive" if raw.get("matchType") == 2 else "friendly"

    return {
        "id": raw["id"],
        "date": date,
        "home_team_id": raw.get("teamHomeId"),
        "away_team_id": raw.get("teamAwayId"),
        "home_score": ms.get("matchGoalsHome") or 0,
        "away_score": ms.get("matchGoalsAway") or 0,
        "match_type": match_type,
        "status": "completed",
        "map": (raw.get("map") or {}).get("name") or mi.get("mapName"),
        "server": (raw.get("server") or {}).get("name"),
        "potm": potm.get("name"),
        "field_min_x": field_min.get("x"),
        "field_min_y": field_min.get("y"),
        "field_max_x": field_max.get("x"),
        "field_max_y": field_max.get("y"),
        "home_team": {
            "id": raw.get("teamHomeId"),
            "name": home.get("name") or "Unknown",
            "slug": home.get("teamCode") or "UNK",
            "logo": (home.get("badgeImage") or {}).get("smallUrl"),
            "region": (home.get("region") or {}).get("regionName"),
            "color": home.get("color"),
            "inactive": home.get("inactive") or False,
        },
        "away_team": {
            "id": raw.get("teamAwayId"),
            "name": away.get("name") or "Unknown",
            "slug": away.get("teamCode") or "UNK",
            "logo": (away.get("badgeImage") or {}).get("smallUrl"),
            "region": (away.get("region") or {}).get("regionName"),
            "color": away.get("color"),
            "inactive": away.get("inactive") or False,
        },
    }


async def fetch_match(client: httpx.AsyncClient, sem: asyncio.Semaphore, match_id: int) -> dict | None:
    async with sem:
        try:
            resp = await client.get(f"{API_BASE}/match/{match_id}", timeout=20)
            if resp.status_code == 404:
                counters["no_data"] += 1
                return None
            if resp.status_code != 200:
                counters["errors"] += 1
                return None
            raw = resp.json()
            parsed = parse_match(raw)
            if parsed:
                counters["fetched"] += 1
            else:
                counters["no_data"] += 1
            return parsed
        except Exception as e:
            counters["errors"] += 1
            return None


async def upsert_team(conn: asyncpg.Connection, team: dict):
    if not team.get("id"):
        return
    await conn.execute(
        """
        INSERT INTO teams (id, name, slug, logo, region, color, inactive)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo = COALESCE(EXCLUDED.logo, teams.logo),
            region = COALESCE(EXCLUDED.region, teams.region),
            color = COALESCE(EXCLUDED.color, teams.color),
            inactive = EXCLUDED.inactive
        """,
        team["id"], team["name"], team["slug"], team.get("logo"),
        team.get("region"), team.get("color"), team.get("inactive", False),
    )


async def upsert_matches_batch(conn: asyncpg.Connection, matches: list[dict]):
    async with conn.transaction():
        for m in matches:
            if not m["home_team_id"] or not m["away_team_id"]:
                continue
            await upsert_team(conn, m["home_team"])
            await upsert_team(conn, m["away_team"])
            await conn.execute(
                """
                INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score,
                                     match_type, status, map, server, potm,
                                     field_min_x, field_min_y, field_max_x, field_max_y)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                ON CONFLICT (id) DO UPDATE SET
                    map = COALESCE(EXCLUDED.map, matches.map),
                    server = COALESCE(EXCLUDED.server, matches.server),
                    potm = COALESCE(EXCLUDED.potm, matches.potm)
                """,
                m["id"], m["date"], m["home_team_id"], m["away_team_id"],
                m["home_score"], m["away_score"], m["match_type"], m["status"],
                m.get("map"), m.get("server"), m.get("potm"),
                m.get("field_min_x"), m.get("field_min_y"),
                m.get("field_max_x"), m.get("field_max_y"),
            )
            counters["inserted"] += 1


async def main(args):
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print("Connected to PostgreSQL.")

    rows = await conn.fetch("""
        SELECT DISTINCT mps.match_id
        FROM match_player_stats mps
        LEFT JOIN matches m ON m.id = mps.match_id
        WHERE m.id IS NULL
        ORDER BY mps.match_id
    """)
    missing_ids = [r["match_id"] for r in rows]
    total = len(missing_ids)
    print(f"Missing match records: {total:,}\n")

    if total == 0:
        print("Nothing to do.")
        await conn.close()
        return

    if args.dry_run:
        print(f"[dry-run] Would fetch {total} matches. Exiting.")
        await conn.close()
        return

    sem = asyncio.Semaphore(args.workers)
    async with httpx.AsyncClient(headers=HEADERS) as client:
        for i in range(0, total, BATCH_DB_SIZE):
            chunk_ids = missing_ids[i:i + BATCH_DB_SIZE]

            tasks = [fetch_match(client, sem, mid) for mid in chunk_ids]
            results = await asyncio.gather(*tasks)

            parsed = [r for r in results if r is not None]
            if parsed:
                try:
                    await upsert_matches_batch(conn, parsed)
                except Exception as e:
                    print(f"  DB error at chunk {i}: {e}")

            done = min(i + BATCH_DB_SIZE, total)
            elapsed = time.time() - start
            rate = done / elapsed if elapsed > 0 else 0
            eta = (total - done) / rate if rate > 0 else 0
            print(
                f"  [{done:,}/{total:,}] "
                f"fetched={counters['fetched']} inserted={counters['inserted']} "
                f"no_data={counters['no_data']} errors={counters['errors']} "
                f"({rate:.0f}/s, ETA {eta/60:.1f}min)",
                flush=True,
            )

    await conn.close()
    elapsed = time.time() - start
    print(f"\nDone in {elapsed/60:.1f} minutes.")
    print(f"  Fetched:  {counters['fetched']}")
    print(f"  Inserted: {counters['inserted']}")
    print(f"  No data:  {counters['no_data']}")
    print(f"  Errors:   {counters['errors']}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=CONCURRENCY)
    parser.add_argument("--dry-run", action="store_true")
    asyncio.run(main(parser.parse_args()))
