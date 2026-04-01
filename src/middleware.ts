import { NextRequest, NextResponse } from "next/server";

const PRODUCTION_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || "";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only apply to API routes
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
  matcher: "/api/:path*",
};
