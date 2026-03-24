"""
Import exported data + raw match files into local PostgreSQL.

Step 1: Import the DB export (matches.json, players.json, etc.) — 88k matches
Step 2: Import raw_matches batch files — 15k additional matches
"""
import asyncio
import asyncpg
import json
import os
import glob
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))
DATABASE_URL = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL", "")
EXPORT_DIR = os.path.join(os.path.dirname(__file__), "..", "data_export")
RAW_DIR = os.path.join(EXPORT_DIR, "raw_matches")

# Import from scraper modules for parsing raw matches
from scraper import parse_match
from normalizer import normalize_coordinate
from xg_model import calculate_xg


def parse_dt(val):
    """Parse datetime string to naive datetime."""
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    try:
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        return dt.replace(tzinfo=None)
    except:
        return datetime.utcnow()


async def import_db_export(conn):
    """Import the previously exported DB data (teams, players, matches, stats, shots)."""

    # 1. Teams
    print("Importing teams...")
    with open(os.path.join(EXPORT_DIR, "teams.json"), "r", encoding="utf-8") as f:
        teams = json.load(f)
    for t in teams:
        await conn.execute(
            """INSERT INTO teams (id, name, slug, logo, region, created_at)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING""",
            t["id"], t["name"], t["slug"], t.get("logo"), t.get("region"),
            parse_dt(t.get("created_at")) or datetime.utcnow()
        )
    print(f"  {len(teams)} teams imported")

    # 2. Players
    print("Importing players...")
    with open(os.path.join(EXPORT_DIR, "players.json"), "r", encoding="utf-8") as f:
        players = json.load(f)
    batch = []
    for p in players:
        batch.append((
            p["steam_id"], p["username"], p.get("country"), p.get("position"), p.get("avatar"),
            parse_dt(p.get("created_at")) or datetime.utcnow(),
            parse_dt(p.get("updated_at")) or datetime.utcnow(),
        ))
    await conn.executemany(
        """INSERT INTO players (steam_id, username, country, position, avatar, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (steam_id) DO NOTHING""",
        batch
    )
    print(f"  {len(players)} players imported")

    # 3. Matches
    print("Importing matches...")
    with open(os.path.join(EXPORT_DIR, "matches.json"), "r", encoding="utf-8") as f:
        matches = json.load(f)
    count = 0
    for m in matches:
        try:
            await conn.execute(
                """INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score,
                   match_type, status, map, server, potm, field_min_x, field_min_y, field_max_x, field_max_y, created_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                   ON CONFLICT (id) DO NOTHING""",
                m["id"], parse_dt(m["date"]), m["home_team_id"], m["away_team_id"],
                m["home_score"], m["away_score"], m.get("match_type", "friendly"),
                m.get("status", "completed"), m.get("map"), m.get("server"), m.get("potm"),
                m.get("field_min_x"), m.get("field_min_y"), m.get("field_max_x"), m.get("field_max_y"),
                parse_dt(m.get("created_at")) or datetime.utcnow()
            )
            count += 1
        except Exception as e:
            pass  # Skip duplicates or FK errors
        if count % 10000 == 0 and count > 0:
            print(f"  {count}/{len(matches)} matches...")
    print(f"  {count} matches imported")

    # 4. Match Player Stats (large file — stream it)
    print("Importing match_player_stats (this may take a while)...")
    with open(os.path.join(EXPORT_DIR, "match_player_stats.json"), "r", encoding="utf-8") as f:
        stats = json.load(f)
    count = 0
    batch = []
    for s in stats:
        batch.append((
            s["match_id"], s["player_steam_id"], s.get("team_side", ""),
            s.get("position"), s.get("goals", 0), s.get("assists", 0),
            s.get("shots", 0), s.get("shots_on_target", 0),
            s.get("passes", 0), s.get("passes_completed", 0),
            s.get("saves", 0), s.get("fouls", 0),
            s.get("yellow_cards", 0), s.get("red_cards", 0),
            s.get("interceptions", 0), float(s.get("possession", 0)),
        ))
        if len(batch) >= 5000:
            try:
                await conn.executemany(
                    """INSERT INTO match_player_stats (match_id, player_steam_id, team_side, position,
                       goals, assists, shots, shots_on_target, passes, passes_completed,
                       saves, fouls, yellow_cards, red_cards, interceptions, possession)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                       ON CONFLICT (match_id, player_steam_id) DO NOTHING""",
                    batch
                )
            except:
                pass
            count += len(batch)
            batch = []
            if count % 50000 == 0:
                print(f"  {count}/{len(stats)} stats...")
    if batch:
        try:
            await conn.executemany(
                """INSERT INTO match_player_stats (match_id, player_steam_id, team_side, position,
                   goals, assists, shots, shots_on_target, passes, passes_completed,
                   saves, fouls, yellow_cards, red_cards, interceptions, possession)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                   ON CONFLICT (match_id, player_steam_id) DO NOTHING""",
                batch
            )
        except:
            pass
        count += len(batch)
    print(f"  {count} player stats imported")

    # 5. Shots (largest file)
    print("Importing shots (largest file, please wait)...")
    with open(os.path.join(EXPORT_DIR, "shots.json"), "r", encoding="utf-8") as f:
        shots = json.load(f)
    count = 0
    batch = []
    for s in shots:
        batch.append((
            s["match_id"], s["player_steam_id"],
            float(s.get("raw_x", 0)), float(s.get("raw_y", 0)),
            float(s.get("normalized_x", 0)), float(s.get("normalized_y", 0)),
            s.get("is_goal", False), s.get("is_save", False),
            float(s.get("xg", 0)), s.get("minute"),
        ))
        if len(batch) >= 10000:
            try:
                await conn.executemany(
                    """INSERT INTO shots (match_id, player_steam_id, raw_x, raw_y,
                       normalized_x, normalized_y, is_goal, is_save, xg, minute)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                    batch
                )
            except:
                pass
            count += len(batch)
            batch = []
            if count % 100000 == 0:
                print(f"  {count}/{len(shots)} shots...")
    if batch:
        try:
            await conn.executemany(
                """INSERT INTO shots (match_id, player_steam_id, raw_x, raw_y,
                   normalized_x, normalized_y, is_goal, is_save, xg, minute)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                batch
            )
        except:
            pass
        count += len(batch)
    print(f"  {count} shots imported")


async def import_raw_matches(conn):
    """Import raw match JSON files (the ones scraped directly to disk)."""
    batch_files = sorted(glob.glob(os.path.join(RAW_DIR, "batch_*.json")))
    if not batch_files:
        print("No raw match files found.")
        return

    print(f"\nImporting {len(batch_files)} raw match batch files...")
    total_matches = 0
    total_shots = 0

    for bf in batch_files:
        with open(bf, "r", encoding="utf-8") as f:
            raw_matches = json.load(f)

        for raw in raw_matches:
            parsed = parse_match(raw)
            if not parsed:
                continue

            # Upsert teams
            for side in ("home", "away"):
                team = parsed["teams"][side]
                if team["id"]:
                    await conn.execute(
                        """INSERT INTO teams (id, name, slug, logo, region)
                           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET
                           name=EXCLUDED.name, logo=EXCLUDED.logo, region=EXCLUDED.region""",
                        team["id"], team["name"], team["slug"], team.get("logo"), team.get("region")
                    )

            # Upsert players
            for p in parsed["players"]:
                await conn.execute(
                    """INSERT INTO players (steam_id, username, position, updated_at)
                       VALUES ($1,$2,$3,NOW()) ON CONFLICT (steam_id) DO UPDATE SET
                       username=EXCLUDED.username, updated_at=NOW()""",
                    p["steam_id"], p["username"], p.get("position")
                )

            # Insert match
            m = parsed["match"]
            try:
                await conn.execute(
                    """INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score,
                       match_type, status, map, server, potm, field_min_x, field_min_y, field_max_x, field_max_y)
                       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                       ON CONFLICT (id) DO NOTHING""",
                    m["id"], m["date"], m["home_team_id"], m["away_team_id"],
                    m["home_score"], m["away_score"], m["match_type"], m["status"],
                    m.get("map"), m.get("server"), m.get("potm"),
                    m.get("field_min_x"), m.get("field_min_y"),
                    m.get("field_max_x"), m.get("field_max_y")
                )
                total_matches += 1
            except:
                continue

            # Insert player stats
            if parsed["player_stats"]:
                try:
                    await conn.executemany(
                        """INSERT INTO match_player_stats (match_id, player_steam_id, team_side, position,
                           goals, assists, shots, shots_on_target, passes, passes_completed,
                           saves, fouls, yellow_cards, red_cards, interceptions, possession)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
                           ON CONFLICT (match_id, player_steam_id) DO NOTHING""",
                        [(s["match_id"], s["player_steam_id"], s["team_side"], s.get("position"),
                          s["goals"], s["assists"], s["shots"], s["shots_on_target"],
                          s["passes"], s["passes_completed"], s["saves"], s["fouls"],
                          s["yellow_cards"], s["red_cards"], s["interceptions"], s["possession"])
                         for s in parsed["player_stats"]]
                    )
                except:
                    pass

            # Insert shots
            if parsed["shots"]:
                try:
                    await conn.executemany(
                        """INSERT INTO shots (match_id, player_steam_id, raw_x, raw_y,
                           normalized_x, normalized_y, is_goal, is_save, xg, minute)
                           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)""",
                        [(s["match_id"], s["player_steam_id"], s["raw_x"], s["raw_y"],
                          s["normalized_x"], s["normalized_y"], s["is_goal"], s["is_save"],
                          s["xg"], s.get("minute"))
                         for s in parsed["shots"]]
                    )
                    total_shots += len(parsed["shots"])
                except:
                    pass

        print(f"  {os.path.basename(bf)}: done ({total_matches} matches, {total_shots} shots)")

    print(f"  Total from raw files: {total_matches} matches, {total_shots} shots")


async def main():
    start = time.time()
    conn = await asyncpg.connect(DATABASE_URL)
    print(f"Connected to local PostgreSQL.\n")

    # Step 1: Import DB export
    await import_db_export(conn)

    # Step 2: Import raw match files
    await import_raw_matches(conn)

    # Final counts
    print("\n=== Final counts ===")
    for table in ["matches", "teams", "players", "match_player_stats", "shots"]:
        count = await conn.fetchval(f"SELECT COUNT(*) FROM {table}")
        print(f"  {table}: {count:,}")

    await conn.close()
    elapsed = time.time() - start
    print(f"\nImport completed in {elapsed / 60:.1f} minutes.")


if __name__ == "__main__":
    asyncio.run(main())
