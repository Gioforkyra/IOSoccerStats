"""
Sync mv_player_leaderboard directly from IOSoccer's match-totals endpoint.
Replaces the Next.js route — same logic, runs standalone.
"""
import asyncio, os, asyncpg, httpx, math
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env.local'))

API = "https://iosoccer.com:44380/api/player-statistics/match-totals"
HEADERS = {
    "Content-Type": "application/json", "Accept": "*/*",
    "Origin": "https://www.iosoccer.com", "Referer": "https://www.iosoccer.com/",
}
PAGE_SIZE   = 200
CONCURRENCY = 2
UPSERT_CHUNK = 200
RETRIES     = 3


async def fetch_page(client: httpx.AsyncClient, page: int) -> tuple[list, int]:
    for attempt in range(RETRIES):
        try:
            r = await client.post(API, json={
                "page": page, "pageSize": PAGE_SIZE,
                "filters": {"timePeriod": 0, "matchFormat": 8},
                "sortOrder": "ASC", "sortBy": "Goals",
            }, headers=HEADERS, timeout=60)
            r.raise_for_status()
            d = r.json()
            return d.get("items", []), d.get("totalPages", 1)
        except (httpx.ReadTimeout, httpx.HTTPStatusError) as e:
            if attempt == RETRIES - 1:
                raise
            wait = 2 ** attempt
            print(f"  Page {page} attempt {attempt+1} failed ({e.__class__.__name__}), retrying in {wait}s...")
            await asyncio.sleep(wait)


def ri(v): return round(v or 0)
def rf(v): return float(v or 0)


UPSERT_SQL = """
INSERT INTO mv_player_leaderboard (
  player_steam_id, apps, as_sub, wins, draws, losses,
  total_goals, total_assists, total_second_assists,
  total_shots, total_shots_on_target,
  total_key_passes, total_chances_created, total_offsides, total_own_goals,
  total_passes, total_passes_completed,
  total_saves, total_saves_caught, total_goals_conceded,
  total_interceptions, total_tackles, total_tackles_completed,
  total_fouls, total_fouls_suffered,
  total_yellow_cards, total_red_cards,
  total_distance, total_possession,
  avg_possession_pct, shot_accuracy, pass_accuracy
) VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
  $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32
)
ON CONFLICT (player_steam_id) DO UPDATE SET
  apps=$2, as_sub=$3, wins=$4, draws=$5, losses=$6,
  total_goals=$7, total_assists=$8, total_second_assists=$9,
  total_shots=$10, total_shots_on_target=$11,
  total_key_passes=$12, total_chances_created=$13, total_offsides=$14, total_own_goals=$15,
  total_passes=$16, total_passes_completed=$17,
  total_saves=$18, total_saves_caught=$19, total_goals_conceded=$20,
  total_interceptions=$21, total_tackles=$22, total_tackles_completed=$23,
  total_fouls=$24, total_fouls_suffered=$25,
  total_yellow_cards=$26, total_red_cards=$27,
  total_distance=$28, total_possession=$29,
  avg_possession_pct=$30, shot_accuracy=$31, pass_accuracy=$32
"""


def item_to_row(item: dict) -> tuple:
    apps = item.get("appearances") or 0
    return (
        item.get("steamID") or "",
        apps,
        ri(item.get("substituteAppearances")),
        ri(item.get("wins")),
        ri(item.get("draws")),
        ri(item.get("losses")),
        ri(item.get("goals")),
        ri(item.get("assists")),
        ri(item.get("secondAssists")),
        ri(item.get("shots")),
        ri(item.get("shotsOnGoal")),
        ri(item.get("keyPasses")),
        ri(item.get("chancesCreated")),
        ri(item.get("offsides")),
        ri(item.get("ownGoals")),
        ri(item.get("passes")),
        ri(item.get("passesCompleted")),
        ri(item.get("keeperSaves")),
        ri((item.get("keeperSavesCaughtAverage") or 0) * apps),
        ri(item.get("goalsConceded")),
        ri(item.get("interceptions")),
        ri((item.get("slidingTacklesAverage") or 0) * apps),
        ri((item.get("slidingTacklesCompletedAverage") or 0) * apps),
        ri(item.get("fouls")),
        ri(item.get("foulsSuffered")),
        ri(item.get("yellowCards")),
        ri(item.get("redCards")),
        ri((item.get("distanceCoveredAverage") or 0) * apps),
        ri((item.get("possessionAverage") or 0) * apps),
        rf(item.get("possessionPercentageAverage")),
        rf((item.get("shotAccuracyPercentage") or 0) * 100),
        rf((item.get("passCompletionPercentageAverage") or 0) * 100),
    )


async def upsert_chunk(db: asyncpg.Connection, rows: list[tuple]):
    async with db.transaction():
        for row in rows:
            if not row[0]:          # skip rows with empty steamID
                continue
            await db.execute(UPSERT_SQL, *row)


async def run():
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    async with httpx.AsyncClient(timeout=60) as client:
        # Page 1 → get totalPages
        items, total_pages = await fetch_page(client, 1)
        all_items = list(items)
        print(f"Total pages: {total_pages} (~{total_pages * PAGE_SIZE} players)")

        # Remaining pages in parallel batches
        for start in range(2, total_pages + 1, CONCURRENCY):
            end = min(start + CONCURRENCY - 1, total_pages)
            batch = await asyncio.gather(*[fetch_page(client, p) for p in range(start, end + 1)])
            for page_items, _ in batch:
                all_items.extend(page_items)
            print(f"  Fetched pages {start}-{end} ({len(all_items)} items so far)")

    print(f"\nTotal items: {len(all_items)}. Upserting...")
    rows = [item_to_row(item) for item in all_items]

    # Reconnect — original connection may have timed out during long fetch
    try:
        await db.close()
    except Exception:
        pass
    db = await asyncpg.connect(os.getenv('DIRECT_URL') or os.getenv('DATABASE_URL'))

    for i in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[i:i + UPSERT_CHUNK]
        await upsert_chunk(db, chunk)
        print(f"  {min(i + UPSERT_CHUNK, len(rows))}/{len(rows)} upserted")

    # Count
    count = await db.fetchval("SELECT COUNT(*) FROM mv_player_leaderboard")
    print(f"\nDone. mv_player_leaderboard now has {count} rows.")
    await db.close()


asyncio.run(run())
