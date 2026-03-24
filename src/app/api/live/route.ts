import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetch(
      "https://iosoccer.com:44380/api/match/live-scores/1",
      {
        headers: {
          Accept: "application/json",
          Origin: "https://www.iosoccer.com",
        },
        next: { revalidate: 0 },
      },
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream API error", status: res.status },
        { status: 502 },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[live-scores] fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch live scores" },
      { status: 500 },
    );
  }
}
