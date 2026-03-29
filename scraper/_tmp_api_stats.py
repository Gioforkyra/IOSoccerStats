"""
Fetch ALL player-statistics for a playerId directly from the API (all pages),
then aggregate and print. This is what the website computes.
"""
import asyncio, httpx, json, sys

API_BASE = "https://iosoccer.com:44380/api"
HEADERS = {
    "Content-Type": "application/json", "Accept": "*/*",
    "Origin": "https://www.iosoccer.com", "Referer": "https://www.iosoccer.com/",
}

async def fetch_page(client, player_id: int, page: int, page_size=100):
    resp = await client.post(f"{API_BASE}/player-statistics/matches", json={
        "page": page,
        "pageSize": page_size,
        "filters": {
            "timePeriod": 0,
            "includeSubstituteAppearances": True,
            "excludePlayers": [],
            "playerId": player_id,
        },
        "sortOrder": "ASC",
        "sortBy": "Player.Name",
    }, headers=HEADERS, timeout=30)
    if resp.status_code != 200:
        return None, 0
    d = resp.json()
    return d.get("items", []), d.get("totalCount", 0)

async def run(player_id: int):
    async with httpx.AsyncClient(timeout=30) as client:
        # First page to get totalCount
        items, total = await fetch_page(client, player_id, 1, 100)
        if items is None:
            print("Endpoint not available with playerId filter")
            return
        print(f"Total stat rows from API: {total}")
        
        if total == 0:
            print("No data")
            return
        
        all_items = list(items)
        pages = (total + 99) // 100
        for p in range(2, pages + 1):
            items, _ = await fetch_page(client, player_id, p, 100)
            if items:
                all_items.extend(items)
            print(f"  Page {p}/{pages} ({len(all_items)}/{total})")
        
        # Aggregate
        agg = {}
        fields = ["goals","assists","secondAssists","shots","shotsOnGoal","keyPasses",
                  "chancesCreated","passes","passesCompleted","interceptions","fouls",
                  "yellowCards","redCards","ownGoals","goalsConceded","keeperSaves","offsides"]
        for f in fields:
            agg[f] = sum((item.get(f) or 0) for item in all_items)
        
        print(f"\n{'='*50}")
        print(f"  Player {player_id} — API aggregate ({len(all_items)} appearances)")
        print(f"{'='*50}")
        print(f"  Appearances:     {len(all_items)}")
        print(f"  Goals:           {agg['goals']}")
        print(f"  Assists:         {agg['assists']}")
        print(f"  2nd Assists:     {agg['secondAssists']}")
        print(f"  Shots:           {agg['shots']}")
        print(f"  Shots on Target: {agg['shotsOnGoal']}")
        print(f"  Key Passes:      {agg['keyPasses']}")
        print(f"  Chances Created: {agg['chancesCreated']}")
        print(f"  Passes:          {agg['passes']}")
        print(f"  Passes Comp:     {agg['passesCompleted']}")
        print(f"  Interceptions:   {agg['interceptions']}")
        print(f"  Fouls:           {agg['fouls']}")
        print(f"  Yellow Cards:    {agg['yellowCards']}")
        print(f"  Red Cards:       {agg['redCards']}")
        print(f"  Own Goals:       {agg['ownGoals']}")
        print(f"  Goals Conceded:  {agg['goalsConceded']}")
        print(f"  Saves:           {agg['keeperSaves']}")
        print(f"{'='*50}")

if __name__ == "__main__":
    pid = int(sys.argv[1]) if len(sys.argv) > 1 else 191
    asyncio.run(run(pid))
