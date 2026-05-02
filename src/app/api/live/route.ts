import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isIosoccerApiDown, tripIosoccerApiCircuit, isFatalConnectionError } from "@/lib/iosoccer-api";

export const revalidate = 30;

/* ── YouTube stream lookup ─────────────────────────────────────── */

const YT_CHANNEL_ID = "UClLkVhbu_2qXPSew8896q_w";
const YT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

let ytCache: { streams: YtStream[]; ts: number } = { streams: [], ts: 0 };

type YtStream = { videoId: string; title: string };

function isStreamingHours(): boolean {
  const now = new Date();
  const rome = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "numeric",
    hour12: false,
  }).format(now);
  const hour = parseInt(rome, 10);
  return hour >= 18 && hour <= 22; // 18:00-22:59 to catch early starts
}

async function getYouTubeStreams(): Promise<YtStream[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey || !isStreamingHours()) return [];

  // Return cached result if fresh
  if (Date.now() - ytCache.ts < YT_CACHE_TTL) return ytCache.streams;

  try {
    const url = `https://www.googleapis.com/youtube/v3/search?channelId=${YT_CHANNEL_ID}&eventType=live&type=video&part=snippet&maxResults=5&key=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) {
      ytCache = { streams: [], ts: Date.now() };
      return [];
    }
    const data = await res.json();
    const streams: YtStream[] = (data.items || []).map((item: any) => ({
      videoId: item.id?.videoId,
      title: item.snippet?.title || "",
    }));
    ytCache = { streams, ts: Date.now() };
    return streams;
  } catch {
    ytCache = { streams: [], ts: Date.now() };
    return [];
  }
}

function matchStreamToGame(
  streams: YtStream[],
  homeTeam: string,
  awayTeam: string,
): string | null {
  if (streams.length === 0) return null;
  const homeLower = homeTeam.toLowerCase();
  const awayLower = awayTeam.toLowerCase();
  for (const s of streams) {
    const titleLower = s.title.toLowerCase();
    if (titleLower.includes(homeLower) || titleLower.includes(awayLower)) {
      return `https://www.youtube.com/watch?v=${s.videoId}`;
    }
  }
  // If only one stream is live, it's probably the current match
  if (streams.length === 1) {
    return `https://www.youtube.com/watch?v=${streams[0].videoId}`;
  }
  return null;
}

function shouldPersistMatches(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get("persist") !== "1") return false;

  const token = process.env.LIVE_PERSIST_TOKEN;
  if (!token) return false;

  const provided = req.headers.get("x-live-token");
  return provided === token;
}

async function persistCompletedMatches(data: unknown) {
  if (!Array.isArray(data)) return;

  for (const m of data) {
    try {
      const meta = m.item1;
      const live = m.item2;
      if (!meta || !live) continue;
      if (live.matchPeriod !== "FULL TIME") continue;

      const matchId = meta.id;
      const homeTeam = meta.teamHome;
      const awayTeam = meta.teamAway;
      if (!matchId || !homeTeam?.id || !awayTeam?.id) continue;

      let matchDate: Date;
      try {
        matchDate = new Date(meta.createdDate);
        if (isNaN(matchDate.getTime())) matchDate = new Date();
      } catch {
        matchDate = new Date();
      }

      const matchType = meta.matchType === 1 ? "competitive" : "friendly";
      const tournamentId = meta.tournamentId || null;

      for (const team of [homeTeam, awayTeam]) {
        const logo = team.badgeImage?.smallUrl || null;
        const slug = team.teamCode || "UNK";
        await prisma.$executeRaw`
          INSERT INTO teams (id, name, slug, logo, color, inactive)
          VALUES (${team.id}, ${team.name}, ${slug}, ${logo}, ${team.color || null}, ${team.inactive || false})
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            logo = EXCLUDED.logo,
            color = EXCLUDED.color,
            inactive = EXCLUDED.inactive
        `;
      }

      await prisma.$executeRaw`
        INSERT INTO matches (id, date, home_team_id, away_team_id, home_score, away_score, match_type, status, tournament_id, map, server)
        VALUES (
          ${matchId}, ${matchDate}, ${homeTeam.id}, ${awayTeam.id},
          ${live.matchGoalsHome || 0}, ${live.matchGoalsAway || 0},
          ${matchType}, ${"completed"}, ${tournamentId},
          ${live.mapName || null}, ${meta.server?.name || null}
        )
        ON CONFLICT (id) DO UPDATE SET
          home_score = EXCLUDED.home_score,
          away_score = EXCLUDED.away_score,
          status = 'completed',
          tournament_id = COALESCE(EXCLUDED.tournament_id, matches.tournament_id)
      `;
    } catch (err) {
      console.error("[live] Error saving match:", err);
    }
  }
}

export async function GET(request: Request) {
  if (isIosoccerApiDown()) {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30",
        "CDN-Cache-Control": "public, s-maxage=30",
        "X-IOS-Api-Status": "circuit-open",
      },
    });
  }

  try {
    const res = await fetch(
      "https://iosoccer.com:44380/api/match/live-scores/1",
      {
        headers: {
          Accept: "application/json",
          Origin: "https://www.iosoccer.com",
        },
      },
    );

    if (!res.ok) {
      if (res.status >= 500) tripIosoccerApiCircuit(`HTTP ${res.status}`);
      return NextResponse.json([], {
        headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
      });
    }

    const data = await res.json();

    // Keep live polling fast/cheap for users; persist only via authenticated cron/job call.
    if (shouldPersistMatches(request)) {
      await persistCompletedMatches(data);
    }

    // Attach YouTube stream links to competitive matches
    if (Array.isArray(data)) {
      const compMatches = data.filter((m: any) => m.item1?.tournamentId != null);
      if (compMatches.length > 0) {
        const streams = await getYouTubeStreams();
        for (const m of compMatches) {
          const link = matchStreamToGame(
            streams,
            m.item1.teamHome?.name || "",
            m.item1.teamAway?.name || "",
          );
          if (link) m.youtubeUrl = link;
        }
      }
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=30, s-maxage=30, stale-while-revalidate=15",
        "CDN-Cache-Control": "public, s-maxage=30, stale-while-revalidate=15",
      },
    });
  } catch (err) {
    if (isFatalConnectionError(err)) {
      const code = (err as { code?: string; cause?: { code?: string } }).code
        ?? (err as { cause?: { code?: string } }).cause?.code
        ?? "fetch failed";
      tripIosoccerApiCircuit(code);
    } else {
      console.error("[live-scores] fetch failed:", err);
    }
    return NextResponse.json([], {
      headers: { "Cache-Control": "public, max-age=30, s-maxage=30" },
    });
  }
}
