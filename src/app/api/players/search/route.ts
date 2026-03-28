import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Row = {
  steam_id: string;
  username: string;
  avatar: string | null;
  apps: bigint;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const pattern = `%${q}%`;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT p.steam_id, p.username, p.avatar, COALESCE(agg.apps, 0)::bigint AS apps
    FROM players p
    LEFT JOIN mv_player_leaderboard agg ON agg.player_steam_id = p.steam_id
    WHERE p.username ILIKE ${pattern}
    ORDER BY COALESCE(agg.apps, 0) DESC
    LIMIT 30
  `;

  return NextResponse.json(rows.map((r) => ({ ...r, apps: Number(r.apps) })));
}
