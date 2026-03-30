"""
Scraper IOSoccer — dati 1:1 con il sito originale.

Usa POST /api/player-statistics/matches invece dell'array statistics[].
I campi arrivano già con nomi espliciti → zero trasformazioni → dati identici.
"""

import asyncio
import httpx
from datetime import datetime
from typing import Optional

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Content-Type": "application/json",
    "Accept": "*/*",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

# ── FETCH ──────────────────────────────────────────────────────

async def fetch_match_list(client: httpx.AsyncClient, page: int, region_id=1) -> dict:
    """POST /api/match — lista partite paginate."""
    resp = await client.post(f"{API_BASE}/match", json={
        "page": page,
        "pageSize": 10,
        "filters": {
            "timePeriod": 0,
            "includeUpcoming": False,
            "includePast": True,
            "regionId": region_id,
            "matchFormat": 8,
        },
        "sortBy": None,
        "sortOrder": "DESC",
    }, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return resp.json()


async def fetch_match_detail(client: httpx.AsyncClient, match_id: int) -> Optional[dict]:
    """GET /api/match/{id} — dettaglio singolo match (per shot map e info base)."""
    try:
        resp = await client.get(f"{API_BASE}/match/{match_id}", headers=HEADERS, timeout=15)
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


async def fetch_match_player_stats(client: httpx.AsyncClient, match_id: int) -> list:
    """
    POST /api/player-statistics/matches — statistiche giocatori per match.
    
    QUESTO è l'endpoint che usa il sito originale per mostrare le stats.
    I campi hanno nomi espliciti — identici a quello che vedi sulla pagina.
    """
    try:
        resp = await client.post(f"{API_BASE}/player-statistics/matches", json={
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
        }, headers=HEADERS, timeout=15)
        resp.raise_for_status()
        return resp.json().get("items", [])
    except Exception:
        return []


async def fetch_potm(client: httpx.AsyncClient, match_id: int) -> Optional[dict]:
    """GET /api/match/{id}/player-of-the-match"""
    try:
        resp = await client.get(
            f"{API_BASE}/match/{match_id}/player-of-the-match",
            headers=HEADERS, timeout=10
        )
        if resp.status_code == 200:
            return resp.json()
        return None
    except Exception:
        return None


# ── PARSE ──────────────────────────────────────────────────────

def parse_team(team_obj: dict) -> dict:
    """Estrae i dati del team dal JSON."""
    badge = team_obj.get("badgeImage") or {}
    region = team_obj.get("region") or {}
    return {
        "id":       team_obj.get("id"),
        "name":     team_obj.get("name", "Unknown"),
        "slug":     team_obj.get("teamCode", "UNK"),
        "logo":     badge.get("smallUrl"),
        "color":    team_obj.get("color"),
        "region":   region.get("regionName"),
        "regionId": team_obj.get("regionId"),
        "teamType": team_obj.get("teamType"),
        "inactive": team_obj.get("inactive", False),
    }


def parse_match_info(raw: dict) -> Optional[dict]:
    """Estrae info base del match dal JSON di GET /api/match/{id}."""
    ms = raw.get("matchStatistics")
    if not ms:
        return None

    md = ms.get("matchData") or {}
    info = md.get("matchInfo") or {}

    # Kickoff
    kick_off_str = raw.get("kickOff") or ms.get("kickOff", "")
    try:
        kick_off = datetime.fromisoformat(kick_off_str.replace("Z", "+00:00"))
        kick_off = kick_off.replace(tzinfo=None)
    except (ValueError, AttributeError):
        kick_off = datetime.utcnow()

    # Map
    map_obj = raw.get("map") or {}
    map_name = map_obj.get("name") or info.get("mapName", "")

    # Server
    server_obj = raw.get("server") or {}
    server_name = server_obj.get("name", "")

    # Tournament
    tournament_obj = raw.get("tournament") or {}
    tournament_id = raw.get("tournamentId")

    # Field dimensions (per shot map)
    field_min = info.get("fieldMin") or {"x": -1554, "y": -2406}
    field_max = info.get("fieldMax") or {"x": 1554, "y": 2406}

    # Match events (per shot map)
    events = md.get("matchEvents") or []

    # Players steamId → steamId64 lookup (per shot map)
    steam_lookup = {}
    # (name.lower, side) → steamId64 lookup (per POST stats that lack steamID)
    name_side_lookup: dict[tuple[str, str], str] = {}
    for rp in (md.get("players") or []):
        pi = rp.get("info") or {}
        sid64 = pi.get("steamId64", "")
        name = (pi.get("name") or "").lower()
        if pi.get("steamId") and sid64:
            steam_lookup[pi["steamId"]] = sid64
        for period in (rp.get("matchPeriodData") or []):
            side = (period.get("info") or {}).get("team", "")
            if name and sid64 and side:
                name_side_lookup[(name, side)] = sid64

    return {
        "id":           raw["id"],
        "kick_off":     kick_off,
        "home_score":   ms.get("matchGoalsHome") or ms.get("homeGoals") or 0,
        "away_score":   ms.get("matchGoalsAway") or ms.get("awayGoals") or 0,
        "match_type":   "competitive" if raw.get("matchType") == 2 else "friendly",
        "map":          map_name,
        "server":       server_name,
        "tournament_id": tournament_id,
        "field_min_x":  float(field_min.get("x", -1554)),
        "field_min_y":  float(field_min.get("y", -2406)),
        "field_max_x":  float(field_max.get("x", 1554)),
        "field_max_y":  float(field_max.get("y", 2406)),
        "events":       events,
        "steam_lookup": steam_lookup,
        "name_side_lookup": name_side_lookup,
    }


def parse_player_stats(items: list, match_id: int, potm_steam_id: Optional[str], name_side_lookup: dict) -> tuple[list, list]:
    """
    Converte gli item di POST /api/player-statistics/matches
    nei record per players e match_player_stats.

    I campi sono già named (goals, assists, ecc.) — zero indici, zero rischi.
    steamID viene risolto tramite name_side_lookup costruito dal GET /api/match/{id}.
    """
    players = []
    stats = []

    for item in items:
        # Risolvi steamId64 tramite (name.lower, side) lookup
        side = "home" if item.get("matchTeamType") == 1 else "away"
        nick = (item.get("nickname") or "").lower()
        steam_id64 = name_side_lookup.get((nick, side), "")
        if not steam_id64:
            continue

        # Player base
        players.append({
            "steam_id":  steam_id64,
            "username":  item.get("nickname") or item.get("name") or "Unknown",
            "position":  item.get("position", {}).get("name") if isinstance(item.get("position"), dict) else item.get("positionName"),
        })

        # Minuti giocati
        seconds = item.get("secondsPlayed") or 0
        minutes = seconds // 60

        # POTM
        is_potm = steam_id64 == potm_steam_id

        # ── Qui i campi arrivano già con nome esplicito dall'API ──
        # Identici a quello che mostra il sito originale
        stats.append({
            "match_id":                  match_id,
            "player_steam_id":           steam_id64,
            "team_side":                 side,
            "position":                  (item.get("position") or {}).get("name") if isinstance(item.get("position"), dict) else (item.get("position") if isinstance(item.get("position"), str) else item.get("positionName")),
            "minutes_played":            minutes,
            "is_substitute":             item.get("substitute", False),
            "is_potm":                   is_potm,
            # Attacco
            "goals":                     item.get("goals") or 0,
            "assists":                   item.get("assists") or 0,
            "second_assists":            item.get("secondAssists") or 0,
            "shots":                     item.get("shots") or 0,
            "shots_on_target":           item.get("shotsOnGoal") or 0,
            "key_passes":                item.get("keyPasses") or 0,
            "chances_created":           item.get("chancesCreated") or 0,
            "offsides":                  item.get("offsides") or 0,
            # Passaggi
            "passes":                    item.get("passes") or 0,
            "passes_completed":          item.get("passesCompleted") or 0,
            "free_kicks":                item.get("freeKicks") or 0,
            "corners":                   item.get("corners") or 0,
            "throw_ins":                 item.get("throwIns") or 0,
            "penalties":                 item.get("penalties") or 0,
            # Difesa
            "interceptions":             item.get("interceptions") or 0,
            "fouls":                     item.get("fouls") or 0,
            "fouls_suffered":            item.get("foulsSuffered") or 0,
            "sliding_tackles":           item.get("slidingTackles") or 0,
            "sliding_tackles_completed": item.get("slidingTacklesCompleted") or 0,
            "goals_conceded":            item.get("goalsConceded") or 0,
            # Portiere
            "saves":                     item.get("keeperSaves") or 0,
            "saves_caught":              item.get("keeperSavesCaught") or 0,
            "goal_kicks":                item.get("goalKicks") or 0,
            # Disciplina
            "yellow_cards":              item.get("yellowCards") or 0,
            "red_cards":                 item.get("redCards") or 0,
            "own_goals":                 item.get("ownGoals") or 0,
            # Fisico
            "distance_run":              item.get("distanceCovered") or 0,
            "possession":                item.get("possessionPercentage") or 0,
        })

    return players, stats


def parse_shots(events: list, steam_lookup: dict, match_id: int, field_min: dict, field_max: dict) -> list:
    """Estrae i tiri dagli eventi con coordinate normalizzate."""
    shots = []
    for ev in events:
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

        # Normalizza coordinate 0.0-1.0
        fx = (field_max["x"] - field_min["x"]) or 1
        fy = (field_max["y"] - field_min["y"]) or 1
        nx = (raw_x - field_min["x"]) / fx
        ny = (raw_y - field_min["y"]) / fy

        shots.append({
            "match_id":     match_id,
            "player_steam_id": steam_id64,
            "raw_x":        float(raw_x),
            "raw_y":        float(raw_y),
            "normalized_x": nx,
            "normalized_y": ny,
            "is_goal":      event_type == "GOAL",
            "is_save":      event_type == "SAVE",
            "minute":       (ev.get("second") or 0) // 60,
        })
    return shots


# ── MAIN FETCH+PARSE per un singolo match ─────────────────────

async def scrape_match(client: httpx.AsyncClient, match_id: int) -> Optional[dict]:
    """
    Fetcha e parsa un singolo match completo.
    Usa POST /api/player-statistics/matches per le stats → dati 1:1 al sito.
    """
    # 1. Dettaglio match (info base + shot map events)
    raw = await fetch_match_detail(client, match_id)
    if not raw:
        return None

    match_info = parse_match_info(raw)
    if not match_info:
        return None

    # 2. POTM
    potm = await fetch_potm(client, match_id)
    potm_steam_id = None
    if potm:
        # Cerca steamID del POTM tra i player stats
        potm_player_id = potm.get("playerId")
        match_info["potm_name"] = potm.get("playerName")
    else:
        match_info["potm_name"] = None

    # 3. Stats giocatori — POST /api/player-statistics/matches
    #    Questi sono i dati che usa il sito originale → identici 1:1
    stat_items = await fetch_match_player_stats(client, match_id)

    # Mapping (name.lower, side) → steamId64 costruito dal GET endpoint
    name_side_lookup = match_info.pop("name_side_lookup")

    # Trova steamID del POTM dai stat_items tramite name lookup
    if potm:
        potm_player_id = potm.get("playerId")
        for item in stat_items:
            if item.get("playerId") == potm_player_id:
                side = "home" if item.get("matchTeamType") == 1 else "away"
                nick = (item.get("nickname") or "").lower()
                potm_steam_id = name_side_lookup.get((nick, side))
                break

    players, player_stats = parse_player_stats(stat_items, match_id, potm_steam_id, name_side_lookup)

    # 4. Shot map events (da GET /api/match/{id})
    shots = parse_shots(
        match_info.pop("events"),
        match_info.pop("steam_lookup"),
        match_id,
        {"x": match_info["field_min_x"], "y": match_info["field_min_y"]},
        {"x": match_info["field_max_x"], "y": match_info["field_max_y"]},
    )

    # 5. Teams
    teams = {
        "home": parse_team(raw.get("teamHome") or {}),
        "away": parse_team(raw.get("teamAway") or {}),
    }
    match_info["home_team_id"] = teams["home"]["id"]
    match_info["away_team_id"] = teams["away"]["id"]
    match_info["status"] = "completed"

    return {
        "match":        match_info,
        "teams":        teams,
        "players":      players,
        "player_stats": player_stats,
        "shots":        shots,
    }


# ── LOOP PRINCIPALE ────────────────────────────────────────────

async def run_scraper(db, start_page: int = 1, region_id: int = 1):
    """
    Scorre tutte le pagine di POST /api/match e salva nel DB.
    db = il tuo Prisma client o asyncpg connection.
    """
    async with httpx.AsyncClient() as client:
        page = start_page
        while True:
            print(f"Fetching page {page}...")
            try:
                data = await fetch_match_list(client, page, region_id)
            except Exception as e:
                print(f"Error fetching page {page}: {e}")
                await asyncio.sleep(5)
                continue

            items = data.get("items") or []
            total_pages = data.get("totalPages") or 1

            if not items:
                print("No more items.")
                break

            for match_summary in items:
                match_id = match_summary["id"]

                # Controlla se il match è già nel DB
                # existing = await db.match.find_unique(where={"id": match_id})
                # if existing:
                #     continue

                result = await scrape_match(client, match_id)
                if not result:
                    continue

                # Salva nel DB (adatta al tuo ORM)
                await save_to_db(db, result)
                print(f"  ✓ Match {match_id} saved")
                await asyncio.sleep(0.5)

            print(f"Page {page}/{total_pages} done")

            if page >= total_pages:
                break

            page += 1
            await asyncio.sleep(2)


async def save_to_db(db, result: dict):
    """
    Salva i dati nel DB usando Prisma.
    Adatta questa funzione al tuo client Prisma Python.
    """
    match = result["match"]
    teams = result["teams"]

    # Upsert teams
    for side, team in teams.items():
        if not team["id"]:
            continue
        await db.team.upsert(
            where={"id": team["id"]},
            data={
                "create": {
                    "id":       team["id"],
                    "name":     team["name"],
                    "slug":     team["slug"],
                    "logo":     team["logo"],
                    "color":    team["color"],
                    "region":   team["region"],
                    "regionId": team["regionId"],
                    "teamType": team["teamType"],
                    "inactive": team["inactive"],
                },
                "update": {
                    "name":     team["name"],
                    "logo":     team["logo"],
                    "color":    team["color"],
                    "inactive": team["inactive"],
                },
            }
        )

    # Upsert match
    await db.match.upsert(
        where={"id": match["id"]},
        data={
            "create": {
                "id":          match["id"],
                "date":        match["kick_off"],
                "homeTeamId":  match["home_team_id"],
                "awayTeamId":  match["away_team_id"],
                "homeScore":   match["home_score"],
                "awayScore":   match["away_score"],
                "matchType":   match["match_type"],
                "status":      match["status"],
                "map":         match["map"],
                "server":      match["server"],
                "potm":        match.get("potm_name"),
                "tournamentId": match.get("tournament_id"),
                "fieldMinX":   match["field_min_x"],
                "fieldMinY":   match["field_min_y"],
                "fieldMaxX":   match["field_max_x"],
                "fieldMaxY":   match["field_max_y"],
            },
            "update": {
                "homeScore": match["home_score"],
                "awayScore": match["away_score"],
                "potm":      match.get("potm_name"),
            },
        }
    )

    # Upsert players
    for player in result["players"]:
        if not player["steam_id"]:
            continue
        await db.player.upsert(
            where={"steamId": player["steam_id"]},
            data={
                "create": {
                    "steamId":  player["steam_id"],
                    "username": player["username"],
                    "position": player["position"],
                },
                "update": {
                    "username": player["username"],
                },
            }
        )

    # Upsert match player stats
    for s in result["player_stats"]:
        await db.matchplayerstats.upsert(
            where={
                "matchId_playerSteamId_teamSide": {
                    "matchId":       s["match_id"],
                    "playerSteamId": s["player_steam_id"],
                    "teamSide":      s["team_side"],
                }
            },
            data={"create": s, "update": s}
        )