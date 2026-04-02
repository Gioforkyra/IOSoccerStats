import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "";

// User-Agent patterns for aggressive crawlers/scrapers to block
const BLOCKED_UA_PATTERNS = [
  /SemrushBot/i,
  /AhrefsBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /PetalBot/i,
  /serpstatbot/i,
  /DataForSeoBot/i,
  /Bytespider/i,
  /GPTBot/i,
  /ClaudeBot/i,
  /Amazonbot/i,
  /PerplexityBot/i,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Block aggressive crawlers on page routes (not on static assets)
  if (!pathname.startsWith("/_next/") && !pathname.startsWith("/favicon")) {
    const ua = req.headers.get("user-agent") ?? "";
    if (BLOCKED_UA_PATTERNS.some((p) => p.test(ua))) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }
  }

  // Only apply CORS to API routes
  if (!pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const origin = req.headers.get("origin") ?? "";
  const host = req.headers.get("host") ?? "";

  // Derive allowed origin: same host or explicitly set NEXT_PUBLIC_SITE_URL
  const allowedOrigin =
    PRODUCTION_ORIGIN ||
    (host ? `https://${host}` : "");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders(origin, allowedOrigin),
    });
  }

  const res = NextResponse.next();

  // Attach CORS + security headers
  for (const [key, value] of Object.entries(corsHeaders(origin, allowedOrigin))) {
    res.headers.set(key, value);
  }

  return res;
}

function corsHeaders(
  requestOrigin: string,
  allowedOrigin: string,
): Record<string, string> {
  // Allow same-origin requests and the production domain
  const allow =
    !requestOrigin ||
    requestOrigin === allowedOrigin ||
    requestOrigin.endsWith(".vercel.app")
      ? requestOrigin || allowedOrigin
      : "";

  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  };
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
