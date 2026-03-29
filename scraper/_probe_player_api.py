import httpx, json

BASE = 'https://iosoccer.com:44380/api'
HEADERS = {
    'Content-Type': 'application/json',
    'Accept': '*/*',
    'Origin': 'https://www.iosoccer.com',
    'Referer': 'https://www.iosoccer.com/',
}

PLAYER_ID = 191  # Gioforkyra

endpoints = [
    ('GET',  f'{BASE}/player-statistics/{PLAYER_ID}', None),
    ('GET',  f'{BASE}/players/{PLAYER_ID}/statistics', None),
    ('GET',  f'{BASE}/player-statistics/player-totals/{PLAYER_ID}', None),
    ('POST', f'{BASE}/player-statistics/player-totals', {'playerId': PLAYER_ID}),
    ('POST', f'{BASE}/player-statistics/player-totals', {'iosoccerId': PLAYER_ID}),
    ('GET',  f'{BASE}/players/{PLAYER_ID}', None),
    ('GET',  f'{BASE}/statistics/player/{PLAYER_ID}', None),
    ('GET',  f'{BASE}/player/{PLAYER_ID}/statistics', None),
    ('GET',  f'{BASE}/player/{PLAYER_ID}/totals', None),
    ('POST', f'{BASE}/player-statistics/totals', {'playerId': PLAYER_ID}),
    ('POST', f'{BASE}/player-statistics/totals', {'filters': {'playerId': PLAYER_ID}}),
]

with httpx.Client(timeout=15, verify=False) as c:
    for method, url, body in endpoints:
        try:
            if method == 'GET':
                r = c.get(url, headers=HEADERS)
            else:
                r = c.post(url, json=body, headers=HEADERS)
            short = url.replace(BASE, '')
            payload_str = json.dumps(body) if body else ''
            print(f'{method} {short} {payload_str} -> {r.status_code} ({len(r.content)}b)')
            if r.status_code == 200 and len(r.content) > 50:
                try:
                    data = r.json()
                    print('  ', str(data)[:400])
                except Exception:
                    print('  ', r.text[:400])
        except Exception as e:
            print(f'ERROR {url}: {e}')
