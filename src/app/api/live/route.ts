import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 30;

export async function GET() {
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

    // Save completed matches (FULL TIME) to the database
    if (Array.isArray(data)) {
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

          // Parse date from createdDate
          let matchDate: Date;
          try {
            matchDate = new Date(meta.createdDate);
            if (isNaN(matchDate.getTime())) matchDate = new Date();
          } catch {
            matchDate = new Date();
          }

          const matchType = meta.matchType === 1 ? "competitive" : "friendly";
          const tournamentId = meta.tournamentId || null;

          // Upsert teams
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

          // Insert match from live data
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

    return NextResponse.json(data);
  } catch (err) {
    console.error("[live-scores] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch live scores" },
      { status: 500 },
    );
  }
}
