import Link from "next/link";
import { notFound } from "next/navigation";
import { proxyImg } from "@/lib/img";
import { prisma } from "@/lib/prisma";
import { getCardContrastPalette } from "@/lib/card-contrast";
import {
  getPastTournaments,
  getCurrentTournaments,
  getTournamentStandings,
  getTournamentPhases,
  getMatches,
  badgeSmallUrl,
  type ApiMatchListItem,
  type ApiTournamentPhase,
} from "@/lib/iosoccer-api";
import ApiUnavailableNotice from "@/components/ApiUnavailableNotice";

export const revalidate = 300;

const FORMAT_LABELS: Record<number, string> = {
  1: "League", 2: "Knockout", 3: "Group + Knockout", 4: "Custom",
  5: "Swiss", 6: "Round Robin", 7: "Double Elimination", 8: "League",
};
const TEAM_TYPES: Record<number, string> = { 1: "Club", 2: "National", 3: "Mix", 4: "Draft" };
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function fmtDate(iso: string | null) {
  if (!iso) return "?";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2,"0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${String(d.getUTCHours()).padStart(2,"0")}:${String(d.getUTCMinutes()).padStart(2,"0")}`;
}

function serverFlag(name: string | null): string {
  if (!name) return "";
  const bracketMatch = name.match(/\[([^\]]+)\]/);
  if (bracketMatch) {
    const parts = bracketMatch[1].split("/");
    const code = parts[parts.length - 1].trim().toUpperCase();
    if (code === "AMS") return "🇳🇱";
    if (code === "UK") return "🇬🇧";
    if (code === "EU") return "🇪🇺";
    if (code === "NA") return "🇺🇸";
    if (/^[A-Z]{2}$/.test(code)) {
      return Array.from(code)
        .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
        .join("");
    }
  }
  return "";
}

type ComputedStanding = {
  teamId: number;
  teamName: string;
  logoUrl: string | null;
  p: number; w: number; d: number; l: number;
  gf: number; ga: number; gd: number; pts: number;
};

type TournamentPlayerStat = {
  steam_id: string;
  username: string | null;
  avatar: string | null;
  apps: number;
  goals: number;
  assists: number;
  second_assists: number;
  passes: number;
  passes_completed: number;
  shots: number;
  shots_on_target: number;
  saves: number;
  saves_caught: number;
  goals_conceded: number;
  interceptions: number;
  key_passes: number;
  chances_created: number;
  fouls: number;
  fouls_suffered: number;
  tackles: number;
  tackles_completed: number;
  own_goals: number;
  offsides: number;
  yellow_cards: number;
  red_cards: number;
  team_id: number | null;
  team_name: string | null;
  team_logo: string | null;
  team_color: string | null;
};

type TournamentPlayerStatRaw = {
  steam_id: string;
  username: string | null;
  avatar: string | null;
  apps: bigint;
  goals: bigint;
  assists: bigint;
  second_assists: bigint;
  passes: bigint;
  passes_completed: bigint;
  shots: bigint;
  shots_on_target: bigint;
  saves: bigint;
  saves_caught: bigint;
  goals_conceded: bigint;
  interceptions: bigint;
  key_passes: bigint;
  chances_created: bigint;
  fouls: bigint;
  fouls_suffered: bigint;
  tackles: bigint;
  tackles_completed: bigint;
  own_goals: bigint;
  offsides: bigint;
  yellow_cards: bigint;
  red_cards: bigint;
  team_id: number | null;
  team_name: string | null;
  team_logo: string | null;
  team_color: string | null;
};

const PLAYER_SORT_KEYS = [
  "apps", "goals", "assists", "second_assists",
  "passes_completed", "pass_acc",
  "key_passes", "chances_created", "shots", "shot_acc", "shot_conv",
  "saves", "saves_caught", "goals_conceded", "save_rate",
  "interceptions", "fouls", "fouls_suffered",
  "tackles_completed", "own_goals", "offsides",
  "yellow_cards", "red_cards",
] as const;
type PlayerSortKey = (typeof PLAYER_SORT_KEYS)[number];

function playerSortValue(r: TournamentPlayerStat, key: PlayerSortKey): number {
  switch (key) {
    case "pass_acc": return r.passes > 0 ? r.passes_completed / r.passes : 0;
    case "shot_acc": return r.shots > 0 ? r.shots_on_target / r.shots : 0;
    case "shot_conv": return r.shots > 0 ? r.goals / r.shots : 0;
    case "save_rate": {
      const f = r.saves + r.goals_conceded;
      return f > 0 ? r.saves / f : 0;
    }
    default: return r[key as keyof TournamentPlayerStat] as number;
  }
}

type PlayerStatView = "general" | "gk" | "defending" | "attacking";

const PLAYER_STAT_VIEWS: { key: PlayerStatView; label: string }[] = [
  { key: "general", label: "General Stats" },
  { key: "gk", label: "Goalkeeping Stats" },
  { key: "defending", label: "Defending Stats" },
  { key: "attacking", label: "Attacking Stats" },
];

const MIN_PLAYER_APPS_OPTIONS = [0, 5, 10];

type PlayerColDef = {
  key: PlayerSortKey;
  label: string;
  title: string;
  format: (r: TournamentPlayerStat) => string;
  tone?: (r: TournamentPlayerStat) => string;
};

function buildPlayerColumns(view: PlayerStatView): PlayerColDef[] {
  const apps: PlayerColDef = { key: "apps", label: "P", title: "Matches played", format: (r) => String(r.apps) };
  const goals: PlayerColDef = { key: "goals", label: "G", title: "Goals", format: (r) => String(r.goals) };
  const assists: PlayerColDef = { key: "assists", label: "A", title: "Assists", format: (r) => String(r.assists) };
  const secondAssists: PlayerColDef = { key: "second_assists", label: "2ND", title: "Second assists", format: (r) => String(r.second_assists) };
  const passesCompleted: PlayerColDef = { key: "passes_completed", label: "PC", title: "Passes completed", format: (r) => r.passes_completed.toLocaleString() };
  const passAcc: PlayerColDef = { key: "pass_acc", label: "P%", title: "Pass accuracy", format: (r) => r.passes > 0 ? `${((r.passes_completed / r.passes) * 100).toFixed(0)}%` : "-" };
  const keyPasses: PlayerColDef = { key: "key_passes", label: "KP", title: "Key passes", format: (r) => String(r.key_passes) };
  const chances: PlayerColDef = { key: "chances_created", label: "CC", title: "Chances created", format: (r) => String(r.chances_created) };
  const shots: PlayerColDef = { key: "shots", label: "S", title: "Shots", format: (r) => String(r.shots) };
  const shotAcc: PlayerColDef = { key: "shot_acc", label: "S%", title: "Shot accuracy", format: (r) => r.shots > 0 ? `${((r.shots_on_target / r.shots) * 100).toFixed(0)}%` : "-" };
  const shotConv: PlayerColDef = { key: "shot_conv", label: "CONV", title: "Shot conversion (goals / shots)", format: (r) => r.shots > 0 ? `${((r.goals / r.shots) * 100).toFixed(0)}%` : "-" };
  const offsides: PlayerColDef = { key: "offsides", label: "OFF", title: "Offsides", format: (r) => String(r.offsides) };
  const saves: PlayerColDef = { key: "saves", label: "SV", title: "Saves", format: (r) => String(r.saves) };
  const savesCaught: PlayerColDef = { key: "saves_caught", label: "SVC", title: "Saves caught", format: (r) => String(r.saves_caught) };
  const goalsAgainst: PlayerColDef = { key: "goals_conceded", label: "GA", title: "Goals against", format: (r) => String(r.goals_conceded) };
  const saveRate: PlayerColDef = { key: "save_rate", label: "SV%", title: "Save rate", format: (r) => { const f = r.saves + r.goals_conceded; return f > 0 ? `${((r.saves / f) * 100).toFixed(0)}%` : "-"; } };
  const interceptions: PlayerColDef = { key: "interceptions", label: "INT", title: "Interceptions", format: (r) => String(r.interceptions) };
  const fouls: PlayerColDef = { key: "fouls", label: "FLS", title: "Fouls", format: (r) => String(r.fouls) };
  const foulsSuffered: PlayerColDef = { key: "fouls_suffered", label: "FLS+", title: "Fouls suffered", format: (r) => String(r.fouls_suffered) };
  const tacklesCompleted: PlayerColDef = { key: "tackles_completed", label: "TKL✓", title: "Sliding tackles completed", format: (r) => String(r.tackles_completed) };
  const ownGoals: PlayerColDef = { key: "own_goals", label: "OG", title: "Own goals", format: (r) => String(r.own_goals), tone: (r) => r.own_goals > 0 ? "text-red-400" : "text-chalk-400" };
  const yellowCards: PlayerColDef = { key: "yellow_cards", label: "YC", title: "Yellow cards", format: (r) => String(r.yellow_cards), tone: (r) => r.yellow_cards > 0 ? "text-yellow-400" : "text-chalk-400" };
  const redCards: PlayerColDef = { key: "red_cards", label: "RC", title: "Red cards", format: (r) => String(r.red_cards), tone: (r) => r.red_cards > 0 ? "text-red-400" : "text-chalk-400" };

  switch (view) {
    case "general":
      return [apps, goals, assists, passesCompleted, passAcc, keyPasses, chances, shots, shotAcc, interceptions, yellowCards, redCards];
    case "gk":
      return [apps, saves, goalsAgainst, saveRate, savesCaught, passesCompleted, passAcc, interceptions, yellowCards, redCards];
    case "defending":
      return [apps, interceptions, fouls, tacklesCompleted, ownGoals, goalsAgainst, passesCompleted, passAcc, yellowCards, redCards];
    case "attacking":
      return [apps, goals, assists, secondAssists, shots, shotAcc, shotConv, keyPasses, chances, offsides, passesCompleted, passAcc];
  }
}

function computeStandings(matches: ApiMatchListItem[]): ComputedStanding[] {
  const map = new Map<number, ComputedStanding>();
  for (const m of matches) {
    const hg = m.matchStatistics?.matchGoalsHome;
    const ag = m.matchStatistics?.matchGoalsAway;
    if (hg == null || ag == null) continue;
    for (const [tid, team, gf, ga] of [
      [m.teamHomeId, m.teamHome, hg, ag],
      [m.teamAwayId, m.teamAway, ag, hg],
    ] as [number, typeof m.teamHome, number, number][]) {
      if (!map.has(tid)) {
        map.set(tid, {
          teamId: tid,
          teamName: team.name,
          logoUrl: badgeSmallUrl(team.badgeImage),
          p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0,
        });
      }
      const s = map.get(tid)!;
      s.p++; s.gf += gf; s.ga += ga;
    }
    const home = map.get(m.teamHomeId)!;
    const away = map.get(m.teamAwayId)!;
    if (hg > ag) { home.w++; away.l++; }
    else if (hg < ag) { away.w++; home.l++; }
    else { home.d++; away.d++; }
  }
  for (const s of map.values()) {
    s.gd = s.gf - s.ga;
    s.pts = s.w * 3 + s.d;
  }
  return Array.from(map.values()).sort(
    (a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf
  );
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; tab?: string; sort?: string; order?: string; view?: string; min?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const tournamentId = parseInt(id, 10);
  if (isNaN(tournamentId)) return notFound();

  const [pastRes, currentRes] = await Promise.all([
    getPastTournaments().then((v) => ({ ok: true as const, v })).catch(() => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof getPastTournaments>> })),
    getCurrentTournaments().then((v) => ({ ok: true as const, v })).catch(() => ({ ok: false as const, v: [] as Awaited<ReturnType<typeof getCurrentTournaments>> })),
  ]);
  const all = [...currentRes.v, ...pastRes.v];
  const tournament = all.find((t) => t.id === tournamentId);
  const tournamentListUnavailable = !pastRes.ok && !currentRes.ok;

  if (!tournament) {
    // If API is down we cannot verify the tournament exists — show banner instead of 404
    if (tournamentListUnavailable) {
      return (
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="text-xs font-mono text-chalk-400 mb-6">
            <Link href="/tournaments" className="hover:text-grass-500 transition-colors">Tournaments</Link>
          </div>
          <ApiUnavailableNotice />
        </div>
      );
    }
    return notFound();
  }

  const isCup = /\bcup\b/i.test(tournament.name);
  const isDraft = tournament.teamType === 4;
  const hasBracket = isCup || isDraft;
  const rawTab = sp.tab ?? "matches";
  const tab: "matches" | "standings" | "bracket" | "players" =
    rawTab === "standings" ? "standings" :
    rawTab === "bracket" && hasBracket ? "bracket" :
    rawTab === "players" ? "players" :
    "matches";
  const currentPage = Math.max(1, parseInt(sp.page || "1", 10));
  const playerSortKey: PlayerSortKey = (PLAYER_SORT_KEYS as readonly string[]).includes(sp.sort ?? "")
    ? (sp.sort as PlayerSortKey)
    : "apps";
  const playerSortOrder: "asc" | "desc" = sp.order === "asc" ? "asc" : "desc";
  const playerView: PlayerStatView = (["general", "gk", "defending", "attacking"].includes(sp.view ?? "")
    ? (sp.view as PlayerStatView)
    : "general");
  const playerMinApps = MIN_PLAYER_APPS_OPTIONS.includes(parseInt(sp.min ?? "0", 10))
    ? parseInt(sp.min ?? "0", 10)
    : 0;

  // Fetch matches page + API standings in parallel
  let apiUnavailable = false;
  const [standingsRaw, matchData] = await Promise.all([
    getTournamentStandings(tournamentId).catch(() => {
      apiUnavailable = true;
      return [];
    }),
    getMatches({ tournamentId, pageSize: 10, page: currentPage }).catch(() => {
      apiUnavailable = true;
      return { items: [] as ApiMatchListItem[], totalItems: 0, totalPages: 1, page: 1, pageSize: 10 };
    }),
  ]);

  let apiStandings = standingsRaw as Awaited<ReturnType<typeof getTournamentStandings>>;
  const matches = matchData.items;
  const totalPages = matchData.totalPages;
  const totalMatches = matchData.totalItems;

  // If on standings tab and API returned nothing, compute from all matches
  let computedStandings: ComputedStanding[] | null = null;
  if (tab === "standings" && apiStandings.length === 0) {
    const allMatches = await getMatches({ tournamentId, pageSize: 500, noCache: true }).catch(() => null);
    if (allMatches) computedStandings = computeStandings(allMatches.items);
  }

  // For Cups: undefeated teams (matches played > 0, 0 losses) always pinned on top.
  if (isCup) {
    apiStandings = [...apiStandings].sort((a, b) => {
      const aUnbeaten = (a.matchesPlayed ?? 0) > 0 && (a.losses ?? 0) === 0;
      const bUnbeaten = (b.matchesPlayed ?? 0) > 0 && (b.losses ?? 0) === 0;
      if (aUnbeaten !== bUnbeaten) return aUnbeaten ? -1 : 1;
      return (a.position ?? 999) - (b.position ?? 999);
    });
    if (computedStandings) {
      computedStandings = [...computedStandings].sort((a, b) => {
        const aUnbeaten = a.p > 0 && a.l === 0;
        const bUnbeaten = b.p > 0 && b.l === 0;
        if (aUnbeaten !== bUnbeaten) return aUnbeaten ? -1 : 1;
        return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf;
      });
    }
  }

  // Bracket tab data
  let bracketPhases: ApiTournamentPhase[] = [];
  let bracketMatchesByPhase: Map<number, ApiMatchListItem[]> = new Map();
  if (tab === "bracket") {
    const [phases, allMatches] = await Promise.all([
      getTournamentPhases(tournamentId).catch(() => [] as ApiTournamentPhase[]),
      getMatches({ tournamentId, pageSize: 500 }).catch(() => null),
    ]);
    // For Cups all phases are knockout; for Drafts only finals-style phases count.
    const keep = isCup
      ? (_: ApiTournamentPhase) => true
      : (p: ApiTournamentPhase) => /\bfinal\b/i.test(p.name);
    bracketPhases = [...phases].filter(keep).sort((a, b) => a.id - b.id);
    if (allMatches) {
      for (const m of allMatches.items) {
        const pid = m.tournamentGroupMatches?.[0]?.tournamentPhaseId ?? null;
        if (pid == null) continue;
        const list = bracketMatchesByPhase.get(pid) ?? [];
        list.push(m);
        bracketMatchesByPhase.set(pid, list);
      }
      for (const list of bracketMatchesByPhase.values()) {
        list.sort((a, b) => new Date(a.kickOff).getTime() - new Date(b.kickOff).getTime());
      }
    }
  }

  // Players tab data — aggregate per-player stats inside this tournament.
  // Awards (Golden Boot / Playmaker / Golden Glove / Best Passer) require ≥5 matches;
  // the stats table itself shows every player who appeared at least once.
  let playerStats: TournamentPlayerStat[] = [];
  let goldenBoot: TournamentPlayerStat | null = null;
  let playmaker: TournamentPlayerStat | null = null;
  let goldenGlove: TournamentPlayerStat | null = null;
  let bestPasser: TournamentPlayerStat | null = null;
  if (tab === "players") {
    const rawRows = await prisma.$queryRaw<TournamentPlayerStatRaw[]>`
      WITH player_team_apps AS (
        SELECT
          mps.player_steam_id,
          CASE
            WHEN mps.team_side = 'home' THEN m.home_team_id
            WHEN mps.team_side = 'away' THEN m.away_team_id
          END AS team_id,
          COUNT(DISTINCT mps.match_id) AS team_apps
        FROM match_player_stats mps
        JOIN matches m ON m.id = mps.match_id
        WHERE m.tournament_id = ${tournamentId}
        GROUP BY mps.player_steam_id, team_id
      ),
      top_team AS (
        SELECT DISTINCT ON (player_steam_id)
          player_steam_id, team_id
        FROM player_team_apps
        WHERE team_id IS NOT NULL
        ORDER BY player_steam_id, team_apps DESC, team_id ASC
      )
      SELECT
        mps.player_steam_id              AS steam_id,
        p.username                       AS username,
        p.avatar                         AS avatar,
        COUNT(DISTINCT mps.match_id)     AS apps,
        COALESCE(SUM(mps.goals), 0)                       AS goals,
        COALESCE(SUM(mps.assists), 0)                     AS assists,
        COALESCE(SUM(mps.second_assists), 0)              AS second_assists,
        COALESCE(SUM(mps.passes), 0)                      AS passes,
        COALESCE(SUM(mps.passes_completed), 0)            AS passes_completed,
        COALESCE(SUM(mps.shots), 0)                       AS shots,
        COALESCE(SUM(mps.shots_on_target), 0)             AS shots_on_target,
        COALESCE(SUM(mps.saves), 0)                       AS saves,
        COALESCE(SUM(mps.saves_caught), 0)                AS saves_caught,
        COALESCE(SUM(mps.goals_conceded), 0)              AS goals_conceded,
        COALESCE(SUM(mps.interceptions), 0)               AS interceptions,
        COALESCE(SUM(mps.key_passes), 0)                  AS key_passes,
        COALESCE(SUM(mps.chances_created), 0)             AS chances_created,
        COALESCE(SUM(mps.fouls), 0)                       AS fouls,
        COALESCE(SUM(mps.fouls_suffered), 0)              AS fouls_suffered,
        COALESCE(SUM(mps.sliding_tackles), 0)             AS tackles,
        COALESCE(SUM(mps.sliding_tackles_completed), 0)   AS tackles_completed,
        COALESCE(SUM(mps.own_goals), 0)                   AS own_goals,
        COALESCE(SUM(mps.offsides), 0)                    AS offsides,
        COALESCE(SUM(mps.yellow_cards), 0)                AS yellow_cards,
        COALESCE(SUM(mps.red_cards), 0)                   AS red_cards,
        tt.team_id                       AS team_id,
        t.name                           AS team_name,
        t.logo                           AS team_logo,
        t.color                          AS team_color
      FROM match_player_stats mps
      JOIN matches m ON m.id = mps.match_id
      LEFT JOIN players p ON p.steam_id = mps.player_steam_id
      LEFT JOIN top_team tt ON tt.player_steam_id = mps.player_steam_id
      LEFT JOIN teams t ON t.id = tt.team_id
      WHERE m.tournament_id = ${tournamentId}
      GROUP BY mps.player_steam_id, p.username, p.avatar, tt.team_id, t.name, t.logo, t.color
    `;
    playerStats = rawRows.map((r) => ({
      steam_id: r.steam_id,
      username: r.username,
      avatar: r.avatar,
      apps: Number(r.apps),
      goals: Number(r.goals),
      assists: Number(r.assists),
      second_assists: Number(r.second_assists),
      passes: Number(r.passes),
      passes_completed: Number(r.passes_completed),
      shots: Number(r.shots),
      shots_on_target: Number(r.shots_on_target),
      saves: Number(r.saves),
      saves_caught: Number(r.saves_caught),
      goals_conceded: Number(r.goals_conceded),
      interceptions: Number(r.interceptions),
      key_passes: Number(r.key_passes),
      chances_created: Number(r.chances_created),
      fouls: Number(r.fouls),
      fouls_suffered: Number(r.fouls_suffered),
      tackles: Number(r.tackles),
      tackles_completed: Number(r.tackles_completed),
      own_goals: Number(r.own_goals),
      offsides: Number(r.offsides),
      yellow_cards: Number(r.yellow_cards),
      red_cards: Number(r.red_cards),
      team_id: r.team_id,
      team_name: r.team_name,
      team_logo: r.team_logo,
      team_color: r.team_color,
    }));

    // Awards: only players with ≥5 matches qualify.
    const eligible = playerStats.filter((p) => p.apps >= 5);
    if (eligible.length > 0) {
      const byGoals = [...eligible].sort((a, b) => b.goals - a.goals);
      if (byGoals[0].goals > 0) goldenBoot = byGoals[0];

      const byAssists = [...eligible].sort((a, b) => b.assists - a.assists);
      if (byAssists[0].assists > 0) playmaker = byAssists[0];

      // Golden Glove: at least 10 shots faced (saves + conceded) so we pick a real GK.
      const keepers = eligible.filter((p) => p.saves + p.goals_conceded >= 10);
      if (keepers.length > 0) {
        keepers.sort((a, b) => {
          const aRate = a.saves / (a.saves + a.goals_conceded);
          const bRate = b.saves / (b.saves + b.goals_conceded);
          return bRate - aRate;
        });
        goldenGlove = keepers[0];
      }

      const byPasses = [...eligible].sort((a, b) => b.passes_completed - a.passes_completed);
      if (byPasses[0].passes_completed > 0) bestPasser = byPasses[0];
    }
  }

  const isActive = currentRes.v.some((t) => t.id === tournamentId);
  const org = tournament.tournamentSeries?.organisation?.acronym ?? null;
  const winnerLogo = badgeSmallUrl(tournament.winningTeam?.badgeImage ?? null);

  const pageNumbers: (number | "...")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(1);
    if (currentPage > 3) pageNumbers.push("...");
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) pageNumbers.push(i);
    if (currentPage < totalPages - 2) pageNumbers.push("...");
    pageNumbers.push(totalPages);
  }

  function pageUrl(p: number) {
    return `/tournaments/${tournamentId}?tab=matches&page=${p}`;
  }

  const tabUrl = (t: string) => `/tournaments/${tournamentId}?tab=${t}`;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <div className="text-xs font-mono text-chalk-400 mb-6">
        <Link href="/tournaments" className="hover:text-grass-500 transition-colors">Tournaments</Link>
        <span className="mx-2">/</span>
        <span className="text-chalk-200">{tournament.name}</span>
      </div>

      {apiUnavailable && <ApiUnavailableNotice />}

      {/* Header */}
      <div className="rounded-xl border border-chalk-100/8 bg-pitch-900/40 p-5 mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <h1 className="font-display font-900 text-3xl tracking-tight text-chalk-100 uppercase">
                {tournament.name}
              </h1>
              {org && (
                <span className="text-[11px] font-mono bg-[#F4119E]/15 text-[#F4119E] px-2 py-0.5 rounded">
                  {org}
                </span>
              )}
              {isActive && (
                <span className="text-[10px] font-mono bg-grass-500/20 text-grass-400 px-2 py-0.5 rounded">
                  ACTIVE
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono text-chalk-400">
              {tournament.format > 0 && <span>FORMAT <span className="text-chalk-200">{FORMAT_LABELS[tournament.format] || "-"}</span></span>}
              {tournament.teamType > 0 && <span>TYPE <span className="text-chalk-200">{TEAM_TYPES[tournament.teamType] || "-"}</span></span>}
              {tournament.startDate && <span>START <span className="text-chalk-200">{fmtDate(tournament.startDate)}</span></span>}
              {tournament.endDate && <span>END <span className="text-chalk-200">{fmtDate(tournament.endDate)}</span></span>}
            </div>
          </div>
          {tournament.winningTeamId && tournament.winningTeam && (
            <Link href={`/teams/${tournament.winningTeamId}`} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              {winnerLogo && <img src={winnerLogo} alt="" className="w-6 h-6 object-contain" />}
              <div>
                <div className="text-[10px] font-mono text-chalk-400 uppercase">Winner</div>
                <div className="font-body font-medium text-[#F4119E]">{tournament.winningTeam.name}</div>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-5 font-mono text-xs">
        <Link
          href={tabUrl("matches")}
          className={`px-4 py-2 rounded border transition-colors ${tab === "matches" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
        >
          MATCHES <span className={tab === "matches" ? "text-[#F4119E]/70" : "text-chalk-500"}>({totalMatches})</span>
        </Link>
        <Link
          href={tabUrl("standings")}
          className={`px-4 py-2 rounded border transition-colors ${tab === "standings" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
        >
          STANDINGS
        </Link>
        {hasBracket && (
          <Link
            href={tabUrl("bracket")}
            className={`px-4 py-2 rounded border transition-colors ${tab === "bracket" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
          >
            BRACKET
          </Link>
        )}
        <Link
          href={tabUrl("players")}
          className={`px-4 py-2 rounded border transition-colors ${tab === "players" ? "border-[#F4119E] text-[#F4119E] bg-[#F4119E]/10" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}
        >
          PLAYERS
        </Link>
      </div>

      {/* MATCHES TAB */}
      {tab === "matches" && (
        <>
          {matches.length === 0 ? (
            <div className="text-center py-8 text-chalk-400 font-body text-sm">No matches found.</div>
          ) : (
            <>
              <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-x-auto">
                <div className="w-max min-w-full">
                <div className="grid border-b border-chalk-100/8 px-4 py-2 text-[10px] font-mono text-chalk-500 uppercase"
                  style={{ gridTemplateColumns: "9rem 1fr 2.5rem 1fr 7rem 2rem" }}>
                  <span>Date</span>
                  <span className="text-right">Home</span>
                  <span className="text-center">Score</span>
                  <span>Away</span>
                  <span className="text-center">POTM</span>
                  <span />
                </div>
                {matches.map((m, i) => {
                  const homeLogo = badgeSmallUrl(m.teamHome.badgeImage);
                  const awayLogo = badgeSmallUrl(m.teamAway.badgeImage);
                  const hg = m.matchStatistics?.matchGoalsHome ?? null;
                  const ag = m.matchStatistics?.matchGoalsAway ?? null;
                  const flag = serverFlag(m.server?.name ?? null);
                  return (
                    <Link
                      key={m.id}
                      href={`/matches/${m.id}`}
                      className={`grid items-center gap-2 px-4 py-2.5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-pitch-600/15" : ""} ${i > 0 ? "border-t border-chalk-100/5" : ""}`}
                      style={{ gridTemplateColumns: "9rem 1fr 2.5rem 1fr 7rem 2rem" }}
                    >
                      <span className="text-[10px] font-mono text-chalk-500 shrink-0">
                        {fmtDateTime(m.kickOff)}
                      </span>
                      <span className="text-right font-body text-sm text-chalk-100 truncate flex items-center justify-end gap-1.5">
                        {m.teamHome.name}
                        {homeLogo ? <img src={homeLogo} alt="" className="h-5 w-5 shrink-0 object-contain" /> : <div className="h-5 w-5 shrink-0" />}
                      </span>
                      <span className="font-mono text-sm font-700 text-chalk-100 text-center shrink-0">
                        {hg !== null ? `${hg}-${ag}` : "vs"}
                      </span>
                      <span className="font-body text-sm text-chalk-100 truncate flex items-center gap-1.5">
                        {awayLogo ? <img src={awayLogo} alt="" className="h-5 w-5 shrink-0 object-contain" /> : <div className="h-5 w-5 shrink-0" />}
                        {m.teamAway.name}
                      </span>
                      <span className="text-[10px] font-mono text-[#56a3ff] shrink-0 text-center truncate">
                        {m.playerOfTheMatch ? m.playerOfTheMatch.name : ""}
                      </span>
                      <span className="text-base shrink-0 text-right" title={m.server?.name ?? undefined}>
                        {flag}
                      </span>
                    </Link>
                  );
                })}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-end gap-1.5 mt-4">
                  {currentPage > 1 && (
                    <Link href={pageUrl(currentPage - 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&lt;</Link>
                  )}
                  {pageNumbers.map((p, idx) =>
                    p === "..." ? (
                      <span key={`e-${idx}`} className="px-2 text-chalk-500 font-mono text-xs">&hellip;</span>
                    ) : (
                      <Link key={p} href={pageUrl(p)} className={`px-3 py-1.5 rounded border font-mono text-xs transition-colors ${p === currentPage ? "border-[#F4119E] bg-[#F4119E] text-white" : "border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/40 hover:text-[#F4119E]"}`}>{p}</Link>
                    )
                  )}
                  {currentPage < totalPages && (
                    <Link href={pageUrl(currentPage + 1)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&gt;</Link>
                  )}
                  {currentPage < totalPages && (
                    <Link href={pageUrl(totalPages)} className="px-3 py-1.5 rounded border border-chalk-100/10 text-chalk-400 font-mono text-xs hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors">&raquo;</Link>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* STANDINGS TAB */}
      {tab === "standings" && (() => {
        // Prefer API standings, fall back to computed
        if (apiStandings.length > 0) {
          const FORM_LABELS: Record<number, { label: string; cls: string }> = {
            0: { label: "W", cls: "bg-grass-500 text-white" },
            1: { label: "D", cls: "bg-chalk-500 text-white" },
            2: { label: "L", cls: "bg-red-500 text-white" },
          };
          return (
            <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-chalk-100/8">
                    <th className="text-left px-3 py-2.5 font-mono text-[10px] text-chalk-400 w-7">#</th>
                    <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">TEAM</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">P</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">W</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">D</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">L</th>
                    <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GD</th>
                    <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">FORM</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {apiStandings.map((s, i) => {
                    const logoUrl = proxyImg(s.badgeImageUrl);
                    const isWinner = tournament.winningTeamId === s.teamId;
                    const form = s.form ?? [];
                    return (
                      <tr key={s.teamId} className={`border-t border-chalk-100/5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-black/[0.03]" : ""}`}>
                        <td className="px-3 py-2 font-mono text-chalk-400 text-center">{s.position ?? i + 1}</td>
                        <td className="px-2 py-2">
                          <Link href={`/teams/${s.teamId}`} className={`flex items-center gap-1.5 hover:text-[#F4119E] transition-colors ${isWinner ? "text-[#F4119E]" : "text-chalk-100"}`}>
                            {logoUrl && <img src={logoUrl} alt="" className="h-5 w-5 object-contain shrink-0" />}
                            <span className="font-body truncate">{s.teamName}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.matchesPlayed ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-grass-400">{s.wins ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-chalk-400">{s.draws ?? "-"}</td>
                        <td className="px-2 py-2 text-center font-mono text-red-400">{s.losses ?? "-"}</td>
                        <td className={`px-2 py-2 text-center font-mono ${(s.goalDifference ?? 0) > 0 ? "text-grass-400" : (s.goalDifference ?? 0) < 0 ? "text-red-400" : "text-chalk-400"}`}>
                          {(s.goalDifference ?? 0) > 0 ? `+${s.goalDifference}` : (s.goalDifference ?? 0)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-0.5">
                            {Array.from({ length: 5 }).map((_, fi) => {
                              const val = form[fi];
                              const fb = val !== undefined && val in FORM_LABELS ? FORM_LABELS[val] : { label: "?", cls: "bg-chalk-100/10 text-chalk-500" };
                              return <span key={fi} className={`inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-mono font-700 ${fb.cls}`}>{fb.label}</span>;
                            })}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Link href={`/teams/${s.teamId}`} className="inline-block text-[10px] font-mono text-chalk-400 border border-chalk-100/10 px-2 py-1 rounded hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors whitespace-nowrap">
                            VIEW PROFILE
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }

        // Computed from matches
        const rows = computedStandings ?? [];
        if (rows.length === 0) {
          return <div className="text-center py-12 text-chalk-400 font-body text-sm">No standings data available.</div>;
        }
        return (
          <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 overflow-x-auto">
            <table className="w-full text-xs whitespace-nowrap">
              <thead>
                <tr className="border-b border-chalk-100/8">
                  <th className="text-left px-3 py-2.5 font-mono text-[10px] text-chalk-400 w-7">#</th>
                  <th className="text-left px-2 py-2.5 font-mono text-[10px] text-chalk-400">TEAM</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">P</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">W</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">D</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">L</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GF</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GA</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">GD</th>
                  <th className="text-center px-2 py-2.5 font-mono text-[10px] text-chalk-400">PTS</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {rows.map((s, i) => {
                  const isWinner = tournament.winningTeamId === s.teamId;
                  return (
                    <tr key={s.teamId} className={`border-t border-chalk-100/5 hover:bg-[#F4119E]/10 transition-colors ${i % 2 === 0 ? "bg-black/[0.03]" : ""}`}>
                      <td className="px-3 py-2 font-mono text-chalk-400 text-center">{i + 1}</td>
                      <td className="px-2 py-2">
                        <Link href={`/teams/${s.teamId}`} className={`flex items-center gap-1.5 hover:text-[#F4119E] transition-colors ${isWinner ? "text-[#F4119E]" : "text-chalk-100"}`}>
                          {s.logoUrl && <img src={s.logoUrl} alt="" className="h-5 w-5 object-contain shrink-0" />}
                          <span className="font-body truncate">{s.teamName}</span>
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.p}</td>
                      <td className="px-2 py-2 text-center font-mono text-grass-400">{s.w}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-400">{s.d}</td>
                      <td className="px-2 py-2 text-center font-mono text-red-400">{s.l}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.gf}</td>
                      <td className="px-2 py-2 text-center font-mono text-chalk-300">{s.ga}</td>
                      <td className={`px-2 py-2 text-center font-mono ${s.gd > 0 ? "text-grass-400" : s.gd < 0 ? "text-red-400" : "text-chalk-400"}`}>
                        {s.gd > 0 ? `+${s.gd}` : s.gd}
                      </td>
                      <td className="px-2 py-2 text-center font-mono font-700 text-chalk-100">{s.pts}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href={`/teams/${s.teamId}`} className="inline-block text-[10px] font-mono text-chalk-400 border border-chalk-100/10 px-2 py-1 rounded hover:border-[#F4119E]/40 hover:text-[#F4119E] transition-colors whitespace-nowrap">
                          VIEW PROFILE
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })()}

      {/* BRACKET TAB */}
      {tab === "bracket" && (() => {
        const nonEmptyPhases = bracketPhases.filter((ph) => (bracketMatchesByPhase.get(ph.id)?.length ?? 0) > 0);
        if (nonEmptyPhases.length === 0) {
          return <div className="text-center py-12 text-chalk-400 font-body text-sm">No knockout matches yet.</div>;
        }
        return (
          <div className="rounded-lg border border-chalk-100/8 bg-pitch-900/40 p-4 overflow-x-auto">
            <div className="flex gap-4 items-stretch min-w-max">
              {nonEmptyPhases.map((phase) => {
                const phaseMatches = bracketMatchesByPhase.get(phase.id) ?? [];
                return (
                  <div key={phase.id} className="flex flex-col gap-3 w-[240px] shrink-0">
                    <div className="text-[11px] font-mono uppercase text-[#F4119E] tracking-wider text-center py-1 border-b border-chalk-100/8">
                      {phase.name}
                    </div>
                    <div className="flex flex-col gap-2 justify-around flex-1">
                      {phaseMatches.map((m) => {
                        const hg = m.matchStatistics?.matchGoalsHome ?? null;
                        const ag = m.matchStatistics?.matchGoalsAway ?? null;
                        const homeLogo = badgeSmallUrl(m.teamHome.badgeImage);
                        const awayLogo = badgeSmallUrl(m.teamAway.badgeImage);
                        const homeWon = hg != null && ag != null && hg > ag;
                        const awayWon = hg != null && ag != null && ag > hg;
                        const played = hg != null && ag != null;
                        return (
                          <Link
                            key={m.id}
                            href={`/matches/${m.id}`}
                            className="group rounded border border-chalk-100/8 bg-pitch-600/20 hover:border-[#F4119E]/50 hover:bg-[#F4119E]/5 transition-colors overflow-hidden"
                          >
                            <div className={`flex items-center gap-2 px-2.5 py-1.5 text-xs ${!played || homeWon ? "" : "opacity-60"}`}>
                              {homeLogo ? <img src={homeLogo} alt="" className="h-4 w-4 shrink-0 object-contain" /> : <div className="h-4 w-4 shrink-0" />}
                              <span className={`flex-1 font-body truncate ${homeWon ? "text-chalk-100 font-700" : "text-chalk-300"}`}>{m.teamHome.name}</span>
                              <span className={`font-mono font-700 tabular-nums ${homeWon ? "text-[#F4119E]" : "text-chalk-300"}`}>
                                {played ? hg : "-"}
                              </span>
                            </div>
                            <div className={`flex items-center gap-2 px-2.5 py-1.5 text-xs border-t border-chalk-100/5 ${!played || awayWon ? "" : "opacity-60"}`}>
                              {awayLogo ? <img src={awayLogo} alt="" className="h-4 w-4 shrink-0 object-contain" /> : <div className="h-4 w-4 shrink-0" />}
                              <span className={`flex-1 font-body truncate ${awayWon ? "text-chalk-100 font-700" : "text-chalk-300"}`}>{m.teamAway.name}</span>
                              <span className={`font-mono font-700 tabular-nums ${awayWon ? "text-[#F4119E]" : "text-chalk-300"}`}>
                                {played ? ag : "-"}
                              </span>
                            </div>
                            <div className="px-2.5 py-1 text-[9px] font-mono text-chalk-500 border-t border-chalk-100/5 group-hover:text-[#F4119E]/70">
                              {fmtDateTime(m.kickOff)}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* PLAYERS TAB */}
      {tab === "players" && (() => {
        if (playerStats.length === 0) {
          return (
            <div className="text-center py-12 text-chalk-400 font-body text-sm">
              No player data for this tournament.
            </div>
          );
        }

        const PLAYERS_PER_PAGE = 10;
        const PLAYER_COLS = buildPlayerColumns(playerView);

        const filteredRows = playerMinApps > 0
          ? playerStats.filter((r) => r.apps >= playerMinApps)
          : playerStats;

        const sortedRows = [...filteredRows].sort((a, b) => {
          const av = playerSortValue(a, playerSortKey);
          const bv = playerSortValue(b, playerSortKey);
          if (av === bv) return b.apps - a.apps;
          return playerSortOrder === "asc" ? av - bv : bv - av;
        });

        const totalPlayers = sortedRows.length;
        const totalPlayerPages = Math.max(1, Math.ceil(totalPlayers / PLAYERS_PER_PAGE));
        const playerPage = Math.min(currentPage, totalPlayerPages);
        const pageStart = (playerPage - 1) * PLAYERS_PER_PAGE;
        const paginatedRows = sortedRows.slice(pageStart, pageStart + PLAYERS_PER_PAGE);

        function buildPlayerParams(extra: Record<string, string | number | undefined> = {}) {
          const p = new URLSearchParams();
          p.set("tab", "players");
          p.set("view", playerView);
          p.set("sort", playerSortKey);
          p.set("order", playerSortOrder);
          if (playerMinApps > 0) p.set("min", String(playerMinApps));
          for (const [k, v] of Object.entries(extra)) {
            if (v == null || v === "" || v === 0) p.delete(k);
            else p.set(k, String(v));
          }
          return p;
        }
        // Sorting resets pagination to page 1.
        function sortUrl(key: PlayerSortKey) {
          const nextOrder = key === playerSortKey && playerSortOrder === "desc" ? "asc" : "desc";
          const p = buildPlayerParams({ sort: key, order: nextOrder });
          p.delete("page");
          return `/tournaments/${tournamentId}?${p.toString()}`;
        }
        function playerPageUrl(p: number) {
          const q = buildPlayerParams({ page: p });
          return `/tournaments/${tournamentId}?${q.toString()}`;
        }
        function viewUrl(v: PlayerStatView) {
          const p = new URLSearchParams();
          p.set("tab", "players");
          p.set("view", v);
          if (playerMinApps > 0) p.set("min", String(playerMinApps));
          return `/tournaments/${tournamentId}?${p.toString()}`;
        }
        function minAppsUrl(min: number) {
          const p = new URLSearchParams();
          p.set("tab", "players");
          p.set("view", playerView);
          p.set("sort", playerSortKey);
          p.set("order", playerSortOrder);
          if (min > 0) p.set("min", String(min));
          return `/tournaments/${tournamentId}?${p.toString()}`;
        }

        const awards: {
          title: string; winner: TournamentPlayerStat | null;
          value: string; unit: string;
        }[] = [
          {
            title: "Golden Boot", winner: goldenBoot,
            value: goldenBoot ? String(goldenBoot.goals) : "-", unit: "goals",
          },
          {
            title: "Playmaker", winner: playmaker,
            value: playmaker ? String(playmaker.assists) : "-", unit: "assists",
          },
          {
            title: "Golden Glove", winner: goldenGlove,
            value: goldenGlove ? `${((goldenGlove.saves / (goldenGlove.saves + goldenGlove.goals_conceded)) * 100).toFixed(1)}%` : "-",
            unit: "save%",
          },
          {
            title: "Best Passer", winner: bestPasser,
            value: bestPasser ? bestPasser.passes_completed.toLocaleString() : "-", unit: "passes",
          },
        ];

        return (
          <>
            {/* Awards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {awards.map((aw) => {
                const teamLogoUrl = aw.winner?.team_logo ? proxyImg(aw.winner.team_logo) : null;
                const teamColor = aw.winner?.team_color ?? null;
                const palette = teamColor ? getCardContrastPalette(teamColor) : null;
                const cardStyle = palette
                  ? { backgroundColor: palette.background, borderColor: palette.isBright ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.12)" }
                  : undefined;
                const primary = palette?.primaryText ?? "#f3f4f6";
                const secondary = palette?.secondaryText ?? "rgba(243,244,246,0.85)";
                const muted = palette?.mutedText ?? "rgba(209,213,219,0.85)";
                return (
                  <div
                    key={aw.title}
                    className={`rounded-lg border p-4 flex items-center gap-4 ${palette ? "" : "stat-card-position"}`}
                    style={cardStyle}
                  >
                    {aw.winner ? (
                      <Link
                        href={`/players/${encodeURIComponent(aw.winner.steam_id)}`}
                        className="shrink-0 group"
                      >
                        {aw.winner.avatar ? (
                          <img
                            src={aw.winner.avatar}
                            alt=""
                            className="w-20 h-20 rounded-lg object-cover border border-chalk-100/15 group-hover:border-[#F4119E]/60 transition-colors"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-pitch-700 flex items-center justify-center text-2xl font-display font-700 text-chalk-300 border border-chalk-100/15 group-hover:border-[#F4119E]/60 transition-colors">
                            {aw.winner.username?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                      </Link>
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-pitch-800/60 border border-chalk-100/10 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="wr-elite font-display font-700 text-lg uppercase tracking-wider leading-tight mb-1.5">
                        {aw.title}
                      </div>
                      {aw.winner ? (
                        <>
                          <Link
                            href={`/players/${encodeURIComponent(aw.winner.steam_id)}`}
                            className="font-body text-sm font-medium hover:!text-[#F4119E] transition-colors truncate block"
                            style={{ color: primary }}
                          >
                            {aw.winner.username || aw.winner.steam_id}
                          </Link>
                          <div className="flex items-baseline gap-1 mt-0.5">
                            <span className="font-mono text-sm font-700 tabular-nums" style={{ color: primary }}>
                              {aw.value}
                            </span>
                            <span className="font-mono text-[10px] uppercase" style={{ color: muted }}>
                              {aw.unit}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="text-xs font-mono italic mt-1" style={{ color: muted }}>
                          No qualified player
                        </div>
                      )}
                    </div>
                    {aw.winner?.team_id && (
                      <Link
                        href={`/teams/${aw.winner.team_id}`}
                        className="shrink-0 flex flex-col items-center gap-1 group"
                        title={aw.winner.team_name ?? undefined}
                      >
                        {teamLogoUrl ? (
                          <img
                            src={teamLogoUrl}
                            alt={aw.winner.team_name ?? ""}
                            className="w-14 h-14 object-contain group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded bg-pitch-700/60 border border-chalk-100/10 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300">
                            {aw.winner.team_name?.[0]?.toUpperCase() || "?"}
                          </div>
                        )}
                        <span
                          className="text-[10px] font-mono group-hover:!text-[#F4119E] transition-colors max-w-[80px] truncate"
                          style={{ color: secondary }}
                        >
                          {aw.winner.team_name}
                        </span>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* View + min apps filters */}
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {PLAYER_STAT_VIEWS.map((sv) => (
                  <Link
                    key={sv.key}
                    href={viewUrl(sv.key)}
                    className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${playerView === sv.key ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40" : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"}`}
                  >
                    {sv.label.toUpperCase()}
                  </Link>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono uppercase text-chalk-500 tracking-wider">Min apps</span>
                {MIN_PLAYER_APPS_OPTIONS.map((min) => (
                  <Link
                    key={min}
                    href={minAppsUrl(min)}
                    className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${playerMinApps === min ? "bg-[#F4119E]/15 text-[#F4119E] border border-[#F4119E]/40" : "border border-chalk-100/10 text-chalk-400 hover:border-[#F4119E]/30 hover:text-chalk-200"}`}
                  >
                    {min === 0 ? "ALL" : `${min}+`}
                  </Link>
                ))}
              </div>
            </div>

            {/* Stats table */}
            <div className="rounded-lg border border-chalk-100/8 overflow-x-auto">
              <table className="w-full text-xs whitespace-nowrap">
                <thead>
                  <tr className="border-b border-chalk-100/8 bg-pitch-900/60">
                    <th className="text-left px-3 py-2 font-mono text-[10px] text-chalk-400 w-7">#</th>
                    <th className="text-left px-2 py-2 font-mono text-[10px] text-chalk-400">PLAYER</th>
                    {PLAYER_COLS.map((c) => {
                      const active = c.key === playerSortKey;
                      return (
                        <th key={c.key} className="text-center px-2 py-2 font-mono text-[10px]" title={c.title}>
                          <Link
                            href={sortUrl(c.key)}
                            className={`inline-flex items-center gap-0.5 transition-colors ${active ? "text-[#F4119E]" : "text-chalk-400 hover:text-[#F4119E]"}`}
                          >
                            {c.label}
                            {active && <span>{playerSortOrder === "desc" ? "↓" : "↑"}</span>}
                          </Link>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((r, i) => {
                    const rowIdx = pageStart + i;
                    return (
                      <tr
                        key={r.steam_id}
                        className={`stat-row group ${rowIdx % 2 === 0 ? "trow-odd" : "trow-even"}`}
                      >
                        <td className="px-3 py-1.5 font-mono text-chalk-400 text-center tabular-nums">{rowIdx + 1}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            href={`/players/${encodeURIComponent(r.steam_id)}`}
                            className="flex items-center gap-2 hover:text-[#F4119E] transition-colors text-chalk-100"
                          >
                            {r.avatar ? (
                              <img src={r.avatar} alt="" className="w-6 h-6 rounded object-cover border border-chalk-100/10 shrink-0" />
                            ) : (
                              <div className="w-6 h-6 rounded bg-pitch-700 flex items-center justify-center text-[10px] font-display font-700 text-chalk-300 shrink-0">
                                {r.username?.[0]?.toUpperCase() || "?"}
                              </div>
                            )}
                            <span className="font-body truncate">{r.username || r.steam_id}</span>
                          </Link>
                        </td>
                        {PLAYER_COLS.map((c) => {
                          const active = c.key === playerSortKey;
                          const tone = c.tone ? c.tone(r) : (active ? "text-chalk-100" : "text-chalk-300");
                          return (
                            <td key={c.key} className={`px-2 py-1.5 text-center font-mono tabular-nums ${tone} ${active ? "font-700" : ""}`}>
                              {c.format(r)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <span className="text-xs font-mono text-chalk-400">
                Page {playerPage} of {totalPlayerPages} · {totalPlayers.toLocaleString()} players
              </span>
              <div className="flex items-center gap-1">
                {playerPage > 1 && (
                  <Link href={playerPageUrl(1)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="First page">&laquo;</Link>
                )}
                {playerPage > 1 && (
                  <Link href={playerPageUrl(Math.max(1, playerPage - 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Back 10 pages">&lt;</Link>
                )}
                {Array.from({ length: Math.min(5, totalPlayerPages) }, (_, i) => {
                  let p: number;
                  if (totalPlayerPages <= 5) p = i + 1;
                  else if (playerPage <= 3) p = i + 1;
                  else if (playerPage >= totalPlayerPages - 2) p = totalPlayerPages - 4 + i;
                  else p = playerPage - 2 + i;
                  return (
                    <Link key={p} href={playerPageUrl(p)} className={`w-8 h-8 rounded text-xs font-mono transition-colors flex items-center justify-center ${p === playerPage ? "bg-[#F4119E] text-white font-700" : "text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30"}`}>
                      {p}
                    </Link>
                  );
                })}
                {playerPage < totalPlayerPages && (
                  <Link href={playerPageUrl(Math.min(totalPlayerPages, playerPage + 10))} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Forward 10 pages">&gt;</Link>
                )}
                {playerPage < totalPlayerPages && (
                  <Link href={playerPageUrl(totalPlayerPages)} className="w-8 h-8 rounded text-xs font-mono text-chalk-400 hover:text-chalk-100 border border-chalk-100/10 hover:border-chalk-100/30 flex items-center justify-center" title="Last page">&raquo;</Link>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
