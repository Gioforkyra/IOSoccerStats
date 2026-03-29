import asyncio, httpx

H = {'Accept': 'application/json', 'Content-Type': 'application/json',
     'Origin': 'https://www.iosoccer.com', 'Referer': 'https://www.iosoccer.com/'}

endpoints = [
    ('GET',  'https://iosoccer.com:44380/api/statistics/player/191', None),
    ('GET',  'https://iosoccer.com:44380/api/statistics/191', None),
    ('GET',  'https://iosoccer.com:44380/api/player-statistics?playerId=191', None),
    ('POST', 'https://iosoccer.com:44380/api/player-statistics', {'playerId': 191}),
    ('GET',  'https://iosoccer.com:44380/api/player/191/stats', None),
    ('GET',  'https://iosoccer.com:44380/api/player-stats/191', None),
    ('POST', 'https://iosoccer.com:44380/api/player-statistics/aggregate', {'playerId': 191}),
    ('GET',  'https://iosoccer.com:44380/api/player-aggregate-statistics/191', None),
]

async def t():
    async with httpx.AsyncClient(timeout=15) as c:
        for method, url, body in endpoints:
            try:
                if method == 'GET':
                    r = await c.get(url, headers=H)
                else:
                    r = await c.post(url, headers=H, json=body or {})
                print(f'{method} {url}: {r.status_code} ({len(r.content)}b)')
                if r.status_code == 200 and r.content:
                    import json
                    d = r.json()
                    if isinstance(d, dict):
                        print('  keys:', list(d.keys())[:10])
                    elif isinstance(d, list) and d:
                        print('  list[0] keys:', list(d[0].keys())[:10])
            except Exception as e:
                print(f'{method} {url}: ERROR {e}')

asyncio.run(t())
