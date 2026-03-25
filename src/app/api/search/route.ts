import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type SearchRow = {
  type: string;
  id: string;
  name: string;
  extra: string | null;
};

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json([]);

  const containsPattern = `%${q}%`;

  const results = await prisma.$queryRaw<SearchRow[]>`
    (
      SELECT 'player' AS type, p.steam_id AS id, p.username AS name, p.position AS extra
      FROM players p
      WHERE p.username ILIKE ${containsPattern}
      ORDER BY p.username
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

  return NextResponse.json(results);
}
