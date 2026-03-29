"""
Verifica che i dati nel DB corrispondano esattamente all'API.
Testa il match specificato confrontando ogni statistica player by player.

Usage:
    python verify_new.py           # usa match 229801
    python verify_new.py 230000    # usa match specifico
"""
import asyncio
import sys
import os
import httpx
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env.local"))

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

CHECKS = [
    ("goals",           "goals",                lambda r: r["goals"]),
    ("assists",         "assists",              lambda r: r["assists"]),
    ("shots",           "shots",                lambda r: r["shots"]),
    ("shots_on_target", "shotsOnGoal",          lambda r: r["shots_on_target"]),
    ("saves",           "keeperSaves",          lambda r: r["saves"]),
    ("passes",          "passes",               lambda r: r["passes"]),
    ("passes_completed","passesCompleted",      lambda r: r["passes_completed"]),
    ("interceptions",   "interceptions",        lambda r: r["interceptions"]),
    ("key_passes",      "keyPasses",            lambda r: r["key_passes"]),
    ("chances_created", "chancesCreated",       lambda r: r["chances_created"]),
    ("yellow_cards",    "yellowCards",          lambda r: r["yellow_cards"]),
    ("red_cards",       "redCards",             lambda r: r["red_cards"]),
    ("second_assists",  "secondAssists",        lambda r: r["second_assists"]),
    ("fouls",           "fouls",                lambda r: r["fouls"]),
    ("corners",         "corners",              lambda r: r["corners"]),
    ("own_goals",       "ownGoals",             lambda r: r["own_goals"]),
]


async def verify(match_id: int):
    # Fetch from new API endpoint (same as iosoccer.com website)
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            f"{API_BASE}/player-statistics/matches",
            headers=HEADERS,
            json={
                "page": 1,
                "pageSize": 50,
                "filters": {
                    "timePeriod": 0,
                    "includeSubstituteAppearances": True,
                    "excludePlayers": [],
                    "matchId": match_id,
                },
                "sortOrder": "ASC",
                "sortBy": "Player.Name",
            },
        )
    api_items = resp.json().get("items", [])

    # Build name+side → steamId64 from GET /api/match/{id} (same as scraper does)
    async with httpx.AsyncClient(timeout=15) as client2:
        r2 = await client2.get(f"{API_BASE}/match/{match_id}", headers=HEADERS)
    raw = r2.json()
    players_get = raw.get("matchStatistics", {}).get("matchData", {}).get("players", [])
    name_side_map: dict[tuple[str, str], str] = {}
    for p in players_get:
        pi = p.get("info") or {}
        sid64 = pi.get("steamId64", "")
        name = (pi.get("name") or "").lower()
        if not sid64 or not name:
            continue
        for period in (p.get("matchPeriodData") or []):
            side = (period.get("info") or {}).get("team", "")
            if side:
                name_side_map[(name, side)] = sid64

    # Map API stats by (steamId64, side)
    api_map = {}
    for item in api_items:
        side = "home" if item.get("matchTeamType") == 1 else "away"
        nick = (item.get("nickname") or "").lower()
        sid = name_side_map.get((nick, side), "")
        if sid:
            api_map[(sid, side)] = item

    # Fetch from DB
    db = await asyncpg.connect(os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL"))
    rows = await db.fetch(
        """SELECT player_steam_id, team_side, goals, assists, shots, shots_on_target,
                  saves, passes, passes_completed, interceptions, key_passes,
                  chances_created, yellow_cards, red_cards, second_assists,
                  fouls, corners, own_goals
           FROM match_player_stats WHERE match_id = $1""",
        match_id,
    )
    await db.close()

    print(f"\nMatch {match_id}")
    print(f"  API players: {len(api_items)} | DB rows: {len(rows)}")

    mismatches = 0
    missing = 0
    for row in rows:
        key = (row["player_steam_id"], row["team_side"])
        api = api_map.get(key)
        if not api:
            missing += 1
            continue
        for db_col, api_col, getter in CHECKS:
            db_val = getter(row)
            api_val = api.get(api_col, 0) or 0
            if db_val != api_val:
                print(f"  MISMATCH {row['player_steam_id'][:10]} [{row['team_side']}] "
                      f"{db_col}: DB={db_val}  API={api_val}")
                mismatches += 1

    if mismatches == 0 and missing == 0:
        print("  ✓ All values match perfectly!")
    else:
        if missing:
            print(f"  {missing} players in DB not found in API")
        if mismatches:
            print(f"  {mismatches} stat mismatches found")


if __name__ == "__main__":
    mid = int(sys.argv[1]) if len(sys.argv) > 1 else 229801
    asyncio.run(verify(mid))
