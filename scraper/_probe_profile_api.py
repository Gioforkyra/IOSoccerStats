import httpx, json

BASE = 'https://iosoccer.com:44380'
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/plain, */*',
    'Origin': 'https://www.iosoccer.com',
    'Referer': 'https://www.iosoccer.com/',
}

PLAYER_ID = 191  # Gioforkyra

endpoints = [
    ('GET',  f'{BASE}/api/player-profiles/{PLAYER_ID}', None),
    ('GET',  f'{BASE}/api/player-statistics/appearance-totals/{PLAYER_ID}', None),
    ('GET',  f'{BASE}/api/player-statistics/performance/monthly/{PLAYER_ID}', None),
    # Also try the general player-statistics + set a player filter
    ('POST', f'{BASE}/api/player-statistics', {
        'page': 1, 'pageSize': 1,
        'filters': {'timePeriod': 0, 'includeSubstituteAppearances': True, 'playerIds': [PLAYER_ID]},
        'sortOrder': 'DESC', 'sortBy': 'Goals'
    }),
    ('POST', f'{BASE}/api/player-statistics', {
        'page': 1, 'pageSize': 1,
        'filters': {'timePeriod': 0, 'includeSubstituteAppearances': False, 'playerIds': [PLAYER_ID]},
        'sortOrder': 'DESC', 'sortBy': 'Goals'
    }),
]

with httpx.Client(timeout=20, verify=False) as c:
    for method, url, body in endpoints:
        try:
            if method == 'GET':
                r = c.get(url, headers=HEADERS)
            else:
                r = c.post(url, json=body, headers=HEADERS)
            short = url.replace(BASE, '')
            payload_str = ''
            if body:
                payload_str = f" | payload={json.dumps(body)[:100]}"
            print(f'{method} {short}{payload_str}')
            print(f'  -> {r.status_code} ({len(r.content)}b)')
            if r.status_code == 200 and len(r.content) > 10:
                try:
                    data = r.json()
                    print('  DATA:', json.dumps(data, indent=2)[:800])
                except Exception:
                    print('  TEXT:', r.text[:400])
            print()
        except Exception as e:
            print(f'ERROR {url}: {e}')
            print()
