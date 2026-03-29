import asyncio, httpx, json

H = {'Accept': 'application/json', 'Content-Type': 'application/json',
     'Origin': 'https://www.iosoccer.com', 'Referer': 'https://www.iosoccer.com/'}

async def t():
    async with httpx.AsyncClient(timeout=30) as c:
        # Try match-totals
        r = await c.post('https://iosoccer.com:44380/api/player-statistics/match-totals',
            headers=H,
            json={'page': 1, 'pageSize': 3, 'filters': {'timePeriod': 0}, 'sortOrder': 'DESC', 'sortBy': 'Goals'}
        )
        print(f'Status: {r.status_code}, bytes: {len(r.content)}')
        if r.status_code == 200 and r.content:
            d = r.json()
            print('Top-level keys:', list(d.keys()) if isinstance(d, dict) else 'list')
            if isinstance(d, dict):
                print('totalCount:', d.get('totalCount'))
                items = d.get('items') or d.get('data') or []
                if items:
                    print('\nFirst item keys:', list(items[0].keys()))
                    print('\nFirst item:', json.dumps(items[0], indent=2))
        else:
            print('Body:', r.text[:300])

asyncio.run(t())
