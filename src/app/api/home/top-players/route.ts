import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSteamAvatar } from "@/lib/steam-avatar";
import { rateLimit } from "@/lib/rate-limit";

export const revalidate = 300;

type Row = {
  steam_id: string;
  username: string;
  avatar: string | null;
  avatar_updated_at: Date | null;
  rating: number;
};

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { scope: "home", limit: 60 });
  if (limited) return limited;

  try {
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT prh.steam_id, p.username, p.avatar, p.avatar_updated_at,
             AVG(prh.rating)::float AS rating
      FROM player_rating_history prh
      JOIN players p ON p.steam_id = prh.steam_id
      WHERE TO_CHAR(DATE_TRUNC('month', prh.recorded_at), 'YYYY-MM') = (
        SELECT TO_CHAR(DATE_TRUNC('month', MAX(recorded_at)), 'YYYY-MM') FROM player_rating_history
      )
      AND prh.rating > 0
      GROUP BY prh.steam_id, p.username, p.avatar, p.avatar_updated_at
      HAVING AVG(prh.rating) > 0
      ORDER BY rating DESC
      LIMIT 10
    `;

    const avatars = await Promise.all(
      rows.map((r) =>
        getSteamAvatar(r.steam_id, r.avatar, r.avatar_updated_at).catch(() => null)
      )
    );

    const players = rows.map((r, i) => ({
      steamId: r.steam_id,
      username: r.username,
      avatar: avatars[i],
    }));

    return NextResponse.json({ players });
  } catch (err) {
    return NextResponse.json({ players: [], error: String(err) }, { status: 500 });
  }
}
