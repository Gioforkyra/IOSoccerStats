import urllib.request, json

r = urllib.request.urlopen(urllib.request.Request(
    'https://iosoccer.com:44380/api/match/229806',
    headers={'Origin': 'https://www.iosoccer.com', 'Referer': 'https://www.iosoccer.com/'}
))
d = json.loads(r.read())
ms = d['matchStatistics']
md = ms['matchData']

for rp in md['players']:
    sid = str(rp['info'].get('steamId64', ''))
    if sid == '76561198061757191':
        print(f"Player {sid} has {len(rp['matchPeriodData'])} periods:")
        for p in rp['matchPeriodData']:
            pi = p['info']
            s = p['statistics']
            team = pi.get('team')
            pos = pi.get('position')
            saves = s[20] if len(s) > 20 else 0
            passes = s[15] if len(s) > 15 else 0
            passcmp = s[9] if len(s) > 9 else 0
            poss = s[22] if len(s) > 22 else 0
            print(f"  team={team} pos={pos} saves={saves} passes={passes} passcmp={passcmp} poss={poss}")
