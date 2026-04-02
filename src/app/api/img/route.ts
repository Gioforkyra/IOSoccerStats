import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = ["www.iosoccer.com", "iosoccer.com", "www.iosoccer.co.uk", "iosoccer.co.uk"];

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) return new NextResponse("Missing url", { status: 400 });

  try {
    const parsed = new URL(url);
    if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
      return new NextResponse("Host not allowed", { status: 403 });
    }

    const res = await fetch(url, {
      headers: {
        Referer: "https://www.iosoccer.com/",
        Origin: "https://www.iosoccer.com",
      },
    });

    if (!res.ok) return new NextResponse("Not found", { status: 404 });

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/png";

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, s-maxage=604800, max-age=604800, stale-while-revalidate=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("Error", { status: 500 });
  }
}
