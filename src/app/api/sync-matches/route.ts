import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const API_BASE = "https://iosoccer.com:44380/api";
const HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

const MAX_EMPTY = 200; // how many consecutive empty IDs before stopping
const BATCH_SIZE = 10; // concurrent fetches per batch

async function fetchMatch(id: number): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/match/${id}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.matchStatistics?.matchData) return data;
    return null;
  } catch {
    return null;
  }
}

/** Fetch a page of match IDs from the API list endpoint */
async function fetchMatchPage(
  page: number,
  extraBody: Record<string, any> = {},
): Promise<{ ids: number[]; totalItems: number }> {
  try {
    const res = await fetch(`${API_BASE}/match`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        page,
        pageSize: 100,
        sortBy: "KickOff",
        sortOrder: "DESC",
        filters: { includePast: true },
        ...extraBody,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { ids: [], totalItems: 0 };
    const data = await res.json();
    const items = data?.items || [];
    return {
      ids: items.map((m: any) => m.id).filter((id: any) => typeof id === "number"),
      totalItems: data?.totalItems || 0,
    };
  } catch {
    return { ids: [], totalItems: 0 };
  }
}

/** Fetch recent match IDs via POST /api/match — multiple pages, both types */
async function fetchRecentMatchIds(): Promise<number[]> {
  const allIds = new Set<number>();

  // Try fetching without matchType filter first (3 pages = 300 matches)
  for (let page = 1; page <= 3; page++) {
    const { ids } = await fetchMatchPage(page);
    if (ids.length === 0) break;
    for (const id of ids) allIds.add(id);
  }

  // Also try with explicit matchType=2 for competitive matches
  // (the default might only return friendly)
  for (const extraBody of [
    { matchType: 2 },
    { filters: { includePast: true, matchType: 2 } },
  ]) {
    const { ids } = await fetchMatchPage(1, extraBody);
    if (ids.length > 0) {
      for (const id of ids) allIds.add(id);
      // This format works, fetch page 2 too
      const p2 = await fetchMatchPage(2, extraBody);
      for (const id of p2.ids) allIds.add(id);
      break;
    }
  }

  return [...allIds];
}

function parseMatch(raw: any) {
  const ms = raw.matchStatistics;
  const md = ms.matchData;
  const mi = md.matchInfo || {};

  const homeTeam = raw.teamHome || {};
  const awayTeam = raw.teamAway || {};

  const kickOffStr = raw.kickOff || ms.kickOff || "";
  let kickOff: Date;
  try {
    kickOff = new Date(kickOffStr);
    if (isNaN(kickOff.getTime())) kickOff = new Date();
  } catch {
    kickOff = new Date();
  }

  const matchTypeRaw = raw.matchType || 1;
  const mapObj = raw.map || {};
  const serverObj = raw.server || {};
  const potmObj = raw.playerOfTheMatch || {};
  const fieldMin = mi.fieldMin || { x: -1554, y: -2406 };
  const fieldMax = mi.fieldMax || { x: 1554, y: 2406 };

  return {
    id: raw.id as number,
    date: kickOff,
    homeTeamId: raw.teamHomeId as number,
    awayTeamId: raw.teamAwayId as number,
    homeScore: (ms.matchGoalsHome || 0) as number,
    awayScore: (ms.matchGoalsAway || 0) as number,
    matchType: matchTypeRaw === 2 ? "competitive" : "friendly",
    status: "completed",
    tournamentId: (raw.tournamentId as number | null) || null,
    map: mapObj.name || mi.mapName || null,
    server: serverObj.name || null,
    potm: potmObj.name || null,
    fieldMinX: fieldMin.x,
    fieldMinY: fieldMin.y,
    fieldMaxX: fieldMax.x,
    fieldMaxY: fieldMax.y,
    homeTeam: {
      id: raw.teamHomeId,
      name: homeTeam.name || "Unknown",
      slug: homeTeam.teamCode || "UNK",
      logo: homeTeam.badgeImage?.smallUrl || null,
      region: homeTeam.region?.regionName || null,
      color: homeTeam.color || null,
      inactive: homeTeam.inactive || false,
      regionId: homeTeam.region?.id || null,
      teamType: homeTeam.teamType || null,
    },
    awayTeam: {
      id: raw.teamAwayId,
      name: awayTeam.name || "Unknown",
      slug: awayTeam.teamCode || "UNK",
      logo: awayTeam.badgeImage?.smallUrl || null,
      region: awayTeam.region?.regionName || null,
      color: awayTeam.color || null,
      inactive: awayTeam.inactive || false,
      regionId: awayTeam.region?.id || null,
      teamType: awayTeam.teamType || null,
    },
  };
}

// Statistics array index mapping from IOSoccer API
const S = {
  RedCards: 0, YellowCards: 1, Fouls: 2, FoulsSuffered: 3,
  SlidingTackles: 4, SlidingTacklesCompleted: 5, GoalsConceded: 6,
  Shots: 7, ShotsOnGoal: 8, PassesCompleted: 9, Interceptions: 10,
  Offsides: 11, Goals: 12, OwnGoals: 13, Assists: 14, Passes: 15,
  FreeKicks: 16, Penalties: 17, Corners: 18, ThrowIns: 19,
  KeeperSaves: 20, GoalKicks: 21, Possession: 22, DistanceCovered: 23,
  KeeperSavesCaught: 24, KeyPasses: 25, ChancesCreated: 26, SecondAssists: 27,
} as const;

/** Convert Steam3 ID [U:1:X] to Steam64, or return as-is if already Steam64 */
function normalizeSteamId(raw: string): string {
  const m = raw.match(/^\[U:1:(\d+)\]$/);
  if (m) {
    return String(BigInt(m[1]) + BigInt("76561197960265728"));
  }
  return raw;
}

function _normalizeCoord(
  val: number,
  fieldMin: number,
  fieldMax: number,
): number {
  const range = fieldMax - fieldMin;
  if (range === 0) return 0.5;
  return (val - fieldMin) / range;
}

async function insertMatch(raw: any): Promise<boolean> {
  try {
    const m = parseMatch(raw);
    if (!m.homeTeamId || !m.awayTeamId) return false;

    const md = raw.matchStatistics.matchData;
    const mi = md.matchInfo || {};
    const fieldMin = mi.fieldMin || { x: -1554, y: -2406 };
    const fieldMax = mi.fieldMax || { x: 1554, y: 2406 };

    // Upsert teams
    for (const team of [m.homeTeam, m.awayTeam]) {
      await prisma.$executeRaw`
        INSERT INTO teams (id, name, slug, logo, region, color, inactive, region_id, team_type)
        VALUES (${team.id}, ${team.name}, ${team.slug}, ${team.logo}, ${team.region}, ${team.color}, ${team.inactive}, ${team.regionId}, ${team.teamType})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          logo = EXCLUDED.logo,
          color = EXCLUDED.color,
          inactive = EXCLUDED.inactive
      `;
    }

    // Insert match
    await prisma.$executeRaw`
      INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score, match_type, status, tournament_id, map, server, potm, field_min_x, field_min_y, field_max_x, field_max_y)
      VALUES (${m.id}, ${m.date}, ${m.homeTeamId}, ${m.awayTeamId}, ${m.homeScore}, ${m.awayScore}, ${m.matchType}, ${m.status}, ${m.tournamentId}, ${m.map}, ${m.server}, ${m.potm}, ${m.fieldMinX}, ${m.fieldMinY}, ${m.fieldMaxX}, ${m.fieldMaxY})
      ON CONFLICT (id) DO UPDATE SET
        tournament_id = COALESCE(EXCLUDED.tournament_id, matches.tournament_id),
        match_type = EXCLUDED.match_type,
        potm = COALESCE(EXCLUDED.potm, matches.potm),
        server = COALESCE(EXCLUDED.server, matches.server),
        home_score = EXCLUDED.home_score,
        away_score = EXCLUDED.away_score
    `;

    // Insert players and player stats
    const players: any[] = md.players || [];
    for (const p of players) {
      const rawSteamId = p.info?.steamId;
      const name = p.info?.name;
      if (!rawSteamId || !name) continue;

      const steamId = normalizeSteamId(rawSteamId);

      // Group periods by team side (handles shared GK who plays for both teams)
      const periods: any[] = p.matchPeriodData || [];
      if (periods.length === 0) continue;

      const byTeam: Record<string, { totals: number[]; position: string | null; isSub: boolean }> = {};
      for (const period of periods) {
        const info = period.info || {};
        const side = info.team === "away" ? "away" : "home";
        if (!byTeam[side]) {
          // First period for this team side — sub if it starts after kickoff
          byTeam[side] = {
            totals: new Array(28).fill(0),
            position: info.position || null,
            isSub: (info.startSecond || 0) > 0,
          };
        }
        if (!byTeam[side].position) byTeam[side].position = info.position || null;
        const stats: number[] = period.statistics || [];
        for (let i = 0; i < stats.length; i++) {
          byTeam[side].totals[i] += stats[i] || 0;
        }
      }

      // Upsert player
      await prisma.$executeRaw`
        INSERT INTO players (steam_id, username, created_at, updated_at)
        VALUES (${steamId}, ${name}, NOW(), NOW())
        ON CONFLICT (steam_id) DO UPDATE SET
          username = CASE
            WHEN players.username IS NULL OR players.username = '' OR LOWER(players.username) = 'unknown'
            THEN EXCLUDED.username
            ELSE players.username
          END,
          updated_at = NOW()
      `;

      // Insert one stat record per team side
      for (const [teamSide, data] of Object.entries(byTeam)) {
        const totals = data.totals;
        const minutesPlayed = Math.round(totals[S.Possession] / 10);
        await prisma.$executeRaw`
          INSERT INTO match_player_stats (
            match_id, player_steam_id, team_side, position,
            goals, assists, second_assists, shots, shots_on_target,
            passes, passes_completed, key_passes, chances_created,
            interceptions, saves, saves_caught, offsides, fouls, fouls_suffered,
            yellow_cards, red_cards, own_goals, goals_conceded,
            corners, throw_ins, free_kicks, goal_kicks, penalties,
            distance_run, possession, minutes_played, is_substitute, is_potm,
            sliding_tackles, sliding_tackles_completed
          ) VALUES (
            ${m.id}, ${steamId}, ${teamSide}, ${data.position},
            ${totals[S.Goals]}, ${totals[S.Assists]}, ${totals[S.SecondAssists]}, ${totals[S.Shots]}, ${totals[S.ShotsOnGoal]},
            ${totals[S.Passes]}, ${totals[S.PassesCompleted]}, ${totals[S.KeyPasses]}, ${totals[S.ChancesCreated]},
            ${totals[S.Interceptions]}, ${totals[S.KeeperSaves]}, ${totals[S.KeeperSavesCaught]}, ${totals[S.Offsides]}, ${totals[S.Fouls]}, ${totals[S.FoulsSuffered]},
            ${totals[S.YellowCards]}, ${totals[S.RedCards]}, ${totals[S.OwnGoals]}, ${totals[S.GoalsConceded]},
            ${totals[S.Corners]}, ${totals[S.ThrowIns]}, ${totals[S.FreeKicks]}, ${totals[S.GoalKicks]}, ${totals[S.Penalties]},
            ${totals[S.DistanceCovered]}, ${totals[S.Possession]}, ${minutesPlayed}, ${data.isSub}, ${name === m.potm},
            ${totals[S.SlidingTackles]}, ${totals[S.SlidingTacklesCompleted]}
          )
          ON CONFLICT (match_id, player_steam_id, team_side) DO UPDATE SET
            position = EXCLUDED.position,
            goals = EXCLUDED.goals, assists = EXCLUDED.assists, second_assists = EXCLUDED.second_assists,
            shots = EXCLUDED.shots, shots_on_target = EXCLUDED.shots_on_target,
            passes = EXCLUDED.passes, passes_completed = EXCLUDED.passes_completed,
            key_passes = EXCLUDED.key_passes, chances_created = EXCLUDED.chances_created,
            interceptions = EXCLUDED.interceptions, saves = EXCLUDED.saves, saves_caught = EXCLUDED.saves_caught,
            offsides = EXCLUDED.offsides, fouls = EXCLUDED.fouls, fouls_suffered = EXCLUDED.fouls_suffered,
            yellow_cards = EXCLUDED.yellow_cards, red_cards = EXCLUDED.red_cards,
            own_goals = EXCLUDED.own_goals, goals_conceded = EXCLUDED.goals_conceded,
            corners = EXCLUDED.corners, throw_ins = EXCLUDED.throw_ins, free_kicks = EXCLUDED.free_kicks,
            goal_kicks = EXCLUDED.goal_kicks, penalties = EXCLUDED.penalties,
            distance_run = EXCLUDED.distance_run, possession = EXCLUDED.possession,
            minutes_played = EXCLUDED.minutes_played, is_substitute = EXCLUDED.is_substitute,
            is_potm = EXCLUDED.is_potm,
            sliding_tackles = EXCLUDED.sliding_tackles, sliding_tackles_completed = EXCLUDED.sliding_tackles_completed
        `;
      }
    }

    return true;
  } catch (err) {
    console.error(`[sync] Error inserting match ${raw.id}:`, err);
    return false;
  }
}

export async function GET(req: Request) {
  const secret = process.env.SYNC_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SYNC_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find the highest match ID we have
    const latest = await prisma.$queryRaw<[{ max_id: number }]>`
      SELECT COALESCE(MAX(id), 0) AS max_id FROM matches
    `;
    const lastId = Number(latest[0].max_id);
    let inserted = 0;

    // Strategy 1: Use POST /api/match to get the latest match IDs
    const recentIds = await fetchRecentMatchIds();
    if (recentIds.length > 0) {
      // Find which matches already exist with player stats in our DB
      const minId = Math.min(...recentIds);
      const existingMatches = await prisma.$queryRaw<{ id: number }[]>`
        SELECT m.id FROM matches m
        WHERE m.id >= ${minId}
          AND EXISTS (SELECT 1 FROM match_player_stats mps WHERE mps.match_id = m.id)
      `;
      const existsSet = new Set(existingMatches.map((r) => r.id));

      // Process matches that don't exist in DB or have no player stats
      const toProcess = recentIds.filter((id) => !existsSet.has(id));

      // Fetch in parallel batches
      for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
        const batch = toProcess.slice(i, i + BATCH_SIZE);
        const results = await Promise.all(batch.map(fetchMatch));
        for (const raw of results) {
          if (raw) {
            const ok = await insertMatch(raw);
            if (ok) inserted++;
          }
        }
      }
    }

    // Strategy 2: Probe sequentially from last known ID
    let emptyStreak = 0;
    let currentId = lastId + 1;

    while (emptyStreak < MAX_EMPTY && inserted < 200) {
      const ids = Array.from({ length: BATCH_SIZE }, (_, i) => currentId + i);
      const results = await Promise.all(ids.map(fetchMatch));

      let batchHasMatch = false;
      for (const raw of results) {
        if (!raw) continue;
        batchHasMatch = true;
        const ok = await insertMatch(raw);
        if (ok) inserted++;
      }

      if (batchHasMatch) {
        emptyStreak = 0;
      } else {
        emptyStreak += BATCH_SIZE;
      }

      currentId += BATCH_SIZE;
    }

    return NextResponse.json({
      ok: true,
      lastId,
      checked: currentId - lastId - 1,
      inserted,
      recentIdsCount: recentIds.length,
    });
  } catch (err) {
    console.error("[sync-matches] error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
