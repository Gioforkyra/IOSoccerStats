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

// Common probe paths used by bot scanners targeting WordPress/Joomla/PHP stacks.
const BLOCKED_PROBE_PATH_PATTERNS = [
  /^\/wp-admin(?:\/|$)/i,
  /^\/wordpress\/wp-admin(?:\/|$)/i,
  /^\/wp-login\.php$/i,
  /^\/xmlrpc\.php$/i,
  /^\/\.env(?:\.|$)/i,
  /^\/phpmyadmin(?:\/|$)/i,
  /^\/boaform\//i,
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") ?? "";

  // Force canonical host so direct *.vercel.app traffic does not bypass Cloudflare protections.
  if (host.endsWith(".vercel.app") && PRODUCTION_ORIGIN) {
    try {
      const redirectUrl = new URL(PRODUCTION_ORIGIN);
      redirectUrl.pathname = req.nextUrl.pathname;
      redirectUrl.search = req.nextUrl.search;
      return NextResponse.redirect(redirectUrl, 308);
    } catch {
      // Ignore invalid NEXT_PUBLIC_SITE_URL and continue request.
    }
  }

  if (BLOCKED_PROBE_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) {
    // Return 404 to avoid confirming stack details to scanners.
    return new NextResponse("Not Found", { status: 404 });
  }

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
