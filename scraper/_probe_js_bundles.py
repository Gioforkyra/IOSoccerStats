import httpx, re

# First, look at what JS the player profile page loads
r = httpx.get(
    'https://www.iosoccer.com/hub/player/191',
    timeout=15,
    headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'},
    verify=False,
    follow_redirects=True,
)
print(f'Page status: {r.status_code}, size: {len(r.text)}')

# find script src tags
scripts = re.findall(r'<script[^>]+src=["\']([^"\']+)["\']', r.text)
print('\nScripts:')
for s in scripts[:20]:
    print(' ', s)

# Look for any API references in raw HTML
api_refs = re.findall(r'["\'](/api/[^"\'<>]{5,})["\']', r.text)
print('\nAPI refs in HTML:')
for a in api_refs[:20]:
    print(' ', a)

print('\nHTML snippet (first 3000 chars):')
print(r.text[:3000])
