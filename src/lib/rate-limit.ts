import { NextRequest, NextResponse } from "next/server";

type Bucket = { count: number; reset: number };

const buckets = new Map<string, Bucket>();

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export function isRateLimited(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > limit;
}

export function rateLimit(
  req: NextRequest,
  opts: { scope: string; limit: number; windowMs?: number } = {
    scope: "default",
    limit: 60,
  }
): NextResponse | null {
  const { scope, limit, windowMs = 60_000 } = opts;
  const ip = getClientIp(req);
  const key = `${scope}:${ip}`;
  if (isRateLimited(key, limit, windowMs)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  return null;
}
