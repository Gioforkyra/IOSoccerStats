import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type SearchRow = {
  type: string;
  id: string;
  name: string;
  extra: string | null;
};

// Simple in-memory rate limiter: max 30 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 30;
}

export async function GET(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2 || q.length > 50) return NextResponse.json([]);

  const containsPattern = `%${q}%`;

  const results = await prisma.$queryRaw<SearchRow[]>`
    (
      SELECT
        'player' AS type,
        p.steam_id AS id,
        p.username AS name,
        COALESCE(
          (
            SELECT mps.position
            FROM match_player_stats mps
            WHERE mps.player_steam_id = p.steam_id AND mps.position IS NOT NULL
            GROUP BY mps.position
            ORDER BY COUNT(*) DESC
            LIMIT 1
          ),
          p.position
        ) AS extra
      FROM players p
      WHERE p.username ILIKE ${containsPattern}
        AND p.iosoccer_id IS NOT NULL
      ORDER BY (SELECT COUNT(*) FROM match_player_stats mps2 WHERE mps2.player_steam_id = p.steam_id) DESC, p.username
      LIMIT 20
    )
    UNION ALL
    (
      SELECT 'team' AS type, t.id::text AS id, t.name AS name, NULL AS extra
      FROM teams t
      WHERE t.name ILIKE ${containsPattern}
        AND t.name NOT IN ('IOSoccer All', 'IOSoccer Overlap', 'IOSoccer Challenge', 'IOSoccer Premier')
      ORDER BY t.name
      LIMIT 10
    )
  `;

  return NextResponse.json(results, {
    headers: {
      "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=30",
      "CDN-Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
    },
  });
}
