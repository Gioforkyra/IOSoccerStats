"""Fetch and parse match data from the IOSoccer API."""
import httpx
from datetime import datetime, timezone
from normalizer import normalize_coordinate
from xg_model import calculate_xg

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

# Statistics array index mapping (from IOSoccer frontend source)
STAT = {
    "red_cards": 0,
    "yellow_cards": 1,
    "fouls": 2,
    "fouls_suffered": 3,
    "goals_conceded": 6,
    "shots": 7,
    "shots_on_target": 8,
    "passes_completed": 9,
    "interceptions": 10,
    "offsides": 11,
    "goals": 12,
    "own_goals": 13,
    "assists": 14,
    "passes": 15,
    "free_kicks": 16,
    "penalties": 17,
    "corners": 18,
    "throw_ins": 19,
    "saves": 20,
    "goal_kicks": 21,
    "possession": 22,
    "distance_run": 23,
    "key_passes": 25,
    "chances_created": 26,
    "second_assists": 27,
}


def safe_stat(stats_arr: list, index: int) -> int:
    """Safely get a stat from the array."""
    if index < len(stats_arr):
        return stats_arr[index] or 0
    return 0


async def fetch_match(client: httpx.AsyncClient, match_id: int) -> dict | None:
    """Fetch a single match by ID. Returns None if not found."""
    try:
        resp = await client.get(f"{API_BASE}/match/{match_id}", headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        return None
    except (httpx.HTTPError, Exception):
        return None


def parse_match(raw: dict) -> dict | None:
    """Parse raw API response into our data model."""
    match_stats = raw.get("matchStatistics")
    if not match_stats:
        return None

    match_data = match_stats.get("matchData")
    if not match_data:
        return None

    match_info = match_data.get("matchInfo") or {}
    field_min = match_info.get("fieldMin") or {"x": -1554, "y": -2406}
    field_max = match_info.get("fieldMax") or {"x": 1554, "y": 2406}

    # Parse teams
    home_team = raw.get("teamHome", {})
    away_team = raw.get("teamAway", {})

    home_badge = home_team.get("badgeImage", {}) or {}
    away_badge = away_team.get("badgeImage", {}) or {}

    home_region = home_team.get("region", {}) or {}
    away_region = away_team.get("region", {}) or {}

    teams = {
        "home": {
            "id": raw.get("teamHomeId"),
            "name": home_team.get("name", "Unknown"),
            "slug": home_team.get("teamCode", "UNK"),
            "logo": home_badge.get("smallUrl"),
            "region": home_region.get("regionName"),
            "color": home_team.get("color"),
            "inactive": home_team.get("inactive", False),
        },
        "away": {
            "id": raw.get("teamAwayId"),
            "name": away_team.get("name", "Unknown"),
            "slug": away_team.get("teamCode", "UNK"),
            "logo": away_badge.get("smallUrl"),
            "region": away_region.get("regionName"),
            "color": away_team.get("color"),
            "inactive": away_team.get("inactive", False),
        },
    }

    if not teams["home"]["id"] or not teams["away"]["id"]:
        return None

    # Parse kickoff date
    kick_off_str = raw.get("kickOff") or match_stats.get("kickOff", "")
    try:
        kick_off = datetime.fromisoformat(kick_off_str.replace("Z", "+00:00"))
        # Make naive (UTC) for PostgreSQL timestamp without timezone
        kick_off = kick_off.replace(tzinfo=None)
    except (ValueError, AttributeError):
        kick_off = datetime.utcnow()

    # Goals
    home_goals = match_stats.get("matchGoalsHome", 0) or 0
    away_goals = match_stats.get("matchGoalsAway", 0) or 0

    # Match type
    match_type_raw = raw.get("matchType", 1)
    match_type = "competitive" if match_type_raw == 2 else "friendly"

    # Map name
    map_obj = raw.get("map", {}) or {}
    map_name = map_obj.get("name") or match_info.get("mapName", "")

    # Server name
    server_obj = raw.get("server", {}) or {}
    server_name = server_obj.get("name", "")

    # POTM
    potm_obj = raw.get("playerOfTheMatch", {}) or {}
    potm_name = potm_obj.get("name")
    potm_steam_id = potm_obj.get("steamID")

    # Parse players
    players = []
    player_stats = []
    raw_players = match_data.get("players", [])

    for rp in raw_players:
        info = rp.get("info", {})
        steam_id64 = info.get("steamId64", "")
        name = info.get("name", "Unknown")

        if not steam_id64:
            continue

        periods = rp.get("matchPeriodData", [])
        if not periods:
            continue

        # Get position and team from first period
        first_period = periods[0].get("info", {})
        position = first_period.get("position")
        team_side = first_period.get("team", "")

        if not team_side:
            continue

        # Sum statistics across all periods
        total_stats = [0] * 30
        for period in periods:
            for i, v in enumerate(period.get("statistics", [])):
                if i < len(total_stats):
                    total_stats[i] += (v or 0)

        players.append({
            "steam_id": steam_id64,
            "username": name,
            "position": position,
        })

        player_stats.append({
            "match_id": raw["id"],
            "player_steam_id": steam_id64,
            "team_side": team_side,
            "position": position,
            "goals": safe_stat(total_stats, STAT["goals"]),
            "assists": safe_stat(total_stats, STAT["assists"]),
            "second_assists": safe_stat(total_stats, STAT["second_assists"]),
            "shots": safe_stat(total_stats, STAT["shots"]),
            "shots_on_target": safe_stat(total_stats, STAT["shots_on_target"]),
            "passes": safe_stat(total_stats, STAT["passes"]),
            "passes_completed": safe_stat(total_stats, STAT["passes_completed"]),
            "key_passes": safe_stat(total_stats, STAT["key_passes"]),
            "chances_created": safe_stat(total_stats, STAT["chances_created"]),
            "interceptions": safe_stat(total_stats, STAT["interceptions"]),
            "saves": safe_stat(total_stats, STAT["saves"]),
            "offsides": safe_stat(total_stats, STAT["offsides"]),
            "fouls": safe_stat(total_stats, STAT["fouls"]),
            "fouls_suffered": safe_stat(total_stats, STAT["fouls_suffered"]),
            "yellow_cards": safe_stat(total_stats, STAT["yellow_cards"]),
            "red_cards": safe_stat(total_stats, STAT["red_cards"]),
            "own_goals": safe_stat(total_stats, STAT["own_goals"]),
            "goals_conceded": safe_stat(total_stats, STAT["goals_conceded"]),
            "corners": safe_stat(total_stats, STAT["corners"]),
            "throw_ins": safe_stat(total_stats, STAT["throw_ins"]),
            "free_kicks": safe_stat(total_stats, STAT["free_kicks"]),
            "goal_kicks": safe_stat(total_stats, STAT["goal_kicks"]),
            "penalties": safe_stat(total_stats, STAT["penalties"]),
            "distance_run": safe_stat(total_stats, STAT["distance_run"]),
            "possession": safe_stat(total_stats, STAT["possession"]),
            "is_potm": steam_id64 == potm_steam_id,
        })

    # Parse match events → shots
    shots = []
    events = match_data.get("matchEvents", [])
    # Build steamId → steamId64 lookup
    steam_lookup = {}
    for rp in raw_players:
        info = rp.get("info", {})
        steam_lookup[info.get("steamId", "")] = info.get("steamId64", "")

    for ev in events:
        try:
            event_type = ev.get("event", "")
            if event_type not in ("GOAL", "SAVE", "MISS"):
                continue

            pos = ev.get("startPosition") or {}
            raw_x = pos.get("x", 0) or 0
            raw_y = pos.get("y", 0) or 0

            steam_id_short = ev.get("player1SteamId", "")
            steam_id64 = steam_lookup.get(steam_id_short, "")
            if not steam_id64:
                continue

            # Normalize coordinates
            nx, ny = normalize_coordinate(raw_x, raw_y, field_min, field_max)

            # Determine if home team shot
            team_side = ev.get("team", "")
            is_home = team_side == "home"

            # Calculate xG
            xg = calculate_xg(nx, ny, is_home)

            # Convert seconds to minute
            second = ev.get("second", 0)
            minute = second // 60 if second else None

            shots.append({
                "match_id": raw["id"],
                "player_steam_id": steam_id64,
                "raw_x": float(raw_x),
                "raw_y": float(raw_y),
                "normalized_x": nx,
                "normalized_y": ny,
                "is_goal": event_type == "GOAL",
                "is_save": event_type == "SAVE",
                "xg": xg,
                "minute": minute,
            })
        except Exception:
            continue  # Skip malformed events

    return {
        "match": {
            "id": raw["id"],
            "date": kick_off,
            "home_team_id": teams["home"]["id"],
            "away_team_id": teams["away"]["id"],
            "home_score": home_goals,
            "away_score": away_goals,
            "match_type": match_type,
            "status": "completed",
            "map": map_name,
            "server": server_name,
            "potm": potm_name,
            "field_min_x": float(field_min.get("x", 0)),
            "field_min_y": float(field_min.get("y", 0)),
            "field_max_x": float(field_max.get("x", 0)),
            "field_max_y": float(field_max.get("y", 0)),
        },
        "teams": teams,
        "players": players,
        "player_stats": player_stats,
        "shots": shots,
    }
