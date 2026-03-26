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

async function fetchShotsFromApi(
  matchId: number,
  playerMap: Map<string, PlayerInfo>,
): Promise<MatchShot[]> {
  const API_BASE = "https://iosoccer.com:44380/api";
  const HEADERS = {
    Accept: "application/json",
    Origin: "https://www.iosoccer.com",
    Referer: "https://www.iosoccer.com/",
  };

  try {
    const res = await fetch(`${API_BASE}/match/${matchId}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];

    const raw = await res.json();
    const md = raw?.matchStatistics?.matchData;
    if (!md) return [];

    const fieldMin = md.matchInfo?.fieldMin || { x: -1554, y: -2406 };
    const fieldMax = md.matchInfo?.fieldMax || { x: 1554, y: 2406 };
    const events: any[] = md.matchEvents || [];

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

      const shooterSteamId = String(shooterRaw);
      const shooterInfo = playerMap.get(shooterSteamId);
      if (!shooterInfo) continue;

      const normalized_x = normalizeFromField(Number(pos.x), Number(fieldMin.x), Number(fieldMax.x));
      const normalized_y = normalizeFromField(Number(pos.y), Number(fieldMin.y), Number(fieldMax.y));
      const xg = estimateXgFromCoords(normalized_x, normalized_y);
      const minute = evt.second ? Math.floor(Number(evt.second) / 60) : null;
      const period = (evt.period as "FIRST HALF" | "SECOND HALF") || null;

      // Goalkeeper
      let goalkeeper_steam_id: string | null = null;
      let goalkeeper_username: string | null = null;
      if (evtType === "SAVE" && evt.player1SteamId) {
        goalkeeper_steam_id = String(evt.player1SteamId);
        goalkeeper_username = playerMap.get(goalkeeper_steam_id)?.username || null;
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
        const assistSteamId = String(evt.player2SteamId);
        assist_username = playerMap.get(assistSteamId)?.username || null;
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

    shots.sort((a, b) => (a.minute ?? 999) - (b.minute ?? 999));
    return shots;
  } catch {
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
  const playerStats = await prisma.$queryRaw<MatchPlayer[]>`
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

  // Build player map for API shot resolution
  const playerMap = new Map<string, PlayerInfo>(
    playerStats.map((p) => [p.player_steam_id, {
      username: p.username,
      team_side: p.team_side,
      position: p.position,
    }])
  );

  // Fetch shots directly from IOSoccer API
  const shots = await fetchShotsFromApi(matchId, playerMap);

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
