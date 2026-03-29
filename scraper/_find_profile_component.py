import httpx, re

BASE_URL = 'https://www.iosoccer.com'
JS_FILE = 'main-es2015.1f612830ca4823c9ab64.js'

r = httpx.get(f'{BASE_URL}/{JS_FILE}', timeout=60, headers={'User-Agent': 'Mozilla/5.0'}, verify=False, follow_redirects=True)
js = r.text
print(f'JS size: {len(js)} chars')

# 1. Find player profile component - look for where playerProfile or hub/player is used
print('\n=== PlayerProfile component context ===')
idx = js.find('PlayerProfile')
while idx != -1 and idx < 3000000:
    snippet = js[max(0, idx-50):idx+400]
    print(f'\n[{idx}]:', snippet[:400])
    idx = js.find('PlayerProfile', idx + 1)

# 2. Look for filter with playerId
print('\n\n=== Filter class (Ha) full context ===')
idx = js.find('class Ha{constructor()') 
if idx == -1:
    idx = js.find('class Ha{')
if idx != -1:
    print(js[max(0, idx-200):idx+600])

# 3. Search for playerId or player_id in filter context
print('\n\n=== playerId in filter ===')
for m in re.finditer(r'playerId|player_id|steamId', js):
    ctx = js[max(0, m.start()-100):m.start()+200]
    if 'filter' in ctx.lower() or 'Filter' in ctx:
        print(f'\n[{m.start()}]: ...{ctx}...')

# 4. Find where getPlayerStatistics is called
print('\n\n=== getPlayerStatistics calls ===')
for m in re.finditer(r'getPlayerStatistics\(|getPlayerMatchStatisticsTotals\(', js):
    ctx = js[max(0, m.start()-200):m.start()+300]
    print(f'\n[{m.start()}]: ...{ctx}...')
