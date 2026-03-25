import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const API_BASE = "https://iosoccer.com:44380/api";
const HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

const MAX_ATTEMPTS = 50; // how many IDs ahead to probe
const BATCH_SIZE = 5; // concurrent fetches

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

export async function GET() {
  try {
    // Find the highest match ID we have
    const latest = await prisma.$queryRaw<[{ max_id: number }]>`
      SELECT COALESCE(MAX(id), 0) AS max_id FROM matches
    `;
    const lastId = Number(latest[0].max_id);

    let inserted = 0;
    let emptyStreak = 0;
    let currentId = lastId + 1;

    while (emptyStreak < MAX_ATTEMPTS && inserted < 100) {
      // Fetch a batch of IDs concurrently
      const ids = Array.from({ length: BATCH_SIZE }, (_, i) => currentId + i);
      const results = await Promise.all(ids.map(fetchMatch));

      let batchHasMatch = false;
      for (let i = 0; i < results.length; i++) {
        const raw = results[i];
        if (!raw) continue;

        batchHasMatch = true;
        try {
          const m = parseMatch(raw);
          if (!m.homeTeamId || !m.awayTeamId) continue;

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
            INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score, match_type, status, map, server, potm, field_min_x, field_min_y, field_max_x, field_max_y)
            VALUES (${m.id}, ${m.date}, ${m.homeTeamId}, ${m.awayTeamId}, ${m.homeScore}, ${m.awayScore}, ${m.matchType}, ${m.status}, ${m.map}, ${m.server}, ${m.potm}, ${m.fieldMinX}, ${m.fieldMinY}, ${m.fieldMaxX}, ${m.fieldMaxY})
            ON CONFLICT (id) DO NOTHING
          `;
          inserted++;
        } catch (err) {
          console.error(`[sync] Error inserting match ${raw.id}:`, err);
        }
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
