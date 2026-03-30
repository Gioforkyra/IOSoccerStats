const API_BASE = "https://iosoccer.com:44380/api";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json",
  Origin: "https://www.iosoccer.com",
  Referer: "https://www.iosoccer.com/",
};

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...HEADERS, ...init?.headers },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(`IOSoccer API ${path}: ${res.status}`);
  return res.json();
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
  server: { name: string } | null;
  playerOfTheMatch: { name: string; steamID: string } | null;
  tournament: { id: number; name: string } | null;
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

/* ------------------------------------------------------------------ */
/*  Matches                                                            */
/* ------------------------------------------------------------------ */

export async function getMatches(opts: {
  page?: number;
  pageSize?: number;
  matchType?: number;
  tournamentId?: number;
  regionId?: number;
  includePast?: boolean;
}) {
  return apiFetch<Paginated<ApiMatchListItem>>("/match", {
    method: "POST",
    body: JSON.stringify({
      page: opts.page ?? 1,
      pageSize: opts.pageSize ?? 15,
      sortBy: "KickOff",
      sortOrder: opts.includePast === false ? "ASC" : "DESC",
      filters: {
        includePast: opts.includePast ?? true,
        ...(opts.matchType ? { matchType: opts.matchType } : {}),
        ...(opts.tournamentId ? { tournamentId: opts.tournamentId } : {}),
        ...(opts.regionId ? { regionId: opts.regionId } : {}),
      },
    }),
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

/* ------------------------------------------------------------------ */
/*  Badge image URL helper                                             */
/* ------------------------------------------------------------------ */

/** Get a proxied badge URL from a badge image object or raw URL. */
export function badgeSmallUrl(badge: ApiBadgeImage | null | undefined): string | null {
  if (!badge?.smallUrl) return null;
  return proxyBadge(badge.smallUrl);
}

function proxyBadge(url: string): string {
  return `/api/img?url=${encodeURIComponent(url)}`;
}

export function badgeUrl(badgeImageId: string | number | null | undefined): string | null {
  if (!badgeImageId) return null;
  return `/api/img?url=${encodeURIComponent(`https://www.iosoccer.com/images/hub/${badgeImageId}_sm.png`)}`;
}
