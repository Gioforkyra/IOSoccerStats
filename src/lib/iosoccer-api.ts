import { proxyImg } from "./img";

// Overridable so we can point at a dead port locally to simulate the
// production TLS-drop failure (see IOSOCCER_API_BASE in the test notes).
const API_BASE = process.env.IOSOCCER_API_BASE ?? "https://iosoccer.com:44380/api";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

// A single intermittent TLS/socket drop used to keep the circuit open for a
// full hour, so one blip blacked out every page. Keep the cooldown short and
// retry transient drops first — the upstream almost always succeeds on retry.
const CIRCUIT_COOLDOWN_MS = Number(process.env.IOSOCCER_CIRCUIT_COOLDOWN_MS) || 60_000;
const MAX_CONNECTION_RETRIES = 2;

type CircuitState = { downUntil: number; reason: string | null };
const g = globalThis as unknown as { __iosoccerCircuit?: CircuitState };
g.__iosoccerCircuit ??= { downUntil: 0, reason: null };
const circuit = g.__iosoccerCircuit;

export function isFatalConnectionError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string; cause?: { code?: string; name?: string } };
  const code = e.code || e.cause?.code;
  const name = e.name || e.cause?.name;
  if (code === "CERT_HAS_EXPIRED" || code === "ECONNREFUSED" || code === "ENOTFOUND" || code === "ECONNRESET") return true;
  if (name === "TimeoutError" || name === "AbortError") return true;
  return false;
}

export function isIosoccerApiDown(): boolean {
  return Date.now() < circuit.downUntil;
}

export function tripIosoccerApiCircuit(reason: string) {
  const wasDown = Date.now() < circuit.downUntil;
  circuit.downUntil = Date.now() + CIRCUIT_COOLDOWN_MS;
  circuit.reason = reason;
  if (!wasDown) {
    console.warn(`[iosoccer-api] circuit tripped: ${reason} — skipping calls for ${CIRCUIT_COOLDOWN_MS / 1000}s`);
  }
}

const tripCircuit = tripIosoccerApiCircuit;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (Date.now() < circuit.downUntil) {
    throw new Error(`IOSoccer API ${path}: circuit open (${circuit.reason ?? "down"})`);
  }

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { ...HEADERS, ...init?.headers },
        signal: init?.signal ?? AbortSignal.timeout(8_000),
        next: { revalidate: 60 },
      });
      if (!res.ok) {
        if (res.status >= 500) tripCircuit(`HTTP ${res.status}`);
        throw new Error(`IOSoccer API ${path}: ${res.status}`);
      }
      return res.json();
    } catch (err) {
      if (isFatalConnectionError(err)) {
        // Transient TLS/socket drop (the production failure mode): retry a few
        // times with a short backoff before giving up and tripping the circuit.
        if (attempt < MAX_CONNECTION_RETRIES) {
          await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
          continue;
        }
        const code = (err as { code?: string; cause?: { code?: string } }).code
          ?? (err as { cause?: { code?: string } }).cause?.code
          ?? "fetch failed";
        tripCircuit(code);
      }
      throw err;
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type Paginated<T> = {
  items: T[];
  totalItems: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type ApiTransfer = {
  playerId: number;
  playerName: string;
  transferFromTeamId: number | null;
  transferToTeamId: number | null;
  transferFromTeamName: string | null;
  transferToTeamName: string | null;
  transferFromTeamBadgeUrl: string | null;
  transferFromTeamBadgeUrlSmall: string | null;
  transferToTeamBadgeUrl: string | null;
  transferToTeamBadgeUrlSmall: string | null;
  leaveDate: string | null;
  joinDate: string | null;
};

export type ApiBadgeImage = {
  smallUrl: string;
  mediumUrl?: string;
  largeUrl?: string;
  originalUrl?: string;
  extraSmallUrl?: string;
};

export type ApiTeamSummary = {
  id: number;
  name: string;
  teamType: number;
  color: string | null;
  badgeImageId: number | null;
  badgeImage: ApiBadgeImage | null;
  inactive: boolean;
};

export type ApiRosterEntry = {
  player: {
    steamID: string;
    id: number;
    name: string;
  };
  joinDate: string | null;
  leaveDate: string | null;
  isCurrentTeam: boolean;
  teamRole: number;
};

export type ApiPlayerTeamEntry = {
  id: number;
  playerId: number;
  teamId: number;
  team: {
    id: number;
    name: string;
    color: string | null;
    teamType: number;
    inactive: boolean;
    badgeImage: ApiBadgeImage | null;
  };
  teamRole: number;
  isCurrentTeam: boolean;
  joinDate: string | null;
  leaveDate: string | null;
};

export type ApiTournament = {
  id: number;
  name: string;
  tournamentType: number;
  teamType: number;
  format: number;
  startDate: string | null;
  endDate: string | null;
  hasStarted: boolean;
  hasEnded: boolean;
  winningTeamId: number | null;
  winningTeam: { id: number; name: string; badgeImage: ApiBadgeImage | null; color: string | null } | null;
  tournamentSeries: {
    name: string;
    organisation: { name: string; acronym: string } | null;
  } | null;
};

export type ApiMatchListItem = {
  id: number;
  teamHomeId: number;
  teamAwayId: number;
  teamHome: { name: string; badgeImage: ApiBadgeImage | null; color: string | null };
  teamAway: { name: string; badgeImage: ApiBadgeImage | null; color: string | null };
  matchStatistics: {
    matchGoalsHome: number;
    matchGoalsAway: number;
  } | null;
  kickOff: string;
  matchType: number;
  format: number | null;
  server: { name: string } | null;
  playerOfTheMatch: { name: string; steamID: string } | null;
  tournament: { id: number; name: string } | null;
  tournamentGroupMatches: Array<{
    id: number;
    matchId: number;
    tournamentGroupId: number | null;
    tournamentPhaseId: number | null;
  }> | null;
};

export type ApiPlayer = {
  id: number;
  steamID: string;
  name: string;
  rating: number | null;
  preferredPositionId: number | null;
};

/* ------------------------------------------------------------------ */
/*  Transfers                                                          */
/* ------------------------------------------------------------------ */

export async function getTransfers(opts: {
  regionId?: number;
  page?: number;
  pageSize?: number;
  freeAgentsOnly?: boolean;
  playerName?: string | null;
  teamName?: string | null;
}) {
  return apiFetch<Paginated<ApiTransfer>>("/player-team/transfers", {
    method: "POST",
    body: JSON.stringify({
      regionId: opts.regionId ?? 1,
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 15,
      filters: {
        freeAgentsOnly: opts.freeAgentsOnly ?? false,
        playerName: opts.playerName ?? null,
        teamName: opts.teamName ?? null,
      },
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Teams                                                              */
/* ------------------------------------------------------------------ */

export async function getActiveTeams(regionId: number, teamType: number) {
  return apiFetch<ApiTeamSummary[]>(
    `/team/region/${regionId}/active/summaries?teamType=${teamType}`
  );
}

export async function getTeamRoster(teamId: number, includeInactive = true) {
  return apiFetch<ApiRosterEntry[]>("/player-team/team", {
    method: "POST",
    body: JSON.stringify({ id: teamId, includeInactive }),
  });
}

export async function getPlayerTeams(playerId: number, includeInactive = true) {
  return apiFetch<ApiPlayerTeamEntry[]>("/player-team/player", {
    method: "POST",
    body: JSON.stringify({ id: playerId, includeInactive }),
  });
}

// Mirrors the official hub's player profile "Teams" tab. The /player-team/player
// endpoint returns extra ghost rows (pending invites, never-played stints) that
// the hub filters out before rendering — this endpoint already returns just the
// stints the hub shows.
export type ApiPlayerTeamHistoryEntry = {
  playerTeam: {
    // Always 0 on this endpoint — use team.id for the real team id.
    teamId: number;
    team: {
      id: number;
      name: string;
      color: string | null;
      // Always 0 on this endpoint — fetch the real team type from our DB.
      teamType: number;
      inactive: boolean;
      badgeImage: ApiBadgeImage | null;
    };
    teamRole: number;
    isCurrentTeam: boolean;
    joinDate: string | null;
    leaveDate: string | null;
  };
  appearances: number;
  goals: number;
  assists: number;
};

export async function getPlayerTeamHistory(playerId: number) {
  return apiFetch<ApiPlayerTeamHistoryEntry[]>(`/player/${playerId}/team-history`);
}

/* ------------------------------------------------------------------ */
/*  Matches                                                            */
/* ------------------------------------------------------------------ */

export async function getMatches(opts: {
  page?: number;
  pageSize?: number;
  matchType?: number;
  matchFormat?: number;
  tournamentId?: number;
  regionId?: number;
  includePast?: boolean;
  noCache?: boolean;
}) {
  return apiFetch<Paginated<ApiMatchListItem>>("/match", {
    method: "POST",
    body: JSON.stringify({
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 15,
      sortBy: "KickOff",
      sortOrder: opts.includePast === false ? "ASC" : "DESC",
      filters: {
        timePeriod: 0,
        includePast: opts.includePast ?? true,
        includeUpcoming: opts.includePast === false ? true : undefined,
        ...(opts.matchType ? { matchType: opts.matchType } : {}),
        ...(opts.matchFormat ? { matchFormat: opts.matchFormat } : {}),
        ...(opts.tournamentId ? { tournamentId: opts.tournamentId } : {}),
        ...(opts.regionId ? { regionId: opts.regionId } : {}),
      },
    }),
    ...(opts.noCache ? { cache: "no-store" as const } : {}),
  });
}

export async function getMatchDetail(id: number) {
  return apiFetch<Record<string, unknown>>(`/match/${id}`);
}

/* ------------------------------------------------------------------ */
/*  Tournaments                                                        */
/* ------------------------------------------------------------------ */

export async function getPastTournaments() {
  return apiFetch<ApiTournament[]>("/tournaments/past");
}

export async function getCurrentTournaments() {
  return apiFetch<ApiTournament[]>("/tournaments/current");
}

export async function getTournamentDetail(id: number) {
  return apiFetch<ApiTournament & Record<string, unknown>>(`/tournament/${id}`);
}

export async function getTournamentTeams(id: number) {
  return apiFetch<{ teamId?: number; id?: number }[]>(`/tournaments/${id}/teams`);
}

export type ApiTournamentPhase = {
  id: number;
  name: string;
  tournamentStageId: number | null;
  createdDate: string | null;
};

export async function getTournamentPhases(id: number) {
  return apiFetch<ApiTournamentPhase[]>(`/tournaments/${id}/phases`);
}

export type ApiTournamentStanding = {
  position: number | null;
  teamId: number;
  teamName: string;
  teamCode: string | null;
  badgeImageUrl: string | null;
  matchesPlayed: number | null;
  wins: number | null;
  draws: number | null;
  losses: number | null;
  goalsScored: number | null;
  goalsConceded: number | null;
  goalDifference: number | null;
  points: number | null;
  form: number[] | null;
};

export async function getTournamentStandings(id: number) {
  return apiFetch<ApiTournamentStanding[]>(`/tournaments/${id}/standings`);
}

/* ------------------------------------------------------------------ */
/*  Single team detail                                                 */
/* ------------------------------------------------------------------ */

export type ApiTeamDetail = {
  id: number;
  name: string;
  teamCode: string | null;
  teamType: number;
  regionId: number;
  color: string | null;
  inactive: boolean;
  badgeImageId: number | null;
  badgeImage: ApiBadgeImage | null;
  form: number[] | null;
};

export async function getTeamDetail(id: number) {
  return apiFetch<ApiTeamDetail>(`/team/${id}`);
}

/* ------------------------------------------------------------------ */
/*  Players                                                            */
/* ------------------------------------------------------------------ */

export async function getPlayers(opts: { page?: number; pageSize?: number }) {
  return apiFetch<Paginated<ApiPlayer>>("/player", {
    method: "POST",
    body: JSON.stringify({
      steamID: "",
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 100,
    }),
  });
}

export type ApiPlayerDetail = {
  id: number;
  steamID: string;
  name: string;
  rating: number | null;
};

export async function getPlayerById(id: number) {
  return apiFetch<ApiPlayerDetail>(`/player/${id}`);
}

export type ApiPlayerStatisticsTotalsItem = {
  steamID: string;
  playerId?: number;
  name?: string;
  nickname?: string;
  rating?: number | null;
  country?: string | null;
  countryCode?: string | null;
  appearances: number;
  substituteAppearances: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  secondAssists: number;
  secondAssistsAverage: number;
  shots: number;
  shotsOnGoal: number;
  keyPasses: number;
  keyPassesAverage: number;
  chancesCreated: number;
  chancesCreatedAverage: number;
  offsides: number;
  ownGoals: number;
  passes: number;
  passesCompleted: number;
  keeperSaves: number;
  keeperSavesCaughtAverage: number;
  goalsConceded: number;
  interceptions: number;
  slidingTacklesAverage: number;
  slidingTacklesCompletedAverage: number;
  fouls: number;
  foulsSuffered: number;
  yellowCards: number;
  redCards: number;
  distanceCoveredAverage: number;
  possessionAverage: number;
  possessionPercentageAverage: number;
  shotAccuracyPercentage: number;
  passCompletionPercentageAverage: number;
};

export async function getPlayerStatisticsTotals(opts: {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: "ASC" | "DESC";
  playerName?: string;
  minApps?: number;
  includeSubstituteAppearances?: boolean;
  matchFormat?: number;
  regionId?: number;
  timePeriod?: number;
}) {
  return apiFetch<Paginated<ApiPlayerStatisticsTotalsItem>>("/player-statistics/match-totals", {
    method: "POST",
    body: JSON.stringify({
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 10,
      sortBy: opts.sortBy ?? "PlayerId",
      sortOrder: opts.sortOrder ?? "ASC",
      filters: {
        excludePlayers: [],
        includeSubstituteAppearances: opts.includeSubstituteAppearances ?? true,
        matchFormat: opts.matchFormat ?? 8,
        regionId: opts.regionId ?? 1,
        timePeriod: opts.timePeriod ?? 0,
        ...(opts.playerName ? { playerName: opts.playerName } : {}),
        ...(opts.minApps && opts.minApps > 0 ? { minimumAppearances: opts.minApps } : {}),
      },
    }),
  });
}

export async function getPlayerStatisticsBySteamId(steamId: string) {
  const target = steamId.trim().toLowerCase();
  const PAGE_SIZE = 300;
  const CONCURRENCY = 4;

  async function fetchPageWithRetry(page: number) {
    try {
      return await getPlayerStatisticsTotals({
        page,
        pageSize: PAGE_SIZE,
        sortBy: "PlayerId",
        sortOrder: "ASC",
        includeSubstituteAppearances: true,
        matchFormat: 8,
        regionId: 1,
        timePeriod: 0,
      });
    } catch {
      try {
        return await getPlayerStatisticsTotals({
          page,
          pageSize: PAGE_SIZE,
          sortBy: "PlayerId",
          sortOrder: "ASC",
          includeSubstituteAppearances: true,
          matchFormat: 8,
          regionId: 1,
          timePeriod: 0,
        });
      } catch {
        return null;
      }
    }
  }

  const first = await fetchPageWithRetry(1);
  if (!first) return null;

  const firstFound = first.items.find((i) => String(i.steamID).trim().toLowerCase() === target);
  if (firstFound) return firstFound;

  const totalPages = Math.max(1, first.totalPages || 1);
  const maxPages = Math.min(totalPages, 80);

  for (let start = 2; start <= maxPages; start += CONCURRENCY) {
    const end = Math.min(start + CONCURRENCY - 1, maxPages);
    const chunk = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, idx) => fetchPageWithRetry(start + idx))
    );
    for (const res of chunk) {
      if (!res) continue;
      const found = res.items.find((i) => String(i.steamID).trim().toLowerCase() === target);
      if (found) return found;
    }
  }

  return null;
}

export async function getPlayerStatisticsForProfile(opts: {
  steamId: string;
  iosoccerId?: number | null;
  username?: string | null;
}) {
  if (opts.iosoccerId != null) {
    try {
      const profile = await getPlayerById(opts.iosoccerId);
      const officialSteam = profile?.steamID?.trim();
      const officialName = profile?.name?.trim();

      if (officialName) {
        const byOfficialName = await getPlayerStatisticsTotals({
          page: 1,
          pageSize: 100,
          sortBy: "PlayerId",
          sortOrder: "ASC",
          playerName: officialName,
          includeSubstituteAppearances: true,
          matchFormat: 8,
          regionId: 1,
          timePeriod: 0,
        });

        const byId = byOfficialName.items.find((i) => Number(i.playerId ?? -1) === opts.iosoccerId);
        if (byId) return byId;

        if (officialSteam) {
          const bySteamInName = byOfficialName.items.find(
            (i) => String(i.steamID).trim().toLowerCase() === officialSteam.toLowerCase()
          );
          if (bySteamInName) return bySteamInName;
        }
      }

      if (officialSteam) {
        const byOfficialSteam = await getPlayerStatisticsBySteamId(officialSteam);
        if (byOfficialSteam) return byOfficialSteam;
      }
    } catch {
      // continue to name fallback
    }
  }

  const name = opts.username?.trim();
  if (name) {
    try {
      const byName = await getPlayerStatisticsTotals({
        page: 1,
        pageSize: 100,
        sortBy: "PlayerId",
        sortOrder: "ASC",
        playerName: name,
        includeSubstituteAppearances: true,
        matchFormat: 8,
        regionId: 1,
        timePeriod: 0,
      });

      if (opts.iosoccerId != null) {
        const idMatch = byName.items.find((i) => Number(i.playerId ?? -1) === opts.iosoccerId);
        if (idMatch) return idMatch;
      }

      const lower = name.toLowerCase();
      const exact = byName.items.find((i) => {
        const n = (i.nickname || i.name || "").trim().toLowerCase();
        return n === lower;
      });
      if (exact) return exact;

      if (byName.items.length === 1) return byName.items[0];
    } catch {
      // ignore and return null
    }
  }

  const bySteam = await getPlayerStatisticsBySteamId(opts.steamId);
  if (bySteam) return bySteam;

  return null;
}

/* ------------------------------------------------------------------ */
/*  Badge image URL helper                                             */
/* ------------------------------------------------------------------ */

/** Get a proxied badge URL from a badge image object or raw URL. */
export function badgeSmallUrl(badge: ApiBadgeImage | null | undefined): string | null {
  if (!badge?.smallUrl) return null;
  return proxyImg(badge.smallUrl);
}

export function badgeUrl(badgeImageId: string | number | null | undefined): string | null {
  if (!badgeImageId) return null;
  return proxyImg(`https://www.iosoccer.com/images/hub/${badgeImageId}_sm.png`);
}
