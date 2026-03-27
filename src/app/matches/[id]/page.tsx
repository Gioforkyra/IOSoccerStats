import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import MatchClient from "./MatchClient";

export type MatchPlayer = {
  player_steam_id: string;
  profile_steam_id: string;
  username: string;
  position: string | null;
  team_side: string;
  goals: number;
  assists: number;
  second_assists: number;
  shots: number;
  shots_on_target: number;
  passes: number;
  passes_completed: number;
  key_passes: number;
  chances_created: number;
  interceptions: number;
  saves: number;
  offsides: number;
  fouls: number;
  fouls_suffered: number;
  yellow_cards: number;
  red_cards: number;
  own_goals: number;
  goals_conceded: number;
  corners: number;
  throw_ins: number;
  free_kicks: number;
  goal_kicks: number;
  penalties: number;
  distance_run: number;
  possession: number;
};

export type MatchShot = {
  player_steam_id: string;
  username: string;
  team_side: string;
  goalkeeper_steam_id: string | null;
  goalkeeper_username: string | null;
  assist_username: string | null;
  normalized_x: number;
  normalized_y: number;
  is_goal: boolean;
  is_save: boolean;
  xg: number;
  minute: number | null;
  period: "FIRST HALF" | "SECOND HALF" | null;
};


function estimateXgFromCoords(normalizedX: number, normalizedY: number) {
  const y = Math.min(1, Math.max(0, normalizedY));
  const x = Math.min(1, Math.max(0, normalizedX));
  const goalY = y < 0.5 ? 0 : 1;
  const depth = 1 - Math.abs(goalY - y);
  const centrality = 1 - Math.min(1, Math.abs(x - 0.5) * 2);
  const zoneBoost = Math.max(0, (depth - 0.72) / 0.28);
  const xg = (depth * 0.58) + (centrality * 0.22) + (zoneBoost * 0.20);
  return Math.max(0.02, Math.min(0.75, xg));
}

function normalizeFromField(val: number, min: number, max: number) {
  const range = max - min;
  if (!Number.isFinite(val) || !Number.isFinite(range) || range === 0) return 0.5;
  return Math.min(1, Math.max(0, (val - min) / range));
}

type PlayerInfo = { username: string; team_side: string; position: string | null };

const API_BASE = "https://iosoccer.com:44380/api";
const API_HEADERS = {
  Accept: "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

const STAT_IDX = {
  red_cards: 0,
  yellow_cards: 1,
  fouls: 2,
  fouls_suffered: 3,
  goals_conceded: 6,
  shots: 7,
  shots_on_target: 8,
  passes_completed: 9,
  interceptions: 10,
  offsides: 11,
  goals: 12,
  own_goals: 13,
  assists: 14,
  passes: 15,
  free_kicks: 16,
  penalties: 17,
  corners: 18,
  throw_ins: 19,
  saves: 20,
  goal_kicks: 21,
  possession: 22,
  distance_run: 23,
  key_passes: 25,
  chances_created: 26,
  second_assists: 27,
} as const;

function safeStat(stats: number[], idx: number): number {
  return idx < stats.length ? Number(stats[idx] || 0) : 0;
}

async function fetchMatchApiRaw(matchId: number): Promise<any | null> {
  try {
    const res = await fetch(`${API_BASE}/match/${matchId}`, {
      headers: API_HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function parsePlayerStatsFromApi(raw: any): MatchPlayer[] {
  const md = raw?.matchStatistics?.matchData;
  if (!md) return [];

  const out: MatchPlayer[] = [];
  const players: any[] = md.players || [];
  for (const rp of players) {
    const info = rp?.info || {};
    const steam64 = info.steamId64 ? String(info.steamId64) : (info.steamId ? String(info.steamId) : "");
    if (!steam64) continue;

    const periods: any[] = rp?.matchPeriodData || [];
    if (periods.length === 0) continue;

    const firstInfo = periods[0]?.info || {};
    const team_side = firstInfo.team === "away" ? "away" : "home";
    const position = firstInfo.position || null;

    const totals = new Array(30).fill(0);
    for (const period of periods) {
      const stats: number[] = period?.statistics || [];
      for (let i = 0; i < stats.length; i++) totals[i] += Number(stats[i] || 0);
    }

    out.push({
      player_steam_id: steam64,
      profile_steam_id: steam64,
      username: String(info.name || "Unknown"),
      position,
      team_side,
      goals: safeStat(totals, STAT_IDX.goals),
      assists: safeStat(totals, STAT_IDX.assists),
      second_assists: safeStat(totals, STAT_IDX.second_assists),
      shots: safeStat(totals, STAT_IDX.shots),
      shots_on_target: safeStat(totals, STAT_IDX.shots_on_target),
      passes: safeStat(totals, STAT_IDX.passes),
      passes_completed: safeStat(totals, STAT_IDX.passes_completed),
      key_passes: safeStat(totals, STAT_IDX.key_passes),
      chances_created: safeStat(totals, STAT_IDX.chances_created),
      interceptions: safeStat(totals, STAT_IDX.interceptions),
      saves: safeStat(totals, STAT_IDX.saves),
      offsides: safeStat(totals, STAT_IDX.offsides),
      fouls: safeStat(totals, STAT_IDX.fouls),
      fouls_suffered: safeStat(totals, STAT_IDX.fouls_suffered),
      yellow_cards: safeStat(totals, STAT_IDX.yellow_cards),
      red_cards: safeStat(totals, STAT_IDX.red_cards),
      own_goals: safeStat(totals, STAT_IDX.own_goals),
      goals_conceded: safeStat(totals, STAT_IDX.goals_conceded),
      corners: safeStat(totals, STAT_IDX.corners),
      throw_ins: safeStat(totals, STAT_IDX.throw_ins),
      free_kicks: safeStat(totals, STAT_IDX.free_kicks),
      goal_kicks: safeStat(totals, STAT_IDX.goal_kicks),
      penalties: safeStat(totals, STAT_IDX.penalties),
      distance_run: safeStat(totals, STAT_IDX.distance_run),
      possession: safeStat(totals, STAT_IDX.possession),
    });
  }
  return out;
}

async function fetchShotsFromApi(
  matchId: number,
  playerMap: Map<string, PlayerInfo>,
  rawOverride?: any | null,
): Promise<MatchShot[]> {
  try {
    const raw = rawOverride ?? await fetchMatchApiRaw(matchId);
    const md = raw?.matchStatistics?.matchData;
    if (!md) return [];

    const fieldMin = md.matchInfo?.fieldMin || { x: -1554, y: -2406 };
    const fieldMax = md.matchInfo?.fieldMax || { x: 1554, y: 2406 };
    const events: any[] = md.matchEvents || [];
    const rawPlayers: any[] = md.players || [];

    const steamLookup = new Map<string, string>();
    const apiPlayerInfo = new Map<string, PlayerInfo>();
    for (const rp of rawPlayers) {
      const shortId = rp?.info?.steamId ? String(rp.info.steamId) : "";
      const steam64 = rp?.info?.steamId64 ? String(rp.info.steamId64) : "";
      if (shortId && steam64) steamLookup.set(shortId, steam64);
      if (steam64) steamLookup.set(steam64, steam64);
      if (steam64) {
        const periods: any[] = rp?.matchPeriodData || [];
        const firstInfo = periods[0]?.info || {};
        apiPlayerInfo.set(steam64, {
          username: String(rp?.info?.name || "Unknown"),
          team_side: firstInfo.team === "away" ? "away" : "home",
          position: firstInfo.position || null,
        });
      }
    }

    // Find GKs for each side
    const homeGk = [...playerMap.entries()].find(
      ([, p]) => p.team_side === "home" && (p.position || "").toUpperCase() === "GK"
    );
    const awayGk = [...playerMap.entries()].find(
      ([, p]) => p.team_side === "away" && (p.position || "").toUpperCase() === "GK"
    );

    const shotEvents = events.filter(
      (evt) => ["GOAL", "SAVE", "MISS"].includes(evt?.event) && evt?.startPosition
    );

    // Deduplicate by shooter + event type + second + position
    const seen = new Set<string>();
    const shots: MatchShot[] = [];

    for (const evt of shotEvents) {
      const evtType = evt.event as "GOAL" | "SAVE" | "MISS";
      const pos = evt.startPosition;

      const shooterRaw = evtType === "SAVE" ? evt.player2SteamId : evt.player1SteamId;
      if (!shooterRaw) continue;

      const eventSecond = Number(evt.second || 0);
      const dedupKey = `${shooterRaw}|${evtType}|${eventSecond}|${Number(pos.x).toFixed(2)}|${Number(pos.y).toFixed(2)}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);

      const shooterSteamId = steamLookup.get(String(shooterRaw)) || String(shooterRaw);
      const shooterInfo = playerMap.get(shooterSteamId) || apiPlayerInfo.get(shooterSteamId);
      if (!shooterInfo) {
        console.warn(`[shots] no info for shooter raw=${shooterRaw} resolved=${shooterSteamId}, playerMap size=${playerMap.size}, apiPlayerInfo size=${apiPlayerInfo.size}`);
        continue;
      }

      const normalized_x = normalizeFromField(Number(pos.x), Number(fieldMin.x), Number(fieldMax.x));
      const normalized_y = normalizeFromField(Number(pos.y), Number(fieldMin.y), Number(fieldMax.y));
      const xg = estimateXgFromCoords(normalized_x, normalized_y);
      const minute = evt.second ? Math.floor(Number(evt.second) / 60) : null;
      const period = (evt.period as "FIRST HALF" | "SECOND HALF") || null;

      // Goalkeeper
      let goalkeeper_steam_id: string | null = null;
      let goalkeeper_username: string | null = null;
      if (evtType === "SAVE" && evt.player1SteamId) {
        goalkeeper_steam_id = steamLookup.get(String(evt.player1SteamId)) || String(evt.player1SteamId);
        goalkeeper_username = playerMap.get(goalkeeper_steam_id)?.username || apiPlayerInfo.get(goalkeeper_steam_id)?.username || null;
      } else {
        // Use opposing team's GK
        const opposingGk = shooterInfo.team_side === "home" ? awayGk : homeGk;
        if (opposingGk) {
          goalkeeper_steam_id = opposingGk[0];
          goalkeeper_username = opposingGk[1].username;
        }
      }

      // Assist (only for goals)
      let assist_username: string | null = null;
      if (evtType === "GOAL" && evt.player2SteamId) {
        const assistSteamId = steamLookup.get(String(evt.player2SteamId)) || String(evt.player2SteamId);
        assist_username = playerMap.get(assistSteamId)?.username || apiPlayerInfo.get(assistSteamId)?.username || null;
      }

      shots.push({
        player_steam_id: shooterSteamId,
        username: shooterInfo.username,
        team_side: shooterInfo.team_side,
        goalkeeper_steam_id,
        goalkeeper_username,
        assist_username,
        normalized_x,
        normalized_y,
        is_goal: evtType === "GOAL",
        is_save: evtType === "SAVE",
        xg,
        minute,
        period,
      });
    }

    console.log(`[shots] matchId=${matchId}: ${shotEvents.length} shot events, ${shots.length} resolved shots, steamLookup size=${steamLookup.size}, playerMap size=${playerMap.size}, apiPlayerInfo size=${apiPlayerInfo.size}`);
    shots.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
    return shots;
  } catch (err) {
    console.error(`[shots] error for match ${matchId}:`, err);
    return [];
  }
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const matchId = parseInt(id, 10);
  if (isNaN(matchId)) return notFound();

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: true,
      awayTeam: true,
    },
  });

  if (!match) return notFound();

  // Player stats for this match
  let playerStats = await prisma.$queryRaw<MatchPlayer[]>`
    SELECT
      mps.player_steam_id,
      COALESCE(canonical.steam_id, p.steam_id) AS profile_steam_id,
      p.username,
      mps.position,
      mps.team_side,
      mps.goals,
      mps.assists,
      mps.second_assists,
      mps.shots,
      mps.shots_on_target,
      mps.passes,
      mps.passes_completed,
      mps.key_passes,
      mps.chances_created,
      mps.interceptions,
      mps.saves,
      mps.offsides,
      mps.fouls,
      mps.fouls_suffered,
      mps.yellow_cards,
      mps.red_cards,
      mps.own_goals,
      mps.goals_conceded,
      mps.corners,
      mps.throw_ins,
      mps.free_kicks,
      mps.goal_kicks,
      mps.penalties,
      mps.distance_run,
      mps.possession
    FROM match_player_stats mps
    JOIN players p ON p.steam_id = mps.player_steam_id
    LEFT JOIN LATERAL (
      SELECT p2.steam_id
      FROM players p2
      LEFT JOIN LATERAL (
        SELECT COUNT(DISTINCT mps2.match_id) AS apps
        FROM match_player_stats mps2
        WHERE mps2.player_steam_id = p2.steam_id
      ) p2stats ON true
      WHERE
        (
          p.iosoccer_id IS NOT NULL
          AND p2.iosoccer_id = p.iosoccer_id
        )
        OR
        (
          p.iosoccer_id IS NULL
          AND p2.iosoccer_id IS NOT NULL
          AND LOWER(TRIM(p2.username)) = LOWER(TRIM(p.username))
        )
      ORDER BY COALESCE(p2stats.apps, 0) DESC, p2.steam_id
      LIMIT 1
    ) canonical ON true
    WHERE mps.match_id = ${matchId}
    ORDER BY mps.team_side ASC, mps.goals DESC, mps.assists DESC
  `;

  let apiRaw: any | null = null;
  if (playerStats.length === 0) {
    apiRaw = await fetchMatchApiRaw(matchId);
    if (apiRaw) playerStats = parsePlayerStatsFromApi(apiRaw);
  }

  // Build player map for API shot resolution
  const playerMap = new Map<string, PlayerInfo>(
    playerStats.map((p) => [p.player_steam_id, {
      username: p.username,
      team_side: p.team_side,
      position: p.position,
    }])
  );

  // Fetch shots directly from IOSoccer API
  const shots = await fetchShotsFromApi(matchId, playerMap, apiRaw);

  const matchDate = new Date(match.date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Proxy logos server-side
  const homeLogoUrl = match.homeTeam.logo ? proxyImg(match.homeTeam.logo) : null;
  const awayLogoUrl = match.awayTeam.logo ? proxyImg(match.awayTeam.logo) : null;

  return (
    <MatchClient
      match={{
        id: match.id,
        date: matchDate,
        map: match.map,
        server: match.server,
        potm: match.potm,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homeTeam: { id: match.homeTeamId, name: match.homeTeam.name, logo: homeLogoUrl, color: match.homeTeam.color },
        awayTeam: { id: match.awayTeamId, name: match.awayTeam.name, logo: awayLogoUrl, color: match.awayTeam.color },
      }}
      playerStats={playerStats.map((p) => {
        const n: Record<string, unknown> = { ...p };
        for (const k of Object.keys(n)) {
          if (k !== "player_steam_id" && k !== "profile_steam_id" && k !== "username" && k !== "position" && k !== "team_side") {
            n[k] = Number(n[k]);
          }
        }
        return n as unknown as MatchPlayer;
      })}
      shots={shots}
    />
  );
}
