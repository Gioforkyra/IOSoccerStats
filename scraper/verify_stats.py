"""Compare old export DB values with API truth for a single match."""
import urllib.request
import json
import subprocess

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Accept": "application/json",
    "Origin": "https://www.iosoccer.com",
    "Referer": "https://www.iosoccer.com/",
}

STAT = {
    "red_cards": 0, "yellow_cards": 1, "fouls": 2, "fouls_suffered": 3,
    "goals_conceded": 6, "shots": 7, "shots_on_target": 8,
    "passes_completed": 9, "interceptions": 10, "offsides": 11,
    "goals": 12, "own_goals": 13, "assists": 14, "passes": 15,
    "free_kicks": 16, "penalties": 17, "corners": 18, "throw_ins": 19,
    "saves": 20, "goal_kicks": 21, "possession": 22, "distance_run": 23,
    "key_passes": 25, "chances_created": 26, "second_assists": 27,
}

def fetch_match_api(match_id):
    req = urllib.request.Request(
        f"{API_BASE}/match/{match_id}",
        headers=HEADERS,
    )
    r = urllib.request.urlopen(req, timeout=15)
    return json.loads(r.read())

def get_db_stats(match_id):
    """Query DB via psql."""
    import os
    os.environ["PGPASSWORD"] = "diodiobibo201"
    cmd = f'psql -h localhost -U postgres -d iosoccer_stats -t -A -F "," -c "SELECT player_steam_id, team_side, position, goals, assists, shots, shots_on_target, saves, fouls, yellow_cards, red_cards, interceptions, passes, passes_completed, goals_conceded, offsides, distance_run, possession FROM match_player_stats WHERE match_id = {match_id} ORDER BY team_side, player_steam_id;"'
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    rows = {}
    for line in result.stdout.strip().split("\n"):
        if not line: continue
        parts = line.split(",")
        if len(parts) < 18: continue
        sid = parts[0]
        rows[sid + "_" + parts[1]] = {
            "team_side": parts[1], "position": parts[2],
            "goals": int(parts[3]), "assists": int(parts[4]),
            "shots": int(parts[5]), "sot": int(parts[6]),
            "saves": int(parts[7]), "fouls": int(parts[8]),
            "yc": int(parts[9]), "rc": int(parts[10]),
            "interceptions": int(parts[11]), "passes": int(parts[12]),
            "pc": int(parts[13]), "gc": int(parts[14]),
            "offsides": int(parts[15]), "dist": int(parts[16]),
            "poss": float(parts[17]),
        }
    return rows


def main():
    match_id = 100000  # Well within old export range
    print(f"=== Match {match_id} ===\n")
    
    raw = fetch_match_api(match_id)
    md = raw.get("matchStatistics", {}).get("matchData", {})
    if not md:
        print("No match data from API")
        return
    
    db_stats = get_db_stats(match_id)
    
    # The old export only had these columns:
    # goals, assists, shots, shots_on_target, passes, passes_completed,
    # saves, fouls, yellow_cards, red_cards, interceptions, possession
    # After our swap: assists is now what was old "interceptions", interceptions is now what was old "assists"
    
    # Let's find which raw index each DB column maps to
    # DB column -> old_export_column -> old_index (unknown)
    
    players = md.get("players", [])
    for p in players[:16]:
        info = p["info"]
        periods = p["matchPeriodData"]
        totals = [0] * 30
        for pd in periods:
            for i, v in enumerate(pd.get("statistics", [])):
                if i < 30:
                    totals[i] += (v or 0)
        
        team = periods[0]["info"].get("team", "?")
        pos = periods[0]["info"].get("position", "?")
        sid = str(info.get("steamId64", ""))
        name = info.get("name", "?")
        
        key = f"{sid}_{team}"
        db = db_stats.get(key, None)
        
        if db:
            # Print DB values and raw index values side by side
            print(f"{name} ({team} {pos})")
            # After swap: db.assists was old interceptions col, db.interceptions was old assists col
            # So to find original mapping: old_assists_col = db.interceptions, old_interceptions_col = db.assists
            db_cols = {
                "goals": db["goals"],
                "old_assists(now_inter)": db["interceptions"],  # this was 'assists' in the original export
                "shots": db["shots"],
                "sot": db["sot"],
                "passes": db["passes"],
                "pc": db["pc"],
                "saves": db["saves"],
                "fouls": db["fouls"],
                "yc": db["yc"],
                "rc": db["rc"],
                "old_inter(now_assists)": db["assists"],  # this was 'interceptions' in the original export
                "poss": db["poss"],
            }
            # Which raw index does each DB value match?
            for col_name, db_val in db_cols.items():
                matches = [i for i in range(28) if totals[i] == db_val and db_val != 0]
                if matches:
                    print(f"  {col_name}={db_val} -> raw indices {matches}")
            print()


if __name__ == "__main__":
    main()
