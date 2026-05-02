import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getActiveTeams, badgeUrl } from "@/lib/iosoccer-api";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 300;

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { scope: "home", limit: 60 });
  if (limited) return limited;

  try {
    const activeTeams = await getActiveTeams(1, 1);
    const activeIds = activeTeams.map((t) => t.id);
    if (activeIds.length === 0) {
      return NextResponse.json({ teams: [] });
    }

    const rows = await prisma.$queryRaw<{ id: number; avg_rating: number | null }[]>`
      SELECT id, avg_rating FROM teams
      WHERE id = ANY(${activeIds}) AND avg_rating IS NOT NULL
      ORDER BY avg_rating DESC LIMIT 8
    `;

    const teams = rows
      .map((r) => {
        const t = activeTeams.find((x) => x.id === r.id);
        if (!t) return null;
        return {
          id: t.id,
          name: t.name,
          logo: badgeUrl(t.badgeImageId),
          avgRating: r.avg_rating,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ teams });
  } catch {
    // API unavailable — return empty teams so the homepage degrades gracefully
    return NextResponse.json({ teams: [] });
  }
}
