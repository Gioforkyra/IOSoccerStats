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

/** Fetch recent match IDs via POST /api/match (the official list endpoint) */
async function fetchRecentMatchIds(): Promise<number[]> {
  try {
    const res = await fetch(`${API_BASE}/match`, {
      method: "POST",
      headers: { ...HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        page: 1,
        pageSize: 100,
        sortBy: "KickOff",
        sortOrder: "DESC",
        filters: { includePast: true },
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = data?.items || [];
    return items
      .map((m: any) => m.id)
      .filter((id: any) => typeof id === "number");
  } catch {
    return [];
  }
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
  KeeperSavesCaught: 24,
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
      ON CONFLICT (id) DO UPDATE SET tournament_id = COALESCE(EXCLUDED.tournament_id, matches.tournament_id)
    `;

    // Insert players and player stats
    const players: any[] = md.players || [];
    for (const p of players) {
      const rawSteamId = p.info?.steamId;
      const name = p.info?.name;
      if (!rawSteamId || !name) continue;

      const steamId = normalizeSteamId(rawSteamId);

      // Aggregate stats across all periods
      const periods: any[] = p.matchPeriodData || [];
      if (periods.length === 0) continue;

      let teamSide = "home";
      let position: string | null = null;
      const totals = new Array(28).fill(0);

      // A player is a substitute if their first period starts after the match kickoff
      const firstPeriod = periods[0]?.info || {};
      const isSubstitute = (firstPeriod.startSecond || 0) > 0;

      for (const period of periods) {
        const info = period.info || {};
        teamSide = info.team === "away" ? "away" : "home";
        if (!position) position = info.position || null;

        const stats: number[] = period.statistics || [];
        for (let i = 0; i < stats.length; i++) {
          totals[i] += stats[i] || 0;
        }
      }

      // Upsert player
      await prisma.$executeRaw`
        INSERT INTO players (steam_id, username, created_at, updated_at)
        VALUES (${steamId}, ${name}, NOW(), NOW())
        ON CONFLICT (steam_id) DO UPDATE SET
          username = EXCLUDED.username,
          updated_at = NOW()
      `;

      // Insert player match stats
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
          ${m.id}, ${steamId}, ${teamSide}, ${position},
          ${totals[S.Goals]}, ${totals[S.Assists]}, ${0}, ${totals[S.Shots]}, ${totals[S.ShotsOnGoal]},
          ${totals[S.Passes]}, ${totals[S.PassesCompleted]}, ${0}, ${0},
          ${totals[S.Interceptions]}, ${totals[S.KeeperSaves]}, ${totals[S.KeeperSavesCaught]}, ${totals[S.Offsides]}, ${totals[S.Fouls]}, ${totals[S.FoulsSuffered]},
          ${totals[S.YellowCards]}, ${totals[S.RedCards]}, ${totals[S.OwnGoals]}, ${totals[S.GoalsConceded]},
          ${totals[S.Corners]}, ${totals[S.ThrowIns]}, ${totals[S.FreeKicks]}, ${totals[S.GoalKicks]}, ${totals[S.Penalties]},
          ${totals[S.DistanceCovered]}, ${totals[S.Possession]}, ${minutesPlayed}, ${isSubstitute}, ${name === m.potm},
          ${totals[S.SlidingTackles]}, ${totals[S.SlidingTacklesCompleted]}
        )
        ON CONFLICT (match_id, player_steam_id) DO NOTHING
      `;
    }

    return true;
  } catch (err) {
    console.error(`[sync] Error inserting match ${raw.id}:`, err);
    return false;
  }
}

export async function GET() {
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
      // Find which recent matches already have player stats
      const minId = Math.min(...recentIds);
      const matchesWithStats = await prisma.$queryRaw<{ match_id: number }[]>`
        SELECT DISTINCT match_id FROM match_player_stats
        WHERE match_id >= ${minId}
      `;
      const hasStatsSet = new Set(matchesWithStats.map((r) => r.match_id));

      // Process matches that are new OR exist but have no player stats
      const toProcess = recentIds.filter(
        (id) => id > lastId || !hasStatsSet.has(id),
      );

      for (const id of toProcess) {
        const raw = await fetchMatch(id);
        if (raw) {
          const ok = await insertMatch(raw);
          if (ok) inserted++;
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
    });
  } catch (err) {
    console.error("[sync-matches] error:", err);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
