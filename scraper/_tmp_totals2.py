import asyncio, httpx, json

H = {'Accept': 'application/json', 'Content-Type': 'application/json',
     'Origin': 'https://www.iosoccer.com', 'Referer': 'https://www.iosoccer.com/'}

# Try different payloads that worked in the first probe
async def t():
    async with httpx.AsyncClient(timeout=30) as c:
        payloads = [
            {'page': 1, 'pageSize': 3, 'filters': {'timePeriod': 0}, 'sortOrder': 'DESC', 'sortBy': 'Goals'},
            {'page': 1, 'pageSize': 3, 'sortOrder': 'DESC', 'sortBy': 'Goals'},
            {'page': 1, 'pageSize': 200, 'filters': {'timePeriod': 0, 'includeSubstituteAppearances': True}, 'sortOrder': 'ASC', 'sortBy': 'Player.Name'},
        ]
        for p in payloads:
            r = await c.post('https://iosoccer.com:44380/api/player-statistics/match-totals', headers=H, json=p)
            print(f'Payload keys={list(p.keys())} sortBy={p.get("sortBy")} → {r.status_code} ({len(r.content)}b)')

asyncio.run(t())
