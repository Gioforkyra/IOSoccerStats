import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 86400; // 1 day

type Row = { steam_id: string; username: string; rating: number };

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { scope: "home", limit: 60 });
  if (limited) return limited;

  try {
    const periodsRaw = await prisma.$queryRaw<{ period: string }[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', recorded_at), 'YYYY-MM') AS period
      FROM player_rating_history
      GROUP BY DATE_TRUNC('month', recorded_at)
      ORDER BY DATE_TRUNC('month', recorded_at) DESC
      LIMIT 1
    `;
    const selectedPeriod = periodsRaw[0]?.period;
    if (!selectedPeriod) {
      return NextResponse.json({ period: null, players: [] });
    }

    const rows = await prisma.$queryRaw<Row[]>`
      SELECT prh.steam_id, p.username, AVG(prh.rating)::float AS rating
      FROM player_rating_history prh
      JOIN players p ON p.steam_id = prh.steam_id
      WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = ${selectedPeriod}
        AND prh.rating > 0
        AND EXISTS (
          SELECT 1 FROM match_player_stats mps
          JOIN matches m ON m.id = mps.match_id
          JOIN teams t ON t.id = m.home_team_id OR t.id = m.away_team_id
          WHERE mps.player_steam_id = prh.steam_id
            AND t.region_id = 1
        )
      GROUP BY prh.steam_id, p.username
      HAVING AVG(prh.rating) > 0
      ORDER BY rating ASC
    `;

    return NextResponse.json({ period: selectedPeriod, players: rows });
  } catch (err) {
    return NextResponse.json({ period: null, players: [], error: String(err) }, { status: 500 });
  }
}
