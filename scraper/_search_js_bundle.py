import httpx, re

BASE_URL = 'https://www.iosoccer.com'
JS_FILE = 'main-es2015.1f612830ca4823c9ab64.js'

print(f'Fetching {JS_FILE}...')
r = httpx.get(
    f'{BASE_URL}/{JS_FILE}',
    timeout=60,
    headers={'User-Agent': 'Mozilla/5.0'},
    verify=False,
    follow_redirects=True,
)
print(f'Status: {r.status_code}, size: {len(r.text)} chars')

js = r.text

# Search for API endpoint patterns
patterns = [
    r'player-statistics[^"\']{0,80}',
    r'/api/[a-z\-/]{5,50}',
    r'match-totals',
    r'player-totals',
    r'player.*?stat',
    r'stat.*?player',
    r'getPlayer',
    r'player.*?endpoint',
    r'playerProfile',
]

print('\n=== API endpoint search ===')
for pat in patterns:
    matches = re.findall(pat, js, re.IGNORECASE)
    unique = list(dict.fromkeys(matches))
    if unique:
        print(f'\nPattern: {pat}')
        for m in unique[:10]:
            print(f'  {m}')
