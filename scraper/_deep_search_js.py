import httpx, re, json

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
js = r.text
print(f'JS size: {len(js)} chars')

# Find occurrences of "player-statistics" or "player statistics" (might have spaces in minified)
print('\n=== /api/ endpoints ===')
matches = re.findall(r'"/api/[^"]{3,80}"', js)
unique = list(dict.fromkeys(matches))
for m in sorted(unique):
    print(' ', m)

# Look for the base URL variable
print('\n=== Base URL patterns ===')
for m in re.findall(r'["\']https?://[^"\']{5,50}["\']', js)[:30]:
    print(' ', m)

# Look around "player-statistics" string
idx = js.find('player-statistics')
while idx != -1:
    snippet = js[max(0, idx-100):idx+200]
    print(f'\n--- at pos {idx} ---')
    print(snippet)
    idx = js.find('player-statistics', idx + 1)
    if idx > 2000000:  # stop after a while
        break

# Also look for filter class with substituteAppearances
idx = js.find('includeSubstituteAppearances')
if idx != -1:
    print(f'\n=== includeSubstituteAppearances context ===')
    print(js[max(0, idx-300):idx+300])
