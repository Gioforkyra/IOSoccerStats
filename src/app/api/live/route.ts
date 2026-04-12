import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 30;

function shouldPersistMatches(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("persist") !== "1") return false;

  const token = process.env.LIVE_PERSIST_TOKEN;
  if (!token) return false;

  const provided = req.headers.get("x-live-token");
  return provided === token;
}

async function persistCompletedMatches(data: unknown) {
  if (!Array.isArray(data)) return;

  for (const m of data) {
    try {
      const meta = m.item1;
      const live = m.item2;
      if (!meta || !live) continue;
      if (live.matchPeriod !== "FULL TIME") continue;

      const matchId = meta.id;
      const homeTeam = meta.teamHome;
      const awayTeam = meta.teamAway;
      if (!matchId || !homeTeam?.id || !awayTeam?.id) continue;

      let matchDate: Date;
      try {
        matchDate = new Date(meta.createdDate);
        if (isNaN(matchDate.getTime())) matchDate = new Date();
      } catch {
        matchDate = new Date();
      }

      const matchType = meta.matchType === 1 ? "competitive" : "friendly";
      const tournamentId = meta.tournamentId || null;

      for (const team of [homeTeam, awayTeam]) {
        const logo = team.badgeImage?.smallUrl || null;
        const slug = team.teamCode || "UNK";
        await prisma.$executeRaw`
          INSERT INTO teams (id, name, slug, logo, color, inactive)
          VALUES (${team.id}, ${team.name}, ${slug}, ${logo}, ${team.color || null}, ${team.inactive || false})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo = EXCLUDED.logo,
            color = EXCLUDED.color,
            inactive = EXCLUDED.inactive
        `;
      }

      await prisma.$executeRaw`
        INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score, match_type, status, tournament_id, map, server)
        VALUES (
          ${matchId}, ${matchDate}, ${homeTeam.id}, ${awayTeam.id},
          ${live.matchGoalsHome || 0}, ${live.matchGoalsAway || 0},
          ${matchType}, ${"completed"}, ${tournamentId},
          ${live.mapName || null}, ${meta.server?.name || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          status = 'completed',
          tournament_id = COALESCE(EXCLUDED.tournament_id, matches.tournament_id)
      `;
    } catch (err) {
      console.error("[live] Error saving match:", err);
    }
  }
}

export async function GET(request: Request) {
  try {
    const res = await fetch(
      "https://iosoccer.com:44380/api/match/live-scores/1",
      {
        headers: {
          Accept: "application/json",
          Origin: "https://www.iosoccer.com",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream API error", status: res.status },
        { status: 502 },
      );
    }

    const data = await res.json();

    // Keep live polling fast/cheap for users; persist only via authenticated cron/job call.
    if (shouldPersistMatches(request)) {
      await persistCompletedMatches(data);
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=15",
        "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    console.error("[live-scores] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch live scores" },
      { status: 500 },
    );
  }
}
