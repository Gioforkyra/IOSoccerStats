const BASE = "https://iosoccer.com:44380/api";
const HEADERS = {
  "Content-Type": "application/json",
  "Origin": "https://www.iosoccer.com",
  "Referer": "https://www.iosoccer.com/",
};

// Only allow these specific path prefixes
const ALLOWED_PATHS = [
  "/team/",
  "/player-team/",
  "/tournaments",
  "/match",
  "/player-statistics/",
];

function isAllowedPath(path: string | null): boolean {
  if (!path) return false;
  return ALLOWED_PATHS.some((prefix) => path.startsWith(prefix));
}

// Rate limiter: max 60 requests per IP per minute
const proxyRateLimit = new Map<string, { count: number; reset: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = proxyRateLimit.get(ip);
  if (!entry || now > entry.reset) {
    proxyRateLimit.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > 60;
}

export async function GET(request: Request) {
  const ip = (request.headers as any).get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

  const path = new URL(request.url).searchParams.get("path");
  if (!isAllowedPath(path)) {
    return Response.json({ error: "Path not allowed" }, { status: 403 });
  }
  try {
    const res = await fetch(`${BASE}${path}`, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const ip = (request.headers as any).get?.("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip)) return Response.json({ error: "Too many requests" }, { status: 429 });

  const path = new URL(request.url).searchParams.get("path");
  if (!isAllowedPath(path)) {
    return Response.json({ error: "Path not allowed" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    return Response.json(data);
  } catch {
    return Response.json({ error: "Upstream error" }, { status: 502 });
  }
}
