import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Deprecated endpoint: leaderboard sync has been disabled because player statistics are sourced from official API.",
    },
    { status: 410 }
  );
}
