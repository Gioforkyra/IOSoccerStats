"""Compare match stats in our DB vs the API to verify rescrape accuracy.
Tests multiple matches across the rescrape range."""
import urllib.request, json, subprocess, os, sys

STAT = {0:'red_cards',1:'yellow_cards',2:'fouls',3:'fouls_suffered',6:'goals_conceded',
        7:'shots',8:'shots_on_target',9:'passes_completed',10:'interceptions',11:'offsides',
        12:'goals',13:'own_goals',14:'assists',15:'passes',16:'free_kicks',17:'penalties',
        18:'corners',19:'throw_ins',20:'saves',21:'goal_kicks',22:'possession',23:'distance_run',
        25:'key_passes',26:'chances_created',27:'second_assists'}

CHECK_COLS = ['goals','assists','saves','interceptions','fouls','passes','red_cards',
              'shots','shots_on_target','passes_completed','yellow_cards','possession']

DB_COLS = "player_steam_id,team_side,goals,assists,saves,interceptions,fouls,passes,red_cards,shots,shots_on_target,passes_completed,yellow_cards,possession"

# Sample match IDs across the rescrape range
MATCH_IDS = [183556, 183500, 180000, 170000, 160000, 140000, 120000, 100000, 80000, 50000]

env = {**os.environ, 'PGPASSWORD': 'diodiobibo201'}
total_matched = 0
total_mismatches = 0
total_missing = 0

for mid in MATCH_IDS:
    try:
        req = urllib.request.Request(
            f'https://iosoccer.com:44380/api/match/{mid}',
            headers={'Origin':'https://www.iosoccer.com','Referer':'https://www.iosoccer.com/'})
        r = urllib.request.urlopen(req)
        d = json.loads(r.read())
    except Exception as e:
        print(f"Match {mid}: API error ({e})")
        continue

    ms = d.get('matchStatistics') or {}
    md = ms.get('matchData') or {}
    players = md.get('players', [])
    if not players:
        print(f"Match {mid}: no player data in API")
        continue

    # Parse API stats grouped by team
    api_data = {}
    for rp in players:
        raw_id = rp.get('info', {}).get('steamId64')
        if not raw_id:
            continue
        sid = str(raw_id)
        by_team = {}
        for p in rp.get('matchPeriodData', []):
            t = p.get('info', {}).get('team', '')
            if not t:
                continue
            by_team.setdefault(t, []).append(p)
        for team_side, team_periods in by_team.items():
            totals = {}
            for p in team_periods:
                s = p.get('statistics', [])
                for idx, key in STAT.items():
                    totals[key] = totals.get(key, 0) + (s[idx] if idx < len(s) else 0)
            api_data[(sid, team_side)] = totals

    # Fetch from DB
    sql = f"SELECT {DB_COLS} FROM match_player_stats WHERE match_id = {mid} ORDER BY team_side, player_steam_id;"
    result = subprocess.run(
        ['psql','-h','localhost','-U','postgres','-d','iosoccer_stats','-t','-A','-F',',','-c',sql],
        capture_output=True, text=True, env=env)

    db_data = {}
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        parts = line.split(',')
        if len(parts) < 14:
            continue
        db_data[(parts[0], parts[1])] = {
            'goals':int(parts[2]),'assists':int(parts[3]),'saves':int(parts[4]),
            'interceptions':int(parts[5]),'fouls':int(parts[6]),'passes':int(parts[7]),
            'red_cards':int(parts[8]),'shots':int(parts[9]),'shots_on_target':int(parts[10]),
            'passes_completed':int(parts[11]),'yellow_cards':int(parts[12]),'possession':int(parts[13])
        }

    # Compare
    mm = 0
    missing = 0
    matched = 0
    for key in api_data:
        sid, team_side = key
        if key not in db_data:
            missing += 1
            continue
        matched += 1
        for col in CHECK_COLS:
            if api_data[key].get(col, 0) != db_data[key].get(col, 0):
                mm += 1
                print(f"  Match {mid} steam={sid} team={team_side} {col}: API={api_data[key][col]} DB={db_data[key][col]}")

    status = "OK" if mm == 0 and missing == 0 else f"{mm} mismatches, {missing} missing"
    print(f"Match {mid}: {len(api_data)} API players, {len(db_data)} DB rows, {matched} matched — {status}")
    total_matched += matched
    total_mismatches += mm
    total_missing += missing

print(f"\n=== SUMMARY: {len(MATCH_IDS)} matches checked, {total_matched} players matched, {total_mismatches} mismatches, {total_missing} missing ===")
