import httpx, json

BASE = 'https://iosoccer.com:44380'
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.iosoccer.com',
    'Referer': 'https://www.iosoccer.com/',
}

PLAYER_ID = 191  # Gioforkyra

with httpx.Client(timeout=20, verify=False) as c:
    # 1. Get regions
    print('=== Regions ===')
    r = c.get(f'{BASE}/api/region', headers=HEADERS)
    regions = r.json()
    print(json.dumps(regions, indent=2)[:2000])

    # 2. Try match-totals with playerId filter using each region's matchFormat
    print('\n=== match-totals with playerId filter ===')
    for region in regions[:5]:
        rid = region.get('regionId') or region.get('id')
        mfmt = region.get('matchFormat')
        name = region.get('name', '?')
        
        payload = {
            'page': 1, 'pageSize': 1,
            'filters': {
                'timePeriod': 0,
                'playerId': PLAYER_ID,
                'matchFormat': mfmt,
            },
            'sortOrder': 'DESC', 'sortBy': 'Goals'
        }
        r2 = c.post(f'{BASE}/api/player-statistics/match-totals', json=payload, headers=HEADERS)
        print(f'\nRegion: {name} (regionId={rid}, matchFormat={mfmt})')
        print(f'  Status: {r2.status_code}, bytes: {len(r2.content)}')
        if r2.status_code == 200 and len(r2.content) > 10:
            data = r2.json()
            items = data.get('items', [])
            if items:
                p = items[0]
                print(f'  Player: {p.get("name")} | apps={p.get("appearances")} | goals={p.get("goals")} | assists={p.get("assists")} | saves={p.get("saves")}')
            else:
                print('  No items')

    # 3. Try with includeSubstituteAppearances=False
    print('\n=== match-totals playerId + no subs ===')
    for region in regions[:3]:
        mfmt = region.get('matchFormat')
        name = region.get('name', '?')
        payload = {
            'page': 1, 'pageSize': 1,
            'filters': {
                'timePeriod': 0,
                'playerId': PLAYER_ID,
                'matchFormat': mfmt,
                'includeSubstituteAppearances': False,
            },
            'sortOrder': 'DESC', 'sortBy': 'Goals'
        }
        r2 = c.post(f'{BASE}/api/player-statistics/match-totals', json=payload, headers=HEADERS)
        print(f'\n  {name} no subs -> {r2.status_code}')
        if r2.status_code == 200:
            items = r2.json().get('items', [])
            if items:
                p = items[0]
                print(f'  Player: {p.get("name")} | apps={p.get("appearances")} | goals={p.get("goals")} | assists={p.get("assists")}')
