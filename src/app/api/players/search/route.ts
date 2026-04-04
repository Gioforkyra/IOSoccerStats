import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

type Row = {
  steam_id: string;
  username: string;
  avatar: string | null;
};

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json([]);

  const pattern = `%${q}%`;
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT p.steam_id, p.username, p.avatar
    FROM players p
    WHERE p.username ILIKE ${pattern}
    ORDER BY p.username ASC
    LIMIT 30
  `;

  return NextResponse.json(rows);
}
