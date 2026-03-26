import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_BASE = "https://iosoccer.com:44380/api";
const HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
  "Content-Type": "application/json",
};

/** Test different body shapes to discover which one returns competitive matches */
export async function GET() {
  const results: Record<string, any> = {};

  const bodies = [
    { label: "no-filter", body: { page: 1, pageSize: 10, sortBy: "KickOff", sortOrder: "DESC", filters: { includePast: true } } },
    { label: "matchType-1-top", body: { page: 1, pageSize: 10, sortBy: "KickOff", sortOrder: "DESC", matchType: 1, filters: { includePast: true } } },
    { label: "matchType-2-top", body: { page: 1, pageSize: 10, sortBy: "KickOff", sortOrder: "DESC", matchType: 2, filters: { includePast: true } } },
    { label: "matchType-1-filter", body: { page: 1, pageSize: 10, sortBy: "KickOff", sortOrder: "DESC", filters: { includePast: true, matchType: 1 } } },
    { label: "matchType-2-filter", body: { page: 1, pageSize: 10, sortBy: "KickOff", sortOrder: "DESC", filters: { includePast: true, matchType: 2 } } },
  ];

  for (const { label, body } of bodies) {
    try {
      const res = await fetch(`${API_BASE}/match`, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        results[label] = { status: res.status, error: await res.text().catch(() => "?") };
        continue;
      }
      const data = await res.json();
      const items = (data?.items || []).slice(0, 5);
      results[label] = {
        totalItems: data?.totalItems,
        returnedCount: (data?.items || []).length,
        sample: items.map((m: any) => ({
          id: m.id,
          matchType: m.matchType,
          kickOff: m.kickOff,
          home: m.teamHome?.name,
          away: m.teamAway?.name,
          tournament: m.tournament?.name || null,
        })),
      };
    } catch (e: any) {
      results[label] = { error: e.message };
    }
  }

  return NextResponse.json(results, { status: 200 });
}
