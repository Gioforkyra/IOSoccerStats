import { notFound } from "next/navigation";
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
  is_sub: boolean;
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

    // Group periods by team side so a shared GK gets separate entries per team
    const byTeam: Record<string, { totals: number[]; position: string | null; isSub: boolean }> = {};
    for (const period of periods) {
      const pInfo = period?.info || {};
      const side = pInfo.team === "away" ? "away" : "home";
      const stats: number[] = period?.statistics || [];
      if (!byTeam[side]) {
        byTeam[side] = {
          totals: new Array(30).fill(0),
          position: pInfo.position || null,
          isSub: (pInfo.startSecond || 0) > 0,
        };
      }
      for (let i = 0; i < stats.length; i++) byTeam[side].totals[i] += Number(stats[i] || 0);
    }

    for (const [team_side, data] of Object.entries(byTeam)) {
      const totals = data.totals;
      out.push({
        player_steam_id: steam64,
        profile_steam_id: steam64,
        username: String(info.name || "Unknown"),
        position: data.position,
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
        is_sub: data.isSub,
      });
    }
  }
  return out;
}

async function fetchShotsFromApi(
  matchId: number,
  playerStats: MatchPlayer[],
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
    // Build period-level team lookup: steamId → array of { side, startSecond, endSecond }
    const periodTeams = new Map<string, { side: string; start: number; end: number }[]>();
    const playerNames = new Map<string, string>();
    for (const rp of rawPlayers) {
      const shortId = rp?.info?.steamId ? String(rp.info.steamId) : "";
      const steam64 = rp?.info?.steamId64 ? String(rp.info.steamId64) : "";
      if (shortId && steam64) steamLookup.set(shortId, steam64);
      if (steam64) steamLookup.set(steam64, steam64);
      if (steam64) {
        playerNames.set(steam64, String(rp?.info?.name || "Unknown"));
        const periods: any[] = rp?.matchPeriodData || [];
        const entries: { side: string; start: number; end: number }[] = [];
        for (const period of periods) {
          const pInfo = period?.info || {};
          entries.push({
            side: pInfo.team === "away" ? "away" : "home",
            start: Number(pInfo.startSecond || 0),
            end: Number(pInfo.endSecond || 99999),
          });
        }
        periodTeams.set(steam64, entries);
      }
    }

    // Resolve team_side at a given event second
    function getTeamAtSecond(steamId: string, second: number): string {
      const periods = periodTeams.get(steamId);
      if (!periods || periods.length === 0) return "home";
      // Find the period that contains this second
      for (const p of periods) {
        if (second >= p.start && second <= p.end) return p.side;
      }
      // Fallback: closest period
      return periods[periods.length - 1].side;
    }

    // Find GKs for each side from the split playerStats array
    const homeGk = playerStats.find(
      (p) => p.team_side === "home" && (p.position || "").toUpperCase() === "GK"
    );
    const awayGk = playerStats.find(
      (p) => p.team_side === "away" && (p.position || "").toUpperCase() === "GK"
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
      const shooterName = playerNames.get(shooterSteamId);
      if (!shooterName) {
        console.warn(`[shots] no info for shooter raw=${shooterRaw} resolved=${shooterSteamId}`);
        continue;
      }
      const shooterTeamSide = getTeamAtSecond(shooterSteamId, eventSecond);

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
        goalkeeper_username = playerNames.get(goalkeeper_steam_id) || null;
      } else {
        // Use opposing team's GK
        const opposingGk = shooterTeamSide === "home" ? awayGk : homeGk;
        if (opposingGk) {
          goalkeeper_steam_id = opposingGk.player_steam_id;
          goalkeeper_username = opposingGk.username;
        }
      }

      // Assist (only for goals)
      let assist_username: string | null = null;
      if (evtType === "GOAL" && evt.player2SteamId) {
        const assistSteamId = steamLookup.get(String(evt.player2SteamId)) || String(evt.player2SteamId);
        assist_username = playerNames.get(assistSteamId) || null;
      }

      shots.push({
        player_steam_id: shooterSteamId,
        username: shooterName,
        team_side: shooterTeamSide,
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

    console.log(`[shots] matchId=${matchId}: ${shotEvents.length} shot events, ${shots.length} resolved shots, steamLookup size=${steamLookup.size}`);
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

  const apiRaw = await fetchMatchApiRaw(matchId);
  if (!apiRaw) return notFound();

  // Extract match info from API
  const homeTeamRaw = apiRaw.teamHome || {};
  const awayTeamRaw = apiRaw.teamAway || {};
  const stats = apiRaw.matchStatistics || {};

  const homeScore = stats.matchGoalsHome ?? 0;
  const awayScore = stats.matchGoalsAway ?? 0;

  const matchDate = new Date(apiRaw.kickOff || Date.now()).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const homeBadge = homeTeamRaw.badgeImage?.smallUrl
    ? `/api/img?url=${encodeURIComponent(homeTeamRaw.badgeImage.smallUrl)}`
    : null;
  const awayBadge = awayTeamRaw.badgeImage?.smallUrl
    ? `/api/img?url=${encodeURIComponent(awayTeamRaw.badgeImage.smallUrl)}`
    : null;

  // Parse player stats from API
  const playerStats = parsePlayerStatsFromApi(apiRaw);

  // Fetch shots from API
  const shots = await fetchShotsFromApi(matchId, playerStats, apiRaw);

  // Determine server and POTM
  const serverName: string | null = apiRaw.server?.name ?? null;
  const potmName: string | null = apiRaw.playerOfTheMatch?.name ?? null;

  return (
    <MatchClient
      match={{
        id: matchId,
        date: matchDate,
        map: null,
        server: serverName,
        potm: potmName,
        homeScore,
        awayScore,
        homeTeam: {
          id: apiRaw.teamHomeId ?? 0,
          name: homeTeamRaw.name ?? "Home",
          logo: homeBadge,
          color: homeTeamRaw.color ?? null,
        },
        awayTeam: {
          id: apiRaw.teamAwayId ?? 0,
          name: awayTeamRaw.name ?? "Away",
          logo: awayBadge,
          color: awayTeamRaw.color ?? null,
        },
      }}
      playerStats={playerStats.map((p) => {
        const n: Record<string, unknown> = { ...p };
        for (const k of Object.keys(n)) {
          if (k !== "player_steam_id" && k !== "profile_steam_id" && k !== "username" && k !== "position" && k !== "team_side" && k !== "is_sub") {
            n[k] = Number(n[k]);
          }
        }
        return n as unknown as MatchPlayer;
      })}
      shots={shots}
    />
  );
}
